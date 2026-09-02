/**
 * `check_estate_count` — the estate ratchet, proven in BOTH directions.
 *
 * `road-to-estate-drawdown` AC-3 asks for exactly that: "both gates exist and
 * are red/green against fixtures in both directions". A ratchet that has only
 * ever been observed green on the tree it was baselined against is
 * indistinguishable from a ratchet that cannot fail, which is the
 * gate-that-scans-nothing shape this repository has already recorded.
 *
 * Every case below runs the real script against a real throwaway git repo, so
 * the diff half is exercised through `git diff` rather than through a stub, and
 * the floor is measured off a real base ref rather than read from a fixture
 * number.
 *
 * REWRITTEN 2026-08-22 (ADR-243). The floor used to be a committed `baseline`
 * object in `src/config/estate-count-budget.json`; it is now MEASURED on the base
 * ref's own tree. Three describe-blocks changed shape rather than disappearing,
 * and the mapping is written down here because a deleted test looks the same as
 * a forgotten one:
 *
 * - "FAILS on a count below baseline" → INVERTED into "a drawdown is green". The
 *   un-walked-tightening class exists only because a stored number can be left
 *   above the truth; with no stored number the state is unreachable, and the test
 *   that pins the inversion is the one below asserting a drawdown passes.
 * - The five raise-check cases → REPLACED by the growth-claim cases. With nothing
 *   stored, "raise the baseline with no reason" is not a state a change can
 *   reach; the authorisation it provided is now `estate_growth_exempt`.
 * - "the committed budget matches the live tree" → became a floor-vacuity guard
 *   (`--base HEAD`), because the old assertion compared two numbers and there is
 *   now only one.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    classifyDiff,
    countEstate,
    exemptionReason,
    growthClaims,
    isCarrierText,
} from '../../src/scripts/check_estate_count.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_estate_count.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const tmpDirs: string[] = [];
afterAll(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function git(cwd: string, ...args: string[]): void {
    const res = spawnSync('git', args, { cwd, encoding: 'utf-8' });
    if (res.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
    }
}

function write(root: string, rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf-8');
}

function roadmap(
    title: string,
    opts: { blockers?: number | undefined; exempt?: string | undefined; claim?: string | undefined } = {},
): string {
    const fmLines = [
        ...(opts.exempt === undefined ? [] : [`estate_offset_exempt: ${opts.exempt}`]),
        ...(opts.claim === undefined ? [] : [`estate_growth_exempt: ${opts.claim}`]),
    ];
    const fm = fmLines.length === 0 ? '' : `---\n${fmLines.join('\n')}\n---\n\n`;
    const blockers = Array.from({ length: opts.blockers ?? 0 }, (_unused, i) =>
        [
            '',
            `### blocker: b-${String(i)}`,
            '- **Status:** open',
            '- **Owner:** user',
            '- **Class:** 2',
            '- **Blocks:** a step',
            '- **Resolved when:** answered',
        ].join('\n'),
    ).join('\n');
    return `${fm}# Roadmap: ${title}\n\n## Phase 1\n\n- [ ] **1.1** a step\n${blockers === '' ? '' : `\n## Blockers\n${blockers}\n`}`;
}

/**
 * The budget file — POLICY ONLY.
 *
 * It carries no number since ADR-243, which is why this helper no longer takes
 * counts. A fixture that wants a different floor changes the TREE at the base
 * commit, which is the whole point of the change under test.
 */
function budget(
    above: number | null = null,
    provisional: Record<string, unknown> | null = { status: 'declined', max_live: null, expires_after_days: null },
): string {
    const doc: Record<string, unknown> = { schema_version: 2, one_in_one_out: { applies_above_active: above } };
    // Passing `null` OMITS the key, which is the misconfiguration case — the one
    // an intentional declination must never be mistaken for.
    if (provisional !== null) doc['provisional_promotion'] = provisional;
    return `${JSON.stringify(doc, null, 4)}\n`;
}

const CLAIM = 'fixture — a real sentence, so the claim counts';

/** A repo with `n` active roadmaps committed on `main`, checked out on a branch. */
function initRepo(n = 3, opts: { later?: number; blockers?: number; above?: number | null } = {}): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estate-count-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'estate@test.local');
    git(dir, 'config', 'user.name', 'estate');
    git(dir, 'config', 'commit.gpgsign', 'false');
    for (let i = 0; i < n; i++) {
        write(dir, `agents/roadmaps/road-to-${String(i)}.md`, roadmap(`R${String(i)}`, { blockers: opts.blockers }));
    }
    for (let i = 0; i < (opts.later ?? 0); i++) {
        write(dir, `agents/roadmaps/later/parked-${String(i)}.md`, roadmap(`P${String(i)}`));
    }
    write(dir, 'src/config/estate-count-budget.json', budget(opts.above ?? null));
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    git(dir, 'checkout', '-qb', 'feat/change');
    return dir;
}

