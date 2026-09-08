#!/usr/bin/env tsx
/**
 * check_candidate_lines.ts — the SHAPE of the candidate-forms line, and the
 * eval instrument that measures it. Not a shipped obligation on anyone.
 *
 * Steps 2.3, 2.5 and 2.6 of `road-to-candidate-moves-floor` define what a
 * `Candidates:` line must look like; step 3.1 needs the three deterministic
 * counts (line present at owed slots, `K0` present, axes pairwise distinct)
 * before any rubric scoring runs. This file is both.
 *
 * WHY IT IS A SEPARATE SCRIPT, and why `lint_mandated_lines.ts` is untouched.
 * The split AI council of 2026-09-07 blocked one specific thing: shipping a
 * sixth line into `mandated-lines.md` § The five lines and giving
 * `lint_mandated_lines` a third obligation. That is the "globally mandatory"
 * step. It explicitly authorised the other half — `Candidates:` may be
 * instructed to the model under test in the eval treatment arm, "where it can
 * be measured without being a shipped obligation on anyone". A measurement
 * instrument is that half. Adding the obligation to the existing linter would
 * be the blocked half, so this checker lives beside it and nothing imports it
 * into the shipped gate.
 *
 * THE GRAMMAR, one line, candidates separated by the house middle dot:
 *
 *   Candidates: K0 keep the current shape · A extract a Notifier service
 *   [ownership boundary] · B pass a callback [call-site coupling] → A; three
 *   callers already build the payload, so the boundary exists already.
 *
 * `K0` is `keep the current form / change nothing` and is owed first. A forced
 * form — exactly one admissible shape — carries the constraint instead of an
 * invented alternative:
 *
 *   Candidates: K0 keep the registration in `register()` [forced: the base
 *   class fixes the extension point] → K0; no other location is admissible.
 *
 * WHAT IT CANNOT CHECK. Not whether the candidates were generated before the
 * choice. A line with an axis and a discriminator is reconstructable in ten
 * seconds after deciding, and no textual check sees the order — the roadmap
 * lists that as its own first risk, and `mandated-lines.md` § Honest scope
 * says the same about the intent line. What IS decidable is that the axes are
 * pairwise distinct, which kills the cosmetic set where three candidates
 * differ only in where a helper lives.
 *
 * Exit: 0 clean · 1 usage/IO error · 2 findings.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { contentWords, overlap } from './count_intent_disagreement.js';
import { stripFences, unwrapLines } from './lint_mandated_lines.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const SLOT_SEPARATOR = '·';

/**
 * `Candidates: …` — one physical line, EMPHASIS-TOLERANT.
 *
 * The optional `**`/`__`/`*`/`_` runs are not cosmetic tolerance; they are the
 * difference between a reading and an artefact. The first version copied the
 * shipped `INTENT_RE` shape, which anchors the label at line start with no
 * emphasis allowed. The 2026-09-08 treatment run then emitted its ONE
 * compliant line as `**Candidates:** K0 …` — markdown bold, which every
 * assistant reaches for on a labelled line — and the checker reported
 * `Candidates line present: 0` over 32 transcripts. A detector that cannot see
 * the thing it counts reproduces the defect it is measuring, and it does so
 * silently, in the direction that confirms the null.
 *
 * The same gap exists in `lint_mandated_lines.ts`'s `INTENT_RE` and in the four
 * other shipped labels. It is recorded as a finding rather than fixed here:
 * that file is a shipped gate with 19 tests of its own, adjacent to the
 * contract the 2026-09-07 council blocked, and widening its discrimination is
 * its own change.
 *
 * CASE-SENSITIVE on the label. Widening with an `i` flag was tried on the
 * sibling counter and took its population from 0 to 172, almost all of them
 * lowercase `intent:` YAML keys in config — a line anchor turned into a prose
 * detector. The instructed label is `Candidates:` and that is what the one
 * real emission carried.
 */
export const CANDIDATES_RE =
    /^[ \t]*(?:>[ \t]*)?(?:[-*+][ \t]+)?(?:\*\*|__|\*|_)?Candidates(?:\*\*|__|\*|_)?(?:[ \t]*\([^)]*\))?(?:\*\*|__|\*|_)?:(?:\*\*|__|\*|_)?[ \t]*(.+)$/gm;

