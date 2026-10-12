#!/usr/bin/env tsx
/**
 * A skill body may shrink. It may not grow without a recorded reason.
 *
 * `road-to-surfaces-no-gate-reads` Phase 3. `lint_token_budget_discipline`
 * gates only `token_budget_class: rich` and `continue`s on a skill with no
 * key — 141 of the 147 bodies over 8 KB carry no key, so nothing stopped any
 * of them growing.
 *
 * ```
 * THE CEILING IS THE MEASURED DISTRIBUTION, NOT A FIXED BAR.
 * IT MOVES DOWN ON ITS OWN. IT MOVES UP ONLY WITH A RECORDED REASON.
 * THE CHECK LOWERS NOTHING BY ITSELF.
 * ```
 *
 * A fixed 8 KB bar was declined by the roadmap's non-goals: 147 bodies are
 * over it today, so the bar would be unfillable and the gate would be turned
 * off rather than met. Bytes, not tokens (D2): bytes are exact on every
 * machine, while the token count needs a devDependency and degrades to a band
 * without it.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_skill_body_budget
 *   ./scripts-run src/scripts/check_skill_body_budget --update   # re-record
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const BUDGET_REL = 'src/config/skill-body-budget.json';

/** One deliberate ceiling rise, with the reason a reviewer reads. */
export interface Raise {
    skill: string;
    old: number;
    new: number;
    reason: string;
}

export interface Budget {
    /** skill directory name → recorded byte ceiling. */
    ceilings: Record<string, number>;
    /** Every rise, newest last. A rise with no reason is refused by the check. */
    raised: Raise[];
    /**
     * Every other top-level key, carried through `--update` untouched.
     *
     * `lint_budget_ownership` requires `owner` and `review_by` on every gate
     * budget, and the first `--update` of this file DROPPED both — it wrote a
     * fresh object from the two fields it knew about, and CI caught the loss
     * on the next run. A writer that silently narrows the file it maintains is
     * the same defect class this gate exists to catch in skill bodies.
     *
     * Optional so a caller constructing a Budget in a test need not invent
     * metadata it is not testing; absent means the file carried none.
     */
    rest?: Record<string, unknown>;
}

/** Byte size of every `src/skills/<name>/SKILL.md`, by directory name. */
export function measureBodies(root = REPO_ROOT): Record<string, number> {
    const dir = path.join(root, 'src', 'skills');
    const out: Record<string, number> = {};
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir).sort()) {
        const body = path.join(dir, name, 'SKILL.md');
        try {
            const st = fs.statSync(body);
            if (st.isFile()) out[name] = st.size;
        } catch {
            continue;
        }
    }
    return out;
}

export function readBudget(root = REPO_ROOT): Budget | null {
    try {
        const doc = JSON.parse(fs.readFileSync(path.join(root, BUDGET_REL), 'utf8')) as Record<string, unknown>;
        const ceilings = doc['ceilings'];
        if (typeof ceilings !== 'object' || ceilings === null) return null;
        const rest: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(doc)) {
            if (k !== 'ceilings' && k !== 'raised') rest[k] = v;
        }
        return {
            ceilings: ceilings as Record<string, number>,
            raised: Array.isArray(doc['raised']) ? (doc['raised'] as Raise[]) : [],
            rest,
        };
    } catch {
        return null;
    }
}

export interface Finding {
    skill: string;
    ceiling: number;
    actual: number;
    reason: 'grew-without-a-raise' | 'raise-without-a-reason' | 'raise-does-not-match';
}

/**
 * Compare the measured bodies against the recorded ceilings.
 *
 * A body AT or BELOW its ceiling passes, always — shrinking is the direction
 * this gate wants and it never objects to it. A body above its ceiling passes
 * only when `raised` carries an entry naming that skill, that new size and a
 * non-empty reason: a rise somebody wrote down is a decision, a rise nobody
 * wrote down is the drift.
 *
 * A skill with no ceiling is NOT a finding — a new skill gets its ceiling on
 * first landing, via `--update`. Refusing it here would make adding a skill
 * require a second commit to make the first one legal.
 */
