// Supabase Database Integration - Free & Open Source
// Get your Supabase credentials from: https://supabase.com/dashboard/project/_// Database API Wrapper
class DatabaseAPI {
    constructor() {
        this.supabase = null;
        this.useSupabase = true;

        // Configuration for Multi-Tenancy (Switch DB based on URL)
        const CONFIG = {
            // Default / Old Clinic
            'default': {
                url: 'https://nndyapaaveycsucwipoh.supabase.co',
                key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZHlhcGFhdmV5Y3N1Y3dpcG9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTIxOTksImV4cCI6MjA4NDIyODE5OX0.FbfLDY46GzTApTqlD1JUnmB2-zxywIAvH2PtT7r5N9k'
            },
            // New "My Dental Clinic"
            'my_dental_clinic': {
                url: 'https://qukrklsgctpkiyninqdb.supabase.co',
                key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1a3JrbHNnY3Rwa2l5bmlucWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDk1NjEsImV4cCI6MjA4NDgyNTU2MX0.DsVh4WLQu86gxl91opf_tltCoZTs863rUETECdtY1JA'
            }
        };

        // Determine which DB to use
        const currentUrl = window.location.href.toLowerCase();
        let selectedConfig = CONFIG['default'];

        if (currentUrl.includes('my_dental_clinic')) {
            console.log('Using Database: My Dental Clinic');
            selectedConfig = CONFIG['my_dental_clinic'];
        } else {
            console.log('Using Database: Dr. Drashtis Default');
        }

        const SUPABASE_URL = selectedConfig.url;
        const SUPABASE_ANON_KEY = selectedConfig.key;

        try {
            if (typeof supabase !== 'undefined') {
                this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('Supabase connected successfully');
            } else {
                console.warn('Supabase JS not loaded, falling back to local storage');
                this.useSupabase = false;
            }
        } catch (error) {
            console.error('Supabase initialization failed:', error);
            this.useSupabase = false;
        }
    }

    // Get all appointments
    async getAppointments() {
        if (!this.useSupabase) {
            return JSON.parse(localStorage.getItem('dentalAppointments')) || [];
        }

        try {
            const { data, error } = await this.supabase
                .from('appointments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform to match localStorage format
            return data.map(apt => ({
                id: apt.id,
                date: apt.booking_date,
                appointmentDate: apt.appointment_date,
                appointmentTime: apt.appointment_time,
                name: apt.name,
                place: apt.place,
                mobile: apt.mobile,
                reason: apt.reason,
                fee: parseFloat(apt.fee),
                status: apt.status
            }));
        } catch (error) {
            console.error('Supabase error:', error);
            if (error.code === '42P01' || (error.message && error.message.includes('relation "public.appointments" does not exist'))) {
                alert('CRITICAL ERROR: Database tables not found!\n\nPlease run the "FULL_DB_SETUP.sql" script in your Supabase SQL Editor.');
            }
            return JSON.parse(localStorage.getItem('dentalAppointments')) || [];
        }
    }

    // Create new appointment
    async createAppointment(appointment) {
        if (!this.useSupabase) {
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            const newAppointment = { ...appointment, id: Date.now() };
            appointments.push(newAppointment);
            localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
            return newAppointment;
        }

        try {
            const { data, error } = await this.supabase
                .from('appointments')
                .insert([{
                    name: appointment.name,
                    place: appointment.place,
                    mobile: appointment.mobile,
                    appointment_date: appointment.appointmentDate,
                    appointment_time: appointment.appointmentTime,
                    reason: appointment.reason,
                    fee: appointment.fee || 0,
                    status: appointment.status || 'Pending',
                    booking_date: appointment.date || new Date().toLocaleDateString()
                }])
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                date: data.booking_date,
                appointmentDate: data.appointment_date,
                appointmentTime: data.appointment_time,
                name: data.name,
                place: data.place,
                mobile: data.mobile,
                reason: data.reason,
                fee: parseFloat(data.fee),
                status: data.status
            };
        } catch (error) {
            console.error('Supabase error:', error);
            // Fallback to localStorage
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            const newAppointment = { ...appointment, id: Date.now() };
            appointments.push(newAppointment);
            localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
            return newAppointment;
        }
    }

