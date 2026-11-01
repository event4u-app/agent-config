// The CLI `./agent-config memory:lookup` and the MCP tool `memory_lookup` are two
// surfaces over one operation. This drives both with the same fixture memory
// tree and arguments and requires the same envelope — the behavioural half that
// `lint_memory_twin_parity` (a source-line ratchet) cannot see.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const CLI = join(REPO_ROOT, 'agent-config');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const MCP_PROBE = join(REPO_ROOT, 'tests', 'fixtures', 'memory-twin', 'mcp_probe.ts');
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function entry(id: string, p: string, validated = TODAY_ISO): string {
    return [
        `  - id: ${id}`,
        '    status: active',
        '    confidence: high',
        '    source:',
        '      - ADR-1',
        '    owner: team',
        `    last_validated: ${validated}`,
        '    review_after_days: 180',
        `    path: "${p}"`,
    ].join('\n');
}

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mem-twin-parity-'));
    const mem = join(tmp, 'agents', 'memory');
    mkdirSync(join(mem, 'intake'), { recursive: true });
    writeFileSync(
        join(mem, 'ownership.yml'),
        `entries:\n${entry('own-1', 'app/Billing')}\n${entry('own-2', 'app/Billing/Invoices')}\n${entry('own-old', 'app/Billing', '2020-01-01')}\n`,
    );
    writeFileSync(
        join(mem, 'intake', 'signals.jsonl'),
        `${JSON.stringify({ id: 'sig-1', type: 'ownership', path: 'app/Billing', body: 'billing owner moved', ts: `${TODAY_ISO}T00:00:00Z` })}\n`,
    );
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

function viaCli(args: readonly string[]): unknown {
    const r = spawnSync(CLI, ['memory:lookup', ...args, '--format', 'json', '--envelope', 'v1'], {
        cwd: tmp,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '200' },
    });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout);
}

// The MCP side runs in its own tsx process, as the server does in production:
// vitest's module loader resolves the optional tokenizer differently and would
// report a harness difference as a twin difference.
function viaMcp(args: Record<string, unknown>): unknown {
    const r = spawnSync(TSX_BIN, [MCP_PROBE, tmp, JSON.stringify(args)], { cwd: REPO_ROOT, encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout);
}

describe('memory_lookup — CLI and MCP answer alike', () => {
    const cases: { name: string; cli: string[]; mcp: Record<string, unknown> }[] = [
        {
            name: 'full detail',
            cli: ['--types', 'ownership', '--key', 'app/Billing', '--limit', '5', '--detail', 'full'],
            mcp: { types: ['ownership'], keys: ['app/Billing'], limit: 5, detail: 'full' },
        },
        {
            name: 'index detail',
            cli: ['--types', 'ownership', '--key', 'app/Billing', '--limit', '5', '--detail', 'index'],
            mcp: { types: ['ownership'], keys: ['app/Billing'], limit: 5, detail: 'index' },
        },
        {
            name: 'token budget',
            cli: ['--types', 'ownership', '--key', 'app/Billing', '--limit', '5', '--detail', 'full', '--token-budget', '20'],
            mcp: { types: ['ownership'], keys: ['app/Billing'], limit: 5, detail: 'full', token_budget: 20 },
        },
        {
            name: 'no match',
            cli: ['--types', 'ownership', '--key', 'nowhere/at/all', '--limit', '5', '--detail', 'index'],
            mcp: { types: ['ownership'], keys: ['nowhere/at/all'], limit: 5, detail: 'index' },
        },
    ];

    for (const c of cases) {
        it(c.name, () => {
            const mcp = viaMcp(c.mcp);
            expect(viaCli(c.cli)).toEqual(mcp);
        });
    }

    it('the fixture is not trivially empty', () => {
        const mcp = viaMcp(cases[0]!.mcp) as Record<string, unknown>;
        expect(JSON.stringify(mcp)).toContain('own-1');
    });
});
