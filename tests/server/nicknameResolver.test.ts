/**
 * The impure half of the nickname prefill — the part that actually ships behind
 * `GET /api/v1/ping`.
 *
 * The pure chain is covered by `tests/shared/nicknamePrefill.test.ts`, and that
 * split left a real gap: the git invocation, the collapse-every-failure-to-
 * `undefined` contract, the floor's position AND its label, and the
 * memoisation the liveness probe depends on were all unverified. "The chain
 * stays testable without a machine" is true of the chain and says nothing about
 * the resolver.
 *
 * These cases are written as INVARIANTS rather than fixed values, because the
 * outcome legitimately differs between a machine with a git identity and one
 * without, and a test that hardcoded either would pass on the author's laptop
 * and fail in CI (or worse, the reverse).
 */

import { describe, expect, it, beforeEach } from 'vitest';

import {
    _resetNicknamePrefillCache,
    cachedNicknamePrefill,
    readGitUserName,
    resolveNicknamePrefill,
} from '../../src/server/nicknameResolver.js';
import type { NicknameSource } from '../../src/shared/nicknamePrefill.js';

const EVERY_SOURCE: readonly NicknameSource[] = [
    'git-user-name',
    'env-user',
    'env-username',
    'os-account',
    'none',
];

beforeEach(() => {
    _resetNicknamePrefillCache();
});

describe('readGitUserName — every failure collapses to undefined', () => {
    it('never throws, whatever git does on this machine', () => {
        expect(() => readGitUserName()).not.toThrow();
    });

    it('returns a trimmed non-empty string, or undefined — never an empty one', () => {
        // The empty string is the shape that would otherwise flow into the
        // chain and satisfy the "git wins" rung with no name in it.
        const got = readGitUserName();
        if (got !== undefined) {
            expect(got).toBe(got.trim());
            expect(got).not.toBe('');
        }
    });
});

describe('resolveNicknamePrefill — the chain against the real machine', () => {
    it('reports a source from the declared set', () => {
        expect(EVERY_SOURCE).toContain(resolveNicknamePrefill({}).source);
    });

    it('is empty if and only if nothing resolved', () => {
        const got = resolveNicknamePrefill({});
        expect(got.name === '').toBe(got.source === 'none');
    });

    it('never returns an untrimmed name', () => {
        const got = resolveNicknamePrefill({ USER: '  spaced  ' });
        expect(got.name).toBe(got.name.trim());
    });

    it('uses $USER only when git supplied nothing', () => {
        // Conditional rather than absolute: on a machine WITH a git identity
        // git must win, and on one without, $USER must. Both directions are
        // asserted without the test knowing which machine it is on.
        const got = resolveNicknamePrefill({ USER: 'zzz-fixture-user' });
        if (readGitUserName() === undefined) {
            expect(got).toEqual({ name: 'zzz-fixture-user', source: 'env-user' });
        } else {
            expect(got.source).toBe('git-user-name');
            expect(got.name).not.toBe('zzz-fixture-user');
        }
    });

    it('labels the OS-account floor as os-account, never as env-user', () => {
        // Injected, not machine-conditional. The earlier version guarded this
        // behind `readGitUserName() === undefined`, so on any box with a git
        // identity the body was skipped and the case passed green having
        // asserted nothing about the one behaviour this module adds.
        const got = resolveNicknamePrefill(
            {},
            { gitUserName: () => undefined, osAccount: () => 'login-handle' },
        );
        expect(got).toEqual({ name: 'login-handle', source: 'os-account' });
        expect(got.source).not.toBe('env-user');
    });

    it('reaches the floor only after git, $USER and $USERNAME are all empty', () => {
        const probes = { gitUserName: () => undefined, osAccount: () => 'login-handle' };
        expect(resolveNicknamePrefill({ USER: 'u' }, probes).source).toBe('env-user');
        expect(resolveNicknamePrefill({ USERNAME: 'w' }, probes).source).toBe('env-username');
        expect(
            resolveNicknamePrefill({}, { ...probes, gitUserName: () => 'Real Name' }).source,
        ).toBe('git-user-name');
    });

    it('returns none when even the floor is empty', () => {
        expect(
            resolveNicknamePrefill(
                {},
                { gitUserName: () => undefined, osAccount: () => undefined },
            ),
        ).toEqual({ name: '', source: 'none' });
    });

    it('trims what the floor returns', () => {
        expect(
            resolveNicknamePrefill(
                {},
                { gitUserName: () => undefined, osAccount: () => '  padded  ' },
            ).name,
        ).toBe('padded');
    });
});

describe('cachedNicknamePrefill — the liveness probe pays the fork once', () => {
    it('returns the identical object on repeated calls', () => {
        // Identity, not equality: equality would also hold if the resolver ran
        // again and produced a matching value, which is exactly the cost this
        // cache exists to avoid.
        expect(cachedNicknamePrefill()).toBe(cachedNicknamePrefill());
    });

    it('agrees with the uncached resolver', () => {
        expect(cachedNicknamePrefill()).toEqual(resolveNicknamePrefill());
    });

    it('recomputes after a reset, so the memo is not permanent state', () => {
        const first = cachedNicknamePrefill();
        _resetNicknamePrefillCache();
        const second = cachedNicknamePrefill();
        expect(second).not.toBe(first);
        expect(second).toEqual(first);
    });
});
