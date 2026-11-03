import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildReport, statusClaimOf } from '../../src/scripts/subagent_return_report.js';

const REPO_ROOT = resolve(__dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'subagent_return_report.ts');

const SESSION = '0d9a7c1e-session-secret-id';
const SECRET_FILE = '/Users/someone/private-project/src/secret_module.ts';
const PROSE = 'The quarterly migration plan for the payments ledger';

type Block = Record<string, unknown>;

function assistant(blocks: Block[], effort?: string): string {
    return JSON.stringify({
        type: 'assistant',
        agentId: 'a1',
        isSidechain: true,
        sessionId: SESSION,
        ...(effort === undefined ? {} : { effort }),
        message: { role: 'assistant', model: 'claude-test-model', content: blocks },
    });
}

function toolResult(id: string, isError: boolean): string {
    return JSON.stringify({
        type: 'user',
        isSidechain: true,
        sessionId: SESSION,
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: 'ok' }] },
    });
}

function write(id: string, name: string, file: string): Block {
    return { type: 'tool_use', id, name, input: { file_path: file, content: PROSE } };
}

const text = (t: string): Block => ({ type: 'text', text: t });

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tree(legs: { id: string; lines: string[]; meta?: Record<string, unknown> }[]): string {
    const root = mkdtempSync(join(tmpdir(), 'sar-'));
    dirs.push(root);
    const dir = join(root, '-Users-someone-private-project', SESSION, 'subagents');
    mkdirSync(dir, { recursive: true });
    // A main-session transcript is not a leg and must not be counted.
    writeFileSync(join(root, '-Users-someone-private-project', `${SESSION}.jsonl`), assistant([text('DONE')]) + '\n');
    for (const leg of legs) {
        writeFileSync(join(dir, `agent-${leg.id}.jsonl`), leg.lines.join('\n') + '\n');
        if (leg.meta !== undefined) writeFileSync(join(dir, `agent-${leg.id}.meta.json`), JSON.stringify(leg.meta));
    }
    return root;
}

function threeLegs(): string {
    return tree([
        {
            id: 'aaa111',
            meta: { agentType: 'ac-worker', model: 'claude-test-model', spawnDepth: 1, description: PROSE },
            lines: [
                assistant([write('t1', 'Edit', SECRET_FILE)], 'high'),
                toolResult('t1', false),
                assistant([write('t2', 'MultiEdit', SECRET_FILE)], 'high'),
                toolResult('t2', false),
                assistant([text(`${PROSE}\n\nDONE`)], 'high'),
            ],
        },
        {
            id: 'bbb222',
            meta: { agentType: 'ac-worker', model: 'claude-test-model', spawnDepth: 2, description: PROSE },
            lines: [
                assistant([write('t3', 'Write', '/tmp/other-secret.md')], 'medium'),
                toolResult('t3', true),
                assistant([text('BLOCKED: the file is read-only')], 'medium'),
            ],
        },
        {
            id: 'ccc333',
            lines: [assistant([text('Looked around.\nNEEDS_CONTEXT')])],
        },
    ]);
}

