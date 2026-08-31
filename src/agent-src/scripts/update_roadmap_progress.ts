#!/usr/bin/env tsx
/**
 * Generate `agents/roadmaps-progress.md` — aggregated progress across open roadmaps.
 *
 * TypeScript twin of `src/agent-src/scripts/update_roadmap_progress.py`
 * (ADR-200, Python→TypeScript migration). The `.augment`-projected copy of this
 * script is what CI runs as `--check`, so byte-parity is load-bearing: the
 * rendered dashboard markdown, the `--check` stale comparison, the stderr
 * warnings, and the exit codes all mirror the Python original EXACTLY. The
 * public surface (`collect`, `parse_roadmap`, `RoadmapStats`-shaped objects with
 * `.rel` / `.open_` / `.deferred` / `total_active`, …) is preserved so
 * `archive_completed_roadmaps` can consume it the same way Python does. snake_case
 * is kept on the public surface.
 *
 * Scans every roadmap under `agents/roadmaps/` (excluding `archive/`, `skipped/`,
 * `template.md`, `README.md`, `open-questions*.md`), counts checkbox states per
 * phase, and writes a dashboard at `agents/roadmaps-progress.md` (outside the
 * `roadmaps/` folder to keep it clean) with:
 *
 *   - Overall progress (open-roadmap count, steps done, %)
 *   - A summary table of every open roadmap
 *   - Per-roadmap phase breakdown
 *
 * Checkbox states:
 *   [x]  done      [ ]  open      [~]  deferred      [-]  cancelled
 *
 * Percentage = done / (done + open). Deferred and cancelled do not count towards
 * "open" (they are explicit decisions).
 *
 * `[~]` deferred items carry plans the user intends to revisit later. They
 * block silent auto-archive per `roadmap-progress-sync` Iron Law 3.
 *
 * Invocation (from project root):
 *   node node_modules/.bin/tsx .augment/scripts/update_roadmap_progress.ts              # rewrite
 *   node node_modules/.bin/tsx .augment/scripts/update_roadmap_progress.ts --archive    # rewrite + archive completed
 *   node node_modules/.bin/tsx .augment/scripts/update_roadmap_progress.ts --check      # CI: exit 1 if stale
 *
 * `--archive` is opt-in and `--check` refuses it; the full contract, the
 * council record and the sweep spawner live in `archival_sweep.ts`.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - Python `round()` is banker's rounding (round-half-to-even). Percentages and
 *   the progress bar use it, so `_pyRound` replicates it — a naïve `Math.round`
 *   would drift on exact-half values (e.g. 12.5 → 12, not 13).
 * - The Python `re` patterns (MULTILINE / DOTALL) are translated 1:1; `\s` in
 *   the checkbox/phase classes maps to Python's `\s` (`[ \t\n\r\f\v]`), and the
 *   Unicode em-dash `—` is preserved in the phase separator class.
 * - `sorted(roadmap_root.rglob("*.md"))` → component-wise sort over a recursive
 *   `.md` walk (only files; symlinked dirs are followed like pathlib).
 * - `collect_bundles` does `import yaml` lazily and returns `[]` on ImportError
 *   or a malformed registry → `createRequire('yaml')` in a try/catch, same
 *   graceful-degradation contract. PyYAML 1.1 semantics via the `yaml` package.
 * - JSON is not emitted; the only structured output is the markdown dashboard
 *   built with `"\n".join(lines) + "\n"`.
 * - `Path.read_text(encoding="utf-8")` → `fs.readFileSync(p, "utf-8")`.
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)`.
 */

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run_archival_sweep } from './archival_sweep.js';
import {
    evaluateDashboardOnDisk,
    parseModeToken,
    reportCheckVerdict,
    type DashboardMode,
} from './dashboard_mode.js';
import type * as YamlModule from 'yaml';
import { headerFragment as stubHeaderFragment } from './stubs_due.js';
import { reportGuardedBaselines } from './guarded_baseline.js'; // third step state; contract lives there

const _HERE = fileURLToPath(import.meta.url);
const _require = createRequire(import.meta.url);

