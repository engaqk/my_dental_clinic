/* 
   ==========================================================================
   State-of-the-Art Dental Clinic Management System
   Premium Patient-Centric & Appointment Engine
   ==========================================================================
*/

let currentPatient = null;
let myChart = null;

// Format any mobile number to wa.me compatible format: 91XXXXXXXXXX
function formatWhatsAppNumber(raw) {
    let digits = (raw || '').replace(/\D/g, '');
    // Remove leading zeros
    digits = digits.replace(/^0+/, '');
    // If already starts with 91 and is 12 digits, use as-is
    if (digits.startsWith('91') && digits.length === 12) return digits;
    // If 10 digits (Indian mobile), prepend 91
    if (digits.length === 10) return '91' + digits;
    // If 11 digits starting with 0, strip leading 0 and add 91
    if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
    // Fallback: return as-is
    return digits;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize multilingual system
    const savedLanguage = localStorage.getItem('dentalLanguage') || 'en';
    if (typeof changeLanguage !== 'undefined') {
        changeLanguage(savedLanguage);
    }

    if (window.dbAPI) {
        await refreshDashboard();
        loadClinicSettings();
        initQRCode();
        if (window.checkSuperAdmin) window.checkSuperAdmin();

        // Handle OAuth Redirect Result for PWA Standalone logins
        if (window.dbAPI.auth) {
            window.dbAPI.auth.getRedirectResult().then((result) => {
                if (result && result.user) {
                    console.log("OAuth redirect login successful:", result.user.email);
                    setupPatientDashboard(result.user.email, result.user.displayName || 'Patient');
                    showSection('patient-portal');
                }
            }).catch(err => {
                console.error("OAuth redirect handler error:", err);
            });
        }
    } else {
        console.error('Database API not found!');
    }
    initializeDateTimePickers();
});

// --- DASHBOARD: PATIENT EXPLORER ---

async function refreshDashboard() {
    if (typeof enforceRoleRestrictions === 'function') enforceRoleRestrictions();
    if (typeof checkSuperAdminUI === 'function') checkSuperAdminUI();
    console.log('💎 Premium Engine: Syncing Dashboard Analytics...');
    
    const appointments = await window.dbAPI.getAppointments();
    
    // Total Revenue Sync (Whole Clinic)
    let allTxns = [];
    if (window.dbAPI.db && window.dbAPI.useFirebase) {
        try {
            const snap = await window.dbAPI.getCollection('payments').get();
            snap.forEach(doc => allTxns.push(doc.data()));
        } catch(e) { console.error('Error loading payments:', e); }
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
    
    renderDashboardOverview(patients);
    if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar(currentScheduleDate);
    console.log(`📊 Sync Complete: ${patients.length} Patients | ₹${revenue} Revenue`);
}

function renderDashboardOverview(patients) {
    const todayList = document.getElementById('todayScheduleList');
    const recentList = document.getElementById('recentPatientsList');
    if (!todayList || !recentList) return;

    // Get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Gather all appointments across all patients
    let allAppts = [];
    patients.forEach(p => {
        p.history.forEach(a => {
            allAppts.push({ ...a, patientName: p.name, mobile: p.mobile, place: p.place, initials: p.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() });
        });
    });

    // Today's schedule
    const todayAppts = allAppts.filter(a => (a.appointmentDate || a.date) === today)
        .sort((a,b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''));
    
    if (todayAppts.length === 0) {
        todayList.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); background: var(--bg-soft); border-radius: 8px;">No appointments scheduled for today.</div>`;
    } else {
        todayList.innerHTML = todayAppts.map(a => `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #F1F5F9; cursor: pointer;" onclick="document.getElementById('searchInput').value='${a.mobile}'; filterPatients();">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0D9488, #0891B2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">${a.initials}</div>
                <div style="flex: 1;">
                    <div style="font-size: 0.95rem; font-weight: 700; color: #0F172A;">${a.patientName}</div>
                    <div style="font-size: 0.8rem; color: #64748B;">${a.appointmentTime || 'Time TBD'} · ${a.reason || 'Consultation'}</div>
                </div>
                <span style="font-size: 0.7rem; padding: 4px 8px; border-radius: 99px; font-weight: 800; ${a.status==='Pending' ? 'background: #FEF9C3; color: #CA8A04;' : 'background: #DCFCE7; color: #16A34A;'}">${a.status || 'Confirmed'}</span>
            </div>
        `).join('');
    }

    // Recent patients (sort by latest appointment)
    const recent = [...patients].sort((a, b) => {
        const d1 = new Date(a.history[0]?.appointmentDate || a.history[0]?.date || '2000-01-01').getTime();
        const d2 = new Date(b.history[0]?.appointmentDate || b.history[0]?.date || '2000-01-01').getTime();
        return d2 - d1;
    }).slice(0, 5);

    if (recent.length === 0) {
        recentList.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); background: var(--bg-soft); border-radius: 8px;">No recent patients.</div>`;
    } else {
        recentList.innerHTML = recent.map(p => {
            const initials = p.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
            const lastAppt = p.history[0];
            return `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #F1F5F9; cursor: pointer;" onclick="openPatientProfile(patients.find(x => x.mobile === '${p.mobile}'))">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #3B82F6, #1E3A8A); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">${initials}</div>
                <div style="flex: 1;">
                    <div style="font-size: 0.95rem; font-weight: 700; color: #0F172A;">${p.name}</div>
                    <div style="font-size: 0.8rem; color: #64748B;">${lastAppt?.reason || 'Consultation'} · ${p.history.length} visits</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.7rem; padding: 4px 8px; border-radius: 99px; font-weight: 800; background: #E0E7FF; color: #4338CA;">Active</span>
                    <i class="fas fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
                </div>
            </div>
            `;
        }).join('');
    }
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
            <button style="width: 100%; margin-top: 1rem; background: var(--bg-soft); color: var(--primary); border: none; padding: 0.75rem; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.2s;">
                View Profile <i class="fas fa-arrow-right" style="margin-left: 5px;"></i>
            </button>
        `;
        container.appendChild(card);
    });
}

function filterPatients() {
    refreshDashboard();
}

async function openPatientProfile(patient) {
    currentPatient = patient;
    window.currentPatient = patient; // EXPOSE FOR PREMIUM FEATURES
    const modal = document.getElementById('patientProfileModal');
    if (modal) {
        document.getElementById('profileName').innerText = patient.name;
        document.getElementById('profileMeta').innerText = `Mobile: ${patient.mobile} | Place: ${patient.place || 'Main'}`;
        renderTimeline(patient.history);
        await renderFinances(patient);
        if (window.resetChartingFeatures) await window.resetChartingFeatures();
        modal.style.display = 'flex';
    }
}

function switchProfileTab(tab) {
    const timeline = document.getElementById('profileTimelineSection');
    const diagnoses = document.getElementById('profileDiagnosisSection');
    const finances = document.getElementById('profileFinanceSection');
    const booking = document.getElementById('profileBookingSection');
    const charting = document.getElementById('profileChartingSection');
    
    if (timeline) timeline.style.display = tab === 'timeline' ? 'block' : 'none';
    if (diagnoses) diagnoses.style.display = tab === 'diagnoses' ? 'block' : 'none';
    if (finances) finances.style.display = tab === 'finances' ? 'block' : 'none';
    if (booking) booking.style.display = tab === 'next-seating' ? 'block' : 'none';
    if (charting) charting.style.display = tab === 'charting' ? 'block' : 'none';
    
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        const text = btn.innerText.toLowerCase();
        if (tab === 'timeline') btn.classList.toggle('active', text.includes('history') || text.includes('clinical'));
        if (tab === 'diagnoses') btn.classList.toggle('active', text.includes('diagnosis'));
        if (tab === 'finances') btn.classList.toggle('active', text.includes('financial') || text.includes('finances'));
        if (tab === 'next-seating') btn.classList.toggle('active', text.includes('seating'));
        if (tab === 'charting') btn.classList.toggle('active', text.includes('charting') || text.includes('consent'));
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
        try {
            const snap = await window.dbAPI.getCollection('payments').where('mobile', '==', patient.mobile).get();
            allTxns = snap.docs.map(doc => doc.data());
        } catch (e) {
            console.error('Error fetching payments:', e);
        }
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
    if (!dateInput.value) {
        dateInput.value = today;
    }
    dateInput.removeEventListener('change', generateTimeSlots);
    dateInput.addEventListener('change', generateTimeSlots);
    dateInput.removeEventListener('input', generateTimeSlots);
    dateInput.addEventListener('input', generateTimeSlots);
    generateTimeSlots();

    // Also initialize profile next sitting date picker if present
    const profileDateInput = document.getElementById('profileNextDate');
    if (profileDateInput) {
        profileDateInput.setAttribute('min', today);
        profileDateInput.removeEventListener('change', generateProfileTimeSlots);
        profileDateInput.addEventListener('change', generateProfileTimeSlots);
        profileDateInput.removeEventListener('input', generateProfileTimeSlots);
        profileDateInput.addEventListener('input', generateProfileTimeSlots);
    }
}

// Helper to parse any time string (12h or 24h, with or without AM/PM or leading zeroes) to minutes from midnight
function parseTimeToMinutes(str) {
    if (!str) return null;
    const s = str.toString().trim().toUpperCase();
    const match = s.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    let hr = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const isPM = s.includes('PM');
    const isAM = s.includes('AM');
    if (isPM && hr < 12) hr += 12;
    if (isAM && hr === 12) hr = 0;
    return hr * 60 + min;
}

async function generateTimeSlots() {
    const timeSelect = document.getElementById('appointmentTime');
    const dateInput = document.getElementById('appointmentDate');
    if (!timeSelect || !dateInput) return;
    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    const previousSelection = timeSelect.value;

    let bookedSlots = [];
    try {
        if (window.dbAPI && typeof window.dbAPI.getBookedTimeSlots === 'function') {
            bookedSlots = await window.dbAPI.getBookedTimeSlots(selectedDate);
        }
    } catch (e) {
        console.warn('Could not load booked time slots:', e);
    }

    const bookedMinutes = (bookedSlots || []).map(parseTimeToMinutes).filter(m => m !== null);

    timeSelect.innerHTML = '<option value="">Select time slot...</option>';

    const addSlot = (h, m) => {
        const slotMinutes = h * 60 + m;
        const display = formatTime(h, m);
        const isBooked = bookedMinutes.includes(slotMinutes);

        const opt = document.createElement('option');
        opt.value = display;
        opt.textContent = isBooked ? `${display} (Booked)` : display;
        opt.style.color = isBooked ? '#94A3B8' : '#0F172A';
        opt.style.backgroundColor = '#FFFFFF';
        opt.style.fontWeight = isBooked ? 'normal' : '600';
        if (isBooked) {
            opt.disabled = true;
        }
        timeSelect.appendChild(opt);
    };

    // Standard clinical hours: 11:00 AM - 02:00 PM and 04:00 PM - 07:00 PM
    for (let h = 11; h < 14; h++) for (let m = 0; m < 60; m += 30) addSlot(h, m);
    for (let h = 16; h < 19; h++) for (let m = 0; m < 60; m += 30) addSlot(h, m);

    // If user already had a valid selection that is not booked, restore it so selection isn't wiped
    if (previousSelection) {
        const prevMin = parseTimeToMinutes(previousSelection);
        if (prevMin !== null && !bookedMinutes.includes(prevMin)) {
            timeSelect.value = previousSelection;
        } else {
            timeSelect.value = "";
        }
    }
    timeSelect.style.color = timeSelect.value ? '#0F172A' : '#64748B';
    timeSelect.onchange = function() {
        this.style.color = this.value ? '#0F172A' : '#64748B';
        this.style.fontWeight = '600';
    };
}

async function generateProfileTimeSlots() {
    const profileTimeSelect = document.getElementById('profileNextTime');
    const profileDateInput = document.getElementById('profileNextDate');
    if (!profileTimeSelect || !profileDateInput || !profileDateInput.value) return;

    let bookedSlots = [];
    try {
        if (window.dbAPI && typeof window.dbAPI.getBookedTimeSlots === 'function') {
            bookedSlots = await window.dbAPI.getBookedTimeSlots(profileDateInput.value);
        }
    } catch (e) {}

    const bookedMinutes = (bookedSlots || []).map(parseTimeToMinutes).filter(m => m !== null);
    const standardHours = [
        { h: 10, m: 0 }, { h: 11, m: 0 }, { h: 12, m: 0 },
        { h: 17, m: 0 }, { h: 18, m: 0 }, { h: 19, m: 0 }, { h: 20, m: 0 }
    ];

    const currentVal = profileTimeSelect.value;
    profileTimeSelect.innerHTML = '';
    standardHours.forEach(({ h, m }) => {
        const slotMinutes = h * 60 + m;
        const display = formatTime(h, m);
        const isBooked = bookedMinutes.includes(slotMinutes);
        const opt = document.createElement('option');
        opt.value = display;
        opt.textContent = isBooked ? `${display} (Booked)` : display;
        if (isBooked) {
            opt.disabled = true;
            opt.style.color = '#94A3B8';
        }
        profileTimeSelect.appendChild(opt);
    });
    if (currentVal && !bookedMinutes.includes(parseTimeToMinutes(currentVal))) {
        profileTimeSelect.value = currentVal;
    }
}

function formatTime(h, m) {
    const p = h >= 12 ? 'PM' : 'AM';
    const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${dh}:${m.toString().padStart(2, '0')} ${p}`;
}

