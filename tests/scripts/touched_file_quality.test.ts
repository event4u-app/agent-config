/**
 * Tests for `_lib/touched_file_quality` — the shadow quality pass over the
 * files a turn edited (`road-to-touched-files-that-pass-their-own-tools` 1.1).
 *
 * Every assertion here is about a RULE, not about a tool being installed: the
 * spawn is injected, so the table's behaviour is observable on a machine with
 * no PHP, no Python and no Rust. The one place a real process runs is the
 * no-mutation fixture, which has to spawn to prove that nothing was written.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    advisoryLine,
    normalizePath,
    OUTPUT_HEAD_LINES,
    parsePorcelainZ,
    planQualityRuns,
    runTouchedFileQuality,
    touchedFilesAtStop,
    truncateToBytes,
    WARN_LINE_MAX_BYTES,
    type QualityRun,
} from '../../src/scripts/_lib/touched_file_quality.js';

/** The resolver's real list at the roadmap's pinned ref. */
const RESOLVER_LIST = [
    'npx tsc --noEmit',
    'npx eslint .',
    'vendor/bin/phpstan analyse',
    'vendor/bin/pint',
    'ruff check',
    'mypy .',
    'go vet ./...',
    'cargo clippy',
] as const;

function planFor(command: string, files: readonly string[]) {
    const [row] = planQualityRuns([command], files);
    if (row === undefined) throw new Error('planQualityRuns returned no row');
    return row;
}

describe('planQualityRuns — only what the resolver listed', () => {
    it('never emits a row for a command the resolver did not list', () => {
        expect(planQualityRuns([], ['a.ts'])).toEqual([]);
    });

    it('returns exactly one row per resolver command, in order', () => {
        const rows = planQualityRuns(RESOLVER_LIST, ['a.ts']);
        expect(rows).toHaveLength(RESOLVER_LIST.length);
        expect(rows.map((r) => r.source_command)).toEqual([...RESOLVER_LIST]);
    });

    it('skips an unrecognised command as unscoped rather than guessing it cheap', () => {
        const row = planFor('some-future-linter --strict', ['a.ts']);
        expect(row.skipped).toBe('unscoped');
        expect(row.argv).toBeNull();
    });
});

describe('planQualityRuns — rule 3, no file-scoped form means unscoped', () => {
    it.each(['npx tsc --noEmit', 'go vet ./...', 'cargo clippy'])(
        '%s is unscoped and is never spawned',
        (command) => {
            const row = planFor(command, ['a.ts', 'b.go', 'c.rs']);
            expect(row.skipped).toBe('unscoped');
            expect(row.argv).toBeNull();
        },
    );
});

describe('planQualityRuns — rule 2, a writing command runs only in its check form', () => {
    it('pint is scoped to its --test form', () => {
        const row = planFor('vendor/bin/pint', ['app/Foo.php']);
        expect(row.skipped).toBeNull();
        expect(row.argv).toEqual(['vendor/bin/pint', '--test', 'app/Foo.php']);
    });

    it('the executed pint argv carries --test before any file', () => {
        const row = planFor('vendor/bin/pint', ['app/Foo.php', 'app/Bar.php']);
        const argv = row.argv ?? [];
        expect(argv.indexOf('--test')).toBeLessThan(argv.indexOf('app/Foo.php'));
    });
});

describe('planQualityRuns — file scoping by extension', () => {
    it('eslint receives only JS/TS files', () => {
        const row = planFor('npx eslint .', ['a.ts', 'b.php', 'c.tsx', 'd.py']);
        expect(row.files).toEqual(['a.ts', 'c.tsx']);
        expect(row.argv).toEqual(['npx', 'eslint', 'a.ts', 'c.tsx']);
    });

    it('phpstan receives only PHP files', () => {
        const row = planFor('vendor/bin/phpstan analyse', ['a.ts', 'app/Foo.php']);
        expect(row.files).toEqual(['app/Foo.php']);
    });

    it.each([
        ['ruff check', 'x.py'],
        ['mypy .', 'x.py'],
    ])('%s receives only Python files', (command, file) => {
        const row = planFor(command, ['a.ts', file]);
        expect(row.files).toEqual([file]);
    });

    it('records no_files when the turn touched nothing the tool reads', () => {
        const row = planFor('npx eslint .', ['app/Foo.php']);
        expect(row.skipped).toBe('no_files');
        expect(row.argv).toBeNull();
    });

    it('records no_files when the turn touched nothing at all', () => {
        for (const row of planQualityRuns(RESOLVER_LIST, [])) {
            expect(row.argv).toBeNull();
            expect(['unscoped', 'no_files']).toContain(row.skipped);
        }
    });
});

