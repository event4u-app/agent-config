#!/usr/bin/env tsx
/**
 * routing:doctor — read-only, live-installation routing diagnosis.
 *
 * Answers, against the REAL installation (not fixtures), the question the
 * session-canary incident exposed as untestable: "why did / didn't concern X
 * fire on session start?" — plus the freshness facts a routing complaint
 * needs ruled out first. Composes existing single-purpose surfaces instead
 * of duplicating them:
 *
 *   * `hooks_status.collect()`   — per-platform bridge presence + bindings
 *     (the "is the dispatcher even registered in the host?" layer).
 *   * `dispatch_hook._resolve_concerns()` — the exact session_start concern
 *     chain the dispatcher would run for the platform.
 *   * `concern_registry.CONCERN_REGISTRY` — in-process gate PROBES for the
 *     read-only session_start concerns: each probe runs the concern's real
 *     `main()` with a synthetic session_start envelope and reports
 *     ACTIVE (context injected, with the concern's own `reason`) or
 *     INACTIVE (clean no-op). This is the live gate evaluation, not a
 *     simulation.
 *   * compile_router `--check` + `condense.sh --changed` — router and
 *     projection freshness (skippable via `--no-freshness`; auto-skipped
 *     when the source tree is absent, i.e. in a consumer install).
 *
 * PROBE SAFETY. Only concerns in `PROBE_SAFE` are invoked — verified to
 * perform zero state writes on the session_start path (session-canary,
 * onboarding-gate, profile-staleness). Stateful concerns (chat-history,
 * hot-context, first-run-gate, wrapper-freshness, surface-probe) are listed
 * with status `stateful` and NOT invoked; their last outcome is visible via
 * `hooks:doctor` (dispatcher feedback files). Deeper diagnosis of a
 * stateful concern stays a `hooks:doctor` job — this doctor never widens
 * the probe set silently.
 *
 * Read-only contract: no file is created or modified; the only child
 * processes are the two freshness checks, both themselves read-only.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  type JsonObject,
  type JsonValue,
  _load_yaml,
  _resolve_concerns,
} from "./hooks/dispatch_hook.js";
import { CONCERN_REGISTRY } from "./hooks/concern_registry.js";
import {
  clearHookStdinOverride,
  setHookStdinOverride,
} from "./hooks/hook_stdin.js";
import * as hooks_status from "./hooks_status.js";
import { load_agent_settings } from "./_lib/agent_settings.js";
import {
  describeHostCapabilities,
  type HostCapabilityManifest,
  type HostCapabilitySources,
} from "./_lib/host_capability.js";
import {
  classifyLookup,
  classifyTask,
  type ActivationInputs,
} from "./_lib/auto_dispatch.js";
import { COOLDOWN_FILE, TIER_ORDER, readCooldowns } from "./_lib/tier_budget_routing.js";
import {
  instructionsLoadedRecord,
  measureStandingDelivery,
  type StandingDeliveryMeasure,
} from "./check_standing_rule_delivery.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const MANIFEST_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");

/**
 * Concerns whose session_start `main()` performs zero state writes — the
 * only ones the doctor may invoke live. Adding a concern here requires
 * re-verifying its write-free path (grep for writeFileSync / appendFileSync /
 * mkdirSync / renameSync on the session_start branch).
 */
export const PROBE_SAFE: ReadonlySet<string> = new Set([
  "session-canary",
  "onboarding-gate",
  "profile-staleness",
]);

export interface GateReport {
  concern: string;
  script: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR" | "stateful" | "unregistered";
  reason: string;
  injects_context: boolean;
}

export interface FreshnessReport {
  router: "fresh" | "stale" | "skipped" | "unavailable";
  projection: "clean" | "stale" | "skipped" | "unavailable";
  projection_detail: string;
  dispatch_bundle: "built" | "absent (tsx fallback path)";
}

