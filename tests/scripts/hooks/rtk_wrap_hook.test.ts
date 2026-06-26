// Tests for src/scripts/hooks/rtk_wrap_hook.ts (token-saving Phase 3).
//
// Unit tests over the exported pure logic: `classify` (eligibility +
// denylist) and `rtk_available` (the live PATH probe). The hook is warn-only
// and fail-open; the dispatcher integration (settings gate + stdin envelope)
// is covered by the manifest/lint gates.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { classify, rtk_available } from "../../../src/scripts/hooks/rtk_wrap_hook.js";

describe("rtk_wrap — classify (eligibility)", () => {
  it("flags a single verbose CLI command", () => {
    for (const cmd of ["git status", "npm run build", "cargo test", "docker compose logs", "phpunit", "pytest -q"]) {
      const r = classify(cmd);
      expect(r.eligible, cmd).toBe(true);
    }
  });

  it("strips leading env assignments to find the program", () => {
    const r = classify("FOO=1 BAR=2 npm test");
    expect(r.eligible).toBe(true);
    expect(r.program).toBe("npm");
  });

  it("denylists `git diff` (completeness-critical)", () => {
    const r = classify("git diff --stat");
    expect(r.eligible).toBe(false);
    expect(r.reason_skip).toBe("git-diff-denylisted");
  });

  it("skips an already-rtk-wrapped command", () => {
    expect(classify("rtk git log").reason_skip).toBe("already-rtk");
  });

  it("skips piped commands (already filtered / composed)", () => {
    expect(classify("git log | grep fix").reason_skip).toBe("compound-or-piped");
  });

  it("skips compound commands (&&, ;, ||)", () => {
    expect(classify("npm ci && npm test").reason_skip).toBe("compound-or-piped");
    expect(classify("git add . ; git status").reason_skip).toBe("compound-or-piped");
  });

  it("ignores non-verbose programs", () => {
    expect(classify("ls -la").reason_skip).toBe("not-verbose-cli");
    expect(classify("echo hi").reason_skip).toBe("not-verbose-cli");
  });

  it("fails open on an unparseable command (unterminated quote)", () => {
    const r = classify("git commit -m 'unterminated");
    expect(r.eligible).toBe(false);
    expect(r.reason_skip).toBe("parse-error");
  });

  it("treats empty input as ineligible", () => {
    expect(classify("   ").eligible).toBe(false);
  });
});

describe("rtk_wrap — rtk_available (live PATH probe)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rtk-probe-"));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("returns false when PATH has no rtk", () => {
    expect(rtk_available({ PATH: tmp })).toBe(false);
  });

  it("returns true when an executable rtk is on PATH (POSIX)", () => {
    if (process.platform === "win32") return; // exec-bit semantics differ
    const bin = path.join(tmp, "rtk");
    fs.writeFileSync(bin, "#!/bin/sh\n");
    fs.chmodSync(bin, 0o755);
    expect(rtk_available({ PATH: tmp })).toBe(true);
  });

  it("returns false for a non-executable rtk file (POSIX)", () => {
    if (process.platform === "win32") return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rtk-noexec-"));
    fs.writeFileSync(path.join(dir, "rtk"), "x");
    fs.chmodSync(path.join(dir, "rtk"), 0o644);
    expect(rtk_available({ PATH: dir })).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns false on an empty PATH", () => {
    expect(rtk_available({ PATH: "" })).toBe(false);
  });
});
