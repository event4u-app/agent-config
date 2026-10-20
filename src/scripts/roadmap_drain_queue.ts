#!/usr/bin/env tsx
/**
 * `roadmap_drain_queue` — the one order `/roadmap:process-full --all` drains in.
 *
 * Ordering by percent done puts the gated tails of nearly-finished roadmaps on
 * top; an orchestrator screens them as blocked and starts an unstarted roadmap
 * instead, so work spreads across many roadmaps and none finishes. The order
 * here asks whether a started roadmap can still move, and answers from the file:
 *
 * 1. `resume`   — a roadmap claimed by a session or lane that is no longer
 *                 alive. Its worktree and branch carry unfinished work; continue
 *                 there. `salvage` says how much: commits ahead of the default
 *                 and uncommitted files, read from that worktree.
 * 1b. `close`   — every step is done and only acceptance criteria are open.
 * 2. `continue` — started (`[x]` ≥ 1) with at least one runnable open step,
 *                 fewest runnable steps first, so the nearest finish lands first.
 * 3. `decide`   — open steps exist and none is runnable. Never dispatched to a
 *                 lane; its blockers go to the council or the owner batch.
 * 4. `start`    — unstarted and runnable. Dispatchable ONLY when no unclaimed
 *                 `continue` or `resume` entry is left.
 *
 * A roadmap a live peer session has claimed is listed as `claimed` and never
 * selected, so a second session takes the next started roadmap instead of the
 * same one or a new one. Claims are read from the per-slug locks
 * (`_lib/roadmap_slug_lock.ts`) as well as the register, so a claim is visible
 * the moment it is written and every lane of one session keeps its own.
 *
 * Acceptance-criteria checkboxes are not steps: an item under an
 * `## Acceptance Criteria` heading or labelled `AC-<n>` is counted in
 * `acceptance_open` and never as runnable. Counting them as steps sent a lane
 * to a roadmap screened "14 runnable" whose 14 were 4 held steps and 10 ACs.
 *
 * The classification is a reading of markers and fields, not a judgement: a
 * step without a `blocked-by` marker and without a dated wait reads runnable.
 * `blocked-by` markers and a blocker's `Class` / `Owner` / `Status` fields are
 * authoritative. The time-gated class is a heuristic: a wait word next to an
 * ISO date later than today. A prose hold — `Held open`, `still held`, `on hold`,
 * `waits on` in a step's continuation lines, or in a blockquote opening its
 * phase — reads `held`: not runnable, not routed to a question batch, and its
 * roadmap lands in `decide` when nothing else is runnable. The step's own title
 * line is never read for a hold, because titles describe behaviour ("ships only
 * when both hold") rather than state.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { gitEnv } from './_lib/git_env.js';
import { holder_is_live, read_holders, read_locks } from './_lib/roadmap_slug_lock.js';
import {
    is_expired,
    read_live_records,
    register_dir,
    type SessionRecord,
} from './_lib/session_register.js';

export type StepClass = 'runnable' | 'council' | 'owner' | 'time' | 'held';
export type Bucket = 'resume' | 'close' | 'continue' | 'decide' | 'start' | 'claimed';

export interface Blocker {
    id: string;
    open: boolean;
    owner: string;
    cls: string | null;
}

export interface OpenStep {
    line: number;
    text: string;
    cls: StepClass;
    blocker: string | null;
}

export interface RoadmapScreen {
    slug: string;
    path: string;
    complexity: string;
    done: number;
    open: number;
    /** Open acceptance-criteria checkboxes — never steps, never runnable. */
    acceptance_open: number;
    counts: Record<StepClass, number>;
    steps: OpenStep[];
    blockers: Blocker[];
}

export interface QueueEntry {
    slug: string;
    bucket: Bucket;
    done: number;
    open: number;
    runnable: number;
    acceptance_open: number;
    dispatchable: boolean;
    claimed_by?: string;
    resume?: { worktree: string; branch: string | null; session_id: string };
    /** Where a live lane of this or another session works this roadmap. */
    lane?: { worktree: string; branch: string | null };
    /** What a dead holder left in its worktree; filled by `main`, not by `buildQueue`. */
    salvage?: Salvage;
}

