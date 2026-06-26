#!/usr/bin/env tsx
/**
 * Validator + coverage reporter for the token-quality golden set
 * (token-saving Phase 0). Loads `internal/bench/corpora/token-quality-golden.yaml`,
 * validates each task against the schema (TOKEN-QUALITY-GOLDEN-SCHEMA.md), and
 * reports rule-coverage vs `dist/router.json` + label-status counts.
 *
 * The `expected` anchors are HAND-LABELLED operator work — so an unfilled
 * (`stub`) task or an uncovered rule is REPORTED, not a failure, by default.
 * Structural errors (unknown rule id, bad scenario, a `labelled` task with a
 * TODO rubric / no anchors) always fail. `--require-complete` is the operator-
 * completion gate (Phase 0 exit): it also fails on any remaining stub, any
 * uncovered rule, or a missing required scenario.
 *
 * CLI:
 *   ./scripts-run src/scripts/check_token_quality_golden
 *   ./scripts-run src/scripts/check_token_quality_golden --json
 *   ./scripts-run src/scripts/check_token_quality_golden --require-complete
 *
 * Exit codes: 0 valid (scaffold or complete) · 1 file error · 2 invalid / incomplete-when-required.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'js-yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'internal/bench/corpora/token-quality-golden.yaml');
const ROUTER = path.join(REPO_ROOT, 'dist/router.json');

const SCENARIOS = ['single', 'multi-turn', 'conflicting-rule', 'corner-case'];
const REQUIRED_SCENARIOS = ['multi-turn', 'conflicting-rule', 'corner-case'];
const LABEL_STATUS = ['stub', 'labelled'];

type Json = Record<string, unknown>;

/** Collect every rule id from the router (kernel strings + tier_* objects). */
export function router_rule_ids(router: Json): Set<string> {
  const ids = new Set<string>();
  for (const key of ['kernel', 'tier_1', 'tier_2']) {
    const arr = router[key];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (typeof entry === 'string') ids.add(entry);
      else if (entry && typeof entry === 'object' && typeof (entry as Json).id === 'string') {
        ids.add((entry as Json).id as string);
      }
    }
  }
  return ids;
}

export interface GoldenReport {
  ok: boolean;
  errors: string[];
  task_count: number;
  labelled: number;
  stubs: number;
  covered: number;
  uncovered: string[];
  scenarios: Record<string, number>;
  missing_scenarios: string[];
}

function _isTodoRubric(rubric: unknown): boolean {
  return (
    typeof rubric !== 'string' ||
    rubric.trim() === '' ||
    /^todo\b/i.test(rubric.trim())
  );
}

/** Pure validation + coverage. `ruleIds` is the authoritative rule universe. */
export function validate(corpus: Json, ruleIds: Set<string>): GoldenReport {
  const errors: string[] = [];
  const tasks = Array.isArray(corpus.tasks) ? (corpus.tasks as Json[]) : null;
  if (corpus.corpus_id !== 'token-quality-golden') {
    errors.push(`corpus_id must be "token-quality-golden" (got ${JSON.stringify(corpus.corpus_id)})`);
  }
  if (tasks === null) {
    errors.push('`tasks` must be a list');
    return {
      ok: false,
      errors,
      task_count: 0,
      labelled: 0,
      stubs: 0,
      covered: 0,
      uncovered: [...ruleIds].sort(),
      scenarios: {},
      missing_scenarios: [...REQUIRED_SCENARIOS],
    };
  }

  const seenIds = new Set<string>();
  const covered = new Set<string>();
  const scenarios: Record<string, number> = {};
  let labelled = 0;
  let stubs = 0;

  for (const [i, task] of tasks.entries()) {
    const where = `task[${i}]${typeof task.id === 'string' ? ` (${task.id})` : ''}`;
    if (typeof task.id !== 'string' || !/^tq-[a-z0-9-]+-\d+$/.test(task.id)) {
      errors.push(`${where}: id must match tq-<area>-NN`);
    } else if (seenIds.has(task.id)) {
      errors.push(`${where}: duplicate id`);
    } else {
      seenIds.add(task.id);
    }

    const rules = Array.isArray(task.rules) ? (task.rules as unknown[]) : [];
    if (rules.length === 0) errors.push(`${where}: rules must be a non-empty list`);
    for (const r of rules) {
      if (typeof r !== 'string' || !ruleIds.has(r)) {
        errors.push(`${where}: unknown rule id ${JSON.stringify(r)}`);
      } else {
        covered.add(r);
      }
    }

    if (typeof task.scenario !== 'string' || !SCENARIOS.includes(task.scenario)) {
      errors.push(`${where}: scenario must be one of ${SCENARIOS.join(' | ')}`);
    } else {
      scenarios[task.scenario] = (scenarios[task.scenario] ?? 0) + 1;
    }

    if (typeof task.prompt !== 'string' || task.prompt.trim() === '') {
      errors.push(`${where}: prompt must be a non-empty string`);
    }

    const status = task.label_status;
    if (typeof status !== 'string' || !LABEL_STATUS.includes(status)) {
      errors.push(`${where}: label_status must be one of ${LABEL_STATUS.join(' | ')}`);
    } else if (status === 'labelled') {
      labelled += 1;
    } else {
      stubs += 1;
    }

    const expected = (task.expected ?? {}) as Json;
    const mustInclude = Array.isArray(expected.must_include) ? expected.must_include : [];
    // A LABELLED task must carry a real rubric + ≥1 anchor; a stub need not.
    if (status === 'labelled') {
      if (_isTodoRubric(expected.rubric)) {
        errors.push(`${where}: labelled task has a TODO/empty rubric`);
      }
      if (mustInclude.length === 0) {
        errors.push(`${where}: labelled task needs ≥1 expected.must_include anchor`);
      }
    }
  }

  const uncovered = [...ruleIds].filter((r) => !covered.has(r)).sort();
  const missing_scenarios = REQUIRED_SCENARIOS.filter((s) => (scenarios[s] ?? 0) === 0);

  return {
    ok: errors.length === 0,
    errors,
    task_count: tasks.length,
    labelled,
    stubs,
    covered: covered.size,
    uncovered,
    scenarios,
    missing_scenarios,
  };
}

