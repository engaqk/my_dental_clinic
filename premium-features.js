// ==========================================
// PREMIUM CLINICAL FEATURES & DENTAL ODONTOGRAM
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Smart Analytics Chart
    initRevenueChart();

    // 2. Initialize Interactive FDI Dental Charting (Odontogram)
    initDentalChart();

    // 3. Initialize Signature Pad
    initSignaturePad();
});

// --- Smart Analytics Chart ---
function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    if (typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [
                    {
                        label: 'Revenue ($)',
                        data: [12500, 15000, 14200, 18000, 22000, 21500, 26000],
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'New Patients',
                        data: [45, 52, 48, 65, 80, 75, 95],
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: "'Outfit', sans-serif", size: 14 }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }
}

// ==========================================================================
// FDI TWO-DIGIT ANATOMICAL ODONTOGRAM ENGINE (CORE CLINICAL USP)
// ==========================================================================

const FDI_DEFINITIONS = {
    adult: {
        // Upper Arch: Quadrant 1 (Patient Right) & Quadrant 2 (Patient Left)
        upper: [
            // Q1: 18 -> 11
            { id: 18, q: 1, qName: 'Upper Right (Q1)', name: 'Third Molar (Wisdom)', type: 'molar', arch: 'upper' },
            { id: 17, q: 1, qName: 'Upper Right (Q1)', name: 'Second Molar', type: 'molar', arch: 'upper' },
            { id: 16, q: 1, qName: 'Upper Right (Q1)', name: 'First Molar', type: 'molar', arch: 'upper' },
            { id: 15, q: 1, qName: 'Upper Right (Q1)', name: 'Second Premolar', type: 'premolar', arch: 'upper' },
            { id: 14, q: 1, qName: 'Upper Right (Q1)', name: 'First Premolar', type: 'premolar', arch: 'upper' },
            { id: 13, q: 1, qName: 'Upper Right (Q1)', name: 'Canine (Cuspid)', type: 'canine', arch: 'upper' },
            { id: 12, q: 1, qName: 'Upper Right (Q1)', name: 'Lateral Incisor', type: 'incisor', arch: 'upper' },
            { id: 11, q: 1, qName: 'Upper Right (Q1)', name: 'Central Incisor', type: 'incisor', arch: 'upper' },
            // Q2: 21 -> 28
            { id: 21, q: 2, qName: 'Upper Left (Q2)', name: 'Central Incisor', type: 'incisor', arch: 'upper' },
            { id: 22, q: 2, qName: 'Upper Left (Q2)', name: 'Lateral Incisor', type: 'incisor', arch: 'upper' },
            { id: 23, q: 2, qName: 'Upper Left (Q2)', name: 'Canine (Cuspid)', type: 'canine', arch: 'upper' },
            { id: 24, q: 2, qName: 'Upper Left (Q2)', name: 'First Premolar', type: 'premolar', arch: 'upper' },
            { id: 25, q: 2, qName: 'Upper Left (Q2)', name: 'Second Premolar', type: 'premolar', arch: 'upper' },
            { id: 26, q: 2, qName: 'Upper Left (Q2)', name: 'First Molar', type: 'molar', arch: 'upper' },
            { id: 27, q: 2, qName: 'Upper Left (Q2)', name: 'Second Molar', type: 'molar', arch: 'upper' },
            { id: 28, q: 2, qName: 'Upper Left (Q2)', name: 'Third Molar (Wisdom)', type: 'molar', arch: 'upper' }
        ],
        // Lower Arch: Quadrant 4 (Patient Right) & Quadrant 3 (Patient Left)
        lower: [
            // Q4: 48 -> 41
            { id: 48, q: 4, qName: 'Lower Right (Q4)', name: 'Third Molar (Wisdom)', type: 'molar', arch: 'lower' },
            { id: 47, q: 4, qName: 'Lower Right (Q4)', name: 'Second Molar', type: 'molar', arch: 'lower' },
            { id: 46, q: 4, qName: 'Lower Right (Q4)', name: 'First Molar', type: 'molar', arch: 'lower' },
            { id: 45, q: 4, qName: 'Lower Right (Q4)', name: 'Second Premolar', type: 'premolar', arch: 'lower' },
            { id: 44, q: 4, qName: 'Lower Right (Q4)', name: 'First Premolar', type: 'premolar', arch: 'lower' },
            { id: 43, q: 4, qName: 'Lower Right (Q4)', name: 'Canine (Cuspid)', type: 'canine', arch: 'lower' },
            { id: 42, q: 4, qName: 'Lower Right (Q4)', name: 'Lateral Incisor', type: 'incisor', arch: 'lower' },
            { id: 41, q: 4, qName: 'Lower Right (Q4)', name: 'Central Incisor', type: 'incisor', arch: 'lower' },
            // Q3: 31 -> 38
            { id: 31, q: 3, qName: 'Lower Left (Q3)', name: 'Central Incisor', type: 'incisor', arch: 'lower' },
            { id: 32, q: 3, qName: 'Lower Left (Q3)', name: 'Lateral Incisor', type: 'incisor', arch: 'lower' },
            { id: 33, q: 3, qName: 'Lower Left (Q3)', name: 'Canine (Cuspid)', type: 'canine', arch: 'lower' },
            { id: 34, q: 3, qName: 'Lower Left (Q3)', name: 'First Premolar', type: 'premolar', arch: 'lower' },
            { id: 35, q: 3, qName: 'Lower Left (Q3)', name: 'Second Premolar', type: 'premolar', arch: 'lower' },
            { id: 36, q: 3, qName: 'Lower Left (Q3)', name: 'First Molar', type: 'molar', arch: 'lower' },
            { id: 37, q: 3, qName: 'Lower Left (Q3)', name: 'Second Molar', type: 'molar', arch: 'lower' },
            { id: 38, q: 3, qName: 'Lower Left (Q3)', name: 'Third Molar (Wisdom)', type: 'molar', arch: 'lower' }
        ]
    },
    pediatric: {
        // Upper Arch: Q5 (55-51) & Q6 (61-65)
        upper: [
            { id: 55, q: 5, qName: 'Primary Upper Right (Q5)', name: 'Second Primary Molar', type: 'molar', arch: 'upper' },
            { id: 54, q: 5, qName: 'Primary Upper Right (Q5)', name: 'First Primary Molar', type: 'molar', arch: 'upper' },
            { id: 53, q: 5, qName: 'Primary Upper Right (Q5)', name: 'Primary Canine', type: 'canine', arch: 'upper' },
            { id: 52, q: 5, qName: 'Primary Upper Right (Q5)', name: 'Primary Lateral Incisor', type: 'incisor', arch: 'upper' },
            { id: 51, q: 5, qName: 'Primary Upper Right (Q5)', name: 'Primary Central Incisor', type: 'incisor', arch: 'upper' },
            { id: 61, q: 6, qName: 'Primary Upper Left (Q6)', name: 'Primary Central Incisor', type: 'incisor', arch: 'upper' },
            { id: 62, q: 6, qName: 'Primary Upper Left (Q6)', name: 'Primary Lateral Incisor', type: 'incisor', arch: 'upper' },
            { id: 63, q: 6, qName: 'Primary Upper Left (Q6)', name: 'Primary Canine', type: 'canine', arch: 'upper' },
            { id: 64, q: 6, qName: 'Primary Upper Left (Q6)', name: 'First Primary Molar', type: 'molar', arch: 'upper' },
            { id: 65, q: 6, qName: 'Primary Upper Left (Q6)', name: 'Second Primary Molar', type: 'molar', arch: 'upper' }
        ],
        // Lower Arch: Q8 (85-81) & Q7 (71-75)
        lower: [
            { id: 85, q: 8, qName: 'Primary Lower Right (Q8)', name: 'Second Primary Molar', type: 'molar', arch: 'lower' },
            { id: 84, q: 8, qName: 'Primary Lower Right (Q8)', name: 'First Primary Molar', type: 'molar', arch: 'lower' },
            { id: 83, q: 8, qName: 'Primary Lower Right (Q8)', name: 'Primary Canine', type: 'canine', arch: 'lower' },
            { id: 82, q: 8, qName: 'Primary Lower Right (Q8)', name: 'Primary Lateral Incisor', type: 'incisor', arch: 'lower' },
            { id: 81, q: 8, qName: 'Primary Lower Right (Q8)', name: 'Primary Central Incisor', type: 'incisor', arch: 'lower' },
            { id: 71, q: 7, qName: 'Primary Lower Left (Q7)', name: 'Primary Central Incisor', type: 'incisor', arch: 'lower' },
            { id: 72, q: 7, qName: 'Primary Lower Left (Q7)', name: 'Primary Lateral Incisor', type: 'incisor', arch: 'lower' },
            { id: 73, q: 7, qName: 'Primary Lower Left (Q7)', name: 'Primary Canine', type: 'canine', arch: 'lower' },
            { id: 74, q: 7, qName: 'Primary Lower Left (Q7)', name: 'First Primary Molar', type: 'molar', arch: 'lower' },
            { id: 75, q: 7, qName: 'Primary Lower Left (Q7)', name: 'Second Primary Molar', type: 'molar', arch: 'lower' }
        ]
    }
};

