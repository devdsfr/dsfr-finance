
CREATE TABLE IF NOT EXISTS debts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50)  NOT NULL DEFAULT 'personal_loan',
    system          VARCHAR(10)  NOT NULL DEFAULT 'price',
    original_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    remaining_balance DECIMAL(15,2) NOT NULL,
    monthly_rate    DECIMAL(10,6) NOT NULL,
    monthly_payment DECIMAL(15,2) NOT NULL,
    remaining_months INT NOT NULL DEFAULT 0,
    notes           TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
