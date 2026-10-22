/**
 * `mergeIdentity` is what the wizard and settings panel save from, so a field
 * it drops is erased from `.agent-user.yml` on the next save.
 */
import { describe, expect, it } from 'vitest';
import { mergeIdentity } from '@shared/userMd/formAdapter.js';

const BASE = {
    version: 1,
    identity: { name: 'Sam' },
    language: 'en',
    style: { pace: 'rapid' },
    last_updated: '2026-10-20',
};

describe('mergeIdentity — style.avoid (brand-checkability 5.5)', () => {
    it('keeps a valid style.avoid through the form round-trip', () => {
        const avoid = [{ pattern: 'circle back', match: 'word', note: 'say when' }];
        expect(mergeIdentity({ ...BASE, style: { pace: 'rapid', avoid } }).style).toEqual({ pace: 'rapid', avoid });
    });

    it('adds no style.avoid key when the file has none', () => {
        expect(mergeIdentity(BASE).style).toEqual({ pace: 'rapid' });
    });

    it('drops an invalid style.avoid rather than saving it', () => {
        const avoid = [{ pattern: 'x', match: 'regex' }];
        expect(mergeIdentity({ ...BASE, style: { pace: 'rapid', avoid } }).style).toEqual({ pace: 'rapid' });
    });

    it('keeps the valid entries when one entry is invalid, instead of erasing the list', () => {
        const good = { pattern: 'circle back', match: 'word' };
        const avoid = [good, { pattern: 'x'.repeat(65), match: 'word' }, { pattern: 'y', match: 'regex' }];
        expect(mergeIdentity({ ...BASE, style: { pace: 'rapid', avoid } }).style).toEqual({
            pace: 'rapid',
            avoid: [good],
        });
    });

    it('keeps an over-cap list whole so the save rejects it visibly rather than dropping it', () => {
        const avoid = Array.from({ length: 33 }, (_, i) => ({ pattern: `term${String(i)}`, match: 'word' }));
        expect(mergeIdentity({ ...BASE, style: { pace: 'rapid', avoid } }).style.avoid).toHaveLength(33);
    });
});
