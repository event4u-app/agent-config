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
});
