import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as NodeFs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Filesystem faults a real disk will not produce on demand: a `close` that
 * fails, a `close` that fails AFTER a read already failed, and a programming
 * error out of `lstat`. `node:fs` is mocked in this file only, with each fault
 * armed per case and every call otherwise delegating to the real module, so the
 * other suites keep a real filesystem.
 */
const faults: { close?: unknown; read?: unknown; lstat?: unknown } = {};

vi.mock('node:fs', async (importOriginal) => {
    const real = await importOriginal<typeof NodeFs>();
    const wrapped = {
        ...real,
        closeSync: (fd: number) => {
            real.closeSync(fd);
            if (faults.close !== undefined) {
                throw faults.close;
            }
        },
        readFileSync: ((...args: Parameters<typeof real.readFileSync>) => {
            if (faults.read !== undefined && typeof args[0] === 'number') {
                throw faults.read;
            }
            return real.readFileSync(...args);
        }) as typeof real.readFileSync,
        lstatSync: ((...args: Parameters<typeof real.lstatSync>) => {
            if (faults.lstat !== undefined) {
                throw faults.lstat;
            }
            return real.lstatSync(...args);
        }) as typeof real.lstatSync,
    };
    return { ...wrapped, default: wrapped };
});

const fs = await import('node:fs');
const { readGatedFile, subjectDigest, GatedFileUnreadable } = await import(
    '../../src/scripts/_lib/ratification_subject.js'
);

const KERNEL = 'src/rules/commit-policy.md';

function osError(code: string, errno: number, syscall: string): NodeJS.ErrnoException {
    return Object.assign(new Error(`${code}: ${syscall}`), { code, errno, syscall });
}

function tmpKernel(body: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-fault-'));
    fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
    fs.writeFileSync(path.join(root, KERNEL), body);
    return root;
}

afterEach(() => {
    delete faults.close;
    delete faults.read;
    delete faults.lstat;
});

describe('the close is inside the translation', () => {
    /**
     * Step 2.4, round 3 of the 2026-10-13 review:
     *
     * > "An `EIO`, `EINTR`, or similar close failure therefore escapes as a raw
     * > Node error. It can also replace a successfully translated read error
     * > because an exception from `finally` overrides the pending exception."
     */
    it('a close failure after a successful read is a typed refusal, not a raw error', () => {
        const root = tmpKernel('one\n');
        faults.close = osError('EIO', -5, 'close');
        let caught: unknown = null;
        try {
            readGatedFile(KERNEL, path.join(root, KERNEL));
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(GatedFileUnreadable);
        expect((caught as InstanceType<typeof GatedFileUnreadable>).errno.code).toBe('EIO');
    });

    it('a close failure after a failed read does not replace the read failure', () => {
        const root = tmpKernel('one\n');
        faults.read = osError('EIO', -5, 'read');
        faults.close = osError('EBADF', -9, 'close');
        let caught: unknown = null;
        try {
            readGatedFile(KERNEL, path.join(root, KERNEL));
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(GatedFileUnreadable);
        expect((caught as InstanceType<typeof GatedFileUnreadable>).errno.code).toBe('EIO');
    });

    it('with no fault armed the bytes come back — the mock delegates', () => {
        // Polarity: the two cases above are not red-proof if every read through
        // this mock fails for some other reason.
        const root = tmpKernel('one\n');
        expect(readGatedFile(KERNEL, path.join(root, KERNEL)).toString()).toBe('one\n');
    });
});

describe('the lstat uses the same discriminator as the reads', () => {
    it('a programming error out of lstat is rethrown, not called unreadable or deleted', () => {
        const root = tmpKernel('one\n');
        const programming = Object.assign(new TypeError('bad argument'), {
            code: 'ERR_INVALID_ARG_TYPE',
        });
        faults.lstat = programming;
        let caught: unknown = null;
        try {
            subjectDigest(root, [KERNEL]);
        } catch (err) {
            caught = err;
        }
        expect(caught).toBe(programming);
    });

    it('an OS failure out of lstat is still a typed refusal', () => {
        const root = tmpKernel('one\n');
        faults.lstat = osError('EACCES', -13, 'lstat');
        expect(() => subjectDigest(root, [KERNEL])).toThrow(GatedFileUnreadable);
    });
});
