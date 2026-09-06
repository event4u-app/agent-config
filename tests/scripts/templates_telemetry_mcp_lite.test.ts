/**
 * Roadmap step 4.2 — the MCP-lite section of `telemetry:report`.
 *
 * Two properties are load-bearing and both are pinned here:
 *
 * 1. The section renders in the DEFAULT invocation, and renders an explicit
 *    zero on a machine with no calls. A section that vanished when empty would
 *    make "nobody used it" and "nobody looked" indistinguishable.
 * 2. It does NOT render when a caller pinned `--log-path` and named no MCP
 *    sink. That is the mode every frozen Python-parity golden runs in, and
 *    those goldens can never be re-captured, so this is a guard on a pin that
 *    cannot be repaired rather than a stylistic choice.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate_mcp_lite, MCP_LITE_LOG_REL } from '../../src/agent-src/templates/scripts/telemetry/mcp_lite.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src/agent-src/templates/scripts/telemetry_report.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tele-mcp-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
}
function run(args: string[], cwd = REPO_ROOT): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function row(o: Record<string, unknown>): string {
    return JSON.stringify({
        tool_name: 'read_skill',
        client_id_hash: 'aaaaaaaaaaaa',
        ts: '2026-09-06T10:00:00Z',
        transport: 'stdio-lite',
        outcome: 'implemented',
        host: 'claude-code',
        ...o,
    });
}

function sink(dir: string, lines: string[]): string {
    const p = path.join(dir, 'calls.jsonl');
    fs.writeFileSync(p, lines.length ? `${lines.join('\n')}\n` : '');
    return p;
}

/** An engagement log path that does not exist — the report treats it as empty. */
function noEngagement(dir: string): string {
    return path.join(dir, 'engagement.jsonl');
}

