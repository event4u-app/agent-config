#!/usr/bin/env tsx
/**
 * Trigger-coverage suite (roadmap Phase 2.1 / 2.2).
 *
 * Ported from the retired Python `src/scripts/trigger_coverage.py` (ADR-200, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--json` flag, exit codes
 * (0 pass / 1 miss / 2 missing-router-or-PyYAML), the stdout/stderr split,
 * byte-identical human + JSON report.
 *
 * The deterministic *must-load* floor for the lean-initial-context migration.
 * Before any auto-tier rule body is demoted to a router-resolved pointer
 * (Phase 3), this suite proves the router still fires that rule on
 * representative task phrasings — so a needed rule can never silently fail
 * to surface.
 *
 * Cases live in `tests/eval/trigger-coverage.yaml`. Matching is deterministic
 * against `dist/router.json`:
 *
 * - kernel rules always fire (always-on layer).
 * - a tier rule fires iff any of its triggers matches the prompt:
 *   - `keyword` → case-insensitive substring.
 *   - `phrase`  → case-insensitive substring (multi-word).
 *
 * `intent` used to be the second matcher here, on word-set-inclusion
 * semantics, while `router_telemetry` documented the same key as
 * "informational only — never auto-matches". That divergence is gone: the
 * trigger type was removed, and `phrase` — which every other tool already
 * treats as a real matcher — took its place. A rule now proves it can fire on
 * a substring a prompt actually contains, not on a bag of words.
 *
 * A case fails when an expected rule is NOT in the fired set. Exit 1 on any
 * miss → the merge that would have shrunk the rule is blocked (2.2).
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { keyword_matches_anchored } from './router_telemetry.js';
import { match_prompt, type Router as MatchRouter } from './_lib/router_match.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/trigger_coverage.ts → parents[2] of the .py file is repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');
export const CORPUS = path.join(REPO_ROOT, 'tests', 'eval', 'trigger-coverage.yaml');

/** Skill tree the `skill` scope reads `triggers:` frontmatter from. */
export const SKILLS_DIR = path.join(REPO_ROOT, 'src', 'skills');
/** The matrix corpus the unintended-activation census is defined over. */
export const MATRIX_DIR = path.join(REPO_ROOT, 'tests', 'eval', 'routing-matrix');

type Router = {
    kernel?: string[];
    tier_1?: Array<{ id: string; triggers?: Array<Record<string, string>> }>;
    tier_2?: Array<{ id: string; triggers?: Array<Record<string, string>> }>;
    [k: string]: unknown;
};

interface Case {
    id: string;
    prompt: string;
    expect?: string[];
}

interface CaseResult {
    id: string;
    ok: boolean;
    missing: string[];
    expect: string[];
}

export function load_router(): Router {
    return JSON.parse(fs.readFileSync(ROUTER, 'utf-8')) as Router;
}

export function fired_rules(prompt: string, router: Router): Set<string> {
    const low = prompt.toLowerCase();
    const fired = new Set<string>(router.kernel ?? []);
    for (const tier of ['tier_1', 'tier_2'] as const) {
        for (const entry of router[tier] ?? []) {
            for (const trig of entry.triggers ?? []) {
                // Single matcher source of truth (road-to-tested-routing
                // Phase 3): `keyword` is word-boundary anchored via the
                // shared helper; `phrase` stays unanchored substring.
                if ('keyword' in trig) {
                    const needle = String(trig['keyword']).toLowerCase();
                    if (needle !== '' && keyword_matches_anchored(low, needle)) {
                        fired.add(entry.id);
                        break;
                    }
                } else if ('phrase' in trig) {
                    const needle = String(trig['phrase']).toLowerCase();
                    if (needle !== '' && low.includes(needle)) {
                        fired.add(entry.id);
                        break;
                    }
                }
            }
        }
    }
    return fired;
}

/* ------------------------------------------------------------------ *
 * The SKILL scope.
 *
 * It reuses `match_prompt` from `_lib/router_match.ts` — the same matcher the
 * rule scope's census runs on — by handing it a router-SHAPED view of the
 * skill catalogue. Forking the matcher would let the two scopes disagree about
 * what "fires" means, which is the exact drift the shared helper exists to
 * prevent.
 *
 * WHAT THIS SCOPE CANNOT REGRESS, stated because the roadmap's own risk
 * register assumed otherwise. Risk 2 reads "the corpus counts activations
 * across the whole router, so a skill-side tranche can regress a rule-side
 * number". Verified against the tree: `compile_router.ts` contains zero
 * references to skills, and `dist/router.json` carries exactly
 * `kernel` + `tier_1` + `tier_2` rule entries. Skill triggers are compiled
 * into nothing and are matched here over a SEPARATE catalogue, so the rule-side
 * 433 census is structurally untouched by any skill tranche. The risk it names
 * is real for a shared router and does not exist in this one — which makes the
 * skill-side count below a NEW number needing its own ceiling, not a threat to
 * the old one.
 * ------------------------------------------------------------------ */

