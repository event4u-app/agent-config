// The installer logs a `write` only when the log does not already prove those
// exact bytes at that path. A re-deploy of an unchanged tree adds no entries.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { flushTxLog } from '../../src/install/txlog.js';

describe('installer tx log — unchanged files are not re-logged', () => {
    let home: string;
    let saved: string | undefined;
    let logPath: string;

    const writes = (): string[] => {
        flushTxLog();
        let text = '';
        try {
            text = readFileSync(logPath, 'utf8');
        } catch {
            return [];
        }
        return text
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as { kind: string; path: string })
            .filter((e) => e.kind === 'write')
            .map((e) => e.path);
    };

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'txlog-skip-'));
        saved = process.env['EVENT4U_CONFIG_HOME'];
        process.env['EVENT4U_CONFIG_HOME'] = join(home, 'cfg');
        logPath = join(home, 'cfg', 'install-log.jsonl');
    });

    afterEach(() => {
        flushTxLog();
        if (saved === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
        else process.env['EVENT4U_CONFIG_HOME'] = saved;
        rmSync(home, { recursive: true, force: true });
    });

    it('a second deploy of the same bytes appends no write entry; a changed file appends one', async () => {
        const { _copy_dir_dereferencing_symlinks } = await import('../../src/scripts/install.js');
        const src = join(home, 'src');
        const dest = join(home, 'dest');
        mkdirSync(src, { recursive: true });
        writeFileSync(join(src, 'a.md'), '# a\n');
        writeFileSync(join(src, 'b.md'), '# b\n');

        _copy_dir_dereferencing_symlinks(src, dest, true);
        expect(writes()).toHaveLength(2);

        _copy_dir_dereferencing_symlinks(src, dest, true);
        expect(writes()).toHaveLength(2);

        writeFileSync(join(src, 'b.md'), '# b, changed\n');
        _copy_dir_dereferencing_symlinks(src, dest, true);
        const all = writes();
        expect(all).toHaveLength(3);
        expect(all[2]).toContain('b.md');
    });
});