/**
 * Decision classes where a form choice actually exists — step 2.3.
 *
 * A FILE COUNT IS THE WRONG TRIGGER and that is the point of the list: a
 * controller plus its test is two files and no architectural choice, while a
 * rename touches four and offers none. These match the semantics instead.
 */
export const OWED_CLASS_TRIGGERS: readonly (readonly [string, RegExp])[] = [
    // The `(?:\w+ ){0,3}` gaps are load-bearing: the first version required the
    // noun to follow the article immediately, so "extracted a Notifier service"
    // — the canonical case — did not fire at all.
    ['ownership-boundary', /\b(ownership boundary|new (?:\w+ ){0,2}(?:service|module|package|bounded context)|extract(?:ed|ing|s)? (?:a |an |the )?(?:\w+ ){0,3}(?:service|module|class|package))\b/i],
    ['new-abstraction', /\b(new (?:\w+ ){0,2}abstraction|introduce[sd]? (?:an |a |the )?(?:\w+ ){0,3}(?:interface|abstraction|base class|strategy|candidate)|abstract(?:ed|ing)? (?:out|over))\b/i],
    ['contract-change', /\b((?:contract|schema|DTO|signature|API response|payload)s?\b[^.]{0,40}\bchang|chang[^.]{0,40}\b(?:contract|schema|DTO|signature|payload)s?\b|migrat(?:e|ed|ion)\b[^.]{0,30}\bcolumn)\b/i],
    ['state-transition', /\b(state (?:transition|machine)|status transition|lifecycle state)\b/i],
    ['migration-rollout', /\b(migration|rollout|roll-out|backfill|expand-contract)\b/i],
    ['failure-semantics', /\b(failure semantics|error semantics|retry (?:policy|semantics)|timeout (?:policy|semantics)|new (?:exception|error) (?:type|class))\b/i],
    ['irreversible-action', /\b(irreversible|destructive|force[- ]push|drop (?:table|column)|truncate)\b/i],
    ['unresolved-root-cause', /\b(root cause (?:is |remains )?(?:unknown|unresolved|not (?:yet )?(?:found|established))|cause (?:is|remains) unclear)\b/i],
    ['maintainer-decision', /\b((?:roadmap|budget|ratchet|projection) (?:shape|scope|baseline)|re-?scope[sd]? the roadmap|lower(?:ed|ing)? the (?:baseline|ratchet))\b/i],
];

/**
 * Classes where the line is NOT owed — step 2.3's other half.
 *
 * These suppress ONLY when no owed trigger fired. The asymmetry is deliberate
 * and is the safe direction: a rename that also changes a contract is a
 * contract change, so an exemption may never overrule a positive owed match.
 * Residual, stated rather than discovered later: a report that describes an
 * abstraction change using only rename vocabulary owes nothing, and no lexical
 * check fixes that.
 */
export const NOT_OWED_TRIGGERS: readonly (readonly [string, RegExp])[] = [
    ['typo', /\b(typo|misspell|spelling fix)\b/i],
    ['format', /\b(reformat|formatting|whitespace|prettier|lint fix|style-only)\b/i],
    ['pure-rename', /\b(pure(?:ly)? rename|rename[sd]? (?:the )?(?:variable|file|symbol|method|function)\b)/i],
    ['user-prescribed', /\b(the user (?:prescribed|specified|asked for) (?:the )?(?:form|shape|approach)|as instructed)\b/i],
    ['mechanical-test-update', /\b(mechanical(?:ly)? (?:test )?update|updated the (?:test )?(?:fixtures?|snapshots?)|snapshot refresh)\b/i],
    ['generated-refresh', /\b(regenerated?|generated-code refresh|re-?ran the generator|task (?:sync|generate-tools))\b/i],
    ['deterministic-config', /\b(one-line config|bumped the (?:version|constant)|flipped the (?:flag|setting))\b/i],
];

export interface Candidate {
    id: string;
    description: string;
    /** Bracketed `[...]` content, or null. */
    bracket: string | null;
    /** The axis, when the bracket is an axis rather than a `forced:` constraint. */
    axis: string | null;
    /** The constraint, when the bracket declares a forced form. */
    forced: string | null;
}

