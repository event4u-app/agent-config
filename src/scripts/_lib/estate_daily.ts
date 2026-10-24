/**
 * The evening report and the per-session call counts the owner asked for on
 * 2026-10-24. Read by `probe_turnaround --daily` and `--calls`.
 *
 * The headline is closed steps, not merged pull requests: a day can merge forty
 * PRs and shrink nothing. Closed steps are net ticks in the roadmap tree between
 * the last first-parent commit older than the window and `ref`; a ticked step in
 * a file created inside the window is authoring and not counted, the rule
 * `readCommitFacts` already applies.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readEstateAtRef } from './turnaround_throughput.js';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const TICK_ADDED = /^\+\s*- \[x\]/i;
const TICK_REMOVED = /^-\s*- \[x\]/i;
const OQ_HEADING = /^### OQ-\d+/gm;
const OLD_DAYS = 7;
export const OWNER_SHEET_REL = 'agents/owner-questions.md';

export interface DailyReport {
    ref: string;
    /** The first-parent commit the window is measured from; `null` when the history is younger. */
    base: string | null;
    hours: number;
    closed: number;
    /** Of `closed`, steps in roadmaps first added more than seven days ago. */
    closedOld: number;
    openNow: number;
    openBefore: number | null;
    evidenceLines: number;
    srcLines: number;
    testLines: number;
    timeboxed: number;
    ownerQuestionsAdded: number;
}

function git(repoRoot: string, args: string[]): string {
    return execFileSync('git', ['-C', repoRoot, ...args], { maxBuffer: 1 << 30, encoding: 'utf8' });
}

