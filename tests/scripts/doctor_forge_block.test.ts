/**
 * The `forge_protection` block as `doctor --json` emits it —
 * `road-to-adversarial-verification-and-long-runs` AC-5.
 *
 * The layer the two review rounds kept finding defects in, and the one that had
 * no test at all: the slug substitution and the `repository` field happen HERE,
 * while the only assertions covering them sat one layer down on
 * `forgeReadingFor`'s return value.
 *
 * The load-bearing case is the OFFLINE-WITH-A-REMOTE one. A git remote resolves
 * with no network, so an ordinary offline run reaches this function with a
 * non-null slug and an all-unread reading. The first implementation reported
 * that slug and substituted it into every source — which made the claim this
 * whole change rests on, that offline output is what Phase 3.2 shipped, false
 * on exactly the path it was supposed to cover. The earlier verification only
 * ever exercised the opt-out switch and read it as offline; they are different
 * paths and only one of them was checked.
 */

// provenance: level=L4 | critical=yes | evidence=test-quality-forge-reader-round2-2026-10-01
//
// L4 by a 2/2 council pass (anthropic + openai) over both suites in full, whose
// highest-weighted finding was that the five rows this file exists to cover
// were barely asserted at all — metadata validated, data assumed. The row-id,
// row-isolation, inactive-ruleset and source-presence cases below are that
// finding folded in. See the sibling suite's marker for the full route,
// including the first pass that was given a description instead of the code and
// correctly declined to judge it.

import { describe, expect, it } from 'vitest';

import {
    forgeProtectionJson,
    forgeProtectionJsonFor,
} from '../../src/scripts/_cli/doctor_execution.js';
import { originUrl, type Runner } from '../../src/scripts/_lib/forge_reader.js';
import { UNREAD_FORGE, type ForgeReading } from '../../src/scripts/_lib/forge_protection.js';
import type { RulesetDetail } from '../../src/scripts/_lib/platform_anchor.js';

const RULESET: RulesetDetail = {
    id: 1,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'] } },
    rules: [
        { type: 'non_fast_forward' },
        {
            type: 'required_status_checks',
            parameters: { required_status_checks: [{ context: 'CI' }] },
        },
    ],
};

const LIVE: ForgeReading = {
    rulesets: [RULESET],
    defaultBranch: 'main',
    allowAutoMerge: true,
    deployRestricted: true,
};

type Block = {
    repository: string | null;
    read_from_forge: boolean;
    rows: { id: string; state: string; source: string }[];
    actions: string[];
};

const block = (r: ForgeReading, repo: string | null): Block =>
    forgeProtectionJson(r, repo) as unknown as Block;

describe('the five rows — the product output itself', () => {
    // The council pass weighted this highest: the suites spent their effort on
    // acquisition choreography while the rows `doctor --json` actually emits —
    // the user-visible trust boundary — were barely asserted. Metadata was
    // thoroughly checked and the data was assumed correct.
    it('emits exactly the five rows, by id and in order', () => {
        expect(block(LIVE, 'o/r').rows.map((r) => r.id)).toEqual([
            'default_branch_protected',
            'required_checks_present',
            'force_push_disabled',
            'auto_merge_available',
            'deploy_via_pipeline_only',
        ]);
    });

    it('isolates each row — one falsified input moves one row and no other', () => {
        // Row isolation was never checked, so a mapper that let one input bleed
        // into a neighbouring row passed. Each case below flips exactly one
        // field and asserts exactly one state changes.
        const states = (r: ForgeReading): string[] => block(r, 'o/r').rows.map((x) => x.state);
        const base = states(LIVE);
        expect(base).toEqual(Array<string>(5).fill('satisfied'));

        const cases: [string, ForgeReading, number][] = [
            ['auto-merge', { ...LIVE, allowAutoMerge: false }, 3],
            ['deploy', { ...LIVE, deployRestricted: false }, 4],
        ];
        for (const [, reading, idx] of cases) {
            const got = states(reading);
            expect(got[idx]).toBe('unsatisfied');
            expect(got.filter((s) => s !== 'satisfied')).toHaveLength(1);
        }
    });

    it('an inactive ruleset does not protect the branch', () => {
        const inactive: ForgeReading = {
            ...LIVE,
            rulesets: [{ ...RULESET, enforcement: 'evaluate' }],
        };
        const rows = block(inactive, 'o/r').rows;
        expect(rows[0]?.state).toBe('unsatisfied');
        expect(rows[2]?.state).toBe('unsatisfied');
    });

    it('every row carries a non-empty source, satisfied or not', () => {
        for (const r of [...block(LIVE, 'o/r').rows, ...block(UNREAD_FORGE, null).rows]) {
            expect(r.source.length).toBeGreaterThan(0);
        }
    });
});