// Global Odontogram States
window.activeOdontogramTool = 'inspect'; // 'inspect' | 'cavity' | 'filling' | 'crown' | 'rct' | 'missing' | 'implant' | 'healthy'
window.currentDentitionMode = 'adult';   // 'adult' | 'pediatric'
window.currentOdontogramData = {
    dentition: 'adult',
    teeth: {},  // toothId: { condition: 'cavity', notes: '...' }
    notes: ''
};
window.activeOdontogramToothId = null;

// Generate Anatomical Tooth SVG based on arch and tooth type
function generateToothSVG(tooth) {
    const isUpper = tooth.arch === 'upper';
    const type = tooth.type;

    if (isUpper) {
        // Upper Arch: Roots at TOP (y: 2-22), Crown at BOTTOM (y: 22-45)
        if (type === 'molar') {
            return `
                <svg class="tooth-svg" width="34" height="48" viewBox="0 0 34 48">
                    <path class="tooth-root" d="M7,22 C6,10 8,4 10,2 C12,8 14,15 17,18 C20,15 22,8 24,2 C26,4 28,10 27,22" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-crown" d="M5,22 C3,31 6,42 11,44 C14,45 20,45 23,44 C28,42 31,31 29,22 C28,20 6,20 5,22 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-fissure" d="M10,32 Q17,36 24,32 M17,25 L17,40" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round"/>
                    <path class="tooth-cross" d="M4,4 L30,44 M30,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        } else if (type === 'premolar') {
            return `
                <svg class="tooth-svg" width="32" height="48" viewBox="0 0 32 48">
                    <path class="tooth-root" d="M10,22 C9,11 12,3 16,2 C20,3 23,11 22,22" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-crown" d="M6,22 C4,31 7,42 12,44 C15,45 17,45 20,44 C25,42 28,31 26,22 C25,20 7,20 6,22 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-fissure" d="M11,32 Q16,35 21,32" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round"/>
                    <path class="tooth-cross" d="M4,4 L28,44 M28,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        } else if (type === 'canine') {
            return `
                <svg class="tooth-svg" width="32" height="48" viewBox="0 0 32 48">
                    <path class="tooth-root" d="M11,22 C10,9 13,2 16,2 C19,2 22,9 21,22" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-crown" d="M7,22 C6,29 10,38 16,45 C22,38 26,29 25,22 C24,20 8,20 7,22 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-cross" d="M4,4 L28,44 M28,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        } else {
            // incisor
            return `
                <svg class="tooth-svg" width="32" height="48" viewBox="0 0 32 48">
                    <path class="tooth-root" d="M11,22 C11,9 13,2 16,2 C19,2 21,9 21,22" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-crown" d="M6,22 C5,31 6,42 8,43 L24,43 C26,42 27,31 26,22 C25,20 7,20 6,22 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-cross" d="M4,4 L28,44 M28,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        }
    } else {
        // Lower Arch: Crown at TOP (y: 6-28), Roots at BOTTOM (y: 28-48)
        if (type === 'molar') {
            return `
                <svg class="tooth-svg" width="34" height="48" viewBox="0 0 34 48">
                    <path class="tooth-crown" d="M5,26 C3,17 6,6 11,4 C14,3 20,3 23,4 C28,6 31,17 29,26 C28,28 6,28 5,26 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-fissure" d="M10,16 Q17,12 24,16 M17,8 L17,23" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round"/>
                    <path class="tooth-root" d="M7,26 C6,36 8,44 10,46 C12,40 14,32 17,29 C20,32 22,40 24,46 C26,44 28,36 27,26" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-cross" d="M4,4 L30,44 M30,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        } else if (type === 'premolar') {
            return `
                <svg class="tooth-svg" width="32" height="48" viewBox="0 0 32 48">
                    <path class="tooth-crown" d="M6,26 C4,17 7,6 12,4 C15,3 17,3 20,4 C25,6 28,17 26,26 C25,28 7,28 6,26 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-fissure" d="M11,16 Q16,13 21,16" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round"/>
                    <path class="tooth-root" d="M10,26 C9,37 12,45 16,46 C20,45 23,37 22,26" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-cross" d="M4,4 L28,44 M28,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        } else if (type === 'canine') {
            return `
                <svg class="tooth-svg" width="32" height="48" viewBox="0 0 32 48">
                    <path class="tooth-crown" d="M7,26 C6,19 10,10 16,3 C22,10 26,19 25,26 C24,28 8,28 7,26 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-root" d="M11,26 C10,39 13,46 16,46 C19,46 22,39 21,26" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-cross" d="M4,4 L28,44 M28,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        } else {
            // incisor
            return `
                <svg class="tooth-svg" width="32" height="48" viewBox="0 0 32 48">
                    <path class="tooth-crown" d="M7,26 C6,17 7,6 9,5 L23,5 C25,6 26,17 25,26 C24,28 8,28 7,26 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
                    <path class="tooth-root" d="M11,26 C11,39 13,46 16,46 C19,46 21,39 21,26" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tooth-cross" d="M4,4 L28,44 M28,4 L4,44" stroke="#64748B" stroke-width="3" stroke-linecap="round" style="display:none;"/>
                </svg>
            `;
        }
    }
}

// Initialize / Render the Full FDI Dental Chart
function initDentalChart() {
    const container = document.getElementById('interactiveTeethChart');
    if (!container) return;

    const mode = window.currentDentitionMode || 'adult';
    const defs = FDI_DEFINITIONS[mode] || FDI_DEFINITIONS.adult;

    // Helper to generate quadrant HTML
    const renderQuadrant = (teethList, quadClass, quadId) => {
        let quadHtml = `<div class="fdi-quadrant ${quadClass}" id="${quadId}">`;
        teethList.forEach(tooth => {
            const currentCond = getToothCondition(tooth.id);
            const stateClass = `state-${currentCond}`;
            const stateBadge = getConditionBadgeHtml(currentCond);

            quadHtml += `
                <div class="tooth-card ${stateClass}" id="toothCard_${tooth.id}" data-tooth-id="${tooth.id}" data-state="${currentCond}" onclick="handleToothTap(${tooth.id})" title="${tooth.id}: ${tooth.name} (${tooth.qName})">
                    <div class="tooth-svg-wrap">
                        ${generateToothSVG(tooth)}
                    </div>
                    <div class="tooth-number">${tooth.id}</div>
                    <div class="tooth-state-badge-wrap">${stateBadge}</div>
                </div>
            `;
        });
        quadHtml += `</div>`;
        return quadHtml;
    };

    // Split upper into Q1 & Q2
    const upperTeeth = defs.upper;
    const midUpper = Math.floor(upperTeeth.length / 2);
    const q1Teeth = upperTeeth.slice(0, midUpper); // Q1 or Q5
    const q2Teeth = upperTeeth.slice(midUpper);    // Q2 or Q6

    // Split lower into Q4 & Q3
    const lowerTeeth = defs.lower;
    const midLower = Math.floor(lowerTeeth.length / 2);
    const q4Teeth = lowerTeeth.slice(0, midLower); // Q4 or Q8
    const q3Teeth = lowerTeeth.slice(midLower);    // Q3 or Q7

    let html = `
        <div class="fdi-chart-layout">
            <!-- Maxillary / Upper Arch -->
            <div class="fdi-arch-section fdi-arch-maxillary">
                <div class="fdi-arch-label-row">
                    <span class="fdi-side-label"><i class="fas fa-arrow-left"></i> PATIENT RIGHT (${mode === 'adult' ? 'Q1' : 'Q5'})</span>
                    <span class="fdi-arch-name">MAXILLARY ARCH (UPPER JAW)</span>
                    <span class="fdi-side-label">PATIENT LEFT (${mode === 'adult' ? 'Q2' : 'Q6'}) <i class="fas fa-arrow-right"></i></span>
                </div>
                <div class="fdi-arch-row fdi-upper-arch-row">
                    ${renderQuadrant(q1Teeth, 'quad-q1', 'fdiQuadrant_Q1')}
                    <div class="fdi-midline-marker" title="Maxillary Midline">
                        <span class="midline-text">MIDLINE</span>
                    </div>
                    ${renderQuadrant(q2Teeth, 'quad-q2', 'fdiQuadrant_Q2')}
                </div>
            </div>

            <!-- Occlusal Plane (Bite Separation) -->
            <div class="fdi-occlusal-plane">
                <span class="occlusal-line"></span>
                <span class="occlusal-badge"><i class="fas fa-arrows-alt-v"></i> OCCLUSAL PLANE (BITING SURFACE)</span>
                <span class="occlusal-line"></span>
            </div>

            <!-- Mandibular / Lower Arch -->
            <div class="fdi-arch-section fdi-arch-mandibular">
                <div class="fdi-arch-row fdi-lower-arch-row">
                    ${renderQuadrant(q4Teeth, 'quad-q4', 'fdiQuadrant_Q4')}
                    <div class="fdi-midline-marker" title="Mandibular Midline">
                        <span class="midline-text">MIDLINE</span>
                    </div>
                    ${renderQuadrant(q3Teeth, 'quad-q3', 'fdiQuadrant_Q3')}
                </div>
                <div class="fdi-arch-label-row">
                    <span class="fdi-side-label"><i class="fas fa-arrow-left"></i> PATIENT RIGHT (${mode === 'adult' ? 'Q4' : 'Q8'})</span>
                    <span class="fdi-arch-name">MANDIBULAR ARCH (LOWER JAW)</span>
                    <span class="fdi-side-label">PATIENT LEFT (${mode === 'adult' ? 'Q3' : 'Q7'}) <i class="fas fa-arrow-right"></i></span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Apply color treatments to SVGs for non-healthy teeth
    applyAllToothVisuals();

    // Update summary metrics counter
    updateChartMetrics();
}

// Get condition helper
function getToothCondition(toothId) {
    if (!window.currentOdontogramData || !window.currentOdontogramData.teeth) return 'healthy';
    const entry = window.currentOdontogramData.teeth[toothId];
    if (!entry) return 'healthy';
    if (typeof entry === 'string') return entry;
    return entry.condition || 'healthy';
}

// Badge HTML helper
function getConditionBadgeHtml(cond) {
    switch (cond) {
        case 'cavity': return `<span class="t-badge t-badge-cavity">Caries</span>`;
        case 'filling': return `<span class="t-badge t-badge-filling">Filling</span>`;
        case 'crown': return `<span class="t-badge t-badge-crown">Crown</span>`;
        case 'rct': return `<span class="t-badge t-badge-rct">RCT</span>`;
        case 'missing': return `<span class="t-badge t-badge-missing">Miss</span>`;
        case 'implant': return `<span class="t-badge t-badge-implant">Implant</span>`;
        default: return `<span class="t-badge t-badge-sound">&bull;</span>`;
    }
}

// Apply SVG visual fills to a specific tooth element
function applyToothVisuals(toothId, condition) {
    const card = document.getElementById(`toothCard_${toothId}`);
    if (!card) return;

    // Remove old state classes
    card.classList.remove('state-healthy', 'state-cavity', 'state-filling', 'state-crown', 'state-rct', 'state-missing', 'state-implant');
    card.classList.add(`state-${condition}`);
    card.setAttribute('data-state', condition);

    const crown = card.querySelector('.tooth-crown');
    const root = card.querySelector('.tooth-root');
    const cross = card.querySelector('.tooth-cross');
    const badgeWrap = card.querySelector('.tooth-state-badge-wrap');

    if (badgeWrap) badgeWrap.innerHTML = getConditionBadgeHtml(condition);

    if (!crown || !root) return;

    // Reset default
    crown.setAttribute('fill', '#FFFFFF');
    crown.setAttribute('stroke', '#94A3B8');
    crown.style.opacity = '1';
    root.setAttribute('fill', '#E2E8F0');
    root.setAttribute('stroke', '#94A3B8');
    root.style.opacity = '1';
    if (cross) cross.style.display = 'none';

    switch (condition) {
        case 'cavity':
            crown.setAttribute('fill', '#EF4444');
            crown.setAttribute('stroke', '#B91C1C');
            break;
        case 'filling':
            crown.setAttribute('fill', '#2563EB');
            crown.setAttribute('stroke', '#1D4ED8');
            break;
        case 'crown':
            crown.setAttribute('fill', '#F59E0B');
            crown.setAttribute('stroke', '#D97706');
            break;
        case 'rct':
            crown.setAttribute('fill', '#8B5CF6');
            crown.setAttribute('stroke', '#6D28D9');
            root.setAttribute('fill', '#A855F7');
            root.setAttribute('stroke', '#7C3AED');
            break;
        case 'missing':
            crown.setAttribute('fill', '#CBD5E1');
            crown.style.opacity = '0.35';
            root.style.opacity = '0.35';
            if (cross) cross.style.display = 'block';
            break;
        case 'implant':
            crown.setAttribute('fill', '#0D9488');
            crown.setAttribute('stroke', '#0F766E');
            root.setAttribute('fill', '#14B8A6');
            root.setAttribute('stroke', '#0F766E');
            break;
        case 'healthy':
        default:
            // clean sound tooth
            break;
    }
}

function applyAllToothVisuals() {
    if (!window.currentOdontogramData || !window.currentOdontogramData.teeth) return;
    Object.entries(window.currentOdontogramData.teeth).forEach(([id, val]) => {
        const cond = typeof val === 'string' ? val : (val.condition || 'healthy');
        applyToothVisuals(id, cond);
    });
}

// Dentition Switcher
window.setOdontogramDentition = function(mode) {
    window.currentDentitionMode = mode;
    if (window.currentOdontogramData) {
        window.currentOdontogramData.dentition = mode;
    }

    const btnAdult = document.getElementById('btnDentitionAdult');
    const btnPediatric = document.getElementById('btnDentitionPediatric');
    if (btnAdult && btnPediatric) {
        btnAdult.classList.toggle('active', mode === 'adult');
        btnPediatric.classList.toggle('active', mode === 'pediatric');
    }

    initDentalChart();
    autoSaveOdontogram();
};

// Tool Palette Selection
window.setOdontogramTool = function(tool) {
    window.activeOdontogramTool = tool;

    // Update active button
    document.querySelectorAll('.fdi-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });

    // Update Tip Text
    const tipEl = document.getElementById('fdiPaletteTip');
    if (tipEl) {
        const toolNames = {
            'inspect': 'Inspect &amp; Plan (Tap tooth for clinical procedures &amp; costs)',
            'cavity': 'Paint Caries / Cavity (Red)',
            'filling': 'Paint Existing Filling (Blue)',
            'crown': 'Paint Crown / Bridge (Amber)',
            'rct': 'Paint Root Canal / RCT (Purple)',
            'missing': 'Paint Missing / Extracted (Crossed)',
            'implant': 'Paint Dental Implant (Teal)',
            'healthy': 'Mark Sound / Healthy (White)'
        };
        tipEl.innerHTML = `Active Tool: <strong>${toolNames[tool] || tool}</strong> &bull; Tap any tooth`;
    }
};

// Handle Tooth Tap
window.handleToothTap = function(toothId) {
    const tool = window.activeOdontogramTool || 'inspect';

    // Tactile animation feedback
    const card = document.getElementById(`toothCard_${toothId}`);
    if (card) {
        card.style.transform = 'scale(1.15)';
        setTimeout(() => card.style.transform = '', 150);
    }

    if (tool === 'inspect') {
        window.openToothProcedureModal(toothId);
    } else {
        // Direct paint tool
        applyConditionToTooth(toothId, tool);
        showToothFeedbackToast(`Tooth #${toothId} marked as ${tool.toUpperCase()}`);
    }
};

// Legacy compatibility
window.toggleToothStatus = function(element, toothId) {
    window.handleToothTap(toothId);
};

// Apply Condition directly to a tooth and auto-save
function applyConditionToTooth(toothId, condition, notes = '') {
    if (!window.currentOdontogramData) window.currentOdontogramData = { teeth: {} };
    if (!window.currentOdontogramData.teeth) window.currentOdontogramData.teeth = {};

    if (condition === 'healthy') {
        delete window.currentOdontogramData.teeth[toothId];
    } else {
        const existing = window.currentOdontogramData.teeth[toothId];
        const existingNotes = (typeof existing === 'object' && existing.notes) ? existing.notes : '';
        window.currentOdontogramData.teeth[toothId] = {
            condition: condition,
            notes: notes || existingNotes,
            updatedAt: new Date().toISOString()
        };
    }

    applyToothVisuals(toothId, condition);
    updateChartMetrics();
    autoSaveOdontogram();
}

// Update the Top Metric Counts Bar
function updateChartMetrics() {
    const teeth = (window.currentOdontogramData && window.currentOdontogramData.teeth) ? window.currentOdontogramData.teeth : {};
    const totalTeeth = window.currentDentitionMode === 'pediatric' ? 20 : 32;

    let cavityCount = 0;
    let fillingCount = 0;
    let crownCount = 0;
    let rctCount = 0;
    let missingCount = 0;
    let implantCount = 0;

    Object.values(teeth).forEach(entry => {
        const cond = typeof entry === 'string' ? entry : (entry.condition || 'healthy');
        if (cond === 'cavity') cavityCount++;
        else if (cond === 'filling') fillingCount++;
        else if (cond === 'crown') crownCount++;
        else if (cond === 'rct') rctCount++;
        else if (cond === 'missing') missingCount++;
        else if (cond === 'implant') implantCount++;
    });

    const affectedCount = cavityCount + fillingCount + crownCount + rctCount + missingCount + implantCount;
    const soundCount = Math.max(0, totalTeeth - affectedCount);

    const soundEl = document.getElementById('metricSoundCount');
    const cavityEl = document.getElementById('metricCavityCount');
    const fillingEl = document.getElementById('metricFillingCount');
    const crownEl = document.getElementById('metricCrownCount');
    const rctEl = document.getElementById('metricRctCount');
    const missingEl = document.getElementById('metricMissingCount');
    const implantEl = document.getElementById('metricImplantCount');

    if (soundEl) soundEl.innerText = soundCount;
    if (cavityEl) cavityEl.innerText = cavityCount;
    if (fillingEl) fillingEl.innerText = fillingCount;
    if (crownEl) crownEl.innerText = crownCount;
    if (rctEl) rctEl.innerText = rctCount;
    if (missingEl) missingEl.innerText = missingCount;
    if (implantEl) implantEl.innerText = implantCount;
}

// Toast status display
function showToothFeedbackToast(msg) {
    const statusText = document.getElementById('toothStatusText');
    if (statusText) {
        statusText.innerHTML = `<i class="fas fa-check-circle" style="color: var(--primary);"></i> ${msg}`;
        statusText.style.color = 'var(--secondary)';
    }
}

// Multi-Tenant Auto-Save
let odontogramSaveTimeout = null;
function autoSaveOdontogram() {
    if (odontogramSaveTimeout) clearTimeout(odontogramSaveTimeout);
    odontogramSaveTimeout = setTimeout(async () => {
        if (!window.dbAPI || !window.currentPatient || !window.currentPatient.mobile) return;
        try {
            await window.dbAPI.savePatientChart(window.currentPatient.mobile, window.currentOdontogramData);
            console.log(`Auto-saved odontogram for patient [${window.currentPatient.mobile}] in tenant [${window.dbAPI.tenantId}]`);
        } catch(err) {
            console.warn("Failed to auto-save odontogram:", err);
        }
    }, 400);
}

// Clear Chart with Confirmation
window.clearOdontogramChart = function() {
    if (!confirm("Are you sure you want to reset all teeth in this chart to Sound/Healthy?")) return;
    if (!window.currentOdontogramData) window.currentOdontogramData = {};
    window.currentOdontogramData.teeth = {};

    initDentalChart();
    autoSaveOdontogram();
    showToothFeedbackToast("All teeth reset to Sound/Healthy.");
};

// Jump to Quadrant on Mobile
window.jumpToQuadrant = function(quadId) {
    // Update active nav button
    document.querySelectorAll('.btn-quicknav').forEach(b => b.classList.remove('active'));
    const clickedBtn = event ? event.target : null;
    if (clickedBtn && clickedBtn.classList.contains('btn-quicknav')) clickedBtn.classList.add('active');

    const scrollContainer = document.getElementById('fdiChartScrollContainer');
    if (!scrollContainer) return;

    if (quadId === 'all') {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
        return;
    }

    const targetEl = document.getElementById(`fdiQuadrant_${quadId.toUpperCase()}`);
    if (targetEl) {
        const offsetLeft = targetEl.offsetLeft - 20;
        scrollContainer.scrollTo({ left: offsetLeft, behavior: 'smooth' });
    }
};

// ==========================================================================
// TOOTH PROCEDURE MODAL & TREATMENT PLAN AUTO-LINKING
// ==========================================================================

function findToothMetadata(toothId) {
    const mode = window.currentDentitionMode || 'adult';
    const defs = FDI_DEFINITIONS[mode] || FDI_DEFINITIONS.adult;
    const allTeeth = [...defs.upper, ...defs.lower];
    return allTeeth.find(t => t.id === Number(toothId)) || {
        id: toothId,
        q: 1,
        qName: 'Dental Arch',
        name: `Tooth #${toothId}`,
        type: 'molar',
        arch: 'upper'
    };
}

window.openToothProcedureModal = function(toothId) {
    window.activeOdontogramToothId = Number(toothId);
    const meta = findToothMetadata(toothId);
    const currentCond = getToothCondition(toothId);

    const modal = document.getElementById('toothProcedureModal');
    if (!modal) return;

    // Header info
    const badgeEl = document.getElementById('toothModalBadge');
    const titleEl = document.getElementById('toothModalTitle');
    if (badgeEl) badgeEl.innerText = `${meta.qName.toUpperCase()} &bull; FDI #${toothId}`;
    if (titleEl) titleEl.innerHTML = `🦷 Tooth #${toothId} &bull; ${meta.name}`;

    // Highlight condition button
    document.querySelectorAll('#toothModalConditionGrid .btn-cond-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-cond') === currentCond);
    });

    // Populate Dynamic Procedure Shortcuts based on condition and tooth type
    renderToothModalProcedures(toothId, meta, currentCond);

    // Populate notes
    const notesInput = document.getElementById('toothClinicalNotes');
    if (notesInput) {
        const entry = window.currentOdontogramData?.teeth?.[toothId];
        notesInput.value = (typeof entry === 'object' && entry?.notes) ? entry.notes : '';
    }

    // Hide previous feedback
    const feedbackEl = document.getElementById('toothModalFeedback');
    if (feedbackEl) feedbackEl.style.display = 'none';

    modal.style.display = 'flex';
};