    // Update appointment
    async updateAppointment(id, updates) {
        if (!this.useSupabase) {
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            const index = appointments.findIndex(a => a.id === id);
            if (index !== -1) {
                appointments[index] = { ...appointments[index], ...updates };
                localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
                return appointments[index];
            }
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('appointments')
                .update({
                    status: updates.status,
                    fee: updates.fee
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                date: data.booking_date,
                appointmentDate: data.appointment_date,
                appointmentTime: data.appointment_time,
                name: data.name,
                place: data.place,
                mobile: data.mobile,
                reason: data.reason,
                fee: parseFloat(data.fee),
                status: data.status
            };
        } catch (error) {
            console.error('Supabase error:', error);
            // Fallback to localStorage
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            const index = appointments.findIndex(a => a.id === id);
            if (index !== -1) {
                appointments[index] = { ...appointments[index], ...updates };
                localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
                return appointments[index];
            }
            return null;
        }
    }

    // Delete appointment
    async deleteAppointment(id) {
        if (!this.useSupabase) {
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            appointments = appointments.filter(a => a.id !== id);
            localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
            return true;
        }

        try {
            const { error } = await this.supabase
                .from('appointments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase error:', error);
            // Fallback to localStorage
            let appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            appointments = appointments.filter(a => a.id !== id);
            localStorage.setItem('dentalAppointments', JSON.stringify(appointments));
            return true;
        }
    }

    // Get booked time slots for a specific date
    async getBookedTimeSlots(date) {
        if (!this.useSupabase) {
            const appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            return appointments
                .filter(app => app.appointmentDate === date && app.status !== 'Cancelled')
                .map(app => app.appointmentTime);
        }

        try {
            const { data, error } = await this.supabase
                .from('appointments')
                .select('appointment_time')
                .eq('appointment_date', date)
                .neq('status', 'Cancelled');

            if (error) throw error;
            console.log(`[DEBUG] getBookedTimeSlots(${date}) =>`, data);

            return data.map(item => {
                // Supabase (Postgres) returns TIME as HH:MM:SS
                // We only want HH:MM
                return item.appointment_time ? item.appointment_time.substring(0, 5) : null;
            }).filter(Boolean);
        } catch (error) {
            console.error('Supabase error:', error);
            const appointments = JSON.parse(localStorage.getItem('dentalAppointments')) || [];
            return appointments
                .filter(app => app.appointmentDate === date && app.status !== 'Cancelled')
                .map(app => app.appointmentTime);
        }
    }

    // Sign In
    async signIn(email, password) {
        if (!this.useSupabase) {
            // Read White Label Settings
            let settings = {};
            try { settings = JSON.parse(localStorage.getItem('clinicSettings')) || {}; } catch (e) { }
            const defaultUser = settings.adminUser || 'drashtijani1812@gmail.com';
            const defaultPass = settings.adminPass || 'drashti@123';

            // Check for Super Admin
            if ((email === 'admin1' || email === 'abdulqadir.galaxy53@gmail.com') && password === '!@#Qadir') {
                return {
                    user: { email: 'abdulqadir.galaxy53@gmail.com', role: 'super_admin' },
                    error: null
                };
            }

            // Mock login for localStorage mode
            if ((email === 'admin' || email === defaultUser) && password === defaultPass) {
                return {
                    user: { email: defaultUser, role: 'admin' },
                    error: null
                };
            }
            return { user: null, error: { message: 'Invalid credentials' } };
        }

        // Read White Label Settings
        let settings = {};
        try {
            settings = JSON.parse(localStorage.getItem('clinicSettings')) || {};
        } catch (e) { }

        const defaultUser = settings.adminUser || 'drashtijani1812@gmail.com';
        const defaultPass = settings.adminPass || 'drashti@123';

        // Check for Super Admin (Hardcoded for White Label Access)
        if ((email === 'admin1' || email === 'abdulqadir.galaxy53@gmail.com') && password === '!@#Qadir') {
            return {
                user: { email: 'abdulqadir.galaxy53@gmail.com', role: 'super_admin' },
                error: null
            };
        }

        // Handle "admin" username alias -> map to Dynamic Default User
        let finalEmail = email;
        if (email.trim().toLowerCase() === 'admin') {
            finalEmail = defaultUser;
            console.log('Mapping "admin" to:', finalEmail);
        }

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email: finalEmail,
            password: password,
        });

        // Fallback: If Supabase auth fails (e.g., user not created yet) 
        // BUT credentials match the Dynamic Admin, allow access.
        if (error && (finalEmail === defaultUser && password === defaultPass)) {
            console.warn('Supabase login failed, using fallback admin access');
            return {
                user: { email: defaultUser, role: 'admin' },
                error: null
            };
        }

        return { user: data.user, error };
    }

    // Sign Out
    async signOut() {
        if (!this.useSupabase) {
            return { error: null };
        }
        const { error } = await this.supabase.auth.signOut();
        return { error };
    }

    // Send Password Reset Email
    async sendPasswordReset(email) {
        if (!this.useSupabase) {
            return { error: { message: 'Password reset not available in offline mode' } };
        }

        const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.href.split('?')[0].split('#')[0],
        });

        return { data, error };
    }

    // Update User (e.g. for Password Reset)
    async updateUser(attributes) {
        if (!this.useSupabase) {
            return { error: { message: 'Cannot update user in offline mode' } };
        }
        const { data, error } = await this.supabase.auth.updateUser(attributes);
        return { data, error };
    }

    // Get App Settings
    async getSettings() {
        if (!this.useSupabase) {
            return JSON.parse(localStorage.getItem('clinicSettings')) || {};
        }
        try {
            const { data, error } = await this.supabase
                .from('settings')
                .select('*')
                .limit(1)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching settings (using local fallback):', error);
            return JSON.parse(localStorage.getItem('clinicSettings')) || {};
        }
    }

    // Save App Settings
    async saveSettings(settings) {
        // Always save to local for offline backup/speed
        localStorage.setItem('clinicSettings', JSON.stringify(settings));

        if (!this.useSupabase) return true;

        try {
            // Check if row exists
            const { data: existing } = await this.supabase.from('settings').select('id').limit(1).single();

            if (existing) {
                // Update
                const { error } = await this.supabase
                    .from('settings')
                    .update({
                        clinic_name: settings.name,
                        subtitle: settings.subtitle,
                        primary_color: settings.primaryColor,
                        secondary_color: settings.secondaryColor,
                        admin_user: settings.adminUser,
                        admin_pass: settings.adminPass,
                        about_text: settings.aboutText
                    })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                // Insert first row
                const { error } = await this.supabase
                    .from('settings')
                    .insert([{
                        clinic_name: settings.name,
                        subtitle: settings.subtitle,
                        primary_color: settings.primaryColor,
                        secondary_color: settings.secondaryColor,
                        admin_user: settings.adminUser,
                        admin_pass: settings.adminPass,
                        about_text: settings.aboutText
                    }]);
                if (error) throw error;
            }
            return true;
        } catch (error) {
            console.error('Error saving settings to Supabase:', error);
            alert('Saved locally, but failed to sync to cloud. (Check if "settings" table exists within Supabase)');
            return false;
        }
    }
}

// Export singleton instance
window.dbAPI = new DatabaseAPI();
