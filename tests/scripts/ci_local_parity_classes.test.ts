/**
 * The `verify:` lines of `road-to-local-gates-wired-while-they-are-green`.
 *
 * Two kinds of assertion live here, and the split is deliberate.
 *
 * 1. BEHAVIOUR of the two gate scripts the drain repaired. Neither exports
 *    anything — both are CLI entry points — so they are exercised as
 *    subprocesses against fixtures rather than by reaching into internals. A
 *    test that imported a helper would pass while the gate a workflow actually
 *    runs stayed broken.
 *
 * 2. STRUCTURE of the wiring: which gate has a caller, and in which kind of
 *    job. These read the workflow YAML, because "has a pull-request caller" is
 *    a property of the workflow file and of nothing else.
 *
 * `baseline-at-most-143` exists only because the baseline has since moved on a
 * reading from the ENFORCING environment — CI printed 129 and named it. While
 * it had not, this case was deliberately absent: `gate-violation-baselines.json`
 * records a 165 -> 164 lowering attempted and reverted on 2026-08-24 for being
 * taken on a local run, and a test asserting a number nobody had measured
 * remotely would have asserted a hope rather than a fact.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");

function runGate(script: string, args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync(path.join(repoRoot, "scripts-run"), [`src/scripts/${script}`, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/**
 * Where batch 1 ends. Every step after this marker belongs to a later change,
 * so the batch-1 case bounds its slice here instead of at the end of the file.
 */
const DRAIN_BATCH_2_MARKER = "The local-only drain — batch 2";

/**
 * Where step 2.2's first batch begins. Deliberately not "… batch 2a": the
 * marker above is a prefix of that string, and `indexOf` would find it first.
 */
const DRAIN_STEP_2_2_BATCH_A_MARKER = "The local-only drain — step 2.2, first batch";

/**
 * The block a drain batch owns: from its marker to the NEXT drain marker, or to
 * the end of the file when it is the last one. An earlier version sliced 2.2a
 * to the end of the file, which held only while 2.2a was the last batch — the
 * first batch appended after it would have read as 2.2a's extras.
 */
function drainBatch(workflow: string, marker: string): string {
  const start = workflow.indexOf(marker);
  if (start < 0) return "";
  const next = workflow.indexOf("# The local-only drain — ", start + marker.length);
  return workflow.slice(start, next > start ? next : undefined);
}

/**
 * Step 2.2's later batches, each the next twenty of the remaining `wire`-class
 * gates in name order, read from the workflow in both directions exactly as
 * 2.2a is. `check` names the members that are generators and must run their
 * `--check` variant, because without it they rewrite the file they check.
 */
