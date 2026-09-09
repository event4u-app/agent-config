/**
 * `b-stdin-read-failure-policy` — option (c), council 2026-08-20 (2/2 quorum).
 *
 * A failed stdin read used to become an empty string, after which every concern
 * on the event evaluated nothing and the dispatcher exited 0. On a
 * `fail_closed: true`, `severity: blocking` guard that is an ALLOW, and F-1
 * measured it: `git commit --no-verify` DENIED at small payload size and ALLOWED
 * once padded to 300 KB.
 *
 * Two seams, tested separately on purpose.
 *
 *  - `stdinReadFailure` is where the failure becomes `''`. The three classes the
 *    council named — `EAGAIN` exhaustion, `EIO`, `EBADF` — are driven through it
 *    with real errno values, because none of them can be staged against a live
 *    fd 0 portably.
 *  - `denyOnStdinFailure` is the policy. It must deny where a deny is honoured
 *    AND something was silenced, and stay silent everywhere else — the second
 *    half is the whole difference between option (c) and option (a).
 *
 * SENSITIVITY: verified red before it was verified green. Against the pre-fix
 * behaviour (no deny at all) the four `denies` cases fail; with the block-capable
 * check removed, the `post_tool_use` and `stop` cases fail. Neither direction
 * passes by accident.
 */
import { describe, expect, it } from 'vitest';

import {
    _is_fail_closed_blocking,
    denyOnStdinFailure,
    stdinReadFailure,
    type JsonObject,
} from '../../src/scripts/hooks/dispatch_hook.js';
import { isBlockCapable } from '../../src/scripts/hooks/host_semantics.js';

/** A real errno error, the shape `fs.readSync` throws. */
function errnoError(code: string): Error {
    const err = new Error(`${code}: simulated, read`) as NodeJS.ErrnoException;
    err.code = code;
    err.errno = -1;
    err.syscall = 'read';
    return err;
}

/** The manifest shape of a fail-closed blocking guard (block-no-verify's). */
const GUARD: JsonObject = {
    name: 'block-no-verify',
    fail_closed: true,
    severity: 'blocking',
};
/** An advisory concern: nothing to silence, so nothing to refuse for. */
const ADVISORY: JsonObject = {
    name: 'design-slop',
    fail_closed: false,
    severity: 'advisory',
};

describe('stdinReadFailure — the seam where a failed read became empty input', () => {
    it('reports a successful read as no failure', () => {
        const r = stdinReadFailure(() => '{"tool_name":"Bash"}');
        expect(r.text).toBe('{"tool_name":"Bash"}');
        expect(r.failure).toBeNull();
    });

    it('reports a genuinely EMPTY stdin as no failure — the case that must stay an allow', () => {
        const r = stdinReadFailure(() => '');
        expect(r.text).toBe('');
        expect(r.failure).toBeNull();
    });

    // The three classes named in the option text. Each must arrive as a
    // non-null failure, never as "" with no failure — that indistinguishability
    // IS the defect.
    it('reports EAGAIN exhaustion, with the retry reader\'s own message', () => {
        const exhausted = new Error(
            'readStdinText: stdin stayed unreadable across 2000 retries (~10s). ' +
                'Refusing to report an empty read as empty input.',
        );
        const r = stdinReadFailure(() => {
            throw exhausted;
        });
        expect(r.text).toBe('');
        expect(r.failure).toContain('2000 retries');
    });

    it('reports EIO', () => {
        const r = stdinReadFailure(() => {
            throw errnoError('EIO');
        });
        expect(r.failure).toContain('EIO');
    });

    it('reports EBADF', () => {
        const r = stdinReadFailure(() => {
            throw errnoError('EBADF');
        });
        expect(r.failure).toContain('EBADF');
    });

    it('survives a thrown non-Error without losing the fact that it failed', () => {
        const r = stdinReadFailure(() => {
            throw 'not an Error';
        });
        expect(r.failure).toBe('not an Error');
    });
});

