const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    pushToken: { type: String },
    mutedCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    resetPasswordOtp: { type: String },
    resetPasswordOtpExpiry: { type: Date },
    outreachUsage: {
      count: { type: Number, default: 0 },
      resetAt: { type: Date, default: Date.now }, // resets monthly
    },
    resumeData: {
      skills: [{ type: String }],
      jobTitles: [{ type: String }],
      industries: [{ type: String }],
      yearsExperience: { type: Number },
      summary: { type: String }, // 1-2 sentence background for prompts
      uploadedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
