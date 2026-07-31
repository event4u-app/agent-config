/**
 * The npm-resolution failure the quickstart used to document inline
 * (road-to-zero-ceremony-install § Phase 2).
 *
 * The failure: a consumer whose `.npmrc` sets `prefer-offline=true`, or who
 * resolves through a lagging registry mirror, gets
 * `ETARGET — No matching version found for <dep>` when one of our runtime
 * floors names a version their cached metadata does not know yet.
 *
 * Where it happens matters, and it is the reason this file contains a gate
 * rather than a retry: `dependencies` are resolved by **npm on the consumer's
 * machine, before our `bin` is executed**. When resolution fails, npx aborts
 * and no code of ours runs — there is no process in which to detect the error,
 * retry with fresh metadata, or print a one-line remedy. The only place the
 * failure can be addressed is at publish time, by never shipping a floor that
 * a lagging mirror cannot satisfy.
 *
 * So the assertions below are unreachability assertions, not recovery ones.
 * The live reproduction against the real registry is opt-in
 * (`AGENT_CONFIG_NET_TESTS=1`) so the default suite stays hermetic.
 */
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { evaluate } from '../../src/scripts/check_dependency_floors.js';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
) as { dependencies?: Record<string, string> };

const tmps: string[] = [];
afterEach(() => {
    while (tmps.length > 0) {
        const dir = tmps.pop();
        if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
    }
});

/** A consumer project with `prefer-offline=true` and one dependency floor. */
function consumerProject(dependencies: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-resolution-'));
    tmps.push(dir);
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'consumer-probe', version: '1.0.0', private: true, dependencies }),
    );
    fs.writeFileSync(path.join(dir, '.npmrc'), 'prefer-offline=true\n');
    return dir;
}

describe('npm resolution — the ETARGET failure mode', () => {
    it('the shipped manifest cannot produce it: every floor is satisfiable by a lagging mirror', () => {
        expect(evaluate(MANIFEST.dependencies ?? {})).toEqual([]);
    });

    it('the counterfactual is caught: a freshest-patch floor would reintroduce it', () => {
        // The exact shape CONTRIBUTING warns about — `execa@^9.6.1` pinned the
        // day 9.6.1 ships, against a mirror that still only knows 9.6.0.
        expect(evaluate({ ...(MANIFEST.dependencies ?? {}), execa: '^9.6.1' })).toHaveLength(1);
    });

    it('a consumer project with prefer-offline is a valid reproduction fixture', () => {
        const dir = consumerProject({ execa: '^9.5.0' });
        expect(fs.readFileSync(path.join(dir, '.npmrc'), 'utf-8')).toContain('prefer-offline=true');
        expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    it.runIf(process.env['AGENT_CONFIG_NET_TESTS'] === '1')(
        'live: an unsatisfiable floor fails with ETARGET before any package code runs',
        async () => {
            const dir = consumerProject({ execa: '^99.9.1' });
            let stderr = '';
            try {
                await execFileAsync('npm', ['install', '--dry-run', '--no-audit', '--no-fund'], { cwd: dir });
                throw new Error('expected npm install to fail with ETARGET');
            } catch (err) {
                stderr = String((err as { stderr?: string }).stderr ?? err);
            }
            expect(stderr).toContain('ETARGET');
            expect(stderr).toContain('No matching version found');
        },
        120_000,
    );
});
