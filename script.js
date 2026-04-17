/* 
   ==========================================================================
   State-of-the-Art Dental Clinic Management System
   Premium Patient-Centric & Appointment Engine
   ==========================================================================
*/

let currentPatient = null;
let myChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (window.dbAPI) {
        await refreshDashboard();
        loadClinicSettings();
        initQRCode();
        if (window.checkSuperAdmin) window.checkSuperAdmin();
    } else {
        console.error('Database API not found!');
    }
    initializeDateTimePickers();
});

// --- DASHBOARD: PATIENT EXPLORER ---

async function refreshDashboard() {
    console.log('💎 Premium Engine: Refreshing Patient Explorer...');
    const appointments = await window.dbAPI.getAppointments();
    
    // Group by Mobile
    const patientMap = new Map();
    let grandTotalEarnings = 0;
    let pendingVisits = 0;

    appointments.forEach(app => {
        const phone = app.mobile || 'Unknown';
        if (!patientMap.has(phone)) {
            patientMap.set(phone, {
                mobile: phone,
                name: app.name || 'Anonymous Patient',
                place: app.place || '',
                history: [],
                totalBilled: 0,
                totalPaid: 0
            });
        }
        const patient = patientMap.get(phone);
        patient.history.push(app);
        const fee = parseFloat(app.fee) || 0;
        patient.totalBilled += fee;
        grandTotalEarnings += fee;
        if (app.status === 'Pending') pendingVisits++;
    });

    const patients = Array.from(patientMap.values());
    renderPatientExplorer(patients);
    
    // Update Stats
    if (document.getElementById('totalPatients')) document.getElementById('totalPatients').innerText = patients.length;
    if (document.getElementById('totalEarnings')) document.getElementById('totalEarnings').innerText = '₹' + grandTotalEarnings.toLocaleString();
    if (document.getElementById('pendingVisits')) document.getElementById('pendingVisits').innerText = pendingVisits;
}

