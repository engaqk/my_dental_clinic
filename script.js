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
    console.log('💎 Premium Engine: Syncing Dashboard Analytics...');
    
    const appointments = await window.dbAPI.getAppointments();
    
    // Total Revenue Sync (Whole Clinic)
    let allTxns = [];
    if (window.dbAPI.db && window.dbAPI.useFirebase) {
        const snap = await window.dbAPI.db.collection('payments').get();
        snap.forEach(doc => allTxns.push(doc.data()));
    } else {
        allTxns = JSON.parse(localStorage.getItem('dentalPayments')) || [];
    }
    
    const revenue = allTxns.filter(t => t.type === 'payment').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const patientMap = new Map();
    let pendingVisits = 0;

    appointments.forEach(app => {
        const phone = app.mobile || 'Unknown';
        if (!patientMap.has(phone)) {
            patientMap.set(phone, {
                mobile: phone,
                name: app.name || 'Anonymous Patient',
                place: app.place || '',
                history: [],
                totalBilled: 0
            });
        }
        const patient = patientMap.get(phone);
        patient.history.push(app);
        if (app.status === 'Pending') pendingVisits++;
    });

    const patients = Array.from(patientMap.values());
    renderPatientExplorer(patients);
    
    // Force DOM Update for Totals
    if (document.getElementById('totalPatients')) document.getElementById('totalPatients').innerText = patients.length;
    if (document.getElementById('totalEarnings')) document.getElementById('totalEarnings').innerText = '₹' + revenue.toLocaleString();
    if (document.getElementById('pendingVisits')) document.getElementById('pendingVisits').innerText = pendingVisits;
    
    console.log(`📊 Sync Complete: ${patients.length} Patients | ₹${revenue} Revenue`);
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
    const diagnoses = document.getElementById('profileDiagnosisSection');
    const finances = document.getElementById('profileFinanceSection');
    const booking = document.getElementById('profileBookingSection');
    
    if (timeline) timeline.style.display = tab === 'timeline' ? 'block' : 'none';
    if (diagnoses) diagnoses.style.display = tab === 'diagnoses' ? 'block' : 'none';
    if (finances) finances.style.display = tab === 'finances' ? 'block' : 'none';
    if (booking) booking.style.display = tab === 'next-seating' ? 'block' : 'none';
    
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        const text = btn.innerText.toLowerCase();
        if (tab === 'timeline') btn.classList.toggle('active', text.includes('history') || text.includes('clinical'));
        if (tab === 'diagnoses') btn.classList.toggle('active', text.includes('diagnosis'));
        if (tab === 'finances') btn.classList.toggle('active', text.includes('financial') || text.includes('finances'));
        if (tab === 'next-seating') btn.classList.toggle('active', text.includes('seating'));
    });

    if (tab === 'diagnoses') renderDiagnoses(currentPatient.mobile);
}

let currentTxnType = 'payment';

function openPaymentModal() {
    if (!currentPatient) return;
    document.getElementById('paymentModal').style.display = 'flex';
    setTxnType('payment'); // Default
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('txnAmount').value = '';
    document.getElementById('txnNote').value = '';
}

function setTxnType(type) {
    currentTxnType = type;
    const payBtn = document.getElementById('txnTypePay');
    const billBtn = document.getElementById('txnTypeBill');
    const label = document.getElementById('txnAmountLabel');
    const processBtn = document.getElementById('txnProcessBtn');
    
    if (type === 'payment') {
        payBtn.style.background = 'var(--primary)';
        payBtn.style.color = 'white';
        billBtn.style.background = 'transparent';
        billBtn.style.color = 'var(--text-main)';
        label.innerText = 'PAYMENT RECEIVED (₹)';
        processBtn.innerText = 'RECORD PAYMENT';
        processBtn.style.background = 'var(--success)';
    } else {
        billBtn.style.background = 'var(--primary)';
        billBtn.style.color = 'white';
        payBtn.style.background = 'transparent';
        payBtn.style.color = 'var(--text-main)';
        label.innerText = 'CHARGE / TREATMENT FEE (₹)';
        processBtn.innerText = 'ADD CHARGE';
        processBtn.style.background = 'var(--danger)';
    }
}

