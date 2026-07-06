// Tests for src/scripts/skill_tools/audit_user_type_coverage.ts (py2ts Phase 8
// / Wave 8h). 1:1 port of the retired pytest suite plus a CLI intent layer
// (tsx only — the Python original is deleted) over temp fixtures.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    audit,
    type UserTypeRow,
} from '../../src/scripts/skill_tools/audit_user_type_coverage.js';
import {
    REPO_ROOT,
    TOOLS_DIR,
    TSX_BIN,
    mkTmp,
    rmTmp,
    writeDoc,
    writeUserType,
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

function rowFor(rows: UserTypeRow[], slug: string): UserTypeRow {
    const r = rows.find((x) => x.user_type === slug);
    if (!r) {
        throw new Error(`no row for ${slug}`);
    }
    return r;
}

describe('audit_user_type_coverage — audit() (1:1 pytest port)', () => {
    it('user-type with zero references is never-referenced', () => {
        const userTypes = path.join(tmp, 'ut');
        const search = path.join(tmp, 'src');
        fs.mkdirSync(search, { recursive: true });
        writeUserType(userTypes, 'lonely');
        const rows = audit(userTypes, search);
        const lonely = rowFor(rows, 'lonely');
        expect(lonely.references).toBe(0);
        expect(lonely.status).toBe('never-referenced');
    });

    it('user-type with one reference is ok', () => {
        const userTypes = path.join(tmp, 'ut');
        const search = path.join(tmp, 'src');
        writeUserType(userTypes, 'field-crew');
        writeDoc(
            search,
            'commands/refine-ticket.md',
            'Use `--user-type=field-crew` to load the field-crew lens.\n',
        );
        const rows = audit(userTypes, search);
        const fc = rowFor(rows, 'field-crew');
        expect(fc.references).toBe(1);
        expect(fc.status).toBe('ok');
    });

    it('orphan reference to missing user-type', () => {
        const userTypes = path.join(tmp, 'ut');
        const search = path.join(tmp, 'src');
        fs.mkdirSync(userTypes, { recursive: true });
        writeDoc(
            search,
            'commands/refine-ticket.md',
            'Example: `--user-type=typo-name` (this id does not exist).\n',
        );
        const rows = audit(userTypes, search);
        const typo = rowFor(rows, 'typo-name');
        expect(typo.status).toBe('orphan');
        expect(typo.references).toBe(1);
    });

    it('references inside user-types dir are excluded', () => {
        const userTypes = path.join(tmp, 'ut');
        writeUserType(userTypes, 'field-crew');
        writeDoc(userTypes, 'README.md', 'Example: `--user-type=field-crew`\n');
        const rows = audit(userTypes, userTypes); // search root == user-types dir
        const fc = rowFor(rows, 'field-crew');
        expect(fc.references).toBe(0);
        expect(fc.status).toBe('never-referenced');
    });

    it('multiple references counted', () => {
        const userTypes = path.join(tmp, 'ut');
        const search = path.join(tmp, 'src');
        writeUserType(userTypes, 'field-crew');
        writeDoc(search, 'a.md', '`--user-type=field-crew`\n');
        writeDoc(search, 'b.md', '`--user-type=field-crew` and `--user-type=field-crew`\n');
        const rows = audit(userTypes, search);
        const fc = rowFor(rows, 'field-crew');
        expect(fc.references).toBe(3);
        expect(fc.status).toBe('ok');
    });

    it('template subdir is skipped', () => {
        const userTypes = path.join(tmp, 'ut');
        fs.mkdirSync(path.join(userTypes, '_template'), { recursive: true });
        fs.writeFileSync(
            path.join(userTypes, '_template', 'user-type.md'),
            '---\nid: TEMPLATE\nkind: user-type\n---\n',
            'utf-8',
        );
        const rows = audit(userTypes, path.join(tmp, 'src'));
        const slugs = new Set(rows.map((r) => r.user_type));
        expect(slugs.has('TEMPLATE')).toBe(false);
    });

    it('missing dirs safe', () => {
        const rows = audit(path.join(tmp, 'nope-ut'), path.join(tmp, 'nope-src'));
        expect(rows).toEqual([]);
    });
});

describe('audit_user_type_coverage — CLI (tsx)', () => {
    function fixture(): { ut: string; src: string } {
        const ut = path.join(tmp, 'ut');
        const src = path.join(tmp, 'src');
        writeUserType(ut, 'field-crew');
        writeUserType(ut, 'lonely');
        writeDoc(src, 'commands/a.md', '`--user-type=field-crew` and `--user-type=typo-x`\n');
        writeDoc(src, 'docs/b.md', '`--user-type=field-crew`\n');
        return { ut, src };
    }

    it('human table lists refs + statuses and a flagged summary', () => {
        const { ut, src } = fixture();
        const r = runTsx('audit_user_type_coverage', [
            '--user-types-dir',
            ut,
            '--search-root',
            src,
        ]);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('user-type');
        expect(r.stdout).toContain('field-crew');
        expect(r.stdout).toContain('never-referenced');
        expect(r.stdout).toContain('orphan');
        expect(r.stdout).toContain('user-type(s) flagged (never-referenced or orphan).');
    });

    it('--json emits the full row set with reference counts', () => {
        const { ut, src } = fixture();
        const r = runTsx('audit_user_type_coverage', [
            '--user-types-dir',
            ut,
            '--search-root',
            src,
            '--json',
        ]);
        expect(r.status, r.stderr).toBe(0);
        const rows = (JSON.parse(r.stdout) as { rows: UserTypeRow[] }).rows;
        const by = new Map(rows.map((row) => [row.user_type, row]));
        expect(by.get('field-crew')).toEqual({
            user_type: 'field-crew',
            references: 2,
            threshold: 1,
            status: 'ok',
        });
        expect(by.get('lonely')!.references).toBe(0);
        expect(by.get('lonely')!.status).toBe('never-referenced');
        expect(by.get('typo-x')!.references).toBe(1);
        expect(by.get('typo-x')!.status).toBe('orphan');
    });

    it('search root == user-types dir excludes own refs', () => {
        const ut = path.join(tmp, 'ut');
        writeUserType(ut, 'field-crew');
        writeDoc(ut, 'README.md', 'Example: `--user-type=field-crew`\n');
        const r = runTsx('audit_user_type_coverage', [
            '--user-types-dir',
            ut,
            '--search-root',
            ut,
            '--json',
        ]);
        expect(r.status, r.stderr).toBe(0);
        const rows = (JSON.parse(r.stdout) as { rows: UserTypeRow[] }).rows;
        const fc = rows.find((row) => row.user_type === 'field-crew');
        expect(fc!.references).toBe(0);
        expect(fc!.status).toBe('never-referenced');
    });
});