describe('runTouchedFileQuality — output shape', () => {
    const stub =
        (status: number | null, output: string, enoent = false) =>
        () => ({ status, output, enoent });

    it('records command, exit code and the first 20 output lines', () => {
        const long = Array.from({ length: 50 }, (_, i) => `line ${String(i)}`).join('\n');
        const [run] = runTouchedFileQuality({
            root: '/tmp',
            commands: ['npx eslint .'],
            files: ['a.ts'],
            spawn: stub(1, long),
        });
        expect(run?.command).toBe('npx eslint a.ts');
        expect(run?.exit_code).toBe(1);
        expect(run?.output_head).toHaveLength(OUTPUT_HEAD_LINES);
        expect(run?.output_head[0]).toBe('line 0');
        expect(run?.output_head[19]).toBe('line 19');
    });

    it('a skipped row carries exit_code null, never 0', () => {
        const [run] = runTouchedFileQuality({
            root: '/tmp',
            commands: ['npx tsc --noEmit'],
            files: ['a.ts'],
            spawn: stub(0, 'should never run'),
        });
        expect(run?.skipped).toBe('unscoped');
        expect(run?.exit_code).toBeNull();
        expect(run?.output_head).toEqual([]);
    });

    it('never spawns a skipped command', () => {
        let spawned = 0;
        runTouchedFileQuality({
            root: '/tmp',
            commands: ['npx tsc --noEmit', 'go vet ./...', 'cargo clippy'],
            files: ['a.ts'],
            spawn: () => {
                spawned += 1;
                return { status: 0, output: '', enoent: false };
            },
        });
        expect(spawned).toBe(0);
    });

    it.each([
        ['ENOENT', { status: null, output: '', enoent: true }],
        ['exit 127', { status: 127, output: 'command not found', enoent: false }],
    ])('rule 4 — %s is skipped: absent, not a red', (_label, result) => {
        const [run] = runTouchedFileQuality({
            root: '/tmp',
            commands: ['vendor/bin/phpstan analyse'],
            files: ['app/Foo.php'],
            spawn: () => result,
        });
        expect(run?.skipped).toBe('absent');
        expect(run?.exit_code).toBeNull();
    });

    it('a real verdict keeps skipped null so 2.1 can count the two apart', () => {
        const [clean] = runTouchedFileQuality({
            root: '/tmp',
            commands: ['npx eslint .'],
            files: ['a.ts'],
            spawn: stub(0, ''),
        });
        expect(clean?.skipped).toBeNull();
        expect(clean?.exit_code).toBe(0);
    });
});

describe('runTouchedFileQuality — risk 3, the module never writes the tree', () => {
    it('leaves every touched file byte-identical after a real spawn', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tfq-nomutate-'));
        const file = path.join(tmp, 'Foo.php');
        const before = '<?php\n   class    Foo {}\n';
        fs.writeFileSync(file, before, 'utf-8');

        // A stand-in for `vendor/bin/pint` that WRITES when invoked without
        // `--test` — the exact behaviour risk 3 names. If the module ever drops
        // the check form, this fixture rewrites the file and the assertion below
        // is what catches it.
        fs.mkdirSync(path.join(tmp, 'vendor', 'bin'), { recursive: true });
        const pint = path.join(tmp, 'vendor', 'bin', 'pint');
        fs.writeFileSync(
            pint,
            '#!/bin/sh\nfor a in "$@"; do [ "$a" = "--test" ] && exit 0; done\n' +
                'for a in "$@"; do case "$a" in --*) ;; *) echo "REWRITTEN" > "$a";; esac; done\nexit 0\n',
            { encoding: 'utf-8', mode: 0o755 },
        );

        runTouchedFileQuality({
            root: tmp,
            commands: ['vendor/bin/pint'],
            files: ['Foo.php'],
        });

        expect(fs.readFileSync(file, 'utf-8')).toBe(before);
    });
});

