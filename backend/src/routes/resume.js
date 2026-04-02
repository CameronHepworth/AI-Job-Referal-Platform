const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Store PDF in memory (no disk I/O needed — we just parse and discard)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported'));
    }
  },
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseResumeWithClaude(rawText) {
  const prompt = `Extract structured information from this resume text and return ONLY valid JSON with these exact fields:

{
  "skills": ["skill1", "skill2"],         // top 8 technical/professional skills
  "jobTitles": ["title1", "title2"],      // job titles held, most recent first, max 4
  "industries": ["industry1"],            // industries worked in, max 3
  "yearsExperience": 5,                   // total years of professional experience as a number
  "summary": "..."                        // 1-2 sentences describing their background for use in outreach messages, written in third person as if describing themselves (e.g. "a software engineer with 5 years in fintech...")
}

Resume text:
${rawText.slice(0, 6000)}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  // Strip markdown code fences if Claude wraps in ```json ... ```
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// POST /api/resume — upload and parse a PDF resume
// ---------------------------------------------------------------------------
router.post('/', protect, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Extract text from PDF buffer
    const { text: rawText } = await pdf(req.file.buffer);
    if (!rawText || rawText.trim().length < 100) {
      return res.status(400).json({ message: 'Could not extract text from PDF. Try a text-based PDF (not a scanned image).' });
    }

    // Parse with Claude
    let parsed;
    try {
      parsed = await parseResumeWithClaude(rawText);
    } catch (err) {
      console.error('[resume] Claude parse error:', err.message);
      return res.status(500).json({ message: 'Could not parse resume. Please try again.' });
    }

    // Save to user
    const user = await User.findById(req.user._id);
    user.resumeData = {
      skills: parsed.skills || [],
      jobTitles: parsed.jobTitles || [],
      industries: parsed.industries || [],
      yearsExperience: parsed.yearsExperience || null,
      summary: parsed.summary || '',
      uploadedAt: new Date(),
    };
    await user.save();

    res.json({ resumeData: user.resumeData });
  } catch (err) {
    if (err.message === 'Only PDF files are supported') {
      return res.status(400).json({ message: err.message });
    }
    console.error('[resume] upload error:', err.message);
    res.status(500).json({ message: 'Upload failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/resume — remove resume data
// ---------------------------------------------------------------------------
router.delete('/', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $unset: { resumeData: '' } });
    res.json({ message: 'Resume removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
