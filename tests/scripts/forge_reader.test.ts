/**
 * The live forge read behind `doctor --json` —
 * `road-to-adversarial-verification-and-long-runs` AC-5.
 *
 * Phase 3.2 shipped a correct pure mapper with no production caller, so
 * `agent-config doctor --json` reported five `unread` rows while the forge
 * satisfied all five. This module is the caller. The load-bearing property is
 * NOT "it reads the forge" — it is that every way the read can fail degrades to
 * exactly the `unread` output Phase 3.2 already produced, because that is the
 * whole argument for the read being safe to make by default.
 *
 * Each case below drives a direction the reader could plausibly have got wrong,
 * and several pin a direction where the WRONG implementation is the more
 * obvious one: an all-or-nothing failure across independent surfaces, a partial
 * ruleset list, a non-boolean flag coerced to `false`.
 */

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
//
// `critical=yes` is a CORRECTION. The first marker read `critical=no`, which an
// independent review called at least arguable and recorded without an argument:
// this suite underwrites whether branch protection, required checks and
// force-push are reported satisfied — the mechanical check ADR-268 § 3 trades
// for the owner's confirmation — and `evaluator-independence` names merge
// control among the critical behaviours.
//
// `level=L4` was EARNED rather than relabelled, and the route matters because
// the first attempt failed honestly. A third review round found `critical=yes`
// at L1 contradicting AC-2, which requires critical tests at L3 or L4 where two
// providers are configured — a closed criterion falsified by this diff. The
// first council pass was given a DESCRIPTION of these files and one seat
// correctly refused to assess while the other speculated; that pass is recorded
// and claims nothing. The second embedded both suites in full (the bundle is
// capped at 51,200 bytes, so the implementation was dropped and the tests kept)
// and ran 2/2 with anthropic and openai.
//
// Its strongest finding is folded in rather than noted: the effort was
// INVERTED — 37 cases on acquisition choreography against almost none asserting
// the five rows this command actually emits. It also caught that the scripted
// `api()` fake DROPPED the `paginate` argument, so the pagination cases passed
// against an implementation that never asked for a second page, and that the
// "non-boolean" case supplied a missing field rather than a wrong-typed one.
// All three now have cases.

import { describe, expect, it } from 'vitest';

import {
    FORGE_CALL_TIMEOUT_MS,
    budgetOf,
    callTimeout,
    forgeReadingFor,
    liveForgeApi,
    readForge,
    resolveForgeRepo,
    withDeadline,
    type ForgeApi,
    type ForgeTarget,
    type Runner,
    type SpawnResult,
} from '../../src/scripts/_lib/forge_reader.js';
import { UNREAD_FORGE } from '../../src/scripts/_lib/forge_protection.js';

/** The live shape of this repository's own payloads, read 2026-09-30. */
const REPO_RECORD = { default_branch: 'main', allow_auto_merge: true };
// `--paginate --slurp` yields an array of PAGES. The first fixture was the flat
// `[{id}]`, which production never produces, so the flatten branch was dead in
// every case that claimed to cover the ruleset read. Both shapes are now
// exercised: this one, and the flat form in its own case below.
const RULESET_SUMMARY = [[{ id: 17749383 }]];
const RULESET_DETAIL = {
    id: 17749383,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'] } },
    rules: [
        {
            type: 'required_status_checks',
            parameters: {
                required_status_checks: [
                    { context: 'Sync + Generate Tools Consistency' },
                    { context: 'Standing payload delta + budget gate' },
                ],
            },
        },
        { type: 'non_fast_forward' },
    ],
};
const ENVIRONMENTS = {
    total_count: 1,
    environments: [
        {
            name: 'github-pages',
            deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
        },
    ],
};
const BRANCH_POLICIES = { total_count: 1, branch_policies: [{ name: 'main' }] };

/** A scripted API. Records every path it was asked for, so "no call" is testable. */
function api(
    table: Readonly<Record<string, unknown | null>>,
): ForgeApi & { readonly calls: string[]; readonly paged: string[] } {
    const calls: string[] = [];
    // The `paginate` argument was DROPPED by the first version of this fake, so
    // the reader→adapter seam — whether `readForge` actually asks for the
    // paginated form — was untested while the pagination cases passed. A fake
    // that silently discards a parameter cannot witness it.
    const paged: string[] = [];
    return {
        calls,
        paged,
        get(apiPath: string, paginate?: boolean): unknown | null {
            calls.push(apiPath);
            if (paginate === true) paged.push(apiPath);
            return apiPath in table ? table[apiPath] : null;
        },
    };
}

