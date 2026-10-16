PRAGMA foreign_keys = ON;

CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  room_name TEXT,
  expected_configuration_json TEXT NOT NULL,
  confirmed_counts_json TEXT NOT NULL,
  detector_versions_json TEXT NOT NULL,
  sound_summary_json TEXT NOT NULL,
  anomaly_summary_json TEXT NOT NULL,
  threshold REAL NOT NULL CHECK (threshold >= 0.1 AND threshold <= 0.85),
  report_schema_version INTEGER NOT NULL,
  app_version TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(owner_id, idempotency_key)
);
CREATE INDEX audits_owner_created ON audits(owner_id, created_at DESC);
CREATE INDEX audits_owner_expiry ON audits(owner_id, expires_at);

CREATE TABLE audit_items (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  evidence_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_items_owner_audit ON audit_items(owner_id, audit_id);

CREATE TABLE audit_measurements (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_measurements_owner_audit ON audit_measurements(owner_id, audit_id);

CREATE TABLE audit_confirmations (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  label TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  status TEXT NOT NULL,
  geometry_json TEXT,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_confirmations_owner_audit ON audit_confirmations(owner_id, audit_id);

CREATE TABLE api_rate_limits (
  owner_id TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL
);
