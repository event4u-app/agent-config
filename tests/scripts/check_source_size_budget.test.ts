// Tests for src/scripts/check_source_size_budget.ts.
//
// Three things are worth pinning here and nothing else is:
//
//   1. The measurement — which files count, and where the boundary sits. An
//      off-by-one at the ceiling decides whether a file is debt or not, so the
//      inclusive edge is asserted from both sides.
//   2. **That the metric is excess lines and NOT a file count.** This is the
//      load-bearing design choice: a count would read the same whether the worst
//      file sits at 5,461 lines or at 9,000, so the gate would stay green while
//      the exact defect it exists for got worse. The discriminating assertion
//      holds the file count fixed and moves only the size.
//   3. The ratchet baseline is the LIVE total. A baseline recorded one above the
//      truth is a gate that permits one free regression and reads green while
//      doing it — the failure the ratchet exists to prevent, reintroduced
//      through its own config.
//
// The exit-code behaviour is proven by the gate's `--self-test`, which drives
// the real binary against a synthetic tree, so it is not re-mocked here.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    SOURCE_CEILING_LINES,
    SOURCE_ROOTS,
    collectSourceFiles,
    countLines,
    excessOf,
    measure,
    totalExcess,
} from '../../src/scripts/check_source_size_budget.js';

const REPO = path.resolve(__dirname, '..', '..');

function makeTree(files: Record<string, number>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cssb-'));
    for (const [rel, lines] of Object.entries(files)) {
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, '//\n'.repeat(lines), 'utf-8');
    }
    return root;
}

describe('check_source_size_budget — what the source layer is', () => {
    it('collects TypeScript under the declared root', () => {
        const root = makeTree({ 'src/a.ts': 3, 'src/nested/deep/b.ts': 3 });
        expect(collectSourceFiles(root).map((f) => path.relative(root, f)).sort()).toEqual(
            [path.join('src', 'a.ts'), path.join('src', 'nested', 'deep', 'b.ts')].sort(),
        );
    });

    it('ignores non-TypeScript files', () => {
        const root = makeTree({ 'src/a.ts': 3, 'src/b.md': 3, 'src/c.json': 3 });
        expect(collectSourceFiles(root)).toHaveLength(1);
    });

    it('does not reach outside the declared root', () => {
        // `tests/` and `docs/` carry no shipped runtime code; counting them would
        // make this gate's number un-interpretable as "the code we ship".
        const root = makeTree({ 'tests/a.ts': 3, 'docs/b.ts': 3 });
        expect(collectSourceFiles(root)).toEqual([]);
    });

    it('skips node_modules — a symlinked dependency tree is not our debt', () => {
        const root = makeTree({ 'src/a.ts': 3, 'src/node_modules/dep/index.ts': 9999 });
        expect(collectSourceFiles(root).map((f) => path.relative(root, f))).toEqual([
            path.join('src', 'a.ts'),
        ]);
    });
});

describe('check_source_size_budget — line counting', () => {
    it('counts newlines, the `wc -l` convention', () => {
        expect(countLines('a\nb\nc\n')).toBe(3);
    });

    it('a file with no trailing newline reads one lower — stated, not accidental', () => {
        expect(countLines('a\nb\nc')).toBe(2);
    });

    it('an empty file is zero lines', () => {
        expect(countLines('')).toBe(0);
    });
});

describe('check_source_size_budget — the ceiling boundary', () => {
    it('is inclusive: exactly at the ceiling carries no excess', () => {
        const root = makeTree({ 'src/a.ts': SOURCE_CEILING_LINES });
        expect(totalExcess(measure(root, collectSourceFiles(root)))).toBe(0);
    });

    it('one line over contributes exactly one line of excess', () => {
        const root = makeTree({ 'src/a.ts': SOURCE_CEILING_LINES + 1 });
        expect(totalExcess(measure(root, collectSourceFiles(root)))).toBe(1);
    });

    it('reports repo-relative POSIX paths, so a finding is copy-pasteable', () => {
        const root = makeTree({ 'src/scripts/nested/a.ts': 5 });
        expect(measure(root, collectSourceFiles(root))[0]?.file).toBe('src/scripts/nested/a.ts');
    });
});

describe('check_source_size_budget — the metric is excess lines, not a file count', () => {
    it('growth INSIDE an already-oversized file raises the metric', () => {
        // The whole point. Both trees hold exactly ONE over-ceiling file, so a
        // file-count ratchet reads 1 = 1 and passes. The excess differs by 100.
        const before = makeTree({ 'src/big.ts': SOURCE_CEILING_LINES + 100 });
        const after = makeTree({ 'src/big.ts': SOURCE_CEILING_LINES + 200 });

        const overCount = (root: string): number =>
            measure(root, collectSourceFiles(root)).filter((m) => excessOf(m) > 0).length;
        expect(overCount(before)).toBe(overCount(after));

        expect(totalExcess(measure(before, collectSourceFiles(before)))).toBe(100);
        expect(totalExcess(measure(after, collectSourceFiles(after)))).toBe(200);
    });

    it('splitting one oversized file into two compliant ones lowers the metric to zero', () => {
        // The lowering commit the ratchet-before-split ordering exists to make
        // visible: same total lines, redistributed under the ceiling.
        const monolith = makeTree({ 'src/big.ts': SOURCE_CEILING_LINES + 400 });
        const split = makeTree({
            'src/a.ts': SOURCE_CEILING_LINES,
            'src/b.ts': 400,
        });
        expect(totalExcess(measure(monolith, collectSourceFiles(monolith)))).toBe(400);
        expect(totalExcess(measure(split, collectSourceFiles(split)))).toBe(0);
    });

    it('files under the ceiling contribute nothing, however many there are', () => {
        const root = makeTree(
            Object.fromEntries(
                Array.from({ length: 20 }, (_, i) => [`src/f${String(i)}.ts`, SOURCE_CEILING_LINES - 1]),
            ),
        );
        expect(totalExcess(measure(root, collectSourceFiles(root)))).toBe(0);
    });
});

describe('check_source_size_budget — the baseline is the live total', () => {
    it('the recorded baseline equals the real tree total excess', () => {
        const live = totalExcess(measure(REPO, collectSourceFiles(REPO)));
        const baselines = JSON.parse(
            fs.readFileSync(path.join(REPO, 'src/config/gate-violation-baselines.json'), 'utf-8'),
        ) as { gates: Record<string, { count: number }> };
        const entry = baselines.gates['check_source_size_budget'];
        expect(entry, 'check_source_size_budget has no baseline entry').toBeDefined();
        // Equality, and BOTH directions are deliberate.
        //
        // Above the live total: the baseline silently grants that many free
        // lines of regression while the gate still prints green. That half is
        // the obvious one.
        //
        // BELOW the live total is the half worth stating, because gate and test
        // then disagree on purpose. A commit that splits a god-file lowers the
        // excess; the gate reads that as `improved` and exits 0 (advisory), so
        // nothing would force the ratchet to follow the gain. This assertion is
        // what makes the lowering commit carry its own baseline update — which
        // is the whole point of ratchet-before-split, since a ratchet that lags
        // its tree permits the gain to be given back unnoticed. So the test
        // blocking where the gate only advises is the intended asymmetry, not a
        // drift between them.
        expect(entry?.count).toBe(live);
    });

    it('the declared root exists — a moved root would make the number meaningless', () => {
        for (const root of SOURCE_ROOTS) {
            expect(fs.existsSync(path.join(REPO, root)), `${root} is missing`).toBe(true);
        }
    });
});
