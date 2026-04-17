// Firebase Integration - Fully Replaces Supabase while keeping Business Logic Intact
// Get your Firebase credentials from: https://console.firebase.google.com/
class DatabaseAPI {
    constructor() {
        this.useFirebase = true;
        this.db = null;
        this.auth = null;

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
    async getAppointments() {
        if (!this.useFirebase) {
            return JSON.parse(localStorage.getItem('appointments')) || [];
        }
        try {
            console.log('Fetching appointments from Firestore...');
            const snapshot = await this.db.collection('appointments').get();
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
                    place: data.place || data.city || '',
                    mobile: data.mobile || data.phoneNumber || data.mobileNo || '', 
                    reason: data.reason || data.service || 'General',
                    fee: parseFloat(data.fee) || 0,
                    status: data.status || 'Pending',
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
            const docRef = await this.db.collection('appointments').add({
                id: appointment.id || Date.now(), // Keep numeric ID for sorting
                name: appointment.name || 'Unknown',
                place: appointment.place || '',
                mobile: normalizedMobile || appointment.mobile || '',
                phoneNumber: normalizedMobile || appointment.mobile || '',
                appointmentDate: appointment.appointmentDate || '',
                appointmentTime: appointment.appointmentTime || '',
                reason: appointment.reason || '',
                fee: parseFloat(appointment.fee) || 0,
                status: appointment.status || 'Pending',
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
                docRef = this.db.collection('appointments').doc(id.toString());
            } else {
                const q = await this.db.collection('appointments').where('id', '==', parseInt(id)).get();
                if (!q.empty) {
                    docRef = q.docs[0].ref;
                } else {
                    docRef = this.db.collection('appointments').doc(id.toString());
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
            await this.db.collection('appointments').doc(id.toString()).delete();
            return true;
        } catch (error) {
            console.error('Firebase error deleting appointment:', error);
            return false;
        }
    }

    // Get booked time slots for a specific date
    async getBookedTimeSlots(date) {
        if (!this.useFirebase) {
            const appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            return appointments
                .filter(app => app.appointmentDate === date && app.status !== 'Cancelled')
                .map(app => app.appointmentTime);
        }

        try {
            // Simplified query to avoid composite index requirement
            const snapshot = await this.db.collection('appointments')
                .where('appointmentDate', '==', date)
                .get();

            const bookedSlots = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Filter status in-memory
                if (data.status !== 'Cancelled') {
                    const time = data.appointmentTime || data.appointment_time;
                    if (time) {
                        bookedSlots.push(time.length > 5 ? time.substring(0, 5) : time);
                    }
                }
            });
            return bookedSlots;
        } catch (error) {
            if (error.code === 'failed-precondition') {
                console.error('INDEX ERROR (getBookedTimeSlots): You must create a composite index in Firebase Console. Click the link in your console log.');
            } else {
                console.error('Firebase error (getBookedTimeSlots):', error);
            }
            return [];
        }
    }

    // Sign In (Supabase API Match but using Firebase Auth)
    async signIn(email, password) {
        if (!this.useFirebase) {
            let settings = {};
            try { settings = JSON.parse(localStorage.getItem('clinicSettings')) || {}; } catch (e) { }
            const defaultUser = settings.adminUser || 'abdulqadir.galaxy53@gmail.com';
            const defaultPass = settings.adminPass || 'admin53';

            if ((email === 'admin1' || email === 'abdulqadir.galaxy53@gmail.com') && password === '!@#Qadir') {
                return { user: { email: 'abdulqadir.galaxy53@gmail.com', role: 'super_admin' }, error: null };
            }

            if ((email === 'admin' || email === defaultUser) && password === defaultPass) {
                return { user: { email: defaultUser, role: 'admin' }, error: null };
            }
            return { user: null, error: { message: 'Invalid credentials' } };
        }

        let settings = {};
        try { settings = JSON.parse(localStorage.getItem('clinicSettings')) || {}; } catch (e) { }
        const defaultUser = settings.adminUser || 'abdulqadir.galaxy53@gmail.com';
        const defaultPass = settings.adminPass || 'admin53';

        if ((email === 'admin1' || email === 'abdulqadir.galaxy53@gmail.com') && password === '!@#Qadir') {
            return { user: { email: 'abdulqadir.galaxy53@gmail.com', role: 'super_admin' }, error: null };
        }

        let finalEmail = email;
        if (email.trim().toLowerCase() === 'admin') {
            finalEmail = defaultUser;
        }

        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(finalEmail, password);
            return { user: userCredential.user, error: null };
        } catch (error) {
            if (finalEmail === defaultUser && password === defaultPass) {
                console.warn('Firebase login failed, using fallback admin access');
                return { user: { email: defaultUser, role: 'admin' }, error: null };
            }
            // Add a friendly invalid message mimicking supabase behavior
            return { user: null, error: { message: 'Invalid username or password' } };
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

    // Get App Settings
    async getSettings() {
        if (!this.useFirebase) {
            return JSON.parse(localStorage.getItem('clinicSettings')) || {};
        }
        try {
            const doc = await this.db.collection('settings').doc('clinic').get();
            if (doc.exists) {
                return doc.data();
            }
            return JSON.parse(localStorage.getItem('clinicSettings')) || {};
        } catch (error) {
            console.error('Error fetching settings (using local fallback):', error);
            return JSON.parse(localStorage.getItem('clinicSettings')) || {};
        }
    }

    // Save App Settings
    async saveSettings(settings) {
        if (!settings) return false;
        
        // Cache locally
        localStorage.setItem('clinicSettings', JSON.stringify(settings));

        if (!this.useFirebase) return true;

        try {
            // Defensive mapping to avoid "undefined" values in Firestore
            const dataToSave = {
                clinic_name: settings.name || settings.clinic_name || 'My Dental Clinic',
                subtitle: settings.subtitle || '',
                primary_color: settings.primaryColor || settings.primary_color || '#26A69A',
                admin_user: settings.adminUser || settings.admin_user || 'admin',
                admin_pass: settings.adminPass || settings.admin_pass || '',
                admin_email: settings.adminEmail || settings.admin_email || '', 
                about_text: settings.aboutText || settings.about_text || ''
            };

            await this.db.collection('settings').doc('clinic').set(dataToSave, { merge: true });
            console.log('Settings successfully synced to Firestore');
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
            const doc = await this.db.collection('settings').doc('gateway').get();
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
            await this.db.collection('settings').doc('gateway').set(settings, { merge: true });
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
            const snapshot = await this.db.collection('marketing_contacts').get();
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
            const docRef = await this.db.collection('marketing_contacts').add({
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
            await this.db.collection('marketing_contacts').doc(id).delete();
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
            const docRef = this.db.collection('marketing_contacts').doc(id);
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
            await this.db.collection('broadcast_history').add({
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
            const doc = await this.db.collection('clinical_notes').doc(appointmentId.toString()).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            return null;
        }
    }

    async saveClinicalNotes(appointmentId, notes) {
        if (!this.useFirebase) return false;
        try {
            await this.db.collection('clinical_notes').doc(appointmentId.toString()).set({
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
            const snapshot = await this.db.collection('payments')
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
        // Always cache locally first
        try {
            let payments = JSON.parse(localStorage.getItem('dentalPayments')) || [];
            payments.push({ ...payment, id: 'pay_' + Date.now(), createdAt: new Date() });
            localStorage.setItem('dentalPayments', JSON.stringify(payments));
        } catch(e){}

        if (!this.useFirebase) return true;
        try {
            const data = {
                ...payment,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await this.db.collection('payments').add(data);
            return true;
        } catch (error) {
            console.warn('Firestore payment failed, using local only');
            return true; 
        }
    }

    async getPatientHistory(mobile) {
        if (!this.useFirebase) return [];
        try {
            const snapshot = await this.db.collection('appointments')
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
}

// Export singleton instance
window.dbAPI = new DatabaseAPI();
