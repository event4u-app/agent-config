/**
 * Tests for `src/scripts/_lib/fs_atomic.ts`.
 *
 * 1:1 port of `tests/test_fs_atomic.py` (ADR-088 Phase 2 / Wave 1).
 * Covers the shared atomic-write primitive used by every v2 lockfile
 * writer:
 *
 * - str payload round-trips with default UTF-8 encoding.
 * - bytes payload round-trips verbatim, encoding ignored.
 * - Missing parent directory is created.
 * - Existing target file is overwritten cleanly (no temp leftovers).
 * - Crash mid-write (throw inside the writer) leaves the original
 *   target untouched and the `.tmp.*` sibling cleaned up.
 * - Invalid payload type throws `TypeError` before any disk write.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { write_atomic } from "../../src/scripts/_lib/fs_atomic.js";

let tmp_path: string;

beforeEach(() => {
  tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), "fs-atomic-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmp_path, { recursive: true, force: true });
});

describe("write_atomic", () => {
  it("test_write_str_round_trip", () => {
    const target = path.join(tmp_path, "out.txt");
    write_atomic(target, "hello\nworld\n");
    expect(fs.readFileSync(target, "utf-8")).toBe("hello\nworld\n");
  });

  it("test_write_bytes_round_trip", () => {
    const target = path.join(tmp_path, "out.bin");
    const payload = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    write_atomic(target, payload);
    expect(fs.readFileSync(target).equals(payload)).toBe(true);
  });

  it("test_creates_missing_parent_dirs", () => {
    const target = path.join(tmp_path, "a", "b", "c", "deep.txt");
    write_atomic(target, "deep");
    expect(fs.readFileSync(target, "utf-8")).toBe("deep");
  });

  it("test_overwrite_leaves_no_temp_siblings", () => {
    const target = path.join(tmp_path, "lock.yml");
    write_atomic(target, "v1");
    write_atomic(target, "v2");
    expect(fs.readFileSync(target, "utf-8")).toBe("v2");
    const siblings = fs.readdirSync(tmp_path);
    expect(siblings).toEqual(["lock.yml"]);
  });

  it("test_crash_midwrite_preserves_original", () => {
    // Simulate a crash between write and rename. The original target
    // must remain byte-identical and no `.tmp.*` siblings may linger.
    // We patch `fs.renameSync` to throw; the writer is expected to
    // unlink the temp file and re-throw.
    const target = path.join(tmp_path, "lock.yml");
    write_atomic(target, "original");
    const original_bytes = fs.readFileSync(target);

    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => write_atomic(target, "would-corrupt")).toThrow("boom");
    vi.restoreAllMocks();

    expect(fs.readFileSync(target).equals(original_bytes)).toBe(true);
    const siblings = fs.readdirSync(tmp_path).sort();
    expect(siblings).toEqual(["lock.yml"]);
  });

  it("test_crash_midwrite_no_target_yet", () => {
    // Crash on first write — target must not appear at all.
    const target = path.join(tmp_path, "fresh.yml");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => write_atomic(target, "anything")).toThrow("boom");
    vi.restoreAllMocks();

    expect(fs.existsSync(target)).toBe(false);
    expect(fs.readdirSync(tmp_path)).toEqual([]);
  });

  it("test_invalid_payload_type_raises", () => {
    const target = path.join(tmp_path, "out.txt");
    expect(() =>
      write_atomic(target, 42 as unknown as string),
    ).toThrowError(/str or bytes/);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("test_custom_encoding", () => {
    const target = path.join(tmp_path, "out.txt");
    write_atomic(target, "héllo", { encoding: "latin-1" });
    expect(
      fs.readFileSync(target).equals(Buffer.from("héllo", "latin1")),
    ).toBe(true);
  });

  it("test_returns_path_object", () => {
    // Python returns a Path; the TS twin returns the normalized path string.
    const target = path.join(tmp_path, "out.txt");
    const result = write_atomic(target, "x");
    expect(typeof result).toBe("string");
    expect(result).toBe(target);
  });

  it("test_parent_dir_fsync_failure_is_silent", () => {
    // Directory fsync failures must not break the write.
    const target = path.join(tmp_path, "out.txt");

    const original_fsync = fs.fsyncSync;
    let count = 0;
    vi.spyOn(fs, "fsyncSync").mockImplementation((fd: number) => {
      count += 1;
      // First call is the file fsync — let it succeed.
      // Second call is the parent dir fsync — make it throw.
      if (count >= 2) {
        throw new Error("EINVAL on dir fsync");
      }
      original_fsync(fd);
    });

    write_atomic(target, "ok");
    vi.restoreAllMocks();

    expect(fs.readFileSync(target, "utf-8")).toBe("ok");
  });
});
