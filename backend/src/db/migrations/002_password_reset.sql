-- Password reset tokens (see POST /rest/user/password/request)
CREATE TABLE IF NOT EXISTS password_reset (
  id TEXT PRIMARY KEY,
  userID TEXT NOT NULL,
  key TEXT NOT NULL,
  created INTEGER,
  expires INTEGER
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset (userID);
