/**
 * An unexpected throw while the strategy is read — including the offline probe
 * `strategyGate` runs — is the documented exit 2 with an `internal error` line
 * and a `scanned:` record, never an uncaught exception.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main, type BaseDeps } from '../../src/scripts/sync_pr_branch.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function repo(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-internal-'));
    dirs.push(d);
    execFileSync('git', ['init', '-q', '-b', 'feature', d]);
    return d;
}

function throwingDeps(): BaseDeps {
    return {
        currentBranch: () => 'feature',
        prBase: () => null,
        defaultBranch: () => 'origin/main',
        remoteSha: () => {
            throw new Error('forge exploded');
        },
        readAtSha: () => null,
    };
}

describe('sync_pr_branch — a throw while the strategy is read', () => {
    it('maps to exit 2 with the internal-error line and still records scanned', () => {
        const dir = repo();
        const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        let code: number;
        let stdout = '';
        let stderr = '';
        try {
            code = main(['--repo', dir, '--base', 'origin/main'], throwingDeps());
            stdout = out.mock.calls.map((c) => String(c[0])).join('');
            stderr = err.mock.calls.map((c) => String(c[0])).join('');
        } finally {
            out.mockRestore();
            err.mockRestore();
        }
        expect(code).toBe(2);
        expect(stderr).toContain('internal error: forge exploded');
        expect(stdout).toContain('scanned: 0');
    });
});
