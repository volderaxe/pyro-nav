CREATE TABLE owner_auth_states (
  state_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE INDEX owner_auth_states_expires_at ON owner_auth_states (expires_at);

CREATE TABLE owner_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX owner_sessions_expires_at ON owner_sessions (expires_at);