export interface Salvage {
    worktree_exists: boolean;
    /** Commits on the worktree's HEAD not on the default branch; null when unreadable. */
    ahead: number | null;
    /** Uncommitted files (tracked or untracked); null when unreadable. */
    dirty: number | null;
}

export interface GatedQuestion {
    roadmap: string;
    blocker: string;
    steps: number;
}

export interface DrainQueue {
    today: string;
    queue: QueueEntry[];
    next: QueueEntry | null;
    owner_questions: GatedQuestion[];
    council_questions: GatedQuestion[];
}

const ACTIVE_DIR = 'agents/roadmaps';
const CHECKBOX_RE = /^\s*-\s\[([ xX~-])\]/;
const FENCE_RE = /^\s*```/;
const BLOCKER_HEADING_RE = /^###[ \t]+blocker:[ \t]*([A-Za-z0-9-]+)/i;
const BLOCKED_BY_RE = /<!--[ \t]*blocked-by:[ \t]*([a-z0-9-]+(?:#[a-z0-9-]+)?)/i;
const PROSE_BLOCKER_RE = /\bblocker[ \t]+`([a-z0-9-]+)`/gi;
const PROSE_HOLD_RE = /\b(held open|still held|on hold|held off|parked until|(?:still |only )?waits on|waiting on)\b/i;
const ACCEPTANCE_HEADING_RE = /^##[ \t]+acceptance criteria\b/i;
const AC_ITEM_RE = /^\s*-\s\[[ xX~-]\]\s*(?:<!--[\s\S]*?-->\s*)?(?:\*\*)?AC-\d+/;
const FIELD_RE = (name: string): RegExp =>
    new RegExp(`^-[ \\t]*\\*\\*${name}:\\*\\*[ \\t]*(.*)$`, 'im');
const USER_OWNER_RE = /^(maintainer|user|owner)\b/i;
const WAIT_WORD_RE = /\b(window|soak|earliest|not before|opens?|waits?|until|after the next release)\b/i;
const ISO_DATE_RE = /\b(20\d\d-\d\d-\d\d)\b/g;
const TIER_ORDER: Readonly<Record<string, number>> = { lightweight: 0, bounded: 1, structural: 2 };

function frontmatterField(text: string, key: string): string {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (fm === null) return '';
    const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(fm[1] ?? '');
    return (m?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
}

/** Every `### blocker:` entry, its fields read up to the next heading. */
export function parseBlockers(text: string): Blocker[] {
    const lines = text.split('\n');
    const out: Blocker[] = [];
    for (let i = 0; i < lines.length; i++) {
        const h = BLOCKER_HEADING_RE.exec(lines[i] ?? '');
        if (h === null) continue;
        let end = i + 1;
        while (end < lines.length && !/^#{2,3}[ \t]/.test(lines[end] ?? '')) end++;
        const body = lines.slice(i + 1, end).join('\n');
        const status = (FIELD_RE('Status').exec(body)?.[1] ?? '').trim();
        const cls = (FIELD_RE('Class').exec(body)?.[1] ?? '').trim();
        out.push({
            id: (h[1] ?? '').toLowerCase(),
            // `resolved` is the only closed token the blocker lint accepts.
            open: !/^resolved\b/i.test(status),
            owner: (FIELD_RE('Owner').exec(body)?.[1] ?? '').trim(),
            cls: /^[0-3]\b/.test(cls) ? cls.charAt(0) : null,
        });
    }
    return out;
}

function classOfBlocker(b: Blocker | undefined): StepClass {
    // An unresolvable reference is held, and held by the safest class.
    if (b === undefined) return 'owner';
    if (!b.open) return 'runnable';
    if (b.cls === '0' || b.cls === '1') return 'runnable';
    if (b.cls === '2') return 'council';
    if (USER_OWNER_RE.test(b.owner)) return 'owner';
    // An absent Class means 3 — human-only — per the blocker contract.
    return b.cls === null || b.cls === '3' ? 'owner' : 'council';
}

/** A dated wait the run cannot outlast: a wait word and a date after today. */
export function isTimeGated(block: string, today: string): boolean {
    if (!WAIT_WORD_RE.test(block)) return false;
    for (const m of block.matchAll(ISO_DATE_RE)) {
        if ((m[1] ?? '') > today) return true;
    }
    return false;
}

export type BlockerLookup = (ref: string) => Blocker | undefined;

/** Screen one roadmap's text: counts and one class per open step. */
export function screenRoadmap(
    slug: string,
    relPath: string,
    text: string,
    today: string,
    lookup: BlockerLookup = () => undefined,
): RoadmapScreen {
    const lines = text.split('\n');
    const blockers = parseBlockers(text);
    const local = new Map(blockers.map((b) => [b.id, b]));
    const counts: Record<StepClass, number> = { runnable: 0, council: 0, owner: 0, time: 0, held: 0 };
    const steps: OpenStep[] = [];
    let done = 0;
    let acceptanceOpen = 0;
    let inFence = false;
    let inAcceptance = false;
    let phaseHeld = false;
    let checkboxSinceHeading = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (/^#{1,6}[ \t]/.test(line)) {
            if (/^##[ \t]/.test(line)) {
                inAcceptance = ACCEPTANCE_HEADING_RE.test(line);
                phaseHeld = false;
            }
            checkboxSinceHeading = false;
            continue;
        }
        const m = CHECKBOX_RE.exec(line);
        if (m === null) {
            // A blockquote before the first step of a phase speaks for the phase.
            if (!checkboxSinceHeading && /^\s*>/.test(line) && PROSE_HOLD_RE.test(line)) phaseHeld = true;
            continue;
        }
        checkboxSinceHeading = true;
        const glyph = m[1] ?? ' ';
        if (inAcceptance || AC_ITEM_RE.test(line)) {
            if (glyph === ' ') acceptanceOpen++;
            continue;
        }
        if (glyph === 'x' || glyph === 'X') {
            done++;
            continue;
        }
        if (glyph !== ' ') continue;
        let end = i + 1;
        while (
            end < lines.length &&
            !CHECKBOX_RE.test(lines[end] ?? '') &&
            !/^#{1,6}[ \t]/.test(lines[end] ?? '')
        ) {
            end++;
        }
        const block = lines.slice(i, end).join('\n');
        const ref = BLOCKED_BY_RE.exec(block)?.[1]?.toLowerCase() ?? null;
        let cls: StepClass;
        let held = ref;
        if (ref !== null) {
            const b = ref.includes('#') ? lookup(ref) : local.get(ref);
            cls = classOfBlocker(b);
        } else {
            // Prose naming an OPEN local blocker holds the step as firmly as a marker.
            const namedAll = [...block.matchAll(PROSE_BLOCKER_RE)]
                .map((p) => local.get((p[1] ?? '').toLowerCase()))
                .filter((b): b is Blocker => b !== undefined);
            const named = namedAll.find((b) => b.open);
            // The step's own indented continuation only: the title line describes rather
            // than holds, and a paragraph after the list speaks for whatever it names.
            let contEnd = i + 1;
            while (contEnd < end && /^(\s|$)/.test(lines[contEnd] ?? '')) contEnd++;
            const continuation = lines.slice(i + 1, contEnd).join('\n');
            if (named !== undefined) {
                held = named.id;
                cls = classOfBlocker(named);
            } else if (isTimeGated(block, today)) {
                cls = 'time';
            } else if (namedAll.length === 0 && (phaseHeld || PROSE_HOLD_RE.test(continuation))) {
                // A hold that names a blocker which has since resolved is not a hold.
                cls = 'held';
            } else {
                cls = 'runnable';
            }
        }
        counts[cls]++;
        steps.push({ line: i + 1, text: line.trim().slice(0, 160), cls, blocker: held });
    }
    return {
        slug,
        path: relPath,
        complexity: frontmatterField(text, 'complexity') || 'structural',
        done,
        open: steps.length,
        acceptance_open: acceptanceOpen,
        counts,
        steps,
        blockers,
    };
}

