// Preserve a user-modified managed file — road-to-a-conformance-check-that-can-fail
// Phase 5.1, owner ruling 2026-09-21 (option (a), after a 1/1 council split).
//
// These exercise the WRITER in `src/scripts/install.ts`.
// `tests/install/preserve.test.ts` covers the pure decision; what is only
// observable here is that the writer consults it at all — which is precisely
// what was missing. The planner has named user-modified files since Phase 5.2
// and `_resolve_file_conflict` returned `write` for every one of them.
//
// Expectations are derived from the fixture inputs (digests hashed here from
// the content under test, package bytes compared against the source file on
// disk) rather than pinned to literals.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as inst from '../../src/scripts/install.js';
import { EXIT_COMPLETED_WITH_CONFLICTS, sidecarPathFor } from '../../src/install/preserve.js';

function sha256(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('install — preserving a user-modified managed file', () => {
    let fakeHome: string;
    let prevHome: string | undefined;
    let prevManifest: string | undefined;
    let root: string;

    /** Absolute paths inside the fixture: package source, deploy target, manifest. */
    function paths(): { src: string; dest: string; source: string; target: string; manifest: string } {
        const src = path.join(root, 'pkg');
        const dest = path.join(root, 'deployed');
        return {
            src,
            dest,
            source: path.join(src, 'AGENTS.md'),
            target: path.join(dest, 'AGENTS.md'),
            manifest: path.join(root, 'installed-tools.lock'),
        };
    }

    /** Write a fixture manifest recording each `[target, originalContent]` pair. */
    function recordManifest(entries: ReadonlyArray<readonly [string, string]>): void {
        const lines = ['schema_version: 2', 'tools:', '  - name: claude-code', '    files:'];
        for (const [target, content] of entries) {
            lines.push(
                `      - path: ${path.resolve(target)}`,
                '        kind: deployed',
                `        sha256: ${sha256(content)}`,
            );
        }
        fs.writeFileSync(paths().manifest, `${lines.join('\n')}\n`);
    }

    /**
     * Lay down a package source file and a deployed copy, recording the
     * deployed file's ORIGINAL content in the manifest. `onDisk` is what the
     * deployed file actually holds now — pass something other than `recorded`
     * to simulate a user edit.
     */
    function fixture(opts: { packaged: string; recorded: string; onDisk: string }): void {
        const p = paths();
        fs.mkdirSync(p.src, { recursive: true });
        fs.mkdirSync(p.dest, { recursive: true });
        fs.writeFileSync(p.source, opts.packaged);
        fs.writeFileSync(p.target, opts.onDisk);
        recordManifest([[p.target, opts.recorded]]);
        inst._begin_conflict_tracking(root);
    }

    beforeEach(() => {
        // The copy path appends to the transaction log under $HOME.
        fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'preserve-home-'));
        prevHome = process.env['HOME'];
        process.env['HOME'] = fakeHome;
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'preserve-root-'));
        prevManifest = process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
        process.env['AGENT_CONFIG_INSTALLED_TOOLS'] = path.join(root, 'installed-tools.lock');
    });

    afterEach(() => {
        if (prevHome === undefined) delete process.env['HOME'];
        else process.env['HOME'] = prevHome;
        if (prevManifest === undefined) delete process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
        else process.env['AGENT_CONFIG_INSTALLED_TOOLS'] = prevManifest;
        inst._begin_conflict_tracking(null);
        fs.rmSync(fakeHome, { recursive: true, force: true });
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('still refreshes a managed file the user has NOT touched', () => {
        const p = paths();
        fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: '# v1\n' });

        const [written, skipped] = inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false);

        expect(written).toBe(1);
        expect(skipped).toBe(0);
        expect(fs.readFileSync(p.target, 'utf8')).toBe(fs.readFileSync(p.source, 'utf8'));
        expect(fs.existsSync(sidecarPathFor(p.target))).toBe(false);
        expect(inst.conflictState.preserved).toEqual([]);
    });

    it('preserves a user-modified managed file and stages the package content beside it', () => {
        const p = paths();
        const edited = '# v1\nmy own note\n';
        fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: edited });

        const [written, skipped] = inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false);

        expect(written).toBe(0);
        expect(skipped).toBe(1);
        // The edit survives byte-for-byte. This is the half of 5.1 that was
        // never delivered before the ruling.
        expect(fs.readFileSync(p.target, 'utf8')).toBe(edited);
        // …and the package content is findable rather than lost.
        expect(fs.readFileSync(sidecarPathFor(p.target), 'utf8')).toBe(
            fs.readFileSync(p.source, 'utf8'),
        );
        expect(inst.conflictState.preserved).toEqual([p.target]);
    });

    it('--force replaces the managed file and stages nothing', () => {
        const p = paths();
        fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: '# v1\nmy own note\n' });

        const [written, skipped] = inst._copy_dir_dereferencing_symlinks(p.src, p.dest, true);

        expect(written).toBe(1);
        expect(skipped).toBe(0);
        expect(fs.readFileSync(p.target, 'utf8')).toBe(fs.readFileSync(p.source, 'utf8'));
        expect(fs.existsSync(sidecarPathFor(p.target))).toBe(false);
        expect(inst.conflictState.preserved).toEqual([]);
    });

    it('re-running over an already-staged sidecar is a no-op, not a rewrite', () => {
        const p = paths();
        fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: '# v1\nmy own note\n' });
        inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false);
        const sidecar = sidecarPathFor(p.target);
        const firstIno = fs.statSync(sidecar).ino;

        inst._begin_conflict_tracking(root);
        expect(() => inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false)).not.toThrow();

        expect(fs.readFileSync(sidecar, 'utf8')).toBe(fs.readFileSync(p.source, 'utf8'));
        expect(fs.statSync(sidecar).ino).toBe(firstIno);
        expect(inst.conflictState.preserved).toEqual([p.target]);
    });

    it('refuses to clobber a foreign file sitting at the sidecar path, and fails the run', () => {
        const p = paths();
        const edited = '# v1\nmy own note\n';
        fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: edited });
        const sidecar = sidecarPathFor(p.target);
        const foreign = 'something else entirely, written by someone else\n';
        fs.writeFileSync(sidecar, foreign);

        // A pathname matching the convention is not provenance. The run fails
        // rather than continuing, because the package content reached nowhere.
        expect(() => inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false)).toThrow(
            inst.SystemExitError,
        );

        expect(fs.readFileSync(sidecar, 'utf8')).toBe(foreign);
        expect(fs.readFileSync(p.target, 'utf8')).toBe(edited);
    });

    it('fails the run when the sidecar cannot be created', () => {
        const p = paths();
        const edited = '# v1\nmy own note\n';
        fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: edited });
        // A directory at the sidecar path cannot receive the package bytes. It
        // has not "completed with conflicts" if the content went nowhere.
        fs.mkdirSync(sidecarPathFor(p.target));

        expect(() => inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false)).toThrow(
            inst.SystemExitError,
        );
        expect(fs.readFileSync(p.target, 'utf8')).toBe(edited);
    });

    it('re-reads the destination at write time, catching an edit made after planning', () => {
        const p = paths();
        fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: '# v1\n' });

        // Reading 1 — the verdict a plan built at this moment would carry.
        expect(inst._resolve_file_conflict(p.target, false)).toBe('write');

        // The window a plan-time verdict would have carried straight through.
        fs.writeFileSync(p.target, '# v1\nedited between plan and write\n');

        // Reading 2 — same call, same arguments, different answer, because the
        // digest comes from disk here rather than from the earlier verdict.
        expect(inst._resolve_file_conflict(p.target, false)).toBe('preserve');
    });

    describe('exit code and conflict count', () => {
        it('a zero-conflict run keeps its own exit code', () => {
            inst._begin_conflict_tracking(root);
            expect(inst.conflictState.preserved).toEqual([]);
            expect(inst._finalize_install_rc(0)).toBe(0);
            expect(inst._finalize_install_rc(1)).toBe(1);
        });

        it('an N-conflict run counts N and exits with the conflicts code', () => {
            const p = paths();
            fs.mkdirSync(p.src, { recursive: true });
            fs.mkdirSync(p.dest, { recursive: true });
            const names = ['a.md', 'b.md', 'c.md'];
            const recorded: Array<readonly [string, string]> = [];
            for (const name of names) {
                fs.writeFileSync(path.join(p.src, name), `# packaged ${name}\n`);
                fs.writeFileSync(path.join(p.dest, name), `# edited ${name}\n`);
                recorded.push([path.join(p.dest, name), `# as we wrote ${name}\n`]);
            }
            recordManifest(recorded);
            inst._begin_conflict_tracking(root);

            inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false);

            expect(inst.conflictState.preserved).toHaveLength(names.length);
            for (const name of names) {
                expect(fs.readFileSync(path.join(p.dest, name), 'utf8')).toBe(`# edited ${name}\n`);
            }
            expect(inst._finalize_install_rc(0)).toBe(EXIT_COMPLETED_WITH_CONFLICTS);
        });

        it('a conflict never masks a failing run', () => {
            const p = paths();
            fixture({ packaged: '# v2\n', recorded: '# v1\n', onDisk: '# v1\nmine\n' });
            inst._copy_dir_dereferencing_symlinks(p.src, p.dest, false);

            expect(inst.conflictState.preserved).toHaveLength(1);
            expect(inst._finalize_install_rc(1)).toBe(1);
        });
    });
});
