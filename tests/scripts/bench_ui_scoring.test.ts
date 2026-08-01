/**
 * `bench:ui` — scoring functions and pre-registration integrity.
 *
 * What this file deliberately does NOT do: launch a browser. The scored run
 * needs Chromium and is a `task bench:ui` invocation, not a unit test — a CI
 * job without browsers would otherwise turn a missing binary into a red test
 * and teach everyone to ignore it.
 *
 * What it DOES do is guard the two things that can rot silently between runs:
 * the pure scoring maths, and the pre-registration itself. A weight table that
 * no longer sums to 1, a fixture missing from the lock, or a threshold quietly
 * relaxed after a bad run are all invisible in a score and fatal to it.
 *
 * `road-to-provided-artifact-honesty` Phase 4.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    diceMultiset,
    extractTokens,
    tokenRecall,
} from '../../internal/bench/ui/run.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BENCH = path.join(REPO, 'internal', 'bench', 'ui');

interface Config {
    truth: string;
    candidates: string[];
    breakpoints: number[];
    weights: Record<string, number>;
    thresholds: Record<string, number | string>;
    interactions: Array<{ name: string; steps: Array<Record<string, unknown>> }>;
}

function config(): Config {
    return JSON.parse(
        fs.readFileSync(path.join(BENCH, 'bench.config.json'), { encoding: 'utf-8' }),
    ) as Config;
}

describe('bench:ui — token extraction', () => {
    it('picks up colours, px, and rem, and normalises hex case', () => {
        const t = extractTokens('.a{color:#C96442;padding:16px;font-size:1.25rem;border-radius:10px}');
        expect(t).toContain('#c96442');
        expect(t).toContain('16px');
        expect(t).toContain('1.25rem');
        expect(t).toContain('10px');
    });

    it('deduplicates and sorts, so the recall denominator is value-count not use-count', () => {
        const t = extractTokens('.a{margin:8px;padding:8px}.b{gap:8px}');
        expect(t.filter((x) => x === '8px')).toHaveLength(1);
        expect([...t].sort()).toEqual(t);
    });

    it('does not mistake an identifier fragment for a length', () => {
        // `grid-8px-gap` is a class name, not a value. The lookbehind exists
        // for exactly this, and a regression here silently inflates recall.
        expect(extractTokens('.grid-8px-gap{color:#000000}')).toEqual(['#000000']);
    });
});

describe('bench:ui — inventory similarity', () => {
    it('is 1 only on equality and 0 on disjoint sets', () => {
        expect(diceMultiset({ a: 2, b: 1 }, { a: 2, b: 1 })).toBe(1);
        expect(diceMultiset({ a: 1 }, { b: 1 })).toBe(0);
    });

    it('is symmetric', () => {
        const a = { div: 4, button: 2, form: 1 };
        const b = { div: 3, button: 2, section: 2 };
        expect(diceMultiset(a, b)).toBeCloseTo(diceMultiset(b, a), 12);
    });

    it('counts multiplicity — dropping one of three cards is not a free pass', () => {
        const full = diceMultiset({ card: 3 }, { card: 3 });
        const dropped = diceMultiset({ card: 3 }, { card: 2 });
        expect(full).toBe(1);
        expect(dropped).toBeLessThan(full);
    });

    it('two empty inventories are equal, not undefined', () => {
        expect(diceMultiset({}, {})).toBe(1);
    });
});

describe('bench:ui — token recall', () => {
    it('measures what the port kept, and is unmoved by what it added', () => {
        expect(tokenRecall(['#a', '#b'], ['#a', '#b', '#c', '#d'])).toBe(1);
        expect(tokenRecall(['#a', '#b'], ['#a'])).toBe(0.5);
        expect(tokenRecall(['#a'], [])).toBe(0);
    });

    it('an empty ground truth is vacuously satisfied, never a divide-by-zero', () => {
        expect(tokenRecall([], ['#a'])).toBe(1);
    });
});

describe('bench:ui — pre-registration integrity', () => {
    const cfg = config();

    it('weights sum to exactly 1', () => {
        const sum = Object.values(cfg.weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 10);
    });

    it('every weighted component has a threshold, and vice versa', () => {
        const weighted = Object.keys(cfg.weights).sort();
        const thresholds = Object.keys(cfg.thresholds)
            .filter((k) => !k.startsWith('_') && k !== 'separation')
            .sort();
        expect(thresholds).toEqual(weighted);
    });

    it('the breakpoints the roadmap pre-registered are the ones scored', () => {
        expect(cfg.breakpoints).toEqual([375, 768, 1280]);
    });

    it('every configured fixture exists and is SHA-pinned', () => {
        const lock = JSON.parse(
            fs.readFileSync(path.join(BENCH, 'fixtures.lock.json'), { encoding: 'utf-8' }),
        ) as { files: Record<string, string> };
        for (const rel of [cfg.truth, ...cfg.candidates]) {
            const abs = path.join(REPO, rel);
            expect(fs.existsSync(abs), `${rel} is configured but missing`).toBe(true);
            const actual = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
            expect(lock.files[rel], `${rel} is not in the fixture lock`).toBe(actual);
        }
    });

    it('no fixture reaches the network — the determinism contract, asserted', () => {
        // The single loudest way this bench could start measuring the runner
        // instead of the port. Worth a test rather than a sentence in a README.
        for (const rel of [cfg.truth, ...cfg.candidates]) {
            // Comments are stripped first: each fixture *documents* its own
            // determinism contract, and the words it uses to do that are not
            // network references. Matching them would push authors toward
            // vaguer comments to appease the test.
            const body = fs
                .readFileSync(path.join(REPO, rel), { encoding: 'utf-8' })
                .replace(/<!--[\s\S]*?-->/g, '');
            expect(body, `${rel} hotlinks a font`).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
            expect(body, `${rel} carries a remote reference`).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
            expect(body, `${rel} carries an @import`).not.toMatch(/@import\b/);
            expect(body, `${rel} uses a non-deterministic source`).not.toMatch(
                /\bMath\.random\b|\bnew Date\b|\bDate\.now\b/,
            );
        }
    });

    it('each interaction is named and carries at least one step', () => {
        expect(cfg.interactions.length).toBeGreaterThan(0);
        for (const spec of cfg.interactions) {
            expect(spec.name).toBeTruthy();
            expect(spec.steps.length).toBeGreaterThan(0);
        }
    });

    it('the interaction checklist covers every interaction the truth declares', () => {
        // The fixture declares three handlers and one keyframe; a checklist
        // that quietly stopped covering one would report a higher score for a
        // worse port.
        const names = cfg.interactions.map((i) => i.name);
        expect(names).toEqual(
            expect.arrayContaining([
                'screen switch',
                'disclosure toggle',
                'subscribe submit',
                'rule-draw keyframe',
            ]),
        );
    });
});

describe('bench:ui — the committed first-epoch run', () => {
    const reportPath = path.join(REPO, 'internal', 'bench', 'reports', 'ui', 'latest.json');

    it('records the epoch it is only comparable within', () => {
        const report = JSON.parse(fs.readFileSync(reportPath, { encoding: 'utf-8' })) as {
            epoch: Record<string, string>;
            reports: Array<{ candidate: string; weighted: number }>;
        };
        for (const key of ['browser', 'platform', 'node']) {
            expect(report.epoch[key], `epoch.${key} missing`).toBeTruthy();
        }
    });

    it('separates a faithful port from a regenerated one by the pre-registered margin', () => {
        const cfg = config();
        const report = JSON.parse(fs.readFileSync(reportPath, { encoding: 'utf-8' })) as {
            reports: Array<{ candidate: string; weighted: number }>;
        };
        const byName = (needle: string): number => {
            const row = report.reports.find((r) => r.candidate.includes(needle));
            if (row === undefined) throw new Error(`no scored candidate matching ${needle}`);
            return row.weighted;
        };
        const margin = byName('port-faithful') - byName('port-regenerated');
        expect(margin).toBeGreaterThanOrEqual(Number(cfg.thresholds['separation']));
    });
});
