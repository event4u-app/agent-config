// Every direct child-process call that lists the whole tree with `git ls-files`
// must raise `maxBuffer`. Node's default is 1 MiB; this repository's tracked-path
// list crossed it on 2026-11-09 (1,050,109 bytes), and two gates that relied on
// the default failed with ENOBUFS or read an empty corpus.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.join(import.meta.dirname, '..', '..');
const SELF = path.join(import.meta.dirname, 'git_ls_files_buffer.test.ts');

/** A raw `execFileSync`/`spawnSync`/`execSync` of `git` whose argv is exactly `ls-files` (optionally `-z`). */
const WHOLE_TREE = /\b(execFileSync|spawnSync|execSync)\(\s*'git',\s*\[(?:'-C',\s*[^,\]]+,\s*)?'ls-files'(?:,\s*'-z')?\]/;

function walk(dir: string, out: string[]): void {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.ts') && p !== SELF) out.push(p);
    }
}

describe('whole-tree git ls-files calls', () => {
    it('raise maxBuffer above the 1 MiB default', () => {
        const files: string[] = [];
        walk(path.join(ROOT, 'src', 'scripts'), files);
        walk(path.join(ROOT, 'tests'), files);
        const missing: string[] = [];
        for (const f of files) {
            const lines = fs.readFileSync(f, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (!WHOLE_TREE.test(line)) return;
                const call = lines.slice(i, i + 6).join('\n');
                if (!/maxBuffer/.test(call)) missing.push(`${path.relative(ROOT, f)}:${String(i + 1)}`);
            });
        }
        expect(missing).toEqual([]);
    });
});
