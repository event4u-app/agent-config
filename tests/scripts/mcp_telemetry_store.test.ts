// Golden parity tests for src/scripts/mcp_telemetry_store.ts (py2ts).
//
// Spawns the Python original and the tsx twin on identical JSONL fixtures
// and asserts byte-identical stdout + stderr + exit code. Each runner gets
// its own consumer root; the resolved root is normalized to <ROOT>.
//
// node:sqlite gate: store writes a SQLite DB via Node's built-in module
// (stable from Node 22.5). `@types/node@20` ships no typings and Node 20
// lacks the module, so this suite is skipIf(!hasNodeSqlite()) — the
// `hasPython3` skipIf precedent. The twin's stdout is sqlite-independent;
// the DB file is a derived view, never byte-compared.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    FIXTURE_LINES,
    REPO_ROOT,
    hasNodeSqlite,
    hasPython3,
    makeRoot,
    normalizeRoot,
    runPy,
    runTs,
    writeSink,
} from './_mcp_telemetry.js';

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_store.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_store.ts');

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

const py3 = hasPython3();
const sqlite = hasNodeSqlite();

describe.skipIf(!py3 || !sqlite)('mcp_telemetry_store — golden parity (python3 vs tsx)', () => {
    it('first ingest: human (4 inserted, 1 malformed)', () => {
        const pyRoot = root();
        const tsRoot = root();
        writeSink(pyRoot, [...FIXTURE_LINES]);
        writeSink(tsRoot, [...FIXTURE_LINES]);
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot]);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot]);
        expect(ts.status).toBe(py.status);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });

    it('first ingest: json', () => {
        const pyRoot = root();
        const tsRoot = root();
        writeSink(pyRoot, [...FIXTURE_LINES]);
        writeSink(tsRoot, [...FIXTURE_LINES]);
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot, '--json']);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot, '--json']);
        expect(ts.status).toBe(py.status);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });

    it('idempotent re-run: second ingest reports 0 inserted / N already (json)', () => {
        const pyRoot = root();
        const tsRoot = root();
        writeSink(pyRoot, [...FIXTURE_LINES]);
        writeSink(tsRoot, [...FIXTURE_LINES]);
        // Prime both stores once.
        runPy(PY_SCRIPT, ['--consumer-root', pyRoot]);
        runTs(TS_SCRIPT, ['--consumer-root', tsRoot]);
        // Second run is the comparison surface.
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot, '--json']);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot, '--json']);
        expect(ts.status).toBe(py.status);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });

    it('missing source sink: still creates DB, reports zeros (human)', () => {
        // No sink written — store creates the DB so the query CLI has a target.
        const pyRoot = root();
        const tsRoot = root();
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot]);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot]);
        expect(ts.status).toBe(py.status);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });

    it('missing source sink: json zeros', () => {
        const pyRoot = root();
        const tsRoot = root();
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot, '--json']);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot, '--json']);
        expect(ts.status).toBe(py.status);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });

    it('record fields coerced via Python str(): non-string / missing values', () => {
        // tool_name int, ts null, transport missing → str(1)="1", str(None)="None",
        // record.get("transport","")="" — exercised through the round-trip but the
        // store stdout only counts rows; this asserts both ingest identically.
        const lines = [
            '{"tool_name":1,"client_id_hash":null,"ts":2,"outcome":true}',
            '{"tool_name":"ok","client_id_hash":"c","ts":"2026-01-01T00:00:00Z","transport":"stdio","outcome":"implemented"}',
        ];
        const pyRoot = root();
        const tsRoot = root();
        writeSink(pyRoot, lines);
        writeSink(tsRoot, lines);
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot, '--json']);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot, '--json']);
        expect(ts.status).toBe(py.status);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });

    it('cross-language DB read: tsx store → python query (format interop)', () => {
        const tsRoot = root();
        writeSink(tsRoot, [...FIXTURE_LINES]);
        runTs(TS_SCRIPT, ['--consumer-root', tsRoot]);
        const PY_QUERY = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_query.py');
        const q = runPy(PY_QUERY, ['--consumer-root', tsRoot, '--json']);
        // Python opens the tsx-written DB read-only without error.
        expect(q.status).toBe(0);
        expect(q.stdout).toContain('"total_attempts":4');
    });
});