export interface ParsedLine {
    raw: string;
    candidates: Candidate[];
    chosen: string | null;
    observation: string | null;
}

export type FindingCode =
    | 'missing-candidates'
    | 'candidates-no-decision'
    | 'missing-k0'
    | 'k0-not-first'
    | 'missing-axis'
    | 'shared-axis'
    | 'single-candidate-unforced'
    | 'unknown-choice'
    | 'missing-observation';

export interface Finding {
    code: FindingCode;
    message: string;
}

export interface Verdict {
    findings: Finding[];
    lines: ParsedLine[];
    /** Which owed classes fired, for the report. */
    owedClasses: string[];
    /** Which exemptions fired. */
    exemptClasses: string[];
    owed: boolean;
}

/** A candidate id: `K0`, or a single letter optionally followed by digits. */
const ID_RE = /^(K\d+|[A-Z]\d*)\b/;

/** Sentences that DENY rather than claim — mirrors the sibling linter. */
const DENIAL_RE = /\b(no|nothing|not|never|without)\b[^.]{0,40}$/i;

function fires(text: string, triggers: readonly (readonly [string, RegExp])[]): string[] {
    const hit: string[] = [];
    for (const sentence of text.split(/(?<=[.!?\n])/)) {
        for (const [name, re] of triggers) {
            if (!re.test(sentence)) continue;
            const before = sentence.slice(0, sentence.search(re));
            if (DENIAL_RE.test(before)) continue;
            if (!hit.includes(name)) hit.push(name);
        }
    }
    return hit;
}

export function parseLine(rawBody: string): ParsedLine {
    // A line the model wrapped in emphasis leaves its closing run at the end,
    // where it would otherwise be read as part of the deciding observation.
    const body = rawBody.replace(/(?:\*\*|__|\*|_)+[ \t]*$/, '').trim();
    const arrowIdx = Math.max(body.indexOf('→'), body.indexOf('->'));
    const listPart = arrowIdx === -1 ? body : body.slice(0, arrowIdx);
    const decisionPart = arrowIdx === -1 ? '' : body.slice(arrowIdx).replace(/^(→|->)\s*/, '');

    const candidates: Candidate[] = [];
    for (const chunk of listPart.split(SLOT_SEPARATOR)) {
        const t = chunk.trim();
        if (t === '') continue;
        const m = ID_RE.exec(t);
        const id = m ? (m[1] as string) : '';
        let rest = m ? t.slice((m[1] as string).length).trim() : t;
        let bracket: string | null = null;
        const b = /\[([^\]]*)\]\s*$/.exec(rest);
        if (b) {
            bracket = (b[1] ?? '').trim();
            rest = rest.slice(0, b.index).trim();
        }
        const isForced = bracket !== null && /^forced\s*:/i.test(bracket);
        candidates.push({
            id,
            description: rest,
            bracket,
            axis: bracket !== null && !isForced ? bracket : null,
            forced: isForced ? (bracket as string).replace(/^forced\s*:\s*/i, '').trim() : null,
        });
    }

    let chosen: string | null = null;
    let observation: string | null = null;
    if (decisionPart !== '') {
        const cm = ID_RE.exec(decisionPart.trim());
        chosen = cm ? (cm[1] as string) : null;
        const sep = decisionPart.search(/[;—]|\s-\s/);
        observation = sep === -1 ? null : decisionPart.slice(sep + 1).replace(/^[—;\s-]+/, '').trim() || null;
    }

    return { raw: body, candidates, chosen, observation };
}

/**
 * The axis-distinctness threshold.
 *
 * A STATED DEFAULT, not a measured optimum. Two axes whose content words
 * overlap at or above this read as one axis — step 2.5's "three candidates
 * that differ only in where a helper lives are one candidate".
 */
export const AXIS_OVERLAP = 0.6;

