const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'news',
        'job_posting_spike',
        'funding_round',
        'exec_hire',
        'expansion',
        'hn_hiring',
        'headcount_growth',
      ],
    },
    summary: String,
    source: String,
    score: { type: Number, default: 0 }, // 0-100, how strong the signal is
    detectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    domain: { type: String, trim: true, lowercase: true },
    industry: { type: String, trim: true },
    description: { type: String },
    linkedinUrl: { type: String },
    logoUrl: { type: String },
    size: {
      type: String,
      enum: ['startup', 'smb', 'mid', 'enterprise', null],
      default: null,
    },
    jobTypes: [{ type: String }], // e.g. ['engineering', 'sales', 'design']
    remote: { type: Boolean, default: false },
    tags: [{ type: String }], // free-form extra tags e.g. ['B2B', 'SaaS', 'Series B']
    // Overall hiring likelihood score 0-100, recalculated by signal engine
    hiringScore: { type: Number, default: 0 },
    hiringScoreSummary: { type: String }, // AI-generated plain-english summary
    // Latest signals detected
    signals: [signalSchema],
    // When the signal engine last ran for this company
    lastScanned: { type: Date },
    // GitHub org slug for headcount tracking (e.g. 'stripe' for github.com/stripe)
    githubOrg: { type: String, trim: true },
    // Last known GitHub member count — used to detect growth delta
    githubMemberCount: { type: Number, default: null },
  },
  { timestamps: true }
);

companySchema.index({ name: 'text', domain: 1 });

module.exports = mongoose.model('Company', companySchema);
