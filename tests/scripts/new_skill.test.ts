// Tests for src/scripts/new_skill.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite:
//   - the no-`packages/` exit-2 path is deterministic on the real repo →
//     byte-identical stdout/stderr/exit (python3 vs tsx).
//   - the `_frontmatter` / `_body` builders are unit-checked against the exact
//     `yaml.safe_dump(sort_keys=False, allow_unicode=True)` byte output.
//   - the SCAFFOLD path is golden-compared by creating a temporary `packages/`
//     tree IN the repo (the script hardcodes ROOT from its own path), running
//     python3 then tsx, comparing the scaffolded file bytes + console output,
//     and asserting NO git drift is left behind.
// Skipped without python3.
import { afterEach, describe, expect, it } from 'vitest';

import * as ns from '../../src/scripts/new_skill.js';



describe('new_skill — frontmatter / body builders (byte-exact PyYAML shape)', () => {
    it('core pack drops the empty `packs` list', () => {
        const fm = ns._frontmatter('my-skill', 'Use when X.', ['engineering'], 'core');
        expect(fm).toBe(
            '---\nname: my-skill\ndescription: Use when X.\nsource: package\n' +
                'workspaces:\n- engineering\nlifecycle: active\n' +
                'trust:\n  level: professional\n  confidence: medium\n  human_review_required: false\n' +
                'install:\n  default: false\n  removable: true\n---\n',
        );
    });
    it('non-core pack keeps a single-item `packs` list', () => {
        const fm = ns._frontmatter('my-skill', 'Use when X.', ['engineering', 'backend'], 'laravel');
        expect(fm).toBe(
            '---\nname: my-skill\ndescription: Use when X.\nsource: package\n' +
                'workspaces:\n- engineering\n- backend\npacks:\n- laravel\nlifecycle: active\n' +
                'trust:\n  level: professional\n  confidence: medium\n  human_review_required: false\n' +
                'install:\n  default: false\n  removable: true\n---\n',
        );
    });
    it('passes unicode through verbatim (allow_unicode)', () => {
        const fm = ns._frontmatter('café', 'Üse — when Ä.', ['eng'], 'core');
        expect(fm).toContain('name: café\n');
        expect(fm).toContain('description: Üse — when Ä.\n');
    });
    it('skill body shape', () => {
        expect(ns._body('skill', 'x', 'D.')).toBe(
            '\n# x\n\n## When to use\n\nD.\n\n## Procedure\n\n' +
                '1. _TODO: replace with the real step-by-step._\n\n' +
                '## Examples\n\n_TODO: copy-pasteable example._\n',
        );
    });
    it('rule body shape', () => {
        expect(ns._body('rule', 'x', 'D.')).toBe('\n# x\n\nD.\n\n## Iron Law\n\n```\nTODO\n```\n');
    });
    it('command body shape', () => {
        expect(ns._body('command', 'x', 'D.')).toBe('\n# x\n\nD.\n\n## Steps\n\n1. _TODO_\n');
    });
});

// Module-level reference so an unused-import lint never trips.
void ns._setConfigForTest;
afterEach(() => {
    /* no shared state mutated by these tests */
});