function run(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(TSX_BIN, [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('subagent_return_report — write accounting (3.1)', () => {
    it('counts attempts, successful writes and distinct targets across legs', () => {
        const r = buildReport({ root: threeLegs() });
        expect(r.totals).toMatchObject({ legs: 3, writes_attempted: 3, writes_ok: 2, targets: 1, meta_missing: 1 });
    });

    it('groups by the sidecar agent type and joins model and spawn depth', () => {
        const r = buildReport({ root: threeLegs() });
        const worker = r.groups.find((g) => g.agent_type === 'ac-worker');
        expect(worker).toMatchObject({ legs: 2, writes_attempted: 3, writes_ok: 2, targets: 1 });
        expect(worker?.models).toEqual({ 'claude-test-model': 2 });
        expect(worker?.spawn_depth).toEqual({ '1': 1, '2': 1 });
        expect(r.groups.find((g) => g.agent_type === 'meta_missing')?.legs).toBe(1);
    });

    it('prints the counts on stdout and nothing that names a path, a host id or prose', () => {
        const root = threeLegs();
        const out = run(['--root', root]);
        expect(out.status, out.stderr).toBe(0);
        for (const needle of ['writes_attempted 3', 'writes_ok 2', 'targets 1', 'meta_missing 1']) {
            expect(out.stdout).toContain(needle);
        }
        for (const leak of [SECRET_FILE, 'secret_module', 'other-secret', SESSION, 'aaa111', 'bbb222', 'ccc333', root, 'private-project', PROSE, 'read-only', 'Looked around']) {
            expect(out.stdout).not.toContain(leak);
        }
        expect(out.stdout).toMatch(/^oldest \d{4}-\d{2}-\d{2}T/m);
        expect(out.stdout).toMatch(/^newest \d{4}-\d{2}-\d{2}T/m);
    });

    it('prints an unrecognisable agent type or model as other, never verbatim', () => {
        const root = tree([
            { id: 'x', meta: { agentType: PROSE, model: 'a model with spaces', spawnDepth: 1 }, lines: [assistant([text('DONE')])] },
        ]);
        const out = run(['--root', root, '--json']);
        expect(out.status).toBe(0);
        expect(out.stdout).not.toContain(PROSE);
        expect(out.stdout).not.toContain('a model with spaces');
        expect(JSON.parse(out.stdout).groups[0].agent_type).toBe('other');
    });

    it('reports zero legs on an empty tree rather than failing', () => {
        const root = mkdtempSync(join(tmpdir(), 'sar-empty-'));
        dirs.push(root);
        expect(buildReport({ root }).totals.legs).toBe(0);
    });
});

describe('subagent_return_report — status claim and effort (3.2)', () => {
    for (const claim of ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED', 'CHECKPOINT'] as const) {
        it(`reads ${claim} line-anchored from the last assistant text`, () => {
            expect(statusClaimOf([assistant([text(`Summary first.\n${claim}: details`)])])).toBe(claim);
        });
    }

    it('is none when no line carries a claim', () => {
        expect(statusClaimOf([assistant([text('I am DONE with this, mostly.')])])).toBe('none');
    });

    it('is none when DONE appears only inside a Bash input', () => {
        const lines = [
            assistant([{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'echo DONE' } }]),
            toolResult('b1', false),
        ];
        expect(statusClaimOf(lines)).toBe('none');
    });

    it('reads only the last assistant text, not an earlier one', () => {
        expect(statusClaimOf([assistant([text('BLOCKED')]), assistant([text('Recovered.\nDONE')])])).toBe('DONE');
    });

    it('prefers a final handback message over trailing text', () => {
        const lines = [
            assistant([{ type: 'tool_use', id: 'h1', name: 'SubagentHandback', input: { message: 'Report.\nDONE_WITH_CONCERNS' } }]),
        ];
        expect(statusClaimOf(lines)).toBe('DONE_WITH_CONCERNS');
    });

    it('reports effort present, absent and mixed per leg', () => {
        const root = tree([
            { id: 'p', meta: { agentType: 'present', spawnDepth: 1 }, lines: [assistant([text('DONE')], 'high'), assistant([text('DONE')], 'high')] },
            { id: 'a', meta: { agentType: 'absent', spawnDepth: 1 }, lines: [assistant([text('DONE')])] },
            { id: 'm', meta: { agentType: 'mixed', spawnDepth: 1 }, lines: [assistant([text('x')], 'low'), assistant([text('DONE')], 'xhigh')] },
        ]);
        const r = buildReport({ root });
        const effort = (t: string): Record<string, number> | undefined => r.groups.find((g) => g.agent_type === t)?.effort;
        expect(effort('present')).toEqual({ high: 1 });
        expect(effort('absent')).toEqual({ null: 1 });
        expect(effort('mixed')).toEqual({ mixed: 1 });
    });

    it('counts status claims per agent type', () => {
        const r = buildReport({ root: threeLegs() });
        expect(r.groups.find((g) => g.agent_type === 'ac-worker')?.status_claim).toEqual({ DONE: 1, BLOCKED: 1 });
        expect(r.groups.find((g) => g.agent_type === 'meta_missing')?.status_claim).toEqual({ NEEDS_CONTEXT: 1 });
    });
});
