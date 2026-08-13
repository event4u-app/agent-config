/**
 * Fixture tests for `src/scripts/sweep_dead_scan_roots.ts`.
 *
 * Every fixture below was added because a measured run got it WRONG — this
 * file is the regression record of the criterion's evidence log, not a
 * hand-invented matrix. Two of them are the sharpest: the dual fixture pins
 * both directions of the precision/recall trade in one pair (a spec-table
 * root must confirm, a predicate-only iteration must not), because the
 * revision that fixed one of them broke the other.
 *
 * The exit contract gets its own block: one meaning per code is the whole
 * point of separating them, so each branch is demonstrated rather than
 * asserted in prose. The stale-without-findings branch runs against an
 * isolated fixture tree — on the real repo it is unreachable while genuine
 * class-A findings exist, and an unreachable branch is an unproven contract.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    analyze,
    buildCensus,
    censusOnlyRoots,
    classify,
    countUnits,
    isNonGateScript,
    resolveRoot,
    rootExists,
    main,
    renderCensus,
    selfTest,
} from '../../src/scripts/sweep_dead_scan_roots.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', 'sweep_dead_scan_roots.ts');

const tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
}
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

/** Analyse a synthetic gate body against the real repo root. */
function scan(lines: string[]): { confirmed: Set<string>; unproven: Set<string> } {
    const r = analyze(lines.join('\n'), REPO);
    return {
        confirmed: new Set(r.confirmed.map((h) => h.rel)),
        unproven: new Set(r.unproven.map((h) => h.rel)),
    };
}

const ABSENT = "agents', 'sweep-fixture-absent";

