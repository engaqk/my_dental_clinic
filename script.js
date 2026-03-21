let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAppointments();
    initializeDateTimePickers();
});

// Initialize date and time pickers
function initializeDateTimePickers() {
    const dateInput = document.getElementById('appointmentDate');
    const timeSelect = document.getElementById('appointmentTime');

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
    dateInput.value = today;

    // Generate time slots when date changes
    dateInput.addEventListener('change', () => {
        generateTimeSlots();
    });

    // Generate initial time slots
    generateTimeSlots();
}

// Generate 30-minute time slots: 11 AM - 2 PM and 4 PM - 7 PM
async function generateTimeSlots() {
    const timeSelect = document.getElementById('appointmentTime');
    const selectedDate = document.getElementById('appointmentDate').value;

    timeSelect.innerHTML = '<option value="">Loading slots...</option>';
    timeSelect.disabled = true;

    // Fetch booked slots ONCE for the entire day
    let bookedSlots = [];
    try {
        bookedSlots = await window.dbAPI.getBookedTimeSlots(selectedDate);
    } catch (e) {
        console.error("Failed to load booked slots", e);
    }

    timeSelect.innerHTML = '<option value="">Select time slot...</option>';
    timeSelect.disabled = false;

    const slotDuration = 30; // minutes

    // Morning session: 11 AM to 2 PM
    const morningStart = 11;
    const morningEnd = 14; // 2 PM in 24-hour format

    // Evening session: 4 PM to 7 PM
    const eveningStart = 16; // 4 PM in 24-hour format
    const eveningEnd = 19; // 7 PM in 24-hour format

    // Current time logic to filter past slots
    const now = new Date();
    const isToday = selectedDate === now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Helper to check if time is in past for today
    const isPast = (h, m) => {
        if (!isToday) return false;
        if (h < currentHour) return true;
        if (h === currentHour && m < currentMinute) return true;
        return false;
    };

    const addSlot = (hour, minute) => {
        // Skip if slot is in the past
        if (isPast(hour, minute)) return;

        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = formatTime(hour, minute);

        // Check against pre-fetched bookedSlots
        // Robust check: handle if slot matches either exact string or starts with the time
        // (e.g. "11:00" matches "11:00" or "11:00:00")
        const isBooked = bookedSlots.some(slot =>
            slot === timeString || slot.startsWith(timeString)
        );

        if (!isBooked) {
            const option = document.createElement('option');
            option.value = timeString;
            option.textContent = displayTime;
            timeSelect.appendChild(option);
        } else {
            const option = document.createElement('option');
            option.value = timeString;
            option.textContent = `${displayTime} (Booked)`;
            option.disabled = true;
            option.style.color = '#999';
            timeSelect.appendChild(option);
        }
    };

    // Generate morning slots
    for (let hour = morningStart; hour < morningEnd; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
            addSlot(hour, minute);
        }
    }

    // Generate evening slots
    for (let hour = eveningStart; hour < eveningEnd; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
            addSlot(hour, minute);
        }
    }
}

// Format time to 12-hour format
function formatTime(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Check if a time slot is available (checks Supabase database)
async function isSlotAvailable(date, time) {
    try {
        // Get booked slots from Supabase
        const bookedSlots = await window.dbAPI.getBookedTimeSlots(date);
        // Robust check: return TRUE if NO slot matches "time" or "time:00"
        return !bookedSlots.some(slot => slot === time || slot.startsWith(time));
    } catch (error) {
        console.error('Error checking slot availability:', error);
        // Fallback to localStorage if Supabase fails
        const appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
        return !appointments.some(app =>
            app.appointmentDate === date &&
            app.appointmentTime === time &&
            app.status !== 'Cancelled'
        );
    }
}

const form = document.getElementById('bookingForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const place = document.getElementById('place').value;
    const mobile = document.getElementById('mobile').value;
    const appointmentDate = document.getElementById('appointmentDate').value;
    const appointmentTime = document.getElementById('appointmentTime').value;
    const reason = document.getElementById('reason').value;

    // Double-check slot availability
    const available = await isSlotAvailable(appointmentDate, appointmentTime);
    if (!available) {
        alert('Sorry, this time slot has just been booked. Please select another time.');
        generateTimeSlots(); // Refresh slots
        return;
    }

    const appointment = {
        id: Date.now(),
        date: new Date().toLocaleDateString(), // Booking date
        appointmentDate: appointmentDate, // Actual appointment date
        appointmentTime: appointmentTime,
        appointmentDateTime: `${appointmentDate} ${appointmentTime}`, // Combined for display
        name,
        place,
        mobile,
        reason,
        fee: 0,
        status: 'Pending'
    };

    const success = await saveAppointment(appointment);

    if (success) {
        form.reset();
        initializeDateTimePickers(); // Reset date/time pickers
        // Show Modal instead of alert
        showBookingModal(appointment);

        // TRIGGER SERVERLESS NOTIFICATION
        triggerBookingNotification(appointment);
    }
});

