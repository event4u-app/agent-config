/**
 * `design_system_import` — the three-lane adapter into the `design-system.json`
 * contract (road-to-design-system-onramp Phase 1).
 *
 * The fixture pairs under `fixtures/design-system-import/` ARE the extractor
 * compatibility matrix. Asserting them as data rather than describing them in
 * prose is the point: a third-party tool that changes its output shape fails
 * here instead of quietly degrading an import, which is the roadmap's Risk 3.
 *
 * The behavioural tests below cover what a fixture pair cannot show — the
 * rejections, the inferences the adapter marks as inferences, and the two
 * silent-overwrite classes (palette roles, DTCG aliases) that a passing
 * end-to-end import would otherwise hide.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    type ProvenanceOverride,
    detectLane,
    importDesignSystem,
    resolveAlias,
    roleName,
} from '../../src/scripts/_lib/design_system_import.js';
import { importClaudeDesignSnapshot, readCustomProperties } from '../../src/scripts/_lib/design_system_claude_design.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'design-system-import');
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CLI = path.join(REPO_ROOT, 'src', 'scripts', 'design_system_import.ts');

const PROVENANCE: ProvenanceOverride = {
    kind: 'url',
    ref: 'https://example.com',
    captured_at: '2026-08-13T09:00:00Z',
};

function readFixture(name: string): unknown {
    return JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf-8'));
}

describe('lane detection', () => {
    it('prefers native whenever a usable source block is present', () => {
        expect(detectLane(readFixture('native.json'))).toBe('native');
    });

    it('detects a DTCG token file by its {$value} leaves', () => {
        expect(detectLane(readFixture('dtcg.tokens.json'))).toBe('dtcg');
    });

    it('detects an extraction output by its documented top-level keys', () => {
        expect(detectLane(readFixture('dembrandt.json'))).toBe('dembrandt');
    });

    it('accepts the draft-era {value, type} spelling as DTCG', () => {
        expect(detectLane({ color: { primary: { value: '#fff', type: 'color' } } })).toBe('dtcg');
    });

    it('returns null rather than guessing on an unrecognised object', () => {
        expect(detectLane({ hello: 'world' })).toBeNull();
        expect(detectLane([1, 2, 3])).toBeNull();
        expect(detectLane('not an object')).toBeNull();
    });
});

describe('extractor compatibility matrix (fixture pairs)', () => {
    const cases: Array<{ lane: string; input: string; expected: string }> = [
        { lane: 'native', input: 'native.json', expected: 'native.expected.json' },
        { lane: 'dtcg', input: 'dtcg.tokens.json', expected: 'dtcg.expected.json' },
        { lane: 'dembrandt', input: 'dembrandt.json', expected: 'dembrandt.expected.json' },
    ];

    for (const c of cases) {
        it(`maps the ${c.lane} lane to the contract shape`, () => {
            const outcome = importDesignSystem(readFixture(c.input), PROVENANCE);
            expect(outcome.ok).toBe(true);
            if (!outcome.ok) return;
            expect(outcome.lane).toBe(c.lane);
            expect(outcome.design_system).toEqual(readFixture(c.expected));
        });
    }
});

describe('provenance is mandatory on every lane', () => {
    it('rejects a native artifact whose source block is missing', () => {
        const outcome = importDesignSystem({ colors: { light: { a: '#fff' } }, source: {} });
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.reason).toContain('source.kind');
    });

    it('rejects a native artifact whose source.kind is not url|repo|dir', () => {
        const outcome = importDesignSystem({
            source: { kind: 'ftp', ref: 'x', captured_at: '2026-01-01' },
        });
        expect(outcome.ok).toBe(false);
    });

    it('rejects a DTCG file when the caller supplies no provenance', () => {
        const outcome = importDesignSystem(readFixture('dtcg.tokens.json'));
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.lane).toBe('dtcg');
        expect(outcome.reason).toContain('no provenance');
    });

    it('records whether provenance was extracted or asserted', () => {
        const fromInput = importDesignSystem(readFixture('native.json'), PROVENANCE);
        const fromCaller = importDesignSystem(readFixture('dtcg.tokens.json'), PROVENANCE);
        expect(fromInput.ok && fromInput.design_system.source._meta?.provenance_origin).toBe('input');
        expect(fromCaller.ok && fromCaller.design_system.source._meta?.provenance_origin).toBe('caller');
    });

    it('records an unstated capture time as unknown rather than inventing one', () => {
        const outcome = importDesignSystem(readFixture('dtcg.tokens.json'), {
            kind: 'dir',
            ref: './tokens',
        });
        expect(outcome.ok && outcome.design_system.source.captured_at).toBe('unknown');
    });
});

describe('role naming does not silently overwrite', () => {
    it('keeps two palette steps of the same number apart', () => {
        expect(roleName(['color', 'gray', '50'])).toBe('gray-50');
        expect(roleName(['color', 'blue', '50'])).toBe('blue-50');
    });

    it('keeps two bucket-named leaves apart', () => {
        expect(roleName(['component', 'button', 'radius'])).toBe('button-radius');
        expect(roleName(['component', 'card', 'radius'])).toBe('card-radius');
    });

    it('leaves an ordinary role as its own name', () => {
        expect(roleName(['semantic', 'color', 'background'])).toBe('background');
    });

    it('maps every palette entry rather than collapsing them', () => {
        const outcome = importDesignSystem(readFixture('dtcg.tokens.json'), PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        const light = outcome.design_system.colors?.light ?? {};
        expect(Object.keys(light)).toEqual(
            expect.arrayContaining(['gray-50', 'gray-900', 'blue-50', 'blue-500']),
        );
    });
});

describe('DTCG alias resolution', () => {
    const root = {
        primitive: { color: { gray: { 50: { $value: '#F9FAFB', $type: 'color' } } } },
        alias: { one: { $value: '{primitive.color.gray.50}', $type: 'color' } },
    };

    it('resolves a reference to the value it points at', () => {
        expect(resolveAlias('{primitive.color.gray.50}', root)).toBe('#F9FAFB');
    });

    it('follows a chain of references', () => {
        expect(resolveAlias('{alias.one}', root)).toBe('#F9FAFB');
    });

    it('returns a dangling reference verbatim so the broken pointer stays visible', () => {
        expect(resolveAlias('{primitive.color.nope}', root)).toBe('{primitive.color.nope}');
    });

    it('does not hang on a self-referential token', () => {
        const looping = { a: { $value: '{a}', $type: 'color' } };
        expect(resolveAlias('{a}', looping)).toBe('{a}');
    });

    it('leaves a literal value untouched', () => {
        expect(resolveAlias('#123456', root)).toBe('#123456');
    });

    it('flags an unresolvable alias in the notes', () => {
        const outcome = importDesignSystem(
            { semantic: { color: { bg: { $value: '{nope.missing}', $type: 'color' } } } },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.notes.join(' ')).toContain('alias reference');
    });
});

describe('DTCG alias chains are kept, cycles are named', () => {
    // D5: two roles aliasing one primitive used to import as two equal hex
    // values with nothing saying they were the same decision.
    const shared = {
        color: { blue: { 600: { $value: '#2563EB', $type: 'color' } } },
        action: { primary: { $value: '{color.blue.600}', $type: 'color' } },
        link: { $value: '{color.blue.600}', $type: 'color' },
    };

    it('alias-control: both roles keep their reference, and a cycle is a cycle', () => {
        const outcome = importDesignSystem(shared, PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system._meta?.['alias_of']).toEqual({
            'action.primary': 'color.blue.600',
            link: 'color.blue.600',
        });

        const looping = importDesignSystem(
            { color: { self: { $value: '{color.self}', $type: 'color' } } },
            PROVENANCE,
        );
        expect(looping.ok).toBe(true);
        if (!looping.ok) return;
        expect(looping.design_system._meta?.['alias_cycles']).toEqual(['color.self']);
        expect(looping.notes.join(' ')).not.toContain('does not define');
    });

    it('alias-record: values stay resolved and a chain is recorded hop by hop', () => {
        const chained = {
            ...shared,
            brand: { $value: '{action.primary}', $type: 'color' },
        };
        const outcome = importDesignSystem(chained, PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system.colors?.light).toMatchObject({
            primary: '#2563EB',
            link: '#2563EB',
            brand: '#2563EB',
        });
        expect(outcome.design_system._meta?.['alias_of']).toMatchObject({ brand: 'action.primary' });
        expect(outcome.design_system._meta?.['alias_cycles']).toBeUndefined();
    });

    it('alias-record: a dangling reference is still undefined, not a cycle', () => {
        const outcome = importDesignSystem(
            { color: { bg: { $value: '{nope.missing}', $type: 'color' } } },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system._meta?.['alias_cycles']).toBeUndefined();
        expect(outcome.notes.join(' ')).toContain('does not define');
    });

    // road-to-a-brand-the-tree-can-check 3.5 — one row, added after canvas 3.1.
    // Stable DTCG 2025.10 makes a colour `$value` an object, so an alias onto
    // one resolves to nothing this adapter can map. Before this row that read
    // exactly like a pointer at a token the file never defined: same verbatim
    // reference, same note. The two need opposite actions, so they stay apart.
    it('alias-object-value: an unmappable target is not a missing one', () => {
        const objectValued = importDesignSystem(
            {
                color: {
                    blue: {
                        600: {
                            $value: { colorSpace: 'srgb', components: [0.15, 0.39, 0.92], hex: '#2563EB' },
                            $type: 'color',
                        },
                    },
                },
                action: { primary: { $value: '{color.blue.600}', $type: 'color' } },
            },
            PROVENANCE,
        );
        expect(objectValued.ok).toBe(true);
        if (!objectValued.ok) return;
        // It exists — the adapter says so by listing the target, not the alias.
        expect(objectValued.design_system._meta?.['unmapped']).toMatchObject({
            'color.blue.600': '<non-scalar $value>',
        });
        expect(objectValued.design_system._meta?.['alias_of']).toMatchObject({
            'action.primary': 'color.blue.600',
        });
        expect(objectValued.design_system._meta?.['alias_cycles']).toBeUndefined();
        const objectNotes = objectValued.notes.join(' ');
        expect(objectNotes).toContain('DOES define');
        expect(objectNotes).not.toContain('does not define');

        // The missing target keeps the other note and lists nothing as unmapped.
        const missing = importDesignSystem(
            { action: { primary: { $value: '{color.blue.600}', $type: 'color' } } },
            PROVENANCE,
        );
        expect(missing.ok).toBe(true);
        if (!missing.ok) return;
        expect(missing.design_system._meta?.['unmapped']).toBeUndefined();
        const missingNotes = missing.notes.join(' ');
        expect(missingNotes).toContain('does not define');
        expect(missingNotes).not.toContain('DOES define');
    });

    it('alias-record: a two-token loop names both members', () => {
        const outcome = importDesignSystem(
            {
                color: {
                    a: { $value: '{color.b}', $type: 'color' },
                    b: { $value: '{color.a}', $type: 'color' },
                },
            },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system._meta?.['alias_cycles']).toEqual(['color.a', 'color.b']);
    });
});

describe('observation is never promoted to a token', () => {
    it('routes WCAG results and breakpoints to _meta', () => {
        const outcome = importDesignSystem(readFixture('dembrandt.json'), PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system._meta).toHaveProperty('wcag');
        expect(outcome.design_system._meta).toHaveProperty('breakpoints');
        expect(outcome.notes.join(' ')).toContain('wcag results are observation');
    });

    it('marks the semantic-map-as-light-theme inference as an inference', () => {
        const outcome = importDesignSystem(readFixture('dembrandt.json'), PROVENANCE);
        expect(outcome.ok && outcome.notes.join(' ')).toContain('semantic role map');
    });

    it('keeps an off-contract native key instead of dropping it', () => {
        const outcome = importDesignSystem(readFixture('native.json'), PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        const unmapped = outcome.design_system._meta?.['unmapped'] as Record<string, unknown>;
        expect(unmapped).toHaveProperty('licence_notes');
        expect(outcome.notes.join(' ')).toContain('licence_notes');
    });

    // Added with the `spec.maturity` block (3.1). A blind review found the
    // contract documenting the field while the importer routed it to
    // `_meta.unmapped` as "not in the contract" — two surfaces disagreeing
    // about one key, which is exactly what an off-contract note is for and
    // exactly the wrong verdict here.
    it('carries a `spec` block through instead of treating it as off-contract', () => {
        const input = {
            source: { kind: 'dir', ref: '.', captured_at: '2026-09-09T00:00:00Z' },
            spec: {
                maturity: 'finished',
                maturity_source: 'declaration',
                maturity_signal: 'the artifact declares `maturity: finished`',
            },
        };
        const outcome = importDesignSystem(input, PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system['spec']).toEqual(input.spec);
        const unmapped = outcome.design_system._meta?.['unmapped'] as Record<string, unknown> | undefined;
        expect(unmapped?.['spec']).toBeUndefined();
        expect(outcome.notes.join(' ')).not.toContain('"spec" is not in the contract');
    });

    it('flags a contract key whose shape is wrong without discarding its value', () => {
        const outcome = importDesignSystem({
            source: { kind: 'dir', ref: '.', captured_at: '2026-01-01' },
            components: { not: 'an array' },
        });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.notes.join(' ')).toContain('should be an array');
        expect(outcome.design_system.components).toEqual({ not: 'an array' });
    });

    it('ships an unmappable extraction as observation only, per the lane falsifier', () => {
        const outcome = importDesignSystem(
            { breakpoints: { sm: '640px' } },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.notes.join(' ')).toContain('observation only');
        expect(outcome.design_system.colors).toBeUndefined();
    });
});

/**
 * Every case below is a probe the R2 completion reviewer executed against this
 * module and found losing data while reporting success. They are pinned here so
 * the class cannot return: the 36 tests above all passed while these failed,
 * which is exactly why a fixture suite is not a substitute for adversarial
 * probing.
 */
