// Golden parity tests for src/scripts/mcp_telemetry_health.ts (py2ts).
//
// Spawns the Python original and the tsx twin on identical fixtures/args and
// asserts byte-identical stdout + stderr + exit code. Each runner gets its
// own consumer root; the resolved root is normalized to <ROOT> so the two
// outputs compare. Needs no sqlite — health reads only the JSONL sink.
//
// Window choice is wall-clock-robust: 999999h ⇒ every record is in-window
// (always healthy); 1h ⇒ records minutes-to-hours old fall out (always
// silent). Both runtimes share the host timezone, so the (intentionally
// DST-faithful) _parse_iso bucketing agrees.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    FIXTURE_LINES,
    REPO_ROOT,
    hasPython3,
    makeRoot,
    normalizeRoot,
    runPy,
    runTs,
    writeSink,
} from './_mcp_telemetry.js';

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_health.py');
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

/** Run py and ts under separate roots with the given sink, compare normalized. */
function assertParity(sink: string[] | null, args: string[]): void {
    const pyRoot = root();
    const tsRoot = root();
    if (sink !== null) {
        writeSink(pyRoot, sink);
        writeSink(tsRoot, sink);
    }
    const py = runPy(PY_SCRIPT, ['--consumer-root', pyRoot, ...args]);
    const ts = runTs(TS_SCRIPT, ['--consumer-root', tsRoot, ...args]);
    expect(ts.status).toBe(py.status);
    expect(normalizeRoot(ts.stdout, tsRoot)).toBe(normalizeRoot(py.stdout, pyRoot));
    expect(normalizeRoot(ts.stderr, tsRoot)).toBe(normalizeRoot(py.stderr, pyRoot));
}

const py3 = hasPython3();

describe.skipIf(!py3)('mcp_telemetry_health — golden parity (python3 vs tsx)', () => {
    it('healthy: huge window, human', () => {
        assertParity([...FIXTURE_LINES], ['--window-hours', '999999']);
    });

    it('healthy: huge window, json (em-dash stays ASCII-escaped)', () => {
        assertParity([...FIXTURE_LINES], ['--window-hours', '999999', '--json']);
    });

    it('silent: tiny window, human (exit 1)', () => {
        assertParity([...FIXTURE_LINES], ['--window-hours', '1']);
    });

    it('silent: tiny window, json (exit 1, em-dash escaped)', () => {
        assertParity([...FIXTURE_LINES], ['--window-hours', '1', '--json']);
    });

    it('default 24h window, human', () => {
        // Records are dated today; whether 24h is healthy or silent depends on
        // the host clock — but py and ts agree because they share it.
        assertParity([...FIXTURE_LINES], []);
    });

    it('missing sink, human (exit 1, ⚠️)', () => {
        // No sink written — both report "missing".
        assertParity(null, []);
    });

    it('missing sink, --allow-missing (exit 0)', () => {
        assertParity(null, ['--allow-missing']);
    });

    it('missing sink, json', () => {
        assertParity(null, ['--json']);
    });

    it('all records malformed / non-string ts → silent, json', () => {
        assertParity(
            ['{"ts":"not-a-date"}', '{"ts":12345}', 'garbage', '{"tool_name":"x"}', '   '],
            ['--window-hours', '999999', '--json'],
        );
    });

    it('empty sink file → silent, human', () => {
        assertParity([], ['--window-hours', '999999']);
    });
});
