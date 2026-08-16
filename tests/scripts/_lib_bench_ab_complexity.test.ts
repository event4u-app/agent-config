// Tests for src/scripts/_lib/bench_ab_complexity.ts — the T2 endpoint of the
// Phase-3 metric pair (S0.3 delta #11).
//
// The suite has two jobs, and the first one is the one that makes the metric
// quotable at all:
//
//  1. CALIBRATION. Cognitive complexity is a *published* metric, so "faithful"
//     has to be asserted against known-good scores, not claimed in a docstring.
//     The first block scores G. Ann Campbell's own worked examples and a set of
//     hand-derived cases whose arithmetic is written out per case, so a future
//     edit that shifts a score by one has to argue with the derivation.
//  2. THE GOLFING DIRECTION. The endpoint exists to catch "fewer lines, denser
//     code". A pair of fixtures that are behaviourally identical, one short and
//     dense, one long and flat, must score the short one HIGHER — otherwise the
//     anti-golfing gate is watching a metric that cannot see the thing it is for.
//
// No fixture is written to the tracked tree; every source is inline.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    complexityForSource,
    langForPath,
    median,
    medianComplexityPerChangedFunction,
} from '../../src/scripts/_lib/bench_ab_complexity.js';

async function scoreOne(file: string, src: string): Promise<number> {
    const r = await complexityForSource(file, src);
    expect(r.functions.length, `expected exactly one function unit in ${file}`).toBe(1);
    return r.functions[0]!.complexity;
}

describe('cognitive complexity — calibration against published scores', () => {
    it("Campbell's sumOfPrimes scores 7", async () => {
        // +1 outer for, +2 inner for (nesting 1), +3 if (nesting 2),
        // +1 `continue OUT` (labelled jump) = 7.
        const src = `function sumOfPrimes(max) {
  let total = 0;
  OUT: for (let i = 1; i <= max; ++i) {
    for (let j = 2; j < i; ++j) {
      if (i % j === 0) {
        continue OUT;
      }
    }
    total += i;
  }
  return total;
}`;
        expect(await scoreOne('a.js', src)).toBe(7);
    });

    it("Campbell's getWords scores 1 — a flat switch is not eight paths", async () => {
        // The whole point of the metric over cyclomatic: +1 for the switch,
        // nothing per case, because a reader follows one construct.
        const src = `function getWords(number) {
  switch (number) {
    case 1: return "one";
    case 2: return "a couple";
    default: return "lots";
  }
}`;
        expect(await scoreOne('b.js', src)).toBe(1);
    });

    it('binary logical operators cost one per SEQUENCE, not per operator', async () => {
        // if +1, `a && b && c` is one sequence +1  → 2
        // if +1, `a && b || c` changes operator once, two sequences +2 → 3
        // total 5.
        const src = `function f(a, b, c) {
  if (a && b && c) { return 1; }
  if (a && b || c) { return 2; }
}`;
        expect(await scoreOne('c.js', src)).toBe(5);
    });

    it('else and else-if take a flat +1 and never a nesting penalty', async () => {
        // if +1, else if +1, else +1 = 3. If `else if` were scored as an else
        // plus a nested if it would be 4 — the classic off-by-one in a
        // hand-rolled implementation.
        const src = `function g(n) {
  if (n > 0) {} else if (n < 0) {} else {}
}`;
        expect(await scoreOne('d.js', src)).toBe(3);
    });

    it('nesting compounds: a catch inside a loop inside an if', async () => {
        // if +1, for +2 (nesting 1), catch +3 (nesting 2) = 6.
        const src = `function h(xs) {
  if (xs) {
    for (const x of xs) {
      try { use(x); } catch (e) { report(e); }
    }
  }
}`;
        expect(await scoreOne('e.js', src)).toBe(6);
    });

    it('scores PHP with the same rules', async () => {
        // if +1, `&&` sequence +1, foreach +2 (nesting 1), catch +3 (nesting 2),
        // elseif +1, else +1 = 9.
        const src = `<?php
function a($n) {
  if ($n > 0 && $n < 5) {
    foreach ([1] as $x) {
      try { g(); } catch (Exception $e) {}
    }
  } elseif ($n) {} else {}
  return $n;
}`;
        expect(await scoreOne('f.php', src)).toBe(9);
    });

    it('scores TypeScript, including a do-while', async () => {
        // if +1, `||` sequence +1, do +2 (nesting 1) = 4.
        const src = `function a(n: number): number {
  if (n > 0 || n < 1) {
    do { n--; } while (n);
  }
  return n;
}`;
        expect(await scoreOne('g.ts', src)).toBe(4);
    });

    it('an else-if body sits at the SAME depth as the if body — the wrapper off-by-one', async () => {
        // Regression for the completion review's first high finding. In JS/TS the
        // `else if` is reached through an `else_clause` wrapper, so its interior
        // was walked one level deeper than the behaviourally identical shapes.
        // if +1, else-if +1, inner if +2 (nesting 1) = 4 — for ALL THREE spellings.
        const jsElseIf = await scoreOne('a.js', `function f(a,b,c){ if(a){} else if(b){ if(c){} } }`);
        const jsElse = await scoreOne('b.js', `function f(a,b,c){ if(a){} else { if(c){} } }`);
        const phpElseIf = await scoreOne(
            'c.php',
            `<?php function f($a,$b,$c){ if($a){} elseif($b){ if($c){} } }`,
        );
        expect(jsElseIf).toBe(4);
        // The point is not the number but the agreement: a metric that scores the
        // same control flow differently per spelling cannot compare two arms.
        expect(jsElseIf).toBe(jsElse);
        expect(jsElseIf).toBe(phpElseIf);
    });

    it('PHP match scores like its switch twin — not zero', async () => {
        // `match` is the expression form of `switch`, and rewriting one as the
        // other is a textbook line-saving transform. An unmodelled node would
        // score 0 and make that transform look free.
        const match = await scoreOne(
            'm.php',
            `<?php function f($n){ return match($n){ 1 => 'a', default => 'b' }; }`,
        );
        const sw = await scoreOne(
            's.php',
            `<?php function f($n){ switch($n){ case 1: return 'a'; default: return 'b'; } }`,
        );
        expect(match).toBe(1);
        expect(match).toBe(sw);
    });

    it("PHP's word-form logical operators count like their symbol forms", async () => {
        const symbols = await scoreOne('p1.php', `<?php function f($a,$b){ if($a && $b){} }`);
        const words = await scoreOne('p2.php', `<?php function f($a,$b){ if($a and $b){} }`);
        expect(symbols).toBe(2);
        expect(words).toBe(symbols);
    });

    it('a nested closure is its own unit — the documented deviation, pinned', async () => {
        const r = await complexityForSource(
            'h.js',
            `function outer() {
  if (1) {}
  const inner = () => { if (2) { if (3) {} } };
}`,
        );
        const byName = Object.fromEntries(r.functions.map((f) => [f.name, f.complexity]));
        // outer keeps only its own `if`; the arrow carries its own 1 + 2.
        expect(byName['outer']).toBe(1);
        expect(byName['<anon>']).toBe(3);
        // Two observations, not one — that is what "per function" means here.
        expect(r.functions.length).toBe(2);
    });
});