const FULL: Readonly<Record<string, unknown | null>> = {
    'repos/o/r': REPO_RECORD,
    'repos/o/r/rulesets': RULESET_SUMMARY,
    'repos/o/r/rulesets/17749383': RULESET_DETAIL,
    'repos/o/r/environments': ENVIRONMENTS,
    'repos/o/r/environments/github-pages/deployment-branch-policies': BRANCH_POLICIES,
};

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
describe('readForge — the happy path', () => {
    it('reads all four fields from the live payload shapes', () => {
        const reading = readForge('o/r', api(FULL));
        expect(reading.defaultBranch).toBe('main');
        expect(reading.allowAutoMerge).toBe(true);
        expect(reading.rulesets).toHaveLength(1);
        expect(reading.deployRestricted).toBe(true);
    });
});

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
describe('readForge — every failure degrades to unread, never to false', () => {
    it('a failed repository record yields the all-unread reading', () => {
        const reading = readForge('o/r', api({}));
        expect(reading).toEqual(UNREAD_FORGE);
    });

    it('stops calling once the repository record fails', () => {
        // The repo record carries two of the four fields and gates the rest, so
        // a reader that keeps going after it fails spends calls it cannot use.
        const a = api({});
        readForge('o/r', a);
        expect(a.calls).toEqual(['repos/o/r']);
    });

    it('a failed ruleset DETAIL blanks the whole list rather than returning a partial one', () => {
        // The plausible wrong implementation keeps the rulesets it managed to
        // read. A subset understates protection in one direction and overstates
        // it in the other, so neither is a verdict worth recording.
        const reading = readForge(
            'o/r',
            api({ ...FULL, 'repos/o/r/rulesets/17749383': null }),
        );
        expect(reading.rulesets).toBeNull();
        expect(reading.defaultBranch).toBe('main');
    });

    it('a failed environments read leaves the ruleset rows intact', () => {
        // The opposite plausible error: all-or-nothing across surfaces that do
        // not depend on each other. A missing environments call says nothing
        // about whether a ruleset protects the branch.
        const reading = readForge('o/r', api({ ...FULL, 'repos/o/r/environments': null }));
        expect(reading.deployRestricted).toBeNull();
        expect(reading.rulesets).toHaveLength(1);
        expect(reading.allowAutoMerge).toBe(true);
    });

    it('a non-boolean allow_auto_merge is unread, never coerced to false', () => {
        const reading = readForge(
            'o/r',
            api({ ...FULL, 'repos/o/r': { default_branch: 'main' } }),
        );
        expect(reading.allowAutoMerge).toBeNull();
    });

    it('a WRONG-TYPE allow_auto_merge is unread, not just a missing one', () => {
        // The case above supplies a MISSING field. A truthy string or a 1 is
        // the shape that actually arrives from a loose serialiser, and it is
        // the one where a coercing implementation reports `satisfied`.
        for (const bad of ['true', 1, 'yes', {}]) {
            const reading = readForge(
                'o/r',
                api({ ...FULL, 'repos/o/r': { default_branch: 'main', allow_auto_merge: bad } }),
            );
            expect(reading.allowAutoMerge).toBeNull();
        }
    });

    it('a non-string default_branch is unread, never an empty branch name', () => {
        const reading = readForge(
            'o/r',
            api({ ...FULL, 'repos/o/r': { default_branch: 42, allow_auto_merge: true } }),
        );
        expect(reading.defaultBranch).toBeNull();
        expect(reading.allowAutoMerge).toBe(true); // independent field, still read
    });

    it('a failed branch-policy read makes the row unread, never a trusted flag', () => {
        // CORRECTED after an independent review. The first version asserted
        // `true` here on the reasoning that falling back to the flag is the
        // "narrower guarantee" — it is the opposite. `deployRestrictedFrom`
        // calls the flag-only path the guarantee that WAS NOT CHECKED, so an
        // environment whose real policy is `*` would report `satisfied`: the
        // overstatement direction this module claims it never takes, and
        // indistinguishable in the output from a real restriction.
        const reading = readForge(
            'o/r',
            api({
                ...FULL,
                'repos/o/r/environments/github-pages/deployment-branch-policies': null,
            }),
        );
        expect(reading.deployRestricted).toBeNull();
    });

    it('url-encodes the environment name into the policy path', () => {
        // An unencoded name with a space fails the call, which — before the
        // correction above — silently became a trusted flag. Encoding is what
        // stops that branch being reached by accident.
        const a = api({
            ...FULL,
            'repos/o/r/environments': {
                environments: [
                    {
                        name: 'prod eu',
                        deployment_branch_policy: { custom_branch_policies: true },
                    },
                ],
            },
            'repos/o/r/environments/prod%20eu/deployment-branch-policies': {
                branch_policies: [{ name: 'main' }],
            },
        });
        expect(readForge('o/r', a).deployRestricted).toBe(true);
        expect(a.calls).toContain('repos/o/r/environments/prod%20eu/deployment-branch-policies');
    });

    it('a non-boolean policy FLAG makes the row unread, not unsatisfied', () => {
        // Omitting it collapsed into `false` one rung down, because
        // `deployRestrictedFrom` tests `=== true` and cannot tell absent from
        // unparseable. An ABSENT flag is a different input and still absent.
        const reading = readForge(
            'o/r',
            api({
                ...FULL,
                'repos/o/r/environments': {
                    environments: [
                        {
                            name: 'github-pages',
                            deployment_branch_policy: { custom_branch_policies: 'yes' },
                        },
                    ],
                },
            }),
        );
        expect(reading.deployRestricted).toBeNull();
    });

    it('a non-string branch-policy name makes the row unread, not unsatisfied', () => {
        // Filtering it away left an empty pattern list, which maps to `false`
        // and renders a positive claim about the forge out of unparseable data.
        const reading = readForge(
            'o/r',
            api({
                ...FULL,
                'repos/o/r/environments/github-pages/deployment-branch-policies': {
                    branch_policies: [{ name: 'main' }, { name: 42 }],
                },
            }),
        );
        expect(reading.deployRestricted).toBeNull();
    });

    it('a wildcard branch policy refutes the row', () => {
        const reading = readForge(
            'o/r',
            api({
                ...FULL,
                'repos/o/r/environments/github-pages/deployment-branch-policies': {
                    branch_policies: [{ name: '*' }],
                },
            }),
        );
        expect(reading.deployRestricted).toBe(false);
    });
});

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
describe('pagination — the overstatement the unpaginated read allowed', () => {
    it('ASKS for the paginated form on every list endpoint', () => {
        // The consumption of pages was tested; the request for them was not,
        // because the fake dropped the argument. An implementation that read
        // page one and parsed it correctly passed every case here.
        const a = api(FULL);
        readForge('o/r', a);
        expect(a.paged).toContain('repos/o/r/rulesets');
        expect(a.paged).toContain('repos/o/r/environments');
        expect(a.paged).toContain(
            'repos/o/r/environments/github-pages/deployment-branch-policies',
        );
        // The single-object reads must NOT be paginated.
        expect(a.paged).not.toContain('repos/o/r');
    });

    it('reads every page of environments, not just the first', () => {
        // Unpaginated, `deployRestrictedFrom`'s `every()` ran over the visible
        // subset, so an unlisted unrestricted environment read as `satisfied`.
        const reading = readForge(
            'o/r',
            api({
                ...FULL,
                'repos/o/r/environments': [
                    { environments: [ENVIRONMENTS.environments[0]] },
                    { environments: [{ name: 'wide', deployment_branch_policy: null }] },
                ],
            }),
        );
        expect(reading.deployRestricted).toBe(false);
    });

    it('reads every page of branch policies', () => {
        const reading = readForge(
            'o/r',
            api({
                ...FULL,
                'repos/o/r/environments/github-pages/deployment-branch-policies': [
                    { branch_policies: [{ name: 'main' }] },
                    { branch_policies: [{ name: '*' }] },
                ],
            }),
        );
        expect(reading.deployRestricted).toBe(false);
    });

    it('accepts the unpaginated page shape too', () => {
        const reading = readForge(
            'o/r',
            api({ ...FULL, 'repos/o/r/rulesets': [{ id: 17749383 }] }),
        );
        expect(reading.rulesets).toHaveLength(1);
    });

    it('skips the policy call when protected_branches already decides the row', () => {
        const a = api({
            ...FULL,
            'repos/o/r/environments': {
                environments: [
                    {
                        name: 'github-pages',
                        deployment_branch_policy: {
                            protected_branches: true,
                            custom_branch_policies: true,
                        },
                    },
                ],
            },
        });
        expect(readForge('o/r', a).deployRestricted).toBe(true);
        expect(
            a.calls.some((c) => c.includes('deployment-branch-policies')),
        ).toBe(false);
    });
});

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
describe('resolveForgeRepo', () => {
    it('refuses a slug carrying path or replacement-pattern characters', () => {
        // The slug is interpolated into an API path AND used as a `replace`
        // replacement, where `$&` and `$1` are control sequences.
        expect(resolveForgeRepo('https://github.com/o/..')).toBeNull();
        expect(resolveForgeRepo('https://github.com/o/r$&x')).toBeNull();
        expect(resolveForgeRepo('https://github.com/o/r?x')).toBeNull();
    });

    it('reads owner/repo from the ssh and https forms', () => {
        expect(resolveForgeRepo('git@github.com:event4u-app/agent-config.git')).toEqual({
            host: 'github.com',
            slug: 'event4u-app/agent-config',
        });
        expect(resolveForgeRepo('https://github.com/event4u-app/agent-config')).toEqual({
            host: 'github.com',
            slug: 'event4u-app/agent-config',
        });
    });

    it('refuses a remote on a host that is not GitHub-shaped', () => {
        // `gh api` speaks GitHub. Spawning it against a GitLab remote buys a
        // doomed process on every `doctor` run; the row is `unread` either way.
        expect(resolveForgeRepo('git@gitlab.com:o/r.git')).toBeNull();
        expect(resolveForgeRepo('https://bitbucket.org/o/r.git')).toBeNull();
    });

    it('accepts a GitHub Enterprise host carrying the vendor name', () => {
        expect(resolveForgeRepo('https://github.acme.com/o/r.git')).toEqual({
            host: 'github.acme.com',
            slug: 'o/r',
        });
    });

    it('is null for an absent or unparseable remote', () => {
        expect(resolveForgeRepo(null)).toBeNull();
        expect(resolveForgeRepo('')).toBeNull();
        expect(resolveForgeRepo('not-a-remote')).toBeNull();
    });
});

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
describe('forgeReadingFor — the opt-out', () => {
    /** A target resolver that records whether it ran at all. */
    function resolver(
        slug: string | null,
    ): (() => ForgeTarget | null) & { ran: () => number } {
        let n = 0;
        const f = (): ForgeTarget | null => {
            n += 1;
            return slug === null ? null : { host: 'github.com', slug };
        };
        return Object.assign(f, { ran: () => n });
    }

    /** Hand every request the same scripted api, whatever target resolved. */
    const give = (a: ForgeApi) => () => a;

    it('reads the forge when nothing opts out, and names the repository it read', () => {
        // The slug travels WITH the rows. Five rows reading `satisfied` say
        // nothing about whose branch is protected when `origin` may be a fork,
        // a mirror, or somebody else's project in a consumer install.
        const a = api(FULL);
        const read = forgeReadingFor({ env: {}, resolveRepo: resolver('o/r'), apiFor: give(a) });
        expect(read.reading.defaultBranch).toBe('main');
        expect(read.repo).toBe('o/r');
        expect(a.calls.length).toBeGreaterThan(0);
    });

    it('reports no repository on every path that read nothing', () => {
        const a = api(FULL);
        expect(forgeReadingFor({ env: {}, resolveRepo: resolver(null), apiFor: give(a) }).repo).toBeNull();
        expect(
            forgeReadingFor({
                env: { AGENT_CONFIG_OFFLINE: '1' },
                resolveRepo: resolver('o/r'),
                apiFor: give(a),
            }).repo,
        ).toBeNull();
    });

    it('reads a switch as the literal 1, matching the rest of the CLI', () => {
        // `cmd_versions` and `cmd_update` both test `=== '1'` for
        // AGENT_CONFIG_OFFLINE. Accepting any non-empty value here gave one
        // variable two opposite meanings in one binary: `=0` meant online
        // there and offline here, and the surprising direction is the one a
        // user reads as "off".
        const a = api(FULL);
        const read = forgeReadingFor({
            env: { AGENT_CONFIG_OFFLINE: '0' },
            resolveRepo: resolver('o/r'),
            apiFor: give(a),
        });
        expect(read.repo).toBe('o/r');
        expect(a.calls.length).toBeGreaterThan(0);
    });

    it('makes NO call when the environment opts out', () => {
        // Asserting the call COUNT rather than the returned reading: a reader
        // that queried the forge and then discarded the answer would satisfy an
        // output-only assertion while still paying the latency the opt-out
        // exists to avoid.
        const a = api(FULL);
        const reading = forgeReadingFor({
            env: { AGENT_CONFIG_DOCTOR_NO_FORGE: '1' },
            resolveRepo: resolver('o/r'),
            apiFor: give(a),
        });
        expect(reading.reading).toEqual(UNREAD_FORGE);
        expect(a.calls).toEqual([]);
    });

    it('the opt-out runs before the repository is even resolved', () => {
        // The council's 1b condition, in one assertion: an opt-out that only
        // skips the API calls still spawns `git remote get-url` to work out a
        // repository it will not use. "No network" has to mean no subprocess at
        // all, or the switch does not say what it claims.
        const r = resolver('o/r');
        const a = api(FULL);
        forgeReadingFor({ env: { AGENT_CONFIG_DOCTOR_NO_FORGE: '1' }, resolveRepo: r, apiFor: give(a) });
        expect(r.ran()).toBe(0);
        expect(a.calls).toEqual([]);
    });

    it('honours the general offline switch too', () => {
        const a = api(FULL);
        expect(
            forgeReadingFor({
                env: { AGENT_CONFIG_OFFLINE: '1' },
                resolveRepo: resolver('o/r'),
                apiFor: give(a),
            }).reading,
        ).toEqual(UNREAD_FORGE);
        expect(a.calls).toEqual([]);
    });

    it('makes NO call when no repository resolves', () => {
        const a = api(FULL);
        expect(forgeReadingFor({ env: {}, resolveRepo: resolver(null), apiFor: give(a) }).reading).toEqual(
            UNREAD_FORGE,
        );
        expect(a.calls).toEqual([]);
    });

    it('never throws when the api throws', () => {
        // A diagnostic that dies because its optional read failed is worse than
        // one that reports `unread`.
        const thrower: ForgeApi = {
            get() {
                throw new Error('gh exploded');
            },
        };
        expect(
            forgeReadingFor({ env: {}, resolveRepo: resolver('o/r'), apiFor: give(thrower) }).reading,
        ).toEqual(UNREAD_FORGE);
    });

    it('never throws when resolving the repository throws', () => {
        const boom = (): ForgeTarget | null => {
            throw new Error('git exploded');
        };
        expect(forgeReadingFor({ env: {}, resolveRepo: boom, apiFor: give(api(FULL)) }).reading).toEqual(
            UNREAD_FORGE,
        );
    });
});

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
describe('withDeadline — the whole-read budget', () => {
    // The council's 1b condition: per-call timeouts bound each call and nothing
    // bounds their SUM, so the advertised ceiling can be exceeded several times
    // over without any single call misbehaving.
    it('passes calls through while the budget holds', () => {
        const a = api(FULL);
        expect(readForge('o/r', withDeadline(a, () => 5_000)).defaultBranch).toBe('main');
    });

    it('a budget exhausted before the first call yields the unread reading', () => {
        const a = api(FULL);
        expect(readForge('o/r', withDeadline(a, () => 0))).toEqual(UNREAD_FORGE);
        expect(a.calls).toEqual([]);
    });

    it('a budget exhausted mid-read degrades the unreached rows to unread, never to false', () => {
        // The direction that matters: a partially spent budget must not be able
        // to turn "we ran out of time" into "the forge says no".
        let n = 0;
        const a = api(FULL);
        const reading = readForge(
            'o/r',
            withDeadline(a, () => {
                n += 1;
                return n > 1 ? 0 : 5_000; // the repo record goes through; nothing after it.
            }),
        );
        expect(reading.defaultBranch).toBe('main');
        expect(reading.rulesets).toBeNull();
        expect(reading.deployRestricted).toBeNull();
    });

    it('budgetOf counts down and floors at zero', () => {
        let t = 1_000;
        const left = budgetOf(100, () => t);
        expect(left()).toBe(100);
        t = 1_050;
        expect(left()).toBe(50);
        t = 9_999;
        expect(left()).toBe(0); // never negative, so `<= 0` is the only check needed.
    });
});

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
describe('liveForgeApi — the adapter the degradation claim rests on', () => {
    // Previously the only non-injectable code in the module and untested, while
    // every branch in it feeds the "every failure degrades to unread" promise.
    const ok = (stdout: string) => (): SpawnResult => ({ status: 0, stdout });

    it('parses a successful call', () => {
        expect(liveForgeApi(() => 5_000, ok('{"a":1}')).get('repos/o/r')).toEqual({ a: 1 });
    });

    it('returns null on a non-zero exit, empty stdout, or unparseable JSON', () => {
        expect(liveForgeApi(() => 5_000, () => ({ status: 1, stdout: '{}' })).get('x')).toBeNull();
        expect(liveForgeApi(() => 5_000, ok('   ')).get('x')).toBeNull();
        expect(liveForgeApi(() => 5_000, ok('not json')).get('x')).toBeNull();
    });

    it('returns null when the spawn itself throws', () => {
        const boom: Runner = () => {
            throw new Error('ENOENT: gh not installed');
        };
        expect(liveForgeApi(() => 5_000, boom).get('x')).toBeNull();
    });

    it('makes no call at all once the budget is gone', () => {
        let ran = 0;
        const counting: Runner = () => {
            ran += 1;
            return { status: 0, stdout: '{}' };
        };
        expect(liveForgeApi(() => 0, counting).get('x')).toBeNull();
        expect(ran).toBe(0);
    });

    it('never hands the runner a timeout Node would ignore', () => {
        // TWO Node behaviours, and the first fix walked into the second.
        // `spawnSync`'s `timeout` must be an INTEGER, so a fractional
        // `performance.now()` remainder threw ERR_OUT_OF_RANGE, was swallowed,
        // and the read degraded with no subprocess started. But `timeout: 0`
        // installs NO kill timer, so flooring alone turned a sub-millisecond
        // remainder into an UNBOUNDED spawn — the ceiling failing OPEN in the
        // one case it exists for, which is the worse direction of the two.
        //
        // The property asserted is therefore the one the mechanism needs — a
        // positive integer — rather than mere integerness, which was the first
        // defect's symptom and would have codified the second as intended.
        const seen: number[] = [];
        const rec: Runner = (_c, _a, timeoutMs) => {
            seen.push(timeoutMs);
            return { status: 0, stdout: '{}' };
        };
        for (const left of [9_999.7, 0.5, 0.0001, 4_321.000001, 10_000.9]) {
            liveForgeApi(() => left, rec).get('x');
        }
        expect(seen.every((t) => Number.isInteger(t) && t >= 1)).toBe(true);
        expect(seen).toEqual([9_999, 1, 1, 4_321, FORGE_CALL_TIMEOUT_MS]);
    });

    it('callTimeout never returns zero, a fraction, or more than the per-call cap', () => {
        for (const left of [0, 0.4, 1, 999.9, FORGE_CALL_TIMEOUT_MS, 1e9]) {
            const t = callTimeout(left);
            expect(Number.isInteger(t)).toBe(true);
            expect(t).toBeGreaterThanOrEqual(1);
            expect(t).toBeLessThanOrEqual(FORGE_CALL_TIMEOUT_MS);
        }
    });

    it('shortens the per-call timeout to whatever the budget has left', () => {
        // The defect this closes: a call admitted at t=14.9s still ran its own
        // full 10s ceiling, so the "whole read" budget bounded admission and
        // not duration.
        const seen: number[] = [];
        const recording: Runner = (_c, _a, timeoutMs) => {
            seen.push(timeoutMs);
            return { status: 0, stdout: '{}' };
        };
        liveForgeApi(() => 250, recording).get('x');
        liveForgeApi(() => 99_000, recording).get('x');
        expect(seen).toEqual([250, FORGE_CALL_TIMEOUT_MS]);
    });

    it('asks for the paginated form only when told to', () => {
        const seen: string[][] = [];
        const recording: Runner = (_c, args) => {
            seen.push([...args]);
            return { status: 0, stdout: '[]' };
        };
        const a = liveForgeApi(() => 5_000, recording);
        a.get('repos/o/r/rulesets', true);
        a.get('repos/o/r');
        expect(seen[0]).toEqual(['api', '--paginate', '--slurp', 'repos/o/r/rulesets']);
        expect(seen[1]).toEqual(['api', 'repos/o/r']);
    });
});
