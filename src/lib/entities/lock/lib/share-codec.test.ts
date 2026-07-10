import { describe, it, expect } from "vitest";
import { decode, encode, type ShareableLock } from "./share-codec";
import type { CouplingMatrix } from "$lib/entities/lock/model/types";
import { PLATE_MAX, PLATE_MIN } from "$lib/shared/config";

/** Build an NxN coupling matrix from a per-cell function (diagonal handled by cell). */
function couplingMatrix(n: number, cell: (i: number, j: number) => number): CouplingMatrix {
  const rows: CouplingMatrix = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(cell(i, j));
    rows.push(row);
  }
  return rows;
}

// Deterministic PRNG — the property loops must never depend on Math.random, or a
// red run could not be reproduced from the seed alone.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomLock(rand: () => number, n: number): ShareableLock {
  const positions = Array.from({ length: n }, () => 1 + Math.floor(rand() * 7));
  const coupling = couplingMatrix(n, (i, j) => (i === j ? 0 : Math.floor(rand() * 3) - 1));
  return {
    plateCount: n,
    positions,
    coupling,
    convention: rand() < 0.5 ? "right-increases" : "right-decreases",
  };
}

// --- Independent low-level packer, mirroring the wire format, so fuzz cases can
// inject values the real encoder would never emit (raw position 7, coupling 3,
// nonzero padding, bad versions) without depending on codec internals. ---
const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bitsToBase64Url(bits: number[], padBit = 0): string {
  const padded = bits.slice();
  while (padded.length % 8 !== 0) padded.push(padBit);
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | padded[i + k]!;
    bytes.push(b);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const triple = (b0 << 16) | ((has1 ? bytes[i + 1]! : 0) << 8) | (has2 ? bytes[i + 2]! : 0);
    out += B64_ALPHABET[(triple >> 18) & 0x3f];
    out += B64_ALPHABET[(triple >> 12) & 0x3f];
    if (has1) out += B64_ALPHABET[(triple >> 6) & 0x3f];
    if (has2) out += B64_ALPHABET[triple & 0x3f];
  }
  return out;
}

interface RawLayout {
  version?: number;
  plateCount: number;
  conventionBit?: number;
  positionRaws: number[];
  couplingRaws: number[];
  padBit?: number;
}

function packRaw(layout: RawLayout): string {
  const bits: number[] = [];
  const push = (value: number, width: number): void => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(layout.version ?? 1, 4);
  push(layout.plateCount - PLATE_MIN, 2);
  push(layout.conventionBit ?? 0, 1);
  for (const p of layout.positionRaws) push(p, 3);
  for (const c of layout.couplingRaws) push(c, 2);
  return bitsToBase64Url(bits, layout.padBit ?? 0);
}

/** Canonical raws for a solvable-shaped N-plate lock (positions 4, no coupling). */
function validRaws(n: number): RawLayout {
  return {
    plateCount: n,
    positionRaws: Array(n).fill(3), // raw 3 → position 4
    couplingRaws: Array(n * (n - 1)).fill(1), // raw 1 → coupling 0
  };
}

const ALL_N = [4, 5, 6, 7];

describe("share-codec roundtrip", () => {
  it("restores every random lock across N=4..7 (50 seeded iterations each)", () => {
    for (const n of ALL_N) {
      for (let iter = 0; iter < 50; iter++) {
        const rand = mulberry32(n * 1000 + iter + 1);
        const lock = randomLock(rand, n);
        expect(decode(encode(lock))).toEqual(lock);
      }
    }
  });

  it("restores the all-minimum lock for each N (positions 1, coupling -1)", () => {
    for (const n of ALL_N) {
      const lock: ShareableLock = {
        plateCount: n,
        positions: Array(n).fill(1),
        coupling: couplingMatrix(n, (i, j) => (i === j ? 0 : -1)),
        convention: "right-increases",
      };
      expect(decode(encode(lock))).toEqual(lock);
    }
  });

  it("restores the all-maximum lock for each N (positions 7, coupling +1)", () => {
    for (const n of ALL_N) {
      const lock: ShareableLock = {
        plateCount: n,
        positions: Array(n).fill(7),
        coupling: couplingMatrix(n, (i, j) => (i === j ? 0 : 1)),
        convention: "right-decreases",
      };
      expect(decode(encode(lock))).toEqual(lock);
    }
  });

  it("restores every diagonal coupling cell to 0", () => {
    const rand = mulberry32(7);
    for (const n of ALL_N) {
      const decoded = decode(encode(randomLock(rand, n)));
      expect("error" in decoded).toBe(false);
      if ("error" in decoded) continue;
      for (let i = 0; i < n; i++) expect(decoded.coupling[i]![i]).toBe(0);
    }
  });

  it("stays within the 19-char worst case at N=7", () => {
    const rand = mulberry32(99);
    const code = encode(randomLock(rand, PLATE_MAX));
    expect(code.length).toBeLessThanOrEqual(19);
  });
});

