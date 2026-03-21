const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');

// Initialize Firebase Admin SDK
// This requires service account credentials in environment variables
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle private key formatted with newlines or not
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
            databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
        });
    } catch (e) {
        console.error('Firebase Admin Init Error:', e.message);
    }
}

const db = admin.firestore();

/**
 * Serverless function to handle booking notifications (Email + SMS)
 */
module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { appointmentId, name, mobile, date, time, reason, clinicName } = req.body;

    if (!appointmentId || !name || !mobile) {
        return res.status(400).json({ error: 'Missing required booking information' });
    }

    try {
        // 1. Fetch Gateway & Clinic Secrets from Firestore (Generic approach)
        const gatewayDoc = await db.collection('settings').doc('gateway').get();
        const clinicDoc = await db.collection('settings').doc('clinic').get();

        const gateway = gatewayDoc.exists ? gatewayDoc.data() : {};
        const clinic = clinicDoc.exists ? clinicDoc.data() : { clinic_name: clinicName || "My Dental Clinic", admin_email: process.env.ADMIN_EMAIL };

        const smsApiKey = gateway.apiKey;
        const smsDeviceId = gateway.deviceId;
        const adminEmail = clinic.admin_email || process.env.ADMIN_EMAIL;

        // 2. Setup Transporter for Gmail SMTP
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS, // App Password
            },
        });

        // 3. Send Email to Admin (Branded)
        const adminMailOptions = {
            from: `"${clinic.clinic_name}" <${process.env.SMTP_USER}>`,
            to: adminEmail,
            subject: `New Appointment: ${name} (${reason})`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #26A69A;">New Booking Alert</h2>
                    <p>A new appointment has been scheduled for <b>${clinic.clinic_name}</b>.</p>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Patient Name:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Date:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${date}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Time:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${time}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Mobile:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${mobile}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Treatment:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${reason}</td></tr>
                    </table>
                    <p style="margin-top: 20px; color: #666; font-size: 0.8rem;">Sent via Pulse SMS & Notification Suite</p>
                </div>
            `
        };

        // 4. Send Confirmation SMS via Textbee
        let smsStatus = "OFFLINE";
        if (smsApiKey && smsDeviceId) {
            try {
                const message = `Hello ${name}, your booking at ${clinic.clinic_name} for ${date} at ${time} is confirmed. Reason: ${reason}. Thank you!`;
                
                const response = await axios.post(`https://api.textbee.dev/api/v1/gateway/devices/${smsDeviceId}/send-sms`, {
                    recipients: [mobile],
                    message: message
                }, {
                    headers: { 'x-api-key': smsApiKey }
                });
                smsStatus = "SENT";
                console.log("SMS Sent ID:", response.data?.data?._id);
            } catch (smsError) {
                console.error("SMS Delivery Failed:", smsError.message);
                smsStatus = "FAILED";
            }
        }

        // Send emails concurrently
        await Promise.all([
            transporter.sendMail(adminMailOptions),
            // Patient email could be added here if email field exists
        ]);

        return res.status(200).json({ 
            success: true, 
            smsStatus,
            message: 'Notifications processed successfully' 
        });

    } catch (error) {
        console.error('Notification logic error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
