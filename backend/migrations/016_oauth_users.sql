-- Social login (Google/Facebook): link an external identity to a user account.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider TEXT,
  ADD COLUMN IF NOT EXISTS oauth_id       TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT;

-- Accounts created via OAuth have no local password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- One external identity maps to at most one account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;
