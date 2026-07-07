#!/usr/bin/env tsx
/**
 * Hard-gate linter for the roadmap `## Blockers` contract
 * (`templates/roadmaps.md` rule 20 / `roadmap-ci-steps-policy` siblings).
 *
 * Validates, for every active roadmap under `agents/roadmaps/*.md`:
 *
 *   1. Every `### blocker: <id>` entry declares all five required fields
 *      (Status, Owner, Blocks, What to do, Resolved when).
 *   2. Every inline `<!-- blocked-by: <id> -->` annotation resolves to a
 *      `### blocker: <id>` entry declared in the SAME file.
 *
 * Fenced code blocks are stripped before scanning so a roadmap that shows
 * the `## Blockers` shape as a documentation example is not flagged.
 *
 * Exit codes: 0 = clean / no active roadmaps, 1 = violations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const QUIET = process.argv.slice(2).includes('--quiet');

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROADMAP_GLOB = 'agents/roadmaps/*.md';

const FENCED_CODE_RE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm;
const BLOCKERS_SECTION_RE = /^##[ \t]+Blockers[ \t]*$/im;
const NEXT_H2_RE = /^##[ \t]+\S/m;
const BLOCKER_HEADING_RE = /^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/gim;
// Only a real checkbox line (`- [ ] … <!-- blocked-by: id -->`) counts — a
// wrapped continuation line or inline-code documentation example of the
// syntax (as this very lint script's own roadmap step describes it) must
// not be mistaken for a live cross-reference.
const BLOCKED_BY_LINE_RE = /^-[ \t]*\[[ xX~-]\].*<!--[ \t]*blocked-by:[ \t]*([a-z0-9-]+)[ \t]*-->/i;

const REQUIRED_FIELDS: ReadonlyArray<readonly [string, RegExp]> = [
    ['Status', /^-[ \t]*\*\*Status:\*\*/im],
    ['Owner', /^-[ \t]*\*\*Owner:\*\*/im],
    ['Blocks', /^-[ \t]*\*\*Blocks:\*\*/im],
    ['What to do', /^-[ \t]*\*\*What to do:\*\*/im],
    ['Resolved when', /^-[ \t]*\*\*Resolved when:\*\*/im],
];

interface Violation {
    line: number;
    message: string;
}

/** 1-based line number of a character offset. */
function _lineAt(text: string, index: number): number {
    let n = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text.charCodeAt(i) === 10) {
            n += 1;
        }
    }
    return n;
}

/** Blank out fenced code blocks, preserving line count and offsets. */
function _stripFencedCode(text: string): string {
    return text.replace(FENCED_CODE_RE, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length));
}

function _scan(rawText: string): Violation[] {
    const violations: Violation[] = [];
    const text = _stripFencedCode(rawText);
    const declaredIds = new Set<string>();

    const sectionMatch = BLOCKERS_SECTION_RE.exec(text);
    if (sectionMatch) {
        const sectionStart = sectionMatch.index + sectionMatch[0].length;
        const rest = text.slice(sectionStart);
        const h2 = NEXT_H2_RE.exec(rest);
        const sectionEnd = h2 ? sectionStart + h2.index : text.length;
        const section = text.slice(sectionStart, sectionEnd);

        BLOCKER_HEADING_RE.lastIndex = 0;
        const heads: Array<{ start: number; end: number; id: string }> = [];
        let hm: RegExpExecArray | null;
        while ((hm = BLOCKER_HEADING_RE.exec(section)) !== null) {
            heads.push({
                start: hm.index,
                end: hm.index + hm[0].length,
                id: (hm[1] as string).trim(),
            });
            if (hm.index === BLOCKER_HEADING_RE.lastIndex) {
                BLOCKER_HEADING_RE.lastIndex++;
            }
        }
        for (let i = 0; i < heads.length; i++) {
            const cur = heads[i] as { start: number; end: number; id: string };
            declaredIds.add(cur.id);
            const bodyEnd = i + 1 < heads.length ? (heads[i + 1] as { start: number }).start : section.length;
            const body = section.slice(cur.end, bodyEnd);
            const missing = REQUIRED_FIELDS.filter(([, re]) => !re.test(body)).map(([name]) => name);
            if (missing.length) {
                violations.push({
                    line: _lineAt(text, sectionStart + cur.start),
                    message: `blocker '${cur.id}' missing required field(s): ${missing.join(', ')}`,
                });
            }
        }
    }

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        // A real annotation is bare markdown (an actual checkbox + HTML
        // comment); an inline-code-quoted mention (`` `<!-- blocked-by: id -->` ``,
        // e.g. this very lint script's own roadmap step documenting the
        // syntax) is prose, not a live cross-reference — blank inline code
        // spans before matching.
        const cleaned = (lines[i] as string).replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
        const m = BLOCKED_BY_LINE_RE.exec(cleaned);
        if (!m) {
            continue;
        }
        const id = m[1] as string;
        if (!declaredIds.has(id)) {
            violations.push({
                line: i + 1,
                message:
                    `blocked-by references unknown blocker id '${id}' ` +
                    `(no matching '### blocker: ${id}' in this file)`,
            });
        }
    }
    violations.sort((a, b) => a.line - b.line);
    return violations;
}

/** Sorted `agents/roadmaps/*.md` (non-recursive — active roadmaps only). */
function _globRoadmaps(): string[] {
    const dir = path.join(REPO_ROOT, 'agents', 'roadmaps');
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function main(): number {
    const roadmaps = _globRoadmaps();
    if (roadmaps.length === 0) {
        if (!QUIET) {
            process.stdout.write(`✅  no active roadmaps under ${ROADMAP_GLOB}\n`);
        }
        return 0;
    }
    let failed = 0;
    for (const roadmap of roadmaps) {
        const rel = _relPosix(roadmap, REPO_ROOT);
        const text = fs.readFileSync(roadmap, 'utf-8');
        const violations = _scan(text);
        if (violations.length) {
            failed += 1;
            process.stderr.write(`❌  ${rel}\n`);
            for (const v of violations) {
                process.stderr.write(`    line ${v.line}: ${v.message}\n`);
            }
        } else if (!QUIET) {
            process.stdout.write(`✅  ${rel}\n`);
        }
    }
    if (failed) {
        process.stderr.write(
            `\n❌  ${failed} roadmap(s) violate the ## Blockers contract — ` +
                'see .augment/rules/roadmap-progress-sync.md and ' +
                '.augment/templates/roadmaps.md rule 20\n',
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(`\n✅  ${roadmaps.length} roadmap(s) blocker-contract-clean\n`);
    }
    return 0;
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

export { REPO_ROOT, ROADMAP_GLOB, REQUIRED_FIELDS, _scan, _globRoadmaps, main };
export type { Violation };
