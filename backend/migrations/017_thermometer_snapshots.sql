-- Monthly snapshot of the financial thermometer, so the user can browse past
-- months. The score/label/color are stored flat for quick listing and the full
-- pillars + tips are kept as JSON for faithful rendering of a past month.
CREATE TABLE IF NOT EXISTS thermometer_snapshots (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    month        VARCHAR(7) NOT NULL,           -- YYYY-MM
    score        INT NOT NULL DEFAULT 0,
    label        TEXT NOT NULL DEFAULT '',
    color        TEXT NOT NULL DEFAULT '',
    payload      JSONB NOT NULL DEFAULT '{}',   -- { pillars: [...], tips: [...] }
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, month)
);

CREATE INDEX IF NOT EXISTS idx_thermometer_ws_month ON thermometer_snapshots(workspace_id, month);
