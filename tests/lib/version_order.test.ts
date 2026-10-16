import { describe, expect, it } from 'vitest';

import { _is_newer, is_newer_version } from '../../src/scripts/_lib/update_check';
import { compare_versions, node_engine_satisfied, parse_version } from '../../src/scripts/_lib/version_order';

describe('is_newer_version — the policy comparator beside _is_newer', () => {
    it('orders a final release above its own prerelease', () => {
        expect(is_newer_version('16.6.0', '16.6.0-next.3')).toBe(true);
    });

    it('pinned regression witness: _is_newer still truncates the prerelease and says false', () => {
        expect(_is_newer('16.6.0', '16.6.0-next.3')).toBe(false);
    });

    it.each<[string, string, boolean]>([
        ['17.0.0', '16.6.0-next.3', true],
        ['16.6.0-next.3', '16.6.0', false],
        ['16.6.0-next.4', '16.6.0-next.3', true],
        ['16.6.0-next.10', '16.6.0-next.9', true],
        ['16.6.0-next.3', '16.6.0-next.3', false],
        ['1.0.0-alpha.beta', '1.0.0-alpha.1', true],
        ['1.0.0-alpha.1', '1.0.0-alpha', true],
        ['v2.0.0', '1.9.9', true],
        ['1.10.0', '1.9.0', true],
        ['1.0.0', '1.0.1', false],
        ['1.0.0+build.5', '1.0.0', false],
    ])('is_newer_version(%s, %s) → %s', (latest, installed, expected) => {
        expect(is_newer_version(latest, installed)).toBe(expected);
    });

    it.each(['', 'latest', '1.2', '1.2.x', '01.2.3', '1.2.3-', null, undefined])(
        'invalid input %j is never newer in either direction',
        (bad) => {
            expect(is_newer_version(bad as string, '1.0.0')).toBe(false);
            expect(is_newer_version('99.0.0', bad as string)).toBe(false);
        },
    );
});

describe('compare_versions', () => {
    it('returns null for an unparseable side and a sign otherwise', () => {
        expect(compare_versions('1.0.0', 'nope')).toBeNull();
        expect(compare_versions('1.0.0', '1.0.0')).toBe(0);
        expect(compare_versions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('parses a v prefix and rejects leading zeros', () => {
        expect(parse_version('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [] });
        expect(parse_version('1.02.3')).toBeNull();
    });
});

describe('node_engine_satisfied — the local machine overrides the map', () => {
    it.each<[string, string, boolean | null]>([
        ['>=22', 'v20.11.0', false],
        ['>=22', 'v22.0.0', true],
        ['>=20.11.0', 'v20.11.0', true],
        ['>=20.11.0', 'v20.10.9', false],
        ['^20.11.0', 'v22.1.0', false],
        ['^20.11.0', 'v20.19.0', true],
        ['~20.11.0', 'v20.12.0', false],
        ['>=18 <21', 'v20.0.0', true],
        ['>=18 <21', 'v22.0.0', false],
        ['^18 || >=22', 'v20.5.0', false],
        ['^18 || >=22', 'v22.5.0', true],
        ['20.x', 'v20.3.1', true],
        ['*', 'v20.0.0', true],
        ['>=22', 'v22.0.0-nightly', false],
        ['banana', 'v20.0.0', null],
        ['>=22', 'not-a-version', null],
    ])('range %j under %s → %s', (range, runtime, expected) => {
        expect(node_engine_satisfied(range, runtime)).toBe(expected);
    });
});
