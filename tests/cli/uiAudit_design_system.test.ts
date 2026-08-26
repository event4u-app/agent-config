// `road-to-component-granularity-vocabulary` step 0.5 (D7).
//
// `SYSTEM_MARKERS[0]` matched the literal path `components/ui/<name>.tsx` to
// decide "this project has shadcn". shadcn's own `components.json` DECLARES
// where its primitives live, under `aliases.ui`, and a project that points that
// alias anywhere else was reported as having no design system at all — the
// opposite of the truth, on the one signal the audit's whole `audit_path`
// branch turns on.
//
// These fixtures are the step's verify: an aliased project still yields a
// non-empty `design_system_markers`, and a project with no shadcn signal at all
// still yields none.
import { describe, expect, it } from 'vitest';

import * as fs from 'node:fs';

import { AUDIT_KINDS, buildArtefact, isBarrel, shadcnUiDirs } from '../../src/cli/commands/uiAudit.js';

const NOW = '2026-08-26T00:00:00.000Z';

function markers(files: ReadonlyArray<readonly [string, string]>): string[] {
    return buildArtefact('/repo', files, NOW).design_system_markers.map((m) => m.marker);
}

const BUTTON = 'export function Button() { return null; }\n';

describe('shadcnUiDirs — read the declaration, do not guess the path', () => {
    it('reads aliases.ui and strips the alias token', () => {
        expect(
            shadcnUiDirs([['components.json', JSON.stringify({ aliases: { ui: '@/ui/primitives' } })]]),
        ).toEqual(['ui/primitives/']);
    });

    it.each([
        ['@/components/ui', 'components/ui/'],
        ['~/lib/ui', 'lib/ui/'],
        ['./src/ui', 'src/ui/'],
        ['src/design/ui/', 'src/design/ui/'],
    ])('normalises %s to %s', (alias, expected) => {
        expect(shadcnUiDirs([['components.json', JSON.stringify({ aliases: { ui: alias } })]])).toEqual([
            expected,
        ]);
    });

    it.each([
        ['no aliases key', JSON.stringify({ style: 'default' })],
        ['no ui alias', JSON.stringify({ aliases: { utils: '@/lib/utils' } })],
        ['empty ui alias', JSON.stringify({ aliases: { ui: '   ' } })],
        ['unparseable', '{ not json'],
    ])('returns nothing for %s', (_label, text) => {
        expect(shadcnUiDirs([['components.json', text]])).toEqual([]);
    });

    it('ignores a components.json that is not at a components.json basename', () => {
        expect(shadcnUiDirs([['docs/example-components.json', JSON.stringify({ aliases: { ui: '@/ui' } })]])).toEqual(
            [],
        );
    });
});

describe('design-system detection — the aliased project is the regression', () => {
    it('THE STEP VERIFY: an aliased ui dir still marks shadcn', () => {
        // Before 0.5 this returned [] — the alias points away from
        // `components/ui/`, so the hardcoded pattern never matched and the
        // project read as having no design system.
        expect(
            markers([
                ['components.json', JSON.stringify({ aliases: { ui: '@/ui/primitives' } })],
                ['ui/primitives/button.tsx', BUTTON],
            ]),
        ).toContain('shadcn');
    });

    it('the conventional path still marks shadcn with no components.json at all', () => {
        expect(markers([['components/ui/button.tsx', BUTTON]])).toContain('shadcn');
    });

    it('both signals present marks shadcn exactly once', () => {
        const got = markers([
            ['components.json', JSON.stringify({ aliases: { ui: '@/components/ui' } })],
            ['components/ui/button.tsx', BUTTON],
        ]);
        expect(got.filter((m) => m === 'shadcn')).toHaveLength(1);
    });

    it('a declared alias with no file under it marks nothing', () => {
        // The declaration alone is not the signal — a `components.json` can
        // outlive the directory it names.
        expect(
            markers([['components.json', JSON.stringify({ aliases: { ui: '@/ui/primitives' } })]]),
        ).not.toContain('shadcn');
    });

    it('a non-tsx file under the declared alias does not mark shadcn', () => {
        expect(
            markers([
                ['components.json', JSON.stringify({ aliases: { ui: '@/ui/primitives' } })],
                ['ui/primitives/README.md', '# primitives\n'],
            ]),
        ).not.toContain('shadcn');
    });

    it('a project with neither signal marks nothing', () => {
        expect(markers([['src/App.tsx', BUTTON]])).not.toContain('shadcn');
    });
});

