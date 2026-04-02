require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const companiesRoutes = require('./routes/companies');
const outreachRoutes = require('./routes/outreach');
const discoverRoutes = require('./routes/discover');
const resumeRoutes = require('./routes/resume');
const { startSignalCron } = require('./jobs/signalCron');

const app = express();

// Trust Railway's proxy so rate limiting uses the real client IP
app.set('trust proxy', 1);

// Security headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet());

// Restrict CORS to your deployed app domain — update ALLOWED_ORIGIN in .env for production
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

app.use(express.json({ type: '*/*' }));

// Strip $ and . from request bodies to prevent MongoDB operator injection
app.use((req, _res, next) => {
  if (req.body) req.body = mongoSanitize(req.body);
  if (req.query) req.query = mongoSanitize(req.query);
  next();
});

// Global rate limit — 100 requests per 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
}));

// Stricter rate limit on auth endpoints — 10 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/resume', resumeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startSignalCron();
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