export interface LiveClaim extends Pick<SessionRecord, 'session_id' | 'roadmap_slug'> {
    /** Held for a lane: its own session does not dispatch onto it either. */
    lane?: boolean;
    worktree?: string;
    branch?: string | null;
}

export interface ClaimView {
    live: ReadonlyArray<LiveClaim>;
    dead: ReadonlyArray<
        Pick<SessionRecord, 'session_id' | 'roadmap_slug' | 'worktree' | 'branch'>
    >;
}

/** Order screened roadmaps into the drain queue. Pure; the caller supplies claims. */
export function buildQueue(
    screens: readonly RoadmapScreen[],
    claims: ClaimView,
    today: string,
    ownSession: string | null = null,
): DrainQueue {
    const liveClaim = new Map<string, string>();
    const laneAt = new Map<string, { worktree: string; branch: string | null }>();
    for (const r of claims.live) {
        if (!r.roadmap_slug) continue;
        const own = r.session_id === ownSession;
        if (own && r.lane !== true) continue;
        liveClaim.set(r.roadmap_slug, own ? `a lane of this session` : r.session_id);
        if (r.worktree !== undefined) laneAt.set(r.roadmap_slug, { worktree: r.worktree, branch: r.branch ?? null });
    }
    const deadClaim = new Map<string, ClaimView['dead'][number]>();
    for (const r of claims.dead) {
        if (r.roadmap_slug && !liveClaim.has(r.roadmap_slug)) deadClaim.set(r.roadmap_slug, r);
    }

    const entries: QueueEntry[] = [];
    for (const s of screens) {
        if (s.open === 0 && s.acceptance_open === 0) continue;
        const base = {
            slug: s.slug,
            done: s.done,
            open: s.open,
            runnable: s.counts.runnable,
            acceptance_open: s.acceptance_open,
        };
        const holder = liveClaim.get(s.slug);
        if (holder !== undefined) {
            const lane = laneAt.get(s.slug);
            entries.push({
                ...base,
                bucket: 'claimed',
                dispatchable: false,
                claimed_by: holder,
                ...(lane !== undefined ? { lane } : {}),
            });
            continue;
        }
        const dead = deadClaim.get(s.slug);
        if (dead !== undefined && (s.counts.runnable > 0 || s.open === 0)) {
            entries.push({
                ...base,
                bucket: 'resume',
                dispatchable: true,
                resume: { worktree: dead.worktree, branch: dead.branch, session_id: dead.session_id },
            });
            continue;
        }
        if (s.open === 0) {
            entries.push({ ...base, bucket: 'close', dispatchable: true });
        } else if (s.counts.runnable === 0) {
            entries.push({ ...base, bucket: 'decide', dispatchable: false });
        } else if (s.done > 0) {
            entries.push({ ...base, bucket: 'continue', dispatchable: true });
        } else {
            entries.push({ ...base, bucket: 'start', dispatchable: false });
        }
    }

    const tier = new Map(screens.map((s) => [s.slug, TIER_ORDER[s.complexity] ?? 2]));
    const rank: Record<Bucket, number> = { resume: 0, close: 1, continue: 2, start: 3, decide: 4, claimed: 5 };
    entries.sort((a, b) => {
        if (rank[a.bucket] !== rank[b.bucket]) return rank[a.bucket] - rank[b.bucket];
        if (a.bucket === 'start') {
            const t = (tier.get(a.slug) ?? 2) - (tier.get(b.slug) ?? 2);
            if (t !== 0) return t;
            if (a.open !== b.open) return a.open - b.open;
        } else if (a.runnable !== b.runnable) {
            return a.runnable - b.runnable;
        }
        if (a.open !== b.open) return a.open - b.open;
        return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });

    // An unstarted roadmap becomes dispatchable only when nothing started can move.
    const startedCanMove = entries.some(
        (e) => e.bucket === 'resume' || e.bucket === 'close' || e.bucket === 'continue',
    );
    for (const e of entries) {
        if (e.bucket === 'start') e.dispatchable = !startedCanMove;
    }

    const owner_questions: GatedQuestion[] = [];
    const council_questions: GatedQuestion[] = [];
    for (const s of screens) {
        if (liveClaim.has(s.slug)) continue;
        const per = new Map<string, { cls: StepClass; n: number }>();
        for (const st of s.steps) {
            if (st.blocker === null || (st.cls !== 'owner' && st.cls !== 'council')) continue;
            const cur = per.get(st.blocker) ?? { cls: st.cls, n: 0 };
            cur.n++;
            per.set(st.blocker, cur);
        }
        for (const [blocker, v] of per) {
            const q = { roadmap: s.slug, blocker, steps: v.n };
            (v.cls === 'owner' ? owner_questions : council_questions).push(q);
        }
    }

    return {
        today,
        queue: entries,
        next: entries.find((e) => e.dispatchable) ?? null,
        owner_questions,
        council_questions,
    };
}

