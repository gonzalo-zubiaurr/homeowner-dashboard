-- ============================================================
-- HOMEOWNER ONBOARDING DASHBOARD — Supabase Setup Script
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Homeowners table
CREATE TABLE IF NOT EXISTS homeowners (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  unit        TEXT,
  lease_start TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Checklist items table
CREATE TABLE IF NOT EXISTS checklist_items (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  homeowner_id  UUID REFERENCES homeowners(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,  -- 'insurance' | 'w9' | 'dwolla_verified' | 'payment_method' | 'id_verified'
  completed     BOOLEAN DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(homeowner_id, item_key)
);

-- 3. Enable Row Level Security (but allow public read/write since it's an internal tool)
ALTER TABLE homeowners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Allow anyone with the anon key to read and write
-- (Change this to use auth if you want login-protected access later)
CREATE POLICY "Public read homeowners"      ON homeowners      FOR SELECT USING (true);
CREATE POLICY "Public insert homeowners"    ON homeowners      FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read checklist"       ON checklist_items FOR SELECT USING (true);
CREATE POLICY "Public upsert checklist"     ON checklist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update checklist"     ON checklist_items FOR UPDATE USING (true);

-- 4. Enable real-time replication (required for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE homeowners;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items;

-- ============================================================
-- OPTIONAL: Add some sample homeowners to test with
-- ============================================================
-- INSERT INTO homeowners (name, unit, lease_start) VALUES
--   ('John Smith', '101', '2024-02-01'),
--   ('Maria Garcia', '204', '2024-02-15'),
--   ('David Kim', '312', '2024-03-01');