const STEP_2_2_LATER_BATCHES: { id: string; marker: string; gates: string[]; check: string[]; final?: true }[] = [
  {
    id: "2.2b",
    marker: "The local-only drain — step 2.2, second batch (2.2b)",
    gates: [
      "check_skill_requires",
      "check_source_pointer_freshness",
      "check_static_layer_stability",
      "check_structural_breaking",
      "check_surface_tiers",
      "check_test_coverage_diff",
      "check_token_optimizer_freshness",
      "check_tracked_but_ignored",
      "generate_capabilities_index",
      "generate_capability_matrix",
      "generate_command_flows",
      "generate_settings_reference",
      "lint_abstraction_thresholds",
      "lint_agent_skill_names",
      "lint_archived_skills",
      "lint_behavioural_eval_freshness",
      "lint_bench_ab",
      "lint_bench_corpus",
      "lint_breaking_changes_index",
      "lint_changelog_rollback",
    ],
    check: ["generate_capabilities_index", "generate_capability_matrix", "generate_command_flows", "generate_settings_reference"],
  },
  {
    id: "2.2c",
    marker: "The local-only drain — step 2.2, third batch (2.2c)",
    gates: [
      "lint_command_flow_coverage",
      "lint_command_routing",
      "lint_command_verbs",
      "lint_context_spine_usage",
      "lint_discovery_vocabulary",
      "lint_documented_commands",
      "lint_empty_roadmaps",
      "lint_eval_fixture_citations",
      "lint_examples",
      "lint_flows",
      "lint_frontmatter_boilerplate",
      "lint_ghostwriter_source",
      "lint_glama_drift",
      "lint_harvest_provenance",
      "lint_hook_concern_budget",
      "lint_knowledge_scale",
      "lint_load_context",
      "lint_metric_consumers",
      "lint_missions",
      "lint_model_tier_coverage",
    ],
    check: [],
  },
  {
    id: "2.2d",
    marker: "The local-only drain — step 2.2, fourth batch (2.2d)",
    gates: [
      "lint_namespace",
      "lint_namespace_collisions",
      "lint_new_skill_gate",
      "lint_no_activation_gates",
      "lint_no_new_atomic_commands",
      "lint_no_python_twin_rationale",
      "lint_orchestrator_auto_detect",
      "lint_pack_first_win",
      "lint_pack_risk_class",
      "lint_profile_overlay_set_only",
      "lint_profile_personas",
      "lint_provenance",
      "lint_roadmap_complexity",
      "lint_roadmap_family_cap",
      "lint_role_experiences",
      "lint_rule_interactions",
      "lint_rule_skill_pack_reach",
      "lint_showcase_sessions",
      "lint_skill_descriptions",
      "lint_skill_originality",
    ],
    check: [],
  },
  {
    id: "2.2e",
    marker: "The local-only drain — step 2.2, fifth batch (2.2e)",
    gates: [
      "lint_skill_router_head",
      "lint_skill_scripts_readonly",
      "lint_skill_tools",
      "lint_spawn_payload",
      "lint_store_boundary",
      "lint_surface_matrix",
      "lint_ticket_buildable",
      "lint_token_budget_discipline",
      "lint_trigger_precision",
      "lint_ui_stack_bundles",
      "lint_versioned_cache",
      "rebuild_hook_bundle",
      "report_imperative_density",
      "second_brain_retrieval",
      "second_brain_score",
      "validate_agent_settings",
      "validate_decision_engine",
      "validate_flow_teams",
      "validate_reach_prescriptions",
    ],
    check: [],
    final: true,
  },
];

const UNOWNED_WIRED_IN_PHASE_3_2 = ["lint_readme_jargon", "lint_readme_serial_comma", "check_augment_description_cap", "check_token_quality_golden", "check_public_links", "check_council_layout"];

const REQUIRED_EXPERIENCE_FIELDS = [
  "id",
  "scope",
  "trigger_context",
  "strategy",
  "falsifier",
  "confidence",
  "contradictions",
  "supersedes",
  "expiry",
  "epistemic_type",
];

