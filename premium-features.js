// ==========================================
// PREMIUM FEATURES SHOWCASE LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Smart Analytics Chart
    initRevenueChart();

    // 2. Initialize Interactive Dental Charting
    initDentalChart();

    // 3. Initialize Signature Pad
    initSignaturePad();
});

// --- Smart Analytics Chart ---
function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    // Use Chart.js if loaded
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

// --- Interactive Dental Charting ---
function initDentalChart() {
    const container = document.getElementById('interactiveTeethChart');
    if (!container) return;

    // Generate 16 SVG teeth representing an arch
    let html = '';
    for (let i = 1; i <= 16; i++) {
        html += `
            <div class="tooth-wrapper" onclick="toggleToothStatus(this, ${i})" style="cursor: pointer; padding: 5px; border-radius: 8px; transition: all 0.3s; background: var(--bg-soft);">
                <svg width="30" height="40" viewBox="0 0 30 40" style="display:block;">
                    <path class="tooth-crown" d="M5,15 C5,5 25,5 25,15 C25,25 20,30 15,30 C10,30 5,25 5,15 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
                    <path class="tooth-root" d="M10,25 C10,38 12,40 15,40 C18,40 20,38 20,25" fill="none" stroke="#cbd5e1" stroke-width="2"/>
                </svg>
                <div style="text-align: center; font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">T${i}</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

window.toggleToothStatus = function(element, toothId) {
    const crown = element.querySelector('.tooth-crown');
    const statusText = document.getElementById('toothStatusText');
    
    // Cycle states: Healthy -> Cavity -> Crown -> Healthy
    let currentState = element.getAttribute('data-state') || 'healthy';
    
    element.style.transform = 'scale(1.1)';
    setTimeout(() => element.style.transform = 'scale(1)', 150);

    if (currentState === 'healthy') {
        element.setAttribute('data-state', 'cavity');
        crown.setAttribute('fill', '#EF4444'); // Red for cavity
        element.style.background = '#FEE2E2';
        statusText.innerText = `Tooth ${toothId} marked with Cavity (Needs filling)`;
        statusText.style.color = '#EF4444';
    } else if (currentState === 'cavity') {
        element.setAttribute('data-state', 'crown');
        crown.setAttribute('fill', '#F59E0B'); // Gold/Yellow for crown
        element.style.background = '#FEF3C7';
        statusText.innerText = `Tooth ${toothId} marked for Crown`;
        statusText.style.color = '#F59E0B';
    } else {
        element.setAttribute('data-state', 'healthy');
        crown.setAttribute('fill', '#ffffff');
        element.style.background = 'var(--bg-soft)';
        statusText.innerText = `Tooth ${toothId} marked as Healthy`;
        statusText.style.color = 'var(--secondary)';
    }

    // Auto-save chart
    if (window.dbAPI && window.currentPatient && window.currentPatient.mobile) {
        const chartData = {};
        document.querySelectorAll('.tooth-wrapper').forEach((el, index) => {
            const tId = index + 1;
            const state = el.getAttribute('data-state') || 'healthy';
            if (state !== 'healthy') {
                chartData[tId] = state;
            }
        });
        window.dbAPI.savePatientChart(window.currentPatient.mobile, chartData);
    }
};

// --- Digital E-Signature Pad ---
let signaturePadContext = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function initSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;

    signaturePadContext = canvas.getContext('2d');
    
    // Set up canvas styles
    signaturePadContext.strokeStyle = '#0F172A';
    signaturePadContext.lineWidth = 3;
    signaturePadContext.lineCap = 'round';
    signaturePadContext.lineJoin = 'round';

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events for mobile/tablet
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
        document.getElementById('signatureSuccessMessage').style.display = 'none';
        
        // Clear from DB if auto-saving
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
                document.getElementById('signatureSuccessMessage').style.display = 'block';
                setTimeout(() => {
                    document.getElementById('signatureSuccessMessage').style.display = 'none';
                }, 3000);
            }
        }
    }, 500);
}

window.resetChartingFeatures = async function() {
    if (window.clearSignature) {
        const canvas = document.getElementById('signaturePad');
        if (canvas && signaturePadContext) {
            signaturePadContext.clearRect(0, 0, canvas.width, canvas.height);
        }
        document.getElementById('signatureSuccessMessage').style.display = 'none';
    }
    
    const teeth = document.querySelectorAll('.tooth-wrapper');
    teeth.forEach(element => {
        element.setAttribute('data-state', 'healthy');
        const crown = element.querySelector('.tooth-crown');
        if (crown) crown.setAttribute('fill', '#ffffff');
        element.style.background = 'var(--bg-soft)';
    });
    
    const statusText = document.getElementById('toothStatusText');
    if (statusText) {
        statusText.innerText = 'Loading patient chart...';
        statusText.style.color = 'var(--secondary)';
    }

    if (!window.dbAPI || !window.currentPatient || !window.currentPatient.mobile) return;

    try {
        // Load Chart
        const chartData = await window.dbAPI.getPatientChart(window.currentPatient.mobile);
        teeth.forEach((element, index) => {
            const tId = index + 1;
            const state = chartData[tId] || 'healthy';
            element.setAttribute('data-state', state);
            const crown = element.querySelector('.tooth-crown');
            
            if (state === 'cavity') {
                if(crown) crown.setAttribute('fill', '#EF4444');
                element.style.background = '#FEE2E2';
            } else if (state === 'crown') {
                if(crown) crown.setAttribute('fill', '#F59E0B');
                element.style.background = '#FEF3C7';
            }
        });
        if (statusText) statusText.innerText = '';

        // Load Signature
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
        if (statusText) statusText.innerText = 'Failed to load chart';
    }
};
