// The template defaults must reach `git:convention` from the layout it ships in.
//
// The settings layer located the shipped template by counting three `..` from
// its own module. That is right from `src/scripts/_lib/` and wrong from the
// precompiled delegate under `dist/cli-delegate/`, where the module is inlined
// two levels below the root: the template was looked up one directory above
// the package, missed, and every default silently vanished. Without a declared
// pattern `branch --slug export --type feat` then exited 1 from an install
// while printing `feat/export` from a source checkout. The other suites inject
// the defaults, so none of them could see it.
//
// This test bundles the real CLI into a package tree laid out like an install
// and runs it, so the module-level path is exercised exactly as shipped.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { beforeAll, describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from '../../src/scripts/_lib/package_root.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let bundle = '';
let home = '';

beforeAll(async () => {
    const pkg = fs.mkdtempSync(path.join(os.tmpdir(), 'gitconv-bundle-'));
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: PACKAGE_NAME, type: 'module' }));
    fs.mkdirSync(path.join(pkg, 'src', 'config'), { recursive: true });
    fs.copyFileSync(
        path.join(REPO, 'src', 'config', 'agent-settings.template.yml'),
        path.join(pkg, 'src', 'config', 'agent-settings.template.yml'),
    );
    // `yaml` is loaded through `createRequire` at runtime, as in an install.
    fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(pkg, 'node_modules'), 'dir');
    bundle = path.join(pkg, 'dist', 'cli-delegate', 'cmd_git_convention.js');
    await build({
        entryPoints: [path.join(REPO, 'src', 'scripts', '_cli', 'cmd_git_convention.ts')],
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node20',
        outfile: bundle,
        define: { __AGENT_CONFIG_BUNDLE__: 'true', __AGENT_CONFIG_CLI_DELEGATE__: 'true' },
        banner: {
            js: "import { createRequire as __acCreateRequire } from 'node:module'; const require = globalThis.require ?? __acCreateRequire(import.meta.url);",
        },
        logLevel: 'silent',
    });
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'gitconv-home-'));
}, 120_000);

function repo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitconv-repo-'));
    spawnSync('git', ['init', '-q', '-b', 'main', dir]);
    return dir;
}

describe('git:convention from the bundled delegate layout', () => {
    it('renders a branch from the template default pattern when nothing is declared', () => {
        const r = spawnSync('node', [bundle, 'branch', '--slug', 'export', '--type', 'feat'], {
            cwd: repo(),
            encoding: 'utf-8',
            env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: '/dev/null' },
            timeout: 60_000,
        });
        expect(`${r.stdout}${r.stderr}`).not.toMatch(/absent/);
        expect(r.stdout.trim()).toBe('feat/export');
        expect(r.status).toBe(0);
    }, 90_000);

    it('lets an approved card win over a developer file holding only the template default', () => {
        const dir = repo();
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), 'git:\n  commit_format: ticket-scope\n');
        const card = path.join(dir, 'agents', 'memory', 'curated', 'conventions', 'approved');
        fs.mkdirSync(card, { recursive: true });
        fs.writeFileSync(path.join(card, 'commit-subject.md'), '---\ndominant_family: ticket-prefix\n---\n');
        const r = spawnSync('node', [bundle, 'subject'], {
            cwd: dir,
            input: '[DEV-1] add x\n',
            encoding: 'utf-8',
            env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: '/dev/null' },
            timeout: 60_000,
        });
        expect(r.stdout).toContain('approved family ticket-prefix');
        expect(r.status).toBe(0);
    }, 90_000);
});
