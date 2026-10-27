
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

        // Check for SuperAdmin direct URL navigation (?login=superadmin or ?superadmin=true)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('login') === 'superadmin' || urlParams.get('superadmin') === 'true' || urlParams.get('superadmin') === '1') {
            window.location.href = 'superadmin.html';
            return;
        }

        // Handle OAuth Redirect Result for PWA and Mobile logins
        if (window.dbAPI && window.dbAPI.auth) {
            window.dbAPI.auth.getRedirectResult().then(async (result) => {
                if (result && result.user) {
                    const rUser = result.user;
                    console.log("OAuth redirect login successful:", rUser.email);
                    
                    // If login was initiated from Doctor/Staff login modal:
                    const pendingType = sessionStorage.getItem('pendingStaffLoginType');
                    if (pendingType === 'doctor') {
                        sessionStorage.removeItem('pendingStaffLoginType');
                        if (typeof loginStaffAsDoctor === 'function') {
                            loginStaffAsDoctor(rUser);
                            return;
                        }
                    }

                    const tenantId = (window.dbAPI && window.dbAPI.tenantId) ? window.dbAPI.tenantId : 'default';
                    localStorage.setItem('tenant_access_verified_' + tenantId, 'true');
                    
                    if (typeof window.dbAPI.recordGoogleVisitor === 'function') {
                        await window.dbAPI.recordGoogleVisitor(rUser);
                    }
                    if (typeof setupLoggedInPatient === 'function') {
                        await setupLoggedInPatient(rUser);
                    }
                    if (typeof dispatchPatientWelcomeEmail === 'function' && rUser.email) {
                        dispatchPatientWelcomeEmail(rUser, window.currentClinicSettings);
                    }
                    const gateModal = document.getElementById('firstTimeAccessGateModal');
                    if (gateModal) gateModal.style.display = 'none';
                    if (typeof setupPatientDashboard === 'function') {
                        setupPatientDashboard(rUser.email, rUser.displayName || 'Patient');
                    }
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
        allTxns = window.dbAPI ? window.dbAPI.getLocalData('dentalPayments', []) : (JSON.parse(localStorage.getItem('dentalPayments')) || []);
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
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 0.7rem; padding: 4px 8px; border-radius: 99px; font-weight: 800; ${a.status==='Pending' ? 'background: #FEF9C3; color: #CA8A04;' : (a.status==='Cancelled' ? 'background: #FEE2E2; color: #DC2626;' : 'background: #DCFCE7; color: #16A34A;')}">${a.status || 'Confirmed'}</span>
                    ${a.status !== 'Cancelled' ? `<button type="button" onclick="event.stopPropagation(); staffCancelAppointment('${a.id}')" style="background: none; border: none; color: #DC2626; cursor: pointer; padding: 4px; font-size: 0.85rem;" title="Cancel Appointment"><i class="fas fa-times-circle"></i></button>` : ''}
                </div>
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
        
        const patientAlerts = p.medicalAlerts || (p.history && p.history.find(h => h.medicalAlerts && h.medicalAlerts.length)?.medicalAlerts) || [];
        card.innerHTML = `
            <div class="patient-name">${p.name}</div>
            <div class="patient-meta">
                <span><i class="fas fa-phone-alt"></i> ${p.mobile}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${p.place || 'Local'}</span>
            </div>
            ${patientAlerts.length > 0 ? `
                <div style="margin: 0.35rem 0 0.5rem; display: flex; flex-wrap: wrap; gap: 4px;">
                    ${patientAlerts.map(al => `<span class="medical-alert-tag alert-tag-danger" style="font-size: 0.68rem; padding: 1px 6px;"><i class="fas fa-exclamation-triangle"></i> ${al}</span>`).join('')}
                </div>
            ` : ''}
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
        if (typeof renderPatientMedicalAlerts === 'function') await renderPatientMedicalAlerts(patient.mobile);
        document.body.classList.add('profile-modal-open');
        modal.style.display = 'flex';
    }
}

function switchProfileTab(tab) {
    const timeline = document.getElementById('profileTimelineSection');
    const diagnoses = document.getElementById('profileDiagnosisSection');
    const finances = document.getElementById('profileFinanceSection');
    const booking = document.getElementById('profileBookingSection');
    const charting = document.getElementById('profileChartingSection');
    const rx = document.getElementById('profilePrescriptionsSection');
    const plans = document.getElementById('profileTreatmentPlansSection');
    
    if (timeline) timeline.style.display = tab === 'timeline' ? 'block' : 'none';
    if (diagnoses) diagnoses.style.display = tab === 'diagnoses' ? 'block' : 'none';
    if (finances) finances.style.display = tab === 'finances' ? 'block' : 'none';
    if (booking) booking.style.display = tab === 'next-seating' ? 'block' : 'none';
    if (charting) charting.style.display = tab === 'charting' ? 'block' : 'none';
    if (rx) rx.style.display = tab === 'prescriptions' ? 'block' : 'none';
    if (plans) plans.style.display = tab === 'treatment-plans' ? 'block' : 'none';
    
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        const text = (btn.innerText || btn.textContent || '').toLowerCase();
        if (tab === 'timeline') btn.classList.toggle('active', text.includes('history') || text.includes('clinical'));
        if (tab === 'diagnoses') btn.classList.toggle('active', text.includes('diagnosis') || text.includes('diagnostic'));
        if (tab === 'finances') btn.classList.toggle('active', text.includes('financial') || text.includes('finances') || text.includes('finance'));
        if (tab === 'next-seating') btn.classList.toggle('active', text.includes('seating') || text.includes('next visit'));
        if (tab === 'charting') btn.classList.toggle('active', text.includes('charting') || text.includes('consent'));
        if (tab === 'prescriptions') btn.classList.toggle('active', text.includes('prescription') || text.includes('rx'));
        if (tab === 'treatment-plans') btn.classList.toggle('active', text.includes('treatment plan') || text.includes('plan'));
    });

    const pat = (typeof currentPatient !== 'undefined' && currentPatient) ? currentPatient : (window.currentPatient || null);
    if (pat && pat.mobile) {
        if (tab === 'diagnoses' && typeof renderDiagnoses === 'function') renderDiagnoses(pat.mobile);
        if (tab === 'prescriptions' && typeof loadPatientPrescriptions === 'function') loadPatientPrescriptions(pat.mobile);
        if (tab === 'treatment-plans' && typeof loadPatientTreatmentPlans === 'function') loadPatientTreatmentPlans(pat.mobile);
    }
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
        mobile: activePatient.mobile,
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; gap: 0.5rem; flex-wrap: wrap;">
                    <select class="status-select" onchange="updateStatus('${appt.id}', this.value)" style="margin: 0;">
                        <option value="Pending" ${appt.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Completed" ${appt.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${appt.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                    ${appt.status !== 'Cancelled' ? `
                        <button type="button" onclick="staffCancelAppointment('${appt.id}')" class="btn-cancel-appt" style="padding: 4px 8px; height: 30px;" title="Cancel this appointment">
                            <i class="fas fa-times-circle"></i> Cancel
                        </button>
                    ` : '<span style="color: #DC2626; font-size: 0.75rem; font-weight: 800;"><i class="fas fa-ban"></i> Cancelled</span>'}
                </div>
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
        const local = window.dbAPI ? window.dbAPI.getLocalData('dentalPayments', []) : (JSON.parse(localStorage.getItem('dentalPayments')) || []);
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
                clinicName: window.currentClinicSettings?.clinic_name || 'My Dental Clinic'
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

    const selectedAlerts = Array.from(document.querySelectorAll('input[name="medicalAlert"]:checked')).map(cb => cb.value);
    const medNotes = document.getElementById('medicalNotes')?.value?.trim() || '';

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
        medicalAlerts: selectedAlerts,
        medicalNotes: medNotes,
        fee: 0,
        status: 'Pending'
    };
    
    const savedAppt = await window.dbAPI.createAppointment(appt);
    
    if ((selectedAlerts.length > 0 || medNotes) && window.dbAPI && typeof window.dbAPI.savePatientMedicalAlerts === 'function') {
        try {
            await window.dbAPI.savePatientMedicalAlerts(appt.mobile, selectedAlerts, medNotes);
        } catch (e) {
            console.warn('Failed to save medical alerts during booking:', e);
        }
    }

    // Send email alert immediately using serverless endpoint
    sendBookingEmail(savedAppt || appt);

    alert('Appointment Booked!');
    bookingForm.reset();
    
    // Clear medical intake inputs
    document.querySelectorAll('input[name="medicalAlert"]').forEach(cb => cb.checked = false);
    const medNotesInput = document.getElementById('medicalNotes');
    if (medNotesInput) medNotesInput.value = '';

    // Retain booked date so user immediately sees the slot marked as (Booked)
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
        dateInput.value = dateVal || new Date().toISOString().split('T')[0];
    }
    // Immediately regenerate slots to show updated booked status
    await generateTimeSlots();
    if (typeof refreshDashboard === 'function') refreshDashboard();

    showBookingModal(savedAppt || appt);
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
    if (name === 'settings') {
        populateSettingsForm();
    }
}

function initQRCode() {
    const container = document.getElementById("qrcode");
    if (container) { container.innerHTML = ""; new QRCode(container, { text: window.location.origin, width: 256, height: 256 }); }
}

function logout() { sessionStorage.clear(); window.location.reload(); }
function closeProfileModal() { document.body.classList.remove('profile-modal-open'); document.getElementById('patientProfileModal').style.display = 'none'; refreshDashboard(); }
function closeBookingModal() { document.getElementById('bookingModal').style.display = 'none'; }

// --- COLOR UTILITIES & TENANT THEME ENGINE ---
function hexToRgb(hex) {
    if (!hex) return { r: 13, g: 148, b: 136 };
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return { r: 13, g: 148, b: 136 };
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function rgbToHex(r, g, b) {
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function adjustColorBrightness(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    if (percent < 0) {
        const factor = 1 + percent;
        return rgbToHex(r * factor, g * factor, b * factor);
    } else {
        return rgbToHex(r + (255 - r) * percent, g + (255 - g) * percent, b + (255 - b) * percent);
    }
}

function applyTenantTheme(colorHex) {
    if (!colorHex || typeof colorHex !== 'string') return;
    let hex = colorHex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(hex)) return;

    const primary = hex.length === 4 ? '#' + hex.slice(1).split('').map(c => c+c).join('') : hex.slice(0, 7);
    const primaryDark = adjustColorBrightness(primary, -0.22);
    const primaryLight = adjustColorBrightness(primary, 0.88);
    const { r, g, b } = hexToRgb(primary);

    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-dark', primaryDark);
    document.documentElement.style.setProperty('--primary-light', primaryLight);
    document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);

    // Update meta theme-color for browser address/status bar
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', primary);

    // Update preview swatch in settings form if present
    const swatch = document.getElementById('settingThemePreviewSwatch');
    if (swatch) swatch.style.background = primary;
}

// --- DYNAMIC TENANT PWA ENGINE ---
function updateTenantPWA(settings) {
    try {
        const tenantId = (window.dbAPI && window.dbAPI.tenantId) ? window.dbAPI.tenantId : 'default';
        const isDefault = !tenantId || tenantId === 'default';
        const clinicName = (settings && (settings.clinic_name || settings.name)) ? (settings.clinic_name || settings.name) : 'My Dental Clinic';
        const subtitle = (settings && settings.subtitle) ? settings.subtitle : 'Dental & Cosmetic Clinic';
        const primaryColor = (settings && (settings.primary_color || settings.primaryColor)) ? (settings.primary_color || settings.primaryColor) : '#0D9488';
        
        let startUrl = isDefault ? '/' : `/${tenantId}`;
        if (window.location.protocol === 'file:') {
            startUrl = isDefault ? 'index.html' : `index.html?c=${tenantId}`;
        }

        const manifestData = {
            name: clinicName,
            short_name: clinicName.length > 18 ? clinicName.substring(0, 16) + '..' : clinicName,
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
                    src: "/app-icon.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any maskable"
                }
            ]
        };

        const manifestBlob = new Blob([JSON.stringify(manifestData, null, 2)], { type: 'application/manifest+json' });
        const manifestURL = URL.createObjectURL(manifestBlob);

        let manifestTag = document.querySelector('link[rel="manifest"]');
        if (!manifestTag) {
            manifestTag = document.createElement('link');
            manifestTag.rel = 'manifest';
            document.head.appendChild(manifestTag);
        }
        manifestTag.setAttribute('href', manifestURL);

        // Apple PWA metadata
        let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (!appleTitle) {
            appleTitle = document.createElement('meta');
            appleTitle.name = 'apple-mobile-web-app-title';
            document.head.appendChild(appleTitle);
        }
        appleTitle.setAttribute('content', clinicName);

        console.log(`📱 PWA Manifest dynamically configured: ${clinicName} (${tenantId}) -> ${startUrl}`);
    } catch (e) {
        console.warn('Tenant PWA adaptation note:', e);
    }
}

// Live interactive theme functions for doctor settings form
function updateThemeFromPicker(hex) {
    const input = document.getElementById('settingPrimaryColor');
    if (input) input.value = hex;
    applyTenantTheme(hex);
}

function updateThemeFromInput(hex) {
    const picker = document.getElementById('settingPrimaryColorPicker');
    if (picker && /^#[0-9A-Fa-f]{6}$/.test(hex)) picker.value = hex;
    applyTenantTheme(hex);
}

function selectThemePreset(hex, name) {
    const picker = document.getElementById('settingPrimaryColorPicker');
    const input = document.getElementById('settingPrimaryColor');
    if (picker) picker.value = hex;
    if (input) input.value = hex;
    applyTenantTheme(hex);
}

function populateSettingsForm(settings) {
    if (!settings) settings = window.currentClinicSettings || {};
    const nameInput = document.getElementById('settingClinicName');
    const subInput = document.getElementById('settingSubtitle');
    const docInput = document.getElementById('settingDoctorName');
    const colorPicker = document.getElementById('settingPrimaryColorPicker');
    const colorHex = document.getElementById('settingPrimaryColor');
    const userInput = document.getElementById('settingAdminUser');
    const passInput = document.getElementById('settingAdminPass');
    const swatch = document.getElementById('settingThemePreviewSwatch');

    const color = settings.primary_color || settings.primaryColor || '#0D9488';

    const gateEnabledInput = document.getElementById('settingAccessGateEnabled');
    const pinInput = document.getElementById('settingAccessPin');
    if (gateEnabledInput) gateEnabledInput.checked = (settings.access_gate_enabled !== false);
    if (pinInput) pinInput.value = settings.access_pin || '1234';

    if (nameInput) nameInput.value = settings.clinic_name || settings.name || "";
    if (subInput) subInput.value = settings.subtitle || "";
    if (docInput) docInput.value = settings.doctor_name || settings.subtitle || "";
    if (colorHex) colorHex.value = color;
    if (colorPicker) colorPicker.value = color;
    if (swatch) swatch.style.background = color;
    if (userInput) userInput.value = settings.admin_user || "";
    if (passInput) passInput.value = settings.admin_pass || "";
}

function openSettingsModal() {
    if (typeof showDashboardTab === 'function') {
        showDashboardTab('settings');
    }
}

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const primaryColor = document.getElementById('settingPrimaryColor')?.value || document.getElementById('settingPrimaryColorPicker')?.value || '#0D9488';
    const gateEnabled = document.getElementById('settingAccessGateEnabled')?.checked !== false;
    const accessPin = document.getElementById('settingAccessPin')?.value?.trim() || '1234';

    const settings = {
        clinic_name: document.getElementById('settingClinicName')?.value?.trim() || '',
        subtitle: document.getElementById('settingSubtitle')?.value?.trim() || '',
        doctor_name: document.getElementById('settingDoctorName')?.value?.trim() || '',
        primary_color: primaryColor,
        access_gate_enabled: gateEnabled,
        access_pin: accessPin,
        admin_user: document.getElementById('settingAdminUser')?.value?.trim() || '',
        admin_pass: document.getElementById('settingAdminPass')?.value || ''
    };

    // Immediate optimistic theme apply
    applyTenantTheme(settings.primary_color);
    updateTenantPWA(settings);

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Settings...';
    }

    try {
        const success = await window.dbAPI.saveSettings(settings);
        if (success) {
            alert('✅ Clinic Settings, Theme & Access PIN Updated Successfully!');
            loadClinicSettings();
        } else {
            alert('Failed to save settings. Please try again.');
        }
    } catch (err) {
        alert('Error saving settings: ' + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText || '<i class="fas fa-save"></i> SAVE CLINIC SETTINGS &amp; THEME';
        }
    }
});

// --- FIRST-TIME VISITOR ACCESS GATE (ONE-TIME VERIFICATION) ---
function toggleGatePinVisibility() {
    const pinInput = document.getElementById('gateVisitorPin');
    const eyeIcon = document.getElementById('gateEyeIcon');
    if (!pinInput) return;
    if (pinInput.type === 'password') {
        pinInput.type = 'text';
        if (eyeIcon) { eyeIcon.classList.remove('fa-eye'); eyeIcon.classList.add('fa-eye-slash'); }
    } else {
        pinInput.type = 'password';
        if (eyeIcon) { eyeIcon.classList.remove('fa-eye-slash'); eyeIcon.classList.add('fa-eye'); }
    }
}

function checkFirstTimeAccessGate(settings) {
    // Gmail login is designated for Clinic Staff & Doctors only.
    // Public website & appointment booking form are completely open to all visitors without any startup gate.
    const modal = document.getElementById('firstTimeAccessGateModal');
    if (modal) modal.style.display = 'none';
}

async function handleDoctorGoogleSignIn() {
    const btn = document.getElementById('btnDoctorGoogleSignIn');
    const errBox = document.getElementById('loginError');
    if (errBox) errBox.style.display = 'none';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Google...';
    }

    try {
        let user = null;
        if (window.dbAPI && window.dbAPI.auth && typeof firebase !== 'undefined' && firebase.auth) {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

            sessionStorage.setItem('pendingStaffLoginType', 'doctor');

            if (isStandalone) {
                await window.dbAPI.auth.signInWithRedirect(provider);
                return;
            } else {
                try {
                    const res = await window.dbAPI.auth.signInWithPopup(provider);
                    user = res.user;
                } catch (popupErr) {
                    console.warn('Doctor popup attempt, fallback to redirect:', popupErr);
                    if (popupErr.code === 'auth/popup-closed-by-user' || popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
                        await window.dbAPI.auth.signInWithRedirect(provider);
                        return;
                    }
                    throw popupErr;
                }
            }
        } else {
            user = {
                displayName: 'Dr. Clinical Specialist',
                email: 'doctor@clinic.com',
                photoURL: ''
            };
        }

        if (user) {
            loginStaffAsDoctor(user);
        }
    } catch (err) {
        console.warn('Doctor Google login error:', err);
        if (errBox) {
            let errorMsg = err.message || 'Google sign-in could not be completed.';
            if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.toLowerCase().includes('unauthorized domain'))) {
                errorMsg = '⚠️ Domain "' + window.location.hostname + '" is not authorized in Firebase Console. Please add it under Authentication > Settings > Authorized Domains.';
            } else if (err.code === 'auth/popup-closed-by-user' || (err.message && err.message.toLowerCase().includes('popup has been closed'))) {
                errorMsg = '⚠️ Popup closed before completion. If closed automatically, ensure "' + window.location.hostname + '" is in Firebase Authorized Domains.';
            }
            errBox.innerText = errorMsg;
            errBox.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign in with Google (Doctor Login)
            `;
        }
    }
}

function loginStaffAsDoctor(user) {
    const staffData = {
        name: user.displayName || 'Doctor',
        email: user.email,
        role: 'doctor',
        photoURL: user.photoURL || ''
    };
    sessionStorage.setItem('staffLoggedIn', 'true');
    sessionStorage.setItem('staffUser', JSON.stringify(staffData));

    if (window.dbAPI && typeof window.dbAPI.logAdminLogin === 'function') {
        window.dbAPI.logAdminLogin({
            username: user.email,
            role: 'doctor',
            status: 'SUCCESS (Doctor Google Auth)',
            clinic: window.currentClinicSettings?.clinic_name || 'Clinic'
        });
    }

    if (typeof closeLoginModal === 'function') closeLoginModal();
    if (typeof showSection === 'function') showSection('dashboard');
    if (typeof refreshDashboard === 'function') refreshDashboard();
    if (typeof switchActiveStaffRole === 'function') switchActiveStaffRole('doctor');
}

async function handleFirstTimeGoogleSignIn() {
    const alertBox = document.getElementById('gateErrorAlert');
    const btn = document.getElementById('btnGoogleGateSignIn');
    if (alertBox) alertBox.style.display = 'none';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Google...';
    }

    try {
        let user = null;
        if (window.dbAPI && window.dbAPI.auth && typeof firebase !== 'undefined' && firebase.auth) {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
            
            if (isStandalone) {
                await window.dbAPI.auth.signInWithRedirect(provider);
                return;
            } else {
                try {
                    const res = await window.dbAPI.auth.signInWithPopup(provider);
                    user = res.user;
                } catch (popupErr) {
                    console.warn('Popup login attempt:', popupErr);
                    if (popupErr.code === 'auth/popup-closed-by-user' || popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
                        if (alertBox) {
                            alertBox.style.background = '#EFF6FF';
                            alertBox.style.borderColor = '#BFDBFE';
                            alertBox.style.color = '#1D4ED8';
                            alertBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Popup closed. Switching to full-page Google sign-in...';
                            alertBox.style.display = 'block';
                        }
                        await window.dbAPI.auth.signInWithRedirect(provider);
                        return;
                    }
                    throw popupErr;
                }
            }
        } else {
            // Local fallback simulation if Firebase offline
            user = {
                uid: 'google_' + Date.now(),
                displayName: 'Patient Guest',
                email: 'patient.user@gmail.com',
                photoURL: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png'
            };
        }

        if (user) {
            const tenantId = (window.dbAPI && window.dbAPI.tenantId) ? window.dbAPI.tenantId : 'default';
            // 1. Mark verified for 1-time startup requirement
            localStorage.setItem('tenant_access_verified_' + tenantId, 'true');

            // 2. Record visitor in SuperAdmin logs & marketing leads
            if (window.dbAPI && typeof window.dbAPI.recordGoogleVisitor === 'function') {
                await window.dbAPI.recordGoogleVisitor(user);
            }

            // 3. Maintain patient profile
            await setupLoggedInPatient(user);

            // 4. Dispatch Welcome Email via SMTP
            if (user.email) {
                dispatchPatientWelcomeEmail(user, window.currentClinicSettings);
            }

            // 5. Smooth dismiss modal
            if (alertBox) {
                alertBox.style.background = '#DCFCE7';
                alertBox.style.borderColor = '#86EFAC';
                alertBox.style.color = '#15803D';
                alertBox.innerText = `✅ Welcome, ${user.displayName || 'Patient'}! Access granted.`;
                alertBox.style.display = 'block';
            }

            setTimeout(() => {
                const modal = document.getElementById('firstTimeAccessGateModal');
                if (modal) modal.style.display = 'none';
            }, 600);
        }

    } catch (err) {
        console.warn('Google sign-in gate notice:', err);
        if (alertBox) {
            let errorMsg = err.message || 'Google sign-in could not be completed. Please try again.';
            if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.toLowerCase().includes('unauthorized domain'))) {
                errorMsg = '⚠️ Domain "' + window.location.hostname + '" is not authorized in Firebase Console. Please add it under Authentication > Settings > Authorized Domains.';
            } else if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.toLowerCase().includes('operation-not-allowed'))) {
                errorMsg = '⚠️ Google Sign-in provider is disabled in Firebase Console. Please enable Google under Authentication > Sign-in method.';
            } else if (err.code === 'auth/popup-closed-by-user' || (err.message && err.message.toLowerCase().includes('popup has been closed'))) {
                errorMsg = '⚠️ Popup closed before completion. If closed automatically, please ensure "' + window.location.hostname + '" is added to Firebase Authorized Domains.';
            } else if (err.message && err.message.toLowerCase().includes('action is invalid')) {
                errorMsg = '⚠️ Firebase error: Action invalid. Ensure "' + window.location.hostname + '" is added to Firebase Authorized Domains and Google Sign-in is enabled.';
            }
            alertBox.innerText = errorMsg;
            alertBox.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign in with Google
            `;
        }
    }
}

function handleFirstTimeGuestBypass() {
    // Guest bypass is disabled. Google sign-in is mandatory.
    handleFirstTimeGoogleSignIn();
}

async function dispatchPatientWelcomeEmail(user, settings) {
    if (!user || !user.email) return;
    try {
        const s = settings || window.currentClinicSettings || {};
        fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: user.email,
                type: 'welcome',
                name: user.displayName || 'Valued Patient',
                clinicName: s.clinic_name || 'My Dental Clinic',
                doctorName: s.doctor_name || s.subtitle || 'Dental Specialist',
                phone: s.phone || '',
                address: s.address || '',
                primaryColor: s.primary_color || '#0D9488'
            })
        }).then(r => r.json())
          .then(res => console.log('✅ Welcome email dispatched to patient:', res))
          .catch(e => console.warn('Welcome email dispatch notice:', e));
    } catch (e) {
        console.warn('Welcome email dispatch notice:', e);
    }
}

async function setupLoggedInPatient(user) {
    if (!user || !user.email) return;
    const tenantId = (window.dbAPI && window.dbAPI.tenantId) ? window.dbAPI.tenantId : 'default';
    window.currentPatientUser = user;
    localStorage.setItem('tenant_patient_user_' + tenantId, JSON.stringify({
        displayName: user.displayName || user.name || 'Patient',
        email: user.email,
        photoURL: user.photoURL || '',
        uid: user.uid || ''
    }));

    // Update navbar avatar & name
    const navItem = document.getElementById('patient-nav-item');
    const loginItem = document.getElementById('patient-login-item');
    const navAvatar = document.getElementById('patientNavAvatar');
    const navName = document.getElementById('patientNavName');

    if (navItem) navItem.style.display = 'inline-block';
    if (loginItem) loginItem.style.display = 'none';
    if (navName) navName.innerText = (user.displayName || user.name || 'Patient').split(' ')[0];
    if (navAvatar) {
        if (user.photoURL) {
            navAvatar.src = user.photoURL;
            navAvatar.style.display = 'inline-block';
        } else {
            navAvatar.style.display = 'none';
        }
    }

    // Public booking form is kept clean and not pre-filled

    // Populate patient profile tab fields
    const pAvatar = document.getElementById('patientProfileAvatar');
    const pFullName = document.getElementById('patientProfileFullName');
    const pEmail = document.getElementById('patientProfileEmail');
    if (pAvatar && user.photoURL) pAvatar.src = user.photoURL;
    if (pFullName) pFullName.innerText = user.displayName || user.name || 'Patient';
    if (pEmail) pEmail.innerText = user.email;

    // Fetch extended profile data (mobile, address, notes)
    if (window.dbAPI && typeof window.dbAPI.getPatientProfile === 'function') {
        try {
            const profile = await window.dbAPI.getPatientProfile(user.email);
            if (profile) {
                const mob = document.getElementById('patientProfileMobile');
                const age = document.getElementById('patientProfileAge');
                const gen = document.getElementById('patientProfileGender');
                const addr = document.getElementById('patientProfileAddress');
                const notes = document.getElementById('patientProfileMedicalNotes');
                const bookingPhone = document.getElementById('phone');

                if (mob && profile.mobile) {
                    mob.value = profile.mobile;
                    if (bookingPhone && !bookingPhone.value) bookingPhone.value = profile.mobile;
                }
                if (age && profile.age) age.value = profile.age;
                if (gen && profile.gender) gen.value = profile.gender;
                if (addr && profile.address) addr.value = profile.address;
                if (notes && profile.medicalNotes) notes.value = profile.medicalNotes;
            }
        } catch(e) {}
    }

    // Also sync with patient portal dashboard
    if (typeof setupPatientDashboard === 'function') {
        setupPatientDashboard(user.email, user.displayName || 'Patient');
    }
}

function checkPatientLoginStatus() {
    const tenantId = (window.dbAPI && window.dbAPI.tenantId) ? window.dbAPI.tenantId : 'default';
    try {
        const saved = JSON.parse(localStorage.getItem('tenant_patient_user_' + tenantId) || 'null');
        if (saved && saved.email) {
            setupLoggedInPatient(saved);
        }
    } catch(e) {}
}

async function savePatientProfileFromSection(e) {
    e.preventDefault();
    const user = window.currentPatientUser;
    if (!user || !user.email) {
        alert('Please sign in with Google first.');
        return;
    }

    const mobile = document.getElementById('patientProfileMobile')?.value?.trim();
    const age = document.getElementById('patientProfileAge')?.value?.trim();
    const gender = document.getElementById('patientProfileGender')?.value;
    const address = document.getElementById('patientProfileAddress')?.value?.trim();
    const medicalNotes = document.getElementById('patientProfileMedicalNotes')?.value?.trim();
    const alertBox = document.getElementById('patientProfileSaveAlert');
    const btn = document.getElementById('btnSavePatientProfile');

    if (!mobile || mobile.replace(/\D/g, '').length < 8) {
        alert('Please enter a valid mobile phone number.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Profile...';
    }

    try {
        const payload = {
            name: user.displayName || user.name || 'Patient',
            email: user.email,
            mobile: mobile,
            phone: mobile,
            age: age || '',
            gender: gender || '',
            address: address || '',
            medicalNotes: medicalNotes || ''
        };

        if (window.dbAPI && typeof window.dbAPI.savePatientProfile === 'function') {
            await window.dbAPI.savePatientProfile(user.email, payload);
        }

        // Auto-fill booking form mobile number
        const bookingPhone = document.getElementById('phone');
        if (bookingPhone) bookingPhone.value = mobile;

        if (alertBox) {
            alertBox.style.display = 'block';
            setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
        }
        alert('✅ Profile details saved successfully! Your contact is linked with your appointments.');

    } catch(err) {
        alert('Error saving profile: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Save Profile Details';
        }
    }
}

function openPatientProfileView() {
    showSection('patient-portal');
    if (typeof switchPatientPortalTab === 'function') {
        switchPatientPortalTab('profile');
    }
}

function triggerGoogleSignInPrompt() {
    handleFirstTimeGoogleSignIn();
}

function loadClinicSettings() {
    if (!window.dbAPI) return;
    window.dbAPI.getSettings().then(settings => {
        window.currentClinicSettings = settings || {};
        const clinicName = settings.clinic_name || settings.name || 'MY DENTAL CLINIC';
        const subtitle = settings.subtitle || 'Dental & Cosmetic Clinic';
        const themeColor = settings.primary_color || settings.primaryColor || '#0D9488';

        const nameEl = document.getElementById('mainClinicName');
        const subEl = document.getElementById('mainClinicSubtitle');
        const footerNameEl = document.getElementById('footerClinicName');

        if (nameEl) nameEl.innerText = clinicName;
        if (subEl) subEl.innerText = subtitle;
        if (footerNameEl) footerNameEl.innerText = clinicName;

        document.title = `${clinicName} | ${subtitle}`;

        applyTenantTheme(themeColor);
        updateTenantPWA(settings);
        populateSettingsForm(settings);
        checkFirstTimeAccessGate(settings);
    }).catch(err => {
        console.warn('loadClinicSettings error:', err);
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
    const detailsEl = document.getElementById('bookingModalDetails');
    if (detailsEl && appt) {
        detailsEl.innerHTML = `Appointment for <b>${escapeHtml(appt.name || 'Patient')}</b> on <b>${appt.appointmentDate || appt.date}</b> at <b>${appt.appointmentTime || ''}</b> has been recorded.`;
    }

    const cancelBtn = document.getElementById('btnCancelBookedAppt');
    if (cancelBtn && appt && appt.id) {
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.style.justifyContent = 'center';
        cancelBtn.style.alignItems = 'center';
        cancelBtn.onclick = () => cancelAppointmentByUser(appt.id);
    } else if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }

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
    const msg = `Hi ${activePatient.name}, this is MY DENTAL CLINIC. We are following up regarding your treatment.`;
    const waNum = formatWhatsAppNumber(activePatient.mobile);
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
        name: activePatient.name,
        mobile: activePatient.mobile,
        email: currentPatient.email || '',
        place: activePatient.place || '',
        appointmentDate: nextDate,
        appointmentTime: nextTime,
        reason: nextReason,
        fee: 0,
        status: 'Pending'
    };

    const saved = await window.dbAPI.createAppointment(newAppt);
    if (saved) {
        // Refresh local patient data
        const updatedHistory = await window.dbAPI.getPatientHistory(activePatient.mobile);
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
        mobile: activePatient.mobile,
        title: title,
        notes: notes
    });

    if (success) {
        alert("Diagnosis Saved Successfully.");
        document.getElementById('diagTitle').value = '';
        document.getElementById('diagNotes').value = '';
        renderDiagnoses(activePatient.mobile);
    }
}

// --- PWA REGISTRATION & INSTANT AUTO-REFRESH ON NEW DEPLOYMENT ---
if ('serviceWorker' in navigator) {
    let isRefreshing = false;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
            console.log('💎 Premium Engine: PWA Service Worker Registered');
            
            // Force checking for updates immediately on page load
            reg.update().catch(err => console.log('SW update check bypassed:', err.message));
            
            // Periodic check for SW update every 60 seconds
            setInterval(() => {
                reg.update().catch(err => console.log('SW periodic update bypassed:', err.message));
            }, 60 * 1000);

            // Check for updates when user refocuses the app/tab
            window.addEventListener('focus', () => {
                reg.update().catch(err => console.log('SW focus update bypassed:', err.message));
                checkForAppDeploymentUpdate();
            });
        }).catch(err => {
            console.warn('SW: Registration failed:', err);
        });

        // Check version on initial launch
        checkForAppDeploymentUpdate();
        setInterval(checkForAppDeploymentUpdate, 60 * 1000);
    });

    // Auto-refresh immediately when controller changes (new ServiceWorker activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isRefreshing) {
            isRefreshing = true;
            window.location.reload(true);
        }
    });

    // Also auto-refresh when SW broadcasts SW_VERSION_UPDATED
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_VERSION_UPDATED') {
            if (!isRefreshing) {
                isRefreshing = true;
                window.location.reload(true);
            }
        }
    });
}

// Polling deployment tracker: checks /version.json to auto-refresh all browser & PWA instances
async function checkForAppDeploymentUpdate() {
    try {
        const res = await fetch('/version.json?_t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.build) {
            const currentBuild = localStorage.getItem('app_installed_build_version');
            if (currentBuild && currentBuild !== String(data.build)) {
                console.log('🚀 New deployment detected (Build: ' + data.build + '). Purging caches & auto-refreshing...');
                localStorage.setItem('app_installed_build_version', String(data.build));
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                window.location.reload(true);
                return;
            }
            localStorage.setItem('app_installed_build_version', String(data.build));
        }
    } catch (e) {
        // Silent catch for offline or non-blocking network glitches
    }
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
        const all = window.dbAPI ? window.dbAPI.getLocalData('dentalAppointments', []) : (JSON.parse(localStorage.getItem('dentalAppointments')) || []);
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
                    const allDiag = window.dbAPI ? window.dbAPI.getLocalData('dentalDiagnoses', []) : (JSON.parse(localStorage.getItem('dentalDiagnoses')) || []);
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
    document.getElementById('pTabBtnTimeline')?.classList.toggle('active', tabName === 'timeline');
    document.getElementById('pTabBtnDiagnoses')?.classList.toggle('active', tabName === 'diagnoses');
    document.getElementById('pTabBtnFinances')?.classList.toggle('active', tabName === 'finances');
    document.getElementById('pTabBtnProfile')?.classList.toggle('active', tabName === 'profile');
    
    // Toggle active containers
    const tSec = document.getElementById('patientTimelineSection');
    const dSec = document.getElementById('patientDiagnosesSection');
    const fSec = document.getElementById('patientFinancesSection');
    const pSec = document.getElementById('patientProfileSection');

    if (tSec) tSec.style.display = tabName === 'timeline' ? 'block' : 'none';
    if (dSec) dSec.style.display = tabName === 'diagnoses' ? 'block' : 'none';
    if (fSec) fSec.style.display = tabName === 'finances' ? 'block' : 'none';
    if (pSec) pSec.style.display = tabName === 'profile' ? 'block' : 'none';
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
    if (bookingFormSub && (bookingFormSub.innerText || bookingFormSub.textContent || '').includes('consultation')) bookingFormSub.innerText = dict.sec_booking_sub;

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
    if (featuresSub && (featuresSub.innerText || featuresSub.textContent || '').includes('procedures')) featuresSub.innerText = dict.sec_services_sub;

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
    const el = document.getElementById('manageClinicsModal');
    if (el) el.style.display = 'block';
    if (typeof showDashboardTab === 'function') showDashboardTab('superadmin');
    loadTenantsList();
}

function closeManageClinicsModal() {
    const el = document.getElementById('manageClinicsModal');
    if (el) el.style.display = 'none';
    const tab = document.getElementById('superadminTab');
    if (tab) tab.style.display = 'none';
    if (typeof showDashboardTab === 'function') showDashboardTab('patients');
}

async function loadTenantsList() {
    const list = document.getElementById('clinicsList');
    if (!list) return;
    list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading clinics...</div>';
    try {
        let tenants = [];
        if (window.dbAPI && window.dbAPI.db) {
            try {
                const snapshot = await window.dbAPI.db.collection('tenants').get();
                snapshot.forEach(doc => {
                    tenants.push({ id: doc.id, ...doc.data() });
                });
            } catch (err) {
                console.warn('Firestore tenants fetch warning:', err);
            }
        }

        // Always ensure default clinic is present
        if (!tenants.some(t => t.id === 'default')) {
            tenants.unshift({
                id: 'default',
                name: 'My Dental Clinic (Default)',
                subtitle: 'Dental & Cosmetic Clinic',
                primary_color: '#10B981'
            });
        }

        // Always ensure Swastik Dental Clinic is present and seeded
        if (!tenants.some(t => t.id === 'swastik-dental' || t.id === 'swastik')) {
            const swastikObj = {
                id: 'swastik-dental',
                name: 'Swastik Dental Clinic',
                subtitle: 'Dr. Chintal Baman (BDS)',
                primary_color: '#0D9488',
                createdAt: new Date().toISOString()
            };
            tenants.push(swastikObj);
            if (window.dbAPI && window.dbAPI.db) {
                window.dbAPI.db.collection('tenants').doc('swastik-dental').set(swastikObj, { merge: true }).catch(console.error);
                window.dbAPI.db.collection('tenants').doc('swastik-dental').collection('settings').doc('clinic').set({
                    clinic_name: 'Swastik Dental Clinic',
                    subtitle: 'Dr. Chintal Baman (BDS)',
                    doctor_name: 'Dr. Chintal Baman (BDS)',
                    primary_color: '#0D9488'
                }, { merge: true }).catch(console.error);
            }
        }

        // Render HTML
        let html = '';
        tenants.forEach(t => {
            const tenantPath = t.id === 'default' ? '/' : `/${t.id}`;
            const visitUrl = (window.location.protocol === 'file:') ? `index.html?c=${t.id}` : (t.id === 'default' ? '/' : `/${t.id}`);
            html += `<div style="padding: 1rem; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <strong style="color: #0F172A; font-size: 0.95rem;">${t.name || t.id}</strong>
                    <div style="font-size:0.8rem; color:#64748B;">Slug: <code>${t.id}</code> &bull; Path: <code>${tenantPath}</code></div>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <a href="${visitUrl}" target="_blank" class="btn-primary" style="padding:0.35rem 0.75rem; font-size:0.8rem;">Open Clinic</a>
                    <a href="index.html?c=${t.id}" target="_blank" class="btn-primary" style="padding:0.35rem 0.75rem; font-size:0.8rem; background: #64748B;">Direct ?c=</a>
                </div>
            </div>`;
        });
        list.innerHTML = html;

        // Populate switcher
        const switcher = document.getElementById('tenantSwitcher');
        if (switcher) {
            let options = '<option value="default">Default Clinic</option>';
            tenants.forEach(t => {
                if (t.id !== 'default') {
                    options += `<option value="${t.id}">${t.name || t.id}</option>`;
                }
            });
            switcher.innerHTML = options;
            switcher.value = window.dbAPI.tenantId || 'default';
        }

    } catch (e) {
        list.innerHTML = '<div style="color: red; padding: 1rem;">Error loading clinics: ' + e.message + '</div>';
    }
}

document.getElementById('addClinicForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const slug = document.getElementById('newClinicSlug').value.toLowerCase().trim();
    const name = document.getElementById('newClinicName').value.trim();
    const subtitle = document.getElementById('newClinicSubtitle')?.value?.trim() || '';
    const color = document.getElementById('newClinicColor')?.value || document.getElementById('newClinicColorHex')?.value || '#0D9488';
    
    if(!slug) return alert('Slug is required');
    
    try {
        const db = window.dbAPI.db;
        await db.collection('tenants').doc(slug).set({
            name: name,
            subtitle: subtitle,
            createdAt: new Date().toISOString()
        });
        
        // Auto-create default admin staff user for this clinic
        await db.collection('tenants').doc(slug).collection('staff').doc(slug + 'admin').set({
            name: subtitle ? `${name} - ${subtitle}` : `${name} Admin`,
            email: slug + 'admin', // using slug+admin as username
            password: 'admin',
            role: 'admin'
        });

        // Initialize clinic settings
        await db.collection('tenants').doc(slug).collection('settings').doc('clinic').set({
            clinic_name: name,
            subtitle: subtitle,
            doctor_name: subtitle,
            contact_number: '',
            clinic_address: '',
            primary_color: color
        });

        const accessUrl = (window.location.protocol === 'file:') ? `index.html?c=${slug}` : `/${slug}`;
        alert(`Tenant "${name}" (${slug}) created successfully!\n\nAccess Link: ${window.location.origin}${accessUrl}\nStaff Login: ${slug}admin\nPassword: admin`);
        document.getElementById('addClinicForm').reset();
        loadTenantsList();
    } catch(err) {
        alert('Error creating clinic: ' + err.message);
    }
});

function switchTenant(tenantId) {
    if (tenantId) {
        if (window.location.protocol === 'file:') {
            window.location.href = (tenantId === 'default') ? 'index.html' : ('index.html?c=' + tenantId);
        } else {
            window.location.href = (tenantId === 'default') ? '/' : ('/' + tenantId);
        }
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
            const role = (user.role || 'doctor').toLowerCase();
            const isDoctor = role === 'doctor' || role === 'admin' || role === 'super_admin';
            const isCompounder = role === 'compounder';
            const isReceptionist = role === 'receptionist';

            // 1. Update role badge in dashboard header
            const badge = document.getElementById('currentRoleBadge');
            if (badge) {
                badge.innerText = role.toUpperCase();
                if (isDoctor) {
                    badge.style.background = '#DCFCE7';
                    badge.style.color = '#15803D';
                } else if (isCompounder) {
                    badge.style.background = '#EDE9FE';
                    badge.style.color = '#6D28D9';
                } else {
                    badge.style.background = '#E0F2FE';
                    badge.style.color = '#0369A1';
                }
            }

            // 2. Update button styles in role switcher bar
            const btnDoc = document.getElementById('roleBtnDoctor');
            const btnComp = document.getElementById('roleBtnCompounder');
            const btnRecep = document.getElementById('roleBtnRecep');

            if (btnDoc) {
                btnDoc.style.background = isDoctor ? 'var(--primary, #0D9488)' : 'transparent';
                btnDoc.style.color = isDoctor ? '#FFFFFF' : '#475569';
            }
            if (btnComp) {
                btnComp.style.background = isCompounder ? '#8B5CF6' : 'transparent';
                btnComp.style.color = isCompounder ? '#FFFFFF' : '#475569';
            }
            if (btnRecep) {
                btnRecep.style.background = isReceptionist ? '#0284C7' : 'transparent';
                btnRecep.style.color = isReceptionist ? '#FFFFFF' : '#475569';
            }

            // 3. Financials: Only Doctor / Admin can view Total Revenue
            const earningsCard = document.getElementById('stats-earnings');
            if (earningsCard) {
                earningsCard.style.display = isDoctor ? 'flex' : 'none';
            }
            
            // 4. Settings button: Only Doctor / Admin can view Settings
            const settingsTabBtns = document.querySelectorAll('button[onclick="showDashboardTab(\'settings\')"]');
            settingsTabBtns.forEach(btn => {
                btn.style.display = isDoctor ? 'inline-block' : 'none';
            });

            // Prevent viewing Settings tab explicitly if not Doctor
            if (!isDoctor && document.getElementById('tab-settings')?.style.display !== 'none') {
                showDashboardTab('patients');
            }
        }
    } catch(e) {
        console.warn('enforceRoleRestrictions error:', e);
    }
}

function switchActiveStaffRole(newRole) {
    let staffUser = {};
    try {
        staffUser = JSON.parse(sessionStorage.getItem('staffUser')) || {};
    } catch(e) {
        staffUser = {};
    }

    staffUser.role = newRole;
    sessionStorage.setItem('staffUser', JSON.stringify(staffUser));
    enforceRoleRestrictions();
    console.log('💎 Clinical role view switched to:', newRole);
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
                        ${a.medicalAlerts && a.medicalAlerts.length > 0 ? `
                            <div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">
                                ${a.medicalAlerts.map(al => `<span class="medical-alert-tag alert-tag-danger" style="font-size: 0.68rem; padding: 1px 6px;"><i class="fas fa-exclamation-triangle"></i> ${al}</span>`).join('')}
                            </div>
                        ` : ''}
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
                        ${status !== 'Cancelled' ? `
                            <button onclick="staffCancelAppointment('${a.id}')" class="btn-primary" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: 8px;" title="Cancel Appointment">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
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

