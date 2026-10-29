/**
 * From signals to candidates, per project only: an incremental fold keeps one
 * row per topic with its `seen_count` counted in distinct sessions and tasks,
 * never in raw events, and the counter-evidence beside it. Aggregating across
 * projects is outside this fold — that path is the decision-revisit on the
 * user-profile schema's non-goal, not a code path here.
 *
 * States: one session is a `signal`; two distinct sessions a `candidate`; a
 * complaint and an approval on one topic `contested`, resolved by recency and
 * never by count; a single severe event (data published, a risky production
 * write) goes straight to `review`; a complaint after an accepted learning on
 * the topic is `recurred`. A topic about a person is dropped.
 */
import type { SignalKind } from './feedback_signals.js';

export interface TopicSignal {
    kind: SignalKind;
    topic: string;
    session: string;
    task: string | null;
    /** ISO time */
    ts: string;
    severe?: boolean;
}

export type CandidateState = 'signal' | 'candidate' | 'contested' | 'review' | 'recurred';

export interface TopicRow {
    topic: string;
    seen_count: number;
    sessions: string[];
    tasks: string[];
    for: number;
    against: number;
    last_kind: SignalKind;
    last_ts: string;
    state: CandidateState;
    /** for a contested topic: the most recent side */
    current: 'for' | 'against' | null;
}

export interface ProjectFold {
    repo_id: string;
    topics: Record<string, TopicRow>;
    /** topic → when a learning on it was accepted */
    accepted: Record<string, string>;
    dropped: number;
}

const PERSON_TOPIC = /^(?:person|user|author|reviewer|member):|@[\w-]+/i;
const AGAINST: ReadonlySet<SignalKind> = new Set(['complaint', 'correction']);

export function emptyFold(repoId: string): ProjectFold {
    return { repo_id: repoId, topics: {}, accepted: {}, dropped: 0 };
}

function stateOf(r: TopicRow, acceptedAt: string | undefined, severe: boolean, prev: CandidateState | undefined): CandidateState {
    if (prev === 'review' || severe) return 'review';
    if (acceptedAt !== undefined && AGAINST.has(r.last_kind) && r.last_ts > acceptedAt) return 'recurred';
    if (r.for > 0 && r.against > 0) return 'contested';
    return r.sessions.length >= 2 ? 'candidate' : 'signal';
}

/** Fold one signal into a project's rows; returns a new fold, the input is untouched. */
export function foldSignal(fold: ProjectFold, s: TopicSignal): ProjectFold {
    if (PERSON_TOPIC.test(s.topic)) return { ...fold, dropped: fold.dropped + 1 };
    const prev = fold.topics[s.topic];
    const sessions = [...new Set([...(prev?.sessions ?? []), s.session])].sort();
    const tasks = [...new Set([...(prev?.tasks ?? []), ...(s.task ? [s.task] : [])])].sort();
    const against = AGAINST.has(s.kind);
    const later = prev === undefined || s.ts >= prev.last_ts;
    const row: TopicRow = {
        topic: s.topic,
        seen_count: sessions.length,
        sessions,
        tasks,
        for: (prev?.for ?? 0) + (s.kind === 'approval' ? 1 : 0),
        against: (prev?.against ?? 0) + (against ? 1 : 0),
        last_kind: later ? s.kind : (prev as TopicRow).last_kind,
        last_ts: later ? s.ts : (prev as TopicRow).last_ts,
        state: 'signal',
        current: null,
    };
    row.state = stateOf(row, fold.accepted[s.topic], s.severe === true, prev?.state);
    if (row.state === 'contested') row.current = AGAINST.has(row.last_kind) ? 'against' : 'for';
    return { ...fold, topics: { ...fold.topics, [s.topic]: row } };
}

export function acceptLearning(fold: ProjectFold, topic: string, at: string): ProjectFold {
    return { ...fold, accepted: { ...fold.accepted, [topic]: at } };
}

/** Rows a reviewer should see: candidates, contested, review and recurred — never a lone signal. */
export function reviewQueue(fold: ProjectFold): TopicRow[] {
    return Object.values(fold.topics)
        .filter((r) => r.state !== 'signal')
        .sort((a, b) => (a.state === 'review' ? -1 : b.state === 'review' ? 1 : 0) || b.seen_count - a.seen_count || (a.topic < b.topic ? -1 : 1));
}
