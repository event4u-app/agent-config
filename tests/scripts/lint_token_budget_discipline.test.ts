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
    RICH_RATIO_CAP,
    RICH_SECTION_HEADING,
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
