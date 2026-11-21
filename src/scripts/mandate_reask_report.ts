/**
 * mandate_reask_report — counts two re-ask kinds in the host's Claude Code transcripts, so the
 * baseline the goal-scoped mandate is measured against is generated, never
 * re-typed from a retro:
 *
 *   reask_after_goal              a later owner turn that re-asks for a commit,
 *                                 push, PR or merge after the owner already
 *                                 named an end state ("bis zum merge") that was
 *                                 not revoked in between.
 *   pr_target_asked_after_create  an assistant turn that asks for a PR URL after
 *                                 the same session's `gh pr create` returned one.
 *
 * Main bucket only (subagent files and sidechain records are skipped), deduped
 * by record `uuid` because the host replays turns into more than one file.
 * Synthetic user turns — slash-command expansions, task notifications, system
 * reminders, tool results — are never owner prose and never count.
 *
 * The output carries counts and session ids only. No prompt text, no assistant
 * text: the baseline lands in a tracked evidence file.
 *
 * Not a gate. Exit 1 only when the store is unreadable or holds no session.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_PROJECTS_ROOT, listTranscriptFiles } from './_lib/cc_transcript.js';
import { isGoalSentence, isRevocation, isSyntheticTurn } from './_lib/goal_phrases.js';

/** An owner turn that asks again for an operation a goal sentence already covers. */
const REASK_PATTERNS: readonly RegExp[] = [
    /\berstelle\s+(?:den|einen|die|das)\s+PRs?\b/i,
    /\bmach\s+(?:den|einen|die)\s+PRs?\b/i,
    /\bpush\s+(?:it|that|this)\b/i,
    /\bpushe?\s+(?:es|das|den\s+branch)\b/i,
    /\bmerge\s+(?:it|that|this)\b/i,
    /\bmerge\s+(?:es|das|ihn|den\s+PR)\b/i,
    /\b(?:create|open)\s+the\s+PRs?\b/i,
    /\bcommit\s+(?:it|that|this)\b/i,
];

/** An assistant question for a PR target. */
const PR_ASK_PATTERNS: readonly RegExp[] = [
    /\bPR[- ]?(?:URL|link|number|nummer)\b/i,
    /\bwhich\s+PR\b/i,
    /\bwelche[nrs]?\s+PR\b/i,
];

const PR_URL_RE = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/;
const GH_PR_CREATE_RE = /\bgh\s+pr\s+create\b/;

export interface SessionCounts {
    session: string;
    reask_after_goal: number;
    pr_target_asked_after_create: number;
}

export interface MandateReaskReport {
    root: string;
    since: string | null;
    sessions_requested: number | null;
    transcript_files: number;
    sessions_scanned: number;
    metrics: {
        reask_after_goal: number;
        pr_target_asked_after_create: number;
        sessions_with_goal: number;
        sessions_with_pr_create: number;
    };
    /** Only sessions with at least one non-zero count, ids only. */
    sessions: SessionCounts[];
}

export interface BuildOptions {
    /** One store root, or several (one per host profile). */
    root?: string | string[];
    sessions?: number;
    since?: string;
}

interface RawBlock {
    type?: unknown;
    text?: unknown;
    id?: unknown;
    name?: unknown;
    input?: { command?: unknown };
    tool_use_id?: unknown;
    content?: unknown;
}

interface RawRecord {
    type?: unknown;
    uuid?: unknown;
    sessionId?: unknown;
    timestamp?: unknown;
    isSidechain?: unknown;
    isMeta?: unknown;
    agentId?: unknown;
    message?: { content?: unknown };
}

interface Turn {
    uuid: string;
    session: string;
    ts: string;
    role: 'user' | 'assistant';
    /** Owner prose for a user turn (null when synthetic), visible text for an assistant turn. */
    text: string | null;
    toolUses: Array<{ id: string; command: string }>;
    toolResults: Array<{ id: string; text: string }>;
}

function blockText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return (content as RawBlock[])
        .map((b) => (typeof b?.text === 'string' ? b.text : ''))
        .join('\n');
}