function experienceCard(omit: string | null): string {
  const lines = ["kind: experience"];
  for (const f of REQUIRED_EXPERIENCE_FIELDS) {
    if (f === omit) continue;
    if (f === "trigger_context" || f === "contradictions" || f === "supersedes") {
      lines.push(`${f}:`, "  - a-value");
    } else if (f === "strategy" || f === "falsifier") {
      lines.push(`${f}: >-`, "  a block scalar whose value is on the following line");
    } else {
      lines.push(`${f}: a-value`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n\n# A card\n\nBody.\n`;
}

describe("unowned-gates-wired", () => {
  it("checks an experience card against its own contract, not the external one", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kcards-"));
    try {
      writeFileSync(path.join(dir, "experience-complete.md"), experienceCard(null), "utf8");
      const r = runGate("check_knowledge_cards", ["--dir", dir]);

      // The regression this repairs: C2 and C4 are EXTERNAL-arm checks. A
      // complete experience card declares none of `trust`, `links.authoritative`
      // or `type: anti-hallucination`, and must not be asked for them.
      expect(r.out).not.toMatch(/C4: missing 'trust'/);
      expect(r.out).not.toMatch(/C2:/);
      expect(r.code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("still reports an experience card that omits a field its own contract requires", () => {
    // Sensitivity: dispatching on `kind` must not become "skip the arm". Each
    // required field is omitted in turn and must be named back.
    for (const omitted of REQUIRED_EXPERIENCE_FIELDS) {
      const dir = mkdtempSync(path.join(tmpdir(), "kcards-"));
      try {
        writeFileSync(path.join(dir, "experience-partial.md"), experienceCard(omitted), "utf8");
        const r = runGate("check_knowledge_cards", ["--dir", dir]);
        expect(r.code, `omitting ${omitted} should be a finding`).not.toBe(0);
        expect(r.out).toContain(`experience card missing required '${omitted}' field`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("still runs the ADR-100 global checks on an experience card", () => {
    // The regression an independent review caught, and the reason the arm
    // dispatch returns THROUGH the global block rather than before it. G1–G5
    // ask whether a card may be in the GLOBAL store — tier, sensitivity, the
    // promotion audit trail, and G3's confidential-pattern scan — which is
    // orthogonal to which arm of the union it belongs to. An early return
    // turned `--global` into a green light for a card carrying an email and an
    // internal hostname, and `knowledge_global_cli promote` does not filter on
    // `kind`, so the path is reachable.
    const dir = mkdtempSync(path.join(tmpdir(), "kcards-g3-"));
    try {
      const leaky = experienceCard(null).replace(
        "# A card\n\nBody.",
        "# A card\n\nReach ops@acme-internal.example.com or build-07.internal.",
      );
      writeFileSync(path.join(dir, "leaky.md"), leaky, "utf8");

      const r = runGate("check_knowledge_cards", ["--dir", dir, "--global"]);
      expect(r.code, "a leaky experience card must not pass --global").not.toBe(0);
      expect(r.out).toMatch(/G3: confidential pattern/);
      expect(r.out).toMatch(/internal_hostname/);

      // And the same card without --global is still only an arm check: the G
      // band is about the store, so it must not fire where there is no store.
      const local = runGate("check_knowledge_cards", ["--dir", dir]);
      expect(local.out).not.toMatch(/G3:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats an underscore-prefixed subagent file as a partial, and one really exists", () => {
    const dir = path.join(repoRoot, "src", "subagents");
    const partials = readdirSync(dir).filter((f) => f.startsWith("_") && f.endsWith(".md"));

    // Without this the next assertion is vacuous: a green gate over a directory
    // with no partial in it says nothing about the skip.
    expect(partials.length, "no `_`-prefixed partial in src/subagents").toBeGreaterThan(0);

    // And the partial really is frontmatter-less, which is why the unfiltered
    // lint reported "no parseable frontmatter" against a correct file.
    const body = readFileSync(path.join(dir, partials[0] as string), "utf8");
    expect(body.startsWith("---")).toBe(false);

    expect(runGate("lint_subagent_determinism", []).code).toBe(0);
  });

  it("wires each remaining unowned gate in the required job, after its findings were fixed", () => {
    // Step 3.2's list, minus the two batch 1 already carried
    // (`check_knowledge_cards`, `lint_subagent_determinism`). A gate is added
    // here in the same change that fixes its findings and wires it — never
    // before, because a gate wired while red blocks every pull request.
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
    const rest = workflow.slice(workflow.indexOf(DRAIN_BATCH_2_MARKER));
    expect(workflow.indexOf(DRAIN_BATCH_2_MARKER), "the batch-2 block is missing").toBeGreaterThan(0);

    for (const gate of UNOWNED_WIRED_IN_PHASE_3_2) {
      const re = new RegExp(`^\\s*\\./scripts-run src/scripts/${gate}\\b`, "m");
      expect(re.test(rest), `${gate} has no caller in the required job`).toBe(true);
    }
  });
});

describe("baseline-at-most-143", () => {
  it("lowers the parity ratchet by at least the batch it wired", () => {
    // 163 at the branch base minus the twenty of batch 1 is 143, which is what
    // step 2.1 asks the baseline to be at most. The committed number is 130,
    // because the thirteen `calendar` gates left the set too — 163 - 33 = 130.
    // `check_council_pin_staleness` also gained its first caller here and is
    // NOT among the 33: it ran in no task either, so it was never in this
    // count to leave.
    const baselines = JSON.parse(
      readFileSync(path.join(repoRoot, "src", "config", "gate-violation-baselines.json"), "utf8"),
    ) as { gates: Record<string, { count: number; note: string }> };
    const entry = baselines.gates["ci-parity:local-only"];

    expect(entry, "the parity ratchet has no entry").toBeTruthy();
    expect(entry?.count).toBeLessThanOrEqual(143);

    // A ratchet only turns one way, and this is the assertion that catches a
    // later change quietly handing the gain back.
    expect(entry?.count).toBeLessThan(165);
  });

  it("does not measure MORE violations than the baseline allows", () => {
    // The gate is the falsifier its own entry names, and this asserts exactly
    // one direction of it. `checkRatchet` returns ok when `actual < baseline`
    // too, and `check_ci_local_parity` fails only on `!ok` — so a baseline set
    // too HIGH stays green here, and an earlier version of this comment claimed
    // the green exit meant tree and baseline agree. It does not; it means the
    // tree is no worse than the baseline. An independent review made the point.
    //
    // The over-tight direction is not left unguarded, it is guarded elsewhere:
    // the gate prints `ratchet is loose` and names the number to lower it to,
    // and the case above caps the committed count at 143.
    expect(runGate("check_ci_local_parity", ["--quiet"]).code).toBe(0);
  });
});

describe("generated-docs-checks-wired", () => {
  const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");

  it("runs each generator's --check variant on a pull request", () => {
    for (const gate of ["generate_ownership_matrix", "generate_cookbook", "generate_role_experiences_catalog"]) {
      expect(workflow, `${gate} --check has no caller`).toContain(`src/scripts/${gate} --check`);
    }
  });

  it("never runs a generator's writing variant there", () => {
    // The reading that produced this batch was wrong once in exactly this way:
    // it ran writers instead of checkers and silently modified five tracked
    // files. A writer in a workflow would commit that mistake permanently.
    for (const gate of ["generate_ownership_matrix", "generate_cookbook", "generate_role_experiences_catalog"]) {
      const calls = workflow.match(new RegExp(`src/scripts/${gate}(?! --check)([^\\n]*)`, "g")) ?? [];
      expect(calls, `${gate} is called without --check`).toEqual([]);
    }
  });

  it("keeps the writers that are not NAMED like writers out of both jobs", () => {
    // THE CASE ABOVE MATCHES NAMES, AND A NAME IS NOT A BEHAVIOUR. An
    // independent review made the point with a counter-example this suite had
    // already waved through: `audit_command_surface` is not called
    // `generate_*`, takes a `--check-new` flag that reads like a checker, and
    // writes `agents/reports/command-surface.{json,md}` — two tracked files —
    // unconditionally at the end of its run. It was a step of the scheduled
    // job, and the case above was green.
    //
    // This case is the floor, not a proof: it names the writers that have been
    // CAUGHT, and a writer nobody has caught yet would pass it exactly as that
    // one did. Saying so here is cheaper than implying a coverage this suite
    // does not have — deciding "does this script write a tracked file" in
    // general needs the call graph, not a regex over YAML.
    const canary = readFileSync(path.join(repoRoot, ".github", "workflows", "gate-canary.yml"), "utf8");
    const scheduled = canary.slice(canary.indexOf("local-only-scheduled:"));
    const drain = workflow.slice(workflow.indexOf("The local-only drain — batch 1"));

    for (const writer of ["audit_command_surface"]) {
      const re = new RegExp(`^\\s*\\./scripts-run src/scripts/${writer}\\b`, "m");
      expect(re.test(drain), `${writer} writes tracked files; it must not run in the drain job`).toBe(false);
      expect(re.test(scheduled), `${writer} writes tracked files; it must not run in the scheduled job`).toBe(false);
    }
  });
});

describe("every-wire-class-gate-has-a-workflow-caller", () => {
  it("wires exactly the batch the council bounded, and every one of them is reachable", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
    const start = workflow.indexOf("The local-only drain — batch 1");
    const end = workflow.indexOf(DRAIN_BATCH_2_MARKER);
    const job = workflow.slice(start, end > start ? end : undefined);

    // READ FROM THE WORKFLOW, never from a literal this file also writes. An
    // earlier version of this case asserted `expect(wired).toHaveLength(20)`
    // against a list defined three lines above it, which measures the test and
    // not the job, and it asserted containment in one direction only — so a
    // twenty-first gate added to the job would have gone unnoticed, which is
    // the direction the council's bound actually cares about.
    const actual = new Set(
      [...job.matchAll(/src\/scripts\/([A-Za-z0-9_]+)/g)].map((m) => m[1] as string),
    );

    const expected = [
      "lint_pack_dependencies",
      "check_originality_freshness",
      "check_context_paths",
      "check_suppression_hygiene",
      "runtime_dispatcher",
      "bench_hook_injection",
      "audit_skill_overlap",
      "memory_replay",
      "lint_framework_leakage",
      "check_gate_paths",
      "smoke_quickstart",
      "compile_router",
      "validate_pack_yaml",
      "measure_augment_budget",
      "generate_ownership_matrix",
      "generate_cookbook",
      "generate_role_experiences_catalog",
      "check_knowledge_cards",
      "lint_subagent_determinism",
      "check_trigger_eval_presence",
    ];

    // Both directions. Missing: the batch lost a gate it claims to wire.
    // Extra: the batch grew past the twenty the council bounded, which is the
    // failure the one-directional version could not see.
    const missing = expected.filter((g) => !actual.has(g));
    const extra = [...actual].filter((g) => !expected.includes(g)).sort();
    expect(missing, "expected gates with no caller in the drain job").toEqual([]);
    expect(extra, "gates in the drain job beyond the bounded batch").toEqual([]);
    expect(actual.size, "the council bounded this batch at twenty").toBe(20);

    for (const gate of expected) {
      expect(existsSync(path.join(repoRoot, "src", "scripts", `${gate}.ts`)), `${gate}.ts does not exist`).toBe(true);
    }
  });

  it("wires step 2.2's first batch, exactly, as steps of the same required job", () => {
    // Step 2.2 found 105 `wire`-class gates still without a caller, which the
    // council's bound of twenty a change cannot carry in one pull request, so
    // the roadmap splits it into numbered batches. This is batch 2a. Same
    // both-directions shape as the batch-1 case above, read from the workflow.
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
    expect(workflow.indexOf(DRAIN_STEP_2_2_BATCH_A_MARKER), "the batch-2a block is missing").toBeGreaterThan(0);
    const job = drainBatch(workflow, DRAIN_STEP_2_2_BATCH_A_MARKER);

    const actual = new Set(
      [...job.matchAll(/src\/scripts\/([A-Za-z0-9_]+)/g)].map((m) => m[1] as string),
    );
    const expected = [
      "audit_mcp_tools",
      "check_agent_artifact_location",
      "check_artefact_count_messaging",
      "check_ci_strict_superset",
      "check_cluster_patterns",
      "check_command_count_messaging",
      "check_council_config_location",
      "check_council_references",
      "check_generated_artefact_headers",
      "check_generator_output_coverage",
      "check_gitignore_freshness",
      "check_module_management_neutral",
      "check_no_local_settings_committed",
      "check_no_roadmap_refs",
      "check_one_off_location",
      "check_overlay_cascade_subdirs",
      "check_public_catalog_links",
      "check_reach_channels",
      "check_role_doc_links",
      "check_score_contract",
    ];

    const missing = expected.filter((g) => !actual.has(g));
    const extra = [...actual].filter((g) => !expected.includes(g)).sort();
    expect(missing, "batch-2a gates with no caller in the drain job").toEqual([]);
    expect(extra, "gates in batch 2a beyond the bounded batch").toEqual([]);
    expect(actual.size, "the council bounded a batch at twenty").toBe(20);

    // The one generator-shaped member must run its checking variant: without
    // `--check` it rewrites its inventory file.
    expect(job).toMatch(/src\/scripts\/audit_mcp_tools --check\b/);
  });

  for (const batch of STEP_2_2_LATER_BATCHES) {
    it(`wires step 2.2's batch ${batch.id}, exactly, as steps of the same required job`, () => {
      const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
      expect(workflow.indexOf(batch.marker), `the batch-${batch.id} block is missing`).toBeGreaterThan(0);
      const job = drainBatch(workflow, batch.marker);

      const actual = new Set([...job.matchAll(/src\/scripts\/([A-Za-z0-9_]+)/g)].map((m) => m[1] as string));
      const missing = batch.gates.filter((g) => !actual.has(g));
      const extra = [...actual].filter((g) => !batch.gates.includes(g)).sort();
      expect(missing, `batch-${batch.id} gates with no caller in the drain job`).toEqual([]);
      expect(extra, `gates in batch ${batch.id} beyond the bounded batch`).toEqual([]);
      // Twenty a batch; only the batch that empties the window may hold fewer.
      expect(actual.size, "the council bounded a batch at twenty").toBe(batch.final === true ? batch.gates.length : 20);
      expect(actual.size).toBeLessThanOrEqual(20);

      for (const gate of batch.gates) {
        expect(existsSync(path.join(repoRoot, "src", "scripts", `${gate}.ts`)), `${gate}.ts does not exist`).toBe(true);
      }
      for (const gen of batch.check) {
        expect(job, `${gen} must run its --check variant`).toMatch(new RegExp(`src/scripts/${gen} --check\\b`));
      }
    });
  }

  // The runner has `origin/main` and no local `main`, and these gates' default base
  // is the local name, so dropping the argument fails CI and passes every checkout.
  it.each(["lint_command_verbs", "lint_new_skill_gate", "lint_no_new_atomic_commands"])(
    "hands %s a base the CI checkout has",
    (gate) => {
      const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
      const calls = [...workflow.matchAll(new RegExp(`src/scripts/${gate}\\b[^\\n]*`, "g"))].map((m) => m[0]);
      expect(calls.length, `${gate} has a caller in the drain job`).toBeGreaterThan(0);
      for (const call of calls) expect(call).toMatch(/--baseline origin\/main\b/);
    },
  );

  it("never calls the same gate twice across the drain", () => {
    // Read from the workflow: a gate copied into a second batch would satisfy
    // that batch's exact-set case and cost a second startup for no reading.
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
    const drain = workflow.slice(workflow.indexOf("The local-only drain — batch 1"));
    const calls = [...drain.matchAll(/^\s*\.\/scripts-run src\/scripts\/([A-Za-z0-9_]+)/gm)].map((m) => m[1] as string);
    const dupes = calls.filter((g, i) => calls.indexOf(g) !== i);
    expect(dupes, "gates called more than once in the drain").toEqual([]);
  });

  it("lives in a REQUIRED context, and on a workflow with no paths filter", () => {
    // The roadmap's non-goals say "No new required check. The steps join the
    // job that is already required". An earlier revision of this change put
    // them in a new job on `rule-backstops.yml`, which is neither — a red there
    // is visible and merges anyway.
    //
    // THE RULESET IS EVIDENCE, NOT AN ASSERTION HERE. Read 2026-10-13 from
    // `repos/event4u-app/agent-config/rulesets` (ruleset `main protection`,
    // id 17749383): exactly two required contexts exist, `Sync + Generate Tools
    // Consistency` and `Standing payload delta + budget gate`. A test cannot
    // re-read that without network and auth, so what it pins is the half it
    // CAN see: the job carries the name the ruleset requires, so a rename
    // silently dropping the drain out of the required set fails here.
    const wf = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
    expect(wf).toContain("name: Standing payload delta + budget gate");

    // And no `paths:` filter on its trigger, which is why these gates run on
    // EVERY pull request. Three of them read inputs (`src/flows`, `src/packs`,
    // `AGENTS.md`) that the previously-chosen workflow's filter did not match,
    // so a pull request touching only those started none of the twenty.
    const header = wf.slice(0, wf.indexOf("jobs:"));
    expect(header).toMatch(/pull_request:/);
    expect(header).not.toMatch(/^\s*paths:/m);
  });

  it("runs on pull requests, which is the whole point of the drain", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");
    expect(workflow.slice(0, workflow.indexOf("jobs:"))).toMatch(/pull_request/);
  });
});

describe("calendar-gates-scheduled-not-required", () => {
  const canary = readFileSync(path.join(repoRoot, ".github", "workflows", "gate-canary.yml"), "utf8");
  const backstops = readFileSync(path.join(repoRoot, ".github", "workflows", "standing-payload-delta.yml"), "utf8");

  // The thirteen the reading classed `calendar` — they call `checkRatchet`,
  // where a baseline unchanged for STALE_AFTER_DAYS fails with no diff at all,
  // or they print an `as-of:` verdict line.
  const calendarGates = [
    "check_roadmap_trackable",
    "domain_soundness_status",
    "lint_artefact_frontmatter",
    "lint_handoffs",
    "lint_provenance_vocabulary",
    "lint_roadmap_blockers",
    "lint_roadmap_later_disposition",
    "skill_eval_coverage",
    "check_knowledge_pages",
    "check_reach_staleness",
    "lint_hook_manifest",
    "lint_one_off_age",
    "lint_symptom_intake",
  ];

  it("gives every calendar gate a scheduled caller", () => {
    for (const gate of calendarGates) {
      expect(canary, `${gate} has no scheduled caller`).toContain(`src/scripts/${gate}`);
    }
  });

  it("keeps every calendar gate out of the pull-request drain job", () => {
    const job = backstops.slice(backstops.indexOf("The local-only drain — batch 1"));
    for (const gate of calendarGates) {
      expect(job, `${gate} must not block a pull request`).not.toContain(`src/scripts/${gate}`);
    }
  });

  it("runs the scheduled job on a schedule and never on a pull request", () => {
    const header = canary.slice(0, canary.indexOf("jobs:"));
    expect(header).toMatch(/schedule:/);
    expect(header).not.toMatch(/pull_request/);
  });

  it("gives check_council_pin_staleness the caller it never had", () => {
    expect(canary).toContain("src/scripts/check_council_pin_staleness");
  });

  it("declares that gate ci_only, in the right list, so the other parity direction stays green", () => {
    // This suite went green once while the tree was red on exactly this: giving
    // a gate a CI caller and no local task reds `check_ci_local_parity` in the
    // CI-only direction, and nothing here looked. The list matters as much as
    // the entry — the first attempt put it under `local_only:`, whose growth
    // the 2026-08-13 decision refuses by name, and the checker kept refusing.
    const manifest = readFileSync(path.join(repoRoot, "src", "config", "ci-local-parity.yml"), "utf8");
    const ciOnly = manifest.slice(manifest.indexOf("\nci_only:"), manifest.indexOf("\nlocal_only:"));
    const localOnly = manifest.slice(manifest.indexOf("\nlocal_only:"));

    expect(ciOnly).toContain("id: check_council_pin_staleness");
    expect(localOnly).not.toContain("id: check_council_pin_staleness");

    // The count the decision protects. Seven before this change and seven
    // after; a declaration added to move a number would show up here.
    expect([...localOnly.matchAll(/^ {2}- id: /gm)]).toHaveLength(7);
  });

  it("keeps the one slow gate off the pull-request path, and out of the scheduled one too", () => {
    // It was on the schedule as the `slow`-class member and has been removed:
    // it writes two tracked files whatever flags it is given, so a scheduled
    // run mutated its tree to compute an answer it then discarded. It stays in
    // the local-only backlog with its class recorded until it grows a
    // `--check`-shaped mode. Asserted in both directions so the removal cannot
    // be quietly undone in either job.
    const job = backstops.slice(backstops.indexOf("The local-only drain — batch 1"));
    const scheduled = canary.slice(canary.indexOf("local-only-scheduled:"));
    const call = /^\s*\.\/scripts-run src\/scripts\/audit_command_surface\b/m;
    expect(call.test(job)).toBe(false);
    expect(call.test(scheduled)).toBe(false);
  });

  it("runs the scheduled gates in their own job, not beside the canary", () => {
    // `check_gate_coverage --canary` plants a declared violation per gate and
    // removes it in a `finally`. A gate sharing that job would read a planted
    // tree, or one a failed `finally` left dirty.
    expect(canary).toMatch(/^ {2}local-only-scheduled:/m);
    const scheduled = canary.slice(canary.indexOf("local-only-scheduled:"));
    expect(scheduled).not.toContain("--canary");
  });
});
