// Legal disclaimer-presence guarantee (road-to-legal-pack § 0.2, test-enforced).
//
// The maintenance-owner gate is replaced by a hard guarantee: the
// "not legal advice" notice is ALWAYS present — in every legal skill, mandated
// into the chat output, in the README, and as a dedicated legal-pack notice.
// These tests are the gate. If any fails, the legal pack must not ship.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS = path.join(REPO, 'src', 'skills');

// The non-removable line the floor mandates in every legal-pack deliverable
// (this is what surfaces the notice in the chat output).
const CHAT_NOTICE = 'Attorney review required on material use';
// Tolerant of markdown/wording: "not legal advice", "does **not** provide legal
// advice", "no legal advice" — a negation within ~30 chars of "legal advice".
const NOT_LEGAL_ADVICE = /\bno(?:t)?\b[\s\S]{0,30}?legal advice/i;

function read(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

function frontmatter(content: string): string {
    if (!content.startsWith('---\n')) return '';
    const end = content.indexOf('\n---', 4);
    return end === -1 ? '' : content.slice(4, end);
}

function legalSkillFiles(): string[] {
    if (!fs.existsSync(SKILLS)) return [];
    return fs
        .readdirSync(SKILLS)
        .map((d) => path.join(SKILLS, d, 'SKILL.md'))
        .filter((f) => fs.existsSync(f))
        .filter((f) => /(^|\n)packs:\s*\n(?:\s*-\s*[^\n]+\n?)*\s*-\s*legal\s*(\n|$)/.test(frontmatter(read(f))));
}

describe('legal pack — the disclaimer is always present (gate replaces the owner requirement)', () => {
    it('there ARE shipped legal-pack skills to guard', () => {
        expect(legalSkillFiles().length).toBeGreaterThanOrEqual(5);
    });

    it('1) every legal skill carries the not-legal-advice notice IN the skill', () => {
        for (const f of legalSkillFiles()) {
            const body = read(f);
            expect(body, `${path.relative(REPO, f)} missing "not legal advice"`).toMatch(NOT_LEGAL_ADVICE);
        }
    });

    it('2) every legal skill mandates the notice into the CHAT output', () => {
        for (const f of legalSkillFiles()) {
            const body = read(f);
            expect(body, `${path.relative(REPO, f)} missing the chat-output notice line`).toContain(CHAT_NOTICE);
        }
    });

    it('2b) the floor mandates the chat-output notice on every deliverable', () => {
        const floor = read(path.join(REPO, 'src', 'rules', 'legal-safety-floor.md'));
        expect(floor).toContain(CHAT_NOTICE);
        expect(floor).toContain('Mandatory work-product line');
        // and the RDG individual-case guardrail (general info only)
        expect(floor.toLowerCase()).toContain('individual-case');
        expect(floor).toMatch(/general information only/i);
    });

    it('3) the main README carries the notice and links LEGAL_NOTICE.md', () => {
        const readme = read(path.join(REPO, 'README.md'));
        expect(readme).toMatch(NOT_LEGAL_ADVICE);
        expect(readme).toContain('LEGAL_NOTICE.md');
    });

    it('4) a repo-root LEGAL_NOTICE and a dedicated legal-pack notice both exist', () => {
        const root = path.join(REPO, 'LEGAL_NOTICE.md');
        const pack = path.join(REPO, 'src', 'domains', 'legal', 'LEGAL_NOTICE.md');
        expect(fs.existsSync(root), 'repo-root LEGAL_NOTICE.md missing').toBe(true);
        expect(fs.existsSync(pack), 'dedicated src/domains/legal/LEGAL_NOTICE.md missing').toBe(true);
        expect(read(root)).toMatch(NOT_LEGAL_ADVICE);
        expect(read(pack)).toMatch(NOT_LEGAL_ADVICE);
    });
});
