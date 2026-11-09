// api/tenant-icon.js - Dynamic Vector App Icon & Favicon Engine for Multi-Tenant Dental PWA
module.exports = (req, res) => {
    let tenantId = (req.query.c || req.query.tenant || req.query.slug || '').toString().toLowerCase().trim();

    // Check cookie fallback if query param not present (e.g. direct /favicon.ico request)
    if (!tenantId && req.headers.cookie) {
        const match = req.headers.cookie.match(/(?:clinic_tenant|tenant_id)=([^;]+)/);
        if (match) tenantId = decodeURIComponent(match[1]).toLowerCase().trim();
    }

    // Check referer header fallback
    if (!tenantId && req.headers.referer) {
        try {
            const refUrl = new URL(req.headers.referer);
            tenantId = (refUrl.searchParams.get('c') || '').toLowerCase().trim();
            if (!tenantId) {
                const segs = refUrl.pathname.replace(/^\/+|\/+$/g, '').split('/');
                const last = segs[segs.length - 1];
                if (last && !last.includes('.') && last !== 'api' && last !== 'superadmin') {
                    tenantId = last.toLowerCase().trim();
                }
            }
        } catch (e) {}
    }

    if (!tenantId) tenantId = 'default';
    const size = parseInt(req.query.size) || 512;

    // Resolve tenant details
    let clinicName = 'My Dental Clinic';
    let primaryColor = '#10B981';
    let primaryDark = '#059669';

    if (tenantId.includes('swastik')) {
        clinicName = 'Swastik Dental Clinic';
        primaryColor = '#0D9488';
        primaryDark = '#115E59';
    } else if (tenantId.includes('sumya')) {
        clinicName = 'Sumya Dental Clinic';
        primaryColor = '#0D9488';
        primaryDark = '#115E59';
    } else if (tenantId !== 'default' && tenantId) {
        const words = tenantId.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        const formatted = words.join(' ');
        clinicName = formatted.toLowerCase().includes('clinic') || formatted.toLowerCase().includes('dental') ? formatted : `${formatted} Dental Clinic`;
        primaryColor = '#0D9488';
        primaryDark = '#115E59';
    }

    // Allow explicit override via query params if provided
    if (req.query.color) {
        primaryColor = req.query.color;
        primaryDark = req.query.dark || primaryColor;
    }

    // Compute 2-character monogram: First character of clinic name + 'C' (for Clinic)
    let monogram = req.query.m || '';
    if (!monogram) {
        const cleanWords = clinicName.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
        const ignore = ['the', 'a', 'an', 'and', 'of', '&'];
        const filtered = cleanWords.filter(w => !ignore.includes(w.toLowerCase()));
        let firstWord = filtered[0] || 'Clinic';
        if (filtered.length >= 2 && /^dr\.?$/i.test(firstWord)) {
            firstWord = filtered[1];
        }
        const firstChar = firstWord[0].toUpperCase();
        monogram = `${firstChar}C`;
    }

    // Generate responsive, vector SVG icon with high aesthetic fidelity
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="tenantGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="${primaryDark}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <!-- Rounded Squircle App Icon Base -->
  <rect width="512" height="512" rx="115" fill="url(#tenantGrad)"/>
  <rect x="6" y="6" width="500" height="500" rx="110" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="8"/>
  
  <!-- Subtle Clinical Crest Watermark -->
  <circle cx="256" cy="256" r="190" fill="rgba(255,255,255,0.08)"/>
  
  <!-- Centered Bold Monogram -->
  <text x="256" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Outfit', 'Segoe UI', Roboto, sans-serif" font-size="220" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="-3" filter="url(#shadow)">${monogram}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(svg);
};
