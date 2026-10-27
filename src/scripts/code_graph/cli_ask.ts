/**
 * `code-graph ask "<question>" [--format hint|concise|detailed] [--fetch <id>] [--json]`
 *
 * The graph-backed sources of the one entry point: symbols and files the
 * question names, and the tests that cover them. Further sources (sessions,
 * signals, bugs, knowledge facts) join through the same `AskSource` shape.
 */
import * as fs from 'node:fs';

import { type AnswerFormat, FORMAT_BUDGET } from './answer_envelope.js';
import { type AskRow, type AskSource, type Scope, ask, fetchById } from './ask.js';
import { flag, resolveRoot } from './cli_args.js';
import { graphHome } from './graph_home.js';
import { type LoadedGraph, loadGraph, resolveSeeds } from './query.js';
import { repoIdentity } from './repo_identity.js';
import { gitProbe } from '../_lib/spawn_env.js';
import { testsForModule } from './answer_correctness.js';
import { correctionSignals, foldSignals, readUserSignals, reviewChecklist } from '../_lib/learning_inputs.js';

const TOKENS_PER_LINE = 10;

/**
 * Review checklist inputs from the asker's own feedback signals: recurring
 * findings and correction hot spots, each citing a contract or a test. The rows
 * belong to the account whose home holds the store, and `ask` shows them only to it.
 */
export function reviewSources(root: string, g: LoadedGraph, scope: Scope, storeOwner: string = process.env['USER'] ?? ''): AskSource[] {
    const signals = readUserSignals(scope.repoId);
    const fold = foldSignals(scope.repoId, signals);
    const area = (q: string): string => /(?:for|in|of)\s+([\w./-]+)/.exec(q)?.[1] ?? '.';
    const rowsFor = (a: string): Array<{ row: AskRow; body: string }> =>
        reviewChecklist(root, fold, correctionSignals(signals, (t) => (t.includes('/') ? t.split(':').pop() ?? null : null)), a, (x) => testsForModule(g, x, 'fresh').tests).map((c, i) => ({
            row: { id: `review:${a}:${i}`, source: 'feedback', title: `${c.item} — cites ${c.cites}`, read_tokens: 40, at: null, repo_id: scope.repoId, branch: null, user: storeOwner, worktree: null },
            body: `${c.item}\ncites: ${c.cites}\nseen in ${c.evidence.sessions} session(s): ${c.evidence.at.join(', ')}`,
        }));
    return [{ name: 'feedback', owner: 'user', intents: ['review'], rows: (q) => rowsFor(area(q)).map((r) => r.row), lookup: (id) => (id.startsWith('review:') ? (rowsFor(id.split(':')[1] ?? '.').find((r) => r.row.id === id) ?? null) : null) }];
}

export function graphSources(g: LoadedGraph, repoId: string): AskSource[] {
    const rowOf = (id: string): AskRow | null => {
        const n = g.byId.get(id);
        if (!n) return null;
        const loc = n.source_location;
        const lines = loc.length >= 3 ? (loc[2] as number) - (loc[0] as number) + 1 : 40;
        return { id, source: 'graph', title: `${n.kind} ${n.label} at ${n.source_file}${loc.length ? `:${loc[0]}` : ''}`, read_tokens: lines * TOKENS_PER_LINE, at: null, repo_id: repoId, branch: null, user: null, worktree: null };
    };
    const words = (q: string): string[] => (q.match(/[A-Za-z_][\w./#-]{2,}/g) ?? []).filter((w) => /[._/#A-Z]/.test(w.slice(1)));
    const symbols: AskSource = {
        name: 'graph',
        owner: 'project',
        intents: ['query', 'explain', 'affected', 'path', 'usage', 'fix-plan', 'verify-fix', 'bugs'],
        rows: (q) => words(q).flatMap((w) => resolveSeeds(g, w, 5)).map(rowOf).filter((r): r is AskRow => r !== null),
        lookup: (id) => {
            const r = rowOf(id);
            return r ? { row: r, body: r.title } : null;
        },
    };
    const tests: AskSource = {
        name: 'tests',
        owner: 'project',
        intents: ['tests-for', 'verify-fix'],
        rows: (q) => words(q).flatMap((w) => testsForModule(g, w, 'fresh').tests).map(rowOf).filter((r): r is AskRow => r !== null),
        lookup: symbols.lookup,
    };
    return [symbols, tests];
}

export function askMain(argv: string[]): number {
    const root = resolveRoot(argv);
    const cache = flag(argv, '--graph') ?? graphHome(root).cachePath;
    if (!fs.existsSync(cache)) {
        process.stderr.write('code-graph ask: no graph yet — run `code-graph build`\n');
        return 1;
    }
    const fmt = (flag(argv, '--format') ?? 'concise') as AnswerFormat;
    if (!(fmt in FORMAT_BUDGET)) {
        process.stderr.write('code-graph ask: --format is hint, concise or detailed\n');
        return 2;
    }
    const git = (args: string[]): string => {
        try {
            return gitProbe(root, args).trim();
        } catch {
            return '';
        }
    };
    const scope: Scope = { repoId: repoIdentity(root).repoId, branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), worktree: root, user: process.env['USER'] ?? '' };
    const g = loadGraph(cache, 'native');
    try {
        const sources = [...graphSources(g, scope.repoId), ...reviewSources(root, g, scope)];
        const id = flag(argv, '--fetch');
        if (id) {
            const r = fetchById(id, sources, scope);
            process.stdout.write(r.ok ? `${r.body}\n` : `${r.reason}\n`);
            return r.ok ? 0 : 1;
        }
        const question = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && (argv[i - 1] ?? '').startsWith('--') && !['--json'].includes(argv[i - 1] ?? ''))).join(' ').trim();
        if (!question) {
            process.stderr.write('usage: code_graph/cli.ts ask "<question>" [--format hint|concise|detailed] [--fetch <id>] [--json]\n');
            return 2;
        }
        const r = ask(question, sources, { ...scope }, { format: fmt, commit: git(['rev-parse', '--short=12', 'HEAD']) || null });
        if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(r, null, 1)}\n`);
        else {
            process.stdout.write(`intent: ${r.intent} · ${r.envelope.counts.shown}/${r.envelope.counts.total} shown${r.envelope.notice ? ` — ${r.envelope.notice}` : ''}\n`);
            for (const a of r.envelope.answer) process.stdout.write(`  ${a.id}${a.text ? ` — ${a.text}` : ''}\n`);
            for (const d of r.degraded) process.stdout.write(`  degraded: ${d}\n`);
            for (const n of r.envelope.next) process.stdout.write(`next: ${n}\n`);
        }
        return 0;
    } finally {
        g.close();
    }
}