export interface OrchestrationReport {
  /** `emergency.orchestration_halt` — the one audited incident switch. */
  halted: boolean;
  downshift: boolean;
  /** cost.budgets.per_tier ceilings + live cool-down state per tier. */
  tier_budgets: Record<string, { ceiling_usd: number | null; cooldown_until_ms: number }>;
  /**
   * Whether the cool-down store exists on disk. `readCooldowns` returns all
   * zeros both when no tier is cooling AND when nothing has ever written the
   * file, so a bare zero cannot distinguish "measured: live" from "no reading
   * exists". This flag is what separates them.
   */
  cooldown_store_present: boolean;
  host_manifest: HostCapabilityManifest;
  /**
   * The host identifier the capability registry was keyed on, and whether it
   * was OBSERVED (given via `--platform`) or merely ASSUMED (the CLI default).
   *
   * The doctor has no host detection: `main()` defaults to `claude`. Once
   * capability resolution keys on that string, an assumed platform produces a
   * confident-looking `subagent_spawn` for a host the user may not be on —
   * so the assumption is reported next to the value it decided, and a reader
   * can falsify it. Without this pair the misdiagnosis is invisible in the
   * output, which is worse than the pre-registry bug it replaced.
   */
  host_platform: string;
  host_platform_assumed: boolean;
  /**
   * Per-field provenance for `host_manifest` — `registry` (a committed
   * observation about this host), `live-probe` (established in this process),
   * or `default` (nothing answered; the all-false safe default applied).
   *
   * Without it the six booleans read alike, and `false` cannot be told apart
   * from "no answer". That distinction is the whole difference between "this
   * host cannot spawn subagents" and "nobody has ever checked this host" —
   * and this command is the one a user runs precisely to find out which.
   */
  host_manifest_sources: HostCapabilitySources;
  /** Verdict of the real activation gate for a canonical delegable probe. */
  activation: { action: string; reason: string };
  cost_budgets: Record<string, unknown>;
  ledger_present: boolean;
  /** Optional --classify dry-run result. */
  sample: {
    prompt: string;
    lookup_route: string;
    lookup_primitive: string | null;
    dispatch: string;
    mode: string | null;
    reason: string;
  } | null;
  /** Budget-routing delivery evidence (external review 2026-08-03, Finding 2). */
  delivery: {
    eligible_dispatches: number;
    budget_evidence_lines: number;
    warning: string;
  };
}

/**
 * Tier-decision coverage in the orchestration record.
 *
 * REPOINTED 2026-08-16. This used to check "delivery evidence" for budget-aware
 * tier routing, on the reasoning that policy can be present while delivery is
 * silently absent — the session-canary blind-spot class. That layer is now
 * ARCHIVED (`docs/contracts/budget-routing.md`), so the old rationale no longer
 * holds and the old warning would have been permanently true and un-actionable:
 * nothing dispatches through a tier decision by design, so telling the operator
 * "the relation may not be running" is a dead advisory of exactly the shape this
 * repository keeps removing elsewhere.
 *
 * What it measures now is narrower and still worth having: how many recorded
 * dispatches carry a `tier` at all. That is the SAME field the archived layer's
 * revisit-if depends on — a saving can only be computed once both the chosen and
 * the realized tier are recorded — so this is the instrument that would show the
 * reopen condition arriving. It reports coverage rather than warning about it.
 * Read-only over agents/runtime/state/audit/*.jsonl; no new state.
 */
export function check_budget_delivery(
  workspace_root: string,
): OrchestrationReport["delivery"] {
  const out = { eligible_dispatches: 0, budget_evidence_lines: 0, warning: "" };
  const auditDir = path.join(workspace_root, "agents", "runtime", "state", "audit");
  let files: string[] = [];
  try {
    files = fs.readdirSync(auditDir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return out; // no audit dir — nothing dispatched, nothing to warn about
  }
  for (const f of files) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(auditDir, f), "utf-8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as Record<string, unknown>;
        const spawns = Number(rec["spawn_count"] ?? 0);
        if (!Number.isFinite(spawns) || spawns < 1) continue;
        out.eligible_dispatches += 1;
        if (typeof rec["tier"] === "string" && rec["tier"] !== "") {
          out.budget_evidence_lines += 1;
        }
      } catch {
        // non-record line — audit files are shared JSONL surfaces
      }
    }
  }
  if (out.eligible_dispatches > 0 && out.budget_evidence_lines === 0) {
    out.warning =
      `tier-decision coverage is 0 of ${out.eligible_dispatches} recorded dispatch(es) — ` +
      `expected while budget routing stays archived (docs/contracts/budget-routing.md). ` +
      `This is the counter its revisit-if reads: a non-zero value here is the signal ` +
      `that per-tier dispatch has reappeared and the decision can be reopened`;
  }
  return out;
}

