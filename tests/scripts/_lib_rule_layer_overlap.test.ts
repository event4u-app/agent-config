// Unit tests for rule-layer overlap detection (`_lib/rule_layer_overlap.ts`).
//
// The defect under test: Claude Code loads `~/.claude/rules/` and
// `<project>/.claude/rules/` both, with no dedup, so a rule in both layers sits
// in standing context twice. Measured 2026-08-08 — 91 shared basenames,
// 74,137 exact-BPE tokens redundant (42%).
//
// Two behaviours are load-bearing and get the sharpest cases here:
//
// 1. **Provenance stripping must be narrow.** The installer stamps `package:`
//    and `source_path:` onto its own copies, so byte-comparison reports 91/91
//    "different" for a corpus whose bodies are identical. Stripping those two
//    keys reveals the duplicate — but stripping too eagerly would make two
//    genuinely different rules compare EQUAL, which is the direction that loses
//    obligations. Both directions are pinned.
// 2. **Nothing may delete.** Suppression goes through the host's own
//    `claudeMdExcludes`, and the merge must append rather than replace: the key
//    merges across settings layers, so an overwrite silently drops another
//    layer's exclusions.
import { describe, expect, it } from 'vitest';

import {
    claudeMdExcludesGlob,
    compareLayers,
    decideLayerAction,
    mergeClaudeMdExcludes,
    stripProvenance,
} from '../../src/scripts/_lib/rule_layer_overlap.js';

/** A rule as the installer writes it into the global layer — provenance stamped. */
const global_copy = (body: string): string =>
    `---\ntype: "always"\npackage: event4u/agent-config\nsource_path: dist/agent-src/rules/x.md\n---\n\n${body}\n`;

/** The same rule as the project layer carries it — no provenance keys. */
const project_copy = (body: string): string => `---\ntype: "always"\n---\n\n${body}\n`;

describe('stripProvenance', () => {
    it('drops only the installer-stamped keys inside the frontmatter fence', () => {
        expect(stripProvenance(global_copy('# Rule'))).toBe(project_copy('# Rule'));
    });

    it('leaves a file without a frontmatter fence untouched', () => {
        const text = 'package: not-frontmatter\n\n# Body\n';
        expect(stripProvenance(text)).toBe(text);
    });

    it('does NOT strip a body line that merely starts with a provenance key', () => {
        // The failure direction that matters: two rules differing only in this
        // body line must stay different, or a real divergence reads as a duplicate.
        const a = `---\ntype: "always"\n---\n\npackage: alpha\n`;
        const b = `---\ntype: "always"\n---\n\npackage: beta\n`;
        expect(stripProvenance(a)).not.toBe(stripProvenance(b));
    });

    it('leaves an unterminated frontmatter fence untouched', () => {
        const text = '---\npackage: event4u/agent-config\n\n# no closing fence\n';
        expect(stripProvenance(text)).toBe(text);
    });
});

describe('compareLayers', () => {
    it('classifies a provenance-only difference as a duplicate, not a divergence', () => {
        const g = new Map([['scope-control.md', global_copy('# Scope')]]);
        const p = new Map([['scope-control.md', project_copy('# Scope')]]);
        const r = compareLayers(g, p);
        expect(r.overlap).toEqual(['scope-control.md']);
        expect(r.duplicate).toEqual(['scope-control.md']);
        expect(r.divergent).toEqual([]);
        // redundant_chars is measured on the project side — what suppressing it recovers.
        expect(r.redundant_chars).toBe(project_copy('# Scope').length);
    });

    it('classifies a real body difference as divergent and counts no recoverable chars', () => {
        const g = new Map([['x.md', global_copy('# Old text')]]);
        const p = new Map([['x.md', project_copy('# New text')]]);
        const r = compareLayers(g, p);
        expect(r.divergent).toEqual(['x.md']);
        expect(r.duplicate).toEqual([]);
        expect(r.redundant_chars).toBe(0);
    });

    it('reports each side-only set, sorted', () => {
        const g = new Map([
            ['b.md', global_copy('B')],
            ['only-global.md', global_copy('G')],
            ['a.md', global_copy('A')],
        ]);
        const p = new Map([
            ['a.md', project_copy('A')],
            ['b.md', project_copy('B')],
            ['only-project.md', project_copy('P')],
        ]);
        const r = compareLayers(g, p);
        expect(r.overlap).toEqual(['a.md', 'b.md']);
        expect(r.global_only).toEqual(['only-global.md']);
        expect(r.project_only).toEqual(['only-project.md']);
    });

    it('two empty layers overlap in nothing and recover nothing', () => {
        const r = compareLayers(new Map(), new Map());
        expect(r.overlap).toEqual([]);
        expect(r.redundant_chars).toBe(0);
    });
});