window.closeToothProcedureModal = function() {
    // Save any typed notes before closing
    const toothId = window.activeOdontogramToothId;
    const notesInput = document.getElementById('toothClinicalNotes');
    if (toothId && notesInput && window.currentOdontogramData?.teeth?.[toothId]) {
        const notes = notesInput.value.trim();
        if (typeof window.currentOdontogramData.teeth[toothId] === 'object') {
            window.currentOdontogramData.teeth[toothId].notes = notes;
            autoSaveOdontogram();
        }
    }

    const modal = document.getElementById('toothProcedureModal');
    if (modal) modal.style.display = 'none';
};

// Set Condition from within modal
window.setToothConditionFromModal = function(condition) {
    const toothId = window.activeOdontogramToothId;
    if (!toothId) return;

    // Highlight active condition button
    document.querySelectorAll('#toothModalConditionGrid .btn-cond-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-cond') === condition);
    });

    const notesInput = document.getElementById('toothClinicalNotes');
    const notes = notesInput ? notesInput.value.trim() : '';

    applyConditionToTooth(toothId, condition, notes);

    // Refresh suggested procedures
    const meta = findToothMetadata(toothId);
    renderToothModalProcedures(toothId, meta, condition);

    const feedbackEl = document.getElementById('toothModalFeedback');
    if (feedbackEl) {
        feedbackEl.innerHTML = `<i class="fas fa-check-circle" style="color: #16A34A;"></i> Condition updated to <strong>${condition.toUpperCase()}</strong>!`;
        feedbackEl.style.display = 'block';
    }
};

