CREATE TABLE IF NOT EXISTS patrimony_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  month         VARCHAR(7) NOT NULL,  -- YYYY-MM
  total         DECIMAL(15,2) NOT NULL DEFAULT 0,
  invested      DECIMAL(15,2) NOT NULL DEFAULT 0,
  profit        DECIMAL(15,2) NOT NULL DEFAULT 0,
  capital_gains DECIMAL(15,2) NOT NULL DEFAULT 0,
  dividends     DECIMAL(15,2) NOT NULL DEFAULT 0,
  income_12m    DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, month)
);
CREATE INDEX IF NOT EXISTS idx_patrimony_snapshots_workspace ON patrimony_snapshots(workspace_id, month);
