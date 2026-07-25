/**
 * Tests for the `exec:` evidence form and the trust-boundary risk classifier.
 *
 * The allowlist and the argument hardening are the security surface here, so
 * the assertions are abuse cases rather than happy paths: a passing
 * "allowlisted command is allowed" test proves nothing about whether
 * `--rootdir=/etc` gets through. Every rejection below corresponds to a
 * specific way the check could be built wrong.
 */
import { describe, expect, it } from 'vitest';

import {
    ALLOWLIST_PREFIXES,
    args_are_safe,
    command_is_allowlisted,
    exec_allowed_here,
    exec_static_error,
    parse_exec_pointer,
    split_argv,
} from '../../src/scripts/_lib/exec_evidence.js';
import {
    classify_diff,
    classify_path,
    escalated_floor,
    RISK_SEVERITY,
} from '../../src/scripts/_lib/risk_paths.js';

describe('exec: pointer grammar', () => {
    it('returns null for the three legacy forms so they fall through unchanged', () => {
        expect(parse_exec_pointer('docs/CLAIMS.md')).toBeNull();
        expect(parse_exec_pointer('docs/CLAIMS.md#substring')).toBeNull();
        expect(parse_exec_pointer('https://example.com (2026-07-25)')).toBeNull();
    });

    it('parses the command and the asserted exit code', () => {
        const p = parse_exec_pointer('exec:skill_eval_coverage --check -> 0');
        expect(p).toEqual({ command: 'skill_eval_coverage --check', expected: 0 });
    });

    it('accepts the rendered arrow the docs use', () => {
        expect(parse_exec_pointer('exec:domain_soundness_status → 0')).toEqual({
            command: 'domain_soundness_status',
            expected: 0,
        });
    });

    it('rejects a pointer with no asserted exit code — an unverifiable assertion is not a verdict', () => {
        const p = parse_exec_pointer('exec:skill_eval_coverage --check');
        expect(p).toHaveProperty('error');
    });

    it('rejects an empty command', () => {
        expect(parse_exec_pointer('exec: -> 0')).toHaveProperty('error');
    });
});

describe('allowlist — prefix tuples, not pattern matching', () => {
    it('admits an exact allowlisted prefix with extra flags', () => {
        expect(command_is_allowlisted(split_argv('skill_eval_coverage --check'))).toBe(true);
        expect(command_is_allowlisted(split_argv('vitest run tests/install/toolDetection.test.ts'))).toBe(true);
    });

    it('refuses a command that merely CONTAINS an allowlisted name', () => {
        // The bypass a substring/regex allowlist would permit.
        expect(command_is_allowlisted(split_argv('rm -rf / skill_eval_coverage'))).toBe(false);
        expect(command_is_allowlisted(split_argv('evil skill_eval_coverage'))).toBe(false);
    });

    it('refuses a prefix that is only partially matched', () => {
        // `vitest` alone is not on the list — only `vitest run`.
        expect(command_is_allowlisted(split_argv('vitest'))).toBe(false);
        expect(command_is_allowlisted(split_argv('vitest watch'))).toBe(false);
    });

    it('refuses an unlisted command outright', () => {
        expect(command_is_allowlisted(split_argv('curl https://example.com'))).toBe(false);
        expect(command_is_allowlisted(split_argv('bash -c whoami'))).toBe(false);
    });

    it('every allowlist entry is non-empty — an empty tuple would match everything', () => {
        for (const prefix of ALLOWLIST_PREFIXES) {
            expect(prefix.length).toBeGreaterThan(0);
            expect(prefix.every((t) => t.length > 0)).toBe(true);
        }
    });
});

describe('argument hardening', () => {
    it('rejects every shell metacharacter used to chain a second command', () => {
        for (const meta of ['&', ';', '|', '>', '<', '`', '$']) {
            expect(args_are_safe(['skill_eval_coverage', `x${meta}y`])).toBe(false);
        }
    });

    it('rejects embedded newlines and NUL', () => {
        expect(args_are_safe(['skill_eval_coverage', 'a\nb'])).toBe(false);
        expect(args_are_safe(['skill_eval_coverage', 'a\r'])).toBe(false);
        expect(args_are_safe(['skill_eval_coverage', 'a\0b'])).toBe(false);
    });

    it('rejects an absolute path argument', () => {
        expect(args_are_safe(['skill_eval_coverage', '/etc/passwd'])).toBe(false);
    });

    it('rejects a Windows drive-letter path', () => {
        expect(args_are_safe(['skill_eval_coverage', 'C:\\Windows'])).toBe(false);
    });

    it('rejects parent-directory escape', () => {
        expect(args_are_safe(['skill_eval_coverage', '../outside'])).toBe(false);
        expect(args_are_safe(['skill_eval_coverage', 'a/../../b'])).toBe(false);
    });

    it('rejects escape hidden in the RIGHT-HAND SIDE of --flag=value', () => {
        // The case an allowlist that only inspects the flag name lets through.
        expect(args_are_safe(['skill_eval_coverage', '--rootdir=/etc'])).toBe(false);
        expect(args_are_safe(['skill_eval_coverage', '--out=../escape'])).toBe(false);
    });

    it('allows ordinary in-repo flags and relative paths', () => {
        expect(args_are_safe(['skill_eval_coverage', '--check'])).toBe(true);
        expect(args_are_safe(['vitest', 'run', 'tests/install/toolDetection.test.ts'])).toBe(true);
        expect(args_are_safe(['skill_eval_coverage', '--limit=200'])).toBe(true);
    });
});

