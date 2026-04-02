const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/user/me
router.get('/me', protect, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      plan: req.user.plan,
      mutedCompanies: req.user.mutedCompanies || [],
      resumeData: req.user.resumeData || null,
    },
  });
});

// POST /api/user/plan
// Called by the app after a successful RevenueCat purchase to sync plan to DB
router.post('/plan', protect, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'pro'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan' });
    }
    await User.findByIdAndUpdate(req.user._id, { plan });
    res.json({ message: 'Plan updated', plan });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/user/profile
// Update name and/or email
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.length > 100) {
        return res.status(400).json({ message: 'Invalid name' });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return res.status(400).json({ message: 'Invalid email address' });
      }
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user._id } });
      if (existing) return res.status(409).json({ message: 'Email already in use' });
      updates.email = email.toLowerCase().trim();
    }

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ user: { id: updated._id, name: updated.name, email: updated.email, plan: updated.plan } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/user/account
// Permanently delete the user's account and all their data
router.delete('/account', protect, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required to delete account' });

    const user = await User.findById(req.user._id);
    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ message: 'Incorrect password' });

    // Remove watchlist alerts and the user document
    const Alert = require('../models/Alert');
    await Alert.deleteMany({ user: req.user._id });
    await User.findByIdAndDelete(req.user._id);

    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/user/mute/:companyId
// Toggle alert muting for a specific company
router.post('/mute/:companyId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const companyId = req.params.companyId;
    const isMuted = user.mutedCompanies.some((id) => id.toString() === companyId);

    if (isMuted) {
      user.mutedCompanies = user.mutedCompanies.filter((id) => id.toString() !== companyId);
    } else {
      user.mutedCompanies.push(companyId);
    }

    await user.save();
    res.json({ muted: !isMuted, mutedCompanies: user.mutedCompanies });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/user/push-token
// Save the device's Expo push token so the signal engine can send notifications
router.post('/push-token', protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    await User.findByIdAndUpdate(req.user._id, { pushToken: token });
    res.json({ message: 'Push token saved' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
