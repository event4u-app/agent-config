/**
 * The isolation contract for an artifact run.
 *
 * The runner passes `bypassPermissions`, and an artifact task invites installs
 * and browsers, so each arm gets its own temp HOME, its own host config dir and
 * a workspace outside the repository. A workspace under the repo would also
 * let the host discover this package's own CLAUDE.md / AGENTS.md walking up
 * from the cwd — the leak that once made `vanilla` ≈ `package`.
 *
 * `network: none` is enforced at two layers: the host gets the web tools
 * disallowed, and every child process inherits a proxy pointing at a closed
 * local port plus npm/pip offline switches. `registry` lifts only the package
 * manager layer; the web tools stay off for both modes. Neither layer is a
 * kernel sandbox — a process that ignores proxy variables still reaches the
 * network — so the bound is stated, not implied.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { NetworkMode } from './bench_artifact_corpus.js';

export interface ArmIsolation {
    arm: string;
    root: string;
    home: string;
    config_dir: string;
    workspace: string;
    network: NetworkMode;
    env: Record<string, string>;
    /** Host flags the network mode adds (web tools off). */
    host_flags: string[];
}

/** A port nothing listens on: connections are refused at once instead of hanging. */
export const BLACKHOLE_PROXY = 'http://127.0.0.1:9';

function is_inside(child: string, parent: string): boolean {
    const rel = path.relative(fs.realpathSync(parent), fs.realpathSync(child));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function network_env(network: NetworkMode): Record<string, string> {
    if (network === 'registry') return { npm_config_offline: 'false' };
    return {
        HTTP_PROXY: BLACKHOLE_PROXY,
        HTTPS_PROXY: BLACKHOLE_PROXY,
        http_proxy: BLACKHOLE_PROXY,
        https_proxy: BLACKHOLE_PROXY,
        ALL_PROXY: BLACKHOLE_PROXY,
        NO_PROXY: '',
        npm_config_offline: 'true',
        PIP_NO_INDEX: '1',
        COMPOSER_DISABLE_NETWORK: '1',
    };
}

/**
 * Create the per-arm directories and the environment that points at them.
 * Throws if any of them resolves inside `repo_root` (a `TMPDIR` under the repo
 * would otherwise defeat the contract silently).
 */
export function isolate_arm(
    arm: string,
    task_id: string,
    network: NetworkMode,
    opts: { repo_root: string; tmp_root?: string },
): ArmIsolation {
    const base = opts.tmp_root ?? os.tmpdir();
    const safe = `${task_id}-${arm}`.replace(/[^A-Za-z0-9._-]/g, '_');
    const root = fs.mkdtempSync(path.join(base, `bench-art-${safe}-`));
    const home = path.join(root, 'home');
    const config_dir = path.join(home, '.claude');
    const workspace = path.join(root, 'workspace');
    for (const d of [home, config_dir, workspace]) fs.mkdirSync(d, { recursive: true });
    for (const d of [root, home, config_dir, workspace]) {
        if (is_inside(d, opts.repo_root)) {
            fs.rmSync(root, { recursive: true, force: true });
            throw new Error(`isolation: ${d} lies inside the repository ${opts.repo_root}`);
        }
    }
    const env: Record<string, string> = {
        HOME: home,
        USERPROFILE: home,
        XDG_CONFIG_HOME: path.join(home, '.config'),
        XDG_CACHE_HOME: path.join(home, '.cache'),
        CLAUDE_CONFIG_DIR: config_dir,
        TMPDIR: path.join(root, 'tmp'),
        ...network_env(network),
    };
    fs.mkdirSync(env['TMPDIR'] as string, { recursive: true });
    return { arm, root, home, config_dir, workspace, network, env, host_flags: ['--disallowedTools', 'WebFetch,WebSearch'] };
}

/** Copy a task fixture into the isolated workspace (byte-identical across arms). */
export function seed_workspace(iso: ArmIsolation, fixture_dir: string): void {
    fs.cpSync(fixture_dir, iso.workspace, { recursive: true });
}

export function dispose(iso: ArmIsolation): void {
    fs.rmSync(iso.root, { recursive: true, force: true });
}
