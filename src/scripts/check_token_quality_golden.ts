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
 *   ./scripts-run src/scripts/check_token_quality_golden --scope consumer
 *
 * Scope-aware coverage (road-to-golden-set-coverage Phase 0): `--scope
 * consumer|maintainer|all` filters the coverage universe by the router's v2
 * `workspaces:` fields — consumer = kernel + every rule NOT exclusively
 * `agent-config-maintainer`; maintainer = the exclusively-maintainer rest;
 * `all` (default) = today's behaviour. The consumer thin/scoped flips gate on
 * `--require-complete --scope consumer`; a maintainer-side flip would gate on
 * `--scope all`.
 *
 * Prompt↔trigger falsifiability (Phase 3): every tagged rule must have ≥1
 * router trigger the task actually exercises — keyword/phrase = substring of
 * the prompt; intent = every alpha word (>2 chars) present (trigger_coverage
 * semantics); path_prefix/file_pattern/command are satisfiable via the
 * optional per-task `context_files:` / `command:` fields. Kernel rules always
 * fire. "Covered" therefore means FIRES, not mentioned. Structural check —
 * always on.
 *
 * Exit codes: 0 valid (scaffold or complete) · 1 file error · 2 invalid / incomplete-when-required.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'internal/bench/corpora/token-quality-golden.yaml');
const ROUTER = path.join(REPO_ROOT, 'dist/router.json');

const SCENARIOS = ['single', 'multi-turn', 'conflicting-rule', 'corner-case'];
const REQUIRED_SCENARIOS = ['multi-turn', 'conflicting-rule', 'corner-case'];
const LABEL_STATUS = ['stub', 'labelled'];

type Json = Record<string, unknown>;

export type Scope = 'consumer' | 'maintainer' | 'all';

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

/**
 * Rule universe for a scope, from the router's v2 `workspaces:` fields.
 * Kernel is always consumer-facing (it ships unconditionally). A non-kernel
 * rule is maintainer-scope iff its workspaces are exactly
 * ['agent-config-maintainer']; missing/empty workspaces count as consumer
 * (fail-safe, mirrors the projection filter).
 */
export function scoped_rule_ids(router: Json, scope: Scope): Set<string> {
  const all = router_rule_ids(router);
  if (scope === 'all') return all;
  const kernel = new Set(Array.isArray(router.kernel) ? (router.kernel as string[]) : []);
  const out = new Set<string>();
  for (const key of ['tier_1', 'tier_2']) {
    const arr = router[key];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const obj = entry as Json;
      const id = obj.id as string;
      const ws = Array.isArray(obj.workspaces) ? (obj.workspaces as string[]) : [];
      const maintainerOnly = ws.length === 1 && ws[0] === 'agent-config-maintainer';
      if (scope === 'consumer' ? !maintainerOnly : maintainerOnly) out.add(id);
    }
  }
  if (scope === 'consumer') for (const k of kernel) out.add(k);
  return out;
}

/** Router entries (non-kernel) as id → triggers, for the fires-check. */
export function router_triggers(router: Json): Map<string, Array<Record<string, string>>> {
  const map = new Map<string, Array<Record<string, string>>>();
  for (const key of ['tier_1', 'tier_2']) {
    const arr = router[key];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const obj = entry as Json;
      map.set(obj.id as string, Array.isArray(obj.triggers) ? (obj.triggers as Array<Record<string, string>>) : []);
    }
  }
  return map;
}

/**
 * Whether a task exercises ≥1 trigger of the rule (prompt↔trigger
 * falsifiability, Phase 3). Kernel rules always fire.
 */
