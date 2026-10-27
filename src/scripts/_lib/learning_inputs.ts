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

import type { FeedbackSignal } from './feedback_signals.js';
import type { ProjectFold, TopicRow, TopicSignal } from './feedback_candidates.js';

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