// --- APPOINTMENT CANCELLATION (BY STAFF & BY USER) ---

async function staffCancelAppointment(id) {
    if (!confirm('Are you sure you want to cancel this appointment? The clinical time slot will be reopened.')) {
        return;
    }
    try {
        if (window.dbAPI && typeof window.dbAPI.updateAppointment === 'function') {
            await window.dbAPI.updateAppointment(id, { status: 'Cancelled' });
        }
        // Update local active patient history if applicable
        if (typeof currentPatient !== 'undefined' && currentPatient && currentPatient.history) {
            const histItem = currentPatient.history.find(h => String(h.id) === String(id));
            if (histItem) histItem.status = 'Cancelled';
            renderTimeline(currentPatient.history);
        }
        if (typeof currentScheduleDate !== 'undefined' && typeof renderScheduleCalendar === 'function') {
            renderScheduleCalendar(currentScheduleDate);
        }
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }
        if (typeof generateTimeSlots === 'function') {
            await generateTimeSlots();
        }
        alert('Appointment successfully cancelled.');
    } catch (e) {
        console.error('Failed to cancel appointment:', e);
        alert('Failed to cancel appointment. Please try again.');
    }
}
window.staffCancelAppointment = staffCancelAppointment;

async function cancelAppointmentByUser(id) {
    if (!confirm('Are you sure you want to cancel your appointment?')) {
        return;
    }
    try {
        if (window.dbAPI && typeof window.dbAPI.updateAppointment === 'function') {
            await window.dbAPI.updateAppointment(id, { status: 'Cancelled' });
        }
        if (typeof generateTimeSlots === 'function') {
            await generateTimeSlots();
        }
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }
        alert('Your appointment has been cancelled successfully.');
        const bModal = document.getElementById('bookingModal');
        if (bModal) bModal.style.display = 'none';
        
        // Refresh lookup results if lookup modal is open
        const lModal = document.getElementById('patientLookupModal');
        if (lModal && lModal.style.display !== 'none') {
            lookupUserAppointments();
        }
    } catch (e) {
        console.error('Failed to cancel appointment:', e);
        alert('Failed to cancel appointment. Please contact the clinic.');
    }
}
window.cancelAppointmentByUser = cancelAppointmentByUser;

