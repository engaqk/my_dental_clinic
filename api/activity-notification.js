const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

// Initialize Firebase Admin safely if credentials are present
let db = null;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                })
            });
            db = admin.firestore();
        } catch (e) {
            console.error('[Activity API] Firebase Admin Init Error:', e.message);
        }
    } else {
        db = admin.firestore();
    }
}

// In-memory rate-limiter / debounce cache for email notifications (prevents SMTP mailbox flood)
// Key: tenantId + email + page
const emailThrottleMap = new Map();

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

    const payload = req.body || {};
    const {
        tenantId = 'default',
        clinicName = 'Dental Clinic Practice',
        category = 'navigation', // 'auth' | 'navigation' | 'clinical' | 'appointment' | 'billing' | 'lead'
        type = 'Activity',
        actor = 'Visitor',
        email = '',
        role = 'visitor',
        page = 'Home',
        previousPage = '',
        timeSpentSeconds = 0,
        timeSpentDisplay = '0s',
        details = '',
        meta = {},
        sendEmail = true
    } = payload;

    const now = new Date();
    const dateStr = payload.ist_date || now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = payload.ist_time || (now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST');
    const istTimestamp = payload.ist_timestamp || `${dateStr}, ${timeStr}`;
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || payload.ipAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || payload.device || 'Web Browser';

    // Parse friendly device label
    let deviceLabel = 'Desktop Browser';
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
        deviceLabel = /iPad|Tablet/i.test(userAgent) ? 'Tablet' : 'Mobile Device';
        if (/iPhone/i.test(userAgent)) deviceLabel = 'Apple iPhone';
        else if (/Android/i.test(userAgent)) deviceLabel = 'Android Mobile';
    }

    const logEntry = {
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        category: category,
        type: type,
        details: details || `${actor || 'User'} navigated to ${page}${timeSpentSeconds > 0 ? ` (Dwell: ${timeSpentDisplay})` : ''}`,
        tenant_id: tenantId,
        clinic_slug: tenantId,
        clinic_name: clinicName,
        actor: actor || 'Visitor',
        name: actor || 'User',
        email: email || '',
        role: role || (category === 'auth' ? 'user' : 'visitor'),
        page: page,
        previous_page: previousPage || '',
        time_spent_seconds: parseInt(timeSpentSeconds) || 0,
        time_spent_display: timeSpentDisplay || `${timeSpentSeconds}s`,
        dateStr: dateStr,
        timeStr: timeStr,
        ist_date: dateStr,
        ist_time: timeStr,
        ist_timestamp: istTimestamp,
        timestamp: now.toISOString(),
        ipAddress: clientIp,
        device: deviceLabel,
        userAgent: userAgent,
        meta: meta
    };

    // 1. Persist to Cloud Firestore (Global audit log + Tenant-isolated collection)
    if (db) {
        try {
            await Promise.all([
                db.collection('superadmin_logs').add(logEntry),
                db.collection('tenants').doc(tenantId).collection('activity_logs').add(logEntry)
            ]);
        } catch (dbErr) {
            console.warn('[Activity API] Firestore write warning:', dbErr.message);
        }
    }

    // 2. Determine Admin Email Notification Dispatch
    let emailDispatched = false;
    let emailReason = 'Not requested or throttled';

    // Resolve Admin Email (From Firestore settings or default clinic admin email)
    let adminRecipient = process.env.ADMIN_NOTIFY_EMAIL || 'abdulqadir.galaxy53@gmail.com';
    if (db) {
        try {
            const clinicDoc = await db.collection('tenants').doc(tenantId).collection('settings').doc('clinic').get();
            if (clinicDoc.exists) {
                const cData = clinicDoc.data();
                if (cData.admin_email && cData.admin_email.includes('@')) {
                    adminRecipient = cData.admin_email;
                } else if (cData.email && cData.email.includes('@')) {
                    adminRecipient = cData.email;
                }
            }
        } catch(e) {}
    }

    // Check throttle to prevent flooding admin mailbox for rapid page clicks within 20 seconds for the same page
    const throttleKey = `${tenantId}::${email || actor}::${category}::${page}`;
    const lastSent = emailThrottleMap.get(throttleKey) || 0;
    const isHighPriority = category === 'auth' || category === 'appointment' || category === 'clinical' || category === 'billing' || (timeSpentSeconds >= 10);
    const cooldownMs = isHighPriority ? 15000 : 30000; // 15s for high priority, 30s for routine page views

    if (sendEmail && (Date.now() - lastSent > cooldownMs || category === 'auth' || category === 'appointment')) {
        emailThrottleMap.set(throttleKey, Date.now());

        // Trim throttle map if it gets too large
        if (emailThrottleMap.size > 200) {
            const nowTime = Date.now();
            for (const [k, v] of emailThrottleMap.entries()) {
                if (nowTime - v > 120000) emailThrottleMap.delete(k);
            }
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

        // Determine icon & theme color
        let eventBadgeColor = '#0D9488'; // teal default
        let eventIcon = '🧭';
        if (category === 'auth') {
            eventBadgeColor = '#8B5CF6'; // purple
            eventIcon = '🔐';
        } else if (category === 'appointment') {
            eventBadgeColor = '#0284C7'; // blue
            eventIcon = '📅';
        } else if (category === 'clinical') {
            eventBadgeColor = '#10B981'; // green
            eventIcon = '🦷';
        } else if (category === 'billing') {
            eventBadgeColor = '#F59E0B'; // amber
            eventIcon = '💳';
        }

        const emailSubject = `${eventIcon} [${clinicName}] Activity: ${type} - ${actor || 'User'} (${timeSpentDisplay !== '0s' ? `Dwell: ${timeSpentDisplay}` : page})`;

        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${emailSubject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
            <div style="max-width: 600px; margin: 20px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, ${eventBadgeColor}, #0F172A); padding: 24px; color: white;">
                    <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; margin-bottom: 6px;">
                        ${clinicName} • Real-Time Activity Alert
                    </div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 800; line-height: 1.3;">
                        ${eventIcon} ${type}
                    </h1>
                    <div style="font-size: 13px; color: #E2E8F0; margin-top: 6px;">
                        Exact Timestamp: <strong>${istTimestamp}</strong>
                    </div>
                </div>

                <!-- Content Grid -->
                <div style="padding: 24px;">
                    <div style="background: #F1F5F9; border-left: 4px solid ${eventBadgeColor}; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                        <div style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Activity Summary</div>
                        <div style="font-size: 15px; font-weight: 700; color: #0F172A; line-height: 1.4;">
                            ${details || `${actor || 'User'} interacted with ${page}`}
                        </div>
                    </div>

                    <!-- Details Table -->
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #64748B; width: 140px; font-weight: 600;">Clinic Practice:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #0F172A; font-weight: 700;">${clinicName} <span style="font-size: 12px; color: #64748B;">(${tenantId})</span></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #64748B; font-weight: 600;">User / Actor:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #0F172A; font-weight: 700;">${actor || 'Visitor'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #64748B; font-weight: 600;">Login / Email:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #0284C7; font-weight: 700;">${email || '<span style="color:#94A3B8; font-weight:normal;">None (Guest Session)</span>'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #64748B; font-weight: 600;">User Role:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #0F172A;">
                                <span style="background: #E2E8F0; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase;">${role}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #64748B; font-weight: 600;">Page Clicked:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #0F172A; font-weight: 700;">
                                <span style="background: #EEF2FF; color: #4338CA; padding: 3px 8px; border-radius: 6px;">${page}</span>
                                ${previousPage ? `<span style="font-size: 12px; color: #64748B;">(from ${previousPage})</span>` : ''}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #64748B; font-weight: 600;">Time Spent (Dwell):</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #0F172A; font-weight: 800; font-size: 15px;">
                                <span style="background: #FEF3C7; color: #B45309; padding: 3px 9px; border-radius: 6px;">⏱️ ${timeSpentDisplay}</span>
                                <span style="font-size: 12px; color: #64748B; margin-left: 4px;">(${timeSpentSeconds} seconds)</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #64748B; font-weight: 600;">Device &amp; IP:</td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #F1F5F9; color: #475569; font-size: 13px;">${deviceLabel} • <code>${clientIp}</code></td>
                        </tr>
                    </table>

                    <!-- CTAs -->
                    <div style="margin-top: 24px; text-align: center;">
                        <a href="https://mydentalclinic01.vercel.app/${tenantId !== 'default' ? tenantId : ''}" style="background: ${eventBadgeColor}; color: white; padding: 10px 22px; border-radius: 8px; font-weight: 800; text-decoration: none; font-size: 13px; display: inline-block; margin-right: 8px;">
                            View Clinic Portal
                        </a>
                        <a href="https://mydentalclinic01.vercel.app/superadmin" style="background: #1E293B; color: white; padding: 10px 22px; border-radius: 8px; font-weight: 800; text-decoration: none; font-size: 13px; display: inline-block;">
                            Audit Trail Console
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 14px 24px; text-align: center; font-size: 12px; color: #94A3B8;">
                    This is an automated activity audit alert dispatched to clinic administrator (${adminRecipient}).
                </div>
            </div>
        </body>
        </html>
        `;

        try {
            await transporter.sendMail({
                from: `"${clinicName} Activity Alert" <${smtpUser}>`,
                to: adminRecipient,
                replyTo: smtpUser,
                subject: emailSubject,
                html: emailHtml
            });
            emailDispatched = true;
            emailReason = `Dispatched to ${adminRecipient}`;
            console.log(`[Activity API] Alert dispatched to ${adminRecipient} for ${type}`);
        } catch (mailErr) {
            console.error('[Activity API] SMTP error:', mailErr.message);
            emailReason = `SMTP error: ${mailErr.message}`;
        }
    }

    return res.status(200).json({
        success: true,
        logged: true,
        logId: logEntry.id,
        emailDispatched: emailDispatched,
        emailReason: emailReason,
        timestamp: istTimestamp
    });
};
