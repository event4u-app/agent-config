#!/usr/bin/env tsx
/**
 * Lint Phase-4 discovery frontmatter on every artefact.
 *
 * TypeScript twin of `src/scripts/lint_artefact_frontmatter.py` (ADR-090,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet`
 * flag, exit codes (0 clean, 1 violation), stdout/stderr split,
 * byte-identical finding messages (including Python-shaped list repr),
 * same scan trees and order, same `validate_frontmatter.parse_frontmatter`
 * splitter, same closed vocabularies.
 *
 * Walks skills / rules / commands / templates under `.agent-src.uncondensed/`
 * and asserts per-file that the five ADR-013 keys are present and
 * well-formed.
 *
 * Exits 0 clean, 1 on any violation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { parse_frontmatter } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);

// Module-level paths are test seams (the Python tests monkeypatch ROOT / SRC
// / VOCAB_DIR). Mutable lets + setters mirror that.
let ROOT = path.resolve(path.dirname(_HERE), '..', '..');
let SRC = path.join(ROOT, '.agent-src.uncondensed');
let VOCAB_DIR = path.join(ROOT, 'src', 'config', 'discovery');

/** Test seam: override the module-level scan roots (mirrors monkeypatch). */
function _set_paths(opts: { root?: string; src?: string; vocabDir?: string }): void {
    if (opts.root !== undefined) {
        ROOT = opts.root;
    }
    if (opts.src !== undefined) {
        SRC = opts.src;
    }
    if (opts.vocabDir !== undefined) {
        VOCAB_DIR = opts.vocabDir;
    }
}

const LIFECYCLES = new Set(['active', 'deprecated', 'experimental', 'archived']);
const TRUST_LEVELS = new Set([
    'core',
    'professional',
    'experimental',
    'advisory',
    'restricted',
]);
const TRUST_CONFIDENCE = new Set(['high', 'medium', 'low']);

function _load_vocab(): [Set<string>, Set<string>, Set<string>] {
    const ws = (parseYaml(fs.readFileSync(path.join(VOCAB_DIR, 'workspaces.yml'), 'utf-8'), {
        version: '1.1',
    }) || []) as Array<Record<string, unknown>>;
    const packs = (parseYaml(fs.readFileSync(path.join(VOCAB_DIR, 'packs.yml'), 'utf-8'), {
        version: '1.1',
    }) || []) as Array<Record<string, unknown>>;
    const rawUn = (parseYaml(
        fs.readFileSync(path.join(VOCAB_DIR, 'unassigned-artefacts.yml'), 'utf-8'),
        { version: '1.1' },
    ) || []) as Array<Record<string, unknown>>;
    const wsIds = new Set(ws.map((e) => e['id'] as string));
    const packIds = new Set(packs.map((e) => e['id'] as string));
    const quarantine = new Set(rawUn.map((e) => e['path'] as string));
    return [wsIds, packIds, quarantine];
}

function _iter_artefacts(): string[] {
    const out: string[] = [];
    for (const p of _rglobSorted(path.join(SRC, 'skills'), 'SKILL.md')) {
        out.push(p);
    }
    for (const p of _rglobSorted(path.join(SRC, 'rules'), '*.md')) {
        out.push(p);
    }
    for (const p of _rglobSorted(path.join(SRC, 'commands'), '*.md')) {
        out.push(p);
    }
    if (_exists(path.join(SRC, 'templates'))) {
        for (const p of _rglobSorted(path.join(SRC, 'templates'), '*.md')) {
            out.push(p);
        }
    }
    return out;
}

