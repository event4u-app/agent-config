// Tests for src/scripts/mine_session.ts (py2ts Phase 8 / Wave 8g).
//
// 1:1 port of tests/test_mine_session.py — opt-in gate, unsupported-host
// exit, --preview writes nothing, redaction of user names, ≤5-fact cap, the
// commit-intake JSONL shape, and the three signal classes from the direct
// mine() call. Plus golden parity (python3 vs tsx) on the committed
// dream-skill fixture. Intake writes target os.tmpdir(); the committed
// fixture is read-only.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { mine } from '../../src/scripts/mine_session.js';
import { REPO_ROOT, hasPython3, runPy, runTs } from './_wave8g.js';

const py3 = hasPython3();
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'dream-skill', 'session.jsonl');

const tmp: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mine8g-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) {
        fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    }
});

function runTsScript(args: string[]): ReturnType<typeof runTs> {
    return runTs('mine_session', args);
}

describe('mine_session — CLI gates (1:1 port, via tsx)', () => {
    it('opt-in required — no transcript read', () => {
        const outRoot = path.join(mkTmp(), 'intake');
        const r = runTsScript(['--transcript', FIXTURE, '--intake-root', outRoot, '--commit-intake']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('--confirm-transcript-access');
        expect(fs.existsSync(outRoot)).toBe(false);
    });

    it('unsupported host exits clean', () => {
        const r = runTsScript(['--confirm-transcript-access', '--host', 'cursor', '--transcript', FIXTURE]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No TranscriptAdapter for host=cursor');
        expect(r.stdout).toContain('claude-code');
    });

    it('--preview default writes nothing', () => {
        const outRoot = path.join(mkTmp(), 'intake');
        const r = runTsScript([
            '--confirm-transcript-access',
            '--transcript',
            FIXTURE,
            '--intake-root',
            outRoot,
            '--since',
            '2026-05-01',
        ]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('Mining preview');
        expect(fs.existsSync(outRoot)).toBe(false);
    });

    it('preview redacts user names', () => {
        const r = runTsScript([
            '--confirm-transcript-access',
            '--transcript',
            FIXTURE,
            '--intake-root',
            path.join(mkTmp(), 'intake'),
            '--since',
            '2026-05-01',
        ]);
        expect(r.status).toBe(0);
        expect(r.stdout).not.toContain('Matze');
        expect(r.stdout).not.toContain('Mathias');
        expect(r.stdout).toContain('<user>');
    });

    it('preview caps facts at five', () => {
        const r = runTsScript([
            '--confirm-transcript-access',
            '--transcript',
            FIXTURE,
            '--intake-root',
            path.join(mkTmp(), 'intake'),
            '--since',
            '2026-05-01',
        ]);
        expect(r.status).toBe(0);
        const rows = r.stdout
            .split('\n')
            .filter((ln) => ln.startsWith('| ') && !ln.startsWith('| #') && !ln.startsWith('|---'));
        expect(rows.length).toBeLessThanOrEqual(5);
    });

    it('commit-intake appends contract-shaped JSONL', () => {
        const outRoot = path.join(mkTmp(), 'intake');
        const r = runTsScript([
            '--confirm-transcript-access',
            '--commit-intake',
            '--transcript',
            FIXTURE,
            '--intake-root',
            outRoot,
            '--since',
            '2026-05-01',
        ]);
        expect(r.status).toBe(0);
        expect(fs.existsSync(outRoot)).toBe(true);
        const files = fs
            .readdirSync(outRoot)
            .filter((f) => f.endsWith('.jsonl'))
            .sort();
        expect(files.length).toBeGreaterThan(0);
        const required = ['ts', 'type', 'key', 'observation', 'source', 'session_id', 'tags'];
        let total = 0;
        for (const f of files) {
            for (const ln of fs.readFileSync(path.join(outRoot, f), 'utf-8').split('\n')) {
                if (!ln.trim()) {
                    continue;
                }
                const obj = JSON.parse(ln) as Record<string, unknown>;
                for (const k of required) {
                    expect(Object.keys(obj)).toContain(k);
                }
                expect(obj.source).toBe('agent');
                expect(Array.isArray(obj.tags)).toBe(true);
                expect(String(obj.observation)).not.toContain('Matze');
                expect(String(obj.observation)).not.toContain('Mathias');
                total += 1;
            }
        }
        expect(total).toBeGreaterThanOrEqual(1);
        expect(total).toBeLessThanOrEqual(5);
    });
});

describe('mine_session.mine — direct call (1:1 port)', () => {
    it('returns the three signal classes', () => {
        const since = new Date(Date.UTC(2026, 4, 1));
        const facts = mine(FIXTURE, since, []);
        const types = new Set(facts.map((f) => f.type as string));
        for (const expected of ['convention', 'gotcha', 'invariant']) {
            expect([...types], `types=${[...types].join(',')}`).toContain(expected);
        }
    });
});

describe.skipIf(!py3)('mine_session — golden parity (python3 vs tsx)', () => {
    it('preview byte-identical on the committed fixture', () => {
        const args = [
            '--confirm-transcript-access',
            '--transcript',
            FIXTURE,
            '--intake-root',
            path.join(mkTmp(), 'intake'),
            '--since',
            '2026-05-01',
            '--project',
            'fixture',
        ];
        const py = runPy('mine_session', args);
        const ts = runTs('mine_session', args);
        expect(py.status).toBe(0);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('opt-in gate + unsupported host messages byte-identical', () => {
        for (const args of [
            ['--transcript', FIXTURE, '--intake-root', path.join(mkTmp(), 'intake')],
            ['--confirm-transcript-access', '--host', 'cursor', '--transcript', FIXTURE],
        ]) {
            const py = runPy('mine_session', args);
            const ts = runTs('mine_session', args);
            expect(ts.stdout, args.join(' ')).toBe(py.stdout);
            expect(ts.status).toBe(py.status);
        }
    });

    it('commit-intake JSONL files byte-identical', () => {
        const pyRoot = path.join(mkTmp(), 'py');
        const tsRoot = path.join(mkTmp(), 'ts');
        const base = [
            '--confirm-transcript-access',
            '--commit-intake',
            '--transcript',
            FIXTURE,
            '--since',
            '2026-05-01',
            '--project',
            'fixture',
        ];
        const py = runPy('mine_session', [...base, '--intake-root', pyRoot]);
        const ts = runTs('mine_session', [...base, '--intake-root', tsRoot]);
        expect(py.status).toBe(0);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        const readAll = (root: string): Record<string, string> => {
            const map: Record<string, string> = {};
            if (!fs.existsSync(root)) {
                return map;
            }
            for (const f of fs.readdirSync(root).sort()) {
                map[f] = fs.readFileSync(path.join(root, f), 'utf-8');
            }
            return map;
        };
        expect(readAll(tsRoot)).toEqual(readAll(pyRoot));
    });
});
