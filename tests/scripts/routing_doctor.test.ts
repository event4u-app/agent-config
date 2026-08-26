// Tests for src/scripts/routing_doctor.ts — the live routing diagnosis
// command (road-to-tested-routing Phase 1). In-process: probe_gate and
// collect_report run the real concern mains against fixture workspaces and
// an isolated EVENT4U_CONFIG_HOME, so no real user-global state leaks in.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PROBE_SAFE,
  collect_report,
  main,
  probe_gate,
  resolve_chain,
} from "../../src/scripts/routing_doctor.js";
import { _load_yaml } from "../../src/scripts/hooks/dispatch_hook.js";

const MANIFEST = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "scripts",
  "hook_manifest.yaml",
);

const tmpDirs: string[] = [];
let prevConfigHome: string | undefined;

function tmpDir(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

beforeEach(() => {
  prevConfigHome = process.env.EVENT4U_CONFIG_HOME;
  // Isolate the user-global layer: every probe in these tests resolves
  // against an empty global root unless a test writes into it.
  process.env.EVENT4U_CONFIG_HOME = tmpDir("routing-doctor-global-");
});

afterEach(() => {
  if (prevConfigHome === undefined) {
    delete process.env.EVENT4U_CONFIG_HOME;
  } else {
    process.env.EVENT4U_CONFIG_HOME = prevConfigHome;
  }
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("resolve_chain", () => {
  it("yields the manifest's session_start chain for claude", () => {
    const manifest = _load_yaml(MANIFEST);
    const chain = resolve_chain(manifest, "claude");
    const names = chain.map((c) => c.name);
    expect(names).toContain("session-canary");
    expect(names).toContain("onboarding-gate");
    expect(chain.every((c) => c.script.length > 0)).toBe(true);
  });

  it("yields an empty chain for the fallback-only platform", () => {
    const manifest = _load_yaml(MANIFEST);
    expect(resolve_chain(manifest, "copilot")).toEqual([]);
  });

  it("yields an empty chain for an unknown platform", () => {
    const manifest = _load_yaml(MANIFEST);
    expect(resolve_chain(manifest, "no-such-platform")).toEqual([]);
  });
});

describe("probe_gate", () => {
  it("reports the canary gate ACTIVE with the concern's own reason", () => {
    const ws = tmpDir("routing-doctor-ws-");
    fs.writeFileSync(
      path.join(ws, ".agent-settings.yml"),
      'personal:\n  canary_name: "Probe"\n',
      "utf-8",
    );
    const r = probe_gate("session-canary", "src/scripts/session_canary_hook.ts", ws);
    expect(r.status).toBe("ACTIVE");
    expect(r.reason).toContain("Probe");
    expect(r.injects_context).toBe(true);
  });

  it("reports the canary gate INACTIVE when no layer carries a name", () => {
    const ws = tmpDir("routing-doctor-ws-");
    const r = probe_gate("session-canary", "src/scripts/session_canary_hook.ts", ws);
    expect(r.status).toBe("INACTIVE");
    expect(r.injects_context).toBe(false);
  });

  it("resolves the canary name from the user-global identity layer", () => {
    const ws = tmpDir("routing-doctor-ws-");
    const globalRoot = process.env.EVENT4U_CONFIG_HOME as string;
    fs.mkdirSync(path.join(globalRoot, "settings"), { recursive: true });
    fs.writeFileSync(
      path.join(globalRoot, "settings", ".agent-user.yml"),
      "identity:\n  name: GlobalProbe\n",
      "utf-8",
    );
    const r = probe_gate("session-canary", "src/scripts/session_canary_hook.ts", ws);
    expect(r.status).toBe("ACTIVE");
    expect(r.reason).toContain("GlobalProbe");
  });

  it("flags a script without a registry entry as unregistered", () => {
    const r = probe_gate("ghost", "src/scripts/no_such_hook.ts", tmpDir("ws-"));
    expect(r.status).toBe("unregistered");
  });
});

describe("collect_report", () => {
  it("probes only PROBE_SAFE concerns and marks the rest stateful", () => {
    const ws = tmpDir("routing-doctor-ws-");
    const report = collect_report({
      platform: "claude",
      workspace_root: ws,
      no_freshness: true,
    });
    const byName = new Map(report.gates.map((g) => [g.concern, g]));
    expect(byName.get("chat-history")?.status).toBe("stateful");
    for (const g of report.gates) {
      if (!PROBE_SAFE.has(g.concern)) {
        expect(["stateful", "unregistered"]).toContain(g.status);
      } else {
        expect(["ACTIVE", "INACTIVE", "ERROR"]).toContain(g.status);
      }
    }
    expect(report.freshness.router).toBe("skipped");
    expect(report.freshness.projection).toBe("skipped");
  });
});

describe("collect_orchestration (via collect_report)", () => {
  it("reports host manifest and a dry-run classification with an EMPTY settings file (always-on)", () => {
    const ws = tmpDir("routing-doctor-ws-");
    const report = collect_report({
      platform: "claude",
      workspace_root: ws,
      no_freshness: true,
      classify: "Who calls resolveSubagentRouting?",
    });
    const o = report.orchestration;
    expect(o.halted).toBe(false);
    expect(o.host_manifest.subagent_spawn).toBe(true);
    expect(o.activation.action).toBe("dispatch");
    expect(o.sample?.lookup_route).toBe("primitive");
    // Capped grep, not the graph: the code-graph primitive is an opportunistic
    // accelerant gated on `hooks.code_graph.enabled`, and the doctor does not
    // pass that flag. The lookup CLASS is still recognised — which is what this
    // assertion is really about — and the primitive follows the gate rather than
    // being hardcoded. See auto_dispatch.classifyLookup and
    // road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh 2.1.
    expect(o.sample?.lookup_primitive).toBe("fts-or-capped-grep");
  });

  // Regression: the doctor resolved capabilities through `normalizeHostManifest`
  // alone, which skips the committed registry. On a fresh clone that made the
  // diagnostic report `subagent_spawn: false` while `delegation_nudge_hook` —
  // which calls `probeHostCapabilities` — reported `true` for the same host.
  it("resolves a KNOWN host from the committed registry with no settings at all", () => {
    const ws = tmpDir("routing-doctor-ws-");
    const report = collect_report({
      platform: "claude",
      workspace_root: ws,
      no_freshness: true,
    });
    const o = report.orchestration;
    expect(o.host_manifest.subagent_spawn).toBe(true);
    expect(o.halted).toBe(false);
    // Always-on: a matched delegable signal (the canonical probe) dispatches
    // unconditionally — there is no more `subagents.auto` mode to fall back to.
    expect(o.activation.action).toBe("dispatch");
    expect(o.sample).toBeNull();
  });

  it("a leftover subagents.host_capabilities override no longer applies (always-on: capability is probe/registry-only)", () => {
    const ws = tmpDir("routing-doctor-ws-");
    fs.writeFileSync(
      path.join(ws, ".agent-settings.yml"),
      ["subagents:", "  host_capabilities:", "    subagent_spawn: false", ""].join("\n"),
      "utf-8",
    );
    const report = collect_report({
      platform: "claude",
      workspace_root: ws,
      no_freshness: true,
    });
    const o = report.orchestration;
    // The stale key is ignored — `claude`'s registry row still wins.
    expect(o.host_manifest.subagent_spawn).toBe(true);
    expect(o.activation.action).toBe("dispatch");
  });

  it("emergency.orchestration_halt closes the activation gate on a known, capable host", () => {
    const ws = tmpDir("routing-doctor-ws-");
    fs.writeFileSync(
      path.join(ws, ".agent-settings.yml"),
      ["emergency:", "  orchestration_halt: true", ""].join("\n"),
      "utf-8",
    );
    const report = collect_report({
      platform: "claude",
      workspace_root: ws,
      no_freshness: true,
    });
    const o = report.orchestration;
    expect(o.halted).toBe(true);
    expect(o.host_manifest.subagent_spawn).toBe(true);
    expect(o.activation.action).toBe("in-session");
    expect(o.activation.reason).toContain("orchestration_halt");
  });

  it("reports whether the platform was observed or assumed", () => {
    const ws = tmpDir("routing-doctor-ws-");
    // Keying the registry on a guessed host is how the fixed bug comes back
    // mirrored, so the guess is part of the report, not just of the CLI.
    const assumed = collect_report({
      platform: "claude",
      workspace_root: ws,
      no_freshness: true,
    });
    expect(assumed.orchestration.host_platform).toBe("claude");
    expect(assumed.orchestration.host_platform_assumed).toBe(true);
    const observed = collect_report({
      platform: "claude",
      platform_assumed: false,
      workspace_root: ws,
      no_freshness: true,
    });
    expect(observed.orchestration.host_platform_assumed).toBe(false);
  });

  it("safe-defaults to no subagent primitive on an UNKNOWN host and reports the deciding gate", () => {
    const ws = tmpDir("routing-doctor-ws-");
    const report = collect_report({
      platform: "no-such-host",
      workspace_root: ws,
      no_freshness: true,
    });
    const o = report.orchestration;
    expect(o.host_manifest.subagent_spawn).toBe(false);
    expect(o.activation.action).toBe("in-session");
    expect(o.activation.reason).toContain("subagent_spawn");
    expect(o.sample).toBeNull();
  });
});

describe("budget-routing delivery evidence (review Finding 2)", () => {
  function auditFixture(ws: string, lines: Array<Record<string, unknown>>): void {
    const dir = path.join(ws, "agents", "runtime", "state", "audit");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "2026-08.jsonl"),
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
      "utf-8",
    );
  }

  // Repointed 2026-08-16 with the surface it covers. The counter is unchanged —
  // the wording is not: budget routing is archived, so "no delivery evidence"
  // asserted a defect that is now the designed state, and a warning that can
  // never be acted on is the dead-advisory shape this repo removes elsewhere.
  // The assertion deliberately pins the two things that still carry meaning: the
  // count, and that the text routes the reader to the migration record.
  it("reports zero tier-decision coverage and routes to the archival record", () => {
    const ws = tmpDir("routing-doctor-ws-");
    auditFixture(ws, [
      { id: "a", spawn_count: 3, task_class: "read-only-fanout" },
      { id: "b", spawn_count: 1, task_class: "mechanical-covered" },
    ]);
    const report = collect_report({ platform: "claude", workspace_root: ws, no_freshness: true });
    expect(report.orchestration.delivery.eligible_dispatches).toBe(2);
    expect(report.orchestration.delivery.budget_evidence_lines).toBe(0);
    expect(report.orchestration.delivery.warning).toContain("0 of 2");
    expect(report.orchestration.delivery.warning).toContain("budget-routing.md");
    expect(report.orchestration.delivery.warning).not.toContain("may not be running");
  });

  it("stays silent when tier-carrying lines exist", () => {
    const ws = tmpDir("routing-doctor-ws-");
    auditFixture(ws, [
      { id: "a", spawn_count: 2, tier: "cheap", tier_source: "inferred" },
      { id: "b", spawn_count: 1, task_class: "synthesis" },
    ]);
    const report = collect_report({ platform: "claude", workspace_root: ws, no_freshness: true });
    expect(report.orchestration.delivery.warning).toBe("");
    expect(report.orchestration.delivery.budget_evidence_lines).toBe(1);
  });

  it("stays silent when there is nothing recorded at all", () => {
    const ws = tmpDir("routing-doctor-ws-");
    const report = collect_report({ platform: "claude", workspace_root: ws, no_freshness: true });
    expect(report.orchestration.delivery.warning).toBe("");
    expect(report.orchestration.delivery.eligible_dispatches).toBe(0);
  });
});

describe("main", () => {
  it("emits parseable JSON and exits 0 with --json --no-freshness", () => {
    const ws = tmpDir("routing-doctor-ws-");
    let out = "";
    const prev = process.stdout.write;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stdout.write = ((chunk: any): boolean => {
      out += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8");
      return true;
    }) as typeof process.stdout.write;
    let rc: number;
    try {
      rc = main(["--platform", "claude", "--workspace", ws, "--json", "--no-freshness"]);
    } finally {
      process.stdout.write = prev;
    }
    expect(rc).toBe(0);
    const parsed = JSON.parse(out) as { platform: string; gates: unknown[] };
    expect(parsed.platform).toBe("claude");
    expect(Array.isArray(parsed.gates)).toBe(true);
    expect(parsed.gates.length).toBeGreaterThan(0);
  });
});
