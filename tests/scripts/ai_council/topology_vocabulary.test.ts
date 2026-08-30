// Tests for src/scripts/ai_council/topology_vocabulary.ts
// (road-to-inbox-harvest-2026-08-e-council-topology-evidence step 7.1).
//
// The step asks for two claims, and they are checked by two different layers:
//
// - "no eighth member without a schema change" — `VocabularyIsClosed`'s first
//   assertion reds `npm run typecheck`, which is a CI gate. That gate is the
//   enforcement; this file's job is to keep the assertions from being DELETED
//   (see "the compile-time layer is present") and to pin the runtime twin.
// - "`team` / `user_required` are not representable" — asserted here at
//   runtime, and by construction in the type layer against the real
//   `LadderVerdict` and `ImpactClass` vocabularies.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    auditCouncilTopologyVocabulary,
    COUNCIL_TOPOLOGIES,
    COUNCIL_TOPOLOGY_ARITY,
    isCouncilTopology,
    RESERVED_BY_OTHER_LAYERS,
} from '../../../src/scripts/ai_council/topology_vocabulary.js';

const MODULE_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'scripts',
    'ai_council',
    'topology_vocabulary.ts',
);

/** The seven names, verbatim from the roadmap goal diagram. Order included. */
const DIAGRAM_NAMES = [
    'single_external',
    'dual_independent',
    'advisor_diversity',
    'peer_review',
    'judge_synthesis',
    'targeted_cross_exam',
    'full_debate',
];

describe('the vocabulary is exactly the seven diagram names', () => {
    it('matches the goal diagram verbatim, in order', () => {
        expect([...COUNCIL_TOPOLOGIES]).toEqual(DIAGRAM_NAMES);
    });

    it('has arity exactly seven, so an eighth member reds this file too', () => {
        expect(COUNCIL_TOPOLOGIES.length).toBe(7);
        expect(COUNCIL_TOPOLOGY_ARITY).toBe(7);
        expect(COUNCIL_TOPOLOGIES.length).toBe(COUNCIL_TOPOLOGY_ARITY);
    });

    it('contains no duplicate name', () => {
        expect(new Set(COUNCIL_TOPOLOGIES).size).toBe(COUNCIL_TOPOLOGIES.length);
    });

    it('is frozen, so it cannot be widened at runtime', () => {
        expect(Object.isFrozen(COUNCIL_TOPOLOGIES)).toBe(true);
        expect(Object.isFrozen(RESERVED_BY_OTHER_LAYERS)).toBe(true);
    });
});

describe('`team` and `user_required` are not representable', () => {
    it('names them as reserved by other layers', () => {
        expect([...RESERVED_BY_OTHER_LAYERS]).toEqual(['team', 'user_required']);
    });

    it.each([...RESERVED_BY_OTHER_LAYERS])('rejects %s as a topology', (name) => {
        expect(isCouncilTopology(name)).toBe(false);
        expect((COUNCIL_TOPOLOGIES as readonly string[]).includes(name)).toBe(false);
    });

    it('accepts every diagram name', () => {
        for (const name of DIAGRAM_NAMES) expect(isCouncilTopology(name)).toBe(true);
    });

    it('rejects non-strings and near-misses rather than coercing them', () => {
        for (const value of [undefined, null, 7, {}, [], 'Team', 'full-debate', 'debate']) {
            expect(isCouncilTopology(value)).toBe(false);
        }
    });
});

describe('the runtime guard is sensitive, not merely satisfied', () => {
    it('passes the shipped vocabulary', () => {
        expect(auditCouncilTopologyVocabulary()).toEqual([]);
    });

    it('fails an eighth member', () => {
        const problems = auditCouncilTopologyVocabulary([...COUNCIL_TOPOLOGIES, 'eighth_topology']);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('arity: expected exactly 7 topologies, found 8');
    });

    it('fails a seventh member removed', () => {
        const problems = auditCouncilTopologyVocabulary(COUNCIL_TOPOLOGIES.slice(0, 6));
        expect(problems[0]).toContain('found 6');
    });

    it.each([...RESERVED_BY_OTHER_LAYERS])('fails when %s is added to the vocabulary', (name) => {
        // Swap, not append, so the arity finding cannot mask the reserved one.
        const mutated = [...COUNCIL_TOPOLOGIES.slice(0, 6), name];
        const problems = auditCouncilTopologyVocabulary(mutated);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain(`reserved: \`${name}\``);
    });

    it('fails a duplicated name', () => {
        const mutated = [...COUNCIL_TOPOLOGIES.slice(0, 6), 'peer_review'];
        expect(auditCouncilTopologyVocabulary(mutated)).toContain(
            'duplicate: the vocabulary contains a repeated name.',
        );
    });

    it('reports every independent problem at once', () => {
        const problems = auditCouncilTopologyVocabulary([...COUNCIL_TOPOLOGIES, 'team', 'user_required']);
        expect(problems).toHaveLength(3);
    });
});

describe('the compile-time layer is present', () => {
    // `npm run typecheck` is what actually enforces the type assertions; a
    // vitest run never type-checks. What a test CAN do is notice the
    // assertions being deleted, which would leave claim 1 and claim 2 resting
    // on the runtime half alone.
    const source = fs.readFileSync(MODULE_PATH, 'utf-8');

    it('declares the closed-vocabulary assertion tuple', () => {
        expect(source).toContain('export type VocabularyIsClosed');
    });

    it('still carries all five assertions', () => {
        expect(source.match(/Assert</g) ?? []).toHaveLength(6); // 5 uses + the declaration
    });

    it('binds the exclusion to the real foreign vocabularies, not to two strings', () => {
        expect(source).toContain("import type { LadderVerdict } from '../_lib/judgment_ladder.js'");
        expect(source).toContain("import type { ImpactClass } from './necessity.js'");
        expect(source).toContain('Extract<CouncilTopology, LadderVerdict>');
        expect(source).toContain('Extract<CouncilTopology, ImpactClass>');
    });

    it('imports the foreign vocabularies as TYPES only, so nothing couples at runtime', () => {
        expect(source).not.toMatch(/^import \{[^}]*\} from '\.\.\/_lib\/judgment_ladder\.js'/m);
        expect(source).not.toMatch(/^import \{[^}]*\} from '\.\/necessity\.js'/m);
    });
});
