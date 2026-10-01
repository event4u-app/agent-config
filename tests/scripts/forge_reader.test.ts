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

// provenance: level=L0 | critical=no | evidence=none

import { describe, expect, it } from 'vitest';

import {
    forgeReadingFor,
    readForge,
    resolveForgeRepo,
    withDeadline,
    type ForgeApi,
} from '../../src/scripts/_lib/forge_reader.js';
import { UNREAD_FORGE } from '../../src/scripts/_lib/forge_protection.js';

/** The live shape of this repository's own payloads, read 2026-09-30. */
const REPO_RECORD = { default_branch: 'main', allow_auto_merge: true };
const RULESET_SUMMARY = [{ id: 17749383 }];
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
): ForgeApi & { readonly calls: string[] } {
    const calls: string[] = [];
    return {
        calls,
        get(apiPath: string): unknown | null {
            calls.push(apiPath);
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

describe('readForge — the happy path', () => {
    it('reads all four fields from the live payload shapes', () => {
        const reading = readForge('o/r', api(FULL));
        expect(reading.defaultBranch).toBe('main');
        expect(reading.allowAutoMerge).toBe(true);
        expect(reading.rulesets).toHaveLength(1);
        expect(reading.deployRestricted).toBe(true);
    });
});

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

    it('a failed branch-policy read falls back to the flag rather than refuting the row', () => {
        // Omitting the env from `patternsByEnv` is the documented NARROWER
        // guarantee — the names were not checked. Reporting `false` instead
        // would invent a refutation out of a read that never happened.
        const reading = readForge(
            'o/r',
            api({
                ...FULL,
                'repos/o/r/environments/github-pages/deployment-branch-policies': null,
            }),
        );
        expect(reading.deployRestricted).toBe(true);
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

describe('resolveForgeRepo', () => {
    it('reads owner/repo from the ssh and https forms', () => {
        expect(resolveForgeRepo('git@github.com:event4u-app/agent-config.git')).toBe(
            'event4u-app/agent-config',
        );
        expect(resolveForgeRepo('https://github.com/event4u-app/agent-config')).toBe(
            'event4u-app/agent-config',
        );
    });

    it('refuses a remote on a host that is not GitHub-shaped', () => {
        // `gh api` speaks GitHub. Spawning it against a GitLab remote buys a
        // doomed process on every `doctor` run; the row is `unread` either way.
        expect(resolveForgeRepo('git@gitlab.com:o/r.git')).toBeNull();
        expect(resolveForgeRepo('https://bitbucket.org/o/r.git')).toBeNull();
    });

    it('accepts a GitHub Enterprise host carrying the vendor name', () => {
        expect(resolveForgeRepo('https://github.acme.com/o/r.git')).toBe('o/r');
    });

    it('is null for an absent or unparseable remote', () => {
        expect(resolveForgeRepo(null)).toBeNull();
        expect(resolveForgeRepo('')).toBeNull();
        expect(resolveForgeRepo('not-a-remote')).toBeNull();
    });
});

describe('forgeReadingFor — the opt-out', () => {
    /** A repo resolver that records whether it ran at all. */
    function resolver(value: string | null): (() => string | null) & { ran: () => number } {
        let n = 0;
        const f = (): string | null => {
            n += 1;
            return value;
        };
        return Object.assign(f, { ran: () => n });
    }

    it('reads the forge when nothing opts out', () => {
        const a = api(FULL);
        const reading = forgeReadingFor({ env: {}, resolveRepo: resolver('o/r'), api: a });
        expect(reading.defaultBranch).toBe('main');
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
            api: a,
        });
        expect(reading).toEqual(UNREAD_FORGE);
        expect(a.calls).toEqual([]);
    });

    it('the opt-out runs before the repository is even resolved', () => {
        // The council's 1b condition, in one assertion: an opt-out that only
        // skips the API calls still spawns `git remote get-url` to work out a
        // repository it will not use. "No network" has to mean no subprocess at
        // all, or the switch does not say what it claims.
        const r = resolver('o/r');
        const a = api(FULL);
        forgeReadingFor({ env: { AGENT_CONFIG_DOCTOR_NO_FORGE: '1' }, resolveRepo: r, api: a });
        expect(r.ran()).toBe(0);
        expect(a.calls).toEqual([]);
    });

    it('honours the general offline switch too', () => {
        const a = api(FULL);
        expect(
            forgeReadingFor({
                env: { AGENT_CONFIG_OFFLINE: '1' },
                resolveRepo: resolver('o/r'),
                api: a,
            }),
        ).toEqual(UNREAD_FORGE);
        expect(a.calls).toEqual([]);
    });

    it('makes NO call when no repository resolves', () => {
        const a = api(FULL);
        expect(forgeReadingFor({ env: {}, resolveRepo: resolver(null), api: a })).toEqual(
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
            forgeReadingFor({ env: {}, resolveRepo: resolver('o/r'), api: thrower }),
        ).toEqual(UNREAD_FORGE);
    });

    it('never throws when resolving the repository throws', () => {
        const boom = (): string | null => {
            throw new Error('git exploded');
        };
        expect(forgeReadingFor({ env: {}, resolveRepo: boom, api: api(FULL) })).toEqual(
            UNREAD_FORGE,
        );
    });
});

describe('withDeadline — the whole-command budget', () => {
    // The council's 1b condition: five per-call timeouts bound each call and
    // nothing bounds their SUM, so the advertised ceiling can be exceeded by a
    // factor of five without any single call misbehaving.
    it('passes calls through while the budget holds', () => {
        const a = api(FULL);
        const reading = readForge('o/r', withDeadline(a, () => false));
        expect(reading.defaultBranch).toBe('main');
    });

    it('a budget exhausted before the first call yields the unread reading', () => {
        const a = api(FULL);
        const reading = readForge('o/r', withDeadline(a, () => true));
        expect(reading).toEqual(UNREAD_FORGE);
        expect(a.calls).toEqual([]);
    });

    it('a budget exhausted mid-read degrades the unreached rows to unread, never to false', () => {
        // The direction that matters: a partially spent budget must not be able
        // to turn "we ran out of time" into "the forge says no".
        let calls = 0;
        const a = api(FULL);
        const reading = readForge(
            'o/r',
            withDeadline(a, () => {
                calls += 1;
                return calls > 1; // the repo record goes through; nothing after it does.
            }),
        );
        expect(reading.defaultBranch).toBe('main');
        expect(reading.rulesets).toBeNull();
        expect(reading.deployRestricted).toBeNull();
    });
});
