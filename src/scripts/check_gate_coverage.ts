#!/usr/bin/env tsx
/**
 * Meta-gate: verify that the repo's gates actually inspect something.
 *
 * A gate that scans nothing exits 0 and certifies coverage that does not exist.
 * That is strictly worse than having no gate, because the green is believed. On
 * 2026-07-29 a sweep found three such gates in CI, each pointing at a tree
 * emptied by the ADR-051 flat-`src/` migration; one of them printed the literal
 * count `0` in its own output for as long as it was broken.
 *
 * This guard reads `src/config/gate-coverage.yml`, runs each listed gate with the
 * CI-identical arguments declared there, reads the `scanned: <N>` line the gate
 * emits, and fails when N falls below the declared floor.
 *
 * Three design rules, each traceable to a concrete failure — see the manifest
 * header for the full rationale:
 *   1. Gates emit a machine-readable count; the guard never parses human output.
 *   2. Invocations mirror CI exactly (a bare probe produced a false alarm during
 *      the sweep).
 *   3. The check is a baseline floor, not `> 0` (428 → 3 is also a collapse).
 *
 * Self-honesty: this guard must not become the thing it catches. It fails when
 * the manifest is empty or unreadable, and it REPORTS `pending` gates (listed but
 * not yet emitting a count) instead of skipping them silently.
 *
 * MUTATION CANARY (`--canary`, road-to-gates-that-can-fail Phase 7). Coverage
 * proves a gate READ something; it cannot prove the gate can still FAIL. The
 * canary plants one declared violation per gate, runs the gate, and records
 * red/green — a gate that stays green over a real planted defect is dead by
 * definition. It runs the same contract as the review-side canary in
 * `docs/contracts/adversarial-review-protocol.md` § 6 (rotating class, sealed
 * record, NEVER SHIPS) and is deliberately kept OFF the default CI path: it
 * mutates the tree, so it is an operator-invoked biannual experiment, not a
 * per-PR gate. Every plant is reverted in a `finally`.
 *
 * CLI:
 *   ./scripts-run src/scripts/check_gate_coverage            # enforce
 *   ./scripts-run src/scripts/check_gate_coverage --list     # show the manifest
 *   ./scripts-run src/scripts/check_gate_coverage --format json
 *   ./scripts-run src/scripts/check_gate_coverage --canary [--ledger <file>]
 *
 * Exit codes: 0 all enforced gates cleared their floor · 1 a gate is blind,
 * collapsed, or silent (in `--canary`: a gate stayed green, or the ledger
 * disagrees with the census) · 2 the manifest itself is missing/empty/malformed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';
import { asOf } from './_lib/as_of.js';
import { checkRatchet } from './_lib/gate_baseline.js';
import { GateLedger, type GateSkipReason } from './_lib/gate_ledger.js';
import { runCountedProbe } from './_lib/counted_probe.js';
import { listGateScripts } from './_lib/gate_population.js';
import { describeOutcome, namesEstateInvalidatingError } from './_lib/gate_result.js';
import { assertScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src/config/gate-coverage.yml');
const CENSUS = path.join(REPO_ROOT, 'agents/evidence/reports/gate-scope-census.md');

/** The one line a gate must emit. Deliberately narrow: no format guessing. */
const SCANNED_RE = /^\s*scanned:\s*(\d+)\s*$/m;

/**
 * A declared, revertible violation for one gate (Phase 7).
 *
 * Only ONE operation shape exists on purpose: create a file that does not exist,
 * delete it afterwards. An in-place edit would need byte-exact restoration of a
 * tracked file, and a canary that can corrupt the tree is worse than no canary —
 * the contract's "never ships" rule binds this implementation too.
 */
export interface CanarySpec {
  /** Rotating-class label, per adversarial-review-protocol § 6. */
  class: string;
  /** Repo-relative path to create. MUST NOT already exist. */
  path: string;
  /** File body planted at that path. */
  content: string;
}

export interface GateSpec {
  id: string;
  argv: string[];
  min_scanned: number;
  corpus: string;
  status: 'enforced' | 'pending';
  /** Absent = this gate has no canary recipe; reported, never hidden. */
  canary?: CanarySpec;
  /**
   * Why this entry has no `canary:` recipe — REQUIRED when one is absent.
   *
   * The measurement that forced this field: over 44 enforced entries, only
   * 20 of 44 by a wide detector (and 13 by a narrow one) can be invoked over an
   * injected path at all, so a non-mutating in-memory negative-control mode
   * would cover under half the manifest. Rather than build a per-PR step named
   * "negative controls" that exercises a minority, the gap is REPORTED — and a
   * reported gap is only honest if every row carries its reason. A silently
   * absent row reads as coverage, which is the exact failure this whole file
   * exists to prevent, one level up.
   */
  no_canary_reason?: string;
  /**
   * Exit code meaning "my prerequisite is absent, so I inspected nothing" — e.g.
   * check_site_links exits 2 when the site is unbuilt or stale. Without this the
   * guard reads that as `silent` and fails, which would make it red on every machine
   * lacking a build artefact: a gate that blocks for an environmental reason teaches
   * people to ignore it, which is worse than no gate. Reported as `unavailable`
   * rather than skipped, so the partial coverage stays visible — the same reason
   * `pending` is reported instead of hidden.
   */
  unavailable_exit?: number;
  /**
   * Repo-relative workflow file this row's `argv` is pinned to.
   *
   * Rule 2 of this manifest — CI-IDENTICAL INVOCATION — was an instruction to
   * the author and nothing else: the guard runs whatever `argv` says and never
   * looked at how CI calls the gate, so a row could drift from its workflow, or
   * the workflow step could be deleted outright, and this file would keep
   * reporting healthy coverage for a gate CI no longer runs.
   *
   * Opt-in per row, because most gates here have several CI invocations with
   * different arguments and one `argv` cannot be identical to all of them. Where
   * a row DOES name a workflow, that workflow must contain an invocation of the
   * gate whose argument list equals `argv` exactly.
   */
  ci_invocation?: string;
  note?: string;
}

