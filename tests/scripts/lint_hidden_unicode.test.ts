// Tests for src/scripts/lint_hidden_unicode.ts (py2ts Phase 1 — VERIFY).
//
// No pytest suite exists. Golden-parity layer runs python3 vs tsx and asserts
// byte-identical stdout/stderr/exit. Two parity surfaces:
//   1. the REAL repo `src/` tree (clean exit-0 path; default + --json),
//   2. a self-contained fixture repo carrying its own _lib + linter so the
//      linter's `ROOT = parents[3]` resolves to the fixture (crafted-hit
//      exit-1 path; default + --json + --fix).
//
// Smuggling codepoints are embedded via escape sequences (String.fromCodePoint)
// so this test file itself stays clean of the very tokens the linter flags.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as lhu from '../../src/scripts/lint_hidden_unicode.js';
import * as sl from '../../src/scripts/_lib/security_lint.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_hidden_unicode.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_hidden_unicode.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

// Invisible codepoints via escape — keeps this file clean of literal smuggles.
const ZW = String.fromCodePoint(0x200b); // ZERO WIDTH SPACE
const RLO = String.fromCodePoint(0x202e); // RIGHT-TO-LEFT OVERRIDE
const TAG_A = String.fromCodePoint(0xe0041); // TAG LATIN CAPITAL LETTER A
const CTRL = String.fromCodePoint(0x01); // control-char (unnamed)
const PUA = String.fromCodePoint(0xe000); // PUA (unnamed)
const VS = [0xe0100, 0xe0101, 0xe0102].map((c) => String.fromCodePoint(c)).join('');

// --- Unit spec over exported pure helpers -----------------------------------

describe('lint_hidden_unicode — _classify', () => {
    it('classifies the codepoint families', () => {
        expect(lhu._classify(0x202e)).toBe('bidi-control');
        expect(lhu._classify(0x200b)).toBe('zero-width');
        expect(lhu._classify(0xe0041)).toBe('unicode-tag');
        expect(lhu._classify(0x206a)).toBe('deprecated-format');
        expect(lhu._classify(0xe000)).toBe('private-use-area');
        expect(lhu._classify(0x01)).toBe('control-char');
        expect(lhu._classify(0x7f)).toBe('control-char');
    });
    it('returns null for ordinary text and the tab/newline/CR carve-outs', () => {
        expect(lhu._classify('a'.codePointAt(0)!)).toBeNull();
        expect(lhu._classify(0x09)).toBeNull();
        expect(lhu._classify(0x0a)).toBeNull();
        expect(lhu._classify(0x0d)).toBeNull();
    });
});

describe('lint_hidden_unicode — _scan over a built ScannedFile', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    });
    function scanText(body: string): sl.Finding[] {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hu-unit-'));
        const p = path.join(tmp, 'f.md');
        fs.writeFileSync(p, body, 'utf-8');
        return lhu._scan(sl.scan_file(p));
    }

    it('reports a bidi control with the exact CPython name + codepoint', () => {
        const hits = scanText(`clean\nbad${RLO}mid\n`);
        expect(hits).toHaveLength(1);
        expect(hits[0]!.line).toBe(2);
        expect(hits[0]!.severity).toBe('HIGH');
        expect(hits[0]!.message).toBe('bidi-control U+202E (RIGHT-TO-LEFT OVERRIDE)');
        expect(hits[0]!.is_fail).toBe(true);
    });

    it('names a Tag-block char, falls back to <unnamed> for control/PUA', () => {
        const hits = scanText(`a${TAG_A}b\nc${CTRL}d\ne${PUA}f\n`);
        expect(hits.map((h) => h.message)).toEqual([
            'unicode-tag U+E0041 (TAG LATIN CAPITAL LETTER A)',
            'control-char U+0001 (<unnamed>)',
            'private-use-area U+E000 (<unnamed>)',
        ]);
    });

    it('flags a variation-selector run of >=3 once per line', () => {
        const hits = scanText(`vs${VS} tail\n`);
        expect(hits).toHaveLength(1);
        expect(hits[0]!.message).toBe('variation-selector run x3 (steganography signature)');
    });

    it('respects the security-lint allow pragma (whole file exempt)', () => {
        const hits = scanText(
            `<!-- security-lint: allow hidden-unicode "teaching" -->\nbad${ZW}here\n`,
        );
        expect(hits).toHaveLength(0);
    });

    it('skips a ```security-example fence but not ordinary text', () => {
        const hits = scanText('```security-example\n' + `bad${ZW}here\n` + '```\n' + `live${ZW}x\n`);
        expect(hits).toHaveLength(1);
        expect(hits[0]!.line).toBe(4);
    });
});

// --- Golden parity on the REAL repo -----------------------------------------

