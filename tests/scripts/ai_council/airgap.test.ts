// Tests for src/scripts/ai_council/airgap.ts (py2ts Phase 1).
//
// Mirrors tests/test_airgap_detection.py (injected-resolver contract) plus a
// CLI golden-parity differential against python3 for the deterministic
// surfaces: --help, --timeout error, unrecognized-arg error. The live-DNS
// happy path is NON-DETERMINISTIC (depends on network reachability) and is
// excluded from byte-parity — same carve-out as update_prices.ts's network
// path. The argparse `prog` differs by extension between runtimes
// (airgap.ts vs airgap.py); normalised before comparison.
import { describe, expect, it } from 'vitest';

import {
    AIRGAP_BANNER,
    COUNCIL_PROBE_HOSTS,
    type Resolver,
    airgap_banner,
    detect_airgap,
    probe_host,
    recommended_member_mode,
} from '../../../src/scripts/ai_council/airgap.js';
import { hasPython3, runPyScript, runTsScript } from './_harness.js';

const py3 = hasPython3();

/** A resolver that succeeds only for hosts in `reachable`. */
function makeResolver(reachable: Set<string>): Resolver {
    return (host: string): void => {
        if (!reachable.has(host)) {
            throw new Error(`unreachable: ${host}`);
        }
    };
}

describe('airgap — probe_host', () => {
    it('returns true when the resolver succeeds', () => {
        const resolver = makeResolver(new Set(['api.openai.com']));
        expect(probe_host('api.openai.com', { resolver })).toBe(true);
    });

    it('returns false when the resolver throws (gaierror analogue)', () => {
        const resolver = makeResolver(new Set());
        expect(probe_host('api.openai.com', { resolver })).toBe(false);
    });

    it('returns false on any thrown error (oserror analogue)', () => {
        const boom: Resolver = () => {
            throw new Error('network unreachable');
        };
        expect(probe_host('api.openai.com', { resolver: boom })).toBe(false);
    });
});

describe('airgap — detect_airgap (three roadmap cases)', () => {
    it('all reachable → false', () => {
        const resolver = makeResolver(new Set(COUNCIL_PROBE_HOSTS));
        expect(detect_airgap({ resolver })).toBe(false);
    });

    it('all unreachable → true', () => {
        const resolver = makeResolver(new Set());
        expect(detect_airgap({ resolver })).toBe(true);
    });

    it.each(COUNCIL_PROBE_HOSTS.map((h) => [h]))(
        'partial reachable (%s) → false',
        (reachableHost) => {
            const resolver = makeResolver(new Set([reachableHost]));
            expect(detect_airgap({ resolver })).toBe(false);
        },
    );

    it('empty hosts → true (airgap by definition)', () => {
        const resolver = makeResolver(new Set(COUNCIL_PROBE_HOSTS));
        expect(detect_airgap({ hosts: [], resolver })).toBe(true);
    });
});

describe('airgap — recommended_member_mode', () => {
    it('cli when reachable', () => {
        const resolver = makeResolver(new Set(['api.openai.com']));
        expect(recommended_member_mode({ resolver })).toBe('cli');
    });

    it('api when airgapped', () => {
        const resolver = makeResolver(new Set());
        expect(recommended_member_mode({ resolver })).toBe('api');
    });
});

describe('airgap — banner + host contract', () => {
    it('banner matches the roadmap wording exactly', () => {
        expect(AIRGAP_BANNER).toBe('airgapped environment detected — defaulting to mode: api');
        expect(airgap_banner()).toBe(AIRGAP_BANNER);
    });

    it('probe hosts cover the three providers', () => {
        expect(new Set(COUNCIL_PROBE_HOSTS)).toEqual(
            new Set(['api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com']),
        );
    });
});

// Normalise the argparse `prog` (airgap.ts vs airgap.py) so the deterministic
// CLI surfaces can be byte-compared across runtimes.
function norm(s: string): string {
    return s.replace(/airgap\.ts/gu, 'airgap.py');
}

describe.skipIf(!py3)('airgap — CLI golden parity (deterministic surfaces)', () => {
    it('--help is byte-identical (modulo prog extension) + exit 0', () => {
        const ts = runTsScript('ai_council/airgap', ['--help']);
        const py = runPyScript('ai_council/airgap', ['--help']);
        expect(ts.status).toBe(0);
        expect(py.status).toBe(0);
        expect(norm(ts.stdout)).toBe(py.stdout);
    });

    it('invalid --timeout → usage + error on stderr, exit 2', () => {
        const ts = runTsScript('ai_council/airgap', ['--timeout', 'abc']);
        const py = runPyScript('ai_council/airgap', ['--timeout', 'abc']);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        expect(norm(ts.stderr)).toBe(py.stderr);
    });

    it('unrecognized argument → usage + error on stderr, exit 2', () => {
        const ts = runTsScript('ai_council/airgap', ['--bogus']);
        const py = runPyScript('ai_council/airgap', ['--bogus']);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        expect(norm(ts.stderr)).toBe(py.stderr);
    });
});