function run(cwd: string, args: string[] = []): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        // The resolver's PR-merge branch keys on GITHUB_ACTIONS; a temp repo has
        // no merge commit, and leaving the real CI value in place would make the
        // test's base ref depend on where it runs.
        env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_BASE_REF: '', RATCHET_BASE_REF: '' },
    });
}

function commitAll(dir: string, msg: string): void {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', msg);
}

describe('check_estate_count — the ratchet direction', () => {
    it('is green when every count sits exactly at the measured floor', () => {
        const repo = initRepo(3);
        const res = run(repo, ['--base', 'main']);
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('scanned: 3');
        expect(res.stdout).toContain('estate within its ratchet');
        // The floor is reported WITH the ref it came from: a reader who cannot
        // see which tree was measured cannot check the verdict.
        expect(res.stdout).toMatch(/active_roadmaps\s+3\s+\(floor 3 at main, \+0\)/);
    });

    it('is RED when the active count grows above the floor', () => {
        const repo = initRepo(3);
        // Adding a roadmap is growth against the base tree — and unlike the
        // stored-baseline version, no number had to be correct for this to fire.
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        commitAll(repo, 'add a roadmap');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('the roadmap estate grew: active_roadmaps 3 → 4');
        // The message names the legal exit, not just the failure.
        expect(res.stderr).toContain('estate_growth_exempt');
    });

    it('is RED when the open-blocker count grows, independently of the file count', () => {
        const repo = initRepo(2, { blockers: 1 });
        const text = fs.readFileSync(path.join(repo, 'agents/roadmaps/road-to-0.md'), 'utf-8');
        write(
            repo,
            'agents/roadmaps/road-to-0.md',
            `${text}\n### blocker: b-extra\n- **Status:** open\n- **Owner:** user\n- **Class:** 2\n- **Blocks:** x\n- **Resolved when:** answered\n`,
        );
        commitAll(repo, 'add a blocker');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('open_blockers 2 → 3');
    });

    // The INVERSION of the old "FAILS on a count below baseline" case, and the
    // single clearest thing the derived floor buys. That failure class existed
    // because a stored number could be left above the truth, leaving headroom a
    // later change could spend; it reddened `main` itself in run 32173675197 on
    // 2026-08-18, after which every later PR failed on drift it had not caused.
    // With the floor measured there is no number to leave stale, so a drawdown is
    // simply a drawdown.
    it('is GREEN on a drawdown, with nothing to walk and nothing to record', () => {
        const repo = initRepo(3);
        fs.rmSync(path.join(repo, 'agents/roadmaps/road-to-2.md'));
        commitAll(repo, 'archive one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toMatch(/active_roadmaps\s+2\s+\(floor 3 at main, -1\)/);
        // The class is gone, not renamed: no wording about walking a baseline
        // survives anywhere in the output.
        expect(res.stderr).not.toContain('un-walked');
        expect(`${res.stdout}${res.stderr}`).not.toContain('baseline');
    });

    it('exits 2, never 1, when the roadmap root is empty — a dead scope is not a pass', () => {
        // The failure this guards: move agents/roadmaps/ and every count is 0, code-comment-allow provenance-comment -- the scan root under test
        // which is trivially under any floor. Exit 1 would assert the estate
        // grew; exit 2 says the gate could not run.
        const repo = initRepo(1);
        fs.rmSync(path.join(repo, 'agents/roadmaps/road-to-0.md'));
        commitAll(repo, 'empty the estate');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('scanned 0');
    });

    it('exits 2 when the budget file is unreadable', () => {
        const repo = initRepo(2);
        write(repo, 'src/config/estate-count-budget.json', '{ not json\n');
        commitAll(repo, 'break the budget');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('unreadable');
    });

    it('exits 2 when the budget carries no policy object', () => {
        // The file holds nothing but policy now, so an empty one is a
        // could-not-run rather than "nothing to enforce".
        const repo = initRepo(2);
        write(repo, 'src/config/estate-count-budget.json', '{}\n');
        commitAll(repo, 'empty the budget');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('one_in_one_out');
    });
});

/**
 * The provisional-promotion path, specified 2026-09-01 and DECLINED the same
 * day by a 2/2 convergent council on governance-self-amendment grounds.
 *
 * The condition the council attached to the decline is the whole reason these
 * tests exist: the checker must be able to tell an intentional declination from
 * missing configuration. Two states cannot do that, so there are three, and each
 * is pinned here — plus the two directions that would quietly undo the decline,
 * a half-registered object resolving to a neighbour and a registered one buying
 * headroom.
 */
describe('check_estate_count — the provisional-promotion path', () => {
    it('reports `declined` and grants nothing — the recorded state, on the real shape', () => {
        // No commit: `initRepo` already committed the base and branched, so the
        // live tree equals the floor and the only thing under test is the line.
        const repo = initRepo(2);
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('declined');
        expect(res.stdout).toContain('path inactive by decision');
    });

    it('exits 2 when the key is ABSENT — misconfiguration is never a declination', () => {
        // The distinction the decline was conditioned on. Absent must not read
        // as "inactive": that would make an unwritten config and a refused path
        // the same reading, which is exactly what the council asked to prevent.
        const repo = initRepo(2);
        write(repo, 'src/config/estate-count-budget.json', budget(null, null));
        commitAll(repo, 'drop the provisional key');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('provisional_promotion');
    });

    it('distinguishes `unregistered` from `declined` — silence is not a decision', () => {
        const repo = initRepo(2);
        write(repo, 'src/config/estate-count-budget.json', budget(null, { max_live: null, expires_after_days: null }));
        commitAll(repo, 'no status marker');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('unregistered');
        expect(res.stdout).not.toContain('path inactive by decision');
    });

    it('exits 2 on a half-registered object rather than guessing which half was meant', () => {
        // A cap with no expiry and an expiry with no cap are different
        // mechanisms; resolving either to a neighbour is how a bounded path
        // becomes an unbounded one by omission.
        const repo = initRepo(2);
        write(repo, 'src/config/estate-count-budget.json', budget(null, { max_live: 1, expires_after_days: null }));
        commitAll(repo, 'half-register');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('half-registered');
    });

    it('READING IS NOT ACTIVATION — a registered path buys no headroom', () => {
        // The load-bearing negative. If registering two integers granted an
        // allowance, the self-certification the 2026-08-24 verdict refused would
        // arrive one commit later, wearing the owner's numbers.
        const repo = initRepo(2);
        write(repo, 'src/config/estate-count-budget.json', budget(null, { max_live: 5, expires_after_days: 30 }));
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('new'));
        commitAll(repo, 'register the path and add a roadmap');
        const res = run(repo, ['--base', 'main']);
        expect(res.stdout).toContain('registered');
        // Still red: the addition is unoffset and unexempt, exactly as it would
        // be with the path declined.
        expect(res.status).toBe(1);
    });
});

