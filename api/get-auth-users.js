const admin = require('firebase-admin');

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

/**
 * Serverless function to list Auth users (limited for demo/white-label)
 */
module.exports = async (req, res) => {
    try {
        const listUsersResult = await admin.auth().listUsers(100);
        const users = listUsersResult.users.map(userRecord => ({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            phoneNumber: userRecord.phoneNumber
        }));

        return res.status(200).json(users);
    } catch (error) {
        console.error('Error listing users:', error);
        return res.status(500).json({ error: 'Failed to list users' });
    }
};
