#!/usr/bin/env tsx
/**
 * CI guard for the `roadmap-progress-sync` rule's trackability Iron Law.
 *
 * TypeScript twin of `src/scripts/check_roadmap_trackable.py` (ADR-200,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--quiet` flag,
 * exit codes (0 all trackable, 1 violation, 1 missing roadmap dir),
 * byte-identical messages, stdout/stderr split, same scan order.
 *
 * The Python original imports `CHECKBOX_RE`, `PHASE_RE`, `is_draft`,
 * `is_roadmap_candidate`, `parse_frontmatter` from
 * `.augment/scripts/update_roadmap_progress.py` (the dashboard) as the
 * single source of truth so the linter cannot drift from what the
 * dashboard parses. `update_roadmap_progress` has no TS twin yet
 * (Python-only); these pure regex/parse helpers are replicated here
 * byte-for-byte from that module. Keep in lock-step with it.
 *
 * Every non-draft file under `agents/roadmaps/` (excluding `archive/`,
 * `skipped/`, template/README/open-questions) MUST:
 *   1. Be parseable by the dashboard's `PHASE_RE` (>= one `## Phase <id>`).
 *   2. Have at least one trackable checkbox under every parsed phase.
 *
 * Exit codes:
 *   0 — every active roadmap has parseable phases with >= 1 checkbox per phase.
 *   1 — at least one violation; details printed to stdout.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.slice(2).includes('--quiet');

const ROADMAP_ROOT = 'agents/roadmaps';

// --- Replicated from .augment/scripts/update_roadmap_progress.py ------------
// CHECKBOX_RE = re.compile(r"^\s*[-*]\s+\[([ xX~\-])\]\s", re.MULTILINE)
const CHECKBOX_RE = /^[ \t]*[-*][ \t]+\[([ xX~\-])\][ \t\f\v]/m;
// PHASE_RE = re.compile(
//   r"^(#{2,3})\s+Phase\s+(\d+[a-z]?|[IVX]+|[A-Z](?:\d+)?)"
//   r"(?:[\s:—\-]+(.*?))?\s*$", re.MULTILINE)
const PHASE_RE =
    /^(#{2,3})[ \t\f\v]+Phase[ \t\f\v]+(\d+[a-z]?|[IVX]+|[A-Z](?:\d+)?)(?:[\s:—\-]+(.*?))?[ \t\f\v]*$/gm;
// FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\s*\n", re.DOTALL)
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\s*\n/;
const DRAFT_VALUES: ReadonlySet<string> = new Set(['draft']);

const EXCLUDE_NAMES: ReadonlySet<string> = new Set([
    'template.md',
    'README.md',
    'progress.md',
    'roadmaps-progress.md',
]);
const EXCLUDE_PREFIXES = ['open-questions'] as const;
const EXCLUDE_DIRS: ReadonlySet<string> = new Set(['archive', 'skipped', 'stubs']);

/** Mirror update_roadmap_progress.parse_frontmatter. */
function parse_frontmatter(text: string): Map<string, string> {
    const m = FRONTMATTER_RE.exec(text);
    const fm = new Map<string, string>();
    if (!m) {
        return fm;
    }
    for (const line of _splitlines(m[1]!)) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#') || !line.includes(':')) {
            continue;
        }
        const idx = line.indexOf(':');
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        fm.set(key, _stripQuotes(value));
    }
    return fm;
}

/** Mirror Python `value.strip().strip('"').strip("'")`. */
function _stripQuotes(value: string): string {
    let v = value;
    v = v.replace(/^"+/, '').replace(/"+$/, '');
    v = v.replace(/^'+/, '').replace(/'+$/, '');
    return v;
}

/** Mirror update_roadmap_progress.is_draft. */
function is_draft(fm: Map<string, string>): boolean {
    return DRAFT_VALUES.has((fm.get('status') ?? '').toLowerCase());
}

