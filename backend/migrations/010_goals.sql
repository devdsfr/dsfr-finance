CREATE TABLE IF NOT EXISTS goals (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL DEFAULT 'saving'
                       CHECK (type IN ('category','saving','patrimony','debt')),
    target_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    target_date   DATE,
    category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    account_id    UUID REFERENCES accounts(id)   ON DELETE SET NULL,
    chart_style   TEXT NOT NULL DEFAULT 'ring'
                       CHECK (chart_style IN ('ring','bar','thermometer','line','gauge')),
    color         TEXT NOT NULL DEFAULT '#2e7736',
    icon          TEXT NOT NULL DEFAULT '🎯',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
