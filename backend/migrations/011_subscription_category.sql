-- Add category and billing_cycle to ai_subscriptions
ALTER TABLE ai_subscriptions
    ADD COLUMN IF NOT EXISTS category     TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly';