describe('sweep_dead_scan_roots — evidence fixtures', () => {
    it('1. direct read of a missing root → CONFIRMED', () => {
        const { confirmed } = scan([
            `const DEAD = path.join(ROOT, '${ABSENT}-a');`,
            'fs.readdirSync(DEAD);',
        ]);
        expect(confirmed).toContain('agents/sweep-fixture-absent-a');
    });

    it('2. helper-mediated read → CONFIRMED (the mode a top-level-consts-only cut missed)', () => {
        const { confirmed } = scan([
            'function _isDirX(p) { return fs.statSync(p).isDirectory(); }',
            `const dead = path.join(ROOT, '${ABSENT}-b');`,
            '_isDirX(dead);',
        ]);
        expect(confirmed).toContain('agents/sweep-fixture-absent-b');
    });

    it('3. predicate-only membership literal → NOT confirmed (path-as-predicate)', () => {
        const { confirmed, unproven } = scan([
            `const ALLOW = path.join(ROOT, '${ABSENT}-c');`,
            'if (candidate.startsWith(ALLOW)) { ok = true; }',
        ]);
        expect(confirmed).not.toContain('agents/sweep-fixture-absent-c');
        expect(unproven).toContain('agents/sweep-fixture-absent-c');
    });

    it('4. write-only output path → reported in neither list', () => {
        const { confirmed, unproven } = scan([
            `const OUT = path.join(ROOT, 'agents', 'reports', 'sweep-fixture-absent-out.json');`,
            "fs.writeFileSync(OUT, 'x');",
        ]);
        expect(confirmed).not.toContain('agents/reports/sweep-fixture-absent-out.json');
        expect(unproven).not.toContain('agents/reports/sweep-fixture-absent-out.json');
    });

    it('5. array-literal roots, loop variable reads → EVERY member confirmed', () => {
        const { confirmed } = scan([
            `const SCAN_ROOTS = [path.join(ROOT, '${ABSENT}-d'), path.join(ROOT, '${ABSENT}-e')];`,
            'for (const r of SCAN_ROOTS) { fs.readdirSync(r); }',
        ]);
        expect(confirmed).toContain('agents/sweep-fixture-absent-d');
        expect(confirmed).toContain('agents/sweep-fixture-absent-e');
    });

    it('6. array-literal roots never used → UNPROVEN, not dropped', () => {
        const { confirmed, unproven } = scan([`const IDLE = [path.join(ROOT, '${ABSENT}-f')];`]);
        expect(confirmed).not.toContain('agents/sweep-fixture-absent-f');
        expect(unproven).toContain('agents/sweep-fixture-absent-f');
    });

    it('7. array iterated into a predicate → NOT confirmed (predicate at array level)', () => {
        const { confirmed, unproven } = scan([
            `const TREE_ALLOW = [path.join(ROOT, '${ABSENT}-g')];`,
            'for (const root of TREE_ALLOW) { if (target.startsWith(root)) { ok = true; } }',
        ]);
        expect(confirmed).not.toContain('agents/sweep-fixture-absent-g');
        expect(unproven).toContain('agents/sweep-fixture-absent-g');
    });

    it('8. derivation chain that terminates in a read → CONFIRMED, chain named', () => {
        const r = analyze(
            [
                `const BASE = path.join(ROOT, '${ABSENT}-h');`,
                "const CHILD = path.join(BASE, 'skills');",
                'fs.readdirSync(CHILD);',
            ].join('\n'),
            REPO,
        );
        const hit = r.confirmed.find((h) => h.rel === 'agents/sweep-fixture-absent-h');
        expect(hit, 'parent root confirmed via its derived child').toBeDefined();
        expect(hit?.evidence).toContain('derived-read->CHILD');
    });

    it('9. derivation with NO terminating read → UNPROVEN (derivation alone is not evidence)', () => {
        const { confirmed, unproven } = scan([
            `const BASE = path.join(ROOT, '${ABSENT}-i');`,
            "const CHILD = path.join(BASE, 'skills');",
            'console.log(CHILD.length);',
        ]);
        expect(confirmed).not.toContain('agents/sweep-fixture-absent-i');
        expect(unproven).toContain('agents/sweep-fixture-absent-i');
    });

    // 10 + 11 — the dual fixture. Both directions, one pair, because the
    // revision that recovered the first regressed the second.
    it('10/11. spec-table root confirms AND predicate iteration stays unproven', () => {
        const { confirmed, unproven } = scan([
            `const SRC = path.join(ROOT, '${ABSENT}-j');`,
            "const TARGETS = [{ kind: 'skill', root: path.join(SRC, 'skills'), glob: '*.md' }];",
            'function _glob(p, g) { return fs.readdirSync(p).filter((x) => x.endsWith(g)); }',
            'for (const { kind, root, glob } of TARGETS) { _glob(root, glob); }',
            `const ALLOW = [{ label: 'x', root: path.join(ROOT, '${ABSENT}-k') }];`,
            'for (const { label, root } of ALLOW) { if (target.startsWith(root)) { ok = true; } }',
        ]);
        expect(confirmed, 'spec-table walked root').toContain('agents/sweep-fixture-absent-j/skills');
        expect(confirmed, 'spec-table predicate root').not.toContain('agents/sweep-fixture-absent-k');
        expect(unproven).toContain('agents/sweep-fixture-absent-k');
    });

    it('the bare spec-table parent stays unproven — it is never walked itself', () => {
        const { confirmed, unproven } = scan([
            `const SRC = path.join(ROOT, '${ABSENT}-j');`,
            "const TARGETS = [{ kind: 'skill', root: path.join(SRC, 'skills'), glob: '*.md' }];",
            'function _glob(p, g) { return fs.readdirSync(p); }',
            'for (const { kind, root, glob } of TARGETS) { _glob(root, glob); }',
        ]);
        expect(confirmed).not.toContain('agents/sweep-fixture-absent-j');
        expect(unproven).toContain('agents/sweep-fixture-absent-j');
    });

    it('an existing root is never reported at all', () => {
        const { confirmed, unproven } = scan([
            "const LIVE = path.join(ROOT, 'src', 'skills');",
            'fs.readdirSync(LIVE);',
        ]);
        expect(confirmed).not.toContain('src/skills');
        expect(unproven).not.toContain('src/skills');
    });

    it('no finding is ever listed as both confirmed and unproven', () => {
        const r = analyze(
            [
                `const SCAN = [path.join(ROOT, '${ABSENT}-d'), path.join(ROOT, '${ABSENT}-e')];`,
                'for (const r of SCAN) { fs.readdirSync(r); }',
                `const IDLE = [path.join(ROOT, '${ABSENT}-f')];`,
            ].join('\n'),
            REPO,
        );
        const c = new Set(r.confirmed.map((h) => h.rel));
        expect(r.unproven.filter((h) => c.has(h.rel))).toEqual([]);
    });
});

