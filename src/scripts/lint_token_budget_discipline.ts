#!/usr/bin/env tsx
/**
 * Token-budget-discipline gate (src/rules/token-budget-discipline.md).
 *
 * The rule names this linter as its CI enforcer for two obligations on
 * `token_budget_class: rich` skills:
 *
 * 1. CAP — at most 15 % of the suite's skills may claim `rich`. Exceeding
 *    the ratio is a hard fail (both numbers are printed).
 * 2. JUSTIFICATION — every `rich`-tagged skill carries a
 *    `## Why this skill is rich` section explaining the irreducible
 *    complexity.
 * 3. SIZE — a `rich`-tagged skill stays under the declared ceiling
 *    (3,500 tokens, ADR-217). Measured with the exact BPE tokenizer
 *    where `js-tiktoken` resolves and with the character proxy where it does
 *    not; the gate says which. A proxy measurement sitting within its own
 *    error margin of the ceiling is reported UNRESOLVED rather than silently
 *    classified — the proxy runs ~5 % off per file IN EITHER DIRECTION, and a
 *    reading whose error band straddles the ceiling has not decided anything.
 *
 * The band was documentation until ADR-217: the ceiling described no artifact
 * that existed (measured max 3,331 of a declared 5,000), so nothing ever
 * noticed that its top half was unused. An unused permission costs nothing
 * until someone uses it.
 *
 * The band's FLOOR is documented and deliberately NOT gated. Running the check
 * once found `accessibility-auditor` at 1,931 tokens — under the 2,000 floor
 * while legitimately holding the class, because `rich` buys exemption from
 * condensation and that is a claim about what compression would LOSE, not
 * about how large the file is. The published measurement supplies a
 * degradation threshold, which is a ceiling; nothing measures a minimum. A
 * floor gate would have forced a WCAG-criteria skill out of the exemption on a
 * number with no evidence behind it.
 *
 * Additionally, any `token_budget_class` value outside
 * `lean | standard | rich` is a finding (schema drift).
 *
 * Exit: 0 clean · 1 usage/IO error · 2 findings.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { gpt_tokens } from './_lib/token_count.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const SKILLS_ROOT = 'src/skills';

/** The rule's cap: rich-tagged skills / total skills must stay <= 15 %. */
export const RICH_RATIO_CAP = 0.15;

export const VALID_CLASSES = ['lean', 'standard', 'rich'] as const;

export const RICH_SECTION_HEADING = '## Why this skill is rich';

/** Declared band for the rich class (ADR-217). Floor unchanged; ceiling 5,000 → 3,500. */
export const RICH_MIN_TOKENS = 2000;
export const RICH_MAX_TOKENS = 3500;

/**
 * Worst-case per-file error of the character proxy, measured over the four
 * rich artifacts on 2026-08-06 (−5.3 % on the largest). A proxy measurement
 * inside this margin of a boundary is not a verdict.
 */
export const PROXY_ERROR_MARGIN = 0.06;

export interface Finding {
    /** repo-relative path */
    file: string;
    message: string;
}

export interface ScanResult {
    findings: Finding[];
    /** SKILL.md files scanned. */
    scanned: number;
    /** Skills declaring token_budget_class: rich. */
    richCount: number;
    /** Per-rich-skill size measurements, for the report line. */
    sizes: RichSize[];
    /** True when every size came from the exact BPE tokenizer. */
    exactThroughout: boolean;
}

export interface RichSize {
    file: string;
    tokens: number;
    exact: boolean;
    /** Set when a proxy measurement lands inside its own error margin of a boundary. */
    unresolved: boolean;
}

/**
 * Measure one artifact, exact where the tokenizer resolved.
 *
 * Split out so the size rule is testable without a filesystem: the boundary
 * cases that matter (exactly at the cap, one token over, a proxy reading a
 * hair under) are the ones a fixture tree makes awkward and a function call
 * makes trivial.
 */
export function classify_size(tokens: number, exact: boolean): { over: boolean; unresolved: boolean } {
    if (exact) {
        return { over: tokens > RICH_MAX_TOKENS, unresolved: false };
    }
    // A proxy reading is a band around the truth, and the band is SYMMETRIC.
    // The first version applied the margin upward only — guarding a proxy that
    // reads low — while the measured error on the largest artifact runs the
    // other way: 3,518 by proxy against 3,331 exact, reading 5.3 % HIGH. That
    // version therefore hard-failed the one artifact ADR-217 rules in-band,
    // on any machine without the tokenizer (`js-tiktoken` is a devDependency).
    //
    // So: a proxy verdict counts only when the WHOLE band falls on one side of
    // the ceiling. A band straddling it is `unresolved` — which is a finding,
    // but one that says "measure properly" rather than "this is too big".
    const margin = Math.ceil(tokens * PROXY_ERROR_MARGIN);
    const straddles = tokens - margin <= RICH_MAX_TOKENS && tokens + margin > RICH_MAX_TOKENS;
    return { over: !straddles && tokens - margin > RICH_MAX_TOKENS, unresolved: straddles };
}

