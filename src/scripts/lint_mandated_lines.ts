#!/usr/bin/env tsx
/**
 * lint_mandated_lines.ts — the deterministic half of the mandated-line contract.
 *
 * Contract: `src/agent-src/contexts/execution/mandated-lines.md`. Given a run
 * report on stdin (or `--file`), assert the two checkable obligations:
 *
 * 1. A report claiming a **behaviour change** carries an **Intent** line.
 * 2. A report describing an **outward action** carries an **Authorization** line.
 *
 * Documented invocation, mirroring the sibling reply checker:
 *
 *     ./scripts-run src/scripts/lint_mandated_lines --stdin < report.md
 *
 * **Not wired into the `ci` corpus sweep, deliberately.** There is no standing
 * tree of run reports to scan, and a gate pointed at a directory that does not
 * accumulate is the dead-scan-root shape this repository has already paid for
 * four times. It is a callable checker, exactly like
 * `check_reply_consistency --stdin`, and its discrimination is proven by a test
 * rather than by a corpus.
 *
 * **What it cannot check, stated rather than discovered later.** It reads a
 * report, so it can see whether a line is present and well-formed. It cannot
 * see whether the line was emitted *before* the action or reconstructed after,
 * and it cannot see whether the three intent slots were filled honestly. Those
 * are model-carried — the contract says so in the same words.
 *
 * **Gaming risk.** The cheap degenerate pass is a report that never uses the
 * trigger vocabulary: describe the edit without the word "fix", the push
 * without the word "push", and both obligations evaporate because nothing was
 * detected to owe them. Mitigation: the trigger sets below are deliberately
 * broad and include the past-tense forms a completion claim actually uses, and
 * a report that trips NO trigger is reported as `no obligations detected`
 * rather than as a pass — the two read differently on purpose. Residual: a
 * sufficiently vague report still owes nothing, and no lexical check can fix
 * that. The line's real enforcement is that the model emits it at the decision
 * point; this is the backstop for the case where it did not.
 *
 * Exit: 0 clean · 1 usage/IO error · 2 findings.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * A report claims a behaviour change. Past tense included on purpose: a
 * completion claim says "fixed", not "will fix".
 */
export const BEHAVIOUR_CHANGE_TRIGGERS: readonly RegExp[] = [
    /\b(fixed|fixes|fixing|a fix)\b/i,
    /\b(changed|changes|changing) the behaviou?r\b/i,
    /\b(implemented|implements|implementing)\b/i,
    /\b(patched|patches|patching)\b/i,
    /\b(refactored|refactors|refactoring)\b/i,
    /\b(corrected|corrects|correcting)\b/i,
    /\bbehaviou?r[- ]changing\b/i,
];

/**
 * A report describes an irreversible outward action — the
 * `non-destructive-by-default` Hard-Floor set.
 */
export const OUTWARD_ACTION_TRIGGERS: readonly RegExp[] = [
    /\b(pushed|pushing|push(?:ed)? to (?:remote|origin|main))\b/i,
    /\b(deployed|deploying|deploy(?:ed)? to prod)\b/i,
    /\b(published|publishing)\b/i,
    /\b(merged|merging) (?:into |to )?(?:main|master|prod)/i,
    /\b(opened|created) (?:the |a )?(?:pull request|PR)\b/i,
    /\b(sent|sending) (?:the |an )?(?:email|message)\b/i,
    /\b(posted|posting) (?:the |a )?comment\b/i,
    /\b(purchased|submitted|ordered)\b/i,
];

/** `Intent: … · … · …` — three slots separated by the middle dot. Global: EVERY line is validated. */
export const INTENT_RE = /^[ \t]*(?:>[ \t]*)?Intent(?:[ \t]*\([^)]*\))?:[ \t]*(.+)$/gim;

/** `Authorization: "…"` — carrying the user's own words. */
export const AUTHORIZATION_RE = /^[ \t]*(?:>[ \t]*)?Authorization:[ \t]*(.+)$/gim;

/**
 * A PAIRED quotation, not a stray quote character.
 *
 * The first version tested for any character in `["“”'']` and got both
 * directions wrong: `the user's roadmap step says to push` passed on the
 * possessive apostrophe — a paraphrase, and literally the
 * documentation-is-not-authorization case the contract denies — while
 * `‘push it and open the PR’` failed, because the typographic single quotes
 * were not in the class at all. What the line must carry is a span somebody
 * actually said, so the test is for an opening mark with a closing partner.
 */
