/**
 * Tests for `src/scripts/_lib/cli_wrapper.ts` — project wrapper re-stamping.
 *
 * 1:1 port of `tests/test_cli_wrapper.py` (ADR-088 Phase 2 / Wave 1).
 * The helper copies the canonical `src/templates/agent-config-wrapper.sh`
 * to a project root so the update commands can refresh an older,
 * fallback-less `./agent-config` wrapper.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  install_cli_wrapper,
  needs_refresh,
  template_path,
} from "../../src/scripts/_lib/cli_wrapper.js";

let tmp_path: string;

beforeEach(() => {
  tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), "cli-wrapper-"));
});

afterEach(() => {
  fs.rmSync(tmp_path, { recursive: true, force: true });
});

describe("cli_wrapper", () => {
  it("test_template_path_points_at_canonical_template", () => {
    const tpl = template_path();
    expect(path.basename(tpl)).toBe("agent-config-wrapper.sh");
    expect(fs.statSync(tpl).isFile()).toBe(true);
    expect(fs.readFileSync(tpl, "utf-8")).toContain("globally-installed");
  });

  it("test_needs_refresh_true_when_missing", () => {
    expect(needs_refresh(tmp_path)).toBe(true);
  });

  it("test_needs_refresh_true_when_differs", () => {
    fs.writeFileSync(
      path.join(tmp_path, "agent-config"),
      "#!/usr/bin/env bash\nexit 127\n",
    );
    expect(needs_refresh(tmp_path)).toBe(true);
  });

  it("test_needs_refresh_false_when_identical", () => {
    install_cli_wrapper(tmp_path);
    expect(needs_refresh(tmp_path)).toBe(false);
  });

  it("test_install_cli_wrapper_writes_executable_template", () => {
    const target = install_cli_wrapper(tmp_path);
    expect(target).toBe(path.join(tmp_path, "agent-config"));
    expect(fs.statSync(target as string).isFile()).toBe(true);
    const body = fs.readFileSync(target as string, "utf-8");
    expect(body).toBe(fs.readFileSync(template_path(), "utf-8"));
    // Executable bit set.
    expect(fs.statSync(target as string).mode & 0o111).not.toBe(0);
  });
});