// Render Dynamic 1-Tap Procedure Shortcuts inside Modal
function renderToothModalProcedures(toothId, meta, condition) {
    const container = document.getElementById('toothModalProcShortcuts');
    if (!container) return;

    let shortcuts = [];

    if (condition === 'cavity') {
        shortcuts = [
            { name: `Posterior Composite Filling`, cost: 1800, sittings: 1, tag: 'Standard' },
            { name: `Deep Caries Excavation + GIC Base`, cost: 1200, sittings: 1, tag: 'Sedative' },
            { name: `Anterior Aesthetic Resin Restoration`, cost: 2200, sittings: 1, tag: 'Cosmetic' },
            { name: `Rotary Root Canal Treatment (RCT)`, cost: 4000, sittings: 2, tag: 'Pulp Exposure' }
        ];
    } else if (condition === 'rct') {
        shortcuts = [
            { name: `Rotary Root Canal Treatment (RCT)`, cost: 4000, sittings: 2, tag: 'Endodontics' },
            { name: `Fiber Post & Core Buildup`, cost: 2500, sittings: 1, tag: 'Reinforce' },
            { name: `Premium Full Zirconia Crown`, cost: 8500, sittings: 2, tag: 'Crown Cap' },
            { name: `Metal Ceramic Crown (PFM)`, cost: 4500, sittings: 2, tag: 'Budget Cap' }
        ];
    } else if (condition === 'crown') {
        shortcuts = [
            { name: `Premium Full Zirconia Crown`, cost: 8500, sittings: 2, tag: 'Monolithic' },
            { name: `Metal Ceramic Crown (PFM)`, cost: 4500, sittings: 2, tag: 'Ceramic' },
            { name: `E-Max All-Ceramic Aesthetic Crown`, cost: 11000, sittings: 2, tag: 'Aesthetic' },
            { name: `Crown Re-cementation`, cost: 800, sittings: 1, tag: 'Existing' }
        ];
    } else if (condition === 'missing') {
        shortcuts = [
            { name: `Titanium Dental Implant & Crown`, cost: 30000, sittings: 3, tag: 'Permanent' },
            { name: `3-Unit Ceramic Bridge Abutment`, cost: 13500, sittings: 2, tag: 'Bridge' },
            { name: `Removable Partial Acrylic Denture`, cost: 2500, sittings: 2, tag: 'Removable' },
            { name: `Ridge Preservation Bone Graft`, cost: 8000, sittings: 1, tag: 'Surgical' }
        ];
    } else if (condition === 'implant') {
        shortcuts = [
            { name: `Implant Abutment & Screw-Retained Crown`, cost: 12000, sittings: 2, tag: 'Prosthetic' },
            { name: `Implant Second Stage Exposure`, cost: 2000, sittings: 1, tag: 'Surgical' },
            { name: `Peri-Implant Maintenance & Clean`, cost: 1500, sittings: 1, tag: 'Maintenance' }
        ];
    } else if (condition === 'filling') {
        shortcuts = [
            { name: `Restoration Polish & Marginal Seal`, cost: 800, sittings: 1, tag: 'Refurbish' },
            { name: `Replacement Composite Filling`, cost: 1800, sittings: 1, tag: 'Re-fill' }
        ];
    } else {
        // Sound / General
        shortcuts = [
            { name: `Ultrasonic Scaling & Polishing`, cost: 1500, sittings: 1, tag: 'Prophylaxis' },
            { name: `Fluoride Varnish & Desensitization`, cost: 1000, sittings: 1, tag: 'Preventive' },
            { name: `Pit & Fissure Sealant`, cost: 1200, sittings: 1, tag: 'Preventive' },
            { name: `Surgical Extraction`, cost: 2500, sittings: 1, tag: 'Oral Surgery' }
        ];
    }

    let html = '';
    shortcuts.forEach(s => {
        html += `
            <button type="button" class="btn-proc-shortcut" onclick="addProcedureFromToothModal('${escapeHtml(s.name)}', ${s.cost}, ${s.sittings})">
                <div class="proc-shortcut-main">
                    <span class="proc-shortcut-name">+ ${escapeHtml(s.name)}</span>
                    <span class="proc-shortcut-tag">${escapeHtml(s.tag)}</span>
                </div>
                <div class="proc-shortcut-meta">
                    <span class="proc-shortcut-cost">&#8377;${s.cost.toLocaleString('en-IN')}</span>
                    <span class="proc-shortcut-sittings">${s.sittings} Visit${s.sittings > 1 ? 's' : ''}</span>
                </div>
            </button>
        `;
    });

    container.innerHTML = html;
}