export interface DoctorReport {
  platform: string;
  chain: string[];
  gates: GateReport[];
  freshness: FreshnessReport;
  orchestration: OrchestrationReport;
  standing_delivery: StandingDeliveryMeasure | null;
  bridge_table: string;
}

/**
 * Standing-rule-delivery savings for the doctor surface — the measurement is
 * `check_standing_rule_delivery`'s, reused rather than re-derived, so the gate
 * and the doctor can never report different numbers for the same layers.
 * Read-only, like everything else here. `null` = no rule layer installed.
 */
export function collect_standing_delivery(
  workspace_root: string,
  global_rules_dir: string = path.join(os.homedir(), ".claude", "rules"),
): StandingDeliveryMeasure | null {
  return measureStandingDelivery(
    global_rules_dir,
    path.join(workspace_root, ".claude", "rules"),
    instructionsLoadedRecord(workspace_root),
  );
}

/**
 * Render the delivery line in one of its states — scoped-clean (one layer,
 * nothing duplicated) or both-layers-active (red, pointing at
 * `install --layer`). Every number printed is one the measurement produced:
 * the received total, the measured overlap, and the received-minus-overlap
 * total suppression would leave. No baseline is invented for the layer that
 * is not installed, so no percentage is derived from one either. The
 * filesystem-vs-host-confirmed caveat is the gate's own honest-scope
 * sentence, carried here so the doctor never claims the host confirmed what
 * only the filesystem projects.
 */
export function render_standing_delivery(m: StandingDeliveryMeasure | null): string[] {
  if (m === null) {
    return [
      "Standing delivery: no rule layer installed (neither ~/.claude/rules nor .claude/rules) — nothing delivered, nothing to save.",
    ];
  }
  const lines: string[] = [];
  if (m.layers.length === 2 && m.overlap_rules > 0) {
    const scoped = m.received_tokens - m.overlap_tokens;
    lines.push(
      `⚠️ Standing delivery: both rule layers active — ${m.overlap_rules} rule(s) delivered twice ` +
        `(~${m.overlap_tokens} tok). This session's host receives ${m.received_tokens} rule tokens; ` +
        `single-layer delivery would be ~${scoped} — run \`agent-config install\` to arm the ` +
        `ADR-236 partition on this machine (it fingerprints the host layer; the next ` +
        `\`task generate-tools\` then withholds the globally-owned artefacts). The former advice ` +
        `here, \`install --layer=<global|project>\`, was layer suppression — declined by ADR-226 ` +
        `and superseded by the partition.`,
    );
    if (m.divergent_rules > 0) {
      // Suppressing a layer whose copies differ drops whichever obligations only
      // the suppressed copy carried — the same guard `decideLayerAction` applies.
      lines.push(
        `  ${m.divergent_rules} of the shared rule(s) differ in body — refresh before suppressing, ` +
          "or obligations only the suppressed copy carries are lost.",
      );
    }
  } else if (m.layers.length === 2) {
    lines.push(
      `Standing delivery: this session's host receives ${m.received_tokens} rule tokens across two ` +
        "non-overlapping layers — nothing delivered twice, Δ0 to save.",
    );
  } else {
    // One layer = the scoped state, and the honest report of it is the received
    // total plus the measured fact that nothing is delivered twice.
    //
    // This line used to invent an "unscoped both-layers baseline" of
    // `received × 2` and report the arithmetic consequence — which is always
    // exactly 50%, for every non-zero input, i.e. a tautology dressed as a
    // measurement. It also assumed the absent second layer would carry an
    // identical corpus; the branch directly above exists because two installed
    // layers can be wholly disjoint, so even with both present the doubling
    // does not follow. A saving needs a second layer to measure against, and
    // here there is none.
    const layer = m.layers[0]?.label ?? "one";
    lines.push(
      `Standing delivery: this session's host receives ${m.received_tokens} rule tokens (scoped, ` +
        `${layer} layer only); 0 tokens delivered twice — one layer is installed, so there is no ` +
        "second layer to measure a saving against.",
    );
  }
  if (m.input === "filesystem") {
    lines.push(
      "  note: filesystem projection, not host-confirmed — no InstructionsLoaded record; a rule " +
        "projected but never loaded, or loaded from an unprojected layer, is invisible to this input.",
    );
  }
  return lines;
}

