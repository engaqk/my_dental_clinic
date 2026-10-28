const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');
const emailTemplates = require('../emailTemplates');

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

        // Use Vercel env variables if available, otherwise fallback to configured credentials
        const smtpUser = process.env.SMTP_USER || 'mydentalapp77@gmail.com';
        const smtpPass = (process.env.SMTP_PASS || 'pswn dsqn slql maee').trim();

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

        // 2. Patient Confirmation Email (Dynamic Tenant-Theme Specific with Monogram Badge)
        let patientEmailSent = false;
        if (email) {
            let patientHtml = '';
            let patientSubject = `✨ Appointment Confirmed - ${clinic.clinic_name}`;

            if (emailTemplates && emailTemplates.getAppointmentConfirmationEmail) {
                const resTpl = emailTemplates.getAppointmentConfirmationEmail({
                    patientName: name,
                    appointment: {
                        name: name,
                        date: date,
                        appointmentDate: date,
                        time: time,
                        appointmentTime: time,
                        reason: reason
                    },
                    tenant: {
                        clinic_name: clinic.clinic_name || clinicName || 'My Dental Clinic',
                        doctor_name: clinic.doctor_name || clinic.subtitle || 'Dental Specialist',
                        primary_color: clinic.primary_color || '#0D9488',
                        phone: clinic.phone || '+91 98765 43210',
                        address: clinic.address || 'Main Clinic Road',
                        portal_url: appUrl,
                        slug: tenantId || 'default'
                    }
                });
                patientHtml = resTpl.html;
                patientSubject = resTpl.subject;
            }

            const patientMailOptions = {
                from: `"${clinic.clinic_name}" <${smtpUser}>`,
                to: email,
                subject: patientSubject,
                html: patientHtml
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
