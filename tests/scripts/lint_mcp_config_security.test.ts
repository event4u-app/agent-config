// Tests for src/scripts/lint_mcp_config_security.ts (py2ts Phase 1 — VERIFY).
//
// No pytest suite exists. Golden-parity layer runs python3 vs tsx and asserts
// byte-identical stdout/stderr/exit. Two parity surfaces:
//   1. the REAL repo `src/` tree (clean exit-0 path; default + --json),
//   2. a self-contained fixture repo carrying its own _lib + linter so the
//      linter's `ROOT = parents[3]` resolves to the fixture (crafted-hit
//      exit-1 path; default + --json).
//
// Crafted attack tokens are assembled from fragments so this test file itself
// is not flagged when the linter scans the real src/ tree.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as sl from '../../src/scripts/_lib/security_lint.js';
import * as mcp from '../../src/scripts/lint_mcp_config_security.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_mcp_config_security.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_mcp_config_security.py');
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

// Assembled from fragments — a fake-but-shaped OpenAI key that satisfies
// sk-proj-[A-Za-z0-9_-]{20,} without being a live credential.
const FAKE_SECRET = 'sk-' + 'proj-' + 'A'.repeat(24);
const NPX = '"' + 'command' + '"';
const YES = '"' + '-y' + '"';

// --- Unit spec over exported _scan ------------------------------------------

describe('lint_mcp_config_security — _scan over a built ScannedFile', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    });
    function scanFile(name: string, body: string): sl.Finding[] {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-unit-'));
        const p = path.join(tmp, name);
        fs.writeFileSync(p, body, 'utf-8');
        return mcp._scan(sl.scan_file(p));
    }

    it('flags an inline secret value in a named .mcp.json as HIGH', () => {
        const hits = scanFile('.mcp.json', `{ "key": "${FAKE_SECRET}" }\n`);
        expect(hits.map((h) => h.severity)).toContain('HIGH');
        expect(hits.some((h) => h.message.includes('inline secret value'))).toBe(true);
    });

    it('flags 0.0.0.0 bind and autoApprove as MED', () => {
        const hits = scanFile(
            'mcp.json',
            '{\n  "host": "0.0.0.0",\n  "autoApprove": true\n}\n',
        );
        const med = hits.filter((h) => h.severity === 'MED').map((h) => h.message);
        expect(med).toContain('0.0.0.0 bind (exposed beyond localhost)');
        expect(med).toContain('auto-approve / auto-enable bypasses consent');
        expect(hits.every((h) => !h.is_fail)).toBe(true);
    });

    it('flags npx -y auto-install at the command line as MED', () => {
        const hits = scanFile(
            'mcp.json',
            `{\n  ${NPX}: "npx",\n  "args": [${YES}]\n}\n`,
        );
        expect(hits.map((h) => h.message)).toContain(
            'npx/uvx -y auto-install (supply-chain risk; pin + pre-install)',
        );
    });

    it('scans a fenced ```json block in a .md that mentions mcpServers', () => {
        const body = '```json\n{ "mcpServers": { "x": "0.0.0.0" } }\n```\n';
        const hits = scanFile('doc.md', body);
        expect(hits.map((h) => h.message)).toContain('0.0.0.0 bind (exposed beyond localhost)');
    });

    it('ignores a fenced block that does not mention mcpServers / command', () => {
        const hits = scanFile('doc.md', '```json\n{ "host": "0.0.0.0" }\n```\n');
        expect(hits).toHaveLength(0);
    });

    it('respects the allow pragma', () => {
        const hits = scanFile(
            '.mcp.json',
            `<!-- security-lint: allow mcp-config-security "teaching" -->\n{ "k": "${FAKE_SECRET}" }\n`,
        );
        expect(hits).toHaveLength(0);
    });
});

// --- Golden parity on the REAL repo -----------------------------------------

describe.skipIf(!py3)('lint_mcp_config_security — golden parity on real src/ (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    it('matches the default run byte-for-byte', () => {
        const pe = runPy([]);
        const te = runTs([]);
        expect(te.stdout).toBe(pe.stdout);
        expect(te.stderr).toBe(pe.stderr);
        expect(te.status).toBe(pe.status);
    });
    it('matches the --json run byte-for-byte', () => {
        const pe = runPy(['--json']);
        const te = runTs(['--json']);
        expect(te.stdout).toBe(pe.stdout);
        expect(te.status).toBe(pe.status);
    });
});