/** Screen every non-draft active roadmap; `later/`, `archive/` and `stubs/` are not drained. */
export function screenEstate(repoRoot: string, today: string): RoadmapScreen[] {
    const dir = path.join(repoRoot, ACTIVE_DIR);
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.startsWith('road-to-') && n.endsWith('.md'));
    } catch {
        return [];
    }
    const texts = new Map<string, string>();
    for (const n of names.sort()) {
        try {
            texts.set(n.slice(0, -3), fs.readFileSync(path.join(dir, n), 'utf-8'));
        } catch {
            /* unreadable file screens as absent */
        }
    }
    const blockersOf = new Map<string, Blocker[]>();
    const lookup: BlockerLookup = (ref) => {
        const [stem, id] = ref.split('#');
        const text = texts.get(stem ?? '');
        if (text === undefined || id === undefined) return undefined;
        let list = blockersOf.get(stem ?? '');
        if (list === undefined) {
            list = parseBlockers(text);
            blockersOf.set(stem ?? '', list);
        }
        return list.find((b) => b.id === id);
    };
    const out: RoadmapScreen[] = [];
    for (const [slug, text] of texts) {
        if (frontmatterField(text, 'status') === 'draft') continue;
        out.push(screenRoadmap(slug, `${ACTIVE_DIR}/${slug}.md`, text, today, lookup));
    }
    return out;
}

