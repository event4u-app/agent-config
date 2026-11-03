/**
 * Compile cache for the per-event entries
 * (road-to-a-fleet-that-pays-less-per-event step 1.2).
 *
 * `dispatch_entry` and the MCP server entry ask node for its on-disk compile
 * cache under the user-global runtime dir, and never fail because of it.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    compileCacheDir,
    enableCompileCacheFailOpen,
} from '../../src/scripts/_lib/compile_cache.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const tmp_dirs: string[] = [];
afterEach(() => {
    while (tmp_dirs.length > 0) fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
});

function tmpHome(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compile-cache-home-'));
    tmp_dirs.push(dir);
    return dir;
}

describe('enableCompileCacheFailOpen', () => {
    it('asks for the cache under <user-global root>/runtime/compile-cache', () => {
        const home = tmpHome();
        const seen: (string | undefined)[] = [];
        const ok = enableCompileCacheFailOpen(
            { EVENT4U_CONFIG_HOME: home },
            { enableCompileCache: (dir) => seen.push(dir) },
        );
        expect(ok).toBe(true);
        expect(seen).toEqual([path.join(home, 'runtime', 'compile-cache')]);
        expect(compileCacheDir({ EVENT4U_CONFIG_HOME: home })).toBe(seen[0]);
    });

    it('fails open when the node build lacks the API', () => {
        expect(enableCompileCacheFailOpen({ EVENT4U_CONFIG_HOME: tmpHome() }, {})).toBe(false);
    });

    it('fails open when the API throws', () => {
        const api = {
            enableCompileCache: (): never => {
                throw new Error('EACCES');
            },
        };
        expect(enableCompileCacheFailOpen({ EVENT4U_CONFIG_HOME: tmpHome() }, api)).toBe(false);
    });

    it('with the real node API, writes the cache directory in a child process', () => {
        const home = tmpHome();
        const script =
            `import { enableCompileCacheFailOpen } from ${JSON.stringify(path.join(REPO_ROOT, 'src/scripts/_lib/compile_cache.ts'))};` +
            `process.stdout.write(String(enableCompileCacheFailOpen()));`;
        const env: NodeJS.ProcessEnv = { ...process.env, EVENT4U_CONFIG_HOME: home };
        delete env['NODE_DISABLE_COMPILE_CACHE'];
        delete env['NODE_COMPILE_CACHE'];
        const r = spawnSync(TSX, ['-e', script], { cwd: REPO_ROOT, env, encoding: 'utf8' });
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('true');
        expect(fs.existsSync(path.join(home, 'runtime', 'compile-cache'))).toBe(true);
    });
});

describe('the per-event entries enable it', () => {
    it.each([
        'src/scripts/hooks/dispatch_entry.ts',
        'src/scripts/mcp_server/__main__.ts',
    ])('%s calls enableCompileCacheFailOpen', (rel) => {
        const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
        expect(src).toMatch(/import \{[^}]*enableCompileCacheFailOpen[^}]*\} from '\.\.\/_lib\/compile_cache\.js'/);
        expect(src).toMatch(/enableCompileCacheFailOpen\(\)/);
    });

    it('dispatch_entry main opens a per-dispatch snapshot scope', () => {
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/hooks/dispatch_entry.ts'), 'utf8');
        expect(src).toMatch(/withDispatchSnapshotScope\(/);
    });
});