describe('the golfing direction — the property the endpoint exists for', () => {
    // Behaviourally identical. The golfed version is ~8× shorter and strictly
    // harder to follow. A metric that cannot separate these cannot gate golfing.
    const FLAT = `function classify(n) {
  if (n < 0) {
    return 'neg';
  }
  if (n === 0) {
    return 'zero';
  }
  return 'pos';
}`;
    const GOLFED = `function classify(n) { return n < 0 ? 'neg' : n === 0 ? 'zero' : 'pos'; }`;

    it('the shorter file scores HIGHER', async () => {
        const flat = await scoreOne('flat.js', FLAT);
        const golfed = await scoreOne('golfed.js', GOLFED);
        expect(golfed).toBeGreaterThan(flat);
    });

    it('and the line counts move the other way — which is the whole trap', () => {
        expect(GOLFED.split('\n').length).toBeLessThan(FLAT.split('\n').length);
    });
});

describe('honest coverage — unmeasured is never zero', () => {
    it('maps the extensions the corpus actually contains', () => {
        expect(langForPath('a/b.ts')).toBe('typescript');
        expect(langForPath('a/b.js')).toBe('javascript');
        expect(langForPath('a/b.mjs')).toBe('javascript');
        expect(langForPath('a/b.php')).toBe('php');
    });

    it('returns lang null — not an empty score — for an uncovered extension', async () => {
        const r = await complexityForSource('q.py', 'def f():\n    if x:\n        pass\n');
        expect(r.lang).toBeNull();
        expect(r.functions).toEqual([]);
    });

    it('median is null on an empty sample, never 0', () => {
        expect(median([])).toBeNull();
        expect(median([3])).toBe(3);
        expect(median([1, 3])).toBe(2);
        expect(median([5, 1, 3])).toBe(3);
    });

    it('a file missing on disk is reported as missing, not as unsupported', async () => {
        const rollup = await medianComplexityPerChangedFunction('/nonexistent-root', ['a.py']);
        expect(rollup.median).toBeNull();
        expect(rollup.n_functions).toBe(0);
        expect(rollup.missing_files).toEqual(['a.py']);
        // The two buckets are distinct: this file was never read, so nothing is
        // known about whether a grammar covers it.
        expect(rollup.unsupported_files).toEqual([]);
    });

    it('a file that EXISTS but has no grammar lands in unsupported_files', async () => {
        // The branch the previous test was named for and did not reach: the file
        // has to be readable before its extension can be judged unsupported.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cxu-'));
        try {
            fs.writeFileSync(path.join(dir, 'a.py'), 'def f():\n    if x:\n        pass\n', 'utf8');
            const rollup = await medianComplexityPerChangedFunction(dir, ['a.py']);
            expect(rollup.unsupported_files).toEqual(['a.py']);
            expect(rollup.missing_files).toEqual([]);
            // Unsupported contributes NO observation — never a zero.
            expect(rollup.median).toBeNull();
            expect(rollup.n_functions).toBe(0);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