export function compare(bodies: Record<string, number>, budget: Budget): Finding[] {
    const findings: Finding[] = [];
    const raisesFor = new Map<string, Raise[]>();
    for (const r of budget.raised) {
        const list = raisesFor.get(r.skill) ?? [];
        list.push(r);
        raisesFor.set(r.skill, list);
    }
    for (const [skill, actual] of Object.entries(bodies).sort(([a], [b]) => (a < b ? -1 : 1))) {
        const ceiling = budget.ceilings[skill];
        if (ceiling === undefined) continue;
        if (actual <= ceiling) continue;
        const raises = raisesFor.get(skill) ?? [];
        const match = raises.find((r) => r.new >= actual);
        if (match === undefined) {
            findings.push({ skill, ceiling, actual, reason: 'grew-without-a-raise' });
            continue;
        }
        if (typeof match.reason !== 'string' || match.reason.trim() === '') {
            findings.push({ skill, ceiling, actual, reason: 'raise-without-a-reason' });
        }
    }
    return findings;
}

/**
 * The ceilings a `--update` would write: every measured body, and for a skill
 * that already has a LOWER reading the lower one wins.
 *
 * Monotone down by construction — this is what "the check lowers nothing on
 * its own" means in code. A re-record after a shrink tightens the ceiling; a
 * re-record after a growth does NOT loosen it unless a `raised` entry covers
 * the growth, so `--update` cannot be used to launder a silent rise.
 */
export function nextCeilings(bodies: Record<string, number>, budget: Budget): Record<string, number> {
    const out: Record<string, number> = { ...budget.ceilings };
    const covered = new Map<string, number>();
    for (const r of budget.raised) covered.set(r.skill, Math.max(covered.get(r.skill) ?? 0, r.new));
    for (const [skill, actual] of Object.entries(bodies)) {
        const current = out[skill];
        if (current === undefined) {
            out[skill] = actual;
            continue;
        }
        if (actual < current) {
            out[skill] = actual;
            continue;
        }
        const allowed = covered.get(skill);
        if (allowed !== undefined && allowed >= actual) out[skill] = actual;
    }
    // A skill that no longer exists keeps no ceiling.
    for (const skill of Object.keys(out)) {
        if (bodies[skill] === undefined) delete out[skill];
    }
    return out;
}

function argValue(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0 && i + 1 < argv.length) return argv[i + 1] as string;
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    return eq === undefined ? null : eq.slice(name.length + 3);
}

/**
 * Write a throwaway tree: one skill of the given size, and a budget file.
 *
 * Returns the root. The caller deletes it — a self-test that leaves a tree
 * behind is a self-test that eventually runs against its own leftovers.
 */
function fixtureRoot(size: number, budget: Budget): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-body-budget-'));
    const skill = path.join(root, 'src', 'skills', 'alpha');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(skill, 'SKILL.md'), 'x'.repeat(size));
    fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, BUDGET_REL), JSON.stringify(budget, null, 2) + '\n');
    return root;
}

/**
 * Prove the gate DISCRIMINATES, over real fixture trees and the real CLI.
 *
 * Five cases, three rejecting. The manifest row records why this gate carries
 * no create-only canary: a new skill has no recorded ceiling and is
 * deliberately not a finding, so a planted file runs the gate green. The only
 * violation it can express is an in-place growth, which is what these fixtures
 * produce.
 */
