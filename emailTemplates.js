/**
 * emailTemplates.js - Professional Tenant-Theme Specific Email Templates
 * Generates beautiful, responsive, clinical email templates tailored to each clinic's brand color,
 * doctor credentials, logo, and contact information.
 * Developed for Multi-Clinic Dental & Healthcare Architecture.
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

    // Helper: Wrap template in clean, responsive HTML email boilerplate
    function wrapEmailBoilerplate(contentHtml, tenant = {}) {
        const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
        const clinicName = tenant.clinic_name || tenant.name || 'My Dental Clinic';
        const doctorName = tenant.doctor_name || tenant.subtitle || 'Dental Specialist';
        const phone = tenant.phone || '+91 98765 43210';
        const address = tenant.address || 'Main Clinic Road';

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${clinicName}</title>
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
    table { border-collapse: collapse; }
    .email-container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header-banner { background: linear-gradient(135deg, ${primaryColor} 0%, #0F172A 100%); color: #FFFFFF; padding: 32px 28px; text-align: left; }
    .btn-action { display: inline-block; background-color: ${primaryColor}; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; margin-top: 16px; }
    .footer-bar { background-color: #F1F5F9; padding: 22px 28px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body style="margin: 0; padding: 20px; background-color: #F8FAFC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0;">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #0F172A 100%); padding: 30px 28px; color: #FFFFFF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; color: #FFFFFF;">
                      🏥 ${clinicName.toUpperCase()}
                    </div>
                    <div style="font-size: 13px; color: #E2E8F0; margin-top: 4px; font-weight: 500;">
                      ${doctorName} &bull; Advanced Patient Care
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <span style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.25); color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; text-transform: uppercase;">
                      Verified Clinic
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT BODY -->
          <tr>
            <td style="padding: 32px 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- CLINIC CONTACT HIGHLIGHT -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; font-size: 13px; color: #475569;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <strong style="color: #0F172A; display: block; margin-bottom: 2px;">📍 Clinic Address:</strong>
                      ${address}
                    </td>
                    <td align="right">
                      <strong style="color: #0F172A; display: block; margin-bottom: 2px;">📞 Call / WhatsApp:</strong>
                      <a href="tel:${phone}" style="color: ${primaryColor}; text-decoration: none; font-weight: 700;">${phone}</a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #F1F5F9; padding: 22px 28px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0;">
              <div>This official notification was sent by <strong>${clinicName}</strong>.</div>
              <div style="margin-top: 6px;">Multi-Tenant Dental Healthcare System &bull; Powered by <a href="https://proconixsoftware.vercel.app" style="color: ${primaryColor}; text-decoration: none; font-weight: 700;">proconixsoftware.vercel.app</a></div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    return {
        /**
         * 1. WELCOME EMAIL (Sent upon first-time Google sign-in / registration)
         */
        getWelcomeEmail(tenant = {}, patient = {}) {
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const clinicName = tenant.clinic_name || tenant.name || 'My Dental Clinic';
            const patientName = patient.name || patient.displayName || 'Valued Patient';
            const portalUrl = (tenant.slug && tenant.slug !== 'default') ? `https://mydentalclinic01.vercel.app/${tenant.slug}` : `https://mydentalclinic01.vercel.app/`;

            const body = `
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0;">
                Welcome to ${clinicName}! 👋
              </h2>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 18px 0;">
                Dear <strong>${patientName}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Thank you for connecting with <strong>${clinicName}</strong>. Your personalized patient portal is now active. You can now easily book appointments, access your dental prescriptions, view treatment estimates, and track your clinical visits anytime from any device.
              </p>

              <div style="background-color: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                <h3 style="font-size: 14px; font-weight: 800; color: #166534; margin: 0 0 8px 0; text-transform: uppercase;">
                  ✨ What You Can Do in Your Portal:
                </h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803D; line-height: 1.7;">
                  <li>Book priority dental appointments instantly online</li>
                  <li>Download digital Rx prescriptions with dosage guidelines</li>
                  <li>Review treatment plan estimates &amp; procedure sittings</li>
                  <li>Update your medical history &amp; emergency alerts securely</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 28px 0 20px 0;">
                <a href="${portalUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #FFFFFF; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.12);">
                  Open Clinic Portal &amp; Book Visit &rarr;
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
        getAppointmentConfirmationEmail(tenant = {}, appt = {}) {
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const clinicName = tenant.clinic_name || tenant.name || 'My Dental Clinic';
            const doctorName = tenant.doctor_name || tenant.subtitle || 'Dr. Dental Specialist';
            const patientName = appt.name || 'Patient';
            const dateStr = appt.date || appt.appointmentDate || 'Upcoming Date';
            const timeStr = appt.time || appt.appointmentTime || 'Scheduled Time';
            const reason = appt.reason || 'General Dental Consultation';

            const body = `
              <div style="display: inline-block; background-color: #DCFCE7; color: #16A34A; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 99px; margin-bottom: 12px; text-transform: uppercase;">
                ✓ Appointment Confirmed
              </div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Your Dental Visit is Scheduled!
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Dear <strong>${patientName}</strong>, your appointment at <strong>${clinicName}</strong> has been confirmed. Below are your consultation details:
              </p>

              <!-- APPOINTMENT PASS TICKET -->
              <div style="background-color: #F8FAFC; border: 2px dashed ${primaryColor}; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px;">
                  <tr>
                    <td style="color: #64748B; width: 35%;"><strong>Consulting Doctor:</strong></td>
                    <td style="color: #0F172A; font-weight: 700;">${doctorName}</td>
                  </tr>
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

              <!-- PRE-VISIT INSTRUCTIONS -->
              <div style="background-color: #FEF9C3; border: 1px solid #FDE047; border-radius: 10px; padding: 14px; font-size: 13px; color: #854D0E; line-height: 1.5; margin-bottom: 22px;">
                💡 <strong>Pre-Visit Advice:</strong> Please arrive 10 minutes prior to your slot. If you have past dental X-rays or ongoing medication prescriptions, please bring them along.
              </div>

              <div style="text-align: center; margin-top: 24px;">
                <a href="https://wa.me/${(tenant.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${clinicName}, I am confirming my appointment on ${dateStr} at ${timeStr}.`)}" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
                  Confirm via WhatsApp
                </a>
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
        getAppointmentReminderEmail(tenant = {}, appt = {}) {
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const clinicName = tenant.clinic_name || tenant.name || 'My Dental Clinic';
            const patientName = appt.name || 'Patient';
            const dateStr = appt.date || appt.appointmentDate || 'Tomorrow';
            const timeStr = appt.time || appt.appointmentTime || 'Scheduled Time';

            const body = `
              <div style="display: inline-block; background-color: #EFF6FF; color: #2563EB; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 99px; margin-bottom: 12px; text-transform: uppercase;">
                ⏰ Friendly Reminder
              </div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Your Appointment is Tomorrow!
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                Dear <strong>${patientName}</strong>, this is a quick reminder from <strong>${clinicName}</strong> for your scheduled visit:
              </p>

              <div style="background-color: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 18px; margin-bottom: 20px; text-align: center;">
                <div style="font-size: 18px; font-weight: 800; color: #0F172A;">${dateStr}</div>
                <div style="font-size: 24px; font-weight: 800; color: ${primaryColor}; margin-top: 4px;">${timeStr}</div>
              </div>

              <p style="font-size: 13px; color: #64748B; line-height: 1.5;">
                Need to reschedule or running late? Please notify our clinic reception directly so we can accommodate your slot.
              </p>
            `;
            return {
                subject: `Reminder: Upcoming Dental Visit Tomorrow at ${timeStr} | ${clinicName}`,
                html: wrapEmailBoilerplate(body, tenant)
            };
        },

        /**
         * 4. TREATMENT PLAN & ESTIMATE EMAIL
         */
        getTreatmentPlanEmail(tenant = {}, plan = {}) {
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const clinicName = tenant.clinic_name || tenant.name || 'My Dental Clinic';
            const patientName = plan.patientName || 'Patient';
            const items = plan.items || [];
            const grandTotal = plan.grandTotal || 0;

            const rowsHtml = items.map((it, idx) => `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 10px 8px; font-size: 13px; color: #0F172A;">${idx + 1}. <strong>${it.name}</strong><br><span style="font-size: 11px; color: #64748B;">Tooth: ${it.tooth || 'All'} | Sittings: ${it.sittings || 1}</span></td>
                <td style="padding: 10px 8px; font-size: 13px; font-weight: 700; color: #0F172A; text-align: right;">₹${(it.cost || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('');

            const body = `
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Treatment Plan &amp; Cost Estimate
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                Dear <strong>${patientName}</strong>, following your dental examination at <strong>${clinicName}</strong>, here is your customized treatment roadmap and cost quotation:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #F8FAFC; border-bottom: 2px solid #E2E8F0;">
                    <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #64748B; text-transform: uppercase;">Proposed Procedure</th>
                    <th style="padding: 10px 8px; text-align: right; font-size: 12px; color: #64748B; text-transform: uppercase;">Cost (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #94A3B8;">No procedures listed</td></tr>'}
                </tbody>
                <tfoot>
                  <tr style="background-color: #F0FDF4;">
                    <td style="padding: 14px 8px; font-size: 15px; font-weight: 800; color: #166534;">Grand Total Estimate:</td>
                    <td style="padding: 14px 8px; font-size: 18px; font-weight: 800; color: #166534; text-align: right;">₹${grandTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>

              <div style="font-size: 12px; color: #64748B; line-height: 1.5; margin-bottom: 20px;">
                * Note: Procedures can be scheduled in flexible phased sittings. Milestone payments are supported at every visit.
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
        getPrescriptionEmail(tenant = {}, rx = {}) {
            const primaryColor = tenant.primary_color || tenant.primaryColor || '#0D9488';
            const clinicName = tenant.clinic_name || tenant.name || 'My Dental Clinic';
            const patientName = rx.patientName || 'Patient';
            const meds = rx.medicines || [];

            const medRows = meds.map((m, idx) => `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 8px; font-size: 13px; font-weight: 700; color: #0F172A;">${idx + 1}. ${m.name}</td>
                <td style="padding: 8px; font-size: 12px; color: #475569;">${m.dosage || '1-0-1'}</td>
                <td style="padding: 8px; font-size: 12px; color: #475569;">${m.duration || '3 Days'}</td>
                <td style="padding: 8px; font-size: 12px; color: #64748B;">${m.instructions || 'After meals'}</td>
              </tr>
            `).join('');

            const body = `
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0;">
                Digital Prescription &amp; Post-Care Advice
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                Dear <strong>${patientName}</strong>, below is your digital prescription following your treatment at <strong>${clinicName}</strong>:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #F8FAFC; border-bottom: 2px solid #E2E8F0;">
                    <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748B;">Medicine</th>
                    <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748B;">Dosage</th>
                    <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748B;">Duration</th>
                    <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748B;">Timing</th>
                  </tr>
                </thead>
                <tbody>
                  ${medRows || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94A3B8;">No medications prescribed</td></tr>'}
                </tbody>
              </table>

              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 14px; font-size: 13px; color: #166534; line-height: 1.5;">
                🦷 <strong>Post-Treatment Care Instructions:</strong> Avoid eating hot or very hard foods for 2 hours. Drink plenty of water and complete the prescribed dosage as instructed.
              </div>
            `;
            return {
                subject: `Digital Prescription & Post-Care Advice | ${clinicName}`,
                html: wrapEmailBoilerplate(body, tenant)
            };
        }
    };
}));