export type Verdict =
  | 'ok'
  | 'below_floor'
  | 'silent'
  | 'crashed'
  | 'estate_invalid'
  | 'pending'
  | 'unavailable';

export interface GateResult {
  id: string;
  status: GateSpec['status'];
  verdict: Verdict;
  scanned: number | null;
  min_scanned: number;
  message: string;
}

function _require_str(v: unknown, field: string, id: string, i: number): string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`gates[${String(i)}] (${id}): ${field} must be a non-empty string`);
  }
  return v;
}

function _require_int(v: unknown, id: string, i: number): number {
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new Error(`gates[${String(i)}] (${id}): unavailable_exit must be an integer exit code`);
  }
  return n;
}

/** Parse + validate the manifest. Throws on anything that would make the guard
 * silently vacuous — an empty gate list is a hard error, not an empty pass. */
export function load_manifest(file = MANIFEST): GateSpec[] {
  if (!fs.existsSync(file)) {
    throw new Error(`manifest not found: ${path.relative(REPO_ROOT, file)}`);
  }
  const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as { gates?: unknown[] };
  const raw = Array.isArray(doc?.gates) ? doc.gates : [];
  if (raw.length === 0) {
    throw new Error('manifest declares zero gates — a coverage guard over an empty set is vacuous');
  }
  return raw.map((entry, i) => {
    const e = entry as Record<string, unknown>;
    const id = String(e['id'] ?? '');
    if (id === '') throw new Error(`gates[${i}]: missing id`);
    const min = Number(e['min_scanned']);
    if (!Number.isInteger(min) || min < 0) {
      throw new Error(`gates[${i}] (${id}): min_scanned must be a non-negative integer`);
    }
    if (
      String(e['status'] ?? 'enforced') === 'enforced' &&
      e['canary'] === undefined &&
      e['no_canary_reason'] === undefined
    ) {
      throw new Error(
        `gates[${String(i)}] (${id}): an enforced entry with no 'canary:' recipe must carry ` +
          `'no_canary_reason:' — a silently absent negative control reads as coverage`,
      );
    }
    const status = String(e['status'] ?? 'enforced');
    if (status !== 'enforced' && status !== 'pending') {
      throw new Error(`gates[${i}] (${id}): status must be 'enforced' or 'pending'`);
    }
    return {
      id,
      argv: Array.isArray(e['argv']) ? e['argv'].map(String) : [],
      min_scanned: min,
      corpus: String(e['corpus'] ?? ''),
      status,
      ...(e['unavailable_exit'] === undefined
        ? {}
        : { unavailable_exit: _require_int(e['unavailable_exit'], id, i) }),
      ...(e['ci_invocation'] === undefined
        ? {}
        : { ci_invocation: _require_str(e['ci_invocation'], 'ci_invocation', id, i) }),
      ...(e['note'] === undefined ? {} : { note: String(e['note']) }),
      ...(e['canary'] === undefined ? {} : { canary: _require_canary(e['canary'], id, i) }),
      ...(e['no_canary_reason'] === undefined
        ? {}
        : { no_canary_reason: _require_str(e['no_canary_reason'], 'no_canary_reason', id, i) }),
    };
  });
}

function _require_canary(v: unknown, id: string, i: number): CanarySpec {
  const c = v as Record<string, unknown>;
  const cls = String(c?.['class'] ?? '');
  const p = String(c?.['path'] ?? '');
  const content = String(c?.['content'] ?? '');
  // A half-declared recipe would plant nothing and read as a passing canary —
  // the exact false green this whole file exists to prevent.
  if (cls === '' || p === '' || content === '') {
    throw new Error(`gates[${String(i)}] (${id}): canary needs class, path and content`);
  }
  if (path.isAbsolute(p) || p.split('/').includes('..')) {
    throw new Error(`gates[${String(i)}] (${id}): canary path must be repo-relative and contain no '..'`);
  }
  return { class: cls, path: p, content };
}

/** Extract the contract line. Returns null when the gate emitted no count. */
export function parse_scanned(output: string): number | null {
  const m = SCANNED_RE.exec(output);
  return m === null ? null : Number(m[1]);
}

/**
 * Map a gate verdict onto its ledger outcome.
 *
 * Extracted and exported so the mapping can be PINNED — it was inline, and the
 * completion review's three sharpest findings were all mis-mappings that a
 * discrimination test would have caught in one line each.
 *
 * The split is INSPECTED vs NOT INSPECTED, never pass vs fail. `fail` counts
 * into the ledger's `scanned=` (`report()` sets `checked = completed + failed`),
 * so a target that could not be READ must never land there — that inflates the
 * exact number the library exists to make trustworthy. This file's own comment
 * already says a gate that could not MEASURE "is not a gate that found
 * violations, and it is not a gate that passed either"; this agrees with it.
 */
