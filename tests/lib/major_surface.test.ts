import { describe, expect, it } from 'vitest';

import {
    MAJOR_SURFACES,
    UNDERIVABLE_SURFACES,
    classify_surfaces,
    parse_name_status,
} from '../../src/scripts/_lib/major_surface.js';

describe('parse_name_status', () => {
    it('reads a status letter and a path per record', () => {
        expect(parse_name_status('M\tREADME.md\nD\tsrc/rules/gone.md\n')).toEqual([
            { status: 'M', path: 'README.md' },
            { status: 'D', path: 'src/rules/gone.md' },
        ]);
    });

    it('keeps the new path of a rename and drops its similarity score', () => {
        expect(parse_name_status('R096\tsrc/rules/old.md\tsrc/rules/new.md\n')).toEqual([
            { status: 'R', path: 'src/rules/new.md' },
        ]);
    });

    it('ignores blank lines and malformed records', () => {
        expect(parse_name_status('\nnotarecord\n\n')).toEqual([]);
    });
});

describe('classify_surfaces — the three triggers a diff can decide', () => {
    it('fires installer-layout when the installer tree gains or loses a file', () => {
        for (const path of [
            'src/install/wizard-plan.ts',
            'packages/core/installer/index.ts',
            'templates/AGENTS.md',
            'bin/agent-config',
            'scripts/install.py',
        ]) {
            expect([...classify_surfaces([{ status: 'A', path }])]).toEqual(['installer-layout']);
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual(['installer-layout']);
        }
    });

    it('fires rule-or-skill-removal only on a deletion, in source or either projection', () => {
        for (const path of [
            'src/rules/gone.md',
            'src/skills/gone/SKILL.md',
            '.agent-src/rules/gone.md',
            'dist/agent-src/skills/gone/SKILL.md',
        ]) {
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual(['rule-or-skill-removal']);
            expect([...classify_surfaces([{ status: 'A', path }])]).toEqual([]);
        }
    });

    it('fires settings-keys from the caller-supplied removed keys, never from a path alone', () => {
        expect([...classify_surfaces([{ status: 'M', path: 'config/agent-settings.template.yml' }])]).toEqual([]);
        expect([...classify_surfaces([], ['worktrees.mode'])]).toEqual(['settings-keys']);
    });

    it('scores a rename as neither a creation nor a removal', () => {
        expect([...classify_surfaces([{ status: 'R', path: 'src/rules/new.md' }])]).toEqual([]);
        expect([...classify_surfaces([{ status: 'R', path: 'src/install/moved.ts' }])]).toEqual([]);
    });

    it('ignores a modification anywhere', () => {
        expect([...classify_surfaces([{ status: 'M', path: 'src/install/wizard-plan.ts' }])]).toEqual([]);
        expect([...classify_surfaces([{ status: 'M', path: 'src/rules/kept.md' }])]).toEqual([]);
    });

    it('ignores a path outside every table', () => {
        expect([...classify_surfaces([{ status: 'D', path: 'docs/guidelines/whatever.md' }])]).toEqual([]);
        expect([...classify_surfaces([{ status: 'A', path: 'src/scripts/_lib/thing.ts' }])]).toEqual([]);
    });

    it('collects every surface a span touched', () => {
        const surfaces = classify_surfaces(
            [
                { status: 'A', path: 'templates/AGENTS.md' },
                { status: 'D', path: 'src/skills/gone/SKILL.md' },
            ],
            ['memory.cadence'],
        );
        expect([...surfaces].sort()).toEqual([...MAJOR_SURFACES].sort());
    });

    it('returns nothing for an empty span', () => {
        expect([...classify_surfaces([])]).toEqual([]);
    });
});

describe('the condensed-format trigger is declared underivable, not scored as absent', () => {
    it('is named in UNDERIVABLE_SURFACES and in no MAJOR_SURFACES value', () => {
        expect([...UNDERIVABLE_SURFACES]).toEqual(['condensed-format']);
        expect(MAJOR_SURFACES as readonly string[]).not.toContain('condensed-format');
    });

    it('never appears in a classification, whatever the condenser did', () => {
        const surfaces = classify_surfaces([
            { status: 'M', path: 'src/scripts/condense.ts' },
            { status: 'A', path: 'src/scripts/condense.sh' },
        ]);
        expect([...surfaces]).toEqual([]);
    });
});
