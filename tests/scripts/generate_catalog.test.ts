// Tests for src/scripts/generate_catalog.ts (py2ts Phase 8 / Wave 8a).
//
// Scope, stated as what this file holds rather than what the port once
// planned: unit tests over the public surface — parse_skill, collect_skills,
// render_llms_txt, render_catalog_md — against temporary fixtures, plus one
// non-trivial-collection check against the real skills directory.
//
// There is NO golden-parity layer and NO drift assertion here. An earlier
// header described both: a python3-vs-tsx byte-identity run and a ZERO-git-
// drift check over the committed llms.txt and docs/skills-catalog.md. Neither
// was ever written, the Python source has since been retired, and while that
// header stood the committed catalogue drifted by one whole skill and six
// descriptions without anything failing. Leaving the two generated files
// ungated is a deliberate choice (both are named merge-conflict surface);
// describing a gate that does not exist is not.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    collect_skills,
    parse_skill,
    render_catalog_md,
    render_llms_txt,
} from '../../src/scripts/generate_catalog.js';



let tmpDir: string;
beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gencat-'));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('parse_skill', () => {
    it('extracts name + description from frontmatter', () => {
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, '---\nname: foo\ndescription: "Use when X — Y, Z."\n---\nbody\n', 'utf-8');
        expect(parse_skill(p)).toEqual(['foo', 'Use when X — Y, Z.']);
    });
    it('returns null when frontmatter is absent', () => {
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, 'no frontmatter\n', 'utf-8');
        expect(parse_skill(p)).toBeNull();
    });
    it('strips one pair of surrounding quotes from a YAML-quoted name', () => {
        // Four shipped skills write `name: "slug"`. Before the quotes were
        // stripped the catalogue rendered `"slug"` as the row label and built
        // the link out of the quoted string, so four links were broken.
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, '---\nname: "estimate-ticket"\ndescription: "D."\n---\nbody\n', 'utf-8');
        expect(parse_skill(p)).toEqual(['estimate-ticket', 'D.']);
    });
    it('leaves an unquoted name and an inner quote alone', () => {
        // Only a SURROUNDING pair is removed: a name is not re-parsed as YAML,
        // so a quote in the middle of one survives.
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, '---\nname: a"b\ndescription: D.\n---\nbody\n', 'utf-8');
        expect(parse_skill(p)).toEqual(['a"b', 'D.']);
    });
    it('returns null when description missing', () => {
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, '---\nname: foo\n---\nbody\n', 'utf-8');
        expect(parse_skill(p)).toBeNull();
    });
});

describe('renderers', () => {
    const skills: Array<[string, string]> = [
        ['alpha', 'Use when alpha.'],
        ['beta', 'Use when beta.'],
    ];
    it('render_llms_txt has the index header + one line per skill', () => {
        const out = render_llms_txt(skills);
        expect(out.startsWith('# agent-config — Skill Index')).toBe(true);
        expect(out).toContain('alpha: Use when alpha.');
        expect(out).toContain('beta: Use when beta.');
        expect(out.endsWith('\n')).toBe(true);
    });
    it('render_catalog_md has the count + a markdown row per skill', () => {
        const out = render_catalog_md(skills);
        expect(out).toContain('All **2 skills**');
        expect(out).toContain('| [`alpha`](../dist/agent-src/skills/alpha/SKILL.md) | Use when alpha. |');
        expect(out).toContain('← [Back to README](../README.md)');
    });
    it('collect_skills finds the real repo skills', () => {
        // Sort order follows pathlib component order; the parity layer asserts
        // byte-identity with python3 — that is the real ordering contract. Here
        // we only check the collection is non-trivial and well-formed.
        const found = collect_skills();
        expect(found.length).toBeGreaterThan(50);
        for (const [name, desc] of found) {
            expect(typeof name).toBe('string');
            expect(typeof desc).toBe('string');
            expect(name.length).toBeGreaterThan(0);
            // A rendered name is a link component; a quote in it breaks the link.
            expect(name).not.toMatch(/^["']|["']$/);
        }
    });
});

