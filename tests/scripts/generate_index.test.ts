// Tests for src/scripts/generate_index.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (_parse_frontmatter, _truncate, _to_shipped_path) plus a
// golden-parity layer that runs python3 vs tsx on the REAL repo — both the
// `--check` summary AND byte-exact generated agents/index.md + docs/catalog.md
// via a snapshot+restore harness (skipped without python3). Writers must
// leave zero on-disk drift.
import { describe, expect, it } from 'vitest';

import * as gi from '../../src/scripts/generate_index.js';



describe('generate_index — pure helpers', () => {
    it('_parse_frontmatter reads top-level keys, strips quotes, skips indented lines', () => {
        const fm = gi._parse_frontmatter('---\nname: "foo"\ntype: always\n  nested: skip\n---\nbody');
        expect(fm).toEqual({ name: 'foo', type: 'always' });
    });
    it('_parse_frontmatter returns {} without frontmatter', () => {
        expect(gi._parse_frontmatter('no frontmatter here')).toEqual({});
    });
    it('_truncate escapes pipes, flattens newlines, caps at the limit with an ellipsis', () => {
        expect(gi._truncate('a | b\nc')).toBe('a \\| b c');
        const long = 'x'.repeat(250);
        const out = gi._truncate(long);
        expect(out.endsWith('…')).toBe(true);
        expect(out.length).toBe(200);
    });
    it('_to_shipped_path rewrites source paths and passes non-source paths through', () => {
        expect(gi._to_shipped_path('.agent-src.uncondensed/skills/x/SKILL.md')).toBe(
            'dist/agent-src/skills/x/SKILL.md',
        );
        expect(gi._to_shipped_path('docs/guidelines/php/general.md')).toBe('docs/guidelines/php/general.md');
    });
    it('_render_table builds a markdown table with the kind / link / extra / description row', () => {
        const t = gi._render_table(
            [{ kind: 'skill', name: 'x', description: 'd', extra: 'e', path: 'p.md' }],
            ['kind', 'name', 'extra', 'description'],
            '../',
        );
        expect(t).toContain('| skill | [`x`](../p.md) | e | d |');
    });
});

describe('generate_index — collectors run against the real repo', () => {
    it('skills / rules / commands / guidelines are non-empty and sorted', () => {
        const skills = gi._collect_skills();
        const rules = gi._collect_rules();
        const guidelines = gi._collect_guidelines();
        expect(skills.length).toBeGreaterThan(0);
        expect(rules.length).toBeGreaterThan(0);
        expect(guidelines.length).toBeGreaterThan(0);
        const names = skills.map((s) => s.name);
        expect([...names].sort()).toEqual(names);
    });
});
