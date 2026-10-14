import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { main } from '../../src/scripts/ratification_subject.js';

/**
 * The CLI's refusal path, invoked directly. Step 2.4, round 3 of the
 * 2026-10-13 review: the catch around `expectedSubjectFor` in `main()` had no
 * case of its own — nothing proved it returns 1, writes to stderr, emits no
 * digest, and still lets an unrelated programming error through.
 */
const KERNEL = 'src/rules/commit-policy.md';
const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

function tmpKernel(body: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-cli-'));
    fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
    fs.writeFileSync(path.join(root, KERNEL), body);
    return root;
}

function run(argv: readonly string[]): { code: number; out: string; err: string } {
    let out = '';
    let err = '';
    const o = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        out += String(chunk);
        return true;
    });
    const e = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        err += String(chunk);
        return true;
    });
    try {
        return { code: main(argv), out, err };
    } finally {
        o.mockRestore();
        e.mockRestore();
    }
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../../src/scripts/check_kernel_edit_ratified.js');
    vi.resetModules();
});

describe('ratification_subject main() — the refusal path', () => {
    it('prints the digest and exits 0 on a readable tree — polarity', () => {
        const root = tmpKernel('one\n');
        const r = run(['--quiet', '--root', root, '--files', KERNEL]);
        expect(r.code).toBe(0);
        expect(r.out).toMatch(/^[0-9a-f]{64}\n$/);
        expect(r.err).toBe('');
    });

    it.skipIf(asRoot)('an unreadable gated file exits 1, on stderr, with no digest', () => {
        const root = tmpKernel('one\n');
        const abs = path.join(root, KERNEL);
        fs.chmodSync(abs, 0o000);
        try {
            const r = run(['--root', root, '--files', KERNEL]);
            expect(r.code).toBe(1);
            expect(r.out).toBe('');
            expect(r.err).toContain('could not be read');
            expect(r.err).toContain(KERNEL);
        } finally {
            fs.chmodSync(abs, 0o644);
        }
    });

    it('a gated path escaping the tree exits 1, on stderr, with no digest', () => {
        const root = tmpKernel('one\n');
        const r = run(['--root', root, '--files', '../../elsewhere/rules/commit-policy.md']);
        expect(r.code).toBe(1);
        expect(r.out).toBe('');
        expect(r.err).toMatch(/^error: /);
    });

    it('a gated path that is a directory exits 1, on stderr, with no digest', () => {
        const root = tmpKernel('one\n');
        const abs = path.join(root, KERNEL);
        fs.rmSync(abs);
        fs.mkdirSync(abs);
        const r = run(['--root', root, '--files', KERNEL]);
        expect(r.code).toBe(1);
        expect(r.out).toBe('');
        expect(r.err).toContain('is a directory');
    });

    it('--quiet over an empty gated set warns on stderr and still prints the digest', () => {
        const root = tmpKernel('one\n');
        const r = run(['--quiet', '--root', root, '--files', 'README.md']);
        expect(r.code).toBe(0);
        expect(r.out).toMatch(/^[0-9a-f]{64}\n$/);
        expect(r.err).toContain('covers nothing');
    });

    it('an unrelated programming error propagates instead of becoming a refusal', async () => {
        const programming = new TypeError('a defect in the subject computation');
        vi.resetModules();
        vi.doMock('../../src/scripts/check_kernel_edit_ratified.js', () => ({
            expectedSubjectFor: () => {
                throw programming;
            },
        }));
        const cli = await import('../../src/scripts/ratification_subject.js');
        const e = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        expect(() => cli.main(['--files', KERNEL])).toThrow(programming);
        expect(e).not.toHaveBeenCalled();
    });
});
