/**
 * E1.1 / E1.2 / E1.3 behaviour, on the pure core.
 *
 * The severity contract is the load-bearing assertion here: Risk 1 of the parent
 * roadmap is that ONE false block on clean UI makes an operator turn the carrier
 * off for good — which is the OFF state the 0.0 % measurement already recorded.
 * So "P1-P3 never block" is tested on both slots, in both directions.
 */
import { describe, expect, it } from 'vitest';

import {
    P0_FLOOR_IDS,
    decide,
    isUiSurface,
    isUiTrivial,
    render,
    targetPath,
    type Finding,
} from '../../src/scripts/hooks/design_pass_hook.js';

const f = (severity: Finding['severity'], catalogId = 'Q1', line = 1, file = 'components/A.tsx'): Finding => ({
    file,
    severity,
    catalogId,
    rule: `slop-${catalogId.toLowerCase()}`,
    line,
    message: `${catalogId} finding`,
});
const none = new Set<string>();

describe('E1.1 — the post pass delivers and never blocks', () => {
    it('a P0 on post_tool_use is delivered, not blocked', () => {
        const r = decide('post_tool_use', [f('P0')], [], none, true);
        expect(r.findings).toHaveLength(1);
        expect(r.blocked).toEqual([]);
    });

    it('P1, P2 and P3 are delivered and never blocked', () => {
        const r = decide('post_tool_use', [f('P1'), f('P2', 'V1', 2), f('P3', 'L4', 3)], [], none, true);
        expect(r.findings).toHaveLength(3);
        expect(r.blocked).toEqual([]);
    });

    it('a clean rewrite of the same file yields nothing new', () => {
        const first = decide('post_tool_use', [f('P2', 'V1')], [], none, true);
        const seen = new Set(first.findings.map((x) => `${x.file}::${x.rule}::${x.line}`));
        expect(decide('post_tool_use', [f('P2', 'V1')], [], seen, true).findings).toEqual([]);
    });
});

describe('E1.3 — P0 blocks at stop, and only P0', () => {
    it('a P0 at stop blocks', () => {
        const r = decide('stop', [f('P0')], [], none, true);
        expect(r.blocked).toHaveLength(1);
    });

    it('a P2-only fixture never blocks at stop', () => {
        expect(decide('stop', [f('P2', 'V1'), f('P3', 'L4')], [], none, true).blocked).toEqual([]);
    });

    it('the P0 set is the objective floors, not aesthetic tells', () => {
        // Q* ids belong to lint_design_quality. An aesthetic tell (V*, T*, L*)
        // must never appear here, or the block becomes a taste judgement.
        expect([...P0_FLOOR_IDS]).toEqual(['Q1', 'Q2', 'Q5', 'Q6']);
        for (const id of P0_FLOOR_IDS) expect(id).toMatch(/^Q\d$/);
    });

    it('an already-surfaced P0 does not block twice', () => {
        const seen = new Set(['components/A.tsx::slop-q1::1']);
        expect(decide('stop', [f('P0')], [], seen, true).blocked).toEqual([]);
    });
});

describe('E1.2 — the stop pass is scoped to the files touched', () => {
    it('dedupes against the post pass by file::rule::line', () => {
        const seen = new Set(['components/A.tsx::slop-v1::7']);
        const r = decide('stop', [f('P2', 'V1', 7), f('P2', 'V1', 9)], [], seen, true);
        expect(r.findings.map((x) => x.line)).toEqual([9]);
    });
});

describe('graft 2 — a pass that could not run says so', () => {
    it('no render artefact degrades the verdict and names why', () => {
        const r = decide('stop', [], [], none, false);
        expect(r.verification).toBe('degraded');
        expect(r.degradation_reason).toMatch(/ui:render/);
    });

    it('a render artefact present is verified with no reason', () => {
        const r = decide('stop', [], [], none, true);
        expect(r.verification).toBe('verified');
        expect(r.degradation_reason).toBeUndefined();
    });

    it('degradation is reported even when there are zero findings', () => {
        // The silent-pass failure mode: nothing found AND nothing checked must
        // not look the same as nothing found after a full check.
        expect(render(decide('stop', [], [], none, false))).toMatch(/verification: degraded/);
    });
});

describe('E2.2 — the audit-freshness line', () => {
    it('a missing artefact is reported with the command that fixes it', () => {
        const out = render(decide('post_tool_use', [], ['components/A.tsx'], none, true));
        expect(out).toMatch(/no ui-audit\.json newer than components\/A\.tsx/);
        expect(out).toMatch(/agent-config ui:audit/);
    });
});

describe('ui-trivial — all FIVE conditions, not the four the prose carries', () => {
    const base = { files: 1, changedLines: 5, newComponent: false, newState: false, newDependency: false };
    it('the boundary case is trivial', () => {
        expect(isUiTrivial(base)).toBe(true);
    });
    it.each([
        ['files', { ...base, files: 2 }],
        ['changedLines', { ...base, changedLines: 6 }],
        ['newComponent', { ...base, newComponent: true }],
        ['newState', { ...base, newState: true }],
        ['newDependency', { ...base, newDependency: true }],
    ])('%s over the line is not trivial', (_name, shape) => {
        expect(isUiTrivial(shape)).toBe(false);
    });
});

describe('surface detection uses the shared predicate', () => {
    it.each([
        ['components/Button.tsx', true],
        ['resources/views/x.blade.php', true],
        ['app.css', true],
        ['pages/api/export.ts', false],
        ['src/server/db.ts', false],
    ])('%s -> %s', (p, want) => {
        expect(isUiSurface(p)).toBe(want);
    });
});

describe('payload extraction tolerates host key variance', () => {
    it.each([
        [{ tool_input: { file_path: 'a.tsx' } }, 'a.tsx'],
        [{ input: { path: 'b.css' } }, 'b.css'],
        [{ filePath: 'c.vue' }, 'c.vue'],
        [{ tool_input: { target_file: 'd.svelte' } }, 'd.svelte'],
    ])('%j -> %s', (payload, want) => {
        expect(targetPath(payload)).toBe(want);
    });

    it('returns null when no path key is present', () => {
        expect(targetPath({ tool_input: { content: 'x' } })).toBeNull();
        expect(targetPath(null)).toBeNull();
    });
});
