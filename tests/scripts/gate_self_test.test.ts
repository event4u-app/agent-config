import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_CANNOT_RUN,
    HARNESS_ERROR,
    judgeCase,
    lastGateCliOutput,
    runGateCli,
    runSelfTest,
} from '../../src/scripts/_lib/gate_self_test.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function fixtureScript(body: string): { dir: string; rel: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-self-test-'));
    const file = path.join(dir, 'gate.ts');
    fs.writeFileSync(file, body);
    return { dir, rel: path.relative(REPO_ROOT, file) };
}

describe('judgeCase — a reject names its catch', () => {
    it('a harness error is never a catch, whatever the expectation', () => {
        for (const polarity of ['reject', 'accept', 'refuse'] as const) {
            expect(judgeCase({ expect: polarity }, HARNESS_ERROR, undefined, null)).toMatch(/harness error/);
        }
    });

    it('without a dialect any non-zero exit is a reject (back-compat)', () => {
        expect(judgeCase({ expect: 'reject' }, 1, undefined, null)).toBeNull();
        expect(judgeCase({ expect: 'reject' }, 2, undefined, null)).toBeNull();
        expect(judgeCase({ expect: 'reject' }, 0, undefined, null)).not.toBeNull();
    });

    it('with a dialect a reject must exit with the declared finding code', () => {
        const dialect = { finding: 1, cannot_run: 2 };
        expect(judgeCase({ expect: 'reject' }, 1, dialect, null)).toBeNull();
        // The usage branch firing on a reject fixture is no longer a catch.
        expect(judgeCase({ expect: 'reject' }, 2, dialect, null)).toMatch(/expected reject, got exit 2/);
    });

    it('a refuse case expects cannot_run — declared, or the default', () => {
        expect(judgeCase({ expect: 'refuse' }, DEFAULT_CANNOT_RUN, undefined, null)).toBeNull();
        expect(judgeCase({ expect: 'refuse' }, 1, undefined, null)).not.toBeNull();
        expect(judgeCase({ expect: 'refuse' }, 3, { finding: 1, cannot_run: 3 }, null)).toBeNull();
    });

    it('names must match the captured output', () => {
        const c = { expect: 'reject' as const, names: /missing intent for GT-7/ };
        expect(judgeCase(c, 1, undefined, '❌ missing intent for GT-7')).toBeNull();
        expect(judgeCase(c, 1, undefined, '❌ something else broke')).toMatch(/did not name its catch/);
        expect(judgeCase(c, 1, undefined, null)).toMatch(/no gate output captured/);
    });

    it('accept is unchanged', () => {
        expect(judgeCase({ expect: 'accept' }, 0, undefined, null)).toBeNull();
        expect(judgeCase({ expect: 'accept' }, 1, undefined, null)).not.toBeNull();
    });
});

describe('runGateCli — a killed child is a harness error', () => {
    it('returns HARNESS_ERROR when the child dies on a signal', () => {
        const { dir, rel } = fixtureScript("process.kill(process.pid, 'SIGKILL');\n");
        try {
            expect(runGateCli(REPO_ROOT, rel, [], dir)).toBe(HARNESS_ERROR);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('captures the output a names assertion reads', () => {
        const { dir, rel } = fixtureScript("process.stderr.write('found: X1\\n'); process.exit(1);\n");
        try {
            expect(runGateCli(REPO_ROOT, rel, [], dir)).toBe(1);
            expect(lastGateCliOutput()).toContain('found: X1');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('a self-test whose reject fixture crashes is red, not green', () => {
        const { dir, rel } = fixtureScript("process.kill(process.pid, 'SIGKILL');\n");
        const out: string[] = [];
        try {
            const code = runSelfTest({
                gate: 'fixture',
                minCases: 1,
                cases: [{ name: 'crash', expect: 'reject', run: () => runGateCli(REPO_ROOT, rel, [], dir) }],
                write: (c) => out.push(String(c)),
            });
            expect(code).toBe(1);
            expect(out.join('')).toMatch(/harness error/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('judgeCase — an uncaught crash is never a catch', () => {
    it('a reject case whose gate died on a module-resolution error is a harness error', () => {
        const out = "Error: Cannot find module './_lib/x.js'\n    at foo (node:internal)\n\nNode.js v22.11.0\n";
        expect(judgeCase({ expect: 'reject' }, 1, undefined, out)).toMatch(/uncaught exception/);
    });
    it('a gate that reports a finding and exits 1 is still a catch', () => {
        expect(judgeCase({ expect: 'reject' }, 1, undefined, '❌ finding: X\n')).toBeNull();
    });
});
