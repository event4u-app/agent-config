/**
 * Step 1.2's reproduction: the committed twelve, re-derived by a second route.
 *
 * `road-to-governed-evidence-production` 1.2 — *"one enumeration is committed,
 * and a second independent pass reproduces it rather than proposing a different
 * twelve."*
 *
 * ROUTE A is `_lib/cascade_stage_enumeration.ts`: it IMPORTS the two stage
 * arrays and applies the ordering rule in code.
 *
 * ROUTE B is this file: it reads the two source files as TEXT and extracts the
 * stage names with a regex, reads the evidence classes from the published table
 * in `docs/contracts/evaluation-cascade-stages.md`, and applies the ordering
 * rule itself. It never imports `TWELVE_STAGES` for anything but the final
 * comparison.
 *
 * The independence is of ROUTE, not of author, and that is deliberate — a second
 * author is a second proposal, and two proposals is the state that produced the
 * council's `REVISE` in the first place. What route B can catch: a hand-edited
 * `TWELVE_STAGES` (it is never read on the way to the answer), a rung added in
 * code without the table, a table edited without the code.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './_bench_ab.js';
import {
    DECIDED_ARITY,
    EVIDENCE_CLASSES,
    TWELVE_STAGES,
    evidenceClass,
} from '../../src/scripts/_lib/cascade_stage_enumeration.js';

const CASCADE_SRC = join(REPO_ROOT, 'src', 'scripts', '_lib', 'evaluation_cascade.ts');
const LADDER_SRC = join(REPO_ROOT, 'src', 'scripts', '_lib', 'activation_ladder.ts');
const CONTRACT = join(REPO_ROOT, 'docs', 'contracts', 'evaluation-cascade-stages.md');

/** Route B, part 1 — the stage names, from the source FILES as text. */
function stageNamesFromSourceText(): string[] {
    const cascade = readFileSync(CASCADE_SRC, 'utf-8');
    const ladder = readFileSync(LADDER_SRC, 'utf-8');

    const arrayLiteral = (src: string, name: string): string[] => {
        const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(src);
        if (m === null) throw new Error(`${name} not found as an array literal`);
        return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
    };

    // The prefix stages are a literal; the receipt stages are derived from the
    // rungs in the ladder, so route B re-derives them the same way the ladder
    // does — from LADDER_RUNGS, with the prefix the ladder's own source states.
    const prefix = arrayLiteral(cascade, 'CASCADE_STAGES');
    const rungs = arrayLiteral(ladder, 'LADDER_RUNGS');
    const receiptPrefix = /RECEIPT_STAGES = LADDER_RUNGS\.map\(\(r\) => `([a-z-]+)\$\{r\}` as const\)/.exec(
        ladder,
    );
    if (receiptPrefix === null) throw new Error('RECEIPT_STAGES derivation not recognised');
    return [...prefix, ...rungs.map((r) => `${receiptPrefix[1]!}${r}`)];
}

/** Route B, part 2 — the evidence classes, from the published contract table. */
function classesFromContractTable(): Map<string, string> {
    const md = readFileSync(CONTRACT, 'utf-8');
    const section = md.slice(md.indexOf('## The twelve'), md.indexOf('## How the reproduction works'));
    const out = new Map<string, string>();
    for (const m of section.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/gm)) {
        out.set(m[2]!, m[3]!);
    }
    return out;
}

describe('route B reproduces the committed twelve', () => {
    it('extracts twelve stage names from the two source files as text', () => {
        const names = stageNamesFromSourceText();
        expect(names).toHaveLength(DECIDED_ARITY);
        // Anti-vacuity: the extraction found real names, not an empty match.
        expect(names).toContain('schema-validity');
        expect(names).toContain('receipt-adhered');
    });

    it('the contract table names exactly those twelve stages', () => {
        const table = classesFromContractTable();
        expect([...table.keys()].sort()).toEqual(stageNamesFromSourceText().sort());
        for (const c of table.values()) expect(EVIDENCE_CLASSES).toContain(c);
    });

    it('applying the ordering rule to route Bs inputs yields the committed order', () => {
        const table = classesFromContractTable();
        const reproduced = stageNamesFromSourceText().sort(
            (a, b) =>
                (EVIDENCE_CLASSES as readonly string[]).indexOf(table.get(a)!) -
                (EVIDENCE_CLASSES as readonly string[]).indexOf(table.get(b)!),
        );
        expect(reproduced).toEqual([...TWELVE_STAGES]);
    });

    it('the contracts class column agrees with the code, stage by stage', () => {
        // The two routes disagree here if PREFIX_EVIDENCE_CLASS is edited
        // without the table, or the table without the code.
        const table = classesFromContractTable();
        for (const [stage, cls] of table) {
            expect(evidenceClass(stage as never), stage).toBe(cls);
        }
    });
});

describe('the ordering rule is the cascades own evidence order, not a preference', () => {
    it('runCascade first touches its input fields in the declared class order', () => {
        // Derived from BEHAVIOUR rather than asserted: the position at which
        // `runCascade` first reads each `CascadeInput` field must rise with the
        // evidence class rank. A stage reordered in the body without its class
        // being updated reds here.
        const src = readFileSync(CASCADE_SRC, 'utf-8');
        const body = src.slice(src.indexOf('export function runCascade('));
        const firstUse = (fields: readonly string[]): number =>
            Math.min(
                ...fields.map((f) => {
                    const i = body.indexOf(`input.${f}`);
                    return i < 0 ? Number.POSITIVE_INFINITY : i;
                }),
            );
        const positions = [
            firstUse(['raw']),
            firstUse(['plan', 'budget']),
            firstUse(['peers']),
            firstUse(['receipt']),
            firstUse(['rows', 'vector']),
        ];
        for (const p of positions) expect(Number.isFinite(p)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        // Anti-vacuity: five distinct positions, not five copies of one.
        expect(new Set(positions).size).toBe(5);
    });

    it('every receipt stage sits after every non-measurement prefix stage (EC-2)', () => {
        const idx = (s: string): number => TWELVE_STAGES.indexOf(s as never);
        const receiptIdxs = TWELVE_STAGES.filter((s) => s.startsWith('receipt-')).map(idx);
        for (const p of ['schema-validity', 'path-ownership', 'holdout-disclosure', 'budget', 'near-duplicate']) {
            for (const r of receiptIdxs) expect(r, `${p} vs receipt`).toBeGreaterThan(idx(p));
        }
        // ... and before the measurement stage, which is last.
        for (const r of receiptIdxs) expect(r).toBeLessThan(idx('metric-verdict'));
        expect(TWELVE_STAGES[DECIDED_ARITY - 1]).toBe('metric-verdict');
    });
});
