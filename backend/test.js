/**
 * Phase 1 test script
 * Run with: node test.js
 * Make sure the backend is running first (npm run dev)
 */

require('dotenv').config();
const axios = require('axios');

const BASE = 'http://localhost:3000';
const TEST_EMAIL = 'test_phase1@test.com';
const TEST_PASS = 'password123';

let token = '';
let companyId = '';

async function run() {
  console.log('\n====== Phase 1 Backend Tests ======\n');

  // 1. Register a test user (will fail gracefully if already exists)
  console.log('1. Registering test user...');
  try {
    const res = await axios.post(`${BASE}/api/auth/register`, {
      name: 'Test User',
      email: TEST_EMAIL,
      password: TEST_PASS,
    });
    token = res.data.token;
    console.log('   ✓ Registered:', res.data.user.email);
  } catch {
    // Already exists — login instead
    const res = await axios.post(`${BASE}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASS,
    });
    token = res.data.token;
    console.log('   ✓ Logged in:', res.data.user.email);
  }

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // 2. Create a company
  console.log('\n2. Creating company (Stripe)...');
  const createRes = await axios.post(`${BASE}/api/companies`, { name: 'Stripe', domain: 'stripe.com' }, auth);
  companyId = createRes.data.company._id;
  console.log('   ✓ Company created:', createRes.data.company.name, '| ID:', companyId);

  // 3. Add to watchlist
  console.log('\n3. Adding Stripe to watchlist...');
  const watchRes = await axios.post(`${BASE}/api/companies/${companyId}/watch`, {}, auth);
  console.log('   ✓ Watchlist size:', watchRes.data.watchlist.length);

  // 4. Fetch watchlist
  console.log('\n4. Fetching watchlist...');
  const listRes = await axios.get(`${BASE}/api/companies/watchlist/me`, auth);
  console.log('   ✓ Companies in watchlist:', listRes.data.watchlist.map(c => c.name).join(', '));

  // 5a. Debug raw API responses
  console.log('\n5a. Raw NewsAPI response...');
  const newsRaw = await axios.get('https://newsapi.org/v2/everything', {
    params: {
      q: '"Stripe" AND (hiring OR funding OR expansion OR growth)',
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 5,
      apiKey: process.env.NEWS_API_KEY,
    },
  });
  console.log('   Total results from NewsAPI:', newsRaw.data.totalResults);
  console.log('   Articles returned:', newsRaw.data.articles.length);
  newsRaw.data.articles.forEach((a, i) => console.log(`   [${i+1}] ${a.title}`));

  console.log('\n5b. Raw JSearch response...');
  const jobsRaw = await axios.get('https://jsearch.p.rapidapi.com/search', {
    params: { query: 'Stripe jobs', page: '1', num_pages: '1' },
    headers: {
      'x-rapidapi-key': process.env.JSEARCH_API_KEY,
      'x-rapidapi-host': 'jsearch.p.rapidapi.com',
    },
  });
  console.log('   Jobs returned:', (jobsRaw.data.data || []).length);
  (jobsRaw.data.data || []).slice(0, 3).forEach((j, i) => console.log(`   [${i+1}] ${j.job_title} @ ${j.employer_name}`));

  // 5. Trigger a manual signal scan
  console.log('\n5. Triggering signal scan for Stripe...');
  console.log('   (this calls NewsAPI + JSearch — may take a few seconds)');
  const scanRes = await axios.post(`${BASE}/api/companies/${companyId}/scan`, {}, auth);
  console.log('   ✓ Hiring score:', scanRes.data.hiringScore);
  console.log('   ✓ Summary:\n  ', scanRes.data.company.hiringScoreSummary);
  console.log('   ✓ Signals detected:', scanRes.data.company.signals.length);

  // 6. Check alerts
  console.log('\n6. Checking alerts...');
  const alertRes = await axios.get(`${BASE}/api/companies/alerts/me`, auth);
  console.log('   ✓ Alerts created:', alertRes.data.alerts.length);
  if (alertRes.data.alerts.length > 0) {
    console.log('   ✓ First alert:', alertRes.data.alerts[0].title);
  }

  // 7. Remove from watchlist
  console.log('\n7. Removing Stripe from watchlist...');
  const removeRes = await axios.delete(`${BASE}/api/companies/${companyId}/watch`, auth);
  console.log('   ✓ Watchlist size after remove:', removeRes.data.watchlist.length);

  console.log('\n====== All tests passed ✓ ======\n');
}

run().catch((err) => {
  const msg = err?.response?.data || err.message;
  console.error('\n✗ Test failed:', JSON.stringify(msg, null, 2));
  process.exit(1);
});