function toTurn(raw: RawRecord): Turn | null {
    if (raw.type !== 'user' && raw.type !== 'assistant') return null;
    if (raw.isSidechain === true) return null;
    if (typeof raw.agentId === 'string' && raw.agentId.length > 0) return null;
    if (typeof raw.uuid !== 'string' || typeof raw.sessionId !== 'string') return null;
    const content = raw.message?.content;
    const blocks = Array.isArray(content) ? (content as RawBlock[]) : [];
    const turn: Turn = {
        uuid: raw.uuid,
        session: raw.sessionId,
        ts: typeof raw.timestamp === 'string' ? raw.timestamp : '',
        role: raw.type,
        text: null,
        toolUses: [],
        toolResults: [],
    };
    for (const b of blocks) {
        if (b?.type === 'tool_use' && typeof b.id === 'string' && typeof b.input?.command === 'string') {
            turn.toolUses.push({ id: b.id, command: b.input.command });
        }
        if (b?.type === 'tool_result' && typeof b.tool_use_id === 'string') {
            turn.toolResults.push({ id: b.tool_use_id, text: blockText(b.content) });
        }
    }
    if (raw.type === 'assistant') {
        turn.text = blockText(content);
    } else if (turn.toolResults.length === 0 && raw.isMeta !== true) {
        const prose = blockText(content);
        turn.text = isSyntheticTurn(prose) ? null : prose;
    }
    return turn;
}

/** Read every main-bucket turn, deduped by uuid, grouped per session in time order. */
function readSessions(roots: readonly string[]): { files: number; sessions: Map<string, Turn[]> } {
    const files = roots
        .flatMap((root) => listTranscriptFiles({ root }))
        .filter((f) => !f.split(path.sep).includes('subagents'));
    const seen = new Set<string>();
    const sessions = new Map<string, Turn[]>();
    for (const file of files) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        for (const line of text.split('\n')) {
            if (line.trim() === '') continue;
            let raw: RawRecord;
            try {
                raw = JSON.parse(line) as RawRecord;
            } catch {
                continue;
            }
            const turn = toTurn(raw);
            if (turn === null || seen.has(turn.uuid)) continue;
            seen.add(turn.uuid);
            const list = sessions.get(turn.session) ?? [];
            list.push(turn);
            sessions.set(turn.session, list);
        }
    }
    for (const list of sessions.values()) list.sort((a, b) => a.ts.localeCompare(b.ts));
    return { files: files.length, sessions };
}

function countSession(turns: readonly Turn[]): { counts: Omit<SessionCounts, 'session'>; goal: boolean; created: boolean } {
    let goalArmed = false;
    let everGoal = false;
    let prCreated = false;
    const createIds = new Set<string>();
    let reask = 0;
    let prAsk = 0;
    for (const t of turns) {
        if (t.role === 'user') {
            for (const r of t.toolResults) {
                if (createIds.has(r.id) && PR_URL_RE.test(r.text)) prCreated = true;
            }
            if (t.text === null) continue;
            if (isRevocation(t.text)) {
                goalArmed = false;
                continue;
            }
            if (goalArmed && REASK_PATTERNS.some((re) => re.test(t.text as string))) reask += 1;
            if (isGoalSentence(t.text)) {
                goalArmed = true;
                everGoal = true;
            }
        } else {
            for (const u of t.toolUses) if (GH_PR_CREATE_RE.test(u.command)) createIds.add(u.id);
            const text = t.text ?? '';
            if (prCreated && text.includes('?') && PR_ASK_PATTERNS.some((re) => re.test(text))) prAsk += 1;
        }
    }
    return {
        counts: { reask_after_goal: reask, pr_target_asked_after_create: prAsk },
        goal: everGoal,
        created: prCreated,
    };
}

export function buildReport(opts: BuildOptions = {}): MandateReaskReport {
    const roots = opts.root === undefined ? [DEFAULT_PROJECTS_ROOT] : ([] as string[]).concat(opts.root);
    const since = opts.since ?? null;
    const { files, sessions } = readSessions(roots);

    let ordered = [...sessions.entries()].map(([id, turns]) => ({
        id,
        turns: since === null ? turns : turns.filter((t) => t.ts >= since),
        last: turns.at(-1)?.ts ?? '',
    }));
    ordered = ordered.filter((s) => s.turns.length > 0).sort((a, b) => b.last.localeCompare(a.last));
    if (opts.sessions !== undefined) ordered = ordered.slice(0, opts.sessions);

    const report: MandateReaskReport = {
        root: roots.join(', '),
        since,
        sessions_requested: opts.sessions ?? null,
        transcript_files: files,
        sessions_scanned: ordered.length,
        metrics: { reask_after_goal: 0, pr_target_asked_after_create: 0, sessions_with_goal: 0, sessions_with_pr_create: 0 },
        sessions: [],
    };
    for (const s of ordered) {
        const { counts, goal, created } = countSession(s.turns);
        report.metrics.reask_after_goal += counts.reask_after_goal;
        report.metrics.pr_target_asked_after_create += counts.pr_target_asked_after_create;
        if (goal) report.metrics.sessions_with_goal += 1;
        if (created) report.metrics.sessions_with_pr_create += 1;
        if (counts.reask_after_goal > 0 || counts.pr_target_asked_after_create > 0) {
            report.sessions.push({ session: s.id, ...counts });
        }
    }
    report.sessions.sort((a, b) => a.session.localeCompare(b.session));
    return report;
}

