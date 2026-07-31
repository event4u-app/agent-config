/**
 * The installer's symlink dereference must not escape the package root.
 *
 * Advisory finding from the PR #1076 review gate, triaged 2026-07-31.
 *
 * `_copy_dir_dereferencing_symlinks` resolves every entry with
 * `fs.realpathSync` and copies the RESOLVED target. A symlink inside the
 * shipped tree whose target sits outside the package root therefore copied an
 * arbitrary readable file into the deploy destination — and the destinations are
 * agent-readable instruction directories (`~/.claude/rules/`, `~/.codeium/…`).
 * A tampered tarball carrying `dist/agent-src/rules/x.md -> ~/.ssh/id_rsa` would
 * land that file where an agent reads rules.
 *
 * Defence-in-depth against `docs/threat-model.md` row b (supply-chain
 * compromise): the package is the install-time trust anchor, so this is not the
 * primary control — but the check costs one comparison and `package_root` was
 * already a parameter, so there is no reason to ship without it.
 *
 * These cases FAIL against the pre-fix code: the escaping file was copied.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { _copy_dir_dereferencing_symlinks } from '../../src/scripts/install.js';
import { is_ancestor } from '../../src/scripts/_lib/global_deploy_inventory.js';

let base: string;
let pkgRoot: string;
let outside: string;
let src: string;
let dest: string;

beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-confine-'));
    pkgRoot = path.join(base, 'package');
    outside = path.join(base, 'outside');
    src = path.join(pkgRoot, 'dist', 'agent-src', 'rules');
    dest = path.join(base, 'deploy', 'rules');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
});

afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
});

function copied(name: string): boolean {
    return fs.existsSync(path.join(dest, name));
}

describe('is_ancestor — the containment predicate', () => {
    it('accepts a strict descendant and rejects escape', () => {
        expect(is_ancestor('/a/b', '/a/b/c')).toBe(true);
        expect(is_ancestor('/a/b', '/a/b/c/d.md')).toBe(true);
        // Equal is NOT a strict descendant, and neither is a sibling that merely
        // shares a prefix — the classic `/a/bc` vs `/a/b` confusion.
        expect(is_ancestor('/a/b', '/a/b')).toBe(false);
        expect(is_ancestor('/a/b', '/a/bc/d.md')).toBe(false);
        expect(is_ancestor('/a/b', '/a/c')).toBe(false);
        expect(is_ancestor('/a/b', '/etc/passwd')).toBe(false);
    });
});

describe('copy refuses a symlink whose target leaves the package root', () => {
    it('does not copy a file symlinked from outside the package', () => {
        const secret = path.join(outside, 'id_rsa');
        fs.writeFileSync(secret, 'PRIVATE KEY');
        fs.writeFileSync(path.join(src, 'legit.md'), '# legit\n');
        fs.symlinkSync(secret, path.join(src, 'stolen.md'));

        const [written, , paths] = _copy_dir_dereferencing_symlinks(src, dest, true, pkgRoot);

        // The legitimate file still arrives — the guard is not a blanket refusal.
        expect(copied('legit.md')).toBe(true);
        // The escaping one does not.
        expect(copied('stolen.md'), 'a symlink escaped the package root').toBe(false);
        expect(written).toBe(1);
        expect(paths.some((p) => p.endsWith('stolen.md'))).toBe(false);
    });

    it('does not walk a DIRECTORY symlinked from outside the package', () => {
        const outDir = path.join(outside, 'secrets');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'token.md'), 'token');
        fs.symlinkSync(outDir, path.join(src, 'nested'));

        _copy_dir_dereferencing_symlinks(src, dest, true, pkgRoot);

        expect(fs.existsSync(path.join(dest, 'nested', 'token.md'))).toBe(false);
    });

    it('still follows a symlink whose target stays INSIDE the package root', () => {
        // The dereferencing behaviour exists on purpose: the shipped tree uses
        // in-package symlinks (e.g. `.augment/skills → dist/agent-src/skills`).
        const inside = path.join(pkgRoot, 'shared');
        fs.mkdirSync(inside, { recursive: true });
        fs.writeFileSync(path.join(inside, 'real.md'), '# real\n');
        fs.symlinkSync(path.join(inside, 'real.md'), path.join(src, 'linked.md'));

        const [written] = _copy_dir_dereferencing_symlinks(src, dest, true, pkgRoot);

        expect(copied('linked.md')).toBe(true);
        expect(written).toBe(1);
    });

    it('follows an in-package directory symlink', () => {
        const inside = path.join(pkgRoot, 'shared', 'sub');
        fs.mkdirSync(inside, { recursive: true });
        fs.writeFileSync(path.join(inside, 'deep.md'), '# deep\n');
        fs.symlinkSync(path.dirname(inside), path.join(src, 'nested'));

        _copy_dir_dereferencing_symlinks(src, dest, true, pkgRoot);

        expect(fs.existsSync(path.join(dest, 'nested', 'sub', 'deep.md'))).toBe(true);
    });

    it('copies everything when no package root is supplied — unchanged behaviour', () => {
        // `package_root` is optional and several callers pass null; the guard
        // must not silently start refusing for them.
        const secret = path.join(outside, 'x.md');
        fs.writeFileSync(secret, 'x');
        fs.symlinkSync(secret, path.join(src, 'linked.md'));

        _copy_dir_dereferencing_symlinks(src, dest, true, null);

        expect(copied('linked.md')).toBe(true);
    });
});
