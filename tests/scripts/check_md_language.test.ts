// Tests for src/scripts/check_md_language.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (scan_file: umlauts, DE words, fences, anchors, inline
// code, ignore marker) plus a golden-parity layer (python3 vs tsx) over the
// real `docs/**` CI invocation (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scan_file } from '../../src/scripts/check_md_language.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_md_language.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_md_language.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_md_language — scan_file', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdl-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });
    const write = (body: string): string => {
        const p = path.join(tmp, 'doc.md');
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    };

    it('flags an umlaut in prose', () => {
        const v = scan_file(write('This is über important.\n'));
        expect(v).toHaveLength(1);
        expect(v[0]!.kind).toBe('umlaut');
        expect(v[0]!.match).toBe('ü');
        expect(v[0]!.line).toBe(1);
    });

    it('flags a German function word', () => {
        const v = scan_file(write('Dies ist nicht englisch.\n'));
        const kinds = v.map((x) => x.kind);
        expect(kinds).toContain('de_word'); // "nicht"
    });

    it('skips fenced code blocks', () => {
        expect(scan_file(write('```\nfür nicht\n```\n'))).toEqual([]);
    });

    it('skips inline code spans', () => {
        expect(scan_file(write('Run `für nicht` literally.\n'))).toEqual([]);
    });

    it('skips DE:/EN: anchor lines', () => {
        expect(scan_file(write('DE: für nicht dass\n'))).toEqual([]);
    });

    it('skips lines with the ignore marker', () => {
        expect(scan_file(write('für nicht <!-- md-language-check: ignore -->\n'))).toEqual([]);
    });

    it('skips YAML frontmatter', () => {
        expect(scan_file(write('---\ntitle: für\n---\nEnglish body.\n'))).toEqual([]);
    });

    it('clean English passes', () => {
        expect(scan_file(write('A perfectly normal English sentence.\n'))).toEqual([]);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_md_language — golden parity (python3 vs tsx)', () => {
    function docArgs(): string[] {
        const out: string[] = [];
        const walk = (dir: string): void => {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) walk(full);
                else if (
                    ent.name.endsWith('.md') &&
                    ent.name !== 'catalog.md' &&
                    ent.name !== 'skills-catalog.md'
                ) {
                    out.push(path.relative(REPO_ROOT, full));
                }
            }
        };
        walk(path.join(REPO_ROOT, 'docs'));
        out.sort();
        return out;
    }

    it('matches the real docs/** CI scan byte-for-byte', () => {
        const args = docArgs();
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
