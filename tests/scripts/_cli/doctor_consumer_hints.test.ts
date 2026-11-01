/**
 * `doctor` fix hints name commands a consumer can run.
 *
 * The 2026-11-01 newcomer walkthrough, on a packed release with a global
 * install: `memory-merge-union` told the user to run
 * `npx tsx src/scripts/sync_gitattributes.ts` (a maintainer path), and three
 * skipped checks told a global-only user to run `agent-config init` "to create
 * a project lockfile" — contradicting the site's "installs once into your
 * user-level configuration, not into your repository".
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _check_bridge_drift_no_manifest, _skipped_manifest_check, main } from '../../../src/scripts/_cli/cmd_doctor.js';
import { runInProc } from '../../_lib/run_in_process.js';

const MAINTAINER_PATH = /npx tsx|src\/scripts\/|agents\/templates\//;

let project: string;
beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-hints-'));
});
afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
});

describe('manifest-only checks on a global install', () => {
    for (const id of ['manifest-integrity', 'lockfile-freshness', 'unsupported-combos']) {
        it(`${id}: no project-init fix for a global install`, () => {
            const row = _skipped_manifest_check(id, true);
            expect(row['status']).toBe('skipped');
            expect(row['remedy']).toBe('');
            expect(String(row['message'])).toMatch(/project install/);
        });
    }

    it('with nothing installed, init is still the fix', () => {
        expect(String(_skipped_manifest_check('manifest-integrity', false)['remedy'])).toContain('agent-config init');
    });

    it('bridge-drift: no project-init fix for a global install', () => {
        const row = _check_bridge_drift_no_manifest(false, true);
        expect(row['remedy']).toBe('');
    });
});

describe('memory-merge-union', () => {
    function check(): string {
        return runInProc(main, ['--check', 'memory-merge-union', '--project', project], { cwd: project }).stdout;
    }

    it('names a consumer command when memory files exist and the block is missing', () => {
        fs.mkdirSync(path.join(project, 'agents', 'memory'), { recursive: true });
        const out = check();
        expect(out).toContain('agent-config refresh --project');
        expect(out).not.toMatch(MAINTAINER_PATH);
    });

    it('is not a warning in a project with no agent memory', () => {
        const out = check();
        expect(out).not.toContain('⚠️');
        expect(out).not.toMatch(MAINTAINER_PATH);
    });
});
