#!/usr/bin/env tsx
/**
 * CI guard for the `ai-council` skill's output-path convention.
 *
 * TypeScript twin of `src/scripts/check_council_layout.py` (ADR-089,
 * Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY — `--quiet`
 * flag (positional anywhere in argv), exit codes (0 clean, 1 violations),
 * stdout, byte-identical finding messages, same `agents/` scan,
 * sorted-iterdir + sorted-rglob ordering, same exemptions. No behaviour
 * changes.
 *
 * Council artefacts belong in three canonical dirs under
 * agents/runtime/council/{questions,responses,sessions}/. The linter
 * catches misplacement: stray council-* files at agents/ root, and
 * council-* files under non-canonical, non-exempt subdirectories.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const AGENTS_ROOT = 'agents';
// Canonical council dirs (relative POSIX paths from AGENTS_ROOT).
const CANONICAL_DIRS: readonly string[] = [
    'runtime/council/questions',
    'runtime/council/responses',
    'runtime/council/sessions',
];
// Top-level subdirectories exempt from the layout check.
const EXEMPT_DIR_PREFIXES = ['audits', 'runtime'] as const;
// `council-` or `.council-` prefix (excludes `road-to-ai-council.md`).
const COUNCIL_PREFIX_RE = /^\.?council-/;

function is_council_artefact(name: string): boolean {
    return COUNCIL_PREFIX_RE.test(name);
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror `sorted(root.iterdir())` — direct children, sorted by full path. */
function _iterdirSorted(root: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(root);
    } catch {
        return [];
    }
    return entries.map((e) => path.join(root, e)).sort();
}

/** Mirror `sorted(root.rglob("*"))` — every descendant, sorted by full path. */
function _rglobAllSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            out.push(full);
            if (entry.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    return out.sort();
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function find_violations(root: string): string[] {
    const findings: string[] = [];
    if (!_isDir(root)) {
        return findings;
    }

    // 1. Stray council artefacts at agents/ root.
    for (const p of _iterdirSorted(root)) {
        if (!_isFile(p)) {
            continue;
        }
        if (is_council_artefact(path.basename(p))) {
            // Mirror Python str(Path) — relative path with the AGENTS_ROOT
            // prefix as constructed (e.g. "agents/council-foo.md").
            findings.push(
                `${_posix(p)}: council artefact at agents/ root — move to ` +
                    `agents/runtime/council/questions/, agents/runtime/council/responses/, ` +
                    `or agents/runtime/council/sessions/ per ai-council § Output path ` +
                    `convention.`,
            );
        }
    }

    // 2. Council artefacts in non-canonical subdirectories.
    for (const p of _rglobAllSorted(root)) {
        if (!_isFile(p) || !is_council_artefact(path.basename(p))) {
            continue;
        }
        const rel = path.relative(root, p);
        const parts = rel.split(path.sep);
        if (parts.length === 1) {
            continue; // already handled above
        }
        const relPosix = parts.join('/');
        if (CANONICAL_DIRS.some((d) => relPosix.startsWith(d + '/'))) {
            continue;
        }
        if (EXEMPT_DIR_PREFIXES.some((d) => parts[0]!.startsWith(d))) {
            continue;
        }
        findings.push(
            `${_posix(p)}: council artefact in non-canonical directory ` +
                `agents/${parts[0]}/ — only ` +
                `agents/runtime/council/{questions,responses,sessions}/ ` +
                `are allowed.`,
        );
    }

    return findings;
}

/** Render a path as POSIX (mirrors str(Path) on the relative agents tree). */
function _posix(p: string): string {
    return p.split(path.sep).join('/');
}

function main(argv: readonly string[]): number {
    const quiet = argv.includes('--quiet');
    const findings = find_violations(AGENTS_ROOT);
    if (findings.length > 0) {
        process.stdout.write('❌  Council layout violations:\n\n');
        for (const f of findings) {
            process.stdout.write(`  - ${f}\n`);
        }
        process.stdout.write(
            '\nRule: .agent-src.uncondensed/skills/ai-council/SKILL.md ' +
                '§ "Output path convention"\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write('✅  Council layout clean.\n');
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}

export {
    AGENTS_ROOT,
    CANONICAL_DIRS,
    EXEMPT_DIR_PREFIXES,
    COUNCIL_PREFIX_RE,
    is_council_artefact,
    find_violations,
    main,
};
