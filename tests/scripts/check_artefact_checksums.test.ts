// Tests for src/scripts/check_artefact_checksums.ts (py2ts Phase 4 / Wave 4c).
//
// The only pytest suite touching this area (tests/test_build_discovery_manifest.py)
// tests the BUILDER, not this gate. So this is a focused differential suite over
// the ported checksum primitive (_artefact_checksum on synthetic artefacts) plus
// a golden-parity layer that runs python3 vs tsx on the REAL REPO against the
// committed manifest (skipIf python3 / manifest unavailable).
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as cac from '../../src/scripts/check_artefact_checksums.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_artefact_checksums.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_artefact_checksums.py');
const COMMITTED = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

describe('check_artefact_checksums — checksum primitive spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cac-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('no frontmatter → hashes the rstripped body + trailing newline', () => {
        const p = path.join(tmp, 'a.md');
        write(p, 'line one   \nline two\t\n\n');
        // Mirror the Python normalization: rstrip each line, rstrip the whole,
        // append a single "\n".
        const body = 'line one\nline two\n\n'
            .split('\n')
            .map((l) => l.replace(/\s+$/, ''))
            .join('\n')
            .replace(/\s+$/, '') + '\n';
        const expected =
            'sha256:' + crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');
        expect(cac._artefact_checksum(p, null)).toBe(expected);
    });

    it('with frontmatter → hashes compact-sorted-JSON fm + "\\n" + normalized body', () => {
        const p = path.join(tmp, 'b.md');
        write(p, '---\nb: 2\na: 1\n---\nbody line  \n');
        const fm = { a: 1, b: 2 };
        // json.dumps(fm, sort_keys=True, ensure_ascii=False, separators=(",",":"))
        const fmJson = '{"a":1,"b":2}';
        const body = 'body line\n';
        const raw = Buffer.from(fmJson + '\n' + body, 'utf-8');
        const expected = 'sha256:' + crypto.createHash('sha256').update(raw).digest('hex');
        expect(cac._artefact_checksum(p, fm)).toBe(expected);
    });

    it('_CATEGORY_SCHEMA maps the three schema-bearing categories', () => {
        expect(cac._CATEGORY_SCHEMA).toEqual({ skill: 'skill', rule: 'rule', command: 'command' });
    });

    it('_check reports a missing-manifest error and exit 1', () => {
        const [code, errs] = cac._check(path.join(tmp, 'nope.json'));
        expect(code).toBe(1);
        expect(errs[0]).toContain('manifest not found at');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();
const runnable = py3 && fs.existsSync(COMMITTED);

const big = { maxBuffer: 256 * 1024 * 1024, cwd: REPO_ROOT, encoding: 'utf8' as const };

describe.skipIf(!runnable)('check_artefact_checksums — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--quiet']] as const) {
        it(`matches byte-for-byte against the committed manifest: ${
            args.join(' ') || '(no args)'
        }`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], big);
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
