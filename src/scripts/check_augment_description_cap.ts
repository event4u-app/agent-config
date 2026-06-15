#!/usr/bin/env tsx
/**
 * Auto-rule description-length CI gate (Phase 1.3 of
 * road-to-augment-limit-fit).
 *
 * TypeScript twin of `src/scripts/check_augment_description_cap.py` (ADR-096,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — no flags, exit
 * codes (0 pass, 1 over-cap), stdout/stderr split, byte-identical finding
 * messages, same scan scope (`.agent-src.uncondensed/rules/*.md`) and file
 * ordering. No behaviour changes — latent bugs replicated.
 *
 * For every `type: auto` rule under `.agent-src.uncondensed/rules/`,
 * fail CI when the frontmatter `description:` exceeds DESC_CAP chars.
 *
 * Why: Augment injects each auto-rule's description into the
 * workspace-guidelines registry stub. Empirical 2026-05-08 budget
 * analysis showed this channel consuming 25 % of the 49,512-char
 * ceiling. Capping descriptions guards future drift.
 *
 * Source of truth: `.agent-src.uncondensed/rules/`. The condensed
 * projection is regenerated; the source dictates what ships.
 *
 * Exit codes: 0 = pass, 1 = at least one rule over cap.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// src/scripts/check_augment_description_cap.ts → two dirs up is the repo root.
// Mirrors the Python `Path(__file__).resolve().parent.parent.parent`.
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const RULES_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'rules');
const DESC_CAP = 150;

const _FM_LINE_RE = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/;

export function parse_frontmatter(text: string): Record<string, string> {
    if (!text.startsWith('---\n')) {
        return {};
    }
    const end = text.indexOf('\n---', 4);
    if (end < 0) {
        return {};
    }
    const fm: Record<string, string> = {};
    for (const line of text.slice(4, end).split('\n')) {
        const m = _FM_LINE_RE.exec(line);
        if (m) {
            fm[m[1] as string] = _strip_quotes((m[2] as string).trim());
        }
    }
    return fm;
}

/** Mirror Python `.strip('"').strip("'")` — strip surrounding double then single quotes. */
function _strip_quotes(s: string): string {
    let v = _trimChar(s, '"');
    v = _trimChar(v, "'");
    return v;
}

function _trimChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) {
        start++;
    }
    while (end > start && s[end - 1] === ch) {
        end--;
    }
    return s.slice(start, end);
}

/** Sorted `*.md` glob over RULES_DIR top level (mirrors `RULES_DIR.glob("*.md")` sorted). */
function _globMdSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

export function main(): number {
    const failures: Array<[string, number, string]> = [];
    let checked = 0;

    for (const p of _globMdSorted(RULES_DIR)) {
        const text = fs.readFileSync(p, 'utf-8');
        const fm = parse_frontmatter(text);
        if (fm['type'] !== 'auto') {
            continue;
        }
        const desc = fm['description'] ?? '';
        checked += 1;
        if (desc.length > DESC_CAP) {
            failures.push([path.basename(p), desc.length, desc]);
        }
    }

    if (failures.length) {
        process.stderr.write(
            `❌  ${failures.length} auto-rule description(s) exceed ${DESC_CAP} chars:\n\n`,
        );
        for (const [name, dlen, desc] of [...failures].sort((a, b) => b[1] - a[1])) {
            process.stderr.write(`  [${String(dlen).padStart(3, ' ')}] ${name}\n`);
            process.stderr.write(`        ${desc}\n`);
        }
        process.stderr.write(
            `\n  Guard rationale: each char in an auto-rule description ` +
                `costs one char in the\n  Augment workspace-guidelines budget ` +
                `(cap 49,512). Trim to ≤ ${DESC_CAP}.\n`,
        );
        return 1;
    }

    process.stdout.write(`✅  All ${checked} auto-rule descriptions ≤ ${DESC_CAP} chars.\n`);
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO_ROOT, RULES_DIR, DESC_CAP };