describe('sweep_dead_scan_roots — triage classes', () => {
    it('maps the retired containers to A, build artifacts to B, the rest to C', () => {
        expect(classify('packages')).toBe('A');
        expect(classify('packages/core'), 'prefix match, not just equality').toBe('A');
        expect(classify('dist/discovery/x.json')).toBe('B');
        expect(classify('.github/budget-trend.jsonl')).toBe('B');
        expect(classify('agents/contexts')).toBe('C');
    });
});

describe('sweep_dead_scan_roots — self-test guard', () => {
    it('passes against the real repo root', () => {
        expect(selfTest(REPO)).toBe(true);
    });
});

/** A fixture tree with one benign gate — produces zero findings by construction. */
function benignTree(): string {
    const root = mkTmp('sweep-fx-');
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'scripts', 'lint_fixture_benign.ts'),
        [
            "import * as path from 'node:path';",
            "const ROOT = '/x';",
            "const OUT = path.join(ROOT, 'agents', 'reports', 'never-written.json');",
            "fs.writeFileSync(OUT, 'x');",
        ].join('\n'),
    );
    return root;
}

/**
 * A tree with one genuine class-A finding — a gate reading a root under a
 * retired container that does not exist.
 *
 * The exit-contract cases below used to assert code 1 against the SHIPPED
 * corpus, which worked only while the repo still HAD class-A findings. That
 * made a passing suite depend on the defect being present: repairing the last
 * dead root (2026-08-02) turned two of them red, which is a close signal, not a
 * regression — but it also means the contract was never really pinned. A
 * fixture pins it for good, and the shipped corpus gets its own assertion below
 * that it is CLEAN.
 */
function classATree(): string {
    const root = mkTmp('sweep-fx-a-');
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'scripts', 'lint_fixture_dead_root.ts'),
        [
            "import * as fs from 'node:fs';",
            "import * as path from 'node:path';",
            "const ROOT = '/x';",
            "const SKILLS = path.join(ROOT, '.agent-src.uncondensed', 'skills');",
            'fs.readdirSync(SKILLS);',
        ].join('\n'),
    );
    return root;
}

function ledgerFile(entries: unknown[]): string {
    const f = path.join(mkTmp('sweep-led-'), 'ledger.json');
    fs.writeFileSync(f, JSON.stringify(entries));
    return f;
}

/**
 * The SHIPPED ledger, not a copy. Duplicating its rows here would let the two
 * drift and would re-introduce the retired-container literals this repo's
 * legacy-path gate forbids under `src/` and `tests/`.
 */
const REAL_LEDGER = JSON.parse(
    fs.readFileSync(path.join(REPO, 'agents', 'evidence', 'sweep-dispositions.json'), 'utf-8'),
) as unknown[];
const GHOST = { script: 'lint_ghost_that_never_was.ts', rel: 'agents/gone', category: 'x', reason: 'r', date: 'd' };

