/**
 * The share reader — it publishes a number, so it must not be able to publish
 * a comfortable one by accident.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main, report, shareOf } from '../../src/scripts/roadmap_verify_share.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-share-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('roadmap_verify_share — the unit is a step block, not a line', () => {
    it('counts a wrapped clause once', () => {
        const md = ['## Phase 1', '', '- [ ] **1.1** do the thing', '      across two lines', '      verify: `cmd`'].join(
            '\n',
        );
        expect(shareOf('x.md', md)).toMatchObject({ clauses: 1, withCommand: 1, withExpectation: 0 });
    });

    it('counts a closed step — a flipped box is the defect in its completed form', () => {
        expect(shareOf('x.md', '## P\n- [x] **1.1** done\n      verify: `cmd` -> 0\n')).toMatchObject({
            clauses: 1,
            withCommand: 1,
            withExpectation: 1,
        });
    });

    it('does not count prose that merely mentions the token', () => {
        expect(shareOf('x.md', '## P\n\nA `verify:` clause names a command.\n').clauses).toBe(0);
    });

    it('does not count a fenced example', () => {
        expect(shareOf('x.md', '## P\n\n```\n- [ ] x\n      verify: `cmd` -> 0\n```\n').clauses).toBe(0);
    });

    it('separates the runnable share from the falsifiable one', () => {
        const md = [
            '## P',
            '- [ ] **1.1** a',
            '      verify: `cmd-a`',
            '- [ ] **1.2** b',
            '      verify: `cmd-b` -> 0',
            '- [ ] **1.3** c',
            '      verify: a human reads it',
        ].join('\n');
        expect(shareOf('x.md', md)).toMatchObject({ clauses: 3, withCommand: 2, withExpectation: 1 });
    });
});

describe('roadmap_verify_share — it refuses an empty corpus', () => {
    it('throws on a root holding no roadmaps, rather than publishing a clean zero', () => {
        // The positive control for this absence check: the SAME root with one
        // roadmap in it reports 1 file (below). Without that pairing, a green
        // here would be indistinguishable from a reader that walked nothing.
        expect(() => report(tmp, 'tmp', false)).toThrow(/scanned 0 roadmap/);
    });

    it('does not throw once the same root holds one roadmap — the positive control', () => {
        fs.writeFileSync(path.join(tmp, 'r.md'), '## P\n- [ ] **1.1** a\n      verify: `cmd` -> 0\n');
        expect(report(tmp, 'tmp', false)).toMatchObject({ files: 1, clauses: 1, withExpectation: 1 });
    });

    it('exits 2 rather than 0 when the CLI meets a dead root', () => {
        expect(main(['--root', tmp])).toBe(2);
    });

    it('exits 0 on the real tree — a reader, never a gate', () => {
        expect(main(['--json'])).toBe(0);
    });
});
