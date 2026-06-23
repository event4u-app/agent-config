
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as installed_lock from "../../src/scripts/_lib/installed_lock.js";

let tmp_path: string;
const saved_env: Array<[string, string | undefined]> = [];

beforeEach(() => {
  tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), "installed-lock-"));
});

afterEach(() => {
  while (saved_env.length > 0) {
    const [key, value] = saved_env.pop() as [string, string | undefined];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  fs.rmSync(tmp_path, { recursive: true, force: true });
});

function patch_env(key: string, value: string | undefined): void {
  saved_env.push([key, process.env[key]]);
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("installed_lock module", () => {
  it("test_read_lockfile_missing_returns_none", () => {
    expect(installed_lock.read_lockfile(path.join(tmp_path, "absent.lock"))).toBeNull();
  });

  it("test_write_lockfile_renders_expected_schema", () => {
    const target = path.join(tmp_path, "installed.lock");
    const written = installed_lock.write_lockfile("2.1.0", ["cursor", "claude-code", "cursor"], {
      path: target,
    });
    expect(written).toBe(target);
    const text = fs.readFileSync(target, "utf-8");
    expect(text.startsWith("schema_version: 1\n")).toBe(true);
    expect(text).toContain('agent_config_version: "2.1.0"\n');
    expect(text).toContain("installed_at:");
    // tools de-duplicated and sorted
    expect(text).toContain("  - claude-code\n");
    expect(text).toContain("  - cursor\n");
    expect(text.split("- cursor").length - 1).toBe(1);
  });

  it("test_read_lockfile_round_trip", () => {
    const target = path.join(tmp_path, "installed.lock");
    installed_lock.write_lockfile("2.0.5", ["aider", "codex"], { path: target });
    const data = installed_lock.read_lockfile(target)!;
    expect(data.schema_version).toBe(1);
    expect(data.agent_config_version).toBe("2.0.5");
    expect(data.tools).toEqual(["aider", "codex"]);
  });

  it("test_read_lockfile_tolerates_garbage", () => {
    const target = path.join(tmp_path, "installed.lock");
    fs.writeFileSync(target, "this is not yaml\nrandom junk\n", "utf-8");
    const data = installed_lock.read_lockfile(target)!;
    expect(data).toEqual({ tools: [] });
  });

  it("test_check_version_no_lockfile", () => {
    const [ok, recorded] = installed_lock.check_version("2.1.0", {
      path: path.join(tmp_path, "absent.lock"),
    });
    expect(ok).toBe(true);
    expect(recorded).toBeNull();
  });

  it("test_check_version_match", () => {
    const target = path.join(tmp_path, "installed.lock");
    installed_lock.write_lockfile("2.1.0", ["cursor"], { path: target });
    const [ok, recorded] = installed_lock.check_version("2.1.0", { path: target });
    expect(ok).toBe(true);
    expect(recorded).toBe("2.1.0");
  });

  it("test_check_version_mismatch", () => {
    const target = path.join(tmp_path, "installed.lock");
    installed_lock.write_lockfile("2.0.5", ["cursor"], { path: target });
    const [ok, recorded] = installed_lock.check_version("2.1.0", { path: target });
    expect(ok).toBe(false);
    expect(recorded).toBe("2.0.5");
  });

  // --- classify_mismatch ---

  it("test_classify_mismatch_none_when_recorded_missing", () => {
    expect(installed_lock.classify_mismatch("2.1.0", null)).toBe("none");
  });

  it("test_classify_mismatch_match_when_equal", () => {
    expect(installed_lock.classify_mismatch("2.1.0", "2.1.0")).toBe("match");
  });

  it("test_classify_mismatch_upgrade_when_recorded_lower", () => {
    expect(installed_lock.classify_mismatch("4.7.2", "1.42.0")).toBe("upgrade");
    expect(installed_lock.classify_mismatch("2.1.0", "2.0.5")).toBe("upgrade");
    expect(installed_lock.classify_mismatch("2.0.0", "1.99.99")).toBe("upgrade");
  });

  it("test_classify_mismatch_downgrade_when_recorded_higher", () => {
    expect(installed_lock.classify_mismatch("4.7.2", "99.0.0")).toBe("downgrade");
    expect(installed_lock.classify_mismatch("2.0.5", "2.1.0")).toBe("downgrade");
  });

  it("test_classify_mismatch_unparseable_legacy_shapes", () => {
    expect(installed_lock.classify_mismatch("4.7.2", "legacy")).toBe("unparseable");
    expect(installed_lock.classify_mismatch("4.7.2", "0.9-rc")).toBe("unparseable");
  });

  it("test_classify_mismatch_tolerates_semver_suffixes", () => {
    expect(installed_lock.classify_mismatch("4.7.2", "v3.0.0")).toBe("upgrade");
    expect(installed_lock.classify_mismatch("4.7.2", "5.0.0-rc1")).toBe("downgrade");
  });

  it("test_current_package_version_reads_package_json", () => {
    const version = installed_lock.current_package_version();
    expect(version).not.toBe("0.0.0");
    expect(version.split(".").length - 1).toBeGreaterThanOrEqual(1);
  });

  // Regression: `agent-config global` refused with "Current package: 0.0.0"
  // because the version resolver used a fixed 3-hop (`src/scripts/_lib/`) that
  // overshot the package root in the shipped esbuild bundle (module runs from
  // `dist/cli/`). The upward walk must reach the package's package.json from
  // ANY runtime depth — source layout or bundled.
  it("upward_walk_finds_package_json_from_bundled_layout", () => {
    const pkg_root = fs.mkdtempSync(path.join(os.tmpdir(), "pkgroot-"));
    fs.writeFileSync(path.join(pkg_root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    // Simulate the esbuild bundle location: <pkg_root>/dist/cli/agent-config.js
    const bundle_dir = path.join(pkg_root, "dist", "cli");
    fs.mkdirSync(bundle_dir, { recursive: true });
    expect(installed_lock._find_package_version_upward(bundle_dir)).toBe("9.9.9");
    // Source layout (deeper) resolves to the same root.
    const src_dir = path.join(pkg_root, "src", "scripts", "_lib");
    fs.mkdirSync(src_dir, { recursive: true });
    expect(installed_lock._find_package_version_upward(src_dir)).toBe("9.9.9");
    fs.rmSync(pkg_root, { recursive: true, force: true });
  });

  it("upward_walk_returns_null_with_no_package_json_to_root", () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "bare-"));
    // No package.json anywhere up the chain inside the tmp dir; the walk must
    // terminate at the filesystem root without looping. (A package.json may
    // exist at an ancestor of os.tmpdir on some systems; assert it does not
    // hang and yields a string-or-null, never throws.)
    const result = installed_lock._find_package_version_upward(bare);
    expect(result === null || typeof result === "string").toBe(true);
    fs.rmSync(bare, { recursive: true, force: true });
  });

  it("test_lockfile_env_override", () => {
    const custom = path.join(tmp_path, "custom.lock");
    patch_env("AGENT_CONFIG_INSTALLED_LOCK", custom);
    expect(installed_lock.lockfile_path()).toBe(custom);
  });

  // --- additional unit coverage for the write/read round trip shape ---

  it("dedup_and_sort_tools_in_wire_format", () => {
    const target = path.join(tmp_path, "installed.lock");
    installed_lock.write_lockfile("2.0.0", ["zed", "aider", "zed", "aider", "cursor"], {
      path: target,
    });
    const data = installed_lock.read_lockfile(target)!;
    expect(data.tools).toEqual(["aider", "cursor", "zed"]);
  });

  it("installed_at_uses_provided_now", () => {
    const target = path.join(tmp_path, "installed.lock");
    const fixed = new Date(Date.UTC(2024, 0, 2, 3, 4, 5));
    installed_lock.write_lockfile("2.0.0", ["cursor"], { path: target, now: fixed });
    const text = fs.readFileSync(target, "utf-8");
    expect(text).toContain('installed_at: "2024-01-02T03:04:05Z"');
  });
});

interface RenderCase {
  version: string;
  tools: string[];
  installed_at: string;
}
