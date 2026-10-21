/**
 * The run-scoped temp root guards itself.
 *
 * `tests/_lib/isolate-tmpdir.ts` points `TMPDIR` at a directory the run owns and
 * deletes. Without it the suite leaks one directory per test file into the
 * user's real `$TMPDIR` — enough, on 2026-10-21, to make every shell start block
 * for 9-35 s. Removing the `globalSetup` entry keeps the suite green and brings
 * the leak back silently, so the wiring is asserted, not trusted.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    createRunRoot,
    fitsSocketPath,
    isolate,
    ISOLATION_SKIPPED_VAR,
    MAX_SOCKET_PATH,
    RUN_ROOT_PREFIX,
    STALE_AFTER_MS,
    sweepStaleRunRoots,
} from '../_lib/isolate-tmpdir.js';

describe('the suite runs inside a run-scoped temp root', () => {
    it('os.tmpdir() resolves inside an ac-vitest-* root, unless setup declined for the socket limit', () => {
        const segments = fs.realpathSync(os.tmpdir()).split(path.sep);
        const isolated = segments.some((segment) => segment.startsWith(RUN_ROOT_PREFIX));
        const declined = process.env[ISOLATION_SKIPPED_VAR] === '1';
        expect(
            isolated || declined,
            `os.tmpdir() is ${os.tmpdir()} — \`globalSetup: ["tests/_lib/isolate-tmpdir.ts"]\` ` +
                'is missing from vitest.config.ts, so every mkdtempSync in the suite leaks ' +
                "into the user's real temp directory.",
        ).toBe(true);
    });
});

describe('sweepStaleRunRoots', () => {
    let base: string;

    afterEach(() => {
        fs.rmSync(base, { recursive: true, force: true });
    });

    it('removes stale run roots and keeps young roots and foreign entries', () => {
        base = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-'));
        const now = Date.now();
        const stale = createRunRoot(base);
        const young = createRunRoot(base);
        const foreign = fs.mkdtempSync(path.join(base, 'someone-else-'));
        const old = new Date(now - STALE_AFTER_MS - 60_000);
        fs.utimesSync(stale, old, old);
        fs.utimesSync(foreign, old, old);

        const removed = sweepStaleRunRoots(base, now);

        expect(removed).toEqual([path.basename(stale)]);
        expect(fs.existsSync(stale)).toBe(false);
        expect(fs.existsSync(young)).toBe(true);
        expect(fs.existsSync(foreign)).toBe(true);
    });

    it('returns nothing for a base that does not exist', () => {
        base = path.join(os.tmpdir(), 'does-not-exist');
        expect(sweepStaleRunRoots(base)).toEqual([]);
    });
});

describe('fitsSocketPath', () => {
    it('accepts a run root under a real macOS $TMPDIR', () => {
        expect(fitsSocketPath(`/var/folders/_s/c58ktjj93tx8zsw3x69wrbch0000gn/T/${RUN_ROOT_PREFIX}AbC123`)).toBe(true);
    });

    it('rejects a root whose tsx pipe would exceed the socket limit', () => {
        const root = `/${'x'.repeat(MAX_SOCKET_PATH)}`;
        expect(fitsSocketPath(root)).toBe(false);
    });
});

describe('isolate and its teardown', () => {
    let base: string;

    afterEach(() => {
        fs.rmSync(base, { recursive: true, force: true });
    });

    it('repoints every temp variable, then removes the root and restores them', () => {
        // A short base: this test already runs inside a run root, and nesting a
        // second one there would cross the socket limit and take the skip path.
        base = fs.mkdtempSync('/tmp/iso-');
        const before = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
        const teardown = isolate(base);
        const root = process.env.TMPDIR as string;
        try {
            expect(path.dirname(root)).toBe(base);
            expect(path.basename(root).startsWith(RUN_ROOT_PREFIX)).toBe(true);
            expect(process.env.TEMP).toBe(root);
            expect(process.env.TMP).toBe(root);
            fs.mkdtempSync(path.join(root, 'leaked-'));
        } finally {
            teardown();
        }
        expect(fs.existsSync(root)).toBe(false);
        expect({ TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP }).toEqual(before);
    });

    it('declines to isolate under a base too long for a tsx socket, and says so', () => {
        base = fs.mkdtempSync('/tmp/iso-');
        const deep = path.join(base, 'd'.repeat(MAX_SOCKET_PATH - base.length - 10));
        fs.mkdirSync(deep);
        const before = process.env.TMPDIR;
        const teardown = isolate(deep);
        try {
            expect(process.env.TMPDIR).toBe(before);
            expect(process.env[ISOLATION_SKIPPED_VAR]).toBe('1');
            expect(fs.readdirSync(deep)).toEqual([]);
        } finally {
            teardown();
        }
        expect(process.env[ISOLATION_SKIPPED_VAR]).toBeUndefined();
    });
});
