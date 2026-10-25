import { describe, expect, it } from 'vitest';

import { formatTimestamp, isMediaAnchor, parseMediaAnchor } from '../../src/scripts/_lib/media_anchor.js';

describe('media anchor grammar', () => {
    it('accepts source@timestamp with and without a tile', () => {
        expect(parseMediaAnchor('S1@01:05 #3')).toEqual({ source: 1, seconds: 65, tile: 3 });
        expect(parseMediaAnchor('S12@00:00')).toEqual({ source: 12, seconds: 0, tile: null });
        expect(parseMediaAnchor('S2@1:02:03 #40')).toEqual({ source: 2, seconds: 3723, tile: 40 });
    });

    it.each([
        'S0@01:05',
        's1@01:05',
        'S1@1:05',
        'S1@01:60',
        'S1@75:00',
        'S1@01:05 #0',
        'S1@01:05#3',
        'S1 @01:05',
        'S1@01:05 #3 extra',
        '1@01:05',
        '',
    ])('refuses %j', (text) => {
        expect(isMediaAnchor(text)).toBe(false);
    });

    it('formats a timestamp the way the anchor reads it', () => {
        expect(formatTimestamp(65.9)).toBe('01:05');
        expect(formatTimestamp(3723)).toBe('1:02:03');
        expect(isMediaAnchor(`S1@${formatTimestamp(3723)} #1`)).toBe(true);
    });
});
