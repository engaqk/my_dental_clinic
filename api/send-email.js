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
        recipients, // Array of { email, name } for bulk campaign
        subject,
        html,
        text,
        type, // 'welcome' | 'confirmation' | 'reminder' | 'prescription' | 'marketing' | 'custom'
        templateKey, // 'daily_care' | 'checkup_offer' | 'portal_reminder' | 'custom'
        customMessage,
        clinicUrl,
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

    const isBulk = Array.isArray(recipients) && recipients.length > 0;
    if (!isBulk && (!to || !to.includes('@'))) {
        return res.status(400).json({ error: 'A valid recipient email (to) or a recipients array is required.' });
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

    const reqTenant = req.body?.tenant || {};
    const tenantInfo = {
        clinic_name: clinicName || reqTenant.clinic_name || reqTenant.name || 'My Dental Clinic',
        doctor_name: doctorName || reqTenant.doctor_name || reqTenant.subtitle || 'Dental Specialist',
        phone: phone || reqTenant.phone || '+91 98765 43210',
        address: address || reqTenant.address || 'Main Clinic Road',
        primary_color: primaryColor || reqTenant.primary_color || reqTenant.primaryColor || '#0D9488',
        slug: tenantId || reqTenant.slug || reqTenant.id || 'default',
        portal_url: clinicUrl || reqTenant.portal_url || reqTenant.clinicUrl || ''
    };

    // --- BULK MARKETING BLAST DISPATCH ---
    if (isBulk) {
        const cleanRecipients = recipients
            .map(r => typeof r === 'string' ? { email: r.trim(), name: 'Valued Patient' } : { email: (r.email || '').trim(), name: r.name || 'Valued Patient' })
            .filter(r => r.email && r.email.includes('@'));

        if (cleanRecipients.length === 0) {
            return res.status(400).json({ error: 'No valid recipient email addresses found in recipients list.' });
        }

        const sent = [];
        const failed = [];

        for (const recipient of cleanRecipients) {
            try {
                let recSubject = subject;
                let recHtml = html;

                if (type === 'marketing' || type === 'marketing_engagement' || templateKey) {
                    const tpl = emailTemplates.getMarketingEngagementTemplate;
                    if (tpl) {
                        const resTpl = tpl({
                            patientName: recipient.name,
                            tenant: tenantInfo,
                            templateKey: templateKey || 'daily_care',
                            customSubject: subject,
                            customMessage: customMessage || text,
                            clinicUrl: clinicUrl || 'https://mydentalclinic01.vercel.app'
                        });
                        recHtml = resTpl.html;
                        recSubject = resTpl.subject;
                    }
                }

                if (!recHtml) {
                    recHtml = `<div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: ${tenantInfo.primary_color};">${tenantInfo.clinic_name}</h2>
                        <p>Hello ${recipient.name},</p>
                        <p>${text || customMessage || 'Thank you for connecting with our clinic.'}</p>
                    </div>`;
                }

                const mailOptions = {
                    from: `"${tenantInfo.clinic_name}" <${smtpUser}>`,
                    to: recipient.email,
                    replyTo: smtpUser,
                    subject: recSubject || `Oral Care Update from ${tenantInfo.clinic_name}`,
                    html: recHtml
                };

                const info = await transporter.sendMail(mailOptions);
                sent.push({ email: recipient.email, name: recipient.name, messageId: info.messageId });

                // Brief pause (50ms) to prevent SMTP bursting
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (recErr) {
                console.error(`[SMTP Bulk] Failed for ${recipient.email}:`, recErr);
                failed.push({ email: recipient.email, error: recErr.message });
            }
        }

        console.log(`[SMTP Bulk Campaign] Total: ${cleanRecipients.length}, Sent: ${sent.length}, Failed: ${failed.length}`);
        return res.status(200).json({
            success: true,
            total: cleanRecipients.length,
            sentCount: sent.length,
            failedCount: failed.length,
            sent: sent,
            failed: failed,
            sender: smtpUser
        });
    }

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
        } else if (type === 'treatment_plan' || type === 'treatment') {
            const tpl = (emailTemplates.getTreatmentPlanEmail || emailTemplates.getTreatmentPlanTemplate);
            if (tpl) {
                const res = tpl({ patientName: name || 'Valued Patient', treatmentPlan: req.body?.treatmentPlan || req.body?.plan || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Treatment Plan & Cost Quotation | ${tenantInfo.clinic_name}`;
            }
        } else if (type === 'marketing' || type === 'marketing_engagement') {
            const tpl = emailTemplates.getMarketingEngagementTemplate;
            if (tpl) {
                const res = tpl({
                    patientName: name || 'Valued Patient',
                    tenant: tenantInfo,
                    templateKey: templateKey || 'daily_care',
                    customSubject: subject,
                    customMessage: customMessage || text,
                    clinicUrl: clinicUrl || 'https://mydentalclinic01.vercel.app'
                });
                finalHtml = res.html;
                finalSubject = finalSubject || res.subject;
            }
        }

        // Fallback default content wrapped in dynamic tenant theme boilerplate if no html generated
        if (!finalHtml) {
            const fallbackBody = `
                <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0;">Notice from ${tenantInfo.clinic_name}</h2>
                <p style="font-size: 15px; color: #334155; margin: 0 0 14px 0;">Hello <strong>${name || 'Valued Patient'}</strong>,</p>
                <div style="font-size: 14px; line-height: 1.6; color: #475569; margin: 16px 0;">
                    ${(text || customMessage || 'Thank you for connecting with our clinic. We are committed to your dental health and wellness.').replace(/\n/g, '<br>')}
                </div>
            `;
            finalHtml = (emailTemplates.wrapEmailBoilerplate) 
                ? emailTemplates.wrapEmailBoilerplate(fallbackBody, tenantInfo)
                : fallbackBody;
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