export function renderText(r: MandateReaskReport): string {
    const lines = [
        `mandate_reask_report · ${r.sessions_scanned} session(s) from ${r.transcript_files} transcript file(s)` +
            (r.since !== null ? ` · since ${r.since}` : ''),
        `  reask_after_goal              ${r.metrics.reask_after_goal}  (sessions with a goal sentence: ${r.metrics.sessions_with_goal})`,
        `  pr_target_asked_after_create  ${r.metrics.pr_target_asked_after_create}  (sessions with gh pr create: ${r.metrics.sessions_with_pr_create})`,
    ];
    for (const s of r.sessions) {
        lines.push(`  ${s.session}  reask=${s.reask_after_goal}  pr_target_ask=${s.pr_target_asked_after_create}`);
    }
    return lines.join('\n');
}

const USAGE = `usage: mandate_reask_report [--sessions N] [--since <iso>] [--json] [--write-baseline <path>] [--root <dir>]

Counts goal-scoped re-asks in the host Claude Code transcript store.
  --sessions N             only the N most recent sessions.
  --since <iso>            only turns at or after this timestamp.
  --json                   machine-readable output.
  --write-baseline <path>  write the JSON report plus the command line to <path>.
  --root <dir>             transcript store root, repeatable (default: the host store).
Exit 1 when the store is unreadable or holds no session.
`;

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(USAGE);
        return 0;
    }
    const opts: BuildOptions = {};
    let asJson = false;
    let baseline: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const val = argv[i + 1];
        if (arg === '--json') {
            asJson = true;
            continue;
        }
        if (arg === '--sessions' || arg === '--since' || arg === '--write-baseline' || arg === '--root') {
            if (val === undefined) {
                process.stderr.write(`mandate_reask_report: ${arg} needs a value\n`);
                return 2;
            }
            i += 1;
            if (arg === '--sessions') {
                const n = Number(val);
                if (!Number.isInteger(n) || n <= 0) {
                    process.stderr.write('mandate_reask_report: --sessions needs a positive integer\n');
                    return 2;
                }
                opts.sessions = n;
            } else if (arg === '--since') {
                if (Number.isNaN(new Date(val).getTime())) {
                    process.stderr.write('mandate_reask_report: --since needs an ISO timestamp\n');
                    return 2;
                }
                opts.since = val;
            } else if (arg === '--write-baseline') {
                baseline = val;
            } else {
                opts.root = ([] as string[]).concat(opts.root ?? [], val);
            }
            continue;
        }
        process.stderr.write(`mandate_reask_report: unknown argument '${String(arg)}'\n${USAGE}`);
        return 2;
    }

    const report = buildReport(opts);
    if (report.transcript_files === 0 || report.sessions_scanned === 0) {
        process.stderr.write(`mandate_reask_report: no readable session under ${report.root}\n`);
        return 1;
    }
    if (baseline !== null) {
        const record = {
            command: `./scripts-run src/scripts/mandate_reask_report ${argv.join(' ')}`,
            generated_at: new Date().toISOString(),
            ...report,
            // Store paths carry the home directory; the tracked record names only how many.
            root: opts.root === undefined ? '<host transcript store>' : `<${([] as string[]).concat(opts.root).length} transcript store(s)>`,
        };
        fs.mkdirSync(path.dirname(baseline), { recursive: true });
        fs.writeFileSync(baseline, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
    }
    process.stdout.write(asJson ? `${JSON.stringify(report, null, 2)}\n` : `${renderText(report)}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
