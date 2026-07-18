-- Investment Strategy: target allocation (rebalancing) + sector mapping of assets

CREATE TABLE IF NOT EXISTS investment_settings (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    monthly_contribution NUMERIC(15,2) NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_classes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    class_name    TEXT NOT NULL
                       CHECK (class_name IN ('acoes','exterior','etfs','fiis','renda_fixa','criptomoedas')),
    ideal_pct     NUMERIC(6,2) NOT NULL DEFAULT 0,
    current_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, class_name)
);

CREATE TABLE IF NOT EXISTS investment_assets (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    class_name    TEXT NOT NULL
                       CHECK (class_name IN ('acoes','exterior','etfs','fiis','renda_fixa','criptomoedas')),
    sector        TEXT NOT NULL DEFAULT 'Outros',
    ticker        TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_assets_ws ON investment_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_investment_classes_ws ON investment_classes(workspace_id);