/**
 * Orchestration-routing state: settings gates, host capability, budget
 * inputs, and (optionally) a dry-run classification for a sample prompt.
 * Read-only — it mirrors what the delegation layer resolves FOR `platform`.
 * That qualifier is load-bearing: the hook reads its platform off a real
 * envelope, this function is told one, and the two agree only when the
 * caller was told the truth (see `platform_assumed`).
 *
 * `platform` is the host identifier the committed capability registry is
 * keyed on — the same string a hook envelope's `platform` field carries.
 * It is REQUIRED, not optional: resolving through `normalizeHostManifest`
 * alone (as this function did until the registry landed) skips the registry
 * row entirely, so on a fresh clone with no `subagents.host_capabilities`
 * override the doctor reported `subagent_spawn: false` while
 * `delegation_nudge_hook` — which does call `resolveHostCapabilities` —
 * reported `true`. Two readers of one fact disagreeing is worse than either
 * answer, and the diagnostic is the one a user runs precisely to check the
 * other. A required parameter makes that regression uncompilable; an
 * optional one only discourages it in a comment, and a comment has never
 * failed a build.
 *
 * `platform_assumed` says whether the caller OBSERVED the host or guessed
 * it. It is not decoration: keying the registry on a guessed host is how
 * this function would trade the bug it fixed for a mirrored one.
 */
export function collect_orchestration(
  workspace_root: string,
  sample_prompt: string | null,
  platform: string,
  platform_assumed: boolean,
): OrchestrationReport {
  const settings = load_agent_settings({ cwd: workspace_root });
  const sub = (settings["subagents"] ?? {}) as Record<string, unknown>;
  const emergency = (settings["emergency"] ?? {}) as Record<string, unknown>;
  const halted = emergency["orchestration_halt"] === true;
  const downshift = sub["downshift"] !== false;
  const { manifest: host_manifest, sources: host_manifest_sources } =
    describeHostCapabilities(platform);
  const activationInputs: ActivationInputs = {
    halted,
    subagent_spawn: host_manifest.subagent_spawn,
  };
  // Canonical delegable probe: the gate verdict shows which activation
  // layer (emergency halt / host primitive) decides on THIS installation.
  const probe = classifyTask(
    { size_estimate: 5, independent_slices: 3 },
    activationInputs,
  );
  const cost = (settings["cost"] ?? {}) as Record<string, unknown>;
  const cost_budgets = (cost["budgets"] ?? {}) as Record<string, unknown>;
  const tracking_dir = path.join(workspace_root, "agents", "cost-tracking");
  const ledger_present = fs.existsSync(path.join(tracking_dir, "sessions.jsonl"));
  const per_tier = (cost_budgets["per_tier"] ?? {}) as Record<string, unknown>;
  const cooldowns = readCooldowns(tracking_dir);
  const cooldown_store_present = fs.existsSync(path.join(tracking_dir, COOLDOWN_FILE));
  const tier_budgets: OrchestrationReport["tier_budgets"] = {};
  for (const t of TIER_ORDER) {
    const v = per_tier[t];
    tier_budgets[t] = {
      ceiling_usd: typeof v === "number" && Number.isFinite(v) ? v : null,
      cooldown_until_ms: cooldowns[t],
    };
  }

  let sample: OrchestrationReport["sample"] = null;
  if (sample_prompt) {
    const lookup = classifyLookup(sample_prompt);
    const cls = classifyTask({ size_estimate: 5 }, activationInputs);
    sample = {
      prompt: sample_prompt,
      lookup_route: lookup.route,
      lookup_primitive: lookup.primitive,
      dispatch: lookup.route === "primitive" ? "primitive (no spawn)" : cls.action,
      mode: cls.mode,
      reason: lookup.route === "primitive" ? lookup.reason : cls.reason,
    };
  }
  return {
    halted,
    downshift,
    tier_budgets,
    cooldown_store_present,
    host_manifest,
    host_platform: platform,
    host_platform_assumed: platform_assumed,
    host_manifest_sources,
    activation: { action: probe.action, reason: probe.reason },
    cost_budgets,
    ledger_present,
    sample,
    delivery: check_budget_delivery(workspace_root),
  };
}

