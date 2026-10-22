/**
 * The read-only half of advisories — what a session start may do
 * (road-to-advisories-heard-the-same-day Phase 4).
 *
 * Kept apart from `advisories.ts` on purpose: this module is inlined into the
 * hook bundle, and it holds no network code at all — no fetch, no process
 * spawn. A session start reads one cache file, prints at most a few lines, and
 * writes one "already shown today" stamp. Everything that touches the network
 * lives in `advisories.ts`, which a hook never imports.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { load_agent_settings, settings_layer_states } from './agent_settings.js';
import type { InventoryEntry } from './advisory_inventory.js';
import type { SourceReport } from './advisory_sources.js';
import type { Acceptance, Finding, Ledger } from './advisory_verdicts.js';
import { git_common_dir } from './git_common_dir.js';
import type { Remediations } from './security_fix.js';
import { mergedNotDeployed } from './undeployed_fixes.js';

export type AdvisoriesMode = 'notify' | 'off';
export type AdvisoriesEgress = 'query' | 'none';
export type AdvisoriesKev = 'on' | 'off';

/** Advisory data older than this makes the notice say so instead of looking current. */
export const STALE_AFTER_HOURS = 24;
/** Three days of a silent source is itself a notice (4.4). */
export const SILENCE_NOTICE_DAYS = 3;

export interface AdvisoryState {
    schema: 1;
    root: string;
    at: string;
    fingerprint: string;
    /** The egress setting this state was refreshed under. */
    egress?: AdvisoriesEgress;
    inventory: InventoryEntry[];
    findings: Finding[];
    reports: SourceReport[];
    ledger: Ledger;
    acceptances: Acceptance[];
    /** What the last refresh decided to announce; the session start prints it once. */
    notice: { at: string; interrupt: string[]; digest: number } | null;
    /** First time each source went silent, for the 4.4 silence notice. */
    silent_since: Record<string, string>;
    /** Fixes in flight and their lifecycle (road-to-security-fixes-carried-to-the-merge Phase 3). */
    remediations?: Remediations;
}

export function readAdvisorySettings(root: string): { mode: AdvisoriesMode; egress: AdvisoriesEgress; kev: AdvisoriesKev } {
    try {
        if (settings_layer_states({ cwd: root }).some((l) => l.state === 'malformed')) return { mode: 'off', egress: 'none', kev: 'off' };
        const section = load_agent_settings({ cwd: root })['advisories'];
        const s = section !== null && typeof section === 'object' && !Array.isArray(section) ? (section as Record<string, unknown>) : {};
        return {
            // An unquoted `off` is YAML's boolean false: both mean off.
            mode: s['mode'] === 'off' || s['mode'] === false ? 'off' : 'notify',
            // Opt-in: only an explicit `query` sends package names (release 17 review, council 2/2).
            egress: s['egress'] === 'query' ? 'query' : 'none',
            kev: s['kev'] === 'off' || s['kev'] === false ? 'off' : 'on',
        };
    } catch {
        return { mode: 'off', egress: 'none', kev: 'off' };
    }
}

/**
 * One cache per checkout. The git common dir is shared by every worktree of a
 * repository, so the file is keyed by the checkout's own real path: a refresh
 * inside a fix worktree describes that branch and never overwrites the main
 * checkout's findings.
 */
export function statePath(root: string): string | null {
    const common = git_common_dir(root);
    if (common === null) return null;
    let real = path.resolve(root);
    try {
        real = fs.realpathSync(root);
    } catch {
        /* a vanished checkout still gets a stable key from its resolved path */
    }
    const key = createHash('sha256').update(real).digest('hex').slice(0, 16);
    return path.join(common, 'agent-config', 'advisories', `${key}.json`);
}

/**
 * Fix lifecycles are per REPOSITORY, not per checkout: a fix claimed in the main
 * checkout is verified in its own worktree, and two worktrees must see one claim
 * for one finding. So they live beside the per-checkout caches, in the common
 * git dir every worktree shares.
 */
export function remediationsPath(root: string): string | null {
    const common = git_common_dir(root);
    return common === null ? null : path.join(common, 'agent-config', 'advisories', 'remediations.json');
}

export function readRemediations(root: string): Remediations {
    const p = remediationsPath(root);
    if (p !== null) {
        try {
            const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
            if (isObject(doc)) return doc as Remediations;
        } catch {
            /* absent or unreadable: fall back to a pre-shared cache below */
        }
    }
    // A cache written before the shared file existed carries its own copy.
    return readState(root)?.remediations ?? {};
}

