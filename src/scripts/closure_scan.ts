#!/usr/bin/env tsx
/**
 * The closure detector — finds the open decisions in a plan, and classifies
 * each one by OWNERSHIP. It never resolves one.
 *
 * That boundary is the whole design. A decision dispatcher was killed on
 * purpose: no TypeScript path routes a decision, and this script adds none.
 * What it adds is the half that can be mechanical — *which questions are open,
 * and whose they are* — so the claim "this plan reached execution with twelve
 * open technical decisions and asked the owner none of them" is falsifiable
 * rather than a feeling.
 *
 * Detector families, each a phrase an author writes when they KNOW something
 * is open. Deliberately narrow: a detector that fires on ordinary plan prose
 * turns every producer red at once, and the cheapest repair is then to weaken
 * it until it finds nothing.
 *
 *   `tbd`                      TBD / to be decided / decide later
 *   `unpicked-alternative`     "either X or Y", "option A … option B"
 *   `unchecked-assumption`     "assuming", "presumably", "probably fine"
 *   `missing-verify`           an open step with no `verify:` line
 *   `ambiguous-acceptance`     a vague acceptance criterion (improve / clean up
 *                              / best practices / handle errors properly)
 *   `contradictory`            "contradicts", "conflicts with", "but also"
 *   `product-semantics`        two valid user-visible outcomes
 *   `typed-op`                 an operation from the typed vocabulary
 *   `spend`                    a ceiling or quota question
 *
 * Ownership classification is the output that matters. Six families classify
 * to a technical class the agent, an independent session, a council or a team
 * resolves; exactly two reach the owner (`product-semantics` → `product-owned`,
 * `typed-op` → `destructive-owned`); `spend` reaches nobody — it pauses and
 * reports (ADR-268 § 8).
 *
 * Exit codes: 0 no open decisions · 1 open decisions found · 2 bad argv.
 * Finding open decisions is the POINT, so `--strict` is what makes exit 1 a
 * failure for a caller that wants one; the default is a report.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'closure_scan';

export type Kind =
    | 'tbd'
    | 'unpicked-alternative'
    | 'unchecked-assumption'
    | 'missing-verify'
    | 'ambiguous-acceptance'
    | 'contradictory'
    | 'product-semantics'
    | 'typed-op'
    | 'spend';

export interface Finding {
    readonly id: string;
    readonly line: number;
    readonly kind: Kind;
    readonly ownership: string;
    readonly excerpt: string;
}

/**
 * Kind → ownership class. The two owner-routed rows are the whole cost of
 * closure: everything else is resolved without reaching a person, which is
 * what "zero owner questions for twelve technical ambiguities" means.
 */
export const OWNERSHIP_BY_KIND: Readonly<Record<Kind, string>> = {
    tbd: 'contested-technical',
    'unpicked-alternative': 'contested-technical',
    'unchecked-assumption': 'reversible-technical',
    'missing-verify': 'deterministic',
    'ambiguous-acceptance': 'reversible-technical',
    contradictory: 'contested-technical',
    'product-semantics': 'product-owned',
    'typed-op': 'destructive-owned',
    spend: 'spend-exhaustion',
};

/** Classes that reach a person. Everything else closes without an ask. */
export const OWNER_ROUTED: ReadonlySet<string> = new Set([
    'product-owned',
    'business-owned',
    'destructive-owned',
]);

interface Pattern {
    readonly kind: Kind;
    readonly re: RegExp;
}

