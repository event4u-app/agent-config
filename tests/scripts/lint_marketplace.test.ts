// Tests for src/scripts/lint_marketplace.ts.
//
// Since road-to-install-path-convergence the linter validates the
// BOOTSTRAP-SHIM shape: the plugin lists EXACTLY one pointer skill
// (./.claude-plugin/skills/install-agent-config); any content skill in
// skills[] or on disk under .claude-plugin/skills/ fails. The linter
// resolves paths relative to cwd (ROOT="."), so each fixture runs in a tmp
// cwd and asserts the exit code + substring contract. A real-repo case
// covers the production tree under the real CI invocation.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../../src/scripts/lint_marketplace.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const POINTER_ENTRY = './.claude-plugin/skills/install-agent-config';

function runTs(cwd: string) {
    return runInProc(main, [], { cwd });
}

function write(p: string, body: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
}

function validRepo(tmp: string): void {
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '1.4.0' }));
    const pointerDir = path.join(tmp, '.claude-plugin', 'skills', 'install-agent-config');
    write(path.join(pointerDir, 'SKILL.md'), '---\nname: install-agent-config\ndescription: Pointer.\n---\n');
    write(
        path.join(tmp, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
            name: 'event4u-agent-config',
            owner: { name: 'event4u', email: 'dev@event4u.app' },
            metadata: { description: 'Test.', version: '1.4.0' },
            plugins: [
                {
                    name: 'agent-config',
                    description: 'Bootstrap shim.',
                    source: './',
                    strict: false,
                    skills: [POINTER_ENTRY],
                },
            ],
        }),
    );
    // The Augment twins. A valid repo shape carries them: both ship in the npm
    // tarball (publish-surface.json roots) and both are version-synced to
    // package.json, so their ABSENCE is a violation, not a not-applicable —
    // that is the whole point of the rule they were added for.
    write(
        path.join(tmp, '.augment-plugin', 'plugin.json'),
        JSON.stringify({ name: 'agent-config', version: '1.4.0' }),
    );
    write(
        path.join(tmp, '.augment-plugin', 'marketplace.json'),
        JSON.stringify({
            name: 'event4u-agent-config',
            version: '1.4.0',
            metadata: { description: 'Test.', version: '1.4.0' },
            plugins: [{ name: 'agent-config', version: '1.4.0', source: '.' }],
        }),
    );
}

function readMarketplace(tmp: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(tmp, '.claude-plugin', 'marketplace.json'), 'utf-8'));
}
function writeMarketplace(tmp: string, payload: unknown): void {
    fs.writeFileSync(path.join(tmp, '.claude-plugin', 'marketplace.json'), JSON.stringify(payload), 'utf-8');
}

describe('lint_marketplace — bootstrap-shim contract', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('test_valid_shim_passes', () => {
        validRepo(tmp);
        const r = runTs(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No issues');
        expect(r.stdout).toContain('bootstrap shim');
    });

    it('test_missing_marketplace_file_fails', () => {
        write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
        const r = runTs(tmp);
        expect(r.status).toBe(1);
    });

    it('test_invalid_json_fails', () => {
        validRepo(tmp);
        write(path.join(tmp, '.claude-plugin', 'marketplace.json'), '{ not json');
        const ts = runTs(tmp);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toContain('not valid JSON');
        const prefix = '❌  .claude-plugin/marketplace.json is not valid JSON: ';
        expect(ts.stdout.startsWith(prefix)).toBe(true);
    });

    it('test_missing_required_top_level_field', () => {
        validRepo(tmp);
        writeMarketplace(tmp, { name: 'x', owner: { name: 'e', email: 'e@x' }, plugins: [] });
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('metadata');
    });

    it('test_version_mismatch_with_package_json', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { metadata: { version: string } };
        payload.metadata.version = '9.9.9';
        writeMarketplace(tmp, payload);
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('package.json');
    });

    it('test_repopulated_content_skill_fails', () => {
        // The load-bearing shim assertion: a content skill re-added to
        // skills[] must FAIL even when the path exists on disk.
        validRepo(tmp);
        const skillDir = path.join(tmp, 'dist/agent-src', 'skills', 'demo-skill');
        write(path.join(skillDir, 'SKILL.md'), '---\nname: demo-skill\ndescription: Demo.\n---\n');
        const payload = readMarketplace(tmp) as { plugins: Array<{ skills: string[] }> };
        payload.plugins[0]!.skills.push('./dist/agent-src/skills/demo-skill');
        writeMarketplace(tmp, payload);
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('bootstrap shim');
        expect(r.stdout).toContain('demo-skill');
    });

    it('test_pointer_missing_on_disk_fails', () => {
        validRepo(tmp);
        fs.rmSync(path.join(tmp, '.claude-plugin', 'skills', 'install-agent-config'), {
            recursive: true,
            force: true,
        });
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('does not exist');
    });

    it('test_pointer_without_skill_md_fails', () => {
        validRepo(tmp);
        fs.rmSync(path.join(tmp, '.claude-plugin', 'skills', 'install-agent-config', 'SKILL.md'));
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('SKILL.md');
    });

    it('test_pointer_not_listed_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { plugins: Array<{ skills: string[] }> };
        payload.plugins[0]!.skills = [];
        writeMarketplace(tmp, payload);
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('not listed');
    });

    it('test_duplicate_skill_path_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { plugins: Array<{ skills: string[] }> };
        payload.plugins[0]!.skills.push(POINTER_ENTRY);
        writeMarketplace(tmp, payload);
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('duplicate');
    });

    it('test_empty_plugins_array_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { plugins: unknown[] };
        payload.plugins = [];
        writeMarketplace(tmp, payload);
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('non-empty');
    });

    it('test_owner_missing_email_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { owner: { email?: string } };
        delete payload.owner.email;
        writeMarketplace(tmp, payload);
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('email');
    });

    it('test_extra_skill_dir_on_disk_fails', () => {
        // A repopulated symlink tree (stale generator output) must FAIL even
        // when marketplace.json itself is clean.
        validRepo(tmp);
        const stray = path.join(tmp, '.claude-plugin', 'skills', 'stray-skill');
        write(path.join(stray, 'SKILL.md'), '---\nname: stray-skill\ndescription: Stray.\n---\n');
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('stray-skill');
        expect(r.stdout).toContain('unexpected skill dir');
    });

    it('test_dist_skills_are_intentionally_unlisted', () => {
        // dist/agent-src/skills/ ships in the npm package, NOT through the
        // marketplace — skills on disk there must NOT trigger drift errors.
        validRepo(tmp);
        const skillDir = path.join(tmp, 'dist/agent-src', 'skills', 'demo-skill');
        write(path.join(skillDir, 'SKILL.md'), '---\nname: demo-skill\ndescription: Demo.\n---\n');
        const r = runTs(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No issues');
    });
});

describe('lint_marketplace — real-repo golden parity (CI invocation)', () => {
    it('matches the default run byte-for-byte', () => {
        const r = runTs(REPO_ROOT);
        expect(r.status).toBe(0);
    });
});
