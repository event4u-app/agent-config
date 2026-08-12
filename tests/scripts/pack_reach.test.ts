/**
 * `pack_reach` — the two directions of pack reachability, and the difference
 * between them.
 *
 * The rule prose this invariant replaces described the direction that cannot
 * happen (`frontend-design` without `engineering-base`, which `requires:`
 * forbids) and missed the one that can (an `engineering-base` install with the
 * skills and no routing rule). Both directions are pinned here so a future
 * edit cannot revert to describing the impossible one.
 */
import { describe, expect, it } from 'vitest';

import {
    analyze,
    installClosure,
    type PackDef,
} from '../../src/scripts/lint_rule_skill_pack_reach.js';

function packs(defs: Array<[string, string[]]>): Map<string, PackDef> {
    return new Map(defs.map(([id, requires]) => [id, { id, requires }]));
}

const REGISTRY = packs([
    ['engineering-base', []],
    ['frontend-design', ['engineering-base']],
    ['laravel', ['engineering-base']],
]);

describe('installClosure', () => {
    it('expands hard requirements transitively', () => {
        expect([...installClosure('frontend-design', REGISTRY)].sort()).toEqual([
            'engineering-base',
            'frontend-design',
        ]);
    });

    it('does not invent the reverse edge', () => {
        // engineering-base does NOT pull frontend-design — the asymmetry that
        // makes the second check necessary.
        expect([...installClosure('engineering-base', REGISTRY)]).toEqual(['engineering-base']);
    });

    it('terminates on a cycle rather than hanging', () => {
        const cyclic = packs([
            ['a', ['b']],
            ['b', ['a']],
        ]);

        expect([...installClosure('a', cyclic)].sort()).toEqual(['a', 'b']);
    });
});

describe('unreachable-route', () => {
    it('does not fire on the real UI pairing — requires: makes it reachable', () => {
        const findings = analyze(
            [
                {
                    name: 'ui-audit-gate',
                    packs: ['frontend-design'],
                    routesToSkills: ['existing-ui-audit'],
                },
            ],
            new Map([['existing-ui-audit', ['engineering-base']]]),
            REGISTRY,
        );

        expect(findings.filter((f) => f.kind === 'unreachable-route')).toEqual([]);
    });

    it('fires when a rule routes into a pack its own packs do not pull', () => {
        const findings = analyze(
            [{ name: 'some-floor', packs: ['engineering-base'], routesToSkills: ['corpus-skill'] }],
            new Map([['corpus-skill', ['frontend-design']]]),
            REGISTRY,
        );

        expect(findings.filter((f) => f.kind === 'unreachable-route')).toHaveLength(1);
        expect(findings[0]!.subject).toBe('some-floor → skill:corpus-skill');
    });

    it('ignores an unscoped rule — it ships everywhere', () => {
        const findings = analyze(
            [{ name: 'kernel-ish', packs: [], routesToSkills: ['corpus-skill'] }],
            new Map([['corpus-skill', ['frontend-design']]]),
            REGISTRY,
        );

        expect(findings.filter((f) => f.kind === 'unreachable-route')).toEqual([]);
    });

    it('ignores a route to a skill that does not exist — that is another gate', () => {
        const findings = analyze(
            [{ name: 'r', packs: ['engineering-base'], routesToSkills: ['ghost'] }],
            new Map(),
            REGISTRY,
        );

        expect(findings).toEqual([]);
    });
});

describe('unrouted-skill', () => {
    it('fires on the measured case: skills in engineering-base, rule in frontend-design', () => {
        const findings = analyze(
            [
                {
                    name: 'ui-audit-gate',
                    packs: ['frontend-design'],
                    routesToSkills: ['existing-ui-audit'],
                },
            ],
            new Map([['existing-ui-audit', ['engineering-base']]]),
            REGISTRY,
        );

        const advisory = findings.filter((f) => f.kind === 'unrouted-skill');
        expect(advisory).toHaveLength(1);
        expect(advisory[0]!.detail).toContain('engineering-base');
    });

    it('stays quiet when the routing rule ships in the same pack', () => {
        const findings = analyze(
            [{ name: 'r', packs: ['engineering-base'], routesToSkills: ['s'] }],
            new Map([['s', ['engineering-base']]]),
            REGISTRY,
        );

        expect(findings).toEqual([]);
    });

    it('stays quiet when an unscoped rule routes to the skill', () => {
        const findings = analyze(
            [{ name: 'r', packs: [], routesToSkills: ['s'] }],
            new Map([['s', ['engineering-base']]]),
            REGISTRY,
        );

        expect(findings.filter((f) => f.kind === 'unrouted-skill')).toEqual([]);
    });
});
