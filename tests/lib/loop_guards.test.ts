// Tests for src/scripts/_lib/loop_guards.ts
// (road-to-skill-ecosystem-runtime-enforcement Phase 5 Steps 2-4).
//
// All three primitives guard a loop, and a loop guard that silently stops
// guarding looks exactly like one that works — so each test targets the failure
// mode rather than the happy path: a torn budget write, a marker matched inside
// a sentence, and a stale authentication error halting a healthy run.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    atomicWriteJson,
    detectUnavailableDependency,
    matchesWholeLine,
} from '../../src/scripts/_lib/loop_guards.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'loopguard-')));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('atomicWriteJson', () => {
    it('writes a readable record and creates the directory', () => {
        const f = path.join(tmp, 'nested', 'state.json');
        expect(atomicWriteJson(f, { iterations: 3 })).toBe(true);
        expect(JSON.parse(fs.readFileSync(f, 'utf8'))).toEqual({ iterations: 3 });
    });

    it('leaves NO temp file behind on success — a stray temp is a later false read', () => {
        const f = path.join(tmp, 'state.json');
        atomicWriteJson(f, { a: 1 });
        expect(fs.readdirSync(tmp)).toEqual(['state.json']);
    });

    it('returns false and cleans up when the target cannot be written', () => {
        // A directory where the file should be: rename fails, and the budget
        // writer must report that rather than throw — a throwing budget writer
        // turns an observability concern into a turn-end failure.
        const f = path.join(tmp, 'blocked');
        fs.mkdirSync(f);
        expect(atomicWriteJson(f, { a: 1 })).toBe(false);
        expect(fs.readdirSync(tmp)).toEqual(['blocked']);
    });

    it('replaces an existing record rather than appending to it', () => {
        const f = path.join(tmp, 'state.json');
        atomicWriteJson(f, { iterations: 1 });
        atomicWriteJson(f, { iterations: 2 });
        expect(JSON.parse(fs.readFileSync(f, 'utf8'))).toEqual({ iterations: 2 });
    });
});

describe('matchesWholeLine', () => {
    it('matches the marker alone on a line', () => {
        expect(matchesWholeLine('work\nRUN-COMPLETE\nmore', 'RUN-COMPLETE')).toBe(true);
    });

    it('does NOT match the marker inside a sentence — the whole point', () => {
        // A substring match lets a transcript sentence terminate the run.
        expect(matchesWholeLine('exit when you print RUN-COMPLETE at the end', 'RUN-COMPLETE')).toBe(false);
    });

    it('does NOT match a marker with a trailing qualifier', () => {
        expect(matchesWholeLine('RUN-COMPLETE (probably)', 'RUN-COMPLETE')).toBe(false);
    });

    it('tolerates surrounding whitespace, which a terminal or JSON round-trip adds', () => {
        expect(matchesWholeLine('  RUN-COMPLETE  \n', 'RUN-COMPLETE')).toBe(true);
    });

    it('never matches an empty marker — that would match every blank line', () => {
        expect(matchesWholeLine('\n\n', '')).toBe(false);
    });
});

describe('detectUnavailableDependency', () => {
    it.each([
        ['bash: gh: command not found', 'binary'],
        ['Error: not authenticated', 'credential'],
        ['GITHUB_TOKEN is not set — missing token', 'credential'],
        ['remote: Permission denied', 'permission'],
        ['429 Too Many Requests', 'quota'],
        ['503 Service Unavailable', 'service'],
    ])('classifies %s as %s', (line, kind) => {
        expect(detectUnavailableDependency(line)?.kind).toBe(kind);
    });

    it('returns null on ordinary failure output — a loop SHOULD iterate on those', () => {
        // The whole risk of this detector is over-firing: a general
        // "looks like an error" heuristic would end runs on test failures,
        // which are exactly what the loop exists to work through.
        expect(detectUnavailableDependency('FAIL tests/x.test.ts — expected 1 to be 2')).toBeNull();
        expect(detectUnavailableDependency('TypeError: cannot read property of undefined')).toBeNull();
    });

    it('scans only the TAIL — a failure that was already fixed must not halt the run', () => {
        const old = 'Permission denied\n' + Array.from({ length: 50 }, (_, i) => `line ${String(i)}`).join('\n');
        expect(detectUnavailableDependency(old, 10)).toBeNull();
        // …and the same text IS found when the window covers it.
        expect(detectUnavailableDependency(old, 100)?.kind).toBe('permission');
    });

    it('carries the evidence line, so a halt names what is missing', () => {
        const d = detectUnavailableDependency('gh: command not found');
        expect(d?.evidence).toContain('command not found');
    });
});
