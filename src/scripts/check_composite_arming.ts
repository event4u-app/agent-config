#!/usr/bin/env tsx
/**
 * A1.2/A1.3 — answer the per-turn composite's arming question, and refuse to guess.
 *
 * `src/config/hook-latency-budget.json` → `per_turn_composite` ships
 * `observe_only: true` with `p50_ci: null`, and its `arming_precondition` is
 * **"at least 10 CI gate readings of the composite, from at least 2 distinct
 * runner sessions"**. Until 2026-08-23 that precondition could not be evaluated
 * at all: the bench printed the composite and stored nothing. This reads the
 * store the bench now appends to and reports whether the precondition holds.
 *
 * IT NEVER WRITES `p50_ci`, AND THAT IS THE POINT. A2.1 is a MAINTAINER ACT
 * gated by `b-composite-ceiling-value`. This script publishes a distribution to
 * choose FROM; choosing is not its job, and a script that both measured and
 * armed would be the agent setting its own ceiling.
 *
 * THREE REFUSALS, each from a recorded failure mode:
 *
 * 1. **A null composite is dropped, never extrapolated.** `perTurnComposite()`
 *    returns null rather than a number when a slot is missing from the run,
 *    because a composite over a subset reads LOW — and low is the direction that
 *    makes a ceiling look met. A record with `composite_ms: null` is counted as
 *    unusable and named, not averaged away.
 * 2. **Never a bare boolean.** "not yet" always names the shortfall — which
 *    clause failed and by how much. `9 readings from 3 sessions` and `12 from 1`
 *    are both not-armable and fail for *different* reasons; a boolean loses that.
 *    Both are pinned as tests.
 * 3. **Sessions are counted by identity, not by row.** The instability the floor
 *    exists to exclude was measured on ONE machine (a sibling metric read
 *    44–157 % at n=12), so twelve readings from one session is exactly the shape
 *    the floor rejects. A bare counter cannot see it.
 *
 * Exit codes:
 *   0 — the store was read and a verdict printed (armable OR not — "not yet" is
 *       a successful measurement, never a build failure)
 *   1 — the store is unreadable or malformed
 *   2 — bad args
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SELF = 'src/scripts/check_composite_arming.ts';

/** The tracked, append-only store the bench writes with `--record-composite`. */
export const STORE_REL = path.join('agents', 'evidence', 'hook-composite-readings.jsonl');

/** From `per_turn_composite.arming_precondition`. A STATED minimum, not a derived one. */
export const MIN_READINGS = 10;
export const MIN_SESSIONS = 2;

const SELF_TEST_MIN_CASES = 5;
const SELF_TEST_MIN_REJECT = 2;

export interface Reading {
    /** null when a slot was missing from the run — unusable, never extrapolated. */
    composite_ms: number | null;
    parts?: Record<string, number>;
    tool_calls?: number;
    /** Distinguishes runner SESSIONS, not rows. See refusal 3. */
    session: string;
    platform?: string;
    node?: string;
    commit?: string;
    recorded_at?: string;
}

export interface Verdict {
    armable: boolean;
    usable: number;
    unusable: number;
    sessions: string[];
    /** Every clause that failed, each naming its shortfall. Empty iff armable. */
    failures: string[];
}

export function parseStore(text: string): { readings: Reading[]; malformed: number } {
    const readings: Reading[] = [];
    let malformed = 0;
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (t === '') continue;
        try {
            const o = JSON.parse(t) as Partial<Reading>;
            if (typeof o.session !== 'string' || !('composite_ms' in o)) {
                malformed += 1;
                continue;
            }
            readings.push({ ...o, session: o.session, composite_ms: o.composite_ms ?? null });
        } catch {
            malformed += 1;
        }
    }
    return { readings, malformed };
}

export function evaluate(readings: readonly Reading[]): Verdict {
    const usable = readings.filter((r) => typeof r.composite_ms === 'number');
    const unusable = readings.length - usable.length;
    const sessions = [...new Set(usable.map((r) => r.session))].sort();
    const failures: string[] = [];
    if (usable.length < MIN_READINGS) {
        failures.push(
            `readings: ${String(usable.length)} usable of ${String(MIN_READINGS)} required ` +
                `(short by ${String(MIN_READINGS - usable.length)})`,
        );
    }
    if (sessions.length < MIN_SESSIONS) {
        failures.push(
            `sessions: ${String(sessions.length)} distinct of ${String(MIN_SESSIONS)} required ` +
                `(short by ${String(MIN_SESSIONS - sessions.length)}) — the floor exists because the ` +
                `instability it excludes was measured on ONE machine, so N readings from one session ` +
                `cannot substitute`,
        );
    }
    return { armable: failures.length === 0, usable: usable.length, unusable, sessions, failures };
}

