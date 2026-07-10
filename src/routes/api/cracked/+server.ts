import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// The root layout sets prerender=true; this endpoint must opt out — a POST
// cannot be prerendered, and the GET total must be read live at request time.
export const prerender = false;

const CACHE_HEADER = "public, s-maxage=30";

/** The single seeded counter row. */
const SELECT_TOTAL = "SELECT n FROM counter WHERE id = 1";
const INCREMENT = "UPDATE counter SET n = n + 1 WHERE id = 1 RETURNING n";
// Mirror of migrations/0001_init_counter.sql: an unseeded database (fresh
// local dev proxy, recreated D1) must heal itself on the first crack rather
// than silently never counting.
const BOOTSTRAP_TABLE =
  "CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, n INTEGER NOT NULL)";
const BOOTSTRAP_ROW = "INSERT OR IGNORE INTO counter (id, n) VALUES (1, 0)";

/**
 * Read the running total. A slightly stale vanity number is fine, so the edge
 * is told to collapse concurrent reads for a short window. Any absence of the
 * platform binding (vite dev without the proxy, or the prerender pass) or a D1
 * hiccup degrades to `{ n: null }` — the client renders nothing for null, so a
 * missing total never breaks the page.
 */
export const GET: RequestHandler = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return json({ n: null });
  try {
    const row = await db.prepare(SELECT_TOTAL).first<{ n: number }>();
    return json({ n: row?.n ?? null }, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch {
    // Never leak D1 error detail; a failed vanity read is not worth surfacing.
    return json({ n: null });
  }
};

/**
 * Increment the total by one and return the new value.
 *
 * Same-origin gate: browsers always attach `Origin` to a cross-origin POST and
 * set `Sec-Fetch-Site`, and a page cannot forge either header — so a foreign
 * `Origin` or a non-same-origin `Sec-Fetch-Site` is rejected. A bare `curl`
 * that sends neither header still gets through; that is accepted for a vanity
 * counter. (A rate-limit binding was researched to blunt scripted inflation but
 * its free-plan availability is unconfirmed, so it is deliberately not used.)
 *
 * The handler is total: no throw escapes. A D1 failure degrades to a 503 with
 * `{ n: null }` and no error detail.
 */
export const POST: RequestHandler = async ({ platform, request, url }) => {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== url.origin) {
    return json({ n: null }, { status: 403 });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return json({ n: null }, { status: 403 });
  }

  const db = platform?.env.DB;
  if (!db) return json({ n: null }, { status: 503 });
  try {
    let row = await db.prepare(INCREMENT).first<{ n: number }>();
    if (!row) {
      // No row to update: the database exists but was never seeded. Bootstrap
      // idempotently and retry once — a vanity counter that silently never
      // counts is worse than one extra round trip on the very first crack.
      await db.prepare(BOOTSTRAP_TABLE).run();
      await db.prepare(BOOTSTRAP_ROW).run();
      row = await db.prepare(INCREMENT).first<{ n: number }>();
    }
    return json({ n: row?.n ?? null });
  } catch {
    try {
      // "no such table" also lands here on some paths; heal and retry once.
      await db.prepare(BOOTSTRAP_TABLE).run();
      await db.prepare(BOOTSTRAP_ROW).run();
      const row = await db.prepare(INCREMENT).first<{ n: number }>();
      return json({ n: row?.n ?? null });
    } catch {
      return json({ n: null }, { status: 503 });
    }
  }
};