// --- Golden parity on a self-contained crafted-hit fixture repo -------------

describe.skipIf(!py3)(
    'lint_mcp_config_security — golden parity on crafted hits (fixture repo)',
    () => {
        let fixRoot: string;
        afterEach(() => {
            if (fixRoot) fs.rmSync(fixRoot, { recursive: true, force: true });
        });

        function buildFixture(files: Record<string, string>): string {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-fix-'));
            const libDst = path.join(root, 'src', 'scripts', '_lib');
            fs.mkdirSync(libDst, { recursive: true });
            const libSrc = path.join(REPO_ROOT, 'src', 'scripts', '_lib');
            fs.copyFileSync(
                path.join(libSrc, 'security_lint.py'),
                path.join(libDst, 'security_lint.py'),
            );
            fs.copyFileSync(
                path.join(libSrc, 'security_lint.ts'),
                path.join(libDst, 'security_lint.ts'),
            );
            const initPy = path.join(libSrc, '__init__.py');
            if (fs.existsSync(initPy)) fs.copyFileSync(initPy, path.join(libDst, '__init__.py'));
            const scrDst = path.join(root, 'src', 'scripts');
            fs.copyFileSync(PY_SCRIPT, path.join(scrDst, 'lint_mcp_config_security.py'));
            fs.copyFileSync(TS_SCRIPT, path.join(scrDst, 'lint_mcp_config_security.ts'));
            for (const [rel, body] of Object.entries(files)) {
                const fp = path.join(root, rel);
                fs.mkdirSync(path.dirname(fp), { recursive: true });
                fs.writeFileSync(fp, body, 'utf-8');
            }
            return root;
        }
        function runPyFix(args: readonly string[]) {
            return spawnSync('python3', ['src/scripts/lint_mcp_config_security.py', ...args], {
                cwd: fixRoot,
                encoding: 'utf8',
            });
        }
        function runTsFix(args: readonly string[]) {
            return spawnSync(TSX_BIN, ['src/scripts/lint_mcp_config_security.ts', ...args], {
                cwd: fixRoot,
                encoding: 'utf8',
            });
        }

        const HIT_FILES = {
            // named config under a non-example root — full weight, HIGH secret + MED smells.
            'src/skills/srv/mcp.json':
                '{\n' +
                `  "key": "${FAKE_SECRET}",\n` +
                '  "host": "0.0.0.0",\n' +
                '  "autoApprove": true,\n' +
                `  ${NPX}: "npx",\n` +
                `  "args": [${YES}, "x && y"],\n` +
                '  "API_BASE_URL": "http://x",\n' +
                '  "scopes": ["*"]\n' +
                '}\n',
            // fenced .md block referencing mcpServers — MED smell.
            'src/skills/doc/SKILL.md':
                '```json\n{ "mcpServers": { "x": { "host": "0.0.0.0" } } }\n```\n',
            // example-path (docs/) → weight 0.25 (secret HIGH downgraded to WARN).
            'src/agent-src/docs/mcp.json': `{ "k": "${FAKE_SECRET}" }\n`,
            // clean file, nothing flagged.
            'src/rules/ok.md': 'ordinary documentation prose, nothing flagged.\n',
        };

        it('matches the default crafted-hit run byte-for-byte', () => {
            fixRoot = buildFixture(HIT_FILES);
            const pe = runPyFix([]);
            const te = runTsFix([]);
            expect(te.stdout).toBe(pe.stdout);
            expect(te.stderr).toBe(pe.stderr);
            expect(te.status).toBe(pe.status);
            expect(pe.status).toBe(1);
        });

        it('matches the --json crafted-hit run byte-for-byte', () => {
            fixRoot = buildFixture(HIT_FILES);
            const pe = runPyFix(['--json']);
            const te = runTsFix(['--json']);
            expect(te.stdout).toBe(pe.stdout);
            expect(te.status).toBe(pe.status);
        });
    },
);
