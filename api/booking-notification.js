const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');

// Initialize Firebase Admin SDK safely
let db = null;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
                databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
            });
            db = admin.firestore();
        } catch (e) {
            console.error('Firebase Admin Init Error:', e.message);
        }
    } else {
        db = admin.firestore();
    }
} else {
    console.warn('Firebase Admin credentials missing. Operating in fallback mode.');
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tenantId, appointmentId, name, mobile, email, date, time, reason, clinicName } = req.body;

    if (!appointmentId || !name || !mobile) {
        return res.status(400).json({ error: 'Missing required booking information' });
    }

    try {
        let gateway = {};
        let clinic = { clinic_name: clinicName || "My Dental Clinic", admin_email: "abdulqadir.galaxy53@gmail.com" };

        if (db) {
            try {
                const gatewayDoc = await db.collection("tenants").doc(tenantId || "default").collection("settings").doc("gateway").get();
                const clinicDoc = await db.collection("tenants").doc(tenantId || "default").collection("settings").doc("clinic").get();
                if (gatewayDoc.exists) gateway = gatewayDoc.data();
                if (clinicDoc.exists) clinic = clinicDoc.data();
            } catch (dbErr) {
                console.error('Firestore settings read failed:', dbErr.message);
            }
        }

        const smsApiKey = gateway.apiKey;
        const smsDeviceId = gateway.deviceId;
        const adminEmail = clinic.admin_email || "abdulqadir.galaxy53@gmail.com";

        // Use Vercel env variables if available, otherwise fallback
        const smtpUser = process.env.SMTP_USER || 'my.dental.app01@gmail.com';
        const smtpPass = process.env.SMTP_PASS || 'okaw nmsf jmrd wpds';

        // Setup Transporter for Gmail SMTP (using custom TLS settings for serverless environments)
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for 587/STARTTLS
            auth: {
                user: smtpUser,
                pass: smtpPass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const appUrl = req.headers.origin || ('https://' + req.headers.host) || 'https://mydentalclinic01.vercel.app';

        // 1. Admin Alert Email (Engaging & Clear)
        const adminMailOptions = {
            from: `"${clinic.clinic_name}" <${smtpUser}>`,
            to: adminEmail,
            subject: `🚨 [New Booking Alert] - ${name}`,
            html: `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; padding: 30px; border-radius: 12px;">
                    <div style="background-color: #0F172A; padding: 20px; border-top-left-radius: 12px; border-top-right-radius: 12px; text-align: center;">
                        <h2 style="color: #10B981; margin: 0; font-size: 20px; letter-spacing: 1px;">${clinic.clinic_name.toUpperCase()} - PORTAL</h2>
                    </div>
                    <div style="background: white; padding: 30px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <p style="font-size: 16px; color: #1E293B; margin-top: 0;">An appointment slot has been successfully booked by a patient.</p>
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;"><b>Patient Name:</b></td><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #0F172A; font-weight: bold;">${name}</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;"><b>Date:</b></td><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #0F172A;">${date}</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;"><b>Time Slot:</b></td><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #0F172A;">${time}</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;"><b>Phone:</b></td><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #0F172A;">${mobile}</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;"><b>Email:</b></td><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #0F172A;">${email || 'Not Provided'}</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;"><b>Concern:</b></td><td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: #0F172A; font-style: italic;">${reason}</td></tr>
                        </table>
                        <a href="${appUrl}" style="background-color: #10B981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block; text-align: center; margin-top: 10px;">Access Clinic Explorer</a>
                    </div>
                </div>
            `
        };

        // Send Admin Alert Email
        try {
            await transporter.sendMail(adminMailOptions);
            console.log("Admin email sent to:", adminEmail);
        } catch (err) {
            console.error("Admin email failed:", err.message);
        }

        // 2. Patient Confirmation Email (Premium & Stunning template)
        let patientEmailSent = false;
        if (email) {
            const patientMailOptions = {
                from: `"${clinic.clinic_name}" <${smtpUser}>`,
                to: email,
                subject: `✨ Appointment Confirmed - ${clinic.clinic_name}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Appointment Confirmed</title>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; margin: 0; padding: 0; }
                            .email-container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
                            .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 40px 20px; text-align: center; color: white; border-bottom: 4px solid #10B981; }
                            .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; color: white; }
                            .header p { margin: 8px 0 0; font-size: 14px; color: #10B981; text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }
                            .content { padding: 40px 35px; }
                            .welcome { font-size: 18px; font-weight: 700; color: #0F172A; margin-top: 0; }
                            .body-text { color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 25px; }
                            .card { background-color: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 12px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #10B981; }
                            .card-title { color: #0F172A; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px; display: flex; align-items: center; }
                            .detail-row { display: flex; margin-bottom: 12px; font-size: 14px; }
                            .detail-label { width: 30%; color: #64748B; font-weight: bold; }
                            .detail-value { width: 70%; color: #0F172A; font-weight: 700; }
                            .btn { display: inline-block; background-color: #10B981; color: white !important; font-weight: bold; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-size: 14px; text-align: center; transition: background-color 0.2s; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2); }
                            .footer { background-color: #F8FAFC; padding: 25px; text-align: center; border-top: 1px solid #F1F5F9; font-size: 12px; color: #94A3B8; }
                            .footer a { color: #10B981; text-decoration: none; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                <h1>${clinic.clinic_name.toUpperCase()}</h1>
                                <p>Excellence in Every Smile</p>
                            </div>
                            <div class="content">
                                <h3 class="welcome">Hi ${name},</h3>
                                <p class="body-text">We are delighted to confirm that your priority consultation appointment has been successfully scheduled. Our specialist clinical team is prepared for your visit.</p>
                                
                                <div class="card">
                                    <div class="card-title">
                                        <span style="color: #10B981; margin-right: 8px; font-size: 16px;">📅</span> APPOINTMENT DETAILS
                                    </div>
                                    <div class="detail-row">
                                        <div class="detail-label">Procedure:</div>
                                        <div class="detail-value">${reason}</div>
                                    </div>
                                    <div class="detail-row">
                                        <div class="detail-label">Date:</div>
                                        <div class="detail-value">${date}</div>
                                    </div>
                                    <div class="detail-row">
                                        <div class="detail-label">Time:</div>
                                        <div class="detail-value">${time}</div>
                                    </div>
                                    <div class="detail-row" style="margin-bottom: 0;">
                                        <div class="detail-label">Clinic:</div>
                                        <div class="detail-value">${clinic.clinic_name}</div>
                                    </div>
                                </div>
                                
                                <div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">
                                    <a href="${appUrl}" class="btn">Go to Patient Portal</a>
                                </div>
                            </div>
                            <div class="footer">
                                <p>If you need to reschedule or cancel, please contact our helpline or reply directly to this email.</p>
                                <p style="margin-top: 15px;">© 2026 ${clinic.clinic_name}. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            try {
                await transporter.sendMail(patientMailOptions);
                patientEmailSent = true;
                console.log("Patient confirmation email sent to:", email);
            } catch (err) {
                console.error("Patient email sending failed:", err.message);
            }
        }

        // Send confirmation SMS via Textbee
        let smsStatus = "OFFLINE";
        if (smsApiKey && smsDeviceId) {
            try {
                const message = `Hello ${name}, your booking at ${clinic.clinic_name} for ${date} at ${time} is confirmed. Thank you!`;
                
                const response = await axios.post(`https://api.textbee.dev/api/v1/gateway/devices/${smsDeviceId}/send-sms`, {
                    recipients: [mobile],
                    message: message
                }, {
                    headers: { 'x-api-key': smsApiKey }
                });
                smsStatus = "SENT";
            } catch (smsError) {
                console.error("SMS Delivery Failed:", smsError.message);
                smsStatus = "FAILED";
            }
        }

        // Send admin mail
        await transporter.sendMail(adminMailOptions);

        return res.status(200).json({ 
            success: true, 
            smsStatus,
            patientEmailSent,
            message: 'Notifications processed successfully' 
        });

    } catch (error) {
        console.error('Notification logic error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
