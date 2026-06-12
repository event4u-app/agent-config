// Tests for src/scripts/inventory_abstraction_budget.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite existed, so this is a focused differential suite:
//   1. Unit checks of pure helpers (parse_frontmatter, CSV quoting via the
//      writer, grep_count over a temp tree).
//   2. Golden parity (python3 vs tsx) on the real repo.
//
// Two real-repo realities the contract makes us replicate-and-flag:
//
//   A. The Python original is LATENTLY BROKEN on the current src/-based layout:
//      `inventory_packs` does an UN-GUARDED `sorted(packs_dir.iterdir())`, so a
//      missing `packages/` directory raises FileNotFoundError → traceback →
//      exit 1. The TS twin reproduces the crash (uncaught readdir ENOENT →
//      exit 1). We assert both exit 1 and write nothing (no git drift); the
//      traceback prose is interpreter-specific so only exit code + empty
//      stdout are compared.
//
//   B. The happy path needs `packages/` to exist. We `mkdir` an EMPTY
//      `packages/` (git does not track empty dirs → zero drift), run both, and
//      compare the three written artefacts. `abstraction-budget-inventory.csv`
//      is byte-identical. `abstraction-budget-frontmatter.csv` differs ONLY in
//      the `dominant_value` column on all-distinct (`distinct == total`) tie
//      fields — Python's `Counter.most_common(1)` returns the first-SCANNED
//      value, and `Path.glob` scan order is `os.scandir` order which Node's
//      `fs.readdirSync` (sorted) cannot reproduce. This is an unreconcilable
//      cross-runtime FS-iteration divergence (see the wave report), so on tie
//      rows we compare every column EXCEPT `dominant_value`. The Markdown
//      report carries a `_Generated:` date line (normalised) and the same tie
//      caveat. The evidence files are snapshotted/restored. Skipped without
//      python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parse_frontmatter, write_csv, grep_count } from '../../src/scripts/inventory_abstraction_budget.js';
import { acquireGlobalStateLock } from './_global_state_lock.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'inventory_abstraction_budget.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'inventory_abstraction_budget.py');
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

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function runTs(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}
function runPy(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

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

const py3 = hasPython3();

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

describe.skipIf(!py3)('inventory_abstraction_budget — golden parity (python3 vs tsx)', () => {
    let snap: Record<string, string | null> = {};
    let madePackages = false;
    let release: (() => void) | null = null;
    beforeEach(() => {
        release = acquireGlobalStateLock();
        for (const f of [INV_MD, INV_CSV, FM_CSV]) {
            snap[f] = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : null;
        }
    });
    afterEach(() => {
        if (madePackages) {
            try {
                fs.rmdirSync(PACKAGES_DIR);
            } catch {
                // leave it if non-empty (should never be — we only mkdir empty)
            }
            madePackages = false;
        }
        for (const f of [INV_MD, INV_CSV, FM_CSV]) {
            const s = snap[f];
            if (s !== null && s !== undefined) {
                fs.writeFileSync(f, s, 'utf-8');
            } else if (fs.existsSync(f)) {
                fs.rmSync(f);
            }
        }
        snap = {};
        if (release) {
            release();
            release = null;
        }
    });

    it('real-repo (no packages/) → both crash exit 1, no file write', () => {
        const before = fs.readFileSync(INV_CSV, 'utf-8');
        const p = runPy(['--quiet']);
        const t = runTs(['--quiet']);
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
        // Neither writes anything on the crash path.
        expect(fs.readFileSync(INV_CSV, 'utf-8')).toBe(before);
        // stdout is empty on both (the crash happens before any success line).
        expect(t.stdout).toBe('');
        expect(p.stdout).toBe('');
    });

    it('happy path (empty packages/): inv.csv byte-identical; fm.csv + MD parity (tie-field caveat)', () => {
        // Empty packages/ flips Python past the iterdir() crash; git ignores
        // empty dirs so there is no drift to clean beyond the rmdir.
        fs.mkdirSync(PACKAGES_DIR, { recursive: true });
        madePackages = true;

        expect(runPy(['--quiet']).status).toBe(0);
        const pyInv = fs.readFileSync(INV_CSV, 'utf-8');
        const pyFm = fs.readFileSync(FM_CSV, 'utf-8');
        const pyMd = fs.readFileSync(INV_MD, 'utf-8');

        expect(runTs(['--quiet']).status).toBe(0);
        const tsInv = fs.readFileSync(INV_CSV, 'utf-8');
        const tsFm = fs.readFileSync(FM_CSV, 'utf-8');
        const tsMd = fs.readFileSync(INV_MD, 'utf-8');

        // inventory.csv is fully deterministic → byte-identical.
        expect(tsInv).toBe(pyInv);

        // frontmatter.csv: header columns
        //   class,field,total,distinct,dominant_value,dominant_share,bloat_candidate
        // Compare every column except dominant_value on all-distinct tie rows.
        const pRows = parseCsv(pyFm);
        const tRows = parseCsv(tsFm);
        expect(tRows.length).toBe(pRows.length);
        for (let i = 0; i < pRows.length; i++) {
            const pr = pRows[i] as string[];
            const tr = tRows[i] as string[];
            const total = pr[2];
            const distinct = pr[3];
            const tieField = i > 0 && total === distinct; // all values distinct → 30-way tie
            for (let c = 0; c < pr.length; c++) {
                if (c === 4 && tieField) {
                    // dominant_value on a tie row — non-deterministic across runtimes.
                    continue;
                }
                expect(tr[c], `fm row ${i} col ${c}`).toBe(pr[c]);
            }
        }

        // Markdown: normalise the _Generated: date line, then compare with the
        // same tie-field caveat by stripping `dominant_value` backtick cells on
        // rows whose Total == Distinct in the frontmatter-audit table is hard to
        // isolate line-wise; instead assert the inventory table + summary match
        // and the only differences are within frontmatter `dominant_value` cells.
        const normDate = (s: string): string => s.replace(/^_Generated:.*/m, '_Generated: X_');
        const pyLines = normDate(pyMd).split('\n');
        const tsLines = normDate(tsMd).split('\n');
        expect(tsLines.length).toBe(pyLines.length);
        for (let i = 0; i < pyLines.length; i++) {
            const pl = pyLines[i] as string;
            const tl = tsLines[i] as string;
            if (pl === tl) {
                continue;
            }
            // The only permitted divergence is a frontmatter-audit table row
            // (starts "| persona |" / "| skill |" etc. and contains a Share %)
            // where the dominant_value backtick cell differs. Such a row has 8
            // pipe-delimited cells: | class | field | total | distinct | value | share | bloat |
            const pc = pl.split('|');
            const tc = tl.split('|');
            expect(pc.length).toBe(tc.length);
            // Same shape; the differing cell must be the dominant_value (index 5
            // when split on '|': ['', ' class ', ' field ', ' total ', ' distinct ',
            // ' `value` ', ' share ', ' bloat ', '']).
            let diffCells = 0;
            for (let c = 0; c < pc.length; c++) {
                if ((pc[c] as string) !== (tc[c] as string)) {
                    diffCells++;
                    expect(c, `MD line ${i} unexpected differing cell`).toBe(5);
                }
            }
            expect(diffCells).toBeGreaterThan(0);
        }
    });
});