describe('originUrl — the only VCS subprocess', () => {
    const run = (r: { status: number | null; stdout?: string }): Runner => () => r;

    it('uses the rewrite-aware form and the project root', () => {
        const seen: { args: string[]; cwd?: string }[] = [];
        const rec: Runner = (_c, args, _t, cwd) => {
            seen.push({ args: [...args], ...(cwd === undefined ? {} : { cwd }) });
            return { status: 0, stdout: 'git@github.com:o/r.git\n' };
        };
        expect(originUrl('/root', rec)).toBe('git@github.com:o/r.git');
        // `remote get-url` ignores `url.insteadOf`; `ls-remote --get-url` applies it.
        expect(seen[0]?.args).toEqual(['ls-remote', '--get-url', 'origin']);
        expect(seen[0]?.cwd).toBe('/root');
    });

    it('is null on a non-zero exit, a non-string stdout, or a throw', () => {
        expect(originUrl('/root', run({ status: 1, stdout: 'x' }))).toBeNull();
        expect(originUrl('/root', run({ status: 0 }))).toBeNull();
        expect(
            originUrl('/root', () => {
                throw new Error('no git');
            }),
        ).toBeNull();
    });

    it('is null when git echoes the remote name back', () => {
        // With no such remote, `ls-remote --get-url` prints `origin` — a
        // sentinel that would otherwise parse as a repository called origin.
        expect(originUrl('/root', run({ status: 0, stdout: 'origin\n' }))).toBeNull();
        expect(originUrl('/root', run({ status: 0, stdout: '   \n' }))).toBeNull();
    });
});

describe('the repository field', () => {
    it('names the repository when something was actually read', () => {
        const b = block(LIVE, 'o/r');
        expect(b.repository).toBe('o/r');
        expect(b.read_from_forge).toBe(true);
        expect(b.rows[0]?.source).toContain('repos/o/r/');
        expect(b.rows.every((row) => !row.source.includes('{owner}'))).toBe(true);
    });

    it('reports NO repository offline, even when a slug resolved from the local remote', () => {
        // The high finding. `git` answers offline, so the slug is present while
        // every row is unread — and reporting it made the output differ from
        // the offline output Phase 3.2 shipped, which is the property the whole
        // change rests on.
        const b = block(UNREAD_FORGE, 'o/r');
        expect(b.repository).toBeNull();
        expect(b.read_from_forge).toBe(false);
        expect(b.rows.every((row) => row.state === 'unread')).toBe(true);
        expect(b.rows[0]?.source).toContain('{owner}/{repo}');
    });

    it('is byte-identical offline whether or not a slug resolved', () => {
        // The claim, asserted rather than described: the opt-out path and the
        // failed-live path produce the same document.
        expect(JSON.stringify(block(UNREAD_FORGE, 'o/r'))).toBe(
            JSON.stringify(block(UNREAD_FORGE, null)),
        );
    });

    it('substitutes into the action lines too, not only the rows', () => {
        const partial: ForgeReading = { ...LIVE, allowAutoMerge: false };
        const b = block(partial, 'o/r');
        expect(b.actions.some((a) => a.includes('repos/o/r'))).toBe(true);
        expect(b.actions.every((a) => !a.includes('{owner}'))).toBe(true);
    });

    it('is the composition root, and it is wired end to end', () => {
        // The budget, the resolve thunk, the host and the cwd are assembled
        // HERE, and that assembly had no seam and therefore no test — the
        // opt-out and the host binding were asserted one layer down against
        // fakes while a regression in the real wiring stayed invisible.
        const calls: { cmd: string; args: string[]; cwd?: string }[] = [];
        const run: Runner = (cmd, args, _t, cwd) => {
            calls.push({ cmd, args: [...args], ...(cwd === undefined ? {} : { cwd }) });
            if (cmd === 'git') return { status: 0, stdout: 'git@github.acme.com:o/r.git\n' };
            if (args.includes('repos/o/r')) {
                return { status: 0, stdout: JSON.stringify({ default_branch: 'main' }) };
            }
            return { status: 1, stdout: '' };
        };
        const b = forgeProtectionJsonFor('/some/root', { env: {}, run }) as unknown as Block;

        // The slug came from `/some/root`, so `gh` is addressed there too...
        expect(calls[0]?.cmd).toBe('git');
        expect(calls[0]?.cwd).toBe('/some/root');
        const gh = calls.filter((c) => c.cmd === 'gh');
        expect(gh.length).toBeGreaterThan(0);
        expect(gh.every((c) => c.cwd === '/some/root')).toBe(true);
        // ...and at the GHES host the remote named, not gh's default.
        expect(gh.every((c) => c.args.includes('--hostname'))).toBe(true);
        expect(gh.every((c) => c.args.includes('github.acme.com'))).toBe(true);
        // Nothing was satisfied, so nothing is named.
        expect(b.repository).toBeNull();
    });

    it('spawns nothing at all when the opt-out is set', () => {
        let spawned = 0;
        const run: Runner = () => {
            spawned += 1;
            return { status: 0, stdout: '' };
        };
        const b = forgeProtectionJsonFor('/some/root', {
            env: { AGENT_CONFIG_DOCTOR_NO_FORGE: '1' },
            run,
        }) as unknown as Block;
        expect(spawned).toBe(0);
        expect(b.read_from_forge).toBe(false);
        expect(b.repository).toBeNull();
    });

    it('treats a dollar sequence in the slug as literal text', () => {
        // `String.replace` reads `$&` in the REPLACEMENT as a control sequence.
        // `resolveForgeRepo` refuses such a slug, so this is the second line of
        // defence rather than the only one — which is why it is asserted here
        // instead of being argued from the validator.
        const b = block(LIVE, 'o/$&');
        expect(b.rows[0]?.source).toContain('repos/o/$&/');
    });
});
