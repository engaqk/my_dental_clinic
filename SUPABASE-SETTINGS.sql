-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Create the settings table
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  clinic_name TEXT,
  subtitle TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  admin_user TEXT,
  admin_pass TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert default settings (if table is empty)
INSERT INTO settings (clinic_name, subtitle, primary_color, secondary_color, admin_user, admin_pass)
SELECT 'Dr. Drashti''s Dental Clinic', 'Advanced Dental & Cosmetic Clinic', '#26A69A', '#42A5F5', 'drashtijani1812@gmail.com', 'drashti@123'
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- 3. Enable Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Allowing anon access for demo purposes)
-- Allow EVERYONE to read settings (so the theme loads for patients)
CREATE POLICY "Public read settings" 
ON settings FOR SELECT 
USING (true);

-- Allow EVERYONE to insert/update settings (for Admin Dashboard white-labeling to work from client)
-- NOTE: In a production app with real auth, restrict this to authenticated users only!
CREATE POLICY "Allow update settings" 
ON settings FOR UPDATE 
USING (true);

CREATE POLICY "Allow insert settings" 
ON settings FOR INSERT 
WITH CHECK (true);

-- 5. Add About Text Column (Update)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS about_text TEXT;