function sendBookingEmail(appt) {
    if (!appt || !appt.email) return;
    try {
        fetch('/api/booking-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appointmentId: appt.id,
                name: appt.name,
                mobile: appt.mobile,
                email: appt.email,
                date: appt.appointmentDate || appt.date,
                time: appt.appointmentTime,
                reason: appt.reason,
                clinicName: 'My Dental Clinic'
            })
        }).then(res => res.json())
          .then(data => console.log('Notification API result:', data))
          .catch(err => console.error('Notification API fetch error:', err));
    } catch (err) {
        console.warn('Failed to call notification service:', err);
    }
}

const bookingForm = document.getElementById('bookingForm');
bookingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('appointmentDate').value;
    const timeVal = document.getElementById('appointmentTime').value;

    if (!timeVal) {
        alert('Please select an available time slot.');
        return;
    }

    const appt = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        appointmentDate: dateVal,
        appointmentTime: timeVal,
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        mobile: document.getElementById('mobile').value,
        place: document.getElementById('place').value,
        reason: document.getElementById('reason').value,
        fee: 0,
        status: 'Pending'
    };
    
    const savedAppt = await window.dbAPI.createAppointment(appt);
    
    // Send email alert immediately using serverless endpoint
    sendBookingEmail(savedAppt || appt);

    alert('Appointment Booked!');
    bookingForm.reset();

    // Retain booked date so user immediately sees the slot marked as (Booked)
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
        dateInput.value = dateVal || new Date().toISOString().split('T')[0];
    }
    // Immediately regenerate slots to show updated booked status
    await generateTimeSlots();
    if (typeof refreshDashboard === 'function') refreshDashboard();

    showBookingModal(appt);
});

// --- UTILITIES ---

