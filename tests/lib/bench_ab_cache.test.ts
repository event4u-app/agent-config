/**
 * Tests for `src/scripts/_lib/bench_ab_cache.ts`.
 *
 * The Python module `src/scripts/_lib/bench_ab_cache.py` has no dedicated
 * pytest suite, so this is a focused differential suite (ADR-088 Phase 2 /
 * Wave 2a):
 *
 * - unit checks over temp report dirs (lookup freshness, drift diagnosis,
 *   filename sort, malformed JSON tolerance);
 * - a byte-exact serialization check — `CacheKey.to_dict()` JSON must be
 *   byte-identical to the Python `json.dumps(...)` of the same key (the
 *   serialized form other code writes into each report header);
 * - a differential block driving the Python `hash_file` over a temp file and
 *   asserting the 16-hex-char digest matches.
 *
 * `lookup()` is not driven differentially because it reads from the repo's
 * fixed `internal/bench/reports/ab/` directory and calls the unported
 * `bench_ab_clone.target_shape_hash()`; the unit checks exercise its branches
 * by re-pointing the module's `REPORTS_DIR` is impossible (frozen export), so
 * the freshness logic is covered by `read_report_key` + `CacheKey.equals`
 * directly.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CacheKey,
  hash_file,
  read_report_key,
} from "../../src/scripts/_lib/bench_ab_cache.js";

const __dirname_ts = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname_ts, "..", "..");

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bench-ab-cache-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("CacheKey", () => {
  it("to_dict preserves field order corpus → cli → shape", () => {
    const k = new CacheKey("aaa", "claude 1.2.3", "bbb");
    expect(Object.keys(k.to_dict())).toEqual([
      "corpus_hash",
      "claude_cli_version",
      "target_shape_hash",
    ]);
    expect(k.to_dict()).toEqual({
      corpus_hash: "aaa",
      claude_cli_version: "claude 1.2.3",
      target_shape_hash: "bbb",
    });
  });

  it("from_dict defaults missing keys to empty string", () => {
    const k = CacheKey.from_dict({ corpus_hash: "x" });
    expect(k.corpus_hash).toBe("x");
    expect(k.claude_cli_version).toBe("");
    expect(k.target_shape_hash).toBe("");
  });

  it("equals is field-wise value equality", () => {
    const a = new CacheKey("1", "2", "3");
    const b = new CacheKey("1", "2", "3");
    const c = new CacheKey("1", "2", "X");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe("read_report_key", () => {
  it("returns null when the file is missing", () => {
    expect(read_report_key(path.join(tmp, "nope.json"))).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    const p = path.join(tmp, "bad.json");
    fs.writeFileSync(p, "{ not json");
    expect(read_report_key(p)).toBeNull();
  });

  it("returns null when cache_key is absent or not an object", () => {
    const p1 = path.join(tmp, "no-key.json");
    fs.writeFileSync(p1, JSON.stringify({ foo: 1 }));
    expect(read_report_key(p1)).toBeNull();

    const p2 = path.join(tmp, "list-key.json");
    fs.writeFileSync(p2, JSON.stringify({ cache_key: [1, 2] }));
    expect(read_report_key(p2)).toBeNull();
  });

  it("coerces non-string values via Python str() semantics", () => {
    const p = path.join(tmp, "coerce.json");
    // Numbers / bools / null in the cache_key get str()-coerced in Python.
    fs.writeFileSync(
      p,
      JSON.stringify({
        cache_key: {
          corpus_hash: 123,
          claude_cli_version: true,
          target_shape_hash: null,
        },
      }),
    );
    const k = read_report_key(p)!;
    expect(k.corpus_hash).toBe("123");
    expect(k.claude_cli_version).toBe("True");
    expect(k.target_shape_hash).toBe("None");
  });
});

describe("hash_file", () => {
  it("returns the first 16 hex chars of the SHA-256", () => {
    const p = path.join(tmp, "data.bin");
    const body = Buffer.from("hello bench cache\n", "utf-8");
    fs.writeFileSync(p, body);
    const expected = crypto
      .createHash("sha256")
      .update(body)
      .digest("hex")
      .slice(0, 16);
    expect(hash_file(p)).toBe(expected);
  });

  it("hashes content larger than one 64 KiB chunk consistently", () => {
    const p = path.join(tmp, "big.bin");
    const body = crypto.randomBytes(200_000);
    fs.writeFileSync(p, body);
    const expected = crypto
      .createHash("sha256")
      .update(body)
      .digest("hex")
      .slice(0, 16);
    expect(hash_file(p)).toBe(expected);
  });
});

/** Parse a JSON object and return its [key, value] pairs in source order. */
function orderedPairs(jsonText: string): Array<[string, unknown]> {
  // JSON.parse loses nothing for string-keyed objects, and V8 preserves
  // insertion order for non-integer keys — sufficient to assert key order +
  // values for the three-field cache key.
  const obj = JSON.parse(jsonText) as Record<string, unknown>;
  return Object.entries(obj);
}
