const express = require('express');
const axios = require('axios');
const Company = require('../models/Company');
const User = require('../models/User');
const Alert = require('../models/Alert');
const { protect } = require('../middleware/auth');
const { scanCompany } = require('../services/signalEngine');
const { enrichCompany } = require('../services/companyEnricher');

// Escape special regex characters to prevent ReDoS / injection
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const router = express.Router();

const FREE_WATCHLIST_LIMIT = 5;

/**
 * Query JSearch for employer names matching the query.
 * Returns an array of unique company names found in job postings.
 */
async function searchExternalCompanies(q) {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: { query: `${q} jobs`, page: '1', num_pages: '1' },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      },
      timeout: 8000,
    });

    const jobs = res.data.data || [];
    // Extract unique employer names that loosely match the query
    const seen = new Set();
    const matches = [];
    const qLower = q.toLowerCase();

    for (const job of jobs) {
      const employer = job.employer_name;
      if (!employer || seen.has(employer)) continue;
      if (employer.toLowerCase().includes(qLower) || qLower.includes(employer.toLowerCase().split(' ')[0].toLowerCase())) {
        seen.add(employer);
        matches.push({
          name: employer,
          logoUrl: job.employer_logo || null,
        });
      }
    }
    return matches.slice(0, 5);
  } catch (err) {
    console.error('[search] JSearch fallback error:', err.message);
    return [];
  }
}

// GET /api/companies/search?q=stripe
router.get('/search', protect, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ message: 'Query is required' });

    // 1. Search local DB first (fast)
    let results = await Company.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .lean();

    // 2. If no local results, fall back to JSearch and auto-create the companies
    if (results.length === 0) {
      const external = await searchExternalCompanies(q);
      for (const ext of external) {
        const existing = await Company.findOne({ name: new RegExp(`^${escapeRegex(ext.name)}$`, 'i') });
        if (existing) {
          // Enrich if missing metadata
          if (!existing.size) {
            await enrichCompany(existing);
          }
          results.push(existing.toObject());
        } else {
          const created = await Company.create({ name: ext.name, logoUrl: ext.logoUrl });
          await enrichCompany(created);
          results.push(created.toObject());
        }
      }
    }

    res.json({ companies: results });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/companies
// Create a new company (admin / seed use — also called when user adds one not in DB)
router.post('/', protect, async (req, res) => {
  try {
    const { name, domain, industry, description, linkedinUrl } = req.body;
    if (!name) return res.status(400).json({ message: 'Company name is required' });

    const existing = await Company.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
    if (existing) return res.json({ company: existing });

    const company = await Company.create({ name, domain, industry, description, linkedinUrl });
    // Enrich in background — don't await so the response is instant
    enrichCompany(company).catch(() => {});
    res.status(201).json({ company });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/companies/:id
// Get a single company with its latest signals
router.get('/:id', protect, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // Check if the current user is watching this company
    const user = await User.findById(req.user._id).select('watchlist');
    const isWatching = user.watchlist.some((id) => id.toString() === company._id.toString());

    res.json({ company, isWatching });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/companies/:id/scan
// Manually trigger a scan for a company (Pro only, or for testing)
router.post('/:id/scan', protect, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const score = await scanCompany(company);
    res.json({ message: 'Scan complete', hiringScore: score, company });
  } catch (err) {
    res.status(500).json({ message: 'Scan failed' });
  }
});

// ---------------------------------------------------------------------------
// Watchlist routes
// ---------------------------------------------------------------------------

// GET /api/companies/watchlist/me
// Get the current user's watchlist with latest signal data
router.get('/watchlist/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('watchlist').lean();
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/companies/:id/watch
// Add a company to the user's watchlist
router.post('/:id/watch', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // Free plan limit
    if (user.plan === 'free' && user.watchlist.length >= FREE_WATCHLIST_LIMIT) {
      return res.status(403).json({
        message: `Free plan is limited to ${FREE_WATCHLIST_LIMIT} watched companies. Upgrade to Pro for unlimited.`,
      });
    }

    if (!user.watchlist.includes(company._id)) {
      user.watchlist.push(company._id);
      await user.save();
    }

    res.json({ message: 'Added to watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/companies/:id/watch
// Remove a company from the user's watchlist
router.delete('/:id/watch', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.watchlist = user.watchlist.filter((id) => id.toString() !== req.params.id);
    await user.save();
    res.json({ message: 'Removed from watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Alerts routes
// ---------------------------------------------------------------------------

// GET /api/companies/alerts/me
// Get all alerts for the current user
router.get('/alerts/me', protect, async (req, res) => {
  try {
    const alerts = await Alert.find({ user: req.user._id })
      .populate('company', 'name logoUrl')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/companies/alerts/:id/read
// Mark an alert as read
router.patch('/alerts/:id/read', protect, async (req, res) => {
  try {
    await Alert.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