async function generateBill(appJson) {
    try {
        const app = JSON.parse(decodeURIComponent(appJson));
        
        // Fetch settings and transactions
        let settings = {};
        let payments = [];
        try {
            if (window.dbAPI) {
                settings = await window.dbAPI.getSettings() || {};
                payments = await window.dbAPI.getPayments(app.id) || [];
            }
        } catch (err) {
            console.warn("Failed to fetch settings or payments for bill generation:", err);
        }

        const clinicName = settings.clinic_name || 'MY DENTAL CLINIC';
        const subtitle = settings.subtitle || 'Dental & Cosmetic Clinic';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // A4 Dimensions: 210 x 297 mm
        
        // 1. Top Decorative Brand Bar (Teal Accent)
        doc.setFillColor(13, 148, 136); // #0D9488 (Teal)
        doc.rect(0, 0, 210, 6, 'F');

        // 2. Clinic Branding
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // #0F172A (Slate 900)
        doc.text(clinicName.toUpperCase(), 20, 22);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(13, 148, 136); // Teal
        doc.text(subtitle, 20, 28);

        // 3. Invoice Title & Meta (Right Aligned)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text("INVOICE", 190, 22, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139); // #64748B (Slate Grey)
        doc.text(`Invoice No: INV-${app.id || 'N/A'}`, 190, 28, { align: 'right' });
        doc.text(`Date: ${app.appointmentDate || app.date || 'N/A'}`, 190, 32, { align: 'right' });

        // Divider
        doc.setDrawColor(226, 232, 240); // #E2E8F0
        doc.setLineWidth(0.5);
        doc.line(20, 38, 190, 38);

        // 4. Two-Column Metadata (Patient Details vs Invoice Details)
        // Column 1: Patient (Left)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("BILLED TO:", 20, 46);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(app.name || 'Anonymous Patient', 20, 52);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59); // #1E293B
        doc.text(`Phone: ${app.mobile || 'N/A'}`, 20, 57);
        doc.text(`Location: ${app.place || 'N/A'}`, 20, 62);

        // Column 2: Appointment / Clinic Details (Right)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("TREATMENT DETAILS:", 120, 46);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(app.reason || 'General Consultation', 120, 52);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(`Scheduled Time: ${app.appointmentTime || 'N/A'}`, 120, 57);
        doc.text(`Clinical Status: ${app.status || 'Pending'}`, 120, 62);

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(20, 68, 190, 68);

        // 5. Itemized Invoice Table
        const items = [];
        const appFee = parseFloat(app.fee) || 0;
        
        // Push primary treatment item
        items.push({
            name: app.reason || 'General Consultation',
            date: app.appointmentDate || app.date,
            type: 'Treatment Fee',
            amount: appFee
        });

        // Push additional charges associated with this appointment
        let totalBilled = appFee;
        let totalPaid = 0;
        
        payments.forEach(p => {
            if (p.type === 'charge') {
                const amt = parseFloat(p.amount) || 0;
                items.push({
                    name: p.note || 'Treatment Charge',
                    date: p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : new Date(p.createdAt).toLocaleDateString(),
                    type: 'Additional Charge',
                    amount: amt
                });
                totalBilled += amt;
            } else if (p.type === 'payment') {
                totalPaid += parseFloat(p.amount) || 0;
            }
        });

        const balanceDue = Math.max(0, totalBilled - totalPaid);

        // Table Header
        doc.setFillColor(13, 148, 136); // #0D9488
        doc.rect(20, 75, 170, 9, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("Service Description / Procedure", 24, 81);
        doc.text("Date", 105, 81);
        doc.text("Type", 135, 81);
        doc.text("Amount", 186, 81, { align: 'right' });

        // Table Rows
        let startY = 84;
        items.forEach((item, index) => {
            // Row background
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252); // #F8FAFC
            } else {
                doc.setFillColor(255, 255, 255);
            }
            doc.rect(20, startY, 170, 10, 'F');

            // Draw line at the bottom of the row
            doc.setDrawColor(241, 245, 249); // #F1F5F9
            doc.line(20, startY + 10, 190, startY + 10);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            
            // Handle long description text wrapping
            const nameText = item.name.length > 38 ? item.name.substring(0, 35) + '...' : item.name;
            doc.text(nameText, 24, startY + 6);
            doc.text(item.date, 105, startY + 6);
            
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(item.type, 135, startY + 6);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(`INR ${item.amount.toLocaleString()}`, 186, startY + 6, { align: 'right' });

            startY += 10;
        });

        // 6. Summary Box & Status Badge
        const summaryY = startY + 10;

        // Status Badge on the left
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("PAYMENT STATUS", 20, summaryY + 4);

        let statusText = "DUE / UNPAID";
        let badgeColor = [239, 68, 68]; // Red
        if (balanceDue === 0 && totalBilled > 0) {
            statusText = "PAID IN FULL";
            badgeColor = [16, 185, 129]; // Green
        } else if (totalPaid > 0 && balanceDue > 0) {
            statusText = "PARTIALLY PAID";
            badgeColor = [245, 158, 11]; // Amber
        }

        // Draw Badge Background
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.rect(20, summaryY + 7, 45, 8, 'F');

        // Draw Badge Text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(statusText, 42.5, summaryY + 12.5, { align: 'center' });

        // Summary calculations on the right
        doc.setFillColor(248, 250, 252);
        doc.rect(120, summaryY, 70, 30, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(120, summaryY, 70, 30, 'D');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Total Billed:", 124, summaryY + 7);
        doc.text("Total Paid:", 124, summaryY + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`INR ${totalBilled.toLocaleString()}`, 186, summaryY + 7, { align: 'right' });
        
        doc.setTextColor(16, 185, 129); // Green
        doc.text(`INR ${totalPaid.toLocaleString()}`, 186, summaryY + 14, { align: 'right' });

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(124, summaryY + 19, 186, summaryY + 19);

        // Balance Due row
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(balanceDue > 0 ? 239 : 15, balanceDue > 0 ? 68 : 23, balanceDue > 0 ? 68 : 42); // Red if due, slate if 0
        doc.text("Balance Due:", 124, summaryY + 25);
        doc.text(`INR ${balanceDue.toLocaleString()}`, 186, summaryY + 25, { align: 'right' });

        // 7. Clinical Exam Instructions / Note
        const notesY = Math.max(summaryY + 45, 160);
        doc.setFillColor(204, 251, 241); // #CCFBF1 (Primary Light)
        doc.rect(20, notesY, 170, 16, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 118, 110); // Deep Teal
        doc.text("CLINICAL INSTRUCTIONS & POLICIES:", 24, notesY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 118, 110);
        doc.text("1. Please maintain regular dental checkups every 6 months.", 24, notesY + 10.5);
        doc.text("2. In case of emergency or severe discomfort post-treatment, contact the clinic immediately.", 24, notesY + 14);

        // 8. Footer (Stick to bottom)
        const footerY = 285;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(20, footerY - 4, 190, footerY - 4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text("This invoice is digitally compiled and processed. No physical signature is required.", 20, footerY + 1);
        doc.text(`${clinicName}  |  ${subtitle}`, 190, footerY + 1, { align: 'right' });

        // 9. Download the PDF
        const patientName = app.name || 'Anonymous Patient';
        const formattedDate = (app.appointmentDate || app.date || 'Bill').replace(/[\/\s:]/g, '_');
        doc.save(`Invoice_${patientName.replace(/\s+/g, '_')}_${formattedDate}.pdf`);

    } catch (e) {
        console.error("Critical error generating PDF invoice:", e);
        alert("An error occurred while compiling the PDF. Downloading simple copy instead.");
        // Fallback simple download
        try {
            const app = JSON.parse(decodeURIComponent(appJson));
            const patientName = app ? (app.name || 'Anonymous Patient') : 'Anonymous Patient';
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text(`Dental Bill - ${patientName}`, 10, 10);
            doc.text(`Treatment: ${app ? (app.reason || 'General Consultation') : 'General Consultation'}`, 10, 20);
            doc.text(`Fee: INR ${app ? (app.fee || 0) : 0}`, 10, 30);
            doc.save(`Bill_${patientName.replace(/\s+/g, '_')}.pdf`);
        } catch(err) {
            alert("Could not generate PDF at all.");
        }
    }
}

function sendWhatsApp(appJson) {
    const app = JSON.parse(decodeURIComponent(appJson));
    const msg = encodeURIComponent(`Hello ${app.name}, reminder for your visit on ${app.appointmentDate} at ${app.appointmentTime}.`);
    const waNum = formatWhatsAppNumber(app.mobile);
    window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank');
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
    const target = document.getElementById(name+'Tab');
    if (target) {
        target.style.display = 'block';
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    const logsBtn = document.getElementById('securityLogsBtn');
    const fields = document.getElementById('superAdminFields');
    const logoutNav = document.getElementById('logout-nav-item');
    const userStr = sessionStorage.getItem('staffUser');
    const user = userStr ? JSON.parse(userStr) : null;

    if (user && (user.role === 'super_admin' || user.role === 'admin' || user.email === 'abdulqadir.galaxy53@gmail.com')) {
        if (btn) btn.style.display = 'inline-block';
        if (logsBtn) logsBtn.style.display = 'inline-block';
        if (fields) fields.style.display = 'block';
        if (logoutNav) logoutNav.style.display = 'block';
    } else {
        if (btn) btn.style.display = 'none';
        if (logsBtn) logsBtn.style.display = 'none';
        if (fields) fields.style.display = 'none';
        if (logoutNav) logoutNav.style.display = 'none';
    }
}
window.checkSuperAdmin = checkSuperAdmin;

function showBookingModal(appt) {
    const btn = document.getElementById('btnAddToCalendar');
    if (appt && btn) {
        try {
            const dateStr = appt.appointmentDate || appt.date;
            const timeStr = appt.appointmentTime || '09:00 AM';
            
            // Format to YYYYMMDD (remove dashes and slashes)
            const cleanDate = dateStr.replace(/-/g, '').replace(/\//g, '');
            
            // Parse time (e.g., "11:00 AM" or "05:30 PM")
            let hours = 9;
            let minutes = 0;
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (match) {
                hours = parseInt(match[1]);
                minutes = parseInt(match[2]);
                const ampm = match[3];
                if (ampm) {
                    if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
                    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                }
            }
            
            const startHour = hours.toString().padStart(2, '0');
            const startMin = minutes.toString().padStart(2, '0');
            
            // Assume 30 min session
            let endHours = hours;
            let endMinutes = minutes + 30;
            if (endMinutes >= 60) {
                endMinutes -= 60;
                endHours += 1;
            }
            const endHour = endHours.toString().padStart(2, '0');
            const endMin = endMinutes.toString().padStart(2, '0');
            
            const datesParam = `${cleanDate}T${startHour}${startMin}00/${cleanDate}T${endHour}${endMin}00`;
            const title = `Dental Appointment - ${appt.name}`;
            const details = `Patient: ${appt.name}\nConcern/Reason: ${appt.reason || 'General Checkup'}\nPhone: ${appt.mobile}`;
            const location = `My Dental Clinic, ${appt.place || 'Main'}`;
            
            const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${datesParam}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
            
            btn.style.display = 'block';
            btn.onclick = () => {
                window.open(calendarUrl, '_blank');
            };
        } catch (err) {
            console.error('Error generating Google Calendar URL:', err);
            btn.style.display = 'none';
        }
    } else if (btn) {
        btn.style.display = 'none';
    }
    document.getElementById('bookingModal').style.display = 'flex';
}

function quickWhatsApp() {
    if (!currentPatient) return;
    const msg = `Hi ${currentPatient.name}, this is MY DENTAL CLINIC. We are following up regarding your treatment.`;
    const waNum = formatWhatsAppNumber(currentPatient.mobile);
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
}

function sendQuickUpdate(mobile, text) {
    const waNum = formatWhatsAppNumber(mobile);
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(text)}`, '_blank');
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
        email: currentPatient.email || '',
        place: currentPatient.place || '',
        appointmentDate: nextDate,
        appointmentTime: nextTime,
        reason: nextReason,
        fee: 0,
        status: 'Pending'
    };

    const saved = await window.dbAPI.createAppointment(newAppt);
    if (saved) {
        // Refresh local patient data
        const updatedHistory = await window.dbAPI.getPatientHistory(currentPatient.mobile);
        currentPatient.history = updatedHistory;
        renderTimeline(currentPatient.history);
        switchProfileTab('timeline');
        
        // Clear inputs
        document.getElementById('profileNextDate').value = '';
        document.getElementById('profileNextReason').value = '';
        
        // Close profile modal and trigger booking success with Google Calendar button
        closeProfileModal();
        showBookingModal(saved);
        
        // Trigger automated email alert
        sendBookingEmail(saved);
        if (typeof generateTimeSlots === 'function') generateTimeSlots();
        if (typeof refreshDashboard === 'function') refreshDashboard();
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

// --- PWA REGISTRATION & UPDATE FLOW ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
            console.log('💎 Premium Engine: PWA Service Worker Registered');
            
            // Force checking for updates immediately on page load
            reg.update().catch(err => console.log('SW update check bypassed:', err.message));
            
            // Periodically check for updates every 5 minutes in background
            setInterval(() => {
                reg.update().catch(err => console.log('SW periodic update bypassed:', err.message));
            }, 5 * 60 * 1000);

            // Also check for updates when user returns to/focuses the window
            window.addEventListener('focus', () => {
                reg.update().catch(err => console.log('SW focus update bypassed:', err.message));
            });
        }).catch(err => {
            console.warn('SW: Registration failed:', err);
        });
    });

    // Automatically reload once when the service worker changes (new version activated)
    let isRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isRefreshing) {
            isRefreshing = true;
            // Create a toast notification for the update
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--primary);color:white;padding:1rem 2rem;border-radius:30px;box-shadow:0 10px 25px rgba(0,0,0,0.2);z-index:99999;display:flex;align-items:center;gap:1rem;font-weight:800;animation:slideUp 0.3s ease-out;';
            toast.innerHTML = `
                <span><i class="fas fa-sync-alt" style="animation: spin 2s linear infinite;"></i> App Updated!</span>
                <button onclick="window.location.reload(true)" style="background:white;color:var(--primary);border:none;padding:0.5rem 1rem;border-radius:20px;font-weight:bold;cursor:pointer;">Refresh Now</button>
            `;
            document.body.appendChild(toast);
        }
    });
}

// Security Logs Modal logic
async function openSecurityLogsModal() {
    document.getElementById('securityLogsModal').style.display = 'flex';
    const tbody = document.getElementById('securityLogsTableBody');
    tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading logs...</td></tr>';
    
    try {
        const logs = await window.dbAPI.getAdminLoginHistory();
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-muted);">No login history found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = logs.map(log => {
            const date = new Date(log.timestamp).toLocaleString();
            return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: var(--text-main); font-size: 0.85rem;">${date}</td>
                <td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: var(--text-main); font-size: 0.85rem;"><span style="background: #E2E8F0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${log.ipAddress || 'Unknown'}</span></td>
                <td style="padding: 10px; border-bottom: 1px solid #F1F5F9; color: var(--text-main); font-size: 0.85rem;">${log.email}</td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--danger);">Failed to load logs.</td></tr>';
        console.error(err);
    }
}

function closeSecurityLogsModal() {
    document.getElementById('securityLogsModal').style.display = 'none';
}

// --- PATIENT PORTAL PORTLET CONTROLLER ---
let activePatientTab = 'timeline';
let loggedInPatientEmail = null;

async function loginPatientGoogle() {
    try {
        if (!window.dbAPI || !window.dbAPI.auth) {
            alert("Local Mock Mode: Login simulation successful.");
            setupPatientDashboard("guest.patient@gmail.com", "Simulated Patient");
            return;
        }
        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Detect if app is running as standalone PWA
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        if (isStandalone) {
            console.log("PWA Standalone detected. Signing in via redirect...");
            await window.dbAPI.auth.signInWithRedirect(provider);
        } else {
            console.log("Browser detected. Signing in via popup...");
            const result = await window.dbAPI.auth.signInWithPopup(provider);
            const user = result.user;
            if (user) {
                setupPatientDashboard(user.email, user.displayName || 'Patient');
            }
        }
    } catch (err) {
        console.error("Google login error:", err);
        alert("Google Sign-In failed: " + err.message);
    }
}

async function loginPatientEmail(e) {
    e.preventDefault();
    const email = document.getElementById('patientAuthEmail').value.trim();
    if (!email) return;
    setupPatientDashboard(email, 'Patient');
}

async function setupPatientDashboard(email, displayName) {
    loggedInPatientEmail = email;
    document.getElementById('patientWelcomeName').innerText = `Welcome back, ${displayName}`;
    document.getElementById('patientWelcomeEmail').innerText = email;
    
    // Auto fill email field in booking form for convenience
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.value = email;

    // Load data
    await refreshPatientPortalData();

    // Show dashboard, hide auth
    document.getElementById('patientPortalAuth').style.display = 'none';
    document.getElementById('patientPortalDashboard').style.display = 'block';
}

function logoutPatient() {
    loggedInPatientEmail = null;
    document.getElementById('patientPortalDashboard').style.display = 'none';
    document.getElementById('patientPortalAuth').style.display = 'block';
    
    // Clear forms
    document.getElementById('patientAuthEmail').value = '';
}

async function refreshPatientPortalData() {
    if (!loggedInPatientEmail) return;
    
    // 1. Fetch appointments associated with this email
    let appointments = [];
    if (window.dbAPI && window.dbAPI.useFirebase && window.dbAPI.db) {
        try {
            const snap = await window.dbAPI.db.collection('appointments')
                .where('email', '==', loggedInPatientEmail)
                .get();
            appointments = snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Failed to query appointments by email:", e);
        }
    } else {
        const all = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
        appointments = all.filter(a => a.email && a.email.toLowerCase().trim() === loggedInPatientEmail.toLowerCase().trim());
    }

    // Sort by date descending
    appointments.sort((a, b) => b.id - a.id);

    // 2. Render Timeline
    const timelineList = document.getElementById('patientTimelineList');
    if (timelineList) {
        if (!appointments.length) {
            timelineList.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">No clinical appointments found under this email.</p>';
        } else {
            timelineList.innerHTML = appointments.map(a => `
                <div class="timeline-item">
                    <div class="timeline-badge" style="background: ${a.status === 'Completed' ? 'var(--success)' : 'var(--primary)'}"></div>
                    <div class="timeline-panel" style="background: var(--bg-soft); border: 1px solid var(--primary-light);">
                        <div class="timeline-heading">
                            <h4 class="timeline-title" style="color:var(--secondary);">${a.reason}</h4>
                            <p><small class="text-muted"><i class="fas fa-calendar-alt"></i> ${a.appointmentDate} at ${a.appointmentTime || 'N/A'}</small></p>
                        </div>
                        <div class="timeline-body" style="margin-top:0.5rem; font-size:0.85rem;">
                            <span style="font-weight:800; color:var(--text-muted);">Status:</span> 
                            <span style="font-weight:800; color:${a.status === 'Completed' ? 'var(--success)' : 'var(--accent)'}">${a.status}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // 3. Render Diagnoses
    const diagnosesList = document.getElementById('patientDiagnosesList');
    if (diagnosesList) {
        if (!appointments.length) {
            diagnosesList.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">No diagnoses recorded.</p>';
        } else {
            // Get unique mobile numbers from appointments to fetch diagnoses
            const mobiles = [...new Set(appointments.map(a => a.mobile).filter(Boolean))];
            let diagnoses = [];
            
            if (mobiles.length) {
                if (window.dbAPI && window.dbAPI.useFirebase && window.dbAPI.db) {
                    try {
                        const snap = await window.dbAPI.db.collection('diagnoses')
                            .where('mobile', 'in', mobiles)
                            .get();
                        diagnoses = snap.docs.map(doc => doc.data());
                    } catch (e) {
                        console.error("Failed to query diagnoses:", e);
                    }
                } else {
                    const allDiag = JSON.parse(localStorage.getItem('dentalDiagnoses')) || [];
                    diagnoses = allDiag.filter(d => mobiles.includes(d.mobile));
                }
            }

            if (!diagnoses.length) {
                diagnosesList.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">No diagnostic logs available.</p>';
            } else {
                diagnoses.sort((a,b) => b.timestamp - a.timestamp);
                diagnosesList.innerHTML = diagnoses.map(d => `
                    <div class="seating-card" style="margin-top:0; border-left:4px solid var(--primary);">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <h4 style="margin:0; color:var(--secondary);">${d.title}</h4>
                            <span style="font-size:0.7rem; font-weight:800; color:var(--text-muted);">${new Date(d.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p style="margin-top:0.5rem; font-size:0.85rem; line-height:1.5;">${d.notes || 'No notes.'}</p>
                    </div>
                `).join('');
            }
        }
    }

    // 4. Render Finances (Bills list)
    const paymentsList = document.getElementById('patientPaymentsList');
    if (paymentsList) {
        if (!appointments.length) {
            paymentsList.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">No financial records found.</p>';
        } else {
            // Filter completed appointments or appointments with fees
            const billedAppts = appointments.filter(a => parseFloat(a.fee) > 0 || a.status === 'Completed');
            if (!billedAppts.length) {
                paymentsList.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">No bills generated yet.</p>';
            } else {
                paymentsList.innerHTML = `
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:2px solid #E2E8F0; text-align:left; font-size:0.8rem; color:var(--text-muted);">
                                <th style="padding:10px;">Procedure</th>
                                <th style="padding:10px;">Date</th>
                                <th style="padding:10px;">Fee</th>
                                <th style="padding:10px; text-align:right;">Statement</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${billedAppts.map(a => `
                                <tr style="border-bottom:1px solid #F1F5F9; font-size:0.85rem;">
                                    <td style="padding:12px 10px; font-weight:bold; color:var(--secondary);">${a.reason}</td>
                                    <td style="padding:12px 10px;">${a.appointmentDate}</td>
                                    <td style="padding:12px 10px; font-weight:bold;">INR ${parseFloat(a.fee).toLocaleString()}</td>
                                    <td style="padding:12px 10px; text-align:right;">
                                        <button onclick="generateBill('${encodeURIComponent(JSON.stringify(a))}')" class="btn-primary" style="height:32px; font-size:0.75rem; padding:0 0.75rem; width:auto; display:inline-flex; align-items:center; gap:4px; background:var(--accent);">
                                            <i class="fas fa-file-pdf"></i> Receipt
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
    }
}

function switchPatientPortalTab(tabName) {
    activePatientTab = tabName;
    
    // Toggle active buttons
    document.getElementById('pTabBtnTimeline').classList.toggle('active', tabName === 'timeline');
    document.getElementById('pTabBtnDiagnoses').classList.toggle('active', tabName === 'diagnoses');
    document.getElementById('pTabBtnFinances').classList.toggle('active', tabName === 'finances');
    
    // Toggle active containers
    document.getElementById('patientTimelineSection').style.display = tabName === 'timeline' ? 'block' : 'none';
    document.getElementById('patientDiagnosesSection').style.display = tabName === 'diagnoses' ? 'block' : 'none';
    document.getElementById('patientFinancesSection').style.display = tabName === 'finances' ? 'block' : 'none';
}

function changeLanguage(lang) {
    localStorage.setItem('dentalLanguage', lang);
    applyLanguage(lang);
}

function applyLanguage(lang) {
    if (typeof translations === 'undefined' || !translations) return;
    const dict = translations[lang] || translations['en'];
    if (!dict) return;
    
    // Set active select value
    const selector = document.getElementById('langSelect');
    if (selector) selector.value = lang;

    // Update navigation links
    if (document.getElementById('home-nav')) document.getElementById('home-nav').innerText = dict.nav_home;
    if (document.getElementById('features-nav')) document.getElementById('features-nav').innerText = dict.nav_services;
    if (document.getElementById('patient-portal-nav')) document.getElementById('patient-portal-nav').innerText = dict.nav_portal;
    if (document.getElementById('dashboard-nav')) document.getElementById('dashboard-nav').innerText = dict.nav_clinical;
    
    // Booking Form
    const bookingFormLabel = document.querySelector('#home .hero-label');
    if (bookingFormLabel) bookingFormLabel.innerText = dict.sec_schedule;
    const bookingFormTitle = document.querySelector('#home .section-title');
    if (bookingFormTitle) bookingFormTitle.innerText = dict.sec_booking_title;
    const bookingFormSub = document.querySelector('#home p');
    if (bookingFormSub && bookingFormSub.innerText.includes('consultation')) bookingFormSub.innerText = dict.sec_booking_sub;

    const labelName = document.querySelector('label[for="name"]') || document.querySelectorAll('#bookingForm label')[0];
    if (labelName) labelName.innerHTML = `<i class="fas fa-user-circle"></i> ` + dict.lbl_name;
    const inputName = document.getElementById('name');
    if (inputName) inputName.placeholder = dict.placeholder_name;

    const labelEmail = document.querySelector('label[for="email"]') || document.querySelectorAll('#bookingForm label')[1];
    if (labelEmail) labelEmail.innerHTML = `<i class="fas fa-envelope"></i> ` + dict.lbl_email;
    const inputEmail = document.getElementById('email');
    if (inputEmail) inputEmail.placeholder = dict.lbl_email;

    const labelMobile = document.querySelector('label[for="mobile"]') || document.querySelectorAll('#bookingForm label')[2];
    if (labelMobile) labelMobile.innerHTML = `<i class="fab fa-whatsapp"></i> ` + dict.lbl_whatsapp;

    const labelPlace = document.querySelector('label[for="place"]') || document.querySelectorAll('#bookingForm label')[3];
    if (labelPlace) labelPlace.innerHTML = `<i class="fas fa-map-marker-alt"></i> ` + dict.lbl_location;
    const inputPlace = document.getElementById('place');
    if (inputPlace) inputPlace.placeholder = dict.placeholder_location;

    const labelDate = document.querySelector('label[for="appointmentDate"]') || document.querySelectorAll('#bookingForm label')[4];
    if (labelDate) labelDate.innerHTML = `<i class="fas fa-calendar-alt"></i> ` + dict.lbl_date;

    const labelTime = document.querySelector('label[for="appointmentTime"]') || document.querySelectorAll('#bookingForm label')[5];
    if (labelTime) labelTime.innerHTML = `<i class="fas fa-clock"></i> ` + dict.lbl_time;

    const labelReason = document.querySelector('label[for="reason"]') || document.querySelectorAll('#bookingForm label')[6];
    if (labelReason) labelReason.innerHTML = `<i class="fas fa-comment-medical"></i> ` + dict.lbl_reason;
    
    // Update reason placeholder or options if select
    const reasonSelect = document.getElementById('reason');
    if (reasonSelect) {
        if (reasonSelect.options && reasonSelect.options.length >= 7) {
            reasonSelect.options[0].text = dict.reason_select;
            reasonSelect.options[1].text = dict.reason_implant;
            reasonSelect.options[2].text = dict.reason_ortho;
            reasonSelect.options[3].text = dict.reason_rct;
            reasonSelect.options[4].text = dict.reason_cosmetic;
            reasonSelect.options[5].text = dict.reason_cleaning;
            reasonSelect.options[6].text = dict.reason_checkup;
        } else {
            reasonSelect.placeholder = dict.placeholder_reason || "Briefly describe your treatment requirement...";
        }
    }

    const btnSubmit = document.querySelector('#bookingForm button[type="submit"]');
    if (btnSubmit) btnSubmit.innerText = dict.btn_book;

    // Services / Features Section
    const featuresLabel = document.querySelector('#features .hero-label');
    if (featuresLabel) featuresLabel.innerText = dict.sec_expertise;
    const featuresTitle = document.querySelector('#features h2');
    if (featuresTitle) featuresTitle.innerText = dict.sec_services_title;
    const featuresSub = document.querySelector('#features p');
    if (featuresSub && featuresSub.innerText.includes('procedures')) featuresSub.innerText = dict.sec_services_sub;

    const statBoxes = document.querySelectorAll('#features .stat-box');
    if (statBoxes.length >= 6) {
        if (statBoxes[0].querySelector('h3')) statBoxes[0].querySelector('h3').innerText = dict.serv_implant_title;
        if (statBoxes[0].querySelector('p')) statBoxes[0].querySelector('p').innerText = dict.serv_implant_desc;

        if (statBoxes[1].querySelector('h3')) statBoxes[1].querySelector('h3').innerText = dict.serv_ortho_title;
        if (statBoxes[1].querySelector('p')) statBoxes[1].querySelector('p').innerText = dict.serv_ortho_desc;

        if (statBoxes[2].querySelector('h3')) statBoxes[2].querySelector('h3').innerText = dict.serv_endodontics_title;
        if (statBoxes[2].querySelector('p')) statBoxes[2].querySelector('p').innerText = dict.serv_endodontics_desc;

        if (statBoxes[3].querySelector('h3')) statBoxes[3].querySelector('h3').innerText = dict.serv_periodontics_title;
        if (statBoxes[3].querySelector('p')) statBoxes[3].querySelector('p').innerText = dict.serv_periodontics_desc;

        if (statBoxes[4].querySelector('h3')) statBoxes[4].querySelector('h3').innerText = dict.serv_prostho_title;
        if (statBoxes[4].querySelector('p')) statBoxes[4].querySelector('p').innerText = dict.serv_prostho_desc;

        if (statBoxes[5].querySelector('h3')) statBoxes[5].querySelector('h3').innerText = dict.serv_pedodontics_title;
        if (statBoxes[5].querySelector('p')) statBoxes[5].querySelector('p').innerText = dict.serv_pedodontics_desc;
    }

    // Patient Portal
    const portalAuthLabel = document.querySelector('#patient-portal .hero-label');
    if (portalAuthLabel) portalAuthLabel.innerText = dict.portal_access;
    const portalAuthTitle = document.querySelector('#patient-portal h2');
    if (portalAuthTitle && portalAuthTitle.innerText.includes('Portal')) portalAuthTitle.innerText = dict.portal_title;
    const portalAuthSub = document.querySelector('#patient-portal p');
    if (portalAuthSub && portalAuthSub.innerText.includes('billing')) portalAuthSub.innerText = dict.portal_sub;

    const btnGoogle = document.querySelector('#patientPortalAuth button');
    if (btnGoogle) {
        btnGoogle.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google logo" style="width: 20px; height: 20px;"> ` + dict.btn_google;
    }
    const labelRegEmail = document.querySelector('#patientEmailLoginForm label');
    if (labelRegEmail) labelRegEmail.innerHTML = `<i class="fas fa-envelope"></i> ` + dict.lbl_reg_email;
    const inputRegEmail = document.getElementById('patientAuthEmail');
    if (inputRegEmail) inputRegEmail.placeholder = dict.placeholder_email || dict.lbl_reg_email;
    const btnSendOtp = document.querySelector('#patientEmailLoginForm button');
    if (btnSendOtp) btnSendOtp.innerHTML = dict.btn_send_otp + ` <i class="fas fa-arrow-right"></i>`;
    const btnRegAccess = document.querySelector('#patientEmailLoginForm button');
    if (btnRegAccess) btnRegAccess.innerText = dict.btn_access;
    // Patient Dashboard
    const pTabBtnTimeline = document.getElementById('pTabBtnTimeline');
    if (pTabBtnTimeline) pTabBtnTimeline.innerText = dict.tab_history;
    const pTabBtnDiagnoses = document.getElementById('pTabBtnDiagnoses');
    if (pTabBtnDiagnoses) pTabBtnDiagnoses.innerText = dict.tab_diagnoses;
    const pTabBtnFinances = document.getElementById('pTabBtnFinances');
    if (pTabBtnFinances) pTabBtnFinances.innerText = dict.tab_bills;

    const titleTimeline = document.querySelector('#patientTimelineSection h3');
    if (titleTimeline) titleTimeline.innerText = dict.title_history;
    const titleDiagnoses = document.querySelector('#patientDiagnosesSection h3');
    if (titleDiagnoses) titleDiagnoses.innerText = dict.title_diagnoses;
    const titleFinances = document.querySelector('#patientFinancesSection h3');
    if (titleFinances) titleFinances.innerText = dict.title_bills;

    // Login Portal
    const staffAuthLabel = document.querySelector('#loginModal .hero-label');
    if (staffAuthLabel) staffAuthLabel.innerText = dict.staff_auth;
    const staffTitle = document.querySelector('#loginModal h2');
    if (staffTitle) staffTitle.innerText = dict.staff_title;
    
    const labelStaffId = document.querySelectorAll('#loginForm label')[0];
    if (labelStaffId) labelStaffId.innerText = dict.lbl_prod_id;
    const labelStaffPass = document.querySelectorAll('#loginForm label')[1];
    if (labelStaffPass) labelStaffPass.innerText = dict.lbl_password;
    const btnStaffLogin = document.querySelector('#loginForm button');
    if (btnStaffLogin) btnStaffLogin.innerText = dict.btn_login;

    // Clinical Dashboard
    const dashLabel = document.querySelector('#dashboard .hero-label');
    if (dashLabel) dashLabel.innerText = dict.dash_title;
    const dashTitle = document.querySelector('#dashboard h2');
    if (dashTitle && dashTitle.innerText.includes('Control')) dashTitle.innerText = dict.dash_title;
    const dashSub = document.querySelector('#dashboard p');
    if (dashSub && dashSub.innerText.includes('diagnostics')) dashSub.innerText = dict.dash_sub;

    const dashTabs = document.querySelectorAll('#dashboard .profile-tab-btn');
    if (dashTabs.length >= 3) {
        dashTabs[0].innerText = dict.tab_patients;
        dashTabs[1].innerText = dict.tab_qr;
        dashTabs[2].innerText = dict.tab_broadcast;
    }

    const statLabels = document.querySelectorAll('#dashboard .stat-box span:first-child');
    if (statLabels.length >= 3) {
        statLabels[0].innerText = dict.dash_total_patients;
        statLabels[1].innerText = dict.dash_earnings;
        statLabels[2].innerText = dict.dash_visits;
    }

    const inputSearch = document.getElementById('searchInput');
    if (inputSearch) inputSearch.placeholder = dict.placeholder_search;

    // Tour Carousel Header
    const tourContainer = document.getElementById('portal-tour');
    if (tourContainer) {
        const tourLabel = tourContainer.querySelector('.hero-label');
        if (tourLabel) tourLabel.innerText = dict.tour_label;
        const tourTitle = tourContainer.querySelector('h2');
        if (tourTitle) tourTitle.innerText = dict.tour_title;
        const tourSub = tourContainer.querySelector('p');
        if (tourSub) tourSub.innerText = dict.tour_sub;
    }

    // Google Calendar button translation
    const btnCalendar = document.getElementById('btnAddToCalendar');
    if (btnCalendar) {
        btnCalendar.innerHTML = `<i class="fab fa-google"></i> ` + (dict.btn_add_calendar || "ADD TO GOOGLE CALENDAR");
    }
}

// Multi-Tenant Functions
function openManageClinicsModal() {
    document.getElementById('manageClinicsModal').style.display = 'block';
    loadTenantsList();
}

function closeManageClinicsModal() {
    document.getElementById('manageClinicsModal').style.display = 'none';
}

async function loadTenantsList() {
    const list = document.getElementById('clinicsList');
    list.innerHTML = 'Loading clinics...';
    try {
        const snapshot = await window.dbAPI.db.collection('tenants').get();
        if (snapshot.empty) {
            list.innerHTML = '<p>No clinics found (other than default if not initialized).</p>';
            return;
        }

        // Auto-migrate existing clinics to have default [slug]admin users
        snapshot.forEach(doc => {
            const id = doc.id;
            const data = doc.data();
            if (id !== 'default') {
                const adminId = id + 'admin';
                window.dbAPI.db.collection('tenants').doc(id).collection('staff').doc(adminId).set({
                    name: (data.name || id) + ' Admin',
                    email: adminId,
                    password: 'admin',
                    role: 'admin'
                }, { merge: true }).catch(e => console.error(e));
            }
        });

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `<div style="padding: 1rem; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${data.name || doc.id}</strong>
                    <div style="font-size:0.8rem; color:#64748B;">Slug: ${doc.id}</div>
                </div>
                <a href="/?c=${doc.id}" target="_blank" class="btn-primary" style="padding:0.25rem 0.5rem; font-size:0.8rem;">Visit</a>
            </div>`;
        });
        list.innerHTML = html;
        
        // Populate switcher
        const switcher = document.getElementById('tenantSwitcher');
        let options = '<option value="default">Default Clinic</option>';
        snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id !== 'default') {
                options += `<option value="${doc.id}">${data.name || doc.id}</option>`;
            }
        });
        switcher.innerHTML = options;
        switcher.value = window.dbAPI.tenantId;

    } catch (e) {
        list.innerHTML = 'Error loading clinics: ' + e.message;
    }
}