/** Invoke one PROBE_SAFE concern's registered main() and observe its gate. */
export function probe_gate(
  name: string,
  script: string,
  workspace_root: string,
): GateReport {
  const main_fn = CONCERN_REGISTRY[script];
  if (!main_fn) {
    return {
      concern: name,
      script,
      status: "unregistered",
      reason: "no CONCERN_REGISTRY entry — dispatcher would use the slow tsx spawn path",
      injects_context: false,
    };
  }
  const envelope: JsonObject = {
    event: "session_start",
    workspace_root,
    platform: "routing-doctor-probe",
  };
  let out = "";
  const prevWrite = process.stdout.write;
  type WriteFn = typeof process.stdout.write;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capture: WriteFn = ((chunk: any, enc?: any, cb?: any): boolean => {
    out += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8");
    const callback = typeof enc === "function" ? enc : cb;
    if (typeof callback === "function") callback();
    return true;
  }) as WriteFn;

  let rc = 0;
  setHookStdinOverride(JSON.stringify(envelope));
  process.stdout.write = capture;
  try {
    const result = main_fn([]);
    rc = typeof result === "number" ? result : 0;
  } catch (exc) {
    rc = 3;
    out = "";
    process.stdout.write = prevWrite;
    return {
      concern: name,
      script,
      status: "ERROR",
      reason: exc instanceof Error ? exc.message : String(exc),
      injects_context: false,
    };
  } finally {
    process.stdout.write = prevWrite;
    clearHookStdinOverride();
  }

  if (rc !== 0) {
    return {
      concern: name,
      script,
      status: "ERROR",
      reason: `probe exited rc=${rc}`,
      injects_context: false,
    };
  }
  const text = out.trim();
  if (text === "") {
    return {
      concern: name,
      script,
      status: "INACTIVE",
      reason: "gate closed — concern emitted nothing (clean no-op)",
      injects_context: false,
    };
  }
  let reason = "gate open";
  let injects = false;
  try {
    const parsed = JSON.parse(text) as JsonObject;
    if (typeof parsed["reason"] === "string" && parsed["reason"] !== "") {
      reason = parsed["reason"] as string;
    }
    injects = typeof parsed["context"] === "string" && parsed["context"] !== "";
  } catch {
    reason = "gate open (non-JSON stdout)";
  }
  return { concern: name, script, status: "ACTIVE", reason, injects_context: injects };
}

/** session_start chain for the platform, from the real manifest. */
export function resolve_chain(
  manifest: JsonObject,
  platform: string,
): Array<{ name: string; script: string }> {
  const concerns = _resolve_concerns(manifest, platform, "session_start");
  return concerns.map((c) => ({
    name: String((c as JsonObject)["name"] ?? "unknown"),
    script: String((c as JsonObject)["script"] ?? ""),
  }));
}

function _freshness(no_freshness: boolean): FreshnessReport {
  const bundle = fs.existsSync(path.join(REPO_ROOT, "dist", "hooks", "dispatch.js"))
    ? ("built" as const)
    : ("absent (tsx fallback path)" as const);
  if (no_freshness) {
    return { router: "skipped", projection: "skipped", projection_detail: "", dispatch_bundle: bundle };
  }
  const compiler = path.join(REPO_ROOT, "src", "scripts", "compile_router.ts");
  let router: FreshnessReport["router"] = "unavailable";
  if (fs.existsSync(compiler)) {
    const r = spawnSync("npx", ["tsx", compiler, "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      timeout: 120_000,
    });
    router = r.status === 0 ? "fresh" : "stale";
  }
  const condense = path.join(REPO_ROOT, "src", "scripts", "condense.sh");
  let projection: FreshnessReport["projection"] = "unavailable";
  let detail = "";
  if (fs.existsSync(condense)) {
    const r = spawnSync("bash", [condense, "--changed"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      timeout: 300_000,
    });
    const outText = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    if (outText.includes("Every .md projection matches")) {
      projection = "clean";
    } else {
      projection = "stale";
      detail = outText
        .split("\n")
        .filter((l) => l.trim().startsWith("rules/") || l.trim().startsWith("skills/") || l.trim().startsWith("commands/"))
        .slice(0, 10)
        .join("; ");
    }
  }
  return { router, projection, projection_detail: detail, dispatch_bundle: bundle };
}