/** One skill that declares activation triggers. */
export interface SkillTriggerEntry {
    id: string;
    triggers: Array<Record<string, string>>;
}

/** `triggers:` list items from a SKILL.md frontmatter block. */
function _parseTriggerBlock(frontmatter: string): Array<Record<string, string>> {
    const out: Array<Record<string, string>> = [];
    const lines = frontmatter.split('\n');
    let inside = false;
    for (const line of lines) {
        if (/^triggers:\s*$/.test(line)) {
            inside = true;
            continue;
        }
        if (inside && /^\S/.test(line)) break; // next top-level key ends the block
        if (!inside) continue;
        const item = /^\s*-\s*(keyword|phrase|file_pattern|path_prefix|command):\s*(.+?)\s*$/.exec(line);
        if (item) {
            out.push({ [item[1]!]: item[2]!.replace(/^["']|["']$/g, '') });
        }
    }
    return out;
}

/** Every skill under `skillsDir` that declares a non-empty `triggers:` list. */
export function loadSkillTriggers(skillsDir: string): SkillTriggerEntry[] {
    let names: string[];
    try {
        names = fs.readdirSync(skillsDir);
    } catch {
        return [];
    }
    const out: SkillTriggerEntry[] = [];
    for (const name of names.sort()) {
        const file = path.join(skillsDir, name, 'SKILL.md');
        let content: string;
        try {
            content = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        if (!content.startsWith('---')) continue;
        const end = content.indexOf('\n---', 3);
        if (end === -1) continue;
        const triggers = _parseTriggerBlock(content.slice(3, end));
        if (triggers.length > 0) out.push({ id: name, triggers });
    }
    return out;
}

/**
 * Every prompt in the matrix corpus, positives and near-misses alike.
 *
 * Parsed with the YAML reader this module already imports, not with a
 * line regex. A regex anchored on `- prompt: "…"` silently drops any entry
 * written unquoted or in single quotes, and a corpus that shrinks without
 * saying so moves every rate computed against it — the denominator would
 * change while the number kept its old name.
 */
export function loadMatrixPrompts(matrixDir: string): string[] {
    let files: string[];
    try {
        files = fs.readdirSync(matrixDir).filter((n) => n.endsWith('.yaml')).sort();
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const f of files) {
        let doc: unknown;
        try {
            doc = parseYaml(fs.readFileSync(path.join(matrixDir, f), 'utf-8'), { version: '1.1' });
        } catch {
            continue; // an unparseable corpus file is skipped, never guessed at
        }
        if (typeof doc !== 'object' || doc === null) continue;
        const record = doc as Record<string, unknown>;
        for (const section of ['positives', 'near_misses']) {
            const entries = record[section];
            if (!Array.isArray(entries)) continue;
            for (const raw of entries) {
                const prompt = (raw as Record<string, unknown> | null)?.['prompt'];
                if (typeof prompt === 'string' && prompt.trim() !== '') out.push(prompt);
            }
        }
    }
    return out;
}

export interface SkillScopeReport {
    /** Skills declaring at least one trigger. Zero on the day the schema ships. */
    skills_with_triggers: number;
    prompts: number;
    /** Total (prompt, skill) activations — the skill-side census. */
    activations: number;
    /** Prompts that activated at least one skill. */
    prompts_activating: number;
    /** Per-skill activation counts, descending then by id. */
    histogram: Array<[string, number]>;
}

/**
 * Run the skill catalogue over the matrix corpus with the shared matcher.
 *
 * `tier_2` is the carrier for the router-shaped view purely because
 * `match_prompt` reads its rule lists from `tier_1`/`tier_2`; skills have no
 * tier and none is implied by the placement.
 */
export function runSkillScope(
    entries: readonly SkillTriggerEntry[],
    prompts: readonly string[],
): SkillScopeReport {
    // `kernel: []` is load-bearing: `match_prompt` appends every kernel id to
    // `activated_rules` unconditionally, so a non-empty kernel here would count
    // rule activations as skill ones on every prompt.
    const view = { kernel: [], tier_1: [], tier_2: entries } as unknown as MatchRouter;
    const histogram: Record<string, number> = {};
    let activations = 0;
    let promptsActivating = 0;
    for (const prompt of prompts) {
        const result = match_prompt(view, prompt, 'full', null, null);
        const ids = result.activated_rules.map((a) => String(a.rule));
        if (ids.length > 0) promptsActivating += 1;
        for (const id of ids) {
            histogram[id] = (histogram[id] ?? 0) + 1;
            activations += 1;
        }
    }
    return {
        skills_with_triggers: entries.length,
        prompts: prompts.length,
        activations,
        prompts_activating: promptsActivating,
        histogram: Object.entries(histogram).sort((a, b) =>
            b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1,
        ),
    };
}

export function run(corpus: Case[], router: Router): [CaseResult[], number] {
    const results: CaseResult[] = [];
    let misses = 0;
    for (const c of corpus) {
        const fired = fired_rules(c.prompt, router);
        const expected = c.expect ?? [];
        const missing = expected.filter((r) => !fired.has(r));
        const ok = missing.length === 0;
        if (!ok) {
            misses += 1;
        }
        results.push({ id: c.id, ok, missing, expect: expected });
    }
    return [results, misses];
}

// --- json.dumps(indent=2, sort_keys=True) replica (ensure_ascii default) -----

function _jsonDumps(obj: unknown): string {
    const pad = '  ';
    const enc = (value: unknown, depth: number): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    };
    const encStr = (s: string): string => {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    };
    return enc(obj, 0);
}

interface ParsedArgs {
    json: boolean;
    /** `rule` keeps the pinned byte-identical contract; `skill` is additive. */
    scope: 'rule' | 'skill';
    /** `--ratchet`: compare the skill scope against its published baseline. */
    ratchet: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { json: false, scope: 'rule', ratchet: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i]!;
        if (a === '--json') {
            out.json = true;
        } else if (a === '--ratchet') {
            out.ratchet = true;
        } else if (a === '--scope') {
            const v = argv[i + 1];
            if (v !== 'rule' && v !== 'skill') {
                process.stderr.write(`error: --scope must be rule or skill, got: ${v ?? '(missing)'}\n`);
                process.exit(2);
            }
            out.scope = v;
            i += 1;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: trigger_coverage [-h] [--json] [--scope rule|skill] [--ratchet]\n',
            );
            process.exit(0);
        }
    }
    return out;
}

/**
 * `--scope skill` — report only, never a gate.
 *
 * Exit 0 regardless of the count: no ceiling is committed here. The skill-side
 * census is a NEW number (see the scope's header note on why the rule-side 433
 * is structurally out of reach), and this package does not commit a threshold
 * before it has a reading. A tranche is judged against a published baseline in
 * its own change, not against a number invented on the day the instrument
 * shipped.
 */
/** The published skill-coverage baseline `--ratchet` compares against. */
export const SKILL_RATCHET_BASELINE = path.join(
    REPO_ROOT,
    'agents',
    'evidence',
    'metrics',
    'skill-trigger-coverage-baseline.json',
);

export interface SkillRatchetBaseline {
    skills_with_triggers: number;
    activations: number;
}

/** Read the baseline, or `null` when none is published yet. */
export function loadSkillRatchetBaseline(file = SKILL_RATCHET_BASELINE): SkillRatchetBaseline | null {
    if (!fs.existsSync(file)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        const c = parsed['skills_with_triggers'];
        const a = parsed['activations'];
        if (typeof c !== 'number' || typeof a !== 'number') return null;
        return { skills_with_triggers: c, activations: a };
    } catch {
        return null;
    }
}

export interface RatchetVerdict {
    ok: boolean;
    lines: string[];
}

/**
 * The Phase-3.2 ratchet, as a pure function of two readings.
 *
 * TWO directions, and only one of them is a floor. Coverage
 * (`skills_with_triggers`) may only RISE — a tranche that removes triggers is
 * the regression this exists to catch. Activations over the matrix may only
 * FALL OR HOLD — that is the noise ceiling, and it is the half that makes
 * seeding safe rather than merely measurable.
 *
 * A missing baseline is NOT a pass. It is `ok: false` with a line saying to
 * publish one, because a ratchet that silently no-ops when its baseline is gone
 * is the failure mode a ratchet exists to prevent.
 */
export function ratchetVerdict(
    current: SkillRatchetBaseline,
    baseline: SkillRatchetBaseline | null,
): RatchetVerdict {
    if (baseline === null) {
        return {
            ok: false,
            lines: [
                '❌  no published baseline — cannot ratchet.',
                `    Publish one: {"skills_with_triggers": ${current.skills_with_triggers}, ` +
                    `"activations": ${current.activations}}`,
                `    at agents/evidence/metrics/skill-trigger-coverage-baseline.json`,
            ],
        };
    }
    const lines: string[] = [];
    let ok = true;
    if (current.skills_with_triggers < baseline.skills_with_triggers) {
        ok = false;
        lines.push(
            `❌  coverage fell: ${baseline.skills_with_triggers} → ${current.skills_with_triggers} ` +
                'skills declaring triggers. The ratchet only turns one way.',
        );
    } else {
        lines.push(
            `✅  coverage ${baseline.skills_with_triggers} → ${current.skills_with_triggers} ` +
                'skills declaring triggers.',
        );
    }
    if (current.activations > baseline.activations) {
        ok = false;
        lines.push(
            `❌  matrix activations rose: ${baseline.activations} → ${current.activations}. ` +
                'A tranche may raise coverage only without raising noise.',
        );
    } else {
        lines.push(`✅  matrix activations ${baseline.activations} → ${current.activations}.`);
    }
    return { ok, lines };
}

function runSkillRatchetCli(json: boolean): number {
    const report = runSkillScope(loadSkillTriggers(SKILLS_DIR), loadMatrixPrompts(MATRIX_DIR));
    const current = {
        skills_with_triggers: report.skills_with_triggers,
        activations: report.activations,
    };
    const verdict = ratchetVerdict(current, loadSkillRatchetBaseline());
    if (json) {
        process.stdout.write(_jsonDumps({ current, ok: verdict.ok, lines: verdict.lines }) + '\n');
        return verdict.ok ? 0 : 1;
    }
    for (const line of verdict.lines) process.stdout.write(`${line}\n`);
    process.stdout.write(
        verdict.ok
            ? '\nskill-trigger ratchet: OK\n'
            : '\nskill-trigger ratchet: FAILED\n',
    );
    return verdict.ok ? 0 : 1;
}

function runSkillScopeCli(json: boolean): number {
    const report = runSkillScope(loadSkillTriggers(SKILLS_DIR), loadMatrixPrompts(MATRIX_DIR));
    if (json) {
        process.stdout.write(_jsonDumps(report) + '\n');
        return 0;
    }
    process.stdout.write(
        `skill trigger coverage over ${report.prompts} matrix prompts\n` +
            `  skills declaring triggers: ${report.skills_with_triggers}\n` +
            `  activations:               ${report.activations}\n` +
            `  prompts activating ≥1:     ${report.prompts_activating}\n`,
    );
    if (report.skills_with_triggers === 0) {
        process.stdout.write(
            '\nNo skill declares a trigger yet. That is the schema landing empty of\n' +
                'adopters, not a failure: the capability is declarable before anything\n' +
                'declares it, so a seeded tranche is measurable before it is written.\n',
        );
        return 0;
    }
    process.stdout.write('\nper skill:\n');
    for (const [id, n] of report.histogram) {
        process.stdout.write(`  ${String(n).padStart(4)}  ${id}\n`);
    }
    process.stdout.write(
        '\nReport only — no ceiling is enforced here. The rule-side 433 census is a\n' +
            'different catalogue and cannot move from this scope.\n',
    );
    return 0;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.ratchet && args.scope !== 'skill') {
        process.stderr.write('error: --ratchet requires --scope skill\n');
        return 2;
    }
    if (args.scope === 'skill') {
        return args.ratchet ? runSkillRatchetCli(args.json) : runSkillScopeCli(args.json);
    }

    let isFile = false;
    try {
        isFile = fs.statSync(ROUTER).isFile();
    } catch {
        isFile = false;
    }
    if (!isFile) {
        process.stderr.write(`error: ${ROUTER} missing — run compile_router first\n`);
        return 2;
    }
    const loaded = parseYaml(fs.readFileSync(CORPUS, 'utf-8'), { version: '1.1' }) as
        | Case[]
        | null;
    const corpus: Case[] = loaded ?? [];
    const router = load_router();
    const [results, misses] = run(corpus, router);

    if (args.json) {
        process.stdout.write(
            _jsonDumps({ cases: results.length, misses, results }) + '\n',
        );
    } else {
        for (const r of results) {
            const mark = r.ok ? '✅' : '❌';
            const detail = r.ok ? '' : `  MISSING: ${r.missing.join(', ')}`;
            process.stdout.write(`  ${mark}  ${r.id}${detail}\n`);
        }
        process.stdout.write('\n');
        if (misses) {
            process.stdout.write(
                `❌  trigger-coverage: ${misses}/${results.length} case(s) failed — ` +
                    'a required rule does not fire. Blocking.\n',
            );
        } else {
            process.stdout.write(
                `✅  trigger-coverage: ${results.length}/${results.length} pass\n`,
            );
        }
    }
    return misses ? 1 : 0;
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

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
