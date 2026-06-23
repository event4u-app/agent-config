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
 *   node node_modules/.bin/tsx .augment/scripts/update_roadmap_progress.ts --check      # CI: exit 1 if stale
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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type * as YamlModule from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const _require = createRequire(import.meta.url);

// CHECKBOX_RE = re.compile(r"^\s*[-*]\s+\[([ xX~\-])\]\s", re.MULTILINE)
const CHECKBOX_RE = /^[ \t\n\r\f\v]*[-*][ \t\n\r\f\v]+\[([ xX~\-])\][ \t\n\r\f\v]/gm;
// PHASE_RE (MULTILINE) — H2/H3 "Phase <id>" with optional separator + name.
const PHASE_RE =
    /^(#{2,3})[ \t\n\r\f\v]+Phase[ \t\n\r\f\v]+(\d+[a-z]?|[IVX]+|[A-Z](?:\d+)?)(?:[\s:—\-]+([\s\S]*?))?[ \t\f\v\r]*$/gm;
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

    constructor(p: string, rel: string, title: string, phases: PhaseStats[] = []) {
        this.path = p;
        this.rel = rel;
        this.title = title;
        this.phases = phases;
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

function is_roadmap_candidate(p: string): boolean {
    const name = path.basename(p);
    if (EXCLUDE_NAMES.has(name)) {
        return false;
    }
    if (EXCLUDE_PREFIXES.some((pre) => name.startsWith(pre))) {
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
    const stats = new RoadmapStats(p, rel, title);
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

function render(roadmaps: RoadmapStats[], bundles: Bundle[] | null = null): string {
    const total_done = roadmaps.reduce((s, r) => s + r.done, 0);
    const total_active = roadmaps.reduce((s, r) => s + r.total_active, 0);
    const overall_pct = total_active ? _pyRound((total_done * 100) / total_active) : 0;
    const pending = pending_iron_law_3(roadmaps);
    const gated = merge_gated_pending(roadmaps);
    const lines: string[] = [];
    lines.push('# Roadmap Progress\n');
    const header_meta =
        `> ${roadmaps.length} open roadmap` +
        `${roadmaps.length !== 1 ? 's' : ''}` +
        ' · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · ' +
        '[skipped/](roadmaps/skipped/) · [later/](roadmaps/later/)\n';
    lines.push(
        // Honest provenance (road-to-roadmap-archival-robustness, gap C): name a
        // regen path that exists in EVERY install, not a hardcoded
        // `.augment/scripts/...` that a script-less / non-Augment consumer does
        // not have. `task roadmap-progress` covers Taskfile projects; the bare
        // script name covers the rest.
        '> Auto-generated — do not edit. Regenerate with `task roadmap-progress` ' +
            'or by running the `update_roadmap_progress` script for your install; ' +
            'rewritten on every roadmap create / execute / completion change ' +
            '(timestamp lives in git history).\n>\n' +
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
    lines.push('| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Progress |');
    lines.push('|---|---|---:|---:|---:|---:|---:|---:|---|');
    roadmaps.forEach((r, idx) => {
        const i = idx + 1;
        lines.push(
            `| ${i} | [${r.rel}](roadmaps/${r.rel}) | ${r.phases.length} | ${r.total_all} | ` +
                `${r.open_} | ${r.done} | ${r.deferred} | ${r.cancelled} | ` +
                `${bar(r.percent)} ${r.percent}% |`,
        );
    });
    lines.push('');
    lines.push('---\n');
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
    return `usage: ${_PROG} [-h] [--check] [--repo-root REPO_ROOT]\n`;
}

interface Args {
    check: boolean;
    repo_root: string;
}

function _parseArgs(argv: readonly string[]): Args {
    let check = false;
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
    return { check, repo_root };
}

function main(argv?: readonly string[]): number {
    const args = _parseArgs(argv ?? process.argv.slice(2));
    const repo_root = args.repo_root;
    const roadmap_root = path.join(repo_root, 'agents', 'roadmaps');
    const target = path.join(repo_root, 'agents', 'roadmaps-progress.md');
    if (!_isDir(roadmap_root)) {
        if (args.check) {
            return 0;
        }
        process.stdout.write(`ℹ️  No roadmaps directory at ${roadmap_root} — nothing to do.\n`);
        return 0;
    }
    const roadmaps = collect(roadmap_root);
    const new_text = render(roadmaps, collect_bundles(repo_root));
    const current = fs.existsSync(target) ? fs.readFileSync(target, { encoding: 'utf-8' }) : '';
    const complete = unarchived_complete(roadmaps);
    const pending = pending_iron_law_3(roadmaps);
    const gated = merge_gated_pending(roadmaps);

    const _relToRepo = (p: string): string => _relPosix(repo_root, p);

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
        const stale = current !== new_text;
        if (stale) {
            process.stderr.write(
                `❌  ${_relToRepo(target)} is stale. ` +
                    'Run `node node_modules/.bin/tsx .augment/scripts/update_roadmap_progress.ts` ' +
                    'to regenerate (or `task roadmap-progress` in Taskfile ' +
                    'projects).\n',
            );
        }
        if (complete.length) {
            process.stderr.write(
                '❌  Completed roadmaps are still in `agents/roadmaps/` — ' +
                    'move them to `agents/roadmaps/archive/` (per the ' +
                    '`roadmap-progress-sync` rule):\n',
            );
            for (const r of complete) {
                process.stderr.write(`      - ${r.rel}  (${r.done}/${r.total_active} done)\n`);
            }
        }
        if (pending.length) {
            process.stderr.write(
                '❌  Iron Law 3 — roadmaps with unresolved `[~]` deferred ' +
                    'items must NOT auto-archive. Resolve via `roadmap-management § 4b` ' +
                    '(spawn follow-up, restore, or cancel):\n',
            );
            for (const r of pending) {
                process.stderr.write(
                    `      - ${r.rel}  (${r.done}/${r.total_active} done · ` +
                        `${r.deferred} deferred)\n`,
                );
            }
        }
        if (gated.length) {
            _warn_merge_gated();
        }
        if (stale || complete.length || pending.length) {
            return 1;
        }
        process.stdout.write(`✅  ${_relToRepo(target)} is up to date.\n`);
        return 0;
    }
    fs.writeFileSync(target, new_text, { encoding: 'utf-8' });
    process.stdout.write(
        `✅  Wrote ${_relToRepo(target)} · ` +
            `${roadmaps.length} roadmap(s) · ` +
            `${roadmaps.reduce((s, r) => s + r.done, 0)}/${roadmaps.reduce((s, r) => s + r.total_active, 0)} steps done.\n`,
    );
    if (complete.length) {
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
export type { Bundle };
