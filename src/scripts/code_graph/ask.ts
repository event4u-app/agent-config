/**
 * One entry point for questions: `ask "<question>"` routes to an intent and
 * answers in three steps — an index of rows with their `~read_tokens`, then a
 * timeline of the same rows, then a fetch by id. Fix-plan and verify-fix are
 * intents, not commands.
 *
 * Every row carries the scope it belongs to: repository, branch, worktree and,
 * for user-owned sources (sessions, signals), the owning user. A row outside
 * the asker's scope is never shown, and a fetch re-checks the scope rather than
 * trusting the index that named the id. Provider text is data: it is
 * sanitised, never placed in `next`, and never treated as an instruction.
 */
import { type AnswerEnvelope, type AnswerFormat, makeEnvelope } from './answer_envelope.js';
import { suggestVerb } from './intent.js';
import { sanitizeLabel } from './sanitize.js';

export type Intent = 'tests-for' | 'usage' | 'affected' | 'explain' | 'path' | 'query' | 'provenance' | 'bugs' | 'fix-plan' | 'verify-fix' | 'sessions' | 'knowledge';

const INTENTS: ReadonlyArray<readonly [Intent, RegExp]> = [
    ['verify-fix', /\b(did|does|is)\b.*\bfix(ed)?\b.*\b(work|hold|stick)|\bverify (the )?fix\b/i],
    ['fix-plan', /\b(how (do|should|can) (i|we) fix|fix plan|plan (a|the) fix)\b/i],
    ['bugs', /\b(bug|bugs|error|crash|regress(ion|ed)?|sentry|exception)\b/i],
    ['tests-for', /\b(which|what) tests?\b|\btests? (for|of|cover)\b/i],
    ['provenance', /\b(since when|who (added|introduced)|which (pr|ticket)|introduced (in|by)|history of)\b/i],
    ['sessions', /\b(last session|which session|worked on|edited by me|my sessions?)\b/i],
    ['knowledge', /\b(adr|decision|decided|memory|convention|rule about|why do we)\b/i],
    ['usage', /\b(who|what) uses\b|\busages? of\b|\bwhere is .* used\b/i],
];

export function routeIntent(question: string): Intent {
    for (const [intent, re] of INTENTS) if (re.test(question)) return intent;
    return suggestVerb(question);
}

export interface Scope {
    repoId: string;
    branch: string;
    worktree: string;
    user: string;
}

export interface AskRow {
    id: string;
    source: string;
    title: string;
    /** what a fetch of this row would cost */
    read_tokens: number;
    at: string | null;
    repo_id: string;
    /** a row answered for one branch, null when branch-independent */
    branch: string | null;
    /** user-owned rows name their owner and the worktree they were captured in */
    user: string | null;
    worktree: string | null;
}

export interface AskSource {
    name: string;
    owner: 'project' | 'user';
    intents: readonly Intent[];
    rows(question: string): AskRow[];
    fetch(id: string): { row: AskRow; body: string } | null;
}

const SAFE_ID = /^[\w:./#@-]{1,200}$/;

export interface Excluded {
    id: string;
    reason: string;
}

/** Why a row is outside the asker's scope, or null when it is in scope. */
export function outOfScope(row: AskRow, source: Pick<AskSource, 'owner'>, scope: Scope): string | null {
    if (row.repo_id !== scope.repoId) return 'another repository';
    if (row.branch !== null && row.branch !== scope.branch) return `answered for branch ${row.branch}, asked on ${scope.branch}`;
    if (source.owner === 'user') {
        if (row.user !== scope.user) return 'owned by another user';
        if (row.worktree !== null && row.worktree !== scope.worktree) return 'captured in another worktree';
    }
    return null;
}

export interface AskResult {
    intent: Intent;
    envelope: AnswerEnvelope;
    /** step 2: the same rows in time order */
    timeline: Array<{ id: string; at: string | null }>;
    excluded: Excluded[];
    /** sources that failed and how the answer degraded */
    degraded: string[];
}

export function ask(question: string, sources: readonly AskSource[], scope: Scope, opts: { format?: AnswerFormat; commit?: string | null } = {}): AskResult {
    const intent = routeIntent(question);
    const rows: AskRow[] = [];
    const excluded: Excluded[] = [];
    const degraded: string[] = [];
    for (const s of sources.filter((x) => x.intents.includes(intent))) {
        let got: AskRow[];
        try {
            got = s.rows(question);
        } catch (e) {
            degraded.push(`${s.name}: ${sanitizeLabel((e as Error).message, 120)} — answered without it`);
            continue;
        }
        for (const r of got) {
            const why = outOfScope(r, s, scope);
            if (why) excluded.push({ id: r.id, reason: why });
            else rows.push({ ...r, title: sanitizeLabel(r.title, 160) });
        }
    }
    rows.sort((a, b) => a.read_tokens - b.read_tokens || (a.id < b.id ? -1 : 1));
    const envelope = makeEnvelope(
        {
            items: rows.map((r) => ({ id: r.id, text: `${r.title} (~${r.read_tokens} tok, ${r.source})` })),
            confidence: degraded.length ? 'low' : rows.length ? 'medium' : 'low',
            witness: { generation: null, commit: opts.commit ?? null, staleness: 'unknown', confirm: null },
            next: rows.length ? (SAFE_ID.test(rows[0]?.id ?? '') ? [`ask --fetch ${rows[0]?.id}`] : []) : [`grep -rn -- '${question.replace(/'/g, "'\\''").slice(0, 60)}' .`],
        },
        opts.format ?? 'concise',
    );
    const timeline = [...rows].sort((a, b) => ((a.at ?? '') < (b.at ?? '') ? -1 : (a.at ?? '') > (b.at ?? '') ? 1 : 0)).map((r) => ({ id: r.id, at: r.at }));
    return { intent, envelope, timeline, excluded, degraded };
}

/** Step 3: fetch one row by id; the scope is re-checked here, never inherited from the index. */
export function fetchById(id: string, sources: readonly AskSource[], scope: Scope): { ok: true; source: string; body: string } | { ok: false; reason: string } {
    for (const s of sources) {
        const hit = s.fetch(id);
        if (!hit) continue;
        const why = outOfScope(hit.row, s, scope);
        if (why) return { ok: false, reason: `refused: ${why}` };
        return { ok: true, source: s.name, body: hit.body };
    }
    return { ok: false, reason: 'no source holds this id' };
}