// CHECKBOX_RE = re.compile(r"^\s*[-*]\s+\[([ xX~\-])\]\s", re.MULTILINE)
const CHECKBOX_RE = /^[ \t\n\r\f\v]*[-*][ \t\n\r\f\v]+\[([ xX~\-])\][ \t\n\r\f\v]/gm;
// PHASE_RE (MULTILINE) — H2/H3 "Phase <id>" with optional separator + name.
// Numeric ids accept dotted sub-phases ("1.0", "4.1", "2.3.1").
const PHASE_RE =
    /^(#{2,3})[ \t\n\r\f\v]+Phase[ \t\n\r\f\v]+(\d+(?:\.\d+)*[a-z]?|[IVX]+|[A-Z](?:\d+)?)(?:[\s:—\-]+([\s\S]*?))?[ \t\f\v\r]*$/gm;
// TITLE_RE = re.compile(r"^#\s+(?:Roadmap:\s*)?(.+?)\s*$", re.MULTILINE)
const TITLE_RE = /^#[ \t\n\r\f\v]+(?:Roadmap:[ \t\n\r\f\v]*)?(.+?)[ \t\f\v\r]*$/m;
const EXCLUDE_NAMES: ReadonlySet<string> = new Set([
    'template.md',
    'README.md',
    'progress.md',
    'roadmaps-progress.md',
]);
const EXCLUDE_PREFIXES: readonly string[] = ['open-questions'];
const EXCLUDE_DIRS: ReadonlySet<string> = new Set(['archive', 'skipped', 'stubs', 'later']);

// FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\s*\n", re.DOTALL)
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---[ \t\n\r\f\v]*\n/;
const DRAFT_VALUES: ReadonlySet<string> = new Set(['draft']);

const MERGE_GATED_RE = /merge-gated/i;
// PR_NUM_RE = re.compile(r"pr\s*[=#:]?\s*#?\s*(\d+)", re.IGNORECASE)
const PR_NUM_RE = /pr[ \t\n\r\f\v]*[=#:]?[ \t\n\r\f\v]*#?[ \t\n\r\f\v]*(\d+)/gi;

/** Python `round()` — round-half-to-even (banker's rounding). */
function _pyRound(x: number): number {
    const floor = Math.floor(x);
    const diff = x - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // Exact half → round to even.
    return floor % 2 === 0 ? floor : floor + 1;
}

class PhaseStats {
    id: string;
    name: string;
    done: number;
    open_: number;
    deferred: number;
    cancelled: number;
    merge_gated: number;
    merge_gated_prs: number[];

    constructor(
        id: string,
        name: string,
        done = 0,
        open_ = 0,
        deferred = 0,
        cancelled = 0,
        merge_gated = 0,
        merge_gated_prs: number[] = [],
    ) {
        this.id = id;
        this.name = name;
        this.done = done;
        this.open_ = open_;
        this.deferred = deferred;
        this.cancelled = cancelled;
        this.merge_gated = merge_gated;
        this.merge_gated_prs = merge_gated_prs;
    }

    get total_active(): number {
        return this.done + this.open_;
    }

    get total_all(): number {
        return this.done + this.open_ + this.deferred + this.cancelled;
    }

    get percent(): number {
        return this.total_active ? _pyRound((this.done * 100) / this.total_active) : 0;
    }

    get state(): string {
        if (this.total_active === 0 && (this.deferred || this.cancelled)) {
            return '⏭️ skipped';
        }
        if (this.total_active === 0) {
            return '⬜ empty';
        }
        if (this.done === 0) {
            return '⬜ not started';
        }
        if (this.open_ === 0) {
            return '✅ done';
        }
        return '🟡 in progress';
    }
}

class RoadmapStats {
    path: string;
    rel: string;
    title: string;
    phases: PhaseStats[];
    blockers: Blocker[];

    constructor(
        p: string,
        rel: string,
        title: string,
        phases: PhaseStats[] = [],
        blockers: Blocker[] = [],
    ) {
        this.path = p;
        this.rel = rel;
        this.title = title;
        this.phases = phases;
        this.blockers = blockers;
    }

    get open_blockers(): Blocker[] {
        return this.blockers.filter((b) => !blocker_is_resolved(b));
    }

    get resolved_blockers(): Blocker[] {
        return this.blockers.filter((b) => blocker_is_resolved(b));
    }

    get done(): number {
        return this.phases.reduce((s, p) => s + p.done, 0);
    }

    get open_(): number {
        return this.phases.reduce((s, p) => s + p.open_, 0);
    }

    get deferred(): number {
        return this.phases.reduce((s, p) => s + p.deferred, 0);
    }

    get cancelled(): number {
        return this.phases.reduce((s, p) => s + p.cancelled, 0);
    }

    get merge_gated(): number {
        return this.phases.reduce((s, p) => s + p.merge_gated, 0);
    }

    get merge_gated_prs(): number[] {
        const seen: number[] = [];
        for (const p of this.phases) {
            for (const n of p.merge_gated_prs) {
                if (!seen.includes(n)) {
                    seen.push(n);
                }
            }
        }
        return seen;
    }

    get total_active(): number {
        return this.done + this.open_;
    }

    get total_all(): number {
        return this.done + this.open_ + this.deferred + this.cancelled;
    }

    get percent(): number {
        return this.total_active ? _pyRound((this.done * 100) / this.total_active) : 0;
    }
}

/** `str.strip()` over Python whitespace (space/tab/nl/cr/ff/vt). */
function _strip(s: string): string {
    return s.replace(/^[ \t\n\r\f\v]+/, '').replace(/[ \t\n\r\f\v]+$/, '');
}

/** `str.splitlines()` — split on Python's line boundaries (no trailing empty). */
function _splitlines(s: string): string[] {
    if (s === '') return [];
    // Python splitlines splits on \n, \r, \r\n (and a few more, but markdown
    // here is plain \n / \r\n). Mirror that set; drop the trailing empty.
    const parts = s.split(/\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/);
    if (parts.length && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

function parse_frontmatter(text: string): Record<string, string> {
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        return {};
    }
    const fm: Record<string, string> = {};
    for (const line of _splitlines(m[1] as string)) {
        const stripped = _strip(line);
        if (!stripped || stripped.startsWith('#') || !line.includes(':')) {
            continue;
        }
        // line.partition(":") — split on first colon.
        const idx = line.indexOf(':');
        const key = line.slice(0, idx);
        const value = line.slice(idx + 1);
        fm[_strip(key)] = _stripQuotes(_strip(value));
    }
    return fm;
}

/** value.strip().strip('"').strip("'") — Python's chained one-char strips. */
function _stripQuotes(s: string): string {
    let out = s.replace(/^"+/, '').replace(/"+$/, '');
    out = out.replace(/^'+/, '').replace(/'+$/, '');
    return out;
}

function is_draft(fm: Record<string, string>): boolean {
    return DRAFT_VALUES.has((fm['status'] ?? '').toLowerCase());
}

/**
 * The NAME half of the candidate test. Split out because the parked inventory
 * reads `later/` on purpose and `is_roadmap_candidate` rejects any path carrying
 * an excluded component — `later` included. Sharing this half keeps
 * `later/README.md` excluded from both sides by one rule rather than two.
 */
function is_roadmap_name(name: string): boolean {
    if (EXCLUDE_NAMES.has(name)) {
        return false;
    }
    return !EXCLUDE_PREFIXES.some((pre) => name.startsWith(pre));
}

function is_roadmap_candidate(p: string): boolean {
    if (!is_roadmap_name(path.basename(p))) {
        return false;
    }
    // path.parts — every component of the path; exclude if any is an excluded dir.
    const parts = p.split(path.sep).filter((s) => s !== '');
    if (parts.some((part) => EXCLUDE_DIRS.has(part))) {
        return false;
    }
    return true;
}

type CheckboxCounts = [number, number, number, number, number, number[]];

function count_checkboxes(text: string): CheckboxCounts {
    let done = 0;
    let open_ = 0;
    let deferred = 0;
    let cancelled = 0;
    let merge_gated = 0;
    const prs: number[] = [];
    const matches: Array<{ start: number; group1: string }> = [];
    CHECKBOX_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CHECKBOX_RE.exec(text)) !== null) {
        matches.push({ start: m.index, group1: m[1] as string });
        if (m.index === CHECKBOX_RE.lastIndex) {
            CHECKBOX_RE.lastIndex++;
        }
    }
    for (let i = 0; i < matches.length; i++) {
        const c = (matches[i] as { start: number; group1: string }).group1.toLowerCase();
        if (c === 'x') {
            done += 1;
        } else if (c === ' ') {
            open_ += 1;
            const span_end =
                i + 1 < matches.length ? (matches[i + 1] as { start: number }).start : text.length;
            const span = text.slice((matches[i] as { start: number }).start, span_end);
            if (MERGE_GATED_RE.test(span)) {
                merge_gated += 1;
                PR_NUM_RE.lastIndex = 0;
                let pm: RegExpExecArray | null;
                while ((pm = PR_NUM_RE.exec(span)) !== null) {
                    prs.push(parseInt(pm[1] as string, 10));
                }
            }
        } else if (c === '~') {
            deferred += 1;
        } else if (c === '-') {
            cancelled += 1;
        }
    }
    return [done, open_, deferred, cancelled, merge_gated, prs];
}

interface Blocker {
    id: string;
    status: string;
    owner: string;
    blocks: string;
    todo: string[];
    resolvedWhen: string;
    /**
     * The two fields that make a blocker *decidable* rather than merely
     * described. Empty string when the entry predates them — the ratchet in
     * `lint_roadmap_blockers` keeps the backlog legal, so the renderer has to
     * cope with absence rather than assume it away.
     */
    recommendation: string;
    ifNothing: string;
    /**
     * Optional one-line statement of what is actually being decided.
     *
     * Not required, but recognised: three entries in the tree already used
     * `- **Question:**` and, because the field list did not know it, the
     * continuation logic silently appended it to `Blocks` — the decision's
     * subject arrived glued to the end of an unrelated sentence. Naming it
     * costs one enum entry and turns a silent swallow into a rendered field.
     */
    question: string;
    /**
     * Gate taxonomy: `0` auto-run · `1` budget-preauthorized · `2`
     * consent-once · `3` human-only. Empty string when the entry declares
     * none, and an absent class READS AS 3 at every consumer.
     *
     * The default is the safe end on purpose. An agent that inferred the class
     * at runtime could promote a Hard-Floor gate into something it executes;
     * authoring it into the file means a misclassification is a reviewed edit,
     * and `lint_roadmap_blockers` refuses a runnable class that names no
     * command.
     */
    blockerClass: string;
    /** The command a class-0/1 entry is resolved by running. */
    run: string;
    /** Spend estimate for class 1 — recorded, never enforced by the lint. */
    budget: string;
}

/**
 * Is this blocker settled?
 *
 * A PREFIX test, not equality, and the difference was measured: authors write
 * the resolution into the status line — `**Status:** RESOLVED 2026-08-17 —
 * **option (b)**, narrowed to two rules` — and an equality check matches
 * neither `open` nor `resolved`, so the entry falls through to open. Found
 * 2026-08-17 in `road-to-mixed-trigger-activation-cost`: a decision taken two
 * days earlier was still being rendered by `agent-config gates` as a live one
 * the reader owed an answer to, and it inflated every blocker count in the
 * dashboard by one.
 *
 * `lint_roadmap_blockers` already read the same field as a prefix
 * (`/^-\s*\*\*Status:\*\*\s*resolved/i`), so the two surfaces disagreed about
 * what "resolved" means — the lint exempted the entry from its decidability
 * ratchet while the dashboard counted it open.
 */
function blocker_is_resolved(b: Blocker): boolean {
    return /^resolved\b/.test(_strip(b.status).toLowerCase());
}

/** Class of a blocker, with the absent-field default applied. */
function blocker_class(b: Blocker): '0' | '1' | '2' | '3' {
    const c = _strip(b.blockerClass).split(/[\s—–-]/)[0] as string;
    return c === '0' || c === '1' || c === '2' ? c : '3';
}

// Strip fenced code blocks before blocker detection — a roadmap that shows the
// `## Blockers` shape as a documentation example (fenced, indented or not)
// must not be mistaken for a live blocker on that roadmap.
const FENCED_CODE_RE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm;
const BLOCKERS_SECTION_RE = /^##[ \t]+Blockers[ \t]*$/im;
const BLOCKER_HEADING_RE = /^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/gim;
const NEXT_H2_RE = /^##[ \t]+\S/m;
const LEGACY_BLOCKED_UNTIL_RE = /^>[ \t]*Blocked until:?[ \t]*(.+)$/im;

function _stripFencedCode(text: string): string {
    return text.replace(FENCED_CODE_RE, (m) => '\n'.repeat(_splitlines(m).length));
}

/**
 * Terminator for a blocker field's continuation lines — ANY `- **Label:**`
 * bullet, not a closed list of known labels.
 *
 * It used to enumerate eight names, which silently diverged from the contract
 * the two call sites below already document ("up to the next `- **Field:**`
 * marker"): a bullet whose label was not on the list did not terminate, so the
 * PREVIOUS field kept absorbing it and the dashboard rendered the two as one
 * run-on sentence. Measured when `- **Options:**` and `- **Side finding:**`
 * first appeared in a blocker — a reader saw the side finding as part of
 * `Resolved when`, i.e. the generator changed what a field meant.
 *
 * A closed list is the wrong shape for a terminator: every future field name
 * would have to be added here to avoid corrupting the field above it, and the
 * failure is silent in generated output nobody edits by hand.
 */
const BLOCKER_FIELD_RE = /^-[ \t]*\*\*[^*]+:\*\*/;

/** Strip an inline `<!-- comment -->` and trim. */
function _stripComment(s: string): string {
    return _strip(s.replace(/<!--[\s\S]*?-->/g, ''));
}

/**
 * `- **Label:** value` → trimmed `value`, joined with any wrapped
 * continuation lines (non-bulleted text under the same field, e.g. a long
 * "Blocks" sentence spanning two lines) up to the next `- **Field:**`
 * marker, blank line, or heading.
 */
function _blockerField(slice: string, label: string): string | null {
    const lines = _splitlines(slice);
    const re = new RegExp(`^-[ \\t]*\\*\\*${label}:\\*\\*[ \\t]*(.*)$`, 'i');
    const startIdx = lines.findIndex((l) => re.test(_strip(l)));
    if (startIdx === -1) {
        return null;
    }
    const m = re.exec(_strip(lines[startIdx] as string));
    const parts: string[] = [];
    const first = _stripComment((m?.[1] as string) ?? '');
    if (first) {
        parts.push(first);
    }
    for (let i = startIdx + 1; i < lines.length; i++) {
        const trimmed = _strip(lines[i] as string);
        if (trimmed === '' || BLOCKER_FIELD_RE.test(trimmed) || trimmed.startsWith('#')) {
            break;
        }
        parts.push(_stripComment(trimmed));
    }
    return parts.length ? parts.join(' ') : null;
}

/**
 * The `- **What to do:**` text: the remainder of the marker line, plus every
 * line under it up to the next `- **Field:**` marker.
 *
 * The marker line's own remainder is load-bearing and used to be dropped.
 * Authors write both shapes — a numbered list under the marker, and prose that
 * starts inline (`- **What to do:** the build work is done; only real …`) —
 * and every *other* blocker field reads the inline part via `_blockerField`.
 * Skipping it here truncated instructions mid-sentence in both the dashboard
 * and `agent-config gates`, which is precisely the content those surfaces
 * exist to deliver.
 */
function _blockerTodo(slice: string): string[] {
    const lines = _splitlines(slice);
    const markerRe = /^-[ \t]*\*\*What to do:\*\*[ \t]*(.*)$/i;
    const startIdx = lines.findIndex((l) => markerRe.test(_strip(l)));
    if (startIdx === -1) {
        return [];
    }
    const out: string[] = [];
    const inline = _stripComment(
        (markerRe.exec(_strip(lines[startIdx] as string))?.[1] as string) ?? '',
    );
    if (inline) {
        out.push(inline);
    }
    for (let i = startIdx + 1; i < lines.length; i++) {
        const trimmed = _strip(lines[i] as string);
        if (BLOCKER_FIELD_RE.test(trimmed) || trimmed.startsWith('#')) {
            break;
        }
        if (trimmed !== '') {
            out.push(trimmed);
        }
    }
    return out;
}

function parse_blockers(raw_text: string): Blocker[] {
    const text = _stripFencedCode(raw_text);
    const blockers: Blocker[] = [];
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
                id: _strip(hm[1] as string),
            });
            if (hm.index === BLOCKER_HEADING_RE.lastIndex) {
                BLOCKER_HEADING_RE.lastIndex++;
            }
        }
        for (let i = 0; i < heads.length; i++) {
            const cur = heads[i] as { start: number; end: number; id: string };
            const bodyEnd =
                i + 1 < heads.length ? (heads[i + 1] as { start: number }).start : section.length;
            const body = section.slice(cur.end, bodyEnd);
            blockers.push({
                id: cur.id,
                status: (_blockerField(body, 'Status') ?? 'open').toLowerCase(),
                owner: _blockerField(body, 'Owner') ?? 'user',
                blocks: _blockerField(body, 'Blocks') ?? '(unspecified)',
                todo: _blockerTodo(body),
                resolvedWhen: _blockerField(body, 'Resolved when') ?? '(unspecified)',
                recommendation: _blockerField(body, 'Recommendation') ?? '',
                ifNothing: _blockerField(body, 'If you do nothing') ?? '',
                question: _blockerField(body, 'Question') ?? '',
                blockerClass: _blockerField(body, 'Class') ?? '',
                run: _blockerField(body, 'Run') ?? '',
                budget: _blockerField(body, 'Budget') ?? '',
            });
        }
    }
    const legacyMatch = LEGACY_BLOCKED_UNTIL_RE.exec(text);
    if (legacyMatch) {
        // The legacy note is a blockquote and routinely wraps over several
        // `> ` lines. The regex captures one line, so the continuation used to
        // be dropped and the instruction ended mid-sentence — the same defect
        // `_blockerTodo` carried above. Walk the following quoted lines until
        // the quote block ends.
        const parts = [_strip(legacyMatch[1] as string)];
        const allLines = _splitlines(text);
        const noteIdx = allLines.findIndex((l) => LEGACY_BLOCKED_UNTIL_RE.test(_strip(l)));
        for (let i = noteIdx + 1; noteIdx !== -1 && i < allLines.length; i++) {
            const quoted = /^>[ \t]?(.*)$/.exec(_strip(allLines[i] as string));
            if (!quoted) {
                break;
            }
            const cont = _strip(quoted[1] as string);
            if (cont === '') {
                break;
            }
            parts.push(cont);
        }
        blockers.push({
            id: 'legacy',
            status: 'open',
            owner: 'user',
            blocks: 'entire roadmap',
            todo: [parts.join(' ')],
            resolvedWhen: 'condition described above clears',
            recommendation: '',
            ifNothing: '',
            question: '',
            blockerClass: '',
            run: '',
            budget: '',
        });
    }
    return blockers;
}

