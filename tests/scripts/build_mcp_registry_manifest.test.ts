// Tests for src/scripts/build_mcp_registry_manifest.ts (py2ts Phase 5).
//
// No pytest suite ships, so this is a FOCUSED DIFFERENTIAL suite:
//   1. Unit checks on pyJsonDumps (ensure_ascii + sort_keys + indent parity
//      with Python json.dumps) and the missing-discovery-prereq SystemExit.
//   2. Golden parity on the REAL REPO: python3 vs tsx produce byte-identical
//      stdout (no --write) AND byte-identical written files (registry-manifest.json
//      / awesome-mcp-servers.row.md / mcp-cloudflare-catalogue.json). The
//      dist/mcp/ outputs are gitignored/generated, so the test writes both into
//      temp dirs and restores any pre-existing dist/mcp tree. Skipped when
//      python3 is absent.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as mcp from '../../src/scripts/build_mcp_registry_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_mcp_registry_manifest.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_mcp_registry_manifest.py');
const MCP_DIR = path.join(REPO_ROOT, 'dist', 'mcp');
const DISCOVERY = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// --- Layer 1: pyJsonDumps parity --------------------------------------------

describe('build_mcp_registry_manifest.pyJsonDumps — Python json.dumps parity', () => {
    it('escapes non-ASCII as \\uXXXX (ensure_ascii)', () => {
        const s = mcp.pyJsonDumps({ k: 'em—dash' }, { indent: 2, sortKeys: true });
        expect(s).toContain('em\\u2014dash');
        expect(s).not.toContain('—');
    });

    it('sorts keys and uses 2-space indent with (",", ": ") separators', () => {
        const s = mcp.pyJsonDumps({ b: 1, a: 2 }, { indent: 2, sortKeys: true });
        expect(s).toBe('{\n  "a": 2,\n  "b": 1\n}');
    });

    it('renders empty containers compactly', () => {
        expect(mcp.pyJsonDumps({ a: [], b: {} }, { indent: 2, sortKeys: true })).toBe(
            '{\n  "a": [],\n  "b": {}\n}',
        );
    });

    it('emits surrogate pairs for astral codepoints', () => {
        // U+1F600 (😀) → 😀 under CPython ensure_ascii.
        const s = mcp.pyJsonDumps({ e: '😀' }, { indent: 2, sortKeys: true });
        expect(s).toContain('\\ud83d\\ude00');
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();
// Requires the HARD discovery prereq + the two on-disk inputs.
const runnable =
    py3 &&
    fs.existsSync(DISCOVERY) &&
    fs.existsSync(path.join(REPO_ROOT, 'internal', 'workers', 'mcp', 'content.json')) &&
    fs.existsSync(path.join(REPO_ROOT, '.github', 'topics.yml'));

const big = { maxBuffer: 64 * 1024 * 1024, cwd: REPO_ROOT, encoding: 'utf8' as const };
const FILES = ['registry-manifest.json', 'awesome-mcp-servers.row.md', 'mcp-cloudflare-catalogue.json'];

describe.skipIf(!runnable)('build_mcp_registry_manifest — golden parity (python3 vs tsx)', () => {
    let mcpDirExisted: boolean;
    let snapshot: Record<string, string>;
    afterEach(() => {
        // Restore dist/mcp to its pre-test state (it is gitignored/generated).
        if (!mcpDirExisted) {
            fs.rmSync(MCP_DIR, { recursive: true, force: true });
        } else {
            for (const [rel, body] of Object.entries(snapshot)) {
                fs.writeFileSync(path.join(MCP_DIR, rel), body, 'utf-8');
            }
        }
    });
    function snap(): void {
        mcpDirExisted = fs.existsSync(MCP_DIR);
        snapshot = {};
        if (mcpDirExisted) {
            for (const f of FILES) {
                const p = path.join(MCP_DIR, f);
                if (fs.existsSync(p)) snapshot[f] = fs.readFileSync(p, 'utf-8');
            }
        }
    }

    it('stdout (no --write) is byte-identical, with \\u2014 escaping', () => {
        snap();
        const py = spawnSync('python3', [PY_SCRIPT], big);
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], big);
        expect(py.status).toBe(0);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stdout).toContain('\\u2014');
    });

    it('--write produces byte-identical files py vs tsx', () => {
        snap();
        const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-gp-'));
        try {
            // python3 --write, capture the three files.
            const py = spawnSync('python3', [PY_SCRIPT, '--write'], big);
            expect(py.status).toBe(0);
            const pyCopies: Record<string, string> = {};
            for (const f of FILES) pyCopies[f] = fs.readFileSync(path.join(MCP_DIR, f), 'utf-8');
            // Clear dist/mcp, then tsx --write, capture again.
            fs.rmSync(MCP_DIR, { recursive: true, force: true });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--write'], big);
            expect(ts.status).toBe(0);
            for (const f of FILES) {
                const tsBody = fs.readFileSync(path.join(MCP_DIR, f), 'utf-8');
                expect(tsBody).toBe(pyCopies[f]);
            }
        } finally {
            fs.rmSync(work, { recursive: true, force: true });
        }
    });
});