describe('_is_fail_closed_blocking — both halves are required', () => {
    it('accepts a fail-closed blocking guard', () => {
        expect(_is_fail_closed_blocking(GUARD)).toBe(true);
    });
    it('rejects an advisory concern that is nonetheless fail_closed', () => {
        expect(
            _is_fail_closed_blocking({ name: 'x', fail_closed: true, severity: 'advisory' }),
        ).toBe(false);
    });
    it('rejects a blocking concern that declared fail_closed: false', () => {
        expect(
            _is_fail_closed_blocking({ name: 'x', fail_closed: false, severity: 'blocking' }),
        ).toBe(false);
    });
    it('rejects a concern declaring neither', () => {
        expect(_is_fail_closed_blocking({ name: 'x' })).toBe(false);
    });
    it('reads severity case- and space-insensitively, as the dispatcher does elsewhere', () => {
        expect(
            _is_fail_closed_blocking({ name: 'x', fail_closed: true, severity: ' BLOCKING ' }),
        ).toBe(true);
    });
});

describe('denyOnStdinFailure — option (c), and only option (c)', () => {
    it('denies on pre_tool_use when a fail-closed blocking guard ran blind', () => {
        const deny = denyOnStdinFailure('claude', 'pre_tool_use', [ADVISORY, GUARD], 'EIO');
        expect(deny).not.toBeNull();
        // The refusal names the guard that was silenced and the failure, so the
        // reason is actionable rather than a bare "hook error".
        expect(deny?.reason).toContain('block-no-verify');
        expect(deny?.reason).toContain('EIO');
    });

    it('names every silenced guard, not just the first', () => {
        const second: JsonObject = {
            name: 'block-kernel-rule-writes',
            fail_closed: true,
            severity: 'blocking',
        };
        const deny = denyOnStdinFailure('claude', 'pre_tool_use', [GUARD, second], 'EBADF');
        expect(deny?.reason).toContain('block-no-verify');
        expect(deny?.reason).toContain('block-kernel-rule-writes');
    });

    // This is the half that separates (c) from (a). A deny here refuses nothing
    // — the tool already ran — and on `stop` it would break a turn end.
    it('does NOT deny on post_tool_use, where exit 2 cannot block', () => {
        expect(denyOnStdinFailure('claude', 'post_tool_use', [GUARD], 'EIO')).toBeNull();
    });

    it('does NOT deny on session_start', () => {
        expect(denyOnStdinFailure('claude', 'session_start', [GUARD], 'EIO')).toBeNull();
    });

    it('does NOT deny when the slot carries only advisory concerns', () => {
        expect(denyOnStdinFailure('claude', 'pre_tool_use', [ADVISORY], 'EIO')).toBeNull();
    });

    it('does NOT deny on an unverified platform, whose deny this tree has never observed honoured', () => {
        expect(denyOnStdinFailure('cursor', 'pre_tool_use', [GUARD], 'EIO')).toBeNull();
        expect(denyOnStdinFailure('augment', 'pre_tool_use', [GUARD], 'EIO')).toBeNull();
    });

    it('agrees with the exported block-capability predicate rather than a local copy', () => {
        // A drifted copy would deny where the deny is discarded — enforcement
        // theatre. Pinned by asserting the same source of truth both read.
        for (const event of ['pre_tool_use', 'user_prompt_submit', 'stop']) {
            expect(isBlockCapable('claude', event)).toBe(true);
            expect(denyOnStdinFailure('claude', event, [GUARD], 'EIO')).not.toBeNull();
        }
        for (const event of ['post_tool_use', 'session_start', 'session_end', 'pre_compact']) {
            expect(isBlockCapable('claude', event)).toBe(false);
            expect(denyOnStdinFailure('claude', event, [GUARD], 'EIO')).toBeNull();
        }
    });
});
