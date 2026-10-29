import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { live_args } from '../../src/scripts/bench_ab_task_runner.js';
import { missingTraceFields, parseTrace, payloadHash } from '../../src/scripts/_lib/bench_map_trace.js';

const REPO = path.resolve(__dirname, '../..');

const stream = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-x-1', tools: ['Read', 'Edit', 'Bash'], mcp_servers: [{ name: 'agent-config', status: 'connected' }] }),
    JSON.stringify({ type: 'assistant', message: { model: 'claude-x-1', content: [{ type: 'text', text: 'secret reasoning' }, { type: 'tool_use', name: 'Read', input: { file_path: '/clone/agents/map/MAP.md' } }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'agent-config code-graph affected src/a.js' } }, { type: 'tool_use', name: 'mcp__agent-config__graph_query', input: { q: 'x' } }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/clone/src/a.js' } }, { type: 'tool_use', name: 'Edit', input: { file_path: '/clone/src/a.js' } }, { type: 'tool_use', name: 'Read', input: { file_path: '/clone/src/b.js' } }] } }),
    'not json',
    JSON.stringify({ type: 'result', subtype: 'success', num_turns: 4, modelUsage: { 'claude-x-1': {} } }),
].join('\n');

describe('trial trace (5.1, H28)', () => {
    it('reads turns, models, subtype, tool calls, map reads, graph runs and reads before the first edit', () => {
        const t = parseTrace(stream, { wall_s: 12.5, ac_version: '9.9.9', payload: 'inject', clone: '/clone' });
        expect(t).toMatchObject({
            turns: 4,
            wall_s: 12.5,
            models: ['claude-x-1'],
            subtype: 'success',
            tool_calls: { Read: 3, Bash: 1, 'mcp__agent-config__graph_query': 1, Edit: 1 },
            map_reads: 1,
            code_graph_runs: 1,
            graph_tool_runs: 1,
            files_read_before_first_edit: ['agents/map/MAP.md', 'src/a.js'],
            tools: ['Bash', 'Edit', 'Read'],
            mcp_servers: ['agent-config'],
            ac_version: '9.9.9',
            payload_hash: payloadHash('inject'),
        });
        expect(missingTraceFields(t)).toEqual([]);
    });

    it('keeps no message text in the trace', () => {
        expect(JSON.stringify(parseTrace(stream, { wall_s: 0, ac_version: 'none', payload: null }))).not.toContain('secret reasoning');
    });

    it('asks claude for stream-json with --verbose when the trace is wanted', () => {
        const a = live_args('p', { stream: true });
        expect(a.slice(0, 4)).toEqual(['--print', '--output-format', 'stream-json', '--verbose']);
        expect(live_args('p').slice(0, 3)).toEqual(['--print', '--output-format', 'json']);
    });

    it('the dry run carries every trace field on every trial', () => {
        const r = spawnSync(path.join(REPO, 'scripts-run'), ['src/scripts/bench_map_task_set', '--dry-run', '--tasks', '1', '--check-trace-fields', '--out-dir', path.join(REPO, 'agents/map/.build/bench-trace-test')], { cwd: REPO, encoding: 'utf-8' });
        expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
        expect(r.stdout).toMatch(/trace fields: complete on \d+ trial/);
    }, 180_000);
});
