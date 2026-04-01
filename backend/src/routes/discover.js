const express = require('express');
const axios = require('axios');
const Company = require('../models/Company');
const { protect } = require('../middleware/auth');
const { enrichCompany } = require('../services/companyEnricher');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const router = express.Router();

/**
 * POST /api/discover
 * Search for companies using filters. Checks local DB first,
 * then falls back to JSearch for external results.
 */
router.post('/', protect, async (req, res) => {
  try {
    const {
      query = '',
      industry,
      size,         // 'startup', 'smb', 'mid', 'enterprise'
      jobType,      // 'engineering', 'sales', 'design', 'marketing', 'operations', 'finance', 'legal'
      hiringOnly,   // boolean — only return companies with hiringScore > 0
      minScore,     // number
    } = req.body;

    // ---------------------------------------------------------------------------
    // 1. Local DB filter
    // ---------------------------------------------------------------------------
    const dbFilter = {};

    if (query) {
      dbFilter.$text = { $search: query };
    }

    if (industry) {
      dbFilter.industry = new RegExp(escapeRegex(industry), 'i');
    }

    if (size) {
      dbFilter.size = size;
    }

    if (jobType) {
      dbFilter.jobTypes = jobType;
    }

    if (hiringOnly) {
      dbFilter.hiringScore = { $gt: 0 };
    }

    if (minScore) {
      dbFilter.hiringScore = { ...(dbFilter.hiringScore || {}), $gte: Number(minScore) };
    }

    let projection = {};
    if (query) projection = { score: { $meta: 'textScore' } };

    let localResults = await Company.find(dbFilter, projection)
      .sort(query ? { score: { $meta: 'textScore' } } : { hiringScore: -1 })
      .limit(20)
      .lean();

    // ---------------------------------------------------------------------------
    // 2. JSearch fallback if not enough local results and a query/jobType provided
    // ---------------------------------------------------------------------------
    if (localResults.length < 5 && (query || jobType)) {
      const searchQuery = [query, jobType, 'jobs'].filter(Boolean).join(' ');
      const apiKey = process.env.JSEARCH_API_KEY;

      if (apiKey) {
        try {
          const jRes = await axios.get('https://jsearch.p.rapidapi.com/search', {
            params: { query: searchQuery, page: '1', num_pages: '1' },
            headers: {
              'x-rapidapi-key': apiKey,
              'x-rapidapi-host': 'jsearch.p.rapidapi.com',
            },
            timeout: 8000,
          });

          const jobs = jRes.data.data || [];
          const seen = new Set(localResults.map((c) => c.name.toLowerCase()));

          for (const job of jobs) {
            const name = job.employer_name;
            if (!name || seen.has(name.toLowerCase())) continue;

            // Apply size filter heuristically if provided
            if (size && job.employer_company_type) {
              const type = job.employer_company_type.toLowerCase();
              if (size === 'startup' && !type.includes('startup')) continue;
              if (size === 'enterprise' && type.includes('startup')) continue;
            }

            seen.add(name.toLowerCase());

            // Upsert into DB so future searches are faster
            let company = await Company.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
            if (!company) {
              company = await Company.create({ name, logoUrl: job.employer_logo || null });
              await enrichCompany(company);
            } else if (!company.size) {
              await enrichCompany(company);
            }

            localResults.push(company.toObject());
            if (localResults.length >= 20) break;
          }
        } catch (err) {
          console.error('[discover] JSearch error:', err.message);
        }
      }
    }

    res.json({ companies: localResults });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