/**
 * Does this blocker need the human at the keyboard, rather than the maintainer
 * or an external party?
 *
 * Owner values in the wild are not the clean `user | maintainer | external`
 * enum the template comment suggests — real entries carry qualifiers
 * (`user (billable spend)`, `user / maintainer`, `maintainer (security role)`).
 * Word-boundary matching on `user` keeps the qualified forms and rejects
 * `maintainer`. A shared `user / maintainer` blocker deliberately counts as the
 * user's: showing one decision too many costs a line, hiding one costs the wait.
 *
 * Lives here rather than in `roadmap_gates` because it is owner *semantics*,
 * not presentation — the dashboard header and `agent-config gates` must agree
 * on the split, and two copies of this regex would drift.
 */
function blocker_needs_user(owner: string): boolean {
    return /\buser\b/i.test(owner);
}

function parse_roadmap(p: string, roadmap_root: string): RoadmapStats | null {
    const text = fs.readFileSync(p, { encoding: 'utf-8' });
    const phase_matches: Array<{ start: number; end: number; g2: string; g3: string | undefined }> =
        [];
    PHASE_RE.lastIndex = 0;
    let pm: RegExpExecArray | null;
    while ((pm = PHASE_RE.exec(text)) !== null) {
        phase_matches.push({
            start: pm.index,
            end: pm.index + pm[0].length,
            g2: pm[2] as string,
            g3: pm[3],
        });
        if (pm.index === PHASE_RE.lastIndex) {
            PHASE_RE.lastIndex++;
        }
    }
    if (phase_matches.length === 0) {
        return null; // not a roadmap — no ## Phase headings
    }
    const title_match = TITLE_RE.exec(text);
    const title = title_match ? _strip(title_match[1] as string) : _stem(p);
    const rel = _relPosix(roadmap_root, p);
    const stats = new RoadmapStats(p, rel, title, [], parse_blockers(text));
    for (let i = 0; i < phase_matches.length; i++) {
        const cur = phase_matches[i] as { start: number; end: number; g2: string; g3: string | undefined };
        const start = cur.end;
        const end = i + 1 < phase_matches.length ? (phase_matches[i + 1] as { start: number }).start : text.length;
        const [d, o, df, c, mg, prs] = count_checkboxes(text.slice(start, end));
        const phase_id = cur.g2;
        const name = _strip(cur.g3 ?? '') || `Phase ${phase_id}`;
        stats.phases.push(new PhaseStats(phase_id, name, d, o, df, c, mg, prs));
    }
    return stats;
}

