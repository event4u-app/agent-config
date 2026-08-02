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

import { analyze, classify, main, selfTest } from '../../src/scripts/sweep_dead_scan_roots.js';

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
        expect(classify('.agent-src.uncondensed/skills')).toBe('A');
        expect(classify('packages')).toBe('A');
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

function ledgerFile(entries: unknown[]): string {
    const f = path.join(mkTmp('sweep-led-'), 'ledger.json');
    fs.writeFileSync(f, JSON.stringify(entries));
    return f;
}

const REAL_LEDGER = [
    { script: 'check_gate_paths.ts', rel: 'packages', category: 'path-as-predicate', reason: 'r', date: 'd' },
    { script: 'check_reply_consistency.ts', rel: '.agent-src.uncondensed', category: 'path-as-sentinel', reason: 'r', date: 'd' },
    {
        script: 'check_token_optimizer_freshness.ts',
        rel: '.agent-src.uncondensed/skills/token-optimizer/SKILL.md',
        category: 'deliberate-legacy-handling',
        reason: 'r',
        date: 'd',
    },
];
const GHOST = { script: 'lint_ghost_that_never_was.ts', rel: 'agents/gone', category: 'x', reason: 'r', date: 'd' };

describe('sweep_dead_scan_roots — exit contract (one meaning per code)', () => {
    it('0 — clean tree, empty ledger', () => {
        const root = benignTree();
        expect(main(['--quiet', '--root', path.join(root, 'src', 'scripts'), '--ledger', ledgerFile([])])).toBe(0);
    });

    it('1 — real class-A findings on the shipped corpus', () => {
        expect(main(['--quiet', '--ledger', ledgerFile(REAL_LEDGER)])).toBe(1);
    });

    it('1 — real findings OUTRANK a stale ledger entry (hygiene must never mask a dead gate)', () => {
        expect(main(['--quiet', '--ledger', ledgerFile([...REAL_LEDGER, GHOST])])).toBe(1);
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