export function ledgerOutcomeFor(
  verdict: GateResult['verdict'],
): 'complete' | 'fail' | GateSkipReason {
  switch (verdict) {
    case 'pending':
      return 'disabled_by_configuration';
    case 'unavailable':
      // NOT `missing_credentials`. The only manifest row carrying
      // `unavailable_exit` is unavailable for an unbuilt `site/dist`, and the
      // skip sentence IS the audit surface — naming a credential would send the
      // reader hunting an unset token instead of running the build.
      return 'no_applicable_files';
    case 'crashed':
      // NOT `dead_scan_root` — a gate that threw has no dead root, and the skip
      // sentence would send the reader to check a scan path that is fine. The
      // vocabulary was extended rather than approximated, same reasoning as the
      // `unavailable` case above.
      return 'check_did_not_run';
    case 'estate_invalid':
      // Nothing was read here either. `crashed` still reds the build through
      // this gate's own filter and `estate_invalid` deliberately does not, but
      // neither belongs in the inspected count.
      return 'dead_scan_root';
    case 'silent':
    case 'below_floor':
      return 'fail';
    case 'ok':
      return 'complete';
    default: {
      // Exhaustiveness guard. A `Verdict` member added later must be classified
      // deliberately: without this, a new member would silently count as
      // INSPECTED and both the switch and its test would stay green —
      // re-creating the over-report this function was extracted to pin.
      const unhandled: never = verdict;
      throw new Error(`ledgerOutcomeFor: unhandled verdict ${String(unhandled)}`);
    }
  }
}

/** Classify one gate's run against its declared floor. Pure — testable without
 * spawning anything. */
export function classify(
  spec: GateSpec,
  scanned: number | null,
  crashed: boolean,
  exit_code?: number | null,
  output = '',
): GateResult {
  const base = { id: spec.id, status: spec.status, scanned, min_scanned: spec.min_scanned };
  if (spec.status === 'pending') {
    return {
      ...base,
      verdict: 'pending',
      message:
        scanned === null
          ? `not yet emitting 'scanned:' — listed as pending, NOT enforced (coverage gap is visible, not hidden)`
          : `reports ${String(scanned)}; floor ${String(spec.min_scanned)} not enforced while pending`,
    };
  }
  if (crashed) {
    return { ...base, verdict: 'crashed', message: 'gate could not be executed' };
  }
  // A gate that could not MEASURE is not a gate that found violations, and it
  // is not a gate that passed either. Reporting it as itself is the whole point:
  // three of this repository's recorded traps are estate invalidation
  // misreported as a per-gate red, sending a contributor hunting for a
  // violation that does not exist.
  if (namesEstateInvalidatingError(output)) {
    return {
      ...base,
      verdict: 'estate_invalid',
      message: describeOutcome(spec.id, 'estate_invalid'),
    };
  }
  if (
    spec.unavailable_exit !== undefined &&
    exit_code !== undefined &&
    exit_code !== null &&
    exit_code === spec.unavailable_exit
  ) {
    return {
      ...base,
      verdict: 'unavailable',
      message:
        `exited ${String(exit_code)} — prerequisite absent, nothing inspected. ` +
        `Coverage unverified here; CI is where this gate has its inputs`,
    };
  }
  if (scanned === null) {
    return {
      ...base,
      verdict: 'silent',
      message: `emitted no 'scanned: <N>' line — an enforced gate must report what it inspected`,
    };
  }
  if (scanned < spec.min_scanned) {
    return {
      ...base,
      verdict: 'below_floor',
      message:
        `scanned ${String(scanned)}, floor ${String(spec.min_scanned)} (${spec.corpus}) — ` +
        `a gate inspecting this little cannot certify the corpus`,
    };
  }
  return { ...base, verdict: 'ok', message: `scanned ${String(scanned)} ≥ ${String(spec.min_scanned)}` };
}

function run_gate(spec: GateSpec): {
  scanned: number | null;
  crashed: boolean;
  exit_code: number | null;
  output: string;
} {
  const runner = path.join(REPO_ROOT, 'scripts-run');
  // Bounded read: a gate whose output overflowed would lose its `scanned:`
  // line and be classified `silent` — the scan-scope guard reporting a dead
  // scope that is merely truncated. `runCountedProbe` throws instead.
  const r = runCountedProbe(runner, [`src/scripts/${spec.id}`, ...spec.argv], { cwd: REPO_ROOT });
  const output = `${r.stdout}\n${r.stderr}`;
  if (r.failure !== null && r.status === null)
    return { scanned: null, crashed: true, exit_code: null, output };
  // A gate may legitimately exit non-zero (it found real violations) and still
  // have scanned plenty — coverage and verdict are different questions.
  return { scanned: parse_scanned(output), crashed: false, exit_code: r.status, output };
}

const ICON: Record<Verdict, string> = {
  ok: '✅',
  below_floor: '❌',
  silent: '❌',
  crashed: '❌',
  estate_invalid: '❌',
  pending: '⚠️',
  unavailable: '⚠️',
};

/**
 * Report which enforced gates carry a negative control and which do not.
 *
 * OBSERVABILITY, NEVER PROOF — and the distinction is the whole point of the
 * wording below. A `canary:` recipe DECLARED is not a recipe RUN: the mutating
 * `--canary` path plants a real file and is deliberately off the per-PR
 * workflow, so on a normal PR the "with recipe" number describes what COULD be
 * exercised, not what was. Reporting it as though it were coverage would be the
 * inflation this file exists to prevent, one level up from where it prevents it.
 *
 * The two populations are reported separately on purpose: whether a gate can be
 * invoked over an injected path and whether it has a recipe are different facts,
 * and an earlier draft of this work conflated them.
 */
