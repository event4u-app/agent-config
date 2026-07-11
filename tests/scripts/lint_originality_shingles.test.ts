/** Smoke + contract for lint_originality_shingles (P1.3):
 *  report-only mode always exits 0 on the real corpus; the report names the
 *  corpus size; an absurd threshold of 101% can never fail. */
import { describe, expect, it } from 'vitest';
import { main } from '../../src/scripts/lint_originality_shingles.js';

describe('lint_originality_shingles', () => {
    it('report-only mode exits 0 on the real corpus', () => {
        expect(main(['--quiet'])).toBe(0);
    });

    it('an unreachable threshold never fails', () => {
        expect(main(['--quiet', '--threshold', '101'])).toBe(0);
    });
});
