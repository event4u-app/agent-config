// Intent tests for src/scripts/mcp_telemetry_store.ts (python-free
// conversion of the retired golden-parity suite — the Python original is
// gone, so the tsx CLI's stdout/stderr/exit are asserted directly).
//
// The consumer root is normalized to <ROOT> so assertions are path-stable.
//
// node:sqlite gate: store writes a SQLite DB via Node's built-in module
// (stable from Node 22.5). `@types/node@20` ships no typings and Node 20
// lacks the module, so this suite is skipIf(!hasNodeSqlite()). The DB file
// is a derived view; only the CLI surface + the store→query round-trip are
// asserted.
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

const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_store.ts');
const TS_QUERY = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_query.ts');

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
    const d = makeRoot('mcp-store-');
    roots.push(d);
    return d;
}

/** Run the tsx store CLI under `r`; normalize paths in the output. */
function runStore(r: string, args: string[]): RunResult {
    const res = runTs(TS_SCRIPT, ['--consumer-root', r, ...args]);
    return {
        status: res.status,
        stdout: normalizeRoot(res.stdout, r),
        stderr: normalizeRoot(res.stderr, r),
    };
}

const SINK = '<ROOT>/agents/runtime/mcp-telemetry/calls.jsonl';
const DB = '<ROOT>/agents/runtime/mcp-telemetry/calls.sqlite3';

const sqlite = hasNodeSqlite();

describe.skipIf(!sqlite)('mcp_telemetry_store — CLI intent (tsx)', () => {
    it('first ingest: human (4 inserted, 1 malformed)', () => {
        const r = root();
        writeSink(r, [...FIXTURE_LINES]);
        const res = runStore(r, []);
        expect(res.status).toBe(0);
        expect(res.stderr).toBe('');
        expect(res.stdout).toBe(
            '✅  ingested 4 new row(s) (skipped 1 malformed, 0 already present)\n' +
                `   source: ${SINK}\n` +
                `   db:     ${DB}\n`,
        );
    });

    it('first ingest: json (field-ordered IngestReport envelope)', () => {
        const r = root();
        writeSink(r, [...FIXTURE_LINES]);
        const res = runStore(r, ['--json']);
        expect(res.status).toBe(0);
        const report = JSON.parse(res.stdout) as Record<string, unknown>;
        expect(Object.keys(report)).toEqual([
            'source_path',
            'db_path',
            'lines_read',
            'lines_skipped',
            'rows_inserted',
            'rows_already_present',
        ]);
        expect(report.lines_read).toBe(5);
        expect(report.lines_skipped).toBe(1);
        expect(report.rows_inserted).toBe(4);
        expect(report.rows_already_present).toBe(0);
    });

    it('idempotent re-run: second ingest reports 0 inserted / 4 already (json)', () => {
        const r = root();
        writeSink(r, [...FIXTURE_LINES]);
        // Prime the store once.
        runStore(r, []);
        // Second run is the assertion surface.
        const res = runStore(r, ['--json']);
        expect(res.status).toBe(0);
        const report = JSON.parse(res.stdout) as Record<string, unknown>;
        expect(report.rows_inserted).toBe(0);
        expect(report.rows_already_present).toBe(4);
        expect(report.lines_skipped).toBe(1);
    });

    it('missing source sink: still creates DB, reports zeros (human)', () => {
        // No sink written — store creates the DB so the query CLI has a target.
        const r = root();
        const res = runStore(r, []);
        expect(res.status).toBe(0);
        expect(res.stdout).toBe(
            '✅  ingested 0 new row(s) (skipped 0 malformed, 0 already present)\n' +
                `   source: ${SINK}\n` +
                `   db:     ${DB}\n`,
        );
        expect(fs.existsSync(path.join(r, 'agents', 'runtime', 'mcp-telemetry', 'calls.sqlite3'))).toBe(
            true,
        );
    });

    it('missing source sink: json zeros', () => {
        const r = root();
        const res = runStore(r, ['--json']);
        expect(res.status).toBe(0);
        const report = JSON.parse(res.stdout) as Record<string, unknown>;
        expect(report.lines_read).toBe(0);
        expect(report.lines_skipped).toBe(0);
        expect(report.rows_inserted).toBe(0);
        expect(report.rows_already_present).toBe(0);
    });

    it('record fields coerced: non-string / missing values still ingest as rows', () => {
        // tool_name int, ts null, transport missing → coerced to strings by
        // the ingester; both lines are valid JSON, so both insert, none skip.
        const lines = [
            '{"tool_name":1,"client_id_hash":null,"ts":2,"outcome":true}',
            '{"tool_name":"ok","client_id_hash":"c","ts":"2026-01-01T00:00:00Z","transport":"stdio","outcome":"implemented"}',
        ];
        const r = root();
        writeSink(r, lines);
        const res = runStore(r, ['--json']);
        expect(res.status).toBe(0);
        const report = JSON.parse(res.stdout) as Record<string, unknown>;
        expect(report.lines_read).toBe(2);
        expect(report.lines_skipped).toBe(0);
        expect(report.rows_inserted).toBe(2);
    });

    it('store → query round-trip: query CLI reads the freshly written DB', () => {
        const r = root();
        writeSink(r, [...FIXTURE_LINES]);
        runStore(r, []);
        const q = runTs(TS_QUERY, ['--consumer-root', r, '--json']);
        // The query CLI opens the store-written DB read-only without error.
        expect(q.status).toBe(0);
        expect(q.stdout).toContain('"total_attempts":4');
    });
});
