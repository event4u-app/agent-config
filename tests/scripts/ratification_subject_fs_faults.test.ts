import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as NodeFs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Filesystem faults a real disk will not produce on demand: a `close` that
 * fails, a `close` that fails AFTER a read already failed, and a programming
 * error out of `lstat`. `node:fs` is mocked in this file only, with each fault
 * armed per case and every call otherwise delegating to the real module, so the
 * other suites keep a real filesystem.
 */
const faults: {
    close?: unknown;
    read?: unknown;
    lstat?: unknown;
    lstatStats?: unknown;
    trapOpen?: boolean;
    withoutFlag?: 'O_NOFOLLOW' | 'O_NONBLOCK';
} = {};

/** Every `openSync` call this file's cases made, with the flags it was given. */
const opens: { path: string; flags: unknown }[] = [];

/** Thrown by a trapped `openSync` so a case never actually opens a FIFO. */
const OPEN_TRAPPED = new Error('openSync was called on a trapped path');

vi.mock('node:fs', async (importOriginal) => {
    const real = await importOriginal<typeof NodeFs>();
    // A copy, because the real `fs.constants` properties are non-writable and
    // non-configurable, so a proxy over the original may not hide one.
    const constants = new Proxy(
        { ...real.constants },
        {
            get: (target, key, receiver) =>
                key === faults.withoutFlag ? undefined : Reflect.get(target, key, receiver),
        },
    );
    const wrapped = {
        ...real,
        constants,
        openSync: ((...args: Parameters<typeof real.openSync>) => {
            opens.push({ path: String(args[0]), flags: args[1] });
            if (faults.trapOpen === true) {
                throw OPEN_TRAPPED;
            }
            return real.openSync(...args);
        }) as typeof real.openSync,
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
            if (faults.lstatStats !== undefined) {
                return faults.lstatStats;
            }
            return real.lstatSync(...args);
        }) as typeof real.lstatSync,
    };
    return { ...wrapped, default: wrapped };
});

const fs = await import('node:fs');
const { readGatedFile, subjectDigest, GatedFileUnreadable, GatedPathUnsupported } = await import(
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
    delete faults.lstatStats;
    delete faults.trapOpen;
    delete faults.withoutFlag;
    opens.length = 0;
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

/**
 * A `Stats` whose only true predicate is `kind` — for the object kinds a test
 * process cannot create on demand (devices) or that need no real file at all.
 */
function statsOf(kind: 'isSocket' | 'isCharacterDevice' | 'isBlockDevice'): NodeFs.Stats {
    const no = (): boolean => false;
    return {
        isFile: no,
        isDirectory: no,
        isSymbolicLink: no,
        isFIFO: no,
        isSocket: no,
        isCharacterDevice: no,
        isBlockDevice: no,
        [kind]: (): boolean => true,
    } as unknown as NodeFs.Stats;
}

function refusalOf(fn: () => unknown): unknown {
    try {
        fn();
    } catch (err) {
        return err;
    }
    return null;
}

const canMkfifo = process.platform !== 'win32';

describe('only an absent path, a symbolic link or a regular file is read', () => {
    /**
     * Step 2.5, opened by round 4 of the modification review, refused 2/2:
     *
     * > "treating every non-symlink object as a regular file can hang the
     * > governance gate; the highest-leverage pre-merge change is to reject
     * > non-regular filesystem objects before opening them."
     *
     * `openSync` is trapped in these cases, so a regression fails on the trap
     * rather than hanging on a FIFO open.
     */
    it.skipIf(!canMkfifo)('a FIFO is refused before any open', () => {
        const root = tmpKernel('one\n');
        const abs = path.join(root, KERNEL);
        fs.rmSync(abs);
        execFileSync('mkfifo', [abs]);
        faults.trapOpen = true;
        const err = refusalOf(() => subjectDigest(root, [KERNEL]));
        expect(err).toBeInstanceOf(GatedPathUnsupported);
        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('FIFO');
        expect(opens).toEqual([]);
    });

    it('a directory is refused before any open', () => {
        const root = tmpKernel('one\n');
        const abs = path.join(root, KERNEL);
        fs.rmSync(abs);
        fs.mkdirSync(abs);
        faults.trapOpen = true;
        const err = refusalOf(() => subjectDigest(root, [KERNEL]));
        expect(err).toBeInstanceOf(GatedPathUnsupported);
        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('directory');
        expect(opens).toEqual([]);
    });

    it.each([
        ['isSocket', 'socket'],
        ['isCharacterDevice', 'character device'],
        ['isBlockDevice', 'block device'],
    ] as const)('a %s Stats is refused as a %s before any open', (predicate, kind) => {
        const root = tmpKernel('one\n');
        faults.lstatStats = statsOf(predicate);
        faults.trapOpen = true;
        const err = refusalOf(() => subjectDigest(root, [KERNEL]));
        expect(err).toBeInstanceOf(GatedPathUnsupported);
        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe(kind);
        expect(opens).toEqual([]);
    });

    it('a regular file is still opened and digested — the refusal is not a blanket one', () => {
        // Polarity: a check that refused every kind would satisfy every case above.
        const root = tmpKernel('one\n');
        expect(subjectDigest(root, [KERNEL])).toMatch(/^[0-9a-f]{64}$/);
        expect(opens.map((o) => o.path)).toEqual([path.join(root, KERNEL)]);
    });
});

describe('an object swapped in after the stat is refused at the open, without blocking', () => {
    it('the open carries O_NOFOLLOW and O_NONBLOCK', () => {
        const root = tmpKernel('one\n');
        readGatedFile(KERNEL, path.join(root, KERNEL));
        expect(opens).toHaveLength(1);
        const flags = opens[0]?.flags as number;
        expect(flags & fs.constants.O_NOFOLLOW).toBe(fs.constants.O_NOFOLLOW);
        expect(flags & fs.constants.O_NONBLOCK).toBe(fs.constants.O_NONBLOCK);
    });

    it.skipIf(!canMkfifo)('a FIFO reached by the read itself is refused by the fstat', () => {
        // `readGatedFile` called directly stands for the race: the `lstat`
        // said regular file, the open met a FIFO.
        const root = tmpKernel('one\n');
        const abs = path.join(root, KERNEL);
        fs.rmSync(abs);
        execFileSync('mkfifo', [abs]);
        const err = refusalOf(() => readGatedFile(KERNEL, abs));
        expect(err).toBeInstanceOf(GatedPathUnsupported);
        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('FIFO');
    });

    it('a directory reached by the read itself is refused by the fstat', () => {
        const root = tmpKernel('one\n');
        const abs = path.join(root, KERNEL);
        fs.rmSync(abs);
        fs.mkdirSync(abs);
        const err = refusalOf(() => readGatedFile(KERNEL, abs));
        expect(err).toBeInstanceOf(GatedPathUnsupported);
        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('directory');
    });
});

describe('a platform without the safe open flags refuses instead of degrading', () => {
    it.each(['O_NOFOLLOW', 'O_NONBLOCK'] as const)(
        'without %s the read is refused and nothing is opened',
        (flag) => {
            const root = tmpKernel('one\n');
            faults.withoutFlag = flag;
            const err = refusalOf(() => readGatedFile(KERNEL, path.join(root, KERNEL)));
            expect(err).toBeInstanceOf(GatedPathUnsupported);
            expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('platform');
            expect(opens).toEqual([]);
        },
    );
});