const LINE_PATTERNS: readonly Pattern[] = [
    { kind: 'tbd', re: /\bTBD\b/ },
    { kind: 'tbd', re: /\bto be decided\b/i },
    { kind: 'tbd', re: /\bdecide later\b/i },
    { kind: 'unpicked-alternative', re: /\beither\b[^.]{3,80}\bor\b/i },
    { kind: 'unpicked-alternative', re: /\boption A\b[^.]{0,120}\boption B\b/i },
    { kind: 'unpicked-alternative', re: /\bwe could (?:either )?\w+[^.]{0,80}\bor\b/i },
    // "two equal technical strategies" is the canonical unpicked alternative,
    // and the phrasing an author reaches for when the choice is genuinely open
    // — it carries no `either`, no `or` and no `option A`.
    { kind: 'unpicked-alternative', re: /\btwo (?:equal|competing)\b[^.]{0,60}\b(?:strateg|approach|design|option)/i },
    { kind: 'unchecked-assumption', re: /\bassuming\b/i },
    { kind: 'unchecked-assumption', re: /\bpresumably\b/i },
    { kind: 'unchecked-assumption', re: /\bprobably (?:fine|works|ok)\b/i },
    { kind: 'ambiguous-acceptance', re: /\b(?:improve|optimi[sz]e)\b(?![^.]*\bby\b)/i },
    { kind: 'ambiguous-acceptance', re: /\bmake it (?:better|cleaner|nicer)\b/i },
    { kind: 'ambiguous-acceptance', re: /\buse best practices\b/i },
    { kind: 'ambiguous-acceptance', re: /\bhandle errors properly\b/i },
    { kind: 'contradictory', re: /\bcontradicts\b/i },
    { kind: 'contradictory', re: /\bconflicts with\b/i },
    { kind: 'product-semantics', re: /\buser-visible\b[^.]{0,80}\b(?:or|versus|vs\.?)\b/i },
    { kind: 'product-semantics', re: /\bwhat the user sees\b/i },
    { kind: 'product-semantics', re: /\btwo valid (?:user|product) semantics\b/i },
    { kind: 'typed-op', re: /\b(?:merge|force-push|deploy|publish|purchase|rotate the secret)\b/i },
    { kind: 'spend', re: /\b(?:over|above|crosses?) the (?:configured )?(?:spend )?ceiling\b/i },
    { kind: 'spend', re: /\bquota (?:is )?(?:exhausted|gone)\b/i },
];

const STEP_RE = /^\s*-\s\[[ x~-]\]\s/;
const OPEN_STEP_RE = /^\s*-\s\[ \]\s/;
const H2_RE = /^##\s+/;
const DISCHARGE_H2_RE = /^##\s+(Decisions|Blockers|Kill register|Risk Register)\s*$/;
const ACCEPTANCE_H2_RE = /^##\s+Acceptance Criteria\s*$/;