describe.skipIf(!py3)('lint_hidden_unicode — golden parity on real src/ (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    it('matches the default (clean exit-0) run byte-for-byte', () => {
        const pe = runPy([]);
        const te = runTs([]);
        expect(te.stdout).toBe(pe.stdout);
        expect(te.stderr).toBe(pe.stderr);
        expect(te.status).toBe(pe.status);
    });
    it('matches the --json (clean) run byte-for-byte', () => {
        const pe = runPy(['--json']);
        const te = runTs(['--json']);
        expect(te.stdout).toBe(pe.stdout);
        expect(te.status).toBe(pe.status);
    });
});

// --- Golden parity on a self-contained crafted-hit fixture repo -------------

describe.skipIf(!py3)('lint_hidden_unicode — golden parity on crafted hits (fixture repo)', () => {
    let fixRoot: string;
    afterEach(() => {
        if (fixRoot) fs.rmSync(fixRoot, { recursive: true, force: true });
    });

    /** Build a repo whose `parents[3]` is the fixture root so ROOT resolves there. */
    function buildFixture(files: Record<string, string>): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hu-fix-'));
        const libDst = path.join(root, 'src', 'scripts', '_lib');
        fs.mkdirSync(libDst, { recursive: true });
        const libSrc = path.join(REPO_ROOT, 'src', 'scripts', '_lib');
        fs.copyFileSync(path.join(libSrc, 'security_lint.py'), path.join(libDst, 'security_lint.py'));
        fs.copyFileSync(path.join(libSrc, 'security_lint.ts'), path.join(libDst, 'security_lint.ts'));
        const initPy = path.join(libSrc, '__init__.py');
        if (fs.existsSync(initPy)) fs.copyFileSync(initPy, path.join(libDst, '__init__.py'));
        const scrDst = path.join(root, 'src', 'scripts');
        fs.copyFileSync(PY_SCRIPT, path.join(scrDst, 'lint_hidden_unicode.py'));
        fs.copyFileSync(TS_SCRIPT, path.join(scrDst, 'lint_hidden_unicode.ts'));
        for (const [rel, body] of Object.entries(files)) {
            const fp = path.join(root, rel);
            fs.mkdirSync(path.dirname(fp), { recursive: true });
            fs.writeFileSync(fp, body, 'utf-8');
        }
        return root;
    }
    function runPyFix(args: readonly string[]) {
        return spawnSync('python3', ['src/scripts/lint_hidden_unicode.py', ...args], {
            cwd: fixRoot,
            encoding: 'utf8',
        });
    }
    function runTsFix(args: readonly string[]) {
        return spawnSync(TSX_BIN, ['src/scripts/lint_hidden_unicode.ts', ...args], {
            cwd: fixRoot,
            encoding: 'utf8',
        });
    }

    const HIT_FILES = {
        'src/skills/multi.md':
            `zw${ZW}here\n` +
            `tag${TAG_A}x\n` +
            `ctrl${CTRL}end\n` +
            `pua${PUA}z\n` +
            `vs${VS} end\n`,
        'src/skills/ok.md': 'totally clean prose\n',
        'src/skills/allowed.md':
            `<!-- security-lint: allow hidden-unicode "teaching" -->\nbad${ZW}here\n`,
        'src/skills/fenced.md': '```security-example\n' + `bad${ZW}here\n` + '```\nclean\n',
        // example-path → weight 0.25 (downgraded to WARN, still printed)
        'src/agent-src/docs/ex.md': `zw${ZW}here\n`,
    };

    it('matches the default crafted-hit run byte-for-byte (exit 1)', () => {
        fixRoot = buildFixture(HIT_FILES);
        const pe = runPyFix([]);
        const te = runTsFix([]);
        expect(te.stdout).toBe(pe.stdout);
        expect(te.stderr).toBe(pe.stderr);
        expect(te.status).toBe(pe.status);
        expect(pe.status).toBe(1);
    });

    it('matches the --json crafted-hit run byte-for-byte (float weight rendering)', () => {
        fixRoot = buildFixture(HIT_FILES);
        const pe = runPyFix(['--json']);
        const te = runTsFix(['--json']);
        expect(te.stdout).toBe(pe.stdout);
        expect(te.status).toBe(pe.status);
        // weight floats render as 1.0 / 0.25, never bare 1.
        expect(pe.stdout).toContain('"weight": 1.0');
        expect(pe.stdout).toContain('"weight": 0.25');
    });

    it('matches --fix: stdout AND the byte-identical sanitized siblings', () => {
        fixRoot = buildFixture({
            'src/skills/h.md': `bad${ZW}zw and ctrl${CTRL} here\n`,
        });
        // run python --fix in its own copy, tsx --fix in a fresh copy, compare both
        const pe = runPyFix(['--fix']);
        const pySan = fs.readFileSync(path.join(fixRoot, 'src/skills/h.md.sanitized'));
        fs.rmSync(path.join(fixRoot, 'src/skills/h.md.sanitized'));
        const te = runTsFix(['--fix']);
        const tsSan = fs.readFileSync(path.join(fixRoot, 'src/skills/h.md.sanitized'));
        expect(te.stdout).toBe(pe.stdout);
        expect(te.status).toBe(pe.status);
        expect(tsSan.equals(pySan)).toBe(true);
    });
});
