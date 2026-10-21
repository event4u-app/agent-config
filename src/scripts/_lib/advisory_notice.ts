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

import * as fs from 'node:fs';
import * as path from 'node:path';

import { load_agent_settings, settings_layer_states } from './agent_settings.js';
import type { InventoryEntry } from './advisory_inventory.js';
import type { SourceReport } from './advisory_sources.js';
import type { Acceptance, Finding, Ledger } from './advisory_verdicts.js';
import { git_common_dir } from './git_common_dir.js';
import { mergedNotDeployed, type Remediations } from './security_fix.js';

export type AdvisoriesMode = 'notify' | 'off';
export type AdvisoriesEgress = 'query' | 'none';

/** Advisory data older than this makes the notice say so instead of looking current. */
export const STALE_AFTER_HOURS = 24;
/** Three days of a silent source is itself a notice (4.4). */
export const SILENCE_NOTICE_DAYS = 3;

export interface AdvisoryState {
    schema: 1;
    root: string;
    at: string;
    fingerprint: string;
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

export function readAdvisorySettings(root: string): { mode: AdvisoriesMode; egress: AdvisoriesEgress } {
    try {
        if (settings_layer_states({ cwd: root }).some((l) => l.state === 'malformed')) return { mode: 'off', egress: 'none' };
        const section = load_agent_settings({ cwd: root })['advisories'];
        const s = section !== null && typeof section === 'object' && !Array.isArray(section) ? (section as Record<string, unknown>) : {};
        return {
            mode: s['mode'] === 'off' ? 'off' : 'notify',
            egress: s['egress'] === 'none' ? 'none' : 'query',
        };
    } catch {
        return { mode: 'off', egress: 'none' };
    }
}

export function statePath(root: string): string | null {
    const common = git_common_dir(root);
    return common === null ? null : path.join(common, 'agent-config', 'advisories.json');
}

export function readState(root: string): AdvisoryState | null {
    const p = statePath(root);
    if (p === null) return null;
    try {
        const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as AdvisoryState;
        return doc.schema === 1 ? doc : null;
    } catch {
        return null;
    }
}

/**
 * Every field a session line carries comes from a cache file on disk, and the
 * line lands in privileged session context. JSON encoding protects the file's
 * framing, not what the decoded string says — so each field is checked against
 * a strict single-line grammar with a length cap before it is printed, and a
 * field that fails is replaced, never passed through (council 2026-10-21, round 2).
 */
const FIELD = /^[A-Za-z0-9@._:/+~^<>=*-]{1,120}$/;

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
    switch (verdict) {
        case 'pre-announced':
            return `${tier} ${pkg}: a security release is pre-announced (${date}); fixed versions not yet named${where(f)}`;
        case 'eol':
            return `${tier} ${pkg}${ver}: security support ended ${date}${where(f)}`;
        case 'eol-soon':
            return `${tier} ${pkg}${ver}: security support ends ${date}${where(f)}`;
        case 'unknown':
            return `${tier} ${pkg}: unknown — the source did not answer`;
        default:
            return `${tier} ${pkg}${ver}${fix} [${verdict}] ${ids}${where(f)}`;
    }
}

/**
 * The session notice — computed from the cache, never from the network, and
 * never an action. Each T0/T1 line ends in the offer; the routing behind the
 * offer is owned by road-to-security-fixes-carried-to-the-merge.
 */
export function noticeLines(state: AdvisoryState | null, now: Date = new Date()): string[] {
    if (state === null) return [];
    const lines: string[] = [];
    const ageH = (now.getTime() - Date.parse(state.at)) / 3600000;
    const byKey = new Map(state.findings.map((f) => [f.key, f]));
    const pending = state.notice?.interrupt.map((k) => byKey.get(k)).filter((f): f is Finding => f !== undefined) ?? [];
    for (const f of pending) {
        lines.push(`advisory ${describe(f)} — fix now: /audit deps fix ${safeField(f.id)} (here or in its own worktree), or later`);
    }
    if ((state.notice?.digest ?? 0) > 0) lines.push(`advisories: ${safeField(state.notice!.digest)} more in the digest — /audit deps`);
    for (const [source, since] of Object.entries(state.silent_since ?? {})) {
        const days = (now.getTime() - Date.parse(since)) / 86400000;
        if (days >= SILENCE_NOTICE_DAYS) lines.push(`advisories: ${safeField(source)} has not answered for ${Math.floor(days)} days — findings from it are unknown, not clear`);
    }
    for (const l of mergedNotDeployed(state.remediations ?? {}, state.findings, now)) lines.push(l.replace(/[\r\n]/g, ' '));
    if (ageH >= STALE_AFTER_HOURS) {
        lines.push(`advisories: data is ${Math.floor(ageH / 24) || 1} day(s) old — run \`agent-config audit:deps refresh\``);
    }
    return lines;
}

/** Shown once per notice: the stamp records which notice this checkout already printed. */
export function sessionNotice(root: string, now: Date = new Date()): string | null {
    if (readAdvisorySettings(root).mode === 'off') return null;
    const state = readState(root);
    if (state === null) return null;
    const stamp = statePath(root) + '.shown';
    let shown = '';
    try {
        shown = fs.readFileSync(stamp, 'utf-8').trim();
    } catch {
        shown = '';
    }
    const id = `${state.notice?.at ?? ''}|${now.toISOString().slice(0, 10)}`;
    if (shown === id) return null;
    const lines = noticeLines(state, now);
    if (lines.length === 0) return null;
    try {
        fs.writeFileSync(stamp, `${id}\n`);
    } catch {
        /* an unwritable stamp means the line may show twice; never a failure */
    }
    return lines.join('\n');
}