describe('telemetry:report — the MCP-lite section renders, zero included', () => {
    it('renders an explicit zero when the sink does not exist', () => {
        const d = mkTmp();
        const r = run(['--log-path', noEngagement(d), '--mcp-log-path', path.join(d, 'absent.jsonl'), '--since', 'all']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('## MCP lite surface');
        expect(r.stdout).toContain('- calls recorded: **0**');
        expect(r.stdout).toContain('No calls recorded.');
    });

    it('renders an explicit zero when the sink exists but is empty', () => {
        const d = mkTmp();
        const r = run(['--log-path', noEngagement(d), '--mcp-log-path', sink(d, []), '--since', 'all']);
        expect(r.stdout).toContain('- calls recorded: **0**');
    });

    it('the zero carries the caveat that the instrument is default-off', () => {
        const d = mkTmp();
        const r = run(['--log-path', noEngagement(d), '--mcp-log-path', sink(d, []), '--since', 'all']);
        expect(r.stdout).toContain('telemetry.artifact_engagement.enabled');
        expect(r.stdout).toContain('not a measurement of what consumers do');
    });

    it('reports per-tool and per-host counts', () => {
        const d = mkTmp();
        const p = sink(d, [
            row({ tool_name: 'suggest_skill_for_task' }),
            row({ tool_name: 'suggest_skill_for_task', host: 'cursor' }),
            row({ tool_name: 'read_skill' }),
        ]);
        const r = run(['--log-path', noEngagement(d), '--mcp-log-path', p, '--since', 'all']);
        expect(r.stdout).toContain('- calls recorded: **3**');
        expect(r.stdout).toContain('| suggest_skill_for_task | 2 |');
        expect(r.stdout).toContain('| read_skill | 1 |');
        expect(r.stdout).toContain('| claude-code | 2 |');
        expect(r.stdout).toContain('| cursor | 1 |');
    });

    it('counts only the lite transport — a kernel-server row is not this surface', () => {
        const d = mkTmp();
        const p = sink(d, [row({}), row({ transport: 'stdio', tool_name: 'memory_signal' })]);
        const r = run(['--log-path', noEngagement(d), '--mcp-log-path', p, '--since', 'all']);
        expect(r.stdout).toContain('- calls recorded: **1**');
        expect(r.stdout).not.toContain('memory_signal');
    });

    it('the JSON format carries the same reading', () => {
        const d = mkTmp();
        const p = sink(d, [row({}), row({ tool_name: 'suggest_skill_for_task', host: 'cursor' })]);
        const r = run(['--log-path', noEngagement(d), '--mcp-log-path', p, '--since', 'all', '--format', 'json']);
        const payload = JSON.parse(r.stdout) as Record<string, unknown>;
        const lite = payload.mcp_lite as Record<string, unknown>;
        expect(lite.calls).toBe(2);
        expect(lite.by_tool).toEqual({ read_skill: 1, suggest_skill_for_task: 1 });
        expect(lite.by_host).toEqual({ 'claude-code': 1, cursor: 1 });
        expect(lite.by_outcome).toEqual({ implemented: 2 });
    });
});

describe('telemetry:report — the section is absent in the pinned-log mode', () => {
    it('a bare --log-path renders no MCP section (the frozen-golden guard)', () => {
        const d = mkTmp();
        const r = run(['--log-path', noEngagement(d), '--since', 'all']);
        expect(r.status).toBe(0);
        expect(r.stdout).not.toContain('MCP lite surface');
    });

    it('a bare --log-path renders no `mcp_lite` key in JSON either', () => {
        const d = mkTmp();
        const r = run(['--log-path', noEngagement(d), '--since', 'all', '--format', 'json']);
        expect(Object.keys(JSON.parse(r.stdout) as Record<string, unknown>)).not.toContain('mcp_lite');
    });

    it('the DEFAULT invocation — no --log-path — DOES render it', () => {
        const d = mkTmp();
        fs.writeFileSync(
            path.join(d, '.agent-settings.yml'),
            `telemetry:\n  artifact_engagement:\n    enabled: false\n    output:\n      path: ${noEngagement(d)}\n`,
        );
        const r = run(['--settings', path.join(d, '.agent-settings.yml'), '--since', 'all'], d);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('## MCP lite surface');
        expect(r.stdout).toContain('- calls recorded: **0**');
    });

    it('the default invocation resolves the sink under the CWD', () => {
        const d = mkTmp();
        fs.mkdirSync(path.dirname(path.join(d, MCP_LITE_LOG_REL)), { recursive: true });
        fs.writeFileSync(path.join(d, MCP_LITE_LOG_REL), `${row({})}\n`);
        fs.writeFileSync(
            path.join(d, '.agent-settings.yml'),
            `telemetry:\n  artifact_engagement:\n    enabled: false\n    output:\n      path: ${noEngagement(d)}\n`,
        );
        const r = run(['--settings', path.join(d, '.agent-settings.yml'), '--since', 'all'], d);
        expect(r.stdout).toContain('- calls recorded: **1**');
    });
});

describe('aggregate_mcp_lite — window and malformed input', () => {
    it('a missing file is an empty reading, never an error', () => {
        const agg = aggregate_mcp_lite(path.join(mkTmp(), 'nope.jsonl'));
        expect(agg.calls).toBe(0);
        expect(agg.skipped_lines).toBe(0);
    });

    it('malformed lines are counted, not fatal', () => {
        const d = mkTmp();
        const p = sink(d, ['{not json', row({}), '[]', JSON.stringify({ transport: 'stdio-lite' })]);
        const agg = aggregate_mcp_lite(p);
        expect(agg.calls).toBe(1);
        expect(agg.skipped_lines).toBe(3);
    });

    it('the --since window drops rows before the cutoff', () => {
        const d = mkTmp();
        const p = sink(d, [
            row({ ts: '2026-01-01T00:00:00Z' }),
            row({ ts: '2026-09-06T10:00:00Z', tool_name: 'suggest_skill_for_task' }),
        ]);
        const cutoff = Date.parse('2026-06-01T00:00:00Z');
        const agg = aggregate_mcp_lite(p, { since: cutoff });
        expect(agg.calls).toBe(1);
        expect([...agg.by_tool.keys()]).toEqual(['suggest_skill_for_task']);
    });

    it('a row with no host reads as `unknown`, never as absent', () => {
        const d = mkTmp();
        const p = sink(d, [JSON.stringify({ tool_name: 'read_skill', transport: 'stdio-lite', ts: '2026-09-06T10:00:00Z', outcome: 'implemented' })]);
        const agg = aggregate_mcp_lite(p);
        expect(agg.by_host.get('unknown')).toBe(1);
    });
});

describe('telemetry:report — the redaction floor still applies to the new section', () => {
    it('a sink carrying a path-shaped tool name is REFUSED, not printed', () => {
        const d = mkTmp();
        const p = sink(d, [row({ tool_name: '/Users/someone/.ssh/id_rsa' })]);
        const r = run(['--log-path', noEngagement(d), '--mcp-log-path', p, '--since', 'all']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('redaction validator refused report');
        expect(r.stdout).not.toContain('id_rsa');
    });
});
