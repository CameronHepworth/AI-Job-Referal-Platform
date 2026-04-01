require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Company = require('../models/Company');

const companies = [
  // Tech — Enterprise
  { name: 'Google', domain: 'google.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'sales', 'marketing', 'design', 'operations'], remote: true, tags: ['B2B', 'B2C', 'SaaS', 'Public'] },
  { name: 'Apple', domain: 'apple.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'design', 'marketing', 'operations'], remote: false, tags: ['B2C', 'Hardware', 'Public'] },
  { name: 'Microsoft', domain: 'microsoft.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'sales', 'marketing', 'finance'], remote: true, tags: ['B2B', 'SaaS', 'Cloud', 'Public'] },
  { name: 'Meta', domain: 'meta.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'design', 'marketing', 'operations'], remote: true, tags: ['B2C', 'Social', 'Public'] },
  { name: 'Amazon', domain: 'amazon.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'operations', 'sales', 'finance'], remote: true, tags: ['B2B', 'B2C', 'Cloud', 'Public'] },
  { name: 'Salesforce', domain: 'salesforce.com', industry: 'Technology', size: 'enterprise', jobTypes: ['sales', 'engineering', 'marketing'], remote: true, tags: ['B2B', 'SaaS', 'CRM', 'Public'] },
  { name: 'Adobe', domain: 'adobe.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'design', 'marketing', 'sales'], remote: true, tags: ['B2B', 'SaaS', 'Creative', 'Public'] },
  { name: 'Atlassian', domain: 'atlassian.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'design', 'sales'], remote: true, tags: ['B2B', 'SaaS', 'Public'] },

  // Tech — Mid
  { name: 'Netflix', domain: 'netflix.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'design', 'marketing', 'operations'], remote: true, tags: ['B2C', 'Streaming', 'Public'] },
  { name: 'Spotify', domain: 'spotify.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2C', 'Audio', 'Public'] },
  { name: 'Shopify', domain: 'shopify.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'design', 'marketing'], remote: true, tags: ['B2B', 'SaaS', 'eCommerce', 'Public'] },
  { name: 'Twilio', domain: 'twilio.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'SaaS', 'API', 'Public'] },
  { name: 'Zoom', domain: 'zoom.us', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'SaaS', 'Public'] },
  { name: 'Slack', domain: 'slack.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'design'], remote: true, tags: ['B2B', 'SaaS', 'Collaboration'] },
  { name: 'Cloudflare', domain: 'cloudflare.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'SaaS', 'Security', 'Public'] },
  { name: 'Snowflake', domain: 'snowflake.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'SaaS', 'Data', 'Public'] },
  { name: 'Palantir', domain: 'palantir.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'operations'], remote: false, tags: ['B2B', 'Data', 'Defence', 'Public'] },
  { name: 'GitHub', domain: 'github.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'design', 'sales'], remote: true, tags: ['B2B', 'Developer Tools', 'SaaS'] },
  { name: 'GitLab', domain: 'gitlab.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'Developer Tools', 'SaaS', 'Public'] },

  // Tech — Startup
  { name: 'Airbnb', domain: 'airbnb.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'design', 'marketing', 'operations'], remote: true, tags: ['B2C', 'Marketplace', 'Public'] },
  { name: 'Uber', domain: 'uber.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'operations', 'marketing', 'legal'], remote: false, tags: ['B2C', 'Marketplace', 'Public'] },
  { name: 'Lyft', domain: 'lyft.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'operations', 'marketing'], remote: false, tags: ['B2C', 'Marketplace', 'Public'] },
  { name: 'DoorDash', domain: 'doordash.com', industry: 'Food Tech', size: 'mid', jobTypes: ['engineering', 'operations', 'marketing', 'sales'], remote: false, tags: ['B2C', 'Marketplace', 'Public'] },
  { name: 'Instacart', domain: 'instacart.com', industry: 'Food Tech', size: 'mid', jobTypes: ['engineering', 'operations', 'marketing'], remote: false, tags: ['B2C', 'Marketplace', 'Public'] },
  { name: 'Discord', domain: 'discord.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2C', 'Social', 'Gaming'] },
  { name: 'Reddit', domain: 'reddit.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'design', 'marketing', 'sales'], remote: true, tags: ['B2C', 'Social', 'Public'] },
  { name: 'Twitter', domain: 'twitter.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2C', 'Social', 'Public'] },
  { name: 'LinkedIn', domain: 'linkedin.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'B2C', 'Social', 'SaaS'] },
  { name: 'Notion', domain: 'notion.so', industry: 'Technology', size: 'startup', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2B', 'B2C', 'SaaS', 'Productivity'] },
  { name: 'Figma', domain: 'figma.com', industry: 'Technology', size: 'smb', jobTypes: ['engineering', 'design', 'sales'], remote: true, tags: ['B2B', 'SaaS', 'Design Tools'] },
  { name: 'Airtable', domain: 'airtable.com', industry: 'Technology', size: 'smb', jobTypes: ['engineering', 'sales', 'design'], remote: true, tags: ['B2B', 'SaaS', 'No-code'] },
  { name: 'Canva', domain: 'canva.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2B', 'B2C', 'SaaS', 'Design Tools'] },
  { name: 'Vercel', domain: 'vercel.com', industry: 'Technology', size: 'startup', jobTypes: ['engineering', 'sales', 'design'], remote: true, tags: ['B2B', 'Developer Tools', 'SaaS'] },
  { name: 'Linear', domain: 'linear.app', industry: 'Technology', size: 'startup', jobTypes: ['engineering', 'design'], remote: true, tags: ['B2B', 'SaaS', 'Developer Tools'] },
  { name: 'Retool', domain: 'retool.com', industry: 'Technology', size: 'startup', jobTypes: ['engineering', 'sales'], remote: true, tags: ['B2B', 'SaaS', 'No-code'] },
  { name: 'HashiCorp', domain: 'hashicorp.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'Developer Tools', 'Open Source', 'Public'] },
  { name: 'Databricks', domain: 'databricks.com', industry: 'Technology', size: 'mid', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'SaaS', 'Data', 'AI'] },

  // AI
  { name: 'OpenAI', domain: 'openai.com', industry: 'Artificial Intelligence', size: 'smb', jobTypes: ['engineering', 'design', 'operations', 'legal'], remote: false, tags: ['B2B', 'B2C', 'AI', 'Research'] },
  { name: 'Anthropic', domain: 'anthropic.com', industry: 'Artificial Intelligence', size: 'smb', jobTypes: ['engineering', 'operations', 'legal'], remote: false, tags: ['B2B', 'AI', 'Research', 'Safety'] },
  { name: 'DeepMind', domain: 'deepmind.com', industry: 'Artificial Intelligence', size: 'smb', jobTypes: ['engineering', 'operations'], remote: false, tags: ['AI', 'Research'] },
  { name: 'Hugging Face', domain: 'huggingface.co', industry: 'Artificial Intelligence', size: 'startup', jobTypes: ['engineering', 'sales'], remote: true, tags: ['B2B', 'AI', 'Open Source', 'SaaS'] },
  { name: 'Scale AI', domain: 'scale.com', industry: 'Artificial Intelligence', size: 'smb', jobTypes: ['engineering', 'operations', 'sales'], remote: false, tags: ['B2B', 'AI', 'Data'] },
  { name: 'Cohere', domain: 'cohere.com', industry: 'Artificial Intelligence', size: 'startup', jobTypes: ['engineering', 'sales'], remote: true, tags: ['B2B', 'AI', 'SaaS'] },
  { name: 'Stability AI', domain: 'stability.ai', industry: 'Artificial Intelligence', size: 'startup', jobTypes: ['engineering', 'design'], remote: true, tags: ['B2C', 'AI', 'Generative AI'] },
  { name: 'TikTok', domain: 'tiktok.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'design', 'marketing', 'operations', 'legal'], remote: false, tags: ['B2C', 'Social', 'Video'] },
  { name: 'ByteDance', domain: 'bytedance.com', industry: 'Technology', size: 'enterprise', jobTypes: ['engineering', 'marketing', 'operations'], remote: false, tags: ['B2C', 'Social', 'AI'] },

  // Fintech
  { name: 'Stripe', domain: 'stripe.com', industry: 'Fintech', size: 'mid', jobTypes: ['engineering', 'sales', 'finance', 'operations', 'design'], remote: true, tags: ['B2B', 'Payments', 'API', 'SaaS'] },
  { name: 'Square', domain: 'squareup.com', industry: 'Fintech', size: 'mid', jobTypes: ['engineering', 'sales', 'design', 'operations'], remote: true, tags: ['B2B', 'B2C', 'Payments', 'Public'] },
  { name: 'Robinhood', domain: 'robinhood.com', industry: 'Fintech', size: 'mid', jobTypes: ['engineering', 'finance', 'legal', 'marketing'], remote: true, tags: ['B2C', 'Investing', 'Public'] },
  { name: 'Coinbase', domain: 'coinbase.com', industry: 'Fintech', size: 'mid', jobTypes: ['engineering', 'finance', 'legal', 'marketing'], remote: true, tags: ['B2C', 'Crypto', 'Public'] },
  { name: 'Chime', domain: 'chime.com', industry: 'Fintech', size: 'smb', jobTypes: ['engineering', 'marketing', 'operations'], remote: true, tags: ['B2C', 'Banking', 'Neobank'] },
  { name: 'Plaid', domain: 'plaid.com', industry: 'Fintech', size: 'smb', jobTypes: ['engineering', 'sales', 'marketing'], remote: true, tags: ['B2B', 'API', 'Banking'] },
  { name: 'Brex', domain: 'brex.com', industry: 'Fintech', size: 'smb', jobTypes: ['engineering', 'sales', 'finance'], remote: true, tags: ['B2B', 'Banking', 'SaaS'] },
  { name: 'Affirm', domain: 'affirm.com', industry: 'Fintech', size: 'mid', jobTypes: ['engineering', 'finance', 'marketing'], remote: true, tags: ['B2C', 'BNPL', 'Public'] },
  { name: 'Klarna', domain: 'klarna.com', industry: 'Fintech', size: 'mid', jobTypes: ['engineering', 'marketing', 'finance'], remote: true, tags: ['B2C', 'BNPL', 'Payments'] },
  { name: 'Ramp', domain: 'ramp.com', industry: 'Fintech', size: 'startup', jobTypes: ['engineering', 'sales', 'finance'], remote: true, tags: ['B2B', 'SaaS', 'Finance'] },

  // Healthcare
  { name: 'Oscar Health', domain: 'hioscar.com', industry: 'Healthcare', size: 'mid', jobTypes: ['engineering', 'operations', 'marketing'], remote: true, tags: ['B2C', 'Insurance', 'Public'] },
  { name: 'Headspace', domain: 'headspace.com', industry: 'Healthcare', size: 'smb', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2C', 'Mental Health', 'Wellness'] },
  { name: 'Calm', domain: 'calm.com', industry: 'Healthcare', size: 'smb', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2C', 'Mental Health', 'Wellness'] },

  // Education
  { name: 'Duolingo', domain: 'duolingo.com', industry: 'Education', size: 'mid', jobTypes: ['engineering', 'design', 'marketing'], remote: true, tags: ['B2C', 'EdTech', 'Public'] },
  { name: 'Coursera', domain: 'coursera.org', industry: 'Education', size: 'mid', jobTypes: ['engineering', 'marketing', 'sales'], remote: true, tags: ['B2B', 'B2C', 'EdTech', 'Public'] },

  // Other
  { name: 'SpaceX', domain: 'spacex.com', industry: 'Aerospace', size: 'mid', jobTypes: ['engineering', 'operations'], remote: false, tags: ['Deep Tech', 'Hardware', 'Defence'] },
  { name: 'Tesla', domain: 'tesla.com', industry: 'Automotive', size: 'enterprise', jobTypes: ['engineering', 'operations', 'sales', 'design'], remote: false, tags: ['B2C', 'EV', 'Hardware', 'Public'] },
  { name: 'Rivian', domain: 'rivian.com', industry: 'Automotive', size: 'mid', jobTypes: ['engineering', 'operations', 'design'], remote: false, tags: ['B2C', 'EV', 'Hardware', 'Public'] },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  let created = 0;
  let updated = 0;

  for (const data of companies) {
    const existing = await Company.findOne({ name: new RegExp(`^${data.name}$`, 'i') });
    if (existing) {
      // Update with new metadata fields
      await Company.findByIdAndUpdate(existing._id, {
        size: data.size,
        jobTypes: data.jobTypes,
        remote: data.remote,
        tags: data.tags,
        industry: data.industry,
        domain: data.domain,
      });
      updated++;
    } else {
      await Company.create(data);
      process.stdout.write(`  ✓ ${data.name}\n`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
