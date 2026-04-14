const admin = require('firebase-admin');
const axios = require('axios');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
  } catch (e) {
    console.error('Firebase Admin Init Error:', e.message);
  }
}

const db = admin.firestore();

/**
 * Serverless function for Batch SMS Broadcast
 * Chunks recipients into groups of 200 to avoid provider timeouts.
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Check for Firebase ID Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (!decodedToken) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  } catch (authError) {
    return res.status(401).json({ error: 'Unauthorized: Authentication failed' });
  }

  const { recipients, message } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
    return res.status(400).json({ error: 'Recipients and message are required' });
  }

  try {
    // Fetch Gateway Secrets from Firestore in real-time
    const gatewayDoc = await db.collection('settings').doc('gateway').get();
    if (!gatewayDoc.exists) {
      return res.status(404).json({ error: 'SMS Gateway credentials not configured' });
    }

    const { apiKey, deviceId } = gatewayDoc.data();
    if (!apiKey || !deviceId) {
      return res.status(400).json({ error: 'SMS Gateway apiKey or deviceId is missing' });
    }

    // Batching Logic (Chunk size 200)
    const chunkSize = 200;
    const results = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      batches: []
    };

    for (let i = 0; i < recipients.length; i += chunkSize) {
      const batchRecipients = recipients.slice(i, i + chunkSize);
      
      try {
        const response = await axios.post(
          `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
          {
            recipients: batchRecipients,
            message: message
          },
          {
            headers: { 'x-api-key': apiKey }
          }
        );

        const smsId = response.data?.data?._id || null;
        results.sent += batchRecipients.length;
        results.batches.push({ success: true, count: batchRecipients.length, smsId, response: response.data });
      } catch (batchError) {
        console.error(`Batch ${i / chunkSize + 1} failed:`, batchError.message);
        results.failed += batchRecipients.length;
        results.batches.push({ success: false, count: batchRecipients.length, error: batchError.message });
      }
    }

    // Log the broadcast in the audit trail with external IDs
    const smsIds = results.batches.map(b => b.smsId).filter(Boolean);
    await db.collection('broadcast_history').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message,
      recipientsCount: results.total,
      sentCount: results.sent,
      failedCount: results.failed,
      externalIds: smsIds,
      status: results.failed === 0 ? 'DELIVERED' : (results.sent > 0 ? 'PARTIAL' : 'FAILED')
    });

    return res.status(200).json(results);
  } catch (error) {
    console.error('Bulk SMS process failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
