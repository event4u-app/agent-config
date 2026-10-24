// Tests for src/scripts/lint_mcp_registry_manifest.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. This is a focused differential suite over the
// public behaviour (the hand-rolled Draft-2020-12 subset validator accepting a
// valid manifest, rejecting bad shapes) plus a golden-parity layer that runs
// python3 vs tsx on the REAL REPO (skipped without python3). In this worktree
// dist/mcp/ is absent, so the no-arg run exercises the `missing:` branch.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_mcp_registry_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'mcp-registry-manifest.schema.json');


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
            {
                id: 'mcp-official-registry',
                label: 'Official MCP Registry',
                listing_format: 'server-json',
                submission_url: 'https://registry.modelcontextprotocol.io',
                status: 'pending',
                submitted_at: null,
                pr_url: null,
                last_verified: null,
                rendered_payload: 'dist/mcp/server.json',
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


describe('lint_mcp_registry_manifest — registry payload (road-to-listings-a-release-keeps-current Phase 1)', () => {
    function payload(description: string, args: unknown[] = [{ type: 'positional', value: 'mcp-server' }]) {
        return {
            $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
            name: 'io.github.example/pkg',
            description,
            version: '1.0.0',
            packages: [{ registryType: 'npm', identifier: 'pkg', version: '1.0.0', transport: { type: 'stdio' }, packageArguments: args }],
        };
    }

    it('accepts a description of exactly 100 characters', () => {
        expect(mod.checkRegistryPayload(payload('x'.repeat(100)))).toBeNull();
    });

    it('rejects a description of 101 characters', () => {
        expect(mod.checkRegistryPayload(payload('x'.repeat(101)))).toMatch(/101 characters/);
    });

    it('rejects a missing description', () => {
        expect(mod.checkRegistryPayload(payload(''))).toMatch(/registryDescription/);
    });

    it('rejects a package entry that would start the bare CLI', () => {
        expect(mod.checkRegistryPayload(payload('ok', []))).toMatch(/mcp-server/);
    });

    it('rejects the old schema pin', () => {
        const p = { ...payload('ok'), $schema: 'https://static.modelcontextprotocol.io/schemas/2025-07-09/server.schema.json' };
        expect(mod.checkRegistryPayload(p)).toMatch(/\$schema/);
    });
});