export function checkReport(text: string): Verdict {
    const findings: Finding[] = [];
    const prepared = unwrapLines(stripFences(text));

    const owedClasses = fires(prepared, OWED_CLASS_TRIGGERS);
    const exemptClasses = fires(prepared, NOT_OWED_TRIGGERS);
    // An exemption suppresses only when nothing owed fired. See NOT_OWED_TRIGGERS.
    const owed = owedClasses.length > 0;

    CANDIDATES_RE.lastIndex = 0;
    const lines = [...prepared.matchAll(CANDIDATES_RE)].map((m) => parseLine(m[1] ?? ''));

    if (owed && lines.length === 0) {
        findings.push({
            code: 'missing-candidates',
            message:
                `the report is in ${owedClasses.length} owed decision class(es) ` +
                `(${owedClasses.join(', ')}) and carries no Candidates line. ` +
                'K0 first, each non-K0 candidate with the axis it differs on, then the choice ' +
                'and the observation that decided it.',
        });
    }

    for (const [i, l] of lines.entries()) {
        const where = lines.length > 1 ? `line ${String(i + 1)} of ${String(lines.length)}: ` : '';
        const ids = l.candidates.map((c) => c.id);

        if (!ids.includes('K0')) {
            findings.push({
                code: 'missing-k0',
                message:
                    `${where}no K0 candidate. K0 is "keep the current form / change nothing" and is ` +
                    'owed wherever the line is owed — without it the set assumes some edit is correct ' +
                    'before any reasoning starts.',
            });
        } else if (ids[0] !== 'K0') {
            findings.push({ code: 'k0-not-first', message: `${where}K0 is present but not first (order: ${ids.join(', ')}).` });
        }

        const nonK0 = l.candidates.filter((c) => c.id !== 'K0');
        const forcedDecl = l.candidates.find((c) => c.forced !== null);

        if (nonK0.length === 0 && forcedDecl === undefined) {
            findings.push({
                code: 'single-candidate-unforced',
                message:
                    `${where}only K0, and no forced-form constraint. Where exactly one form is ` +
                    'admissible, name the constraint that forecloses the alternatives — ' +
                    '`[forced: the base class fixes the extension point]`. A bare single candidate ' +
                    'is indistinguishable from not having looked.',
            });
        }

        for (const c of nonK0) {
            if (c.axis === null && c.forced === null) {
                findings.push({
                    code: 'missing-axis',
                    message:
                        `${where}candidate ${c.id} carries no axis. Three candidates that differ only ` +
                        'in where a helper lives are one candidate.',
                });
            }
        }

        const axes = nonK0.filter((c) => c.axis !== null).map((c) => ({ id: c.id, set: contentWords(c.axis as string) }));
        for (let a = 0; a < axes.length; a++) {
            for (let b = a + 1; b < axes.length; b++) {
                const ov = overlap((axes[a] as { set: Set<string> }).set, (axes[b] as { set: Set<string> }).set);
                if (ov >= AXIS_OVERLAP) {
                    findings.push({
                        code: 'shared-axis',
                        message:
                            `${where}candidates ${(axes[a] as { id: string }).id} and ${(axes[b] as { id: string }).id} ` +
                            `share an axis (overlap ${String(Math.round(ov * 1000) / 1000)}) — they count as ONE material candidate.`,
                    });
                }
            }
        }

        if (l.chosen === null) {
            findings.push({
                code: 'candidates-no-decision',
                message: `${where}no choice. The line ends with "→ <id>; <the observation that decided it>".`,
            });
        } else {
            if (!ids.includes(l.chosen)) {
                findings.push({
                    code: 'unknown-choice',
                    message: `${where}the choice ${l.chosen} is not one of the listed candidates (${ids.join(', ')}).`,
                });
            }
            if (l.observation === null || l.observation === '') {
                findings.push({
                    code: 'missing-observation',
                    message:
                        `${where}the choice ${l.chosen} states no deciding observation. Without one the ` +
                        'choice reads as preference, which the rubric scores 2 rather than 3.',
                });
            }
        }
    }

    return { findings, lines, owedClasses, exemptClasses, owed };
}

/** The three deterministic counts step 3.1 runs before any scoring. */
export interface CorpusCounts {
    transcripts: number;
    withLine: number;
    withK0: number;
    axesPairwiseDistinct: number;
    k0Drawn: number;
    findings: number;
}

/**
 * Count a stored eval results file.
 *
 * Reads the same envelope `rdp_quality_eval --score-only` reads, so the
 * treatment run needs no bespoke format. `k0Drawn` is the counter step 2.1
 * actually wants: K0 present but never chosen across a whole corpus is K0 as
 * an unchosen first row, which is the failure that step names.
 */
