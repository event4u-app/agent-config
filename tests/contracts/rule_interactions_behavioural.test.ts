// Behavioural 2-axis contract for docs/contracts/rule-interactions.yml
// (PURE-TS port of the BEHAVIOURAL layer of
// tests/contracts/test_rule_interactions.py).
//
// The STRUCTURAL layer (constants + golden-parity of the linter) is already
// covered by tests/scripts/lint_rule_interactions.test.ts. This file ports
// ONLY the behavioural gap: the four roadmap-mandated 2-axis cases
// (autonomy×scope, autonomy×commit, scope×verify, memory×commit) must be
// present and assert the dominant (senior) rule's Iron Law fires when both
// rules could trigger.
//
// "memory" in roadmap shorthand = standing instructions; the on-disk surface
// is `autonomous-execution`, so memory-x-commit maps to the same YAML pair as
// autonomy-x-commit. This indirection is intentional — the package has no
// standalone `agent-memory` rule slug.
//
// No python, no oracle: parse the YAML directly and assert.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MATRIX_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'rule-interactions.yml');

interface Pair {
    id: string;
    rules: string[];
    relation: string;
    conflict: string;
    resolution: string;
    evidence: string[];
}

// Roadmap-mandated 2-axis cases: roadmap label → YAML pair-id + senior/junior.
// The senior rule is the one whose Iron Law fires when both could trigger.
const ROADMAP_AXIS_CASES: Record<string, { pair_id: string; senior: string; junior: string }> = {
    'autonomy-x-scope': {
        pair_id: 'autonomy-x-scope-control',
        senior: 'scope-control',
        junior: 'autonomous-execution',
    },
    'autonomy-x-commit': {
        pair_id: 'autonomy-x-commit-policy',
        senior: 'commit-policy',
        junior: 'autonomous-execution',
    },
    'scope-x-verify': {
        pair_id: 'scope-x-verify-before-complete',
        senior: 'verify-before-complete',
        junior: 'scope-control',
    },
    // "memory" shorthand = standing instructions → on-disk `autonomous-execution`.
    'memory-x-commit': {
        pair_id: 'autonomy-x-commit-policy',
        senior: 'commit-policy',
        junior: 'autonomous-execution',
    },
};

function loadMatrix(): { version?: number; rules?: string[]; pairs: Pair[] } {
    return parseYaml(fs.readFileSync(MATRIX_PATH, 'utf-8'), { version: '1.1' });
}

function pairsById(): Record<string, Pair> {
    const out: Record<string, Pair> = {};
    for (const p of loadMatrix().pairs) {
        out[p.id] = p;
    }
    return out;
}

// Sorted labels mirror `params=sorted(ROADMAP_AXIS_CASES)` so the parametrized
// case set is identical to the python spec.
const AXIS_LABELS = Object.keys(ROADMAP_AXIS_CASES).sort();

describe('rule-interactions behavioural 2-axis cases', () => {
    for (const label of AXIS_LABELS) {
        const spec = ROADMAP_AXIS_CASES[label];

        describe(label, () => {
            const byId = pairsById();
            const pair = byId[spec.pair_id];

            it('roadmap axis maps to an existing matrix pair', () => {
                expect(
                    pair,
                    `roadmap axis ${label} expects pair ${spec.pair_id} but matrix has none`,
                ).toBeDefined();
            });

            it('case present and well-oriented: senior first, both rules listed', () => {
                const rules = pair.rules;
                expect(rules).toContain(spec.senior);
                expect(rules).toContain(spec.junior);
                // Senior rule must be first in pair.rules.
                expect(rules[0]).toBe(spec.senior);
            });

            it('resolution invokes the senior rule (or its Iron Law)', () => {
                const resolution = pair.resolution.toLowerCase();
                expect(
                    resolution.includes(spec.senior) || resolution.includes('iron law'),
                    `${label}: resolution does not invoke senior rule ${spec.senior} or its Iron Law`,
                ).toBe(true);
            });

            it('evidence anchors the senior rule', () => {
                const seniorEvidence = pair.evidence.filter((citation) =>
                    citation.includes(`/rules/${spec.senior}.md`),
                );
                expect(
                    seniorEvidence.length,
                    `${label}: evidence for pair ${spec.pair_id} cites no anchor on senior rule ${spec.senior}`,
                ).toBeGreaterThan(0);
            });
        });
    }
});
