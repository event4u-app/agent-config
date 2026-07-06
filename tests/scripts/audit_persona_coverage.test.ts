// Tests for src/scripts/skill_tools/audit_persona_coverage.ts (py2ts Phase 8 /
// Wave 8h). 1:1 port of the retired pytest suite plus a CLI intent layer
// (tsx only — the Python original is deleted) over temp fixtures.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _frontmatter_list,
    _frontmatter_value,
    audit,
    type PersonaRow,
} from '../../src/scripts/skill_tools/audit_persona_coverage.js';
import {
    REPO_ROOT,
    TOOLS_DIR,
    TSX_BIN,
    mkTmp,
    rmTmp,
    writePersona,
    writeSkillWithPersonas,
} from './_skill_tools.js';

function runTsx(module: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(TSX_BIN, [path.join(TOOLS_DIR, `${module}.ts`), ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

let tmp: string;
beforeEach(() => {
    tmp = mkTmp();
});
afterEach(() => {
    rmTmp(tmp);
});

function rowFor(rows: PersonaRow[], slug: string): PersonaRow {
    const r = rows.find((x) => x.persona === slug);
    if (!r) {
        throw new Error(`no row for ${slug}`);
    }
    return r;
}

describe('audit_persona_coverage — pure helpers (1:1 pytest port)', () => {
    it('frontmatter_value unquotes', () => {
        expect(_frontmatter_value('name: foo\n', 'name')).toBe('foo');
        expect(_frontmatter_value('name: "bar baz"\n', 'name')).toBe('bar baz');
        expect(_frontmatter_value('name: foo\n', 'missing')).toBeNull();
    });

    it('frontmatter_list collects indented items', () => {
        const block = 'personas:\n  - alpha\n  - beta\n  - gamma\nname: x\n';
        expect(_frontmatter_list(block, 'personas')).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('specialist under-cited threshold', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'qa', 'specialist');
        writeSkillWithPersonas(skills, 'a', ['qa']);
        writeSkillWithPersonas(skills, 'b', ['qa']); // 2 cites < 3
        const rows = audit(skills, personas);
        const qa = rowFor(rows, 'qa');
        expect(qa.status).toBe('under-cited');
        expect(qa.citations).toBe(2);
        expect(qa.threshold).toBe(3);
    });

    it('specialist meets threshold', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'qa', 'specialist');
        for (const s of ['a', 'b', 'c']) {
            writeSkillWithPersonas(skills, s, ['qa']);
        }
        const rows = audit(skills, personas);
        const qa = rowFor(rows, 'qa');
        expect(qa.status).toBe('ok');
        expect(qa.citations).toBe(3);
    });

    it('core threshold is higher', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'developer', 'core');
        for (const s of ['a', 'b', 'c', 'd']) {
            writeSkillWithPersonas(skills, s, ['developer']);
        }
        const rows = audit(skills, personas);
        const dev = rowFor(rows, 'developer');
        expect(dev.status).toBe('under-cited');
        expect(dev.threshold).toBe(5);
        expect(dev.citations).toBe(4);
    });

    it('core meets threshold', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'developer', 'core');
        for (const s of ['a', 'b', 'c', 'd', 'e']) {
            writeSkillWithPersonas(skills, s, ['developer']);
        }
        const rows = audit(skills, personas);
        expect(rowFor(rows, 'developer').status).toBe('ok');
    });

    it('orphan persona surfaced', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'qa', 'specialist');
        writeSkillWithPersonas(skills, 'a', ['typo-persona']);
        const rows = audit(skills, personas);
        const statuses = new Map(rows.map((r) => [r.persona, r.status]));
        expect(statuses.get('typo-persona')).toBe('orphan');
    });

    it('persona with zero citations is under-cited', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'lonely', 'specialist');
        fs.mkdirSync(skills, { recursive: true });
        const rows = audit(skills, personas);
        const lonely = rowFor(rows, 'lonely');
        expect(lonely.citations).toBe(0);
        expect(lonely.status).toBe('under-cited');
    });

    it('missing dirs safe', () => {
        const rows = audit(path.join(tmp, 'nope-s'), path.join(tmp, 'nope-p'));
        expect(rows).toEqual([]);
    });

    it('two under-cited eval target', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'alpha', 'specialist');
        writePersona(personas, 'beta', 'specialist');
        writePersona(personas, 'gamma', 'core');
        writeSkillWithPersonas(skills, 'x', ['gamma']);
        const rows = audit(skills, personas);
        const flagged = rows.filter((r) => r.status === 'under-cited');
        expect(flagged.length).toBeGreaterThanOrEqual(2);
    });
});

describe('audit_persona_coverage — CLI (tsx)', () => {
    function fixture(): { skills: string; personas: string } {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'developer', 'core');
        writePersona(personas, 'qa', 'specialist');
        writePersona(personas, 'lonely', 'specialist');
        writeSkillWithPersonas(skills, 'a', ['qa', 'developer']);
        writeSkillWithPersonas(skills, 'b', ['qa', 'typo-x']);
        writeSkillWithPersonas(skills, 'c', ['developer']);
        return { skills, personas };
    }

    it('human table lists every persona with tier + status and a flagged summary', () => {
        const { skills, personas } = fixture();
        const r = runTsx('audit_persona_coverage', [
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
        ]);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('persona');
        expect(r.stdout).toContain('developer');
        expect(r.stdout).toContain('under-cited');
        expect(r.stdout).toContain('orphan');
        expect(r.stdout).toContain('persona(s) flagged (under-cited or orphan).');
    });

    it('--json emits the full row set with tiers, thresholds, and statuses', () => {
        const { skills, personas } = fixture();
        const r = runTsx('audit_persona_coverage', [
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
            '--json',
        ]);
        expect(r.status, r.stderr).toBe(0);
        const rows = (JSON.parse(r.stdout) as { rows: PersonaRow[] }).rows;
        const by = new Map(rows.map((row) => [row.persona, row]));
        expect(by.get('developer')).toEqual({
            persona: 'developer',
            tier: 'core',
            citations: 2,
            threshold: 5,
            status: 'under-cited',
        });
        expect(by.get('qa')).toEqual({
            persona: 'qa',
            tier: 'specialist',
            citations: 2,
            threshold: 3,
            status: 'under-cited',
        });
        expect(by.get('lonely')!.citations).toBe(0);
        expect(by.get('lonely')!.status).toBe('under-cited');
        expect(by.get('typo-x')!.tier).toBe('unknown');
        expect(by.get('typo-x')!.status).toBe('orphan');
    });

    it('empty dirs print the no-personas notice and exit 0', () => {
        const r = runTsx('audit_persona_coverage', [
            '--skills-dir',
            path.join(tmp, 'nope-s'),
            '--personas-dir',
            path.join(tmp, 'nope-p'),
        ]);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout.trim()).toBe('(no personas found)');
    });
});