describe('R2 findings — nothing is lost while reporting success', () => {
    it('keeps two same-named roles from different DTCG layers', () => {
        const outcome = importDesignSystem(
            {
                semantic: { color: { background: { $value: '#ffffff', $type: 'color' } } },
                component: { card: { background: { $value: '#eeeeee', $type: 'color' } } },
            },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        const light = outcome.design_system.colors?.light ?? {};
        expect(Object.values(light)).toEqual(expect.arrayContaining(['#ffffff', '#eeeeee']));
        expect(outcome.notes.join(' ')).toContain('already held by a different value');
    });

    it('names a `default` leaf after its component, not after its bucket', () => {
        expect(roleName(['button', 'radius', 'default'])).toBe('button-radius');
        expect(roleName(['card', 'radius', 'default'])).toBe('card-radius');
    });

    it('keeps two component radii that both end in default', () => {
        const outcome = importDesignSystem(
            {
                button: { radius: { default: { $value: '4px', $type: 'dimension' } } },
                card: { radius: { default: { $value: '12px', $type: 'dimension' } } },
            },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(Object.values(outcome.design_system.radius ?? {})).toEqual(
            expect.arrayContaining(['4px', '12px']),
        );
    });

    it('never emits border widths or styles as radius tokens', () => {
        const outcome = importDesignSystem(
            { borders: { radius: ['4px', '8px'], width: '1px', style: 'solid' } },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system.radius).toBeUndefined();
        expect(outcome.design_system._meta).toHaveProperty('borders');
        expect(outcome.notes.join(' ')).toContain('borders.radius is present but not a role');
    });

    it('marks the dark-by-path inference in the DTCG lane', () => {
        const outcome = importDesignSystem(
            { color: { neutral: { dark: { $value: '#222222', $type: 'color' } } } },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.notes.join(' ')).toContain('path segment is named "dark"');
    });

    it('routes a non-scalar colour subtree to _meta instead of discarding it', () => {
        const outcome = importDesignSystem(
            { colors: { primary: '#533afd', scales: { blue: { '500': '#00f' } } } },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system._meta).toHaveProperty('colors');
        expect(outcome.notes.join(' ')).toContain('not scalar values');
    });

    it('does not report a loss for a legitimate nested colour grouping', () => {
        const outcome = importDesignSystem(readFixture('dembrandt.json'), PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system._meta).not.toHaveProperty('colors');
    });

    it('keeps motion residue that matches neither a token nor an observation', () => {
        const outcome = importDesignSystem(
            {
                motion: {
                    durations: { fast: '150ms' },
                    easings: { standard: { value: 'cubic-bezier(0,0,1,1)' } },
                    transitions: { a: 'b' },
                },
            },
            PROVENANCE,
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        const motionMeta = (outcome.design_system.motion?._meta ?? {}) as Record<string, unknown>;
        expect(motionMeta).toHaveProperty('unmapped');
        expect(Object.keys(motionMeta['unmapped'] as Record<string, unknown>)).toEqual(
            expect.arrayContaining(['transitions', 'easings']),
        );
        expect(outcome.notes.join(' ')).toContain('motion:');
    });

    it('merges into a pre-existing _meta.unmapped instead of clobbering it', () => {
        const outcome = importDesignSystem({
            source: { kind: 'dir', ref: '.', captured_at: '2026-01-01' },
            _meta: { unmapped: { keep: 'me' } },
            offContract: 1,
        });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        const unmapped = outcome.design_system._meta?.['unmapped'] as Record<string, unknown>;
        expect(unmapped).toHaveProperty('keep', 'me');
        expect(unmapped).toHaveProperty('offContract');
    });

    it('omits an empty props array and keeps a scalar component observation', () => {
        const outcome = importDesignSystem({ components: { button: 'observed once' } }, PROVENANCE);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system.components?.[0]?.observed).toEqual({});
        expect(outcome.design_system._meta).toHaveProperty('components');
        expect(outcome.notes.join(' ')).toContain('scalar observation');
    });
});

describe('a forced lane changes the mapper, never the input', () => {
    it('maps nothing when a native artifact is forced through the token mapper', () => {
        const outcome = importDesignSystem(readFixture('native.json'), PROVENANCE, 'dtcg');
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.lane).toBe('dtcg');
        expect(outcome.design_system.colors).toBeUndefined();
    });

    it('keeps extracted provenance when a native artifact is forced to another lane', () => {
        const outcome = importDesignSystem(readFixture('native.json'), undefined, 'dembrandt');
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.design_system.source._meta?.provenance_origin).toBe('input');
    });
});