export function countCorpus(runPath: string): CorpusCounts | { error: string } {
    let run: { results?: Array<{ variants?: Record<string, { text?: string }> }> };
    try {
        run = JSON.parse(fs.readFileSync(runPath, 'utf-8')) as typeof run;
    } catch (e) {
        return { error: `cannot read ${runPath}: ${String(e)}` };
    }
    const counts: CorpusCounts = {
        transcripts: 0, withLine: 0, withK0: 0, axesPairwiseDistinct: 0, k0Drawn: 0, findings: 0,
    };
    for (const r of run.results ?? []) {
        for (const v of Object.values(r.variants ?? {})) {
            if (typeof v.text !== 'string' || v.text === '') continue;
            counts.transcripts += 1;
            const verdict = checkReport(v.text);
            if (verdict.lines.length === 0) continue;
            counts.withLine += 1;
            counts.findings += verdict.findings.length;
            const l = verdict.lines[0] as ParsedLine;
            if (l.candidates.some((c) => c.id === 'K0')) counts.withK0 += 1;
            if (!verdict.findings.some((f) => f.code === 'shared-axis')) counts.axesPairwiseDistinct += 1;
            if (l.chosen === 'K0') counts.k0Drawn += 1;
        }
    }
    return counts;
}

function readInput(argv: readonly string[]): { text: string } | { error: string } {
    const fileIdx = argv.indexOf('--file');
    if (fileIdx !== -1) {
        const p = argv[fileIdx + 1];
        if (p === undefined) return { error: '--file needs a path' };
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
    return { error: 'usage: check_candidate_lines --stdin | --file <report.md> | --corpus <results.json>' };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const corpusIdx = argv.indexOf('--corpus');
    if (corpusIdx !== -1) {
        const p = argv[corpusIdx + 1];
        if (p === undefined) {
            process.stderr.write('--corpus needs a results.json path\n');
            return 1;
        }
        const c = countCorpus(path.resolve(p));
        if ('error' in c) {
            process.stderr.write(`${c.error}\n`);
            return 1;
        }
        try {
            assertScanned({
                gate: 'check_candidate_lines',
                scanned: c.transcripts,
                units: 'transcript(s)',
                roots: [p],
            });
        } catch (e) {
            if (e instanceof DeadScopeError) {
                process.stderr.write(`❌  ${e.message}\n`);
                return 1;
            }
            throw e;
        }
        process.stdout.write(
            `transcripts: ${String(c.transcripts)}\n` +
                `Candidates line present: ${String(c.withLine)}\n` +
                `K0 present: ${String(c.withK0)}\n` +
                `axes pairwise distinct: ${String(c.axesPairwiseDistinct)}\n` +
                `K0 actually drawn: ${String(c.k0Drawn)}\n` +
                `shape findings: ${String(c.findings)}\n` +
                `scanned: ${String(c.transcripts)}\n`,
        );
        return 0;
    }

    const quiet = argv.includes('--quiet');
    const input = readInput(argv);
    if ('error' in input) {
        process.stderr.write(`${input.error}\n`);
        return 1;
    }
    const contentLines = input.text.split('\n').filter((l) => l.trim() !== '').length;
    try {
        assertScanned({ gate: 'check_candidate_lines', scanned: contentLines, units: 'report line(s)', roots: ['<stdin>'] });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    const verdict = checkReport(input.text);
    for (const f of verdict.findings) process.stderr.write(`❌  ${f.code}  ${f.message}\n`);
    if (verdict.findings.length > 0) {
        process.stderr.write(`\n❌  check_candidate_lines: ${String(verdict.findings.length)} finding(s)\n`);
        return 2;
    }
    if (!quiet) {
        if (!verdict.owed && verdict.lines.length === 0) {
            process.stdout.write(
                '✅  check_candidate_lines: no owed decision class detected in this report' +
                    (verdict.exemptClasses.length > 0 ? ` (exempt: ${verdict.exemptClasses.join(', ')})` : '') +
                    '\n',
            );
        } else {
            process.stdout.write(
                `✅  check_candidate_lines: ${String(verdict.lines.length)} well-formed line(s)` +
                    (verdict.owedClasses.length > 0 ? ` for owed class(es) ${verdict.owedClasses.join(', ')}` : '') +
                    '\n',
            );
        }
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}

export { REPO_ROOT };