function report_negative_control_inventory(specs: readonly GateSpec[]): void {
  const enforced = specs.filter((s) => s.status === 'enforced');
  const withRecipe = enforced.filter((s) => s.canary !== undefined);
  const without = enforced.filter((s) => s.canary === undefined);
  process.stdout.write(
    `\nnegative controls: ${String(withRecipe.length)} of ${String(enforced.length)} enforced ` +
      `entries carry a \`canary:\` recipe · ${String(without.length)} do not\n`,
  );
  // The arithmetic is the guard against skimming: two numbers that reconcile
  // against the enforced total cannot be read as "all of them checked".
  process.stdout.write(
    `  ⚠️  declared, not run — the mutating --canary path is operator-invoked and off the per-PR workflow, ` +
      `so no negative control ran here.\n`,
  );
  for (const s of without) {
    process.stdout.write(`  · ${s.id}: ${s.no_canary_reason ?? '(no reason recorded)'}\n`);
  }
}

/**
 * Invocations of `src/scripts/<id>` in a workflow, each as its argument list.
 *
 * Deliberately a text scan rather than a YAML walk: an invocation lives inside a
 * `run:` block scalar, so parsing the workflow buys nothing and costs the ability
 * to see a call split across a line continuation, which is how the release job
 * writes this very gate. Backslash-newline joins are folded before matching for
 * that reason.
 */
export function ci_invocations(workflowText: string, id: string): string[][] {
  const folded = workflowText.replace(/\\\n\s*/gu, ' ');
  const out: string[][] = [];
  const re = new RegExp(String.raw`src/scripts/${id}(?![A-Za-z0-9_])([^\n]*)`, 'gu');
  for (const m of folded.matchAll(re)) {
    out.push(
      (m[1] ?? '')
        .trim()
        .split(/\s+/u)
        .filter((t) => t !== ''),
    );
  }
  return out;
}

/**
 * The row's `argv` must be reproducible from the workflow it pins.
 *
 * Both directions are failures and they are different defects: no matching
 * invocation means the manifest probes the gate in a way CI does not (or CI
 * stopped calling it at all), which is the drift rule 2 asks for and nothing
 * enforced.
 */
export function ci_invocation_problem(
  workflowText: string,
  id: string,
  argv: readonly string[],
): string | null {
  const found = ci_invocations(workflowText, id);
  if (found.length === 0) {
    return `no invocation of src/scripts/${id} — the workflow does not call this gate`;
  }
  const want = argv.join(' ');
  if (found.some((a) => a.join(' ') === want)) {
    return null;
  }
  return (
    `argv [${want}] matches no invocation there; the workflow calls it as ` +
    found.map((a) => `[${a.join(' ')}]`).join(', ')
  );
}

/** Rows whose `ci_invocation` no longer describes their workflow. */
export function ci_invocation_drift(specs: readonly GateSpec[], repoRoot = REPO_ROOT): string[] {
  const problems: string[] = [];
  for (const s of specs) {
    if (s.ci_invocation === undefined) continue;
    const file = path.join(repoRoot, s.ci_invocation);
    if (!fs.existsSync(file)) {
      problems.push(`${s.id}: ci_invocation ${s.ci_invocation} does not exist`);
      continue;
    }
    const problem = ci_invocation_problem(fs.readFileSync(file, 'utf-8'), s.id, s.argv);
    if (problem !== null) problems.push(`${s.id}: ${s.ci_invocation} — ${problem}`);
  }
  return problems;
}

