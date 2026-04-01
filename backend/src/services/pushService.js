const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to one or more Expo push tokens.
 *
 * @param {string[]} tokens   - Array of Expo push tokens
 * @param {string}   title    - Notification title
 * @param {string}   body     - Notification body text
 * @param {object}   data     - Extra data (e.g. { companyId } for navigation)
 */
async function sendPushNotifications(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;

  // Filter out any null/invalid tokens
  const validTokens = tokens.filter(
    (t) => t && typeof t === 'string' && t.startsWith('ExponentPushToken')
  );
  if (validTokens.length === 0) return;

  // Expo push API accepts up to 100 messages per request
  const messages = validTokens.map((token) => ({
    to: token,
    title,
    body,
    data,
    sound: 'default',
    badge: 1,
    priority: 'high',
  }));

  try {
    const res = await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    // Log any per-token errors from Expo
    const results = res.data?.data || [];
    results.forEach((result, i) => {
      if (result.status === 'error') {
        console.error(`[pushService] Token ${validTokens[i]} error:`, result.message);
      }
    });

    console.log(`[pushService] Sent ${validTokens.length} notification(s): "${title}"`);
  } catch (err) {
    console.error('[pushService] Failed to send push notifications:', err.message);
  }
}

module.exports = { sendPushNotifications };