/**
 * Trigger Serverless Notification API
 */
async function triggerBookingNotification(appointment) {
    try {
        const settings = JSON.parse(localStorage.getItem('clinicSettings')) || {};
        await fetch('/api/booking-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appointmentId: appointment.id,
                name: appointment.name,
                mobile: window.phoneUtils.normalize(appointment.mobile),
                date: appointment.appointmentDate,
                time: appointment.appointmentTime,
                reason: appointment.reason,
                clinicName: settings.name || "My Dental Clinic"
            })
        });
        console.log('Notification triggered successfully');
    } catch (e) {
        console.error('Failed to trigger notification:', e);
    }
}

function showBookingModal(appointment) {
    const modal = document.getElementById('bookingModal');
    const linkBtn = document.getElementById('calendarLink');

    // Generate Google Calendar Link
    // Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=TEXT&dates=DATES&details=DETAILS&location=LOCATION
    const title = encodeURIComponent(`Dentist Appointment: ${appointment.reason}`);
    const details = encodeURIComponent(`Appointment with My Dental Clinic.\\nPatient: ${appointment.name}\\nReason: ${appointment.reason}`);
    const location = encodeURIComponent("My Dental Clinic - Advance Dental clinic");

    // Dates need to be YYYYMMDDTHHMMSSZ (UTC or local time without zone)
    // appointment.appointmentDate is YYYY-MM-DD
    // appointment.appointmentTime is HH:mm
    const datePart = appointment.appointmentDate.replace(/-/g, "");
    const timePart = appointment.appointmentTime.replace(/:/g, "") + "00";
    
    const start = `${datePart}T${timePart}`;
    // Add 30 minutes for the end time (matching our slot duration)
    const endHour = parseInt(appointment.appointmentTime.split(':')[0]);
    const endMin = (parseInt(appointment.appointmentTime.split(':')[1]) + 30);
    const endMinStr = endMin >= 60 ? (endMin - 60).toString().padStart(2, '0') : endMin.toString().padStart(2, '0');
    const endHourStr = endMin >= 60 ? (endHour + 1).toString().padStart(2, '0') : endHour.toString().padStart(2, '0');
    const end = `${datePart}T${endHourStr}${endMinStr}00`;

    const href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;

    if (linkBtn) linkBtn.href = href;
    modal.style.display = "flex";
}

function closeBookingModal() {
    closeModal();
}

function closeModal() {
    document.getElementById('bookingModal').style.display = "none";
    showSection('home');
}

// Close modal if clicked outside
window.onclick = function (event) {
    const modal = document.getElementById('bookingModal');
    if (event.target == modal) {
        closeModal();
    }
}

async function saveAppointment(appointment) {
    try {
        await window.dbAPI.createAppointment(appointment);
        await loadAppointments();
        return true;
    } catch (error) {
        console.error('Error saving appointment:', error);
        alert('Failed to save appointment. Please try again.');
        return false;
    }
}

function filterAppointments() {
    loadAppointments();
}

