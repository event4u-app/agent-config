// Tests for src/scripts/skill_tools/audit_user_type_coverage.ts (py2ts Phase 8
// / Wave 8h). 1:1 port of tests/test_audit_user_type_coverage.py plus a golden
// parity layer (python3 vs tsx) over temp fixtures.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    audit,
    type UserTypeRow,
} from '../../src/scripts/skill_tools/audit_user_type_coverage.js';
import {
    hasPython3,
    mkTmp,
    rmTmp,
    runBoth,
    writeDoc,
    writeUserType,
} from './_skill_tools.js';

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

describe.runIf(hasPython3())('audit_user_type_coverage — golden parity (python3 vs tsx)', () => {
    function fixture(): { ut: string; src: string } {
        const ut = path.join(tmp, 'ut');
        const src = path.join(tmp, 'src');
        writeUserType(ut, 'field-crew');
        writeUserType(ut, 'lonely');
        writeDoc(src, 'commands/a.md', '`--user-type=field-crew` and `--user-type=typo-x`\n');
        writeDoc(src, 'docs/b.md', '`--user-type=field-crew`\n');
        return { ut, src };
    }

    it('human table is byte-identical', () => {
        const { ut, src } = fixture();
        const { py, ts } = runBoth('audit_user_type_coverage', [
            '--user-types-dir',
            ut,
            '--search-root',
            src,
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--json is byte-identical', () => {
        const { ut, src } = fixture();
        const { py, ts } = runBoth('audit_user_type_coverage', [
            '--user-types-dir',
            ut,
            '--search-root',
            src,
            '--json',
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('search root == user-types dir excludes own refs (byte-identical)', () => {
        const ut = path.join(tmp, 'ut');
        writeUserType(ut, 'field-crew');
        writeDoc(ut, 'README.md', 'Example: `--user-type=field-crew`\n');
        const { py, ts } = runBoth('audit_user_type_coverage', [
            '--user-types-dir',
            ut,
            '--search-root',
            ut,
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });
});