describe('CLI contract', () => {
    function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
        const proc = spawnSync(
            path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'),
            [CLI, ...args],
            { encoding: 'utf8', timeout: 60_000 },
        );
        return { status: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
    }

    it('exits 0 and prints the artifact on a good import', () => {
        const r = run([path.join(FIXTURES, 'native.json')]);
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual(readFixture('native.expected.json'));
    });

    it('exits 1 when the input carries no provenance and none is supplied', () => {
        const r = run([path.join(FIXTURES, 'dtcg.tokens.json')]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('REJECTED');
    });

    it('exits 1 on an unreadable file', () => {
        const r = run([path.join(FIXTURES, 'does-not-exist.json')]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('cannot read');
    });

    it('exits 2 on a bad lane choice', () => {
        const r = run([path.join(FIXTURES, 'native.json'), '--lane', 'nope']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('invalid choice');
    });

    it('exits 2 when only half a provenance is given', () => {
        const r = run([path.join(FIXTURES, 'dtcg.tokens.json'), '--source-ref', 'x']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('must be given together');
    });

    it('exits 2 rather than silently ignoring a lone --captured-at', () => {
        const r = run([path.join(FIXTURES, 'native.json'), '--captured-at', '2026-01-01']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('--captured-at requires');
    });

    it('says so when the file own provenance overrides the supplied flags', () => {
        const r = run([
            path.join(FIXTURES, 'native.json'),
            '--source-kind',
            'dir',
            '--source-ref',
            './ignored',
        ]);
        expect(r.status).toBe(0);
        expect(r.stderr).toContain('was not used');
    });

    it('renders a human summary that states the trust posture', () => {
        const r = run([path.join(FIXTURES, 'native.json'), '--format', 'summary']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('observed, not authoritative');
        expect(r.stdout).toContain('lane: native');
    });
});

// road-to-a-canvas-the-code-owns 3.2 — the `claude-design` lane, snapshot input.
describe('claude-design lane — untrusted CSS', () => {
    it('reads a declaration and stays linear on an undelimited megabyte', () => {
        const into = { light: new Map<string, string>(), dark: new Map<string, string>(), references: new Set<string>() };
        readCustomProperties(':root { --a: #fff; }', into);
        expect(into.light.get('--a')).toBe('#fff');
        const hostile = `--a:${'x'.repeat(1_000_000)}`;
        const t0 = performance.now();
        readCustomProperties(hostile, { light: new Map(), dark: new Map(), references: new Set() });
        // Quadratic took minutes here; linear takes milliseconds. The bound is loose on purpose.
        expect(performance.now() - t0).toBeLessThan(5_000);
    });
});

describe('claude-design lane (snapshot directory)', () => {
    function snapshot(files: Record<string, string>): string {
        const dir = mkdtempSync(path.join(tmpdir(), 'cd-snapshot-'));
        for (const [rel, text] of Object.entries(files)) {
            mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
            writeFileSync(path.join(dir, rel), text);
        }
        return dir;
    }
    const BASE = {
        'source.json': JSON.stringify({ source: { kind: 'url', ref: 'canvas://project/demo', captured_at: '2026-10-18' } }),
        'styles/theme.css': [
            ':root { --color-blue-600: #2563eb; --color-primary: var(--color-blue-600); --radius-md: 8px; }',
            ':root { --space-2: 8px; --font-body: "Inter", sans-serif; --color-link: var(--color-missing); }',
            '[data-theme="dark"] { --color-primary: #60a5fa; }',
            '.btn { color: var(--color-primary); border-color: var(--color-ghost); }',
        ].join('\n'),
        'components/Button.d.ts':
            'export interface ButtonProps {\n  variant?: "primary" | "ghost";\n  size: "sm" | "md";\n  onClick?: () => void;\n}\nexport declare function Button(props: ButtonProps): JSX.Element;\n',
        'guidelines/usage.md': '# Buttons\n\nOne primary action per view.\n',
        'previews/button.html': '<button>Hi</button>',
    };

    it('claude-design: maps tokens, the custom-property closure, contracts and guidelines', () => {
        const r = importClaudeDesignSnapshot(snapshot(BASE));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const ds = r.design_system;
        expect(r.lane).toBe('claude-design');
        expect(ds.source.ref).toBe('canvas://project/demo');
        expect(ds.colors?.light?.['primary']).toBe('#2563eb');
        expect(ds.colors?.dark?.['primary']).toBe('#60a5fa');
        expect(ds.radius?.['md']).toBe('8px');
        expect(ds.spacing?.scale).toEqual(['8px']);
        expect(ds.typography?.families?.[0]).toEqual({ role: 'body', name: 'Inter', bundled_local: false });
        expect(ds.components).toEqual([{ name: 'Button', observed: { props: ['onClick', 'size', 'variant'] } }]);
        expect(ds._meta?.['alias_of']).toMatchObject({ 'css:--color-primary': '--color-blue-600' });
        expect(ds._meta?.['component_paths']).toEqual({ Button: 'components/Button.d.ts' });
        expect(ds._meta?.['guidelines']).toEqual([{ path: 'guidelines/usage.md', text: BASE['guidelines/usage.md'] }]);
    });

    it('claude-design: lists every var() with no declaration in the closure', () => {
        const r = importClaudeDesignSnapshot(snapshot(BASE));
        if (!r.ok) throw new Error(r.reason);
        expect(r.design_system._meta?.['unresolved_custom_properties']).toEqual(['--color-ghost', '--color-missing']);
        // the dangling alias is kept as observation, never invented into a colour
        expect(r.design_system.colors?.light?.['link']).toBeUndefined();
        expect(r.design_system._meta?.['unmapped_custom_properties']).toMatchObject({ '--color-link': 'var(--color-missing)' });
    });

    it('claude-design: keeps unknown files in _meta.unmapped, never drops them', () => {
        const r = importClaudeDesignSnapshot(snapshot(BASE));
        if (!r.ok) throw new Error(r.reason);
        expect(r.design_system._meta?.['unmapped']).toEqual(['previews/button.html']);
    });

    it('claude-design: provenance is mandatory', () => {
        const { 'source.json': _drop, ...rest } = BASE;
        const r = importClaudeDesignSnapshot(snapshot(rest));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(/no provenance/);
        const withFlag = importClaudeDesignSnapshot(snapshot(rest), { kind: 'dir', ref: './export' });
        expect(withFlag.ok && withFlag.design_system.source._meta?.provenance_origin).toBe('caller');
    });

    it('claude-design: a JSON file forced to the lane is refused, not mapped as another lane', () => {
        const r = importDesignSystem({ colors: {} }, { kind: 'dir', ref: '.' }, 'claude-design');
        expect(r.ok).toBe(false);
    });

    it('claude-design: the CLI routes a directory to the lane', () => {
        const proc = spawnSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [CLI, snapshot(BASE), '--format', 'summary'], {
            encoding: 'utf8',
            timeout: 60_000,
        });
        expect(proc.status).toBe(0);
        expect(proc.stdout).toContain('lane: claude-design');
    });
});