/** Path.stem — filename without final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

/** str(path.relative_to(root)) — POSIX-separated relative path. */
function _relPosix(root: string, p: string): string {
    return path.relative(root, p).split(path.sep).join('/');
}

/** Deterministic anchor slug for a roadmap's blocker section — explicit
 * anchors (rather than GitHub's auto heading-slug) survive `.md` / brackets. */
function _blockerAnchor(rel: string): string {
    const stem = rel.endsWith('.md') ? rel.slice(0, -3) : rel;
    return (
        'blockers-' +
        stem
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    );
}

function bar(pct: number, width = 10): string {
    const filled = _pyRound((pct * width) / 100);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** sorted(roadmap_root.rglob("*.md")) — recursive, component-wise sort, files. */
function _rglobMdSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isSymbolicLink() && _isDir(full)) {
                walk(full);
            } else if (ent.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

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

function collect(roadmap_root: string): RoadmapStats[] {
    const results: RoadmapStats[] = [];
    for (const p of _rglobMdSorted(roadmap_root)) {
        if (!_isFile(p) || !is_roadmap_candidate(p)) {
            continue;
        }
        const text = fs.readFileSync(p, { encoding: 'utf-8' });
        if (is_draft(parse_frontmatter(text))) {
            continue;
        }
        const stats = parse_roadmap(p, roadmap_root);
        if (stats) {
            results.push(stats);
        }
    }
    return results;
}

/** One parked roadmap, as the inventory needs it. */
interface ParkedRoadmap {
    rel: string;
    resume: string | null;
    /** Only the linter's looser marker matched — CI passes, the cell cannot quote. */
    unlabelled: boolean;
    /** Open blockers still carried by the parked file. */
    open_blockers: number;
    /** Of those, the ones whose owner is the user. */
    needs_user: number;
}

/**
 * A line that STATES when the roadmap comes back. Two tiers exist because
 * `lint_roadmap_later_disposition` accepts a bare `trigger`, which is too loose to
 * quote from — measured over the live tree it matched a `Source:` path containing
 * `mixed-trigger-cleanup`, producing cells that were wrong rather than short.
 */
const RESUME_STATEMENT = /\b(blocked until|resume when|resume-when|blocked-until)\b/i;

/**
 * The linter's looser vocabulary. A file matching only this DOES carry a resume
 * condition as far as CI is concerned, so reporting it as missing would make the
 * dashboard contradict a gate that already passed.
 */
const RESUME_LOOSE = /\btrigger\b/i;

/**
 * Parked roadmaps, with the resume condition each one records.
 *
 * A view over existing data, NOT a new governance mechanism: nothing here gates,
 * counts toward a ratchet, or changes what `collect()` scans. It exists because
 * `later/` is excluded from `collect()` and from `/roadmap:process-*` — correct,
 * parked work is not backlog — and that exclusion had no counterweight, so a
 * roadmap moved there left the dashboard entirely.
 */
function collect_parked(roadmap_root: string): ParkedRoadmap[] {
    const dir = path.join(roadmap_root, 'later');
    let names: string[];
    try {
        names = fs.readdirSync(dir).sort();
    } catch {
        return [];
    }
    const out: ParkedRoadmap[] = [];
    for (const name of names) {
        const full = path.join(dir, name);
        // The NAME half only: the full predicate rejects every path under `later`.
        if (!_isFile(full) || !is_roadmap_name(name)) {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(full, { encoding: 'utf-8' });
        } catch {
            continue;
        }
        if (is_draft(parse_frontmatter(text))) {
            continue;
        }
        const cell = resume_cell(text);
        // Parked blockers are still open blockers — counting them here is what stops
        // this section becoming the surface where a park reads as a resolution.
        const open = parse_blockers(text).filter((b) => !blocker_is_resolved(b));
        out.push({
            rel: name,
            resume: cell.stated,
            unlabelled: cell.unlabelled,
            open_blockers: open.length,
            needs_user: open.filter((b) => blocker_needs_user(b.owner)).length,
        });
    }
    return out;
}

/**
 * What brings a parked roadmap back, as one table cell. Both fields false means the
 * file records nothing — said outright, because an empty cell reads as "nothing to
 * wait for".
 *
 * The PARAGRAPH is joined, not the matched line: roadmap prose wraps at ~80
 * columns, and quoting one line ended 39 of 52 cells mid-clause. A cell stopping at
 * "the pair for" is not a shorter sentence, it is a different claim.
 *
 * Both tiers are tested over the SAME lines. Testing the loose one whole-file while
 * the strict one ran per line made `unlabelled` fire on any file using the word
 * "trigger" anywhere.
 */
function resume_cell(text: string): { stated: string | null; unlabelled: boolean } {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] as string;
        if (!RESUME_STATEMENT.test(raw)) {
            continue;
        }
        const parts: string[] = [raw];
        // Continuation lines of the same paragraph: non-blank, and not the start of
        // a new block (list item, heading, fence, table row).
        for (let j = i + 1; j < lines.length; j++) {
            const next = (lines[j] as string).replace(/^\s*>\s?/, '').trim();
            if (next === '' || /^([-*+]\s|#{1,6}\s|```|\||>\s*$)/.test(next)) {
                break;
            }
            parts.push(next);
        }
        const joined = cell_text(parts.join(' '));
        if (joined === '') {
            continue;
        }
        return { stated: joined, unlabelled: false };
    }
    return { stated: null, unlabelled: lines.some((l) => RESUME_LOOSE.test(l)) };
}

