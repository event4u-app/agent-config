// Golden parity tests for src/scripts/mcp_telemetry_query.ts (py2ts).
//
// Each test primes a store (same-language: py-store→py-query,
// ts-store→ts-query) on identical JSONL fixtures, then compares the query
// CLI's stdout/stderr/exit byte-for-byte. Each runner gets its own consumer
// root; the resolved root is normalized to <ROOT>.
//
// node:sqlite gate: the read paths use Node's built-in SQLite (stable from
// Node 22.5). `@types/node@20` ships no typings and Node 20 lacks it, so the
// read suite is skipIf(!hasNodeSqlite()) — the `hasPython3` skipIf precedent.
// The missing-DB error path runs before any sqlite load, so it stays in the
// ungated suite.
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

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_query.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_query.ts');
const PY_STORE = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_store.py');
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

/** Prime same-language stores, then compare same-language query output. */
function assertQueryParity(sink: string[], queryArgs: string[]): void {
    const pyRoot = root();
    const tsRoot = root();
    writeSink(pyRoot, sink);
    writeSink(tsRoot, sink);
    runPy(PY_STORE, ['--consumer-root', pyRoot]);
    runTs(TS_STORE, ['--consumer-root', tsRoot]);
    const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot, ...queryArgs]);
    const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot, ...queryArgs]);
    expect(ts.status).toBe(py.status);
    expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
    expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
}

const py3 = hasPython3();
const sqlite = hasNodeSqlite();

describe.skipIf(!py3 || !sqlite)('mcp_telemetry_query — golden parity (python3 vs tsx)', () => {
    it('populated store: human table (padding, em-dash, latent warning)', () => {
        assertQueryParity([...FIXTURE_LINES], []);
    });

    it('populated store: json (catalog_known, latent_demand_names)', () => {
        assertQueryParity([...FIXTURE_LINES], ['--json']);
    });

    it('empty store (no rows): human "no telemetry rows"', () => {
        assertQueryParity([], []);
    });

    it('empty store (no rows): json', () => {
        assertQueryParity([], ['--json']);
    });

    it('only catalog tools (no latent names): human + json', () => {
        const lines = [
            '{"tool_name":"audit_mcp_tools","client_id_hash":"c1","ts":"2026-06-13T10:00:00Z","transport":"stdio","outcome":"implemented"}',
            '{"tool_name":"audit_mcp_tools","client_id_hash":"c2","ts":"2026-06-13T11:00:00Z","transport":"stdio","outcome":"implemented"}',
        ];
        assertQueryParity(lines, []);
        assertQueryParity(lines, ['--json']);
    });

    it('cross-language DB read: python store → tsx query (format interop)', () => {
        const r = root();
        writeSink(r, [...FIXTURE_LINES]);
        runPy(PY_STORE, ['--consumer-root', r]);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', r, '--json']);
        const py = runPy(PY_SCRIPT, ['--consumer-root', r, '--json']);
        // tsx query reads the python-written DB; output matches python query.
        expect(ts.status).toBe(0);
        expect(normalizeRoot(ts.stdout, r)).toBe(normalizeRoot(py.stdout, r));
    });
});

// The missing-DB branch returns before any sqlite load, so it needs no gate.
describe.skipIf(!py3)('mcp_telemetry_query — missing DB (no sqlite needed)', () => {
    it('missing db: human error on stderr, exit 1', () => {
        const pyRoot = root();
        const tsRoot = root();
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot]);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot]);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });

    it('missing db: json error envelope, exit 1', () => {
        const pyRoot = root();
        const tsRoot = root();
        const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot, '--json']);
        const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot, '--json']);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
        expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
    });
});
