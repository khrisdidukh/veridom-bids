import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "bid-comparison-core",
      sql: `CREATE TABLE IF NOT EXISTS bid_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE TABLE IF NOT EXISTS bid_project_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE TABLE IF NOT EXISTS scope_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES bid_projects(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  title TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL CHECK (quantity >= 0),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  benchmark_min DOUBLE PRECISION,
  benchmark_max DOUBLE PRECISION,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now()),
  CHECK (benchmark_min IS NULL OR benchmark_max IS NULL OR benchmark_max >= benchmark_min)
);
CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES bid_projects(id) ON DELETE CASCADE,
  contractor_name TEXT NOT NULL,
  contractor_email TEXT,
  quote_ref TEXT,
  quote_date TEXT,
  valid_until TEXT,
  quoted_net DOUBLE PRECISION,
  vat_rate DOUBLE PRECISION,
  payment_terms TEXT,
  warranty_months INTEGER,
  start_date TEXT,
  duration_days INTEGER,
  file_name TEXT,
  source_text TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','extracted','reviewed')),
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS bid_lines (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  scope_item_id TEXT REFERENCES scope_items(id) ON DELETE SET NULL,
  position TEXT,
  description TEXT NOT NULL,
  quantity DOUBLE PRECISION,
  unit TEXT,
  unit_price DOUBLE PRECISION,
  total DOUBLE PRECISION,
  coverage TEXT NOT NULL DEFAULT 'included' CHECK (coverage IN ('included','excluded','optional','unclear')),
  note TEXT,
  edited_by TEXT NOT NULL DEFAULT 'agent' CHECK (edited_by IN ('agent','user')),
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS bid_flags (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  scope_item_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('missing','excluded','price_high','price_low','quantity','terms','other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high','medium','low')),
  message TEXT NOT NULL,
  impact DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'check' CHECK (source IN ('check','agent','user')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS bid_questions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  flag_id TEXT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS bid_projects_owner_org_idx ON bid_projects (owner_email, org_id, created_at);
CREATE INDEX IF NOT EXISTS bid_project_shares_resource_idx ON bid_project_shares (resource_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS scope_items_project_idx ON scope_items (project_id, sort_order);
CREATE INDEX IF NOT EXISTS bids_project_idx ON bids (project_id, created_at);
CREATE INDEX IF NOT EXISTS bid_lines_bid_idx ON bid_lines (bid_id, scope_item_id);
CREATE INDEX IF NOT EXISTS bid_lines_project_idx ON bid_lines (project_id);
CREATE INDEX IF NOT EXISTS bid_flags_project_idx ON bid_flags (project_id, bid_id, status);
CREATE INDEX IF NOT EXISTS bid_questions_project_idx ON bid_questions (project_id, bid_id)`,
    },
    {
      version: 2,
      name: "bid-lines-original-contribution",
      sql: `ALTER TABLE bid_lines ADD COLUMN IF NOT EXISTS original_contribution DOUBLE PRECISION`,
    },
  ],
  { table: "veridom_bids_migrations" },
);