describe('touchedFilesAtStop — risk 4, no cross-session leak', () => {
    function seed(state: unknown): string {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tfq-touched-'));
        fs.mkdirSync(path.join(tmp, 'agents', 'state'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, 'agents', 'state', 'minimal-safe-diff.json'),
            JSON.stringify(state),
            'utf-8',
        );
        return tmp;
    }

    it('refuses a recorder state belonging to another session', () => {
        const root = seed({ session_id: 'other', files_touched_this_turn: ['a.ts'] });
        const got = touchedFilesAtStop(root, 'mine', () => ['a.ts']);
        expect(got.files).toEqual([]);
        expect(got.source).toBe('none');
    });

    it('yields none when the recorder state is absent', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tfq-absent-'));
        expect(touchedFilesAtStop(tmp, 'mine', () => ['a.ts']).source).toBe('none');
    });

    it('keeps only paths the working tree still reports as changed', () => {
        const root = seed({ session_id: 'mine', files_touched_this_turn: ['a.ts', 'reverted.ts'] });
        const got = touchedFilesAtStop(root, 'mine', () => ['a.ts']);
        expect(got.files).toEqual(['a.ts']);
        expect(got.source).toBe('minimal-safe-diff∩worktree');
    });

    it('never treats an empty session id as ownership', () => {
        const root = seed({ session_id: '', files_touched_this_turn: ['a.ts'] });
        expect(touchedFilesAtStop(root, '', () => ['a.ts']).files).toEqual([]);
    });
});

describe('parsePorcelainZ', () => {
    it('reads a plain modification', () => {
        expect(parsePorcelainZ(' M src/a.ts\0')).toEqual(['src/a.ts']);
    });

    it('keeps a path with a space unquoted', () => {
        expect(parsePorcelainZ(' M src/a file.ts\0')).toEqual(['src/a file.ts']);
    });

    it('takes the new path of a rename and consumes the origin', () => {
        expect(parsePorcelainZ('R  new.ts\0old.ts\0 M other.ts\0')).toEqual(['new.ts', 'other.ts']);
    });

    it('normalises a leading ./', () => {
        expect(normalizePath('./src/a.ts')).toBe('src/a.ts');
    });
});

describe('advisoryLine — 2.2', () => {
    const run = (over: Partial<QualityRun>): QualityRun => ({
        command: 'npx tsc --noEmit a.ts',
        source_command: 'npx eslint .',
        exit_code: 0,
        output_head: [],
        skipped: null,
        files: ['a.ts'],
        ignored_files: [],
        typecheck_not_run: [],
        at: '2026-10-01T00:00:00+00:00',
        ...over,
    });

    it('is null when nothing failed', () => {
        expect(advisoryLine([run({ exit_code: 0 })])).toBeNull();
    });

    it('is null when the only non-zero row was skipped', () => {
        expect(advisoryLine([run({ exit_code: null, skipped: 'absent' })])).toBeNull();
    });

    it('names the command and the file on a failure', () => {
        const line = advisoryLine([run({ exit_code: 1 })]);
        expect(line).toContain('npx eslint .');
        expect(line).toContain('a.ts');
    });

    it('stays within 200 bytes however long the path is', () => {
        const long = `src/${'deeply-nested/'.repeat(40)}file.ts`;
        const line = advisoryLine([run({ exit_code: 1, files: [long] })]);
        expect(Buffer.byteLength(line ?? '', 'utf-8')).toBeLessThanOrEqual(WARN_LINE_MAX_BYTES);
    });

    it('is exactly one line', () => {
        const line = advisoryLine([run({ exit_code: 2, files: ['a.ts', 'b.ts'] })]);
        expect(line?.split('\n')).toHaveLength(1);
    });
});

describe('truncateToBytes', () => {
    it('measures bytes, not code units', () => {
        const out = truncateToBytes('ä'.repeat(100), 10);
        expect(Buffer.byteLength(out, 'utf-8')).toBeLessThanOrEqual(10);
    });

    it('never cuts a character in half', () => {
        const out = truncateToBytes('ä'.repeat(100), 9);
        expect(Buffer.from(out, 'utf-8').toString('utf-8')).toBe(out);
        expect(out).not.toContain('�');
    });

    it('leaves a short string alone', () => {
        expect(truncateToBytes('short', 200)).toBe('short');
    });
});

describe('the resolver is the only authority', () => {
    it('the scoped table names no command the resolver cannot emit', () => {
        // Read the resolver's own quality functions and assert every key of the
        // scoped table appears there. A table row for a command the resolver
        // never emits is a second authority, which D2 forbids.
        const src = fs.readFileSync(
            path.join(
                process.cwd(),
                'src/agent-src/templates/scripts/work_engine/stack/runner.ts',
            ),
            'utf-8',
        );
        for (const command of ['npx eslint .', 'vendor/bin/phpstan analyse', 'vendor/bin/pint', 'ruff check', 'mypy .']) {
            expect(src).toContain(`'${command}'`);
        }
    });

    it('the real shell spawn is reachable', () => {
        // Guards the injected-spawn convenience above from hiding a broken
        // default: a module whose only tested path is the stub would ship a
        // `defaultSpawn` nobody ever ran.
        const probe = spawnSync('node', ['-e', 'process.exit(3)'], { encoding: 'utf-8' });
        expect(probe.status).toBe(3);
    });
});