export function main(argv: readonly string[]): number {
  const wantJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
  const listOnly = argv.includes('--list');

  let specs: GateSpec[];
  try {
    specs = load_manifest();
    // This guard's own scan scope is the manifest. It already refused an empty
    // gate list ("a coverage guard over an empty set is vacuous"), but as a
    // bespoke throw — invisible to the very population test below, which is how
    // the meta-gate ended up outside its own definition of hardened. Routing the
    // same condition through the shared assertion is the honest fix: no new
    // behaviour, one shape for "this gate read nothing".
    assertScanned({
      gate: 'check_gate_coverage',
      scanned: specs.length,
      units: 'manifest gate(s)',
      roots: [path.relative(REPO_ROOT, MANIFEST)],
    });
  } catch (e) {
    process.stderr.write(`❌  gate-coverage manifest: ${(e as Error).message}\n`);
    return 2;
  }

  if (argv.includes('--canary')) {
    return run_canary_mode(specs, argv);
  }

  if (listOnly) {
    for (const s of specs) {
      process.stdout.write(
        `  ${s.status === 'enforced' ? '[enforced]' : '[pending] '} ${s.id} ` +
          `argv=[${s.argv.join(' ')}] floor=${String(s.min_scanned)}\n`,
      );
    }
    process.stdout.write(`scanned: ${String(specs.length)}\n`);
    return 0;
  }

  // Per-target accounting over the manifest rows. The gate that audits gate
  // coverage was itself unaudited.
  //
  // Stated precisely, because the obvious justification overstates it: this gate
  // ALREADY prints counted `pending N · unavailable N` warnings, so those two
  // classes were not invisible. What the ledger adds is that they are expressed
  // in the estate-wide vocabulary every other adopter uses, so a reader
  // comparing gates does not have to learn this one's private status names — and
  // that `crashed` and `estate_invalid`, which had no counted line at all, stop
  // being counted as inspected.
  //
  // Note the two numbers this produces in one run: the ledger's `scanned=` (what
  // was inspected) and the contract line `scanned:` (manifest rows read). They
  // differ by the skips and that is correct, but only the latter is what
  // `SCANNED_RE` parses.
  const ledger = new GateLedger('check_gate_coverage');
  // Deduplicated on purpose. `load_manifest` does not check id uniqueness, and a
  // copy-pasted row with a forgotten rename would otherwise make `plan()` throw
  // an uncaught LedgerUsageError — surfacing a manifest mistake as a stack trace
  // and Node's exit 1, which this file's own contract reads as "a gate is blind,
  // collapsed, or silent" rather than as the exit 2 a malformed manifest earns.
  // The duplicate still runs twice and still prints twice; only the accounting
  // refuses to double-count it.
  ledger.plan([...new Set(specs.map((s) => s.id))]);

  const results = specs.map((s) => {
    if (spec_is_pending(s)) {
      const { scanned, crashed } = probe_pending(s);
      return classify(s, scanned, crashed);
    }
    const { scanned, crashed, exit_code, output } = run_gate(s);
    return classify(s, scanned, crashed, exit_code, output);
  });

  // `recorded` pairs with the deduplicated plan above: a duplicated manifest id
  // must be accounted once, and recording it twice would raise the same
  // LedgerUsageError the dedupe exists to avoid.
  const recorded = new Set<string>();
  for (const r of results) {
    if (recorded.has(r.id)) continue;
    recorded.add(r.id);
    const outcome = ledgerOutcomeFor(r.verdict);
    if (outcome === 'complete') ledger.complete(r.id);
    else if (outcome === 'fail') ledger.fail(r.id, r.message);
    else ledger.skip(r.id, outcome);
  }
  ledger.report();

  if (wantJson) {
    process.stdout.write(`${JSON.stringify({ generated_by: 'check_gate_coverage', results }, null, 2)}\n`);
  } else {
    for (const r of results) {
      process.stdout.write(`  ${ICON[r.verdict]} ${r.id}: ${r.message}\n`);
    }
  }

  const failed = results.filter((r) => r.verdict === 'below_floor' || r.verdict === 'silent' || r.verdict === 'crashed');
  const pending = results.filter((r) => r.verdict === 'pending');
  const unavailable = results.filter((r) => r.verdict === 'unavailable');

  // The guard reports its OWN coverage. Hiding a pending gate behind a green
  // summary is exactly the failure mode this file exists to prevent.
  process.stdout.write(
    `\nscanned: ${String(results.length)}\n` +
      `  enforced ${String(results.length - pending.length)} · pending ${String(pending.length)} · ` +
      `unavailable ${String(unavailable.length)} · failing ${String(failed.length)}\n`,
  );
  if (unavailable.length > 0) {
    process.stdout.write(
      `⚠️  ${String(unavailable.length)} gate(s) could not run here (prerequisite absent) — ` +
        `their coverage is unverified locally, not proven.\n`,
    );
  }
  if (pending.length > 0) {
    process.stdout.write(
      `⚠️  ${String(pending.length)} gate(s) are listed but NOT enforced — this guard's coverage is partial by declaration.\n`,
    );
  }
  report_negative_control_inventory(specs);
  const drift = ci_invocation_drift(specs);
  for (const d of drift) {
    process.stdout.write(`  ❌ ${d}\n`);
  }
  const hardening = report_hardening_ratchet();
  const selfTest = report_self_test_ratchet();
  if (failed.length > 0) {
    process.stdout.write(`❌  ${String(failed.length)} gate(s) failed the coverage floor.\n`);
    return 1;
  }
  if (drift.length > 0) {
    process.stdout.write(
      `❌  ${String(drift.length)} row(s) declare a ci_invocation their workflow no longer matches — ` +
        `the manifest probes the gate differently from CI, or CI stopped calling it.\n`,
    );
    return 1;
  }
  if (hardening !== 0) {
    return hardening;
  }
  if (selfTest !== 0) {
    return selfTest;
  }
  process.stdout.write('✅  every enforced gate cleared its coverage floor.\n');
  return 0;
}

/**
 * Vulnerability ratchet — the count that must not RISE.
 *
 * This deliberately measures **defect exposure**, not adoption reach. A
 * coverage-percentage ratchet ("hardened gates must increase") would be
 * threshold-lowering in a ratchet's clothes: it tracks how far the fix has
 * spread and can never regress, so it grades the solution instead of the
 * problem. The number below is the opposite — how many gates could still exit 0
 * over a moved root without saying so. It CAN regress (every new gate written
 * without a scope assertion raises it) and the target stays 0.
 *
 * Recorded via the existing violation ratchet (`_lib/gate_baseline.ts`), so the
 * 56-day non-stagnation clause applies unchanged: a count that never drops
 * fails, because a frozen baseline is suppression with extra steps.
 */
export function report_hardening_ratchet(): number {
  const unhardened = list_unhardened_gates();
  const verdict = checkRatchet({
    gate: 'gate-hardening:unhardened-scan-scope',
    actual: unhardened.length,
    repoRoot: REPO_ROOT,
  });
  process.stdout.write(`  ${verdict.ok ? '✅' : '❌'} ${verdict.message}\n`);
  return verdict.ok ? 0 : 1;
}

/**
 * Registered gates that carry no `--self-test` and no exemption — the count
 * that must not RISE.
 *
 * `_lib/gate_self_test.ts` proves a gate DISCRIMINATES: it drives the real
 * binary through cases that must reject and cases that must accept, with a
 * `minRejectCases` floor so an all-accepting suite cannot satisfy it. A gate
 * that emits an enforced `scanned:` count has proven it read something; only a
 * self-test proves the reading changes the verdict.
 *
 * ## Why this is a NON-ADOPTER count and not an adoption column
 *
 * The roadmap item asked for adoption as a column in `gate-coverage.yml`,
 * ratcheted upward. That is the exact shape `report_hardening_ratchet` above
 * rejects in this same file — a coverage-percentage ratchet "tracks how far the
 * fix has spread and can never regress, so it grades the solution instead of
 * the problem". Inverting it fixes that: the number below can regress (a new
 * registered gate written without a self-test raises it), and the target is 0.
 * That is also the shape the sibling adoption ratchet already uses —
 * `check_gate_completeness`'s ledger baseline is a shrink-only count of
 * non-adopters, not a rising percentage.
 *
 * Population is the MANIFEST, not every script under `src/scripts`: a self-test
 * is a claim about a gate CI runs against a floor. Padding the manifest to move
 * this number would add a floor per row, which is the opposite of gaming.
 *
 * Exemption marker: `// self-test-exempt: <reason>` with a non-empty reason. A
 * bare marker does not count — same discipline as `// no-index:` and
 * `// ledger-exempt:`.
 */
