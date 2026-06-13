// Tests for src/scripts/mcp_render.ts (py2ts Phase 8 / Wave 8g).
//
// Ports tests/test_mcp_render.py 1:1 (substitute, load_source, render,
// format_missing_report, CLI render / check / claude-desktop opt-in /
// idempotence / stale detection) plus a golden-parity layer that runs
// python3 vs tsx on the shared fixtures.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _claudeDesktop,
    format_missing_report,
    load_source,
    main,
    render,
    substitute,
} from '../../src/scripts/mcp_render.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'mcp');

let tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-'));
    tmpDirs.push(d);
    return d;
}

const _origEnv = { ...process.env };
const _origClaude = _claudeDesktop.target;
afterEach(() => {
    for (const d of tmpDirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    }
    tmpDirs = [];
    // restore env
    for (const k of Object.keys(process.env)) {
        if (!(k in _origEnv)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(_origEnv)) {
        if (v !== undefined) process.env[k] = v;
    }
    _claudeDesktop.target = _origClaude;
});

function _writeSource(tmp: string, name = 'mcp.json'): string {
    const src = path.join(tmp, name);
    fs.writeFileSync(src, fs.readFileSync(path.join(FIXTURES, 'source-valid.json'), 'utf-8'), 'utf-8');
    return src;
}

describe('mcp_render — ported pytest suite', () => {
    it('substitute replaces env var', () => {
        process.env['MY_TOKEN'] = 'secret-value';
        const missing: Array<[string, string]> = [];
        const result = substitute('Bearer ${env:MY_TOKEN}', 'x', missing);
        expect(result).toBe('Bearer secret-value');
        expect(missing).toEqual([]);
    });

    it('substitute collects missing without raising', () => {
        delete process.env['NOT_SET_XYZ'];
        const missing: Array<[string, string]> = [];
        const result = substitute('${env:NOT_SET_XYZ}', 'servers.a.env.TOKEN', missing);
        expect(result).toBe('${env:NOT_SET_XYZ}');
        expect(missing).toEqual([['NOT_SET_XYZ', 'servers.a.env.TOKEN']]);
    });

    it('substitute recurses into dict and list', () => {
        process.env['X'] = '1';
        const missing: Array<[string, string]> = [];
        const result = substitute({ a: ['${env:X}', { b: '${env:X}' }] }, 'servers', missing);
        expect(result).toEqual({ a: ['1', { b: '1' }] });
        expect(missing).toEqual([]);
    });

    it('load_source rejects missing file', () => {
        const tmp = mkTmp();
        expect(() => load_source(path.join(tmp, 'missing.json'))).toThrow(/not found/);
    });

    it('load_source rejects invalid json', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 'bad.json'), '{ not valid', 'utf-8');
        expect(() => load_source(path.join(tmp, 'bad.json'))).toThrow(/Invalid JSON/);
    });

    it('load_source rejects missing servers key', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 's.json'), '{"foo": {}}', 'utf-8');
        expect(() => load_source(path.join(tmp, 's.json'))).toThrow(/top-level 'servers'/);
    });

    it('render maps servers to mcpServers', () => {
        process.env['GH_TOKEN'] = 'ghp_xxx';
        process.env['JIRA_TOKEN'] = 'jira_yyy';
        const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'source-valid.json'), 'utf-8'));
        const [rendered, missing] = render(data);
        expect(missing).toEqual([]);
        expect(rendered).toHaveProperty('mcpServers');
        expect(rendered).not.toHaveProperty('servers');
        const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'golden.json'), 'utf-8'));
        expect(rendered).toEqual(expected);
    });

    it('render missing vars produce named report', () => {
        delete process.env['GH_TOKEN'];
        delete process.env['JIRA_TOKEN'];
        const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'source-valid.json'), 'utf-8'));
        const [, missing] = render(data);
        const names = [...new Set(missing.map(([n]) => n))].sort();
        expect(names).toEqual(['GH_TOKEN', 'JIRA_TOKEN']);
        const report = format_missing_report(missing);
        expect(report).toContain('GH_TOKEN');
        expect(report).toContain('JIRA_TOKEN');
        expect(report).toContain('servers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN');
        expect(report).toContain('servers.jira.env.JIRA_TOKEN');
    });

    it('cli render writes targets', () => {
        const tmp = mkTmp();
        process.env['GH_TOKEN'] = 'ghp_xxx';
        process.env['JIRA_TOKEN'] = 'jira_yyy';
        const source = _writeSource(tmp);
        _claudeDesktop.target = path.join(tmp, 'claude', 'config.json');
        const rc = main(['--source', source, '--project-root', tmp]);
        expect(rc).toBe(0);
        const golden = fs.readFileSync(path.join(FIXTURES, 'golden.json'), 'utf-8');
        const expected = _pyDumpSorted(JSON.parse(golden)) + '\n';
        expect(fs.readFileSync(path.join(tmp, '.cursor', 'mcp.json'), 'utf-8')).toBe(expected);
        expect(fs.readFileSync(path.join(tmp, '.windsurf', 'mcp.json'), 'utf-8')).toBe(expected);
        expect(fs.existsSync(path.join(tmp, 'claude', 'config.json'))).toBe(false);
    });

    it('cli render includes claude desktop when opted in', () => {
        const tmp = mkTmp();
        process.env['GH_TOKEN'] = 'ghp_xxx';
        process.env['JIRA_TOKEN'] = 'jira_yyy';
        const source = _writeSource(tmp);
        _claudeDesktop.target = path.join(tmp, 'claude', 'config.json');
        const rc = main(['--source', source, '--project-root', tmp, '--claude-desktop']);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'claude', 'config.json'))).toBe(true);
    });

    it('cli render fails loud and writes nothing', () => {
        const tmp = mkTmp();
        delete process.env['GH_TOKEN'];
        delete process.env['JIRA_TOKEN'];
        const source = _writeSource(tmp);
        const errChunks: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stderr as any).write = (s: string) => {
            errChunks.push(String(s));
            return true;
        };
        let rc: number;
        try {
            rc = main(['--source', source, '--project-root', tmp]);
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (process.stderr as any).write = orig;
        }
        expect(rc).toBe(1);
        const err = errChunks.join('');
        expect(err).toContain('GH_TOKEN');
        expect(err).toContain('JIRA_TOKEN');
        expect(fs.existsSync(path.join(tmp, '.cursor'))).toBe(false);
    });

    it('cli render is idempotent', () => {
        const tmp = mkTmp();
        process.env['GH_TOKEN'] = 'ghp_xxx';
        process.env['JIRA_TOKEN'] = 'jira_yyy';
        const source = _writeSource(tmp);
        const target = path.join(tmp, '.cursor', 'mcp.json');
        _claudeDesktop.target = path.join(tmp, 'unused.json');
        const args = ['--source', source, '--project-root', tmp];
        expect(main(args)).toBe(0);
        const first = fs.readFileSync(target, 'utf-8');
        expect(main(args)).toBe(0);
        expect(fs.readFileSync(target, 'utf-8')).toBe(first);
        expect(main([...args, '--check'])).toBe(0);
    });

    it('cli check detects stale output', () => {
        const tmp = mkTmp();
        process.env['GH_TOKEN'] = 'ghp_xxx';
        process.env['JIRA_TOKEN'] = 'jira_yyy';
        const source = _writeSource(tmp);
        const target = path.join(tmp, '.cursor', 'mcp.json');
        _claudeDesktop.target = path.join(tmp, 'unused.json');
        fs.mkdirSync(path.dirname(target));
        fs.writeFileSync(target, '{}\n', 'utf-8');
        expect(main(['--source', source, '--project-root', tmp, '--check'])).toBe(1);
    });
});

