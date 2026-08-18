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
 * the diff half is exercised through `git diff` rather than through a stub.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { classifyDiff, exemptionReason } from '../../src/scripts/check_estate_count.js';

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

function roadmap(title: string, opts: { blockers?: number | undefined; exempt?: string | undefined } = {}): string {
    const fm = opts.exempt === undefined ? '' : `---\nestate_offset_exempt: ${opts.exempt}\n---\n\n`;
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

function budget(counts: { active: number; later: number; blockers: number }, above: number | null = null): string {
    return `${JSON.stringify(
        {
            schema_version: 1,
            baseline: {
                active_roadmaps: counts.active,
                later_roadmaps: counts.later,
                open_blockers: counts.blockers,
            },
            one_in_one_out: { applies_above_active: above },
        },
        null,
        4,
    )}\n`;
}

/** A repo with `n` active roadmaps and a baseline that matches them exactly. */
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
    write(
        dir,
        'src/config/estate-count-budget.json',
        budget(
            { active: n, later: opts.later ?? 0, blockers: n * (opts.blockers ?? 0) },
            opts.above ?? null,
        ),
    );
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
    it('is green when every count sits exactly at its baseline', () => {
        const repo = initRepo(3);
        const res = run(repo, ['--base', 'main']);
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('scanned: 3');
        expect(res.stdout).toContain('estate within its ratchet');
    });

    it('is RED when the active count grows above the baseline', () => {
        const repo = initRepo(3);
        // Adding a roadmap without touching the baseline is growth. This is the
        // direction that had no gate at all before this file.
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        commitAll(repo, 'add a roadmap');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('the roadmap estate grew: active_roadmaps 3 → 4');
        // The message names the two legal exits, not just the failure.
        expect(res.stderr).toContain('raise it in src/config/estate-count-budget.json');
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

    it('reports a count BELOW baseline as a free tightening and stays green', () => {
        const repo = initRepo(3);
        fs.rmSync(path.join(repo, 'agents/roadmaps/road-to-2.md'));
        commitAll(repo, 'archive one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('free tightening: active_roadmaps measured 2 under a baseline of 3');
    });

    it('exits 2, never 1, when the roadmap root is empty — a dead scope is not a pass', () => {
        // The failure this guards: move agents/roadmaps/ and every count is 0,
        // which is trivially under any baseline. Exit 1 would assert the estate
        // grew; exit 2 says the gate could not run.
        const repo = initRepo(1);
        fs.rmSync(path.join(repo, 'agents/roadmaps/road-to-0.md'));
        write(repo, 'src/config/estate-count-budget.json', budget({ active: 0, later: 0, blockers: 0 }));
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
});

describe('check_estate_count — one-in-one-out', () => {
    it('is RED on an addition with no offset in the same change', () => {
        const repo = initRepo(3);
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        // Raise the baseline so the ratchet half passes and the failure can only
        // come from the offset half — otherwise this test would pass for the
        // wrong reason.
        write(repo, 'src/config/estate-count-budget.json', budget({ active: 4, later: 0, blockers: 0 }));
        commitAll(repo, 'add a roadmap, raise the baseline');
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

    it('counts a park into later/ as an offset, and later/ growth is then the ratchet’s business', () => {
        const repo = initRepo(3, { later: 1 });
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        git(repo, 'mv', 'agents/roadmaps/road-to-2.md', 'agents/roadmaps/later/road-to-2.md');
        // later/ goes 1 → 2, so the ratchet must be told; the offset half is
        // satisfied either way. The two halves answer different questions and
        // this fixture pins that they do not shadow each other.
        write(repo, 'src/config/estate-count-budget.json', budget({ active: 3, later: 2, blockers: 0 }));
        commitAll(repo, 'add one, park one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toContain('+1 active / -1 disposed');
    });

    it('treats un-parking a later/ roadmap as an addition, not as a neutral move', () => {
        const repo = initRepo(3, { later: 1 });
        git(repo, 'mv', 'agents/roadmaps/later/parked-0.md', 'agents/roadmaps/road-to-unparked.md');
        write(repo, 'src/config/estate-count-budget.json', budget({ active: 4, later: 0, blockers: 0 }));
        commitAll(repo, 'un-park one');
        const res = run(repo, ['--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('no offset');
        expect(res.stderr).toContain('road-to-unparked.md');
    });

    it('accepts an addition carrying an estate_offset_exempt reason in its frontmatter', () => {
        const repo = initRepo(3);
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New', { exempt: 'incident follow-up, nothing to trade' }));
        write(repo, 'src/config/estate-count-budget.json', budget({ active: 4, later: 0, blockers: 0 }));
        commitAll(repo, 'add an exempt roadmap');
        const res = run(repo, ['--base', 'main']);
        expect(res.status, `${res.stdout}${res.stderr}`).toBe(0);
        expect(res.stdout).toContain('1 exempt');
    });

    it('is inert below a registered active ceiling, and live above it', () => {
        // T3 applies "while the active count sits above target". With a ceiling
        // registered ABOVE the live count the lint must not fire; the same
        // change with the ceiling below it must.
        const inert = initRepo(3, { above: 10 });
        write(inert, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        write(
            inert,
            'src/config/estate-count-budget.json',
            budget({ active: 4, later: 0, blockers: 0 }, 10),
        );
        commitAll(inert, 'add one under the ceiling');
        expect(run(inert, ['--base', 'main']).status).toBe(0);

        const live = initRepo(3, { above: 2 });
        write(live, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        write(live, 'src/config/estate-count-budget.json', budget({ active: 4, later: 0, blockers: 0 }, 2));
        commitAll(live, 'add one over the ceiling');
        expect(run(live, ['--base', 'main']).status).toBe(1);
    });

    it('reports the diff half as skipped rather than passing when no base ref resolves', () => {
        const repo = initRepo(2);
        write(repo, 'agents/roadmaps/road-to-new.md', roadmap('New'));
        write(repo, 'src/config/estate-count-budget.json', budget({ active: 3, later: 0, blockers: 0 }));
        commitAll(repo, 'add one');
        git(repo, 'branch', '-D', 'main');
        const res = run(repo);
        // Green on the count half, but the skip is PRINTED and ledgered — an
        // unevaluated check that reports nothing is the silent pass this gate's
        // own header argues against.
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('one-in-one-out not evaluated');
        expect(res.stdout).toContain('precondition_unmet');
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
                'M\tagents/roadmaps/road-to-f.md',
                'A\tagents/roadmaps/archive/road-to-g.md',
                'A\tsrc/scripts/unrelated.ts',
            ].join('\n'),
            () => null,
        );
        expect(out.added.sort()).toEqual(['agents/roadmaps/road-to-a.md', 'agents/roadmaps/road-to-d.md']);
        expect(out.offsets.sort()).toEqual(['agents/roadmaps/road-to-b.md', 'agents/roadmaps/road-to-c.md']);
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

    it('the committed budget matches the live tree, so the gate ships green', () => {
        // Vacuity guard on the registration itself: a baseline that did not
        // match the tree at registration would make the gate red on arrival,
        // which teaches the reader to ignore it.
        const res = run(REPO_ROOT, ['--json', '--base', 'origin/main']);
        expect(res.status, res.stderr).toBe(0);
        const v = JSON.parse(res.stdout.replace(/^scanned: \d+\n/, '')) as {
            counts: Record<string, number>;
            baseline: Record<string, number>;
            growth: unknown[];
        };
        expect(v.growth).toEqual([]);
        expect(v.counts['active_roadmaps']).toBe(v.baseline['active_roadmaps']);
    });
});
