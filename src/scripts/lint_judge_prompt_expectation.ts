#!/usr/bin/env tsx
/**
 * Warn when a captured judge prompt states an EXPECTATION of the outcome.
 *
 * Step 4.2 of `road-to-review-independence`, and the companion to
 * `evidence_independence.ts`. That concern blocks a prompt carrying a pre-loaded
 * **verdict**; this one reads the prompts that were actually sent and warns on the
 * softer form — a statement of what the author thinks the answer will be.
 *
 * The distinction is not academic. *"NO-FINDINGS is expected and welcome"* names no
 * verdict and supplies one; it steered a real review into an honest-null that a later
 * unsteered pass refuted with five findings, one critical, already live on the trunk.
 * `evaluator-independence.md` states the rule; this is the part a script can see.
 *
 * WHAT IT CANNOT SEE — stated here so the gate is not oversold, exactly as
 * `evidence_independence.ts` states its own phrase-list limit:
 *
 * 1. **A paraphrase.** This is a PHRASE LIST. "no findings expected" is caught; "I'd be
 *    surprised if anything turns up" is not. It catches recurrences of known steering
 *    wording, never steering as such. Closing that needs a judgement, not a check.
 * 2. **Omission.** A round that commits no `prompt.md` is not in the scanned set at all —
 *    the same cheapest-bypass `check_review_prompt_binding` records for itself. Nothing
 *    in the tree requires the package to exist.
 * 3. **Substitution.** The party that writes a steered prompt also writes the file, so
 *    swapping a clean one in passes. What changes is that steering then requires an act
 *    of substitution rather than merely a careless sentence.
 *
 * WARN-ONLY, deliberately. A phrase list that can refuse a review would refuse the
 * false positives too, and the shape it is looking for is one sentence in a long prompt.
 * Exit is always 0; the finding is the output.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const REVIEWS_DIR = path.join('agents', 'evidence', 'reviews');

/**
 * Phrases that state an expectation of the outcome.
 *
 * Each is a shape observed or narrowly derived from one, and the list is deliberately
 * short: a long list of guesses produces false positives, and a warn nobody trusts is
 * worse than no warn. The first entry is the measured one.
 */
export const EXPECTATION_PHRASES: readonly RegExp[] = [
    /no[- ]findings\s+(?:is|are)\s+(?:expected|welcome)/i,
    /\bexpect(?:ing)?\s+(?:no|zero)\s+(?:findings|issues|problems)/i,
    /\bshould\s+be\s+(?:clean|fine|correct|green)\b/i,
    /\bi\s+believe\s+this\s+is\s+(?:correct|clean|right)\b/i,
    /\bjust\s+confirm\b/i,
    /\bplease\s+confirm\s+(?:that\s+)?(?:there\s+are\s+)?no\b/i,
    /\bthis\s+(?:should|ought\s+to)\s+pass\b/i,
];

export interface Finding {
    readonly file: string;
    readonly line: number;
    readonly phrase: string;
    readonly text: string;
}

/** Scan one prompt's text. Returns every match, not the first — a prompt can steer twice. */
export function scanPromptText(rel: string, text: string): Finding[] {
    const out: Finding[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]!;
        for (const re of EXPECTATION_PHRASES) {
            const m = re.exec(line);
            if (m !== null) {
                out.push({
                    file: rel,
                    line: i + 1,
                    phrase: m[0],
                    // Trimmed and capped: the finding names the sentence, and a prompt
                    // line can be very long.
                    text: line.trim().slice(0, 160),
                });
            }
        }
    }
    return out;
}

/** Every `<slug>.review-input/prompt.md` under the reviews directory. */
export function collectPrompts(repoRoot: string): string[] {
    const dir = path.join(repoRoot, REVIEWS_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name < b.name ? -1 : 1,
    )) {
        if (!entry.isDirectory() || !entry.name.endsWith('.review-input')) continue;
        const p = path.join(dir, entry.name, 'prompt.md');
        if (fs.existsSync(p)) out.push(p);
    }
    return out;
}

export function main(argv: readonly string[] = []): number {
    const quiet = argv.includes('--quiet');
    const rootIdx = argv.indexOf('--repo-root');
    const repoRoot = rootIdx >= 0 ? (argv[rootIdx + 1] ?? REPO_ROOT) : REPO_ROOT;

    const prompts = collectPrompts(repoRoot);
    // Per-target accounting. `collectPrompts` already drops a `.review-input`
    // directory that carries no `prompt.md`, and that drop is the gate's own
    // stated bypass ("omission") — the ledger is what makes it countable instead
    // of invisible, so a run over N review directories cannot look identical to
    // a run over N-3 of them.
    const ledger = new GateLedger('lint_judge_prompt_expectation');
    const dirs = fs.existsSync(path.join(repoRoot, REVIEWS_DIR))
        ? fs
              .readdirSync(path.join(repoRoot, REVIEWS_DIR), { withFileTypes: true })
              .filter((e) => e.isDirectory() && e.name.endsWith('.review-input'))
              .map((e) => path.join(REVIEWS_DIR, e.name))
              .sort()
        : [];
    ledger.plan(dirs);
    const withPrompt = new Set(prompts.map((p) => path.dirname(path.relative(repoRoot, p))));
    for (const d of dirs) {
        if (!withPrompt.has(d)) ledger.skip(d, 'no_applicable_files');
    }

    const findings: Finding[] = [];
    for (const p of prompts) {
        const rel = path.relative(repoRoot, p);
        const hits = scanPromptText(rel, fs.readFileSync(p, 'utf-8'));
        findings.push(...hits);
        const dir = path.dirname(rel);
        if (hits.length > 0) ledger.fail(dir, `${String(hits.length)} expectation phrase(s)`);
        else ledger.complete(dir);
    }
    ledger.report(quiet ? () => undefined : undefined);

    reportScanned({
        gate: 'lint_judge_prompt_expectation',
        scanned: prompts.length,
        units: 'captured judge prompt(s)',
        roots: [REVIEWS_DIR],
    });

    if (findings.length === 0) {
        if (!quiet) {
            process.stdout.write(
                '✅  lint_judge_prompt_expectation: no captured prompt states an expectation ' +
                    'of the outcome (phrase list only — a paraphrase is not caught).\n',
            );
        }
        return 0;
    }
    process.stdout.write(
        `⚠️   lint_judge_prompt_expectation: ${String(findings.length)} prompt line(s) state an ` +
            'expectation of the outcome. WARN ONLY — review them:\n',
    );
    for (const f of findings) {
        process.stdout.write(`  ${f.file}:${String(f.line)} — "${f.phrase}"\n      ${f.text}\n`);
    }
    process.stdout.write(
        '\n  A prompt that says what the author thinks the answer is has authored the answer, ' +
            'whatever mood it used. See src/rules/evaluator-independence.md.\n',
    );
    // Always 0. See the header: a phrase list that can refuse would refuse its false
    // positives too.
    return 0;
}

function _isCliEntry(): boolean {
    const invoked = process.argv[1];
    return invoked !== undefined && path.resolve(invoked) === path.resolve(fileURLToPath(import.meta.url));
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
