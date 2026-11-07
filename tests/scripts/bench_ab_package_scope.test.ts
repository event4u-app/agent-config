import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { stage_package_scope, workspace_dir } from '../../internal/bench/core/_lib/bench_ab_workspace.js';

function tmp(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('stage_package_scope', () => {
    it('copies every rule file into <root>/.claude/rules and counts them', () => {
        const src = tmp('rules-src-');
        const names = ['a.md', 'b.md', 'c.md'];
        for (const n of names) fs.writeFileSync(path.join(src, n), `# ${n}\n`);
        fs.writeFileSync(path.join(src, 'notes.txt'), 'not a rule');
        const root = tmp('scope-');

        const staged = stage_package_scope(src, root);

        expect(staged).toEqual({ root, rule_files: names.length });
        for (const n of names) {
            expect(fs.readFileSync(path.join(root, '.claude', 'rules', n), 'utf-8')).toBe(`# ${n}\n`);
        }
    });

    it('replaces a previously staged set rather than merging into it', () => {
        const root = tmp('scope-');
        const first = tmp('rules-src-');
        fs.writeFileSync(path.join(first, 'old.md'), 'old');
        stage_package_scope(first, root);
        const second = tmp('rules-src-');
        fs.writeFileSync(path.join(second, 'new.md'), 'new');

        expect(stage_package_scope(second, root)?.rule_files).toBe(1);
        expect(fs.existsSync(path.join(root, '.claude', 'rules', 'old.md'))).toBe(false);
    });

    it('returns null for a missing or rule-less source', () => {
        expect(stage_package_scope(path.join(tmp('none-'), 'absent'), tmp('scope-'))).toBeNull();
        expect(stage_package_scope(tmp('empty-'), tmp('scope-'))).toBeNull();
    });

    it('places a scoped clone beneath the staged rules, never containing them', () => {
        const root = tmp('scope-');
        const clone = workspace_dir('t-01', 'package', 3, root);
        expect(path.dirname(clone)).toBe(root);
        expect(clone.startsWith(path.join(root, '.claude'))).toBe(false);
        expect(workspace_dir('t-01', 'vanilla', 3)).not.toContain(root);
    });
});
