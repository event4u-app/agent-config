// Pre-registered probe case matrix for src/scripts/_lib/tool_probe.ts
// (road-to-internet-reach Phase 2, step 3 — written before the doctor exists).
//
// Every case is driven by a REAL executable stub in a real temp dir; nothing
// mocks `node:child_process`. The five states are exercised end-to-end through
// `probeTool()`, which must classify and never throw.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    probeTool,
    probeTools,
    type ToolProbeDescriptor,
    type ToolProbeResult,
} from '../../src/scripts/_lib/tool_probe.js';

// The fixtures are `#!/bin/sh` stubs — POSIX only. On win32 the whole matrix
// is inapplicable (no shebang execution), so it is skipped wholesale rather
// than asserted with a different meaning.
const POSIX = process.platform !== 'win32';

/** Absolute `sleep` for the deadline fixture (the fixture PATH holds only stubs). */
const SLEEP = ['/bin/sleep', '/usr/bin/sleep'].find((candidate) => fs.existsSync(candidate));

let BIN_DIR = '';
let ROOT = '';

/** Write an executable stub into the fixture PATH dir. */
function stub(name: string, body: string): string {
    const target = path.join(BIN_DIR, name);
    fs.writeFileSync(target, body, 'utf-8');
    fs.chmodSync(target, 0o755);
    return target;
}

/** Descriptor pointing at the fixture bin dir only — nothing from the host PATH. */
function descriptorFor(
    bin: string,
    extra: Partial<ToolProbeDescriptor> = {},
): ToolProbeDescriptor {
    return {
        name: `fixture-${bin}`,
        bin,
        probe_args: ['--version'],
        timeout_ms: 4_000,
        env: { PATH: BIN_DIR },
        ...extra,
    };
}

beforeAll(() => {
    ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-probe-'));
    BIN_DIR = path.join(ROOT, 'bin');
    fs.mkdirSync(BIN_DIR, { recursive: true });
});

afterAll(() => {
    if (ROOT !== '') fs.rmSync(ROOT, { recursive: true, force: true });
});

describe.skipIf(!POSIX)('probeTool — case 1: absent binary', () => {
    it('GIVEN a binary that resolves nowhere on the probe PATH WHEN probed THEN status is missing and the fix is echoed', () => {
        const result = probeTool(
            descriptorFor('agent-config-absent-backend-xyz', {
                fix: 'brew install agent-config-absent-backend-xyz',
            }),
        );

        expect(result.status).toBe('missing');
        expect(result.path).toBeNull();
        expect(result.exit_code).toBeNull();
        expect(result.attempts).toBe(0);
        expect(result.fix).toBe('brew install agent-config-absent-backend-xyz');
        expect(result.diagnostic).toContain('does not resolve on PATH');
    });
});

describe.skipIf(!POSIX)('probeTool — case 2: stale shim', () => {
    it('GIVEN a resolvable shim whose interpreter path does not exist WHEN probed THEN status is broken and the descriptor fix is present in the result', () => {
        const goneInterpreter = path.join(ROOT, 'no-such-runtime', 'python3');
        const shimPath = stub('stale-shim-backend', `#!${goneInterpreter}\nprint('hi')\n`);
        // The shim itself resolves: it exists and carries the executable bit.
        expect(fs.existsSync(shimPath)).toBe(true);
        expect(fs.existsSync(goneInterpreter)).toBe(false);

        const result = probeTool(
            descriptorFor('stale-shim-backend', {
                fix: 'pipx reinstall stale-shim-backend==1.4.2',
            }),
        );

        expect(result.status).toBe('broken');
        expect(result.path).toBe(shimPath);
        expect(result.fix).toBe('pipx reinstall stale-shim-backend==1.4.2');
        expect(result.diagnostic).toContain('stale shim');
        // Stale shims are never retried — the interpreter will not reappear.
        expect(result.attempts).toBe(1);
    });
});

describe.skipIf(!POSIX)('probeTool — case 3: exit code 127', () => {
    it('GIVEN a resolvable binary whose probe exits 127 WHEN probed THEN status is broken with exit_code 127', () => {
        stub('exit127-backend', '#!/bin/sh\nexit 127\n');

        const result = probeTool(
            descriptorFor('exit127-backend', { fix: 'reinstall exit127-backend' }),
        );

        expect(result.status).toBe('broken');
        expect(result.exit_code).toBe(127);
        expect(result.fix).toBe('reinstall exit127-backend');
        expect(result.attempts).toBe(1);
    });
});

describe.skipIf(!POSIX)('probeTool — case 4: exit code 126', () => {
    it('GIVEN a resolvable binary whose probe exits 126 WHEN probed THEN status is broken with exit_code 126', () => {
        stub('exit126-backend', '#!/bin/sh\nexit 126\n');

        const result = probeTool(descriptorFor('exit126-backend'));

        expect(result.status).toBe('broken');
        expect(result.exit_code).toBe(126);
        expect(result.attempts).toBe(1);
    });
});