function _quantile(sorted: readonly number[], q: number): number {
    if (sorted.length === 0) return 0;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
    return sorted[i] as number;
}

/**
 * A1.3 — render the distribution to choose FROM. Writes no `p50_ci`.
 *
 * The pathology net is kept SEPARATE from the cap, per step 3 of the recorded
 * arming procedure: one runner spike should be caught as a pathology rather than
 * by lowering the cap for everyone.
 */
export function renderDistribution(readings: readonly Reading[], v: Verdict): string {
    const vals = readings
        .map((r) => r.composite_ms)
        .filter((x): x is number => typeof x === 'number')
        .sort((a, b) => a - b);
    const L: string[] = [];
    L.push('# Per-turn composite — distribution, not a decision');
    L.push('');
    L.push(`n = ${String(v.usable)} usable reading(s) across ${String(v.sessions.length)} session(s).`);
    if (v.unusable > 0) {
        L.push('');
        L.push(
            `**${String(v.unusable)} reading(s) were DROPPED as unusable** — a slot the definition ` +
                'needs was missing from that run, so the composite would have read low, and low is the ' +
                'direction that makes a ceiling look met. They are excluded, not averaged.',
        );
    }
    L.push('');
    L.push('| statistic | ms |');
    L.push('|---|---|');
    L.push(`| min | ${String(vals[0] ?? 0)} |`);
    L.push(`| p50 | ${String(_quantile(vals, 0.5))} |`);
    L.push(`| p95 | ${String(_quantile(vals, 0.95))} |`);
    L.push(`| max | ${String(vals[vals.length - 1] ?? 0)} |`);
    L.push(`| spread (max − min) | ${String((vals[vals.length - 1] ?? 0) - (vals[0] ?? 0))} |`);
    L.push('');
    L.push('## Per session');
    L.push('');
    L.push('| session | n | p50 | max |');
    L.push('|---|---|---|---|');
    for (const s of v.sessions) {
        const sv = readings
            .filter((r) => r.session === s && typeof r.composite_ms === 'number')
            .map((r) => r.composite_ms as number)
            .sort((a, b) => a - b);
        L.push(`| \`${s}\` | ${String(sv.length)} | ${String(_quantile(sv, 0.5))} | ${String(sv[sv.length - 1] ?? 0)} |`);
    }
    L.push('');
    L.push('## What a maintainer does with this — and what this file deliberately does NOT do');
    L.push('');
    L.push(
        'This file writes **no `p50_ci`**. Setting it is step A2.1, a MAINTAINER ACT gated by ' +
            '`b-composite-ceiling-value`. A script that both measured the distribution and armed the ' +
            'ceiling from it would be the agent setting its own budget.',
    );
    L.push('');
    L.push(
        'Per step 2 of the recorded arming procedure, the cap is an **absolute** number derived from ' +
            'this distribution, never a creep window — shared CI runners flap, which is why ' +
            '`regression_gate.max_regression_pct` already sits at 200.',
    );
    L.push('');
    L.push(
        'Per step 3, the **pathology net stays separate from the cap**. Proposed shape, offered as a ' +
            'starting point and not a recommendation: cap from the p50 with the recorded headroom ' +
            'convention, and a separate net at roughly the observed max, so ONE spike is caught as a ' +
            'pathology rather than by lowering the cap for every run.',
    );
    if (!v.armable) {
        L.push('');
        L.push('## NOT ARMABLE YET');
        L.push('');
        for (const f of v.failures) L.push(`- ${f}`);
        L.push('');
        L.push(
            'The numbers above are printed anyway, because a distribution is informative before it is ' +
                'sufficient — but they must not be read as a basis for a ceiling until every clause ' +
                'above clears.',
        );
    }
    return `${L.join('\n')}\n`;
}

