/**
 * `RELEASE_E2E_ONLY` in tests/test_release_install_e2e.sh must refuse a
 * selection that names no known section, or names one plus a typo, BEFORE the
 * script packs, fetches or installs anything. A selector that ignored the typo
 * would run fewer sections than asked and still report green.
 *
 * `npm` and `tar` are shadowed by stubs that record each call, so "before any
 * download or install work" is observed rather than inferred from timing.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = path.join(process.cwd(), 'tests', 'test_release_install_e2e.sh');

let stubDir = '';
let callLog = '';

beforeAll(() => {
    stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-e2e-selector-'));
    callLog = path.join(stubDir, 'calls.log');
    for (const tool of ['npm', 'tar']) {
        const stub = path.join(stubDir, tool);
        fs.writeFileSync(stub, `#!/bin/sh\necho "${tool} $*" >> "${callLog}"\nexit 1\n`);
        fs.chmodSync(stub, 0o755);
    }
});

afterAll(() => {
    fs.rmSync(stubDir, { recursive: true, force: true });
});

function runWith(only: string) {
    fs.rmSync(callLog, { force: true });
    const env: NodeJS.ProcessEnv = { ...process.env, RELEASE_E2E_ONLY: only, PATH: `${stubDir}${path.delimiter}${process.env.PATH ?? ''}` };
    delete env.RELEASE_TARBALL;
    delete env.BASELINE_TARBALL;
    const r = spawnSync('bash', [SCRIPT], { env, encoding: 'utf8', timeout: 60_000 });
    const calls = fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8') : '';
    return { status: r.status, stderr: r.stderr, calls };
}

describe('RELEASE_E2E_ONLY selector', () => {
    for (const only of ['unknown', ',', 'consumer-ci-settle,typo']) {
        it(`refuses ${JSON.stringify(only)} before any pack or install`, () => {
            const r = runWith(only);
            expect(r.calls, 'npm/tar ran before the selector refused').toBe('');
            expect(r.status).not.toBe(0);
            expect(r.stderr).toContain('RELEASE_E2E_ONLY');
        });
    }
});
