const axios = require('axios');
const Company = require('../models/Company');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { sendPushNotifications } = require('./pushService');

// ---------------------------------------------------------------------------
// 1. News signals — NewsAPI (100 req/day free)
//    Detects: funding rounds, exec hires, expansion news, general hiring news
// ---------------------------------------------------------------------------
async function fetchNewsSignals(company) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `"${company.name}"`,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey,
      },
      timeout: 8000,
    });

    const articles = res.data.articles || [];
    const companyRegex = new RegExp(
      `\\b${company.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i'
    );

    const signals = [];

    for (const a of articles) {
      const title = (a.title || '').toLowerCase();

      // Skip articles where the company name isn't in the title
      if (!companyRegex.test(a.title || '')) continue;

      // --- Funding round (highest priority news signal) ---
      const fundingKeywords = [
        'series a', 'series b', 'series c', 'series d',
        'seed round', 'raises $', 'raises €', 'funding round',
        'valued at', 'valuation', 'ipo', 'spac', 'went public',
      ];
      if (fundingKeywords.some((k) => title.includes(k))) {
        signals.push({
          type: 'funding_round',
          summary: a.title,
          source: a.url,
          score: 60,
          detectedAt: new Date(a.publishedAt),
        });
        continue;
      }

      // --- Executive hire (strong referral-hiring predictor) ---
      const execKeywords = [
        'appoints', 'names new', 'joins as', 'hires head of',
        'new cto', 'new cpo', 'new coo', 'new cfo', 'new cmo',
        'new vp', 'vp of engineering', 'vp of sales', 'vp of product',
        'chief executive', 'chief technology', 'chief product',
      ];
      if (execKeywords.some((k) => title.includes(k))) {
        signals.push({
          type: 'exec_hire',
          summary: a.title,
          source: a.url,
          score: 50,
          detectedAt: new Date(a.publishedAt),
        });
        continue;
      }

      // --- Expansion / product launch ---
      const expansionKeywords = [
        'launches', 'expands to', 'new office', 'opens in',
        'partnership with', 'acquires', 'acquisition', 'new product',
        'enters', 'expansion',
      ];
      if (expansionKeywords.some((k) => title.includes(k))) {
        signals.push({
          type: 'expansion',
          summary: a.title,
          source: a.url,
          score: 30,
          detectedAt: new Date(a.publishedAt),
        });
        continue;
      }

      // --- General hiring news ---
      const hiringKeywords = [
        'hiring', 'headcount', 'growth', 'jobs', 'layoffs',
        'workforce', 'employees', 'recruits',
      ];
      if (hiringKeywords.some((k) => title.includes(k))) {
        signals.push({
          type: 'news',
          summary: a.title,
          source: a.url,
          score: 20,
          detectedAt: new Date(a.publishedAt),
        });
      }
    }

    return signals;
  } catch (err) {
    console.error(`[signalEngine] NewsAPI error for ${company.name}:`, err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. Job posting signals — JSearch via RapidAPI (200 req/month free)
//    Detects: posting volume + department-level hiring spikes
// ---------------------------------------------------------------------------
async function fetchJobPostingSignals(company) {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query: `${company.name} jobs`,
        page: '1',
        num_pages: '1',
      },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      },
      timeout: 8000,
    });

    const jobs = res.data.data || [];
    if (jobs.length === 0) return [];

    const deptCounts = {};
    const deptKeywords = {
      engineering: ['engineer', 'developer', 'backend', 'frontend', 'fullstack', 'devops', 'sre', 'software'],
      sales: ['sales', 'account executive', 'business development', 'bdr', 'sdr', 'revenue'],
      product: ['product manager', 'product designer', 'ux', 'ui', 'product owner'],
      marketing: ['marketing', 'growth', 'content', 'seo', 'brand', 'demand gen'],
      operations: ['operations', 'ops', 'supply chain', 'logistics', 'program manager'],
    };

    jobs.forEach((job) => {
      const title = (job.job_title || '').toLowerCase();
      Object.entries(deptKeywords).forEach(([dept, keywords]) => {
        if (keywords.some((k) => title.includes(k))) {
          deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        }
      });
    });

    const signals = [];
    const PAGE_LIMIT = 10;
    const countLabel = jobs.length >= PAGE_LIMIT ? `${jobs.length}+` : `${jobs.length}`;
    const score = Math.min(jobs.length * 8, 60);

    signals.push({
      type: 'job_posting_spike',
      summary: `${countLabel} open role${jobs.length > 1 ? 's' : ''} detected at ${company.name}`,
      source: `https://www.google.com/search?q=${encodeURIComponent(company.name + ' jobs')}`,
      score,
      detectedAt: new Date(),
    });

    Object.entries(deptCounts).forEach(([dept, count]) => {
      if (count >= 3) {
        signals.push({
          type: 'job_posting_spike',
          summary: `${company.name} is scaling its ${dept} team (${count} open roles)`,
          source: `https://www.google.com/search?q=${encodeURIComponent(company.name + ' ' + dept + ' jobs')}`,
          score: Math.min(count * 12, 50),
          detectedAt: new Date(),
        });
      }
    });

    return signals;
  } catch (err) {
    console.error(`[signalEngine] JSearch error for ${company.name}:`, err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 3. Hacker News "Who is Hiring" signals — free, no API key needed
//    Scrapes the monthly HN hiring thread for company mentions
// ---------------------------------------------------------------------------

// Cache the HN thread id + comments for the current month so we don't
// re-fetch it for every company in the same batch scan.
let hnCache = { monthKey: null, comments: [] };

async function getHNHiringComments() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  if (hnCache.monthKey === monthKey && hnCache.comments.length > 0) {
    return hnCache.comments;
  }

  try {
    // HN "Ask HN: Who is hiring?" threads are posted by user 'whoishiring' monthly
    // Search for the latest thread
    const searchRes = await axios.get(
      'https://hn.algolia.com/api/v1/search?query=Ask+HN%3A+Who+is+hiring%3F&tags=story,author_whoishiring&hitsPerPage=1',
      { timeout: 8000 }
    );

    const hits = searchRes.data.hits || [];
    if (!hits.length) return [];

    const threadId = hits[0].objectID;

    // Fetch all top-level comments (job posts) from the thread
    const threadRes = await axios.get(
      `https://hn.algolia.com/api/v1/items/${threadId}`,
      { timeout: 10000 }
    );

    const children = threadRes.data.children || [];
    const comments = children
      .filter((c) => c.text)
      .map((c) => c.text.toLowerCase());

    hnCache = { monthKey, comments };
    return comments;
  } catch (err) {
    console.error('[signalEngine] HN fetch error:', err.message);
    return [];
  }
}

async function fetchHNSignals(company) {
  try {
    const comments = await getHNHiringComments();
    if (!comments.length) return [];

    const matchingComments = comments.filter((text) => {
      // Match the exact company name as a word (avoids e.g. "Stripe" matching "Stripechat")
      const regex = new RegExp(`\\b${company.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(text);
    });

    if (matchingComments.length === 0) return [];

    return [{
      type: 'hn_hiring',
      summary: `${company.name} is actively hiring on Hacker News "Who is Hiring" this month`,
      source: 'https://news.ycombinator.com/ask',
      score: 55,
      detectedAt: new Date(),
    }];
  } catch (err) {
    console.error(`[signalEngine] HN signal error for ${company.name}:`, err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 4. GitHub headcount growth — free (60 req/hour unauth, 5000/hour with token)
//    Compares current org member count to stored value to detect team growth
// ---------------------------------------------------------------------------
async function fetchGitHubSignals(company) {
  // Only run if a GitHub org slug is stored on the company
  if (!company.githubOrg) return [];

  const token = process.env.GITHUB_TOKEN;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    // GitHub doesn't expose exact member counts without auth for private members,
    // but public member counts are available via the org endpoint
    const orgRes = await axios.get(
      `https://api.github.com/orgs/${company.githubOrg}`,
      { headers, timeout: 8000 }
    );

    const currentCount = orgRes.data.public_members_url
      ? await getOrgMemberCount(company.githubOrg, headers)
      : null;

    if (currentCount === null) return [];

    const signals = [];
    const previousCount = company.githubMemberCount;

    if (previousCount && currentCount > previousCount) {
      const delta = currentCount - previousCount;
      const pct = Math.round((delta / previousCount) * 100);

      if (pct >= 5) {
        signals.push({
          type: 'headcount_growth',
          summary: `${company.name}'s engineering team grew by ${delta} members (+${pct}%) since last scan`,
          source: `https://github.com/${company.githubOrg}`,
          score: Math.min(pct * 2, 65),
          detectedAt: new Date(),
        });
      }
    } else if (!previousCount && currentCount > 0) {
      // First time we've seen this — just record baseline, no signal yet
    }

    // Update stored count
    company.githubMemberCount = currentCount;

    return signals;
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error(`[signalEngine] GitHub error for ${company.githubOrg}:`, err.message);
    }
    return [];
  }
}

async function getOrgMemberCount(org, headers) {
  try {
    // Paginate to count public members
    let page = 1;
    let total = 0;
    while (true) {
      const res = await axios.get(
        `https://api.github.com/orgs/${org}/public_members?per_page=100&page=${page}`,
        { headers, timeout: 8000 }
      );
      const members = res.data || [];
      total += members.length;
      if (members.length < 100) break;
      page++;
      if (page > 10) break; // cap at 1000 members to avoid rate limits
    }
    return total;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Score calculator
// ---------------------------------------------------------------------------

// Maximum points each signal TYPE can contribute to the total score.
// This prevents large companies (Amazon, Google) from auto-maxing just
// because they have hundreds of job postings or lots of news coverage.
// A company needs signals across MULTIPLE categories to score high.
const TYPE_CAPS = {
  job_posting_spike: 35, // Lots of postings is expected for big corps — capped low
  funding_round:     30, // One strong funding signal
  exec_hire:         25, // One exec hire
  hn_hiring:         25, // Actively on HN hiring thread
  headcount_growth:  25, // GitHub team growth
  expansion:         15, // Product/geo expansion news
  news:              10, // Generic news — weakest
};

// Max achievable score = sum of all caps = 165, scaled down to 100.
// So a company needs genuinely diverse signals to hit 70+.
const MAX_RAW = Object.values(TYPE_CAPS).reduce((a, b) => a + b, 0); // 165

function calculateHiringScore(signals) {
  if (!signals.length) return 0;

  // Group signals by type and take the best signal per type (no stacking)
  const bestPerType = {};
  for (const s of signals) {
    if (!bestPerType[s.type] || s.score > bestPerType[s.type]) {
      bestPerType[s.type] = s.score;
    }
  }

  // Apply per-type cap, then sum
  const raw = Object.entries(bestPerType).reduce((sum, [type, score]) => {
    const cap = TYPE_CAPS[type] ?? 10;
    return sum + Math.min(score, cap);
  }, 0);

  // Scale to 0-100
  return Math.min(Math.round((raw / MAX_RAW) * 100), 100);
}

function buildScoreSummary(signals, companyName) {
  if (!signals.length) return 'No strong hiring signals detected recently.';

  const top = [...signals].sort((a, b) => b.score - a.score).slice(0, 3);
  const lines = top.map((s) => `• ${s.summary}`).join('\n');
  return `${companyName} is showing hiring signals:\n${lines}`;
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

async function scanCompany(company) {
  console.log(`[signalEngine] Scanning: ${company.name}`);

  const [newsSignals, jobSignals, hnSignals, githubSignals] = await Promise.all([
    fetchNewsSignals(company),
    fetchJobPostingSignals(company),
    fetchHNSignals(company),
    fetchGitHubSignals(company),
  ]);

  const allSignals = [...jobSignals, ...hnSignals, ...githubSignals, ...newsSignals];
  const hiringScore = calculateHiringScore(allSignals);
  const hiringScoreSummary = buildScoreSummary(allSignals, company.name);

  company.signals = allSignals.slice(0, 10);
  company.hiringScore = hiringScore;
  company.hiringScoreSummary = hiringScoreSummary;
  company.lastScanned = new Date();
  await company.save();

  if (hiringScore >= 40) {
    await createAlertsForWatchers(company, hiringScore, hiringScoreSummary);
  }

  return hiringScore;
}

async function createAlertsForWatchers(company, score, summary) {
  const watchers = await User.find({ watchlist: company._id }).select('_id pushToken mutedCompanies');
  if (!watchers.length) return;

  const title = `${company.name} is hiring`;
  const pushTokens = [];

  for (const watcher of watchers) {
    // Skip if this user has muted alerts for this company
    const isMuted = (watcher.mutedCompanies || []).some(
      (id) => id.toString() === company._id.toString()
    );
    if (isMuted) continue;

    const recent = await Alert.findOne({
      user: watcher._id,
      company: company._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (!recent) {
      await Alert.create({
        user: watcher._id,
        company: company._id,
        type: score >= 70 ? 'hiring_spike' : 'news',
        title,
        body: summary,
        score,
      });
      if (watcher.pushToken) pushTokens.push(watcher.pushToken);
    }
  }

  if (pushTokens.length > 0) {
    await sendPushNotifications(
      pushTokens,
      title,
      `Hiring score: ${score} — tap to view signals`,
      { companyId: company._id.toString() }
    );
  }
}

// ---------------------------------------------------------------------------
// Batch runner — called by cron
// ---------------------------------------------------------------------------

async function runSignalScan() {
  console.log('[signalEngine] Starting full scan...');

  const watchedIds = await User.distinct('watchlist');
  if (!watchedIds.length) {
    console.log('[signalEngine] No watched companies, skipping.');
    return;
  }

  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const companies = await Company.find({
    _id: { $in: watchedIds },
    $or: [{ lastScanned: { $lt: cutoff } }, { lastScanned: null }],
  });

  console.log(`[signalEngine] Scanning ${companies.length} companies.`);

  for (const company of companies) {
    await scanCompany(company);
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('[signalEngine] Scan complete.');
}

module.exports = { runSignalScan, scanCompany };