describe('sweep_dead_scan_roots — exit contract (one meaning per code)', () => {
    it('0 — clean tree, empty ledger', () => {
        const root = benignTree();
        expect(main(['--quiet', '--root', path.join(root, 'src', 'scripts'), '--ledger', ledgerFile([])])).toBe(0);
    });

    it('1 — a real class-A finding', () => {
        const root = classATree();
        expect(main(['--quiet', '--root', path.join(root, 'src', 'scripts'), '--ledger', ledgerFile([])])).toBe(1);
    });

    it('1 — real findings OUTRANK a stale ledger entry (hygiene must never mask a dead gate)', () => {
        const root = classATree();
        expect(
            main(['--quiet', '--root', path.join(root, 'src', 'scripts'), '--ledger', ledgerFile([GHOST])]),
        ).toBe(1);
    });

    it('the SHIPPED corpus has no class-A finding and no stale disposition', () => {
        // The state the repairs reached, asserted directly instead of inferred
        // from an exit code that used to mean the opposite. If a future change
        // re-introduces a dead root, this is the line that says so.
        expect(main(['--quiet', '--ledger', ledgerFile(REAL_LEDGER)])).toBe(0);
    });

    it('3 — stale entry with no real findings', () => {
        const root = benignTree();
        expect(main(['--quiet', '--root', path.join(root, 'src', 'scripts'), '--ledger', ledgerFile([GHOST])])).toBe(3);
    });

    it('3 — ledger over cap, before anything is measured', () => {
        const over = Array.from({ length: 16 }, (_, i) => ({
            script: `s${i}.ts`,
            rel: `r${i}`,
            category: 'x',
            reason: 'r',
            date: 'd',
        }));
        expect(main(['--quiet', '--ledger', ledgerFile(over)])).toBe(3);
    });

    it('2 — reserved for self-test failure, distinct from every other code', () => {
        // Demonstrated via the CLI's argument guard, which shares the code:
        // the point is that 2 never means "findings" and never means "ledger".
        const r = spawnSync(TSX, [SCRIPT, '--nonsense'], { cwd: REPO, encoding: 'utf8' });
        expect(r.status).toBe(2);
    });
});

describe('sweep_dead_scan_roots — shipped ledger', () => {
    it('is within cap and every entry carries a category and a reason', () => {
        const shipped = JSON.parse(
            fs.readFileSync(path.join(REPO, 'agents', 'evidence', 'sweep-dispositions.json'), 'utf-8'),
        ) as Array<Record<string, string>>;
        expect(shipped.length).toBeLessThanOrEqual(15);
        for (const e of shipped) {
            expect(e.category, JSON.stringify(e)).toBeTruthy();
            expect((e.reason ?? '').length, JSON.stringify(e)).toBeGreaterThan(20);
        }
    });

    it('has no stale entries against the shipped corpus (every disposition still matches a finding)', () => {
        const r = spawnSync(TSX, [SCRIPT, '--quiet'], { cwd: REPO, encoding: 'utf8' });
        expect(r.stderr).not.toContain('STALE');
    });
});

/**
 * Census mode — added with the census itself (roadmap `road-to-gates-that-can-fail`
 * Phase 1). The load-bearing property is not "a report is produced" but that the
 * report keeps its safety split: the permissive census pass raises RECALL, and it
 * must never be able to lower the finding path's PRECISION. The
 * `censusOnlyRoots-cannot-invent-a-dead-root` case is the one that pins it.
 */
