#!/usr/bin/env tsx
/**
 * Context-spine usage linter.
 *
 * TypeScript twin of `src/scripts/lint_context_spine_usage.py` (ADR-094,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet`
 * detected by argv membership (no argparse), exit codes (0 clean,
 * 1 violations / no files), stdout/stderr split, byte-identical messages,
 * same glob scan order. No behaviour changes — latent bugs replicated.
 *
 * For every slot declared in frontmatter (`context_spine: [...]`), the skill
 * body MUST cite the slot at least once (link, bold, or inline-code form).
 *
 * Exit codes: 0 = clean, 1 = violation / no SKILL.md matched.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const QUIET = process.argv.slice(2).includes('--quiet');

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// Mirror the Python glob order: each pattern is rglob'd + sorted, then the
// patterns are concatenated in declaration order.
const SKILL_GLOBS = [
    '.agent-src.uncondensed/skills',
    'dist/agent-src/skills',
] as const;
const VALID_SLOTS = [
    'product',
    'team',
    'repo',
    'channel-stage',
    'funnel-stage',
    'customer-segment',
    'fiscal-period',
    'org-stage',
    'regulatory-regime',
] as const;

const CONTEXT_SPINE_PAT = /^context_spine:\s*\[([^\]]*)\]\s*$/m;

function _frontmatter_and_body(text: string): [string, string] {
    if (!text.startsWith('---\n')) {
        return ['', text];
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return ['', text];
    }
    return [text.slice(4, end), text.slice(end + 5)];
}

function _read_spine(fm: string): string[] | null {
    const m = CONTEXT_SPINE_PAT.exec(fm);
    if (m === null) {
        return null;
    }
    const raw = m[1]!.trim();
    if (!raw) {
        return [];
    }
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => s.replace(/^['"]+|['"]+$/g, ''));
}

function _slot_cited(body: string, slot: string): boolean {
    const forms = [
        `agents/context-spine/${slot}.md`,
        `**${slot}**`,
        `\`${slot}\``,
    ];
    return forms.some((form) => body.includes(form));
}

function lint_skill(p: string): string[] {
    const text = fs.readFileSync(p, 'utf-8');
    const [fm, body] = _frontmatter_and_body(text);
    if (!fm) {
        return [];
    }
    const slots = _read_spine(fm);
    if (slots === null) {
        return [];
    }
    const problems: string[] = [];
    for (const slot of slots) {
        if (!(VALID_SLOTS as readonly string[]).includes(slot)) {
            problems.push(
                `unknown_context_spine_slot: '${slot}' (valid: ${VALID_SLOTS.join(', ')})`,
            );
            continue;
        }
        if (!_slot_cited(body, slot)) {
            problems.push(
                `declared context_spine slot '${slot}' is never cited ` +
                    `in the skill body — add \`**${slot}**\`, \`\` \`${slot}\` \`\`, ` +
                    `or a link to \`agents/context-spine/${slot}.md\` ` +
                    `(see docs/contracts/context-spine.md § 6)`,
            );
        }
    }
    return problems;
}

/** Recursively list `SKILL.md` files under `dir`, sorted (mirrors sorted(rglob)). */
function _rglobSkillSorted(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name === 'SKILL.md') {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out.sort();
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function main(): number {
    const skills: string[] = [];
    for (const pattern of SKILL_GLOBS) {
        skills.push(..._rglobSkillSorted(path.join(REPO_ROOT, pattern)));
    }
    if (skills.length === 0) {
        process.stderr.write('❌  no SKILL.md files matched\n');
        return 1;
    }
    let failed = 0;
    let declared = 0;
    for (const skill of skills) {
        const rel = _relPosix(skill, REPO_ROOT);
        const problems = lint_skill(skill);
        const text = fs.readFileSync(skill, 'utf-8');
        const [fm] = _frontmatter_and_body(text);
        if (fm && CONTEXT_SPINE_PAT.test(fm)) {
            declared += 1;
        }
        if (problems.length) {
            failed += 1;
            process.stderr.write(`❌  ${rel}\n`);
            for (const pb of problems) {
                process.stderr.write(`    - ${pb}\n`);
            }
        }
    }
    if (failed) {
        process.stderr.write(
            `\n❌  ${failed} skill(s) failed context-spine usage lint ` +
                `(${declared} skill(s) declare a spine)\n`,
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(
            `✅  ${declared} skill(s) declare context_spine; ` +
                `all declared slots are cited in the body\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    SKILL_GLOBS,
    VALID_SLOTS,
    CONTEXT_SPINE_PAT,
    _frontmatter_and_body,
    _read_spine,
    _slot_cited,
    lint_skill,
    main,
};