export function list_self_test_non_adopters(
  dir = path.join(REPO_ROOT, 'src/scripts'),
  ids: ReadonlySet<string> = enforced_manifest_ids(),
): string[] {
  const out: string[] = [];
  for (const id of [...ids].sort()) {
    let src: string;
    try {
      src = fs.readFileSync(path.join(dir, `${id}.ts`), 'utf8');
    } catch {
      // A registered id with no readable script cannot prove discrimination.
      out.push(id);
      continue;
    }
    const adopts = /_lib\/gate_self_test\.js/.test(src);
    const exempt = /\/\/\s*self-test-exempt:\s*\S/.test(src);
    if (!adopts && !exempt) out.push(id);
  }
  return out;
}

/** Ratchet wrapper for {@link list_self_test_non_adopters}. */
export function report_self_test_ratchet(): number {
  const missing = list_self_test_non_adopters();
  const verdict = checkRatchet({
    gate: 'gate-self-test:registered-non-adopters',
    actual: missing.length,
    repoRoot: REPO_ROOT,
  });
  process.stdout.write(`  ${verdict.ok ? '✅' : '❌'} ${verdict.message}\n`);
  return verdict.ok ? 0 : 1;
}

/**
 * Manifest ids whose `scanned:` line is actually ENFORCED against a floor.
 *
 * A `pending` entry, or an enforced one with `min_scanned: 0`, reads the line
 * without being able to fail on it — so it cannot make a gate hardened either.
 * Read best-effort: an unreadable manifest yields an empty set, which pushes
 * every emit-only gate back into the unhardened count. That direction is
 * deliberate — a coverage guard that cannot read its own manifest should
 * over-report exposure, never under-report it.
 */
export function enforced_manifest_ids(file = MANIFEST): Set<string> {
  try {
    return new Set(
      load_manifest(file)
        .filter((s) => s.status === 'enforced' && s.min_scanned >= 1)
        .map((s) => s.id),
    );
  } catch {
    return new Set<string>();
  }
}

/**
 * Gate scripts that neither assert their scan scope nor publish an ENFORCED
 * count — the population still able to report success over an empty corpus.
 *
 * ```
 * hardened ⇔ routes through _lib/scan_scope
 *          ∨ (emits `scanned:` ∧ registered enforced in gate-coverage.yml with a floor)
 * ```
 *
 * The second clause used to be a bare "emits `scanned:`". Measured 2026-08-04
 * while chartering the conversion of the remaining 189: a printed count is only
 * a *guard* for the gates this file actually runs against a floor. For an
 * unregistered gate the line is decoration — it can print `scanned: 0` out of a
 * deleted root and still exit 0, with nobody reading it. That made the cheapest
 * route to a green ratchet (add one write per gate) also the route that changes
 * nothing, while "pad the manifest" is an explicit non-goal of the conversion
 * roadmap. Requiring registration closes the loop: to harden by emitting you
 * must accept a floor, and everything else asserts.
 *
 * The tightening cost the existing population nothing — all 14 emit-only gates
 * were already registered enforced — which is why it is a drift repair against
 * this guard's own charter ("asserts its scan scope … or carries a justified
 * `allowEmpty`") rather than a moved goalpost.
 */
