#!/usr/bin/env tsx
/**
 * Who owns a piece of scope growth discovered mid-mission.
 *
 * The size question — *is this small and aligned enough to do now* — already
 * has an answer in the remediation ladder. This is the other axis, and the two
 * are independent: something small and council-owned is still not the agent's
 * to decide, and something agent-owned and large is still bounded by the
 * smallest-diff rule.
 *
 * Four verdicts, and the last one is the important one:
 *
 *   `agent`      done inline, recorded as a scope delta in the PR body, never
 *                asked about.
 *   `council`    routed through the ownership ladder; the verdict becomes a
 *                `## Decisions` row. It does NOT reach the owner, however
 *                consequential — a technical decision does not become
 *                owner-owned because it is hard.
 *   `owner`      the work changes what the product or the business does, or it
 *                needs a typed op for which no grant exists. Two rows, closed.
 *   `follow-up`  not scope growth at all. A larger unrelated opportunity
 *                becomes its own artifact and the mission does not expand to
 *                hold it — the failure that looks like diligence is a mission
 *                that absorbs every good idea it meets and delivers none.
 *
 * `unknown` is a real verdict and is deliberately NOT folded into `agent`:
 * growth nothing classifies is growth nobody decided, and defaulting it to the
 * cheapest rung is how an owner question becomes an agent one silently.
 *
 * Exit codes: 0 classified · 1 unknown · 2 bad argv.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'scope_growth';

export type Verdict = 'agent' | 'council' | 'owner' | 'follow-up' | 'unknown';

export interface Rule {
    readonly verdict: Verdict;
    readonly kind: string;
    readonly re: RegExp;
}

/**
 * Ordered, and the order is the contract: `owner` and `follow-up` are tested
 * BEFORE `agent`, so a row that matches both ("a missing test — in a subsystem
 * this mission never touched") resolves to the more conservative rung rather
 * than to the first cheap match.
 */
export const RULES: readonly Rule[] = [
    // --- owner: two rows, closed ------------------------------------------
    {
        verdict: 'owner',
        kind: 'product-or-business-change',
        re: /\b(?:new user-visible|changes what the product|changes what the business|a price|pricing|a public commitment|a policy change)\b/i,
    },
    {
        verdict: 'owner',
        kind: 'typed-op-without-grant',
        re: /\b(?:needs a typed op|no grant exists|merge to main|force-push|deploy to prod(?:uction)?|rotate the secret)\b/i,
    },
    // --- follow-up: unrelated, however good -------------------------------
    {
        verdict: 'follow-up',
        kind: 'larger-unrelated',
        re: /\b(?:unrelated|another subsystem|a subsystem this .{0,30}never touched|out of scope|deserves its own)\b/i,
    },
    // --- council: technical, contested ------------------------------------
    {
        verdict: 'council',
        kind: 'larger-internal-re-cut',
        re: /\b(?:re-?cut|restructure the module|reshape the boundary)\b/i,
    },
    {
        verdict: 'council',
        kind: 'two-equal-strategies',
        re: /\b(?:two equal|two valid|either strategy|no evidence between them)\b/i,
    },
    {
        verdict: 'council',
        kind: 'risky-compatibility-design',
        re: /\b(?:compatibility risk|backwards[- ]incompat|breaking change)\b/i,
    },
    {
        verdict: 'council',
        kind: 'unclear-boundary',
        re: /\b(?:unclear boundary|where the boundary)\b/i,
    },
    // --- agent: six rows, closed ------------------------------------------
    {
        verdict: 'agent',
        kind: 'necessary-internal-refactor',
        re: /\b(?:necessary (?:internal )?refactor|cannot land (?:correctly )?without)\b/i,
    },
    { verdict: 'agent', kind: 'missing-test', re: /\bmissing test\b/i },
    {
        verdict: 'agent',
        kind: 'regression-on-touched-path',
        re: /\bregression\b[^.]{0,60}\btouched\b|\btouched\b[^.]{0,60}\bregression\b/i,
    },
    {
        verdict: 'agent',
        kind: 'small-dependency-adjustment',
        re: /\b(?:small dependency adjustment|patch bump|minor bump)\b/i,
    },
    {
        verdict: 'agent',
        kind: 'local-api-inside-defined-semantics',
        re: /\b(?:inside (?:the )?(?:already-)?defined semantics|the contract does not move)\b/i,
    },
    {
        verdict: 'agent',
        kind: 'boy-scout-cleanup',
        re: /\bboy[- ]scout\b/i,
    },
];

export interface Classification {
    readonly verdict: Verdict;
    readonly kind: string;
    /** True when the verdict is done inline and recorded rather than asked. */
    readonly records_scope_delta: boolean;
    /** True when a person is reached at all. */
    readonly asks: boolean;
}

export function classifyGrowth(text: string): Classification {
    for (const r of RULES) {
        if (r.re.test(text)) {
            return {
                verdict: r.verdict,
                kind: r.kind,
                records_scope_delta: r.verdict === 'agent',
                asks: r.verdict === 'owner',
            };
        }
    }
    return { verdict: 'unknown', kind: 'unclassified', records_scope_delta: false, asks: false };
}

function _usage(): string {
    return `usage: ${_PROG} [-h] [--self-test] [--json] <description...>\n`;
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let json = false;
    const words: string[] = [];
    for (const a of args) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(_usage());
            return 0;
        }
        if (a === '--self-test') return _selfTest();
        if (a === '--json') {
            json = true;
            continue;
        }
        words.push(a);
    }
    if (!words.length) {
        process.stderr.write(`${_usage()}${_PROG}: error: a description is required\n`);
        return 2;
    }
    const c = classifyGrowth(words.join(' '));
    if (json) {
        process.stdout.write(JSON.stringify(c, null, 2) + '\n');
    } else {
        process.stdout.write(
            `${c.verdict}  (${c.kind})  scope-delta=${String(c.records_scope_delta)}  asks=${String(c.asks)}\n`,
        );
    }
    return c.verdict === 'unknown' ? 1 : 0;
}

function _selfTest(): number {
    const cases: ReadonlyArray<readonly [string, Verdict]> = [
        ['a missing test on a path this change touched', 'agent'],
        ['a boy-scout cleanup, small and local', 'agent'],
        ['two equal technical strategies with no evidence between them', 'council'],
        ['this introduces a compatibility risk', 'council'],
        ['it needs a typed op and no grant exists', 'owner'],
        ['this adds new user-visible semantics', 'owner'],
        ['an unrelated refactor that deserves its own roadmap', 'follow-up'],
        ['something nobody wrote a rule for', 'unknown'],
        // The ordering case: matches `missing test` AND `unrelated`, and the
        // conservative rung must win or a follow-up silently becomes agent work.
        ['a missing test in an unrelated subsystem', 'follow-up'],
    ];
    const failures: string[] = [];
    for (const [text, want] of cases) {
        const got = classifyGrowth(text).verdict;
        if (got !== want) failures.push(`"${text}" → ${got}, wanted ${want}`);
    }
    if (failures.length) {
        for (const f of failures) process.stderr.write(`❌  ${_PROG} --self-test: ${f}\n`);
        return 1;
    }
    process.stdout.write(`✅  ${_PROG} --self-test: ${String(cases.length)} case(s) behaved\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}
