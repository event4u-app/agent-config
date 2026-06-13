#!/usr/bin/env tsx
/**
 * CI guard for the council clause of the `no-roadmap-references` rule.
 *
 * TypeScript twin of `src/scripts/check_council_references.py` (ADR-094,
 * Phase 4 / Wave 4a). The CLI contract is mirrored EXACTLY — `--quiet`
 * flag, exit codes (0 clean, 1 forbidden refs), stdout/stderr split,
 * byte-identical finding + footer text, same scan roots / order, and the
 * same STRUCTURAL_CARVEOUTS logic. No behaviour changes — latent bugs
 * replicated.
 *
 * Council artefacts under `agents/runtime/council/{questions,responses,sessions}/`
 * are gitignored, local-only, and auto-pruned. A link to a specific
 * council file rots three ways: gitignored (not in cloned repo),
 * pruned after the retention window (gone even locally), and the
 * installed `.augment/` projection cannot follow a path that does not
 * exist in the consumer.
 *
 * This linter scans durable artefacts for forbidden links to specific
 * council files. Directory mentions and placeholder paths
 * (`<timestamp>`, `<topic-slug>`) are allowed — they document the
 * output-path convention, not a live reference.
 *
 * Forbidden hits in this codebase exist today (kernel-membership ADRs
 * cite real session JSONs as decision traces). Two source/target shapes
 * are exempt structurally — see STRUCTURAL_CARVEOUTS below — because
 * they encode immutable decision provenance, not transient drafting
 * state. Anything else needs an inline pragma at the end of the line.
 *
 * Exit codes:
 *   0 — no forbidden references.
 *   1 — at least one forbidden reference found.
 *
 * Invocation (from project root):
 *   ./scripts-run src/scripts/check_council_references
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots, strip_source_prefix } from './_lib/agent_src.js';

const QUIET = process.argv.includes('--quiet');

// Module-level repo root. Mirrors the Python `ROOT = Path(".")` constant
// that tests monkeypatch. Mutable via `_setRootForTest` (the TS analogue of
// `monkeypatch.setattr(ccr, "ROOT", Path("."))`).
let ROOT = '.';

/** Test seam — analogue of `monkeypatch.setattr(ccr, "ROOT", ...)`. */
function _setRootForTest(root: string): void {
    ROOT = root;
}

// A specific file inside a council dir: must end with .md or .json,
// must NOT contain `<` or `>` (placeholders), must NOT contain backticks
// or quotes (those are line delimiters, not path content).
const PATTERN =
    /agents\/runtime\/council\/(?:questions|responses|sessions)\/([^\s"'<>)\]`]+\.(?:md|json))/g;

// Only these durable surfaces are scanned. Archive, analysis, and the
// council dirs themselves are excluded by design.
//
// Source roots (legacy `.agent-src.uncondensed/` and every
// `packages/*/.agent-src.uncondensed/`) are discovered at runtime via
// `artefact_roots()` so the linter follows the monorepo physical layout.
const FIXED_SCAN_ROOTS = [
    'agents/roadmaps',
    'agents/settings/contexts',
    'agents/reference/docs',
    'docs/contracts',
    'docs/decisions',
    'docs/guidelines',
] as const;

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** POSIX-relative path; null when `target` is not under `base` (ValueError). */
function _relativeToOrNull(target: string, base: string): string | null {
    const rel = path.relative(base, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

function _scan_roots(): string[] {
    const cwd = path.resolve('.');
    const roots: string[] = [];
    for (const r of artefact_roots()) {
        // `artefact_roots()` returns absolute paths derived from __file__.
        if (path.isAbsolute(r)) {
            const rel = _relativeToOrNull(r, cwd);
            if (rel === null) {
                // Root lives outside the current working directory (e.g. tests
                // chdir into a tmp tree). Skip — the test isolates its own
                // source tree.
                continue;
            }
            roots.push(rel);
        } else {
            roots.push(r.split(path.sep).join('/'));
        }
    }
    roots.push(...FIXED_SCAN_ROOTS);
    return roots;
}

const SCAN_EXTS = new Set(['.md', '.yml', '.yaml', '.json', '.py']);

// Files (or directory prefixes) that legitimately document the output
// convention or are scratch / archived. Paths are POSIX-style, repo-relative.
const ALLOWLIST_PREFIXES: readonly string[] = [
    // Archived roadmaps — historical evidence trail.
    'agents/roadmaps/archive/',
    // Working comparison docs — forward-refs to planned artefacts (mirrors
    // the SKIP_DIRS contract in scripts/check_references.py).
    'agents/evidence/analysis/',
    // The rule itself documents forbidden vs. allowed forms.
    '.agent-src.uncondensed/rules/no-roadmap-references.md',
    // ai-council skill documents the output-path schema.
    '.agent-src.uncondensed/skills/ai-council/',
    // Council commands document the output-path schema.
    '.agent-src.uncondensed/commands/council/',
    '.agent-src.uncondensed/commands/council.md',
];

// Top-level files that are also exempt (e.g. CHANGELOG with historical entries).
const ALLOWLIST_FILES: ReadonlySet<string> = new Set(['CHANGELOG.md']);

const INLINE_PRAGMA = /<!--\s*council-ref-allowed:[^>]*-->/;

const _LEGACY_PREFIX_STR = '.agent-src.uncondensed/';

// Structural carve-outs — (source_pattern, target_pattern) pairs where
// the reference is immutable decision provenance rather than transient
// drafting state. Driven by the 2026-05-14 P3.4 council round.
//
// Each entry: source file matches `source` regex AND the captured
// reference path matches `target` regex → reference is allowed without
// an inline pragma.
const STRUCTURAL_CARVEOUTS: ReadonlyArray<readonly [RegExp, RegExp]> = [
    // (a) evaluation-context → council-question:
    // the question file is a frozen function-parameter / spend-gate
    // input, not a documentation link.
    [
        /^agents\/settings\/contexts\/evaluation-[^/]+\.md$/,
        /^agents\/runtime\/council\/questions\/[^/]+\.md$/,
    ],
    // (b) contract → council-session-synthesis:
    // the synthesis file is the audit-trail receipt the contract cites
    // as decision provenance; the contract inlines the decision body.
    [
        /^docs\/contracts\/[^/]+\.md$/,
        /^agents\/runtime\/council\/sessions\/[^/]+\/synthesis\.md$/,
    ],
];

function _is_allowlisted(rel: string): boolean {
    // Match a repo-relative POSIX path against the allowlist.
    //
    // Allowlist prefixes are written against the legacy
    // `.agent-src.uncondensed/` layout. A physical hit under
    // `packages/*/.agent-src.uncondensed/` is normalised to the same
    // logical path before matching so entries keep covering relocated files.
    if (ALLOWLIST_FILES.has(rel)) {
        return true;
    }
    if (ALLOWLIST_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
        return true;
    }
    const logical = strip_source_prefix(rel);
    if (logical !== null) {
        const canon = `${_LEGACY_PREFIX_STR}${logical}`;
        if (ALLOWLIST_PREFIXES.some((prefix) => canon.startsWith(prefix))) {
            return true;
        }
    }
    return false;
}

function _is_structurally_allowed(source_rel: string, target_capture: string): boolean {
    // True when (source, target) matches a structural carve-out pair.
    for (const [srcRe, tgtRe] of STRUCTURAL_CARVEOUTS) {
        if (srcRe.test(source_rel) && tgtRe.test(target_capture)) {
            return true;
        }
    }
    return false;
}

function _scan_file(p: string): Array<[number, string]> {
    const findings: Array<[number, string]> = [];
    const rel = p.split(path.sep).join('/');
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return findings;
    }
    const lines = text.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const ln = idx + 1;
        const line = lines[idx]!;
        if (INLINE_PRAGMA.test(line)) {
            continue;
        }
        PATTERN.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = PATTERN.exec(line)) !== null) {
            if (_is_structurally_allowed(rel, m[0])) {
                continue;
            }
            findings.push([ln, m[0]]);
        }
    }
    return findings;
}

