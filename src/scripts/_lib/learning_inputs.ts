/**
 * Learnings into retros and reviews. Retro triage reads signal kinds and
 * topics; "held or recurred" compares signals on a topic before and after a
 * learning was accepted; review routing receives recurring findings and
 * correction hot spots as checklist inputs that cite the violated contract or
 * test. No input carries a signal's span: a review sees the rule, never the
 * words someone used when they were frustrated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { type ProjectFold, type TopicRow, type TopicSignal, emptyFold, foldSignal } from './feedback_candidates.js';
import type { FeedbackSignal } from './feedback_signals.js';
import { userProjectDir } from './ownership_model.js';
import { type UserRow, exportUserData } from './user_data_control.js';
import type { EnvMap } from './user_global_paths.js';

export interface RetroDigestRow {
    topic: string;
    state: TopicRow['state'];
    seen_count: number;
    for: number;
    against: number;
}

export function retroDigest(fold: ProjectFold): RetroDigestRow[] {
    return Object.values(fold.topics)
        .map((r) => ({ topic: r.topic, state: r.state, seen_count: r.seen_count, for: r.for, against: r.against }))
        .sort((a, b) => b.seen_count - a.seen_count || (a.topic < b.topic ? -1 : 1));
}

export interface HeldReport {
    topic: string;
    accepted_at: string;
    before: number;
    after: number;
    verdict: 'held' | 'recurred' | 'too early';
}

/** Against-signals in distinct sessions before and after the acceptance. */
export function heldOrRecurred(signals: readonly TopicSignal[], topic: string, acceptedAt: string, now: string, minDays = 14): HeldReport {
    const against = signals.filter((s) => s.topic === topic && (s.kind === 'complaint' || s.kind === 'correction'));
    const sessions = (xs: readonly TopicSignal[]): number => new Set(xs.map((s) => s.session)).size;
    const before = sessions(against.filter((s) => s.ts < acceptedAt));
    const after = sessions(against.filter((s) => s.ts >= acceptedAt));
    const days = (Date.parse(now) - Date.parse(acceptedAt)) / 86_400_000;
    const verdict = after > 0 ? 'recurred' : days < minDays ? 'too early' : 'held';
    return { topic, accepted_at: acceptedAt, before, after, verdict };
}

export interface ChecklistInput {
    item: string;
    cites: string;
    evidence: { sessions: number; at: string[] };
}

/** The contract a topic names: `rule:<id>` → its rule file, `skill:<id>` → its skill, `test:<path>` → the test. */
export function citeFor(root: string, topic: string): string | null {
    const [kind, id = ''] = topic.split(':', 2) as [string, string?];
    if (!/^[\w./-]+$/.test(id)) return null;
    const candidates = kind === 'rule' ? [`src/rules/${id}.md`] : kind === 'skill' ? [`src/skills/${id}/SKILL.md`] : kind === 'test' ? [id] : [];
    return candidates.find((c) => fs.existsSync(path.join(root, c))) ?? null;
}

/**
 * Checklist inputs for a review of `area`: recurring topics with a citable
 * contract, and correction hot spots under the area. A topic without a
 * contract or test to cite is left out rather than passed on as opinion.
 */
export function reviewChecklist(root: string, fold: ProjectFold, corrections: readonly FeedbackSignal[], area: string, testsFor: (area: string) => string[] = () => []): ChecklistInput[] {
    const out: ChecklistInput[] = [];
    for (const r of Object.values(fold.topics)) {
        if (r.state !== 'candidate' && r.state !== 'recurred') continue;
        const cites = citeFor(root, r.topic);
        if (cites === null) continue;
        out.push({ item: `recurring finding on ${r.topic} (${r.state})`, cites, evidence: { sessions: r.seen_count, at: r.sessions } });
    }
    const hot = corrections.filter((c) => c.kind === 'correction' && c.area !== null && (c.area === area || c.area.startsWith(`${area}/`) || area.startsWith(`${c.area}/`)));
    if (hot.length >= 2) {
        const tests = testsFor(area);
        if (tests.length) out.push({ item: `correction hot spot: agent lines in ${area} were corrected ${hot.length} times`, cites: tests[0] as string, evidence: { sessions: new Set(hot.map((h) => h.at.split(':')[0])).size, at: hot.map((h) => h.at) } });
    }
    return out;
}

/** Topic signals of one repository, read from the user's own store under their home. */
export function readUserSignals(repoId: string, env?: EnvMap | null): TopicSignal[] {
    let rows: UserRow[];
    try {
        rows = exportUserData(userProjectDir(repoId, env)).signals;
    } catch {
        return [];
    }
    const kinds = new Set(['complaint', 'approval', 'directive', 'correction']);
    return rows.flatMap((r) =>
        typeof r['topic'] === 'string' && typeof r['session'] === 'string' && typeof r['ts'] === 'string' && kinds.has(String(r['kind']))
            ? [{ kind: r['kind'] as TopicSignal['kind'], topic: r['topic'], session: r['session'], task: typeof r['task'] === 'string' ? r['task'] : null, ts: r['ts'], ...(r['severe'] === true ? { severe: true } : {}) }]
            : [],
    );
}

/** Correction signals as checklist evidence: area and `session:line` only, never a span. */
export function correctionSignals(signals: readonly TopicSignal[], areaOf: (topic: string) => string | null): FeedbackSignal[] {
    return signals
        .filter((s) => s.kind === 'correction')
        .map((s) => ({ kind: 'correction' as const, about: s.topic, rules: [], skills: [], area: areaOf(s.topic), at: `${s.session}:0`, span: '' }));
}

export function foldSignals(repoId: string, signals: readonly TopicSignal[]): ProjectFold {
    return [...signals].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)).reduce(foldSignal, emptyFold(repoId));
}

export interface TriageLike {
    class: string;
    score: number;
    signals: string[];
}

/** Points a unit's triage gains from feedback topics a reviewer should see; capped so feedback alone never outweighs facts. */
export const FEEDBACK_POINTS = 2;
export const FEEDBACK_CAP = 4;

/**
 * Retro triage that reads signal kinds and topics: a topic in `candidate`,
 * `recurred` or `review` adds points and names itself. A unit the facts
 * skipped as low-signal becomes `analyse` when feedback lifts it over `analyseAt`.
 */
export function withFeedback<T extends TriageLike>(t: T, digest: readonly RetroDigestRow[], analyseAt: number): T {
    const live = digest.filter((d) => d.state === 'candidate' || d.state === 'recurred' || d.state === 'review');
    if (live.length === 0 || t.class.startsWith('skip:') && t.score === 0 && t.signals.includes('no assistant record')) return t;
    const points = Math.min(FEEDBACK_CAP, live.length * FEEDBACK_POINTS);
    const score = t.score + points;
    return { ...t, score, class: score >= analyseAt ? 'analyse' : t.class, signals: [...t.signals, `feedback: ${live.map((d) => `${d.topic} ${d.state}`).join(', ')} +${points}`] };
}
