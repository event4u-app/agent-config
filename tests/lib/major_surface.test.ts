import { describe, expect, it } from 'vitest';

import {
    MAJOR_SURFACES,
    SETTINGS_KEY_FILES,
    UNDERIVABLE_SURFACES,
    classify_surfaces,
    parse_name_status,
    removed_setting_keys,
    settings_key_paths,
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
    it('keeps the two sets disjoint, so no surface is both declared and decided', () => {
        expect([...UNDERIVABLE_SURFACES]).toEqual(['condensed-format']);
        const overlap = (UNDERIVABLE_SURFACES as readonly string[]).filter((s) =>
            (MAJOR_SURFACES as readonly string[]).includes(s),
        );
        expect(overlap).toEqual([]);
    });

    // Weak by construction and kept deliberately: `classify_surfaces` returns
    // `Set<MajorSurface>`, so the type already forbids the value this asserts
    // is absent. It still fails if a future author widens that union and wires
    // a condense path into a table, which is the only way the gap could close
    // silently. Named as a low finding in the R2 round-1 review rather than
    // dressed up as a stronger check than it is.
    it('never appears in a classification, whatever the condenser did', () => {
        const surfaces = classify_surfaces([
            { status: 'M', path: 'src/scripts/condense.ts' },
            { status: 'A', path: 'src/scripts/condense.sh' },
        ]);
        expect([...surfaces]).toEqual([]);
    });
});

describe('the paths that moved, pinned so the tables cannot go blind again', () => {
    it('recognises the settings template at BOTH roots it has lived at', () => {
        for (const path of ['config/agent-settings.template.yml', 'src/config/agent-settings.template.yml']) {
            expect(settings_key_paths([{ status: 'M', path }])).toEqual([path]);
        }
    });

    it('fires installer-layout for the entry point at BOTH roots it has lived at', () => {
        for (const path of ['scripts/install.py', 'src/scripts/install.ts', 'src/scripts/install.sh']) {
            expect([...classify_surfaces([{ status: 'A', path }])]).toEqual(['installer-layout']);
        }
    });

    it('leaves build output of the installer alone, because its source is already covered', () => {
        expect([...classify_surfaces([{ status: 'A', path: 'dist/install/install.mjs' }])]).toEqual([]);
    });

    // The templates tree moved `templates/` -> `src/templates/` inside the
    // scored window, and the row stayed anchored at the old root until round 2
    // of the review found it — the same stale-anchor class as the settings
    // defect, in the same table, missed because the regression test above
    // pinned only the entry point. Latent when found (no span creates or
    // removes under `src/templates/`), which is exactly why nothing caught it.
    it('fires installer-layout for the templates tree at BOTH roots it has lived at', () => {
        for (const path of ['templates/AGENTS.md', 'src/templates/AGENTS.md']) {
            expect([...classify_surfaces([{ status: 'A', path }])]).toEqual(['installer-layout']);
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual(['installer-layout']);
        }
    });

    it('matches the schema directory wherever it sits', () => {
        expect(settings_key_paths([{ status: 'M', path: 'src/scripts/schemas/agent-settings.schema.json' }])).toEqual([
            'src/scripts/schemas/agent-settings.schema.json',
        ]);
    });

    it('returns each settings path once and ignores everything else', () => {
        expect(
            settings_key_paths([
                { status: 'M', path: 'src/config/agent-settings.template.yml' },
                { status: 'D', path: 'src/config/agent-settings.template.yml' },
                { status: 'M', path: 'README.md' },
            ]),
        ).toEqual(['src/config/agent-settings.template.yml']);
    });

    it('has no root-anchored row left that a relocation could silence', () => {
        const anchored = SETTINGS_KEY_FILES.filter((re) => re.source.startsWith('^'));
        expect(anchored.map((re) => re.source)).toEqual([]);
    });
});

describe('removed_setting_keys — a minus line is not a removal', () => {
    it('reports a key the patch deletes and does not put back', () => {
        expect(removed_setting_keys('-worktrees:\n-  mode: ask\n')).toEqual(['mode', 'worktrees']);
    });

    it('reports nothing when the same key is re-added, whatever its indent', () => {
        expect(removed_setting_keys('-  mode: ask\n+    mode: ask\n')).toEqual([]);
        expect(removed_setting_keys('-worktrees:\n-  mode: ask\n+worktrees:\n+  mode: off\n')).toEqual([]);
    });

    it('ignores the file headers a unified diff opens each hunk with', () => {
        expect(removed_setting_keys('--- a/x.yml\n+++ b/x.yml\n')).toEqual([]);
    });

    it('ignores a removed line that is not a key declaration', () => {
        expect(removed_setting_keys('-  # a comment\n-  - list item\n')).toEqual([]);
    });

    it('returns a sorted, deduplicated set', () => {
        expect(removed_setting_keys('-zeta: 1\n-alpha: 2\n-alpha: 3\n')).toEqual(['alpha', 'zeta']);
    });

    it('reads the real 11.0.0 removal shape', () => {
        const patch = ['@@', '-worktrees:', '-  mode: ask', ' memory:', '   cadence: auto'].join('\n');
        expect(removed_setting_keys(patch)).toEqual(['mode', 'worktrees']);
    });
});
