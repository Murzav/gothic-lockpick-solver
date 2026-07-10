import { PLATE_MAX, PLATE_MIN } from "$lib/shared/config";
import type { CouplingMatrix, DirectionConvention, LockState } from "../model/types";

/**
 * Codec for the compact "share this lock" code carried in the URL fragment.
 *
 * Fixed-width bit packing was chosen deliberately over mixed-radix: it needs no
 * BigInt, the worst case (N=7) is just 14 bytes / 19 base64url chars, and every
 * field lands on a predictable bit offset, which makes the strict reject checks
 * in `decode` easy to reason about.
 *
 * Bit layout, MSB-first into a byte array:
 *   version     4 bits  (currently 1)
 *   plateCount  2 bits  (stored as plateCount - 4, so 0..3 → 4..7)
 *   convention  1 bit   (0 = right-increases, 1 = right-decreases)
 *   positions   3 bits × N     (stored as value - 1, so 0..6)
 *   coupling    2 bits × N(N-1) (stored as value + 1, so 0..2; 3 is invalid)
 *               row-major, skipping the diagonal
 * The final byte is padded with zero bits.
 *
 * CANONICAL ORDER IS FROZEN. Positions run plate 0..N-1; coupling runs row i,
 * column j in ascending order skipping i === j. Both roundtrip correctness and
 * history dedupe (same lock → same string) depend on this order never changing.
 * A new layout means a new `version` nibble, never a reshuffle of this one.
 */

const VERSION = 1;

/** Lock fields that fit into a share code — everything but transient UI state. */
export interface ShareableLock {
  plateCount: number;
  positions: LockState;
  coupling: CouplingMatrix;
  convention: DirectionConvention;
}

/**
 * `decode` never throws: a damaged or newer code returns a typed error instead.
 * "version" means the code is well-formed but from an unknown tool version;
 * "invalid" means it is mangled (bad alphabet, wrong length, out-of-range value,
 * or nonzero padding).
 */
export type DecodeResult = ShareableLock | { error: "invalid" | "version" };

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Reverse map for the base64url alphabet; -1 marks a character outside it. */
const B64_LOOKUP: number[] = (() => {
  const table = Array.from({ length: 128 }, () => -1);
  for (let i = 0; i < B64_ALPHABET.length; i++) {
    table[B64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/** Number of whole bytes a fully-populated code for `plateCount` plates occupies. */
function byteLength(plateCount: number): number {
  const dataBits = 4 + 2 + 1 + 3 * plateCount + 2 * plateCount * (plateCount - 1);
  return Math.ceil(dataBits / 8);
}

/** Appends fixed-width values MSB-first, padding the final byte with zeros. */
class BitWriter {
  private bytes: number[] = [];
  private acc = 0;
  private filled = 0;

  write(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | ((value >>> i) & 1);
      this.filled++;
      if (this.filled === 8) {
        this.bytes.push(this.acc);
        this.acc = 0;
        this.filled = 0;
      }
    }
  }

  finish(): Uint8Array {
    if (this.filled > 0) {
      this.bytes.push(this.acc << (8 - this.filled));
      this.acc = 0;
      this.filled = 0;
    }
    return Uint8Array.from(this.bytes);
  }
}

/** Reads fixed-width values MSB-first from a fixed byte array. */
class BitReader {
  private pos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  read(width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) {
      const byte = this.bytes[this.pos >> 3] ?? 0;
      const bit = (byte >> (7 - (this.pos & 7))) & 1;
      value = (value << 1) | bit;
      this.pos++;
    }
    return value;
  }

  get bitPos(): number {
    return this.pos;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1]! : 0;
    const b2 = has2 ? bytes[i + 2]! : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64_ALPHABET[(triple >> 18) & 0x3f];
    out += B64_ALPHABET[(triple >> 12) & 0x3f];
    if (has1) out += B64_ALPHABET[(triple >> 6) & 0x3f];
    if (has2) out += B64_ALPHABET[triple & 0x3f];
  }
  return out;
}

/**
 * Strict base64url → bytes. Rejects any character outside the alphabet, an
 * impossible length (mod 4 === 1), and non-canonical trailing bits — so the
 * only strings that decode are ones our own encoder could have produced.
 */
function base64UrlToBytes(code: string): Uint8Array | null {
  const len = code.length;
  if (len % 4 === 1) return null;
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const charCode = code.charCodeAt(i);
    const value = charCode < 128 ? B64_LOOKUP[charCode]! : -1;
    if (value < 0) return null;
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  // Canonical encodings leave only zero bits over; anything else is tampering.
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) return null;
  return Uint8Array.from(bytes);
}

/** Serialise a lock into a padding-free base64url share code. */
export function encode(lock: ShareableLock): string {
  const { plateCount, positions, coupling, convention } = lock;
  const writer = new BitWriter();
  writer.write(VERSION, 4);
  writer.write(plateCount - PLATE_MIN, 2);
  writer.write(convention === "right-decreases" ? 1 : 0, 1);
  for (let i = 0; i < plateCount; i++) {
    writer.write(positions[i]! - 1, 3);
  }
  for (let i = 0; i < plateCount; i++) {
    for (let j = 0; j < plateCount; j++) {
      if (i === j) continue;
      writer.write(coupling[i]![j]! + 1, 2);
    }
  }
  return bytesToBase64Url(writer.finish());
}

/**
 * Parse a share code back into a lock, or a typed error. Reject-not-clamp: any
 * out-of-range field or leftover nonzero bit fails the whole decode, so a
 * mangled link can never masquerade as a different-but-valid lock.
 */
export function decode(code: string): DecodeResult {
  const bytes = base64UrlToBytes(code);
  if (bytes === null || bytes.length < 1) return { error: "invalid" };

  const reader = new BitReader(bytes);
  const version = reader.read(4);
  if (version !== VERSION) return { error: "version" };

  const plateCount = reader.read(2) + PLATE_MIN;
  // plateCount is intrinsically 4..7 (2 bits + PLATE_MIN); this only guards the
  // config invariant, not the wire value.
  if (plateCount < PLATE_MIN || plateCount > PLATE_MAX) return { error: "invalid" };
  // Exact length is the mangle detector: a truncated or padded code changes the
  // byte count and is rejected before any value is trusted.
  if (bytes.length !== byteLength(plateCount)) return { error: "invalid" };

  const convention: DirectionConvention =
    reader.read(1) === 1 ? "right-decreases" : "right-increases";

  const positions: LockState = [];
  for (let i = 0; i < plateCount; i++) {
    const raw = reader.read(3);
    // 3 bits can encode 7, but a position tops out at value 7 (raw 6); raw 7 is
    // impossible from a genuine encode.
    if (raw > 6) return { error: "invalid" };
    positions.push(raw + 1);
  }

  const coupling: CouplingMatrix = Array.from({ length: plateCount }, () =>
    Array.from({ length: plateCount }, () => 0),
  );
  for (let i = 0; i < plateCount; i++) {
    for (let j = 0; j < plateCount; j++) {
      if (i === j) continue; // diagonal is always 0, never on the wire
      const raw = reader.read(2);
      if (raw > 2) return { error: "invalid" }; // raw 3 has no -1/0/+1 meaning
      coupling[i]![j] = raw - 1;
    }
  }

  // Every remaining bit is padding and must be zero, or the code is not one we
  // could have produced.
  const totalBits = bytes.length * 8;
  while (reader.bitPos < totalBits) {
    if (reader.read(1) !== 0) return { error: "invalid" };
  }

  return { plateCount, positions, coupling, convention };
}
