const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: {
      type: String,
      enum: ['hiring_spike', 'funding_round', 'headcount_growth', 'executive_hire', 'news'],
      required: true,
    },
    title: { type: String, required: true },   // Short headline
    body: { type: String, required: true },     // Full summary
    score: { type: Number, default: 0 },        // Signal strength at time of alert
    read: { type: Boolean, default: false },
    pushSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

alertSchema.index({ user: 1, read: 1 });
alertSchema.index({ user: 1, company: 1 });

module.exports = mongoose.model('Alert', alertSchema);
