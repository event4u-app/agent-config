// Intent tests for src/scripts/mcp_telemetry_health.ts (python-free
// conversion of the retired golden-parity suite — the Python original is
// gone, so the tsx CLI's stdout/stderr/exit are asserted directly).
//
// The consumer root is normalized to <ROOT> so assertions are path-stable.
// Needs no sqlite — health reads only the JSONL sink.
//
// Window choice is wall-clock-robust: the FIXTURE_LINES timestamps are
// fixed in the past (2026-06-13), so 999999h ⇒ every record is in-window
// (always healthy) and 1h / the default 24h ⇒ records fall out (always
// silent).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    FIXTURE_LINES,
    REPO_ROOT,
    type RunResult,
    makeRoot,
    normalizeRoot,
    runTs,
    writeSink,
} from './_mcp_telemetry.js';

const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_health.ts');

const roots: string[] = [];
afterEach(() => {
    while (roots.length > 0) {
        const d = roots.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});
function root(): string {
    const d = makeRoot('mcp-health-');
    roots.push(d);
    return d;
}

/** Run the tsx CLI under a fresh root with the given sink; normalize paths. */
function runHealth(sink: string[] | null, args: string[]): RunResult {
    const r = root();
    if (sink !== null) {
        writeSink(r, sink);
    }
    const res = runTs(TS_SCRIPT, ['--consumer-root', r, ...args]);
    return {
        status: res.status,
        stdout: normalizeRoot(res.stdout, r),
        stderr: normalizeRoot(res.stderr, r),
    };
}

const SINK = '<ROOT>/agents/runtime/mcp-telemetry/calls.jsonl';

describe('mcp_telemetry_health — CLI intent (tsx)', () => {
    it('healthy: huge window, human', () => {
        const r = runHealth([...FIXTURE_LINES], ['--window-hours', '999999']);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(r.stdout).toBe(
            '✅  4 record(s) logged in the past 999999h.\n' +
                '   last record: 2026-06-13T12:00:00Z\n' +
                `   sink: ${SINK}\n`,
        );
    });

    it('healthy: huge window, json (compact, field-ordered envelope)', () => {
        const r = runHealth([...FIXTURE_LINES], ['--window-hours', '999999', '--json']);
        expect(r.status).toBe(0);
        const report = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(Object.keys(report)).toEqual([
            'status',
            'path',
            'window_hours',
            'records_in_window',
            'last_ts',
            'message',
        ]);
        expect(report.status).toBe('healthy');
        expect(report.records_in_window).toBe(4);
        expect(report.last_ts).toBe('2026-06-13T12:00:00Z');
        expect(report.window_hours).toBe(999999);
    });

    it('silent: tiny window, human (exit 1)', () => {
        const r = runHealth([...FIXTURE_LINES], ['--window-hours', '1']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('❌  No telemetry records in the past 1h.');
        expect(r.stdout).toContain('   last record: 2026-06-13T12:00:00Z');
        expect(r.stdout).toContain(`   sink: ${SINK}`);
    });

    it('silent: tiny window, json (exit 1, em-dash stays ASCII-escaped)', () => {
        const r = runHealth([...FIXTURE_LINES], ['--window-hours', '1', '--json']);
        expect(r.status).toBe(1);
        // Raw stdout keeps ensure_ascii escaping — the em-dash in the silent
        // message never appears as a literal non-ASCII byte.
        expect(r.stdout).toContain('\\u2014');
        expect(r.stdout).not.toContain('—');
        const report = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(report.status).toBe('silent');
        expect(report.records_in_window).toBe(0);
        expect(report.last_ts).toBe('2026-06-13T12:00:00Z');
    });

    it('default 24h window is silent for the fixed-past fixtures, human', () => {
        // Fixture records are permanently in the past, so the default window
        // deterministically reports silence.
        const r = runHealth([...FIXTURE_LINES], []);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('❌  No telemetry records in the past 24h.');
    });

    it('missing sink, human (exit 1, ⚠️)', () => {
        const r = runHealth(null, []);
        expect(r.status).toBe(1);
        expect(r.stdout).toBe(
            `⚠️  Telemetry sink not found at ${SINK}. ` +
                'Either the MCP server has never run, or the consumer root is wrong.\n' +
                `   sink: ${SINK}\n`,
        );
    });

    it('missing sink, --allow-missing (exit 0)', () => {
        const r = runHealth(null, ['--allow-missing']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('⚠️  Telemetry sink not found');
    });

    it('missing sink, json', () => {
        const r = runHealth(null, ['--json']);
        expect(r.status).toBe(1);
        const report = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(report.status).toBe('missing');
        expect(report.records_in_window).toBe(0);
        expect(report.last_ts).toBeNull();
        expect(report.path).toBe(SINK);
    });

    it('all records malformed / non-string ts → silent, json', () => {
        const r = runHealth(
            ['{"ts":"not-a-date"}', '{"ts":12345}', 'garbage', '{"tool_name":"x"}', '   '],
            ['--window-hours', '999999', '--json'],
        );
        expect(r.status).toBe(1);
        const report = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(report.status).toBe('silent');
        expect(report.records_in_window).toBe(0);
        expect(report.last_ts).toBeNull();
    });

    it('empty sink file → silent, human', () => {
        const r = runHealth([], ['--window-hours', '999999']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('❌  No telemetry records in the past 999999h.');
        expect(r.stdout).not.toContain('last record:');
    });
});
