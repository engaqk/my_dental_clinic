const nodemailer = require('nodemailer');
const emailTemplates = require('../emailTemplates');

/**
 * Universal SMTP Email Dispatcher for Multi-Clinic Dental Platform
 * Sender: mydentalapp77@gmail.com (or process.env.SMTP_USER)
 * Supports: Welcome emails, Appointment confirmations, Reminders, Digital Prescriptions, Custom HTML
 */
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const {
        to,
        subject,
        html,
        text,
        type, // 'welcome' | 'confirmation' | 'reminder' | 'prescription' | 'custom'
        name,
        tenantId,
        clinicName,
        doctorName,
        phone,
        address,
        primaryColor,
        appointmentData,
        prescriptionData
    } = req.body || {};

    if (!to || (!to.includes('@'))) {
        return res.status(400).json({ error: 'A valid recipient email (to) is required.' });
    }

    const smtpUser = process.env.SMTP_USER || 'mydentalapp77@gmail.com';
    const smtpPass = (process.env.SMTP_PASS || 'pswn dsqn slql maee').trim();

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: smtpUser,
            pass: smtpPass
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const tenantInfo = {
        clinic_name: clinicName || 'My Dental Clinic',
        doctor_name: doctorName || 'Dental Specialist',
        phone: phone || '',
        address: address || '',
        primary_color: primaryColor || '#0D9488'
    };

    let finalSubject = subject;
    let finalHtml = html;

    try {
        if (type === 'welcome') {
            const tpl = (emailTemplates.getWelcomeEmail || emailTemplates.getWelcomeTemplate);
            if (tpl) {
                const res = tpl({ patientName: name || 'Valued Patient', patientEmail: to, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Welcome to ${tenantInfo.clinic_name}!`;
            }
        } else if (type === 'confirmation') {
            const tpl = (emailTemplates.getAppointmentConfirmationEmail || emailTemplates.getAppointmentConfirmationTemplate);
            if (tpl) {
                const res = tpl({ patientName: name || 'Valued Patient', appointment: appointmentData || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Confirmed: Appointment with ${tenantInfo.clinic_name}`;
            }
        } else if (type === 'reminder') {
            const tpl = (emailTemplates.getAppointmentReminderEmail || emailTemplates.getAppointmentReminderTemplate);
            if (tpl) {
                const res = tpl({ patientName: name || 'Valued Patient', appointment: appointmentData || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Friendly Reminder: Appointment at ${tenantInfo.clinic_name}`;
            }
        } else if (type === 'prescription') {
            const tpl = (emailTemplates.getPrescriptionEmail || emailTemplates.getPrescriptionTemplate);
            if (tpl) {
                const res = tpl({ patientName: name || 'Valued Patient', prescription: prescriptionData || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Digital Prescription - ${tenantInfo.clinic_name}`;
            }
        }

        // Fallback default content if no html generated
        if (!finalHtml) {
            finalHtml = `<div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: ${tenantInfo.primary_color};">${tenantInfo.clinic_name}</h2>
                <p>Hello ${name || 'Patient'},</p>
                <p>${text || 'Thank you for connecting with our clinic.'}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <small style="color: #666;">${tenantInfo.doctor_name} &bull; ${tenantInfo.phone}</small>
            </div>`;
        }

        const mailOptions = {
            from: `"${tenantInfo.clinic_name}" <${smtpUser}>`,
            to: to,
            replyTo: smtpUser,
            subject: finalSubject || `Notification from ${tenantInfo.clinic_name}`,
            text: text || 'Please view this email in an HTML-compatible client.',
            html: finalHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[SMTP] Email (${type || 'custom'}) successfully dispatched to ${to}. MessageId: ${info.messageId}`);

        return res.status(200).json({
            success: true,
            messageId: info.messageId,
            recipient: to,
            sender: smtpUser
        });

    } catch (err) {
        console.error('[SMTP] Dispatch failed:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to dispatch email via SMTP transporter.'
        });
    }
};
