CREATE TABLE requests (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  details TEXT NOT NULL CHECK (length(details) BETWEEN 1 AND 3000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX requests_created_at_idx ON requests (created_at DESC);
