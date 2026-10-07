/**
 * The approved convention card is committed with the commit it was approved
 * for. Left unstaged, it reached only the checkout `/commit` ran in: a worktree
 * or a fresh clone asked the question again and could approve another family.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { APPROVED_CARD } from '../../src/scripts/_cli/cmd_git_convention.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('the approved convention card is committed, not left unstaged', () => {
    it('/commit stages the card explicitly in the step that writes it', () => {
        const text = read('src/domains/git/commit/command.md');
        expect(text).toContain(`git add -- ${APPROVED_CARD}`);
        expect(text).not.toMatch(/leave it\s+unstaged/);
        expect(text).not.toMatch(/left unstaged/);
    });

    it('/commit:in-chunks carries an unstaged card in the first chunk', () => {
        const text = read('src/domains/git/commit/in-chunks/command.md');
        expect(text).toContain(APPROVED_CARD);
        expect(text).toMatch(/first chunk/);
    });
});
