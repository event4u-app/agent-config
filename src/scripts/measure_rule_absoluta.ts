#!/usr/bin/env node
/**
 * Measure how many rules carry an imperative ABSOLUTE, and which terms.
 *
 * WHY THIS EXISTS. `road-to-rule-coherence` was designed around the figure
 * "17 rules carry competing absolutes". A scratch census during that roadmap
 * refuted it and reported 97 of 111 — and that refutation is what killed the
 * precedence lattice and the coverage ratchet: a governance mechanism over 17
 * outliers is proportionate, the same mechanism over ~90% of the corpus is
 * declaration debt across almost all of it.
 *
 * But the 97 came from a throwaway script in a scratch directory, so it was an
 * unverified number replacing an unverified number — the exact failure class it
 * had just exposed. Re-deriving it here shows BOTH prior figures were lexicon
 * artifacts:
 *
 *   strict (ALL-CAPS imperatives only)        79 / 111  (71.2%)
 *   same lexicon, case-insensitive            97 / 111  (87.4%)  <- the prior 97
 *   carries an Iron Law block (structural)    94 / 111  (84.7%)
 *
 * The 97 is reproducible — it is the case-insensitive reading, which counts
 * lowercase "must"/"never" in explanatory prose as mandates. The strict reading
 * is the better proxy for an imperative, but it has false negatives of its own:
 * `downstream-changes` carries a full Iron Law block ("EVERY EDIT IS INCOMPLETE
 * ... IS A CRITICAL FAILURE") using none of the lexicon terms, and scores 0.
 *
 * So no single number is defensible, and the third row is why that does not
 * matter: the structural count needs no lexicon at all, and all three readings
 * land at 71-87%. The conclusion the roadmap actually rests on — absolutes are
 * the house style, not 17 outliers — is invariant to the method. Cite the range
 * and the structural figure; do not cite a point estimate.
 *
 * NOT A GATE, deliberately. The `measure_` prefix keeps it out of
 * `_lib/gate_population`'s gate set, and it emits no `scanned:` contract line,
 * so it carries no `gate-coverage.yml` registration duty. There is nothing here
 * to enforce: "how many rules speak in absolutes" is a property of the house
 * writing style, not a defect with a threshold. Adding a threshold would
 * recreate the ratchet the measurement itself argued against.
 *
 * Frontmatter is excluded — `description:` routinely contains trigger words
 * that are not imperatives addressed to the agent.
 *
 * Output: default table, `--json` for the deterministic record.
 *
 * SCOPE: this is a CLOSED decision input, not ongoing instrumentation — see
 * docs/decisions/ADR-218-absoluta-census-is-a-closed-decision-input.md. Nothing
 * consumes the number; it exists so the figures in that record can be
 * re-derived instead of cited from a commit message. A future "did this PR
 * introduce a new absolute?" check is a DIFFERENT tool that watches diffs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { SRC_RULES } from './_lib/agent_src.js';

/**
 * The lexicon IS the measurement — enumerated here rather than described, so a
 * re-run reproduces the number exactly and a disagreement about the number is a
 * disagreement about this list.
 *
 * Case-sensitive where the term is an ALL-CAPS imperative (`NEVER`, `ALWAYS`,
 * `STOP`, `MUST`, `FORBIDDEN`): lowercase "never" appears in ordinary prose
 * ("never mind that") and is not a mandate. Case-insensitive where the phrase
 * is a mandate in any casing (`non-bypassable`, `Hard Floor`, `no exceptions`)
 * or a verb stem (`refuse`, `abort`).
 */
export const ABSOLUTA_LEXICON: ReadonlyArray<{
    term: string;
    pattern: RegExp;
    note: string;
}> = [
    { term: 'NEVER', pattern: /\bNEVER\b/g, note: 'ALL-CAPS only — lowercase "never" is ordinary prose' },
    { term: 'ALWAYS', pattern: /\bALWAYS\b/g, note: 'ALL-CAPS only' },
    { term: 'STOP', pattern: /\bSTOP\b/g, note: 'ALL-CAPS only' },
    { term: 'MUST', pattern: /\bMUST\b/g, note: 'ALL-CAPS only — lowercase "must" is common in explanatory prose' },
    { term: 'FORBIDDEN', pattern: /\bFORBIDDEN\b/g, note: 'ALL-CAPS only' },
    { term: 'non-bypassable', pattern: /non-bypassable/gi, note: 'any casing — always a mandate' },
    { term: 'Hard Floor', pattern: /hard floor/gi, note: 'any casing — names the supremacy tier' },
    { term: 'no exceptions', pattern: /no exceptions/gi, note: 'any casing' },
    { term: 'refuse', pattern: /\brefuses?\b|\brefusal\b/gi, note: 'verb stem, any casing' },
    { term: 'abort', pattern: /\baborts?\b/gi, note: 'verb stem, any casing' },
];

export interface RuleAbsoluta {
    rule: string;
    total: number;
    perTerm: Record<string, number>;
    /** True when the file has a body but no absolute — the pointer-stub class. */
    stub: boolean;
}

export interface AbsolutaCensus {
    rules_scanned: number;
    rules_with_absolute: number;
    rules_without_absolute: number;
    share_with_absolute: number;
    occurrences_total: number;
    per_term: Record<string, { occurrences: number; rules: number }>;
    without_absolute: string[];
    per_rule: RuleAbsoluta[];
    /** Case-insensitive reading of the same lexicon — the upper bound. */
    rules_with_absolute_loose: number;
    /**
     * Structural, lexicon-independent signal: rules carrying an `Iron Law`
     * heading or a `**Iron Law` marker. This is the number that does NOT move
     * when the lexicon is argued about, which is why it is reported alongside.
     */
    rules_with_iron_law: number;
}

