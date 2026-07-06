// Tests for src/scripts/mine_session.ts (py2ts Phase 8 / Wave 8g).
//
// 1:1 port of tests/test_mine_session.py — opt-in gate, unsupported-host
// exit, --preview writes nothing, redaction of user names, ≤5-fact cap, the
// commit-intake JSONL shape, and the three signal classes from the direct
// mine() call. Plus determinism intent tests on the committed mine-session
// fixture (fixed turn timestamps → preview + intake output is stable).
// Intake writes target os.tmpdir(); the committed fixture is read-only.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { mine, _iterClaudeCodeJsonl } from '../../src/scripts/mine_session.js';
import { REPO_ROOT, runTs } from './_wave8g.js';

const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'mine-session', 'session.jsonl');

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

    it('cross-host mines via the override source', () => {
        // Mining is cross-host now — any host mines via the override source.
        // The former 'No TranscriptAdapter for host=X' rejection is gone: the
        // chat-history JSONL log is written by hooks on every host, so mining
        // no longer special-cases claude-code.
        const r = runTsScript(['--confirm-transcript-access', '--host', 'cursor', '--transcript', FIXTURE]);
        expect(r.status).toBe(0);
        expect(r.stdout).not.toContain('No TranscriptAdapter');
        expect(r.stdout).toContain('Mining preview');
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
        const facts = mine(_iterClaudeCodeJsonl(FIXTURE), since, [], 'testsess');
        const types = new Set(facts.map((f) => f.type as string));
        for (const expected of ['convention', 'gotcha', 'invariant']) {
            expect([...types], `types=${[...types].join(',')}`).toContain(expected);
        }
    });
});

// NOTE (converted from the retired python-parity block): the former
// "opt-in gate + unsupported host messages byte-identical" test is fully
// redundant with the python-free CLI tests above — 'opt-in required' covers
// the no-confirm arg combo (exit 0 + the --confirm-transcript-access hint)
// and 'cross-host mines via the override source' covers the --host cursor
// combo (exit 0 + preview emitted) — so it was deleted, not converted.
describe('mine_session — CLI determinism on the committed fixture (tsx)', () => {
    it('preview with --project is deterministic and carries the header + schema summary', () => {
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
        const first = runTs('mine_session', args);
        expect(first.status).toBe(0);
        expect(first.stderr).toBe('');
        expect(first.stdout).toContain(
            '## Mining preview — fixture · since 2026-05-01 · host=claude-code',
        );
        expect(first.stdout).toMatch(/^Schemas touched: [a-z, ]+$/m);
        // Fixed turn timestamps in the fixture → repeated runs are stable.
        const second = runTs('mine_session', args);
        expect(second.stdout).toBe(first.stdout);
    });

    it('commit-intake JSONL files are deterministic across runs', () => {
        const rootA = path.join(mkTmp(), 'a');
        const rootB = path.join(mkTmp(), 'b');
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
        const a = runTs('mine_session', [...base, '--intake-root', rootA]);
        const b = runTs('mine_session', [...base, '--intake-root', rootB]);
        expect(a.status).toBe(0);
        expect(b.status).toBe(0);
        expect(b.stdout).toBe(a.stdout);
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
        const filesA = readAll(rootA);
        expect(Object.keys(filesA).length).toBeGreaterThan(0);
        // One <type>.jsonl per mined schema class, identical across runs.
        expect(readAll(rootB)).toEqual(filesA);
    });
});
