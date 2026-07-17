-- ============================================================
-- PLAN / ACCESS CONTROL
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
-- Usuários já existentes ganham premium automaticamente (não quebra acesso atual)
UPDATE users SET plan = 'premium' WHERE plan = 'free';

-- ============================================================
-- AI SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_subscriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,                    -- openai | anthropic | google | other
    name            TEXT NOT NULL,
    plan_name       TEXT,
    monthly_cost    NUMERIC(15,2) NOT NULL DEFAULT 0,
    billing_day     INT,
    api_key_enc     TEXT,                              -- chave de API criptografada (AES-GCM, base64)
    color           TEXT,
    logo            TEXT,
    status          TEXT NOT NULL DEFAULT 'active',     -- active | canceled
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES ai_subscriptions(id) ON DELETE CASCADE,
    period          TEXT NOT NULL,                     -- YYYY-MM
    requests_count  INT NOT NULL DEFAULT 0,
    tokens_used     BIGINT NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(15,4) NOT NULL DEFAULT 0,
    source          TEXT NOT NULL DEFAULT 'manual',     -- manual | api
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, period)
);

CREATE INDEX IF NOT EXISTS idx_ai_subscriptions_workspace ON ai_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_subscription ON ai_usage_snapshots(subscription_id);
