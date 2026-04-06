const express = require('express');
const axios = require('axios');
const Company = require('../models/Company');
const { protect } = require('../middleware/auth');
const { enrichCompany } = require('../services/companyEnricher');
const { scanCompany } = require('../services/signalEngine');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function searchClearbit(q) {
  try {
    const res = await axios.get('https://autocomplete.clearbit.com/v1/companies/suggest', {
      params: { query: q },
      timeout: 5000,
    });
    return (res.data || []).slice(0, 10).map((c) => ({
      name: c.name,
      domain: c.domain,
      logoUrl: c.logo || null,
    }));
  } catch (err) {
    console.error('[discover] Clearbit error:', err.message);
    return [];
  }
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

    // Run local DB and Clearbit (when query provided) in parallel
    const [localResults, clearbitResults] = await Promise.all([
      Company.find(dbFilter, projection)
        .sort(query ? { score: { $meta: 'textScore' } } : { hiringScore: -1 })
        .limit(20)
        .lean(),
      query ? searchClearbit(query) : Promise.resolve([]),
    ]);

    // Merge Clearbit results not already in local DB
    const seen = new Set(localResults.map((c) => c.name.toLowerCase()));
    const merged = [...localResults];

    for (const ext of clearbitResults) {
      if (seen.has(ext.name.toLowerCase())) continue;
      seen.add(ext.name.toLowerCase());

      let company = await Company.findOne({ name: new RegExp(`^${escapeRegex(ext.name)}$`, 'i') });
      if (!company) {
        company = await Company.create({ name: ext.name, domain: ext.domain, logoUrl: ext.logoUrl });
        enrichCompany(company).catch(() => {});
      }

      // Apply remaining filters to external results
      if (industry && !company.industry?.match(new RegExp(escapeRegex(industry), 'i'))) continue;
      if (size && company.size && company.size !== size) continue;
      if (hiringOnly && !company.hiringScore) continue;
      if (minScore && (company.hiringScore || 0) < Number(minScore)) continue;

      merged.push(company.toObject ? company.toObject() : company);
      if (merged.length >= 25) break;
    }

    // Background scan companies that haven't been scanned in 24h
    // so score filters work on subsequent searches
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toScan = merged
      .filter((c) => !c.lastScanned || new Date(c.lastScanned) < staleThreshold)
      .slice(0, 5); // cap at 5 per request to avoid overloading

    if (toScan.length > 0) {
      (async () => {
        for (const c of toScan) {
          try {
            const doc = await Company.findById(c._id);
            if (doc) await scanCompany(doc);
          } catch (err) {
            console.error('[discover] bg scan error:', err.message);
          }
        }
      })();
    }

    res.json({ companies: merged });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