export function task_fires_rule(
  task: { prompt: string; context_files?: string[]; command?: string },
  ruleId: string,
  router: Json,
): boolean {
  const kernel = new Set(Array.isArray(router.kernel) ? (router.kernel as string[]) : []);
  if (kernel.has(ruleId)) return true;
  const triggers = router_triggers(router).get(ruleId) ?? [];
  const low = task.prompt.toLowerCase();
  const files = Array.isArray(task.context_files) ? task.context_files : [];
  const cmd = typeof task.command === 'string' ? task.command : '';
  for (const trig of triggers) {
    if ('keyword' in trig || 'phrase' in trig) {
      const needle = String(trig.keyword ?? trig.phrase).toLowerCase();
      if (needle && low.includes(needle)) return true;
    } else if ('path_prefix' in trig) {
      const prefix = String(trig.path_prefix);
      if (files.some((f) => f.startsWith(prefix))) return true;
    } else if ('file_pattern' in trig) {
      const pat = String(trig.file_pattern);
      // Glob-lite: '*' matches any run; anchor on basename like Cursor does.
      const re = new RegExp('^' + pat.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      if (files.some((f) => re.test(f) || re.test(path.basename(f)))) return true;
    } else if ('command' in trig) {
      const c = String(trig.command);
      if (cmd && (cmd === c || cmd === `/${c.replace(/^\//, '')}` || cmd.replace(/^\//, '') === c.replace(/^\//, ''))) {
        return true;
      }
    }
  }
  return false;
}

export interface GoldenReport {
  ok: boolean;
  errors: string[];
  task_count: number;
  labelled: number;
  stubs: number;
  covered: number;
  covered_ids: string[];
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

/**
 * Pure validation + coverage. `ruleIds` is the authoritative rule universe
 * (scope-filtered by the caller). When `router` is provided, the
 * prompt↔trigger falsifiability check runs: a tagged rule whose triggers the
 * task provably does NOT exercise is a structural error.
 */
export function validate(corpus: Json, ruleIds: Set<string>, router: Json | null = null): GoldenReport {
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
      covered_ids: [],
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
        continue;
      }
      covered.add(r);
      // Prompt↔trigger falsifiability — "covered" must mean FIRES.
      // `no_fire: true` inverts the check for corner-case tasks that
      // deliberately test NON-activation (the rule must NOT fire).
      if (router !== null && typeof task.prompt === 'string') {
        const fires = task_fires_rule(
          task as { prompt: string; context_files?: string[]; command?: string },
          r,
          router,
        );
        const noFire = task.no_fire === true;
        const kernel = new Set(Array.isArray(router.kernel) ? (router.kernel as string[]) : []);
        if (noFire && kernel.has(r)) {
          errors.push(`${where}: no_fire is invalid for kernel rule \`${r}\` (kernel always fires)`);
        } else if (noFire && fires) {
          errors.push(
            `${where}: no_fire task, but rule \`${r}\` DOES fire on the prompt — ` +
              'the non-activation corner-case is broken',
          );
        } else if (!noFire && !fires) {
          errors.push(
            `${where}: tagged rule \`${r}\` has no router trigger the prompt exercises ` +
              '(add a matching keyword/phrase to the prompt, or context_files:/command:, or re-tag)',
          );
        }
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
    covered_ids: [...covered].sort(),
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
  let scope: Scope = 'all';
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (a === '--scope') {
      const v = argv[(i += 1)];
      if (v !== 'consumer' && v !== 'maintainer' && v !== 'all') {
        process.stderr.write('error: --scope must be consumer | maintainer | all\n');
        return 1;
      }
      scope = v;
      continue;
    }
    if (!['--json', '--require-complete', '-h', '--help'].includes(a)) {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
    if (a === '-h' || a === '--help') {
      process.stdout.write(
        'usage: check_token_quality_golden [--json] [--require-complete] [--scope consumer|maintainer|all]\n',
      );
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
  // Structure (incl. the fires-check) always validates against the FULL
  // universe — a maintainer-rule tag is not "unknown" under consumer scope.
  const report = validate(corpus, ruleIds, router);

  // Coverage accounting runs against the SCOPED universe: which flip is
  // being gated decides what "complete" means.
  const scopedIds = scoped_rule_ids(router, scope);
  const coveredScoped = report.covered_ids.filter((r) => scopedIds.has(r));
  const uncoveredScoped = [...scopedIds].filter((r) => !report.covered_ids.includes(r)).sort();
  // Stubs only block completion when they tag in-scope rules.
  const incomplete =
    report.stubs > 0 || uncoveredScoped.length > 0 || report.missing_scenarios.length > 0;

  if (asJson) {
    process.stdout.write(
      JSON.stringify(
        {
          ...report,
          scope,
          scope_universe: scopedIds.size,
          scope_covered: coveredScoped.length,
          scope_uncovered: uncoveredScoped,
          require_complete: requireComplete,
          incomplete,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    for (const e of report.errors) process.stdout.write(`❌  ${e}\n`);
    process.stdout.write(
      `golden set: ${report.task_count} task(s) · ${report.labelled} labelled · ${report.stubs} stub · ` +
        `coverage ${report.covered}/${ruleIds.size} rules\n`,
    );
    process.stdout.write(
      `scope ${scope}: coverage ${coveredScoped.length}/${scopedIds.size} rules\n`,
    );
    if (uncoveredScoped.length > 0) {
      process.stdout.write(`⚠️  ${uncoveredScoped.length} in-scope rule(s) uncovered (operator to add tasks)\n`);
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

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _IS_MAIN =
  _isCliEntry();

if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
