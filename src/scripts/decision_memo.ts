/**
 * decision_memo — the decision-memo channel (UOTL Phase 4.3, sequenced by
 * road-to-long-horizon-execution Phase 2.2).
 *
 * ## What this is for
 *
 * A question the agent resolves without contacting the user is only
 * legitimate if the resolution is REVIEWABLE afterwards. Before this, a
 * medium-impact resolution left no trace at all: the run either halted (a
 * contact) or decided silently (no record). Neither is what the ladder wants
 * between those two — the memo is.
 *
 * One file per resolution under
 * `agents/runtime/state/decisions/<run>/NNN.md`, monotonic index per run.
 * Local-only: the whole `agents/runtime/` tree is gitignored, so a memo never
 * reaches a commit unless a human copies it out.
 *
 * ## Why a writer script rather than "the agent writes a markdown file"
 *
 * Two properties a prose instruction cannot give:
 *
 * - **The shape cannot drift.** Every memo carries the same five fields the
 *   roadmap names — question, chosen option, reasoning, resolver, confidence —
 *   because the writer refuses a memo missing any of them. A directory of
 *   free-form notes is not a channel, it is a folder.
 * - **The index is monotonic and gap-free per run**, so "003 exists but 002
 *   does not" is impossible and a reader can tell a pruned memo from an
 *   unwritten one.
 *
 * ## What it deliberately does NOT do
 *
 * It does not decide anything, and it does not gate. A memo is a record of a
 * resolution that already happened; making the writer refuse a resolution
 * would put a decision gate in an observability surface, which is the shape
 * `roadmap-progress` and the interruption ledger both stay clear of.
 *
 * It also carries no locked-class check, and that is not an omission to fix
 * here: `high_impact` and `user_required` are refused at the SCHEMA
 * (`config.ts::_build_decision_resolution`), before any model sees a route.
 * A second check in the writer would read as the enforcement point and put
 * the real one out of mind — the schema is the gate, this is the ledger.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DECISIONS_DIR_REL = path.join('agents', 'runtime', 'state', 'decisions');

/** The five fields the roadmap names, and nothing optional among them. */
export interface DecisionMemo {
    /** The question as it was actually open — not a summary of the answer. */
    question: string;
    /** The option taken, stated so a reader can see what was NOT taken. */
    chosen: string;
    /** Why. The load-bearing field: without it the memo is a log line. */
    reasoning: string;
    /** Which rung resolved it — `agent`, `second-model:<provider>`, `council`. */
    resolver: string;
    /** Self-assessed, `high` | `medium` | `low`. Never a number. */
    confidence: 'high' | 'medium' | 'low';
}

const CONFIDENCE: ReadonlySet<string> = new Set(['high', 'medium', 'low']);

/**
 * A run id has to be a filename component. `safe` here is deliberately
 * narrow rather than a sanitiser: a run id that needs escaping is a caller
 * bug, and silently rewriting it would put two runs in one directory.
 */
export function isSafeRunId(runId: string): boolean {
    return /^[A-Za-z0-9_-]{1,64}$/.test(runId);
}

export function runDir(repoRoot: string, runId: string): string {
    return path.join(repoRoot, DECISIONS_DIR_REL, runId);
}

/**
 * The next index for this run — one past the highest `NNN.md` present.
 *
 * Reads the directory rather than a counter file: a counter that drifts from
 * the directory is a second source of truth, and the directory is the one a
 * human reads.
 */
export function nextIndex(dir: string): number {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return 1;
    }
    let max = 0;
    for (const name of entries) {
        const m = /^(\d{3})\.md$/.exec(name);
        if (m === null) continue;
        const n = Number.parseInt(m[1] as string, 10);
        if (Number.isFinite(n) && n > max) max = n;
    }
    return max + 1;
}

/** Refusal reasons, as a list so a caller can report all of them at once. */
export function validate(memo: Partial<DecisionMemo>): string[] {
    const problems: string[] = [];
    for (const field of ['question', 'chosen', 'reasoning', 'resolver'] as const) {
        const v = memo[field];
        if (typeof v !== 'string' || v.trim() === '') {
            problems.push(`${field} is required and must be non-empty`);
        }
    }
    const c = memo.confidence;
    if (typeof c !== 'string' || !CONFIDENCE.has(c)) {
        problems.push(`confidence must be one of high | medium | low (got ${String(c)})`);
    }
    return problems;
}

