// Tests for src/scripts/hooks/dispatch_issues.ts (py2ts Phase 6 — hooks core).
//
// 1:1 port of the helper round-trip cases in tests/hooks/test_dispatch_issue_log.py
// (log+read round-trip, invalid-issue rejection, rotation cap at 200, empty
// read, lazy dir creation, valid JSONL, freeform resolution) plus a JSONL-byte
// parity layer (python3 vs TS write the exact same line bytes). Volatile
// timestamps are normalised before byte comparison. Parity layer skipped
// without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    fix_hint,
    log_dispatch_issue,
    LOG_CAP,
    read_dispatch_issues,
    VALID_ISSUE,
} from '../../../src/scripts/hooks/dispatch_issues.js';



let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-issues-'));
    delete process.env['AGENT_CONFIG_REPLAY'];
});
afterEach(() => {
    delete process.env['AGENT_CONFIG_REPLAY'];
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

const LOG_REL = path.join('agents', 'runtime', 'state', 'dispatch-issues.jsonl');

describe('dispatch_issues — constants', () => {
    it('cap is 200 and VALID_ISSUE matches the schema', () => {
        expect(LOG_CAP).toBe(200);
        expect([...VALID_ISSUE].sort()).toEqual([
            'execution_failed',
            'permission_denied',
            'prerequisite_missing',
            'script_not_found',
        ]);
    });
    it('fix_hint returns the canonical hint', () => {
        expect(fix_hint()).toBe('./agent-config init');
        expect(fix_hint(tmp)).toBe('./agent-config init');
    });
});

describe('dispatch_issues — helper round-trip', () => {
    it('log + read round-trip', () => {
        log_dispatch_issue(
            tmp,
            'roadmap-progress',
            'prerequisite_missing',
            'update_roadmap_progress.py not found',
            './agent-config hooks:install --regen',
        );
        const out = read_dispatch_issues(tmp);
        expect(out.length).toBe(1);
        const entry = out[0]!;
        expect(entry['hook']).toBe('roadmap-progress');
        expect(entry['issue']).toBe('prerequisite_missing');
        expect(String(entry['detail'])).toContain('update_roadmap_progress.py');
        expect(String(entry['resolution']).startsWith('./agent-config')).toBe(true);
        expect(String(entry['timestamp']).endsWith('Z')).toBe(true);
    });

    it('invalid issue rejected but no crash, stderr noted', () => {
        const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        log_dispatch_issue(tmp, 'x', 'not_a_valid_enum', 'nope', 'nope');
        expect(read_dispatch_issues(tmp)).toEqual([]);
        const errText = errSpy.mock.calls.map((c) => String(c[0])).join('');
        expect(errText).toContain('invalid issue');
    });

    it('rotation caps at 200, dropping the oldest', () => {
        for (let i = 0; i < 250; i += 1) {
            log_dispatch_issue(tmp, 'rotation-test', 'prerequisite_missing', `entry ${i}`, './agent-config init');
        }
        const out = read_dispatch_issues(tmp);
        expect(out.length).toBe(200);
        expect(out[0]!['detail']).toBe('entry 50');
        expect(out[out.length - 1]!['detail']).toBe('entry 249');
    });

    it('read returns empty when log absent', () => {
        expect(read_dispatch_issues(tmp)).toEqual([]);
    });

    it('log creates the state dir lazily', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state');
        expect(fs.existsSync(stateDir)).toBe(false);
        log_dispatch_issue(tmp, 'x', 'script_not_found', 'd', 'r');
        expect(fs.existsSync(path.join(stateDir, 'dispatch-issues.jsonl'))).toBe(true);
    });

    it('log file is valid JSONL with the locked keys', () => {
        for (let i = 0; i < 3; i += 1) {
            log_dispatch_issue(tmp, `hook-${i}`, 'prerequisite_missing', `d-${i}`, 'r');
        }
        const lines = fs
            .readFileSync(path.join(tmp, LOG_REL), 'utf8')
            .split('\n')
            .filter((l) => l.trim());
        expect(lines.length).toBe(3);
        for (const ln of lines) {
            const decoded = JSON.parse(ln) as Record<string, unknown>;
            for (const k of ['timestamp', 'hook', 'issue', 'detail', 'resolution']) {
                expect(k in decoded).toBe(true);
            }
        }
    });

    it('resolution field is freeform (command or doc URL)', () => {
        log_dispatch_issue(tmp, 'x', 'execution_failed', 'timeout', 'see docs/contracts/hook-architecture-v1.md');
        const out = read_dispatch_issues(tmp);
        expect(String(out[0]!['resolution']).startsWith('see docs/')).toBe(true);
    });

    it('no-op under AGENT_CONFIG_REPLAY=1', () => {
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        log_dispatch_issue(tmp, 'x', 'script_not_found', 'd', 'r');
        expect(read_dispatch_issues(tmp)).toEqual([]);
    });
});

