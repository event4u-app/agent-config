import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { enclosingWorkTree } from '../../src/scripts/_lib/git_common_dir.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'enclosing-wt-')));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('enclosingWorkTree', () => {
    it('finds the repository above a path that does not exist yet', () => {
        const repo = path.join(tmp, 'repo');
        fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
        expect(enclosingWorkTree(path.join(repo, 'out', 'view.html'))).toBe(repo);
    });

    it('treats a linked-worktree pointer file as a work tree', () => {
        const wt = path.join(tmp, 'wt');
        fs.mkdirSync(wt);
        fs.writeFileSync(path.join(wt, '.git'), 'gitdir: /elsewhere\n');
        expect(enclosingWorkTree(path.join(wt, 'x'))).toBe(wt);
    });

    it('is null outside any repository', () => {
        expect(enclosingWorkTree(path.join(tmp, 'plain', 'file'))).toBeNull();
    });
});
