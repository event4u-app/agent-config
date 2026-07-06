// Intent tests for src/scripts/mcp_telemetry_query.ts (python-free
// conversion of the retired golden-parity suite — the Python original is
// gone, so the tsx CLI's stdout/stderr/exit are asserted directly).
//
// Each test primes the tsx store on a JSONL fixture, then asserts the query
// CLI's output. The consumer root is normalized to <ROOT> so assertions are
// path-stable.
//
// node:sqlite gate: the read paths use Node's built-in SQLite (stable from
// Node 22.5). `@types/node@20` ships no typings and Node 20 lacks it, so
// the read suite is skipIf(!hasNodeSqlite()). The missing-DB error path
// runs before any sqlite load, so it stays in the ungated suite.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    FIXTURE_LINES,
    REPO_ROOT,
    type RunResult,
    hasNodeSqlite,
    makeRoot,
    normalizeRoot,
    runTs,
    writeSink,
} from './_mcp_telemetry.js';

const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_query.ts');
const TS_STORE = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_store.ts');

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
    const d = makeRoot('mcp-query-');
    roots.push(d);
    return d;
}

/** Prime the tsx store on `sink`, then run the tsx query CLI. */
function runQuery(sink: string[], queryArgs: string[]): RunResult {
    const r = root();
    writeSink(r, sink);
    runTs(TS_STORE, ['--consumer-root', r]);
    const res = runTs(TS_SCRIPT, ['--consumer-root', r, ...queryArgs]);
    return {
        status: res.status,
        stdout: normalizeRoot(res.stdout, r),
        stderr: normalizeRoot(res.stderr, r),
    };
}

const sqlite = hasNodeSqlite();

describe.skipIf(!sqlite)('mcp_telemetry_query — CLI intent (tsx)', () => {
    it('populated store: human table (header, rows, latent warning)', () => {
        const res = runQuery([...FIXTURE_LINES], []);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain(
            '📊  4 attempts across 2 tool(s) — 3 distinct consumer(s)',
        );
        expect(res.stdout).toContain('   db: <ROOT>/agents/runtime/mcp-telemetry/calls.sqlite3');
        // Rows ordered attempts DESC, tool_name ASC → alphabetical on a tie.
        const audit = res.stdout.indexOf('audit_mcp_tools');
        const madeUp = res.stdout.indexOf('made_up_tool');
        expect(audit).toBeGreaterThan(-1);
        expect(madeUp).toBeGreaterThan(audit);
        expect(res.stdout).toContain('⚠️  latent-demand names not in catalog:');
        expect(res.stdout).toContain('   - made_up_tool');
    });

    it('populated store: json (catalog_known, latent_demand_names)', () => {
        const res = runQuery([...FIXTURE_LINES], ['--json']);
        expect(res.status).toBe(0);
        const report = JSON.parse(res.stdout) as Record<string, unknown>;
        expect(Object.keys(report)).toEqual([
            'db_path',
            'total_attempts',
            'total_distinct_consumers',
            'tools',
            'latent_demand_names',
            'catalog_known',
        ]);
        expect(report.total_attempts).toBe(4);
        expect(report.total_distinct_consumers).toBe(3);
        expect(report.catalog_known).toBe(true);
        expect(report.latent_demand_names).toEqual(['made_up_tool']);
        expect(report.tools).toEqual([
            {
                tool_name: 'audit_mcp_tools',
                attempts: 2,
                distinct_consumers: 2,
                implemented: 1,
                stub: 1,
                latent_demand: 0,
                last_ts: '2026-06-13T11:00:00Z',
            },
            {
                tool_name: 'made_up_tool',
                attempts: 2,
                distinct_consumers: 2,
                implemented: 0,
                stub: 0,
                latent_demand: 2,
                last_ts: '2026-06-13T12:00:00Z',
            },
        ]);
    });

    it('empty store (no rows): human "no telemetry rows"', () => {
        const res = runQuery([], []);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('📊  0 attempts across 0 tool(s) — 0 distinct consumer(s)');
        expect(res.stdout).toContain('(no telemetry rows');
    });

    it('empty store (no rows): json', () => {
        const res = runQuery([], ['--json']);
        expect(res.status).toBe(0);
        const report = JSON.parse(res.stdout) as Record<string, unknown>;
        expect(report.total_attempts).toBe(0);
        expect(report.total_distinct_consumers).toBe(0);
        expect(report.tools).toEqual([]);
        expect(report.latent_demand_names).toEqual([]);
    });

    it('only catalog tools (no latent names): human + json', () => {
        const lines = [
            '{"tool_name":"audit_mcp_tools","client_id_hash":"c1","ts":"2026-06-13T10:00:00Z","transport":"stdio","outcome":"implemented"}',
            '{"tool_name":"audit_mcp_tools","client_id_hash":"c2","ts":"2026-06-13T11:00:00Z","transport":"stdio","outcome":"implemented"}',
        ];
        const human = runQuery(lines, []);
        expect(human.status).toBe(0);
        expect(human.stdout).not.toContain('latent-demand names');
        const json = runQuery(lines, ['--json']);
        expect(json.status).toBe(0);
        const report = JSON.parse(json.stdout) as Record<string, unknown>;
        expect(report.latent_demand_names).toEqual([]);
        expect(report.total_attempts).toBe(2);
    });
});

// The missing-DB branch returns before any sqlite load, so it needs no gate.
describe('mcp_telemetry_query — missing DB (no sqlite needed)', () => {
    it('missing db: human error on stderr, exit 1', () => {
        const r = root();
        const res = runTs(TS_SCRIPT, ['--consumer-root', r]);
        expect(res.status).toBe(1);
        expect(res.stdout).toBe('');
        const stderr = normalizeRoot(res.stderr, r);
        expect(stderr).toContain(
            '❌  telemetry db not found: <ROOT>/agents/runtime/mcp-telemetry/calls.sqlite3',
        );
        expect(stderr).toContain('run `./scripts-run src/scripts/mcp_telemetry_store` first.');
    });

    it('missing db: json error envelope on stdout, exit 1', () => {
        const r = root();
        const res = runTs(TS_SCRIPT, ['--consumer-root', r, '--json']);
        expect(res.status).toBe(1);
        expect(res.stderr).toBe('');
        const report = JSON.parse(normalizeRoot(res.stdout, r)) as Record<string, unknown>;
        expect(report).toEqual({
            error: 'telemetry db not found: <ROOT>/agents/runtime/mcp-telemetry/calls.sqlite3',
        });
    });
});