export function collect_report(options: {
  platform: string;
  /**
   * True when `platform` is the CLI's fallback rather than a value the caller
   * observed or passed. Optional so existing callers keep compiling, and
   * defaulting to `true` on purpose: a caller that did not say where the
   * platform came from has not established that it observed one, and the
   * conservative reading is the one that shows the caveat rather than the one
   * that hides it.
   */
  platform_assumed?: boolean;
  workspace_root: string;
  no_freshness: boolean;
  classify?: string | null;
  /** Test seam: fixture global rules dir. Defaults to the real `~/.claude/rules`. */
  global_rules_dir?: string;
}): DoctorReport {
  const manifest = _load_yaml(MANIFEST_PATH);
  const chain = resolve_chain(manifest, options.platform);
  const gates: GateReport[] = chain.map(({ name, script }) => {
    if (!PROBE_SAFE.has(name)) {
      return {
        concern: name,
        script,
        status: "stateful" as const,
        reason: "not probed (writes state) — see hooks:doctor last-feedback",
        injects_context: false,
      };
    }
    return probe_gate(name, script, options.workspace_root);
  });
  let bridge_table = "";
  try {
    const matrix = hooks_status.collect(options.workspace_root, manifest);
    bridge_table = hooks_status._render_table(matrix);
  } catch (exc) {
    bridge_table = `bridge status unavailable: ${exc instanceof Error ? exc.message : String(exc)}`;
  }
  return {
    platform: options.platform,
    chain: chain.map((c) => c.name),
    gates,
    freshness: _freshness(options.no_freshness),
    orchestration: collect_orchestration(
      options.workspace_root,
      options.classify ?? null,
      options.platform,
      options.platform_assumed ?? true,
    ),
    standing_delivery: options.global_rules_dir === undefined
      ? collect_standing_delivery(options.workspace_root)
      : collect_standing_delivery(options.workspace_root, options.global_rules_dir),
    bridge_table,
  };
}