function _isFence(line: string): boolean {
    return /^\s*(```|~~~)/.test(line);
}

/**
 * A scan unit: one logical statement, which is NOT one physical line.
 *
 * A roadmap step wraps over several lines, and the ambiguity it carries
 * routinely straddles the wrap ("either newline-delimited JSON / or a single
 * array"). Matching per line missed exactly those, which are the ones an
 * author is least likely to notice. A step block is therefore ONE unit, joined
 * and matched once — which also means one finding per step at most, so a step
 * carrying two hedges is one open decision rather than two.
 */
export interface Unit {
    /** 1-based line of the unit's first line. */
    readonly line: number;
    readonly text: string;
    readonly inAcceptance: boolean;
    readonly isOpenStep: boolean;
    readonly hasVerify: boolean;
}

export function units(lines: readonly string[]): Unit[] {
    const out: Unit[] = [];
    let inFence = false;
    let inDischarge = false;
    let inAcceptance = false;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i] as string;
        if (_isFence(line)) {
            inFence = !inFence;
            i += 1;
            continue;
        }
        if (inFence) {
            i += 1;
            continue;
        }
        if (H2_RE.test(line)) {
            inDischarge = DISCHARGE_H2_RE.test(line);
            inAcceptance = ACCEPTANCE_H2_RE.test(line);
        }
        if (inDischarge) {
            i += 1;
            continue;
        }
        if (STEP_RE.test(line)) {
            let j = i + 1;
            while (j < lines.length && !STEP_RE.test(lines[j] as string) && !H2_RE.test(lines[j] as string)) {
                j += 1;
            }
            const block = lines.slice(i, j);
            out.push({
                line: i + 1,
                // Whitespace-normalised: a wrapped step joined with a single
                // space still carries the next line's indent, so a pattern
                // written with single spaces stops matching across the wrap —
                // which is the case this unit exists to catch.
                text: block.join(' ').replace(/\s+/g, ' '),
                inAcceptance,
                isOpenStep: OPEN_STEP_RE.test(line),
                hasVerify: /(?:^|\s)verify:/m.test(block.join('\n')),
            });
            i = j;
            continue;
        }
        out.push({
            line: i + 1,
            text: line,
            inAcceptance,
            isOpenStep: false,
            hasVerify: false,
        });
        i += 1;
    }
    return out;
}

export function scan(text: string): Finding[] {
    const lines = text.split('\n');
    const findings: Finding[] = [];

    for (const u of units(lines)) {
        if (/<!--\s*closure:\s*ignore\s*-->/.test(u.text)) continue;
        let matched: Kind | null = null;
        for (const { kind, re } of LINE_PATTERNS) {
            if (re.test(u.text)) {
                matched = kind;
                break;
            }
        }
        // An open step carries a `verify:` line — a step whose success cannot
        // be checked is a trigger for a question, not for work. Acceptance
        // criteria are criteria, not steps: they have their own contract and
        // carry no verify line by design.
        if (matched === null && u.isOpenStep && !u.hasVerify && !u.inAcceptance) {
            matched = 'missing-verify';
        }
        if (matched === null) continue;
        findings.push({
            id: '',
            line: u.line,
            kind: matched,
            ownership: OWNERSHIP_BY_KIND[matched],
            excerpt: u.text.trim().replace(/\s+/g, ' ').slice(0, 120),
        });
    }

    findings.sort((a, b) => a.line - b.line);
    return findings.map((f, idx) => ({ ...f, id: `C${String(idx + 1)}` }));
}

/** The `## Decisions` skeleton — one row per finding, resolution left open. */
export function renderRows(findings: readonly Finding[]): string {
    const header = '| ID | ownership | resolved by | decision | evidence | revisit if |';
    const sep = '|---|---|---|---|---|---|';
    const rows = findings.map(
        (f) => `| ${f.id} | ${f.ownership} | <resolver> | <decision> | ${f.kind}:${String(f.line)} | <condition> |`,
    );
    return [header, sep, ...rows].join('\n');
}

export function ownerQuestionCount(findings: readonly Finding[]): number {
    return findings.filter((f) => OWNER_ROUTED.has(f.ownership)).length;
}

// --------------------------------------------------------------------------
// CLI.
// --------------------------------------------------------------------------

function _usage(): string {
    return (
        `usage: ${_PROG} [-h] [--json] [--rows] [--strict] <roadmap.md>\n\n` +
        `Find and classify the open decisions in a plan. Resolves nothing.\n`
    );
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let json = false;
    let rows = false;
    let strict = false;
    const paths: string[] = [];
    for (const a of args) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(_usage());
            return 0;
        } else if (a === '--json') json = true;
        else if (a === '--rows') rows = true;
        else if (a === '--strict') strict = true;
        else if (a.startsWith('-')) {
            process.stderr.write(`${_usage()}${_PROG}: error: unrecognized arguments: ${a}\n`);
            return 2;
        } else paths.push(a);
    }
    if (paths.length !== 1) {
        process.stderr.write(`${_usage()}${_PROG}: error: exactly one roadmap path is required\n`);
        return 2;
    }
    const target = path.resolve(paths[0] as string);
    let text: string;
    try {
        text = fs.readFileSync(target, 'utf-8');
    } catch {
        process.stderr.write(`${_PROG}: error: cannot read ${paths[0] as string}\n`);
        return 2;
    }

    const findings = scan(text);
    const owner = ownerQuestionCount(findings);

    if (json) {
        process.stdout.write(
            JSON.stringify({ findings, open: findings.length, owner_questions: owner }, null, 2) + '\n',
        );
    } else if (rows) {
        process.stdout.write(renderRows(findings) + '\n');
    } else {
        process.stdout.write(`open decisions: ${String(findings.length)}\n`);
        process.stdout.write(`owner questions: ${String(owner)}\n`);
        for (const f of findings) {
            process.stdout.write(
                `  ${f.id}  ${String(f.line).padStart(4)}  ${f.kind.padEnd(20)} ${f.ownership.padEnd(22)} ${f.excerpt}\n`,
            );
        }
    }
    if (!findings.length) return 0;
    return strict ? 1 : 0;
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