document.getElementById('addClinicForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const slug = document.getElementById('newClinicSlug').value.toLowerCase().trim();
    const name = document.getElementById('newClinicName').value.trim();
    
    if(!slug) return alert('Slug is required');
    
    try {
        const db = window.dbAPI.db;
        await db.collection('tenants').doc(slug).set({
            name: name,
            createdAt: new Date().toISOString()
        });
        
        // Auto-create default admin staff user for this clinic
        await db.collection('tenants').doc(slug).collection('staff').doc(slug + 'admin').set({
            name: name + ' Admin',
            email: slug + 'admin', // using slug+admin as username
            password: 'admin',
            role: 'admin'
        });

        // Initialize clinic settings
        await db.collection('tenants').doc(slug).collection('settings').doc('clinic').set({
            clinic_name: name,
            contact_number: '',
            clinic_address: '',
            primary_color: '#10B981'
        });

        alert('Clinic created successfully!');
        document.getElementById('addClinicForm').reset();
        loadTenantsList();
    } catch(err) {
        alert('Error creating clinic: ' + err.message);
    }
});

function switchTenant(tenantId) {
    if (tenantId) {
        window.location.href = '/?c=' + tenantId;
    }
}

// Add SuperAdmin check on load (Only superadmin/admin53 gets super admin privileges)
function checkSuperAdminUI() {
    let isSuper = false;
    try {
        const isSuperFlag = sessionStorage.getItem('isSuperAdmin');
        const userStr = sessionStorage.getItem('staffUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.role === 'super_admin') {
                isSuper = true;
            }
        }
        if (isSuperFlag === 'true') {
            isSuper = true;
        }
    } catch (e) {
        console.error('Error checking super admin:', e);
    }

    const btn = document.getElementById('manageClinicsBtn');
    const switcher = document.getElementById('tenantSwitcher');

    if (isSuper) {
        if (btn) btn.style.display = 'inline-flex';
        if (switcher) switcher.style.display = 'inline-block';
        if (window.dbAPI && window.dbAPI.db) {
            loadTenantsList().catch(console.error);
        }
    } else {
        if (btn) btn.style.display = 'none';
        if (switcher) switcher.style.display = 'none';
    }
}

