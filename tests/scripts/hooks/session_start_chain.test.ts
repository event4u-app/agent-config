// Composed session_start chain test (road-to-tested-routing Phase 1).
//
// Runs the REAL dispatcher (dispatch_entry via tsx, child process — the
// production no-bundle path) against fixture workspaces and an isolated
// EVENT4U_CONFIG_HOME, per hook-capable platform. Pins exactly the class of
// bug the session-canary incident exposed: the composed chain's per-gate
// settings-layer resolution, the planned concern order, and the aggregate
// injected-context size. Child-process isolation is deliberate — the
// in-process runner hardens/mutates process.env, which would leak the build
// machine's real user-global config into the assertions.
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { _load_yaml } from "../../../src/scripts/hooks/dispatch_hook.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const ENTRY = path.join(REPO_ROOT, "src", "scripts", "hooks", "dispatch_entry.ts");
const MANIFEST_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");
const TSX_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

/**
 * Aggregate injected-context ceiling for a bare fixture workspace. This is
 * a documented invariant, not a tuning knob: session_start injection on an
 * EMPTY workspace must stay far below host context budgets. Raise only with
 * a reason recorded in the roadmap/ADR that changes the injection surface.
 */
const EMPTY_WORKSPACE_CONTEXT_BUDGET_CHARS = 20_000;

const tmpDirs: string[] = [];

function tmpDir(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runDispatcher(options: {
  platform: string;
  workspace: string;
  globalRoot: string;
  dryRun?: boolean;
}): RunResult {
  const envelope = JSON.stringify({
    event: "session_start",
    workspace_root: options.workspace,
    platform: options.platform,
  });
  const args = [
    ENTRY,
    "--platform",
    options.platform,
    "--event",
    "session_start",
  ];
  if (options.dryRun) args.push("--dry-run");
  const r = spawnSync(TSX_BIN, args, {
    encoding: "utf-8",
    cwd: options.workspace,
    input: envelope,
    timeout: 120_000,
    env: {
      ...process.env,
      EVENT4U_CONFIG_HOME: options.globalRoot,
      AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT,
    },
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function hookCapablePlatforms(): string[] {
  const manifest = _load_yaml(MANIFEST_PATH) as {
    platforms?: Record<string, Record<string, unknown> & { fallback_only?: boolean }>;
  };
  return Object.entries(manifest.platforms ?? {})
    .filter(([, cfg]) => cfg.fallback_only !== true && Array.isArray(cfg["session_start"]))
    .map(([name]) => name);
}

describe("composed session_start chain — per platform", () => {
  const platforms = hookCapablePlatforms();

  it("manifest exposes at least the core hook-capable platforms", () => {
    expect(platforms).toEqual(expect.arrayContaining(["claude", "augment", "cursor"]));
  });

  for (const platform of platforms) {
    it(`${platform}: dispatcher exits 0 on a bare fixture workspace and stays under the context budget`, () => {
      const ws = tmpDir("chain-ws-");
      const globalRoot = tmpDir("chain-global-");
      const r = runDispatcher({ platform, workspace: ws, globalRoot });
      expect(r.status, `stderr: ${r.stderr.slice(0, 500)}`).toBe(0);
      expect(r.stdout.length).toBeLessThanOrEqual(EMPTY_WORKSPACE_CONTEXT_BUDGET_CHARS);
    });

    it(`${platform}: --dry-run plan matches the manifest chain order`, () => {
      const ws = tmpDir("chain-ws-");
      const globalRoot = tmpDir("chain-global-");
      const manifest = _load_yaml(MANIFEST_PATH) as {
        platforms: Record<string, Record<string, string[]>>;
      };
      const expected = manifest.platforms[platform]?.["session_start"] ?? [];
      expect(expected.length).toBeGreaterThan(0);
      const r = runDispatcher({ platform, workspace: ws, globalRoot, dryRun: true });
      expect(r.status).toBe(0);
      // The dry-run plan lists concerns in execution order; assert the
      // manifest order is preserved as a subsequence of the plan output.
      let cursor = -1;
      for (const concern of expected) {
        const idx = r.stdout.indexOf(concern, cursor + 1);
        expect(idx, `concern ${concern} missing/out of order in plan:\n${r.stdout}`).toBeGreaterThan(cursor);
        cursor = idx;
      }
    });
  }
});

describe("composed chain — canary settings-layer resolution (regression: 2026-08 incident)", () => {
  function canaryContextFor(fixtures: {
    projectYaml?: string;
    globalSettingsYaml?: string;
    globalUserYaml?: string;
  }): string {
    const ws = tmpDir("chain-ws-");
    const globalRoot = tmpDir("chain-global-");
    fs.mkdirSync(path.join(globalRoot, "settings"), { recursive: true });
    if (fixtures.projectYaml !== undefined) {
      fs.writeFileSync(path.join(ws, ".agent-settings.yml"), fixtures.projectYaml, "utf-8");
    }
    if (fixtures.globalSettingsYaml !== undefined) {
      fs.writeFileSync(
        path.join(globalRoot, "settings", ".agent-settings.yml"),
        fixtures.globalSettingsYaml,
        "utf-8",
      );
    }
    if (fixtures.globalUserYaml !== undefined) {
      fs.writeFileSync(
        path.join(globalRoot, "settings", ".agent-user.yml"),
        fixtures.globalUserYaml,
        "utf-8",
      );
    }
    const r = runDispatcher({ platform: "claude", workspace: ws, globalRoot });
    expect(r.status, `stderr: ${r.stderr.slice(0, 500)}`).toBe(0);
    return r.stdout;
  }

  it("project canary_name overrides both user-global layers through the real chain", () => {
    const out = canaryContextFor({
      projectYaml: 'personal:\n  canary_name: "ProjectWins"\n',
      globalSettingsYaml: 'personal:\n  canary_name: "GlobalSettings"\n',
      globalUserYaml: "identity:\n  name: GlobalIdentity\n",
    });
    expect(out).toContain("ProjectWins");
    expect(out).not.toContain("GlobalSettings");
    expect(out).not.toContain("GlobalIdentity");
  });

  it("user-global settings canary_name beats the identity fallback", () => {
    const out = canaryContextFor({
      globalSettingsYaml: 'personal:\n  canary_name: "GlobalSettings"\n',
      globalUserYaml: "identity:\n  name: GlobalIdentity\n",
    });
    expect(out).toContain("GlobalSettings");
    expect(out).not.toContain("GlobalIdentity");
  });

  it("identity.name is the final fallback — THE incident case: no project config at all", () => {
    const out = canaryContextFor({
      globalUserYaml: "identity:\n  name: GlobalIdentity\n",
    });
    expect(out).toContain("GlobalIdentity");
    expect(out).toContain("session-canary");
  });

  it("no name on any layer → no canary block in the composed output", () => {
    const out = canaryContextFor({});
    expect(out).not.toContain("session-canary");
  });
});
