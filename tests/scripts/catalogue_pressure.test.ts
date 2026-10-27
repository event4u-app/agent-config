// `road-to-routing-assurance-live-floors` 3.1, 3.2 and 4.2 — the deterministic
// halves: the comparison set, the twin, and the parity gate.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    MCP_PARITY_EPSILON,
    catalogueSubset,
    fnv1a,
    injectTwin,
    parityVerdict,
    writeSubset,
} from '../../src/scripts/_lib/catalogue_pressure.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pressure-'));
    dirs.push(d);
    return d;
}

const all = Array.from({ length: 80 }, (_, i) => `skill-${String(i).padStart(2, '0')}`);

describe('fnv1a', () => {
    it('matches the published 32-bit FNV-1a vectors', () => {
        expect(fnv1a('')).toBe(0x811c9dc5);
        expect(fnv1a('a')).toBe(0xe40c292c);
        expect(fnv1a('foobar')).toBe(0xbf9cf968);
    });
});

describe('catalogueSubset — 3.1', () => {
    it('the same seed reproduces the same distractor set, across input order', () => {
        const a = catalogueSubset(all, 'skill-07', 20, 'seed-1');
        const b = catalogueSubset([...all].reverse(), 'skill-07', 20, 'seed-1');
        expect(a).toEqual(b);
    });

    it('a different seed draws a different set', () => {
        expect(catalogueSubset(all, 'skill-07', 20, 'seed-1')).not.toEqual(
            catalogueSubset(all, 'skill-07', 20, 'seed-2'),
        );
    });

    it('has exactly n entries and always carries the target', () => {
        for (const n of [12, 20, 50] as const) {
            const got = catalogueSubset(all, 'skill-33', n, 's');
            expect(got).toHaveLength(n);
            expect(got).toContain('skill-33');
            expect(new Set(got).size).toBe(n);
        }
        expect(catalogueSubset(all, 'skill-33', 'full', 's')).toHaveLength(all.length);
    });

    it('refuses a target outside the catalogue', () => {
        expect(() => catalogueSubset(all, 'nope', 12, 's')).toThrow(/not in the catalogue/);
    });

    it('writeSubset copies exactly the named skills', () => {
        const root = tmp();
        for (const s of ['a', 'b', 'c']) {
            fs.mkdirSync(path.join(root, 'cat', s), { recursive: true });
            fs.writeFileSync(path.join(root, 'cat', s, 'SKILL.md'), s);
        }
        writeSubset(path.join(root, 'cat'), ['a', 'c'], path.join(root, 'out'));
        expect(fs.readdirSync(path.join(root, 'out')).sort()).toEqual(['a', 'c']);
    });
});

describe('injectTwin — 3.2', () => {
    function cat(): string {
        const root = tmp();
        fs.mkdirSync(path.join(root, 'code-review'), { recursive: true });
        fs.writeFileSync(path.join(root, 'code-review', 'SKILL.md'), '---\nname: code-review\ndescription: x\n---\n');
        return root;
    }

    it('writes a sibling with the paraphrased description and returns the text to archive', () => {
        const root = cat();
        const twin = injectTwin(root, 'code-review', 'Use when reviewing a diff: "check my changes"');
        expect(twin.name).toBe('code-review-twin');
        const written = fs.readFileSync(path.join(root, 'code-review-twin', 'SKILL.md'), 'utf8');
        expect(written).toBe(twin.text);
        expect(written).toContain('name: code-review-twin');
        expect(written).toContain('check my changes');
    });

    it('refuses an empty or multi-line twin, a missing original, or a second twin', () => {
        const root = cat();
        expect(() => injectTwin(root, 'code-review', '  ')).toThrow(/one non-empty line/);
        expect(() => injectTwin(root, 'code-review', 'a\nb')).toThrow(/one non-empty line/);
        expect(() => injectTwin(root, 'missing', 'x')).toThrow(/no SKILL.md/);
        injectTwin(root, 'code-review', 'x');
        expect(() => injectTwin(root, 'code-review', 'y')).toThrow(/already exists/);
    });
});

describe('parityVerdict — 4.2', () => {
    it('pins the registered epsilon', () => {
        expect(MCP_PARITY_EPSILON).toBe(0.05);
    });

    it('a synthetic recall gap larger than epsilon turns the gate red', () => {
        expect(parityVerdict(0.9, 0.8)).toEqual({ delta: 0.1, breached: true });
    });

    it('a gap at or inside epsilon, or an MCP path that does better, stays green', () => {
        expect(parityVerdict(0.9, 0.85).breached).toBe(false);
        expect(parityVerdict(0.8, 0.9).breached).toBe(false);
    });

    it('a missing figure is a breach, never a pass', () => {
        expect(parityVerdict(null, 0.9).breached).toBe(true);
        expect(parityVerdict(0.9, null).breached).toBe(true);
    });
});