describe("share-codec determinism", () => {
  it("encodes the same lock to the same string (frozen canonical order)", () => {
    for (const n of ALL_N) {
      const a = randomLock(mulberry32(n + 500), n);
      const b = randomLock(mulberry32(n + 500), n); // same seed → identical lock
      expect(a).toEqual(b);
      expect(encode(a)).toBe(encode(b));
      expect(encode(a)).toBe(encode(a));
    }
  });

  it("produces only base64url characters, no padding", () => {
    const rand = mulberry32(3);
    for (const n of ALL_N) {
      const code = encode(randomLock(rand, n));
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(code).not.toContain("=");
    }
  });
});

describe("share-codec rejects malformed input (never throws)", () => {
  it("rejects the empty string", () => {
    expect(decode("")).toEqual({ error: "invalid" });
  });

  it("rejects characters outside the base64url alphabet", () => {
    for (const bad of ["a/b", "a+b", "a=b", "he!lo", "with space", "café", "..", "%%%%"]) {
      expect(() => decode(bad)).not.toThrow();
      expect(decode(bad)).toEqual({ error: "invalid" });
    }
  });

  it("reports every non-1 version nibble (0 and 2..15) as a version error", () => {
    for (let version = 0; version <= 15; version++) {
      if (version === 1) continue;
      const code = packRaw({ ...validRaws(4), version });
      expect(() => decode(code)).not.toThrow();
      expect(decode(code)).toEqual({ error: "version" });
    }
  });

  it("accepts the crafted version-1 layout, proving the fuzz packer is sound", () => {
    const decoded = decode(packRaw(validRaws(5)));
    expect("error" in decoded).toBe(false);
  });

  it("rejects a raw position of 7 (3 bits can encode it; a real position cannot)", () => {
    const layout = validRaws(4);
    layout.positionRaws[0] = 7;
    const code = packRaw(layout);
    expect(() => decode(code)).not.toThrow();
    expect(decode(code)).toEqual({ error: "invalid" });
  });

  it("rejects a raw coupling of 3 (no -1/0/+1 meaning)", () => {
    const layout = validRaws(4);
    layout.couplingRaws[0] = 3;
    const code = packRaw(layout);
    expect(() => decode(code)).not.toThrow();
    expect(decode(code)).toEqual({ error: "invalid" });
  });

  it("rejects nonzero padding bits in the final byte", () => {
    // N=4 leaves 5 pad bits; flipping them to 1 must fail the padding check.
    const code = packRaw({ ...validRaws(4), padBit: 1 });
    expect(() => decode(code)).not.toThrow();
    expect(decode(code)).toEqual({ error: "invalid" });
  });

  it("rejects a truncated code (byte count no longer matches plateCount)", () => {
    for (const n of ALL_N) {
      const code = encode(randomLock(mulberry32(n), n));
      const truncated = code.slice(0, -1);
      expect(() => decode(truncated)).not.toThrow();
      expect(decode(truncated)).toEqual({ error: "invalid" });
    }
  });

  it("rejects an extended code (extra bytes past the declared length)", () => {
    for (const n of ALL_N) {
      const code = encode(randomLock(mulberry32(n + 1), n));
      const extended = code + "AAAA";
      expect(() => decode(extended)).not.toThrow();
      expect(decode(extended)).toEqual({ error: "invalid" });
    }
  });

  it("never throws on random base64url garbage of random length", () => {
    const rand = mulberry32(1234);
    for (let i = 0; i < 300; i++) {
      const len = Math.floor(rand() * 30);
      let s = "";
      for (let k = 0; k < len; k++) s += B64_ALPHABET[Math.floor(rand() * 64)];
      let result: unknown;
      expect(() => {
        result = decode(s);
      }).not.toThrow();
      // Whatever comes back is either a typed error or a well-formed lock.
      if (result && typeof result === "object" && "error" in result) {
        expect(["invalid", "version"]).toContain((result as { error: string }).error);
      } else {
        expect(result).toHaveProperty("plateCount");
      }
    }
  });

  it("never throws on random arbitrary-character noise", () => {
    const rand = mulberry32(4321);
    for (let i = 0; i < 300; i++) {
      const len = Math.floor(rand() * 24);
      let s = "";
      for (let k = 0; k < len; k++) s += String.fromCharCode(33 + Math.floor(rand() * 94));
      expect(() => decode(s)).not.toThrow();
    }
  });
});
