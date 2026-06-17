#!/usr/bin/env tsx
/**
 * Lint trigger-eval freshness — corpus-backed skills must carry a current
 * `upstream.last_eval` (the corpus-refresh DoD, ADR-061 §6 + road-to-image-brand-
 * typography Phase D).
 *
 * TypeScript twin of `src/scripts/lint_eval_freshness.py` (ADR-200,
 * Python→TypeScript migration). The CLI contract is mirrored EXACTLY — the
 * `--quiet` flag, the `argparse` usage / error text (`-h`/`--help` → exit 0,
 * unknown arg → exit 2), the scan order (`sorted(SKILLS_DIR.glob(
 * "<skill>/data/manifest.json"))` — pathlib component-wise sort), byte-identical
 * finding lines (errors to stderr, OK line to stdout), and exit codes (0 clean /
 * 1 on a missing-or-stale in-scope skill). snake_case kept.
 *
 * Deterministic, no token spend: it only reads on-disk manifests. The live eval
 * (`task test-triggers-live`) and the recording (`agent-config eval:record`) are
 * separate, spend-bearing steps; this gate verifies the *result* was recorded and
 * is still attached to the pinned SHA.
 *
 * A skill is in scope when ALL hold:
 *   - it ships `evals/triggers.json` (it is description-routed), AND
 *   - it has a corpus `data/manifest.json`, AND
 *   - that manifest's `upstream` is an object carrying a non-null `sha`.
 *
 * `upstream: null` (an original-authored corpus with no upstream pin — e.g. the
 * `brand` corpus) is OUT of scope: there is no SHA to attach an eval to, so there
 * is nothing to keep fresh. Such corpora are skipped, not failed.
 *
 * For an in-scope skill the gate fails when:
 *   - `upstream.last_eval` is absent (never recorded), OR
 *   - `last_eval.sha_at_eval` != `upstream.sha` (recorded against a stale pin —
 *     the SHA bumped without a re-eval).
 *
 * Exit codes:
 *   0  all in-scope skills have a current last_eval (or none are in scope)
 *   1  at least one in-scope skill is missing / stale
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// REPO = Path(__file__).resolve().parents[2]
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
// Mutable binding so tests can sandbox the scan target (mirrors the pytest
// monkeypatch.setattr seam used by sibling lint twins).
let SKILLS_DIR = path.join(REPO, 'src', 'skills');

function _setSkillsDirForTest(p: string): void {
    SKILLS_DIR = p;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function _isPlainObject(v: unknown): v is { [k: string]: JsonValue } {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Python `json.loads(path.read_text())`; None on OSError / ValueError. */
function _load_json(p: string): { [k: string]: JsonValue } | null {
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    // Python returns whatever json.loads yields (could be a non-dict); the
    // caller only ever does `.get(...)`, so a non-dict would raise. In practice
    // manifests are objects. Mirror: return the parsed value, typed loosely.
    return parsed as { [k: string]: JsonValue } | null;
}

/**
 * sorted(SKILLS_DIR.glob("*\/data/manifest.json"))
 *
 * pathlib sorts the resulting PosixPath objects, which compare component-wise
 * on their string parts. Since every match has the identical tail
 * (`<skill>/data/manifest.json`), the effective ordering is by skill-dir name,
 * codepoint-ascending — reproduced here by sorting the absolute paths (the
 * shared prefix + identical tail make full-path sort equivalent).
 */
function _manifestPaths(): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const ent of entries) {
        const skillDir = path.join(SKILLS_DIR, ent.name);
        const isDir = ent.isDirectory() || (ent.isSymbolicLink() && _isDirPath(skillDir));
        if (!isDir) {
            continue;
        }
        const manifest = path.join(skillDir, 'data', 'manifest.json');
        if (_isFilePath(manifest)) {
            out.push(manifest);
        }
    }
    out.sort();
    return out;
}

