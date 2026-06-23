-- Per-user display currency (RON/EUR/USD/BRL...) — AC for international rollout.
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';
