// The `attribution-label` shape class (road-to-slices-at-agreed-seams step 1.2).
//
// A `- Inspiration: <owner>/<repo>/skills/<x>/SKILL.md` line shipped under
// `src/` with an owner the deny list did not carry, and no shape class saw it:
// `source-header` only reads `**Source:**`, `repo-slug` only reads
// `github.com/` URLs. These tests pin that the gate now reports such a line at
// least at warn tier under `src/`, and that a label carrying a description, an
// internal path, or an integrated vendor stays silent.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { _load_config } from '../../src/scripts/check_no_external_sources.js';
import { attributionLabelHits, shapeHits, tierFor } from '../../src/scripts/_lib/source_shape.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', 'fixtures', 'source-headers', 'attribution-label.md');

function section(name: 'Flagged' | 'Silent'): string[] {
    const raw = fs.readFileSync(FIXTURE, 'utf8');
    // Anchored: the explanatory comment at the top names both headings in prose.
    const start = raw.search(new RegExp(`^## ${name}$`, 'm'));
    const rest = raw.slice(start + name.length + 3);
    const end = rest.indexOf('\n## ');
    return (end < 0 ? rest : rest.slice(0, end)).split('\n').filter((l) => l.trim() !== '');
}

describe('attribution-label — flagged corpus', () => {
    const lines = section('Flagged');

    it('has a non-trivial corpus', () => {
        expect(lines.length).toBeGreaterThanOrEqual(5);
    });

    it.each(lines)('flags: %s', (line) => {
        expect(shapeHits(line).map((h) => h.cls)).toContain('attribution-label');
    });

    it('is caught by SHAPE, not by the deny list', () => {
        // If a fixture owner were deny-listed, this test would prove nothing
        // about the shape class — the deny pass would catch the line anyway.
        const deny = _load_config().deny.map((p) => new RegExp(p, 'i'));
        for (const line of lines) {
            expect(deny.some((re) => re.test(line))).toBe(false);
        }
    });

    it('reports the identifier, not the whole line', () => {
        expect(attributionLabelHits('- Inspiration: `somevendor/some-suite/skills/grill-me/SKILL.md`')).toEqual([
            { cls: 'attribution-label', value: 'somevendor/some-suite' },
        ]);
    });
});

describe('attribution-label — silent corpus', () => {
    const lines = section('Silent');

    it('has a non-trivial corpus', () => {
        expect(lines.length).toBeGreaterThanOrEqual(5);
    });

    it.each(lines)('does not flag: %s', (line) => {
        expect(attributionLabelHits(line)).toEqual([]);
    });
});

describe('the gate tier for the D1 shape under src/', () => {
    it('is at least warn — a finding the gate reports, not one it drops', () => {
        const rel = 'src/domains/meta/challenge-me/vision/command.md';
        const line = '- Inspiration: `somevendor/some-suite/skills/grill-me/SKILL.md`';
        const hits = shapeHits(line).filter((h) => h.cls === 'attribution-label');
        expect(hits).toHaveLength(1);
        expect(['warn', 'block']).toContain(tierFor(rel));
    });
});