describe('check_estate_count — the floor', () => {
    it('FAILS when no base ref resolves — a shrink-only gate with no floor passes everything', () => {
        // The class that replaces the old bare-raise refusal: with nothing stored,
        // the way to silence this gate is to deny it a floor. The old gate reported
        // "unproven" and exited 0 on this input, which under a measured floor would
        // be a green over an unevaluated verdict.
        const repo = initRepo(2);
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        commitAll(repo, 'add one');
        git(repo, 'branch', '-D', 'main');
        const res = run(repo);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(1);
        expect(res.stderr).toContain('no floor');
        // The remedy is named, and it is the flag the fixtures themselves use.
        expect(res.stderr).toContain('--base origin/main');
        // The diff half still reports its own skip rather than vanishing.
        expect(res.stdout).toContain('one-in-one-out not evaluated');
        expect(res.stdout).toContain('precondition_unmet');
    });

    it('FAILS rather than measuring zero when the base ref has no roadmap subtree', () => {
        // The silent-zero shape `_lib/base_tree` exists to refuse: an absent
        // subtree, a typo and an export-ignore all produce an empty read, and a
        // floor of 0 is a green light for unbounded growth.
        const repo = initRepo(2);
        const res = run(repo, ['--base', 'HEAD:agents']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('no floor');
    });

    it('measures the floor off the tree, so an edited budget file cannot move it', () => {
        // The property that made the old design a ratchet at all — the change under
        // review cannot rewrite the "before" side — restated for the new one. Here
        // the fixture tries the old bypass: touch nothing but the config.
        const repo = initRepo(3);
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        // Built from the helper so the file keeps every key the gate now
        // requires; the only thing this case adds is the stored number the old
        // bypass used to lean on.
        const edited = { ...(JSON.parse(budget()) as Record<string, unknown>), baseline: { active_roadmaps: 99 } };
        write(repo, 'src/config/estate-count-budget.json', `${JSON.stringify(edited, null, 4)}\n`);
        commitAll(repo, 'add a roadmap and type a big number');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, res.stdout).toBe(1);
        expect(res.stderr).toContain('active_roadmaps 3 → 4');
    });
});