async function processTransaction() {
    if (!currentPatient) return;
    const amount = parseFloat(document.getElementById('txnAmount').value);
    const note = document.getElementById('txnNote').value;
    
    if (isNaN(amount) || amount <= 0) { alert("Please enter a valid amount."); return; }

    const txnData = {
        appointmentId: currentPatient.history[0]?.id.toString() || 'general',
        mobile: currentPatient.mobile,
        amount: amount,
        note: note || (currentTxnType === 'payment' ? 'Clinic Payment' : 'Treatment Charge')
    };

    let success = false;
    if (currentTxnType === 'payment') {
        success = await window.dbAPI.addPayment(txnData);
    } else {
        success = await window.dbAPI.addCharge(txnData);
    }

    if (success) {
        alert(currentTxnType === 'payment' ? "Payment Recorded!" : "Charge Added!");
        closePaymentModal();
        await renderFinances(currentPatient);
        refreshDashboard();
    }
}

function showQuickPayment() {
    openPaymentModal();
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
    if (!window.dbAPI) return;
    
    // Fetch all financial records linked to this mobile number
    // In a real app we'd query by mobile, for now assuming we get them via appointment IDs
    let allTxns = [];
    if (window.dbAPI.db && window.dbAPI.useFirebase) {
        const payments = await window.dbAPI.db.collection('payments').get().then(snap => snap.docs.map(doc => doc.data()));
        const revenue = payments.filter(p => p.type === 'payment').reduce((sum, p) => sum + (p.amount || 0), 0);
    } else {
        const local = JSON.parse(localStorage.getItem('dentalPayments')) || [];
        allTxns = local.filter(p => p.mobile === patient.mobile);
    }

    const totalPaid = allTxns.filter(t => t.type === 'payment').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const totalBilled = allTxns.filter(t => t.type === 'charge').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    document.getElementById('totalBilledProfile').innerText = '₹' + totalBilled.toLocaleString();
    document.getElementById('totalPaidProfile').innerText = '₹' + totalPaid.toLocaleString();

    const paymentLog = document.getElementById('paymentLog');
    paymentLog.innerHTML = '';
    
    allTxns.sort((a,b) => (b.createdAt?.seconds || Date.now()) - (a.createdAt?.seconds || 0)).forEach(txn => {
        const div = document.createElement('div');
        div.className = 'payment-log-item';
        div.style.borderLeft = txn.type === 'payment' ? '4px solid var(--success)' : '4px solid var(--danger)';
        
        const dateStr = txn.createdAt?.toDate ? txn.createdAt.toDate().toLocaleDateString() : new Date(txn.createdAt).toLocaleDateString();
        const typeLabel = txn.type === 'payment' ? 'RECEIVED' : 'BILLED';
        
        div.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <span style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">${typeLabel} - ${dateStr}</span>
                <span style="font-size:0.85rem; font-weight:600;">${txn.note || ''}</span>
            </div>
            <span class="amount" style="color: ${txn.type === 'payment' ? 'var(--success)' : 'var(--danger)'}">₹${txn.amount}</span>
        `;
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
    if (success) { 
        alert('Settings Updated Globally'); 
        document.getElementById('settingsModal').style.display='none'; 
        loadClinicSettings(); // Refresh UI immediately
    }
});

function loadClinicSettings() {
    window.dbAPI.getSettings().then(settings => {
        const nameEl = document.getElementById('mainClinicName');
        const subEl = document.getElementById('mainClinicSubtitle');
        if (nameEl) nameEl.innerText = settings.clinic_name || 'MY DENTAL CLINIC';
        if (subEl) subEl.innerText = settings.subtitle || 'Dental & Cosmetic Clinic';
    });
}

function checkSuperAdmin() {
    const btn = document.getElementById('settingsBtn');
    const fields = document.getElementById('superAdminFields');
    const logoutNav = document.getElementById('logout-nav-item');
    const userStr = sessionStorage.getItem('staffUser');
    const user = userStr ? JSON.parse(userStr) : null;

    if (user && (user.role === 'super_admin' || user.role === 'admin' || user.email === 'abdulqadir.galaxy53@gmail.com')) {
        if (btn) btn.style.display = 'inline-block';
        if (fields) fields.style.display = 'block';
        if (logoutNav) logoutNav.style.display = 'block';
    } else {
        if (btn) btn.style.display = 'none';
        if (fields) fields.style.display = 'none';
        if (logoutNav) logoutNav.style.display = 'none';
    }
}
window.checkSuperAdmin = checkSuperAdmin;

function showBookingModal(a) { document.getElementById('bookingModal').style.display = 'flex'; }

function quickWhatsApp() {
    if (!currentPatient) return;
    const msg = encodeURIComponent(`Hi ${currentPatient.name}, this is MY DENTAL CLINIC. We are following up regarding your treatment.`);
    window.open(`https://wa.me/${currentPatient.mobile.replace(/\D/g,'')}?text=${msg}`, '_blank');
}

function openBookingForCurrentPatient() {
    if (!currentPatient) return;
    switchProfileTab('next-seating');
}

async function saveProfileBooking() {
    if (!currentPatient) return;
    
    const nextDate = document.getElementById('profileNextDate').value;
    const nextTime = document.getElementById('profileNextTime').value;
    const nextReason = document.getElementById('profileNextReason').value;

    if (!nextDate) { alert("Please select a date."); return; }

    const newAppt = {
        name: currentPatient.name,
        mobile: currentPatient.mobile,
        place: currentPatient.place || '',
        appointmentDate: nextDate,
        appointmentTime: nextTime,
        reason: nextReason,
        fee: 0,
        status: 'Pending'
    };

    const saved = await window.dbAPI.createAppointment(newAppt);
    if (saved) {
        alert("Success: Next seating scheduled.");
        // Refresh local patient data
        const updatedHistory = await window.dbAPI.getPatientHistory(currentPatient.mobile);
        currentPatient.history = updatedHistory;
        renderTimeline(currentPatient.history);
        switchProfileTab('timeline');
        // Clear inputs
        document.getElementById('profileNextDate').value = '';
        document.getElementById('profileNextReason').value = '';
        refreshDashboard();
    }
}

// --- DIAGNOSIS ENGINE ---
async function renderDiagnoses(mobile) {
    const list = document.getElementById('diagnosisList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;">Loading history...</p>';
    
    const records = await window.dbAPI.getDiagnoses(mobile);
    if (!records.length) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">No diagnostic history recorded.</p>';
        return;
    }

    list.innerHTML = records.map(r => `
        <div class="seating-card" style="margin-top:0; border-left:4px solid var(--primary);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h4 style="margin:0; color:var(--secondary);">${r.title}</h4>
                <span style="font-size:0.7rem; font-weight:800; color:var(--text-muted);">${new Date(r.timestamp).toLocaleDateString()}</span>
            </div>
            <p style="margin-top:0.5rem; font-size:0.85rem; line-height:1.5;">${r.notes || 'No detailed notes.'}</p>
        </div>
    `).join('');
}

async function saveNewDiagnosis() {
    if (!currentPatient) return;
    const title = document.getElementById('diagTitle').value.trim();
    const notes = document.getElementById('diagNotes').value.trim();

    if (!title) { alert("Please enter the diagnostic condition."); return; }

    const success = await window.dbAPI.addDiagnosis({
        mobile: currentPatient.mobile,
        title: title,
        notes: notes
    });

    if (success) {
        alert("Diagnosis Saved Successfully.");
        document.getElementById('diagTitle').value = '';
        document.getElementById('diagNotes').value = '';
        renderDiagnoses(currentPatient.mobile);
    }
}

// --- PWA REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('💎 Premium Engine: PWA Service Worker Registered');
        }).catch(err => {
            console.warn('SW: Registration failed:', err);
        });
    });
}
