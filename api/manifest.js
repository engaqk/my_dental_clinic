// api/manifest.js - Dynamic Web App Manifest Generator for Multi-Tenant Dental PWA
module.exports = (req, res) => {
    let tenantId = (req.query.c || req.query.tenant || req.query.slug || '').toString().toLowerCase().trim();

    // Check cookie fallback if query param not present
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
    const isDefault = tenantId === 'default';

    let clinicName = 'My Dental Clinic';
    let subtitle = 'Dental & Cosmetic Clinic';
    let primaryColor = '#10B981';

    if (tenantId.includes('swastik')) {
        clinicName = 'Swastik Dental Clinic';
        subtitle = 'Dr. Chintal Baman (BDS)';
        primaryColor = '#0D9488';
    } else if (tenantId.includes('sumya')) {
        clinicName = 'Sumya Dental Clinic';
        subtitle = 'Comprehensive Dental & Oral Healthcare';
        primaryColor = '#0D9488';
    } else if (tenantId.includes('smile')) {
        clinicName = 'Smile Dental Clinic';
        subtitle = 'Advanced Dental & Cosmetic Clinic';
        primaryColor = '#0D9488';
    } else if (!isDefault) {
        const words = tenantId.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        const formatted = words.join(' ');
        clinicName = formatted.toLowerCase().includes('clinic') || formatted.toLowerCase().includes('dental') ? formatted : `${formatted} Dental Clinic`;
        primaryColor = '#0D9488';
    }

    const shortName = clinicName.length > 18 ? clinicName.substring(0, 16) + '..' : clinicName;
    const startUrl = isDefault ? '/' : `/?c=${tenantId}`;

    const manifest = {
        name: clinicName,
        short_name: shortName,
        start_url: startUrl,
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: primaryColor,
        description: `${clinicName} - ${subtitle}`,
        categories: ["medical", "health", "business"],
        icons: [
            {
                src: `/api/tenant-icon?c=${tenantId}&size=192&format=png`,
                sizes: "192x192",
                type: "image/png",
                purpose: "any"
            },
            {
                src: `/api/tenant-icon?c=${tenantId}&size=512&format=png`,
                sizes: "512x512",
                type: "image/png",
                purpose: "any"
            },
            {
                src: `/api/tenant-icon?c=${tenantId}&size=512&format=png`,
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable"
            },
            {
                src: `/api/tenant-icon?c=${tenantId}&size=192`,
                sizes: "192x192",
                type: "image/svg+xml",
                purpose: "any maskable"
            },
            {
                src: `/api/tenant-icon?c=${tenantId}&size=512`,
                sizes: "512x512",
                type: "image/svg+xml",
                purpose: "any maskable"
            }
        ]
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(manifest);
};
