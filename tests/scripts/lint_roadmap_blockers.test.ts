// Tests for src/scripts/lint_roadmap_blockers.ts.
//
// Mirrors the sibling lint_roadmap_ci_steps.ts test shape: unit-tests the
// pure `_scan(text)` function directly (no filesystem / CLI plumbing —
// REPO_ROOT is fixed relative to the script location, same convention as
// the sibling linters in this family).
import { describe, expect, it } from 'vitest';

import { _scan } from '../../src/scripts/lint_roadmap_blockers.js';

describe('lint_roadmap_blockers — _scan', () => {
    const VALID_BLOCKER = [
        '## Blockers',
        '',
        '### blocker: kernel-budget',
        '- **Status:** open',
        '- **Owner:** maintainer',
        '- **Blocks:** Phase 1',
        '- **What to do:**',
        '  1. Do the thing.',
        '- **Resolved when:** CI is green',
        '',
    ].join('\n');

    it('a complete blocker entry — no violations', () => {
        const text = `# Roadmap: X\n\n## Phase 1 — Ship\n- [ ] step\n\n${VALID_BLOCKER}`;
        expect(_scan(text)).toEqual([]);
    });

    it('a roadmap with no Blockers section — no violations', () => {
        const text = '# Roadmap: X\n\n## Phase 1 — Ship\n- [ ] step\n';
        expect(_scan(text)).toEqual([]);
    });

    it('a valid blocked-by reference — no violations', () => {
        const text = [
            '# Roadmap: X',
            '',
            '## Phase 1 — Ship',
            '- [ ] step <!-- blocked-by: kernel-budget -->',
            '',
            VALID_BLOCKER,
        ].join('\n');
        expect(_scan(text)).toEqual([]);
    });

    it('deliberately broken fixture — missing fields + dangling blocked-by reported with line numbers', () => {
        const text = [
            '# Roadmap: Broken', // 1
            '', // 2
            '## Phase 1 — Ship', // 3
            '- [ ] step <!-- blocked-by: ghost-blocker -->', // 4
            '', // 5
            '## Blockers', // 6
            '', // 7
            '### blocker: incomplete', // 8
            '- **Status:** open', // 9
            '- **Owner:** user', // 10
            '- **What to do:**', // 11
            '  1. Missing Blocks and Resolved when.', // 12
            '', // 13
        ].join('\n');
        const violations = _scan(text);
        // One "missing fields" violation for `incomplete`, one "dangling
        // reference" violation for `ghost-blocker`.
        expect(violations.length).toBe(2);
        const [first, second] = violations;
        // Sorted by line — the blocked-by reference (line 4) precedes the
        // blocker heading (line 8).
        expect(first!.line).toBe(4);
        expect(first!.message).toContain("unknown blocker id 'ghost-blocker'");
        expect(second!.line).toBe(8);
        expect(second!.message).toContain("blocker 'incomplete' missing required field(s)");
        expect(second!.message).toContain('Blocks');
        expect(second!.message).toContain('Resolved when');
        // Fields that ARE present must not be listed as missing.
        expect(second!.message).not.toContain('Status');
        expect(second!.message).not.toContain('Owner');
        expect(second!.message).not.toContain('What to do');
    });

    it('inline-code documentation of the blocked-by syntax on a non-checkbox line is not scanned', () => {
        // A roadmap step describing this very feature, wrapping onto a
        // continuation line — the marker text is not on a checkbox line.
        const text = [
            '# Roadmap: X',
            '',
            '## Phase 1 — Ship',
            '- [ ] Add a check that every `<!-- blocked-by: id -->` reference',
            '  resolves to a real blocker.',
            '',
        ].join('\n');
        expect(_scan(text)).toEqual([]);
    });

    it('a fenced code example of the shape is not scanned', () => {
        const text = [
            '# Roadmap: X',
            '',
            '## Phase 1 — Ship',
            '- [ ] step describing the feature:',
            '',
            '  ```markdown',
            '  ## Blockers',
            '',
            '  ### blocker: example-only',
            '  - **Status:** open',
            '  ```',
            '',
        ].join('\n');
        expect(_scan(text)).toEqual([]);
    });

    it('two blockers, one incomplete — only the incomplete one is reported', () => {
        const text = [
            '## Blockers',
            '',
            '### blocker: complete-one',
            '- **Status:** open',
            '- **Owner:** user',
            '- **Blocks:** Phase 1',
            '- **What to do:**',
            '  1. Fine.',
            '- **Resolved when:** done',
            '',
            '### blocker: incomplete-one',
            '- **Status:** open',
            '- **Owner:** user',
            '',
        ].join('\n');
        const violations = _scan(text);
        expect(violations.length).toBe(1);
        expect(violations[0]!.message).toContain("blocker 'incomplete-one' missing");
    });
});
