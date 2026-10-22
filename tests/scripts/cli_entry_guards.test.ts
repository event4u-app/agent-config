/**
 * A gate reached through a symlinked or space-carrying path must still run.
 *
 * Its entry guard decides whether `main()` runs at all, and a guard that
 * misses the match exits 0 having checked nothing — a fail-open that looks
 * exactly like a pass. Each gate is invoked through a directory symlink whose
 * name carries a space, and must print something rather than exit silently.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-entry-'));
const linked = path.join(tmp, 'linked scripts');
fs.symlinkSync(path.join(REPO, 'src', 'scripts'), linked);

afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function run(script: string, args: string[]): { status: number | null; out: string } {
    const r = spawnSync(TSX, [path.join(linked, script), ...args], { cwd: REPO, encoding: 'utf-8', timeout: 60_000 });
    return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

describe('entry guards run main() through a symlinked path with a space', () => {
    it('check_account_surface reaches its usage error instead of exiting 0 silently', () => {
        const r = run('check_account_surface.ts', []);
        expect(r.status, r.out).toBe(2);
        expect(r.out).toContain('usage: check_account_surface');
    });

    it('check_permission_deny_syntax runs and prints its reading', () => {
        const r = run('check_permission_deny_syntax.ts', []);
        expect(r.out.trim(), `exit ${String(r.status)}`).not.toBe('');
    });

    it('arrival_report runs and prints its reading', () => {
        const r = run('arrival_report.ts', []);
        expect(r.out).toContain('scanned:');
    });
}, 120_000);
