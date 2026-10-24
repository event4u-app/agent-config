// The Gemini CLI extension and the GitHub Copilot discovery plugin are read by
// crawlers from the default branch and start the MCP server through `npx`, so
// the version in each — and the version pinned in its `npx` argument — must
// follow package.json through every release.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LISTING_MANIFESTS } from '../../src/scripts/_lib/listing_manifests.js';
import { manifestDifferences } from '../../src/scripts/check_release_manifest_content.js';
import { _matches as shapeAdmits } from '../../src/scripts/check_release_pr_shape.js';
import { check_listing_manifests } from '../../src/scripts/lint_marketplace.js';
import { set_plugin_manifest_versions } from '../../src/scripts/release_env.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');

type Obj = Record<string, unknown>;

function readRepoJson(rel: string): Obj {
    return JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf-8')) as Obj;
}

const PKG_VERSION = (readRepoJson('package.json') as { version: string }).version;

function serverArgs(manifest: Obj): string[] {
    const servers = manifest['mcpServers'] as Record<string, { command: string; args: string[] }>;
    return servers['agent-config']!.args;
}

function listing(version: string, pinned: string): Obj {
    return {
        name: 'agent-config',
        version,
        mcpServers: { 'agent-config': { command: 'npx', args: ['-y', `@event4u/agent-config@${pinned}`, 'mcp-server'] } },
    };
}

describe('Gemini CLI extension (root gemini-extension.json)', () => {
    const manifest = readRepoJson('gemini-extension.json');

    it('names the extension and carries the package.json version', () => {
        expect(manifest['name']).toBe('agent-config');
        expect(manifest['version']).toBe(PKG_VERSION);
    });

    it('starts the MCP server through npx, pinned to the package version', () => {
        const server = (manifest['mcpServers'] as Record<string, { command: string; args: string[] }>)['agent-config']!;
        expect(server.command).toBe('npx');
        expect(server.args).toContain('mcp-server');
        expect(server.args).toContain(`@event4u/agent-config@${PKG_VERSION}`);
    });

    it('points at a context file of 15 lines or fewer that is not the GEMINI.md projection', () => {
        const ctx = manifest['contextFileName'];
        expect(ctx).toBe('gemini-extension-context.md');
        const text = fs.readFileSync(path.join(REPO, ctx as string), 'utf-8');
        expect(text.trimEnd().split('\n').length).toBeLessThanOrEqual(15);
        expect(text).toContain('npx -y @event4u/agent-config init');
    });
});

describe('GitHub Copilot discovery plugin (.github/plugin/plugin.json)', () => {
    const manifest = readRepoJson('.github/plugin/plugin.json');

    it('registers no hooks', () => {
        expect(manifest).not.toHaveProperty('hooks');
    });

    it('declares the read-only MCP server pinned to the package version', () => {
        expect(serverArgs(manifest)).toEqual(['-y', `@event4u/agent-config@${PKG_VERSION}`, 'mcp-server']);
        expect(manifest['version']).toBe(PKG_VERSION);
    });

    it('declares only the install-pointer skill, which exists on disk', () => {
        // A subdirectory install copies .github/plugin/ alone, so every path the
        // manifest names must resolve inside it (a clean Copilot install of the
        // 17.3.0 shape found the server and no skill).
        expect(manifest['skills']).toEqual(['./skills/install-agent-config']);
        const pluginDir = path.join(REPO, '.github', 'plugin');
        for (const rel of manifest['skills'] as string[]) {
            const resolved = path.resolve(pluginDir, rel);
            expect(resolved.startsWith(pluginDir + path.sep)).toBe(true);
            expect(fs.existsSync(path.join(resolved, 'SKILL.md'))).toBe(true);
        }
        expect(fs.readFileSync(path.join(pluginDir, 'skills', 'install-agent-config', 'SKILL.md'), 'utf-8')).toBe(
            fs.readFileSync(path.join(REPO, '.claude-plugin', 'skills', 'install-agent-config', 'SKILL.md'), 'utf-8'),
        );
    });

    it('says it is a discovery plugin, not the full suite, and names the full install', () => {
        const description = String(manifest['description']);
        expect(description).toMatch(/discovery plugin/i);
        expect(description).toMatch(/not the full suite/i);
        expect(description).toContain('npx -y @event4u/agent-config init');
    });
});

