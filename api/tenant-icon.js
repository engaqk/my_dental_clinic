// api/tenant-icon.js - Dynamic Vector & PNG App Icon & Favicon Engine for Multi-Tenant Dental PWA
const zlib = require('zlib');

// Precomputed CRC32 table for pure-Node PNG chunk generation
const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    CRC_TABLE[n] = c;
}

function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const FONT_8X8 = {
    'A': [0x18, 0x3C, 0x66, 0x66, 0x7E, 0x66, 0x66, 0x00],
    'B': [0x7C, 0x66, 0x66, 0x7C, 0x66, 0x66, 0x7C, 0x00],
    'C': [0x3C, 0x66, 0x60, 0x60, 0x60, 0x66, 0x3C, 0x00],
    'D': [0x78, 0x6C, 0x66, 0x66, 0x66, 0x6C, 0x78, 0x00],
    'E': [0x7E, 0x60, 0x60, 0x7C, 0x60, 0x60, 0x7E, 0x00],
    'F': [0x7E, 0x60, 0x60, 0x7C, 0x60, 0x60, 0x60, 0x00],
    'G': [0x3C, 0x66, 0x60, 0x6E, 0x66, 0x66, 0x3A, 0x00],
    'H': [0x66, 0x66, 0x66, 0x7E, 0x66, 0x66, 0x66, 0x00],
    'I': [0x3C, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3C, 0x00],
    'J': [0x1E, 0x06, 0x06, 0x06, 0x06, 0x66, 0x3C, 0x00],
    'K': [0x66, 0x6C, 0x78, 0x70, 0x78, 0x6C, 0x66, 0x00],
    'L': [0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x7E, 0x00],
    'M': [0x63, 0x77, 0x7F, 0x6B, 0x63, 0x63, 0x63, 0x00],
    'N': [0x66, 0x76, 0x7E, 0x7E, 0x6E, 0x66, 0x66, 0x00],
    'O': [0x3C, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x00],
    'P': [0x7C, 0x66, 0x66, 0x7C, 0x60, 0x60, 0x60, 0x00],
    'Q': [0x3C, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x0E, 0x00],
    'R': [0x7C, 0x66, 0x66, 0x7C, 0x78, 0x6C, 0x66, 0x00],
    'S': [0x3C, 0x66, 0x60, 0x3C, 0x06, 0x66, 0x3C, 0x00],
    'T': [0x7E, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00],
    'U': [0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x00],
    'V': [0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x18, 0x00],
    'W': [0x63, 0x63, 0x63, 0x6B, 0x7F, 0x77, 0x63, 0x00],
    'X': [0x66, 0x66, 0x3C, 0x18, 0x3C, 0x66, 0x66, 0x00],
    'Y': [0x66, 0x66, 0x66, 0x3C, 0x18, 0x18, 0x18, 0x00],
    'Z': [0x7E, 0x06, 0x0C, 0x18, 0x30, 0x60, 0x7E, 0x00]
};