describe('check_estate_count — growth claims', () => {
    it('accepts growth a claim added in this change authorises, and prints the reason', () => {
        const repo = initRepo(3, { blockers: 1 });
        write(repo, 'agents/roadmaps/road-to-0.md', roadmap('R0', { blockers: 2, claim: CLAIM }));
        commitAll(repo, 'discover a blocker and claim it');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toContain('growth claimed in agents/roadmaps/road-to-0.md');
        expect(res.stdout).toContain(CLAIM);
        expect(res.stdout).toContain('authorised by the claim above');
    });

    it('refuses a claim that was already in the file at base — no banking', () => {
        // The anti-banking property, and the reason claims are read from the PATCH
        // rather than from the file. A stored baseline could be over-raised once and
        // spent by every later change; this shape has no equivalent.
        const repo = initRepo(2);
        git(repo, 'checkout', '-q', 'main');
        write(repo, 'agents/roadmaps/road-to-0.md', roadmap('R0', { claim: CLAIM }));
        commitAll(repo, 'bank a claim at base');
        git(repo, 'checkout', '-q', 'feat/change');
        git(repo, 'merge', '-q', 'main');
        write(repo, 'agents/roadmaps/road-to-0.md', roadmap('R0', { blockers: 1, claim: CLAIM }));
        commitAll(repo, 'spend the banked claim');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, res.stdout).toBe(1);
        expect(res.stderr).toContain('open_blockers 0 → 1');
    });

    it('refuses a bare claim marker with no reason', () => {
        const repo = initRepo(2);
        write(repo, 'agents/roadmaps/road-to-0.md', `---\nestate_growth_exempt:\n---\n\n${roadmap('R0', { blockers: 1 })}`);
        commitAll(repo, 'claim nothing');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('open_blockers 0 → 1');
    });
});

