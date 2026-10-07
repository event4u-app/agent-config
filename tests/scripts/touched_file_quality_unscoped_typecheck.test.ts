/**
 * A green row names what did not run
 * (`road-to-touched-file-quality-that-says-when-it-did-not-look` Phase 2).
 *
 * The readings page § 5(b): a real type error in a linted path recorded
 * `exit_code: 0`, because `tsc --noEmit` has no per-file form and is skipped on
 * every turn. The row has to say so itself, so that a reader of ANY single record
 * sees a `0` was a lint verdict and not a type verdict.
 */
import { describe, expect, it } from 'vitest';

import { runTouchedFileQuality } from '../../src/scripts/_lib/touched_file_quality.js';

const okSpawn = () => ({ status: 0, output: '', enoent: false });

describe('2.1 — every record of the turn names the type checker that did not run', () => {
    it('tsc unscoped, eslint green: both rows name tsc', () => {
        const runs = runTouchedFileQuality({
            root: '/nonexistent',
            commands: ['npx tsc --noEmit', 'npx eslint .'],
            files: ['src/a.ts'],
            spawn: okSpawn,
        });
        expect(runs).toHaveLength(2);
        for (const run of runs) {
            expect(run.typecheck_not_run).toEqual(['npx tsc --noEmit']);
        }
        const eslint = runs.find((r) => r.source_command === 'npx eslint .');
        expect(eslint?.exit_code).toBe(0);
    });

    it('a type checker that ran is not named', () => {
        const runs = runTouchedFileQuality({
            root: '/nonexistent',
            commands: ['ruff check', 'mypy .'],
            files: ['a.py'],
            spawn: okSpawn,
        });
        for (const run of runs) expect(run.typecheck_not_run).toEqual([]);
    });

    it('a type checker that was absent is named', () => {
        const runs = runTouchedFileQuality({
            root: '/nonexistent',
            commands: ['ruff check', 'mypy .'],
            files: ['a.py'],
            spawn: (argv) =>
                argv[0] === 'mypy'
                    ? { status: null, output: '', enoent: true }
                    : { status: 0, output: '', enoent: false },
        });
        for (const run of runs) expect(run.typecheck_not_run).toEqual(['mypy .']);
    });

    it('no type checker emitted names nothing', () => {
        const runs = runTouchedFileQuality({
            root: '/nonexistent',
            commands: ['npx eslint .'],
            files: ['src/a.ts'],
            spawn: okSpawn,
        });
        expect(runs[0]?.typecheck_not_run).toEqual([]);
    });
});
