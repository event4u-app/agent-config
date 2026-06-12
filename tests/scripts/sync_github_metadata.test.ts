// Tests for src/scripts/sync_github_metadata.ts (py2ts Phase 5).
//
// The script talks to the GitHub REST API; the transport is INJECTABLE so the
// whole suite runs with ZERO network.
//
// Two layers:
//   1. Differential unit checks on the injected-transport main(): dry-run diff
//      output, --strict exit codes, --apply audit-row formatting + mutation
//      calls, repo resolution, and the SystemExit error paths (missing token,
//      unresolvable repo).
//   2. Golden parity on a STUBBED transport: python3 (with _request
//      monkeypatched) vs tsx (with the request seam) produce byte-identical
//      stdout / exit / audit-file bytes on the same fixture inputs. Skipped
//      when python3 is absent.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sgm from '../../src/scripts/sync_github_metadata.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'sync_github_metadata.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgm-'));
    fs.mkdirSync(path.join(tmp, '.github'), { recursive: true });
    fs.writeFileSync(
        path.join(tmp, '.github', 'topics.yml'),
        'topics:\n  - bbb\n  - aaa\n',
        'utf-8',
    );
    fs.writeFileSync(
        path.join(tmp, '.github', 'about.yml'),
        'description: "New desc"\nhomepage: "https://new.example"\n',
        'utf-8',
    );
    fs.writeFileSync(
        path.join(tmp, 'package.json'),
        JSON.stringify({ repository: { url: 'git+https://github.com/owner/name.git' } }),
        'utf-8',
    );
    sgm._setRootForTest(tmp);
});

afterEach(() => {
    sgm._setRootForTest(sgm.ROOT);
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

interface RunResult {
    rc: number;
    out: string;
    err: string;
    calls: Array<{ method: string; url: string; body: Record<string, unknown> | null }>;
}
class _Exit extends Error {
    constructor(public code: number) {
        super(`exit ${code}`);
    }
}

async function runMain(
    args: string[],
    remote: { topics?: string[]; description?: string; homepage?: string },
    opts: { token?: string | null } = {},
): Promise<RunResult> {
    let out = '';
    let err = '';
    const calls: RunResult['calls'] = [];
    const so = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => {
        out += typeof c === 'string' ? c : c.toString('utf-8');
        return true;
    });
    const se = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => {
        err += typeof c === 'string' ? c : c.toString('utf-8');
        return true;
    });
    const ex = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new _Exit(code ?? 0);
    }) as never);
    const request: sgm.RequestFn = async (method, url, _t, body) => {
        calls.push({ method, url, body });
        if (method === 'GET' && url.endsWith('/topics')) {
            return { names: remote.topics ?? [] };
        }
        if (method === 'GET') {
            return { description: remote.description ?? '', homepage: remote.homepage ?? '' };
        }
        return {};
    };
    let rc: number;
    try {
        rc = await sgm.main(args, { request, token: opts.token !== undefined ? opts.token : 'tok' });
    } catch (e) {
        if (e instanceof _Exit) rc = e.code;
        else if (e instanceof sgm.ExitError) {
            err += `${e.message}\n`;
            rc = 1;
        } else throw e;
    } finally {
        so.mockRestore();
        se.mockRestore();
        ex.mockRestore();
    }
    return { rc, out, err, calls };
}

// --- Layer 1: differential unit checks --------------------------------------