/**
 * Every claim on the estate: per-slug locks first, then register records. A lock
 * outranks a record for its slug — it is written at claim time and carries the
 * lane's worktree, while a record shows the session's last claim one heartbeat late.
 */
export function readClaims(repoRoot: string, now: Date = new Date()): ClaimView {
    const fromLocks = readLockClaims(repoRoot, now);
    const fromRegister = readRegisterClaims(repoRoot, now);
    const locked = new Set([...fromLocks.live, ...fromLocks.dead].map((c) => c.roadmap_slug));
    return {
        live: [...fromLocks.live, ...fromRegister.live.filter((c) => !locked.has(c.roadmap_slug))],
        dead: [...fromLocks.dead, ...fromRegister.dead.filter((c) => !locked.has(c.roadmap_slug))],
    };
}

function readLockClaims(repoRoot: string, now: Date): ClaimView {
    const holders = read_holders(repoRoot, now);
    const live: LiveClaim[] = [];
    const dead: Array<Pick<SessionRecord, 'session_id' | 'roadmap_slug' | 'worktree' | 'branch'>> = [];
    for (const l of read_locks(repoRoot)) {
        const sid = l.session_id ?? `worktree:${l.worktree}`;
        if (holder_is_live(l, holders, now)) {
            live.push({ session_id: sid, roadmap_slug: l.slug, lane: l.lane, worktree: l.worktree, branch: l.branch });
        } else {
            dead.push({ session_id: sid, roadmap_slug: l.slug, worktree: l.worktree, branch: l.branch });
        }
    }
    return { live, dead };
}

