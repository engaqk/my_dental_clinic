/**
 * activityTracker.js - Universal Multi-Tenant Activity & Page Dwell Time Tracker
 * 
 * Captures:
 * 1. Page navigations, sections clicked & exact dwell time (seconds and formatted string).
 * 2. User identity (Login email, name, role) for Patients, Doctors, Staff, and Visitors.
 * 3. Clinical & patient interactions (Appointments, Rx, Odontogram, E-Consent, Billing).
 * 4. Asynchronously logs to Cloud Firestore and triggers Admin Email Notifications.
 * 
 * 100% Non-blocking: Errors are caught safely so business logic is NEVER interrupted.
 */

(function(window) {
    'use strict';

    function formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0s';
        if (seconds < 60) return seconds + 's';
        const mins = Math.floor(seconds / 60);
        const remSecs = seconds % 60;
        if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs}h ${remMins}m`;
    }

    function formatSectionTitle(id) {
        if (!id) return 'Home';
        const map = {
            'home': 'Home / Booking',
            'dashboard': 'Clinical Dashboard',
            'patient-portal': 'Patient Portal',
            'profile': 'Patient Profile',
            'services': 'Dental Services',
            'premium-features': 'VIP Chairside Suite',
            'superadmin': 'SuperAdmin Console'
        };
        return map[id] || (id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' '));
    }

    function getCurrentUserInfo() {
        let email = '';
        let name = 'Visitor';
        let role = 'visitor';

        try {
            // 1. Check Staff / Doctor Login
            const staffStr = sessionStorage.getItem('staffUser') || localStorage.getItem('clinic_current_user');
            if (staffStr) {
                const u = JSON.parse(staffStr);
                email = u.email || u.username || '';
                name = u.name || u.displayName || u.username || 'Staff Member';
                role = u.role || 'staff';
                return { email, name, role };
            }

            // 2. Check Patient Login
            const ptEmail = sessionStorage.getItem('patientEmail') || localStorage.getItem('patientEmail') || (window.currentPatient ? window.currentPatient.email : '');
            if (ptEmail) {
                email = ptEmail;
                name = sessionStorage.getItem('patientName') || localStorage.getItem('patientName') || (window.currentPatient ? window.currentPatient.name : 'Patient');
                role = 'patient';
                return { email, name, role };
            }

            // 3. Check SuperAdmin Login
            if (sessionStorage.getItem('isSuperAdmin') === 'true') {
                return { email: 'superadmin@galaxy.com', name: 'Super Administrator', role: 'super_admin' };
            }
        } catch(e) {}

        return { email: '', name: 'Visitor', role: 'visitor' };
    }

    const ActivityTracker = {
        currentPage: 'Home',
        pageStartTime: Date.now(),
        sessionStartTime: Date.now(),
        isInitialized: false,

        formatDuration: formatDuration,
        getCurrentUser: getCurrentUserInfo,

        /**
         * Triggered on every page or dashboard tab change.
         * Computes dwell time spent on previous page and logs arrival at new page.
         */
        onPageChange: function(newPageRaw, customMeta) {
            try {
                if (!newPageRaw) return;
                const newPageName = formatSectionTitle(newPageRaw);
                const now = Date.now();
                const durationSec = Math.max(0, Math.round((now - this.pageStartTime) / 1000));
                const durationStr = formatDuration(durationSec);
                const prevPage = this.currentPage;

                // Log dwell time for previous page if user stayed at least 2 seconds
                if (durationSec >= 2 && prevPage && prevPage !== newPageName) {
                    const user = getCurrentUserInfo();
                    const clinicName = window.currentClinicSettings?.clinic_name || 'Smile Dental Clinic';
                    const tenantId = window.dbAPI?.tenantId || sessionStorage.getItem('activeTenantSlug') || 'default';

                    if (window.dbAPI && typeof window.dbAPI.logActivity === 'function') {
                        window.dbAPI.logActivity('navigation', 'Page Dwell Time', `${user.name} stayed ${durationStr} on ${prevPage} before navigating to ${newPageName}`, {
                            page: prevPage,
                            nextPage: newPageName,
                            timeSpentSeconds: durationSec,
                            timeSpentDisplay: durationStr,
                            actor: user.name,
                            email: user.email,
                            role: user.role,
                            clinicName: clinicName,
                            tenantId: tenantId,
                            ...(customMeta || {})
                        });
                    }
                }

                // Switch active tracked page
                this.currentPage = newPageName;
                this.pageStartTime = now;
                window.currentTrackedPage = newPageName;

                // Log new page arrival
                const user = getCurrentUserInfo();
                const clinicName = window.currentClinicSettings?.clinic_name || 'Smile Dental Clinic';
                const tenantId = window.dbAPI?.tenantId || sessionStorage.getItem('activeTenantSlug') || 'default';

                if (window.dbAPI && typeof window.dbAPI.logActivity === 'function') {
                    window.dbAPI.logActivity('navigation', 'Page Visit', `${user.name} viewed ${newPageName}`, {
                        page: newPageName,
                        previousPage: prevPage,
                        timeSpentSeconds: 0,
                        timeSpentDisplay: '0s',
                        actor: user.name,
                        email: user.email,
                        role: user.role,
                        clinicName: clinicName,
                        tenantId: tenantId,
                        ...(customMeta || {})
                    });
                }
            } catch (err) {
                console.warn('[ActivityTracker] onPageChange error:', err);
            }
        },

        /**
         * Explicit action logging (button clicks, form submits, mobile downloads).
         */
        trackAction: function(category, actionType, details, meta) {
            try {
                const user = getCurrentUserInfo();
                const clinicName = window.currentClinicSettings?.clinic_name || 'Smile Dental Clinic';
                const tenantId = window.dbAPI?.tenantId || sessionStorage.getItem('activeTenantSlug') || 'default';

                if (window.dbAPI && typeof window.dbAPI.logActivity === 'function') {
                    window.dbAPI.logActivity(category || 'general', actionType, details, {
                        page: this.currentPage,
                        actor: user.name,
                        email: user.email,
                        role: user.role,
                        clinicName: clinicName,
                        tenantId: tenantId,
                        ...(meta || {})
                    });
                }
            } catch(e) {
                console.warn('[ActivityTracker] trackAction error:', e);
            }
        },

        /**
         * Initialize tracker listeners & session lifecycle hooks.
         */
        init: function() {
            if (this.isInitialized) return;
            this.isInitialized = true;
            this.pageStartTime = Date.now();
            this.sessionStartTime = Date.now();
            this.currentPage = 'Home';
            window.currentTrackedPage = 'Home';

            // Initial arrival log (debounced 1.2s to allow clinic settings to hydrate)
            setTimeout(() => {
                try {
                    const user = getCurrentUserInfo();
                    const clinicName = window.currentClinicSettings?.clinic_name || 'Smile Dental Clinic';
                    const tenantId = window.dbAPI?.tenantId || sessionStorage.getItem('activeTenantSlug') || 'default';

                    if (window.dbAPI && typeof window.dbAPI.logActivity === 'function') {
                        window.dbAPI.logActivity('navigation', 'Session Started', `${user.name} arrived at ${clinicName} (Landing Page: Home)`, {
                            page: 'Home',
                            timeSpentSeconds: 0,
                            timeSpentDisplay: '0s',
                            actor: user.name,
                            email: user.email,
                            role: user.role,
                            clinicName: clinicName,
                            tenantId: tenantId
                        });
                    }
                } catch(e) {}
            }, 1200);

            // Log exit dwell time on tab close / browser navigation
            const logExitDwell = () => {
                try {
                    const durationSec = Math.max(0, Math.round((Date.now() - this.pageStartTime) / 1000));
                    if (durationSec >= 2) {
                        const user = getCurrentUserInfo();
                        const clinicName = window.currentClinicSettings?.clinic_name || 'Smile Dental Clinic';
                        const tenantId = window.dbAPI?.tenantId || sessionStorage.getItem('activeTenantSlug') || 'default';
                        const durationStr = formatDuration(durationSec);

                        const payload = {
                            category: 'navigation',
                            type: 'Page Exit',
                            details: `${user.name} finished session after staying ${durationStr} on ${this.currentPage}`,
                            page: this.currentPage,
                            timeSpentSeconds: durationSec,
                            timeSpentDisplay: durationStr,
                            actor: user.name,
                            email: user.email,
                            role: user.role,
                            clinicName: clinicName,
                            tenantId: tenantId
                        };

                        // Use sendBeacon if available for reliable unload transmission
                        if (navigator.sendBeacon) {
                            try {
                                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                                navigator.sendBeacon('/api/activity-notification', blob);
                            } catch(e) {}
                        }

                        if (window.dbAPI && typeof window.dbAPI.logActivity === 'function') {
                            window.dbAPI.logActivity(payload.category, payload.type, payload.details, payload);
                        }
                    }
                } catch(e) {}
            };

            window.addEventListener('beforeunload', logExitDwell);
            window.addEventListener('pagehide', logExitDwell);
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ActivityTracker.init());
    } else {
        ActivityTracker.init();
    }

    // Expose globally
    window.ActivityTracker = ActivityTracker;

})(window);