export function list_unhardened_gates(
  dir = path.join(REPO_ROOT, 'src/scripts'),
  registered: ReadonlySet<string> = enforced_manifest_ids(),
): string[] {
  const out: string[] = [];
  for (const id of listGateScripts(dir, (d) => fs.readdirSync(d))) {
    let src: string;
    try {
      src = fs.readFileSync(path.join(dir, `${id}.ts`), 'utf8');
    } catch {
      continue;
    }
    const asserts = /assertScanned\(|assertWatchlistResolves\(|reportScanned\(/.test(src);
    const emits = /(?:process\.(?:stdout|stderr)\.write|lines\.push)\(\s*`scanned: /.test(src);
    if (!asserts && !(emits && registered.has(id))) out.push(id);
  }
  return out.sort();
}

function spec_is_pending(s: GateSpec): boolean {
  return s.status === 'pending';
}

/** Pending gates are still probed (so the report shows what they currently do),
 * but their count never fails the build. */
function probe_pending(s: GateSpec): { scanned: number | null; crashed: boolean } {
  return run_gate(s);
}

// ── Mutation canary (Phase 7) ──────────────────────────────────────────────

export type CanaryVerdict = 'red' | 'green' | 'no_recipe' | 'crashed';

export interface CanaryResult {
  id: string;
  verdict: CanaryVerdict;
  class: string | null;
  exit_code: number | null;
  message: string;
}

/**
 * Plant one declared violation, run the gate, revert.
 *
 * The revert is in a `finally` and deletes exactly the file this function
 * created — never a pre-existing one, which is why an occupied path aborts
 * instead of overwriting.
 */
export function run_canary(spec: GateSpec, repoRoot = REPO_ROOT): CanaryResult {
  const c = spec.canary;
  if (c === undefined) {
    return {
      id: spec.id,
      verdict: 'no_recipe',
      class: null,
      exit_code: null,
      message: 'no canary recipe declared — this gate is UNPROVEN, not proven working',
    };
  }
  const abs = path.join(repoRoot, c.path);
  if (fs.existsSync(abs)) {
    return {
      id: spec.id,
      verdict: 'crashed',
      class: c.class,
      exit_code: null,
      message: `canary path ${c.path} already exists — refusing to overwrite a real file`,
    };
  }
  let planted = false;
  // Directories the plant had to create. An empty `src/skills/<x>/` left behind
  // is invisible to `git status` but is still residue, and a skill directory
  // with no SKILL.md is itself a defect the next gate run would report.
  const madeDirs: string[] = [];
  for (let d = path.dirname(abs); !fs.existsSync(d) && d.startsWith(repoRoot); d = path.dirname(d)) {
    madeDirs.push(d);
  }
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, c.content, 'utf8');
    planted = true;
    const runner = path.join(repoRoot, 'scripts-run');
    const r = runCountedProbe(runner, [`src/scripts/${spec.id}`, ...spec.argv], { cwd: repoRoot });
    if (r.failure !== null && r.status === null) {
      return {
        id: spec.id,
        verdict: 'crashed',
        class: c.class,
        exit_code: null,
        message: `gate could not be executed under the plant: ${r.failure}`,
      };
    }
    const code = r.status ?? 0;
    return code !== 0
      ? {
          id: spec.id,
          verdict: 'red',
          class: c.class,
          exit_code: code,
          message: `caught the planted ${c.class} defect (exit ${String(code)})`,
        }
      : {
          id: spec.id,
          verdict: 'green',
          class: c.class,
          exit_code: 0,
          message:
            `stayed GREEN over a planted ${c.class} defect at ${c.path} — ` +
            'the gate is dead by definition. This row is a defect ticket',
        };
  } finally {
    // NEVER SHIPS (adversarial-review-protocol § 6): the plant is removed even
    // when the gate crashes or the process is interrupted mid-run.
    if (planted) {
      try {
        fs.rmSync(abs, { force: true });
        // Innermost first — rmdir only succeeds while the directory is empty,
        // so a dir that gained other content is left alone.
        for (const d of madeDirs) {
          try {
            fs.rmdirSync(d);
          } catch {
            break;
          }
        }
      } catch {
        process.stderr.write(`❌  canary could not remove its plant at ${c.path} — REMOVE IT BY HAND\n`);
      }
    }
  }
}

export interface Disagreement {
  gate: string;
  kind: 'dead_gate' | 'census_stale';
  detail: string;
}

/**
 * Read the scan-scope census into `gate -> units`.
 *
 * Column-position-agnostic: it locates the gate column and the units column by
 * header text, so a census regenerated with a different column set still
 * cross-checks. `null` = the census recorded no measurable count.
 */
export function parse_census(md: string): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const rows = md.split('\n').filter((l) => l.trim().startsWith('|'));
  const cells = (l: string): string[] =>
    l.split('|').slice(1, -1).map((c) => c.trim());
  let gateCol = -1;
  let unitCol = -1;
  for (const line of rows) {
    const cs = cells(line);
    const head = cs.map((c) => c.toLowerCase());
    const g = head.findIndex((c) => c === 'gate');
    const u = head.findIndex((c) => c.startsWith('unit'));
    if (g >= 0 && u >= 0) {
      gateCol = g;
      unitCol = u;
      continue;
    }
    if (gateCol < 0 || cs.length <= Math.max(gateCol, unitCol)) continue;
    const idm = /`([A-Za-z0-9_.-]+)`/.exec(cs[gateCol] as string);
    if (idm === null) continue;
    // A row the census could not extract a root for is NOT a row that read
    // nothing — the two are indistinguishable in the units column, which prints
    // `**0**` for both, and conflating them produced a false `census_stale`
    // disagreement on every dynamically-scoped gate. `check_secret_leak`
    // resolves its corpus by spawning `git diff` / `npm pack`, and
    // `check_no_roadmap_refs` likewise: a static root extractor finds nothing to
    // count, so the canary correctly reds them while the census correctly says
    // 0, and the comparison then calls a correct pair a defect.
    //
    // `null` already means "no measurable count" here and is already skipped by
    // the disagreement check, so this maps the un-extractable case onto the
    // meaning it always had.
    if (/\(none extracted\)/.test(line)) {
      // Left UNSET, not set to `null`. The disagreement check treats
      // `undefined` as "not censused — nothing to disagree with" and `null` as
      // "censused and read nothing", which is a stale row. An un-extractable
      // root is the first, not the second: nothing was measured, so there is no
      // measurement to disagree with the canary about.
      //
      // Setting `null` here was tried first and made it WORSE — it turned every
      // dynamically-scoped gate into a fresh false `census_stale`, six of them
      // at once. The distinction between the two absences is the whole fix.
      continue;
    }
    const raw = cs[unitCol] as string;
    const num = /(\d[\d,]*)/.exec(raw.replace(/\*/g, ''));
    out.set(idm[1] as string, num === null ? null : Number((num[1] as string).replace(/,/g, '')));
  }
  return out;
}

/**
 * Make the two artefacts disagree loudly (Phase 7 step 2).
 *
 * The census says what a gate READS; the canary says whether anything it reads
 * can make it FAIL. Each alone is satisfiable by a broken gate; together they
 * are not.
 */
export function cross_check(
  results: readonly CanaryResult[],
  census: ReadonlyMap<string, number | null>,
): Disagreement[] {
  const out: Disagreement[] = [];
  for (const r of results) {
    const units = census.get(r.id);
    if (units === undefined) continue; // not censused — nothing to disagree with
    if (r.verdict === 'green' && units !== null && units > 0) {
      out.push({
        gate: r.id,
        kind: 'dead_gate',
        detail:
          `census records ${String(units)} unit(s) read, but the canary could not make it fail — ` +
          'a gate that reads a live corpus and cannot go red is dead',
      });
    }
    if (r.verdict === 'red' && (units === null || units === 0)) {
      out.push({
        gate: r.id,
        kind: 'census_stale',
        detail:
          'the canary made it fail, so it reads a live corpus, but the census records no units — ' +
          're-run the census; its row is stale',
      });
    }
  }
  return out;
}

const CANARY_ICON: Record<CanaryVerdict, string> = {
  red: '✅',
  green: '❌',
  no_recipe: '⚠️',
  crashed: '❌',
};

export function render_ledger(
  results: readonly CanaryResult[],
  disagreements: readonly Disagreement[],
  totalGateScripts: number,
  cycleId: string,
): string {
  const recipes = results.filter((r) => r.verdict !== 'no_recipe');
  const red = results.filter((r) => r.verdict === 'red');
  const green = results.filter((r) => r.verdict === 'green');
  const lines = [
    `# Gate-surface canary ledger — ${cycleId}`,
    '',
    'Produced by `./scripts-run src/scripts/check_gate_coverage --canary`. Governed by',
    '[`adversarial-review-protocol`](../../../../docs/contracts/adversarial-review-protocol.md)',
    '§ 6 — biannual cadence, rotating class, sealed record, never ships.',
    '',
    '## Coverage (stated, not implied)',
    '',
    `- Gate scripts in \`src/scripts/\`: **${String(totalGateScripts)}**`,
    `- Listed in \`src/config/gate-coverage.yml\`: **${String(results.length)}**`,
    `- Carrying a canary recipe: **${String(recipes.length)}**`,
    `- RED (caught the plant): **${String(red.length)}** · GREEN (dead): **${String(green.length)}**`,
    '',
    'Every gate outside the recipe count is UNPROVEN by this experiment. That is a',
    'gap, not a pass.',
    '',
    '## Per-gate ledger',
    '',
    '| Gate | Class | Verdict | Exit | Detail |',
    '|---|---|---|---:|---|',
  ];
  for (const r of results) {
    lines.push(
      `| \`${r.id}\` | ${r.class ?? '—'} | ${CANARY_ICON[r.verdict]} ${r.verdict.toUpperCase()} ` +
        `| ${r.exit_code === null ? '—' : String(r.exit_code)} | ${r.message} |`,
    );
  }
  lines.push('', '## Cross-check against the scan-scope census', '');
  if (disagreements.length === 0) {
    lines.push('No disagreement: every censused gate with a recipe went red, and every red gate');
    lines.push('has a non-zero census count.');
  } else {
    lines.push('| Gate | Kind | Detail |', '|---|---|---|');
    for (const d of disagreements) lines.push(`| \`${d.gate}\` | **${d.kind}** | ${d.detail} |`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Count of gate-shaped scripts, for the honest denominator in the ledger. */
export function count_gate_scripts(dir = path.join(REPO_ROOT, 'src/scripts')): number {
  return listGateScripts(dir, (d) => fs.readdirSync(d)).length;
}

function run_canary_mode(specs: readonly GateSpec[], argv: readonly string[]): number {
  const results = specs.map((s) => run_canary(s));
  const censusMd = fs.existsSync(CENSUS) ? fs.readFileSync(CENSUS, 'utf8') : '';
  const disagreements = cross_check(results, parse_census(censusMd));

  for (const r of results) {
    process.stdout.write(`  ${CANARY_ICON[r.verdict]} ${r.id}: ${r.message}\n`);
  }
  for (const d of disagreements) {
    process.stdout.write(`  ❌ DISAGREEMENT [${d.kind}] ${d.gate}: ${d.detail}\n`);
  }

  const cycleId = `gate-surface-${asOf().toISOString().slice(0, 10)}`;
  const li = argv.indexOf('--ledger');
  if (li >= 0 && argv[li + 1] !== undefined) {
    const out = path.resolve(REPO_ROOT, argv[li + 1] as string);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render_ledger(results, disagreements, count_gate_scripts(), cycleId), 'utf8');
    process.stdout.write(`\nledger: ${path.relative(REPO_ROOT, out)}\n`);
  }

  const recipes = results.filter((r) => r.verdict !== 'no_recipe').length;
  const green = results.filter((r) => r.verdict === 'green' || r.verdict === 'crashed').length;
  process.stdout.write(
    `\nscanned: ${String(results.length)}\n` +
      `  recipes ${String(recipes)} · unproven ${String(results.length - recipes)} · ` +
      `green(dead) ${String(green)} · disagreements ${String(disagreements.length)}\n`,
  );
  if (green > 0 || disagreements.length > 0) {
    process.stdout.write('❌  canary found dead gate(s) or a census disagreement — each row is a defect ticket.\n');
    return 1;
  }
  process.stdout.write('✅  every gate with a recipe went red over its planted defect.\n');
  return 0;
}

function _isCliEntry(): boolean {
  if (process.argv[1] === undefined) return false;
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (argvUrl === import.meta.url) return true;
  try {
    return pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href === import.meta.url;
  } catch {
    return false;
  }
}

if (_isCliEntry()) {
  process.exit(main(process.argv.slice(2)));
}
