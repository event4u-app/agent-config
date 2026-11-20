// feedback_policy — only an outcome worth reading on its own keeps a
// per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dropStaleFeedback, isQuietAllow } from '../../../src/scripts/hooks/feedback_policy.js';

const allow = { concern: 'c', exit_code: 0, raw_exit_code: 0, decision: 'allow', reason: null };

describe('feedback_policy — isQuietAllow', () => {
    it('a plain allow is quiet', () => {
        expect(isQuietAllow(allow)).toBe(true);
        expect(isQuietAllow({ ...allow, reason: undefined })).toBe(true);
    });

    it('a warn, a block, a crash resolved to allow, a non-allow decision or a reason keep their file', () => {
        expect(isQuietAllow({ ...allow, exit_code: 1, decision: 'warn' })).toBe(false);
        expect(isQuietAllow({ ...allow, exit_code: 2, decision: 'block' })).toBe(false);
        expect(isQuietAllow({ ...allow, raw_exit_code: 3 })).toBe(false);
        expect(isQuietAllow({ ...allow, decision: 'ask' })).toBe(false);
        expect(isQuietAllow({ ...allow, reason: 'context injected' })).toBe(false);
    });
});

describe('feedback_policy — dropStaleFeedback', () => {
    it('a quiet allow removes the warning an earlier run left, and a missing file is not an error', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-policy-'));
        try {
            const f = path.join(dir, 'c.json');
            fs.writeFileSync(f, JSON.stringify({ decision: 'warn' }));
            dropStaleFeedback(f);
            expect(fs.existsSync(f)).toBe(false);
            expect(() => dropStaleFeedback(f)).not.toThrow();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
