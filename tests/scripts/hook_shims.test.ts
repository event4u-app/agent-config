// Tests for the container-only tooling shim
// (road-to-skill-ecosystem-runtime-enforcement Phase 1, Steps 2-4 and 7).
//
// The shim is a POSIX shell script on PATH, so it is exercised as a process
// rather than imported: what matters is what a developer's shell does when they
// type `php`, and that is only observable by running it.
//
// Step 4 asks for a documented false-positive matrix — "the cases where the
// binary name appears without being invoked". Those cases are in the § matrix
// below and each is asserted to be a fast pass, because a shim that fires on a
// `which` query or a grep for its own name is worse than no shim: it breaks
// tooling that was never trying to run the binary.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SHIM_DIR = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'shims');
const SHIM = path.join(SHIM_DIR, 'php');

/** A throwaway dir holding a fake "real" php, so the kill switch has a target. */
let realDir: string;

function run(
    argv: string[],
    opts: { env?: NodeJS.ProcessEnv; asName?: string } = {},
): { status: number; stdout: string; stderr: string } {
    const bin = opts.asName ? path.join(SHIM_DIR, opts.asName) : SHIM;
    const r = spawnSync(bin, argv, {
        encoding: 'utf-8',
        env: { ...process.env, ...(opts.env ?? {}) },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

beforeAll(() => {
    realDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-real-'));
    const p = path.join(realDir, 'php');
    fs.writeFileSync(p, '#!/bin/sh\necho "REAL:$*"\nexit 0\n');
    fs.chmodSync(p, 0o755);
});

afterAll(() => {
    fs.rmSync(realDir, { recursive: true, force: true });
});

describe('the shim refuses a host invocation', () => {
    it('exits non-zero — a shim that exits 0 has told the caller nothing', () => {
        expect(run(['-v']).status).toBe(2);
    });

    it('names the rule rather than only refusing', () => {
        expect(run(['-v']).stderr).toContain('container-only');
    });

    it('prints a RUNNABLE suggestion carrying the caller own arguments', () => {
        const { stderr } = run(['artisan', 'migrate', '--force']);
        expect(stderr).toContain('docker compose exec -T php php');
        expect(stderr).toContain("'artisan' 'migrate' '--force'");
    });

    it('re-quotes an argument containing a SPACE, so copy-paste survives', () => {
        // Without re-quoting, `--msg=a b` pastes as two arguments and the
        // suggestion silently does something else than what was refused.
        const { stderr } = run(['-r', 'echo hello world']);
        expect(stderr).toContain("'echo hello world'");
    });

    it("re-quotes an embedded SINGLE QUOTE — the case naive quoting breaks", () => {
        const { stderr } = run(['-r', "echo 'hi'"]);
        // sh single-quote escaping renders ' as '\'' inside a quoted run.
        expect(stderr).toContain(`'echo '\\''hi'\\'''`);
    });

    it('honours AGENT_CONFIG_PHP_SERVICE in the suggestion', () => {
        expect(run(['-v'], { env: { AGENT_CONFIG_PHP_SERVICE: 'app' } }).stderr).toContain(
            'docker compose exec -T app php',
        );
    });

    it('writes the refusal to STDERR, leaving stdout clean for pipelines', () => {
        const { stdout, stderr } = run(['-v']);
        expect(stdout).toBe('');
        expect(stderr.length).toBeGreaterThan(0);
    });
});

describe('basename dispatch (Step 3)', () => {
    it('refuses under an UNCLAIMED basename rather than passing silently', () => {
        // A silent pass-through would make the shim look installed and inert,
        // which is worse than an error: nothing would ever reveal the gap.
        const link = path.join(SHIM_DIR, 'composer');
        fs.symlinkSync('php', link);
        try {
            const r = run(['install'], { asName: 'composer' });
            expect(r.status).toBe(2);
            expect(r.stderr).toContain('unclaimed basename');
        } finally {
            fs.rmSync(link, { force: true });
        }
    });
});

describe('the global kill switch (Step 7)', () => {
    it('re-execs the REAL binary instead of refusing', () => {
        const env = {
            AGENT_CONFIG_DISABLE_HOOKS: '1',
            PATH: `${SHIM_DIR}:${realDir}:${process.env.PATH ?? ''}`,
        };
        const r = run(['--version'], { env });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('REAL:--version');
    });

    it('does NOT loop when the shim dir is first on PATH', () => {
        // The load-bearing property. The shim strips its own directory out of
        // PATH before looking again; without that it finds itself and recurses
        // until the process dies. The assertion is simply that it terminates
        // with the real binary's output — a loop never gets here.
        const env = {
            AGENT_CONFIG_DISABLE_HOOKS: '1',
            PATH: `${SHIM_DIR}:${SHIM_DIR}:${realDir}:${process.env.PATH ?? ''}`,
        };
        expect(run(['ok'], { env }).stdout).toContain('REAL:ok');
    });

    it('exits 127 rather than 0 when disabled with no real binary to reach', () => {
        // Exiting 0 would report success for a command that never ran.
        const env = { AGENT_CONFIG_DISABLE_HOOKS: '1', PATH: SHIM_DIR };
        expect(run(['-v'], { env }).status).toBe(127);
    });

    it('any value other than exactly "1" leaves the shim armed', () => {
        // A truthy-ish check would let `AGENT_CONFIG_DISABLE_HOOKS=0` disable
        // enforcement, which reads as the opposite of what it says.
        for (const v of ['0', 'true', 'yes', '']) {
            expect(run(['-v'], { env: { AGENT_CONFIG_DISABLE_HOOKS: v } }).status).toBe(2);
        }
    });
});

// --- Step 4: the false-positive matrix -------------------------------------
//
// | case                            | why it must NOT fire                    |
// |---------------------------------|-----------------------------------------|
// | `which php` / `command -v php`  | asks WHERE the binary is, never runs it |
// | `grep php <file>`               | the name is data, not an invocation     |
// | a file named `php` in a listing | a path component, not a command         |
// | `echo php`                      | the name as a literal argument          |
//
// None of these execute the shim, so the assertion is that resolving or naming
// it costs nothing and produces no refusal. They are asserted rather than
// assumed because a future shim implemented as a shell FUNCTION or an alias
// would break exactly these, and this file is where that regression surfaces.
describe('false-positive matrix (Step 4)', () => {
    it('`command -v` RESOLVES the shim without invoking it', () => {
        const r = spawnSync('sh', ['-c', 'command -v php'], {
            encoding: 'utf-8',
            env: { ...process.env, PATH: `${SHIM_DIR}:${process.env.PATH ?? ''}` },
        });
        expect(r.status).toBe(0);
        expect(r.stdout.trim()).toBe(SHIM);
        expect(r.stderr).not.toContain('container-only');
    });

    it('grepping for the name does not fire it', () => {
        const f = path.join(realDir, 'note.txt');
        fs.writeFileSync(f, 'we run php in the container\n');
        const r = spawnSync('grep', ['php', f], {
            encoding: 'utf-8',
            env: { ...process.env, PATH: `${SHIM_DIR}:${process.env.PATH ?? ''}` },
        });
        expect(r.status).toBe(0);
        expect(r.stderr).not.toContain('container-only');
    });

    it('the name as a literal argument does not fire it', () => {
        const r = spawnSync('sh', ['-c', 'echo php'], {
            encoding: 'utf-8',
            env: { ...process.env, PATH: `${SHIM_DIR}:${process.env.PATH ?? ''}` },
        });
        expect(r.stdout.trim()).toBe('php');
        expect(r.stderr).not.toContain('container-only');
    });

    it('a FILE named php in a listing does not fire it', () => {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-listing-'));
        fs.writeFileSync(path.join(d, 'php'), 'not executable\n');
        const r = spawnSync('ls', [d], {
            encoding: 'utf-8',
            env: { ...process.env, PATH: `${SHIM_DIR}:${process.env.PATH ?? ''}` },
        });
        expect(r.stdout).toContain('php');
        expect(r.stderr).not.toContain('container-only');
        fs.rmSync(d, { recursive: true, force: true });
    });
});