/**
 * One roadmap sentence, safe between two pipes. ORDER IS LOAD-BEARING: truncate
 * before escaping, because cutting an escaped string severs a `\|` and leaves a
 * dangling backslash. HTML comments are removed, not escaped — a `<!--` reaching a
 * cell comments out the rest of the document, and one already did.
 */
function cell_text(raw: string): string {
    let out = raw
        .replace(/^\s*>\s?/, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<!--|-->/g, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (out.length > 200) {
        out = `${out.slice(0, 197).trimEnd()}...`;
    }
    return out.replace(/\|/g, '\\|');
}

function unarchived_complete(roadmaps: RoadmapStats[]): RoadmapStats[] {
    return roadmaps.filter((r) => r.total_active > 0 && r.open_ === 0 && r.deferred === 0);
}

function merge_gated_pending(roadmaps: RoadmapStats[]): RoadmapStats[] {
    return roadmaps.filter((r) => r.open_ > 0 && r.merge_gated === r.open_);
}

function pending_iron_law_3(roadmaps: RoadmapStats[]): RoadmapStats[] {
    return roadmaps.filter((r) => r.total_active > 0 && r.open_ === 0 && r.deferred > 0);
}

interface Bundle {
    slug: string;
    tickets: number;
    status: string;
    roadmap: string;
}

function collect_bundles(repo_root: string): Bundle[] {
    const reg = path.join(repo_root, 'agents', 'tickets', '_registry.yml');
    if (!fs.existsSync(reg)) {
        return [];
    }
    let YAML: typeof YamlModule;
    try {
        YAML = _require('yaml') as typeof YamlModule;
    } catch {
        return [];
    }
    let data: unknown;
    try {
        // yaml.safe_load(...) or {} — PyYAML 1.1 semantics; graceful on malformed.
        data = YAML.parse(fs.readFileSync(reg, { encoding: 'utf-8' }), { version: '1.1' }) ?? {};
    } catch {
        return [];
    }
    const out: Bundle[] = [];
    const bundles =
        data && typeof data === 'object' && !Array.isArray(data)
            ? ((data as Record<string, unknown>)['bundles'] ?? null)
            : null;
    const bundleMap =
        bundles && typeof bundles === 'object' && !Array.isArray(bundles)
            ? (bundles as Record<string, unknown>)
            : {};
    for (const slug of Object.keys(bundleMap).sort()) {
        const metaRaw = bundleMap[slug];
        const meta =
            metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
                ? (metaRaw as Record<string, unknown>)
                : {};
        const bdir = path.join(repo_root, 'agents', 'tickets', slug);
        let n = 0;
        if (_isDir(bdir)) {
            try {
                n = fs.readdirSync(bdir).filter((f) => f.startsWith('T-') && f.endsWith('.md')).length;
            } catch {
                n = 0;
            }
        }
        out.push({
            slug,
            tickets: n,
            status: (meta['status'] as string) ?? '?',
            roadmap: (meta['source_roadmap'] as string) ?? '',
        });
    }
    return out;
}

function render(roadmaps: RoadmapStats[], bundles: Bundle[] | null, roadmap_root: string): string {
    const total_done = roadmaps.reduce((s, r) => s + r.done, 0);
    const total_active = roadmaps.reduce((s, r) => s + r.total_active, 0);
    const overall_pct = total_active ? _pyRound((total_done * 100) / total_active) : 0;
    const pending = pending_iron_law_3(roadmaps);
    const gated = merge_gated_pending(roadmaps);
    const total_open_blockers = roadmaps.reduce((s, r) => s + r.open_blockers.length, 0);
    // The count alone answers "is something blocked", never "is it on me" —
    // and the per-roadmap anchors make the owner split a manual read across the
    // whole file. Name the user's share here and point at the command that
    // renders those entries as actions.
    const user_open_blockers = roadmaps.reduce(
        (s, r) => s + r.open_blockers.filter((b) => blocker_needs_user(b.owner)).length,
        0,
    );
    const lines: string[] = [];
    lines.push('# Roadmap Progress\n');
    const header_meta =
        `> ${roadmaps.length} open roadmap` +
        `${roadmaps.length !== 1 ? 's' : ''}` +
        ' · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · ' +
        '[skipped/](roadmaps/skipped/) · [later/](roadmaps/later/)' +
        (total_open_blockers > 0
            ? ` · **${total_open_blockers}** open blocker${total_open_blockers !== 1 ? 's' : ''}` +
              ' in the active tree' +
              (user_open_blockers > 0
                  ? `, **${user_open_blockers}** need you → \`agent-config gates\``
                  : '')
            : '') +
        // Two integers, never a row — see `stubs_due.headerFragment`.
        stubHeaderFragment(path.join(roadmap_root, 'stubs')) +
        '\n';
    lines.push(
        // Honest provenance (road-to-roadmap-archival-robustness, gap C): name a
        // regen path that exists in EVERY install, not a hardcoded
        // `.augment/scripts/...` that a script-less / non-Augment consumer does
        // not have. `task roadmap-progress` covers Taskfile projects; the bare
        // script name covers the rest.
        '> Auto-generated — do not edit. Regenerate with `task roadmap-progress` ' +
            'or by running the `update_roadmap_progress` script for your install; ' +
            'rewritten on every roadmap create / execute / completion change. ' +
            'A repository that does not commit this file has no git history for ' +
            'it — regenerate to see the current state.\n>\n' +
            header_meta,
    );
    lines.push('## Overall\n');
    lines.push(`**${total_done} / ${total_active} steps done · ${overall_pct}%**\n`);
    lines.push('```text\n' + bar(overall_pct, 40) + `   ${overall_pct}%\n` + '```\n');
    if (pending.length) {
        lines.push('## ⚠️ Iron Law 3 — unresolved deferred items\n');
        lines.push(
            'These roadmaps have `count_open == 0` but carry `[~]` deferred ' +
                'items. Per `roadmap-progress-sync` Iron Law 3 they do NOT ' +
                'auto-archive — the user must resolve the deferrals first ' +
                '(spawn follow-up, restore, or cancel). See ' +
                '[`roadmap-management § 4b`](../packages/core/.agent-src.uncondensed/skills/roadmap-management/SKILL.md).\n',
        );
        lines.push('| Roadmap | Done | Deferred | Cancelled |');
        lines.push('|---|---:|---:|---:|');
        for (const r of pending) {
            lines.push(
                `| [${r.rel}](roadmaps/${r.rel}) | ${r.done} | ` + `${r.deferred} | ${r.cancelled} |`,
            );
        }
        lines.push('');
    }
    if (gated.length) {
        lines.push('## ⏳ Merge-gated — pending post-merge archival\n');
        lines.push(
            'Every open item in these roadmaps is `merge-gated`: held open ' +
                'on purpose while a closing PR is in flight, so inbound ' +
                'references keep resolving until the file archives. **The moment ' +
                'the gating PR merges**, flip the merge-gated box → `[x]`, ' +
                '`git mv` the roadmap to `archive/`, migrate inbound refs, and ' +
                'regenerate this dashboard — all in the same response (per ' +
                '`roadmap-progress-sync` Iron Law 1). Do NOT leave it lingering ' +
                'at < 100%.\n',
        );
        lines.push('| Roadmap | Done | Merge-gated open | Gating PR |');
        lines.push('|---|---:|---:|---|');
        for (const r of gated) {
            const prs = r.merge_gated_prs.map((n) => `#${n}`).join(', ') || '—';
            lines.push(
                `| [${r.rel}](roadmaps/${r.rel}) | ${r.done} | ` + `${r.merge_gated} | ${prs} |`,
            );
        }
        lines.push('');
    }
    const unarchived = unarchived_complete(roadmaps);
    if (unarchived.length) {
        // Non-CI backstop (road-to-roadmap-archival-robustness, gap C): a
        // persistent dashboard banner makes "completed but unarchived" visible
        // without the CI `--check` gate — the consumer sees it on every regen.
        lines.push('## ✅ Completed — pending archival\n');
        lines.push(
            'These roadmaps are **complete** (`count_open == 0`, ' +
                '`count_deferred == 0`) but still sit in the active tree. They ' +
                'should be in `agents/roadmaps/archive/`. Run the archival sweep ' +
                '`archive_completed_roadmaps --all` (untracked-safe), or follow the ' +
                'manual fallback documented in the `roadmap-management` skill, then ' +
                'regenerate this dashboard.\n',
        );
        lines.push('| Roadmap | Done | Total |');
        lines.push('|---|---:|---:|');
        for (const r of unarchived) {
            lines.push(`| [${r.rel}](roadmaps/${r.rel}) | ${r.done} | ${r.total_active} |`);
        }
        lines.push('');
    }
    if (roadmaps.length === 0) {
        lines.push('_No open roadmaps._\n');
        return lines.join('\n') + '\n';
    }
    lines.push('## Open roadmaps\n');
    lines.push(
        '| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Blocker | Progress |',
    );
    lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---|');
    roadmaps.forEach((r, idx) => {
        const i = idx + 1;
        const openBlockers = r.open_blockers.length;
        const blockerCell =
            openBlockers > 0 ? `[${openBlockers}](#${_blockerAnchor(r.rel)})` : '0';
        lines.push(
            `| ${i} | [${r.rel}](roadmaps/${r.rel}) | ${r.phases.length} | ${r.total_all} | ` +
                `${r.open_} | ${r.done} | ${r.deferred} | ${r.cancelled} | ${blockerCell} | ` +
                `${bar(r.percent)} ${r.percent}% |`,
        );
    });
    lines.push('');
    lines.push('---\n');

    // Listed under the active table so the two are read together. Parked work
    // carries no counts here; what a reader needs is what brings it back.
    const parked = collect_parked(roadmap_root);
    if (parked.length > 0) {
        lines.push(
            `## Parked — \`later/\` (${parked.length} roadmap` +
                `${parked.length !== 1 ? 's' : ''}, not active backlog)\n`,
        );
        lines.push(
            '> Excluded from the table above and from `/roadmap:process-*` by ' +
                'design. Listed here so a resume condition is visible without ' +
                'opening the file.\n',
        );
        const parked_open = parked.reduce((n, r) => n + r.open_blockers, 0);
        const parked_user = parked.reduce((n, r) => n + r.needs_user, 0);
        if (parked_open > 0) {
            lines.push(
                `> Carrying **${parked_open}** open blocker` +
                    `${parked_open !== 1 ? 's' : ''}` +
                    (parked_user > 0 ? `, **${parked_user}** owned by you` : '') +
                    ' — parking resolves nothing, so these are NOT in the ' +
                    'active-tree count above.\n',
            );
        }
        lines.push('| Roadmap | Open blockers | Resume when |');
        lines.push('|---|---:|---|');
        for (const r of parked) {
            const cell =
                r.resume ??
                (r.unlabelled
                    ? '_condition present but unlabelled — see file_'
                    : '_no resume line recorded_');
            const blockers =
                r.open_blockers === 0
                    ? '0'
                    : `${r.open_blockers}${r.needs_user > 0 ? ` (${r.needs_user} you)` : ''}`;
            // `<!-- ref-ignore -->` per row — a correctness fix, not a suppression. A
            // resume condition NAMES WHAT DOES NOT EXIST YET ("when `x.md` exists" is
            // the commonest shape in `later/`), so checking these quoted paths as live
            // references fires the gate on correct content. It fired immediately. The
            // authoritative copy of each path is the roadmap file; this table quotes
            // it, and that gate does not walk `later/` either way.
            lines.push(
                `| [${r.rel}](roadmaps/later/${r.rel}) | ${blockers} | ${cell} |` +
                    ' <!-- ref-ignore -->',
            );
        }
        lines.push('');
        lines.push('---\n');
    }

    lines.push('## Per-roadmap phase breakdown\n');
    for (const r of roadmaps) {
        lines.push(`### [${r.rel}](roadmaps/${r.rel})\n`);
        lines.push(`**${r.title}** — ${r.done} / ${r.total_active} done (${r.percent}%)\n`);
        lines.push('| # | Phase | State | Open | Done | Deferred | Cancelled | % |');
        lines.push('|---|---|---|---:|---:|---:|---:|---:|');
        for (const p of r.phases) {
            lines.push(
                `| ${p.id} | ${p.name} | ${p.state} | ${p.open_} | ${p.done} | ` +
                    `${p.deferred} | ${p.cancelled} | ${p.percent}% |`,
            );
        }
        lines.push('');
        const openBlockers = r.open_blockers;
        if (openBlockers.length) {
            lines.push(`<a id="${_blockerAnchor(r.rel)}"></a>`);
            lines.push('**Blockers**\n');
            for (const b of openBlockers) {
                lines.push(`- **${b.id}** (owner: ${b.owner}) — blocks ${b.blocks}`);
                if (b.recommendation) {
                    lines.push(`  - **Recommendation:** ${b.recommendation}`);
                }
                if (b.ifNothing) {
                    lines.push(`  - **If you do nothing:** ${b.ifNothing}`);
                }
                lines.push('  - **What to do:**');
                for (const step of b.todo) {
                    lines.push(`    ${step}`);
                }
                lines.push(`  - **Resolved when:** ${b.resolvedWhen}`);
            }
            const resolvedCount = r.resolved_blockers.length;
            if (resolvedCount > 0) {
                lines.push(
                    `\n_${resolvedCount} blocker${resolvedCount !== 1 ? 's' : ''} resolved._`,
                );
            }
            lines.push('');
        }
    }
    if (bundles && bundles.length) {
        lines.push('---\n');
        lines.push('## Ticket bundles\n');
        lines.push(
            'Materialised ticket bundles under [`agents/tickets/`](tickets/) ' +
                '(via `/roadmap:materialize`), counted from ' +
                '`agents/tickets/_registry.yml`.\n',
        );
        lines.push('| Bundle | Tickets | Status | Source roadmap |');
        lines.push('|---|---:|---|---|');
        for (const b of bundles) {
            lines.push(
                `| ${b.slug} | ${b.tickets} | ${b.status} | ` + `${b.roadmap} |`,
            );
        }
        lines.push('');
    }
    return lines.join('\n') + '\n';
}

// --- argparse parity ---------------------------------------------------------

class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

const _PROG = 'update_roadmap_progress.py';

function _usage(): string {
    return (
        `usage: ${_PROG} [-h] [--check] [--tracked-mode | --untracked-mode]\n` +
        `       [--archive | --no-archive] [--repo-root REPO_ROOT] [--dashboard-only]\n`
    );
}

interface Args {
    check: boolean;
    mode: DashboardMode;
    archive: boolean;
    repo_root: string;
    /**
     * Assert ONLY this artefact's own state — tracked / absent / stale — not
     * the estate-wide conditions `--check` also carries. Two obligations, two
     * blast radii: why that split exists, and what it cost when it did not,
     * is on the `roadmap-dashboard-untracked-check` task in
     * `taskfiles/content.yml`.
     */
    dashboard_only: boolean;
}

function _parseArgs(argv: readonly string[]): Args {
    let check = false;
    let mode: DashboardMode = 'tracked';
    let archive = false;
    let dashboard_only = false;
    let repo_root = process.cwd();
    const emitError = (msg: string): never => {
        process.stderr.write(_usage());
        process.stderr.write(`${_PROG}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            process.stdout.write(_usage());
            throw new ArgparseExit(0);
        } else if (tok === '--check') {
            check = true;
            i += 1;
        } else if (parseModeToken(tok) !== null) {
            mode = parseModeToken(tok) as DashboardMode;
            i += 1;
        } else if (tok === '--dashboard-only') {
            dashboard_only = true;
            i += 1;
        } else if (tok === '--archive') {
            archive = true;
            i += 1;
        } else if (tok === '--no-archive') {
            archive = false;
            i += 1;
        } else if (tok === '--repo-root') {
            const val = argv[i + 1];
            if (val === undefined) {
                emitError('argument --repo-root: expected one argument');
            }
            repo_root = val as string;
            i += 2;
        } else if (tok.startsWith('--repo-root=')) {
            repo_root = tok.slice('--repo-root='.length);
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    if (check && archive) {
        // A gate that mutates the tree it is checking cannot be trusted by CI
        // (council 2026-08-20, both seats). Refuse the combination outright
        // rather than silently letting one win.
        emitError('argument --archive: not allowed with --check');
    }
    if (dashboard_only && !check) {
        emitError('argument --dashboard-only: only meaningful with --check');
    }
    return { check, mode, archive, repo_root, dashboard_only };
}

/**
 * When the default cwd carries no `agents/roadmaps/`, fall back to the git
 * toplevel — hook and IDE invocations often run from a subdirectory, and a
 * cwd-only resolution silently skipped the dashboard there. An explicit
 * `--repo-root` always wins; a cwd that has the directory is used as-is
 * (monorepo sub-project support).
 */
function _fallback_git_toplevel(repo_root: string): string {
    try {
        const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
            cwd: repo_root,
            encoding: 'utf-8',
            timeout: 10_000,
        });
        const top = (r.stdout || '').trim();
        if (r.status === 0 && top !== '' && _isDir(path.join(top, 'agents', 'roadmaps'))) {
            return top;
        }
    } catch {
        /* not a git repo / git missing — keep the cwd default */
    }
    return repo_root;
}

function main(argv?: readonly string[]): number {
    const args = _parseArgs(argv ?? process.argv.slice(2));
    let repo_root = args.repo_root;
    if (repo_root === process.cwd() && !_isDir(path.join(repo_root, 'agents', 'roadmaps'))) {
        repo_root = _fallback_git_toplevel(repo_root);
    }
    const roadmap_root = path.join(repo_root, 'agents', 'roadmaps');
    const target = path.join(repo_root, 'agents', 'roadmaps-progress.md');
    if (!_isDir(roadmap_root)) {
        if (args.check) {
            return 0;
        }
        process.stdout.write(`ℹ️  No roadmaps directory at ${roadmap_root} — nothing to do.\n`);
        return 0;
    }
    // Archive before rendering, so the dashboard describes the tree the sweep
    // leaves behind rather than the one it found. `--check` never archives: a
    // gate that mutates the tree it is checking cannot be trusted by CI.
    let sweep_out = '';
    if (!args.check && args.archive && unarchived_complete(collect(roadmap_root)).length > 0) {
        const swept = run_archival_sweep(repo_root);
        sweep_out = swept.stdout;
        if (swept.stderr) {
            process.stderr.write(swept.stderr);
        }
        if (!swept.ok) {
            // A half-finished sweep leaves the tree in a shape the dashboard
            // would describe as if it were intentional. Report and stop before
            // writing (council 2026-08-20: "archival failures must prevent
            // dashboard rendering so partially updated state is not presented
            // as current").
            process.stderr.write(
                '❌  The archival sweep failed — dashboard NOT regenerated. ' +
                    'Fix the tree, then re-run.\n',
            );
            return 1;
        }
    }
    const roadmaps = collect(roadmap_root), guarded = reportGuardedBaselines(roadmaps, repo_root);
    const new_text = render(roadmaps, collect_bundles(repo_root), roadmap_root) + guarded.section;
    const complete = unarchived_complete(roadmaps);
    const pending = pending_iron_law_3(roadmaps);
    const gated = merge_gated_pending(roadmaps);

    const _warn_merge_gated = (): void => {
        process.stderr.write(
            '⏳  Merge-gated roadmaps (every open item gated on a PR) — ' +
                'flip + archive the moment the gating PR merges ' +
                '(`roadmap-progress-sync` Iron Law 1):\n',
        );
        for (const r of gated) {
            const prs = r.merge_gated_prs.map((n) => `#${n}`).join(', ') || 'PR unknown';
            process.stderr.write(
                `      - ${r.rel}  (${r.done}/${r.total_active} done · ` +
                    `${r.merge_gated} merge-gated · ${prs})\n`,
            );
        }
    };

    if (args.check) {
        const rel = _relPosix(repo_root, target);
        const r = reportCheckVerdict({
            verdict: evaluateDashboardOnDisk({ mode: args.mode, target, repo_root, rendered: new_text, rel }),
            complete,
            pending,
            dashboardOnly: args.dashboard_only,
            warnMergeGated: _warn_merge_gated,
            gatedCount: gated.length,
        });
        if (r.stderr) process.stderr.write(r.stderr);
        if (r.stdout) process.stdout.write(r.stdout);
        return guarded.problems > 0 ? 1 : r.rc;
    }
    fs.writeFileSync(target, new_text, { encoding: 'utf-8' });
    process.stdout.write(
        `✅  Wrote ${_relPosix(repo_root, target)} · ` +
            `${roadmaps.length} roadmap(s) · ` +
            `${roadmaps.reduce((s, r) => s + r.done, 0)}/${roadmaps.reduce((s, r) => s + r.total_active, 0)} steps done.\n`,
    );
    if (sweep_out) {
        process.stdout.write(sweep_out);
    }
    if (complete.length) {
        // Whatever survived the sweep is complete but NOT archivable — the
        // sweep already said why on stderr (an open blocker outlives its
        // steps). Without `--archive` this is every complete roadmap.
        process.stderr.write(
            '⚠️   Completed roadmaps not yet archived — move to ' +
                '`agents/roadmaps/archive/`:\n',
        );
        for (const r of complete) {
            process.stderr.write(`      - ${r.rel}\n`);
        }
    }
    if (pending.length) {
        process.stderr.write(
            '⚠️   Iron Law 3 — roadmaps with unresolved `[~]` deferred items. ' +
                'Surface them and ask the user (`roadmap-management § 4b`) ' +
                'before any archive:\n',
        );
        for (const r of pending) {
            process.stderr.write(`      - ${r.rel}  (${r.deferred} deferred)\n`);
        }
    }
    if (gated.length) {
        _warn_merge_gated();
    }
    return guarded.problems > 0 ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via `.augment/scripts` → `dist/agent-src/scripts`,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the symlink
    // path. Compare realpaths so the entry guard still fires (without this the
    // dashboard regen silently no-ops when run through the symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exitCode = main();
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}

export {
    PhaseStats,
    RoadmapStats,
    CHECKBOX_RE,
    PHASE_RE,
    TITLE_RE,
    FRONTMATTER_RE,
    parse_frontmatter,
    is_draft,
    is_roadmap_candidate,
    count_checkboxes,
    parse_blockers,
    blocker_class,
    blocker_is_resolved,
    blocker_needs_user,
    parse_roadmap,
    bar,
    collect,
    unarchived_complete,
    merge_gated_pending,
    pending_iron_law_3,
    collect_bundles,
    render,
    main,
    _pyRound,
};
export type { Bundle, Blocker };
