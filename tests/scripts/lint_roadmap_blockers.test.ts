// Tests for src/scripts/lint_roadmap_blockers.ts.
//
// Mirrors the sibling lint_roadmap_ci_steps.ts test shape: unit-tests the
// pure `_scan(text)` function directly (no filesystem / CLI plumbing —
// REPO_ROOT is fixed relative to the script location, same convention as
// the sibling linters in this family).
import { describe, expect, it } from 'vitest';

import {
    _blockerClass,
    _hasExecutableSubstance,
    _scan,
    _scanBoth,
} from '../../src/scripts/lint_roadmap_blockers.js';

describe('lint_roadmap_blockers — the decidability half', () => {
    const decidable = [
        '## Blockers',
        '',
        '### blocker: pick-a-reading',
        '- **Status:** open',
        '- **Owner:** maintainer',
        '- **Blocks:** acceptance criterion 3',
        '- **Recommendation:** (a) — it is the only one backed by a measurement.',
        '- **If you do nothing:** the roadmap stays open; nothing else breaks.',
        '- **What to do:**',
        '  1. (a) Edit `agents/roadmaps/x.md` and tick the criterion.',
        '  2. (b) Re-cut the criterion, then run `agent-config roadmap:progress`.',
        '- **Resolved when:** the criterion is ticked',
        '',
    ].join('\n');

    it('a fully decidable blocker raises nothing', () => {
        expect(_scanBoth(decidable).decidability).toEqual([]);
    });

    it('flags the shape that started this — options in prose, no command, no recommendation', () => {
        const prose = decidable
            .replace('- **Recommendation:** (a) — it is the only one backed by a measurement.\n', '')
            .replace('- **If you do nothing:** the roadmap stays open; nothing else breaks.\n', '')
            .replace(
                '  1. (a) Edit `agents/roadmaps/x.md` and tick the criterion.\n' +
                    '  2. (b) Re-cut the criterion, then run `agent-config roadmap:progress`.',
                '  pick exactly one — accept the reading, or re-cut the criterion.',
            );
        const gaps = _scanBoth(prose).decidability;
        expect(gaps).toHaveLength(1);
        expect(gaps[0]!.message).toContain('Recommendation');
        expect(gaps[0]!.message).toContain('If you do nothing');
        expect(gaps[0]!.message).toContain('What to do');
    });

    it('never re-litigates a resolved blocker — history is not a backlog', () => {
        const resolved = decidable
            .replace('- **Status:** open', '- **Status:** resolved')
            .replace('- **Recommendation:** (a) — it is the only one backed by a measurement.\n', '');
        expect(_scanBoth(resolved).decidability).toEqual([]);
    });

    it('keeps the five-field contract hard while the new fields ratchet', () => {
        const noOwner = decidable.replace('- **Owner:** maintainer\n', '');
        // Missing Owner is a contract violation → hard, not deferred to the ratchet.
        expect(_scanBoth(noOwner).hard).toHaveLength(1);
        expect(_scanBoth(noOwner).hard[0]!.message).toContain('Owner');
    });

    it('an empty field header does not count as a recommendation', () => {
        const blank = decidable.replace(
            '- **Recommendation:** (a) — it is the only one backed by a measurement.',
            '- **Recommendation:**',
        );
        expect(_scanBoth(blank).decidability[0]!.message).toContain('Recommendation');
    });

    describe('_hasExecutableSubstance', () => {
        it('accepts a backticked command or path', () => {
            expect(
                _hasExecutableSubstance('- **What to do:**\n  1. Run `agent-config gates`.\n'),
            ).toBe(true);
        });

        it('accepts an enumerated option set', () => {
            expect(
                _hasExecutableSubstance('- **What to do:**\n  pick one — (a) do this (b) do that\n'),
            ).toBe(true);
        });

        it('rejects bare prose, however confident', () => {
            expect(
                _hasExecutableSubstance(
                    '- **What to do:** pick exactly one — accept the false-positive reading, ' +
                        'or re-cut the criterion. Mutually exclusive.\n',
                ),
            ).toBe(false);
        });

        it('does not borrow substance from a neighbouring field', () => {
            // A backtick in `Resolved when:` must not make `What to do:` look
            // executable — the slice has to stop at the next field marker.
            expect(
                _hasExecutableSubstance(
                    '- **What to do:** decide it.\n- **Resolved when:** `task ci` exits 0\n',
                ),
            ).toBe(false);
        });
    });
});

describe('lint_roadmap_blockers — the gate-class contract', () => {
    /** A decidable class-0 entry: it declares the command it is cleared by. */
    const classified = (extra: readonly string[]): string =>
        [
            '## Blockers',
            '',
            '### blocker: time-window',
            '- **Status:** open',
            '- **Owner:** user',
            '- **Blocks:** Phase 2',
            ...extra,
            '- **Recommendation:** (a) — the window is already past.',
            '- **If you do nothing:** the phase stays parked on a satisfied test.',
            '- **What to do:**',
            '  1. Run `agent-config gates --execute time-window`.',
            '- **Resolved when:** the probe exits 0',
            '',
        ].join('\n');

    it('a class-0 entry that names its command is clean', () => {
        const text = classified(['- **Class:** 0', '- **Run:** `date -u +%F`']);
        expect(_scan(text)).toEqual([]);
    });

    it('a class-0 entry with no Run: is the new violation', () => {
        const gaps = _scan(classified(['- **Class:** 0']));
        expect(gaps).toHaveLength(1);
        expect(gaps[0]!.message).toContain('class 0');
        expect(gaps[0]!.message).toContain('**Run:**');
    });

    it('class 1 is held to the same bar as class 0', () => {
        const gaps = _scan(classified(['- **Class:** 1', '- **Budget:** ~$2 per run']));
        expect(gaps).toHaveLength(1);
        expect(gaps[0]!.message).toContain('class 1');
    });

    it('classes 2 and 3 need no Run: — nobody claimed they were runnable', () => {
        expect(_scan(classified(['- **Class:** 2']))).toEqual([]);
        expect(_scan(classified(['- **Class:** 3']))).toEqual([]);
    });

    it('an absent Class is class 3, so the whole backlog stays legal', () => {
        // The pre-existing shape: five fields, no class, no Run. This is the
        // property that lets the check be hard instead of ratcheted.
        expect(_scan(classified([]))).toEqual([]);
    });

    it('an unknown class is refused rather than silently treated as 3', () => {
        const gaps = _scan(classified(['- **Class:** auto']));
        expect(gaps).toHaveLength(1);
        expect(gaps[0]!.message).toContain('unknown class');
    });

    it('history is not re-litigated — a resolved entry is exempt', () => {
        const resolved = classified(['- **Class:** 0']).replace(
            '- **Status:** open',
            '- **Status:** resolved',
        );
        expect(_scan(resolved)).toEqual([]);
    });

    describe('_blockerClass', () => {
        it('reads the leading token so the taxonomy name may follow', () => {
            expect(_blockerClass('- **Class:** 1 — budget-preauthorized\n')).toBe('1');
        });

        it('an absent or empty field reads as no declaration', () => {
            expect(_blockerClass('- **Owner:** user\n')).toBe('');
            expect(_blockerClass('- **Class:**\n')).toBe('');
        });
    });
});

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
