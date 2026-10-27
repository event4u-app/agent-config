/**
 * The SVG active-content backstop grep, run rather than restated.
 *
 * `frontend-render-security` § Backstop greps documents a pattern that locates
 * SVG markup which executes once the file is inlined — a `<foreignObject>`, an
 * `on*` attribute on the root `<svg>`, a `javascript:` href. A grep that lives
 * only in prose is a grep nobody has ever run: it can be wrong on the day it is
 * written and stay wrong, because the skill is read by an agent and checked by
 * nothing.
 *
 * So this test does not carry its own copy of the pattern. The pattern lives in
 * one place, the `svg-active-content` rule of `code-graph scan`, and the skill
 * names that rule; this test takes the rule from the table, applies it to a
 * committed fixture of three planted files and one clean twin, and checks the
 * skill still points at it. A drift in either direction — the rule stops
 * matching an attack shape, or widens until it matches a clean asset — fails
 * here.
 *
 * The twin is the half that carries the sensitivity. Three hits alone are also
 * what `.` would produce; the pair "three planted AND not the twin" is the claim
 * worth pinning, which is why one case asserts both and is named for both.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SCAN_RULES, scanText } from '../../src/scripts/code_graph/scan.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL = path.join(REPO, 'src', 'skills', 'frontend-render-security', 'SKILL.md');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'svg-active-content');

const rule = () => {
    const r = SCAN_RULES.filter((x) => x.id === 'svg-active-content');
    // Exactly one, so a second copy added later is a failure here rather than a silent choice.
    expect(r, 'the scan table must carry the SVG rule exactly once').toHaveLength(1);
    return r[0] as (typeof SCAN_RULES)[number];
};

describe('frontend-render-security — the SVG active-content backstop', () => {
    it('grep-hits-three-planted-and-not-the-twin', () => {
        const files = fs.readdirSync(FIXTURE).filter((n) => n.endsWith('.svg')).sort();
        // The fixture is part of the claim: four files, or the counts below say
        // nothing about what the pattern can tell apart.
        expect(files).toEqual(['clean-twin.svg', 'foreign-object.svg', 'javascript-href.svg', 'onload-attribute.svg']);
        const r = rule();
        const hit = files.filter((name) => scanText(name, fs.readFileSync(path.join(FIXTURE, name), 'utf-8'), [r]).length > 0);
        expect(hit).toEqual(['foreign-object.svg', 'javascript-href.svg', 'onload-attribute.svg']);
        expect(hit).not.toContain('clean-twin.svg');
    });

    it('the skill points at the rule the scan runs, and the rule is scoped to *.svg', () => {
        const skill = fs.readFileSync(SKILL, 'utf-8');
        expect(skill).toContain('agent-config code-graph scan --pack frontend');
        expect(skill.match(/`svg-active-content`/g)).toHaveLength(1);
        expect(rule().pack).toBe('frontend');
        expect(scanText('a.tsx', '<svg onload="x()">', [rule()])).toEqual([]);
    });
});
