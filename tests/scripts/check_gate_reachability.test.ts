/**
 * road-to-gates-that-do-not-run step 1.1.
 *
 * verify: the script prints its count on this tree, and its output is stable
 * across two runs.
 */
import { describe, expect, it } from 'vitest';

import {
    analyse,
    closure,
    isGateShaped,
    parseTargets,
    scriptOf,
} from '../../src/scripts/check_gate_reachability.js';

const REPO = process.cwd();

describe('the reading is stable', () => {
    it('two runs on one tree produce the identical set', () => {
        // The verify line asks for this in those words. A reachability reading
        // that drifted between runs could not be diffed against a baseline,
        // which is the whole point of committing the script.
        expect(JSON.stringify(analyse(REPO))).toBe(JSON.stringify(analyse(REPO)));
    });

    it('every gate-shaped target lands in exactly one of the three classes', () => {
        const r = analyse(REPO);
        const all = [...r.reachable, ...r.scriptInWorkflow, ...r.unreachable];
        expect(new Set(all).size).toBe(all.length);
    });

    it('finds a real corpus — a walk that read nothing is not a pass', () => {
        const r = analyse(REPO);
        expect(r.reachable.length + r.scriptInWorkflow.length + r.unreachable.length).toBeGreaterThan(100);
    });
});

describe('the three categories are distinct, and the third is the load-bearing one', () => {
    it('separates a target whose SCRIPT runs in a workflow from one that is silent', () => {
        // Conflating these overstated the hole by roughly 2x on this tree, and
        // in the misleading direction: check_rule_projection_integrity was
        // observed FAILING in a workflow while its task target was unwired.
        const r = analyse(REPO);
        expect(r.scriptInWorkflow).toContain('check-rule-projection-integrity');
        expect(r.unreachable).not.toContain('check-rule-projection-integrity');
    });

    it('a `--json` sibling of a reachable target is not counted as silent', () => {
        const r = analyse(REPO);
        expect(r.reachable).toContain('check-refs');
        expect(r.unreachable).not.toContain('check-refs-json');
    });
});

describe('the edge kinds — all three, because missing one invents a hole', () => {
    it('follows `deps:` as well as `- task:`', () => {
        // A missed edge kind does not merely undercount: it reports a target as
        // unreachable when CI does run it, which is the one error this script
        // must not make. `deps:` was missed by the first implementation.
        const defs = parseTargets(REPO);
        const withDeps = [...defs.values()].find((d) => d.name === 'lint-discovery-manifest');
        expect(withDeps?.edges).toContain('build-discovery-manifest');
    });

    it('closure is transitive', () => {
        const defs = new Map([
            ['a', { name: 'a', edges: ['b'], cmds: [], file: 'x' }],
            ['b', { name: 'b', edges: ['c'], cmds: [], file: 'x' }],
            ['c', { name: 'c', edges: [], cmds: [], file: 'x' }],
        ]);
        expect([...closure(defs, ['a'])].sort()).toEqual(['a', 'b', 'c']);
    });

    it('closure terminates on a cycle', () => {
        const defs = new Map([
            ['a', { name: 'a', edges: ['b'], cmds: [], file: 'x' }],
            ['b', { name: 'b', edges: ['a'], cmds: [], file: 'x' }],
        ]);
        expect([...closure(defs, ['a'])].sort()).toEqual(['a', 'b']);
    });
});

describe('the gate-shape predicate', () => {
    it('accepts a gate-named target and a target running a gate script', () => {
        expect(isGateShaped({ name: 'check-x', edges: [], cmds: [], file: 'f' })).toBe(true);
        expect(
            isGateShaped({ name: 'anything', edges: [], cmds: ['cmd: ./scripts-run src/scripts/lint_foo'], file: 'f' }),
        ).toBe(true);
    });

    it('rejects an ordinary target', () => {
        expect(isGateShaped({ name: 'build', edges: [], cmds: ['cmd: npm run build'], file: 'f' })).toBe(false);
    });

    it('extracts the script path a target runs', () => {
        expect(scriptOf({ name: 'x', edges: [], cmds: ['cmd: ./scripts-run src/scripts/lint_foo --x'], file: 'f' })).toBe(
            'src/scripts/lint_foo',
        );
        expect(scriptOf({ name: 'x', edges: [], cmds: ['cmd: echo hi'], file: 'f' })).toBeNull();
    });
});
