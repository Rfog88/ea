-- EA voice-bridge audit log (SQLite, local to the droplet at EA_BRIDGE_DB).
-- Not the Paperclip embedded Postgres (that is sealed). This is the bridge's own
-- per-call record so tool calls can be reviewed against the conversation later.

CREATE TABLE IF NOT EXISTS session_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  call_sid  TEXT NOT NULL,
  event     TEXT NOT NULL,          -- ws-open|stream-start|gemini-error|rejected-caller|...
  detail    TEXT,                   -- JSON blob
  ts        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_log_call ON session_log (call_sid);
CREATE INDEX IF NOT EXISTS idx_session_log_ts   ON session_log (ts);

CREATE TABLE IF NOT EXISTS tool_call (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  call_sid  TEXT NOT NULL,
  tool      TEXT NOT NULL,          -- create_reminder|send_sms|send_email|...
  input     TEXT,                   -- JSON
  result    TEXT,                   -- JSON
  ts        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_call_call ON tool_call (call_sid);
CREATE INDEX IF NOT EXISTS idx_tool_call_tool ON tool_call (tool);
