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

/** `Intent: … · … · …` — three slots separated by the middle dot. */
export const INTENT_RE = /^\s*(?:>\s*)?Intent(?:\s*\([^)]*\))?:\s*(.+)$/im;

/** `Authorization: "…"` — carrying the user's own words. */
export const AUTHORIZATION_RE = /^\s*(?:>\s*)?Authorization:\s*(.+)$/im;

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

function _fires(text: string, triggers: readonly RegExp[]): boolean {
    return triggers.some((re) => re.test(text));
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

    const claimsChange = _fires(text, BEHAVIOUR_CHANGE_TRIGGERS);
    const claimsOutward = _fires(text, OUTWARD_ACTION_TRIGGERS);

    if (claimsChange) {
        owed.push('intent');
        const m = INTENT_RE.exec(text);
        if (m === null) {
            findings.push({
                code: 'missing-intent',
                message:
                    'the report claims a behaviour change and carries no Intent line. ' +
                    'Three slots: what the code does · what the failing check expects · what the spec says.',
            });
        } else {
            const slots = (m[1] ?? '').split(SLOT_SEPARATOR).map((s) => s.trim()).filter((s) => s !== '');
            if (slots.length < 3) {
                findings.push({
                    code: 'intent-slots',
                    message:
                        `the Intent line has ${String(slots.length)} slot(s), not 3. The three slots are the ` +
                        'mechanism: when they disagree, the disagreement is the finding and the edit does not proceed. ' +
                        `Separate them with '${SLOT_SEPARATOR}'.`,
                });
            }
        }
    }

    if (claimsOutward) {
        owed.push('authorization');
        const m = AUTHORIZATION_RE.exec(text);
        if (m === null) {
            findings.push({
                code: 'missing-authorization',
                message:
                    'the report describes an irreversible outward action and carries no Authorization line. ' +
                    'Documentation is not authorization; completing the task is not authorization.',
            });
        } else if (!/["“”'']/.test(m[1] ?? '')) {
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