async function loadAppointments() {
    let appointments = await window.dbAPI.getAppointments();
    const tbody = document.querySelector('#patientsTable tbody');
    const cardsContainer = document.getElementById('patientsCards');
    const noData = document.getElementById('noDataMessage');

    // Filter Logic
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const dateFilter = document.getElementById('dateFilter').value;
    const todayStr = new Date().toLocaleDateString();

    let filtered = appointments.filter(app => {
        const matchesSearch = app.name.toLowerCase().includes(searchText) ||
            app.mobile.includes(searchText) ||
            app.place.toLowerCase().includes(searchText);

        let matchesDate = true;
        if (dateFilter === 'today') {
            matchesDate = app.date === todayStr;
        }

        return matchesSearch && matchesDate;
    });

    tbody.innerHTML = '';
    cardsContainer.innerHTML = '';

    if (filtered.length === 0) {
        noData.style.display = 'block';
    } else {
        noData.style.display = 'none';
        // Sort by newest first
        filtered.sort((a, b) => b.id - a.id).forEach(app => {
            // Calendar Link
            // Dynamic Calendar Link based on session time
            let start = "", end = "";
            if (app.appointmentDate && app.appointmentTime) {
                const datePart = app.appointmentDate.replace(/-/g, "");
                const timePart = app.appointmentTime.replace(/:/g, "") + "00";
                start = `${datePart}T${timePart}`;
                const endHour = parseInt(app.appointmentTime.split(':')[0]);
                const endMin = (parseInt(app.appointmentTime.split(':')[1]) + 30);
                const endMinStr = endMin >= 60 ? (endMin - 60).toString().padStart(2, '0') : endMin.toString().padStart(2, '0');
                const endHourStr = endMin >= 60 ? (endHour + 1).toString().padStart(2, '0') : endHour.toString().padStart(2, '0');
                end = `${datePart}T${endHourStr}${endMinStr}00`;
            } else {
                const now = new Date();
                start = now.toISOString().replace(/-|:|\.\d\d\d/g, "");
                end = new Date(now.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
            }
            const title = encodeURIComponent(`Patient: ${app.name} (${app.reason})`);
            const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=Mobile: ${app.mobile}&location=Clinic`;

            // CREATE MOBILE CARD
            const card = document.createElement('div');
            card.className = `patient-card ${app.status === 'Cancelled' ? 'cancelled' : ''}`;
            card.innerHTML = `
                <div class="patient-card-header">
                    <div>
                        <div class="patient-card-name">${app.name}</div>
                        <div class="patient-card-date">Booked: ${app.date}</div>
                    </div>
                </div>
                <div class="patient-card-body">
                    <div class="patient-card-row">
                        <span class="patient-card-label">📅 Appointment:</span>
                        <span class="patient-card-value">${app.appointmentDate || app.date} ${app.appointmentTime ? 'at ' + formatTime12Hour(app.appointmentTime) : ''}</span>
                    </div>
                    <div class="patient-card-row">
                        <span class="patient-card-label">Place:</span>
                        <span class="patient-card-value">${app.place}</span>
                    </div>
                    <div class="patient-card-row">
                        <span class="patient-card-label">Mobile:</span>
                        <span class="patient-card-value">${app.mobile}</span>
                    </div>
                    <div class="patient-card-row">
                        <span class="patient-card-label">Treatment:</span>
                        <span class="patient-card-value">${app.reason}</span>
                    </div>
                </div>
                <div class="patient-card-actions">
                    <select onchange="updateStatus(${app.id}, this.value)" style="${app.status === 'Cancelled' ? 'color: red;' : ''}">
                        <option value="Pending" ${app.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${app.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                    <input type="number" value="${app.fee}" id="fee-card-${app.id}" placeholder="Fee (₹)">
                    <button onclick="updateFeeCard(${app.id})" title="Save Fee" class="btn-primary"><i class="fas fa-save"></i></button>
                    <a href="${calUrl}" target="_blank" title="Calendar" class="btn-primary" style="background-color: #4CAF50; text-decoration: none;"><i class="fas fa-calendar"></i></a>
                    <button onclick="deleteAppointment(${app.id})" title="Delete" class="btn-primary" style="background-color: #dc3545;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            cardsContainer.appendChild(card);

            // CREATE DESKTOP TABLE ROW
            const row = document.createElement('tr');
            if (app.status === 'Cancelled') {
                row.style.opacity = '0.6';
                row.style.background = '#f9f9f9';
            }

            row.innerHTML = `
                <td>
                    <strong>${app.appointmentDate || app.date}</strong><br>
                    <small style="color:#666">${app.appointmentTime ? formatTime12Hour(app.appointmentTime) : 'Time TBD'}</small>
                </td>
                <td>
                    <strong>${app.name}</strong><br>
                    <small style="color:#666">${app.place} | ${app.mobile}</small>
                </td>
                <td>${app.reason}</td>
                <td>
                    <select onchange="updateStatus(${app.id}, this.value)" 
                            style="padding: 5px; border-radius: 5px; border: 1px solid #ddd; ${app.status === 'Cancelled' ? 'color: red;' : ''}">
                        <option value="Pending" ${app.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${app.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>
                    <input type="number" value="${app.fee}" id="fee-${app.id}" style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 5px;">
                </td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="updateFee(${app.id})" title="Save Fee" class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-save"></i></button>
                        <a href="${calUrl}" target="_blank" title="Add to Calendar" class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background-color: #4CAF50; text-decoration: none;"><i class="fas fa-calendar"></i></a>
                        <button onclick="deleteAppointment(${app.id})" title="Delete" class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background-color: #dc3545;"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updateStats(appointments);
    updateChart(appointments);
}

// Helper function to format time in 12-hour format
function formatTime12Hour(timeString) {
    if (!timeString) return '';
    const [hour, minute] = timeString.split(':').map(Number);
    return formatTime(hour, minute);
}

// New function for updating fee from card view
async function updateFeeCard(id) {
    const feeInput = document.getElementById(`fee-card-${id}`);
    const newFee = parseFloat(feeInput.value) || 0;

    try {
        await window.dbAPI.updateAppointment(id, { fee: newFee });
        alert('Fee updated!');
        await loadAppointments();
    } catch (error) {
        console.error('Error updating fee:', error);
        alert('Failed to update fee.');
    }
}


async function updateStatus(id, newStatus) {
    try {
        await window.dbAPI.updateAppointment(id, { status: newStatus });
        await loadAppointments();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status.');
    }
}

async function updateFee(id) {
    const feeInput = document.getElementById(`fee-${id}`);
    const newFee = parseFloat(feeInput.value) || 0;

    try {
        await window.dbAPI.updateAppointment(id, { fee: newFee });
        alert('Fee updated!');
        await loadAppointments();
    } catch (error) {
        console.error('Error updating fee:', error);
        alert('Failed to update fee.');
    }
}

async function deleteAppointment(id) {
    if (confirm('Are you sure you want to delete this record?')) {
        try {
            await window.dbAPI.deleteAppointment(id);
            await loadAppointments();
        } catch (error) {
            console.error('Error deleting appointment:', error);
            alert('Failed to delete appointment.');
        }
    }
}

function updateStats(appointments) {
    // Stats usually show total historical data
    const totalPatients = appointments.length;
    // Calculate earnings only from non-cancelled? Or all recorded fees? Usually all recorded.
    // If Cancelled, maybe fee should be 0, but user might want to charge cancellation fee.
    const totalEarnings = appointments.reduce((sum, app) => sum + (parseFloat(app.fee) || 0), 0);
    const pendingVisits = appointments.filter(a => a.status === 'Pending').length;

    document.getElementById('totalPatients').innerText = totalPatients;
    document.getElementById('totalEarnings').innerText = '₹' + totalEarnings.toLocaleString();
    document.getElementById('pendingVisits').innerText = pendingVisits;
}

function updateChart(appointments) {
    const ctx = document.getElementById('treatmentChart');
    if (!ctx) return; // Guard against running on pages without chart

    // Aggregate by reason
    const reasonCounts = {};
    appointments.forEach(app => {
        reasonCounts[app.reason] = (reasonCounts[app.reason] || 0) + 1;
    });

    const labels = Object.keys(reasonCounts);
    const data = Object.values(reasonCounts);

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: '# of Patients',
                data: data,
                backgroundColor: [
                    '#0d4b9f', // Primary
                    '#d4af37', // Gold
                    '#4CAF50', // Green
                    '#FFC107', // Amber
                    '#9C27B0', // Purple
                    '#FF5722'  // Orange
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

/* --- White Label Settings Logic --- */

document.addEventListener('DOMContentLoaded', () => {
    loadClinicSettings();
    if (typeof checkSuperAdmin === 'function') checkSuperAdmin();
});

function checkSuperAdmin() {
    try {
        const btn = document.getElementById('settingsBtn');
        if (!btn) return;

        const userStr = sessionStorage.getItem('staffUser');
        const user = userStr ? JSON.parse(userStr) : null;

        // STRICT CHECK
        if (user && user.role === 'super_admin') {
            console.log('Super Admin detected: Showing settings.');
            btn.style.display = 'inline-block';
        } else {
            console.log('Not Super Admin: Hiding settings.');
            btn.style.display = 'none';
            btn.style.setProperty('display', 'none', 'important'); // Force hide
        }
    } catch (e) {
        console.error('Check Super Admin Error:', e);
    }
}

// Global for access from auth.js
window.checkSuperAdmin = checkSuperAdmin;

window.openSettingsModal = async function () {
    const modal = document.getElementById('settingsModal');
    const settings = JSON.parse(localStorage.getItem('clinicSettings')) || {};
    const gateway = await window.dbAPI.getGatewaySettings();

    document.getElementById('settingClinicName').value = settings.name || "My Dental Clinic";
    document.getElementById('settingSubtitle').value = settings.subtitle || "Advance Dental clinic";
    document.getElementById('settingAdminEmail').value = settings.adminEmail || "";
    document.getElementById('settingPrimaryColor').value = settings.primaryColor || "#26A69A";

    document.getElementById('settingGatewayApiKey').value = gateway.apiKey || "";
    document.getElementById('settingGatewayDeviceId').value = gateway.deviceId || "";

    document.getElementById('settingAdminUser').value = settings.adminUser || "drashtijani1812@gmail.com";
    document.getElementById('settingAdminPass').value = settings.adminPass || "drashti@123";
    document.getElementById('settingAboutText').value = settings.aboutText || ""; // Load About Text

    modal.style.display = 'flex';
};

window.closeSettingsModal = function () {
    document.getElementById('settingsModal').style.display = 'none';
};

const settingsForm = document.getElementById('settingsForm');
if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const settings = {
            name: document.getElementById('settingClinicName').value,
            subtitle: document.getElementById('settingSubtitle').value,
            adminEmail: document.getElementById('settingAdminEmail').value,
            primaryColor: document.getElementById('settingPrimaryColor').value,
            adminUser: document.getElementById('settingAdminUser').value,
            adminPass: document.getElementById('settingAdminPass').value,
            aboutText: document.getElementById('settingAboutText').value
        };

        const gatewaySettings = {
            apiKey: document.getElementById('settingGatewayApiKey').value,
            deviceId: document.getElementById('settingGatewayDeviceId').value
        };

        applySettings(settings);

        // Save to Cloud (and local inside the method)
        const btn = settingsForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        await Promise.all([
            window.dbAPI.saveSettings(settings),
            window.dbAPI.saveGatewaySettings(gatewaySettings)
        ]);

        btn.textContent = originalText;
        btn.disabled = false;

        closeSettingsModal();
        alert('Settings saved successfully!');
    });
}

async function loadClinicSettings() {
    try {
        let settings = {};
        // Try to fetch from Supabase if connected
        if (window.dbAPI) {
            const data = await window.dbAPI.getSettings();
            // If data comes from DB (snake_case), map it
            if (data && data.clinic_name) {
                settings = {
                    name: data.clinic_name,
                    subtitle: data.subtitle,
                    adminEmail: data.admin_email,
                    primaryColor: data.primary_color,
                    adminUser: data.admin_user,
                    adminPass: data.admin_pass,
                    aboutText: data.about_text
                };
                // Cache locally
                localStorage.setItem('clinicSettings', JSON.stringify(settings));
            } else if (data && data.name) {
                // From local storage fallback
                settings = data;
            }
        } else {
            settings = JSON.parse(localStorage.getItem('clinicSettings'));
        }

        if (settings && Object.keys(settings).length > 0) applySettings(settings);
    } catch (e) {
        console.error("Error loading settings:", e);
    }
}

function applySettings(settings) {
    if (settings.name) {
        const h1 = document.querySelector('.clinic-name h1');
        if (h1) h1.textContent = settings.name;
        document.title = settings.name;
        const footerP = document.getElementById('footerCopyright');
        if (footerP) {
            footerP.innerHTML = `&copy; 2026 ${settings.name}${settings.subtitle ? ' - ' + settings.subtitle : ''}. All rights reserved.`;
        }
    }
    if (settings.subtitle) {
        const span = document.querySelector('.clinic-name span');
        if (span) span.textContent = settings.subtitle;
    }
    if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
    }
    if (settings.secondaryColor) {
        document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor);
    }

    // About Page Logic
    const aboutNav = document.getElementById('navAbout');
    const aboutContent = document.getElementById('aboutContent');
    const aboutSection = document.getElementById('about');

    if (settings.aboutText && settings.aboutText.trim() !== "") {
        if (aboutNav) aboutNav.style.display = 'block';
        if (aboutSection) aboutSection.style.display = 'block'; // Show entire section
        if (aboutContent) aboutContent.innerText = settings.aboutText;
    } else {
        if (aboutNav) aboutNav.style.display = 'none';
        if (aboutSection) aboutSection.style.display = 'none';
    }
}

function showSection(sectionId) {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';

    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

/* --- PULSE SMS ENGINE UI LOGIC --- */

let allRecipients = [];
let currentPage = 1;
const rowsPerPage = 10; // Modified to 10 per page

function showDashboardTab(tabName) {
    const tabs = document.querySelectorAll('.dashboard-tab');
    tabs.forEach(t => t.style.display = 'none');
    
    if (tabName === 'broadcast') {
        document.getElementById('broadcastTab').style.display = 'block';
        document.getElementById('broadcastBtn').style.background = '#0d4b9f';
        // Add a back button/breadcrumb if needed
        initBroadcastHistory();
    } else {
        document.getElementById('patientsTab').style.display = 'block';
        document.getElementById('broadcastBtn').style.background = '#555';
    }
}

async function previewRecipients() {
    const previewEl = document.getElementById('recipientPreview');
    previewEl.style.display = 'block';
    previewEl.scrollIntoView({ behavior: 'smooth' });

    document.getElementById('recipientsBody').innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading recipients...</td></tr>';
    
    allRecipients = await window.dbAPI.getBroadcastRecipients();
    document.getElementById('previewCount').textContent = allRecipients.length;
    
    currentPage = 1;
    renderRecipientsTable();
}

function renderRecipientsTable() {
    const tbody = document.getElementById('recipientsBody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginated = allRecipients.slice(start, end);

    const selectAllCheckbox = document.getElementById('selectAllRecipients');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    toggleBulkDeleteBtn();

    paginated.forEach(r => {
        const row = document.createElement('tr');
        const isMarketing = r.source.includes('Marketing');
        row.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="recipient-checkbox" data-phone="${r.mobile}" onchange="updateSelectedRecipients()">
            </td>
            <td>${r.name}</td>
            <td>${r.mobile}</td>
            <td><span class="source-tag">${r.source}</span></td>
            <td style="text-align: right;">
                ${isMarketing ? `<button onclick="removeSingleRecipient('${r.mobile}', '${r.id}')" class="btn-primary" style="background: transparent; color: #dc3545; border: none; padding: 0; font-size: 1rem;"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });

    const totalPages = Math.ceil(allRecipients.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderRecipientsTable();
    }
});

document.getElementById('nextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil(allRecipients.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderRecipientsTable();
    }
});

/* --- BROADCAST RECIPIENT DELETION LOGIC --- */

function toggleSelectAllRecipients(source) {
    const checkboxes = document.querySelectorAll('.recipient-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateSelectedRecipients();
}

function updateSelectedRecipients() {
    toggleBulkDeleteBtn();
}

function toggleBulkDeleteBtn() {
    const selected = document.querySelectorAll('.recipient-checkbox:checked').length;
    const btn = document.getElementById('bulkDeleteBtn');
    if (btn) btn.style.display = selected > 0 ? 'inline-block' : 'none';
}

async function removeSingleRecipient(phone, id) {
    if (!confirm("Are you sure you want to delete this marketing contact?")) return;
    
    // UI update
    allRecipients = allRecipients.filter(r => r.mobile !== phone);
    renderRecipientsTable();
    document.getElementById('previewCount').textContent = allRecipients.length;

    // Database update
    if (id && id !== 'undefined') {
        try {
            await window.dbAPI.deleteMarketingContact(id);
        } catch (e) {
            console.error("Failed to delete from DB:", e);
        }
    }
}

async function deleteSelectedRecipients() {
    const selectedCheckboxes = document.querySelectorAll('.recipient-checkbox:checked');
    const phonesToDelete = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-phone'));
    
    if (phonesToDelete.length === 0) return;
    
    // Identify which ones are marketing contacts to delete from DB
    const marketingRecipients = allRecipients.filter(r => phonesToDelete.includes(r.mobile) && r.id);
    const marketingIds = marketingRecipients.map(r => r.id);

    if (!confirm(`Delete ${phonesToDelete.length} selected recipients?`)) return;

    // UI Update
    allRecipients = allRecipients.filter(r => !phonesToDelete.includes(r.mobile));
    renderRecipientsTable();
    document.getElementById('previewCount').textContent = allRecipients.length;

    // Database Update
    if (marketingIds.length > 0) {
        try {
            await window.dbAPI.deleteManyMarketingContacts(marketingIds);
            alert("Marketing contacts deleted from database.");
        } catch (e) {
            console.error("Batch delete failed:", e);
        }
    }
}

async function sendBroadcast() {
    const message = document.getElementById('broadcastMessage').value;
    if (!message) {
        alert('Please enter a message to broadcast.');
        return;
    }

    if (allRecipients.length === 0) {
        allRecipients = await window.dbAPI.getBroadcastRecipients();
    }

    if (allRecipients.length === 0) {
        alert('No recipients found to send message to.');
        return;
    }

    if (!confirm(`Are you sure you want to send this broadcast to ${allRecipients.length} recipients?`)) return;

    const btn = document.getElementById('sendBroadcastBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
        const phones = allRecipients.map(r => r.mobile);
        const response = await fetch('/api/send-bulk-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipients: phones, message })
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        alert(`Broadcast initiated! Sent: ${result.sent}, Failed: ${result.failed}`);
        document.getElementById('broadcastMessage').value = '';
    } catch (e) {
        console.error('Broadcast failed:', e);
        alert('Broadcast failed: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function initBroadcastHistory() {
    if (window.broadcastUnsubscribe) window.broadcastUnsubscribe();
    
    window.broadcastUnsubscribe = window.dbAPI.onBroadcastHistoryChange((history) => {
        const list = document.getElementById('broadcastHistoryList');
        if (history.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #888; padding: 2rem;">No recent broadcasts.</div>';
            return;
        }

        list.innerHTML = history.map(h => `
            <div class="history-item" style="padding: 1rem; border-bottom: 1px solid #eee; background: white; margin-bottom: 0.5rem; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <span style="font-weight: bold; color: var(--primary-color);">${h.timestamp?.toDate().toLocaleString() || 'Just now'}</span>
                    <span class="status-badge ${h.status.toLowerCase()}" style="padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; background: ${h.status === 'DELIVERED' ? '#e6f4ea' : '#fce8e6'}; color: ${h.status === 'DELIVERED' ? '#1e7e34' : '#c5221f'};">
                        ${h.status}
                    </span>
                </div>
                <p style="font-size: 0.9rem; margin-bottom: 0.5rem; color: #444;">${h.message}</p>
                <div style="font-size: 0.8rem; color: #666;">
                    <i class="fas fa-users"></i> ${h.recipientsCount} Recipients | 
                    <i class="fas fa-check"></i> ${h.sentCount || h.recipientsCount} Sent |
                    <i class="fas fa-times"></i> ${h.failedCount || 0} Failed
                </div>
            </div>
        `).join('');
    });
}

/**
 * Pulse Manual Contact Add: Zero-Latency Logic
 */
async function addManualContact() {
    const nameInput = document.getElementById('manualContactName');
    const phoneInput = document.getElementById('manualContactPhone');
    const errorEl = document.getElementById('manualContactError');
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name || phone.length !== 10) {
        errorEl.textContent = "Please enter valid name and 10-digit number.";
        errorEl.style.display = "block";
        return;
    }

    errorEl.style.display = "none";
    const normalized = window.phoneUtils.normalize(phone);

    // Ensure the preview is visible when we add a contact
    const previewEl = document.getElementById('recipientPreview');
    if (previewEl && previewEl.style.display !== 'block') {
        previewEl.style.display = 'block';
        previewEl.scrollIntoView({ behavior: 'smooth' });
    }

    // Update local state immediately for ZERO-LATENCY feel
    if (previewEl) {
        const isDuplicate = allRecipients.some(r => r.mobile === normalized);
        if (!isDuplicate) {
            allRecipients.push({ name: name, mobile: normalized, source: 'Marketing (Local Update)' });
            allRecipients.sort((a,b) => a.name.localeCompare(b.name));
            renderRecipientsTable();
            document.getElementById('previewCount').textContent = allRecipients.length;
        }
    }

    // Clear inputs and persist in background
    nameInput.value = '';
    phoneInput.value = '';
    
    try {
        await window.dbAPI.addMarketingContact({ name, mobile: normalized });
        console.log("Contact persisted in background via Marketing Persistence");
    } catch (e) { console.error("Persistence failed:", e); }
}

// Character counter for broadcast
document.getElementById('broadcastMessage')?.addEventListener('input', (e) => {
    const len = e.target.value.length;
    document.getElementById('charCount').textContent = `${len} characters${len > 160 ? ' (Multiple SMS)' : ''}`;
});

/* --- INPUT VALIDATION & MASKS --- */

document.getElementById('mobile')?.addEventListener('input', function(e) {
    const val = e.target.value;
    const errorEl = getOrCreateInlineError(this);
    
    if (val && !/^[0-9]{10}$/.test(val)) {
        errorEl.textContent = "Enter valid 10-digit number";
        errorEl.style.display = "block";
    } else {
        errorEl.style.display = "none";
    }
});

function getOrCreateInlineError(input) {
    let error = input.parentElement.querySelector('.inline-error');
    if (!error) {
        error = document.createElement('div');
        error.className = 'inline-error';
        error.style.color = '#dc3545';
        error.style.fontSize = '0.8rem';
        error.style.marginTop = '4px';
        input.parentElement.appendChild(error);
    }
    return error;
}

function printSchedule() {
    window.print();
}

/* --- PWA SMART INSTALL BANNER LOGIC --- */

let deferredPWAInstallPrompt = null;

window.addEventListener('load', () => {
    const banner = document.getElementById('pwaInstallBanner');
    if (!banner) return;

    // Check if dismissed in this session
    if (sessionStorage.getItem('pwa_banner_dismissed')) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
        console.log("App running in standalone mode (PWA).");
        return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !window.navigator.standalone;

    if (isIOS) {
        document.getElementById('pwaDesc').innerHTML = 'Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong>';
        const iosInstruct = document.getElementById('pwaIosInstruct');
        if (iosInstruct) iosInstruct.style.display = 'block';
        setTimeout(() => { banner.style.display = 'flex'; }, 3000);
    }
});

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default Chrome prompt
    e.preventDefault();
    deferredPWAInstallPrompt = e;
    const banner = document.getElementById('pwaInstallBanner');
    const btn = document.getElementById('pwaInstallBtn');
    if (banner) banner.style.display = 'flex';
    if (btn) btn.style.display = 'block';
    console.log("PWA Install Prompt captured and ready.");
});

async function handlePWAInstall() {
    if (!deferredPWAInstallPrompt) return;
    deferredPWAInstallPrompt.prompt();
    const { outcome } = await deferredPWAInstallPrompt.userChoice;
    if (outcome === 'accepted') {
        dismissPWABanner();
        deferredPWAInstallPrompt = null;
    }
}

function dismissPWABanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.style.display = 'none';
    sessionStorage.setItem('pwa_banner_dismissed', '1');
}
