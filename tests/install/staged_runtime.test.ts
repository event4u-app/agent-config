// road-to-a-hook-carrier-that-is-never-silent 1.1 / 1.2: the runtime the hook
// carrier and the stub pointers need is staged under the machine root, so an
// install made from an `npx` cache keeps working after the package manager
// clears that cache, and an interrupted upgrade never leaves pointers resolving
// into a half-written stage.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CLAUDE_LAYER_DIRNAME,
    currentRuntimeDir,
    stageRuntime,
} from '../../src/install/stagedRuntime.js';

let tmp: string;

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'staged-runtime-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

function write(p: string, body: string): void {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
}

/** An npx-shaped package root: `<cache>/_npx/<hash>/node_modules/@event4u/agent-config`. */
function npxPackage(version: string): string {
    const root = path.join(tmp, 'npm-cache', '_npx', '4297e1a784ff86d4', 'node_modules', '@event4u', 'agent-config');
    write(path.join(root, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version }));
    write(path.join(root, 'dist', 'hooks', 'dispatch.js'), `// dispatcher ${version}\n`);
    write(path.join(root, 'dist', 'agent-src', 'rules', 'alpha.md'), `# alpha ${version}\n`);
    write(path.join(root, 'dist', 'agent-src', 'guidelines', 'g.md'), '# g\n');
    write(path.join(root, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
    write(path.join(root, 'src', 'config', 'x.json'), '{}\n');
    return root;
}

describe('stageRuntime — a root the package owns (1.1)', () => {
    it('pointers and the dispatcher still resolve after the npx cache is deleted', () => {
        const pkg = npxPackage('1.0.0');
        const runtime = path.join(tmp, 'machine', 'runtime');
        const res = stageRuntime({ packageRoot: pkg, runtimeRoot: runtime, nodePath: process.execPath });
        rmSync(path.join(tmp, 'npm-cache'), { recursive: true, force: true });

        const current = currentRuntimeDir(runtime);
        expect(res.currentDir).toBe(current);
        expect(readFileSync(path.join(current, 'dist', 'hooks', 'dispatch.js'), 'utf8')).toContain('1.0.0');
        expect(readFileSync(path.join(current, 'dist', 'agent-src', 'rules', 'alpha.md'), 'utf8')).toContain('1.0.0');
        expect(existsSync(path.join(current, 'dist', 'agent-src', 'guidelines', 'g.md'))).toBe(true);
        expect(existsSync(path.join(current, 'src', 'scripts', 'hook_manifest.yaml'))).toBe(true);
        expect(readFileSync(path.join(current, 'node'), 'utf8').trim()).toBe(process.execPath);
        expect(res.version).toBe('1.0.0');
        expect(res.dispatcher).toBe(true);
    });

    it('snapshots only the stamped files of the installed claude layer', () => {
        const pkg = npxPackage('1.0.0');
        const layer = path.join(tmp, 'claude', 'rules');
        write(path.join(layer, 'owned.md'), '---\npackage: event4u/agent-config\n---\n# owned full body\n');
        write(path.join(layer, 'foreign.md'), '---\nname: mine\n---\n# a user rule\n');
        const runtime = path.join(tmp, 'machine', 'runtime');
        stageRuntime({ packageRoot: pkg, runtimeRoot: runtime, nodePath: process.execPath, claudeRulesDir: layer });
        const snap = path.join(currentRuntimeDir(runtime), CLAUDE_LAYER_DIRNAME);
        expect(readdirSync(snap).sort()).toEqual(['owned.md']);
        expect(readFileSync(path.join(snap, 'owned.md'), 'utf8')).toContain('owned full body');
    });
});

describe('stageRuntime — what the real bundle reads', () => {
    it('stages the data tables beside the bundle and the one dependency it resolves at run time, and no source', () => {
        const repo = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
        const runtime = path.join(tmp, 'machine', 'runtime');
        stageRuntime({ packageRoot: repo, runtimeRoot: runtime, nodePath: process.execPath });
        const current = currentRuntimeDir(runtime);
        expect(existsSync(path.join(current, 'src', 'scripts', 'hook_manifest.yaml'))).toBe(true);
        expect(existsSync(path.join(current, 'src', 'scripts', 'hooks', 'host_lowering.yaml'))).toBe(true);
        expect(existsSync(path.join(current, 'node_modules', 'yaml', 'package.json'))).toBe(true);
        expect(existsSync(path.join(current, 'src', 'scripts', 'install.ts'))).toBe(false);
    }, 60_000);
});

describe('stageRuntime — one version on disk (1.2)', () => {
    it('an interrupted stage leaves the previous version resolvable, and the next stage leaves one version', () => {
        const runtime = path.join(tmp, 'machine', 'runtime');
        stageRuntime({ packageRoot: npxPackage('1.0.0'), runtimeRoot: runtime, nodePath: process.execPath });

        const v2 = npxPackage('2.0.0');
        expect(() =>
            stageRuntime({ packageRoot: v2, runtimeRoot: runtime, nodePath: process.execPath, _failAfterEntries: 2 }),
        ).toThrow(/injected/);
        const current = currentRuntimeDir(runtime);
        expect(readFileSync(path.join(current, 'dist', 'hooks', 'dispatch.js'), 'utf8')).toContain('1.0.0');
        expect(readFileSync(path.join(current, 'dist', 'agent-src', 'rules', 'alpha.md'), 'utf8')).toContain('1.0.0');

        stageRuntime({ packageRoot: v2, runtimeRoot: runtime, nodePath: process.execPath });
        expect(readFileSync(path.join(current, 'dist', 'hooks', 'dispatch.js'), 'utf8')).toContain('2.0.0');
        const entries = readdirSync(runtime).filter((e) => e !== 'current');
        expect(entries.filter((e) => e.startsWith('v-'))).toHaveLength(1);
        expect(entries.filter((e) => e.startsWith('.stage-') || e.startsWith('.current-'))).toEqual([]);
    });
});
