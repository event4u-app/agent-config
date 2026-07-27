import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { enabled, runLearn } from '../../src/scripts/memory_learn_hook.js';

let tmp: string;

function writeSettings(root: string, body: string): void {
    fs.writeFileSync(path.join(root, '.agent-settings.yml'), body, 'utf8');
}

function seedIntake(root: string): void {
    const intake = path.join(root, 'agents', 'memory', 'intake');
    fs.mkdirSync(intake, { recursive: true });
    const lines: string[] = [];
    for (let i = 0; i < 4; i++) {
        lines.push(
            JSON.stringify({
                id: `s${i}`,
                ts: `2026-07-${20 + i}T10:00:00Z`,
                entry_type: 'historical-patterns',
                path: 'src/x.ts',
                body: 'Use helper',
                origin: i % 2 === 0 ? 'claude' : 'cursor',
                polarity: 'preferred',
            }),
        );
    }
    fs.writeFileSync(path.join(intake, 'signals-2026-07.jsonl'), `${lines.join('\n')}\n`, 'utf8');
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-learn-hook-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('enabled() — settings mini-parser', () => {
    it('defaults to false with no settings file', () => {
        expect(enabled(tmp)).toBe(false);
    });
    it('reads memory.learn_on_session_end: true', () => {
        writeSettings(tmp, 'memory:\n  learn_on_session_end: true\n');
        expect(enabled(tmp)).toBe(true);
    });
    it('stays false when the key is false or in another block', () => {
        writeSettings(tmp, 'memory:\n  learn_on_session_end: false\n');
        expect(enabled(tmp)).toBe(false);
        writeSettings(tmp, 'other:\n  learn_on_session_end: true\nmemory:\n  visibility: on\n');
        expect(enabled(tmp)).toBe(false);
    });
});

describe('runLearn() — budget-capped, fail-open aggregation', () => {
    it('returns null (no write) when the intake dir is absent', () => {
        expect(runLearn(tmp, '2026-07-27T00:00:00Z')).toBeNull();
    });
    it('writes sidecar + lessons and returns the visibility marker', () => {
        seedIntake(tmp);
        const marker = runLearn(tmp, '2026-07-27T00:00:00Z');
        expect(marker).toMatch(/^🧠 Memory: sidecar refreshed — 1 lesson/u);
        expect(marker).toContain('/memory:propose');
        expect(fs.existsSync(path.join(tmp, 'agents', 'memory', '.agent-learning.json'))).toBe(true);
        expect(fs.existsSync(path.join(tmp, 'agents', 'memory', 'LESSONS.md'))).toBe(true);
    });
    it('never writes curated YAML (promotion stays human)', () => {
        seedIntake(tmp);
        runLearn(tmp, '2026-07-27T00:00:00Z');
        const files = fs.readdirSync(path.join(tmp, 'agents', 'memory'));
        expect(files.filter((f) => f.endsWith('.yml'))).toEqual([]);
    });
});

describe('hook entry — default-off no-op, fail-open', () => {
    it('exits 0 and prints nothing when the setting is off', () => {
        seedIntake(tmp);
        const out = execFileSync(
            'npx',
            ['tsx', path.resolve('src/scripts/memory_learn_hook.ts')],
            { cwd: tmp, encoding: 'utf8' },
        );
        expect(out).toBe('');
        expect(fs.existsSync(path.join(tmp, 'agents', 'memory', 'LESSONS.md'))).toBe(false);
    });
    it('exits 0 with the marker when enabled', () => {
        seedIntake(tmp);
        writeSettings(tmp, 'memory:\n  learn_on_session_end: true\n');
        const out = execFileSync(
            'npx',
            ['tsx', path.resolve('src/scripts/memory_learn_hook.ts')],
            { cwd: tmp, encoding: 'utf8' },
        );
        expect(out).toMatch(/🧠 Memory: sidecar refreshed/u);
    });
});
