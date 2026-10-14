// Tests for src/scripts/_lib/loop_guards.ts
// (road-to-skill-ecosystem-runtime-enforcement Phase 5 Steps 2-4).
//
// A loop guard that silently stops guarding looks exactly like one that works,
// so each test targets the failure mode rather than the happy path. The
// whole-line marker and dependency-scan cases left with their subjects, removed
// on 2026-10-14 by owner decision together with the continuation ladder.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { atomicWriteJson, stallSignal } from '../../src/scripts/_lib/loop_guards.js';

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

describe('stallSignal', () => {
    it('reports PROGRESSING on a new minimum — the primary signal', () => {
        const s = stallSignal([9, 7, 5]);
        expect(s.level).toBe('progressing');
        expect(s.newMinimum).toBe(true);
        expect(s.minimum).toBe(5);
    });

    it('reports STALLED on a full window of identical readings', () => {
        const s = stallSignal([9, 7, 7, 7], 3);
        expect(s.level).toBe('stalled');
        expect(s.flatRun).toBe(3);
    });

    it('is FLAT, not stalled, before the window fills', () => {
        expect(stallSignal([7, 7], 3).level).toBe('flat');
    });

    it('is FLAT when the count ROSE — regression is not progress, and not a stall either', () => {
        // A rising count means work was ADDED. Calling it progress would let a
        // growing plan keep the budget alive forever; calling it a stall would
        // halt a run that is doing exactly what it should.
        expect(stallSignal([5, 5, 9], 3).level).toBe('flat');
    });

    it('does not call a return to a PREVIOUS minimum a new minimum', () => {
        // 5 was already reached; coming back to it is not fresh progress.
        expect(stallSignal([5, 9, 5], 3).newMinimum).toBe(false);
    });

    it('handles an empty history without pretending to know anything', () => {
        expect(stallSignal([])).toEqual({ level: 'flat', flatRun: 0, minimum: null, newMinimum: false });
    });
});
