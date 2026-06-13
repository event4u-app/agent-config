#!/usr/bin/env tsx
/**
 * Linter for `.github/topics.yml`.
 *
 * TypeScript twin of `src/scripts/lint_topics_yaml.py` (ADR-094, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract EXACTLY — same scan target,
 * finding messages (incl. Python `repr()` rendering of offending values),
 * stdout/stderr split, exit codes, and the `--quiet` flag read directly
 * from argv at module load. No behaviour changes — latent bugs replicated.
 *
 * Asserts:
 *   * file exists and parses as YAML
 *   * `topics:` is a non-empty list
 *   * every topic matches `^[a-z0-9][a-z0-9-]*$` and is ≤ 50 chars
 *   * no duplicates
 *   * `notes:` key exists (may be empty mapping/string), so the
 *     rationale slot is never silently dropped
 *   * `equivalents:` (if present) is a mapping whose keys are all
 *     listed in `topics:`
 *
 * Exit codes: 0 = clean, 1 = error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml, YAMLParseError } from 'yaml';

// src/scripts/lint_topics_yaml.ts → two dirs up is the repo root
// (mirrors Path(__file__).resolve().parents[2]).
const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const TOPICS_FILE = path.join(ROOT, '.github', 'topics.yml');
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const QUIET = process.argv.includes('--quiet');

/** POSIX relative path of `target` under `root` (str(Path.relative_to)). */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Render a value the way Python's `repr()` / `{x!r}` would for the values
 * that flow into the finding messages: strings (single-quoted, with escape
 * of backslash / the quote / control chars) and the scalars YAML can yield
 * (numbers, booleans `True`/`False`, `None`, lists, dicts). Used for the
 * `non-string topic entry: {t!r}` / `topic too long (>50 chars): {t!r}` etc.
 */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'string') {
        return _pyReprStr(value);
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return String(value);
        }
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyRepr(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyRepr(k)}: ${_pyRepr(v)}`,
        );
        return `{${parts.join(', ')}}`;
    }
    return String(value);
}

function _pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const useDouble = hasSingle && !hasDouble;
    const quote = useDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    if (useDouble) {
        body = body.replace(/"/g, '\\"');
    } else {
        body = body.replace(/'/g, "\\'");
    }
    body = body.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    return `${quote}${body}${quote}`;
}

function _fail(msg: string): void {
    process.stderr.write(`❌  topics.yml: ${msg}\n`);
}

function main(): number {
    if (!_exists(TOPICS_FILE)) {
        _fail(`missing file: ${_relTo(TOPICS_FILE, ROOT)}`);
        return 1;
    }
    let doc: unknown;
    try {
        const raw = parseYaml(fs.readFileSync(TOPICS_FILE, 'utf-8'), { version: '1.1' });
        doc = raw ?? {};
    } catch (e) {
        if (e instanceof YAMLParseError) {
            _fail(`YAML parse error: ${e.message}`);
            return 1;
        }
        throw e;
    }

    const errors: string[] = [];

    const docObj =
        doc !== null && typeof doc === 'object' && !Array.isArray(doc)
            ? (doc as Record<string, unknown>)
            : ({} as Record<string, unknown>);

    let topics = docObj['topics'];
    if (!Array.isArray(topics) || topics.length === 0) {
        errors.push('`topics:` must be a non-empty list');
        topics = [];
    }

    const seen = new Set<string>();
    for (const t of topics as unknown[]) {
        if (typeof t !== 'string') {
            errors.push(`non-string topic entry: ${_pyRepr(t)}`);
            continue;
        }
        if (t.length > 50) {
            errors.push(`topic too long (>50 chars): ${_pyRepr(t)}`);
        }
        if (!SLUG_RE.test(t)) {
            errors.push(`invalid slug (expect ^[a-z0-9][a-z0-9-]*$): ${_pyRepr(t)}`);
        }
        if (seen.has(t)) {
            errors.push(`duplicate topic: ${_pyRepr(t)}`);
        }
        seen.add(t);
    }

    if (!('notes' in docObj)) {
        errors.push('`notes:` key missing (may be empty, but must be present)');
    }

    const equivalents = docObj['equivalents'];
    if (equivalents !== undefined && equivalents !== null) {
        if (
            typeof equivalents !== 'object' ||
            Array.isArray(equivalents)
        ) {
            errors.push('`equivalents:` must be a mapping');
        } else {
            for (const [key, val] of Object.entries(
                equivalents as Record<string, unknown>,
            )) {
                if (!seen.has(key)) {
                    errors.push(`\`equivalents:\` key ${_pyRepr(key)} not in \`topics:\``);
                }
                if (
                    !Array.isArray(val) ||
                    !val.every((v) => typeof v === 'string')
                ) {
                    errors.push(`\`equivalents.${key}\` must be a list of strings`);
                }
            }
        }
    }

    if (errors.length > 0) {
        for (const e of errors) {
            _fail(e);
        }
        return 1;
    }

    if (!QUIET) {
        process.stdout.write(
            `✅  topics.yml: ${(topics as unknown[]).length} topic(s), all valid\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, TOPICS_FILE, SLUG_RE, main };