describe('check_estate_count — one-in-one-out', () => {
    it('is RED on an addition with no offset in the same change', () => {
        const repo = initRepo(3);
        // The addition carries a growth claim so the COUNT half passes and the
        // failure can only come from the offset half — otherwise this test would
        // pass for the wrong reason. The old fixture bought that isolation with a
        // pre-raised baseline, which no longer exists.
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New', { claim: CLAIM }));
        commitAll(repo, 'add a roadmap and claim the growth');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).not.toContain('the roadmap estate grew');
        expect(res.stderr).toContain('1 new active roadmap(s) with no offset');
        expect(res.stderr).toContain('road-to-new.md');
    });

    it('is GREEN when the addition is paid for by an archive move in the same change', () => {
        const repo = initRepo(3);
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        fs.mkdirSync(path.join(repo, 'agents/roadmaps/archive'), { recursive: true });
        git(repo, 'mv', 'agents/roadmaps/road-to-2.md', 'agents/roadmaps/archive/road-to-2.md');
        commitAll(repo, 'add one, archive one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toContain('+1 active / -1 disposed');
    });

    it('lets a park pay for an addition AND covers the later/ growth it causes', () => {
        const repo = initRepo(3, { later: 1 });
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        git(repo, 'mv', 'agents/roadmaps/road-to-2.md', 'agents/roadmaps/later/road-to-2.md');
        // later/ goes 1 → 2. Under a stored baseline that cost a recorded raise;
        // under a measured floor it is covered by the parking allowance, because
        // parking relocates estate rather than creating it. The offset half is
        // satisfied either way, and the two halves still answer different
        // questions — this fixture pins that they do not shadow each other.
        commitAll(repo, 'add one, park one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toContain('+1 active / -1 disposed, 1 parked');
        expect(res.stdout).toMatch(/later_roadmaps\s+2\s+\(floor 1 at main, \+1\)/);
    });

    it('refuses a later/ roadmap that no park in this change accounts for', () => {
        // The other side of that allowance, and the reason it is keyed on parking
        // rather than on any offset: a later/ file nothing was parked into is
        // estate arriving for free.
        const repo = initRepo(3, { later: 1 });
        write(repo, 'agents/roadmaps/later/parked-new.md', roadmap('P-new'));
        commitAll(repo, 'grow later/ from nowhere');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('later_roadmaps 1 → 2');
    });

    it('does not let an ARCHIVE move buy a new later/ file', () => {
        // Keyed on parking, not on offsets: archiving one roadmap and adding a
        // parked one is a swap the allowance must not cover.
        const repo = initRepo(3, { later: 1 });
        fs.mkdirSync(path.join(repo, 'agents/roadmaps/archive'), { recursive: true });
        git(repo, 'mv', 'agents/roadmaps/road-to-2.md', 'agents/roadmaps/archive/road-to-2.md');
        write(repo, 'agents/roadmaps/later/parked-new.md', roadmap('P-new'));
        commitAll(repo, 'archive one, add a parked one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, res.stdout).toBe(1);
        expect(res.stderr).toContain('later_roadmaps 1 → 2');
    });

    it('treats un-parking a later/ roadmap as an addition, not as a neutral move', () => {
        const repo = initRepo(3, { later: 1 });
        git(repo, 'mv', 'agents/roadmaps/later/parked-0.md', 'agents/roadmaps/road-to-unparked.md');
        commitAll(repo, 'un-park one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('no offset');
        expect(res.stderr).toContain('road-to-unparked.md');
    });

    it('accepts an addition carrying an estate_offset_exempt reason in its frontmatter', () => {
        const repo = initRepo(3);
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New', { exempt: 'incident follow-up, nothing to trade' }));
        commitAll(repo, 'add an exempt roadmap');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toContain('1 exempt');
        // The exemption must raise the COUNT allowance too, or the sanctioned
        // un-offsettable addition would fail the other half with no green path.
        expect(res.stdout).toMatch(/active_roadmaps\s+4\s+\(floor 3 at main, \+1\)/);
    });

    it('is inert below a registered active ceiling, and live above it', () => {
        // T3 applies "while the active count sits above target". With a ceiling
        // registered ABOVE the live count the lint must not fire; the same change
        // with the ceiling below it must. Both fixtures claim the growth so the
        // count half cannot be the reason either way.
        const inert = initRepo(3, { above: 10 });
        write(inert, 'agents/roadmaps/road-to-new.md', roadmap('New', { claim: CLAIM }));
        commitAll(inert, 'add one under the ceiling');
        expect(run(inert, ['--base', 'main']).status).toBe(0);

        const live = initRepo(3, { above: 2 });
        write(live, 'agents/roadmaps/road-to-new.md', roadmap('New', { claim: CLAIM }));
        commitAll(live, 'add one over the ceiling');
        expect(run(live, ['--base', 'main']).status).toBe(1);
    });
});

describe('check_estate_count — unit surface', () => {
    it('classifyDiff reads renames by direction, not as bare adds and deletes', () => {
        const out = classifyDiff(
            [
                'A\tagents/roadmaps/road-to-a.md',
                'D\tagents/roadmaps/road-to-b.md',
                'R100\tagents/roadmaps/road-to-c.md\tagents/roadmaps/archive/road-to-c.md',
                'R100\tagents/roadmaps/later/road-to-d.md\tagents/roadmaps/road-to-d.md',
                'R100\tagents/roadmaps/road-to-e.md\tagents/roadmaps/road-to-e2.md',
                'R100\tagents/roadmaps/road-to-p.md\tagents/roadmaps/later/road-to-p.md',
                'M\tagents/roadmaps/road-to-f.md',
                'A\tagents/roadmaps/archive/road-to-g.md',
                'A\tsrc/scripts/unrelated.ts',
            ].join('\n'),
            () => null,
        );
        expect(out.added.sort()).toEqual(['agents/roadmaps/road-to-a.md', 'agents/roadmaps/road-to-d.md']);
        expect(out.offsets.sort()).toEqual([
            'agents/roadmaps/road-to-b.md',
            'agents/roadmaps/road-to-c.md',
            'agents/roadmaps/road-to-p.md',
        ]);
        // Parking is a SUBSET of offsets, reported by its destination: it is the
        // one offset that raises another gated count.
        expect(out.parked).toEqual(['agents/roadmaps/later/road-to-p.md']);
        // A top-level rename is neither an addition nor an offset, a modify is
        // not an addition, and neither an archive-only add nor a non-roadmap
        // path is in scope at all.
        expect(out.added).not.toContain('agents/roadmaps/road-to-e2.md');
        expect(out.added).not.toContain('agents/roadmaps/archive/road-to-g.md');
    });

    it('exemptionReason accepts a real reason and refuses an empty or absent one', () => {
        expect(exemptionReason('---\nestate_offset_exempt: because X\n---\n# R\n')).toBe('because X');
        expect(exemptionReason('---\nestate_offset_exempt: "quoted reason"\n---\n# R\n')).toBe('quoted reason');
        // A bare key is not a reason. The exemption costs a sentence on purpose.
        expect(exemptionReason('---\nestate_offset_exempt: ""\n---\n# R\n')).toBeNull();
        expect(exemptionReason('---\nestate_offset_exempt:\n---\n# R\n')).toBeNull();
        expect(exemptionReason('---\ncomplexity: lightweight\n---\n# R\n')).toBeNull();
        expect(exemptionReason('# R\n')).toBeNull();
    });

    it('growthClaims reads ADDED lines only, and attributes each to its file', () => {
        const patch = [
            'diff --git a/agents/roadmaps/road-to-a.md b/agents/roadmaps/road-to-a.md',
            '--- a/agents/roadmaps/road-to-a.md',
            '+++ b/agents/roadmaps/road-to-a.md',
            '@@ -1,0 +2 @@',
            '+estate_growth_exempt: a blocker surfaced while doing the work',
            'diff --git a/agents/roadmaps/road-to-b.md b/agents/roadmaps/road-to-b.md',
            '--- a/agents/roadmaps/road-to-b.md',
            '+++ b/agents/roadmaps/road-to-b.md',
            '@@ -2 +2 @@',
            '-estate_growth_exempt: a reason being REMOVED authorises nothing',
            '+something else',
        ].join('\n');
        const out = growthClaims(patch);
        expect(out).toEqual([
            { file: 'agents/roadmaps/road-to-a.md', reason: 'a blocker surfaced while doing the work' },
        ]);
    });

    it('growthClaims refuses an empty reason and ignores the +++ header line', () => {
        // `+++ b/...` starts with `+` and must never be read as a claim line; an
        // empty reason is the silent exception the key exists to replace.
        expect(growthClaims('+++ b/estate_growth_exempt: x\n')).toEqual([]);
        expect(growthClaims('+++ b/agents/roadmaps/r.md\n+estate_growth_exempt:\n')).toEqual([]);
        expect(growthClaims('+++ b/agents/roadmaps/r.md\n+estate_growth_exempt: "quoted"\n')).toEqual([
            { file: 'agents/roadmaps/r.md', reason: 'quoted' },
        ]);
    });

    it('is green against its own repository with the floor taken at HEAD', () => {
        // Vacuity guard on the change itself: the gate must not ship red on the
        // tree it lands in. Measured at HEAD rather than at origin/main on purpose
        // — a branch that is behind main legitimately reads as growth (see the
        // gate's own § WHY THE FLOOR IS MAIN'S TIP), and a test that depends on
        // remote freshness is a test that fails for the wrong reason.
        const res = run(REPO_ROOT, ['--json', '--base', 'HEAD']);
        expect(res.status, res.stderr).toBe(0);
        const v = JSON.parse(res.stdout) as {
            counts: Record<string, number>;
            floor: Record<string, number> | null;
            growth: unknown[];
        };
        expect(v.growth).toEqual([]);
        expect(v.floor).not.toBeNull();
        expect(v.counts['active_roadmaps']).toBe((v.floor as Record<string, number>)['active_roadmaps']);
    });
});

describe('check_estate_count — the metric corrections (R2 findings 3, 4, 6)', () => {
    it('does NOT drop the blocker count when a roadmap is parked into later/', () => {
        // Finding 3. Counting open_blockers over the active tree alone meant a park
        // shrank the gated number without resolving anything — and the gate then
        // printed "free tightening" over a burial, inviting a permanent drop.
        const repo = initRepo(2, { blockers: 2 });
        fs.mkdirSync(path.join(repo, 'agents/roadmaps/later'), { recursive: true });
        git(repo, 'mv', 'agents/roadmaps/road-to-1.md', 'agents/roadmaps/later/road-to-1.md');
        commitAll(repo, 'park a roadmap with blockers');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        // 4 blockers before, 4 after — the park moved them, it did not resolve them.
        // Matched by regex, not by exact padding: a column-width change is not a
        // behaviour change and must not red this.
        expect(res.stdout).toMatch(/open_blockers\s+4\s+\(floor 4 at main, \+0\)/);
    });

    it('charges un-stubbing as an addition — stubs/ is a recognised disposition', () => {
        // Finding 4. `stubs/` was neither counted nor an offset destination, so the
        // documented promotion path was classified as neither and could never be
        // charged: an active roadmap arriving for free.
        const repo = initRepo(3);
        write(repo, 'agents/roadmaps/stubs/road-to-stub.md', roadmap('Stub'));
        commitAll(repo, 'add a stub at base-ish');
        git(repo, 'mv', 'agents/roadmaps/stubs/road-to-stub.md', 'agents/roadmaps/road-to-stub.md');
        write(repo, 'agents/roadmaps/road-to-stub.md', roadmap('Stub', { claim: CLAIM }));
        commitAll(repo, 'un-stub it');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('no offset');
        expect(res.stderr).toContain('road-to-stub.md');
    });

    it('does not count later/README.md as a parked roadmap', () => {
        // Finding 6. The first version listed *.md, so the count described N
        // roadmaps plus a README — inconsistent with the active side's own filter.
        const repo = initRepo(2, { later: 1 });
        write(repo, 'agents/roadmaps/later/README.md', '# Parked roadmaps\n\nWhat this directory is for.\n');
        commitAll(repo, 'document the later dir');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toMatch(/later_roadmaps\s+1\s+\(floor 1 at main, \+0\)/);
    });
});

describe('check_estate_count — argv and output contracts (R2 findings 2, 7)', () => {
    it('emits stdout that is one JSON document under --json', () => {
        // Finding 2. `scanned:` went to stdout unconditionally, so stdout was
        // "scanned: N" followed by the object — and the test regex-stripped the
        // prefix, which turned the defect into the calling convention.
        const repo = initRepo(3);
        const res = run(repo, ['--base', 'main', '--json']);
        expect(res.status, res.stderr).toBe(0);
        const parsed = JSON.parse(res.stdout) as {
            counts: Record<string, number>;
            claims: unknown[];
            floorRef: string;
        };
        expect(parsed.counts['active_roadmaps']).toBe(3);
        expect(parsed.claims).toEqual([]);
        expect(parsed.floorRef).toBe('main');
        // The count is not lost — it moves to stderr, where the coverage guard
        // also reads it.
        expect(res.stderr).toContain('scanned: 3');
    });

    it('refuses `--base` with no ref instead of taking the next flag as one', () => {
        // Finding 7. `--base --json` took `--json` as the ref, which failed as a
        // git revision and silently downgraded both halves to "unproven" — a
        // green run over two unevaluated checks.
        const repo = initRepo(3);
        const res = run(repo, ['--base', '--json']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('usage:');
    });
});

/**
 * The skill corpus, added as a fourth and fifth metric 2026-08-24.
 *
 * Every case here drives the REAL binary over a git repo whose base ref carries
 * a committed skill tree, so the floor is measured off that tree — Phase 2.1's
 * verify line asks specifically for a test proving the floor comes from the base
 * ref rather than from the config, and the config carries no skill number at all.
 */
describe('check_estate_count — the skill estate', () => {
    /** A skill directory with a one-line description. */
    function skill(name: string, description: string, lifecycle?: string): string {
        const lc = lifecycle === undefined ? '' : `lifecycle: ${lifecycle}\n`;
        return `---\nname: ${name}\n${lc}description: ${description}\n---\n\n# ${name}\n`;
    }

    /** `initRepo` plus `k` committed skills on the base ref. */
    function initRepoWithSkills(k: number): string {
        const dir = initRepo(3);
        git(dir, 'checkout', '-q', 'main');
        for (let i = 0; i < k; i++) {
            write(dir, `src/skills/s${String(i)}/SKILL.md`, skill(`s${String(i)}`, `Does thing ${String(i)}.`));
        }
        commitAll(dir, 'skills');
        git(dir, 'checkout', '-q', 'feat/change');
        git(dir, 'merge', '-q', '--no-edit', 'main');
        return dir;
    }

    it('reports both dimensions with a floor read off the base ref', () => {
        const repo = initRepoWithSkills(4);
        const r = run(repo, ['--base', 'main']);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/skill_count\s+4\s+\(floor 4 at main/);
        expect(r.stdout).toMatch(/skill_description_tokens\s+\d+\s+\(floor \d+ at main/);
    });

    it('FAILS on one added skill, and the config holds no number that could have said so', () => {
        const repo = initRepoWithSkills(4);
        write(repo, 'src/skills/s99/SKILL.md', skill('s99', 'An added skill.'));
        commitAll(repo, 'add a skill');
        const r = run(repo, ['--base', 'main']);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('the skill estate grew: skill_count 4 → 5');
        // The floor is not in the budget file: grep proves it, so a reader cannot
        // conclude the 4 came from configuration.
        const cfg = fs.readFileSync(path.join(repo, 'src/config/estate-count-budget.json'), 'utf8');
        expect(cfg).not.toMatch(/skill_count"?\s*:\s*\d/);
    });

    it('names the SKILL estate, not the roadmap estate', () => {
        // The noun was unconditional before this metric existed.
        const repo = initRepoWithSkills(2);
        write(repo, 'src/skills/extra/SKILL.md', skill('extra', 'One more.'));
        commitAll(repo, 'grow');
        expect(run(repo, ['--base', 'main']).stderr).toContain('the skill estate grew');
    });

    it('FAILS on a longer description with the count unchanged', () => {
        // The gaming path the second dimension closes: no new file, more payload.
        const repo = initRepoWithSkills(3);
        write(
            repo,
            'src/skills/s0/SKILL.md',
            skill('s0', 'A substantially longer description with a great many additional words in it.'),
        );
        commitAll(repo, 'pad a description');
        const r = run(repo, ['--base', 'main']);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('skill_description_tokens');
        expect(r.stderr).not.toContain('skill_count 3 → ');
    });

    it('deprecating a skill LOWERS the count — retirement buys headroom', () => {
        const repo = initRepoWithSkills(3);
        write(repo, 'src/skills/s2/SKILL.md', skill('s2', 'Does thing 2.', 'deprecated'));
        commitAll(repo, 'deprecate s2');
        const r = run(repo, ['--base', 'main']);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/skill_count\s+2\s+\(floor 3 at main/);
    });

    it('a base ref with NO skill tree drops the skill metrics with a stated reason', () => {
        // Never silently zero: a floor of 0 against a live 299 would fail every
        // branch, and a silent skip would pass every tree.
        const repo = initRepo(3); // base ref has no src/skills at all
        write(repo, 'src/skills/fresh/SKILL.md', skill('fresh', 'Brand new.'));
        commitAll(repo, 'first skill ever');
        const r = run(repo, ['--base', 'main']);
        expect(r.stdout + r.stderr).toContain('skill_count not compared');
        expect(r.stdout + r.stderr).toMatch(/could not read src\/skills at main/);
        expect(r.status).toBe(0);
    });

    it('a skill addition can be claimed like any other growth', () => {
        const repo = initRepoWithSkills(2);
        write(repo, 'src/skills/claimed/SKILL.md', skill('claimed', 'Justified addition.'));
        // The helper's own `claim` option, not a string replace: `roadmap()`
        // emits no frontmatter block at all when neither option is set, so a
        // replace had nothing to anchor on and the claim never reached the diff.
        write(
            repo,
            'agents/roadmaps/road-to-0.md',
            roadmap('R0', { claim: '"A real sentence explaining why this skill had to land here."' }),
        );
        commitAll(repo, 'add a skill with a claim');
        expect(run(repo, ['--base', 'main']).status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// The `status: carrier` term, which had no unit coverage at all when it landed.
// ---------------------------------------------------------------------------

/** A carrier, as its frontmatter declares it. */
const CARRIER_TEXT = '---\nstatus: carrier\n---\n# Roadmap: c\n\n## Phase 1\n\n- [~] **1.1** s\n';

describe('isCarrierText reads the frontmatter, and only the frontmatter', () => {
    it('accepts the declaration and rejects every near-miss', () => {
        expect(isCarrierText(CARRIER_TEXT)).toBe(true);
        expect(isCarrierText('---\ncomplexity: bounded\nstatus: carrier\n---\n# c\n')).toBe(true);
        expect(isCarrierText(null)).toBe(false);
        expect(isCarrierText(roadmap('plain'))).toBe(false);
        expect(isCarrierText('---\nstatus: ready\n---\n# c\n')).toBe(false);
        // A body mention is documentation, never a declaration.
        expect(isCarrierText('---\nstatus: ready\n---\n# c\n\nstatus: carrier\n')).toBe(false);
        // No frontmatter block at all.
        expect(isCarrierText('status: carrier\n# c\n')).toBe(false);
    });
});

describe('classifyDiff scores a carrier removal at zero credit', () => {
    const nameStatus = (status: string, file: string): string => `${status}\t${file}`;
    const none = (): null => null;

    it('gives no offset for a deleted carrier, and one for a deleted ordinary roadmap', () => {
        const deleted = nameStatus('D', 'agents/roadmaps/road-to-x.md');
        const asCarrier = classifyDiff(deleted, none, () => CARRIER_TEXT);
        expect(asCarrier.offsets).toEqual([]);
        const asOrdinary = classifyDiff(deleted, none, () => roadmap('x'));
        expect(asOrdinary.offsets).toEqual(['agents/roadmaps/road-to-x.md']);
    });

    it('gives no offset for a carrier ARCHIVED by rename, and one for an ordinary roadmap', () => {
        const moved = 'R100\tagents/roadmaps/road-to-x.md\tagents/roadmaps/archive/road-to-x.md';
        expect(classifyDiff(moved, none, () => CARRIER_TEXT).offsets).toEqual([]);
        expect(classifyDiff(moved, none, () => roadmap('x')).offsets).toEqual([
            'agents/roadmaps/road-to-x.md',
        ]);
    });

    it('defaults to the pre-carrier scoring when the caller supplies no base reader', () => {
        // The documented default of `readBase`: a caller that cannot produce a
        // pre-image keeps the old answer rather than silently getting a new one.
        const deleted = nameStatus('D', 'agents/roadmaps/road-to-x.md');
        expect(classifyDiff(deleted, none).offsets).toEqual(['agents/roadmaps/road-to-x.md']);
    });
});

describe('countEstate counts a carrier as the estate it is', () => {
    it('is unchanged by a status flip in either direction', () => {
        const repo = initRepo(3);
        const before = countEstate(repo).active_roadmaps;
        write(repo, 'agents/roadmaps/road-to-2.md', CARRIER_TEXT);
        expect(countEstate(repo).active_roadmaps).toBe(before);
        write(repo, 'agents/roadmaps/road-to-2.md', roadmap('R2'));
        expect(countEstate(repo).active_roadmaps).toBe(before);
    });

    it('counts an added carrier as growth rather than as free estate', () => {
        const repo = initRepo(3);
        const before = countEstate(repo).active_roadmaps;
        write(repo, 'agents/roadmaps/road-to-fresh-carrier.md', CARRIER_TEXT);
        expect(countEstate(repo).active_roadmaps).toBe(before + 1);
    });

    it('leaves a parked carrier out of open_blockers, exactly as it leaves a draft out', () => {
        const repo = initRepo(1);
        const before = countEstate(repo).open_blockers;
        const withBlocker = roadmap('P', { blockers: 2 });
        write(repo, 'agents/roadmaps/later/parked-carrier.md', withBlocker);
        expect(countEstate(repo).open_blockers).toBe(before + 2);
        write(
            repo,
            'agents/roadmaps/later/parked-carrier.md',
            `---\nstatus: carrier\n---\n\n${withBlocker}`,
        );
        expect(countEstate(repo).open_blockers).toBe(before);
    });
});