/** `## Iron Law`, `### Iron Laws`, `**Iron Law.**`, `Iron Law 1`, … */
const IRON_LAW_MARKER = /^#{1,6}\s+.*Iron Law|^\*\*Iron Law/im;

/** Strip YAML frontmatter; return the body only. */
export function stripFrontmatter(text: string): string {
    if (!text.startsWith('---\n')) return text;
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return text;
    return text.slice(end + '\n---\n'.length);
}

export function censusAbsoluta(rulesDir: string): AbsolutaCensus {
    const files = fs
        .readdirSync(rulesDir)
        .filter((f) => f.endsWith('.md'))
        .sort();

    const perRule: RuleAbsoluta[] = [];
    const perTerm: Record<string, { occurrences: number; rules: number }> = {};
    for (const { term } of ABSOLUTA_LEXICON) perTerm[term] = { occurrences: 0, rules: 0 };

    let occurrences = 0;
    let looseHits = 0;
    let ironLawHits = 0;
    for (const file of files) {
        const body = stripFrontmatter(fs.readFileSync(path.join(rulesDir, file), 'utf-8'));
        const counts: Record<string, number> = {};
        let total = 0;
        let looseTotal = 0;
        for (const { term, pattern } of ABSOLUTA_LEXICON) {
            // Fresh regex per file: /g patterns carry lastIndex across calls.
            const n = (body.match(new RegExp(pattern.source, pattern.flags)) ?? []).length;
            counts[term] = n;
            total += n;
            if (n > 0) {
                perTerm[term]!.occurrences += n;
                perTerm[term]!.rules += 1;
            }
            // Loose reading: same lexicon, case-insensitive throughout. This is
            // the upper bound, and it is the reading a prior scratch census
            // used — reproducing it here is what identifies that method.
            looseTotal += (body.match(new RegExp(pattern.source, 'gi')) ?? []).length;
        }
        occurrences += total;
        if (looseTotal > 0) looseHits += 1;
        if (IRON_LAW_MARKER.test(body)) ironLawHits += 1;
        perRule.push({ rule: path.basename(file, '.md'), total, perTerm: counts, stub: total === 0 });
    }

    const withAbs = perRule.filter((r) => r.total > 0).length;
    return {
        rules_scanned: perRule.length,
        rules_with_absolute: withAbs,
        rules_without_absolute: perRule.length - withAbs,
        share_with_absolute: perRule.length === 0 ? 0 : Number((withAbs / perRule.length).toFixed(4)),
        occurrences_total: occurrences,
        per_term: perTerm,
        without_absolute: perRule.filter((r) => r.stub).map((r) => r.rule),
        per_rule: perRule,
        rules_with_absolute_loose: looseHits,
        rules_with_iron_law: ironLawHits,
    };
}

function render(c: AbsolutaCensus): string {
    const lines: string[] = [];
    lines.push('Rule absoluta census');
    lines.push('');
    lines.push(
        `  rules scanned          ${c.rules_scanned}`,
    );
    lines.push(
        `  carry >=1 absolute     ${c.rules_with_absolute}  (${(c.share_with_absolute * 100).toFixed(1)}%)`,
    );
    lines.push(`  carry none             ${c.rules_without_absolute}`);
    lines.push(
        `  same lexicon, loose    ${c.rules_with_absolute_loose}  (${((c.rules_with_absolute_loose / c.rules_scanned) * 100).toFixed(1)}%)  <- case-insensitive upper bound`,
    );
    lines.push(
        `  carry an Iron Law      ${c.rules_with_iron_law}  (${((c.rules_with_iron_law / c.rules_scanned) * 100).toFixed(1)}%)  <- structural, lexicon-free`,
    );
    lines.push(`  total occurrences      ${c.occurrences_total}  (strict)`);
    lines.push('');
    lines.push('  per term (occurrences / rules):');
    for (const { term } of ABSOLUTA_LEXICON) {
        const e = c.per_term[term]!;
        lines.push(`    ${term.padEnd(16)} ${String(e.occurrences).padStart(4)} / ${e.rules}`);
    }
    if (c.without_absolute.length > 0) {
        lines.push('');
        lines.push('  rules with NO absolute (expected: migrated pointer stubs):');
        for (const r of c.without_absolute) lines.push(`    ${r}`);
    }
    return lines.join('\n');
}

export function main(argv: string[]): number {
    const json = argv.includes('--json');
    const dir = SRC_RULES();
    if (!fs.existsSync(dir)) {
        process.stderr.write(`measure_rule_absoluta: rules dir missing: ${dir}\n`);
        return 1;
    }
    const c = censusAbsoluta(dir);
    if (c.rules_scanned === 0) {
        // A census over zero files would print a confident 0% — the
        // scan-nothing-and-look-green shape this repo has been burned by.
        process.stderr.write(`measure_rule_absoluta: scanned 0 rules under ${dir}\n`);
        return 1;
    }
    process.stdout.write((json ? JSON.stringify(c, null, 2) : render(c)) + '\n');
    return 0;
}

/* c8 ignore start */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = main(process.argv.slice(2));
}
/* c8 ignore stop */