/** Recursively list files under `base`, sorted (mirrors sorted(rglob("*"))). */
function _rglobAll(base: string): string[] {
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
            if (entry.isDirectory()) {
                walk(full);
            } else {
                out.push(full);
            }
        }
    };
    walk(base);
    return out;
}

function* _iter_files(roots: readonly string[]): Generator<string> {
    for (const root of roots) {
        const base = path.join(ROOT, root);
        if (!_exists(base)) {
            continue;
        }
        if (_isFile(base)) {
            yield base;
            continue;
        }
        for (const p of _rglobAll(base).sort()) {
            if (_isFile(p) && SCAN_EXTS.has(path.extname(p))) {
                yield p;
            }
        }
    }
}

function main(): number {
    const violations: Array<[string, number, string]> = [];
    for (const p of _iter_files(_scan_roots())) {
        const rel = p.split(path.sep).join('/');
        if (_is_allowlisted(rel)) {
            continue;
        }
        for (const [ln, ref] of _scan_file(p)) {
            violations.push([p, ln, ref]);
        }
    }

    if (violations.length === 0) {
        if (!QUIET) {
            process.stdout.write('✅  No forbidden council references in durable artefacts.\n');
        }
        return 0;
    }

    process.stdout.write(`❌  ${violations.length} forbidden council reference(s):\n\n`);
    for (const [p, ln, ref] of violations) {
        const relPosix = p.split(path.sep).join('/');
        process.stdout.write(`  - ${relPosix}:${ln}: ${ref}\n`);
    }
    process.stdout.write(
        '\nRule: dist/agent-src/rules/no-roadmap-references.md (council clause)\n' +
            'Fix: inline the convergence summary (members + date) instead of\n' +
            'linking the file. Two source/target shapes are exempt structurally\n' +
            '(evaluation-context → council-question, contract →\n' +
            'council-session-synthesis) — see STRUCTURAL_CARVEOUTS in this\n' +
            'script. Otherwise append ' +
            '<!-- council-ref-allowed: <reason> --> on the same line to\n' +
            'suppress when the reference is genuinely required (ADR decision\n' +
            'trace).\n',
    );
    return 1;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    PATTERN,
    FIXED_SCAN_ROOTS,
    SCAN_EXTS,
    ALLOWLIST_PREFIXES,
    ALLOWLIST_FILES,
    INLINE_PRAGMA,
    STRUCTURAL_CARVEOUTS,
    _is_allowlisted,
    _is_structurally_allowed,
    _scan_file,
    _scan_roots,
    main,
    _setRootForTest,
};
