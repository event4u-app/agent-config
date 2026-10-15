/**
 * Re-read guard + post-edit scope hint — `pre_tool_use` concern
 * (`src/scripts/hooks/reread_guard_hook.ts`, road-to-token-economy-cache
 * Phase 6.1/6.2).
 *
 * Two layers, mirroring `edit_shape_hook.test.ts`:
 *   - Unit tests over the exported pure helpers (exemption matching,
 *     ranged-read detection, advisory lines).
 *   - E2E: spawns the hook via tsx with dispatcher envelopes on stdin
 *     against a temp workspace, driving multi-call sequences through the
 *     session-scoped ledger (duplicate read → fire; changed file / first
 *     read / ranged read / exempt path → silence; post-edit full read →
 *     fire; ledger stores paths + numbers only).
 *
 * All fixtures live under `os.tmpdir()` — no tracked file is ever written.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    buildDuplicateReadLine,
    buildPostEditReadLine,
    compareRead,
    contentDigest,
    deriveSessionKey,
    HASH_BOUND_BYTES,
    isExemptPath,
    isRangedRead,
    ledgerFile,
} from '../../src/scripts/hooks/reread_guard_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'reread_guard_hook.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmp_dirs: string[] = [];

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

function makeWorkspace(): { root: string; abs: string } {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'reread-guard-'));
    tmp_dirs.push(root);
    const abs = path.join(root, 'src', 'target.ts');
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'export const x = 1;\n');
    return { root, abs };
}

function envelope(root: string, payload: unknown, session = 'sess-1'): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        session_id: session,
        workspace_root: root,
        payload,
    });
}

function run(input: string, cwd: string): { status: number | null; stdout: string } {
    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd, input });
    expect(r.status).not.toBeNull();
    return { status: r.status, stdout: r.stdout as string };
}

function readEvent(root: string, abs: string, session = 'sess-1', extraInput: object = {}): string {
    return envelope(root, { tool_name: 'Read', tool_input: { file_path: abs, ...extraInput } }, session);
}

// ── Pure-helper unit tests ──────────────────────────────────────────────

describe('isExemptPath (shared list with edit-shape, duplicated on purpose)', () => {
    it('matches the committed exemption list', () => {
        expect(isExemptPath('dist/agent-src/rules/a.md')).toBe(true);
        expect(isExemptPath('src/generated/types.ts')).toBe(true);
        expect(isExemptPath('yarn.lock')).toBe(true);
        expect(isExemptPath('assets/app.min.css')).toBe(true);
        expect(isExemptPath('agents/runtime/state/x.json')).toBe(true);
        expect(isExemptPath('src/scripts/hooks/reread_guard_hook.ts')).toBe(false);
    });
});

describe('isRangedRead', () => {
    it('treats offset/limit (and line-range variants) as the cheap form', () => {
        expect(isRangedRead({ offset: 10 })).toBe(true);
        expect(isRangedRead({ limit: 50 })).toBe(true);
        expect(isRangedRead({ start_line: 1, end_line: 20 })).toBe(true);
        expect(isRangedRead({ file_path: '/x' })).toBe(false);
        expect(isRangedRead({})).toBe(false);
    });
});

describe('advisory lines', () => {
    it('the duplicate-read line names the earlier read and the ranged alternative', () => {
        const line = buildDuplicateReadLine('src/a.ts', 1700000000000, 'content');
        expect(line).toContain('src/a.ts');
        expect(line).toContain('already fully read');
        expect(line).toContain('offset/limit');
    });
    it('the post-edit line points at a ranged re-read of the edited hunk', () => {
        const line = buildPostEditReadLine('src/a.ts');
        expect(line).toContain('just edited src/a.ts');
        expect(line).toContain('offset/limit');
    });
});

describe('content key and its size bound (D3)', () => {
    const HASHED_A = { kind: 'sha256', value: 'a' } as const;
    const HASHED_B = { kind: 'sha256', value: 'b' } as const;
    const OVER = { kind: 'over-bound' } as const;
    const UNREADABLE = { kind: 'unreadable' } as const;
    const BIG = HASH_BOUND_BYTES + 10;

    it('compares digests when both reads carry one, whatever the stat pair says', () => {
        expect(compareRead({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 1, 5, HASHED_B)).toBeNull();
        expect(compareRead({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 2, 5, HASHED_A)).toBe('content');
    });

    it('falls back to mtime + size only for a file over the bound, and names that basis', () => {
        expect(compareRead({ mtime: 1, size: BIG, ts: 0 }, 1, BIG, OVER)).toBe('stat-over-bound');
        expect(compareRead({ mtime: 1, size: BIG, ts: 0 }, 2, BIG, OVER)).toBeNull();
    });

    it('never asserts unchanged for a hash-eligible file without both digests', () => {
        // A legacy ledger entry (written before the digest existed) beside an equal stat pair.
        expect(compareRead({ mtime: 1, size: 5, ts: 0 }, 1, 5, HASHED_A)).toBeNull();
        // The current read could not be hashed.
        expect(compareRead({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 1, 5, UNREADABLE)).toBeNull();
        expect(compareRead({ mtime: 1, size: 5, ts: 0 }, 1, 5, UNREADABLE)).toBeNull();
    });

    it('the duplicate line states the basis it used', () => {
        expect(buildDuplicateReadLine('a.ts', 0, 'content')).toContain('unchanged content');
        expect(buildDuplicateReadLine('a.ts', 0, 'stat-over-bound')).toContain('2 MB hash bound');
        expect(buildDuplicateReadLine('a.ts', 0, 'content')).not.toContain('hash bound');
    });

    describe('contentDigest reads real files, never past the bound', () => {
        function realFile(bytes: number): string {
            const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'reread-digest-'));
            tmp_dirs.push(dir);
            const f = path.join(dir, 'f.bin');
            fs.writeFileSync(f, Buffer.alloc(bytes, 0x61));
            return f;
        }

        it('hashes a file at the bound', () => {
            const f = realFile(HASH_BOUND_BYTES);
            expect(contentDigest(f, HASH_BOUND_BYTES)).toEqual({
                kind: 'sha256',
                value: createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
            });
        });

        it('skips the read when the stat size is over the bound', () => {
            // A small, readable file: hashing it would succeed, so over-bound proves the skip.
            const f = realFile(16);
            expect(contentDigest(f, HASH_BOUND_BYTES + 1)).toEqual({ kind: 'over-bound' });
        });

        it('stops at the bound when the file is larger than its stat said', () => {
            // The file grew between stat and read: the read itself must enforce the bound.
            const f = realFile(HASH_BOUND_BYTES + 1);
            expect(contentDigest(f, 16)).toEqual({ kind: 'over-bound' });
        });

        it('reports a read failure as its own state, not as over the bound', () => {
            const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'reread-digest-'));
            tmp_dirs.push(dir);
            expect(contentDigest(path.join(dir, 'missing'), 16)).toEqual({ kind: 'unreadable' });
        });
    });
});

// E2E sequences through the ledger.

describe('reread_guard_hook E2E', () => {
    it('6.1: fires (exit 2) on a duplicate full read of an unchanged file — silent on the first', () => {
        const { root, abs } = makeWorkspace();
        const first = run(readEvent(root, abs), root);
        expect(first.status).toBe(0);
        expect(first.stdout.trim()).toBe('');

        const second = run(readEvent(root, abs), root);
        expect(second.status).toBe(2);
        const out = JSON.parse(second.stdout);
        expect(out.decision).toBe('warn');
        expect(out.additional_context).toContain('already fully read');
        expect(out.additional_context).toContain('offset/limit');
    });

    it('6.1: silent when the file changed since the recorded read (different mtime/size)', () => {
        const { root, abs } = makeWorkspace();
        expect(run(readEvent(root, abs), root).status).toBe(0);
        fs.writeFileSync(abs, 'export const x = 2; // changed by someone else\n');
        // Force a distinct mtime even on coarse-grained filesystems.
        fs.utimesSync(abs, new Date(), new Date(Date.now() + 5000));
        const second = run(readEvent(root, abs), root);
        expect(second.status).toBe(0);
        expect(second.stdout.trim()).toBe('');
    });

    it('same-mtime-same-size-new-content-is-not-unchanged', () => {
        // An equal-length rewrite with its mtime restored: stat says unchanged,
        // the content is not, so the advisory must stay silent.
        const { root, abs } = makeWorkspace();
        // A whole-second mtime, so restoring it is exact on every filesystem.
        const pinned = new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000);
        fs.utimesSync(abs, pinned, pinned);
        const before = fs.statSync(abs);
        expect(run(readEvent(root, abs), root).status).toBe(0);
        fs.writeFileSync(abs, 'export const y = 9;\n');
        fs.utimesSync(abs, pinned, pinned);
        const after = fs.statSync(abs);
        expect(after.size).toBe(before.size);
        expect(after.mtimeMs).toBe(before.mtimeMs);
        const second = run(readEvent(root, abs), root);
        expect(second.status).toBe(0);
        expect(second.stdout.trim()).toBe('');
    });

    it('restored-identical-content-is-unchanged', () => {
        // Same bytes with a new mtime (a checkout restoring the file): the
        // content the session read is still the content on disk.
        const { root, abs } = makeWorkspace();
        expect(run(readEvent(root, abs), root).status).toBe(0);
        fs.writeFileSync(abs, fs.readFileSync(abs));
        fs.utimesSync(abs, new Date(), new Date(Date.now() + 5000));
        const second = run(readEvent(root, abs), root);
        expect(second.status).toBe(2);
        expect(JSON.parse(second.stdout).additional_context).toContain('unchanged content');
    });

    it('6.1: silent on a ranged read even when the path was already fully read', () => {
        const { root, abs } = makeWorkspace();
        expect(run(readEvent(root, abs), root).status).toBe(0);
        const ranged = run(readEvent(root, abs, 'sess-1', { offset: 1, limit: 10 }), root);
        expect(ranged.status).toBe(0);
        expect(ranged.stdout.trim()).toBe('');
    });

    it('is silent on exempt paths', () => {
        const { root } = makeWorkspace();
        const exempt = path.join(root, 'dist', 'bundle.js');
        fs.mkdirSync(path.dirname(exempt), { recursive: true });
        fs.writeFileSync(exempt, 'x\n');
        expect(run(readEvent(root, exempt), root).status).toBe(0);
        expect(run(readEvent(root, exempt), root).status).toBe(0); // duplicate read, still silent
    });

    it('6.2: a full read right after this session\'s own Edit to the path fires the scope hint', () => {
        const { root, abs } = makeWorkspace();
        const edit = envelope(root, {
            tool_name: 'Edit',
            tool_input: { file_path: abs, old_string: 'x = 1', new_string: 'x = 2' },
        });
        expect(run(edit, root).status).toBe(0); // bookkeeping only, never fires

        const readBack = run(readEvent(root, abs), root);
        expect(readBack.status).toBe(2);
        const out = JSON.parse(readBack.stdout);
        expect(out.decision).toBe('warn');
        expect(out.additional_context).toContain('just edited');
        expect(out.additional_context).toContain('offset/limit');
    });

    it('fires at most once per path per session (per-path latch)', () => {
        const { root, abs } = makeWorkspace();
        expect(run(readEvent(root, abs), root).status).toBe(0);
        expect(run(readEvent(root, abs), root).status).toBe(2);
        const third = run(readEvent(root, abs), root);
        expect(third.status).toBe(0);
        expect(third.stdout.trim()).toBe('');
    });

    it('a second path still gets its own advisory after the first path fired', () => {
        const { root, abs } = makeWorkspace();
        const other = path.join(root, 'src', 'other.ts');
        fs.writeFileSync(other, 'export const y = 1;\n');
        expect(run(readEvent(root, abs), root).status).toBe(0);
        expect(run(readEvent(root, abs), root).status).toBe(2); // path A latched
        expect(run(readEvent(root, other), root).status).toBe(0);
        expect(run(readEvent(root, other), root).status).toBe(2); // path B fires independently
    });

    it('legacy-ledger-entry-without-digest-is-not-asserted-unchanged', () => {
        // A read recorded before the digest existed: equal stat pair, no sha256.
        const { root, abs } = makeWorkspace();
        const st = fs.statSync(abs);
        const key = deriveSessionKey({ session_id: 'sess-1' }, {});
        const file = ledgerFile(root, key);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            JSON.stringify({ reads: { 'src/target.ts': { mtime: st.mtimeMs, size: st.size, ts: 1 } }, writes: {}, fired: {} }),
        );
        const second = run(readEvent(root, abs), root);
        expect(second.status).toBe(0);
        expect(second.stdout.trim()).toBe('');
    });

    it('over-bound-duplicate-read-fires-on-the-stat-basis-and-says-so', () => {
        const { root } = makeWorkspace();
        const big = path.join(root, 'src', 'big.txt');
        fs.writeFileSync(big, Buffer.alloc(HASH_BOUND_BYTES + 1, 0x62));
        expect(run(readEvent(root, big), root).status).toBe(0);
        const second = run(readEvent(root, big), root);
        expect(second.status).toBe(2);
        expect(JSON.parse(second.stdout).additional_context).toContain('2 MB hash bound');
    });

    it('the ledger stores paths, numbers and a sha256 digest only — no content field', () => {
        const { root, abs } = makeWorkspace();
        expect(run(readEvent(root, abs), root).status).toBe(0);
        const key = deriveSessionKey({ session_id: 'sess-1' }, {});
        const ledger = JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8'));
        expect(Object.keys(ledger).sort()).toEqual(['fired', 'reads', 'writes']);
        for (const rec of Object.values(ledger.reads) as Array<Record<string, unknown>>) {
            expect(Object.keys(rec).sort()).toEqual(['mtime', 'sha256', 'size', 'ts']);
            expect(rec['sha256']).toBe(createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
            for (const [k, v] of Object.entries(rec)) if (k !== 'sha256') expect(typeof v).toBe('number');
        }
        for (const v of Object.values(ledger.writes)) expect(typeof v).toBe('number');
        expect(JSON.stringify(ledger)).not.toContain('export const'); // never the file body
    });

    it('is silent on non-covered tools and on malformed stdin — and never exits 1', () => {
        const { root, abs } = makeWorkspace();
        const bash = run(envelope(root, { tool_name: 'Bash', tool_input: { command: 'ls' } }), root);
        expect(bash.status).toBe(0);
        expect(run('not json {', root).status).toBe(0);
        expect(run('', root).status).toBe(0);
        // never a block: even the firing path exits 2 (warn), not 1
        expect(run(readEvent(root, abs), root).status).toBe(0);
        expect([0, 2]).toContain(run(readEvent(root, abs), root).status);
    });
});