function tryGit(repoRoot: string, args: string[]): string | null {
    try {
        return execFileSync('git', ['-C', repoRoot, ...args], {
            maxBuffer: 1 << 30,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return null;
    }
}

function firstAdded(repoRoot: string, ref: string, rel: string): number | null {
    const out = tryGit(repoRoot, ['log', ref, '--diff-filter=A', '--format=%ct', '--', rel]);
    const last = out?.trim().split('\n').filter((l) => l !== '').pop();
    return last === undefined ? null : Number(last) * 1000;
}

function ownerQuestions(repoRoot: string, rev: string | null): number {
    if (rev === null) return 0;
    const text = tryGit(repoRoot, ['show', `${rev}:${OWNER_SHEET_REL}`]);
    return text === null ? 0 : (text.match(OQ_HEADING) ?? []).length;
}

/** The five evening figures over the last `hours` on `ref`. `timeboxed` is supplied by the caller. */
export function readDaily(repoRoot: string, ref = 'HEAD', now = new Date(), hours = 24, timeboxed = 0): DailyReport {
    const before = new Date(now.getTime() - hours * 3_600_000).toISOString();
    const baseOut = tryGit(repoRoot, ['rev-list', '-1', '--first-parent', `--before=${before}`, ref])?.trim() ?? '';
    const base = baseOut === '' ? null : baseOut;
    const from = base ?? EMPTY_TREE;

    let closed = 0;
    let closedOld = 0;
    const patch = git(repoRoot, ['diff', '-M', '-U0', '--no-color', from, ref, '--', 'agents/roadmaps']);
    for (const chunk of patch.split(/^diff --git /m).slice(1)) {
        if (/^new file mode/m.test(chunk)) continue;
        const src = /^--- a\/(.+)$/m.exec(chunk)?.[1];
        let net = 0;
        for (const l of chunk.split('\n')) {
            if (l.startsWith('+++') || l.startsWith('---')) continue;
            if (TICK_ADDED.test(l)) net += 1;
            else if (TICK_REMOVED.test(l)) net -= 1;
        }
        if (net === 0) continue;
        closed += net;
        const added = src === undefined ? null : firstAdded(repoRoot, from, src);
        if (added !== null && now.getTime() - added > OLD_DAYS * 86_400_000) closedOld += net;
    }

    const lines = { evidence: 0, src: 0, tests: 0 };
    for (const row of git(repoRoot, ['diff', '--numstat', from, ref, '--', 'agents/evidence', 'src', 'tests']).split('\n')) {
        const [add, , file] = row.split('\t');
        const n = Number(add);
        if (file === undefined || !Number.isFinite(n)) continue;
        if (file.startsWith('agents/evidence/')) lines.evidence += n;
        else if (file.startsWith('src/')) lines.src += n;
        else if (file.startsWith('tests/')) lines.tests += n;
    }

    return {
        ref,
        base,
        hours,
        closed,
        closedOld,
        openNow: readEstateAtRef(repoRoot, ref).openSteps,
        openBefore: base === null ? null : readEstateAtRef(repoRoot, base).openSteps,
        evidenceLines: lines.evidence,
        srcLines: lines.src,
        testLines: lines.tests,
        timeboxed,
        ownerQuestionsAdded: Math.max(0, ownerQuestions(repoRoot, ref) - ownerQuestions(repoRoot, base)),
    };
}

export function renderDaily(d: DailyReport): string {
    const trend = d.openBefore === null ? 'no earlier reading' : `${d.openNow - d.openBefore >= 0 ? '+' : ''}${String(d.openNow - d.openBefore)} vs ${String(d.openBefore)}`;
    const code = d.srcLines + d.testLines;
    return [
        `evening report · last ${String(d.hours)} h on ${d.ref}${d.base === null ? ' (history younger than the window)' : ''}`,
        `  closed steps        ${String(d.closed)} (${String(d.closedOld)} from roadmaps older than ${String(OLD_DAYS)} days)`,
        `  open steps          ${String(d.openNow)} (${trend})`,
        `  evidence vs code    ${String(d.evidenceLines)} evidence lines · ${String(d.srcLines)} src + ${String(d.testLines)} tests${code > 0 ? ` · ratio ${(d.evidenceLines / code).toFixed(2)}` : ''}`,
        `  timeboxed steps     ${String(d.timeboxed)}`,
        `  owner questions     +${String(d.ownerQuestionsAdded)}`,
        '',
    ].join('\n');
}

export interface SessionCalls {
    transcript: string;
    bash: number;
    council: number;
    vitest: number;
}

const COUNCIL_RE = /\bcouncil_cli\s+(?:run|ask)\b|\bagent-config\s+council:(?!status\b)[a-z-]+/;
const VITEST_RE = /\bvitest\b/;

/**
 * Bash calls in one transcript that ran the council or vitest, each call counted
 * once however many segments it chains. Subagent (sidechain) calls are counted:
 * they spend the same budget as the session that spawned them.
 */
export function countSessionCalls(transcript: string): SessionCalls {
    const out: SessionCalls = { transcript, bash: 0, council: 0, vitest: 0 };
    let text = '';
    try {
        text = fs.readFileSync(transcript, 'utf8');
    } catch {
        return out;
    }
    for (const line of text.split('\n')) {
        if (!line.includes('"tool_use"')) continue;
        let e: { message?: { content?: unknown } };
        try {
            e = JSON.parse(line) as typeof e;
        } catch {
            continue;
        }
        const content = e.message?.content;
        if (!Array.isArray(content)) continue;
        for (const b of content as Array<Record<string, unknown>>) {
            if (b['type'] !== 'tool_use' || b['name'] !== 'Bash') continue;
            const input = b['input'] as Record<string, unknown> | undefined;
            const cmd = typeof input?.['command'] === 'string' ? input['command'] : '';
            out.bash += 1;
            if (COUNCIL_RE.test(cmd)) out.council += 1;
            if (VITEST_RE.test(cmd)) out.vitest += 1;
        }
    }
    return out;
}

/** The current session's transcript: `CLAUDE_CODE_SESSION_ID` when exported, else the newest file. */
export function currentTranscript(store: string, sessionId = process.env['CLAUDE_CODE_SESSION_ID']): string | null {
    if (sessionId !== undefined && sessionId !== '') {
        const p = path.join(store, `${sessionId}.jsonl`);
        if (fs.existsSync(p)) return p;
    }
    let names: string[] = [];
    try {
        names = fs.readdirSync(store).filter((f) => f.endsWith('.jsonl'));
    } catch {
        return null;
    }
    const newest = names
        .map((f) => ({ f, m: fs.statSync(path.join(store, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m)[0];
    return newest === undefined ? null : path.join(store, newest.f);
}
