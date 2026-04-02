const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { protect } = require('../middleware/auth');
const Company = require('../models/Company');
const User = require('../models/User');

const router = express.Router();

const FREE_MONTHLY_LIMIT = 3;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Prompt builders — each type gets a tailored system + user prompt
// ---------------------------------------------------------------------------

const TYPE_CONFIG = {
  linkedin: {
    label: 'LinkedIn connection request',
    instructions: (senderName) => `Write a short, genuine LinkedIn connection request message (max 300 characters — LinkedIn's limit).
- Sound like a real person, not a recruiter or bot
- Reference at least one specific hiring signal by name or detail — not just "actively hiring"
- End with a clear but low-pressure reason to connect
- Do NOT use generic phrases like "I came across your profile", "I hope this message finds you well", or "actively hiring right now"
- Do NOT use any placeholder text like [their area], [role], [skill], etc. — the only bracket placeholder allowed is [Name] for the recipient
- Do NOT include a subject line
- Use [Name] for the recipient and sign off with: ${senderName}`,
  },
  cold_email: {
    label: 'cold outreach email',
    instructions: (senderName) => `Write a concise cold outreach email from a job seeker to someone at this company.
- Include a subject line on the first line in the format: Subject: ...
- Keep the body to 3 short paragraphs max
- First paragraph: why you're reaching out (reference the signals naturally)
- Second paragraph: what you bring to the table (use [your background] as the only placeholder — keep it to one bracket phrase)
- Third paragraph: single clear CTA — ask for a 15-min call
- Sign off with: Best,\\n${senderName}
- Sound confident but not desperate
- Do NOT use buzzwords like "synergy", "leverage", "circle back"`,
  },
  followup: {
    label: 'follow-up message',
    instructions: (senderName) => `Write a brief, respectful follow-up message for someone who already sent an initial outreach to this company.
- Acknowledge you've already reached out once — keep it light
- Reference a specific signal detail (e.g. a recent hire, funding, expansion) — not just "still watching your growth"
- Do NOT use any placeholder text like [their area], [role], [skill], etc.
- Keep it to 3-4 sentences max
- End with an easy yes/no question
- Do NOT be passive aggressive or guilt-trip them for not responding
- Works as either a LinkedIn message or email (no subject line needed)
- Use [Name] for the recipient and sign off with: ${senderName}`,
  },
};

async function generateWithClaude(type, companyName, signals, industry, senderName, resumeData) {
  const config = TYPE_CONFIG[type];
  const signalList = signals.slice(0, 4).map((s) => `• ${s}`).join('\n');
  const industryContext = industry ? ` (${industry})` : '';

  const resumeContext = resumeData?.summary
    ? `\nSender background: ${resumeData.summary}${resumeData.skills?.length ? `\nKey skills: ${resumeData.skills.slice(0, 6).join(', ')}` : ''}`
    : '';

  const systemPrompt = `You are an expert career coach helping job seekers write outreach messages that actually get responses. Your messages are specific, human, and signal-aware — they reference real company data to stand out from generic templates.`;

  const userPrompt = `Write a ${config.label} to someone at ${companyName}${industryContext}.

Here are the current hiring signals detected for this company:
${signalList}
${resumeContext}
Instructions:
${config.instructions(senderName)}
${resumeData?.summary ? `- Use the sender's actual background (provided above) instead of generic placeholders like [your background] — weave it in naturally` : ''}
Write only the message itself — no commentary, no "here's the message:", no explanation.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  return response.content[0].text.trim();
}

// ---------------------------------------------------------------------------
// Usage helpers
// ---------------------------------------------------------------------------

function isNewMonth(date) {
  const now = new Date();
  const reset = new Date(date);
  return now.getFullYear() !== reset.getFullYear() || now.getMonth() !== reset.getMonth();
}

async function checkAndIncrementUsage(user) {
  // Reset counter if we're in a new calendar month
  if (!user.outreachUsage || isNewMonth(user.outreachUsage.resetAt)) {
    user.outreachUsage = { count: 0, resetAt: new Date() };
  }

  const isPro = user.plan === 'pro';
  const currentCount = user.outreachUsage.count;

  if (!isPro && currentCount >= FREE_MONTHLY_LIMIT) {
    return { allowed: false, count: currentCount, limit: FREE_MONTHLY_LIMIT };
  }

  user.outreachUsage.count += 1;
  await user.save();

  return { allowed: true, count: user.outreachUsage.count, limit: isPro ? null : FREE_MONTHLY_LIMIT };
}

// ---------------------------------------------------------------------------
// POST /api/outreach/generate
// ---------------------------------------------------------------------------
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

    // Check and enforce usage limits
    const user = await User.findById(req.user._id);
    const usage = await checkAndIncrementUsage(user);

    if (!usage.allowed) {
      return res.status(403).json({
        message: `You've used all ${FREE_MONTHLY_LIMIT} free messages this month. Upgrade to Pro for unlimited outreach.`,
        limitReached: true,
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ message: 'Outreach generation is not configured' });
    }

    const signalSummaries = (company.signals || []).map((s) => s.summary);
    const message = await generateWithClaude(type, company.name, signalSummaries, company.industry, req.user.name, user.resumeData);

    res.json({
      message,
      company: company.name,
      type,
      personalized: !!user.resumeData?.summary,
      usage: { count: usage.count, limit: usage.limit },
    });
  } catch (err) {
    console.error('[outreach] generation error:', err.message);
    res.status(500).json({ message: 'Generation failed. Please try again.' });
  }
});

// GET /api/outreach/usage
// Let the app show current usage without generating
router.get('/usage', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const isPro = user.plan === 'pro';

    let count = user.outreachUsage?.count || 0;
    if (!user.outreachUsage || isNewMonth(user.outreachUsage.resetAt)) {
      count = 0;
    }

    res.json({
      count,
      limit: isPro ? null : FREE_MONTHLY_LIMIT,
      isPro,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
