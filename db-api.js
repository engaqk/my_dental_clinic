// Firebase Integration - Fully Replaces Supabase while keeping Business Logic Intact
// Get your Firebase credentials from: https://console.firebase.google.com/
class DatabaseAPI {
    constructor() {
        this.useFirebase = true;
        this.db = null;
        this.auth = null;

        // 1. Initialize Default Values - Universal multi-mode tenant resolver
        const urlParams = new URLSearchParams(window.location.search);
        
        let rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
        let pathId = '';
        if (rawPath) {
            const segments = rawPath.split('/');
            const lastSegment = segments[segments.length - 1];
            if (lastSegment && !lastSegment.includes('.') && lastSegment !== 'api' && lastSegment !== 'superadmin' && lastSegment !== 'my_dental_clinic') {
                pathId = lastSegment;
            }
        }

        let hashId = window.location.hash.replace(/^#\/?/, '').trim().split('?')[0].split('/')[0];
        if (['home', 'dashboard', 'tour', 'booking', 'services'].includes(hashId)) {
            hashId = '';
        }

        const queryId = urlParams.get('c') || urlParams.get('clinic') || '';

        this.tenantId = queryId || pathId || hashId || 'default';
        this.cacheVersion = '1.0.0';
        localStorage.setItem('activeTenantId', this.tenantId);

        const firebaseConfig = {
            apiKey: "AIzaSyAW9f8YvUDWpTkaJiwjXSaancicOJcKnBk",
            authDomain: "my-dental-clinic-wl.firebaseapp.com",
            projectId: "my-dental-clinic-wl",
            storageBucket: "my-dental-clinic-wl.firebasestorage.app",
            messagingSenderId: "222622897500",
            appId: "1:222622897500:web:6f0b52907a052d5d91dd99",
            measurementId: "G-H67S5BWGTZ"
        };
        
        // Initialize Analytics if needed (via compat)
        this.analytics = null;

        try {
            if (typeof firebase !== 'undefined') {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.db = firebase.firestore();
                this.auth = firebase.auth();
                console.log('Firebase connected successfully');

                // Keep Supabase namespace dummy for auth.js compatibility
                this.supabase = {
                    auth: {
                        onAuthStateChange: (cb) => {
                            this.auth.onAuthStateChanged((user) => {
                                cb(user ? 'SIGNED_IN' : 'SIGNED_OUT', user);
                            });
                        }
                    },
                    from: () => ({ select: () => ({ limit: () => ({ single: () => ({ data: null, error: null }) }) }) }) // minimal mocks if needed
                };

            } else {
                console.warn('Firebase JS not loaded, falling back to local storage');
                this.useFirebase = false;
            }
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.useFirebase = false;
        }
    }

    // Get Appointments
    // --- STAFF MANAGEMENT ---
    async addStaff(staffData) {
        if (!this.db) throw new Error('Offline mode');
        const emailKey = staffData.email.toLowerCase();
        await this.getCollection('staff').doc(emailKey).set(staffData);
        return true;
    }

    async getStaffList() {
        if (!this.db) return [];
        const snapshot = await this.getCollection('staff').get();
        return snapshot.docs.map(doc => doc.data());
    }

    async deleteStaff(email) {
        if (!this.db) throw new Error('Offline mode');
        await this.getCollection('staff').doc(email.toLowerCase()).delete();
        return true;
    }

    async getAppointments() {
        if (!this.useFirebase) {
            return JSON.parse(localStorage.getItem('appointments')) || [];
        }
        try {
            console.log('Fetching appointments from Firestore...');
            const snapshot = await this.getCollection('appointments').get();
            const appointments = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Ensure we have a valid ID (numeric preferred for sorting)
                const docId = doc.id;
                const numericId = data.id || (isNaN(parseInt(docId)) ? 0 : parseInt(docId));

                appointments.push({
                    id: numericId,
                    docId: docId, // Keep original doc ID for updates/deletes
                    idString: docId, // For compatibility
                    date: data.date || data.booking_date || new Date().toLocaleDateString(),
                    appointmentDate: data.appointmentDate || data.appointment_date || '',
                    appointmentTime: data.appointmentTime || data.appointment_time || '',
                    name: data.name || data.patientName || 'Unknown Patient',
                    email: data.email || '',
                    place: data.place || data.city || '',
                    mobile: data.mobile || data.phoneNumber || data.mobileNo || '', 
                    reason: data.reason || data.service || 'General',
                    fee: parseFloat(data.fee) || 0,
                    status: data.status || 'Pending',
                    medicalAlerts: data.medicalAlerts || [],
                    medicalNotes: data.medicalNotes || '',
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().getTime() : data.createdAt) : numericId
                });
            });

            console.log(`Successfully fetched ${appointments.length} appointments.`);

