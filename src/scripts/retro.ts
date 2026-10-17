/**
 * Retro composition — facts → triage → at most one durable learning per unit
 * (`docs/contracts/retro-v1.md`).
 *
 * The synthesis itself is the agent's; this module is the part that must not
 * depend on it. It triages from facts with the pre-registered start values,
 * applies the durability test to whatever candidate the synthesis produced,
 * routes the survivor to exactly one target from the closed vocabulary, and
 * turns it into intake signals whose origin is the unit key — so two PRs with
 * one learning corroborate each other and two hosts examining one PR do not.
 *
 * Triage start values are a pre-registered hypothesis. They change only by a
 * documented contract revision, never by editing a constant here.
 */

import { createHash } from 'node:crypto';

import type { Signal } from './learning_sidecar.js';
import type { Fact, PrFacts, SessionFacts } from './retro_facts.js';
import { targetCounts } from './_lib/self_repair_store.js';

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
 * `{repo, pr|session, merge_sha|tag, policy}` as one string. It is the origin
 * of every intake signal, so its shape is what decides corroboration: anything
 * not in it (host, model, run) must not separate two examinations of one unit.
 */
export function unitKey(k: UnitKeyInput): string {
    const policy = k.policy ?? TRIAGE_POLICY;
    if (k.pr !== undefined) return `retro:${k.repo}#pr${k.pr}@${k.merge_sha ?? 'unmerged'}/p${policy}`;
    if (k.session !== undefined) return `retro:${k.repo}#session@${k.session}/p${policy}`;
    throw new Error('unitKey: a unit is a PR or a session');
}

const val = (f: Fact<number>): number | null => (f.status === 'measured' ? f.value : null);

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
        if (conflicts !== '' && !/^(none|—|-)\b/i.test(conflicts)) add(1, 'a drain conflict class');
        if (row.some(([h, v]) => /disposition/i.test(h) && /twice-exhausted/.test(v))) add(3, 'twice-exhausted');
    }
    return { class: score >= ANALYSE_AT ? 'analyse' : 'skip:low-signal', score, signals };
}

export function triageSession(f: SessionFacts): Triage {
    let score = 0;
    const signals: string[] = [];
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

/** What the synthesis step proposes for one unit. */
export interface Candidate {
    learning: string;
    target: Target;
    /** Where the learning can already be read; non-null fails the durability test. */
    derivable_from: 'diff' | 'code' | 'tests' | 'docs' | null;
    /** Would the mistake recur without a note? `false` fails the durability test. */
    would_recur: boolean;
    counter_hypothesis: string;
    falsifier: string;
    /** Stable subject the learning is about; the sidecar groups claims by it. */
    subject: string;
    /** A self-repair target (`rule:<id>` …) whose earlier record count this reports. */
    asset_target?: string;
}

export interface RetroOutput {
    unit_key: string;
    facts: PrFacts | SessionFacts;
    triage: Triage;
    learning: string | null;
    target: Target;
    reason: string;
    subject: string | null;
    counter_hypothesis: string | null;
    falsifier: string | null;
    /** Earlier records naming the same asset target — the held/recurred input. */
    recurrence: { target: string; occurrences: number; records: number } | null;
}

export interface ComposeInput {
    key: string;
    facts: PrFacts | SessionFacts;
    candidate: Candidate | null;
    /** Workspace whose self-repair store holds the recurrence counts. */
    root: string;
}

function none(base: Omit<RetroOutput, 'learning' | 'target' | 'reason' | 'subject' | 'counter_hypothesis' | 'falsifier' | 'recurrence'>, reason: string): RetroOutput {
    return {
        ...base,
        learning: null,
        target: 'none',
        reason,
        subject: null,
        counter_hypothesis: null,
        falsifier: null,
        recurrence: null,
    };
}

export function composeRetro(input: ComposeInput): RetroOutput {
    const { key, facts, candidate, root } = input;
    const triage = facts.unit === 'pr' ? triagePr(facts) : triageSession(facts);
    const base = { unit_key: key, facts, triage };
    if (triage.class !== 'analyse') return none(base, `triage ${triage.class} (score ${triage.score})`);
    if (candidate === null) return none(base, 'the synthesis found no learning');
    if (!(TARGETS as readonly string[]).includes(candidate.target)) {
        throw new Error(`composeRetro: target "${candidate.target}" is outside the closed vocabulary`);
    }
    if (candidate.target === 'none') return none(base, 'the synthesis routed the learning to none');
    if (candidate.derivable_from !== null) {
        return none(base, `durability: derivable from the ${candidate.derivable_from}`);
    }
    if (!candidate.would_recur) return none(base, 'durability: would not recur without a note');

    let recurrence: RetroOutput['recurrence'] = null;
    if (candidate.asset_target !== undefined) {
        const hit = targetCounts(root).find((t) => t.target === candidate.asset_target);
        recurrence = {
            target: candidate.asset_target,
            occurrences: hit?.occurrences ?? 0,
            records: hit?.records.length ?? 0,
        };
    }
    return {
        ...base,
        learning: candidate.learning,
        target: candidate.target,
        reason: 'durable: not derivable from code, tests or docs, and would recur',
        subject: candidate.subject,
        counter_hypothesis: candidate.counter_hypothesis,
        falsifier: candidate.falsifier,
        recurrence,
    };
}

/** Entry type the retro writes into the intake stream. */
export const RETRO_ENTRY_TYPE = 'retro-learning';

/**
 * Intake signals for one output, origin = unit key, at most
 * {@link MAX_INTAKE_SIGNALS_PER_UNIT}. Only an `intake-signal` learning yields
 * any; every other target is a proposal or a record, never a signal.
 */
export function intakeSignals(out: RetroOutput, nowIso: string, bodies?: readonly string[]): Signal[] {
    if (out.target !== 'intake-signal' || out.learning === null || out.subject === null) return [];
    const tsMs = Date.parse(nowIso);
    const subject = out.subject;
    return (bodies ?? [out.learning]).slice(0, MAX_INTAKE_SIGNALS_PER_UNIT).map((body) => ({
        id: createHash('sha256').update(`${out.unit_key}\0${body}`).digest('hex').slice(0, 16),
        ts: nowIso,
        tsMs,
        origin: out.unit_key,
        entryType: RETRO_ENTRY_TYPE,
        path: subject,
        body,
        polarity: 'preferred' as const,
    }));
}
