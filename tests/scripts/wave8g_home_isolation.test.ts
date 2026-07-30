// The spawn rig must never hand a child the developer's real global root.
//
// These suites run actual CLIs, and the package now has global write paths (the
// user-memory observation buffer). Before this isolation, a spawned script
// resolved `$HOME` to the developer's home, so wiring any global write into a
// spawned CLI would have written into `~/.event4u/` during a test run. That is
// exactly why the miner's `--commit-intake` global append stayed unwired.
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT, runTs, sandboxHome } from './_wave8g.js';

/** Print the env the child actually sees, using a script that exists in-tree. */
function childEnv(options?: Parameters<typeof runTs>[2]): { home: string; configHome: string } {
    // `--version`-style probes differ per script, so read the env directly with
    // node instead: the point under test is the rig, not any one CLI.
    const r = runTs('../../tests/scripts/_print_env_probe', [], options);
    const parsed = JSON.parse(r.stdout || '{}') as { HOME?: string; EVENT4U_CONFIG_HOME?: string };
    return { home: parsed.HOME ?? '', configHome: parsed.EVENT4U_CONFIG_HOME ?? '' };
}

describe('wave8g spawn rig — HOME isolation', () => {
    it('points a spawned child at the sandbox, not the real home', () => {
        const seen = childEnv();
        expect(seen.home).toBe(sandboxHome());
        expect(seen.home).not.toBe(os.homedir());
        expect(seen.home.startsWith(os.tmpdir())).toBe(true);
    });

    it('scopes EVENT4U_CONFIG_HOME inside the sandbox too', () => {
        const seen = childEnv();
        expect(seen.configHome.startsWith(sandboxHome())).toBe(true);
        // The global user-memory artefacts resolve under this root, so a stray
        // write during a test run lands in the sandbox rather than in `~`.
        expect(seen.configHome).toContain(path.join('.event4u', 'agent-config'));
    });

    it('reuses one sandbox per process so a suite can inspect what its children wrote', () => {
        expect(sandboxHome()).toBe(sandboxHome());
    });

    it('still allows an explicit opt-out, so the dangerous case has to be spelled out', () => {
        const seen = childEnv({ inheritHome: true });
        expect(seen.home).toBe(process.env['HOME'] ?? os.homedir());
    });

    it('resolves the repo root it spawns from', () => {
        expect(REPO_ROOT.length).toBeGreaterThan(0);
    });
});
