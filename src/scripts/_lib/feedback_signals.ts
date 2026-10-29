/**
 * Four feedback signals, read deterministically — no model judges sentiment:
 *
 *  · complaint  — the existing agent-directed complaint detector
 *  · approval   — a narrow set of explicit approval phrasings
 *  · directive  — a standing "always / never / from now on" statement, passed
 *                 through the standing-command and self-harmful-preference
 *                 guards; a harmful one is refused, never stored
 *  · correction — an edit or a revert of agent output, read from git
 *
 * Interruptions and self-repair records are sources, not a fifth kind. A
 * signal stores its kind, what it is about, the active rule and skill ids,
 * the file area, a `session:line` pointer and a redacted span of at most 80
 * characters — never the message.
 */
import { detectUserReport, sanitizeEvidence } from './self_repair.js';
import { detectSelfHarmfulPreference, detectStandingCommand } from './user_global_observations.js';

export type SignalKind = 'complaint' | 'approval' | 'directive' | 'correction';

export const SPAN_MAX = 80;

export interface FeedbackSignal {
    kind: SignalKind;
    about: string;
    rules: string[];
    skills: string[];
    area: string | null;
    /** `<session>:<line>` — a pointer, never the text */
    at: string;
    span: string;
}

export interface SignalContext {
    session: string;
    line: number;
    rules?: readonly string[];
    skills?: readonly string[];
    area?: string | null;
    /** what the turn was about, e.g. the rule or file the agent acted on */
    about?: string;
}

export type SignalVerdict = { stored: FeedbackSignal } | { refused: string } | null;

const APPROVAL = [/^\s*(?:perfekt|super|genau so|passt|top|lgtm|looks good(?: to me)?|perfect|exactly(?: right)?|great,? thanks?|that'?s (?:it|right))\b[\s.!]*$/i, /\b(?:genau so (?:will|wollte) ich das|that is exactly what i wanted)\b/i];
const DIRECTIVE = /\b(?:from now on|always|never|ab jetzt|ab sofort|immer|nie(?:mals)?)\b[^.!?\n]{3,}/i;

/** The shared evidence sanitiser (addresses, home paths) plus token shapes, then the cap. */
export function redactSpan(text: string): string {
    const clean = sanitizeEvidence(text).replace(/\b(?:sk|ghp|xox[bp])[-_][A-Za-z0-9_-]{8,}\b/g, '[secret]');
    return clean.length > SPAN_MAX ? `${clean.slice(0, SPAN_MAX - 1)}…` : clean;
}

function signal(kind: SignalKind, span: string, ctx: SignalContext): FeedbackSignal {
    return { kind, about: ctx.about ?? 'turn', rules: [...(ctx.rules ?? [])].sort(), skills: [...(ctx.skills ?? [])].sort(), area: ctx.area ?? null, at: `${ctx.session}:${ctx.line}`, span: redactSpan(span) };
}

/** The signal a prompt carries, the refusal of a harmful directive, or null. */
export function promptSignal(prompt: string, ctx: SignalContext): SignalVerdict {
    if (detectSelfHarmfulPreference(prompt)) return { refused: 'self-harmful standing preference: surfaced, never stored' };
    const complaint = detectUserReport(prompt);
    if (complaint) return { stored: signal('complaint', complaint.evidence, ctx) };
    // A standing command is stored only as a pointer and a short span for review; it is never re-injected.
    const directive = DIRECTIVE.exec(prompt);
    if (directive || detectStandingCommand(prompt)) return { stored: signal('directive', directive?.[0] ?? prompt, ctx) };
    for (const re of APPROVAL) {
        const m = re.exec(prompt);
        if (m) return { stored: signal('approval', m[0].trim(), ctx) };
    }
    return null;
}

type Git = (args: readonly string[]) => string;

/**
 * Corrections: a later commit that reverts an agent commit, or rewrites lines
 * it added. `agentCommits` are the shas the agent authored (a trailer or the
 * session index says which); the span is the correcting commit's subject.
 */
export function corrections(git: Git, agentCommits: readonly string[], ctx: Omit<SignalContext, 'line'>): FeedbackSignal[] {
    const agent = new Set(agentCommits.map((s) => s.slice(0, 12)));
    const out: FeedbackSignal[] = [];
    const log = git(['log', '--no-merges', '--format=%H%x1f%s%x1f%b%x1e']);
    let line = 0;
    for (const rec of log.split('\x1e')) {
        const [sha = '', subject = '', body = ''] = rec.trim().split('\x1f');
        if (!sha || agent.has(sha.slice(0, 12))) continue;
        line++;
        const reverted = /This reverts commit ([0-9a-f]{7,40})/.exec(body)?.[1];
        if (reverted && agent.has(reverted.slice(0, 12))) {
            out.push(signal('correction', subject, { ...ctx, line, about: `revert of ${reverted.slice(0, 12)}` }));
            continue;
        }
        let blamed: string;
        try {
            blamed = git(['diff', '-U0', `${sha}^`, sha]);
        } catch {
            continue;
        }
        const touched = [...blamed.matchAll(/^--- a\/(.+)$/gm)].map((m) => m[1] as string);
        for (const file of touched) {
            let porcelain: string;
            try {
                porcelain = git(['blame', '--porcelain', `${sha}^`, '--', file]);
            } catch {
                continue;
            }
            const removedFrom = new Set([...blamed.matchAll(/^@@ -(\d+)(?:,(\d+))? /gm)].flatMap((m) => Array.from({ length: Number(m[2] ?? 1) }, (_, i) => Number(m[1]) + i)));
            const hit = [...porcelain.matchAll(/^([0-9a-f]{40}) \d+ (\d+)/gm)].some((m) => agent.has((m[1] as string).slice(0, 12)) && removedFrom.has(Number(m[2])));
            if (hit) {
                out.push(signal('correction', subject, { ...ctx, line, about: `edit of agent lines in ${file}`, area: file.split('/').slice(0, 2).join('/') }));
                break;
            }
        }
    }
    return out;
}
