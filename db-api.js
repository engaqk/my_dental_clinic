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

    // --- MULTI-TENANT LOCAL STORAGE PARTITIONING HELPERS ---
    getStorageKey(key) {
        return `${this.tenantId}_${key}`;
    }

    getLocalData(key, defaultVal = []) {
        try {
            const tenantVal = localStorage.getItem(this.getStorageKey(key));
            if (tenantVal !== null) {
                return JSON.parse(tenantVal);
            }
            if (this.tenantId === 'default') {
                const legacyVal = localStorage.getItem(key);
                if (legacyVal !== null) return JSON.parse(legacyVal);
            }
        } catch(e) {}
        return defaultVal;
    }

    setLocalData(key, val) {
        try {
            localStorage.setItem(this.getStorageKey(key), JSON.stringify(val));
            if (this.tenantId === 'default') {
                localStorage.setItem(key, JSON.stringify(val));
            }
        } catch(e) {}
    }

    // --- STAFF MANAGEMENT (TENANT ISOLATED) ---
    async addStaff(staffData) {
        if (!this.db) throw new Error('Offline mode');
        const emailKey = staffData.email.toLowerCase();
        await this.getCollection('staff').doc(emailKey).set({
            ...staffData,
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId
        }, { merge: true });
        return true;
    }

    async getStaffList() {
        if (!this.db) return [];
        const snapshot = await this.getCollection('staff').get();
        return snapshot.docs.map(doc => doc.data()).filter(s => !s.tenant_id || s.tenant_id === this.tenantId);
    }

    async deleteStaff(email) {
        if (!this.db) throw new Error('Offline mode');
        await this.getCollection('staff').doc(email.toLowerCase()).delete();
        return true;
    }

    // --- APPOINTMENTS (TENANT ISOLATED) ---
    async getAppointments() {
        if (!this.useFirebase) {
            return this.getLocalData('dentalAppointments', []);
        }
        try {
            console.log(`Fetching appointments for clinic tenant [${this.tenantId}] from Firestore...`);
            const snapshot = await this.getCollection('appointments').get();
            const appointments = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Strict Tenant Isolation: skip if record belongs to another clinic
                if (data.tenant_id && data.tenant_id !== this.tenantId) {
                    return;
                }
                const docId = doc.id;
                const numericId = data.id || (isNaN(parseInt(docId)) ? 0 : parseInt(docId));

                appointments.push({
                    id: numericId,
                    docId: docId,
                    idString: docId,
                    tenant_id: data.tenant_id || this.tenantId,
                    clinic_slug: data.clinic_slug || this.tenantId,
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

            console.log(`Successfully fetched ${appointments.length} appointments for tenant [${this.tenantId}].`);

            // Save isolated local cache
            this.setLocalData('dentalAppointments', appointments);

            return appointments.sort((a, b) => {
                const timeA = a.createdAt || a.id || 0;
                const timeB = b.createdAt || b.id || 0;
                return timeB - timeA;
            });
        } catch (error) {
            console.warn(`Firebase error fetching appointments for [${this.tenantId}]:`, error);
            return this.getLocalData('dentalAppointments', []);
        }
    }

    // Create new appointment (Strictly isolated by collection and tenant_id)
    async createAppointment(appointment) {
        const payload = {
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            id: appointment.id || Date.now(),
            name: appointment.name || 'Unknown',
            email: appointment.email || '',
            place: appointment.place || '',
            mobile: window.phoneUtils ? window.phoneUtils.normalizePhone(appointment.mobile) : appointment.mobile,
            phoneNumber: window.phoneUtils ? window.phoneUtils.normalizePhone(appointment.mobile) : appointment.mobile,
            appointmentDate: appointment.appointmentDate || '',
            appointmentTime: appointment.appointmentTime || '',
            reason: appointment.reason || '',
            fee: parseFloat(appointment.fee) || 0,
            status: appointment.status || 'Pending',
            medicalAlerts: appointment.medicalAlerts || [],
            medicalNotes: appointment.medicalNotes || '',
            date: appointment.date || new Date().toLocaleDateString()
        };

        if (!this.useFirebase) {
            let appointments = this.getLocalData('dentalAppointments', []);
            const newAppointment = { ...payload, id: Date.now() };
            appointments.unshift(newAppointment);
            this.setLocalData('dentalAppointments', appointments);
            return newAppointment;
        }

        try {
            console.log(`Attempting to save appointment for tenant [${this.tenantId}]...`, payload);
            const docRef = await this.getCollection('appointments').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Successfully saved to tenant [${this.tenantId}] with doc ID:`, docRef.id);

            const savedAppt = {
                ...payload,
                docId: docRef.id
            };

            // Update isolated local cache
            let localList = this.getLocalData('dentalAppointments', []);
            localList.unshift(savedAppt);
            this.setLocalData('dentalAppointments', localList);

            return savedAppt;
        } catch (error) {
            console.error(`CRITICAL: Booking failed for tenant [${this.tenantId}]!`, error);
            let appointments = this.getLocalData('dentalAppointments', []);
            const fallbackAppt = { ...payload, id: Date.now() };
            appointments.unshift(fallbackAppt);
            this.setLocalData('dentalAppointments', appointments);
            return fallbackAppt;
        }
    }

    // Update appointment
    async updateAppointment(id, updates) {
        if (!this.useFirebase) {
            let appointments = this.getLocalData('dentalAppointments', []);
            const index = appointments.findIndex(a => a.id.toString() === id.toString() || a.docId === id);
            if (index !== -1) {
                appointments[index] = { ...appointments[index], ...updates };
                this.setLocalData('dentalAppointments', appointments);
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
            
            await docRef.update({
                ...updates,
                tenant_id: this.tenantId,
                clinic_slug: this.tenantId
            });
            
            // Local fallback update
            try {
                let local = this.getLocalData('dentalAppointments', []);
                const idx = local.findIndex(a => a.id.toString() === id.toString() || a.docId === id);
                if (idx !== -1) {
                    local[idx] = { ...local[idx], ...updates };
                    this.setLocalData('dentalAppointments', local);
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
            let appointments = this.getLocalData('dentalAppointments', []);
            appointments = appointments.filter(a => a.id.toString() !== id.toString() && a.docId !== id);
            this.setLocalData('dentalAppointments', appointments);
            return true;
        }

        try {
            if (!this.db) throw new Error('Firestore not initialized');
            await this.getCollection('appointments').doc(id.toString()).delete();
            let appointments = this.getLocalData('dentalAppointments', []);
            appointments = appointments.filter(a => a.id.toString() !== id.toString() && a.docId !== id);
            this.setLocalData('dentalAppointments', appointments);
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
            const local = this.getLocalData('dentalAppointments', []);
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
            await this.logAdminLogin('superadmin', { name: 'Super Admin', role: 'super_admin', type: 'SuperAdmin Access' });
            return { user: { email: 'superadmin', name: 'Super Admin', role: 'super_admin' }, error: null };
        }

        // 3. Immediate Fallback Admin Bypass (admin/admin, email/admin, or settings credentials)
        const isSwastikTenant = this.tenantId && this.tenantId.toLowerCase().includes('swastik');
        if ((lowerEmail === 'admin' || lowerEmail === defaultUser || (isSwastikTenant && (lowerEmail === 'swastikadmin' || lowerEmail === 'chintal'))) && 
            (password === 'admin' || password === defaultPass)) {
            console.log('💎 PWA Auth: Successful admin login via local/cloud fallback credential validation');
            const userEmail = isSwastikTenant ? 'swastikadmin' : defaultUser;
            const userName = isSwastikTenant ? 'Dr. Chintal Baman (BDS)' : 'Clinic Admin';
            await this.logAdminLogin(userEmail, { name: userName, role: 'admin', type: 'Clinic Admin Login' });
            return { user: { email: userEmail, role: 'admin', name: userName }, error: null };
        }

        // 3.5. Tenant Staff Login (stored in Firestore)
        if (this.useFirebase && this.db) {
            try {
                const staffDoc = await this.getCollection('staff').doc(lowerEmail).get();
                if (staffDoc.exists) {
                    const staffData = staffDoc.data();
                    if (staffData.password === password) {
                        console.log('💎 PWA Auth: Successful tenant staff login');
                        await this.logAdminLogin(lowerEmail, { 
                            name: staffData.name || lowerEmail, 
                            mobile: staffData.mobile || staffData.phone || '', 
                            role: staffData.role || 'staff', 
                            type: 'Staff Login' 
                        });
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

    // Log admin login history & visitor access (IP, Timestamp, Name, Mobile, Role/Type)
    async logAdminLogin(email, extraData = {}) {
        if (typeof email === 'object' && email !== null) {
            extraData = email;
            email = extraData.email || extraData.username || '';
        }
        let ip = 'Unknown';
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            ip = data.ip;
        } catch (e) {
            console.warn('Could not fetch IP address', e);
        }

        const logEntry = {
            tenant_id: extraData.tenant_id || this.tenantId,
            clinic_slug: extraData.clinic_slug || this.tenantId,
            email: email || extraData.email || 'N/A',
            name: extraData.name || (email === 'superadmin' ? 'Super Admin' : (email || 'Admin User')),
            mobile: extraData.mobile || '',
            role: extraData.role || (email === 'superadmin' ? 'super_admin' : 'admin'),
            type: extraData.type || (extraData.role === 'Visitor' ? 'Visitor Gate' : 'Staff Login'),
            ipAddress: ip,
            device: navigator.userAgent || 'Web Browser',
            timestamp: new Date().toISOString()
        };

        if (this.useFirebase && this.db) {
            try {
                // 1. Tenant-scoped login history
                await this.getCollection('login_history').add(logEntry);
                // 2. Global SuperAdmin log collection
                await this.db.collection('superadmin_logs').add(logEntry);
            } catch (err) {
                console.error('Failed to log admin login to Firestore', err);
            }
        }

        // Local fallback / cache per tenant and global
        const localLogs = this.getLocalData('adminLoginLogs', []);
        localLogs.unshift(logEntry);
        this.setLocalData('adminLoginLogs', localLogs.slice(0, 50));

        try {
            const globalLogs = JSON.parse(localStorage.getItem('superadmin_logs_cache') || '[]');
            globalLogs.unshift(logEntry);
            localStorage.setItem('superadmin_logs_cache', JSON.stringify(globalLogs.slice(0, 100)));
        } catch(e){}
    }

    // Record Visitor First-Time Access & Capture Marketing Lead
    async recordVisitorAccess(visitorData) {
        if (!visitorData) return false;
        const tenantId = this.tenantId || 'default';
        const contact = {
            name: visitorData.name || 'Visitor',
            mobile: visitorData.mobile || '',
            phone: visitorData.mobile || '',
            email: visitorData.email || '',
            tenant_id: tenantId,
            clinic_slug: tenantId,
            source: 'First-Time Access Gate',
            notes: 'Verified clinic access PIN',
            createdAt: new Date().toISOString()
        };

        // 1. Save to Firestore under marketing_contacts and visitors
        if (this.useFirebase && this.db) {
            try {
                await this.getCollection('visitors').add(contact);
                await this.getCollection('marketing_contacts').add(contact);
                // Also save to global marketing leads collection
                await this.db.collection('global_marketing_leads').add(contact);
            } catch (err) {
                console.warn('Firestore visitor record notice:', err);
            }
        }

        // 2. Log in SuperAdmin activity logs
        await this.logAdminLogin(contact.email, {
            name: contact.name,
            mobile: contact.mobile,
            role: 'Visitor',
            type: 'First-time Visitor Gate',
            tenant_id: tenantId
        });

        // 3. Cache locally in marketingContacts
        try {
            const localContacts = this.getLocalData('marketingContacts', []);
            localContacts.unshift(contact);
            this.setLocalData('marketingContacts', localContacts);

            const globalLeads = JSON.parse(localStorage.getItem('global_marketing_leads_cache') || '[]');
            globalLeads.unshift(contact);
            localStorage.setItem('global_marketing_leads_cache', JSON.stringify(globalLeads.slice(0, 150)));
        } catch(e){}

        return true;
    }

    // Get admin login history (Tenant-Scoped)
    async getAdminLoginHistory() {
        if (!this.useFirebase || !this.db) {
            return this.getLocalData('adminLoginLogs', []);
        }

        try {
            const snapshot = await this.getCollection('login_history').orderBy('timestamp', 'desc').limit(50).get();
            if (snapshot.empty) return [];
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(l => !l.tenant_id || l.tenant_id === this.tenantId);
        } catch (error) {
            console.error('Failed to fetch login history from Firestore', error);
            return this.getLocalData('adminLoginLogs', []);
        }
    }

    // Get SuperAdmin All Logs (Logins & Visitor Entries across all clinics)
    async getSuperAdminLogs() {
        let logs = [];
        if (this.useFirebase && this.db) {
            try {
                const snap = await this.db.collection('superadmin_logs').orderBy('timestamp', 'desc').limit(150).get();
                if (!snap.empty) {
                    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
            } catch (err) {
                console.warn('Superadmin logs query fallback:', err);
            }
        }

        // Merge with local cached logs
        try {
            const local = JSON.parse(localStorage.getItem('superadmin_logs_cache') || '[]');
            const legacy = this.getLocalData('adminLoginLogs', []);
            const combined = [...logs, ...local, ...legacy];
            // Deduplicate by timestamp + email
            const seen = new Set();
            logs = combined.filter(l => {
                const key = `${l.timestamp || ''}_${l.email || ''}_${l.type || ''}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        } catch(e) {}

        logs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        return logs;
    }

    // Get All Marketing Leads for SuperAdmin
    async getMarketingLeads() {
        if (!this.useFirebase || !this.db) {
            try {
                return JSON.parse(localStorage.getItem('global_marketing_leads_cache') || '[]') || this.getLocalData('marketingContacts', []);
            } catch(e) {
                return [];
            }
        }

        try {
            const snap = await this.db.collection('global_marketing_leads').orderBy('createdAt', 'desc').limit(200).get();
            if (!snap.empty) {
                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            return JSON.parse(localStorage.getItem('global_marketing_leads_cache') || '[]');
        } catch (err) {
            console.warn('Global marketing leads query fallback:', err);
            return JSON.parse(localStorage.getItem('global_marketing_leads_cache') || '[]');
        }
    }

    // Fetch all user email history (Google logins, registered patients, visitor gate leads) for 1-click marketing engagement
    async getAllEngagementEmailRecipients(tenantScope = 'all') {
        const emailMap = new Map();

        // 1. Fetch from superadmin_logs (all login history)
        try {
            const logs = await this.getSuperAdminLogs();
            (logs || []).forEach(l => {
                const email = (l.email || '').trim().toLowerCase();
                if (email && email.includes('@') && email.includes('.') && !email.includes('superadmin') && !email.includes('admin@clinic')) {
                    const tenant = l.tenant_id || l.clinic_slug || 'default';
                    if (tenantScope === 'all' || tenant === tenantScope) {
                        if (!emailMap.has(email)) {
                            emailMap.set(email, {
                                email: email,
                                name: l.name || (email.split('@')[0].replace(/[._]/g, ' ')),
                                mobile: l.mobile || '',
                                tenant_id: tenant,
                                role: l.role || 'Visitor',
                                source: l.type || 'Google Login History',
                                lastActive: l.timestamp || new Date().toISOString()
                            });
                        }
                    }
                }
            });
        } catch (e) {
            console.warn('Recipients from logs fetch notice:', e);
        }

        // 2. Fetch from global_marketing_leads
        try {
            const leads = await this.getMarketingLeads();
            (leads || []).forEach(l => {
                const email = (l.email || '').trim().toLowerCase();
                if (email && email.includes('@') && email.includes('.')) {
                    const tenant = l.tenant_id || l.clinic_slug || 'default';
                    if (tenantScope === 'all' || tenant === tenantScope) {
                        if (!emailMap.has(email)) {
                            emailMap.set(email, {
                                email: email,
                                name: l.name || (email.split('@')[0].replace(/[._]/g, ' ')),
                                mobile: l.mobile || l.phone || '',
                                tenant_id: tenant,
                                role: 'Patient / Visitor',
                                source: l.source || 'Marketing Gate Lead',
                                lastActive: l.createdAt || new Date().toISOString()
                            });
                        } else {
                            const existing = emailMap.get(email);
                            if (!existing.mobile && (l.mobile || l.phone)) existing.mobile = (l.mobile || l.phone);
                            if (existing.name === 'Patient' && l.name) existing.name = l.name;
                        }
                    }
                }
            });
        } catch (e) {
            console.warn('Recipients from leads fetch notice:', e);
        }

        // 3. Fetch from patient database across tenants
        if (this.useFirebase && this.db) {
            try {
                const tenantsToFetch = (tenantScope && tenantScope !== 'all') ? [tenantScope] : ['default', 'swastik-dental', ...(window.allLoadedTenants ? window.allLoadedTenants.map(t => t.id) : [])];
                const uniqueTenants = [...new Set(tenantsToFetch)];

                for (const tId of uniqueTenants) {
                    try {
                        const snap = await this.db.collection('tenants').doc(tId).collection('patients').limit(100).get();
                        snap.forEach(doc => {
                            const p = doc.data();
                            const email = (p.email || '').trim().toLowerCase();
                            if (email && email.includes('@') && email.includes('.')) {
                                if (tenantScope === 'all' || tId === tenantScope) {
                                    if (!emailMap.has(email)) {
                                        emailMap.set(email, {
                                            email: email,
                                            name: p.name || p.displayName || email.split('@')[0],
                                            mobile: p.mobile || p.phone || '',
                                            tenant_id: tId,
                                            role: 'Registered Patient',
                                            source: 'Patient Database',
                                            lastActive: p.updatedAt || p.createdAt || new Date().toISOString()
                                        });
                                    }
                                }
                            }
                        });
                    } catch(err) {}
                }
            } catch(e) {}
        }

        // 4. Merge any local storage patient profiles
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('patient_profile_')) {
                    try {
                        const p = JSON.parse(localStorage.getItem(k) || '{}');
                        const email = (p.email || '').trim().toLowerCase();
                        if (email && email.includes('@') && email.includes('.')) {
                            const tenant = p.tenant_id || 'default';
                            if (tenantScope === 'all' || tenant === tenantScope) {
                                if (!emailMap.has(email)) {
                                    emailMap.set(email, {
                                        email: email,
                                        name: p.name || email.split('@')[0],
                                        mobile: p.mobile || '',
                                        tenant_id: tenant,
                                        role: 'Registered Patient',
                                        source: 'Local Patient Profile',
                                        lastActive: p.updatedAt || new Date().toISOString()
                                    });
                                }
                            }
                        }
                    } catch(err) {}
                }
            }
        } catch(e) {}

        const list = Array.from(emailMap.values());
        list.sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));
        return list;
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
                phone: '+91 98765 43210',
                access_gate_enabled: true,
                pin_required: false,
                access_pin: '1234'
            };
        }
        if (id === 'default' || !id) {
            return {
                clinic_name: 'My Dental Clinic',
                subtitle: 'Dental & Cosmetic Clinic',
                primary_color: '#10B981',
                admin_user: 'admin',
                admin_pass: 'admin',
                doctor_name: 'Dr. Dental Expert (MDS)',
                degrees: 'M.D.S., B.D.S.',
                address: 'Modern Dental Care Center',
                phone: '+91 98765 43210',
                access_gate_enabled: true,
                pin_required: false,
                access_pin: '1234'
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
                doctor_name: settings.doctor_name || settings.subtitle || '',
                access_gate_enabled: (settings.access_gate_enabled !== undefined) ? !!settings.access_gate_enabled : true,
                pin_required: (settings.pin_required !== undefined) ? !!settings.pin_required : false,
                access_pin: settings.access_pin ? String(settings.access_pin).trim() : '1234'
            };

            await this.getCollection('settings').doc('clinic').set(dataToSave, { merge: true });
            if (this.db) {
                await this.db.collection('tenants').doc(this.tenantId).set({
                    name: dataToSave.clinic_name,
                    subtitle: dataToSave.subtitle,
                    primary_color: dataToSave.primary_color,
                    doctor_name: dataToSave.doctor_name,
                    access_gate_enabled: dataToSave.access_gate_enabled,
                    pin_required: dataToSave.pin_required,
                    access_pin: dataToSave.access_pin,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
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

    // Get Marketing Contacts (Firestore + localStorage fallback merged, tenant isolated)
    async getMarketingContacts() {
        // Always load isolated local contacts first
        let localContacts = this.getLocalData('marketing_contacts_local', []);

        if (!this.useFirebase) return localContacts;

        try {
            const snapshot = await this.getCollection('marketing_contacts').get();
            const firestoreContacts = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.tenant_id || data.tenant_id === this.tenantId) {
                    firestoreContacts.push({ id: doc.id, ...data });
                }
            });

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
            const local = this.getLocalData('marketing_contacts_local', []);
            const isDup = local.some(c => c.mobile === contact.mobile);
            if (!isDup) {
                local.push({ id: 'local_' + Date.now(), name: contact.name, mobile: contact.mobile, source: 'Marketing', tenant_id: this.tenantId });
                this.setLocalData('marketing_contacts_local', local);
            }
        } catch(e) {}

        if (!this.useFirebase) return null;

        try {
            const docRef = await this.getCollection('marketing_contacts').add({
                tenant_id: this.tenantId,
                clinic_slug: this.tenantId,
                name: contact.name,
                mobile: contact.mobile,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Remove from local cache since it's now in Firestore
            try {
                let local = this.getLocalData('marketing_contacts_local', []);
                local = local.filter(c => c.mobile !== contact.mobile);
                this.setLocalData('marketing_contacts_local', local);
            } catch(e) {}
            return { id: docRef.id, tenant_id: this.tenantId, ...contact };
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

    // --- NEW: Multi-Seating & Payment Management (Tenant Isolated) ---

    async getPayments(appointmentId) {
        let localPayments = [];
        try {
            localPayments = (this.getLocalData('dentalPayments', []))
                            .filter(p => p.appointmentId && p.appointmentId.toString() === appointmentId.toString() && (!p.tenant_id || p.tenant_id === this.tenantId));
        } catch(e){}

        if (!this.useFirebase) return localPayments;
        try {
            const snapshot = await this.getCollection('payments')
                .where('appointmentId', '==', appointmentId.toString())
                .get();
            const firestorePayments = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.tenant_id || data.tenant_id === this.tenantId) {
                    firestorePayments.push({ id: doc.id, ...data });
                }
            });
            
            return firestorePayments.length > 0 ? firestorePayments : localPayments;
        } catch (error) {
            return localPayments;
        }
    }

    async addPayment(payment) {
        const data = { 
            ...payment, 
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            type: 'payment', 
            createdAt: new Date().toISOString() 
        };
        try {
            let local = this.getLocalData('dentalPayments', []);
            local.push(data);
            this.setLocalData('dentalPayments', local);
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
        const data = { 
            ...charge, 
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            type: 'charge', 
            createdAt: new Date().toISOString() 
        };
        try {
            let local = this.getLocalData('dentalPayments', []);
            local.push(data);
            this.setLocalData('dentalPayments', local);
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
        if (!this.useFirebase) {
            return (this.getLocalData('dentalAppointments', []))
                .filter(a => a.mobile === mobile && (!a.tenant_id || a.tenant_id === this.tenantId));
        }
        try {
            const snapshot = await this.getCollection('appointments')
                .where('mobile', '==', mobile)
                .get();
            const history = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.tenant_id || data.tenant_id === this.tenantId) {
                    history.push({ id: doc.id, ...data });
                }
            });
            return history.sort((a, b) => {
                const dateA = a.appointmentDate || a.date;
                const dateB = b.appointmentDate || b.date;
                return (dateB || '').localeCompare(dateA || '');
            });
        } catch (error) {
            return [];
        }
    }

    // --- NEW: Patient Diagnosis History (Tenant Isolated) ---
    async getDiagnoses(mobile) {
        if (!this.useFirebase) {
            return (this.getLocalData('dentalDiagnoses', []))
                .filter(d => d.mobile === mobile && (!d.tenant_id || d.tenant_id === this.tenantId));
        }
        try {
            const snapshot = await this.getCollection('diagnoses')
                .where('mobile', '==', mobile)
                .get();
            const diagnoses = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.tenant_id || data.tenant_id === this.tenantId) {
                    diagnoses.push({ id: doc.id, ...data });
                }
            });
            return diagnoses.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            return [];
        }
    }

    async addDiagnosis(diagnosis) {
        const data = {
            ...diagnosis,
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            timestamp: Date.now(),
            createdAt: this.useFirebase ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };

        // Local cache
        try {
            let local = this.getLocalData('dentalDiagnoses', []);
            local.push(data);
            this.setLocalData('dentalDiagnoses', local);
        } catch(e){}

        if (!this.useFirebase) return true;
        try {
            await this.getCollection('diagnoses').add(data);
            return true;
        } catch (error) {
            return true;
        }
    }

    // --- NEW: Patient Charting & Signature (Tenant Isolated) ---
    async savePatientChart(mobile, chartData) {
        const payload = {
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            data: chartData,
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };

        if (this.useFirebase) {
            try {
                await this.getCollection('patient_charts').doc(mobile).set(payload, { merge: true });
            } catch (err) {
                console.warn("Failed to save chart to Firebase", err);
            }
        }
        try {
            let local = this.getLocalData('dentalCharts', {});
            local[mobile] = chartData;
            this.setLocalData('dentalCharts', local);
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
            let local = this.getLocalData('dentalCharts', {});
            return local[mobile] || {};
        } catch(e) {
            return {};
        }
    }

    async savePatientSignature(mobile, signatureBase64) {
        const payload = {
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            data: signatureBase64,
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };

        if (this.useFirebase) {
            try {
                await this.getCollection('patient_signatures').doc(mobile).set(payload, { merge: true });
            } catch (err) {
                console.warn("Failed to save signature to Firebase", err);
            }
        }
        try {
            let local = this.getLocalData('dentalSignatures', {});
            local[mobile] = signatureBase64;
            this.setLocalData('dentalSignatures', local);
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
            let local = this.getLocalData('dentalSignatures', {});
            return local[mobile] || null;
        } catch(e) {
            return null;
        }
    }

    // --- DIGITAL PRESCRIPTIONS (Rx - Tenant Isolated) ---
    async savePrescription(rxData) {
        const payload = {
            ...rxData,
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };
        try {
            let local = this.getLocalData('dentalPrescriptions', []);
            local.unshift({ ...payload, id: Date.now() });
            this.setLocalData('dentalPrescriptions', local);
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const docRef = await this.getCollection('prescriptions').add(payload);
                return { id: docRef.id, ...payload };
            } catch (err) {
                console.warn('Failed to save prescription to Firebase (saved to local cache):', err);
            }
        }
        return { id: Date.now(), ...payload };
    }

    async getPrescriptions(mobile) {
        const normMobile = window.phoneUtils ? window.phoneUtils.normalizePhone(mobile) : mobile;
        let results = [];
        try {
            const local = this.getLocalData('dentalPrescriptions', []);
            results = local.filter(r => (!r.tenant_id || r.tenant_id === this.tenantId) && (r.mobile === mobile || r.patientMobile === mobile || (normMobile && (r.mobile === normMobile || r.patientMobile === normMobile))));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const snap = await this.getCollection('prescriptions').where('mobile', '==', mobile).get();
                const fbResults = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    if (!data.tenant_id || data.tenant_id === this.tenantId) {
                        fbResults.push({ id: doc.id, ...data });
                    }
                });
                if (fbResults.length > 0) return fbResults;
            } catch (err) {
                console.warn('Failed to fetch prescriptions from Firebase:', err);
            }
        }
        return results;
    }

    // --- TREATMENT PLANS & COST ESTIMATES (Tenant Isolated) ---
    async saveTreatmentPlan(planData) {
        const payload = {
            ...planData,
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };
        try {
            let local = this.getLocalData('dentalTreatmentPlans', []);
            local.unshift({ ...payload, id: Date.now() });
            this.setLocalData('dentalTreatmentPlans', local);
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const docRef = await this.getCollection('treatment_plans').add(payload);
                return { id: docRef.id, ...payload };
            } catch (err) {
                console.warn('Failed to save treatment plan to Firebase (saved to local cache):', err);
            }
        }
        return { id: Date.now(), ...payload };
    }

    async getTreatmentPlans(mobile) {
        const normMobile = window.phoneUtils ? window.phoneUtils.normalizePhone(mobile) : mobile;
        let results = [];
        try {
            const local = this.getLocalData('dentalTreatmentPlans', []);
            results = local.filter(r => (!r.tenant_id || r.tenant_id === this.tenantId) && (r.mobile === mobile || r.patientMobile === mobile || (normMobile && (r.mobile === normMobile || r.patientMobile === normMobile))));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const snap = await this.getCollection('treatment_plans').where('mobile', '==', mobile).get();
                const fbResults = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    if (!data.tenant_id || data.tenant_id === this.tenantId) {
                        fbResults.push({ id: doc.id, ...data });
                    }
                });
                if (fbResults.length > 0) return fbResults;
            } catch (err) {
                console.warn('Failed to fetch treatment plans from Firebase:', err);
            }
        }
        return results;
    }

    // --- PATIENT MEDICAL ALERTS & HEALTH PROFILE (Tenant Isolated) ---
    async savePatientMedicalAlerts(mobile, alerts, notes) {
        const payload = {
            tenant_id: this.tenantId,
            clinic_slug: this.tenantId,
            mobile,
            alerts: alerts || [],
            notes: notes || '',
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };
        try {
            let local = this.getLocalData('dentalMedicalAlerts', {});
            local[mobile] = { alerts, notes, tenant_id: this.tenantId };
            this.setLocalData('dentalMedicalAlerts', local);
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
            const local = this.getLocalData('dentalMedicalAlerts', {});
            if (local[mobile]) localAlerts = local[mobile];
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const doc = await this.getCollection('patient_medical_alerts').doc(mobile).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (!data.tenant_id || data.tenant_id === this.tenantId) {
                        return data;
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch medical alerts from Firebase:', err);
            }
        }
        return localAlerts;
    }

    // --- ROUTE & VISITOR ANALYTICS TRACKING ---
    async trackRouteVisit(route, meta = {}) {
        if (!route) return;
        const tenantId = meta.tenantId || this.tenantId || 'default';
        const timestamp = new Date().toISOString();
        const routeLabel = String(route).trim();

        // 1. Local Cache Update
        try {
            const cacheKey = 'clinic_route_analytics';
            let stats = JSON.parse(localStorage.getItem(cacheKey) || '{}');
            const key = `${tenantId}::${routeLabel}`;
            if (!stats[key]) {
                stats[key] = { key, route: routeLabel, tenant_id: tenantId, count: 0, lastVisited: timestamp };
            }
            stats[key].count += 1;
            stats[key].lastVisited = timestamp;
            localStorage.setItem(cacheKey, JSON.stringify(stats));

            // Track total overall hits counter
            const totalHits = parseInt(localStorage.getItem('clinic_total_route_hits') || '0', 10) + 1;
            localStorage.setItem('clinic_total_route_hits', totalHits.toString());
        } catch(e) {}

        // 2. Cloud Firestore Aggregation
        if (this.useFirebase && this.db) {
            try {
                const safeDocId = `${tenantId}_${routeLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 80);
                const ref = this.db.collection('route_analytics').doc(safeDocId);
                const hasFieldValue = typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue;
                const inc = hasFieldValue ? firebase.firestore.FieldValue.increment(1) : 1;
                const serverTime = hasFieldValue ? firebase.firestore.FieldValue.serverTimestamp() : timestamp;

                await ref.set({
                    route: routeLabel,
                    tenant_id: tenantId,
                    count: inc,
                    lastVisited: serverTime
                }, { merge: true });
            } catch (err) {
                // Non-blocking analytics
            }
        }
    }

    async getAnalyticsSummary() {
        let routeStats = [];
        let totalVisitors = 0;
        let totalRouteHits = 0;

        // Fetch route analytics from Firestore if online
        if (this.useFirebase && this.db) {
            try {
                const snap = await this.db.collection('route_analytics').get();
                snap.forEach(doc => {
                    const data = doc.data();
                    routeStats.push({
                        id: doc.id,
                        route: data.route || 'General',
                        tenant_id: data.tenant_id || 'default',
                        count: typeof data.count === 'number' ? data.count : 1,
                        lastVisited: data.lastVisited && data.lastVisited.toDate ? data.lastVisited.toDate().toISOString() : (data.lastVisited || '')
                    });
                });
            } catch (err) {
                console.warn('Firestore analytics fetch notice:', err);
            }
        }

        // Fallback or merge with local cache
        if (routeStats.length === 0) {
            try {
                const local = JSON.parse(localStorage.getItem('clinic_route_analytics') || '{}');
                routeStats = Object.values(local);
            } catch(e) {}
        }

        routeStats.sort((a, b) => (b.count || 0) - (a.count || 0));
        totalRouteHits = routeStats.reduce((sum, r) => sum + (r.count || 0), 0);

        // Fetch total visitors count from marketing leads
        try {
            const leads = await this.getMarketingLeads();
            totalVisitors = leads ? leads.length : 0;
        } catch(e) {
            totalVisitors = routeStats.length;
        }

        return {
            totalVisitors,
            totalRouteHits,
            routeStats
        };
    }

    // --- GOOGLE 1-TAP VISITOR LOGIN & MARKETING LEAD CAPTURE ---
    async recordGoogleVisitor(googleUser) {
        if (!googleUser || !googleUser.email) return false;
        const tenantId = this.tenantId || 'default';
        const contact = {
            name: googleUser.displayName || googleUser.name || googleUser.email.split('@')[0],
            email: googleUser.email,
            mobile: googleUser.mobile || googleUser.phoneNumber || '',
            phone: googleUser.mobile || googleUser.phoneNumber || '',
            photoURL: googleUser.photoURL || '',
            tenant_id: tenantId,
            clinic_slug: tenantId,
            source: 'Google One-Tap Access',
            uid: googleUser.uid || '',
            createdAt: new Date().toISOString()
        };

        if (this.useFirebase && this.db) {
            try {
                const safeEmail = googleUser.email.replace(/[^a-zA-Z0-9]/g, '_');
                await this.getCollection('visitors').doc(safeEmail).set(contact, { merge: true });
                await this.getCollection('marketing_contacts').doc(safeEmail).set(contact, { merge: true });
                await this.db.collection('global_marketing_leads').doc(`${tenantId}_${safeEmail}`).set(contact, { merge: true });
            } catch (err) {
                console.warn('Firestore Google visitor record notice:', err);
            }
        }

        // Log in SuperAdmin security logs
        await this.logAdminLogin(contact.email, {
            name: contact.name,
            mobile: contact.mobile,
            role: 'Google Visitor',
            type: 'Google 1-Tap Access',
            tenant_id: tenantId
        });

        // Cache locally in marketing leads cache
        try {
            const globalLeads = JSON.parse(localStorage.getItem('global_marketing_leads_cache') || '[]');
            const existsIdx = globalLeads.findIndex(l => l.email === contact.email && l.tenant_id === tenantId);
            if (existsIdx >= 0) {
                globalLeads[existsIdx] = contact;
            } else {
                globalLeads.unshift(contact);
            }
            localStorage.setItem('global_marketing_leads_cache', JSON.stringify(globalLeads.slice(0, 150)));
        } catch(e) {}

        return true;
    }

    // --- SAVE EXTENDED PATIENT PROFILE (Details completed in profile section) ---
    async savePatientProfile(email, profileData) {
        if (!email) return false;
        const tenantId = this.tenantId || 'default';
        const payload = {
            ...profileData,
            email: email,
            tenant_id: tenantId,
            clinic_slug: tenantId,
            updatedAt: new Date().toISOString()
        };

        // Cache locally
        try {
            const cacheKey = `patient_profile_${tenantId}_${email}`;
            localStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const safeDocId = email.replace(/[^a-zA-Z0-9]/g, '_');
                await this.getCollection('patients').doc(safeDocId).set(payload, { merge: true });
                if (payload.mobile) {
                    await this.db.collection('global_marketing_leads').doc(`${tenantId}_${safeDocId}`).set({
                        mobile: payload.mobile,
                        phone: payload.mobile,
                        name: payload.name || payload.displayName || ''
                    }, { merge: true });
                }
                return true;
            } catch (err) {
                console.warn('Failed to save profile to Firestore:', err);
            }
        }
        return true;
    }

    async getPatientProfile(email) {
        if (!email) return null;
        const tenantId = this.tenantId || 'default';
        const cacheKey = `patient_profile_${tenantId}_${email}`;
        
        let localProfile = null;
        try {
            localProfile = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        } catch(e) {}

        if (this.useFirebase && this.db) {
            try {
                const safeDocId = email.replace(/[^a-zA-Z0-9]/g, '_');
                const doc = await this.getCollection('patients').doc(safeDocId).get();
                if (doc.exists) {
                    const data = doc.data();
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    return data;
                }
            } catch (err) {
                console.warn('Failed to fetch patient profile from Firestore:', err);
            }
        }
        return localProfile;
    }
}

// Export singleton instance
window.dbAPI = new DatabaseAPI();
