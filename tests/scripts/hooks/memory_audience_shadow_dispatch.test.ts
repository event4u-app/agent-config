// memory-audience-shadow through the real dispatcher: manifest binding on claude
// pre_tool_use, the payload projection, root resolution and exactly one ledger
// append per observation (ratification round 13, both seats' recommendation).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO = resolve(__dirname, '..', '..', '..');
const TSX = join(REPO, 'node_modules', '.bin', 'tsx');
const ENTRY = join(REPO, 'src', 'scripts', 'hooks', 'dispatch_entry.ts');

let root: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mem-audience-dispatch-'));
    mkdirSync(join(root, 'agents', 'memory'), { recursive: true });
    writeFileSync(join(root, 'agents', 'memory', 'product-rules.yml'), 'y'.repeat(800));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function dispatch(payload: Record<string, unknown>): { status: number | null; stdout: string } {
    const r = spawnSync(TSX, [ENTRY, '--platform', 'claude', '--event', 'pre_tool_use'], {
        cwd: root,
        input: JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'e2e', ...payload }),
        encoding: 'utf8',
        env: { ...process.env, AGENT_CONFIG_REPLAY: '' },
    });
    return { status: r.status, stdout: r.stdout };
}

function memoryLines(): Record<string, unknown>[] {
    const dir = join(root, 'agents', 'runtime', 'state', 'subagent-ledger');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter((l) => l.trim()))
        .map((l) => JSON.parse(l) as Record<string, unknown>)
        .filter((l) => String(l['event']).startsWith('memory_'));
}

describe('memory-audience-shadow through the built dispatch path', () => {
    it('a child write under agents/memory/ appends exactly one line; the same write without agent_id none', () => {
        const write = { tool_name: 'Write', tool_input: { file_path: 'agents/memory/product-rules.yml', content: 'z' } };
        expect(dispatch({ ...write, agent_id: 'agent-x' }).status).toBe(0);
        expect(memoryLines()).toMatchObject([{ event: 'memory_child_write_attempt', target: 'curated' }]);
        expect(dispatch(write).status).toBe(0);
        expect(memoryLines()).toHaveLength(1);
    }, 60_000);

    it("the orchestrator's spawn appends one slice line with counts only", () => {
        const r = dispatch({ tool_name: 'Agent', tool_input: { prompt: 'see agents/memory/product-rules.yml', subagent_type: 'x' } });
        expect(r.status).toBe(0);
        const lines = memoryLines();
        expect(lines).toMatchObject([{ event: 'memory_slice_shadow', ref_count: 1, est_tokens: 200, delivered: false }]);
        expect(JSON.stringify(lines)).not.toContain('product-rules');
    }, 60_000);
});