describe('sweep_dead_scan_roots — census', () => {
    it('counts a directory recursively and a file as one unit', () => {
        const root = mkTmp('census-count-');
        fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
        fs.writeFileSync(path.join(root, 'a', 'one.md'), 'x');
        fs.writeFileSync(path.join(root, 'a', 'b', 'two.md'), 'x');
        fs.writeFileSync(path.join(root, 'solo.md'), 'x');

        expect(countUnits(root, 'a')).toEqual({ kind: 'dir', units: 2 });
        expect(countUnits(root, 'solo.md')).toEqual({ kind: 'file', units: 1 });
        expect(countUnits(root, 'nope')).toEqual({ kind: 'absent', units: 0 });
    });

    it('skips node_modules when counting so a vendored tree cannot dominate the number', () => {
        const root = mkTmp('census-skip-');
        fs.mkdirSync(path.join(root, 'r', 'node_modules', 'pkg'), { recursive: true });
        fs.writeFileSync(path.join(root, 'r', 'real.md'), 'x');
        fs.writeFileSync(path.join(root, 'r', 'node_modules', 'pkg', 'index.js'), 'x');

        expect(countUnits(root, 'r')).toEqual({ kind: 'dir', units: 1 });
    });

    it('resolves a string-const path segment the strict finding extractor cannot see', () => {
        const root = mkTmp('census-const-');
        fs.mkdirSync(path.join(root, 'src', 'rules'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'rules', 'a.md'), 'x');

        const src = "const SOURCE_DIR = 'src';\nconst D = path.join(ROOT, SOURCE_DIR, 'rules');\n";
        expect([...censusOnlyRoots(src, root).keys()]).toContain('src/rules');
    });

    it('censusOnlyRoots cannot invent a dead root — the permissive pass is existence-filtered', () => {
        const root = mkTmp('census-safety-');
        const src = "const GONE = 'packages';\nconst D = path.join(ROOT, GONE, 'core');\n";
        // The path does not exist under `root`, so the permissive pass must drop it
        // rather than hand the finding path a fabricated dead root.
        expect([...censusOnlyRoots(src, root).keys()]).toEqual([]);
    });

    it('lists a gate with no extractable root instead of omitting it', () => {
        const rows = buildCensus(
            ['check_nothing.ts'],
            new Map([['check_nothing.ts', { confirmed: [], unproven: [], roots: [] }]]),
            REPO,
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]?.gate).toBe('check_nothing');
        expect(rows[0]?.rel).toBe('(no literal root extracted)');
    });

    it('renders a headline whose gate total matches the population it was given', () => {
        const md = renderCensus(
            [
                { gate: 'g1', rel: 'src/rules', names: 'RULES', kind: 'dir', units: 7 },
                { gate: 'g2', rel: '(no literal root extracted)', names: '—', kind: 'absent', units: 0 },
            ],
            2,
            '2026-08-02',
        );
        expect(md).toContain('| Gate scripts in population | 2 |');
        expect(md).toContain('| Gates with at least one resolvable root | 1 |');
        expect(md).toContain('| Gates with no literal root the extractor can see | 1 |');
        expect(md).toContain('| `g1` | `src/rules` | dir | 7 |');
    });

    it('writes the census file when --census is given, over the real population', () => {
        const out = path.join(mkTmp('census-out-'), 'census.md');
        const r = spawnSync(TSX, [SCRIPT, '--quiet', '--census', out], { cwd: REPO, encoding: 'utf8' });
        expect(r.status === 0 || r.status === 1).toBe(true); // 1 = real class-A findings exist; not a census failure
        const md = fs.readFileSync(out, 'utf-8');
        expect(md).toContain('# Gate scan-scope census');
        expect(md).toMatch(/\| Gate scripts in population \| \d{3} \|/);
        expect(md).toContain('## Reproducing');
    });
});