function selfTest(): number {
    const base: Budget = { ceilings: { alpha: 1000 }, raised: [] };
    const run = (size: number, budget: Budget): (() => number) => {
        return (): number => {
            const root = fixtureRoot(size, budget);
            try {
                return runGateCli(REPO_ROOT, 'src/scripts/check_skill_body_budget.ts', ['--root', root], root);
            } finally {
                fs.rmSync(root, { recursive: true, force: true });
            }
        };
    };
    return runSelfTest({
        gate: 'check_skill_body_budget',
        minCases: 5,
        minRejectCases: 3,
        cases: [
            { name: 'a body one byte over its ceiling', expect: 'reject', run: run(1001, base) },
            { name: 'a body far over its ceiling', expect: 'reject', run: run(5000, base) },
            {
                name: 'a rise with an empty reason',
                expect: 'reject',
                run: run(1001, { ceilings: { alpha: 1000 }, raised: [{ skill: 'alpha', old: 1000, new: 1001, reason: '' }] }),
            },
            { name: 'a body at its ceiling', expect: 'accept', run: run(1000, base) },
            { name: 'a body below its ceiling', expect: 'accept', run: run(10, base) },
            {
                name: 'a rise recorded with a reason',
                expect: 'accept',
                run: run(1001, {
                    ceilings: { alpha: 1000 },
                    raised: [{ skill: 'alpha', old: 1000, new: 1001, reason: 'one worked example the body needed' }],
                }),
            },
        ],
    });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test') && process.env['GATE_SELF_TEST_CHILD'] !== '1') return selfTest();
    const root = argValue(argv, 'root') ?? REPO_ROOT;
    const bodies = measureBodies(root);
    const budget = readBudget(root);

    if (budget === null) {
        process.stderr.write(`❌  ${BUDGET_REL} is missing or unreadable — run with --update to record it\n`);
        return 1;
    }

    if (argv.includes('--update')) {
        // Every other key first, so `owner`, `review_by` and `_comment` survive
        // and stay at the top of the file where a reader meets them.
        const next = { ...(budget.rest ?? {}), ceilings: nextCeilings(bodies, budget), raised: budget.raised };
        fs.writeFileSync(path.join(root, BUDGET_REL), JSON.stringify(next, null, 2) + '\n');
        process.stdout.write(`scanned: ${String(Object.keys(bodies).length)}\n`);
        process.stdout.write(`🔧  ${BUDGET_REL}: ${String(Object.keys(next.ceilings).length)} ceiling(s) recorded\n`);
        return 0;
    }

    const findings = compare(bodies, budget);
    // `scanned:` on every path, including the clean one — a gate that scans
    // nothing exits green and says nothing, which reads identically to a gate
    // that scanned a corpus and found it clean.
    process.stdout.write(`scanned: ${String(Object.keys(bodies).length)}\n`);

    // Every body this run considered is accounted for by name: completed,
    // failed, or out of scope with a reason from the closed vocabulary. The
    // count above says how many were read; the ledger says what happened to
    // each one, which is the difference between a gate that scanned and a gate
    // that scanned and decided.
    const ledger = new GateLedger('check_skill_body_budget');
    const failed = new Map(findings.map((f) => [f.skill, f]));
    ledger.plan(Object.keys(bodies).sort());
    for (const skill of Object.keys(bodies).sort()) {
        if (budget.ceilings[skill] === undefined) {
            ledger.outOfScope(skill, 'not_applicable_kind');
            continue;
        }
        const f = failed.get(skill);
        if (f === undefined) ledger.complete(skill);
        else ledger.fail(skill, `${String(f.actual)} bytes > ceiling ${String(f.ceiling)} (${f.reason})`);
    }
    ledger.report();

    if (Object.keys(bodies).length === 0) {
        process.stderr.write('❌  no SKILL.md found — the walk is wrong, not the corpus\n');
        return 1;
    }

    if (findings.length === 0) {
        process.stdout.write(
            `✅  check_skill_body_budget: ${String(Object.keys(budget.ceilings).length)} skill body/bodies within budget\n`,
        );
        return 0;
    }

    process.stderr.write(`❌  ${String(findings.length)} skill body/bodies over budget:\n`);
    for (const f of findings) {
        const over = f.actual - f.ceiling;
        process.stderr.write(
            `  ${f.skill}: ${String(f.actual)} bytes > ceiling ${String(f.ceiling)} (over by ${String(over)}) — ${f.reason}\n`,
        );
    }
    process.stderr.write(
        '\n  A body may shrink freely. To raise one, add an entry to `raised` in\n' +
            `  ${BUDGET_REL} with skill, old, new and a one-line reason, then re-run\n` +
            '  with --update. The check never lowers or raises a ceiling by itself.\n',
    );
    return 1;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
