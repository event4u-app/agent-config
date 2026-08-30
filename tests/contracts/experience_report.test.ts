/**
 * road-to-experience-loop-broadening steps 6.1, 6.2 and 6.3.
 *
 * 6.1 verify: an asset with no signal appears with unknown != 0 and win rate
 *             undefined, not with a fabricated score.
 * 6.2 verify: a report line with an estimated component that does not name its
 *             method fails the lint.
 * 6.3 verify: no import of the report module from any routing or selection path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { describe, expect, it } from 'vitest';

import { basisOf, isBasisTag, methodOf } from '../../src/scripts/_lib/evidence_basis.js';
import { aggregate, type AuditLineView } from '../../src/scripts/_lib/experience_report.js';

const line = (outcome: unknown, rules: string[] = [], skills?: string[]): AuditLineView => {
    const l: AuditLineView = { outcome, rules_applied: rules };
    if (skills !== undefined) l.skills_applied = skills;
    return l;
};

describe('6.1 — an unclassifiable signal is unknown, never a fabricated score', () => {
    it('an asset with no classifiable signal has unknown != 0 and win_rate null', () => {
        const rows = aggregate([line('who-knows', ['r'])]);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.unknown).toBe(1);
        expect(rows[0]!.win_rate).toBeNull();
    });

    it('win_rate is null and NOT zero — the distinction a reader acts on', () => {
        // Zero is a measurement meaning "it never worked". Null means "we do
        // not know". Rendering the second as the first is the fabrication this
        // module exists to prevent.
        const rows = aggregate([line(undefined, ['r'])]);
        expect(rows[0]!.win_rate).not.toBe(0);
        expect(rows[0]!.win_rate).toBeNull();
    });

    it('unknown never enters the win-rate denominator', () => {
        // Two helpful, one unclassifiable => 2/2, not 2/3. A rate over
        // "everything we saw" answers a different question from a rate over
        // "everything we could classify", and only the second is about the asset.
        const rows = aggregate([line('success', ['r']), line('success', ['r']), line('???', ['r'])]);
        expect(rows[0]!.win_rate).toBe(1);
        expect(rows[0]!.unknown).toBe(1);
    });

    it('splits helpful, neutral and harmful as four separate shares', () => {
        const rows = aggregate([
            line('success', ['r']), line('skipped', ['r']),
            line('error', ['r']), line('???', ['r']),
        ]);
        const r = rows[0]!;
        expect([r.helpful, r.neutral, r.harmful, r.unknown]).toEqual([1, 1, 1, 1]);
        expect(r.win_rate).toBeCloseTo(1 / 3);
    });

    it('counts a streak of the most recent helpful outcomes', () => {
        const rows = aggregate([line('error', ['r']), line('success', ['r']), line('success', ['r'])]);
        expect(rows[0]!.streak).toBe(2);
    });
});

describe('6.1 — absent skills_applied invents nothing', () => {
    it('a line omitting skills_applied produces no skill row', () => {
        // Omission recorded nothing about skills. It is not evidence that no
        // skill was applied, so it may not become an `unknown` against a skill
        // nobody named.
        const rows = aggregate([line('success', ['r'])]);
        expect(rows.every((x) => x.kind === 'rule')).toBe(true);
    });

    it('an empty skills_applied also produces no skill row, for the other reason', () => {
        const rows = aggregate([line('success', ['r'], [])]);
        expect(rows.every((x) => x.kind === 'rule')).toBe(true);
    });

    it('a named skill does get a row', () => {
        const rows = aggregate([line('success', [], ['code-review'])]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ kind: 'skill', id: 'code-review', helpful: 1 });
    });
});

describe('6.2 — an estimated figure must name its method', () => {
    it('a bare `estimated` is not a valid basis tag', () => {
        expect(isBasisTag('estimated')).toBe(false);
    });

    it('`estimated:` with an empty method is rejected too', () => {
        // The same omission wearing a colon.
        expect(isBasisTag('estimated:')).toBe(false);
        expect(isBasisTag('estimated:   ')).toBe(false);
    });

    it('a named method is accepted, and both halves are recoverable', () => {
        expect(isBasisTag('estimated:response-length-heuristic')).toBe(true);
        expect(basisOf('estimated:response-length-heuristic')).toBe('estimated');
        expect(methodOf('estimated:response-length-heuristic')).toBe('response-length-heuristic');
    });

    it('every other basis is self-describing and takes no suffix', () => {
        for (const b of ['measured', 'inferred', 'provider-reported', 'model-judged', 'unknown'] as const) {
            expect(isBasisTag(b)).toBe(true);
            expect(methodOf(b)).toBeNull();
        }
    });

    it('the report emits a method-bearing tag on its derived figure', () => {
        const rows = aggregate([line('success', ['r'])]);
        expect(isBasisTag(rows[0]!.win_rate_basis)).toBe(true);
        expect(basisOf(rows[0]!.win_rate_basis)).toBe('estimated');
        expect(methodOf(rows[0]!.win_rate_basis)).toBeTruthy();
    });
});

describe('6.3 — no routing or selection path imports the report', () => {
    // Enumerated explicitly rather than globbed: a glob that silently matched
    // nothing would pass forever. Every path below is asserted to exist first,
    // so a rename turns this red instead of quietly emptying it.
    const ROUTING_PATHS = [
        'src/scripts/_lib/router_match.ts',
        'src/scripts/_lib/subagent_routing.ts',
        'src/scripts/_lib/trigger_routers.ts',
        'src/scripts/_lib/tier_budget_routing.ts',
        'src/scripts/_lib/arm_ranking.ts',
        'src/scripts/compile_router.ts',
        'src/scripts/routing_doctor.ts',
        'src/scripts/score_skill_selection.ts',
        'src/scripts/select_analysis_mode.ts',
        'src/scripts/skill_discovery.ts',
        'src/scripts/hooks/skill_route_hook.ts',
        'src/scripts/hooks/ui_route_nudge_hook.ts',
    ];
    const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');

    it('every enumerated routing path exists — so a rename fails loudly', () => {
        const missing = ROUTING_PATHS.filter((p) => !fs.existsSync(path.join(repoRoot, p)));
        expect(missing).toEqual([]);
    });

    it('none of them imports experience_report', () => {
        const offenders = ROUTING_PATHS.filter((p) =>
            fs.readFileSync(path.join(repoRoot, p), 'utf-8').includes('experience_report'),
        );
        expect(offenders).toEqual([]);
    });
});

describe('6.5 — the SQLite index is deferred, and the deferral is checkable', () => {
    // The step is an INSTRUCTION TO DEFER, so its verify ("deleting the index
    // changes only runtime, and a rebuild reproduces it byte-for-byte") is a
    // conditional guard on a build that has not happened. Ticking the step on
    // that basis alone would be a green with nothing behind it -- the exact
    // silent-green this repository has recorded before.
    //
    // So the deferral is asserted instead of assumed: no experience index
    // exists, and the report reads the JSONL directly. If someone builds one,
    // this test goes red and the verify above becomes the thing they must
    // satisfy -- which is precisely when it should start applying.
    const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');

    it('the report module opens no database', () => {
        const src = fs.readFileSync(
            path.join(repoRoot, 'src/scripts/_lib/experience_report.ts'),
            'utf-8',
        );
        expect(src).not.toMatch(/node:sqlite|DatabaseSync|better-sqlite3/);
    });

    it('no experience index artefact is committed anywhere', () => {
        const offenders = ['agents/runtime/state/experience.db', 'agents/runtime/state/experience.sqlite']
            .filter((p) => fs.existsSync(path.join(repoRoot, p)));
        expect(offenders).toEqual([]);
    });
});