// 1-Tap Add to Treatment Plan (Tab 2)
window.addProcedureFromToothModal = function(name, cost, sittings = 1) {
    const toothId = window.activeOdontogramToothId;
    if (!toothId) return;

    const toothLabel = `Tooth #${toothId}`;

    if (typeof window.addPlanTemplate === 'function') {
        window.addPlanTemplate(name, toothLabel, cost, sittings);
    } else if (window.currentPlanItems) {
        window.currentPlanItems.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: name,
            tooth: toothLabel,
            sittings: Number(sittings) || 1,
            cost: Number(cost) || 0
        });
        if (typeof renderPlanItemsTable === 'function') renderPlanItemsTable();
        if (typeof calculatePlanTotal === 'function') calculatePlanTotal();
    }

    const feedbackEl = document.getElementById('toothModalFeedback');
    if (feedbackEl) {
        feedbackEl.innerHTML = `<i class="fas fa-check-circle" style="color: #16A34A;"></i> Added "<strong>${escapeHtml(name)}</strong>" (&#8377;${cost.toLocaleString('en-IN')}) to Treatment Plan!`;
        feedbackEl.style.display = 'block';
    }
};

// Add Custom Procedure from within Tooth Modal
window.addCustomProcedureFromToothModal = function() {
    const nameInput = document.getElementById('customToothProcName');
    const costInput = document.getElementById('customToothProcCost');
    const sittingsInput = document.getElementById('customToothProcSittings');

    const name = nameInput ? nameInput.value.trim() : '';
    const cost = costInput ? Number(costInput.value) : 0;
    const sittings = sittingsInput ? Number(sittingsInput.value) || 1 : 1;

    if (!name) {
        alert("Please enter a procedure name.");
        return;
    }

    window.addProcedureFromToothModal(name, cost, sittings);

    if (nameInput) nameInput.value = '';
    if (costInput) costInput.value = '';
};