export function selfTest(): number {
    const nine3 = Array.from({ length: 9 }, (_, i) => ({ composite_ms: 1000 + i, session: `s${String(i % 3)}` }));
    const twelve1 = Array.from({ length: 12 }, (_, i) => ({ composite_ms: 1000 + i, session: 'only' }));
    const ok = Array.from({ length: 10 }, (_, i) => ({ composite_ms: 1000 + i, session: `s${String(i % 2)}` }));
    const cases: SelfTestCase[] = [
        {
            name: '9 readings from 3 sessions is NOT armable, and names the readings clause',
            expect: 'accept',
            run: () => {
                const v = evaluate(nine3);
                return !v.armable && v.failures.length === 1 && v.failures[0]?.startsWith('readings:') === true ? 0 : 1;
            },
        },
        {
            name: '12 readings from 1 session is NOT armable, and names the sessions clause',
            expect: 'accept',
            run: () => {
                const v = evaluate(twelve1);
                return !v.armable && v.failures.length === 1 && v.failures[0]?.startsWith('sessions:') === true ? 0 : 1;
            },
        },
        {
            name: '10 readings from 2 sessions IS armable',
            expect: 'accept',
            run: () => (evaluate(ok).armable ? 0 : 1),
        },
        {
            name: 'a null composite is dropped, not counted toward the floor',
            expect: 'accept',
            run: () => {
                const v = evaluate([...ok.slice(0, 9), { composite_ms: null, session: 'sX' }]);
                return !v.armable && v.unusable === 1 && v.usable === 9 ? 0 : 1;
            },
        },
        {
            name: 'the published distribution writes no p50_ci',
            expect: 'accept',
            run: () => (/p50_ci/.test(renderDistribution(ok, evaluate(ok))) && !/writes \*\*no `p50_ci`\*\*/.test(renderDistribution(ok, evaluate(ok))) ? 1 : 0),
        },
        {
            name: 'rejects a missing store rather than reporting armable',
            expect: 'reject',
            run: () => runGateCli(REPO_ROOT, SELF, ['--store', path.join(REPO_ROOT, 'no-such.jsonl')], REPO_ROOT),
        },
        {
            name: 'rejects a malformed store rather than silently skipping every line',
            expect: 'reject',
            run: () => {
                const d = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-'));
                const f = path.join(d, 's.jsonl');
                fs.writeFileSync(f, 'not json\n{also not\n');
                try {
                    return runGateCli(REPO_ROOT, SELF, ['--store', f], REPO_ROOT);
                } finally {
                    fs.rmSync(d, { recursive: true, force: true });
                }
            },
        },
    ];
    return runSelfTest({ gate: 'check_composite_arming', cases, minCases: SELF_TEST_MIN_CASES, minRejectCases: SELF_TEST_MIN_REJECT });
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('--self-test')) return selfTest();
    const si = args.indexOf('--store');
    const store = si >= 0 ? args[si + 1] : path.join(REPO_ROOT, STORE_REL);
    if (store === undefined) {
        process.stderr.write('check_composite_arming: --store requires a path\n');
        return 2;
    }
    let text: string;
    try {
        text = fs.readFileSync(store, 'utf-8');
    } catch {
        process.stdout.write(
            `❌  no composite store at ${path.relative(REPO_ROOT, store)}.\n` +
                `    The bench appends to it with \`--record-composite\`; until CI runs have\n` +
                `    accumulated readings there is nothing to evaluate. This is "not measured yet",\n` +
                `    which is NOT the same as "armable".\n`,
        );
        return 1;
    }
    const { readings, malformed } = parseStore(text);
    if (malformed > 0 && readings.length === 0) {
        process.stderr.write(
            `❌  ${path.relative(REPO_ROOT, store)}: ${String(malformed)} malformed line(s) and no usable ` +
                `record. A store that parses to nothing must not read as "no readings yet".\n`,
        );
        return 1;
    }
    const v = evaluate(readings);

    if (args.includes('--publish')) {
        const out = path.join(REPO_ROOT, 'agents', 'evidence', 'reports', 'per-turn-composite-distribution.md');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, renderDistribution(readings, v), 'utf-8');
        process.stdout.write(`✅  wrote ${path.relative(REPO_ROOT, out)} (n=${String(v.usable)}, sessions=${String(v.sessions.length)})\n`);
        return 0;
    }

    if (malformed > 0) {
        process.stdout.write(`⚠️   ${String(malformed)} malformed line(s) ignored (${String(readings.length)} parsed)\n`);
    }
    if (v.armable) {
        process.stdout.write(
            `✅  ARMABLE — ${String(v.usable)} usable reading(s) from ${String(v.sessions.length)} session(s) ` +
                `(floor: ${String(MIN_READINGS)} / ${String(MIN_SESSIONS)}).\n` +
                `    Next is A2.1, a MAINTAINER ACT: run with --publish, then set p50_ci and flip\n` +
                `    observe_only. This script never writes either.\n`,
        );
    } else {
        process.stdout.write(
            `⏳  NOT YET — ${String(v.usable)} usable reading(s) from ${String(v.sessions.length)} session(s)` +
                `${v.unusable > 0 ? `, ${String(v.unusable)} dropped as unusable` : ''}.\n`,
        );
        for (const f of v.failures) process.stdout.write(`    · ${f}\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) process.exit(main());

export { main };