function renderPatientExplorer(patients) {
    const container = document.getElementById('patientExplorer');
    if (!container) return;

    const searchText = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const filtered = patients.filter(p => 
        p.name.toLowerCase().includes(searchText) || 
        p.mobile.includes(searchText) ||
        p.place.toLowerCase().includes(searchText)
    );

    container.innerHTML = '';
    if (filtered.length === 0) {
        document.getElementById('noDataMessage').style.display = 'block';
        return;
    }
    document.getElementById('noDataMessage').style.display = 'none';

    filtered.forEach(p => {
        const lastVisit = p.history[0]?.appointmentDate || p.history[0]?.date || 'N/A';
        const card = document.createElement('div');
        card.className = 'patient-explorer-card';
        card.onclick = () => openPatientProfile(p);
        
        card.innerHTML = `
            <div class="patient-name">${p.name}</div>
            <div class="patient-meta">
                <span><i class="fas fa-phone-alt"></i> ${p.mobile}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${p.place || 'Local'}</span>
            </div>
            <div class="patient-summary-stats">
                <div class="mini-stat">
                    <span>Last Visit</span>
                    <span>${lastVisit}</span>
                </div>
                <div class="mini-stat">
                    <span>Sessions</span>
                    <span>${p.history.length}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterPatients() {
    refreshDashboard();
}

async function openPatientProfile(patient) {
    currentPatient = patient;
    const modal = document.getElementById('patientProfileModal');
    if (modal) {
        document.getElementById('profileName').innerText = patient.name;
        document.getElementById('profileMeta').innerText = `Mobile: ${patient.mobile} | Place: ${patient.place || 'Main'}`;
        renderTimeline(patient.history);
        await renderFinances(patient);
        modal.style.display = 'flex';
    }
}

function switchProfileTab(tab) {
    const timeline = document.getElementById('profileTimelineSection');
    const finances = document.getElementById('profileFinanceSection');
    if (timeline) timeline.style.display = tab === 'timeline' ? 'block' : 'none';
    if (finances) finances.style.display = tab === 'finances' ? 'block' : 'none';
    
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        const text = btn.innerText.toLowerCase();
        if (tab === 'timeline') btn.classList.toggle('active', text.includes('history') || text.includes('clinical'));
        if (tab === 'finances') btn.classList.toggle('active', text.includes('financial') || text.includes('finances'));
    });
}

async function showQuickPayment() {
    const amount = prompt("Enter payment amount (₹):");
    if (!amount || isNaN(amount)) return;
    if (!currentPatient || !currentPatient.history[0]) {
        alert("Select a service to link payment.");
        return;
    }
    const success = await window.dbAPI.addPayment({
        appointmentId: currentPatient.history[0].id.toString(),
        mobile: currentPatient.mobile,
        amount: parseFloat(amount),
        method: 'Recorded Payment'
    });
    if (success) {
        alert("Payment Recorded Successfully.");
        await renderFinances(currentPatient);
    }
}

function renderTimeline(history) {
    const container = document.getElementById('patientTimeline');
    container.innerHTML = '';

    const totalVisits = history.length;
    
    // Reverse sort so newest is on top
    history.sort((a,b) => (b.appointmentDate||b.date).localeCompare(a.appointmentDate||a.date)).forEach((appt, index) => {
        const visitNumber = totalVisits - index;
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-date">
                <span class="visit-tag">VISIT #${visitNumber}</span>
                <span>${appt.appointmentDate || appt.date} | ${appt.appointmentTime || ''}</span>
            </div>
            <div class="seating-card">
                <select class="status-select" onchange="updateStatus('${appt.id}', this.value)">
                    <option value="Pending" ${appt.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Completed" ${appt.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Cancelled" ${appt.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
                <h4>${appt.reason || 'General Consultation'}</h4>
                
                <div class="seating-fee-input">
                    <label>Treatment Fee: ₹</label>
                    <input type="number" value="${appt.fee || 0}" onchange="updateFee('${appt.id}', this.value)">
                </div>

                <div class="timeline-actions">
                    <button onclick="openNotesModal('${appt.id}')" class="btn-notes">
                        <i class="fas fa-notes-medical"></i> NOTES
                    </button>
                    <button onclick="generateBill('${encodeURIComponent(JSON.stringify(appt))}')" class="btn-bill">
                        <i class="fas fa-file-invoice-dollar"></i> BILL
                    </button>
                    <button onclick="sendQuickUpdate('${appt.mobile}', 'Hi ${appt.name}, just a follow up regarding your visit for ${appt.reason}.')" 
                        class="btn-chat-small">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="window.location.href='tel:${appt.mobile}'" 
                        class="btn-call-small">
                        <i class="fas fa-phone-alt"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

async function renderFinances(patient) {
    let allPayments = [];
    for (const appt of patient.history) {
        const p = await window.dbAPI.getPayments(appt.id);
        allPayments = allPayments.concat(p);
    }
    const totalPaid = allPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    
    document.getElementById('totalBilledProfile').innerText = '₹' + patient.totalBilled.toLocaleString();
    document.getElementById('totalPaidProfile').innerText = '₹' + totalPaid.toLocaleString();

    const paymentLog = document.getElementById('paymentLog');
    paymentLog.innerHTML = '';
    allPayments.sort((a,b) => b.createdAt - a.createdAt).forEach(pay => {
        const div = document.createElement('div');
        div.className = 'payment-log-item';
        div.innerHTML = `<span>${new Date().toLocaleDateString()}</span> <span class="amount">₹${pay.amount}</span>`;
        paymentLog.appendChild(div);
    });
}

// --- BOOKING LOGIC ---

function initializeDateTimePickers() {
    const dateInput = document.getElementById('appointmentDate');
    if (!dateInput) return;
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
    dateInput.value = today;
    dateInput.addEventListener('change', generateTimeSlots);
    generateTimeSlots();
}

async function generateTimeSlots() {
    const timeSelect = document.getElementById('appointmentTime');
    const selectedDate = document.getElementById('appointmentDate').value;
    if (!timeSelect) return;

    timeSelect.innerHTML = '<option value="">Loading...</option>';
    let bookedSlots = await window.dbAPI.getBookedTimeSlots(selectedDate);
    timeSelect.innerHTML = '<option value="">Select time slot...</option>';

    const addSlot = (h, m) => {
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const display = formatTime(h, m);
        const booked = bookedSlots.some(s => s === timeStr || s.startsWith(timeStr));
        const opt = document.createElement('option');
        opt.value = timeStr;
        opt.textContent = booked ? `${display} (Booked)` : display;
        if (booked) opt.disabled = true;
        timeSelect.appendChild(opt);
    };

    for (let h = 11; h < 14; h++) for (let m = 0; m < 60; m += 30) addSlot(h, m);
    for (let h = 16; h < 19; h++) for (let m = 0; m < 60; m += 30) addSlot(h, m);
}

function formatTime(h, m) {
    const p = h >= 12 ? 'PM' : 'AM';
    const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${dh}:${m.toString().padStart(2, '0')} ${p}`;
}

const bookingForm = document.getElementById('bookingForm');
bookingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const appt = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        appointmentDate: document.getElementById('appointmentDate').value,
        appointmentTime: document.getElementById('appointmentTime').value,
        name: document.getElementById('name').value,
        mobile: document.getElementById('mobile').value,
        place: document.getElementById('place').value,
        reason: document.getElementById('reason').value,
        fee: 0,
        status: 'Pending'
    };
    await window.dbAPI.createAppointment(appt);
    alert('Appointment Booked!');
    bookingForm.reset();
    showBookingModal(appt);
});

// --- UTILITIES ---

