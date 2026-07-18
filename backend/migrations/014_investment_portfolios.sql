-- Investment portfolios: multiple wallets (self, children, etc.) with monthly history

CREATE TABLE IF NOT EXISTS investment_portfolios (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    icon          TEXT NOT NULL DEFAULT '👤',
    color         TEXT NOT NULL DEFAULT '#2e7736',
    display_order INT  NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Target allocation per portfolio
CREATE TABLE IF NOT EXISTS investment_portfolio_classes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES investment_portfolios(id) ON DELETE CASCADE,
    class_name   TEXT NOT NULL
                      CHECK (class_name IN ('acoes','exterior','etfs','fiis','renda_fixa','criptomoedas')),
    ideal_pct    NUMERIC(6,2) NOT NULL DEFAULT 0,
    UNIQUE (portfolio_id, class_name)
);

-- One entry per portfolio per month
CREATE TABLE IF NOT EXISTS investment_month_entries (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    portfolio_id UUID NOT NULL REFERENCES investment_portfolios(id) ON DELETE CASCADE,
    month        TEXT NOT NULL, -- YYYY-MM
    contribution NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (portfolio_id, month)
);

-- Per-class detail of a monthly entry
CREATE TABLE IF NOT EXISTS investment_month_classes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id      UUID NOT NULL REFERENCES investment_month_entries(id) ON DELETE CASCADE,
    class_name    TEXT NOT NULL
                       CHECK (class_name IN ('acoes','exterior','etfs','fiis','renda_fixa','criptomoedas')),
    current_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    allocation    NUMERIC(15,2) NOT NULL DEFAULT 0,
    UNIQUE (entry_id, class_name)
);

CREATE INDEX IF NOT EXISTS idx_inv_portfolios_ws   ON investment_portfolios(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inv_month_entries_ws ON investment_month_entries(workspace_id, month);
CREATE INDEX IF NOT EXISTS idx_inv_month_entries_pf ON investment_month_entries(portfolio_id, month);

-- ── Migrate existing single-allocation data into a default portfolio ──────────
DO $$
DECLARE
    ws RECORD;
    new_pf_id UUID;
BEGIN
    FOR ws IN SELECT DISTINCT workspace_id FROM investment_classes LOOP
        -- Skip workspaces that already have portfolios
        IF EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.workspace_id = ws.workspace_id) THEN
            CONTINUE;
        END IF;

        INSERT INTO investment_portfolios (workspace_id, name, icon, display_order)
        VALUES (ws.workspace_id, 'Principal', '👤', 0)
        RETURNING id INTO new_pf_id;

        INSERT INTO investment_portfolio_classes (portfolio_id, class_name, ideal_pct)
        SELECT new_pf_id, c.class_name, c.ideal_pct
        FROM investment_classes c
        WHERE c.workspace_id = ws.workspace_id
        ON CONFLICT (portfolio_id, class_name) DO NOTHING;
    END LOOP;
END $$;