export function readState(root: string): AdvisoryState | null {
    const p = statePath(root);
    if (p === null) return null;
    try {
        const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as AdvisoryState;
        return isState(doc) ? doc : null;
    } catch {
        return null;
    }
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The shape every reader below relies on; a cache that is not it is no cache. */
function isState(doc: unknown): doc is AdvisoryState {
    if (!isObject(doc) || doc['schema'] !== 1 || typeof doc['at'] !== 'string') return false;
    if (!Array.isArray(doc['findings']) || !doc['findings'].every((f) => isObject(f) && typeof f['key'] === 'string')) return false;
    const n = doc['notice'];
    if (n !== null && n !== undefined && !(isObject(n) && Array.isArray(n['interrupt']) && typeof n['digest'] === 'number')) return false;
    if (doc['silent_since'] !== undefined && !isObject(doc['silent_since'])) return false;
    if (doc['remediations'] !== undefined && !isObject(doc['remediations'])) return false;
    return true;
}

/** Most lines a session start prints, whatever the cache holds. */
export const MAX_NOTICE_LINES = 8;

/**
 * Every field a session line carries comes from a cache file on disk, and the
 * line lands in privileged session context. JSON encoding protects the file's
 * framing, not what the decoded string says — so each field is checked against
 * a strict single-line grammar with a length cap before it is printed, and a
 * field that fails is replaced, never passed through (council 2026-10-21, round 2).
 */
const FIELD = /^[A-Za-z0-9@._:/+~^<>=*-]{1,200}$/;

export function safeField(v: unknown, max = 80): string {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10_000_000) return String(v);
    if (typeof v !== 'string' || v.length > max || !FIELD.test(v)) return '?';
    return v;
}

const TIERS = new Set(['T0', 'T1', 'T2', 'T3']);
const VERDICTS = new Set([
    'affected', 'fix-available', 'fix-fresh', 'no-fix', 'malware', 'eol', 'eol-soon', 'pre-announced', 'unknown', 'accepted',
]);

function enumField(v: unknown, allowed: Set<string>): string {
    return typeof v === 'string' && allowed.has(v) ? v : '?';
}

function where(f: Finding): string {
    return f.file === '' ? '' : ` (${safeField(f.file, 200)}:${safeField(f.line)})`;
}

export function describe(f: Finding): string {
    const tier = enumField(f.tier, TIERS);
    const verdict = enumField(f.verdict, VERDICTS);
    const pkg = safeField(f.package);
    const ver = f.version === null ? '' : ` ${safeField(f.version)}`;
    const fix = f.fixed === null ? '' : ` → ${safeField(f.fixed)}`;
    const date = safeField(f.date);
    const ids = [f.id, ...(Array.isArray(f.aliases) ? f.aliases : [])].slice(0, 3).map((i) => safeField(i)).join(', ');
    // Provenance of the tier: "known exploited" is a fact, never a prediction.
    const kev = f.kev === true ? ' — known exploited (KEV)' : '';
    switch (verdict) {
        case 'pre-announced':
            return `${tier} ${pkg}: a security release is pre-announced (${date}); fixed versions not yet named${where(f)}`;
        case 'eol':
            return `${tier} ${pkg}${ver}: security support ended ${date}${where(f)}`;
        case 'eol-soon':
            return `${tier} ${pkg}${ver}: security support ends ${date}${where(f)}`;
        case 'unknown':
            if (typeof f.note === 'string' && f.note.includes('egress-none')) return `${tier} ${pkg}: not checked — advisories.egress is none`;
            if (typeof f.note === 'string' && f.note.includes('lockfile-unsupported')) return `${tier} ${pkg}: not checked — a lockfile format this audit cannot read (yarn, pnpm, bun or npm v1)`;
            if (typeof f.note === 'string' && f.note.startsWith('vendor-patched')) return `${tier} ${pkg}${ver}: distro-patched — judge it by the distro's own advisory${where(f)}`;
            return `${tier} ${pkg}: unknown — the source did not answer`;
        default:
            return `${tier} ${pkg}${ver}${fix} [${verdict}] ${ids}${kev}${where(f)}`;
    }
}

/**
 * The session notice — computed from the cache, never from the network, and
 * never an action. Each T0/T1 line ends in the offer; the routing behind the
 * offer is owned by road-to-security-fixes-carried-to-the-merge.
 */