/** `token_budget_class` value from a SKILL.md's YAML frontmatter, or null. */
export function frontmatter_class(content: string): string | null {
    if (!content.startsWith('---')) {
        return null;
    }
    const end = content.indexOf('\n---', 3);
    if (end === -1) {
        return null;
    }
    const frontmatter = content.slice(0, end);
    const m = /^token_budget_class:\s*['"]?([^'"\s#]+)/m.exec(frontmatter);
    return m ? m[1]! : null;
}

/** Scan one skills root (directory of `<skill>/SKILL.md`). */
export function scan_skills(skillsRoot: string): ScanResult {
    const findings: Finding[] = [];
    const sizes: RichSize[] = [];
    let scanned = 0;
    let richCount = 0;
    const entries = fs
        .readdirSync(skillsRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    for (const name of entries) {
        const skillFile = path.join(skillsRoot, name, 'SKILL.md');
        if (!fs.existsSync(skillFile)) {
            continue;
        }
        scanned += 1;
        const rel = path.relative(REPO_ROOT, skillFile).split(path.sep).join('/');
        const content = fs.readFileSync(skillFile, 'utf-8');
        const cls = frontmatter_class(content);
        if (cls === null) {
            continue; // no key = lean by default (rule § the three classes)
        }
        if (!(VALID_CLASSES as readonly string[]).includes(cls)) {
            findings.push({
                file: rel,
                message: `invalid token_budget_class '${cls}' — must be one of ${VALID_CLASSES.join(' | ')}`,
            });
            continue;
        }
        if (cls === 'rich') {
            richCount += 1;
            if (!content.includes(RICH_SECTION_HEADING)) {
                findings.push({
                    file: rel,
                    message: `rich-tagged skill missing the '${RICH_SECTION_HEADING}' justification section`,
                });
            }
            const measured = gpt_tokens(content);
            const verdict = classify_size(measured.tokens, measured.exact);
            sizes.push({ file: rel, tokens: measured.tokens, exact: measured.exact, unresolved: verdict.unresolved });
            const how = measured.exact ? 'exact BPE' : 'chars/4 proxy';
            if (verdict.over) {
                findings.push({
                    file: rel,
                    message:
                        `rich-class size band exceeded: ${String(measured.tokens)} tokens (${how}) > ` +
                        `${String(RICH_MAX_TOKENS)} (ADR-217). Split by responsibility, or argue the ` +
                        'ceiling in a decision record — not in this file.',
                });
            } else if (verdict.unresolved) {
                findings.push({
                    file: rel,
                    message:
                        `rich-class size UNRESOLVED: ${String(measured.tokens)} tokens (${how}) sits within the ` +
                        `${String(PROXY_ERROR_MARGIN * 100)} % proxy margin of a band boundary. Install the exact ` +
                        'tokenizer (js-tiktoken is a declared dependency) and re-run — a proxy reading this ' +
                        'close has not decided anything.',
                });
            }
        }
    }
    if (scanned > 0 && richCount > scanned * RICH_RATIO_CAP) {
        findings.push({
            file: SKILLS_ROOT,
            message:
                `rich-skill cap exceeded: ${String(richCount)} rich of ${String(scanned)} skills ` +
                `(${((richCount / scanned) * 100).toFixed(1)} % > ${String(RICH_RATIO_CAP * 100)} % cap, ` +
                `max ${String(Math.floor(scanned * RICH_RATIO_CAP))})`,
        });
    }
    return { findings, scanned, richCount, sizes, exactThroughout: sizes.every((s) => s.exact) };
}

export function main(argv?: readonly string[]): number {
    let quiet = false;
    for (const arg of argv ?? process.argv.slice(2)) {
        if (arg === '--quiet') {
            quiet = true;
        } else {
            process.stderr.write('usage: lint_token_budget_discipline [--quiet]\n');
            return 1;
        }
    }

    let result: ScanResult;
    try {
        result = scan_skills(path.join(REPO_ROOT, SKILLS_ROOT));
    } catch (e) {
        process.stderr.write(`error: ${String(e)}\n`);
        return 1;
    }

    for (const f of result.findings) {
        process.stdout.write(`❌  ${f.file}  ${f.message}\n`);
    }
    if (result.findings.length === 0 && !quiet) {
        const how = result.exactThroughout ? 'exact BPE' : 'chars/4 proxy (js-tiktoken did not resolve)';
        const largest = result.sizes.reduce((max, s) => (s.tokens > max ? s.tokens : max), 0);
        process.stdout.write(
            `✅  token-budget discipline: ${String(result.richCount)} rich of ${String(result.scanned)} skills within the ${String(RICH_RATIO_CAP * 100)} % cap; every rich skill justifies itself\n`,
        );
        // Publish the sizes on the GREEN path too. A band nobody sees the
        // numbers for is how this one spent months describing no artifact
        // that existed.
        process.stdout.write(
            `    size ceiling ${String(RICH_MAX_TOKENS)} (ADR-217; the ${String(RICH_MIN_TOKENS)} floor is documented, not gated), ` +
                `measured ${how}; largest ${String(largest)}\n`,
        );
        for (const s of result.sizes) {
            process.stdout.write(`    ${String(s.tokens).padStart(5)}  ${s.file}\n`);
        }
    }
    // gate-coverage contract (src/config/gate-coverage.yml): files inspected.
    process.stdout.write(`scanned: ${String(result.scanned)}\n`);
    return result.findings.length > 0 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