describe('static validation', () => {
    it('passes a well-formed allowlisted pointer', () => {
        expect(exec_static_error({ command: 'skill_eval_coverage --check', expected: 0 })).toBeNull();
    });

    it('fails a non-allowlisted command everywhere, including locally', () => {
        // A bad pointer is a ledger defect, not an environment property, so it
        // must not be deferred to CI.
        expect(exec_static_error({ command: 'curl evil.example', expected: 0 })).toMatch(/allowlist/);
    });

    it('fails a suspicious argument', () => {
        expect(exec_static_error({ command: 'skill_eval_coverage --out=/etc', expected: 0 })).toMatch(
            /suspicious/,
        );
    });
});

describe('execution gating', () => {
    it('refuses to run outside CI by default', () => {
        expect(exec_allowed_here({})).toBe(false);
        expect(exec_allowed_here({ CI: 'false' })).toBe(false);
    });

    it('runs in CI', () => {
        expect(exec_allowed_here({ CI: 'true' })).toBe(true);
        expect(exec_allowed_here({ CI: '1' })).toBe(true);
    });

    it('honours an explicit maintainer opt-in', () => {
        expect(exec_allowed_here({ AGENT_CONFIG_EXEC_EVIDENCE: '1' })).toBe(true);
    });
});

describe('risk classification', () => {
    it('classifies installer and provenance paths as trust-boundary', () => {
        expect(classify_path('src/install/detect.ts').risk).toBe('trust-boundary');
        expect(classify_path('.github/workflows/publish-npm.yml').risk).toBe('trust-boundary');
    });

    it('classifies the subagent spawn path as trust-boundary', () => {
        expect(classify_path('src/scripts/_lib/subagent_spawn.ts').risk).toBe('trust-boundary');
        expect(classify_path('src/scripts/generate_subagent_floor.ts').risk).toBe('trust-boundary');
    });

    it('does NOT let the docs exemption swallow a kernel rule', () => {
        // A kernel rule IS a markdown file. Exempting by extension first would
        // classify the most governed surface in the repo as `none`.
        expect(classify_path('src/rules/non-destructive-by-default.md').risk).toBe('trust-boundary');
        expect(classify_path('src/rules/commit-policy.md').risk).toBe('trust-boundary');
    });

    it('exempts ordinary docs', () => {
        expect(classify_path('docs/guides/whatever.md').risk).toBe('none');
        expect(classify_path('README.md').risk).toBe('none');
    });

    it('classifies a non-kernel rule as governance, not trust-boundary', () => {
        expect(classify_path('src/rules/icon-consistency.md').risk).toBe('governance');
    });

    it('takes the HIGHEST class across a mixed diff', () => {
        const v = classify_diff([
            'README.md',
            'src/rules/icon-consistency.md',
            'src/install/paths.ts',
        ]);
        expect(v.risk).toBe('trust-boundary');
        expect(v.reasons.length).toBe(2); // README is exempt
    });

    it('returns none for a diff that touches nothing governed', () => {
        expect(classify_diff(['src/ui/theme.ts', 'docs/x.md']).risk).toBe('none');
    });
});

describe('two-axis combination', () => {
    it('a risk trigger raises the host floor', () => {
        expect(escalated_floor(0, 'trust-boundary')).toBe(RISK_SEVERITY['trust-boundary']);
    });

    it('a weak host can NEVER lower a risk escalation — the direction is the point', () => {
        const strict = RISK_SEVERITY['trust-boundary'];
        expect(escalated_floor(strict, 'none')).toBe(strict);
        expect(escalated_floor(strict, 'governance')).toBe(strict);
    });

    it('is monotonic in both arguments', () => {
        for (const host of [0, 1, 2, 3]) {
            for (const risk of ['none', 'governance', 'auth', 'trust-boundary'] as const) {
                const out = escalated_floor(host, risk);
                expect(out).toBeGreaterThanOrEqual(host);
                expect(out).toBeGreaterThanOrEqual(RISK_SEVERITY[risk]);
            }
        }
    });
});