function openPatientLookupModal() {
    const modal = document.getElementById('patientLookupModal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('userLookupPhone');
        if (input) {
            input.value = '';
            if (window.innerWidth > 768) {
                setTimeout(() => input.focus(), 150);
            }
        }
        const res = document.getElementById('userLookupResults');
        if (res) res.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">Enter your 10-digit mobile number above to see your appointments.</div>`;
    }
}
window.openPatientLookupModal = openPatientLookupModal;

function closePatientLookupModal() {
    const modal = document.getElementById('patientLookupModal');
    if (modal) modal.style.display = 'none';
}
window.closePatientLookupModal = closePatientLookupModal;

async function lookupUserAppointments() {
    const phoneInput = document.getElementById('userLookupPhone');
    const res = document.getElementById('userLookupResults');
    if (!phoneInput || !res) return;
    const phone = phoneInput.value.trim().replace(/\D/g, '');
    if (phone.length < 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
    }
    res.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--primary); font-weight: 700;"><i class="fas fa-spinner fa-spin"></i> Searching bookings...</div>';
    
    try {
        let appts = [];
        if (window.dbAPI && typeof window.dbAPI.getPatientHistory === 'function') {
            appts = await window.dbAPI.getPatientHistory(phone);
        }
        if (!appts || appts.length === 0) {
            if (window.dbAPI && typeof window.dbAPI.getAppointments === 'function') {
                const all = await window.dbAPI.getAppointments();
                appts = (all || []).filter(a => (a.mobile || '').replace(/\D/g, '').endsWith(phone.slice(-10)));
            }
        }
        
        if (!appts || appts.length === 0) {
            res.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: #64748B; background: #F8FAFC; border-radius: 10px; border: 1px solid #E2E8F0;">
                <i class="fas fa-calendar-times" style="font-size: 2rem; color: #94A3B8; margin-bottom: 0.5rem; display: block;"></i>
                No appointments found for mobile number <b>${phone}</b>.
            </div>`;
            return;
        }

        // Sort descending by date
        appts.sort((a,b) => (b.appointmentDate||b.date||'').localeCompare(a.appointmentDate||a.date||''));

        res.innerHTML = appts.map(a => {
            const isCancelled = a.status === 'Cancelled';
            const isCompleted = a.status === 'Completed';
            const dateStr = a.appointmentDate || a.date;
            const timeStr = a.appointmentTime || 'Time TBD';
            return `
                <div style="background: white; border: 1.5px solid ${isCancelled ? '#FCA5A5' : '#E2E8F0'}; border-radius: 12px; padding: 0.9rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="font-weight: 800; color: #0F172A; font-size: 0.95rem;">
                            <i class="fas fa-calendar-day" style="color: var(--primary);"></i> ${dateStr} at ${timeStr}
                        </div>
                        <span style="font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 99px; ${isCancelled ? 'background: #FEE2E2; color: #DC2626;' : (isCompleted ? 'background: #E0E7FF; color: #4338CA;' : 'background: #DCFCE7; color: #16A34A;')}">
                            ${a.status || 'Confirmed'}
                        </span>
                    </div>
                    <div style="font-size: 0.82rem; color: #64748B;">
                        <b>Concern:</b> ${escapeHtml(a.reason || 'General Consultation')}
                    </div>
                    ${!isCancelled && !isCompleted ? `
                        <button type="button" onclick="cancelAppointmentByUser('${a.id}')" style="align-self: flex-start; height: 32px; padding: 0 12px; background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; margin-top: 4px;">
                            <i class="fas fa-times-circle"></i> Cancel Appointment
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error fetching appointments:', err);
        res.innerHTML = '<div style="color: #DC2626; text-align: center; padding: 1rem;">Failed to fetch appointments. Please try again.</div>';
    }
}
window.lookupUserAppointments = lookupUserAppointments;




function getActivePatient() {
    if (typeof currentPatient !== 'undefined' && currentPatient) return currentPatient;
    if (typeof window !== 'undefined' && window.currentPatient) return window.currentPatient;
    return null;
}

/* ==========================================================================
   CLINICAL MODULE: PRE-VISIT MEDICAL HISTORY & CLINICAL ALERTS
   ========================================================================== */

function toggleMedicalIntake() {
    const body = document.getElementById('medicalIntakeBody') || document.getElementById('medicalIntakeSection');
    const chevron = document.getElementById('medicalIntakeChevron') || document.getElementById('intakeToggleIcon');
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

async function renderPatientMedicalAlerts(mobile) {
    const badgesContainer = document.getElementById('profileAlertsBadges');
    if (!badgesContainer) return;

    let alertData = { alerts: [], notes: '' };
    try {
        if (window.dbAPI && typeof window.dbAPI.getPatientMedicalAlerts === 'function') {
            alertData = await window.dbAPI.getPatientMedicalAlerts(mobile);
        }
    } catch (e) {
        console.warn('Error fetching medical alerts:', e);
    }

    // Fallback: check if currentPatient has alerts in appointment history
    if ((!alertData.alerts || alertData.alerts.length === 0) && currentPatient && currentPatient.history) {
        const histAppt = currentPatient.history.find(h => h.medicalAlerts && h.medicalAlerts.length > 0);
        if (histAppt) {
            alertData.alerts = histAppt.medicalAlerts || [];
            alertData.notes = histAppt.medicalNotes || alertData.notes || '';
        }
    }

    if (currentPatient) {
        currentPatient.medicalAlerts = alertData.alerts || [];
        currentPatient.medicalNotes = alertData.notes || '';
    }

    if (!alertData.alerts || alertData.alerts.length === 0) {
        badgesContainer.innerHTML = `
            <span style="font-size: 0.75rem; font-weight: 900; color: #16A34A;"><i class="fas fa-heartbeat"></i> HEALTH STATUS:</span>
            <span style="font-size: 0.75rem; color: #64748B;">No medical alerts recorded (Fit for routine procedures)</span>
            ${alertData.notes ? `<span class="medical-alert-tag alert-tag-warning" style="font-size: 0.72rem;"><i class="fas fa-sticky-note"></i> ${escapeHtml(alertData.notes)}</span>` : ''}
        `;
    } else {
        badgesContainer.innerHTML = `
            <span style="font-size: 0.75rem; font-weight: 900; color: #DC2626;"><i class="fas fa-exclamation-triangle"></i> CLINICAL WARNINGS:</span>
            ${alertData.alerts.map(al => `<span class="medical-alert-tag alert-tag-danger"><i class="fas fa-heart"></i> ${escapeHtml(al)}</span>`).join('')}
            ${alertData.notes ? `<span class="medical-alert-tag alert-tag-warning" style="font-size: 0.72rem;"><i class="fas fa-sticky-note"></i> Note: ${escapeHtml(alertData.notes)}</span>` : ''}
        `;
    }
}

function openEditMedicalAlertsModal() {
    const activePatient = getActivePatient();
    if (!activePatient) {
        alert('Please select a patient first.');
        return;
    }
    const modal = document.getElementById('editMedicalAlertsModal');
    if (!modal) return;

    const alerts = currentPatient.medicalAlerts || [];
    const notes = currentPatient.medicalNotes || '';

    const checkMap = {
        'Penicillin / Drug Allergy': 'editAlertPenicillin',
        'Diabetes': 'editAlertDiabetes',
        'Hypertension (BP)': 'editAlertHypertension',
        'Cardiac / Heart Condition': 'editAlertHeart',
        'Bleeding Disorder / Blood Thinners': 'editAlertBleeding',
        'Latex / Local Anesthetic Allergy': 'editAlertLatex',
        'Pregnancy': 'editAlertPregnancy'
    };

    Object.entries(checkMap).forEach(([text, id]) => {
        const el = document.getElementById(id);
        if (el) el.checked = alerts.some(a => a.toLowerCase().includes(text.toLowerCase().substring(0, 8)));
    });

    const notesEl = document.getElementById('editAlertCustomNotes');
    if (notesEl) notesEl.value = notes;

    modal.style.display = 'flex';
}

function closeEditMedicalAlertsModal() {
    const modal = document.getElementById('editMedicalAlertsModal');
    if (modal) modal.style.display = 'none';
}

async function saveMedicalAlertsFromModal() {
    if (!currentPatient) return;

    const checkMap = {
        'editAlertPenicillin': 'Penicillin / Drug Allergy',
        'editAlertDiabetes': 'Diabetes',
        'editAlertHypertension': 'Hypertension (BP)',
        'editAlertHeart': 'Cardiac / Heart Condition',
        'editAlertBleeding': 'Bleeding Disorder / Blood Thinners',
        'editAlertLatex': 'Latex / Local Anesthetic Allergy',
        'editAlertPregnancy': 'Pregnancy'
    };

    const selected = [];
    Object.entries(checkMap).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && el.checked) selected.push(val);
    });

    const notes = document.getElementById('editAlertCustomNotes')?.value?.trim() || '';

    try {
        if (window.dbAPI && typeof window.dbAPI.savePatientMedicalAlerts === 'function') {
            await window.dbAPI.savePatientMedicalAlerts(activePatient.mobile, selected, notes);
        }
        currentPatient.medicalAlerts = selected;
        currentPatient.medicalNotes = notes;
        await renderPatientMedicalAlerts(activePatient.mobile);
        closeEditMedicalAlertsModal();
        if (typeof refreshDashboard === 'function') refreshDashboard();
        alert('Patient medical alerts updated successfully!');
    } catch (e) {
        console.error('Failed to save patient medical alerts:', e);
        alert('Error updating medical alerts. Please try again.');
    }
}


/* ==========================================================================
   CLINICAL MODULE: DIGITAL DENTAL PRESCRIPTION (Rx) GENERATOR
   ========================================================================== */

let currentRxMedicines = [];
window.currentRxMedicines = currentRxMedicines;

function addRxTemplate(name, freq, dur, inst) {
    currentRxMedicines.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name,
        frequency: freq,
        duration: dur,
        instructions: inst
    });
    renderRxMedicinesTable();
}

function addCustomRxMedicine() {
    const nameEl = document.getElementById('rxDrugName');
    const freqEl = document.getElementById('rxDrugFrequency');
    const durEl = document.getElementById('rxDrugDuration');
    const instEl = document.getElementById('rxDrugInstructions');

    const name = nameEl?.value?.trim();
    const freq = freqEl?.value?.trim() || '1-0-1';
    const dur = durEl?.value?.trim() || '5 Days';
    const inst = instEl?.value?.trim() || 'After food';

    if (!name) {
        alert('Please enter medicine name.');
        nameEl?.focus();
        return;
    }

    currentRxMedicines.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name,
        frequency: freq,
        duration: dur,
        instructions: inst
    });

    nameEl.value = '';
    freqEl.value = '';
    durEl.value = '';
    instEl.value = '';

    renderRxMedicinesTable();
}

function deleteRxMedicine(idx) {
    currentRxMedicines.splice(idx, 1);
    renderRxMedicinesTable();
}

function renderRxMedicinesTable() {
    const tbody = document.getElementById('rxMedicinesTableBody');
    if (!tbody) return;

    if (currentRxMedicines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No medicines added to Rx yet. Tap templates above to add.</td></tr>';
        return;
    }

    tbody.innerHTML = currentRxMedicines.map((m, idx) => `
        <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px; font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
            <td style="padding: 8px; font-weight: 800; color: var(--secondary);">${escapeHtml(m.name)}</td>
            <td style="padding: 8px; font-weight: 700; color: var(--primary);">${escapeHtml(m.frequency)}</td>
            <td style="padding: 8px;">${escapeHtml(m.duration)}</td>
            <td style="padding: 8px; font-size: 0.8rem; color: #475569;">${escapeHtml(m.instructions)}</td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" onclick="deleteRxMedicine(${idx})" style="background: none; border: none; color: #EF4444; cursor: pointer; padding: 4px 8px; border-radius: 4px;" title="Remove medicine">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function clearRxForm() {
    currentRxMedicines = [];
    renderRxMedicinesTable();
    const notesEl = document.getElementById('rxAdditionalNotes');
    if (notesEl) notesEl.value = '';
}

async function saveAndGenerateRxPDF() {
    const activePatient = getActivePatient();
    if (!activePatient) {
        alert('Please select a patient first.');
        return;
    }
    if (currentRxMedicines.length === 0) {
        alert('Please add at least one medicine to the prescription.');
        return;
    }

    // Collect advice checkboxes
    const adviceElements = document.querySelectorAll('input[name="rxAdvice"]:checked');
    const adviceList = Array.from(adviceElements).map(el => el.value);
    const additionalNotes = document.getElementById('rxAdditionalNotes')?.value?.trim() || '';

    const rxRecord = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        patientName: activePatient.name,
        patientMobile: activePatient.mobile,
        patientPlace: activePatient.place || 'Local',
        medicines: [...currentRxMedicines],
        advice: adviceList,
        additionalNotes: additionalNotes,
        createdAt: new Date().toISOString()
    };

    // Save to Firestore / localStorage
    try {
        if (window.dbAPI && typeof window.dbAPI.savePrescription === 'function') {
            await window.dbAPI.savePrescription(rxRecord);
        }
    } catch (e) {
        console.warn('Error persisting prescription:', e);
    }

    // Generate Branded PDF using jsPDF
    try {
        generateRxPDFDocument(rxRecord);
    } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr);
        alert('Prescription saved! Note: PDF download encountered an issue.');
    }

    // Refresh history
    await loadPatientPrescriptions(activePatient.mobile);
    alert('Digital Prescription saved and PDF generated!');
}

