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
import { readFileSync } from 'node:fs';
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

    it('renders a human summary that states the trust posture', () => {
        const r = run([path.join(FIXTURES, 'native.json'), '--format', 'summary']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('observed, not authoritative');
        expect(r.stdout).toContain('lane: native');
    });
});
