/**
 * The `package` arm of an artifact run gets agent-config the way a consumer
 * gets it: the checkout under test is packed once per sweep, and each package
 * run installs that tarball into its own isolated HOME with the public
 * installer — the same command the `bench-ac` container image runs.
 *
 * The earlier path pointed the host at the repository with `--plugin-dir`.
 * That loaded the repository's whole `agents/` tree as subagent definitions
 * (about 370k tokens before the first reply) and fell through to whatever
 * `agent-config` binary was on the operator's PATH for hooks, so it measured
 * neither the package nor anything a user would run.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ArmIsolation } from './bench_artifact_isolation.js';

/** Isolation keys that block the network; the install needs the registry for the package's dependencies. */
const NETWORK_BLOCK_KEYS: readonly string[] = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'http_proxy',
    'https_proxy',
    'ALL_PROXY',
    'NO_PROXY',
    'no_proxy',
    'npm_config_offline',
    'PIP_NO_INDEX',
    'COMPOSER_DISABLE_NETWORK',
];

/** `npm pack` of the checkout into `dest_dir`; returns the tarball path. */
export function pack_package(repo_root: string, dest_dir: string): string {
    fs.mkdirSync(dest_dir, { recursive: true });
    const r = spawnSync('npm', ['pack', '--silent', '--pack-destination', dest_dir], { cwd: repo_root, encoding: 'utf-8' });
    const name = (r.stdout ?? '').trim().split('\n').pop() ?? '';
    if (r.status !== 0 || name === '') throw new Error(`npm pack failed (exit ${r.status}): ${(r.stderr ?? '').trim().slice(0, 300)}`);
    return path.join(dest_dir, name);
}

/**
 * The installer's environment: the caller's, overlaid by the arm's home and
 * config dirs, without the arm's network blackhole (the caller's own proxy
 * settings stand), and with one npm cache shared across the sweep.
 */
export function install_env(base: NodeJS.ProcessEnv, iso_env: Record<string, string>, npm_cache: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(base)) if (typeof v === 'string') out[k] = v;
    for (const [k, v] of Object.entries(iso_env)) if (!NETWORK_BLOCK_KEYS.includes(k)) out[k] = v;
    out['npm_config_cache'] = npm_cache;
    return out;
}

/** Runs the public installer for `tarball` into the arm's HOME. */
export function install_package(iso: ArmIsolation, tarball: string, npm_cache: string): { ok: boolean; reason: string } {
    const r = spawnSync(
        'npx',
        ['-y', `--package=${tarball}`, 'agent-config', 'init', '--yes', '--no-ui', '--offline', '--tools=claude-code'],
        { cwd: iso.home, encoding: 'utf-8', env: install_env(process.env, iso.env, npm_cache), timeout: 300_000 },
    );
    if (r.status === 0) return { ok: true, reason: 'installed' };
    return { ok: false, reason: `install failed (exit ${r.status}): ${(r.stderr ?? '').trim().slice(-300)}` };
}

/** Skill directories carrying a SKILL.md under the arm's config dir. */
export function installed_skill_count(config_dir: string): number {
    const root = path.join(config_dir, 'skills');
    if (!fs.existsSync(root)) return 0;
    return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, 'SKILL.md'))).length;
}

/** A package arm must have the install; a control arm must not. */
export function load_check(is_package: boolean, skills: number): { ok: boolean; reason: string } {
    if (is_package && skills === 0) return { ok: false, reason: 'load_mismatch: package arm has 0 installed skills' };
    if (!is_package && skills > 0) return { ok: false, reason: `load_mismatch: control arm has ${skills} installed skills` };
    return { ok: true, reason: `${skills} installed skills` };
}