/** Mirror update_roadmap_progress.is_roadmap_candidate (POSIX path parts). */
function is_roadmap_candidate(p: string): boolean {
    const name = path.basename(p);
    if (EXCLUDE_NAMES.has(name)) {
        return false;
    }
    if (EXCLUDE_PREFIXES.some((pre) => name.startsWith(pre))) {
        return false;
    }
    const parts = p.split(path.sep);
    if (parts.some((part) => EXCLUDE_DIRS.has(part))) {
        return false;
    }
    return true;
}

// --- end replicated block ---------------------------------------------------

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror Python `str.splitlines()`. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Recursively list `*.md` under `dir`, SORTED (mirrors sorted(rglob)). */
function _rglobMdSorted(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(current, ent.name);
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            } else if (ent.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort();
    return out;
}

/** Return every non-draft roadmap candidate under root. */
function find_active_roadmaps(root: string): string[] {
    const out: string[] = [];
    for (const p of _rglobMdSorted(root)) {
        if (!_isFile(p) || !is_roadmap_candidate(p)) {
            continue;
        }
        const text = fs.readFileSync(p, 'utf-8');
        if (is_draft(parse_frontmatter(text))) {
            continue;
        }
        out.push(p);
    }
    return out;
}

/** Return human-readable violation strings for a single roadmap. */
function violations_for(p: string): string[] {
    const text = fs.readFileSync(p, 'utf-8');
    PHASE_RE.lastIndex = 0;
    const matches: Array<{ start: number; end: number; id: string; name: string | undefined }> =
        [];
    let m: RegExpExecArray | null;
    while ((m = PHASE_RE.exec(text)) !== null) {
        matches.push({
            start: m.index,
            end: m.index + m[0].length,
            id: m[2]!,
            name: m[3],
        });
        if (m.index === PHASE_RE.lastIndex) {
            PHASE_RE.lastIndex++;
        }
    }
    if (matches.length === 0) {
        return [
            `${p}: no \`## Phase <id>\` or \`### Phase <id>\` heading ` +
                "matched the dashboard's PHASE_RE — roadmap is invisible " +
                'to agents/roadmaps-progress.md. Either rename headings to ' +
                'the canonical `Phase <id>` form or add `status: draft` to ' +
                'the frontmatter.',
        ];
    }
    const out: string[] = [];
    for (let i = 0; i < matches.length; i++) {
        const pm = matches[i]!;
        const start = pm.end;
        const end = i + 1 < matches.length ? matches[i + 1]!.start : text.length;
        const slice = text.slice(start, end);
        CHECKBOX_RE.lastIndex = 0;
        if (!CHECKBOX_RE.test(slice)) {
            const phase_id = pm.id;
            const name = (pm.name ?? '').trim() || `Phase ${phase_id}`;
            out.push(
                `${p}: Phase ${phase_id} (${name.slice(0, 60)}) has zero ` +
                    'trackable checkboxes — add at least one `- [ ]` (or ' +
                    '`[x]`/`[~]`/`[-]`) item or remove the phase.',
            );
        }
    }
    return out;
}

function main(): number {
    if (!_isDir(ROADMAP_ROOT)) {
        process.stderr.write(`❌  ${ROADMAP_ROOT} not found — run from project root.\n`);
        return 1;
    }
    const findings: string[] = [];
    for (const p of find_active_roadmaps(ROADMAP_ROOT)) {
        findings.push(...violations_for(p));
    }
    if (findings.length > 0) {
        process.stdout.write('❌  Trackable-roadmap rule violations:\n\n');
        for (const f of findings) {
            process.stdout.write(`  - ${f}\n`);
        }
        process.stdout.write(
            '\nRule: .augment/rules/roadmap-progress-sync.md ' +
                '§ "Iron Law — every active roadmap is trackable"\n',
        );
        return 1;
    }
    const count = find_active_roadmaps(ROADMAP_ROOT).length;
    if (!QUIET) {
        process.stdout.write(
            `✅  ${count} active roadmap(s) — all parseable, all phases have checkboxes.\n`,
        );
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    ROADMAP_ROOT,
    CHECKBOX_RE,
    PHASE_RE,
    is_draft,
    is_roadmap_candidate,
    parse_frontmatter,
    find_active_roadmaps,
    violations_for,
    main,
};
