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
 * CLI:
 *   ./scripts-run src/scripts/check_gate_coverage            # enforce
 *   ./scripts-run src/scripts/check_gate_coverage --list     # show the manifest
 *   ./scripts-run src/scripts/check_gate_coverage --format json
 *
 * Exit codes: 0 all enforced gates cleared their floor · 1 a gate is blind,
 * collapsed, or silent · 2 the manifest itself is missing/empty/malformed.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'js-yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src/config/gate-coverage.yml');

/** The one line a gate must emit. Deliberately narrow: no format guessing. */
const SCANNED_RE = /^\s*scanned:\s*(\d+)\s*$/m;

export interface GateSpec {
  id: string;
  argv: string[];
  min_scanned: number;
  corpus: string;
  status: 'enforced' | 'pending';
  note?: string;
}

export type Verdict = 'ok' | 'below_floor' | 'silent' | 'crashed' | 'pending';

export interface GateResult {
  id: string;
  status: GateSpec['status'];
  verdict: Verdict;
  scanned: number | null;
  min_scanned: number;
  message: string;
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
      ...(e['note'] === undefined ? {} : { note: String(e['note']) }),
    };
  });
}

/** Extract the contract line. Returns null when the gate emitted no count. */
export function parse_scanned(output: string): number | null {
  const m = SCANNED_RE.exec(output);
  return m === null ? null : Number(m[1]);
}

/** Classify one gate's run against its declared floor. Pure — testable without
 * spawning anything. */
export function classify(spec: GateSpec, scanned: number | null, crashed: boolean): GateResult {
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

function run_gate(spec: GateSpec): { scanned: number | null; crashed: boolean } {
  const runner = path.join(REPO_ROOT, 'scripts-run');
  const r = spawnSync(runner, [`src/scripts/${spec.id}`, ...spec.argv], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (r.error !== undefined || r.status === null) return { scanned: null, crashed: true };
  // A gate may legitimately exit non-zero (it found real violations) and still
  // have scanned plenty — coverage and verdict are different questions.
  return { scanned: parse_scanned(`${r.stdout}\n${r.stderr}`), crashed: false };
}

const ICON: Record<Verdict, string> = {
  ok: '✅',
  below_floor: '❌',
  silent: '❌',
  crashed: '❌',
  pending: '⚠️',
};

export function main(argv: readonly string[]): number {
  const wantJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
  const listOnly = argv.includes('--list');

  let specs: GateSpec[];
  try {
    specs = load_manifest();
  } catch (e) {
    process.stderr.write(`❌  gate-coverage manifest: ${(e as Error).message}\n`);
    return 2;
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

  const results = specs.map((s) => {
    const { scanned, crashed } = spec_is_pending(s) ? probe_pending(s) : run_gate(s);
    return classify(s, scanned, crashed);
  });

  if (wantJson) {
    process.stdout.write(`${JSON.stringify({ generated_by: 'check_gate_coverage', results }, null, 2)}\n`);
  } else {
    for (const r of results) {
      process.stdout.write(`  ${ICON[r.verdict]} ${r.id}: ${r.message}\n`);
    }
  }

  const failed = results.filter((r) => r.verdict === 'below_floor' || r.verdict === 'silent' || r.verdict === 'crashed');
  const pending = results.filter((r) => r.verdict === 'pending');

  // The guard reports its OWN coverage. Hiding a pending gate behind a green
  // summary is exactly the failure mode this file exists to prevent.
  process.stdout.write(
    `\nscanned: ${String(results.length)}\n` +
      `  enforced ${String(results.length - pending.length)} · pending ${String(pending.length)} · failing ${String(failed.length)}\n`,
  );
  if (pending.length > 0) {
    process.stdout.write(
      `⚠️  ${String(pending.length)} gate(s) are listed but NOT enforced — this guard's coverage is partial by declaration.\n`,
    );
  }
  if (failed.length > 0) {
    process.stdout.write(`❌  ${String(failed.length)} gate(s) failed the coverage floor.\n`);
    return 1;
  }
  process.stdout.write('✅  every enforced gate cleared its coverage floor.\n');
  return 0;
}

function spec_is_pending(s: GateSpec): boolean {
  return s.status === 'pending';
}

/** Pending gates are still probed (so the report shows what they currently do),
 * but their count never fails the build. */
function probe_pending(s: GateSpec): { scanned: number | null; crashed: boolean } {
  return run_gate(s);
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
