// Tests for src/scripts/apply_modules_config.ts (py2ts Phase 8 / Wave 8g).
//
// 1:1 port of tests/test_apply_modules_config.py — comment preservation,
// idempotent re-application, bootstrap from the bundled template, decline /
// ack-only / error paths. Subprocess-driven against a temp project (never the
// live repo), exactly like the pytest `_run` helper. Plus a golden-parity
// block comparing python3 vs tsx byte-for-byte on the same fixtures.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'apply_modules_config.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'apply_modules_config.py');
// 6.0.x (ADR-051): the uncondensed source container moved to src/agent-src/.
const TEMPLATE = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'agents',
    'agent-project-settings.example.yml',
);
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'amc-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            // ignore
        }
    }
});

interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}
function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8' });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
function runPy(args: string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8' });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Mirror the pytest `_run` helper (TS side). */
function run(project: string, payload: Record<string, unknown> | null, decline = false): RunResult {
    const args = ['--project', project];
    if (decline) {
        args.push('--decline');
        return runTs(args);
    }
    const payloadPath = path.join(project, '_payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify(payload ?? {}), 'utf-8');
    args.push('--input-file', payloadPath);
    return runTs(args);
}

function seedTeamFile(project: string): string {
    const target = path.join(project, '.agent-project-settings.yml');
    fs.copyFileSync(TEMPLATE, target);
    return target;
}
function read(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

describe('apply_modules_config — happy path', () => {
    it('patches modules block with full payload', () => {
        const tmp = mkTmp();
        const team = seedTeamFile(tmp);
        const proc = run(tmp, {
            enabled: true,
            root_paths: ['app/Modules'],
            namespace_template: 'App\\Modules\\{ModuleName}\\App',
            agent_folder: 'agents',
            skip_dirs: ['.module-template', '.example'],
        });
        expect(proc.status).toBe(0);
        const text = read(team);
        expect(text).toContain('  enabled: true');
        expect(text).toContain('  root_paths: ["app/Modules"]');
        expect(text).toContain('  namespace_template: "App\\\\Modules\\\\{ModuleName}\\\\App"');
    });

    it('preserves comments and surrounding blocks', () => {
        const tmp = mkTmp();
        const team = seedTeamFile(tmp);
        const before = read(team);
        const commentsBefore = before
            .split('\n')
            .filter((ln) => ln.trim().startsWith('#'));
        run(tmp, { enabled: true, root_paths: ['src'] });
        const after = read(team);
        const commentsAfter = after.split('\n').filter((ln) => ln.trim().startsWith('#'));
        expect(commentsAfter).toEqual(commentsBefore);
        expect(after).toContain('schema_version: 1');
    });

    it('idempotent under repeat application', () => {
        const tmp = mkTmp();
        seedTeamFile(tmp);
        const payload = {
            enabled: true,
            root_paths: ['packages'],
            namespace_template: '',
            agent_folder: 'agents',
            skip_dirs: ['.module-template', '.example'],
        };
        run(tmp, payload);
        const first = read(path.join(tmp, '.agent-project-settings.yml'));
        run(tmp, payload);
        const second = read(path.join(tmp, '.agent-project-settings.yml'));
        expect(second).toBe(first);
    });
});

describe('apply_modules_config — decline / bootstrap / error', () => {
    it('decline writes nothing when team file missing', () => {
        const tmp = mkTmp();
        const proc = run(tmp, null, true);
        expect(proc.status).toBe(0);
        expect(fs.existsSync(path.join(tmp, '.agent-project-settings.yml'))).toBe(false);
    });

    it('decline leaves existing team file untouched', () => {
        const tmp = mkTmp();
        const team = seedTeamFile(tmp);
        const before = read(team);
        const proc = run(tmp, null, true);
        expect(proc.status).toBe(0);
        expect(read(team)).toBe(before);
    });

    it('bootstraps team file from bundled template', () => {
        const tmp = mkTmp();
        const target = path.join(tmp, '.agent-project-settings.yml');
        expect(fs.existsSync(target)).toBe(false);
        const proc = run(tmp, { enabled: true, root_paths: ['src'] });
        expect(proc.status).toBe(0);
        expect(fs.statSync(target).isFile()).toBe(true);
        const text = read(target);
        expect(text).toContain('schema_version: 1');
        expect(text).toContain('  enabled: true');
    });

    it('rejects invalid payload shape (exit 2)', () => {
        const tmp = mkTmp();
        seedTeamFile(tmp);
        const proc = run(tmp, { enabled: true, root_paths: 'app/Modules' });
        expect(proc.status).toBe(2);
        expect(proc.stderr).toContain('root_paths');
    });

    it('empty root_paths renders as empty flow list', () => {
        const tmp = mkTmp();
        const team = seedTeamFile(tmp);
        run(tmp, { enabled: false, root_paths: [] });
        expect(read(team)).toContain('  root_paths: []');
    });

    it('emits team file path on stdout', () => {
        const tmp = mkTmp();
        seedTeamFile(tmp);
        const proc = run(tmp, { enabled: true, root_paths: ['src'] });
        expect(proc.status).toBe(0);
        // The script resolves the project root (symlink-following) before
        // joining TEAM_FILE; compare against the same realpath.
        const resolved = fs.realpathSync(tmp);
        expect(proc.stdout.trim()).toBe(path.join(resolved, '.agent-project-settings.yml'));
    });

    it('unreachable project root errors with exit 2', () => {
        const tmp = mkTmp();
        const payloadPath = path.join(tmp, '_payload.json');
        fs.writeFileSync(
            payloadPath,
            JSON.stringify({ enabled: true, root_paths: ['src'] }),
            'utf-8',
        );
        const missing = path.join(tmp, 'does-not-exist');
        const proc = runTs(['--project', missing, '--input-file', payloadPath]);
        expect(proc.status).toBe(2);
        expect(proc.stderr).toContain('project root');
    });
});

describe('apply_modules_config — --acknowledge-only', () => {
    function runAckOnly(project: string): RunResult {
        return runTs(['--project', project, '--acknowledge-only']);
    }

    it('flips just the ack flag', () => {
        const tmp = mkTmp();
        const team = seedTeamFile(tmp);
        const before = read(team);
        expect(before).toContain('  detection_acknowledged: false');
        const proc = runAckOnly(tmp);
        expect(proc.status).toBe(0);
        const after = read(team);
        expect(after).toContain('  detection_acknowledged: true');
        expect(after).toContain('  enabled: false');
        expect(after).toContain('  root_paths: []');
        expect(after).toContain('  namespace_template: ""');
    });

    it('bootstraps when team file missing', () => {
        const tmp = mkTmp();
        const target = path.join(tmp, '.agent-project-settings.yml');
        expect(fs.existsSync(target)).toBe(false);
        const proc = runAckOnly(tmp);
        expect(proc.status).toBe(0);
        expect(fs.statSync(target).isFile()).toBe(true);
        const text = read(target);
        expect(text).toContain('  detection_acknowledged: true');
        expect(text).toContain('  enabled: false');
        expect(text).toContain('schema_version: 1');
    });

    it('is idempotent', () => {
        const tmp = mkTmp();
        seedTeamFile(tmp);
        runAckOnly(tmp);
        const first = read(path.join(tmp, '.agent-project-settings.yml'));
        runAckOnly(tmp);
        const second = read(path.join(tmp, '.agent-project-settings.yml'));
        expect(second).toBe(first);
    });

    it('ignores stdin payload', () => {
        const tmp = mkTmp();
        seedTeamFile(tmp);
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--project', tmp, '--acknowledge-only'], {
            encoding: 'utf8',
            input: '',
        });
        expect(r.status).toBe(0);
    });
});

// ---- Golden parity (python3 vs tsx) ----
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py = hasPython3();

describe.skipIf(!py)('apply_modules_config — golden parity (python3 vs tsx)', () => {
    function bothPatch(payload: Record<string, unknown> | null, extra: string[]): void {
        const dpy = mkTmp();
        const dts = mkTmp();
        seedTeamFile(dpy);
        seedTeamFile(dts);
        let pjPy: string | null = null;
        let pjTs: string | null = null;
        if (payload !== null) {
            pjPy = path.join(dpy, 'p.json');
            pjTs = path.join(dts, 'p.json');
            fs.writeFileSync(pjPy, JSON.stringify(payload), 'utf-8');
            fs.writeFileSync(pjTs, JSON.stringify(payload), 'utf-8');
        }
        const pyArgs = ['--project', dpy, ...extra, ...(pjPy ? ['--input-file', pjPy] : [])];
        const tsArgs = ['--project', dts, ...extra, ...(pjTs ? ['--input-file', pjTs] : [])];
        const p = runPy(pyArgs);
        const t = runTs(tsArgs);
        expect(t.status).toBe(p.status);
        expect(read(path.join(dts, '.agent-project-settings.yml'))).toBe(
            read(path.join(dpy, '.agent-project-settings.yml')),
        );
    }

    it('full payload written file matches', () => {
        bothPatch(
            {
                enabled: true,
                root_paths: ['app/Modules'],
                namespace_template: 'App\\Modules\\{ModuleName}\\App',
                agent_folder: 'agents',
                skip_dirs: ['.module-template', '.example'],
            },
            [],
        );
    });

    it('empty root_paths written file matches', () => {
        bothPatch({ enabled: false, root_paths: [] }, []);
    });

    it('acknowledge-only written file matches', () => {
        bothPatch(null, ['--acknowledge-only']);
    });

    it('bad payload exits 2 identically', () => {
        const dpy = mkTmp();
        const dts = mkTmp();
        seedTeamFile(dpy);
        seedTeamFile(dts);
        const pj = path.join(dpy, 'p.json');
        fs.writeFileSync(pj, JSON.stringify({ enabled: true, root_paths: 'x' }), 'utf-8');
        const p = runPy(['--project', dpy, '--input-file', pj]);
        const t = runTs(['--project', dts, '--input-file', pj]);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
    });
});
