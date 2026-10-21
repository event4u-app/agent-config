/**
 * The dangling-link probe in category A must withhold, never throw.
 *
 * Council review 2026-10-21, round 6: `lstatSync` ran outside any `try`, so a
 * filesystem error between `realpathSync` reporting `ENOENT` and the probe (a
 * race, a permission change) escaped the classifier. An uncaught throw ends the
 * dispatcher with exit 1, which Claude Code does not read as a block, so a
 * `deny` another concern already voted would be lost with it.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return {
        ...actual,
        realpathSync: (p: string) => {
            if (String(p).endsWith('racy')) {
                throw Object.assign(new Error('gone'), { code: 'ENOENT' });
            }
            return actual.realpathSync(p);
        },
        lstatSync: () => {
            throw Object.assign(new Error('denied'), { code: 'EACCES' });
        },
    };
});

const { isCategoryA } = await import('../../src/scripts/hooks/category_a.js');

describe('category A resolution failures', () => {
    it('lstat-failure-withholds: an lstat error after ENOENT is not inside, and does not throw', () => {
        expect(() => isCategoryA('Bash', { command: 'cat racy' }, process.cwd())).not.toThrow();
        expect(isCategoryA('Bash', { command: 'cat racy' }, process.cwd())).toBe(false);
    });
});