function _isDirPath(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFilePath(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Python repr() of a string (single-quote preference, ASCII-shaped). */
function _pyStrRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    let out = "'";
    for (const ch of s) {
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

/** Python repr() for an arbitrary JSON value (the `!r` formatting in messages). */
function _pyRepr(v: JsonValue | undefined): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    if (typeof v === 'string') {
        return _pyStrRepr(v);
    }
    if (Array.isArray(v)) {
        return `[${v.map((x) => _pyRepr(x)).join(', ')}]`;
    }
    const obj = v as { [k: string]: JsonValue };
    const parts = Object.keys(obj).map((k) => `${_pyStrRepr(k)}: ${_pyRepr(obj[k])}`);
    return `{${parts.join(', ')}}`;
}

/** Return a list of freshness violations (empty = clean). */
function check(): string[] {
    const errors: string[] = [];
    if (!_exists(SKILLS_DIR)) {
        return errors;
    }

    for (const manifest_path of _manifestPaths()) {
        const skill_dir = path.dirname(path.dirname(manifest_path));
        const skill = path.basename(skill_dir);

        // In scope only if the skill is description-routed (ships triggers).
        if (!_exists(path.join(skill_dir, 'evals', 'triggers.json'))) {
            continue;
        }

        const manifest = _load_json(manifest_path);
        if (manifest === null) {
            errors.push(`${skill}: manifest.json is unreadable / invalid JSON`);
            continue;
        }

        const upstream = _isPlainObject(manifest) ? manifest['upstream'] : undefined;
        // Out of scope: no upstream pin (original-authored corpus, e.g. brand).
        if (!_isPlainObject(upstream)) {
            continue;
        }
        const sha = upstream['sha'];
        if (!_pyTruthy(sha)) {
            continue;
        }

        const last_eval = upstream['last_eval'];
        if (!_isPlainObject(last_eval)) {
            errors.push(
                `${skill}: ships evals/triggers.json + a SHA-pinned manifest but ` +
                    `has no \`upstream.last_eval\` — run the live eval and ` +
                    `\`agent-config eval:record\` (ADR-061 §6 refresh DoD).`,
            );
            continue;
        }
        const sha_at_eval = last_eval['sha_at_eval'];
        if (!_pyEq(sha_at_eval, sha)) {
            errors.push(
                `${skill}: \`upstream.last_eval.sha_at_eval\` (${_pyRepr(sha_at_eval ?? null)}) != ` +
                    `\`upstream.sha\` (${_pyRepr(sha)}) — the corpus moved since the last eval; ` +
                    `re-run the live eval and re-record.`,
            );
        }
    }

    return errors;
}

/** Python truthiness for the values that appear here (None / "" / 0 / [] / {} falsy). */
function _pyTruthy(v: JsonValue | undefined): boolean {
    if (v === null || v === undefined) {
        return false;
    }
    if (typeof v === 'boolean') {
        return v;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    return Object.keys(v).length > 0;
}

/** Python `==` for the JSON values compared here (sha_at_eval != sha). */
function _pyEq(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
    if (a === undefined || b === undefined) {
        return a === b;
    }
    if (typeof a !== 'object' && typeof b !== 'object') {
        return a === b;
    }
    return JSON.stringify(a) === JSON.stringify(b);
}

interface Args {
    quiet: boolean;
}

const _PROG = 'lint_eval_freshness.py';

function _usage(): string {
    return `usage: ${_PROG} [-h] [--quiet]\n`;
}

function _parseArgs(argv: readonly string[]): { args?: Args; exitCode?: number } {
    // argparse: -h/--help is an action that fires immediately (exit 0), even
    // when other args follow. All other unrecognized args are collected and
    // reported together, space-joined; --quiet is consumed (not listed).
    let quiet = false;
    const unrecognized: string[] = [];
    for (const arg of argv) {
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(_usage());
            return { exitCode: 0 };
        }
        if (arg === '--quiet') {
            quiet = true;
        } else {
            unrecognized.push(arg);
        }
    }
    if (unrecognized.length) {
        process.stderr.write(
            _usage() + `${_PROG}: error: unrecognized arguments: ${unrecognized.join(' ')}\n`,
        );
        return { exitCode: 2 };
    }
    return { args: { quiet } };
}

function main(argv?: readonly string[]): number {
    const parsed = _parseArgs(argv ?? process.argv.slice(2));
    if (parsed.exitCode !== undefined) {
        return parsed.exitCode;
    }
    const args = parsed.args as Args;

    const errors = check();
    if (errors.length) {
        process.stderr.write('eval-freshness: corpus-backed skills missing a current last_eval:\n');
        for (const e of errors) {
            process.stderr.write(`  - ${e}\n`);
        }
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write(
            '✅  eval-freshness: all SHA-pinned corpus skills carry a current upstream.last_eval.\n',
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export { REPO, SKILLS_DIR, _setSkillsDirForTest, check, main };