function _render(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`routing:doctor · platform=${report.platform} · event=session_start`);
  lines.push("");
  lines.push("Gate status (live probes, read-only):");
  for (const g of report.gates) {
    const marker =
      g.status === "ACTIVE" ? "✅" : g.status === "ERROR" ? "❌" : g.status === "INACTIVE" ? "⚠️" : "·";
    const ctx = g.injects_context ? " [injects context]" : "";
    lines.push(`  ${marker} ${g.concern.padEnd(20)} ${g.status.padEnd(10)} ${g.reason}${ctx}`);
  }
  lines.push("");
  lines.push(
    `Freshness: router=${report.freshness.router} · projection=${report.freshness.projection}` +
      (report.freshness.projection_detail ? ` (${report.freshness.projection_detail})` : "") +
      ` · dispatch bundle=${report.freshness.dispatch_bundle}`,
  );
  lines.push("");
  lines.push(...render_standing_delivery(report.standing_delivery));
  lines.push("");
  const o = report.orchestration;
  lines.push(
    `Orchestration: halted=${o.halted} · downshift=${o.downshift} · ` +
      `subagent_spawn=${o.host_manifest.subagent_spawn} ` +
      `(host=${o.host_platform}${o.host_platform_assumed ? ", ASSUMED" : ", observed"}) · ` +
      `ledger=${o.ledger_present ? "present" : "absent"}`,
  );
  if (o.host_platform_assumed) {
    // Without this line the reader cannot tell a measured capability from one
    // the registry produced for a host nobody checked they were on.
    lines.push(
      `  ⚠️ host not detected — '${o.host_platform}' is this command's default, ` +
        `and the capability registry is keyed on it. Pass --platform <host> to check another.`,
    );
  }
  const provenanceBits = Object.entries(o.host_manifest_sources).map(
    ([field, src]) =>
      `${field}=${o.host_manifest[field as keyof HostCapabilityManifest]}(${src})`,
  );
  lines.push(`  capability provenance: ${provenanceBits.join(" · ")}`);
  lines.push(
    `  registry = committed observation about this host, not a live check · ` +
      `default = nobody answered, rendered as false`,
  );
  const tierBits = Object.entries(o.tier_budgets).map(([t, s]) => {
    const cap = s.ceiling_usd === null ? "no cap" : `$${s.ceiling_usd}`;
    // `> Date.now()`, not `> 0`. The purger went with the archived permit
    // lifecycle (`tripCooldown` rewrote the map on every write), so a stale
    // entry now has nothing to clear it and `> 0` would render COOLING for
    // ever. Latent rather than live — there is no writer either — but the
    // comparison should be the one that stays correct if a writer returns.
    const cool = s.cooldown_until_ms > Date.now() ? " COOLING" : "";
    return `${t}=${cap}${cool}`;
  });
  lines.push(`  tier budgets (rolling-24h): ${tierBits.join(" · ")}`);
  // `readCooldowns` returns all zeros both when no tier is cooling and when
  // nothing has ever written the store, so a missing COOLING marker alone
  // cannot be read as a measured "this tier is live". Report which of the two
  // it is — the same unavailable-vs-false distinction the capability-
  // provenance line above makes two lines earlier. Derived from the store's
  // existence rather than from a caller count, so it stays true if the
  // cool-down producer is ever wired.
  if (!o.cooldown_store_present) {
    lines.push(
      `  cool-down state: no reading on disk (${COOLDOWN_FILE} absent) — ` +
        `absence of COOLING above is not evidence of a live tier`,
    );
  }
  if (o.delivery.warning) {
    lines.push(`  ⚠️ ${o.delivery.warning}`);
  } else if (o.delivery.eligible_dispatches > 0) {
    lines.push(
      `  delivery evidence: ${o.delivery.budget_evidence_lines}/${o.delivery.eligible_dispatches} dispatches carry a tier decision`,
    );
  }
  lines.push(`  activation probe: ${o.activation.action} — ${o.activation.reason}`);
  if (o.sample) {
    lines.push(
      `  dry-run "${o.sample.prompt.slice(0, 60)}": ${o.sample.dispatch}` +
        (o.sample.mode ? ` (${o.sample.mode})` : "") +
        (o.sample.lookup_primitive ? ` via ${o.sample.lookup_primitive}` : "") +
        ` — ${o.sample.reason}`,
    );
  }
  lines.push("");
  lines.push("Host bridge / bindings:");
  lines.push(report.bridge_table);
  return lines.join("\n");
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  // The default is a guess, and since the capability registry is keyed on it
  // the guess now decides `subagent_spawn`. Track where the value came from so
  // the report can say so — there is no host detection here to replace it with.
  let platform = "claude";
  let platform_assumed = true;
  let workspace_root = process.cwd();
  let json = false;
  let strict = false;
  let no_freshness = false;
  let classify: string | null = null;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--platform" && args[i + 1]) {
      platform = String(args[(i += 1)]);
      platform_assumed = false;
    } else if (a === "--workspace" && args[i + 1]) {
      workspace_root = path.resolve(String(args[(i += 1)]));
    } else if (a === "--classify" && args[i + 1]) {
      classify = String(args[(i += 1)]);
    } else if (a === "--json") {
      json = true;
    } else if (a === "--strict") {
      strict = true;
    } else if (a === "--no-freshness") {
      no_freshness = true;
    }
  }
  const report = collect_report({
    platform,
    platform_assumed,
    workspace_root,
    no_freshness,
    classify,
  });
  if (json) {
    process.stdout.write(`${JSON.stringify(report as unknown as JsonValue, null, 2)}\n`);
  } else {
    process.stdout.write(`${_render(report)}\n`);
  }
  const red =
    report.gates.some((g) => g.status === "ERROR" || g.status === "unregistered") ||
    report.freshness.router === "stale" ||
    report.freshness.projection === "stale";
  return strict && red ? 1 : 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) {
    return false;
  }
  if (process.argv[1] === undefined) {
    return false;
  }
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
    return here === argv1;
  } catch {
    return false;
  }
}

if (_isCliEntry()) {
  process.exit(main());
}