function hexToRgb(hex) {
    hex = (hex || '#0D9488').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function generateTenantPng(monogram, primaryHex, darkHex, size = 512) {
    const [r1, g1, b1] = hexToRgb(primaryHex || '#0D9488');
    const [r2, g2, b2] = hexToRgb(darkHex || '#115E59');
    
    const img = new Uint8Array(size * size * 4);
    const cornerRadius = Math.round(size * 0.22);
    const half = size / 2;

    for (let y = 0; y < size; y++) {
        const t = y / (size - 1);
        const curR = Math.round(r1 + (r2 - r1) * t);
        const curG = Math.round(g1 + (g2 - g1) * t);
        const curB = Math.round(b1 + (b2 - b1) * t);

        for (let x = 0; x < size; x++) {
            let inside = true;
            const cx = x < cornerRadius ? cornerRadius : (x >= size - cornerRadius ? size - cornerRadius - 1 : x);
            const cy = y < cornerRadius ? cornerRadius : (y >= size - cornerRadius ? size - cornerRadius - 1 : y);
            
            if (cx !== x || cy !== y) {
                const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
                if (distSq > cornerRadius * cornerRadius) {
                    inside = false;
                }
            }

            if (inside) {
                const idx = (y * size + x) * 4;
                img[idx] = curR;
                img[idx + 1] = curG;
                img[idx + 2] = curB;
                img[idx + 3] = 255;

                // Subtle center watermark crest
                const cDist = Math.sqrt((x - half) * (x - half) + (y - half) * (y - half));
                if (cDist < size * 0.38) {
                    img[idx] = Math.min(255, img[idx] + 16);
                    img[idx + 1] = Math.min(255, img[idx + 1] + 16);
                    img[idx + 2] = Math.min(255, img[idx + 2] + 16);
                }
            }
        }
    }

    // Render 2-character monogram
    const letters = (monogram || 'SC').toUpperCase().slice(0, 2);
    const letterScale = Math.max(2, Math.round(size / 18));
    const fontWidth = 8 * letterScale;
    const fontHeight = 8 * letterScale;
    const totalLettersWidth = letters.length * fontWidth + (letters.length - 1) * Math.round(letterScale * 2);
    const startX = Math.round((size - totalLettersWidth) / 2);
    const startY = Math.round((size - fontHeight) / 2);

    for (let li = 0; li < letters.length; li++) {
        const char = letters[li];
        const glyph = FONT_8X8[char] || FONT_8X8['C'];
        const charX = startX + li * (fontWidth + Math.round(letterScale * 2));

        for (let row = 0; row < 8; row++) {
            const rowBits = glyph[row];
            for (let col = 0; col < 8; col++) {
                if ((rowBits & (1 << (7 - col))) !== 0) {
                    for (let sy = 0; sy < letterScale; sy++) {
                        for (let sx = 0; sx < letterScale; sx++) {
                            const px = charX + col * letterScale + sx;
                            const py = startY + row * letterScale + sy;
                            if (px >= 0 && px < size && py >= 0 && py < size) {
                                const pIdx = (py * size + px) * 4;
                                img[pIdx] = 255;
                                img[pIdx + 1] = 255;
                                img[pIdx + 2] = 255;
                                img[pIdx + 3] = 255;
                            }
                        }
                    }
                }
            }
        }
    }

    const rawScanlines = Buffer.alloc(size * (1 + size * 4));
    let rawOffset = 0;
    for (let y = 0; y < size; y++) {
        rawScanlines[rawOffset++] = 0;
        const rowStart = y * size * 4;
        for (let x = 0; x < size * 4; x++) {
            rawScanlines[rawOffset++] = img[rowStart + x];
        }
    }

    const compressed = zlib.deflateSync(rawScanlines);
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
        sig,
        createChunk('IHDR', ihdr),
        createChunk('IDAT', compressed),
        createChunk('IEND', Buffer.alloc(0))
    ]);
}

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
    } else if (tenantId.includes('smile')) {
        clinicName = 'Smile Dental Clinic';
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

    // Determine output format (PNG for WhatsApp / SMS / OpenGraph / Crawlers, SVG for vector)
    const reqUrl = req.url || '';
    const wantsPng = req.query.format === 'png' || 
                     reqUrl.includes('.png') || 
                     reqUrl.includes('favicon.ico') ||
                     (req.headers['user-agent'] && (
                         req.headers['user-agent'].includes('WhatsApp') ||
                         req.headers['user-agent'].includes('facebookexternalhit') ||
                         req.headers['user-agent'].includes('Twitterbot') ||
                         req.headers['user-agent'].includes('Applebot') ||
                         req.headers['user-agent'].includes('TelegramBot')
                     ));

    if (wantsPng) {
        const pngBuf = generateTenantPng(monogram, primaryColor, primaryDark, size);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(pngBuf);
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
