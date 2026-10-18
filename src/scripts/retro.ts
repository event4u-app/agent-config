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
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    LESSONS_NAME,
    SIDECAR_NAME,
    buildSidecar,
    renderLessonsMd,
    type Sidecar,
    type Signal,
} from './learning_sidecar.js';
import { _assert_project_writable } from './memory_signal.js';
import type { Fact, PrFacts, SessionFacts } from './retro_facts.js';
import { ACTIVE_STATUSES } from './_lib/self_repair.js';
import { listRecords, setStatus, targetCounts } from './_lib/self_repair_store.js';

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
    /**
     * The canonical claim, short and stable (`drain/baseline-drift`). Two
     * syntheses that agree on the claim must produce the same string; it is
     * what corroborates, the wording of `learning` is not.
     */
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
    /** Earlier records naming the same asset target — the held/recurred reading. */
    recurrence: Recurrence | null;
}

/**
 * Whether an earlier learning on this target HELD.
 *
 * `first` — nothing earlier named it, so there is nothing to have held.
 * `held` — every record naming it reached a terminal status and none is back
 *   in the queue. The fix landed and the defect has not returned.
 * `recurred` — at least one record naming it is active again. Either it was
 *   never closed, or something reopened it (a revert, per
 *   {@link reopenOnRevert}).
 *
 * The verdict is read from record STATUS, never from the occurrence count:
 * occurrences accumulate across a record's whole life, so a high count on a
 * closed record says the defect was frequent before the fix, not that the fix
 * failed. Reading volume as recurrence is the mistake Phase 5 exists to avoid.
 */
export type RecurrenceVerdict = 'first' | 'held' | 'recurred';

export interface Recurrence {
    target: string;
    occurrences: number;
    records: number;
    verdict: RecurrenceVerdict;
    /** Fingerprints that are active again — empty unless the verdict is `recurred`. */
    active: string[];
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
        recurrence = readRecurrence(root, candidate.asset_target);
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

/**
 * The held/recurred reading for one asset target.
 *
 * Exported because `/retro status` and the per-unit output both need it and
 * neither should re-derive the rule — two readings of "did it hold" is the
 * same defect class as two readings of "what is the brand".
 */
export function readRecurrence(root: string, target: string): Recurrence {
    const hit = targetCounts(root).find((t) => t.target === target);
    const active = listRecords(root)
        .filter((r) => (r.target ?? []).includes(target) && ACTIVE_STATUSES.includes(r.status))
        .map((r) => r.fingerprint)
        .sort();
    const records = hit?.records.length ?? 0;
    const verdict: RecurrenceVerdict =
        records === 0 ? 'first' : active.length > 0 ? 'recurred' : 'held';
    return { target, occurrences: hit?.occurrences ?? 0, records, verdict, active };
}

/**
 * A revert of a landed fix reopens its record.
 *
 * A fix that was reverted is not a fix, and leaving its record `actioned`
 * would let the next retro report `held` about a defect that is live again.
 * This is the one place a retro writes a STATUS rather than a proposal: it
 * restores a record the tree's own history contradicts, and it never closes,
 * declines or supersedes one.
 *
 * Returns the fingerprints it reopened, sorted. A no-op when the facts carry no
 * measured revert — `missing` is not `false`, so an unread revert fact reopens
 * nothing rather than guessing in either direction.
 */
export function reopenOnRevert(
    root: string,
    facts: PrFacts | SessionFacts,
    target: string,
    now: string,
): string[] {
    if (facts.unit !== 'pr') return [];
    const revert = facts.later_revert;
    if (revert.status !== 'measured' || revert.value !== true) return [];
    const reopened: string[] = [];
    for (const rec of listRecords(root)) {
        if (!(rec.target ?? []).includes(target)) continue;
        if (rec.status !== 'actioned') continue;
        setStatus(root, rec.fingerprint, 'open', now, {
            resolution: `reopened: the landed fix was reverted (${facts.unit} ${facts.pr})`,
        });
        reopened.push(rec.fingerprint);
    }
    return reopened.sort();
}

/**
 * Entry type the retro writes into the intake stream — one of the types the
 * memory reader accepts, so a retro signal is read like any other.
 */
export const RETRO_ENTRY_TYPE = 'historical-patterns';

/**
 * The intake signal for one output: exactly the learning that passed the
 * durability test, origin = {@link unitOrigin}. Only an `intake-signal`
 * learning yields one; every other target is a proposal or a record.
 *
 * The sidecar corroborates claims by body, so the body is the canonical claim
 * (the subject), not the synthesis's wording: two independent retros that
 * agree on the claim must corroborate even when they phrase it differently.
 */
export function intakeSignals(out: RetroOutput, nowIso: string): Signal[] {
    if (out.target !== 'intake-signal' || out.learning === null || out.subject === null) return [];
    const origin = unitOrigin(out.unit_key);
    const body = `retro claim: ${out.subject}`;
    return [
        {
            id: createHash('sha256').update(`${origin}\0${body}`).digest('hex').slice(0, 16),
            ts: nowIso,
            tsMs: Date.parse(nowIso),
            origin,
            entryType: RETRO_ENTRY_TYPE,
            path: out.subject,
            body,
            polarity: 'preferred' as const,
        },
    ].slice(0, MAX_INTAKE_SIGNALS_PER_UNIT);
}

export const INTAKE_REL = path.join('agents', 'memory', 'intake');
export const SIDECAR_OUT_REL = path.join('agents', 'memory');

/**
 * Append the signals to this month's intake file. Gitignored and decaying, so
 * it is written without a question; the project-provenance gate still applies.
 * Returns how many were written.
 */
export function writeIntakeSignals(root: string, signals: readonly Signal[]): number {
    if (signals.length === 0) return 0;
    const dir = path.join(root, INTAKE_REL);
    fs.mkdirSync(dir, { recursive: true });
    const lines: string[] = [];
    for (const s of signals) {
        const record = {
            id: s.id,
            ts: s.ts,
            origin: s.origin,
            entry_type: s.entryType,
            path: s.path,
            body: s.body,
            subject: 'project',
            source: 'retro',
        };
        _assert_project_writable(record);
        lines.push(JSON.stringify(record));
    }
    const month = signals[0]!.ts.slice(0, 7);
    fs.appendFileSync(path.join(dir, `signals-${month}.jsonl`), `${lines.join('\n')}\n`, 'utf-8');
    return lines.length;
}

/**
 * Rebuild the learning sidecar at the end of a retro run. Called by the retro
 * itself, so it does not depend on `memory.learn_on_session_end` — that key
 * stays class B with a conservative default and this never reads it.
 */
export function aggregateSidecar(root: string, nowIso: string): Sidecar {
    const sidecar = buildSidecar(path.join(root, INTAKE_REL), nowIso);
    const out = path.join(root, SIDECAR_OUT_REL);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, SIDECAR_NAME), `${JSON.stringify(sidecar, null, 2)}\n`);
    fs.writeFileSync(path.join(out, LESSONS_NAME), renderLessonsMd(sidecar));
    return sidecar;
}
