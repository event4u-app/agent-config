import { describe, expect, it } from 'vitest';

import {
    MAJOR_SURFACES,
    SETTINGS_KEY_FILES,
    UNDERIVABLE_SURFACES,
    classify_surfaces,
    parse_name_status,
    removed_setting_keys,
    settings_key_paths,
    span_surfaces,
    unshipped_pending_rows,
} from '../../src/scripts/_lib/major_surface.js';
import { NO_IMPACT_TRAILERS } from '../../src/scripts/_lib/consumer_impact.js';
import { span_bump } from '../../src/scripts/_lib/impact_bump.js';

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

describe('classify_surfaces — the triggers a diff can decide', () => {
    // Owner ruling 2026-10-30: a major is a breaking change. A consumer-facing
    // installer path that disappears breaks a consumer; one that appears does
    // not. The 20.0.0 near-miss was a new internal module under src/install/.
    it('fires installer-layout only when a consumer-facing installer path is removed', () => {
        for (const path of ['templates/AGENTS.md', 'bin/agent-config', 'scripts/install.py']) {
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual(['installer-layout']);
            expect([...classify_surfaces([{ status: 'A', path }])]).toEqual([]);
        }
    });

    it('never fires installer-layout for installer source code, created or removed', () => {
        for (const path of [
            'src/install/hostConfigMerge.ts',
            'src/install/wizard-plan.ts',
            'packages/core/installer/index.ts',
        ]) {
            expect([...classify_surfaces([{ status: 'A', path }])]).toEqual([]);
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual([]);
        }
    });

    it('numbers a span that only adds an installer module as a minor, not a major', () => {
        const surfaces = classify_surfaces([{ status: 'A', path: 'src/install/hostConfigMerge.ts' }]);
        expect(
            span_bump({
                commits: [{ breaking: false, trailers: NO_IMPACT_TRAILERS }],
                has_minor_type: true,
                surfaces,
            }),
        ).toBe('minor');
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

    // Positive control pinned to a named span: 15.0.0 retired `/chat-history`
    // and its sub-command, and these are the four deletions that span carries.
    it('fires command-removal on the 15.0.0 deletions, in source and projection', () => {
        for (const path of [
            'src/domains/meta/chat-history/command.md',
            'src/domains/meta/chat-history/import/command.md',
            'dist/agent-src/commands/chat-history.md',
            'dist/agent-src/commands/chat-history/import.md',
            'src/agent-src/commands/gone.md',
        ]) {
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual(['command-removal']);
            expect([...classify_surfaces([{ status: 'A', path }])]).toEqual([]);
            expect([...classify_surfaces([{ status: 'M', path }])]).toEqual([]);
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
                { status: 'D', path: 'templates/AGENTS.md' },
                { status: 'D', path: 'src/skills/gone/SKILL.md' },
                { status: 'D', path: 'src/domains/meta/gone/command.md' },
            ],
            ['memory.cadence'],
            1,
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
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual(['installer-layout']);
        }
    });

    it('leaves build output of the installer alone, because its source is already covered', () => {
        expect([...classify_surfaces([{ status: 'D', path: 'dist/install/install.mjs' }])]).toEqual([]);
    });

    // The templates tree moved `templates/` -> `src/templates/` inside the
    // scored window, and the row stayed anchored at the old root until round 2
    // of the review found it — the same stale-anchor class as the settings
    // defect, in the same table, missed because the regression test above
    // pinned only the entry point. Latent when found (no span creates or
    // removes under `src/templates/`), which is exactly why nothing caught it.
    it('fires installer-layout for the templates tree at BOTH roots it has lived at', () => {
        for (const path of ['templates/AGENTS.md', 'src/templates/AGENTS.md']) {
            expect([...classify_surfaces([{ status: 'D', path }])]).toEqual(['installer-layout']);
        }
    });

    it('matches the schema directory wherever it sits', () => {
        expect(settings_key_paths([{ status: 'M', path: 'src/scripts/schemas/agent-settings.schema.yml' }])).toEqual([
            'src/scripts/schemas/agent-settings.schema.yml',
        ]);
    });

    // The over-match recorded on `settings_key_paths`, closed when the surface
    // clause was wired into `release.ts` (ADR-300): a TypeScript or JSON file is
    // not read with a YAML key regex, because a deleted `enabled: true,` property
    // there would number a release as a major.
    it('selects only YAML files, never the TypeScript or JSON beside them', () => {
        expect(
            settings_key_paths([
                { status: 'M', path: 'src/scripts/schemas/agent-settings.schema.json' },
                { status: 'M', path: 'src/server/schemas/settings.ts' },
                { status: 'M', path: 'tests/install/settings_surface_snapshot.test.ts' },
            ]),
        ).toEqual([]);
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

describe('span_surfaces — the span release.ts numbers by (ADR-300)', () => {
    it('reads the name-status list and the settings patch of <tag>..HEAD', () => {
        const calls: string[][] = [];
        const git = (args: string[]): string => {
            calls.push(args);
            if (args[1] === '--name-status') return 'M\tsrc/config/agent-settings.template.yml\nD\tsrc/domains/meta/gone/command.md\n';
            return '--- a/x\n+++ b/x\n-  memory_cadence: weekly\n';
        };
        expect([...span_surfaces('16.5.0', git, () => '')].sort()).toEqual(['command-removal', 'settings-keys']);
        expect(calls).toEqual([
            ['diff', '--name-status', '16.5.0..HEAD'],
            ['diff', '16.5.0..HEAD', '--', 'src/config/agent-settings.template.yml'],
        ]);
    });

    it('asks git for no patch when no settings file changed, and nothing at all without a tag', () => {
        const calls: string[][] = [];
        const git = (args: string[]): string => {
            calls.push(args);
            return 'M\tREADME.md\n';
        };
        expect([...span_surfaces('16.5.0', git, () => '')]).toEqual([]);
        expect(calls.length).toBe(1);
        expect([...span_surfaces(null, git, () => '')]).toEqual([]);
        expect(calls.length).toBe(1);
    });
});

describe('a Pending row in BREAKING_CHANGES.md is a major surface', () => {
    const index = [
        '## Pending — landed on `main`, not yet in a released major',
        '',
        '| Landed | What changes | Migration |',
        '|---|---|---|',
        '| 2026-10-24 (`79cb86c0dd`) | **A key is removed.** | Do X. |',
        '| 2026-10-01 (`aaaaaaaaaa`) | **Shipped already.** | — |',
        '',
        '## Breaking changes by major',
    ].join('\n');

    it('counts only the rows whose commit the span carries', () => {
        expect(unshipped_pending_rows(index, ['79cb86c0dd1234', 'ffff'])).toBe(1);
        expect(unshipped_pending_rows(index, ['ffff'])).toBe(0);
        expect(unshipped_pending_rows('', ['79cb86c0dd1234'])).toBe(0);
    });

    it('turns a span that ships a Pending row into a major', () => {
        const git = (args: string[]): string => (args[0] === 'log' ? '79cb86c0dd1234\nbbbb\n' : 'M\tREADME.md\n');
        const surfaces = span_surfaces('17.4.0', git, () => index);
        expect([...surfaces]).toEqual(['pending-breaking']);
        expect(span_bump({ commits: [], surfaces, has_minor_type: true })).toBe('major');
    });

    it('leaves a span alone whose Pending rows an earlier tag already shipped', () => {
        const git = (args: string[]): string => (args[0] === 'log' ? 'cccc\n' : 'M\tREADME.md\n');
        expect([...span_surfaces('17.4.0', git, () => index)]).toEqual([]);
    });
});
