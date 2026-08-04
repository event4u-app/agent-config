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
 *
 * Additionally, any `token_budget_class` value outside
 * `lean | standard | rich` is a finding (schema drift).
 *
 * Exit: 0 clean · 1 usage/IO error · 2 findings.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const SKILLS_ROOT = 'src/skills';

/** The rule's cap: rich-tagged skills / total skills must stay <= 15 %. */
export const RICH_RATIO_CAP = 0.15;

export const VALID_CLASSES = ['lean', 'standard', 'rich'] as const;

export const RICH_SECTION_HEADING = '## Why this skill is rich';

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
    return { findings, scanned, richCount };
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
        process.stdout.write(
            `✅  token-budget discipline: ${String(result.richCount)} rich of ${String(result.scanned)} skills within the ${String(RICH_RATIO_CAP * 100)} % cap; every rich skill justifies itself\n`,
        );
    }
    // gate-coverage contract (src/config/gate-coverage.yml): files inspected.
    process.stdout.write(`scanned: ${String(result.scanned)}\n`);
    return result.findings.length > 0 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
