// The dispatcher writes feedback AFTER it has computed its verdict, with no
// caller-side catch around the per-concern write. That is safe only while the
// write path reports failure instead of throwing, so these pin it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { execute, release, type Held } from '../../../src/scripts/_lib/generation_lock.js';
import { update_json_under_lock } from '../../../src/scripts/hooks/state_io.js';

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-no-throw-'));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('the feedback write path reports, it does not throw', () => {
    it('expire on a guard that is gone returns undefined instead of throwing', () => {
        const missing = path.join(dir, 'never-created.lock.held');
        expect(() => execute(['expire', missing])).not.toThrow();
        expect(execute(['expire', missing])).toBeUndefined();
    });

    it('release of a lock whose guard vanished does not throw', () => {
        for (const generation of [0, 3]) {
            const held: Held = { lockPath: path.join(dir, `gone-${String(generation)}.lock.held`), generation };
            expect(() => release(held)).not.toThrow();
        }
    });

    it('a mutator that throws is reported as failed, and the lock is released', () => {
        const target = path.join(dir, 'concern.json');
        const boom = (): never => {
            throw new Error('mutator failed');
        };
        expect(update_json_under_lock(target, boom)).toBe('failed');
        // Released: a second writer gets the lock and writes.
        expect(update_json_under_lock(target, () => ({ ok: true }))).toBe('written');
        expect(JSON.parse(fs.readFileSync(target, 'utf-8'))).toEqual({ ok: true });
    });

    it('an unwritable target directory is reported as failed', () => {
        const blocker = path.join(dir, 'a-file');
        fs.writeFileSync(blocker, '');
        expect(update_json_under_lock(path.join(blocker, 'sub', 'concern.json'), () => ({ ok: true }))).toBe('failed');
    });
});
