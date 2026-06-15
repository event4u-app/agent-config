#!/usr/bin/env tsx
/**
 * Token-Optimizer freshness validator.
 *
 * TypeScript twin of `src/scripts/check_token_optimizer_freshness.py` (ADR-096,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — no flags,
 * exit codes (0 clean, 1 drift / missing skill / unparseable), stdout/stderr
 * split, byte-identical messages, the same catalog-row parsing, the same
 * `resolve()` / `is_external()` logic and the same `_lib/agent_src`
 * resolution. No behaviour changes — latent bugs replicated.
 *
 * Parses the catalog table inside the token-optimizer SKILL.md, verifies
 * every cited internal asset exists, and checks the trigger keywords against
 * each target file. Fails on missing target OR keyword mismatch.
 *
 * Exit codes: 0 = clean, 1 = drift / error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_logical, strip_source_prefix } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Post-ADR-017 the source-of-truth lives under whichever package owns
// the skill; resolve_logical() walks every artefact root.
const SKILL =
    resolve_logical('skills/token-optimizer/SKILL.md') ??
    path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills', 'token-optimizer', 'SKILL.md');

// Catalog row pattern: | name | path | keywords | description |
const ROW_RE =
    /^\|\s*`?(?<name>[^`|]+?)`?\s*\|\s*(?<path>[^|]+?)\s*\|\s*(?<keywords>[^|]+?)\s*\|\s*(?<desc>[^|]+?)\s*\|\s*$/;
const KW_RE = /`([^`]+)`/g;

interface Row {
    name: string;
    path: string;
    keywords: string;
    desc: string;
}

function parse_catalog(text: string): Row[] {
    const rows: Row[] = [];
    let inCatalog = false;
    for (const line of text.split('\n')) {
        if (line.trim().startsWith('## ')) {
            inCatalog = line.trim() === '## Catalog';
            continue;
        }
        if (!inCatalog) {
            continue;
        }
        if (line.startsWith('|---') || line.startsWith('| Asset')) {
            continue;
        }
        const m = ROW_RE.exec(line);
        if (!m) {
            continue;
        }
        const g = m.groups!;
        rows.push({
            name: g['name']!.trim(),
            path: g['path']!.trim(),
            keywords: g['keywords']!.trim(),
            desc: g['desc']!.trim(),
        });
    }
    return rows;
}

function is_external(p: string): boolean {
    const lc = p.toLowerCase();
    return (
        lc.startsWith('upstream:') ||
        lc.startsWith('http://') ||
        lc.startsWith('https://') ||
        lc.startsWith('tbd') ||
        lc.includes('github.com')
    );
}

function resolve(p: string): string | null {
    if (is_external(p)) {
        return null;
    }
    let cleaned = p.trim().replace(/^`+/, '').replace(/`+$/, '');
    // cleaned.split(")")[0].lstrip("[(")
    cleaned = cleaned.split(')')[0]!.replace(/^[[(]+/, '');
    // Catalog rows still cite the legacy .agent-src.uncondensed/ prefix
    // for compactness; resolve those across every packages/* root.
    const logical = strip_source_prefix(cleaned);
    if (logical !== null) {
        const hit = resolve_logical(logical);
        if (hit !== null) {
            return hit;
        }
    }
    return path.resolve(REPO_ROOT, cleaned);
}

function check_row(row: Row): string[] {
    const errs: string[] = [];
    if (is_external(row.path)) {
        return errs;
    }
    const target = resolve(row.path);
    let exists = false;
    if (target !== null) {
        try {
            exists = fs.statSync(target) !== undefined;
        } catch {
            exists = false;
        }
    }
    if (target === null || !exists) {
        errs.push(`[${row.name}] target missing: ${row.path}`);
        return errs;
    }
    const body = fs.readFileSync(target, 'utf-8').toLowerCase();
    KW_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = KW_RE.exec(row.keywords)) !== null) {
        const kwLc = m[1]!.trim().toLowerCase();
        if (!kwLc) {
            continue;
        }
        if (!body.includes(kwLc)) {
            errs.push(
                `[${row.name}] trigger keyword '${m[1]}' not found in ` +
                    `${row.path} — catalog row may be stale`,
            );
        }
    }
    return errs;
}

function main(): number {
    let skillExists = false;
    try {
        skillExists = fs.statSync(SKILL) !== undefined;
    } catch {
        skillExists = false;
    }
    if (!skillExists) {
        process.stderr.write(`ERROR: token-optimizer skill not found at ${SKILL}\n`);
        return 1;
    }
    const text = fs.readFileSync(SKILL, 'utf-8');
    const rows = parse_catalog(text);
    if (rows.length === 0) {
        process.stderr.write('ERROR: token-optimizer SKILL.md has no parseable catalog rows\n');
        return 1;
    }
    const allErrs: string[] = [];
    let checked = 0;
    for (const row of rows) {
        const errs = check_row(row);
        allErrs.push(...errs);
        if (!is_external(row.path)) {
            checked += 1;
        }
    }
    process.stdout.write(
        `token-optimizer freshness: ${rows.length} catalog rows, ` +
            `${checked} internal targets checked, ${allErrs.length} drift signal(s)\n`,
    );
    for (const e of allErrs) {
        process.stdout.write(`  FAIL  ${e}\n`);
    }
    return allErrs.length ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { SKILL, ROW_RE, parse_catalog, is_external, resolve, check_row, main };