export function noticeLines(state: AdvisoryState | null, now: Date = new Date(), remediations: Remediations | null = null): string[] {
    if (state === null) return [];
    const lines: string[] = [];
    // An unreadable or future timestamp proves nothing about freshness: stale.
    const atMs = Date.parse(state.at);
    const ageH = Number.isFinite(atMs) && atMs <= now.getTime() ? (now.getTime() - atMs) / 3600000 : Number.POSITIVE_INFINITY;
    const byKey = new Map(state.findings.map((f) => [f.key, f]));
    const pending = state.notice?.interrupt.map((k) => byKey.get(k)).filter((f): f is Finding => f !== undefined) ?? [];
    for (const f of pending) {
        lines.push(`advisory ${describe(f)} — fix now: /audit deps fix ${safeField(f.id)} (here or in its own worktree), or later`);
    }
    if ((state.notice?.digest ?? 0) > 0) lines.push(`advisories: ${safeField(state.notice!.digest)} more in the digest — /audit deps`);
    for (const [source, since] of Object.entries(state.silent_since ?? {}).slice(0, 4)) {
        const sinceMs = Date.parse(String(since));
        if (!Number.isFinite(sinceMs) || sinceMs > now.getTime()) {
            lines.push(`advisories: ${safeField(source)} silent since an unreadable date — findings from it are unknown, not clear`);
            continue;
        }
        const days = (now.getTime() - sinceMs) / 86400000;
        if (days >= SILENCE_NOTICE_DAYS) lines.push(`advisories: ${safeField(source)} has not answered for ${Math.floor(days)} days — findings from it are unknown, not clear`);
    }
    for (const u of mergedNotDeployed(remediations ?? state.remediations ?? {}, state.findings, now)) {
        const sha = u.mergeSha === null ? '' : ` (${safeField(u.mergeSha.slice(0, 12))})`;
        lines.push(`advisory ${safeField(u.id)}: merged${sha} but not deployed for ${safeField(u.hours)} h — deploy it the way this project deploys`);
    }
    if (ageH === Number.POSITIVE_INFINITY) {
        lines.push('advisories: data age unreadable — run `agent-config audit:deps refresh`');
    } else if (ageH >= STALE_AFTER_HOURS) {
        lines.push(`advisories: data is ${Math.floor(ageH / 24) || 1} day(s) old — run \`agent-config audit:deps refresh\``);
    }
    return lines.length > MAX_NOTICE_LINES ? [...lines.slice(0, MAX_NOTICE_LINES - 1), `advisories: ${lines.length - MAX_NOTICE_LINES + 1} more — /audit deps`] : lines;
}

/** Shown once per notice: the stamp records which notice this checkout already printed. */
export function sessionNotice(root: string, now: Date = new Date(), deliver?: (text: string) => boolean): string | null {
    if (readAdvisorySettings(root).mode === 'off') return null;
    const state = readState(root);
    if (state === null) return null;
    const stamp = statePath(root) + '.shown';
    let prev: { day?: string; once?: string[]; today?: string[] } = {};
    try {
        prev = JSON.parse(fs.readFileSync(stamp, 'utf-8')) as typeof prev;
    } catch {
        prev = {};
    }
    const day = now.toISOString().slice(0, 10);
    const lines = noticeLines(state, now, readRemediations(root));
    // A finding announced by a refresh is printed ONCE, whatever day it is and
    // however long the cache goes unrefreshed — the weekly budget and the delta
    // ledger count at refresh time, and a re-print would escape both. Reminders
    // (stale data, a silent source, merged-not-deployed) come back once a day.
    // Numbers that only age (hours, days) are not part of a line's identity.
    const keyOf = (l: string): string => createHash('sha256').update(l.replace(/\b\d+ (?:h|days?|day\(s\))\b/g, '#')).digest('hex').slice(0, 16);
    const isReminder = (l: string): boolean => /^advisories: (?:data|\S+ (?:has not answered|silent since))|: merged/.test(l);
    const once = new Set(Array.isArray(prev.once) ? prev.once : []);
    const today = new Set(prev.day === day && Array.isArray(prev.today) ? prev.today : []);
    const out = lines.filter((l) => (isReminder(l) ? !today.has(keyOf(l)) : !once.has(keyOf(l))));
    if (out.length === 0) return null;
    const text = out.join('\n');
    // Stamped only once the text reached someone: a caller that could not
    // deliver it leaves the notice for the next surface.
    if (deliver !== undefined && !deliver(text)) return null;
    for (const l of out) (isReminder(l) ? today : once).add(keyOf(l));
    try {
        fs.writeFileSync(stamp, `${JSON.stringify({ day, once: [...once].slice(-200), today: [...today] })}\n`);
    } catch {
        /* an unwritable stamp means the line may show twice; never a failure */
    }
    return text;
}