const QUOTED_SPAN_RE = /"[^"]+"|“[^”]*”|‘[^’]*’|'[^']{2,}'|«[^»]+»|„[^“”]+[“”]/;

/**
 * Drop fenced blocks before matching.
 *
 * Without this, a report that QUOTES the contract's own merged-block example —
 * which contains a well-formed Intent and Commit line — satisfies both
 * obligations while having emitted neither. The contract's § Brevity
 * illustration was, verbatim, a working bypass.
 */
export function stripFences(text: string): string {
    const out: string[] = [];
    let fence: string | null = null;
    for (const line of text.split('\n')) {
        const m = /^[ \t]*(`{3,}|~{3,})/.exec(line);
        if (m !== null) {
            const marker = (m[1] as string)[0] as string;
            if (fence === null) fence = marker;
            else if (fence === marker) fence = null;
            out.push('');
            continue;
        }
        out.push(fence === null ? line : '');
    }
    return out.join('\n');
}

/**
 * Join a wrapped continuation onto its label line.
 *
 * The contract's own canonical Intent example wraps across two blockquote
 * lines, and a one-physical-line capture read it as two slots — the document's
 * model-correct artifact failed its own checker. A following line that does not
 * start a new label and is not blank belongs to the line above it.
 */
export function unwrapLines(text: string): string {
    const lines = text.split('\n');
    const out: string[] = [];
    for (const raw of lines) {
        const isLabel = /^[ \t]*(?:>[ \t]*)?(?:Intent|Authorization|Commit|Pending|Sibling search)\b/i.test(raw);
        const isBlank = raw.trim() === '';
        const prev = out[out.length - 1];
        if (!isLabel && !isBlank && prev !== undefined && prev.trim() !== '' &&
            /^[ \t]*(?:>[ \t]*)?(?:Intent|Authorization|Commit|Pending|Sibling search)\b/i.test(prev)) {
            out[out.length - 1] = `${prev.trimEnd()} ${raw.trim()}`;
            continue;
        }
        out.push(raw);
    }
    return out.join('\n');
}

/**
 * Sentences that DENY the action rather than claiming it.
 *
 * Narrow on purpose. A trigger word inside "no code changed" or "nothing was
 * implemented" is a report saying the opposite of what the trigger detects, and
 * charging it an obligation trains the reader to ignore the checker. This
 * cannot be complete — negation is not a lexical property — and the residual is
 * stated in the header rather than hidden.
 */
const DENIAL_RE = /\b(no|nothing|not|never|without)\b[^.]{0,40}$/i;

/** The slot separator the contract specifies. */
const SLOT_SEPARATOR = '·';

export interface Finding {
    code: 'missing-intent' | 'missing-authorization' | 'intent-slots' | 'authorization-quote';
    message: string;
}

export interface Verdict {
    findings: Finding[];
    /** True when no trigger fired at all — reported distinctly from a pass. */
    noObligations: boolean;
    owed: string[];
}

/**
 * Does any trigger fire on a sentence that is not denying it?
 *
 * Sentence-scoped so a denial in one sentence does not excuse a claim in the
 * next: "No code changed. Pushed the doc fix." still owes the authorization
 * line.
 */
function _fires(text: string, triggers: readonly RegExp[]): boolean {
    for (const sentence of text.split(/(?<=[.!?\n])/)) {
        if (!triggers.some((re) => re.test(sentence))) continue;
        const before = sentence.slice(0, sentence.search(triggers.find((re) => re.test(sentence)) as RegExp));
        if (DENIAL_RE.test(before)) continue;
        return true;
    }
    return false;
}

/**
 * Check one report.
 *
 * Separated from the CLI so the discrimination cases are unit-testable without
 * spawning a process — the boundary cases here are textual, and a fixture file
 * per case would make them harder to read, not easier.
 */
export function checkReport(text: string): Verdict {
    const findings: Finding[] = [];
    const owed: string[] = [];

    // Fenced blocks are illustrations, not claims — and unwrapping puts a
    // soft-wrapped continuation back on its label line before anything counts
    // slots.
    const prepared = unwrapLines(stripFences(text));

    const claimsChange = _fires(prepared, BEHAVIOUR_CHANGE_TRIGGERS);
    const claimsOutward = _fires(prepared, OUTWARD_ACTION_TRIGGERS);

    if (claimsChange) {
        owed.push('intent');
        INTENT_RE.lastIndex = 0;
        const matches = [...prepared.matchAll(INTENT_RE)];
        if (matches.length === 0) {
            findings.push({
                code: 'missing-intent',
                message:
                    'the report claims a behaviour change and carries no Intent line. ' +
                    'Three slots: what the code does · what the failing check expects · what the spec says.',
            });
        } else {
            // EVERY intent line is validated. Checking only the first made the
            // verdict depend on line order, so one well-formed line satisfied a
            // report claiming any number of behaviour changes.
            for (const [i, m] of matches.entries()) {
                const slots = (m[1] ?? '').split(SLOT_SEPARATOR).map((s) => s.trim()).filter((s) => s !== '');
                if (slots.length < 3) {
                    findings.push({
                        code: 'intent-slots',
                        message:
                            `Intent line ${String(i + 1)} of ${String(matches.length)} has ${String(slots.length)} slot(s), not 3. ` +
                            'The three slots are the mechanism: when they disagree, the disagreement is the finding ' +
                            `and the edit does not proceed. Separate them with '${SLOT_SEPARATOR}'.`,
                    });
                }
            }
        }
    }

    if (claimsOutward) {
        owed.push('authorization');
        AUTHORIZATION_RE.lastIndex = 0;
        const m = AUTHORIZATION_RE.exec(prepared);
        if (m === null) {
            findings.push({
                code: 'missing-authorization',
                message:
                    'the report describes an irreversible outward action and carries no Authorization line. ' +
                    'Documentation is not authorization; completing the task is not authorization.',
            });
        } else if (!QUOTED_SPAN_RE.test(m[1] ?? '')) {
            findings.push({
                code: 'authorization-quote',
                message:
                    'the Authorization line quotes nothing. It carries the USER\'S OWN WORDS — a paraphrase ' +
                    'is the agent restating its own conclusion, which is what the line exists to prevent.',
            });
        }
    }

    return { findings, noObligations: !claimsChange && !claimsOutward, owed };
}

function _readInput(argv: readonly string[]): { text: string } | { error: string } {
    const fileIdx = argv.indexOf('--file');
    if (fileIdx !== -1) {
        const p = argv[fileIdx + 1];
        if (p === undefined) {
            return { error: '--file needs a path' };
        }
        try {
            return { text: fs.readFileSync(path.resolve(p), 'utf-8') };
        } catch (e) {
            return { error: `cannot read ${p}: ${String(e)}` };
        }
    }
    if (argv.includes('--stdin')) {
        try {
            return { text: fs.readFileSync(0, 'utf-8') };
        } catch (e) {
            return { error: `cannot read stdin: ${String(e)}` };
        }
    }
    return { error: 'usage: lint_mandated_lines --stdin | --file <report.md> [--quiet]' };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const quiet = argv.includes('--quiet');
    const input = _readInput(argv);
    if ('error' in input) {
        process.stderr.write(`${input.error}\n`);
        return 1;
    }

    // Scope assertion. An EMPTY report used to print "no obligations detected"
    // and exit 0 — a piped-nothing reading as compliance, which is the
    // false-green shape this repository has paid for four times. The unit is
    // content lines, and zero of them is a dead scope rather than a clean run.
    const contentLines = input.text.split('\n').filter((l) => l.trim() !== '').length;
    try {
        assertScanned({ gate: 'lint_mandated_lines', scanned: contentLines, units: 'report line(s)', roots: ['<stdin>'] });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    const verdict = checkReport(input.text);
    for (const f of verdict.findings) {
        process.stderr.write(`❌  ${f.code}  ${f.message}\n`);
    }
    if (verdict.findings.length > 0) {
        process.stderr.write(`\n❌  lint_mandated_lines: ${String(verdict.findings.length)} finding(s)\n`);
        return 2;
    }
    if (!quiet) {
        if (verdict.noObligations) {
            // Deliberately not "clean". A report that triggered nothing has not
            // been shown to comply; it has been shown to owe nothing, and the
            // two are different facts.
            process.stdout.write('✅  lint_mandated_lines: no obligations detected in this report\n');
        } else {
            process.stdout.write(
                `✅  lint_mandated_lines: ${String(verdict.owed.length)} obligation(s) owed and present — ` +
                    `${verdict.owed.join(', ')}\n`,
            );
        }
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}

export { REPO_ROOT };