// Jump to Treatment Plan tab directly
window.goToTreatmentPlanFromToothModal = function() {
    window.closeToothProcedureModal();
    if (typeof switchProfileTab === 'function') {
        switchProfileTab('treatment-plans');
    }
};

// Batch Add All Charted non-healthy teeth to Treatment Plan
window.addAllChartedToTreatmentPlan = function() {
    if (!window.currentPatient || !window.currentPatient.mobile) {
        alert("Please select an active patient first.");
        return;
    }

    const teeth = (window.currentOdontogramData && window.currentOdontogramData.teeth) ? window.currentOdontogramData.teeth : {};
    const entries = Object.entries(teeth);

    if (entries.length === 0) {
        alert("No active conditions charted yet. Tap teeth with Caries, RCT, or Crown first!");
        return;
    }

    let addedCount = 0;
    entries.forEach(([id, val]) => {
        const cond = typeof val === 'string' ? val : (val.condition || 'healthy');
        if (cond === 'healthy') return;

        let procName = '';
        let cost = 0;
        let sittings = 1;

        if (cond === 'cavity') {
            procName = 'Posterior Composite Restoration';
            cost = 1800;
            sittings = 1;
        } else if (cond === 'rct') {
            procName = 'Rotary Root Canal Treatment (RCT)';
            cost = 4000;
            sittings = 2;
        } else if (cond === 'crown') {
            procName = 'Premium Full Zirconia Crown';
            cost = 8500;
            sittings = 2;
        } else if (cond === 'filling') {
            procName = 'Restoration Polish & Marginal Seal';
            cost = 800;
            sittings = 1;
        } else if (cond === 'missing') {
            procName = 'Titanium Dental Implant & Crown';
            cost = 30000;
            sittings = 3;
        } else if (cond === 'implant') {
            procName = 'Implant Crown Prosthesis';
            cost = 12000;
            sittings = 2;
        }

        if (procName) {
            const toothLabel = `Tooth #${id}`;
            if (typeof window.addPlanTemplate === 'function') {
                window.addPlanTemplate(procName, toothLabel, cost, sittings);
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        showToothFeedbackToast(`Added ${addedCount} procedure(s) to Treatment Plan!`);
        alert(`Successfully linked ${addedCount} charted procedure(s) into Treatment Plan (Tab 2)!`);
        if (typeof switchProfileTab === 'function') {
            switchProfileTab('treatment-plans');
        }
    } else {
        alert("All teeth in chart are already marked healthy.");
    }
};

// ==========================================================================
// RESET & LOAD PATIENT CHARTING FEATURES (TENANT ISOLATED)
// ==========================================================================

window.resetChartingFeatures = async function() {
    // 1. Reset E-Signature canvas
    if (window.clearSignature) {
        const canvas = document.getElementById('signaturePad');
        if (canvas && signaturePadContext) {
            signaturePadContext.clearRect(0, 0, canvas.width, canvas.height);
        }
        const successMsg = document.getElementById('signatureSuccessMessage');
        if (successMsg) successMsg.style.display = 'none';
    }

    const statusText = document.getElementById('toothStatusText');
    if (statusText) {
        statusText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading patient odontogram...';
        statusText.style.color = 'var(--secondary)';
    }

    // Default clean state
    window.currentDentitionMode = 'adult';
    window.currentOdontogramData = {
        dentition: 'adult',
        teeth: {},
        notes: ''
    };

    if (!window.dbAPI || !window.currentPatient || !window.currentPatient.mobile) {
        initDentalChart();
        if (statusText) statusText.innerText = '';
        return;
    }

    try {
        // Fetch Tenant-Isolated Patient Chart
        const chartData = await window.dbAPI.getPatientChart(window.currentPatient.mobile);

        if (chartData && typeof chartData === 'object') {
            if (chartData.teeth) {
                // New rich format
                window.currentOdontogramData = {
                    dentition: chartData.dentition || 'adult',
                    teeth: chartData.teeth || {},
                    notes: chartData.notes || ''
                };
                window.currentDentitionMode = chartData.dentition || 'adult';
            } else {
                // Legacy format: { "1": "cavity", ... }
                const convertedTeeth = {};
                Object.entries(chartData).forEach(([k, v]) => {
                    if (v && v !== 'healthy') {
                        convertedTeeth[k] = { condition: v };
                    }
                });
                window.currentOdontogramData = {
                    dentition: 'adult',
                    teeth: convertedTeeth,
                    notes: ''
                };
                window.currentDentitionMode = 'adult';
            }
        }

        // Update dentition button toggle state
        const btnAdult = document.getElementById('btnDentitionAdult');
        const btnPediatric = document.getElementById('btnDentitionPediatric');
        if (btnAdult && btnPediatric) {
            btnAdult.classList.toggle('active', window.currentDentitionMode === 'adult');
            btnPediatric.classList.toggle('active', window.currentDentitionMode === 'pediatric');
        }

        // Render FDI Arch
        initDentalChart();

        if (statusText) {
            statusText.innerHTML = '<i class="fas fa-check-circle" style="color: var(--primary);"></i> Patient chart loaded successfully.';
        }

        // Load Patient Consent Signature (Tenant-Isolated)
        const signatureBase64 = await window.dbAPI.getPatientSignature(window.currentPatient.mobile);
        if (signatureBase64 && signaturePadContext) {
            const img = new Image();
            img.onload = function() {
                signaturePadContext.drawImage(img, 0, 0);
            };
            img.src = signatureBase64;
        }
    } catch(err) {
        console.warn("Failed to load charting features:", err);
        initDentalChart();
        if (statusText) statusText.innerText = 'Offline chart mode active.';
    }
};

// ==========================================================================
// DIGITAL E-SIGNATURE PAD LOGIC
// ==========================================================================

let signaturePadContext = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function initSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;

    signaturePadContext = canvas.getContext('2d');
    signaturePadContext.strokeStyle = '#0F172A';
    signaturePadContext.lineWidth = 3;
    signaturePadContext.lineCap = 'round';
    signaturePadContext.lineJoin = 'round';

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function draw(e) {
    if (!isDrawing) return;
    signaturePadContext.beginPath();
    signaturePadContext.moveTo(lastX, lastY);
    signaturePadContext.lineTo(e.offsetX, e.offsetY);
    signaturePadContext.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    autoSaveSignature();
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    isDrawing = true;
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    signaturePadContext.beginPath();
    signaturePadContext.moveTo(lastX, lastY);
    signaturePadContext.lineTo(currentX, currentY);
    signaturePadContext.stroke();
    
    lastX = currentX;
    lastY = currentY;
}

window.clearSignature = function() {
    const canvas = document.getElementById('signaturePad');
    if (canvas && signaturePadContext) {
        signaturePadContext.clearRect(0, 0, canvas.width, canvas.height);
        const msg = document.getElementById('signatureSuccessMessage');
        if (msg) msg.style.display = 'none';

        if (window.dbAPI && window.currentPatient && window.currentPatient.mobile) {
            window.dbAPI.savePatientSignature(window.currentPatient.mobile, null);
        }
    }
};

window.saveSignature = function() {
    autoSaveSignature(true);
};

let signatureTimeout = null;
function autoSaveSignature(showUI = false) {
    if (signatureTimeout) clearTimeout(signatureTimeout);
    signatureTimeout = setTimeout(() => {
        const canvas = document.getElementById('signaturePad');
        if (canvas && window.dbAPI && window.currentPatient && window.currentPatient.mobile) {
            const base64 = canvas.toDataURL();
            window.dbAPI.savePatientSignature(window.currentPatient.mobile, base64);
            if (showUI) {
                const msg = document.getElementById('signatureSuccessMessage');
                if (msg) {
                    msg.style.display = 'block';
                    setTimeout(() => msg.style.display = 'none', 3000);
                }
            }
        }
    }, 500);
}
