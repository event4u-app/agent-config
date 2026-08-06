// Tests for src/scripts/lint_token_budget_discipline.ts.
//
// Real-tree pass verified 2026-08: 4 rich skills (design-intelligence,
// typography-system, accessibility-auditor, design-system-capture — all in
// the rule's approved candidate table), each carrying the
// '## Why this skill is rich' section; 4/288 is far under the 15 % cap.
// No known-offenders list is needed.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    PROXY_ERROR_MARGIN,
    RICH_MAX_TOKENS,
    RICH_RATIO_CAP,
    RICH_SECTION_HEADING,
    classify_size,
    frontmatter_class,
    scan_skills,
} from '../../src/scripts/lint_token_budget_discipline.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function write_skill(root: string, name: string, cls: string | null, body = ''): void {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    const fm =
        cls === null
            ? `---\nname: ${name}\ndescription: A synthetic test skill.\n---\n`
            : `---\nname: ${name}\ndescription: A synthetic test skill.\ntoken_budget_class: ${cls}\n---\n`;
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `${fm}\n# ${name}\n\n${body}`);
}

describe('lint_token_budget_discipline.frontmatter_class', () => {
    it('extracts the declared class', () => {
        expect(frontmatter_class('---\nname: x\ntoken_budget_class: rich\n---\nbody')).toBe('rich');
    });

    it('returns null without the key or without frontmatter', () => {
        expect(frontmatter_class('---\nname: x\n---\nbody')).toBeNull();
        expect(frontmatter_class('# no frontmatter\ntoken_budget_class: rich\n')).toBeNull();
    });

    it('does not read the key from the body below the frontmatter', () => {
        expect(frontmatter_class('---\nname: x\n---\ntoken_budget_class: rich\n')).toBeNull();
    });
});

describe('lint_token_budget_discipline.scan_skills — synthetic trees', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tbd-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('clean tree: rich with section under the cap → no findings', () => {
        for (let i = 0; i < 9; i++) {
            write_skill(tmp, `lean-${String(i)}`, null);
        }
        write_skill(tmp, 'rich-ok', 'rich', `${RICH_SECTION_HEADING}\n\nIrreducible complexity.\n`);
        const result = scan_skills(tmp);
        expect(result.findings).toEqual([]);
        expect(result.scanned).toBe(10);
        expect(result.richCount).toBe(1);
    });

    it('rich count over the 15 % cap → finding with both numbers', () => {
        // 2 rich of 10 skills = 20 % > 15 %.
        for (let i = 0; i < 8; i++) {
            write_skill(tmp, `lean-${String(i)}`, null);
        }
        write_skill(tmp, 'rich-a', 'rich', `${RICH_SECTION_HEADING}\n\nWhy.\n`);
        write_skill(tmp, 'rich-b', 'rich', `${RICH_SECTION_HEADING}\n\nWhy.\n`);
        const result = scan_skills(tmp);
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]!.message).toContain('cap exceeded');
        expect(result.findings[0]!.message).toContain('2 rich of 10 skills');
    });

    it('rich without the justification section → finding', () => {
        for (let i = 0; i < 9; i++) {
            write_skill(tmp, `lean-${String(i)}`, null);
        }
        write_skill(tmp, 'rich-bare', 'rich', 'No justification here.\n');
        const result = scan_skills(tmp);
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]!.message).toContain(RICH_SECTION_HEADING);
    });

    it('invalid class value → finding', () => {
        write_skill(tmp, 'weird', 'jumbo');
        write_skill(tmp, 'ok', 'standard');
        const result = scan_skills(tmp);
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]!.message).toContain("invalid token_budget_class 'jumbo'");
    });
});

describe('lint_token_budget_discipline — real tree', () => {
    it('passes on the real skills tree', () => {
        const result = scan_skills(path.join(REPO_ROOT, 'src', 'skills'));
        expect(result.findings).toEqual([]);
        expect(result.scanned).toBeGreaterThan(200);
        expect(result.richCount).toBeLessThanOrEqual(result.scanned * RICH_RATIO_CAP);
    });
});

describe('classify_size — the band verdict', () => {
    it('exact measurements are verdicts, at the cap and one over', () => {
        expect(classify_size(RICH_MAX_TOKENS, true)).toEqual({ over: false, unresolved: false });
        expect(classify_size(RICH_MAX_TOKENS + 1, true)).toEqual({ over: true, unresolved: false });
        expect(classify_size(1, true)).toEqual({ over: false, unresolved: false });
    });

    it('a proxy reading HIGH near the ceiling is unresolved, not a breach', () => {
        // The regression this pins: the measured proxy error on the largest
        // artifact runs HIGH (3,518 against 3,331 exact). The first version
        // applied the margin upward only, so that reading hard-failed the one
        // artifact ADR-217 rules in-band — on any machine without the
        // tokenizer, which is a devDependency.
        expect(classify_size(3518, false)).toEqual({ over: false, unresolved: true });
    });

    it('a proxy reading whose whole error band clears the ceiling IS a breach', () => {
        // Unresolved must not swallow a real breach: the band has to fall
        // entirely on one side before the gate says anything.
        const clearlyOver = Math.ceil(RICH_MAX_TOKENS * (1 + PROXY_ERROR_MARGIN)) + 50;
        expect(classify_size(clearlyOver, false)).toEqual({ over: true, unresolved: false });
    });

    it('a proxy reading whose whole band sits under the ceiling is clean', () => {
        const clearlyUnder = Math.floor(RICH_MAX_TOKENS * (1 - PROXY_ERROR_MARGIN)) - 50;
        expect(classify_size(clearlyUnder, false)).toEqual({ over: false, unresolved: false });
    });

    it('the margin is symmetric — both edges of the band are unresolved', () => {
        expect(classify_size(RICH_MAX_TOKENS - 1, false).unresolved).toBe(true);
        expect(classify_size(RICH_MAX_TOKENS + 1, false).unresolved).toBe(true);
    });
});
