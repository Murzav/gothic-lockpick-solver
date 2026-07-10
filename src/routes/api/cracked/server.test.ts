import { describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { GET, POST } from "./+server";

// Minimal D1 double: the endpoint calls `prepare(sql).first()` for reads and
// increments, and `prepare(sql).run()` for the self-healing bootstrap — mock
// exactly that shape (typed against the real binding via a single cast).
function mockDb(
  first: () => Promise<{ n: number } | null>,
  run: () => Promise<unknown> = () => Promise.resolve({}),
): {
  db: D1Database;
  prepare: ReturnType<typeof vi.fn>;
} {
  const prepare = vi.fn(() => ({ first, run }));
  return { db: { prepare } as unknown as D1Database, prepare };
}

type GetEvent = Parameters<typeof GET>[0];
type PostEvent = Parameters<typeof POST>[0];

function getEvent(db?: D1Database): GetEvent {
  return { platform: db ? { env: { DB: db } } : undefined } as unknown as GetEvent;
}

function postEvent(opts: {
  db?: D1Database;
  origin?: string;
  secFetchSite?: string;
  requestOrigin?: string;
}): PostEvent {
  const requestOrigin = opts.requestOrigin ?? "https://example.com";
  const headers = new Headers();
  if (opts.origin !== undefined) headers.set("origin", opts.origin);
  if (opts.secFetchSite !== undefined) headers.set("sec-fetch-site", opts.secFetchSite);
  return {
    platform: opts.db ? { env: { DB: opts.db } } : undefined,
    request: new Request(requestOrigin + "/api/cracked", { method: "POST", headers }),
    url: new URL(requestOrigin + "/api/cracked"),
  } as unknown as PostEvent;
}

describe("GET /api/cracked", () => {
  it("returns the current total with the edge-cache header", async () => {
    const { db } = mockDb(() => Promise.resolve({ n: 128 }));
    const res = await GET(getEvent(db));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=30");
    expect(await res.json()).toEqual({ n: 128 });
  });

  it("degrades to { n: null } when the platform binding is missing", async () => {
    const res = await GET(getEvent());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ n: null });
  });

  it("degrades to { n: null } without a cache header when D1 throws", async () => {
    const { db } = mockDb(() => Promise.reject(new Error("d1 down")));
    const res = await GET(getEvent(db));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBeNull();
    expect(await res.json()).toEqual({ n: null });
  });
});

describe("POST /api/cracked", () => {
  it("increments and returns the new total", async () => {
    const { db } = mockDb(() => Promise.resolve({ n: 42 }));
    const res = await POST(postEvent({ db, secFetchSite: "same-origin" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ n: 42 });
  });

  it("rejects a foreign Origin with 403 and never touches D1", async () => {
    const { db, prepare } = mockDb(() => Promise.resolve({ n: 1 }));
    const res = await POST(
      postEvent({ db, requestOrigin: "https://example.com", origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ n: null });
  });

  it("rejects a cross-site Sec-Fetch-Site with 403 and never touches D1", async () => {
    const { db, prepare } = mockDb(() => Promise.resolve({ n: 1 }));
    const res = await POST(postEvent({ db, secFetchSite: "cross-site" }));
    expect(res.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ n: null });
  });

  it("returns 503 { n: null } when D1 keeps failing even after the heal attempt", async () => {
    const { db } = mockDb(() => Promise.reject(new Error("d1 down")));
    const res = await POST(postEvent({ db, secFetchSite: "same-origin" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ n: null });
  });

  it("bootstraps an unseeded database (row missing) and counts the first crack", async () => {
    let updates = 0;
    const { db, prepare } = mockDb(() => {
      updates++;
      return Promise.resolve(updates === 1 ? null : { n: 1 });
    });
    const res = await POST(postEvent({ db, secFetchSite: "same-origin" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ n: 1 });
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS"));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE"));
  });

  it("heals a missing table (first statement throws) and still counts", async () => {
    let calls = 0;
    const { db } = mockDb(() => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error("no such table: counter"))
        : Promise.resolve({ n: 1 });
    });
    const res = await POST(postEvent({ db, secFetchSite: "same-origin" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ n: 1 });
  });
});
