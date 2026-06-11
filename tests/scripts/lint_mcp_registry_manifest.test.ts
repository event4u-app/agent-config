// Tests for src/scripts/lint_mcp_registry_manifest.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. This is a focused differential suite over the
// public behaviour (the hand-rolled Draft-2020-12 subset validator accepting a
// valid manifest, rejecting bad shapes) plus a golden-parity layer that runs
// python3 vs tsx on the REAL REPO (skipped without python3). In this worktree
// dist/mcp/ is absent, so the no-arg run exercises the `missing:` branch.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_mcp_registry_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_mcp_registry_manifest.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_mcp_registry_manifest.py');
const SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'mcp-registry-manifest.schema.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8')) as Record<string, unknown>;

function validManifest(): Record<string, unknown> {
    return {
        version: 1,
        generated_at: '2026-01-01',
        package: {
            name: 'pkg',
            version: '1.0.0',
            description: 'desc',
            homepage: 'https://example.com',
            repository: 'https://example.com/repo',
        },
        server: {
            name: 'srv',
            transports: ['stdio'],
            tools_count: 3,
            install_hint_stdio: 'npx pkg',
        },
        registries: [
            {
                id: 'awesome-mcp-servers',
                label: 'Awesome',
                listing_format: 'markdown-row',
                submission_url: 'https://example.com/sub',
                status: 'pending',
                submitted_at: null,
                pr_url: null,
                last_verified: null,
                rendered_payload: 'dist/mcp/awesome-mcp-servers.row.md',
            },
            {
                id: 'mcp-cloudflare-catalogue',
                label: 'CF',
                listing_format: 'json-entry',
                submission_url: 'https://example.com/cf',
                status: 'pending',
                submitted_at: null,
                pr_url: null,
                last_verified: null,
                rendered_payload: 'dist/mcp/mcp-cloudflare-catalogue.json',
            },
        ],
    };
}

describe('lint_mcp_registry_manifest — schema validator (subset)', () => {
    it('accepts a fully valid manifest', () => {
        expect(mod._validateSchema(validManifest(), schema)).toBeNull();
    });

    it('rejects wrong version const', () => {
        const m = validManifest();
        m['version'] = 2;
        expect(mod._validateSchema(m, schema)).not.toBeNull();
    });

    it('rejects a missing required key', () => {
        const m = validManifest();
        delete m['server'];
        expect(mod._validateSchema(m, schema)).not.toBeNull();
    });

    it('rejects an unknown additional property', () => {
        const m = validManifest();
        m['surprise'] = true;
        expect(mod._validateSchema(m, schema)).not.toBeNull();
    });

    it('rejects a bad registry status enum', () => {
        const m = validManifest();
        (m['registries'] as Array<Record<string, unknown>>)[0]!['status'] = 'maybe';
        expect(mod._validateSchema(m, schema)).not.toBeNull();
    });

    it('rejects fewer than 2 registries', () => {
        const m = validManifest();
        m['registries'] = [(m['registries'] as unknown[])[0]];
        expect(mod._validateSchema(m, schema)).not.toBeNull();
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_mcp_registry_manifest — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
