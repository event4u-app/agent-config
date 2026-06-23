import { describe, expect, it } from 'vitest';

import { TRIVIAL_CHANGE_FLOOR, selectVerifyMode, verificationGap } from '../../src/scripts/_lib/verify_budget.js';

describe('selectVerifyMode', () => {
    it('read-only sub-task → deterministic', () => {
        expect(selectVerifyMode({ change_size: 0, file_writes: false, read_only: true })).toBe('deterministic');
    });

    it('trivial change, no file writes → deterministic', () => {
        expect(selectVerifyMode({ change_size: TRIVIAL_CHANGE_FLOOR, file_writes: false, read_only: false })).toBe('deterministic');
    });

    it('change above the floor → judge', () => {
        expect(selectVerifyMode({ change_size: TRIVIAL_CHANGE_FLOOR + 1, file_writes: true, read_only: false })).toBe('judge');
    });

    it('any file write on a non-read-only task → judge', () => {
        expect(selectVerifyMode({ change_size: 3, file_writes: true, read_only: false })).toBe('judge');
    });
});

describe('verificationGap — surfaced safety gap, never silent', () => {
    it('required but none recorded → gap', () => {
        expect(verificationGap('judge', 'none')).toMatch(/required but none recorded/);
        expect(verificationGap('deterministic', 'none')).toMatch(/required but none recorded/);
    });

    it('judge required but only deterministic ran → gap', () => {
        expect(verificationGap('judge', 'deterministic')).toMatch(/judge required/);
    });

    it('matching mode → no gap', () => {
        expect(verificationGap('judge', 'judge')).toBeNull();
        expect(verificationGap('deterministic', 'deterministic')).toBeNull();
    });

    it('none required → no gap', () => {
        expect(verificationGap('none', 'none')).toBeNull();
    });
});