describe('claudeMdExcludesGlob', () => {
    it('emits an absolute-path glob with a trailing /**', () => {
        expect(claudeMdExcludesGlob('/repo/.claude/rules')).toBe('/repo/.claude/rules/**');
    });

    it('does not double the separator when the input already ends in a slash', () => {
        expect(claudeMdExcludesGlob('/repo/.claude/rules/')).toBe('/repo/.claude/rules/**');
    });
});

describe('mergeClaudeMdExcludes', () => {
    it('appends to an existing array instead of replacing it', () => {
        const existing = ['**/other-team/.claude/rules/**'];
        expect(mergeClaudeMdExcludes(existing, '/repo/.claude/rules/**')).toEqual([
            '**/other-team/.claude/rules/**',
            '/repo/.claude/rules/**',
        ]);
    });

    it('is idempotent — a second install adds nothing', () => {
        const once = mergeClaudeMdExcludes(undefined, '/r/**');
        expect(mergeClaudeMdExcludes(once, '/r/**')).toEqual(['/r/**']);
    });

    it('starts a fresh array when the existing value is absent or not an array', () => {
        expect(mergeClaudeMdExcludes(undefined, '/r/**')).toEqual(['/r/**']);
        expect(mergeClaudeMdExcludes('not-an-array', '/r/**')).toEqual(['/r/**']);
    });

    it('preserves non-string members a human may have hand-edited in', () => {
        expect(mergeClaudeMdExcludes([42, '/a/**'], '/r/**')).toEqual([42, '/a/**', '/r/**']);
    });
});

describe('decideLayerAction', () => {
    const dup = compareLayers(
        new Map([['x.md', global_copy('X')]]),
        new Map([['x.md', project_copy('X')]]),
    );
    const skewed = compareLayers(
        new Map([['x.md', global_copy('old')]]),
        new Map([['x.md', project_copy('new')]]),
    );

    it('choice=global suppresses the project layer and never deletes', () => {
        const a = decideLayerAction(dup, 'global', '/g/rules', '/p/rules');
        expect(a.write).toBe('global');
        expect(a.suppress_dir).toBe('/p/rules');
        expect(a.note).toContain('No file is deleted or rewritten');
    });

    it('choice=project suppresses the global layer', () => {
        const a = decideLayerAction(dup, 'project', '/g/rules', '/p/rules');
        expect(a.write).toBe('project');
        expect(a.suppress_dir).toBe('/g/rules');
    });

    it('choice=both-acknowledged suppresses nothing and states the recurring cost', () => {
        const a = decideLayerAction(dup, 'both-acknowledged', '/g/rules', '/p/rules');
        expect(a.write).toBe('both');
        expect(a.suppress_dir).toBeNull();
        expect(a.note).toContain('delivered twice per session');
    });

    it('a divergent body demands a refresh before suppression, in every choice', () => {
        for (const choice of ['global', 'project', 'both-acknowledged'] as const) {
            const a = decideLayerAction(skewed, choice, '/g/rules', '/p/rules');
            expect(a.refresh_required).toBe(true);
            expect(a.note).toContain('refresh before suppressing');
        }
    });

    it('a pure duplicate demands no refresh', () => {
        expect(decideLayerAction(dup, 'global', '/g', '/p').refresh_required).toBe(false);
    });
});
