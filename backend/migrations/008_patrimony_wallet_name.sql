-- Add wallet_name to patrimony_snapshots and update unique constraint
ALTER TABLE patrimony_snapshots
  ADD COLUMN IF NOT EXISTS wallet_name VARCHAR(100) NOT NULL DEFAULT 'Principal';

-- Drop old unique constraint (workspace_id, month) and replace with (workspace_id, month, wallet_name)
ALTER TABLE patrimony_snapshots
  DROP CONSTRAINT IF EXISTS patrimony_snapshots_workspace_id_month_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patrimony_snapshots_workspace_month_wallet_key'
  ) THEN
    ALTER TABLE patrimony_snapshots
      ADD CONSTRAINT patrimony_snapshots_workspace_month_wallet_key
      UNIQUE (workspace_id, month, wallet_name);
  END IF;
END $$;