// Local json.dumps(indent=2, sort_keys=True) for the expected-output assert.
function _pyDumpSorted(obj: unknown, depth = 0): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (obj === null) return 'null';
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'string') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        return '[\n' + obj.map((v) => padInner + _pyDumpSorted(v, depth + 1)).join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(obj as Record<string, unknown>).sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    if (entries.length === 0) return '{}';
    return (
        '{\n' +
        entries.map(([k, v]) => padInner + JSON.stringify(k) + ': ' + _pyDumpSorted(v, depth + 1)).join(',\n') +
        '\n' +
        pad +
        '}'
    );
}

// ---- Golden parity: python3 vs tsx CLI -------------------------------------

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_render.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_render.ts');
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

describe.skipIf(!py3)('mcp_render — golden parity (python3 vs tsx)', () => {
    let scratch: string;
    beforeEach(() => {
        scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-par-'));
        fs.writeFileSync(
            path.join(scratch, 'mcp.json'),
            fs.readFileSync(path.join(FIXTURES, 'source-valid.json'), 'utf-8'),
            'utf-8',
        );
    });
    afterEach(() => {
        try {
            fs.rmSync(scratch, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    function run(bin: string, args: string[], env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> {
        return spawnSync(bin, args, { cwd: scratch, encoding: 'utf8', env });
    }

    it('render → identical stdout/stderr/exit (env present)', () => {
        const env = { ...process.env, GH_TOKEN: 'ghp_xxx', JIRA_TOKEN: 'jira_yyy' };
        const source = path.join(scratch, 'mcp.json');
        const pyRoot = path.join(scratch, 'py');
        const tsRoot = path.join(scratch, 'ts');
        fs.mkdirSync(pyRoot);
        fs.mkdirSync(tsRoot);
        const p = run('python3', [PY_SCRIPT, '--source', source, '--project-root', pyRoot], env);
        const t = run(TSX_BIN, [TS_SCRIPT, '--source', source, '--project-root', tsRoot], env);
        // stdout names + paths differ by root dir; normalise the root.
        const pyOut = String(p.stdout ?? '').split(pyRoot).join('<ROOT>');
        const tsOut = String(t.stdout ?? '').split(tsRoot).join('<ROOT>');
        expect(tsOut).toBe(pyOut);
        expect(t.status).toBe(p.status);
        // Written target files byte-identical.
        const pyTarget = fs.readFileSync(path.join(pyRoot, '.cursor', 'mcp.json'), 'utf-8');
        const tsTarget = fs.readFileSync(path.join(tsRoot, '.cursor', 'mcp.json'), 'utf-8');
        expect(tsTarget).toBe(pyTarget);
    });

    it('missing env → identical stderr/exit', () => {
        const env = { ...process.env };
        delete env['GH_TOKEN'];
        delete env['JIRA_TOKEN'];
        const p = run('python3', [PY_SCRIPT, '--project-root', scratch], env);
        const t = run(TSX_BIN, [TS_SCRIPT, '--project-root', scratch], env);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    });
});
