-- Drop old tables and recreate with new schema
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS homeowners CASCADE;
DROP TABLE IF EXISTS leases CASCADE;

-- Homes table (checklist tied to home, not lease)
CREATE TABLE IF NOT EXISTS homes (
  home_id       TEXT PRIMARY KEY,
  home_link     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Leases table (all lease data from CSV)
CREATE TABLE IF NOT EXISTS leases (
  lease_id              TEXT PRIMARY KEY,
  lease_link            TEXT,
  home_id               TEXT REFERENCES homes(home_id) ON DELETE CASCADE,
  address               TEXT,
  concierge             TEXT,
  homeowner_name        TEXT,
  lease_type            TEXT,
  payout_plan           TEXT,
  rent_amount           NUMERIC,
  rent_payout_status    TEXT,
  open_payable_count    INTEGER DEFAULT 0,
  open_payable_balance  NUMERIC DEFAULT 0,
  first_open_payable_month TEXT,
  last_open_payable_month  TEXT,
  lease_start_on        TIMESTAMPTZ,
  lease_end_on          TIMESTAMPTZ,
  terminated_on         TIMESTAMPTZ,
  notice_type           TEXT,
  lease_status          TEXT,
  agreement_status      TEXT,
  -- Manual fields (team updates)
  manual_status         TEXT, -- 'processing' override
  notes                 TEXT,
  escalated             BOOLEAN DEFAULT FALSE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist items (tied to home_id)
CREATE TABLE IF NOT EXISTS checklist_items (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  home_id       TEXT REFERENCES homes(home_id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,
  completed     BOOLEAN DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(home_id, item_key)
);

-- RLS
ALTER TABLE homes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public all homes"      ON homes           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all leases"     ON leases          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all checklist"  ON checklist_items FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE homes;
ALTER PUBLICATION supabase_realtime ADD TABLE leases;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items;
