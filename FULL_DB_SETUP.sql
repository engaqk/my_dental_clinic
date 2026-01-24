-- ==========================================
-- SUPER DENTAL CLINIC - FULL DATABASE SETUP
-- Run this script in verify specific Supabase Project SQL Editor
-- ==========================================

-- 1. Create APPOINTMENTS Table
CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  treatment TEXT,
  status TEXT DEFAULT 'Scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policies for Appointments (Public Access for Demo)
CREATE POLICY "Allow public select appointments" ON appointments FOR SELECT USING (true);
CREATE POLICY "Allow public insert appointments" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update appointments" ON appointments FOR UPDATE USING (true);


-- 2. Create SETTINGS Table (For White Label Features)
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  clinic_name TEXT,
  subtitle TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  admin_user TEXT,
  admin_pass TEXT,
  about_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policies for Settings
CREATE POLICY "Allow public select settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert settings" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update settings" ON settings FOR UPDATE USING (true);

-- 3. Insert Default Settings (Bootstrap)
INSERT INTO settings (clinic_name, subtitle, primary_color, secondary_color, admin_user, admin_pass, about_text)
SELECT 
  'My Dental Clinic', 
  'Premium Dental Services', 
  '#26A69A', 
  '#42A5F5', 
  'admin@example.com', 
  'admin123',
  'Welcome to our premium dental facility. We provide top-notch care...'
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- 4. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone);


-- 5. Create STAFF_PROFILES Table
CREATE TABLE IF NOT EXISTS staff_profiles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',
  email TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for Staff
CREATE POLICY "Allow public read staff" ON staff_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public update staff" ON staff_profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public insert staff" ON staff_profiles FOR INSERT WITH CHECK (true);

-- Insert Default Staff
INSERT INTO staff_profiles (name, role, email)
SELECT 'Dr. Admin', 'Doctor', 'admin@example.com'
WHERE NOT EXISTS (SELECT 1 FROM staff_profiles);
