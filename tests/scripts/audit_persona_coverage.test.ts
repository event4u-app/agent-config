// Tests for src/scripts/skill_tools/audit_persona_coverage.ts (py2ts Phase 8 /
// Wave 8h). 1:1 port of tests/test_audit_persona_coverage.py plus a golden
// parity layer (python3 vs tsx) over temp fixtures.
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
    hasPython3,
    mkTmp,
    rmTmp,
    runBoth,
    writePersona,
    writeSkillWithPersonas,
} from './_skill_tools.js';

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

describe.runIf(hasPython3())('audit_persona_coverage — golden parity (python3 vs tsx)', () => {
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

    it('human table is byte-identical', () => {
        const { skills, personas } = fixture();
        const { py, ts } = runBoth('audit_persona_coverage', [
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--json is byte-identical', () => {
        const { skills, personas } = fixture();
        const { py, ts } = runBoth('audit_persona_coverage', [
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
            '--json',
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('empty dirs are byte-identical', () => {
        const { py, ts } = runBoth('audit_persona_coverage', [
            '--skills-dir',
            path.join(tmp, 'nope-s'),
            '--personas-dir',
            path.join(tmp, 'nope-p'),
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });
});
