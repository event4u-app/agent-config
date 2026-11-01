import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { containedPath, writeContained } from '../../../src/scripts/_lib/contained_write.js';

let root: string;
let outside: string;

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cw-root-')));
    outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cw-out-')));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
});

describe('writeContained', () => {
    it('writes inside real directories it creates', () => {
        expect(writeContained(root, path.join(root, 'agents', 'map', '.build', 'x.json'), '{}')).toBe(true);
        expect(fs.readFileSync(path.join(root, 'agents', 'map', '.build', 'x.json'), 'utf-8')).toBe('{}');
    });

    it('refuses a symlinked ancestor and leaves the target untouched', () => {
        fs.mkdirSync(path.join(root, 'agents'));
        fs.symlinkSync(outside, path.join(root, 'agents', 'map'));
        expect(writeContained(root, path.join(root, 'agents', 'map', '.build', 'x.json'), '{}')).toBe(false);
        expect(fs.readdirSync(outside)).toEqual([]);
    });

    it('refuses a symlink at the target itself', () => {
        fs.mkdirSync(path.join(root, 'd'));
        fs.writeFileSync(path.join(outside, 'victim'), 'keep');
        fs.symlinkSync(path.join(outside, 'victim'), path.join(root, 'd', 'x.json'));
        expect(writeContained(root, path.join(root, 'd', 'x.json'), 'overwritten')).toBe(false);
        expect(fs.readFileSync(path.join(outside, 'victim'), 'utf-8')).toBe('keep');
    });

    it('refuses a path outside the root', () => {
        expect(containedPath(root, outside)).toBe(false);
        expect(writeContained(root, path.join(outside, 'x'), '{}')).toBe(false);
    });
});
