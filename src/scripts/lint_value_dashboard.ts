#!/usr/bin/env tsx
/**
 * Lint `docs/value.md` for structural invariants.
 *
 * TypeScript twin of `src/scripts/lint_value_dashboard.py` (ADR-096,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet`
 * flag, exit codes (0 / 1), stdout/stderr split, byte-identical messages,
 * same check order. No behaviour changes — latent bugs replicated.
 *
 * Output: one violation per line in non-quiet mode; one-line summary in
 * quiet mode. Exit 0 on clean, 1 on any violation.
 *
 * DIVERGENCE CANDIDATE: the malformed-JSON failure path prints the host
 * JSON parser's exception text (`FAIL: latest.json is not valid JSON: …`),
 * which differs between Python's `json.JSONDecodeError` and JS `JSON.parse`.
 * The happy path and every structural check are byte-identical.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DASHBOARD = path.join(REPO_ROOT, 'docs', 'value.md');
const LATEST = path.join(
    REPO_ROOT,
    'internal',
    'bench',
    'reports',
    'value',
    'latest.json',
);

const REQUIRED_SECTIONS = [
    '# Value Dashboard',
    '## Reference scale',
    '## Panel A',
    '## Panel B',
    '## Glossary',
    '**NET',
] as const;

const CANONICAL_RUNG_IDS = ['baseline', 'load', 'thin', 'condense', 'rtk', 'terse'] as const;

type JsonObject = Record<string, unknown>;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _log(msg: string, quiet: boolean, err = false): void {
    if (err) {
        process.stderr.write(msg + '\n');
    } else if (!quiet) {
        process.stdout.write(msg + '\n');
    }
}

function check_required_sections(text: string): string[] {
    return REQUIRED_SECTIONS.filter((section) => !text.includes(section)).map(
        (section) => `missing required section: '${section}'`,
    );
}

function _asArray(v: unknown): unknown[] {
    // Mirror `report.get("cost_ladder", []) or []` — a falsy / absent value
    // becomes an empty list; a list passes through.
    if (Array.isArray(v)) {
        return v;
    }
    return [];
}

function check_source_citations(report: JsonObject): string[] {
    const violations: string[] = [];
    for (const rungU of _asArray(report['cost_ladder'])) {
        const rung = rungU as JsonObject;
        const source = rung['source_report'];
        if (!source) {
            violations.push(`rung '${_g(rung['id'])}' has no source_report field`);
            continue;
        }
        if (typeof source !== 'string' || !source.trim()) {
            violations.push(`rung '${_g(rung['id'])}' has empty source_report`);
        }
    }
    return violations;
}

/** A `measured` rung's source_report must exist on disk. */
function check_confidence_vs_source(report: JsonObject): string[] {
    const violations: string[] = [];
    for (const rungU of _asArray(report['cost_ladder'])) {
        const rung = rungU as JsonObject;
        if (rung['confidence'] !== 'measured') {
            continue;
        }
        const source = (rung['source_report'] as string) || '';
        if (source === '' || source === 'n/a') {
            continue; // baseline rung
        }
        const p = path.join(REPO_ROOT, source);
        if (!_exists(p)) {
            violations.push(
                `rung '${_g(rung['id'])}' is 'measured' but its ` +
                    `source_report does not exist: ${source}`,
            );
        }
    }
    return violations;
}

function check_no_negative_savings(text: string): string[] {
    const violations: string[] = [];
    let in_panel_a = false;
    for (const line of text.split('\n')) {
        if (line.startsWith('## Panel A')) {
            in_panel_a = true;
            continue;
        }
        if (in_panel_a && line.startsWith('## ')) {
            break;
        }
        if (!in_panel_a || !line.startsWith('|')) {
            continue;
        }
        if (!line.includes('Ersparnis')) {
            continue;
        }
        const m = /\|\s*([+-][0-9 ]+)\s*\|/.exec(line);
        if (m && m[1]!.trim().startsWith('+')) {
            const token_value = m[1]!.trim();
            violations.push(
                "row labelled 'Ersparnis' has a positive Δ-token value: " +
                    `${_pyRepr(token_value)} — positive deltas are costs, not savings.`,
            );
        }
    }
    return violations;
}

function check_canonical_rung_set(report: JsonObject): string[] {
    const rungs = _asArray(report['cost_ladder']);
    const ids = rungs.map((r) => (r as JsonObject)['id']);
    if (!_seqEqual(ids, CANONICAL_RUNG_IDS as readonly unknown[])) {
        return [
            `cost_ladder rung ids must be ${_pyTupleRepr(CANONICAL_RUNG_IDS)}, ` +
                `got ${_pyTupleRepr(ids)}`,
        ];
    }
    return [];
}

function _seqEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function lint(quiet = false): number {
    const violations: string[] = [];

    if (!_exists(DASHBOARD)) {
        _log(`FAIL: dashboard not found: ${_relPosix(DASHBOARD, REPO_ROOT)}`, quiet, true);
        return 1;
    }
    const text = fs.readFileSync(DASHBOARD, 'utf-8');
    violations.push(...check_required_sections(text));
    violations.push(...check_no_negative_savings(text));

    if (!_exists(LATEST)) {
        if (violations.length) {
            for (const v of violations) {
                _log(`FAIL: ${v}`, quiet, true);
            }
            return 1;
        }
        _log(
            'lint_value_dashboard: dashboard is a placeholder ' +
                '(no value-v1.json yet) — structural checks pass.',
            false,
        );
        return 0;
    }

    let report: JsonObject;
    try {
        report = JSON.parse(fs.readFileSync(LATEST, 'utf-8')) as JsonObject;
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        _log(`FAIL: ${path.basename(LATEST)} is not valid JSON: ${msg}`, quiet, true);
        return 1;
    }

    violations.push(...check_source_citations(report));
    violations.push(...check_confidence_vs_source(report));
    violations.push(...check_canonical_rung_set(report));

    if (violations.length) {
        for (const v of violations) {
            _log(`FAIL: ${v}`, quiet, true);
        }
        return 1;
    }
    _log(
        'lint_value_dashboard: OK — ' +
            `${_asArray(report['cost_ladder']).length} rungs, ` +
            `${_asArray(report['behaviour']).length} behaviour metrics, all ` +
            'sections present, all sources cited.',
        false,
    );
    return 0;
}

/** Mirror Python's f-string rendering of a value used in `rung.get('id')`. */
function _g(v: unknown): string {
    if (v === undefined || v === null) {
        return 'None';
    }
    return String(v);
}

/** Mirror Python repr() of a string. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

/** Mirror Python repr() of a tuple of (possibly non-string) values. */
function _pyTupleRepr(items: readonly unknown[]): string {
    const parts = items.map((i) => {
        if (typeof i === 'string') {
            return _pyRepr(i);
        }
        if (i === undefined || i === null) {
            return 'None';
        }
        return String(i);
    });
    if (parts.length === 1) {
        return `(${parts[0]},)`;
    }
    return `(${parts.join(', ')})`;
}

function parse_args(argv: readonly string[]): boolean {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_value_dashboard.py [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(
                `usage: lint_value_dashboard.py [-h] [--quiet]\nlint_value_dashboard.py: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return quiet;
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    return lint(args);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type JsonObject,
    REPO_ROOT,
    DASHBOARD,
    LATEST,
    REQUIRED_SECTIONS,
    CANONICAL_RUNG_IDS,
    check_required_sections,
    check_source_citations,
    check_confidence_vs_source,
    check_no_negative_savings,
    check_canonical_rung_set,
    lint,
    main,
};