function _check_one(
    p: string,
    wsIds: Set<string>,
    packIds: Set<string>,
    quarantine: Set<string>,
): string[] {
    const rel = _relPosix(p);
    const errs: string[] = [];
    if (quarantine.has(rel)) {
        const text = fs.readFileSync(p, 'utf-8');
        const [fm] = parse_frontmatter(text);
        if (
            isPlainObject(fm) &&
            ['workspaces', 'packs', 'lifecycle', 'trust', 'install'].some((k) => k in fm)
        ) {
            errs.push(
                `${rel}: quarantined in unassigned-artefacts.yml but carries` +
                    ' discovery frontmatter — remove one or the other.',
            );
        }
        return errs;
    }

    const text = fs.readFileSync(p, 'utf-8');
    const [fm] = parse_frontmatter(text);
    if (!isPlainObject(fm)) {
        errs.push(`${rel}: missing or unparseable frontmatter`);
        return errs;
    }

    for (const key of ['workspaces', 'packs', 'lifecycle', 'trust', 'install']) {
        if (!(key in fm)) {
            errs.push(`${rel}: missing required key \`${key}\``);
        }
    }
    if (errs.length) {
        return errs;
    }

    const ws = fm['workspaces'];
    if (!Array.isArray(ws) || ws.length === 0) {
        errs.push(`${rel}: workspaces must be a non-empty list`);
    } else {
        const bad = ws.filter((w) => !wsIds.has(w as string));
        if (bad.length) {
            errs.push(`${rel}: workspaces not in workspaces.yml: ${_pyRepr(bad)}`);
        }
    }

    const packs = fm['packs'];
    if (!Array.isArray(packs) || packs.length === 0) {
        errs.push(`${rel}: packs must be a non-empty list`);
    } else {
        const bad = packs.filter((p2) => !packIds.has(p2 as string));
        if (bad.length) {
            errs.push(`${rel}: packs not in packs.yml: ${_pyRepr(bad)}`);
        }
    }

    if ('pack' in fm) {
        const owner = fm['pack'];
        if (typeof owner !== 'string' || !packIds.has(owner)) {
            errs.push(`${rel}: pack \`${owner}\` not a known pack id in packs.yml`);
        }
    }

    const lc = fm['lifecycle'];
    if (typeof lc !== 'string' || !LIFECYCLES.has(lc)) {
        errs.push(`${rel}: lifecycle \`${lc}\` not in ${_sortedListRepr(LIFECYCLES)}`);
    }

    const trust = fm['trust'];
    if (!isPlainObject(trust)) {
        errs.push(`${rel}: trust must be a mapping`);
    } else {
        const level = (trust as Record<string, unknown>)['level'];
        if (typeof level !== 'string' || !TRUST_LEVELS.has(level)) {
            errs.push(
                `${rel}: trust.level \`${_unwrap(level)}\` not in ${_sortedListRepr(TRUST_LEVELS)}`,
            );
        }
        const confidence = (trust as Record<string, unknown>)['confidence'];
        if (typeof confidence !== 'string' || !TRUST_CONFIDENCE.has(confidence)) {
            errs.push(
                `${rel}: trust.confidence \`${_unwrap(confidence)}\` not in` +
                    ` ${_sortedListRepr(TRUST_CONFIDENCE)}`,
            );
        }
        const hrr = (trust as Record<string, unknown>)['human_review_required'];
        if (typeof hrr !== 'boolean') {
            errs.push(`${rel}: trust.human_review_required must be bool`);
        }
    }

    const install = fm['install'];
    if (!isPlainObject(install)) {
        errs.push(`${rel}: install must be a mapping`);
    } else {
        if (typeof (install as Record<string, unknown>)['default'] !== 'boolean') {
            errs.push(`${rel}: install.default must be bool`);
        }
        if (typeof (install as Record<string, unknown>)['removable'] !== 'boolean') {
            errs.push(`${rel}: install.removable must be bool`);
        }
    }
    return errs;
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
            process.stdout.write('usage: lint_artefact_frontmatter [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_artefact_frontmatter: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return { quiet };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const [wsIds, packIds, quarantine] = _load_vocab();
    const artefacts = _iter_artefacts();
    const allErrs: string[] = [];
    for (const p of artefacts) {
        allErrs.push(..._check_one(p, wsIds, packIds, quarantine));
    }

    if (allErrs.length) {
        for (const e of allErrs) {
            process.stderr.write(`ERROR: ${e}\n`);
        }
        process.stderr.write(
            `\n${allErrs.length} violation(s) across ${artefacts.length} artefact(s).\n`,
        );
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write(
            `✅  lint-artefact-frontmatter: ${artefacts.length} artefact(s) clean` +
                ` (quarantine: ${quarantine.size}).\n`,
        );
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

/** Recursive glob matching `Path.rglob(pattern)`, returned sorted by full path. */
function _rglobSorted(root: string, pattern: string): string[] {
    const out: string[] = [];
    const matchExt = pattern === '*.md' ? '.md' : null;
    const matchExact = pattern === 'SKILL.md' ? 'SKILL.md' : null;
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile()) {
                if (matchExact !== null && e.name === matchExact) {
                    out.push(full);
                } else if (matchExt !== null && e.name.endsWith(matchExt)) {
                    out.push(full);
                }
            }
        }
    };
    if (_exists(root)) {
        walk(root);
    }
    return out.sort();
}

function _relPosix(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Render a value the way Python embeds it in `\`${value}\`` — None for null. */
function _unwrap(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    return String(v);
}

/** Mirror Python list repr of strings: ['a', 'b']. */
function _pyRepr(arr: unknown[]): string {
    return '[' + arr.map((x) => _pyReprScalar(x)).join(', ') + ']';
}

function _pyReprScalar(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    if (typeof v === 'string') {
        return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(v);
}

/** Mirror Python `sorted(set)` repr as a list literal of single-quoted strings. */
function _sortedListRepr(s: Set<string>): string {
    return '[' + [...s].sort().map((x) => `'${x}'`).join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    LIFECYCLES,
    TRUST_LEVELS,
    TRUST_CONFIDENCE,
    _set_paths,
    _load_vocab,
    _iter_artefacts,
    _check_one,
    parse_args,
    main,
};