describe.skipIf(!POSIX || SLEEP === undefined)('probeTool — case 5: deadline exceeded', () => {
    it('GIVEN a probe that sleeps past the deadline WHEN probed THEN status is timeout AND exactly one retry was attempted', () => {
        // The stub records every invocation in a real counter file, so the
        // attempt count is measured from the outside, not inferred.
        // `sleep` is invoked by absolute path: the fixture PATH deliberately
        // contains only BIN_DIR, so a bare `sleep` would exit 127 and the case
        // would silently test `broken` instead of `timeout`.
        const counter = path.join(ROOT, 'slow-attempts.log');
        stub(
            'slow-backend',
            `#!/bin/sh\nprintf 'x\\n' >> "${counter}"\nexec ${String(SLEEP)} 5\n`,
        );

        const result = probeTool(descriptorFor('slow-backend', { timeout_ms: 250 }));

        expect(result.status).toBe('timeout');
        expect(result.attempts).toBe(2);
        expect(result.timeout_ms).toBe(250);
        const invocations = fs
            .readFileSync(counter, 'utf-8')
            .split('\n')
            .filter((line) => line.trim() !== '');
        // 1 initial attempt + exactly 1 retry. Never 1, never 3.
        expect(invocations).toHaveLength(2);
    });
});

describe.skipIf(!POSIX)('probeTool — case 6: healthy binary', () => {
    it('GIVEN a resolvable binary whose side-effect-free probe exits 0 WHEN probed THEN status is ok with no fix', () => {
        const healthy = stub('healthy-backend', '#!/bin/sh\nexit 0\n');

        const result = probeTool(
            descriptorFor('healthy-backend', { fix: 'never needed' }),
        );

        expect(result.status).toBe('ok');
        expect(result.path).toBe(healthy);
        expect(result.exit_code).toBe(0);
        expect(result.attempts).toBe(1);
        // A prescription is only surfaced when something is wrong.
        expect(result.fix).toBeNull();
    });
});

describe.skipIf(!POSIX)('probeTool — case 7: unexpected throw', () => {
    it('GIVEN a descriptor whose probe args make the spawn throw WHEN probed THEN the function returns an error result instead of propagating', () => {
        stub('throwing-backend', '#!/bin/sh\nexit 0\n');
        // A NUL byte in an arg makes node:child_process throw
        // ERR_INVALID_ARG_VALUE synchronously — a real unexpected throw from
        // inside the probe, no mocking involved.
        const hostile = descriptorFor('throwing-backend', {
            probe_args: ['--version\u0000injected'],
        });

        let result: ToolProbeResult | undefined;
        expect(() => {
            result = probeTool(hostile);
        }).not.toThrow();

        expect(result).toBeDefined();
        expect(result?.status).toBe('error');
        expect(result?.diagnostic).toContain('raised unexpectedly');
    });

    it('GIVEN one hostile descriptor among several WHEN probeTools runs THEN that entry is error and every other backend is still reported', () => {
        stub('healthy-neighbour', '#!/bin/sh\nexit 0\n');

        const results = probeTools([
            descriptorFor('healthy-neighbour'),
            descriptorFor('healthy-neighbour', {
                name: 'hostile',
                probe_args: ['--bad\u0000arg'],
            }),
            descriptorFor('agent-config-absent-backend-xyz', { name: 'absent' }),
        ]);

        expect(results).toHaveLength(3);
        expect(results.map((r) => r.status)).toEqual(['ok', 'error', 'missing']);
    });
});

describe.skipIf(!POSIX)('probeTool — fix prescription resolution', () => {
    it('GIVEN a platform-keyed fix map WHEN the current platform has an entry THEN that string is echoed verbatim', () => {
        const result = probeTool(
            descriptorFor('agent-config-absent-backend-xyz', {
                fix: { [process.platform]: 'platform-specific install', default: 'generic install' },
            }),
        );

        expect(result.status).toBe('missing');
        expect(result.fix).toBe('platform-specific install');
    });

    it('GIVEN a fix map without an entry for the current platform THEN the default entry is echoed', () => {
        const result = probeTool(
            descriptorFor('agent-config-absent-backend-xyz', {
                fix: { 'not-a-real-platform': 'wrong', default: 'generic install' },
            }),
        );

        expect(result.fix).toBe('generic install');
    });

    it('GIVEN no fix at all THEN the result carries null rather than an invented command', () => {
        const result = probeTool(descriptorFor('agent-config-absent-backend-xyz'));

        expect(result.status).toBe('missing');
        expect(result.fix).toBeNull();
    });
});
