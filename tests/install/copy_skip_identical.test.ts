// A re-deploy must not rewrite a file whose bytes are already the bytes the run
// would write. The copy is the dominant cost of `agent-config upgrade`, and on
// an upgrade nearly every file is unchanged — so "written" has to mean "the
// target now holds these bytes", not "the disk was touched".
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { flushTxLog } from '../../src/install/txlog.js';

const OLD = new Date('2001-01-01T00:00:00Z');

describe('installer copy — identical targets are left untouched', () => {
    let home: string;
    let saved: string | undefined;
    let src: string;
    let dest: string;

    /** Backdate a deployed file so a rewrite is observable as a moved mtime. */
    const backdate = (name: string): void => utimesSync(join(dest, name), OLD, OLD);
    const touched = (name: string): boolean => statSync(join(dest, name)).mtimeMs !== OLD.getTime();

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'copy-skip-'));
        saved = process.env['EVENT4U_CONFIG_HOME'];
        process.env['EVENT4U_CONFIG_HOME'] = join(home, 'cfg');
        src = join(home, 'pkg', 'rules');
        dest = join(home, 'dest');
        mkdirSync(src, { recursive: true });
    });

    afterEach(() => {
        flushTxLog();
        if (saved === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
        else process.env['EVENT4U_CONFIG_HOME'] = saved;
        rmSync(home, { recursive: true, force: true });
    });

    it('does not rewrite an unchanged tagged .md or an unchanged plain file, and still reports both', async () => {
        const { _copy_dir_dereferencing_symlinks } = await import('../../src/scripts/install.js');
        writeFileSync(join(src, 'a.md'), '---\nname: a\n---\n# a\n');
        writeFileSync(join(src, 'b.sh'), 'echo b\n');
        const pkg = join(home, 'pkg');

        const first = _copy_dir_dereferencing_symlinks(src, dest, true, pkg);
        expect(first[0]).toBe(2);
        const tagged = readFileSync(join(dest, 'a.md'), 'utf8');
        expect(tagged).toContain('package: event4u/agent-config');
        expect(tagged).toContain('source_path: rules/a.md');

        backdate('a.md');
        backdate('b.sh');
        const second = _copy_dir_dereferencing_symlinks(src, dest, true, pkg);

        expect(touched('a.md')).toBe(false);
        expect(touched('b.sh')).toBe(false);
        // The manifest and the reaper are fed from this return value: an elided
        // write is still a file this run maintains.
        expect(second[0]).toBe(2);
        expect(second[2].sort()).toEqual(first[2].sort());
        expect(readFileSync(join(dest, 'a.md'), 'utf8')).toBe(tagged);
    });

    it('rewrites a file whose source changed and leaves its unchanged sibling alone', async () => {
        const { _copy_dir_dereferencing_symlinks } = await import('../../src/scripts/install.js');
        writeFileSync(join(src, 'a.md'), '---\nname: a\n---\n# a\n');
        writeFileSync(join(src, 'b.md'), '---\nname: b\n---\n# b\n');
        _copy_dir_dereferencing_symlinks(src, dest, true, join(home, 'pkg'));
        backdate('a.md');
        backdate('b.md');

        writeFileSync(join(src, 'b.md'), '---\nname: b\n---\n# b, changed\n');
        _copy_dir_dereferencing_symlinks(src, dest, true, join(home, 'pkg'));

        expect(touched('a.md')).toBe(false);
        expect(touched('b.md')).toBe(true);
        expect(readFileSync(join(dest, 'b.md'), 'utf8')).toContain('# b, changed');
        expect(readFileSync(join(dest, 'b.md'), 'utf8')).toContain('package: event4u/agent-config');
    });

    it('rewrites a target whose bytes drifted from what the run would write', async () => {
        const { _copy_dir_dereferencing_symlinks } = await import('../../src/scripts/install.js');
        writeFileSync(join(src, 'a.md'), '---\nname: a\n---\n# a\n');
        _copy_dir_dereferencing_symlinks(src, dest, true, join(home, 'pkg'));
        const good = readFileSync(join(dest, 'a.md'), 'utf8');

        writeFileSync(join(dest, 'a.md'), good.replace('# a', '# hand edit'));
        _copy_dir_dereferencing_symlinks(src, dest, true, join(home, 'pkg'));

        expect(readFileSync(join(dest, 'a.md'), 'utf8')).toBe(good);
    });

    it('carries a permission change over even when the bytes are identical', async () => {
        const { _copy_dir_dereferencing_symlinks } = await import('../../src/scripts/install.js');
        writeFileSync(join(src, 'run.sh'), '#!/bin/sh\necho hi\n');
        chmodSync(join(src, 'run.sh'), 0o644);
        _copy_dir_dereferencing_symlinks(src, dest, true, join(home, 'pkg'));

        chmodSync(join(src, 'run.sh'), 0o755);
        _copy_dir_dereferencing_symlinks(src, dest, true, join(home, 'pkg'));

        // Stated as equality with the source so it holds on every platform:
        // where the bits exist the copy must have happened, where they do not
        // both sides read the same.
        expect(statSync(join(dest, 'run.sh')).mode).toBe(statSync(join(src, 'run.sh')).mode);
    });
});