function readRegisterClaims(repoRoot: string, now: Date): ClaimView {
    const dir = register_dir(repoRoot);
    if (dir === null) return { live: [], dead: [] };
    const live = read_live_records(dir, { now });
    const dead: SessionRecord[] = [];
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        return { live, dead };
    }
    for (const n of names) {
        try {
            const rec = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf-8')) as SessionRecord;
            if (typeof rec.session_id === 'string' && rec.roadmap_slug && is_expired(rec, now)) {
                dead.push(rec);
            }
        } catch {
            /* a record that does not parse carries no claim */
        }
    }
    return { live, dead };
}

function git(cwd: string, args: string[]): string | null {
    try {
        return execFileSync('git', ['-C', cwd, ...args], {
            encoding: 'utf-8',
            env: gitEnv(),
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 10_000,
        });
    } catch {
        return null;
    }
}

/** What a holder left behind in its worktree. Best-effort; never throws. */
export function readSalvage(worktree: string, base = 'origin/main'): Salvage {
    if (!fs.existsSync(worktree)) return { worktree_exists: false, ahead: null, dirty: null };
    const ahead = git(worktree, ['rev-list', '--count', `${base}..HEAD`]);
    const status = git(worktree, ['status', '--porcelain']);
    return {
        worktree_exists: true,
        ahead: ahead === null ? null : Number.parseInt(ahead.trim(), 10),
        dirty: status === null ? null : status.split('\n').filter((l) => l.trim() !== '').length,
    };
}

function renderSalvage(s: Salvage | undefined): string {
    if (s === undefined) return '';
    if (!s.worktree_exists) return '  [worktree gone — work only on the branch, if it was pushed]';
    return `  [salvage: ${s.ahead ?? '?'} commit(s) ahead, ${s.dirty ?? '?'} uncommitted file(s)]`;
}

export function renderText(q: DrainQueue): string {
    const out: string[] = [`drain queue · ${q.today} · ${q.queue.length} roadmap(s) with open steps`];
    for (const e of q.queue) {
        const tail =
            e.bucket === 'claimed'
                ? `  held by ${e.claimed_by}${e.lane !== undefined ? ` in ${e.lane.worktree}` : ''}`
                : e.bucket === 'resume'
                  ? `  resume in ${e.resume?.worktree} (${e.resume?.branch ?? 'no branch'})`
                  : '';
        out.push(
            `  ${e.dispatchable ? '▶' : ' '} ${e.bucket.padEnd(8)} ${e.slug}  ` +
                `done ${e.done} · open ${e.open} · runnable ${e.runnable} · AC open ${e.acceptance_open}` +
                `${tail}${renderSalvage(e.salvage)}`,
        );
    }
    out.push(`next: ${q.next === null ? 'none — nothing dispatchable' : `${q.next.slug} (${q.next.bucket})`}`);
    out.push(`owner questions: ${q.owner_questions.length} · council questions: ${q.council_questions.length}`);
    for (const g of q.owner_questions) out.push(`  owner   ${g.roadmap}#${g.blocker}  (${g.steps} step(s))`);
    for (const g of q.council_questions) out.push(`  council ${g.roadmap}#${g.blocker}  (${g.steps} step(s))`);
    return `${out.join('\n')}\n`;
}

function argValue(argv: readonly string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] ?? null) : null;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--help')) {
        process.stdout.write(
            'usage: roadmap_drain_queue [--root DIR] [--session ID] [--today YYYY-MM-DD] [--json]\n',
        );
        return 0;
    }
    const root = argValue(argv, '--root') ?? process.cwd();
    const today = argValue(argv, '--today') ?? new Date().toISOString().slice(0, 10);
    const session = argValue(argv, '--session') ?? process.env['CLAUDE_CODE_SESSION_ID'] ?? null;
    const q = buildQueue(screenEstate(root, today), readClaims(root), today, session);
    for (const e of q.queue) {
        const wt = e.resume?.worktree ?? (e.claimed_by === 'a lane of this session' ? e.lane?.worktree : undefined);
        if (wt !== undefined) e.salvage = readSalvage(wt);
    }
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(q, null, 2)}\n` : renderText(q));
    return 0;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
