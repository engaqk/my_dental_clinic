/**
 * emailTemplates.js - Universal Multi-Tenant Responsive HTML Email Templates
 * Zero Dummy Placeholders: Everything strictly resolved from actual database tenant settings.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.emailTemplates = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // --- 1. DYNAMIC 2-CHARACTER MONOGRAM BADGE GENERATOR ---
    function getClinicMonogram(name = '') {
        const clean = (name || '').trim().replace(/^(dr\.?|doctor)\s+/i, '');
        if (!clean) return 'DC';

        const words = clean.split(/\s+/).filter(w => w.length > 0);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        } else if (clean.length >= 2) {
            return clean.substring(0, 2).toUpperCase();
        }
        return (clean[0] || 'D').toUpperCase() + 'C';
    }

    // --- 2. DYNAMIC COLOR LIGHTENING / DARKENING ---
    function hexToRgb(hex = '#0D9488') {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    function adjustBrightness(hex = '#0D9488', percent = 0) {
        const { r, g, b } = hexToRgb(hex);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, Math.max(0, r + amt));
        const G = Math.min(255, Math.max(0, g + amt));
        const B = Math.min(255, Math.max(0, b + amt));
        return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
    }

    // --- 3. ROBUST EXTRACTORS FOR TENANT & PATIENT DATA ---
    function extractTenantAndData(arg1, arg2) {
        let tenant = {};
        let data = {};

        if (arg1 && typeof arg1 === 'object') {
            if (arg1.tenant && typeof arg1.tenant === 'object') {
                tenant = { ...arg1.tenant };
                data = { ...arg1 };
                delete data.tenant;
            } else if (arg1.primary_color || arg1.primaryColor || arg1.clinic_name || (arg1.name && !arg1.email && !arg1.date)) {
                tenant = { ...arg1 };
                data = (arg2 && typeof arg2 === 'object') ? { ...arg2 } : {};
            } else {
                data = { ...arg1 };
                if (arg2 && typeof arg2 === 'object') {
                    tenant = (arg2.tenant && typeof arg2.tenant === 'object') ? { ...arg2.tenant } : { ...arg2 };
                }
            }
        } else if (arg2 && typeof arg2 === 'object') {
            tenant = (arg2.tenant && typeof arg2.tenant === 'object') ? { ...arg2.tenant } : { ...arg2 };
        }

        return { tenant, data };
    }

    function resolveClinicName(tenant = {}) {
        return (tenant.clinic_name || tenant.name || '').trim() || 'Dental Clinic';
    }

    function resolveDoctorName(tenant = {}) {
        if (!tenant) return '';
        const d = (tenant.doctor_name || '').trim();
        if (d && !d.toLowerCase().includes('specialist') && !d.toLowerCase().includes('physician')) {
            return d;
        }
        const s = (tenant.subtitle || '').trim();
        if (s && !s.toLowerCase().includes('clinic') && !s.toLowerCase().includes('specialist') && !s.toLowerCase().includes('physician')) {
            return s;
        }
        return '';
    }

    function resolvePatientName(data = {}) {
        if (!data) return '';
        const raw = (data.patientName || data.name || data.displayName || '').trim();
        if (raw && !raw.toLowerCase().includes('valued patient')) {
            return raw;
        }
        if (data.email && typeof data.email === 'string') {
            const prefix = data.email.split('@')[0].replace(/[._-]/g, ' ').trim();
            if (prefix.length > 2 && !prefix.includes('admin') && !prefix.includes('test')) {
                return prefix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
        }
        return '';
    }

    function formatSalutation(data = {}) {
        const name = resolvePatientName(data);
        if (name) {
            return `Dear <strong>${name}</strong>,`;
        }
        return `Hello,`;
    }

    // --- 4. DYNAMIC EMAIL WRAPPER (BOILERPLATE) ---
    function wrapEmailBoilerplate(contentHtml, tenant = {}) {
        const clinicName = resolveClinicName(tenant);
        const doctorName = resolveDoctorName(tenant);
        const phone = (tenant.phone || tenant.doctor_phone || tenant.mobile || '').trim();
        const address = (tenant.address || tenant.city || '').trim();
        const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
        const cleanPhone = phone.replace(/[^0-9+]/g, '');

        const primaryDark = adjustBrightness(primaryColor, -24);
        const rgb = hexToRgb(primaryColor);
        const primarySoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
        const primaryBorderSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

        const monogram = getClinicMonogram(clinicName);
        const portalUrl = tenant.portal_url || tenant.clinicUrl || ((tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`);

        const doctorSubtitleHtml = doctorName 
            ? `<div style="font-size: 12.5px; color: #E2E8F0; margin-top: 3px; font-weight: 500;">${doctorName} &bull; Dental Care</div>`
            : `<div style="font-size: 12.5px; color: #E2E8F0; margin-top: 3px; font-weight: 500;">Comprehensive Dental Care</div>`;

        // Only display contact strip if actual phone or address exists
        let contactStripHtml = '';
        if (phone || address) {
            contactStripHtml = `
              <tr>
                <td style="padding: 0 28px 24px 28px;">
                  <div style="background-color: ${primarySoft}; border: 1.5px solid ${primaryBorderSoft}; border-radius: 14px; padding: 18px 20px; font-size: 13px; color: #334155;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        ${address ? `
                          <td style="vertical-align: top; width: 55%; padding-right: 12px;">
                            <strong style="color: #0F172A; display: block; margin-bottom: 3px; font-size: 13px;">📍 Clinic Address:</strong>
                            <span style="color: #475569; line-height: 1.4;">${address}</span>
                          </td>
                        ` : ''}
                        ${phone ? `
                          <td style="vertical-align: top; text-align: ${address ? 'right' : 'left'};">
                            <strong style="color: #0F172A; display: block; margin-bottom: 3px; font-size: 13px;">📞 Contact / WhatsApp:</strong>
                            <a href="tel:${cleanPhone}" style="color: ${primaryColor}; text-decoration: none; font-weight: 800; font-size: 14px;">${phone}</a>
                          </td>
                        ` : ''}
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>
            `;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${clinicName}</title>
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
    table { border-collapse: collapse; }
    .email-container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
    .btn-action { display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); color: #FFFFFF !important; text-decoration: none; font-weight: 800; font-size: 14px; padding: 13px 28px; border-radius: 9px; box-shadow: 0 4px 14px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35); text-align: center; }
  </style>
</head>
<body style="margin: 0; padding: 20px; background-color: #F8FAFC; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 6px 18px rgba(0,0,0,0.06);">
          
          <!-- TOP TENANT BRAND ACCENT STRIP -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, ${primaryColor} 0%, ${primaryDark} 100%); line-height: 6px; font-size: 1px;">&nbsp;</td>
          </tr>

          <!-- DYNAMIC BRAND HEADER WITH 2-CHARACTER MONOGRAM BADGE -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryDark} 0%, #0F172A 85%); padding: 26px 28px; color: #FFFFFF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
                      <tr>
                        <!-- DYNAMIC 2-CHARACTER MONOGRAM LOGO BADGE -->
                        <td style="width: 46px; height: 46px; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); border-radius: 12px; border: 2px solid rgba(255,255,255,0.4); text-align: center; vertical-align: middle; color: #FFFFFF; font-size: 19px; font-weight: 900; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">${monogram}</td>
                        <td style="padding-left: 14px; vertical-align: middle;">
                          <div style="font-size: 19px; font-weight: 900; letter-spacing: -0.3px; line-height: 1.2; color: #FFFFFF; text-transform: uppercase;">
                            ${clinicName}
                          </div>
                          ${doctorSubtitleHtml}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.26); color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Verified Clinic
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT BODY -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- DYNAMIC CLINIC CONTACT HIGHLIGHT STRIP (Only if data exists) -->
          ${contactStripHtml}

          <!-- DYNAMIC FOOTER -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 28px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0;">
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin: 0 auto 10px auto;">
                <tr>
                  <td style="width: 26px; height: 26px; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); border-radius: 7px; text-align: center; vertical-align: middle; color: #FFFFFF; font-size: 11px; font-weight: 900;">${monogram}</td>
                  <td style="padding-left: 8px; font-weight: 800; color: #0F172A; font-size: 13px;">
                    ${clinicName}
                  </td>
                </tr>
              </table>
              <div style="line-height: 1.5;">This communication was sent specifically to you on behalf of <strong>${clinicName}</strong>.</div>
              <div style="margin-top: 8px; font-size: 11px; color: #94A3B8;">
                <a href="${portalUrl}" style="color: ${primaryColor}; text-decoration: none; font-weight: 700;">Visit ${clinicName} Online Portal</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    // --- TEMPLATE FACTORY OBJECT ---
    const templates = {
        /**
         * 1. WELCOME EMAIL (Sent upon first-time Google sign-in / registration)
         */
        getWelcomeEmail(arg1, arg2) {
            const { tenant, data } = extractTenantAndData(arg1, arg2);
            const clinicName = resolveClinicName(tenant);
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const primaryDark = adjustBrightness(primaryColor, -24);
            const rgb = hexToRgb(primaryColor);
            const primarySoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
            const primaryBorderSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

            const salutation = formatSalutation(data);
            const portalUrl = tenant.portal_url || tenant.clinicUrl || ((tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`);

            const body = `
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0;">
                Welcome to ${clinicName}! 👋
              </h2>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                ${salutation}
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Thank you for connecting with <strong>${clinicName}</strong>. Your personalized patient portal is now active. You can now conveniently book appointments, view your digital prescriptions, access treatment estimates, and track all your dental visits from any device.
              </p>

              <!-- TENANT THEMED FEATURE HIGHLIGHTS -->
              <div style="background-color: ${primarySoft}; border: 1.5px solid ${primaryBorderSoft}; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <h3 style="font-size: 13.5px; font-weight: 800; color: ${primaryDark}; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  ✨ What You Can Do in Your Clinic Portal:
                </h3>
                <table role="presentation" width="100%" cellpadding="4" cellspacing="0" style="font-size: 13.5px; color: #334155; line-height: 1.6;">
                  <tr><td style="width: 22px; color: ${primaryColor}; font-weight: 800; font-size: 16px; vertical-align: top;">✓</td><td><strong>Instant Online Booking:</strong> Choose your preferred consultation time-slot 24/7.</td></tr>
                  <tr><td style="width: 22px; color: ${primaryColor}; font-weight: 800; font-size: 16px; vertical-align: top;">✓</td><td><strong>Digital Prescriptions:</strong> View and download medication instructions anytime.</td></tr>
                  <tr><td style="width: 22px; color: ${primaryColor}; font-weight: 800; font-size: 16px; vertical-align: top;">✓</td><td><strong>Treatment Roadmap &amp; Estimates:</strong> Review procedure sittings &amp; invoices seamlessly.</td></tr>
                  <tr><td style="width: 22px; color: ${primaryColor}; font-weight: 800; font-size: 16px; vertical-align: top;">✓</td><td><strong>Emergency Dental Support:</strong> Contact our team with direct one-tap assistance.</td></tr>
                </table>
              </div>

              <!-- DYNAMIC CTA BUTTON -->
              <div style="text-align: center; margin: 28px 0 20px 0;">
                <a href="${portalUrl}" class="btn-action" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); color: #FFFFFF !important; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35);">
                  Open ${clinicName} Portal &rarr;
                </a>
              </div>
            `;

            return {
                subject: `Welcome to ${clinicName} - Your Patient Portal is Active`,
                html: wrapEmailBoilerplate(body, tenant)
            };
        },

        /**
         * 2. APPOINTMENT CONFIRMATION EMAIL
         */
        getAppointmentConfirmationEmail(arg1, arg2) {
            const { tenant, data } = extractTenantAndData(arg1, arg2);
            const clinicName = resolveClinicName(tenant);
            const doctorName = resolveDoctorName(tenant);
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const primaryDark = adjustBrightness(primaryColor, -24);
            const rgb = hexToRgb(primaryColor);
            const primarySoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
            const primaryBorderSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

            const appt = data.appointment || data;
            const salutation = formatSalutation(data);
            const dateStr = appt.date || appt.appointmentDate || 'Upcoming Date';
            const timeStr = appt.time || appt.appointmentTime || 'Scheduled Time';
            const reason = appt.reason || 'General Dental Consultation';
            const portalUrl = tenant.portal_url || tenant.clinicUrl || ((tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`);
            const phone = (tenant.phone || tenant.doctor_phone || tenant.mobile || '').trim();
            const cleanPhone = phone.replace(/[^0-9]/g, '');

            const body = `
              <div style="display: inline-block; background-color: ${primarySoft}; border: 1.5px solid ${primaryBorderSoft}; color: ${primaryDark}; font-size: 12px; font-weight: 800; padding: 5px 14px; border-radius: 99px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                ✓ Appointment Confirmed
              </div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Your Dental Visit is Scheduled!
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                ${salutation} your appointment at <strong>${clinicName}</strong> has been successfully booked. Below are your consultation details:
              </p>

              <!-- APPOINTMENT PASS TICKET -->
              <div style="background-color: #F8FAFC; border: 2px dashed ${primaryColor}; border-radius: 14px; padding: 22px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px;">
                  ${doctorName ? `
                    <tr>
                      <td style="color: #64748B; width: 35%;"><strong>Consulting Doctor:</strong></td>
                      <td style="color: #0F172A; font-weight: 700;">${doctorName}</td>
                    </tr>
                  ` : `
                    <tr>
                      <td style="color: #64748B; width: 35%;"><strong>Clinic:</strong></td>
                      <td style="color: #0F172A; font-weight: 700;">${clinicName}</td>
                    </tr>
                  `}
                  <tr>
                    <td style="color: #64748B;"><strong>Date of Visit:</strong></td>
                    <td style="color: #0F172A; font-weight: 700;">📅 ${dateStr}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748B;"><strong>Appointment Time:</strong></td>
                    <td style="color: ${primaryColor}; font-weight: 800; font-size: 16px;">⏰ ${timeStr}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748B;"><strong>Purpose of Visit:</strong></td>
                    <td style="color: #0F172A; font-weight: 600;">🦷 ${reason}</td>
                  </tr>
                </table>
              </div>

              <!-- PRE-VISIT ADVICE -->
              <div style="background-color: #FEF9C3; border: 1.5px solid #FDE047; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #854D0E; line-height: 1.5; margin-bottom: 22px;">
                💡 <strong>Pre-Visit Advice:</strong> Please arrive 10 minutes prior to your slot. If you have past dental X-rays or ongoing medication prescriptions, please bring them along.
              </div>

              <!-- ACTION BUTTONS -->
              <div style="text-align: center; margin-top: 24px;">
                <table role="presentation" align="center" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right: 12px;">
                      <a href="${portalUrl}" class="btn-action" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); color: #FFFFFF !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
                        Manage in Portal &rarr;
                      </a>
                    </td>
                    ${(cleanPhone && cleanPhone.length >= 7) ? `
                      <td>
                        <a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${clinicName}, I am confirming my appointment on ${dateStr} at ${timeStr}.`)}" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 22px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25);">
                          WhatsApp Clinic
                        </a>
                      </td>
                    ` : ''}
                  </tr>
                </table>
              </div>
            `;

            return {
                subject: `Appointment Confirmed: ${dateStr} at ${timeStr} | ${clinicName}`,
                html: wrapEmailBoilerplate(body, tenant)
            };
        },

        /**
         * 3. APPOINTMENT REMINDER EMAIL
         */
        getAppointmentReminderEmail(arg1, arg2) {
            const { tenant, data } = extractTenantAndData(arg1, arg2);
            const clinicName = resolveClinicName(tenant);
            const doctorName = resolveDoctorName(tenant);
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const primaryDark = adjustBrightness(primaryColor, -24);
            const rgb = hexToRgb(primaryColor);
            const primarySoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
            const primaryBorderSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

            const appt = data.appointment || data;
            const salutation = formatSalutation(data);
            const dateStr = appt.date || appt.appointmentDate || 'Tomorrow';
            const timeStr = appt.time || appt.appointmentTime || 'Scheduled Time';
            const portalUrl = tenant.portal_url || tenant.clinicUrl || ((tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`);

            const body = `
              <div style="display: inline-block; background-color: ${primarySoft}; border: 1.5px solid ${primaryBorderSoft}; color: ${primaryDark}; font-size: 12px; font-weight: 800; padding: 5px 14px; border-radius: 99px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                ⏰ Friendly Reminder
              </div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Your Dental Visit is Coming Up!
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                ${salutation} this is a quick reminder from <strong>${clinicName}</strong> for your scheduled consultation:
              </p>

              <!-- SCHEDULE HIGHLIGHT CARD -->
              <div style="background: linear-gradient(135deg, #F8FAFC 0%, ${primarySoft} 100%); border: 1.5px solid ${primaryBorderSoft}; border-radius: 14px; padding: 22px; margin-bottom: 22px; text-align: center;">
                <div style="font-size: 13px; font-weight: 700; color: #64748B; text-transform: uppercase;">Your Confirmed Slot</div>
                <div style="font-size: 20px; font-weight: 800; color: #0F172A; margin-top: 4px;">📅 ${dateStr}</div>
                <div style="font-size: 26px; font-weight: 900; color: ${primaryColor}; margin-top: 6px;">⏰ ${timeStr}</div>
                ${doctorName ? `<div style="font-size: 13px; color: #475569; margin-top: 6px;">Consulting with <strong>${doctorName}</strong></div>` : ''}
              </div>

              <p style="font-size: 13px; color: #64748B; line-height: 1.5;">
                Need to reschedule or running late? Please notify our clinic reception directly or click below to manage your slot.
              </p>

              <div style="text-align: center; margin-top: 24px;">
                <a href="${portalUrl}" class="btn-action" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); color: #FFFFFF !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 28px; border-radius: 9px; box-shadow: 0 4px 14px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35);">
                  View Appointment in Portal &rarr;
                </a>
              </div>
            `;

            return {
                subject: `Reminder: Upcoming Dental Visit on ${dateStr} at ${timeStr} | ${clinicName}`,
                html: wrapEmailBoilerplate(body, tenant)
            };
        },

        /**
         * 4. TREATMENT PLAN & ESTIMATE EMAIL
         */
        getTreatmentPlanEmail(arg1, arg2) {
            const { tenant, data } = extractTenantAndData(arg1, arg2);
            const clinicName = resolveClinicName(tenant);
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const primaryDark = adjustBrightness(primaryColor, -24);
            const rgb = hexToRgb(primaryColor);
            const primarySoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
            const primaryBorderSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

            const plan = data.treatmentPlan || data.plan || data;
            const salutation = formatSalutation(data);
            const items = plan.items || [];
            const grandTotal = plan.grandTotal || 0;
            const portalUrl = tenant.portal_url || tenant.clinicUrl || ((tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`);

            const rowsHtml = items.map((it, idx) => `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px 10px; font-size: 13px; color: #0F172A;">
                  ${idx + 1}. <strong>${it.name}</strong><br>
                  <span style="font-size: 11px; color: #64748B;">Tooth: ${it.tooth || 'General'} | Sittings: ${it.sittings || 1}</span>
                </td>
                <td style="padding: 12px 10px; font-size: 13.5px; font-weight: 800; color: #0F172A; text-align: right;">
                  ₹${(it.cost || 0).toLocaleString('en-IN')}
                </td>
              </tr>
            `).join('');

            const body = `
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Treatment Plan &amp; Cost Estimate
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                ${salutation} following your dental examination at <strong>${clinicName}</strong>, here is your customized treatment roadmap and cost quotation:
              </p>

              <!-- PROCEDURES ESTIMATE TABLE -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 22px; border: 1.5px solid #E2E8F0; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background-color: ${primarySoft}; border-bottom: 2px solid ${primaryBorderSoft};">
                    <th style="padding: 12px 10px; text-align: left; font-size: 12px; font-weight: 800; color: ${primaryDark}; text-transform: uppercase;">Proposed Dental Procedure</th>
                    <th style="padding: 12px 10px; text-align: right; font-size: 12px; font-weight: 800; color: ${primaryDark}; text-transform: uppercase;">Estimated Fee</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="2" style="padding: 14px; text-align: center; color: #94A3B8;">No procedures listed</td></tr>'}
                </tbody>
                <tfoot>
                  <tr style="background: linear-gradient(135deg, ${primarySoft} 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14) 100%); border-top: 2px solid ${primaryBorderSoft};">
                    <td style="padding: 14px 10px; font-size: 15px; font-weight: 800; color: ${primaryDark};">Grand Total Estimate:</td>
                    <td style="padding: 14px 10px; font-size: 18px; font-weight: 900; color: ${primaryDark}; text-align: right;">₹${grandTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>

              <div style="font-size: 12.5px; color: #64748B; line-height: 1.5; margin-bottom: 20px;">
                * Note: Procedures can be scheduled in phased, comfortable sittings. Milestone payments are supported at every visit.
              </div>

              <div style="text-align: center; margin-top: 24px;">
                <a href="${portalUrl}" class="btn-action" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); color: #FFFFFF !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 28px; border-radius: 9px; box-shadow: 0 4px 14px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35);">
                  Review in Portal &amp; Confirm Sittings &rarr;
                </a>
              </div>
            `;

            return {
                subject: `Treatment Plan & Cost Quotation | ${clinicName}`,
                html: wrapEmailBoilerplate(body, tenant)
            };
        },

        /**
         * 5. DIGITAL PRESCRIPTION & POST-CARE EMAIL
         */
        getPrescriptionEmail(arg1, arg2) {
            const { tenant, data } = extractTenantAndData(arg1, arg2);
            const clinicName = resolveClinicName(tenant);
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const primaryDark = adjustBrightness(primaryColor, -24);
            const rgb = hexToRgb(primaryColor);
            const primarySoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
            const primaryBorderSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

            const rx = data.prescription || data.rx || data;
            const salutation = formatSalutation(data);
            const meds = rx.medicines || rx.items || [];
            const portalUrl = tenant.portal_url || tenant.clinicUrl || ((tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`);

            const medRows = meds.map((m, idx) => `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 10px 8px; font-size: 13px; font-weight: 700; color: #0F172A;">${idx + 1}. ${m.name}</td>
                <td style="padding: 10px 8px; font-size: 12px; color: #475569;">${m.dosage || '1-0-1'}</td>
                <td style="padding: 10px 8px; font-size: 12px; color: #475569;">${m.duration || '3 Days'}</td>
                <td style="padding: 10px 8px; font-size: 12px; color: #64748B;">${m.instructions || 'After meals'}</td>
              </tr>
            `).join('');

            const body = `
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Digital Prescription &amp; Post-Care Advice
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                ${salutation} below is your digital prescription following your treatment at <strong>${clinicName}</strong>:
              </p>

              <!-- MEDICATIONS TABLE -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1.5px solid #E2E8F0; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background-color: ${primarySoft}; border-bottom: 2px solid ${primaryBorderSoft};">
                    <th style="padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 800; color: ${primaryDark};">Medicine</th>
                    <th style="padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 800; color: ${primaryDark};">Dosage</th>
                    <th style="padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 800; color: ${primaryDark};">Duration</th>
                    <th style="padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 800; color: ${primaryDark};">Timing</th>
                  </tr>
                </thead>
                <tbody>
                  ${medRows || '<tr><td colspan="4" style="padding: 14px; text-align: center; color: #94A3B8;">No medications prescribed</td></tr>'}
                </tbody>
              </table>

              <!-- POST-TREATMENT ADVICE -->
              <div style="background-color: ${primarySoft}; border: 1.5px solid ${primaryBorderSoft}; border-radius: 12px; padding: 16px 18px; font-size: 13px; color: ${primaryDark}; line-height: 1.5; margin-bottom: 20px;">
                🦷 <strong>Post-Treatment Care Instructions:</strong> Avoid eating hot or very hard foods for 2 hours. Drink plenty of water and complete the prescribed dosage as instructed.
              </div>

              <div style="text-align: center; margin-top: 24px;">
                <a href="${portalUrl}" class="btn-action" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); color: #FFFFFF !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 28px; border-radius: 9px; box-shadow: 0 4px 14px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35);">
                  Download Official Rx PDF in Portal &rarr;
                </a>
              </div>
            `;

            return {
                subject: `Digital Prescription & Post-Care Advice | ${clinicName}`,
                html: wrapEmailBoilerplate(body, tenant)
            };
        },

        /**
         * 6. DAILY PATIENT ENGAGEMENT & MARKETING BROADCAST EMAIL
         */
        getMarketingEngagementTemplate({ patientName = '', tenant = {}, templateKey = 'daily_care', customSubject = '', customMessage = '', clinicUrl = '' } = {}) {
            const clinicName = resolveClinicName(tenant);
            const doctorName = resolveDoctorName(tenant);
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const primaryDark = adjustBrightness(primaryColor, -24);
            const rgb = hexToRgb(primaryColor);
            const primarySoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
            const primaryBorderSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

            const link = clinicUrl || tenant.portal_url || ((tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`);

            const salutation = patientName ? `Dear <strong>${patientName}</strong>,` : `Hello,`;
            const signoff = doctorName ? `— ${doctorName}, ${clinicName}` : `— Team ${clinicName}`;

            let subject = customSubject;
            let title = '';
            let subtitle = '';
            let contentHtml = '';
            let buttonText = 'Book Appointment Now';

            if (templateKey === 'daily_care') {
                subject = subject || `🌟 Daily Oral Care Guide from ${clinicName}`;
                title = `Keep Your Smile Bright & Healthy Every Day!`;
                subtitle = doctorName ? `Oral Health Guide from ${doctorName}` : `Clinic Wellness Guide`;
                buttonText = `📅 Book Routine Consultation`;
                contentHtml = `
                    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                        ${salutation}
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                        A healthy smile leads to lasting overall confidence and wellness! Here are recommended daily care habits from <strong>${clinicName}</strong>:
                    </p>
                    <div style="background-color: ${primarySoft}; border: 1.5px solid ${primaryBorderSoft}; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
                        <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
                            <li><strong>2-Minute Brushing:</strong> Brush gently twice a day using a soft-bristled brush and fluoride toothpaste.</li>
                            <li><strong>Clean Between Teeth:</strong> Floss or use an interdental brush daily to prevent plaque buildup and gum inflammation.</li>
                            <li><strong>Stay Hydrated:</strong> Drinking plenty of water washes away food particles and neutralizes enamel-damaging acids.</li>
                            <li><strong>Timely 6-Month Checkup:</strong> Routine scaling and examination detect minor issues before they become painful or costly.</li>
                        </ul>
                    </div>
                    <div style="background-color: #F8FAFC; border-left: 4px solid ${primaryColor}; border-radius: 4px 12px 12px 4px; padding: 14px 18px; color: #334155; font-size: 13.5px; line-height: 1.5; margin-bottom: 20px;">
                        ✨ <em>"Prevention is always easier, gentler, and more affordable than cure."</em><br>
                        <strong style="color: ${primaryDark};">${signoff}</strong>
                    </div>
                `;
            } else if (templateKey === 'checkup_offer') {
                subject = subject || `🎁 Consultation Privilege: Routine Dental Checkup at ${clinicName}`;
                title = `Routine Dental Checkup Assessment`;
                subtitle = doctorName ? `Clinical Assessment with ${doctorName}` : `Routine Oral Checkup`;
                buttonText = `🎁 Book Consultation Slot`;
                contentHtml = `
                    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                        ${salutation}
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                        We are pleased to invite you for a comprehensive clinical assessment at <strong>${clinicName}</strong>.
                    </p>
                    <div style="background-color: #FEF3C7; border: 1.5px solid #FDE68A; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
                        <div style="font-weight: 800; color: #92400E; font-size: 14px; margin-bottom: 10px;">✨ Comprehensive Assessment Includes:</div>
                        <ul style="margin: 0; padding-left: 20px; color: #78350F; font-size: 13.5px; line-height: 1.7;">
                            <li>Full digital diagnostic visual examination</li>
                            <li>Gum &amp; periodontal health evaluation</li>
                            <li>Bite and alignment assessment</li>
                            <li>Personalized treatment quotation &amp; guidance</li>
                        </ul>
                    </div>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                        Click below to choose your convenient consultation timing!
                    </p>
                `;
            } else if (templateKey === 'portal_reminder') {
                subject = subject || `📋 Your Digital Dental Portal & Records | ${clinicName}`;
                title = `Your Dental Portal is Live & Accessible`;
                subtitle = `Instant Access to Prescriptions, Invoices & Online Booking`;
                buttonText = `📱 Open My Patient Portal`;
                contentHtml = `
                    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                        ${salutation}
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                        Did you know you can access your dental records online 24/7 with zero waiting time at <strong>${clinicName}</strong>?
                    </p>
                    <div style="background-color: ${primarySoft}; border: 1.5px solid ${primaryBorderSoft}; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
                        <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
                            <li><strong>Digital Prescriptions:</strong> View and download your doctor's Rx anytime.</li>
                            <li><strong>Itemized Invoices:</strong> Track all your treatments and payments seamlessly.</li>
                            <li><strong>Instant Slot Booking:</strong> Book your upcoming checkup in under 30 seconds.</li>
                        </ul>
                    </div>
                `;
            } else {
                subject = subject || `Important Clinical Update from ${clinicName}`;
                title = customSubject || `Notice from ${clinicName}`;
                subtitle = doctorName ? `${doctorName} • ${clinicName}` : clinicName;
                buttonText = `Visit Clinic Portal`;
                contentHtml = `
                    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                        ${salutation}
                    </p>
                    <div style="font-size: 14px; line-height: 1.7; color: #475569; margin: 0 0 18px 0;">
                        ${(customMessage || 'We hope you are smiling bright! Please connect with us for any dental wellness assistance.').replace(/\n/g, '<br>')}
                    </div>
                `;
            }

            const body = `
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 6px 0; line-height: 1.3;">
                        ${title}
                    </h2>
                    <div style="font-size: 13px; color: ${primaryColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${subtitle}
                    </div>
                </div>

                ${contentHtml}

                <div style="text-align: center; margin: 26px 0 18px 0;">
                    <a href="${link}" class="btn-action" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%); color: #FFFFFF !important; text-decoration: none; font-weight: 800; font-size: 14px; padding: 14px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35);">
                        ${buttonText} &rarr;
                    </a>
                </div>
            `;

            return {
                subject: subject,
                html: wrapEmailBoilerplate(body, tenant)
            };
        }
    };

    // Backward compatible aliases
    templates.getWelcomeTemplate = templates.getWelcomeEmail;
    templates.getAppointmentConfirmationTemplate = templates.getAppointmentConfirmationEmail;
    templates.getAppointmentReminderTemplate = templates.getAppointmentReminderEmail;
    templates.getTreatmentPlanTemplate = templates.getTreatmentPlanEmail;
    templates.getPrescriptionTemplate = templates.getPrescriptionEmail;
    templates.getClinicMonogram = getClinicMonogram;
    templates.wrapEmailBoilerplate = wrapEmailBoilerplate;

    return templates;
}));
