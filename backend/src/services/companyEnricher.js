const axios = require('axios');

/**
 * Infer company metadata from JSearch job posting data.
 * Called when a new company is created from an external search.
 */
async function enrichCompany(company) {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) return company;

  try {
    const res = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: { query: `${company.name} jobs`, page: '1', num_pages: '1' },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      },
      timeout: 8000,
    });

    const jobs = res.data.data || [];
    if (jobs.length === 0) return company;

    // ---------------------------------------------------------------------------
    // Infer job types from titles
    // ---------------------------------------------------------------------------
    const jobTypeKeywords = {
      engineering: ['engineer', 'developer', 'backend', 'frontend', 'fullstack', 'devops', 'sre', 'architect', 'data scientist', 'ml ', 'machine learning'],
      sales: ['sales', 'account executive', 'account manager', 'business development', 'bdr', 'sdr', 'revenue'],
      design: ['designer', 'ux', 'ui ', 'product design', 'visual design', 'creative'],
      marketing: ['marketing', 'growth', 'content', 'seo', 'brand', 'social media', 'demand gen'],
      operations: ['operations', 'ops', 'logistics', 'supply chain', 'program manager'],
      finance: ['finance', 'accounting', 'controller', 'analyst', 'fp&a', 'treasury'],
      legal: ['legal', 'counsel', 'compliance', 'privacy', 'attorney'],
    };

    const detectedJobTypes = new Set();
    jobs.forEach((job) => {
      const title = (job.job_title || '').toLowerCase();
      Object.entries(jobTypeKeywords).forEach(([type, keywords]) => {
        if (keywords.some((k) => title.includes(k))) detectedJobTypes.add(type);
      });
    });

    // ---------------------------------------------------------------------------
    // Infer size from employee count or company type field
    // ---------------------------------------------------------------------------
    const firstJob = jobs[0];
    let size = null;
    const employerType = (firstJob?.employer_company_type || '').toLowerCase();
    const employeeCount = firstJob?.job_naics_name || '';

    if (employerType.includes('startup') || employerType.includes('seed')) {
      size = 'startup';
    } else if (employerType.includes('small')) {
      size = 'smb';
    } else if (employerType.includes('mid') || employerType.includes('medium')) {
      size = 'mid';
    } else if (employerType.includes('enterprise') || employerType.includes('large')) {
      size = 'enterprise';
    } else {
      // Fall back to job count as a rough proxy
      if (jobs.length >= 15) size = 'enterprise';
      else if (jobs.length >= 8) size = 'mid';
      else if (jobs.length >= 3) size = 'smb';
      else size = 'startup';
    }

    // ---------------------------------------------------------------------------
    // Infer remote from job location fields
    // ---------------------------------------------------------------------------
    const remoteCount = jobs.filter((j) => j.job_is_remote).length;
    const remote = remoteCount > jobs.length / 2;

    // ---------------------------------------------------------------------------
    // Infer industry from NAICS or job titles
    // ---------------------------------------------------------------------------
    let industry = company.industry;
    if (!industry && firstJob?.job_naics_name) {
      const naics = firstJob.job_naics_name.toLowerCase();
      if (naics.includes('software') || naics.includes('tech')) industry = 'Technology';
      else if (naics.includes('financ') || naics.includes('bank')) industry = 'Fintech';
      else if (naics.includes('health') || naics.includes('medical')) industry = 'Healthcare';
      else if (naics.includes('education') || naics.includes('school')) industry = 'Education';
    }

    // ---------------------------------------------------------------------------
    // Build free-form tags
    // ---------------------------------------------------------------------------
    const tags = [];
    const allTitles = jobs.map((j) => (j.job_title || '').toLowerCase()).join(' ');
    if (allTitles.includes('saas') || allTitles.includes('software')) tags.push('SaaS');
    if (allTitles.includes('b2b') || detectedJobTypes.has('sales')) tags.push('B2B');
    if (allTitles.includes('b2c') || detectedJobTypes.has('marketing')) tags.push('B2C');
    if (allTitles.includes('api') || detectedJobTypes.has('engineering')) tags.push('Tech');
    if (remote) tags.push('Remote-friendly');

    // ---------------------------------------------------------------------------
    // Persist enriched data
    // ---------------------------------------------------------------------------
    company.jobTypes = [...detectedJobTypes];
    company.size = size;
    company.remote = remote;
    if (industry) company.industry = industry;
    company.tags = [...new Set(tags)];
    await company.save();

    console.log(`[enricher] Enriched: ${company.name} | size: ${size} | jobTypes: ${[...detectedJobTypes].join(', ')}`);
  } catch (err) {
    console.error(`[enricher] Failed for ${company.name}:`, err.message);
  }

  return company;
}

module.exports = { enrichCompany };