describe('sync_github_metadata — injected-transport behaviour', () => {
    it('dry-run with no drift prints the in-sync line and exits 0', async () => {
        const { rc, out } = await runMain(['--repo', 'owner/name'], {
            topics: ['aaa', 'bbb'],
            description: 'New desc',
            homepage: 'https://new.example',
        });
        expect(rc).toBe(0);
        expect(out).toContain('owner/name: topics + about already in sync');
    });

    it('dry-run with drift prints unified diffs (topics + about)', async () => {
        const { rc, out } = await runMain(['--repo', 'owner/name'], {
            topics: ['zzz'],
            description: 'Old desc',
            homepage: 'https://old.example',
        });
        expect(rc).toBe(0);
        expect(out).toContain('--- remote/topics');
        expect(out).toContain('+++ desired/topics');
        expect(out).toContain('-  "zzz"');
        expect(out).toContain('+  "aaa"');
        expect(out).toContain('--- remote/about');
        expect(out).toContain('+  "description": "New desc"');
    });

    it('--strict exits 2 on drift in dry-run', async () => {
        const { rc } = await runMain(['--repo', 'owner/name', '--strict'], { topics: ['zzz'] });
        expect(rc).toBe(2);
    });

    it('--strict exits 0 when in sync', async () => {
        const { rc } = await runMain(['--repo', 'owner/name', '--strict'], {
            topics: ['aaa', 'bbb'],
            description: 'New desc',
            homepage: 'https://new.example',
        });
        expect(rc).toBe(0);
    });

    it('--apply mutates remote and appends an audit block', async () => {
        const { rc, calls } = await runMain(['--repo', 'owner/name', '--apply', '--quiet'], {
            topics: ['zzz'],
            description: 'Old',
            homepage: '',
        });
        expect(rc).toBe(0);
        const methods = calls.map((c) => c.method);
        expect(methods).toContain('PUT'); // topics
        expect(methods).toContain('PATCH'); // about
        const auditPath = path.join(tmp, 'agents', 'notes', 'visibility-sync-audit.md');
        const audit = fs.readFileSync(auditPath, 'utf-8');
        expect(audit).toContain('# Visibility sync audit log');
        // Python repr() of the list/dict (single quotes).
        expect(audit).toContain("topics → ['aaa', 'bbb']");
        expect(audit).toContain("about → {'description': 'New desc', 'homepage': 'https://new.example'}");
    });

    it('--apply with no drift writes no mutations', async () => {
        const { rc, out, calls } = await runMain(['--repo', 'owner/name', '--apply'], {
            topics: ['aaa', 'bbb'],
            description: 'New desc',
            homepage: 'https://new.example',
        });
        expect(rc).toBe(0);
        expect(calls.filter((c) => c.method === 'PUT' || c.method === 'PATCH')).toEqual([]);
        expect(out).toContain('nothing to apply');
        expect(fs.existsSync(path.join(tmp, 'agents', 'notes', 'visibility-sync-audit.md'))).toBe(false);
    });

    it('missing GITHUB_TOKEN raises ExitError → exit 1', async () => {
        const { rc, err } = await runMain(['--repo', 'owner/name'], { topics: [] }, { token: null });
        expect(rc).toBe(1);
        expect(err).toContain('ERROR: GITHUB_TOKEN not set');
    });

    it('resolves repo from package.json when --repo absent', () => {
        expect(sgm._resolve_repo(null)).toBe('owner/name');
    });

    it('unresolvable repo raises ExitError', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ repository: { url: 'nope' } }), 'utf-8');
        expect(() => sgm._resolve_repo(null)).toThrow(sgm.ExitError);
    });
});

// --- Layer 2: golden parity against a stubbed python transport --------------

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

describe.skipIf(!py3)('sync_github_metadata — golden parity (python stub vs tsx stub)', () => {
    it('dry-run drift diff is byte-identical, exit matches', async () => {
        // Python side: monkeypatch _request, capture stdout + exit.
        const pyHarness = `
import sys, os, pathlib
sys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'src', 'scripts'))})
import sync_github_metadata as m
m.TOPICS_FILE = pathlib.Path(${JSON.stringify(path.join(tmp, '.github', 'topics.yml'))})
m.ABOUT_FILE = pathlib.Path(${JSON.stringify(path.join(tmp, '.github', 'about.yml'))})
os.environ['GITHUB_TOKEN'] = 'tok'
def fake(method, url, token, body=None):
    if method == 'GET' and url.endswith('/topics'):
        return {'names': ['zzz']}
    if method == 'GET':
        return {'description': 'Old desc', 'homepage': 'https://old.example'}
    return {}
m._request = fake
sys.argv = ['x', '--repo', 'owner/name']
rc = m.main()
sys.stderr.write('RC %d\\n' % rc)
`;
        const py = spawnSync('python3', ['-c', pyHarness], { encoding: 'utf8', cwd: REPO_ROOT });
        const pyRc = Number((py.stderr.match(/RC (\d+)/) ?? [])[1] ?? '-1');

        const { rc, out } = await runMain(['--repo', 'owner/name'], {
            topics: ['zzz'],
            description: 'Old desc',
            homepage: 'https://old.example',
        });
        expect(rc).toBe(pyRc);
        expect(out).toBe(py.stdout);
    });
});
