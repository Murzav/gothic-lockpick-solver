-- Global "locks cracked" counter: a single seeded row that POST /api/cracked
-- increments atomically. Idempotent on purpose — safe to re-apply, and the
-- endpoint runs the same statements as a self-healing fallback when the row
-- is missing (fresh local dev proxy, recreated database).
-- Apply: bunx wrangler d1 migrations apply gls-counter [--local | --remote]
CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, n INTEGER NOT NULL);
INSERT OR IGNORE INTO counter (id, n) VALUES (1, 0);