function _readJson(file: string): Json | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Json;
  } catch {
    return null;
  }
}

function main(argv: string[]): number {
  const asJson = argv.includes('--json');
  const requireComplete = argv.includes('--require-complete');
  for (const a of argv) {
    if (!['--json', '--require-complete', '-h', '--help'].includes(a)) {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
    if (a === '-h' || a === '--help') {
      process.stdout.write('usage: check_token_quality_golden [--json] [--require-complete]\n');
      return 0;
    }
  }

  let corpus: Json | null;
  try {
    corpus = yaml.load(fs.readFileSync(CORPUS, 'utf-8')) as Json;
  } catch (e) {
    process.stderr.write(`error: cannot read/parse ${path.relative(REPO_ROOT, CORPUS)}: ${(e as Error).message}\n`);
    return 1;
  }
  const router = _readJson(ROUTER);
  if (router === null) {
    process.stderr.write(`error: cannot read ${path.relative(REPO_ROOT, ROUTER)} — run \`task sync\` first\n`);
    return 1;
  }
  const ruleIds = router_rule_ids(router);
  const report = validate(corpus, ruleIds);

  const incomplete =
    report.stubs > 0 || report.uncovered.length > 0 || report.missing_scenarios.length > 0;

  if (asJson) {
    process.stdout.write(JSON.stringify({ ...report, require_complete: requireComplete, incomplete }, null, 2) + '\n');
  } else {
    for (const e of report.errors) process.stdout.write(`❌  ${e}\n`);
    process.stdout.write(
      `golden set: ${report.task_count} task(s) · ${report.labelled} labelled · ${report.stubs} stub · ` +
        `coverage ${report.covered}/${ruleIds.size} rules\n`,
    );
    if (report.uncovered.length > 0) {
      process.stdout.write(`⚠️  ${report.uncovered.length} rule(s) uncovered (operator to add tasks)\n`);
    }
    if (report.missing_scenarios.length > 0) {
      process.stdout.write(`⚠️  missing required scenario(s): ${report.missing_scenarios.join(', ')}\n`);
    }
    if (!report.ok) {
      process.stdout.write(`❌  golden set has structural errors (see above).\n`);
    } else if (incomplete) {
      process.stdout.write(`✅  structurally valid — scaffold awaiting operator labels.\n`);
    } else {
      process.stdout.write(`✅  golden set complete.\n`);
    }
  }

  if (!report.ok) return 2;
  if (requireComplete && incomplete) {
    if (!asJson) {
      process.stdout.write(`❌  --require-complete: golden set is not yet complete.\n`);
    }
    return 2;
  }
  return 0;
}

const _IS_MAIN =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