describe('root resolution is independent of checkout shape', () => {
    it('resolves .git/* through the real git dir when .git is a worktree file', () => {
        // In a linked worktree `.git` is a FILE (`gitdir: <path>`), so a plain
        // existsSync reports `.git/HEAD` absent and the census gains a row that
        // a clone does not have. A report whose contents depend on which
        // checkout produced it cannot "match a fresh run", which is the whole
        // claim the committed census makes.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
        const realGit = fs.mkdtempSync(path.join(os.tmpdir(), 'gitdir-'));
        try {
            fs.writeFileSync(path.join(realGit, 'HEAD'), 'ref: refs/heads/main\n');
            fs.writeFileSync(path.join(root, '.git'), `gitdir: ${realGit}\n`);

            expect(rootExists(root, '.git/HEAD')).toBe(true);
            expect(resolveRoot(root, '.git/HEAD')).toBe(path.join(realGit, 'HEAD'));
            expect(countUnits(root, '.git/HEAD')).toEqual({ kind: 'file', units: 1 });
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(realGit, { recursive: true, force: true });
        }
    });

    it('still resolves .git/* directly when .git is a real directory (a clone)', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-'));
        try {
            fs.mkdirSync(path.join(root, '.git'));
            fs.writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
            expect(rootExists(root, '.git/HEAD')).toBe(true);
            expect(resolveRoot(root, '.git/HEAD')).toBe(path.join(root, '.git', 'HEAD'));
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('reports a genuinely missing .git as absent rather than throwing', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nogit-'));
        try {
            expect(rootExists(root, '.git/HEAD')).toBe(false);
            expect(countUnits(root, '.git/HEAD')).toEqual({ kind: 'absent', units: 0 });
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

/**
 * The Class-A advisory over NON-gate scripts.
 *
 * Added because the sweep's reach was a filename prefix, not a property of the
 * code: `run_skill_evals.ts` roots at a retired container and fails on every
 * subcommand, while its sibling `skill_trigger_eval.ts` — same retired root —
 * was reported, on the `skill_` prefix alone. The pair below pins both halves
 * of the widening: a non-gate script over a retired container IS surfaced, and
 * the pass stays Class-A-only so it cannot grow into a second census.
 *
 * The exit assertion is the load-bearing one. The gate population is shared
 * with the ratchet and the registration test, so an advisory that moved the
 * exit code would move a ratchet base for a reason unrelated to any gate.
 */
describe('sweep_dead_scan_roots — Class-A advisory over non-gate scripts', () => {
    function advisoryTree(): string {
        const root = mkTmp('sweep-fx-adv-');
        fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'rules'), { recursive: true });
        // Non-gate prefix (`run_`), retired container → must be surfaced.
        fs.writeFileSync(
            path.join(root, 'src', 'scripts', 'run_fixture_evals.ts'),
            [
                "import * as fs from 'node:fs';",
                "import * as path from 'node:path';",
                "const REPO_ROOT = '/x';",
                "const SKILLS_ROOT = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');",
                'fs.readdirSync(SKILLS_ROOT);',
            ].join('\n'),
        );
        // Non-gate prefix, live non-retired root → must stay out of the advisory.
        fs.writeFileSync(
            path.join(root, 'src', 'scripts', 'run_fixture_live.ts'),
            [
                "import * as fs from 'node:fs';",
                "import * as path from 'node:path';",
                "const REPO_ROOT = '/x';",
                "const RULES = path.join(REPO_ROOT, 'src', 'rules');",
                'fs.readdirSync(RULES);',
            ].join('\n'),
        );
        return root;
    }

    function runSweep(root: string): { stdout: string; status: number | null } {
        const r = spawnSync(
            TSX,
            [SCRIPT, '--root', path.join(root, 'src', 'scripts'), '--ledger', ledgerFile([])],
            { cwd: REPO, encoding: 'utf8' },
        );
        return { stdout: r.stdout ?? '', status: r.status };
    }

    it('surfaces a non-gate script rooting at a retired container', () => {
        const { stdout } = runSweep(advisoryTree());
        expect(stdout).toContain('advisory  [A] run_fixture_evals.ts');
    });

    it('leaves a non-gate script with a live root out of the advisory', () => {
        const { stdout } = runSweep(advisoryTree());
        expect(stdout).not.toContain('run_fixture_live.ts');
    });

    it('does not gate — an advisory-only tree still exits 0', () => {
        const { status } = runSweep(advisoryTree());
        expect(status).toBe(0);
    });

    it('excludes the sweep itself, whose class table is not a read', () => {
        expect(isNonGateScript('sweep_dead_scan_roots.ts')).toBe(false);
        expect(isNonGateScript('run_skill_evals.ts')).toBe(true);
        expect(isNonGateScript('lint_anything.ts')).toBe(false);
        expect(isNonGateScript('run_thing.test.ts')).toBe(false);
    });
});