            // Sort by createdAt or numeric ID descending
            return appointments.sort((a, b) => {
                const timeA = a.createdAt || a.id || 0;
                const timeB = b.createdAt || b.id || 0;
                return timeB - timeA;
            });
        } catch (error) {
            if (error.code === 'permission-denied') {
                console.error('SECURITY RULES WARNING: Access to "appointments" collection is blocked by Firestore Security Rules.');
            } else {
                console.error('Firebase error fetching appointments:', error);
            }
            try {
                return JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            } catch (e) {
                return [];
            }
        }
    }

    // Create new appointment
    async createAppointment(appointment) {
        if (!this.useFirebase) {
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            const newAppointment = { ...appointment, id: Date.now() };
            appointments.push(newAppointment);
            localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
            return newAppointment;
        }

        try {
            console.log('Attempting to save appointment to Firestore...', appointment);
            const normalizedMobile = window.phoneUtils ? window.phoneUtils.normalizePhone(appointment.mobile) : appointment.mobile;
            
            // Use .add() instead of .doc().set() to ensure it's treated as a new document
            // and let Firestore generate a unique string ID.
            const docRef = await this.getCollection('appointments').add({
                id: appointment.id || Date.now(), // Keep numeric ID for sorting
                name: appointment.name || 'Unknown',
                email: appointment.email || '',
                place: appointment.place || '',
                mobile: normalizedMobile || appointment.mobile || '',
                phoneNumber: normalizedMobile || appointment.mobile || '',
                appointmentDate: appointment.appointmentDate || '',
                appointmentTime: appointment.appointmentTime || '',
                reason: appointment.reason || '',
                fee: parseFloat(appointment.fee) || 0,
                status: appointment.status || 'Pending',
                medicalAlerts: appointment.medicalAlerts || [],
                medicalNotes: appointment.medicalNotes || '',
                date: appointment.date || new Date().toLocaleDateString(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('Successfully saved to Firestore with ID:', docRef.id);

            return {
                id: appointment.id || Date.now(),
                docId: docRef.id,
                date: appointment.date || new Date().toLocaleDateString(),
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
                name: appointment.name,
                email: appointment.email || '',
                place: appointment.place || '',
                mobile: appointment.mobile,
                reason: appointment.reason,
                fee: appointment.fee || 0,
                status: appointment.status || 'Pending'
            };
        } catch (error) {
            console.error('CRITICAL: Firestore booking failed!', error);
            if (error.code === 'permission-denied') {
                console.error('CHECK SECURITY RULES: Public write to "appointments" might be blocked.');
            }
            
            // Fallback to local storage so the user doesn't lose the booking
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            const newAppointment = { ...appointment, id: Date.now() };
            appointments.push(newAppointment);
            localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
            return newAppointment;
        }
    }

    // Update appointment
    async updateAppointment(id, updates) {
        if (!this.useFirebase) {
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            const index = appointments.findIndex(a => a.id.toString() === id.toString());
            if (index !== -1) {
                appointments[index] = { ...appointments[index], ...updates };
                localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
                return appointments[index];
            }
            return null;
        }

        try {
            if (!this.db) throw new Error('Firestore not initialized');
            
            // First, find the document if the 'id' passed is the numeric ID
            let docRef;
            if (id.toString().length > 15) { // Likely a docId string
                docRef = this.getCollection('appointments').doc(id.toString());
            } else {
                const q = await this.getCollection('appointments').where('id', '==', parseInt(id)).get();
                if (!q.empty) {
                    docRef = q.docs[0].ref;
                } else {
                    docRef = this.getCollection('appointments').doc(id.toString());
                }
            }
            
            await docRef.update(updates);
            
            // Local fallback update
            try {
                let local = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
                const idx = local.findIndex(a => a.id.toString() === id.toString() || a.docId === id);
                if (idx !== -1) {
                    local[idx] = { ...local[idx], ...updates };
                    localStorage.setItem('dentalAppointments', JSON.stringify(local));
                }
            } catch(e){}

            return { id, ...updates };
        } catch (error) {
            console.error('Firebase error updating appointment:', error);
            return null;
        }
    }

    // Delete appointment
    async deleteAppointment(id) {
        if (!this.useFirebase) {
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            appointments = appointments.filter(a => a.id !== id);
            localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
            return true;
        }

        try {
            if (!this.db) throw new Error('Firestore not initialized');
            await this.getCollection('appointments').doc(id.toString()).delete();
            return true;
        } catch (error) {
            console.error('Firebase error deleting appointment:', error);
            return false;
        }
    }

    // Get booked time slots for a specific date (supporting multiple format variations)
    async getBookedTimeSlots(date) {
        if (!date) return [];
        const dateStr = date.toString().trim();

        const getDateVariations = (dStr) => {
            const vars = [dStr];
            try {
                const parts = dStr.split('-');
                if (parts.length === 3) {
                    const y = parts[0];
                    const m = parseInt(parts[1]).toString();
                    const pm = parts[1].padStart(2, '0');
                    const d = parseInt(parts[2]).toString();
                    const pd = parts[2].padStart(2, '0');
                    
                    vars.push(`${d}/${pm}/${y}`);
                    vars.push(`${pd}/${pm}/${y}`);
                    vars.push(`${m}/${d}/${y}`);
                    vars.push(`${pm}/${pd}/${y}`);
                    vars.push(`${d}-${pm}-${y}`);
                    vars.push(`${pd}-${pm}-${y}`);
                }
            } catch(e){}
            return [...new Set(vars)];
        };

        const variations = getDateVariations(dateStr);

        const isMatchingDate = (rawDate) => {
            if (!rawDate) return false;
            const s = rawDate.toString().trim();
            if (variations.includes(s)) return true;
            try {
                const d1 = new Date(s);
                const d2 = new Date(dateStr);
                if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                    return d1.getFullYear() === d2.getFullYear() &&
                           d1.getMonth() === d2.getMonth() &&
                           d1.getDate() === d2.getDate();
                }
            } catch (e) {}
            return false;
        };

        const bookedSlots = [];

        // Check local storage records
        try {
            const local = JSON.parse(localStorage.getItem('dentalAppointments')) || JSON.parse(localStorage.getItem('appointments')) || [];
            local.forEach(app => {
                const appDate = app.appointmentDate || app.appointment_date || app.date || '';
                if (isMatchingDate(appDate) && app.status !== 'Cancelled') {
                    const time = app.appointmentTime || app.appointment_time;
                    if (time) bookedSlots.push(time.toString().trim());
                }
            });
        } catch(e) {}

        if (!this.useFirebase || !this.db) {
            return [...new Set(bookedSlots)];
        }

        try {
            // Fetch appointments for this clinic directly without requiring composite indexes
            const snapshot = await this.getCollection('appointments').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'Cancelled') {
                    const appDate = data.appointmentDate || data.appointment_date || data.date || '';
                    if (isMatchingDate(appDate)) {
                        const time = data.appointmentTime || data.appointment_time;
                        if (time) {
                            bookedSlots.push(time.toString().trim());
                        }
                    }
                }
            });
            return [...new Set(bookedSlots)];
        } catch (error) {
            console.warn('Firebase getBookedTimeSlots fetch notice (falling back to cache):', error);
            return [...new Set(bookedSlots)];
        }
    }

    getCollection(collectionName) {
        if (!this.db) throw new Error('DB not initialized');
        return this.db.collection('tenants').doc(this.tenantId).collection(collectionName);
    }

    async signIn(email, password) {
        const lowerEmail = email.trim().toLowerCase();
        
        // 1. Fetch settings (offline + online sync)
        let settings = {};
        try {
            settings = JSON.parse(localStorage.getItem('clinicSettings')) || {};
            if (this.useFirebase && this.db) {
                try {
                    const snap = await this.getCollection('settings').doc('clinic').get();
                    if (snap.exists) {
                        settings = { ...settings, ...snap.data() };
                    }
                } catch(e){}
            }
        } catch (e) { }

        const defaultUser = (settings.admin_user || settings.adminUser || 'abdulqadir.galaxy53@gmail.com').trim().toLowerCase();
        let defaultPass = settings.admin_pass || settings.adminPass || 'admin';
        if (defaultPass === 'admin53') defaultPass = 'admin';

        // 2. Immediate Super Admin Bypass (username: superadmin, password: admin53)
        if ((lowerEmail === 'superadmin' || lowerEmail === 'admin1' || lowerEmail === 'abdulqadir.galaxy53@gmail.com') && 
            (password === 'admin53' || password === '!@#Qadir')) {
            console.log('💎 PWA Auth: Successful super admin login');
            await this.logAdminLogin('superadmin');
            return { user: { email: 'superadmin', name: 'Super Admin', role: 'super_admin' }, error: null };
        }

        // 3. Immediate Fallback Admin Bypass (admin/admin, email/admin, or settings credentials)
        const isSwastikTenant = this.tenantId && this.tenantId.toLowerCase().includes('swastik');
        if ((lowerEmail === 'admin' || lowerEmail === defaultUser || (isSwastikTenant && (lowerEmail === 'swastikadmin' || lowerEmail === 'chintal'))) && 
            (password === 'admin' || password === defaultPass)) {
            console.log('💎 PWA Auth: Successful admin login via local/cloud fallback credential validation');
            const userEmail = isSwastikTenant ? 'swastikadmin' : defaultUser;
            await this.logAdminLogin(userEmail);
            return { user: { email: userEmail, role: 'admin', name: isSwastikTenant ? 'Dr. Chintal Baman (BDS)' : 'Clinic Admin' }, error: null };
        }

        // 3.5. Tenant Staff Login (stored in Firestore)
        if (this.useFirebase && this.db) {
            try {
                const staffDoc = await this.getCollection('staff').doc(lowerEmail).get();
                if (staffDoc.exists) {
                    const staffData = staffDoc.data();
                    if (staffData.password === password) {
                        console.log('💎 PWA Auth: Successful tenant staff login');
                        await this.logAdminLogin(lowerEmail);
                        return { user: { email: lowerEmail, role: staffData.role || 'staff', name: staffData.name }, error: null };
                    }
                }
            } catch(e) {
                console.error('Error checking staff auth:', e);
            }
        }

        // 4. Offline Auth Fallback
        if (!this.useFirebase) {
            return { user: null, error: { message: 'Invalid credentials (offline mode)' } };
        }

        // 5. Firebase Authentication
        let finalEmail = email;
        if (lowerEmail === 'admin') {
            finalEmail = defaultUser;
        }

        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(finalEmail, password);
            await this.logAdminLogin(finalEmail);
            return { user: userCredential.user, error: null };
        } catch (error) {
            // Backup validation if Firebase doesn't match but local fallback matches
            if (finalEmail === defaultUser && password === defaultPass) {
                console.warn('Firebase login failed, using fallback admin access');
                await this.logAdminLogin(finalEmail);
                return { user: { email: defaultUser, role: 'admin' }, error: null };
            }
            return { user: null, error: { message: 'Invalid username or password' } };
        }
    }

    // Log admin login history (IP & Timestamp)
    async logAdminLogin(email) {
        let ip = 'Unknown';
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            ip = data.ip;
        } catch (e) {
            console.warn('Could not fetch IP address', e);
        }

        const logEntry = {
            email: email,
            ipAddress: ip,
            timestamp: new Date().toISOString()
        };

        if (this.useFirebase) {
            try {
                await this.getCollection('login_history').add(logEntry);
            } catch (err) {
                console.error('Failed to log admin login to Firestore', err);
            }
        }

        // Local fallback / cache
        const localLogs = JSON.parse(localStorage.getItem('adminLoginLogs')) || [];
        localLogs.unshift(logEntry);
        // keep only latest 50
        localStorage.setItem('adminLoginLogs', JSON.stringify(localLogs.slice(0, 50)));
    }

    // Get admin login history
    async getAdminLoginHistory() {
        if (!this.useFirebase) {
            return JSON.parse(localStorage.getItem('adminLoginLogs')) || [];
        }

        try {
            const snapshot = await this.getCollection('login_history').orderBy('timestamp', 'desc').limit(50).get();
            if (snapshot.empty) return [];
            return snapshot.docs.map(doc => doc.data());
        } catch (error) {
            console.error('Failed to fetch login history from Firestore', error);
            return JSON.parse(localStorage.getItem('adminLoginLogs')) || [];
        }
    }

    // Helper to get fresh ID Token for secure API calls
    async getIdToken() {
        if (!this.useFirebase || !this.auth.currentUser) return null;
        try {
            return await this.auth.currentUser.getIdToken(true);
        } catch (error) {
            console.error('Failed to get ID token:', error);
            return null;
        }
    }

    // Sign Out
    async signOut() {
        if (!this.useFirebase) {
            return { error: null };
        }
        try {
            await this.auth.signOut();
            return { error: null };
        } catch (error) {
            return { error };
        }
    }

    // Send Password Reset Email
    async sendPasswordReset(email) {
        if (!this.useFirebase) {
            return { error: { message: 'Password reset not available in offline mode' } };
        }
        try {
            await this.auth.sendPasswordResetEmail(email);
            return { data: true, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    // Update User (e.g. for Password Reset natively supported by DB API fallback)
    async updateUser(attributes) {
        if (!this.useFirebase) {
            return { error: { message: 'Cannot update user in offline mode' } };
        }
        try {
            if (attributes.password) {
                const user = this.auth.currentUser;
                if (user) {
                    await user.updatePassword(attributes.password);
                } else {
                    return { data: null, error: { message: 'No user signed in' } };
                }
            }
            return { data: true, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    // Pre-configured Tenant Blueprints
    getTenantBlueprint(tenantId) {
        const id = (tenantId || this.tenantId || '').toLowerCase();
        if (id.includes('swastik')) {
            return {
                clinic_name: 'Swastik Dental Clinic',
                subtitle: 'Dr. Chintal Baman (BDS)',
                primary_color: '#0D9488',
                admin_user: 'swastikadmin',
                admin_pass: 'admin',
                doctor_name: 'Dr. Chintal Baman (BDS)',
                degrees: 'B.D.S.',
                address: 'Main Clinic',
                phone: '+91 98765 43210'
            };
        }
        return null;
    }

    // Get App Settings (Tenant-Scoped)
    async getSettings() {
        const tenantKey = 'clinicSettings_' + this.tenantId;
        const blueprint = this.getTenantBlueprint(this.tenantId);

        if (!this.useFirebase || !this.db) {
            const cached = JSON.parse(localStorage.getItem(tenantKey) || localStorage.getItem('clinicSettings') || 'null');
            return cached || blueprint || {};
        }

        try {
            const doc = await this.getCollection('settings').doc('clinic').get();
            if (doc.exists) {
                const data = doc.data();
                localStorage.setItem(tenantKey, JSON.stringify(data));
                this.currentSettings = data;
                return data;
            }

            // Auto-seed preconfigured tenant if not exists in Firestore yet
            if (blueprint) {
                console.log(`🌱 Auto-seeding new tenant settings for: ${this.tenantId}`);
                await this.getCollection('settings').doc('clinic').set(blueprint, { merge: true });
                await this.db.collection('tenants').doc(this.tenantId).set({
                    name: blueprint.clinic_name,
                    subtitle: blueprint.subtitle,
                    createdAt: new Date().toISOString()
                }, { merge: true });
                await this.getCollection('staff').doc(blueprint.admin_user).set({
                    name: blueprint.doctor_name || blueprint.clinic_name,
                    email: blueprint.admin_user,
                    password: blueprint.admin_pass,
                    role: 'admin'
                }, { merge: true });
                localStorage.setItem(tenantKey, JSON.stringify(blueprint));
                this.currentSettings = blueprint;
                return blueprint;
            }

            const fallback = JSON.parse(localStorage.getItem(tenantKey) || 'null') || blueprint || {};
            this.currentSettings = fallback;
            return fallback;
        } catch (error) {
            console.error('Error fetching settings (using local fallback):', error);
            const cached = JSON.parse(localStorage.getItem(tenantKey) || 'null') || blueprint || {};
            this.currentSettings = cached;
            return cached;
        }
    }

    // Save App Settings
    async saveSettings(settings) {
        if (!settings) return false;
        const tenantKey = 'clinicSettings_' + this.tenantId;
        
        // Cache locally per tenant
        localStorage.setItem(tenantKey, JSON.stringify(settings));
        localStorage.setItem('clinicSettings', JSON.stringify(settings));
        this.currentSettings = settings;

        if (!this.useFirebase || !this.db) return true;

        try {
            // Defensive mapping to avoid "undefined" values in Firestore
            const dataToSave = {
                clinic_name: settings.name || settings.clinic_name || 'My Dental Clinic',
                subtitle: settings.subtitle || '',
                primary_color: settings.primaryColor || settings.primary_color || '#0D9488',
                admin_user: settings.adminUser || settings.admin_user || (this.tenantId + 'admin'),
                admin_pass: settings.adminPass || settings.admin_pass || 'admin',
                admin_email: settings.adminEmail || settings.admin_email || '', 
                about_text: settings.aboutText || settings.about_text || '',
                doctor_name: settings.doctor_name || settings.subtitle || ''
            };

            await this.getCollection('settings').doc('clinic').set(dataToSave, { merge: true });
            await this.db.collection('tenants').doc(this.tenantId).set({
                name: dataToSave.clinic_name,
                subtitle: dataToSave.subtitle,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log('Settings successfully synced to Firestore for tenant:', this.tenantId);
            return true;
        } catch (error) {
            console.error('Error saving settings to Firebase:', error);
            return false;
        }
    }

    // --- PULSE SMS & NOTIFICATION SUITE METHODS ---

    // Get Gateway Settings
    async getGatewaySettings() {
        if (!this.useFirebase) return {};
        try {
            const doc = await this.getCollection('settings').doc('gateway').get();
            return doc.exists ? doc.data() : {};
        } catch (error) {
            console.error('Error fetching gateway settings:', error);
            return {};
        }
    }

    // Save Gateway Settings
    async saveGatewaySettings(settings) {
        if (!this.useFirebase) return false;
        try {
            await this.getCollection('settings').doc('gateway').set(settings, { merge: true });
            return true;
        } catch (error) {
            console.error('Error saving gateway settings:', error);
            return false;
        }
    }

    // Get Marketing Contacts (Firestore + localStorage fallback merged)
    async getMarketingContacts() {
        // Always load local contacts first
        let localContacts = [];
        try {
            localContacts = JSON.parse(localStorage.getItem('marketing_contacts_local') || '[]');
        } catch(e) {}

        if (!this.useFirebase) return localContacts;

        try {
            const snapshot = await this.getCollection('marketing_contacts').get();
            const firestoreContacts = [];
            snapshot.forEach(doc => firestoreContacts.push({ id: doc.id, ...doc.data() }));

            // Merge: add local-only contacts not yet in Firestore
            const firestoreMobiles = new Set(firestoreContacts.map(c => c.mobile));
            const localOnly = localContacts.filter(c => !firestoreMobiles.has(c.mobile));
            return [...firestoreContacts, ...localOnly];
        } catch (error) {
            console.warn('Firestore blocked, using local contacts:', error.code);
            return localContacts;
        }
    }

    // Add Marketing Contact (saves locally first, then syncs to Firestore)
    async addMarketingContact(contact) {
        // Always save to localStorage immediately
        try {
            const local = JSON.parse(localStorage.getItem('marketing_contacts_local') || '[]');
            const isDup = local.some(c => c.mobile === contact.mobile);
            if (!isDup) {
                local.push({ id: 'local_' + Date.now(), name: contact.name, mobile: contact.mobile, source: 'Marketing' });
                localStorage.setItem('marketing_contacts_local', JSON.stringify(local));
            }
        } catch(e) {}

        if (!this.useFirebase) return null;

        try {
            const docRef = await this.getCollection('marketing_contacts').add({
                name: contact.name,
                mobile: contact.mobile,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Remove from local cache since it's now in Firestore
            try {
                let local = JSON.parse(localStorage.getItem('marketing_contacts_local') || '[]');
                local = local.filter(c => c.mobile !== contact.mobile);
                localStorage.setItem('marketing_contacts_local', JSON.stringify(local));
            } catch(e) {}
            return { id: docRef.id, ...contact };
        } catch (error) {
            if (error.code === 'permission-denied') {
                console.warn('Firestore blocked - contact saved locally only. Update Firebase Rules to persist online.');
            } else {
                console.error('Error adding marketing contact:', error);
            }
            return null;
        }
    }

    // Delete Marketing Contact
    async deleteMarketingContact(id) {
        if (!this.useFirebase) return false;
        try {
            await this.getCollection('marketing_contacts').doc(id).delete();
            return true;
        } catch (error) {
            console.error('Error deleting marketing contact:', error);
            return false;
        }
    }

    // Delete Multiple Marketing Contacts
    async deleteManyMarketingContacts(ids) {
        if (!this.useFirebase || !ids.length) return false;
        const batch = this.db.batch();
        ids.forEach(id => {
            const docRef = this.getCollection('marketing_contacts').doc(id);
            batch.delete(docRef);
        });
        try {
            await batch.commit();
            return true;
        } catch (error) {
            console.error('Error in batch delete:', error);
            return false;
        }
    }

    // Aggregate Unique Phone Numbers from 3 Sources
    async getBroadcastRecipients() {
        if (!this.useFirebase) return [];
        
        const recipientMap = new Map(); // Use Map to keep unique by phone

        try {
            // Source 1: Appointments
            const appts = await this.getAppointments();
            appts.forEach(a => {
                if (a.mobile && a.name) {
                    const normalized = window.phoneUtils.normalizePhone(a.mobile);
                    if (!recipientMap.has(normalized)) {
                        recipientMap.set(normalized, { name: a.name, mobile: normalized, source: 'Appointment' });
                    }
                }
            });

            // Source 2: Auth Directory (via Serverless API)
            try {
                const token = await this.getIdToken();
                const response = await fetch('api/get-auth-users', {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (response.ok) {
                    const authUsers = await response.json();
                    if (authUsers && Array.isArray(authUsers)) {
                        authUsers.forEach(u => {
                            if (u.phoneNumber || u.mobile) {
                                const normalized = window.phoneUtils.normalizePhone(u.phoneNumber || u.mobile);
                                if (!recipientMap.has(normalized)) {
                                    recipientMap.set(normalized, { name: u.displayName || u.email || 'Auth User', mobile: normalized, source: 'Auth' });
                                }
                            }
                        });
                    }
                } else {
                    console.warn('Auth directory access denied (not logged in or invalid token)');
                }
            } catch (e) { console.warn('Auth directory fetch failed:', e); }

            // Source 3: Marketing Contacts
            const marketing = await this.getMarketingContacts();
            marketing.forEach(m => {
                if (m.mobile) {
                    const normalized = window.phoneUtils.normalizePhone(m.mobile);
                    if (!recipientMap.has(normalized)) {
                        // STORE THE ID so we can delete it later
                        recipientMap.set(normalized, { id: m.id, name: m.name || 'Marketing Contact', mobile: normalized, source: 'Marketing' });
                    }
                }
            });

            return Array.from(recipientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error aggregating recipients:', error);
            return [];
        }
    }

    // Log Broadcast History
    async logBroadcast(batchId, recipientsCount, message, status = 'SENT') {
        if (!this.useFirebase) return;
        try {
            await this.getCollection('broadcast_history').add({
                batchId,
                recipientsCount,
                message,
                status,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error logging broadcast:', error);
        }
    }

    // --- NEW: Clinical Examination Notes ---
    async getClinicalNotes(appointmentId) {
        if (!this.useFirebase) return null;
        try {
            const doc = await this.getCollection('clinical_notes').doc(appointmentId.toString()).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            return null;
        }
    }

    async saveClinicalNotes(appointmentId, notes) {
        if (!this.useFirebase) return false;
        try {
            await this.getCollection('clinical_notes').doc(appointmentId.toString()).set({
                ...notes,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // --- NEW: Multi-Seating & Payment Management ---

    async getPayments(appointmentId) {
        let localPayments = [];
        try {
            localPayments = (JSON.parse(localStorage.getItem('dentalPayments')) || [])
                            .filter(p => p.appointmentId.toString() === appointmentId.toString());
        } catch(e){}

        if (!this.useFirebase) return localPayments;
        try {
            const snapshot = await this.getCollection('payments')
                .where('appointmentId', '==', appointmentId.toString())
                .get();
            const firestorePayments = [];
            snapshot.forEach(doc => firestorePayments.push({ id: doc.id, ...doc.data() }));
            
            // Prefer Firestore, fallback to local if empty but doc exists
            return firestorePayments.length > 0 ? firestorePayments : localPayments;
        } catch (error) {
            return localPayments;
        }
    }

    async addPayment(payment) {
        const data = { ...payment, type: 'payment', createdAt: new Date() };
        try {
            let local = JSON.parse(localStorage.getItem('dentalPayments')) || [];
            local.push(data);
            localStorage.setItem('dentalPayments', JSON.stringify(local));
        } catch(e){}

        if (!this.useFirebase) return true;
        try {
            await this.getCollection('payments').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) { return true; }
    }

    async addCharge(charge) {
        const data = { ...charge, type: 'charge', createdAt: new Date() };
        try {
            let local = JSON.parse(localStorage.getItem('dentalPayments')) || [];
            local.push(data);
            localStorage.setItem('dentalPayments', JSON.stringify(local));
        } catch(e){}

        if (!this.useFirebase) return true;
        try {
            await this.getCollection('payments').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) { return true; }
    }

    async getPatientHistory(mobile) {
        if (!this.useFirebase) return [];
        try {
            const snapshot = await this.getCollection('appointments')
                .where('mobile', '==', mobile)
                .get();
            const history = [];
            snapshot.forEach(doc => history.push({ id: doc.id, ...doc.data() }));
            return history.sort((a, b) => {
                const dateA = a.appointmentDate || a.date;
                const dateB = b.appointmentDate || b.date;
                return dateB.localeCompare(dateA);
            });
        } catch (error) {
            return [];
        }
    }

    // --- NEW: Patient Diagnosis History ---
    async getDiagnoses(mobile) {
        if (!this.useFirebase) {
            return (JSON.parse(localStorage.getItem('dentalDiagnoses')) || [])
                .filter(d => d.mobile === mobile);
        }
        try {
            const snapshot = await this.getCollection('diagnoses')
                .where('mobile', '==', mobile)
                .get();
            const diagnoses = [];
            snapshot.forEach(doc => diagnoses.push({ id: doc.id, ...doc.data() }));
            return diagnoses.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            return [];
        }
    }

    async addDiagnosis(diagnosis) {
        const data = {
            ...diagnosis,
            timestamp: Date.now(),
            createdAt: this.useFirebase ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
        };

        // Local cache
        try {
            let local = JSON.parse(localStorage.getItem('dentalDiagnoses')) || [];
            local.push(data);
            localStorage.setItem('dentalDiagnoses', JSON.stringify(local));
        } catch(e){}

        if (!this.useFirebase) return true;
        try {
            await this.getCollection('diagnoses').add(data);
            return true;
        } catch (error) {
            return true;
        }
    }

    // --- NEW: Patient Charting & Signature ---
    async savePatientChart(mobile, chartData) {
        if (this.useFirebase) {
            try {
                await this.getCollection('patient_charts').doc(mobile).set({ data: chartData }, { merge: true });
            } catch (err) {
                console.warn("Failed to save chart to Firebase", err);
            }
        }
        try {
            let local = JSON.parse(localStorage.getItem('dentalCharts')) || {};
            local[mobile] = chartData;
            localStorage.setItem('dentalCharts', JSON.stringify(local));
        } catch(e){}
    }

    async getPatientChart(mobile) {
        if (this.useFirebase) {
            try {
                const doc = await this.getCollection('patient_charts').doc(mobile).get();
                if (doc.exists) return doc.data().data || {};
            } catch (err) {
                console.warn("Failed to fetch chart from Firebase", err);
            }
        }
        try {
            let local = JSON.parse(localStorage.getItem('dentalCharts')) || {};
            return local[mobile] || {};
        } catch(e) {
            return {};
        }
    }

    async savePatientSignature(mobile, signatureBase64) {
        if (this.useFirebase) {
            try {
                await this.getCollection('patient_signatures').doc(mobile).set({ data: signatureBase64 }, { merge: true });
            } catch (err) {
                console.warn("Failed to save signature to Firebase", err);
            }
        }
        try {
            let local = JSON.parse(localStorage.getItem('dentalSignatures')) || {};
            local[mobile] = signatureBase64;
            localStorage.setItem('dentalSignatures', JSON.stringify(local));
        } catch(e){}
    }

    async getPatientSignature(mobile) {
        if (this.useFirebase) {
            try {
                const doc = await this.getCollection('patient_signatures').doc(mobile).get();
                if (doc.exists) return doc.data().data || null;
            } catch (err) {
                console.warn("Failed to fetch signature from Firebase", err);
            }
        }
        try {
            let local = JSON.parse(localStorage.getItem('dentalSignatures')) || {};
            return local[mobile] || null;
        } catch(e) {
            return null;
        }
    }
    // --- DIGITAL PRESCRIPTIONS (Rx) ---
    async savePrescription(rxData) {
        const payload = {
            ...rxData,
            createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };
        try {
            let local = JSON.parse(localStorage.getItem('dentalPrescriptions') || '[]');
            local.unshift({ ...rxData, id: Date.now(), createdAt: Date.now() });
            localStorage.setItem('dentalPrescriptions', JSON.stringify(local));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const docRef = await this.getCollection('prescriptions').add(payload);
                return { id: docRef.id, ...rxData };
            } catch (err) {
                console.warn('Failed to save prescription to Firebase (saved to local cache):', err);
            }
        }
        return { id: Date.now(), ...rxData };
    }

    async getPrescriptions(mobile) {
        const normMobile = window.phoneUtils ? window.phoneUtils.normalizePhone(mobile) : mobile;
        let results = [];
        try {
            const local = JSON.parse(localStorage.getItem('dentalPrescriptions') || '[]');
            results = local.filter(r => r.mobile === mobile || r.patientMobile === mobile || (normMobile && (r.mobile === normMobile || r.patientMobile === normMobile)));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const snap = await this.getCollection('prescriptions').where('mobile', '==', mobile).get();
                const fbResults = [];
                snap.forEach(doc => fbResults.push({ id: doc.id, ...doc.data() }));
                if (fbResults.length > 0) return fbResults;
            } catch (err) {
                console.warn('Failed to fetch prescriptions from Firebase:', err);
            }
        }
        return results;
    }

    // --- TREATMENT PLANS & COST ESTIMATES ---
    async saveTreatmentPlan(planData) {
        const payload = {
            ...planData,
            createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };
        try {
            let local = JSON.parse(localStorage.getItem('dentalTreatmentPlans') || '[]');
            local.unshift({ ...planData, id: Date.now(), createdAt: Date.now() });
            localStorage.setItem('dentalTreatmentPlans', JSON.stringify(local));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const docRef = await this.getCollection('treatment_plans').add(payload);
                return { id: docRef.id, ...planData };
            } catch (err) {
                console.warn('Failed to save treatment plan to Firebase (saved to local cache):', err);
            }
        }
        return { id: Date.now(), ...planData };
    }

    async getTreatmentPlans(mobile) {
        const normMobile = window.phoneUtils ? window.phoneUtils.normalizePhone(mobile) : mobile;
        let results = [];
        try {
            const local = JSON.parse(localStorage.getItem('dentalTreatmentPlans') || '[]');
            results = local.filter(r => r.mobile === mobile || r.patientMobile === mobile || (normMobile && (r.mobile === normMobile || r.patientMobile === normMobile)));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const snap = await this.getCollection('treatment_plans').where('mobile', '==', mobile).get();
                const fbResults = [];
                snap.forEach(doc => fbResults.push({ id: doc.id, ...doc.data() }));
                if (fbResults.length > 0) return fbResults;
            } catch (err) {
                console.warn('Failed to fetch treatment plans from Firebase:', err);
            }
        }
        return results;
    }

    // --- PATIENT MEDICAL ALERTS & HEALTH PROFILE ---
    async savePatientMedicalAlerts(mobile, alerts, notes) {
        const payload = {
            mobile,
            alerts: alerts || [],
            notes: notes || '',
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };
        try {
            let local = JSON.parse(localStorage.getItem('dentalMedicalAlerts') || '{}');
            local[mobile] = { alerts, notes };
            localStorage.setItem('dentalMedicalAlerts', JSON.stringify(local));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                await this.getCollection('patient_medical_alerts').doc(mobile).set(payload, { merge: true });
                return true;
            } catch (err) {
                console.warn('Failed to save medical alerts to Firebase:', err);
            }
        }
        return true;
    }

    async getPatientMedicalAlerts(mobile) {
        let localAlerts = { alerts: [], notes: '' };
        try {
            const local = JSON.parse(localStorage.getItem('dentalMedicalAlerts') || '{}');
            if (local[mobile]) localAlerts = local[mobile];
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const doc = await this.getCollection('patient_medical_alerts').doc(mobile).get();
                if (doc.exists) return doc.data();
            } catch (err) {
                console.warn('Failed to fetch medical alerts from Firebase:', err);
            }
        }
        return localAlerts;
    }
}

// Export singleton instance
window.dbAPI = new DatabaseAPI();
