const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Store PDF in memory (no disk I/O needed — we just parse and discard)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Wrap multer in a promise so we can catch its errors inside the route handler
function runMulter(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('resume')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function parsePdf(buffer) {
  // Import inline to avoid pdf-parse test-file side-effect on require
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const result = await pdfParse(buffer);
  return result.text;
}

async function parseResumeWithClaude(rawText) {
  const prompt = `Extract structured information from this resume text and return ONLY valid JSON with these exact fields:

{
  "skills": ["skill1", "skill2"],
  "jobTitles": ["title1", "title2"],
  "industries": ["industry1"],
  "yearsExperience": 5,
  "summary": "1-2 sentences describing their background in third person for use in outreach messages (e.g. a software engineer with 5 years in fintech...)"
}

Resume text:
${rawText.slice(0, 6000)}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// POST /api/resume — upload and parse a PDF resume
// ---------------------------------------------------------------------------
router.post('/', protect, async (req, res) => {
  // Run multer and catch its errors (size limit, wrong field name, etc.)
  try {
    await runMulter(req, res);
  } catch (err) {
    console.error('[resume] multer error:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5 MB.' });
    }
    return res.status(400).json({ message: err.message || 'File upload failed.' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file received. Make sure you are uploading a PDF.' });
    }

    console.log('[resume] received file:', req.file.originalname, req.file.mimetype, req.file.size);

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'Only PDF files are supported.' });
    }

    // Extract text from PDF buffer
    let rawText;
    try {
      rawText = await parsePdf(req.file.buffer);
    } catch (err) {
      console.error('[resume] pdf-parse error:', err.message);
      return res.status(400).json({ message: 'Could not read PDF. Try a different file.' });
    }

    if (!rawText || rawText.trim().length < 100) {
      return res.status(400).json({ message: 'Could not extract text from PDF. Try a text-based PDF (not a scanned image).' });
    }

    console.log('[resume] extracted text length:', rawText.length);

    // Parse with Claude
    let parsed;
    try {
      parsed = await parseResumeWithClaude(rawText);
    } catch (err) {
      console.error('[resume] Claude parse error:', err.message);
      return res.status(500).json({ message: 'Could not parse resume. Please try again.' });
    }

    console.log('[resume] parsed successfully:', JSON.stringify(parsed).slice(0, 200));

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
    console.error('[resume] upload error:', err.message, err.stack);
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