describe('listing manifests under the release version gate', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'listing-ver-'));
        fs.mkdirSync(path.join(tmp, '.github', 'plugin'), { recursive: true });
        fs.mkdirSync(path.join(tmp, '.augment-plugin'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function writeFixtures(version: string, pinned: string): void {
        for (const rel of LISTING_MANIFESTS) {
            fs.writeFileSync(path.join(tmp, rel), JSON.stringify(listing(version, pinned), null, 2) + '\n');
        }
        fs.writeFileSync(path.join(tmp, '.augment-plugin', 'plugin.json'), JSON.stringify({ version }) + '\n');
        fs.writeFileSync(
            path.join(tmp, '.augment-plugin', 'marketplace.json'),
            JSON.stringify({ version, metadata: { version }, plugins: [{ version }] }) + '\n',
        );
    }

    it('the real tree passes the marketplace lint', () => {
        const errors: string[] = [];
        check_listing_manifests(PKG_VERSION, errors, REPO);
        expect(errors).toEqual([]);
    });

    it('a manifest left at an old version fails the lint', () => {
        writeFixtures('1.0.0', '2.0.0');
        const errors: string[] = [];
        check_listing_manifests('2.0.0', errors, tmp);
        expect(errors).toHaveLength(2);
        expect(errors.join('\n')).toContain('version `1.0.0` does not match package.json version `2.0.0`');
    });

    it('an old pinned npx argument fails the lint even when `version` is current', () => {
        writeFixtures('2.0.0', '1.0.0');
        const errors: string[] = [];
        check_listing_manifests('2.0.0', errors, tmp);
        expect(errors).toHaveLength(2);
        expect(errors.join('\n')).toContain('must pin `@event4u/agent-config@2.0.0` (found `@event4u/agent-config@1.0.0`)');
    });

    it('an unpinned package argument fails the lint', () => {
        writeFixtures('2.0.0', '2.0.0');
        const file = path.join(tmp, 'gemini-extension.json');
        const m = JSON.parse(fs.readFileSync(file, 'utf-8')) as Obj;
        serverArgs(m)[1] = '@event4u/agent-config';
        fs.writeFileSync(file, JSON.stringify(m));
        const errors: string[] = [];
        check_listing_manifests('2.0.0', errors, tmp);
        expect(errors).toEqual([expect.stringContaining('found `@event4u/agent-config`')]);
    });

    it('the release writer bumps version and pin in both, and the lint then passes', () => {
        writeFixtures('1.0.0', '1.0.0');
        set_plugin_manifest_versions('2.1.0', tmp);
        const errors: string[] = [];
        check_listing_manifests('2.1.0', errors, tmp);
        expect(errors).toEqual([]);
        for (const rel of LISTING_MANIFESTS) {
            const m = JSON.parse(fs.readFileSync(path.join(tmp, rel), 'utf-8')) as Obj;
            expect(serverArgs(m)).toEqual(['-y', '@event4u/agent-config@2.1.0', 'mcp-server']);
        }
    });

    it('a release PR may carry both listing manifests', () => {
        for (const rel of LISTING_MANIFESTS) expect(shapeAdmits(rel)).toBe(true);
    });
});

describe('release-PR content gate on the listing manifests', () => {
    const before = JSON.stringify(listing('1.0.0', '1.0.0'));

    it.each(LISTING_MANIFESTS)('%s: admits a version bump with its re-pin', (file) => {
        expect(manifestDifferences(file, before, JSON.stringify(listing('1.1.0', '1.1.0')))).toEqual([]);
    });

    it.each(LISTING_MANIFESTS)('%s: refuses an npx argument swapped for another package', (file) => {
        const after = listing('1.1.0', '1.1.0');
        serverArgs(after)[1] = 'evil-package@1.1.0';
        expect(manifestDifferences(file, before, JSON.stringify(after))).toEqual([
            `${file}: "mcpServers"."agent-config"."args".[1] differs outside the version fields`,
        ]);
    });

    it.each(LISTING_MANIFESTS)('%s: refuses a changed command and an added argument', (file) => {
        const after = listing('1.1.0', '1.1.0');
        serverArgs(after)[2] = 'install';
        expect(manifestDifferences(file, before, JSON.stringify(after))).toHaveLength(1);
        serverArgs(after).push('--yes');
        expect(manifestDifferences(file, before, JSON.stringify(after))).toEqual([
            `${file}: "mcpServers"."agent-config"."args" differs outside the version fields`,
        ]);
    });
});

describe('install-pointer skill — true for every plugin that ships it', () => {
    const body = fs.readFileSync(path.join(REPO, '.claude-plugin', 'skills', 'install-agent-config', 'SKILL.md'), 'utf-8');

    it('does not tell a Copilot user the plugin ships hooks', () => {
        expect(body).not.toMatch(/ships hooks\s+plus this pointer only/);
        expect(body).not.toMatch(/This plugin is a \*\*bootstrap shim\*\*/);
    });

    it('says what each plugin adds and that neither is the full suite', () => {
        expect(body).toContain('the Copilot one a read-only MCP server');
        expect(body).toContain('npx -y @event4u/agent-config init');
    });
});