// Call on load
checkSuperAdminUI();


// --- STAFF MANAGEMENT LOGIC ---

async function loadStaffList() {
    if (!window.dbAPI || !window.dbAPI.db) return;
    const table = document.getElementById('staffListTable');
    if (!table) return;
    
    table.innerHTML = '<tr><td colspan="4" style="padding:1rem 0;">Loading...</td></tr>';
    try {
        const staff = await window.dbAPI.getStaffList();
        if (staff.length === 0) {
            table.innerHTML = '<tr><td colspan="4" style="padding:1rem 0; color:#64748B;">No staff found.</td></tr>';
            return;
        }
        
        let html = '';
        staff.forEach(s => {
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:0.75rem 0; font-weight:600;">${s.name}</td>
                <td style="padding:0.75rem 0;">${s.email}</td>
                <td style="padding:0.75rem 0;"><span style="background:${s.role === 'admin' ? '#dbeafe' : '#f1f5f9'}; color:${s.role === 'admin' ? '#2563eb' : '#475569'}; padding:0.25rem 0.5rem; border-radius:12px; font-size:0.75rem; font-weight:bold;">${s.role.toUpperCase()}</span></td>
                <td style="padding:0.75rem 0;">
                    <button onclick="deleteStaff('${s.email}')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        table.innerHTML = html;
    } catch (e) {
        table.innerHTML = `<tr><td colspan="4" style="padding:1rem 0; color:red;">Error: ${e.message}</td></tr>`;
    }
}

document.getElementById('addStaffForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.dbAPI || !window.dbAPI.db) return alert('Offline mode');
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Creating...';
    btn.disabled = true;
    
    try {
        await window.dbAPI.addStaff({
            name: document.getElementById('newStaffName').value.trim(),
            email: document.getElementById('newStaffEmail').value.trim().toLowerCase(),
            password: document.getElementById('newStaffPassword').value,
            role: document.getElementById('newStaffRole').value
        });
        alert('Staff account created successfully!');
        e.target.reset();
        loadStaffList();
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

async function deleteStaff(email) {
    if (!confirm('Are you sure you want to delete this staff account?')) return;
    try {
        await window.dbAPI.deleteStaff(email);
        loadStaffList();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function enforceRoleRestrictions() {
    try {
        const userStr = sessionStorage.getItem('staffUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            const isStaff = user.role === 'staff';
            
            // Hide earnings
            const earningsCard = document.getElementById('stats-earnings');
            if (earningsCard) {
                if (isStaff) {
                    earningsCard.style.display = 'none';
                } else {
                    earningsCard.style.display = 'block'; // Or however it was originally displayed, assume block/flex handled by css, just removing inline none if it exists. Actually it's better to just hide if staff.
                }
            }
            
            // Hide settings tab button
            const settingsTabBtns = document.querySelectorAll('button[onclick="showDashboardTab(\'settings\')"]');
            settingsTabBtns.forEach(btn => {
                if (isStaff) btn.style.display = 'none';
            });

            // Prevent viewing Settings tab explicitly
            if (isStaff && document.getElementById('tab-settings')?.style.display !== 'none') {
                showDashboardTab('patients');
            }
        }
    } catch(e) {}
}

// Call restrictions after loading dashboard
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(enforceRoleRestrictions, 500);
});


async function deleteClinic(slug) {
    if (slug === 'default') return alert('Cannot delete the default clinic.');
    
    const confirmDelete = confirm('Are you sure you want to permanently delete the clinic "' + slug + '"? This will remove it from your management list.');
    if (!confirmDelete) return;
    
    try {
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = 'Deleting...';
        btn.disabled = true;
        
        await window.dbAPI.db.collection('tenants').doc(slug).delete();
        alert('Clinic deleted successfully.');
        loadTenantsList();
        
    } catch (e) {
        console.error(e);
        alert('Error deleting clinic: ' + e.message);
    }
}


// --- APPOINTMENT BOOKED HISTORY & CALENDAR MODULE ---
let currentScheduleDate = new Date().toISOString().split('T')[0];

function setScheduleDay(dayType) {
    const today = new Date();
    if (dayType === 'today') {
        currentScheduleDate = today.toISOString().split('T')[0];
    } else if (dayType === 'yesterday') {
        const y = new Date();
        y.setDate(today.getDate() - 1);
        currentScheduleDate = y.toISOString().split('T')[0];
    } else if (dayType === 'tomorrow') {
        const t = new Date();
        t.setDate(today.getDate() + 1);
        currentScheduleDate = t.toISOString().split('T')[0];
    } else if (typeof dayType === 'string' && dayType.trim()) {
        currentScheduleDate = dayType.trim();
    }
    renderScheduleCalendar(currentScheduleDate);
}

function changeScheduleDay(delta) {
    if (!currentScheduleDate) {
        currentScheduleDate = new Date().toISOString().split('T')[0];
    }
    const d = new Date(currentScheduleDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    currentScheduleDate = d.toISOString().split('T')[0];
    renderScheduleCalendar(currentScheduleDate);
}

function isDateMatching(rawDate, targetDateStr) {
    if (!rawDate || !targetDateStr) return false;
    const s = rawDate.toString().trim();
    if (s === targetDateStr) return true;
    try {
        const parts = targetDateStr.split('-');
        if (parts.length === 3) {
            const y = parts[0];
            const pm = parts[1].padStart(2, '0');
            const m = parseInt(parts[1]).toString();
            const pd = parts[2].padStart(2, '0');
            const d = parseInt(parts[2]).toString();
            const vars = [
                targetDateStr,
                `${d}/${pm}/${y}`,
                `${pd}/${pm}/${y}`,
                `${m}/${d}/${y}`,
                `${pm}/${pd}/${y}`,
                `${d}-${pm}-${y}`,
                `${pd}-${pm}-${y}`
            ];
            if (vars.includes(s)) return true;
        }
        const d1 = new Date(s);
        const d2 = new Date(targetDateStr);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            return d1.getFullYear() === d2.getFullYear() &&
                   d1.getMonth() === d2.getMonth() &&
                   d1.getDate() === d2.getDate();
        }
    } catch (e) {}
    return false;
}

async function renderScheduleCalendar(targetDate) {
    const list = document.getElementById('scheduleAppointmentsList');
    const datePicker = document.getElementById('calendarScheduleDate');
    const titleEl = document.getElementById('scheduleDayTitle');
    const subtitleEl = document.getElementById('scheduleDaySubtitle');
    const countEl = document.getElementById('scheduleCount');
    const pendingEl = document.getElementById('schedulePendingCount');
    const confirmedEl = document.getElementById('scheduleConfirmedCount');

    if (!list) return;

    if (!targetDate) {
        targetDate = currentScheduleDate || new Date().toISOString().split('T')[0];
    }
    currentScheduleDate = targetDate;
    if (datePicker) datePicker.value = targetDate;

    // Determine Day Label
    const todayStr = new Date().toISOString().split('T')[0];
    const yDate = new Date(); yDate.setDate(new Date().getDate() - 1);
    const yStr = yDate.toISOString().split('T')[0];
    const tDate = new Date(); tDate.setDate(new Date().getDate() + 1);
    const tStr = tDate.toISOString().split('T')[0];

    const dObj = new Date(targetDate + 'T00:00:00');
    const formattedDate = dObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

    let relativeBadge = '';
    if (targetDate === todayStr) relativeBadge = '<span style="background:var(--primary); color:white; padding:2px 8px; border-radius:99px; font-size:0.75rem; margin-right:6px;">TODAY</span>';
    else if (targetDate === yStr) relativeBadge = '<span style="background:#64748B; color:white; padding:2px 8px; border-radius:99px; font-size:0.75rem; margin-right:6px;">YESTERDAY</span>';
    else if (targetDate === tStr) relativeBadge = '<span style="background:#0284C7; color:white; padding:2px 8px; border-radius:99px; font-size:0.75rem; margin-right:6px;">TOMORROW</span>';

    if (titleEl) {
        titleEl.innerHTML = relativeBadge + formattedDate;
    }
    if (subtitleEl) {
        subtitleEl.innerText = `Clinical appointments for ${targetDate}`;
    }

    list.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading schedule...</div>';

    let appointments = [];
    try {
        if (window.dbAPI && typeof window.dbAPI.getAppointments === 'function') {
            appointments = await window.dbAPI.getAppointments();
        }
    } catch(err) {
        console.error('Error fetching appointments for schedule calendar:', err);
    }

    // Filter appointments for the target date using isDateMatching
    const dayAppointments = appointments.filter(a => {
        const appDate = a.appointmentDate || a.date || '';
        return isDateMatching(appDate, targetDate);
    });

    // Sort by appointment time slot
    dayAppointments.sort((a, b) => {
        const minA = parseTimeToMinutes(a.appointmentTime) || 9999;
        const minB = parseTimeToMinutes(b.appointmentTime) || 9999;
        return minA - minB;
    });

    // Update summary counters
    const totalCount = dayAppointments.length;
    const pendingCount = dayAppointments.filter(a => (a.status || 'Pending').toLowerCase() === 'pending').length;
    const confirmedCount = totalCount - pendingCount;

    if (countEl) countEl.innerText = totalCount;
    if (pendingEl) pendingEl.innerText = pendingCount;
    if (confirmedEl) confirmedEl.innerText = confirmedCount;

    if (dayAppointments.length === 0) {
        list.innerHTML = `
            <div style="background: white; border-radius: 14px; padding: 3rem 1.5rem; text-align: center; border: 1px dashed #CBD5E1;">
                <div style="font-size: 2.5rem; color: #94A3B8; margin-bottom: 0.75rem;"><i class="fas fa-calendar-times"></i></div>
                <h4 style="font-weight: 800; color: var(--secondary); margin-bottom: 0.25rem;">No Appointments Booked</h4>
                <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 400px; margin: 0 auto 1.25rem;">There are no clinical appointments recorded for ${formattedDate}.</p>
                <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                    <button onclick="setScheduleDay('today')" class="btn-primary" style="font-size: 0.85rem; padding: 0.5rem 1rem;"><i class="fas fa-calendar-day"></i> View Today</button>
                    <button onclick="showSection('home')" class="btn-primary" style="background: white; color: var(--secondary); border: 1px solid #CBD5E1; font-size: 0.85rem; padding: 0.5rem 1rem;"><i class="fas fa-plus-circle"></i> New Appointment</button>
                </div>
            </div>
        `;
        return;
    }

    list.innerHTML = dayAppointments.map(a => {
        const initials = (a.name || 'P').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
        const timeDisplay = a.appointmentTime || 'Time TBD';
        const status = a.status || 'Pending';
        const isPending = status === 'Pending';
        const isCompleted = status === 'Completed';
        const isCancelled = status === 'Cancelled';
        const isConfirmed = status === 'Confirmed';

        let badgeBg = '#FEF9C3';
        let badgeColor = '#CA8A04';
        if (isCompleted) { badgeBg = '#E0E7FF'; badgeColor = '#4338CA'; }
        else if (isConfirmed) { badgeBg = '#DCFCE7'; badgeColor = '#16A34A'; }
        else if (isCancelled) { badgeBg = '#FEE2E2'; badgeColor = '#DC2626'; }

        const safeAppJson = encodeURIComponent(JSON.stringify(a));

        return `
            <div style="background: white; border-radius: 14px; padding: 1.25rem 1.5rem; border: 1px solid #E2E8F0; box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem; min-width: 250px;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #0D9488, #0891B2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 0.95rem; flex-shrink: 0;">${initials}</div>
                    <div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: var(--secondary); cursor: pointer;" onclick="document.getElementById('searchInput').value='${a.mobile}'; showDashboardTab('patients'); filterPatients();">
                            ${a.name} <i class="fas fa-external-link-alt" style="font-size: 0.75rem; color: var(--primary); margin-left: 4px;"></i>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem; margin-top: 2px;">
                            <span><i class="fas fa-phone-alt" style="font-size: 0.7rem;"></i> ${a.mobile || 'No Mobile'}</span>
                            ${a.place ? `<span>· <i class="fas fa-map-marker-alt" style="font-size: 0.7rem;"></i> ${a.place}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <!-- Time Slot Badge -->
                    <div style="background: var(--bg-soft); border: 1px solid #E2E8F0; padding: 0.4rem 0.85rem; border-radius: 99px; font-weight: 800; font-size: 0.85rem; color: var(--secondary); display: flex; align-items: center; gap: 0.4rem;">
                        <i class="fas fa-clock" style="color: var(--primary);"></i> ${timeDisplay}
                    </div>

                    <!-- Clinical Reason -->
                    <div style="background: #F1F5F9; padding: 0.4rem 0.85rem; border-radius: 99px; font-size: 0.8rem; color: #475569; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.reason || 'Consultation'}">
                        <i class="fas fa-notes-medical" style="color: #64748B;"></i> ${a.reason || 'Consultation'}
                    </div>

                    <!-- Status Selector -->
                    <select onchange="updateAppointmentStatusFromCalendar(${a.id}, this.value)" style="height: 36px; padding: 0 0.75rem; border-radius: 99px; font-size: 0.8rem; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; cursor: pointer;">
                        <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>🟡 Pending</option>
                        <option value="Confirmed" ${status === 'Confirmed' ? 'selected' : ''}>🟢 Confirmed</option>
                        <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>🔵 Completed</option>
                        <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>🔴 Cancelled</option>
                    </select>

                    <!-- Quick Action Buttons -->
                    <div style="display: flex; gap: 0.35rem;">
                        <button onclick="sendQuickUpdate('${a.mobile}', 'Hello ${a.name}, reminder for your appointment at MY DENTAL CLINIC on ${targetDate} at ${timeDisplay}.')" class="btn-primary" style="background: #25D366; width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: 8px;" title="WhatsApp Reminder">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                        <button onclick="generateBill('${safeAppJson}')" class="btn-primary" style="background: #0284C7; width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: 8px;" title="Print / Download Invoice">
                            <i class="fas fa-file-invoice"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function updateAppointmentStatusFromCalendar(id, newStatus) {
    if (window.dbAPI && typeof window.dbAPI.updateAppointment === 'function') {
        await window.dbAPI.updateAppointment(id, { status: newStatus });
    }
    renderScheduleCalendar(currentScheduleDate);
    refreshDashboard();
}
