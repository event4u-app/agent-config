#!/usr/bin/env tsx
/**
 * Validate the A/B bench corpora + `docs/benchmark.md` shape.
 *
 * TypeScript twin of `src/scripts/lint_bench_ab.py` (ADR-096, Phase 4 /
 * Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet` flag, exit
 * codes (0 success, 1 first violation), stdout/stderr split, byte-identical
 * finding messages (including the `lint_bench_ab: <relpath>: <msg>` prefix
 * and the Python `repr()`-shaped value formatting), same check order, same
 * YAML loader (`yaml.safe_load`).
 *
 * Phase 5 Step 3 of `agents/roadmaps/road-to-package-impact-benchmark.md`.
 *
 * Exit 0 on success, 1 on the first violation (with file + line where
 * possible).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const TRACK_A_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-tracka.yaml');
const TRACK_B_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb.yaml');
const DOCS_PATH = path.join(REPO_ROOT, 'docs', 'benchmark.md');

const REQUIRED_SECTIONS = [
    // docs/benchmark.md is the v2 discipline-axis report (rendered by
    // bench_ab_v2_stats.py --markdown). The v1 Headline/Track-A/Track-B/History
    // structure was retired with the v1 binary-capability frame.
    '## Honesty labels',
    '## Gate verdict',
    '## Methodology',
] as const;

const TRACK_A_CATEGORIES = new Set(['rule', 'skill']);
const TRACK_B_CATEGORIES = new Set(['bugfix', 'feature', 'refactor', 'uiaudit', 'testadd']);

// CPython set-literal repr is hash-ordered, not insertion-ordered. These
// frozen messages reproduce the exact `{...}` text the Python linter emits
// in a category-mismatch finding (verified against CPython 3.x):
//   {'rule', 'skill'}
//   {'testadd', 'feature', 'uiaudit', 'refactor', 'bugfix'}
const _TRACK_A_CATEGORIES_REPR = "{'rule', 'skill'}";
const _TRACK_B_CATEGORIES_REPR = "{'testadd', 'feature', 'uiaudit', 'refactor', 'bugfix'}";

class LintError extends Error {}

function _relTo(p: string): string {
    return path.relative(REPO_ROOT, p);
}

function _fail(p: string, msg: string): never {
    process.stderr.write(`lint_bench_ab: ${_relTo(p)}: ${msg}\n`);
    throw new LintError(msg);
}

/** Python repr() for an arbitrary loaded value, ASCII-shaped. */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'string') {
        let out = "'";
        for (const ch of value) {
            if (ch === '\\') {
                out += '\\\\';
            } else if (ch === "'") {
                out += "\\'";
            } else if (ch === '\n') {
                out += '\\n';
            } else if (ch === '\r') {
                out += '\\r';
            } else if (ch === '\t') {
                out += '\\t';
            } else {
                out += ch;
            }
        }
        return out + "'";
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _pyRepr(v)).join(', ') + ']';
    }
    if (isPlainObject(value)) {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyRepr(k)}: ${_pyRepr(v)}`,
        );
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

function _load(p: string): unknown {
    return parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
}

function _get(obj: unknown, key: string): unknown {
    return isPlainObject(obj) ? (obj as Record<string, unknown>)[key] : undefined;
}

function lint_track_a(): void {
    if (!_exists(TRACK_A_PATH)) {
        _fail(TRACK_A_PATH, 'missing corpus file');
    }
    const data = _load(TRACK_A_PATH);
    if (_get(data, 'version') !== 1) {
        _fail(TRACK_A_PATH, `version must be 1 (got ${_pyRepr(_get(data, 'version'))})`);
    }
    if (_get(data, 'corpus_id') !== 'ab-tracka') {
        _fail(
            TRACK_A_PATH,
            `corpus_id must be 'ab-tracka' (got ${_pyRepr(_get(data, 'corpus_id'))})`,
        );
    }
    const prompts = _get(data, 'prompts') || [];
    if (!Array.isArray(prompts)) {
        _fail(TRACK_A_PATH, 'prompts must be a list');
    }
    if (prompts.length < 30) {
        _fail(TRACK_A_PATH, `prompts must have ≥ 30 entries (found ${prompts.length})`);
    }
    const ids = new Set<unknown>();
    for (let i = 0; i < prompts.length; i += 1) {
        const prompt = prompts[i];
        const loc = `prompts[${i}]`;
        if (!isPlainObject(prompt)) {
            _fail(TRACK_A_PATH, `${loc} must be a mapping`);
        }
        const pid = _get(prompt, 'id');
        if (typeof pid !== 'string' || !pid) {
            _fail(TRACK_A_PATH, `${loc}.id must be a non-empty string`);
        }
        if (ids.has(pid)) {
            _fail(TRACK_A_PATH, `${loc}.id duplicates an earlier id (${_pyRepr(pid)})`);
        }
        ids.add(pid);
        const cat = _get(prompt, 'category');
        if (typeof cat !== 'string' || !TRACK_A_CATEGORIES.has(cat)) {
            _fail(
                TRACK_A_PATH,
                `${loc}.category must be in ${_TRACK_A_CATEGORIES_REPR} (got ${_pyRepr(cat)})`,
            );
        }
        const target = _get(prompt, 'expected_target');
        if (typeof target !== 'string' || !target) {
            _fail(TRACK_A_PATH, `${loc}.expected_target must be a non-empty string`);
        }
        const keywords = _get(prompt, 'expected_keywords');
        if (keywords !== null && keywords !== undefined && !Array.isArray(keywords)) {
            _fail(TRACK_A_PATH, `${loc}.expected_keywords must be a list when present`);
        }
        const pr = _get(prompt, 'prompt');
        if (typeof pr !== 'string' || !pr) {
            _fail(TRACK_A_PATH, `${loc}.prompt must be a non-empty string`);
        }
    }
}

function lint_track_b(): void {
    if (!_exists(TRACK_B_PATH)) {
        _fail(TRACK_B_PATH, 'missing corpus file');
    }
    const data = _load(TRACK_B_PATH);
    if (_get(data, 'version') !== 1) {
        _fail(TRACK_B_PATH, `version must be 1 (got ${_pyRepr(_get(data, 'version'))})`);
    }
    if (_get(data, 'corpus_id') !== 'ab-trackb') {
        _fail(
            TRACK_B_PATH,
            `corpus_id must be 'ab-trackb' (got ${_pyRepr(_get(data, 'corpus_id'))})`,
        );
    }
    const tasks = _get(data, 'tasks') || [];
    if (!Array.isArray(tasks)) {
        _fail(TRACK_B_PATH, 'tasks must be a list');
    }
    if (tasks.length < 10) {
        _fail(TRACK_B_PATH, `tasks must have ≥ 10 entries (found ${tasks.length})`);
    }
    const ids = new Set<unknown>();
    for (let i = 0; i < tasks.length; i += 1) {
        const task = tasks[i];
        const loc = `tasks[${i}]`;
        if (!isPlainObject(task)) {
            _fail(TRACK_B_PATH, `${loc} must be a mapping`);
        }
        const tid = _get(task, 'id');
        if (typeof tid !== 'string' || !tid) {
            _fail(TRACK_B_PATH, `${loc}.id must be a non-empty string`);
        }
        if (ids.has(tid)) {
            _fail(TRACK_B_PATH, `${loc}.id duplicates an earlier id (${_pyRepr(tid)})`);
        }
        ids.add(tid);
        const cat = _get(task, 'category');
        if (typeof cat !== 'string' || !TRACK_B_CATEGORIES.has(cat)) {
            _fail(
                TRACK_B_PATH,
                `${loc}.category must be in ${_TRACK_B_CATEGORIES_REPR} (got ${_pyRepr(cat)})`,
            );
        }
        const pr = _get(task, 'prompt');
        if (typeof pr !== 'string' || !pr) {
            _fail(TRACK_B_PATH, `${loc}.prompt must be a non-empty string`);
        }
        const seeds = _get(task, 'seed_files');
        if (!Array.isArray(seeds)) {
            _fail(TRACK_B_PATH, `${loc}.seed_files must be a list`);
        }
        const crit = _get(task, 'success_criteria');
        if (!isPlainObject(crit) || Object.keys(crit as object).length === 0) {
            _fail(TRACK_B_PATH, `${loc}.success_criteria must be a non-empty mapping`);
        }
    }
}

function lint_doc(quiet: boolean): void {
    if (!_exists(DOCS_PATH)) {
        if (!quiet) {
            process.stdout.write(
                `lint_bench_ab: ${_relTo(DOCS_PATH)} not yet rendered ` +
                    '(run task bench:ab:diff) — skipping doc shape check\n',
            );
        }
        return;
    }
    const body = fs.readFileSync(DOCS_PATH, 'utf-8');
    const missing = REQUIRED_SECTIONS.filter((section) => !body.includes(section));
    if (missing.length) {
        _fail(DOCS_PATH, `missing required sections: ${_pyRepr(missing)}`);
    }
}

interface Args {
    quiet: boolean;
}

function parse_args(argv: readonly string[]): Args {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_bench_ab [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_bench_ab: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return { quiet };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    try {
        lint_track_a();
        lint_track_b();
        lint_doc(args.quiet);
    } catch (exc) {
        if (exc instanceof LintError) {
            return 1;
        }
        throw exc;
    }
    if (!args.quiet) {
        process.stdout.write('lint_bench_ab: OK\n');
    }
    return 0;
}

// --- helpers --------------------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    TRACK_A_PATH,
    TRACK_B_PATH,
    DOCS_PATH,
    REQUIRED_SECTIONS,
    LintError,
    lint_track_a,
    lint_track_b,
    lint_doc,
    parse_args,
    main,
};
