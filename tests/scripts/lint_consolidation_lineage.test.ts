/**
 * Fixture tests for `src/scripts/lint_consolidation_lineage.ts`.
 *
 * The corpus that motivated the checker is gitignored (`agents/tmp.old/`), so
 * an acceptance criterion phrased against it would be satisfiable on one
 * machine and nowhere else. These fixtures under
 * `tests/fixtures/consolidation-lineage/` mirror the measured DECLARATION
 * SHAPES and folder structure — not the content — so the census table is
 * reproducible from the tracked tree.
 *
 * Verified equivalence, 2026-08-27: running the checker over
 * `census-mirror/` and over the live `agents/tmp.old/` census folders produces
 * the same ten findings with the same declared/present/omitted counts.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    analyseFolder,
    normalizeParent,
    parseDeclaration,
    selfTest,
} from '../../src/scripts/lint_consolidation_lineage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const FIX = path.join(REPO, 'tests', 'fixtures', 'consolidation-lineage');
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', 'lint_consolidation_lineage.ts');

const codesIn = (dir: string): string[] => analyseFolder(path.join(FIX, dir)).map((f) => f.code).sort();
const estate = (dir: string) => analyseFolder(path.join(FIX, dir), path.basename(dir), 'estate');

describe('lint_consolidation_lineage — the six declaration shapes', () => {
    // AC-3: each legacy shape parses to the SAME parent set as the canonical
    // field — never to an empty set. An empty set would report every legacy
    // consolidation as declaring zero parents: a finding storm on first run.
    const shapes = [
        ['shape-consolidates', 'consolidates'],
        ['shape-supersedes-analysis', 'supersedes_analysis'],
        ['shape-inputs-consolidated', 'inputs-consolidated'],
        ['shape-ersetzt', 'ersetzt-als-fuehrendes-proposal'],
        ['shape-master-table', 'master-konsolidierung-table'],
        ['shape-prose-supersession', 'prose-supersession'],
    ] as const;

    for (const [dir, kind] of shapes) {
        it(`${dir} parses to {road-to-a, road-to-b} via ${kind}`, async () => {
            const fs = await import('node:fs');
            const decl = parseDeclaration(fs.readFileSync(path.join(FIX, dir, 'road-to-master.md'), 'utf-8'));
            expect(decl.kind).toBe(kind);
            expect(decl.parents).toEqual(['road-to-a', 'road-to-b']);
            expect(decl.unparseable).toBe(false);
            expect(codesIn(dir)).toEqual([]);
        });
    }

    it('a claim with no readable list is UNPARSEABLE, never an empty declaration', () => {
        expect(codesIn('shape-unparseable')).toEqual(['claims-without-field']);
    });

    it('a complete folder produces zero findings', () => {
        expect(codesIn('complete')).toEqual([]);
    });
});

describe('lint_consolidation_lineage — normalization', () => {
    it('strips the download-collision suffix, the extension, and trailing prose', () => {
        expect(normalizeParent('- `road-to-a(1).md`')).toBe('road-to-a');
        expect(normalizeParent('road-to-b')).toBe('road-to-b');
        expect(normalizeParent('`road-to-c` v3 (Claude-Session) — P0–P7, K1–K5')).toBe('road-to-c');
        expect(normalizeParent('  road-to-d.md   # a comment')).toBe('road-to-d');
    });
});

describe('lint_consolidation_lineage — the census reproduces from committed fixtures', () => {
    // AC-1. Counts are the measured row from
    // agents/evidence/analysis/consolidation-lineage-census-2026-08-26.md.
    const row = (dir: string, master: string, declared: number, present: number, omitted: string): void => {
        const f = analyseFolder(path.join(FIX, 'census-mirror', dir)).filter(
            (x) => x.code === 'omitted-sibling' && x.file === master,
        );
        expect(f, `${dir}: expected one omitted-sibling finding on ${master}`).toHaveLength(1);
        expect(f[0]!.detail).toBe(`declared ${declared}, present ${present}, omitted \`${omitted}\``);
    };

    it('evolve — declared 2, present 3, omitted the deeper synthesis', () => {
        row('evolve', 'road-to-governed-harness-evolution-master.md', 2, 3, 'road-to-gated-harness-evolution-deep-v4');
    });
    it('evolver — declared 2, present 3, omitted the deeper synthesis', () => {
        row('evolver', 'road-to-experience-loop-master.md', 2, 3, 'road-to-outcome-grounded-harness-evolution');
    });
    it('impeccable — declared 3, present 4, omitted the operating-system synthesis', () => {
        row('impeccable', 'road-to-frontend-power.md', 3, 4, 'road-to-frontend-operating-system');
    });
    it('redundanz — declared 4, present 5, omitted the competing master', () => {
        row('redundanz', 'road-to-redundancy-governance-master.md', 4, 5, 'road-to-one-spine');
    });

    // 2.3's verify, stated in the roadmap AFTER a neutral review corrected it:
    // the overlapping-sets shape occurs in THREE folders, not one — and not in
    // `impeccable`, where the omitted sibling declares a `research.basis:`
    // grounding list rather than an overlapping parent set.
    it('overlapping-sets fires in evolve, evolver and redundanz — and NOT in impeccable', () => {
        for (const d of ['evolve', 'evolver', 'redundanz']) {
            expect(codesIn(`census-mirror/${d}`), d).toContain('overlapping-sets');
        }
        expect(codesIn('census-mirror/impeccable')).not.toContain('overlapping-sets');
    });
});

describe('lint_consolidation_lineage — CLI contract', () => {
    it('--self-test proves all three comparison findings can fire', () => {
        expect(selfTest()).toBe(0);
    });

    it('publishes its scanned count so an empty scan is visible, not silently green', () => {
        const r = spawnSync(TSX, [SCRIPT, '--root', path.join('tests', 'fixtures', 'consolidation-lineage', 'complete')], {
            cwd: REPO,
            encoding: 'utf8',
        });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/^scanned: 3$/m);
    });

    it('--strict turns findings into a non-zero exit; report mode stays 0', () => {
        const args = ['--root', path.join('tests', 'fixtures', 'consolidation-lineage', 'census-mirror', 'evolve')];
        const report = spawnSync(TSX, [SCRIPT, ...args], { cwd: REPO, encoding: 'utf8' });
        expect(report.status).toBe(0);
        const strict = spawnSync(TSX, [SCRIPT, ...args, '--strict'], { cwd: REPO, encoding: 'utf8' });
        expect(strict.status).toBe(1);
    });
});


describe('lint_consolidation_lineage — the estate surface is narrower, deliberately', () => {
    // Both narrowings below are corrections to a first implementation that ran
    // the inbox rules over `agents/roadmaps/`. Each produced findings that were
    // not merely noisy but wrong on their face.

    it('does not infer parents from neighbouring estate roadmaps', () => {
        // Inbox rules on a 12-file estate produced 11 omitted-sibling findings
        // for one declaring roadmap — every neighbour a mandatory parent.
        const f = estate('estate');
        expect(f.map((x) => x.code)).not.toContain('omitted-sibling');
    });

    it('does not read a roadmap that DESCRIBES a consolidation as declaring one', () => {
        // The header of an estate roadmap routinely quotes the inbox master it
        // was authored from. Prose recognition turned that into a parent set.
        const f = estate('estate').filter((x) => x.file === 'road-to-describes-a-consolidation.md');
        expect(f).toEqual([]);
    });

    it('still reports a canonical declaration naming a file that does not exist', () => {
        // The narrowing must not cost the finding that motivated 2.2 — a
        // lineage naming a plan nobody can open.
        const f = estate('estate').filter((x) => x.code === 'missing-parent');
        expect(f).toHaveLength(1);
        expect(f[0]!.detail).toContain('road-to-never-existed');
    });

    it('a glob is never a parent', () => {
        expect(normalizeParent('`road-to-*.md`')).toBe('');
        expect(parseDeclaration('# m\n\nset difference over `road-to-*.md` in the folder.\n').parents).toEqual([]);
    });
});

describe('dead-scope: enumeration of the declared root, not a count of what it holds', () => {
    // AI council 2026-08-30 (anthropic + openai, convergent, option b). The
    // `min_scanned: 5` floor that used to guard this scope sat over a
    // population under deliberate drawdown to zero: it went red the day the
    // drain succeeded — six active roadmaps to four in one afternoon — and the
    // only move left was lowering the number again, a treadmill ending at a
    // floor of 0, which is no floor.
    //
    // The invariant is now enumeration of the exact declared root BY THIS
    // LINTER, which is why these tests invoke the CLI rather than a helper: an
    // independent existsSync in check_gate_coverage would observe a directory
    // without proving this process enumerated it.
    const run = (root: string): { status: number | null; stderr: string } => {
        const r = spawnSync(TSX, [SCRIPT, '--root', root], { cwd: REPO, encoding: 'utf8' });
        return { status: r.status, stderr: r.stderr };
    };

    it('REFUSES a declared root that does not exist', () => {
        const r = run(path.join(REPO, 'tests', 'fixtures', 'consolidation-lineage', 'no-such-root'));
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('DEAD SCOPE');
    });

    it('REFUSES a declared root that is a file, not a directory', () => {
        const r = run(path.join(REPO, 'package.json'));
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('not a directory');
    });

    // removing_this_constraint_reds_it: restore `if (!fs.existsSync(root))
    // continue;` in main(). MEASURED: 1 of these 2 reds, not both, and the
    // difference is worth recording rather than rounding up. The missing-root
    // case reds — a skipped root contributes zero and passes under the
    // allowEmpty reason, which is the hole. The file-root case stays green
    // under the old code too, but for an unrelated reason: `readdirSync` on a
    // file throws ENOTDIR out of an uncaught call, so the process exits
    // non-zero by crashing rather than by refusing. What the new code buys
    // there is a stated refusal instead of a stack trace, which the assertion
    // on `not a directory` pins.

    it('ACCEPTS an existing but EMPTY root — a completed drain is not a dead scope', () => {
        // The other half, and the reason the floor could not stay: this must
        // pass, or the drain can never finish.
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'lineage-empty-'));
        try {
            const r = spawnSync(TSX, [SCRIPT, '--root', empty], { cwd: REPO, encoding: 'utf8' });
            expect(r.status).toBe(0);
            expect(`${r.stdout}${r.stderr}`).toContain('scanned: 0');
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });
});