export function render(memo: DecisionMemo, index: number, stampedAt: string): string {
    return [
        `# Decision ${String(index).padStart(3, '0')}`,
        '',
        `- **Resolver:** ${memo.resolver}`,
        `- **Confidence:** ${memo.confidence}`,
        `- **Recorded:** ${stampedAt}`,
        '',
        '## Question',
        '',
        memo.question.trim(),
        '',
        '## Chosen',
        '',
        memo.chosen.trim(),
        '',
        '## Reasoning',
        '',
        memo.reasoning.trim(),
        '',
    ].join('\n');
}

export interface WriteResult {
    path: string;
    index: number;
}

/**
 * Write one memo. Throws on a validation failure — a memo that cannot be
 * written is a caller bug and must not degrade into a partial record.
 */
export function writeMemo(
    repoRoot: string,
    runId: string,
    memo: DecisionMemo,
    opts: { now?: () => Date } = {},
): WriteResult {
    if (!isSafeRunId(runId)) {
        throw new Error(
            `decision_memo: run id ${JSON.stringify(runId)} is not a safe filename ` +
                `component (letters, digits, _ and - only, 1..64 chars)`,
        );
    }
    const problems = validate(memo);
    if (problems.length > 0) {
        throw new Error(`decision_memo: refusing an incomplete memo — ${problems.join('; ')}`);
    }
    const dir = runDir(repoRoot, runId);
    fs.mkdirSync(dir, { recursive: true });
    const index = nextIndex(dir);
    const file = path.join(dir, `${String(index).padStart(3, '0')}.md`);
    const stamp = (opts.now ?? ((): Date => new Date()))().toISOString();
    fs.writeFileSync(file, render(memo, index, stamp), 'utf-8');
    return { path: file, index };
}

/** Every memo of one run, in index order. */
export function listMemos(repoRoot: string, runId: string): string[] {
    const dir = runDir(repoRoot, runId);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return entries
        .filter((n) => /^\d{3}\.md$/.test(n))
        .sort()
        .map((n) => path.join(dir, n));
}

const USAGE = `usage: decision_memo write --run <id> --question <q> --chosen <c> \\
                        --reasoning <r> --resolver <who> --confidence <high|medium|low>
       decision_memo list --run <id>

Records one autonomously-resolved question so it is reviewable after the run.
Writes agents/runtime/state/decisions/<run>/NNN.md — local-only (gitignored).

Locked classes (high_impact, user_required) are refused at the CONFIG SCHEMA,
never here: this is the ledger, not the gate.
`;

function argValue(argv: string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    if (i === -1 || i + 1 >= argv.length) return null;
    return argv[i + 1] ?? null;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const sub = argv[0] ?? '';
    if (sub === '' || sub === '--help' || sub === '-h') {
        process.stdout.write(USAGE);
        return sub === '' ? 2 : 0;
    }
    const repoRoot = argValue(argv, '--root') ?? process.cwd();
    const runId = argValue(argv, '--run');
    if (runId === null) {
        process.stderr.write('decision_memo: --run <id> is required\n');
        return 2;
    }

    if (sub === 'list') {
        const memos = listMemos(repoRoot, runId);
        if (memos.length === 0) {
            process.stdout.write(`decision_memo: no memos for run ${runId}\n`);
            return 0;
        }
        for (const m of memos) {
            process.stdout.write(`${path.relative(repoRoot, m)}\n`);
        }
        return 0;
    }

    if (sub !== 'write') {
        process.stderr.write(`decision_memo: unknown subcommand '${sub}'\n${USAGE}`);
        return 2;
    }

    const memo: Partial<DecisionMemo> = {
        question: argValue(argv, '--question') ?? '',
        chosen: argValue(argv, '--chosen') ?? '',
        reasoning: argValue(argv, '--reasoning') ?? '',
        resolver: argValue(argv, '--resolver') ?? '',
        confidence: (argValue(argv, '--confidence') ?? '') as DecisionMemo['confidence'],
    };
    const problems = validate(memo);
    if (problems.length > 0) {
        process.stderr.write(`decision_memo: ${problems.join('; ')}\n`);
        return 2;
    }
    try {
        const res = writeMemo(repoRoot, runId, memo as DecisionMemo);
        process.stdout.write(`${path.relative(repoRoot, res.path)}\n`);
        return 0;
    } catch (exc) {
        process.stderr.write(`${exc instanceof Error ? exc.message : String(exc)}\n`);
        return 2;
    }
}

/**
 * The realpath-comparing form, not a `basename` test: an installed projection
 * and macOS `/var` → `/private/var` both make `argv[1]` a symlink whose URL
 * differs from `import.meta.url`, and a naive comparison silently no-ops the
 * CLI. Same shape as `interruption_report.ts::_isCliEntry`.
 */
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