function generateBill(appJson) {
    const app = JSON.parse(decodeURIComponent(appJson));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("DENTAL CLINIC INVOICE", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Patient: ${app.name}`, 20, 40);
    doc.text(`Treatment: ${app.reason}`, 20, 50);
    doc.text(`Total Fee: Rs. ${app.fee}/-`, 20, 60);
    doc.save(`Bill_${app.name}.pdf`);
}

function sendWhatsApp(appJson) {
    const app = JSON.parse(decodeURIComponent(appJson));
    const msg = encodeURIComponent(`Hello ${app.name}, reminder for your visit on ${app.appointmentDate} at ${app.appointmentTime}.`);
    window.open(`https://wa.me/91${app.mobile}?text=${msg}`, '_blank');
}

async function openNotesModal(apptId) {
    document.getElementById('notesApptId').value = apptId;
    document.getElementById('notesForm').reset();
    const existing = await window.dbAPI.getClinicalNotes(apptId);
    if (existing) {
        document.getElementById('noteSoftTissue').value = existing.softTissue || "";
        document.getElementById('noteHardTissue').value = existing.hardTissue || "";
        document.getElementById('noteHygiene').value = existing.hygiene || "Good";
        document.getElementById('notePeriodontal').value = existing.periodontal || "";
        document.getElementById('noteRadiographic').value = existing.radiographic || "";
    }
    document.getElementById('notesModal').style.display = 'flex';
}

function closeNotesModal() { document.getElementById('notesModal').style.display = 'none'; }

document.getElementById('notesForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        softTissue: document.getElementById('noteSoftTissue').value,
        hardTissue: document.getElementById('noteHardTissue').value,
        hygiene: document.getElementById('noteHygiene').value,
        periodontal: document.getElementById('notePeriodontal').value,
        radiographic: document.getElementById('noteRadiographic').value
    };
    await window.dbAPI.saveClinicalNotes(document.getElementById('notesApptId').value, data);
    alert('Notes Saved!');
    closeNotesModal();
});

async function updateStatus(id, stat) { await window.dbAPI.updateAppointment(id, { status: stat }); refreshDashboard(); }
async function updateFee(id, val) { await window.dbAPI.updateAppointment(id, { fee: parseFloat(val) || 0 }); refreshDashboard(); }

function showDashboardTab(name) {
    document.querySelectorAll('.dashboard-tab').forEach(t => t.style.display='none');
    document.getElementById(name+'Tab').style.display='block';
}

function initQRCode() {
    const container = document.getElementById("qrcode");
    if (container) { container.innerHTML = ""; new QRCode(container, { text: window.location.origin, width: 256, height: 256 }); }
}

function logout() { sessionStorage.clear(); window.location.reload(); }
function closeProfileModal() { document.getElementById('patientProfileModal').style.display = 'none'; refreshDashboard(); }
function closeBookingModal() { document.getElementById('bookingModal').style.display = 'none'; }
function closeBookingModal() { document.getElementById('bookingModal').style.display = 'none'; }

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    window.dbAPI.getSettings().then(settings => {
        document.getElementById('settingClinicName').value = settings.clinic_name || "";
        document.getElementById('settingSubtitle').value = settings.subtitle || "";
        document.getElementById('settingAdminUser').value = settings.admin_user || "";
        document.getElementById('settingAdminPass').value = settings.admin_pass || "";
        modal.style.display = 'flex';
    });
}

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const settings = {
        clinic_name: document.getElementById('settingClinicName').value,
        subtitle: document.getElementById('settingSubtitle').value,
        admin_user: document.getElementById('settingAdminUser').value,
        admin_pass: document.getElementById('settingAdminPass').value
    };
    const success = await window.dbAPI.saveSettings(settings);
    if (success) { alert('Settings Updated Globally'); document.getElementById('settingsModal').style.display='none'; }
});

function loadClinicSettings() {
    window.dbAPI.getSettings().then(settings => {
        if (settings.clinic_name) document.querySelector('.logo-section').insertAdjacentHTML('beforeend', `<div class="clinic-name"><h1>${settings.clinic_name}</h1><span>${settings.subtitle}</span></div>`);
    });
}

function checkSuperAdmin() {
    const btn = document.getElementById('settingsBtn');
    const fields = document.getElementById('superAdminFields');
    const userStr = sessionStorage.getItem('staffUser');
    const user = userStr ? JSON.parse(userStr) : null;

    if (user && (user.role === 'super_admin' || user.email === 'abdulqadir.galaxy53@gmail.com')) {
        if (btn) btn.style.display = 'inline-block';
        if (fields) fields.style.display = 'block';
    } else {
        if (btn) btn.style.display = 'none';
        if (fields) fields.style.display = 'none';
    }
}
window.checkSuperAdmin = checkSuperAdmin;

function showBookingModal(a) { document.getElementById('bookingModal').style.display = 'flex'; }

function openBookingForCurrentPatient() {
    if (!currentPatient) return;
    showSection('home');
    document.getElementById('name').value = currentPatient.name;
    document.getElementById('mobile').value = currentPatient.mobile;
    document.getElementById('place').value = currentPatient.place || "";
    document.getElementById('reason').value = "Follow-up for " + (currentPatient.history[0]?.reason || "previous treatment");
    
    // Smooth scroll to form
    setTimeout(() => {
        document.querySelector('.appointment-form').scrollIntoView({behavior: 'smooth'});
    }, 100);
}
