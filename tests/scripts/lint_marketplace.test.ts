// Tests for src/scripts/lint_marketplace.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// The Python linter resolves paths relative to cwd (ROOT="."). The pytest
// suite tests/test_lint_marketplace.py drives it via subprocess in a tmp cwd.
// Ported 1:1 here as a DUAL run: each fixture runs both python3 and tsx in the
// same tmp cwd and asserts (a) byte-identical stdout/stderr/exit between the
// two (golden parity per fixture) and (b) the pytest assertions on exit code +
// substring. The whole suite is skipped without python3. A real-repo
// golden-parity case covers the production tree under the real CI invocation.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_marketplace.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_marketplace.py');
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

function runPy(cwd: string) {
    return spawnSync('python3', [PY_SCRIPT], { cwd, encoding: 'utf8' });
}
function runTs(cwd: string) {
    return spawnSync(TSX_BIN, [TS_SCRIPT], { cwd, encoding: 'utf8' });
}

/** Run both, assert byte-parity, return the (shared) result for assertions. */
function runBoth(cwd: string): { stdout: string; stderr: string; status: number | null } {
    const py = runPy(cwd);
    const ts = runTs(cwd);
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.status).toBe(py.status);
    return { stdout: ts.stdout, stderr: ts.stderr, status: ts.status };
}

function write(p: string, body: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
}

function validRepo(tmp: string): void {
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '1.4.0' }));
    const skillDir = path.join(tmp, 'dist/agent-src', 'skills', 'demo-skill');
    write(path.join(skillDir, 'SKILL.md'), '---\nname: demo-skill\ndescription: Demo.\n---\n');
    write(
        path.join(tmp, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
            name: 'event4u-agent-config',
            owner: { name: 'event4u', email: 'dev@event4u.app' },
            metadata: { description: 'Test.', version: '1.4.0' },
            plugins: [
                {
                    name: 'agent-config',
                    description: 'Test bundle.',
                    source: './',
                    strict: false,
                    skills: ['./dist/agent-src/skills/demo-skill'],
                },
            ],
        }),
    );
}

function readMarketplace(tmp: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(tmp, '.claude-plugin', 'marketplace.json'), 'utf-8'));
}
function writeMarketplace(tmp: string, payload: unknown): void {
    fs.writeFileSync(path.join(tmp, '.claude-plugin', 'marketplace.json'), JSON.stringify(payload), 'utf-8');
}

describe.skipIf(!py3)('lint_marketplace — ported pytest suite (dual run, byte-parity per fixture)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('test_valid_repo_passes', () => {
        validRepo(tmp);
        const r = runBoth(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No issues');
    });

    it('test_missing_marketplace_file_fails', () => {
        write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
    });

    it('test_invalid_json_fails', () => {
        // DIVERGENCE (formatting-only): the native JSON-parser error TEXT after
        // the stable `is not valid JSON: ` prefix differs between CPython's and
        // V8's decoders — same class as check_memory's YAML divergence. See
        // docs/migration/divergences/src-scripts-lint_marketplace.md. Assert the
        // stable contract (exit 1 + prefix) on BOTH rather than byte-parity.
        validRepo(tmp);
        write(path.join(tmp, '.claude-plugin', 'marketplace.json'), '{ not json');
        const py = runPy(tmp);
        const ts = runTs(tmp);
        expect(py.status).toBe(1);
        expect(ts.status).toBe(py.status);
        expect(py.stdout).toContain('not valid JSON');
        expect(ts.stdout).toContain('not valid JSON');
        // Everything up to and including the stable prefix is byte-identical.
        const prefix = '❌  .claude-plugin/marketplace.json is not valid JSON: ';
        expect(ts.stdout.startsWith(prefix)).toBe(true);
        expect(py.stdout.startsWith(prefix)).toBe(true);
    });

    it('test_missing_required_top_level_field', () => {
        validRepo(tmp);
        writeMarketplace(tmp, { name: 'x', owner: { name: 'e', email: 'e@x' }, plugins: [] });
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('metadata');
    });

    it('test_version_mismatch_with_package_json', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { metadata: { version: string } };
        payload.metadata.version = '9.9.9';
        writeMarketplace(tmp, payload);
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('package.json');
    });

    it('test_nonexistent_skill_path_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { plugins: Array<{ skills: string[] }> };
        payload.plugins[0]!.skills.push('./dist/agent-src/skills/nope');
        writeMarketplace(tmp, payload);
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('nope');
    });

    it('test_skill_dir_without_skill_md_fails', () => {
        validRepo(tmp);
        fs.mkdirSync(path.join(tmp, 'dist/agent-src', 'skills', 'broken-skill'), { recursive: true });
        const payload = readMarketplace(tmp) as { plugins: Array<{ skills: string[] }> };
        payload.plugins[0]!.skills.push('./dist/agent-src/skills/broken-skill');
        writeMarketplace(tmp, payload);
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('SKILL.md');
    });

    it('test_duplicate_skill_path_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { plugins: Array<{ skills: string[] }> };
        payload.plugins[0]!.skills.push('./dist/agent-src/skills/demo-skill');
        writeMarketplace(tmp, payload);
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('duplicate');
    });

    it('test_empty_plugins_array_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { plugins: unknown[] };
        payload.plugins = [];
        writeMarketplace(tmp, payload);
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('non-empty');
    });

    it('test_owner_missing_email_fails', () => {
        validRepo(tmp);
        const payload = readMarketplace(tmp) as { owner: { email?: string } };
        delete payload.owner.email;
        writeMarketplace(tmp, payload);
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('email');
    });

    it('test_skill_on_disk_not_listed_in_marketplace_fails', () => {
        validRepo(tmp);
        const drifted = path.join(tmp, 'dist/agent-src', 'skills', 'drifted-skill');
        write(path.join(drifted, 'SKILL.md'), '---\nname: drifted-skill\ndescription: Drift.\n---\n');
        const r = runBoth(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('drifted-skill');
        expect(r.stdout).toContain('not listed');
    });

    it('test_completeness_check_ignores_dirs_without_skill_md', () => {
        validRepo(tmp);
        fs.mkdirSync(path.join(tmp, 'dist/agent-src', 'skills', '_template'), { recursive: true });
        const r = runBoth(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No issues');
    });

    it('test_completeness_check_ignores_loose_files', () => {
        validRepo(tmp);
        write(path.join(tmp, 'dist/agent-src', 'skills', 'README.md'), '# index');
        const r = runBoth(tmp);
        expect(r.status).toBe(0);
    });
});

describe.skipIf(!py3)('lint_marketplace — real-repo golden parity (CI invocation)', () => {
    it('matches the default run byte-for-byte', () => {
        runBoth(REPO_ROOT);
    });
});
