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
    }
});

function showBookingModal(appointment) {
    const modal = document.getElementById('bookingModal');
    const linkBtn = document.getElementById('calendarLink');

    // Generate Google Calendar Link
    // Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=TEXT&dates=DATES&details=DETAILS&location=LOCATION
    const title = encodeURIComponent(`Dentist Appointment: ${appointment.reason}`);
    const details = encodeURIComponent(`Appointment with My Dental Clinic.\\nPatient: ${appointment.name}\\nReason: ${appointment.reason}`);
    const location = encodeURIComponent("My Dental Clinic - Advance Dental clinic");

    // Dates need to be YYYYMMDDTHHMMSSZ
    // Currently just setting for "Now" + 1 hour for simplicity, or we could ask user for date time.
    // Since form relies on "today", let's assume "Time to be confirmed" but link creates a slot for Today + 1 hour from now.
    const now = new Date();
    const start = now.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");

    const href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;

    linkBtn.href = href;
    modal.style.display = "flex";
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
            const now = new Date();
            const start = now.toISOString().replace(/-|:|\.\d\d\d/g, "");
            const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
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

window.openSettingsModal = function () {
    const modal = document.getElementById('settingsModal');
    const settings = JSON.parse(localStorage.getItem('clinicSettings')) || {};

    document.getElementById('settingClinicName').value = settings.name || "My Dental Clinic";
    document.getElementById('settingSubtitle').value = settings.subtitle || "Advance Dental clinic";
    // Set default colors if not set (using our new Teal default)
    document.getElementById('settingPrimaryColor').value = settings.primaryColor || "#26A69A";
    document.getElementById('settingSecondaryColor').value = settings.secondaryColor || "#42A5F5";

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
            primaryColor: document.getElementById('settingPrimaryColor').value,
            secondaryColor: document.getElementById('settingSecondaryColor').value,
            adminUser: document.getElementById('settingAdminUser').value,
            adminPass: document.getElementById('settingAdminPass').value,
            aboutText: document.getElementById('settingAboutText').value
        };

        applySettings(settings);

        // Save to Cloud (and local inside the method)
        const btn = settingsForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        await window.dbAPI.saveSettings(settings);

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
                    primaryColor: data.primary_color,
                    secondaryColor: data.secondary_color,
                    adminUser: data.admin_user,
                    adminPass: data.admin_pass,
                    aboutText: data.about_text // Map from DB
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

function printSchedule() {
    window.print();
}
