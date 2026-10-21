/**
 * Retro triage and unit keys (`docs/contracts/retro-v1.md`) — deterministic,
 * never a model.
 *
 * Kept apart from `retro.ts` so the session-start probe reaches the triage
 * without the composition, proposal and CLI code it never runs. `retro.ts`
 * re-exports everything here.
 *
 * Triage start values are a pre-registered hypothesis. They change only by a
 * documented contract revision, never by editing a constant here.
 */

import type { PrFacts } from './retro_facts.js';
import type { Fact, SessionFacts } from './retro_session_facts.js';

/** The triage policy version; part of every unit key. */
export const TRIAGE_POLICY = 1;

export const TARGETS = [
    'intake-signal',
    'override-proposal',
    'contract-no-go-proposal',
    'package-record',
    'none',
] as const;
export type Target = (typeof TARGETS)[number];

export type TriageClass = 'analyse' | 'skip:low-signal' | 'covered' | 'expired' | 'deferred';

export interface Triage {
    class: TriageClass;
    score: number;
    signals: string[];
}

/** Score at or above which a unit is worth a model retro. */
export const ANALYSE_AT = 3;

/** Caps from the contract. */
export const MAX_INTAKE_SIGNALS_PER_UNIT = 3;

export interface UnitKeyInput {
    repo: string;
    pr?: number;
    merge_sha?: string;
    session?: string;
    policy?: number;
}

/**
 * `{repo, pr|session, merge_sha|tag, policy}` as one string — the queue and
 * disposition key. Corroboration uses {@link unitOrigin}, never this string.
 */
export function unitKey(k: UnitKeyInput): string {
    const policy = k.policy ?? TRIAGE_POLICY;
    if (k.pr !== undefined) return `retro:${k.repo}#pr${k.pr}@${k.merge_sha ?? 'unmerged'}/p${policy}`;
    if (k.session !== undefined) return `retro:${k.repo}#session@${k.session}/p${policy}`;
    throw new Error('unitKey: a unit is a PR or a session');
}

/**
 * The intake origin of a unit: `{repo, pr|session}` only. A failed merge-sha
 * lookup or a policy bump re-keys a disposition, but must never let one PR
 * corroborate itself. The slash is replaced so the provenance gate does not
 * read the origin as a filesystem path.
 */
export function unitOrigin(key: string): string {
    const m = /^retro:([^#]+)#(pr\d+|session)(?:@([^/]+))?\/p\d+$/.exec(key);
    if (m === null) throw new Error(`unitOrigin: not a unit key: ${key}`);
    const unit = m[2] === 'session' ? `session:${m[3] ?? ''}` : m[2];
    return `retro:${m[1]!.replace(/\//g, ':')}#${unit}`;
}

const val = (f: Fact<number>): number | null => (f.status === 'measured' ? f.value : null);

/** Drain-summary conflict cells that say there was none, in the shapes real summaries use. */
const NO_CONFLICT_RE = /^(none|—|–|-+|0(\s|$)|clean|no (content )?conflicts?)/i;

export function triagePr(f: PrFacts): Triage {
    let score = 0;
    const signals: string[] = [];
    const add = (points: number, why: string): void => {
        score += points;
        signals.push(`${why} +${points}`);
    };
    const red = val(f.red_heads);
    if (red !== null && red > 0) add(2 * Math.min(red, 3), `${red} red head(s)`);
    const heads = val(f.ci_heads);
    if (heads !== null && heads >= 3) add(1, `${heads} CI heads`);
    const reverts = val(f.in_pr_reverts);
    if (reverts !== null && reverts > 0) add(3, 'a revert inside the PR');
    if (f.later_revert.status === 'measured' && f.later_revert.value) add(5, 'merge commit reverted later');
    const threads = val(f.review_threads);
    if (threads !== null && threads > 0) add(Math.min(threads, 3), `${threads} review thread(s)`);
    if (f.drain_row.status === 'measured') {
        const row = Object.entries(f.drain_row.value);
        const conflicts = row.find(([h]) => /conflict/i.test(h))?.[1] ?? '';
        if (conflicts !== '' && !NO_CONFLICT_RE.test(conflicts)) add(1, 'a drain conflict class');
        if (row.some(([h, v]) => /disposition/i.test(h) && /twice-exhausted/.test(v))) add(3, 'twice-exhausted');
    }
    return { class: score >= ANALYSE_AT ? 'analyse' : 'skip:low-signal', score, signals };
}

export function triageSession(f: SessionFacts): Triage {
    let score = 0;
    const signals: string[] = [];
    if (f.assistant_records.status === 'measured' && f.assistant_records.value === 0) {
        return { class: 'skip:low-signal', score: 0, signals: ['no assistant record'] };
    }
    const add = (points: number, why: string): void => {
        score += points;
        signals.push(`${why} +${points}`);
    };
    const repairs = val(f.self_repair_in_window);
    if (repairs !== null && repairs > 0) add(4, 'a self-repair record in the window');
    const compactions = val(f.compactions);
    if (compactions !== null && compactions > 0) add(Math.min(compactions, 2), `${compactions} compaction(s)`);
    if (f.interruptions.status === 'measured') {
        const { ask, handback } = f.interruptions.value;
        if (ask + handback >= 2) add(1, `${ask + handback} interruption(s)`);
    }
    const turns = val(f.turns);
    if (turns !== null && turns >= 20) add(1, `${turns} turns`);
    return { class: score >= ANALYSE_AT ? 'analyse' : 'skip:low-signal', score, signals };
}

