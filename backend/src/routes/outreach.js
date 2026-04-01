const express = require('express');
const { protect } = require('../middleware/auth');
const Company = require('../models/Company');

const router = express.Router();

// ---------------------------------------------------------------------------
// Stub — replace generateWithClaude() with real Claude API call later
// ---------------------------------------------------------------------------
async function generateWithClaude(type, companyName, signals) {
  // TODO: Replace this with the real Claude API call when ready.
  // Example signals passed in:
  //   companyName = "Stripe"
  //   signals = ["10 open roles detected at Stripe", "Stripe is scaling its engineering team (3 open roles)"]
  //   type = "linkedin" | "cold_email" | "followup"

  const topSignals = signals.slice(0, 2).join(' and ');

  const stubs = {
    linkedin: `Hi [Name], I came across ${companyName} and noticed ${topSignals}. I'd love to connect and learn more about the team — your work on [specific area] really stood out to me. Would be great to stay in touch!`,
    cold_email: `Subject: Interested in joining ${companyName}\n\nHi [Name],\n\nI noticed that ${companyName} is growing — ${topSignals}. I've been following your work and I think my background in [your skill] could be a strong fit for your team.\n\nWould you have 15 minutes for a quick call this week?\n\nBest,\n[Your Name]`,
    followup: `Hi [Name], I wanted to follow up on my previous message. I know ${companyName} is busy scaling right now — ${topSignals} — so I'll keep this brief. I'd love to find a time to chat about how I could contribute. Is this week or next any good for you?`,
  };

  return stubs[type] || stubs.linkedin;
}

// POST /api/outreach/generate
router.post('/generate', protect, async (req, res) => {
  try {
    const { companyId, type } = req.body;

    if (!companyId || !type) {
      return res.status(400).json({ message: 'companyId and type are required' });
    }

    const validTypes = ['linkedin', 'cold_email', 'followup'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${validTypes.join(', ')}` });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const signalSummaries = (company.signals || []).map((s) => s.summary);
    const message = await generateWithClaude(type, company.name, signalSummaries);

    res.json({ message, company: company.name, type });
  } catch (err) {
    res.status(500).json({ message: 'Generation failed' });
  }
});

module.exports = router;
