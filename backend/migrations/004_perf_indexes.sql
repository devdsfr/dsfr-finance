-- Speeds up the most common transaction query pattern:
-- WHERE workspace_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date DESC
-- Previously only single-column indexes existed on workspace_id and date
-- separately, forcing Postgres to bitmap-AND two indexes instead of doing a
-- single composite index scan that also satisfies the ORDER BY for free.
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON transactions(workspace_id, date DESC);
