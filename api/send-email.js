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
        clinic_name: clinicName || reqTenant.clinic_name || reqTenant.name || '',
        doctor_name: doctorName || reqTenant.doctor_name || reqTenant.subtitle || '',
        phone: phone || reqTenant.phone || reqTenant.doctor_phone || reqTenant.mobile || '',
        address: address || reqTenant.address || reqTenant.city || '',
        primary_color: primaryColor || reqTenant.primary_color || reqTenant.primaryColor || '#0D9488',
        slug: tenantId || reqTenant.slug || reqTenant.id || 'default',
        portal_url: clinicUrl || reqTenant.portal_url || reqTenant.clinicUrl || ''
    };

    // Helper to extract clean human name from email if name is missing or dummy
    function cleanRecipientName(rawName, email) {
        if (rawName && typeof rawName === 'string') {
            const trimmed = rawName.trim();
            if (trimmed && !trimmed.toLowerCase().includes('valued patient')) return trimmed;
        }
        if (email && typeof email === 'string') {
            const prefix = email.split('@')[0].replace(/[._-]/g, ' ').trim();
            if (prefix.length > 2 && !prefix.includes('admin') && !prefix.includes('test')) {
                return prefix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
        }
        return '';
    }

    // --- BULK MARKETING BLAST DISPATCH ---
    if (isBulk) {
        const cleanRecipients = recipients
            .map(r => {
                if (typeof r === 'string') {
                    const em = r.trim();
                    return { email: em, name: cleanRecipientName('', em), tenant: tenantInfo };
                }
                const em = (r.email || '').trim();
                return {
                    email: em,
                    name: cleanRecipientName(r.name, em),
                    tenant_id: r.tenant_id,
                    tenant: r.tenant || null
                };
            })
            .filter(r => r.email && r.email.includes('@'));

        if (cleanRecipients.length === 0) {
            return res.status(400).json({ error: 'No valid recipient email addresses found in recipients list.' });
        }

        const sent = [];
        const failed = [];

        for (const recipient of cleanRecipients) {
            try {
                // Ensure strictly tenant-specific metadata per recipient
                const rTenant = recipient.tenant || {};
                const recClinicName = (rTenant.clinic_name || rTenant.name || tenantInfo.clinic_name || 'Dental Clinic').trim();
                const recDoctorName = (rTenant.doctor_name || rTenant.subtitle || tenantInfo.doctor_name || '').trim();
                const recPrimaryColor = rTenant.primary_color || rTenant.primaryColor || tenantInfo.primary_color || '#0D9488';
                const recPhone = (rTenant.phone || rTenant.doctor_phone || tenantInfo.phone || '').trim();
                const recAddress = (rTenant.address || tenantInfo.address || '').trim();
                const recSlug = rTenant.slug || rTenant.id || recipient.tenant_id || tenantInfo.slug || 'default';
                const recPortalUrl = rTenant.portal_url || rTenant.clinicUrl || tenantInfo.portal_url || ((recSlug && recSlug !== 'default') ? `https://mydentalclinic01.vercel.app/${recSlug}` : `https://mydentalclinic01.vercel.app/`);

                const resolvedTenant = {
                    clinic_name: recClinicName,
                    name: recClinicName,
                    doctor_name: recDoctorName,
                    subtitle: recDoctorName,
                    primary_color: recPrimaryColor,
                    primaryColor: recPrimaryColor,
                    phone: recPhone,
                    address: recAddress,
                    slug: recSlug,
                    portal_url: recPortalUrl,
                    clinicUrl: recPortalUrl
                };

                let recSubject = subject;
                // Generate or adapt subject specifically for this recipient's tenant
                if (!recSubject || recSubject.includes('My Dental Clinic') || (tenantInfo.clinic_name && recSubject.includes(tenantInfo.clinic_name))) {
                    if (templateKey === 'daily_care') {
                        recSubject = `🌟 Daily Oral Care Guide & Checkup Reminder from ${recClinicName}`;
                    } else if (templateKey === 'checkup_offer') {
                        recSubject = `🎁 Exclusive Privilege: Routine Dental Checkup at ${recClinicName}`;
                    } else if (templateKey === 'portal_reminder') {
                        recSubject = `📱 Your Digital Dental Portal & Records are Ready | ${recClinicName}`;
                    } else if (subject && tenantInfo.clinic_name) {
                        recSubject = subject.replace(new RegExp(tenantInfo.clinic_name, 'g'), recClinicName);
                    } else {
                        recSubject = `Important Notice from ${recClinicName}`;
                    }
                }

                let recHtml = html;

                if (type === 'marketing' || type === 'marketing_engagement' || templateKey) {
                    const tpl = emailTemplates.getMarketingEngagementTemplate;
                    if (tpl) {
                        const resTpl = tpl({
                            patientName: recipient.name,
                            tenant: resolvedTenant,
                            templateKey: templateKey || 'daily_care',
                            customSubject: recSubject,
                            customMessage: customMessage || text,
                            clinicUrl: recPortalUrl
                        });
                        recHtml = resTpl.html;
                        recSubject = resTpl.subject;
                    }
                }

                if (!recHtml) {
                    recHtml = (emailTemplates.wrapEmailBoilerplate)
                        ? emailTemplates.wrapEmailBoilerplate(`
                            <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0;">Notice from ${recClinicName}</h2>
                            <p style="font-size: 15px; color: #334155; margin: 0 0 14px 0;">Hello <strong>${recipient.name}</strong>,</p>
                            <div style="font-size: 14px; line-height: 1.6; color: #475569; margin: 16px 0;">
                                ${(text || customMessage || 'Thank you for connecting with our clinic. We are committed to your dental wellness.').replace(/\n/g, '<br>')}
                            </div>
                        `, resolvedTenant)
                        : `<div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2 style="color: ${recPrimaryColor};">${recClinicName}</h2>
                            <p>Hello ${recipient.name},</p>
                            <p>${text || customMessage || 'Thank you for connecting with our clinic.'}</p>
                        </div>`;
                }

                const mailOptions = {
                    from: `"${recClinicName}" <${smtpUser}>`,
                    to: recipient.email,
                    replyTo: smtpUser,
                    subject: recSubject || `Oral Care Update from ${recClinicName}`,
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
        const effectiveRecipientName = cleanRecipientName(name, to);

        if (type === 'welcome') {
            const tpl = (emailTemplates.getWelcomeEmail || emailTemplates.getWelcomeTemplate);
            if (tpl) {
                const res = tpl({ patientName: effectiveRecipientName, patientEmail: to, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Welcome to ${tenantInfo.clinic_name}!`;
            }
        } else if (type === 'confirmation') {
            const tpl = (emailTemplates.getAppointmentConfirmationEmail || emailTemplates.getAppointmentConfirmationTemplate);
            if (tpl) {
                const res = tpl({ patientName: effectiveRecipientName, appointment: appointmentData || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Confirmed: Appointment with ${tenantInfo.clinic_name}`;
            }
        } else if (type === 'reminder') {
            const tpl = (emailTemplates.getAppointmentReminderEmail || emailTemplates.getAppointmentReminderTemplate);
            if (tpl) {
                const res = tpl({ patientName: effectiveRecipientName, appointment: appointmentData || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Friendly Reminder: Appointment at ${tenantInfo.clinic_name}`;
            }
        } else if (type === 'prescription') {
            const tpl = (emailTemplates.getPrescriptionEmail || emailTemplates.getPrescriptionTemplate);
            if (tpl) {
                const res = tpl({ patientName: effectiveRecipientName, prescription: prescriptionData || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Digital Prescription - ${tenantInfo.clinic_name}`;
            }
        } else if (type === 'treatment_plan' || type === 'treatment') {
            const tpl = (emailTemplates.getTreatmentPlanEmail || emailTemplates.getTreatmentPlanTemplate);
            if (tpl) {
                const res = tpl({ patientName: effectiveRecipientName, treatmentPlan: req.body?.treatmentPlan || req.body?.plan || {}, tenant: tenantInfo });
                finalHtml = typeof res === 'object' ? res.html : res;
                finalSubject = finalSubject || (typeof res === 'object' ? res.subject : null) || `Treatment Plan & Cost Quotation | ${tenantInfo.clinic_name}`;
            }
        } else if (type === 'marketing' || type === 'marketing_engagement') {
            const tpl = emailTemplates.getMarketingEngagementTemplate;
            if (tpl) {
                const res = tpl({
                    patientName: effectiveRecipientName,
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
            const cleanGreeting = cleanRecipientName(name, to);
            const greetingLine = cleanGreeting ? `<p style="font-size: 15px; color: #334155; margin: 0 0 14px 0;">Hello <strong>${cleanGreeting}</strong>,</p>` : '<p style="font-size: 15px; color: #334155; margin: 0 0 14px 0;">Hello,</p>';
            const fallbackBody = `
                <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0;">Notice from ${tenantInfo.clinic_name}</h2>
                ${greetingLine}
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
