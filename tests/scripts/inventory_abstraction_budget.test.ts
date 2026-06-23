
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parse_frontmatter, write_csv, grep_count } from '../../src/scripts/inventory_abstraction_budget.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'inventory_abstraction_budget.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const EVIDENCE_DIR = path.join(REPO_ROOT, 'agents', 'evidence', 'analysis');
const INV_MD = path.join(EVIDENCE_DIR, 'abstraction-budget-inventory.md');
const INV_CSV = path.join(EVIDENCE_DIR, 'abstraction-budget-inventory.csv');
const FM_CSV = path.join(EVIDENCE_DIR, 'abstraction-budget-frontmatter.csv');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

describe('inventory_abstraction_budget — unit helpers', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('parse_frontmatter flattens nested keys with dotted paths', () => {
        const p = path.join(tmp, 'x.md');
        fs.writeFileSync(p, '---\ntype: auto\ntrust:\n  level: core\n---\nbody\n', 'utf-8');
        const fm = parse_frontmatter(p);
        expect(fm['type']).toBe('auto');
        expect(fm['trust.level']).toBe('core');
    });
    it('parse_frontmatter returns empty when no frontmatter', () => {
        const p = path.join(tmp, 'x.md');
        fs.writeFileSync(p, 'no frontmatter\n', 'utf-8');
        expect(parse_frontmatter(p)).toEqual({});
    });

    it('write_csv uses CRLF terminators and QUOTE_MINIMAL', () => {
        const p = path.join(tmp, 'out.csv');
        write_csv(p, ['a', 'b'], [['plain', 'has,comma'], ['has"quote', 'line\nbreak']]);
        const raw = fs.readFileSync(p, 'utf-8');
        // Each row ends with \r\n; comma/quote/newline fields are quoted.
        expect(raw).toBe('a,b\r\nplain,"has,comma"\r\n"has""quote","line\nbreak"\r\n');
    });

    it('grep_count counts substrings deterministically (python-walk fallback)', () => {
        // No `rg` binary in this environment, so grep_count uses the python-walk
        // fallback over the whole repo. A token that exists in the source returns
        // a positive count; a synthetic token (assembled at runtime so the literal
        // never appears in any source file, including this test) returns 0.
        const present = grep_count('inventory_abstraction_budget');
        expect(present).toBeGreaterThan(0);
        const absent = grep_count(['zqx', 'never', 'present', '7913'].join('-'));
        expect(absent).toBe(0);
    });
});

/** Parse a CSV produced by the writer (CRLF rows, minimal quoting). */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let i = 0;
    const n = text.length;
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    while (i < n) {
        const ch = text[i] as string;
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            field += ch;
            i++;
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            i++;
        } else if (ch === ',') {
            row.push(field);
            field = '';
            i++;
        } else if (ch === '\r' && text[i + 1] === '\n') {
            row.push(field);
            rows.push(row);
            field = '';
            row = [];
            i += 2;
        } else {
            field += ch;
            i++;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}