function generateRxPDFDocument(rxRecord) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('jsPDF library not available.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Top Decorative Brand Bar (Teal Accent)
    doc.setFillColor(13, 148, 136); // #0D9488
    doc.rect(0, 0, 210, 6, 'F');

    // 2. Clinic Header
    const clinicName = window.currentClinicSettings?.clinic_name || 'MY DENTAL CLINIC';
    const clinicSubtitle = window.currentClinicSettings?.subtitle || 'Dental & Cosmetic Clinic';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text(clinicName.toUpperCase(), 20, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(13, 148, 136);
    doc.text(clinicSubtitle, 20, 28);

    // 3. Document Title (Right Aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('PRESCRIPTION (Rx)', 190, 22, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Rx No: RX-${rxRecord.id}`, 190, 28, { align: 'right' });
    doc.text(`Date: ${rxRecord.date}`, 190, 32, { align: 'right' });

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, 36, 190, 36);

    // 4. Patient Information Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 40, 170, 22, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('PATIENT DETAILS:', 25, 46);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(rxRecord.patientName.toUpperCase(), 25, 52);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Mobile: ${rxRecord.patientMobile} | Location: ${rxRecord.patientPlace}`, 25, 57);

    // Medical Alert Warning if present
    let currentY = 68;
    const alerts = currentPatient?.medicalAlerts || [];
    if (alerts.length > 0) {
        doc.setFillColor(254, 226, 226);
        doc.roundedRect(20, currentY, 170, 9, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(220, 38, 38);
        doc.text(`WARNING - MEDICAL ALERTS: ${alerts.join(', ')}`, 25, currentY + 6);
        currentY += 14;
    }

    // 5. Prescribed Medicines Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(13, 148, 136);
    doc.text('Rx - PRESCRIBED MEDICINES', 20, currentY);
    currentY += 6;

    // Table Header
    doc.setFillColor(15, 23, 42);
    doc.rect(20, currentY, 170, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('#', 23, currentY + 5.5);
    doc.text('MEDICINE NAME', 32, currentY + 5.5);
    doc.text('FREQUENCY', 95, currentY + 5.5);
    doc.text('DURATION', 125, currentY + 5.5);
    doc.text('INSTRUCTIONS', 150, currentY + 5.5);
    currentY += 8;

    // Table Rows
    rxRecord.medicines.forEach((med, idx) => {
        const rowBg = idx % 2 === 0 ? 255 : 248;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(20, currentY, 170, 9, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(idx + 1), 23, currentY + 6);

        doc.setFont('helvetica', 'bold');
        doc.text(med.name.substring(0, 32), 32, currentY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(13, 148, 136);
        doc.text(med.frequency || '1-0-1', 95, currentY + 6);

        doc.setTextColor(51, 65, 85);
        doc.text(med.duration || '5 Days', 125, currentY + 6);
        doc.text((med.instructions || 'After food').substring(0, 22), 150, currentY + 6);

        // Row bottom line
        doc.setDrawColor(241, 245, 249);
        doc.line(20, currentY + 9, 190, currentY + 9);
        currentY += 9;
    });

    currentY += 6;

    // 6. Clinical Advice & Instructions
    if (rxRecord.advice && rxRecord.advice.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('CLINICAL ADVICE & POST-OP INSTRUCTIONS:', 20, currentY);
        currentY += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        rxRecord.advice.forEach(adv => {
            doc.text(`•  ${adv}`, 24, currentY);
            currentY += 5;
        });
    }

    if (rxRecord.additionalNotes) {
        currentY += 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Doctor Notes:', 20, currentY);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(51, 65, 85);
        doc.text(rxRecord.additionalNotes.substring(0, 90), 45, currentY);
        currentY += 6;
    }

    // 7. Signature & Clinic Stamp Block
    doc.setDrawColor(203, 213, 225);
    doc.line(135, 255, 190, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('DOCTOR SIGNATURE / STAMP', 135, 260);

    // 8. Global Clinic & Developer Attribution Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 275, 190, 275);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${(window.currentClinicSettings?.clinic_name || 'MY DENTAL CLINIC').toUpperCase()} | For emergency care contact clinic helpline`, 20, 281);
    doc.text('Developed by proconixsoftware.vercel.app', 190, 281, { align: 'right' });

    // Save PDF
    const cleanName = (rxRecord.patientName || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Rx_${cleanName}_${rxRecord.id}.pdf`);
}

function shareRxWhatsApp() {
    const activePatient = getActivePatient();
    if (!activePatient) {
        alert('Please select a patient first.');
        return;
    }
    if (currentRxMedicines.length === 0) {
        alert('Please add at least one medicine to the prescription.');
        return;
    }

    const adviceList = Array.from(document.querySelectorAll('input[name="rxAdvice"]:checked')).map(el => el.value);
    const notes = document.getElementById('rxAdditionalNotes')?.value?.trim();

    const clinicTitle = (window.currentClinicSettings?.clinic_name || 'MY DENTAL CLINIC').toUpperCase();
    let msg = `💊 *DENTAL PRESCRIPTION (Rx)*\n`;
    msg += `🏥 *${clinicTitle}*\n`;
    msg += `👤 *Patient:* ${activePatient.name}\n`;
    msg += `📅 *Date:* ${new Date().toLocaleDateString()}\n`;
    msg += `---------------------------\n`;
    msg += `*PRESCRIBED MEDICINES:*\n`;
    currentRxMedicines.forEach((m, i) => {
        msg += `${i + 1}. * ${m.name}*\n   Dosage: ${m.frequency} | Dur: ${m.duration}\n   Note: ${m.instructions}\n`;
    });

    if (adviceList.length > 0) {
        msg += `---------------------------\n`;
        msg += `*ADVICE & INSTRUCTIONS:*\n`;
        adviceList.forEach(adv => {
            msg += `• ${adv}\n`;
        });
    }

    if (notes) {
        msg += `📝 *Note:* ${notes}\n`;
    }

    msg += `---------------------------\n`;
    msg += `✨ *Developed by proconixsoftware.vercel.app*`;

    const cleanMobile = (activePatient.mobile || '').replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

async function loadPatientPrescriptions(mobile) {
    const container = document.getElementById('patientPrescriptionsHistoryList');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading prescriptions...</div>';

    let list = [];
    try {
        if (window.dbAPI && typeof window.dbAPI.getPrescriptions === 'function') {
            list = await window.dbAPI.getPrescriptions(mobile);
        }
    } catch (e) {
        console.warn('Failed to load prescriptions:', e);
    }

    if (!list || list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">No past digital prescriptions recorded for this patient.</div>';
        return;
    }

    container.innerHTML = list.map(rx => {
        const safeRxJson = encodeURIComponent(JSON.stringify(rx));
        const medNames = (rx.medicines || []).map(m => m.name).join(', ');
        return `
            <div style="background: var(--bg-soft); border-radius: 10px; padding: 1rem 1.25rem; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <span style="font-weight: 800; color: var(--secondary); font-size: 0.95rem;">Rx #${rx.id}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">${rx.date || 'N/A'}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: #475569; max-width: 480px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${medNames}">
                        ${medNames || 'No medicines listed'}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="reprintRxPDF('${safeRxJson}')" class="btn-primary" style="height: 32px; font-size: 0.75rem; padding: 0 0.85rem; background: var(--primary);" title="Download PDF">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button onclick="reprintRxWhatsApp('${safeRxJson}')" class="btn-primary" style="height: 32px; font-size: 0.75rem; padding: 0 0.85rem; background: #25D366;" title="Share WhatsApp">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function reprintRxPDF(rxJson) {
    try {
        const rx = JSON.parse(decodeURIComponent(rxJson));
        generateRxPDFDocument(rx);
    } catch (e) {
        console.error('Error reprinting Rx PDF:', e);
    }
}

function reprintRxWhatsApp(rxJson) {
    try {
        const rx = JSON.parse(decodeURIComponent(rxJson));
        let msg = `💊 *DENTAL PRESCRIPTION (Rx)*\n`;
        msg += `🏥 *MY DENTAL CLINIC*\n`;
        msg += `👤 *Patient:* ${rx.patientName}\n`;
        msg += `📅 *Date:* ${rx.date}\n`;
        msg += `---------------------------\n`;
        msg += `*PRESCRIBED MEDICINES:*\n`;
        (rx.medicines || []).forEach((m, i) => {
            msg += `${i + 1}. * ${m.name}*\n   Dosage: ${m.frequency} | Dur: ${m.duration}\n   Note: ${m.instructions}\n`;
        });
        if (rx.advice && rx.advice.length > 0) {
            msg += `---------------------------\n*ADVICE:*\n`;
            rx.advice.forEach(a => msg += `• ${a}\n`);
        }
        msg += `---------------------------\n✨ *Developed by proconixsoftware.vercel.app*`;
        const cleanMobile = (rx.patientMobile || '').replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (e) {
        console.error('Error reprinting Rx WhatsApp:', e);
    }
}


/* ==========================================================================
   CLINICAL MODULE: TREATMENT PLAN & COST QUOTATION BUILDER
   ========================================================================== */

let currentPlanItems = [];
window.currentPlanItems = currentPlanItems;

function addPlanTemplate(name, tooth, cost, sittings) {
    currentPlanItems.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name,
        tooth: tooth || 'General',
        sittings: Number(sittings) || 1,
        cost: Number(cost) || 0
    });
    renderPlanItemsTable();
    calculatePlanTotal();
}

function addCustomPlanItem() {
    const nameEl = document.getElementById('planItemName');
    const toothEl = document.getElementById('planItemTooth');
    const sittingsEl = document.getElementById('planItemSittings');
    const costEl = document.getElementById('planItemCost');

    const name = nameEl?.value?.trim();
    const tooth = toothEl?.value?.trim() || 'General';
    const sittings = Number(sittingsEl?.value) || 1;
    const cost = Number(costEl?.value) || 0;

    if (!name) {
        alert('Please enter procedure name.');
        nameEl?.focus();
        return;
    }
    if (cost < 0) {
        alert('Cost cannot be negative.');
        return;
    }

    currentPlanItems.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name,
        tooth: tooth,
        sittings: sittings,
        cost: cost
    });

    nameEl.value = '';
    toothEl.value = '';
    costEl.value = '';
    if (sittingsEl) sittingsEl.value = '1';

    renderPlanItemsTable();
    calculatePlanTotal();
}

function deletePlanItem(idx) {
    currentPlanItems.splice(idx, 1);
    renderPlanItemsTable();
    calculatePlanTotal();
}

function renderPlanItemsTable() {
    const tbody = document.getElementById('planItemsTableBody');
    if (!tbody) return;

    if (currentPlanItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No procedures added yet. Select from templates above.</td></tr>';
        return;
    }

    tbody.innerHTML = currentPlanItems.map((item, idx) => `
        <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px; font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
            <td style="padding: 8px; font-weight: 800; color: var(--secondary);">${escapeHtml(item.name)}</td>
            <td style="padding: 8px;"><span style="background: var(--bg-soft); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.8rem;">${escapeHtml(item.tooth)}</span></td>
            <td style="padding: 8px; text-align: center; font-weight: 700;">${item.sittings}</td>
            <td style="padding: 8px; font-weight: 800; color: var(--primary);">₹${item.cost.toLocaleString('en-IN')}</td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" onclick="deletePlanItem(${idx})" style="background: none; border: none; color: #EF4444; cursor: pointer; padding: 4px 8px; border-radius: 4px;" title="Remove procedure">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function calculatePlanTotal() {
    const subtotal = currentPlanItems.reduce((acc, item) => acc + (Number(item.cost) || 0), 0);
    const discountEl = document.getElementById('planDiscount');
    const discount = Number(discountEl?.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);

    const totalEl = document.getElementById('planGrandTotal');
    if (totalEl) {
        totalEl.innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
    }
    return { subtotal, discount, grandTotal };
}

function clearPlanForm() {
    currentPlanItems = [];
    renderPlanItemsTable();
    const discountEl = document.getElementById('planDiscount');
    if (discountEl) discountEl.value = '0';
    calculatePlanTotal();
}

async function saveAndGenerateTreatmentPlanPDF() {
    const activePatient = getActivePatient();
    if (!activePatient) {
        alert('Please select a patient first.');
        return;
    }
    if (currentPlanItems.length === 0) {
        alert('Please add at least one procedure to the treatment plan.');
        return;
    }

    const { subtotal, discount, grandTotal } = calculatePlanTotal();
    const status = document.getElementById('planStatus')?.value || 'Presented';

    const planRecord = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        patientName: activePatient.name,
        patientMobile: activePatient.mobile,
        patientPlace: activePatient.place || 'Local',
        items: [...currentPlanItems],
        subtotal: subtotal,
        discount: discount,
        grandTotal: grandTotal,
        status: status,
        createdAt: new Date().toISOString()
    };

    // Save to Firestore / localStorage
    try {
        if (window.dbAPI && typeof window.dbAPI.saveTreatmentPlan === 'function') {
            await window.dbAPI.saveTreatmentPlan(planRecord);
        }
    } catch (e) {
        console.warn('Error persisting treatment plan:', e);
    }

    // Generate Quotation PDF
    try {
        generateTreatmentPlanPDFDocument(planRecord);
    } catch (pdfErr) {
        console.error('Plan PDF generation error:', pdfErr);
        alert('Treatment plan saved! PDF generation had an issue.');
    }

    // Refresh history
    await loadPatientTreatmentPlans(activePatient.mobile);
    alert('Treatment Plan & Quotation saved and PDF generated!');
}

function generateTreatmentPlanPDFDocument(planRecord) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('jsPDF library not available.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Top Decorative Brand Bar (Teal Accent)
    doc.setFillColor(13, 148, 136); // #0D9488
    doc.rect(0, 0, 210, 6, 'F');

    // 2. Clinic Header
    const clinicName = window.currentClinicSettings?.clinic_name || 'MY DENTAL CLINIC';
    const clinicSubtitle = window.currentClinicSettings?.subtitle || 'Dental & Cosmetic Clinic';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text(clinicName.toUpperCase(), 20, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(13, 148, 136);
    doc.text(clinicSubtitle, 20, 28);

    // 3. Document Title (Right Aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('TREATMENT QUOTATION', 190, 22, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Estimate No: EST-${planRecord.id}`, 190, 28, { align: 'right' });
    doc.text(`Date: ${planRecord.date}`, 190, 32, { align: 'right' });

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, 36, 190, 36);

    // 4. Patient Information Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 40, 170, 22, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('PROPOSED FOR PATIENT:', 25, 46);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(planRecord.patientName.toUpperCase(), 25, 52);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Mobile: ${planRecord.patientMobile} | Location: ${planRecord.patientPlace} | Status: ${planRecord.status}`, 25, 57);

    // 5. Proposed Treatment Procedures Table
    let currentY = 70;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(13, 148, 136);
    doc.text('PROPOSED CLINICAL PROCEDURES & FEES', 20, currentY);
    currentY += 6;

    // Table Header
    doc.setFillColor(15, 23, 42);
    doc.rect(20, currentY, 170, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('#', 23, currentY + 5.5);
    doc.text('PROCEDURE / DESCRIPTION', 32, currentY + 5.5);
    doc.text('TOOTH', 115, currentY + 5.5);
    doc.text('SITTINGS', 140, currentY + 5.5);
    doc.text('EST. COST', 168, currentY + 5.5);
    currentY += 8;

    // Table Rows
    planRecord.items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? 255 : 248;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(20, currentY, 170, 9, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(idx + 1), 23, currentY + 6);

        doc.setFont('helvetica', 'bold');
        doc.text(item.name.substring(0, 38), 32, currentY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(String(item.tooth || 'All'), 115, currentY + 6);
        doc.text(String(item.sittings || 1), 145, currentY + 6);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`INR ${(item.cost || 0).toLocaleString('en-IN')}`, 168, currentY + 6);

        doc.setDrawColor(241, 245, 249);
        doc.line(20, currentY + 9, 190, currentY + 9);
        currentY += 9;
    });

    currentY += 6;

    // 6. Cost Summary Box (Right aligned)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(110, currentY, 80, 26, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', 115, currentY + 6);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${planRecord.subtotal.toLocaleString('en-IN')}`, 185, currentY + 6, { align: 'right' });

    doc.setTextColor(100, 116, 139);
    doc.text('Courtesy / Discount:', 115, currentY + 12);
    doc.setTextColor(220, 38, 38);
    doc.text(`- INR ${planRecord.discount.toLocaleString('en-IN')}`, 185, currentY + 12, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(115, currentY + 15, 185, currentY + 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text('TOTAL ESTIMATE:', 115, currentY + 22);
    doc.text(`INR ${planRecord.grandTotal.toLocaleString('en-IN')}`, 185, currentY + 22, { align: 'right' });

    currentY += 34;

    // 7. Clinical Notes & Terms
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('TERMS & CLINICAL NOTES:', 20, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('1. Treatment quotation is valid for 30 calendar days from the date of issue.', 24, currentY);
    doc.text('2. Fees cover scheduled sittings. Unforeseen complications may require clinical adjustments.', 24, currentY + 4.5);
    doc.text('3. Flexible multi-sitting milestone payments and zero-cost EMI options are available.', 24, currentY + 9);

    // 8. Doctor Signature Block
    doc.setDrawColor(203, 213, 225);
    doc.line(135, 255, 190, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('CONSULTING DENTIST', 135, 260);

    // 9. Attribution Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 275, 190, 275);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const clinicTitle = (window.currentClinicSettings?.clinic_name || 'MY DENTAL CLINIC').toUpperCase();
    doc.text(`${clinicTitle} | Empowering Healthy Smiles Every Day`, 20, 281);
    doc.text('Developed by proconixsoftware.vercel.app', 190, 281, { align: 'right' });

    // Save PDF
    const cleanName = (planRecord.patientName || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Estimate_${cleanName}_${planRecord.id}.pdf`);
}

function shareTreatmentPlanWhatsApp() {
    const activePatient = getActivePatient();
    if (!activePatient) {
        alert('Please select a patient first.');
        return;
    }
    if (currentPlanItems.length === 0) {
        alert('Please add at least one procedure to the treatment plan.');
        return;
    }

    const { subtotal, discount, grandTotal } = calculatePlanTotal();

    const clinicTitle = (window.currentClinicSettings?.clinic_name || 'MY DENTAL CLINIC').toUpperCase();
    let msg = `📋 *TREATMENT PLAN & ESTIMATE*\n`;
    msg += `🏥 *${clinicTitle}*\n`;
    msg += `👤 *Patient:* ${activePatient.name}\n`;
    msg += `📅 *Date:* ${new Date().toLocaleDateString()}\n`;
    msg += `---------------------------\n`;
    msg += `*PROPOSED PROCEDURES:*\n`;
    currentPlanItems.forEach((item, i) => {
        msg += `${i + 1}. * ${item.name}*\n   Tooth: ${item.tooth} | Sittings: ${item.sittings}\n   Cost: ₹${item.cost.toLocaleString('en-IN')}\n`;
    });
    msg += `---------------------------\n`;
    msg += `*Subtotal:* ₹${subtotal.toLocaleString('en-IN')}\n`;
    if (discount > 0) {
        msg += `*Discount:* -₹${discount.toLocaleString('en-IN')}\n`;
    }
    msg += `*GRAND TOTAL ESTIMATE:* ₹${grandTotal.toLocaleString('en-IN')}\n`;
    msg += `---------------------------\n`;
    msg += `_Note: Flexible milestone payments available._\n`;
    msg += `✨ *Developed by proconixsoftware.vercel.app*`;

    const cleanMobile = (activePatient.mobile || '').replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

async function loadPatientTreatmentPlans(mobile) {
    const container = document.getElementById('patientTreatmentPlansHistoryList');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading treatment plans...</div>';

    let list = [];
    try {
        if (window.dbAPI && typeof window.dbAPI.getTreatmentPlans === 'function') {
            list = await window.dbAPI.getTreatmentPlans(mobile);
        }
    } catch (e) {
        console.warn('Failed to load treatment plans:', e);
    }

    if (!list || list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">No past treatment plans recorded for this patient.</div>';
        return;
    }

    container.innerHTML = list.map(plan => {
        const safePlanJson = encodeURIComponent(JSON.stringify(plan));
        const itemNames = (plan.items || []).map(i => i.name).join(', ');
        return `
            <div style="background: var(--bg-soft); border-radius: 10px; padding: 1rem 1.25rem; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <span style="font-weight: 800; color: var(--secondary); font-size: 0.95rem;">Plan #${plan.id}</span>
                        <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; font-weight: 800;">${plan.status || 'Presented'}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">${plan.date || 'N/A'}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: #475569; max-width: 450px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemNames}">
                        ${itemNames || 'No items listed'}
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 800; color: var(--primary); margin-top: 2px;">
                        Total: ₹${(plan.grandTotal || 0).toLocaleString('en-IN')}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="reprintTreatmentPlanPDF('${safePlanJson}')" class="btn-primary" style="height: 32px; font-size: 0.75rem; padding: 0 0.85rem; background: var(--primary);" title="Download Quotation PDF">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button onclick="reprintTreatmentPlanWhatsApp('${safePlanJson}')" class="btn-primary" style="height: 32px; font-size: 0.75rem; padding: 0 0.85rem; background: #25D366;" title="Share WhatsApp">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function reprintTreatmentPlanPDF(planJson) {
    try {
        const plan = JSON.parse(decodeURIComponent(planJson));
        generateTreatmentPlanPDFDocument(plan);
    } catch (e) {
        console.error('Error reprinting treatment plan PDF:', e);
    }
}

function reprintTreatmentPlanWhatsApp(planJson) {
    try {
        const clinicTitle = (window.currentClinicSettings?.clinic_name || 'MY DENTAL CLINIC').toUpperCase();
        let msg = `📋 *TREATMENT PLAN & ESTIMATE*\n`;
        msg += `🏥 *${clinicTitle}*\n`;
        msg += `👤 *Patient:* ${plan.patientName}\n`;
        msg += `📅 *Date:* ${plan.date}\n`;
        msg += `---------------------------\n`;
        msg += `*PROPOSED PROCEDURES:*\n`;
        (plan.items || []).forEach((item, i) => {
            msg += `${i + 1}. * ${item.name}*\n   Tooth: ${item.tooth} | Sittings: ${item.sittings}\n   Cost: ₹${(item.cost || 0).toLocaleString('en-IN')}\n`;
        });
        msg += `---------------------------\n`;
        msg += `*Subtotal:* ₹${(plan.subtotal || 0).toLocaleString('en-IN')}\n`;
        if (plan.discount > 0) {
            msg += `*Discount:* -₹${(plan.discount || 0).toLocaleString('en-IN')}\n`;
        }
        msg += `*GRAND TOTAL ESTIMATE:* ₹${(plan.grandTotal || 0).toLocaleString('en-IN')}\n`;
        msg += `---------------------------\n`;
        msg += `✨ *Developed by proconixsoftware.vercel.app*`;
        const cleanMobile = (plan.patientMobile || '').replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (e) {
        console.error('Error reprinting treatment plan WhatsApp:', e);
    }
}

/* Mobile-First Bottom Navigation Handler */
function openLoginModal() {
    if (typeof showLoginModal === 'function') {
        showLoginModal();
    } else {
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'flex';
    }
}
window.openLoginModal = openLoginModal;

function handleMobileNav(target) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => item.classList.remove('active'));
    
    if (target === 'home') {
        const item = document.getElementById('mobNavHome');
        if (item) item.classList.add('active');
        showSection('home');
        if (typeof scrollToBooking === 'function') scrollToBooking();
    } else if (target === 'schedule') {
        const item = document.getElementById('mobNavSchedule');
        if (item) item.classList.add('active');
        if (sessionStorage.getItem('staffUser')) {
            showSection('dashboard');
            if (typeof showDashboardTab === 'function') showDashboardTab('schedule');
        } else {
            openLoginModal();
        }
    } else if (target === 'patients') {
        const item = document.getElementById('mobNavPatients');
        if (item) item.classList.add('active');
        if (sessionStorage.getItem('staffUser')) {
            showSection('dashboard');
            if (typeof showDashboardTab === 'function') showDashboardTab('patients');
        } else {
            openLoginModal();
        }
    } else if (target === 'portal') {
        const item = document.getElementById('mobNavPortal');
        if (item) item.classList.add('active');
        if (sessionStorage.getItem('staffUser')) {
            showSection('dashboard');
        } else {
            openLoginModal();
        }
    }
}
