// Tests for src/scripts/lint_namespace.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_namespace.py exists. This is a focused differential
// suite over the linter's public helpers (_shape_errors, _name_for,
// _skill_name_field, check_single) plus a golden-parity layer running
// python3 vs tsx on the REAL REPO (skipped without python3). Byte-identical
// stdout/stderr/exit is the contract.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as ln from '../../src/scripts/lint_namespace.js';



describe('lint_namespace._shape_errors', () => {
    it('accepts a valid kebab-case command name', () => {
        expect(ln._shape_errors('foo-bar')).toEqual([]);
    });
    it('flags an underscore via the regex rule', () => {
        expect(ln._shape_errors('bad_name')).toEqual([
            'regex — must match ^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
        ]);
    });
    it('flags a too-short command name (floor 2) — single letter is regex-valid', () => {
        expect(ln._shape_errors('a')).toEqual(['length — 1 chars (must be 2–64)']);
    });
    it('uses the skill floor of 3', () => {
        expect(ln._shape_errors('ab', false, 'skill')).toEqual([
            'length — 2 chars (must be 3–64)',
        ]);
        expect(ln._shape_errors('abc', false, 'skill')).toEqual([]);
    });
    it('flags a reserved name unless sub_verb', () => {
        expect(ln._shape_errors('index')).toEqual([
            "reserved — 'index' in reserved-names list",
        ]);
        expect(ln._shape_errors('index', true)).toEqual([]);
    });
});

describe('lint_namespace._name_for', () => {
    it('depth 0 → file stem', () => {
        expect(ln._name_for('foo-bar.md', 0)).toBe('foo-bar');
    });
    it('depth 1 → first dir', () => {
        expect(ln._name_for('foo-bar/SKILL.md', 1)).toBe('foo-bar');
    });
});

/** Run a fn capturing stdout + stderr; returns [stdout, stderr]. */
function capture(fn: () => void): [string, string] {
    let out = '';
    let err = '';
    const spyOut = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => {
        out += String(c);
        return true;
    });
    const spyErr = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => {
        err += String(c);
        return true;
    });
    try {
        fn();
        return [out, err];
    } finally {
        spyOut.mockRestore();
        spyErr.mockRestore();
    }
}

describe('lint_namespace.check_single', () => {
    it('returns 0 and prints on a valid name', () => {
        let code = -1;
        const [out] = capture(() => {
            code = ln.check_single('foo-bar');
        });
        expect(code).toBe(0);
        expect(out).toBe("✅ 'foo-bar' is a valid artefact name\n");
    });
    it('returns 1 and prints findings on an invalid name', () => {
        let code = -1;
        const [, err] = capture(() => {
            code = ln.check_single('Bad_Name');
        });
        expect(code).toBe(1);
        expect(err).toContain("❌ 'Bad_Name': regex");
    });
});

describe('lint_namespace._skill_name_field', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ln-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });
    it('reads the name: key from frontmatter', () => {
        const p = path.join(tmp, 'SKILL.md');
        fs.writeFileSync(p, '---\nname: my-skill\ndescription: x\n---\nbody\n');
        expect(ln._skill_name_field(p)).toBe('my-skill');
    });
    it('returns null when there is no frontmatter', () => {
        const p = path.join(tmp, 'SKILL.md');
        fs.writeFileSync(p, 'no frontmatter\n');
        expect(ln._skill_name_field(p)).toBeNull();
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

