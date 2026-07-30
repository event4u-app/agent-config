// Unit tests for the shared duplicate-scope byte-comparison primitive
// (`agents/roadmaps/road-to-cache-economy.md` Phase 3, C-2) — reused by
// `cache_realization_report.ts#computeDuplicateScope` and the `doctor`
// `duplicate-scope-rules` check so both surfaces agree on what's shared.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { censusDuplicateScope } from '../../../src/scripts/_lib/duplicate_scope_census.js';

const tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    while (tmpDirs.length > 0) {
        const dir = tmpDirs.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('censusDuplicateScope', () => {
    it('sums the smaller of each shared filename’s byte size, ignoring files unique to one scope', () => {
        const userDir = mkTmp('user-rules-');
        const projectDir = mkTmp('project-rules-');
        const aUser = 'x'.repeat(100);
        const aProject = 'x'.repeat(120); // larger — the user copy is the smaller/"redundant" one counted
        const bBoth = 'x'.repeat(50);
        fs.writeFileSync(path.join(userDir, 'a.md'), aUser);
        fs.writeFileSync(path.join(userDir, 'b.md'), bBoth);
        fs.writeFileSync(path.join(userDir, 'only-user.md'), 'y'.repeat(30));
        fs.writeFileSync(path.join(projectDir, 'a.md'), aProject);
        fs.writeFileSync(path.join(projectDir, 'b.md'), bBoth);
        fs.writeFileSync(path.join(projectDir, 'only-project.md'), 'z'.repeat(10));
        fs.writeFileSync(path.join(projectDir, 'not-markdown.txt'), 'w'.repeat(999));

        const result = censusDuplicateScope(userDir, projectDir);

        expect(result.evaluable).toBe(true);
        expect(result.shared_filenames).toEqual(['a.md', 'b.md']);
        expect(result.duplicate_chars).toBe(Math.min(aUser.length, aProject.length) + Math.min(bBoth.length, bBoth.length));
    });

    it('is not evaluable when one of the rule directories is missing', () => {
        const userDir = mkTmp('user-rules-');
        const result = censusDuplicateScope(userDir, path.join(userDir, 'does-not-exist'));
        expect(result.evaluable).toBe(false);
        expect(result.reason).toMatch(/missing/);
        expect(result.shared_filenames).toEqual([]);
        expect(result.duplicate_chars).toBe(0);
    });

    it('is not evaluable when no filename is shared between the two scopes (single-scope install)', () => {
        const userDir = mkTmp('user-rules-');
        const projectDir = mkTmp('project-rules-');
        fs.writeFileSync(path.join(userDir, 'only-user.md'), 'a');
        fs.writeFileSync(path.join(projectDir, 'only-project.md'), 'b');

        const result = censusDuplicateScope(userDir, projectDir);
        expect(result.evaluable).toBe(false);
        expect(result.reason).toMatch(/no shared/);
        expect(result.shared_filenames).toEqual([]);
        expect(result.duplicate_chars).toBe(0);
    });

    it('returns filenames sorted regardless of directory read order', () => {
        const userDir = mkTmp('user-rules-');
        const projectDir = mkTmp('project-rules-');
        for (const name of ['zed.md', 'alpha.md', 'mid.md']) {
            fs.writeFileSync(path.join(userDir, name), 'x');
            fs.writeFileSync(path.join(projectDir, name), 'x');
        }
        const result = censusDuplicateScope(userDir, projectDir);
        expect(result.shared_filenames).toEqual(['alpha.md', 'mid.md', 'zed.md']);
    });
});