// `road-to-component-granularity-vocabulary` step 0.6.
//
// `index.[jt]sx?` is one of the page markers and a barrel is the commonest thing
// to call `index`. Reproduced before the fix: a two-line re-export barrel at
// `src/ui/components/index.tsx` classified as `page` — and `page` is what the
// audit_path branch and every downstream consumer read as "a screen".
describe('classify — a barrel is not a page', () => {
    function kind(rel: string, text: string): string {
        return buildArtefact('/repo', [[rel, text]]).components_found[0]?.kind ?? '(filtered out)';
    }
    const BARREL = "export { Button } from './Button';\nexport { Card } from './Card';\n";
    const SCREEN = 'export default function Page() { return null; }\n';

    it('THE STEP VERIFY: a re-export barrel named index does NOT classify as page', () => {
        expect(kind('src/ui/components/index.tsx', BARREL)).toBe('component');
    });

    it('a real page.tsx still classifies as page', () => {
        expect(kind('src/ui/app/settings/page.tsx', SCREEN)).toBe('page');
    });

    it('a file under pages/ still classifies as page whatever its body', () => {
        expect(kind('src/ui/pages/Settings.tsx', BARREL)).toBe('page');
    });

    it('an index that RENDERS is a page, not a barrel', () => {
        expect(kind('src/ui/components/index.tsx', SCREEN)).toBe('page');
    });

    it('a hybrid index — re-exports AND a declaration — stays a page', () => {
        // Conservative on purpose: a false negative costs a page label, a false
        // positive would silently reclassify a real screen.
        expect(kind('src/ui/components/index.tsx', BARREL + SCREEN)).toBe('page');
    });
});

describe('isBarrel', () => {
    it.each([
        ["export { A } from './A';", true],
        ["export * from './A';", true],
        ["export { A } from './A';\n// a comment\n\nexport * from './B';", true],
        ['/* leading block */\nexport * from "./A";', true],
        ['', false],
        ['export const A = 1;', false],
        ["export { A } from './A';\nconsole.log('side effect');", false],
        ['export default function X() { return null; }', false],
        ["import './styles.css';\nexport * from './A';", false],
    ])('%s -> %s', (text, want) => {
        expect(isBarrel(text as string)).toBe(want);
    });
});

// `road-to-component-granularity-vocabulary` step 0.6, second half.
//
// The roadmap records `view` as "0 in any JS tree" and reads that as dead. It is
// not dead — it is the BLADE branch, and measuring a JS tree is the wrong
// instrument for it. This repository's own Laravel fixtures exercise it.
describe('classify — `view` is the Blade branch, not a dead one', () => {
    function kind(rel: string, text: string): string {
        return buildArtefact('/repo', [[rel, text]]).components_found[0]?.kind ?? '(filtered out)';
    }
    it.each([
        'resources/views/bookings/index.blade.php',
        'resources/views/livewire/seat-map.blade.php',
    ])('%s classifies as view', (rel) => {
        expect(kind(rel, '<div>{{ $x }}</div>')).toBe('view');
    });

    it('a Blade file under a pages-like path is still a view, not a page', () => {
        // Ordering matters: the blade test now runs BEFORE the pages/app test,
        // so a Laravel project with `resources/views/pages/` is not mislabelled.
        expect(kind('resources/views/pages/home.blade.php', '<div/>')).toBe('view');
    });
});

// `road-to-component-granularity-vocabulary` step 0.1, and its verify verbatim:
// "the value list in existing-ui-audit/SKILL.md and the union in
// ComponentEntry['kind'] are string-identical, asserted by a test that READS
// BOTH FILES rather than restating either."
//
// So this test reads the skill off disk. A test that hardcoded the expected list
// would pass while both surfaces drifted together, which is the failure it is
// here to prevent.
describe('the audit kind enum has ONE definition', () => {
    const SKILL = 'src/skills/existing-ui-audit/SKILL.md';

    it('the skill states exactly the kinds the code emits', () => {
        const text = fs.readFileSync(SKILL, 'utf8');
        const m = text.match(/kind:\s*([a-z|]+)\s*,/);
        expect(m, `${SKILL} must declare a \`kind: a|b|c\` list`).not.toBeNull();
        const declared = (m as RegExpMatchArray)[1]!.split('|');
        expect([...declared].sort()).toEqual([...AUDIT_KINDS].sort());
    });

    it('the skill does not resurrect the two values with no operational definition', () => {
        const text = fs.readFileSync(SKILL, 'utf8');
        const m = text.match(/kind:\s*([a-z|]+)\s*,/);
        const declared = (m as RegExpMatchArray)[1]!.split('|');
        for (const dead of ['partial', 'layout']) {
            expect(declared, `${dead} has no testable definition — see AUDIT_KINDS`).not.toContain(dead);
        }
    });

    it('`view` is in the set — it is the Blade branch, not a dead value', () => {
        // Pinned because two independent reviewers recommended removing it on
        // the stated premise "0 occurrences in any JS tree", which is true and
        // is the wrong corpus. This repository's Blade fixtures classify as
        // `view`, and the classify tests above prove it.
        expect(AUDIT_KINDS).toContain('view');
    });
});
