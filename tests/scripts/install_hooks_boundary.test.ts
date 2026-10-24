/**
 * The development git hooks run `./agent-config`, `./scripts-run`, `task` and
 * `npm` from the checkout. That is this package's development trust model and
 * nobody else's: run from a consumer's `node_modules`, the installer would
 * resolve the CONSUMER's git directory and install these hooks there
 * (road-to-code-graph-refresh-follow-ups 3.1).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INSTALLER = path.join(REPO_ROOT, 'src', 'scripts', 'install-hooks.sh');

let tmp: string;
afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

function consumerWithPackageInside(name: string): { consumer: string; installer: string } {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-boundary-')));
    const consumer = path.join(tmp, 'consumer');
    fs.mkdirSync(consumer);
    spawnSync('git', ['-C', consumer, 'init', '-q']);
    const pkg = path.join(consumer, 'node_modules', '@event4u', 'agent-config');
    fs.mkdirSync(path.join(pkg, 'src', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name }));
    const installer = path.join(pkg, 'src', 'scripts', 'install-hooks.sh');
    fs.copyFileSync(INSTALLER, installer);
    return { consumer, installer };
}

describe('install-hooks.sh installs only into this package’s own checkout', () => {
    it('refuses when run from a consumer’s node_modules, and writes no hook', () => {
        const { consumer, installer } = consumerWithPackageInside('@event4u/agent-config');
        const r = spawnSync('bash', [installer], { cwd: consumer, encoding: 'utf-8' });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/refusing to install/);
        const hooks = path.join(consumer, '.git', 'hooks');
        const written = fs.readdirSync(hooks).filter((f) => !f.endsWith('.sample'));
        expect(written).toEqual([]);
    });

    it('refuses a checkout that is not this package', () => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-boundary-')));
        spawnSync('git', ['-C', tmp, 'init', '-q']);
        fs.mkdirSync(path.join(tmp, 'src', 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'someone-else' }));
        const installer = path.join(tmp, 'src', 'scripts', 'install-hooks.sh');
        fs.copyFileSync(INSTALLER, installer);
        const stage = path.join(tmp, 'stage');
        const r = spawnSync('bash', [installer], {
            cwd: tmp,
            encoding: 'utf-8',
            env: { ...process.env, AGENT_CONFIG_HOOKS_DIR: stage },
        });
        expect(r.status).not.toBe(0);
        expect(fs.existsSync(path.join(stage, 'post-commit'))).toBe(false);
    });

    it('installs from this checkout (rendered through the inspection seam)', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-boundary-'));
        const r = spawnSync('bash', [INSTALLER], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            env: { ...process.env, AGENT_CONFIG_HOOKS_DIR: tmp },
        });
        expect(r.status, r.stderr).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'post-commit'))).toBe(true);
    }, 120_000);
});
