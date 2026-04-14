// Authentication System with Supabase Integration
// Handles login, logout, and password recovery

// Show/hide login modal
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginForm').reset();
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
}

// Show/hide forgot password modal
function showForgotPasswordModal() {
    closeLoginModal();
    document.getElementById('forgotPasswordModal').style.display = 'flex';
    document.getElementById('resetMessage').style.display = 'none';
    document.getElementById('forgotPasswordForm').reset();
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').style.display = 'none';
    document.getElementById('resetMessage').style.display = 'none';
}

// Handle login form submission
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('loginError');
            const submitBtn = e.target.querySelector('button[type="submit"]');

            // Disable button and show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            errorMsg.style.display = 'none';

            try {
                // Map "admin" to the primary email for convenience
                let actualUsername = username;
                if (username.toLowerCase() === 'admin') {
                    actualUsername = 'abdulqadir.galaxy53@gmail.com';
                }

                // Use Supabase authentication
                const { user, error } = await window.dbAPI.signIn(actualUsername, password);

                if (error) {
                    throw error;
                }

                if (user) {
                    // Successful login
                    sessionStorage.setItem('staffLoggedIn', 'true');
                    sessionStorage.setItem('staffUser', JSON.stringify(user));
                    closeLoginModal();

                    // Show dashboard
                    document.getElementById('dashboard').style.display = 'block';
                    document.getElementById('main-content').style.display = 'none';

                    if (typeof loadAppointments === 'function') {
                        loadAppointments();
                    }

                    // Sync Password: If login succeeded, update 'adminPass' in settings to match 
                    try {
                        let localSettings = JSON.parse(localStorage.getItem('clinicSettings')) || {};
                        const defaultUser = localSettings.adminUser || 'abdulqadir.galaxy53@gmail.com';
                        // Check if we logged in as the admin (via 'admin' alias or direct email)
                        if (username === 'admin' || username === defaultUser) {
                            if (localSettings.adminPass !== password) {
                                console.log('Syncing new password to settings...');
                                localSettings.adminPass = password;
                                localStorage.setItem('clinicSettings', JSON.stringify(localSettings));
                                // Also try to sync to cloud if possible
                                if (window.dbAPI && window.dbAPI.saveSettings) {
                                    const fullSettings = await window.dbAPI.getSettings();
                                    const merged = { ...fullSettings, ...localSettings, name: fullSettings.clinic_name || localSettings.name };
                                    window.dbAPI.saveSettings(merged);
                                }
                            }
                        }
                    } catch (e) { console.error('Auto-sync password failed:', e); }

                    // Validate Super Admin Access immediately
                    if (typeof window.checkSuperAdmin === 'function') window.checkSuperAdmin();
                } else {
                    throw new Error('Invalid credentials');
                }
            } catch (error) {
                // Failed login
                errorMsg.textContent = error.message || 'Invalid username or password';
                errorMsg.style.display = 'block';
            } finally {
                // Re-enable button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        });
    }

    // Handle forgot password form submission
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('resetEmail').value;
            const messageEl = document.getElementById('resetMessage');
            const submitBtn = e.target.querySelector('button[type="submit"]');

            // Disable button and show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            messageEl.style.display = 'none';

            try {
                // Send password reset email via Supabase
                const { error } = await window.dbAPI.sendPasswordReset(email);

                if (error) {
                    throw error;
                }

                // Success
                messageEl.textContent = 'Password reset link sent! Check your email.';
                messageEl.style.color = 'green';
                messageEl.style.display = 'block';

                // Reset form and close modal after 3 seconds
                setTimeout(() => {
                    closeForgotPasswordModal();
                    showLoginModal();
                }, 3000);
            } catch (error) {
                // Error
                messageEl.textContent = error.message || 'Failed to send reset link. Please try again.';
                messageEl.style.color = 'red';
                messageEl.style.display = 'block';
            } finally {
                // Re-enable button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Reset Link';
            }
        });
    }
});

// Check if user is logged in
function checkAuth() {
    return sessionStorage.getItem('staffLoggedIn') === 'true';
}

// Logout function
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Sign out from Supabase
        await window.dbAPI.signOut();

        // Clear session
        sessionStorage.removeItem('staffLoggedIn');
        sessionStorage.removeItem('staffUser');

        // Update UI
        document.getElementById('dashboard').style.display = 'none';
        const stBtn = document.getElementById('settingsBtn');
        if (stBtn) stBtn.style.display = 'none';

        document.getElementById('main-content').style.display = 'block';
        showSection('home');
    }
}

// Toggle Dashboard with authentication check
function toggleDashboard() {
    if (!checkAuth()) {
        showLoginModal();
        return;
    }

    const dashboard = document.getElementById('dashboard');
    const mainContent = document.getElementById('main-content');

    if (dashboard.style.display === 'none' || dashboard.style.display === '') {
        dashboard.style.display = 'block';
        mainContent.style.display = 'none';
        if (typeof window.checkSuperAdmin === 'function') window.checkSuperAdmin();
        if (typeof loadAppointments === 'function') {
            loadAppointments();
        }
    } else {
        dashboard.style.display = 'none';
        mainContent.style.display = 'block';
    }
}

// Listen for Auth State Changes (e.g., Password Recovery)
document.addEventListener('DOMContentLoaded', () => {
    if (window.dbAPI && window.dbAPI.supabase) {
        window.dbAPI.supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                document.getElementById('updatePasswordModal').style.display = 'flex';
            }
        });
    }

    // Handle Password Update Form
    const updatePasswordForm = document.getElementById('updatePasswordForm');
    if (updatePasswordForm) {
        updatePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const msg = document.getElementById('updatePasswordMessage');
            const btn = e.target.querySelector('button');

            btn.disabled = true;
            btn.textContent = 'Updating...';

            const { error } = await window.dbAPI.updateUser({ password: newPassword });

            if (error) {
                msg.style.color = 'red';
                msg.textContent = 'Error: ' + error.message;
                btn.disabled = false;
                btn.textContent = 'Update Password';
            } else {
                msg.style.color = 'green';
                msg.textContent = 'Password updated successfully! Logging you in...';
                setTimeout(() => {
                    document.getElementById('updatePasswordModal').style.display = 'none';
                    showLoginModal(); // Show login to re-authenticate with new password
                }, 2000);
            }
        });
    }
});
