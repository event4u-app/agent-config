/**
 * `running_origin` must answer "is this an installed package or a dev
 * checkout", and `_is_source_repo` answers a different question: "am I standing
 * in an agent-config tree at all". Its two positive signals — a `dist/agent-src/`
 * directory and a `package.json` named `@event4u/agent-config` — are both
 * present in every published tarball, so using it here classified every
 * installed package as a source checkout and `quiet_context` suppressed the
 * unattended run on all of them.
 *
 * The fixtures below are therefore built around the one input that separates
 * the two shapes: a `.git` entry, which npm never ships. A test that called
 * `running_origin()` in this repository would pass for the wrong reason — this
 * IS a source checkout, so the old predicate was legitimately true here.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { originForPackageRoot } from '../../src/scripts/_cli/upgrade_unattended.js';
import { isSourceCheckoutPackage } from '../../src/scripts/_cli/doctor_install_mode.js';

const dirs: string[] = [];
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'unattended-origin-'));
    dirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** What `npm pack` produces: the condensed tree and the package's own name, and no `.git`. */
function publishedTarball(root: string): string {
    fs.mkdirSync(path.join(root, 'dist', 'agent-src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '16.5.0' }));
    return root;
}

describe('upgrade --unattended — install origin', () => {
    it('a-published-install-is-not-a-source-checkout', () => {
        const root = publishedTarball(tmp());
        expect(fs.existsSync(path.join(root, '.git'))).toBe(false);
        expect(originForPackageRoot(root)).not.toBe('source-checkout');
    });

    it('a published install under a global node_modules tree classifies as global', () => {
        const base = tmp();
        const root = publishedTarball(path.join(base, 'lib', 'node_modules', '@event4u', 'agent-config'));
        expect(originForPackageRoot(root)).toBe('global');
    });

    it('a real source checkout still classifies as source-checkout', () => {
        const root = publishedTarball(tmp());
        fs.mkdirSync(path.join(root, '.git'));
        expect(originForPackageRoot(root)).toBe('source-checkout');
    });

    it('a worktree checkout, whose .git is a file, is still a source checkout', () => {
        const root = publishedTarball(tmp());
        fs.writeFileSync(path.join(root, '.git'), 'gitdir: /elsewhere/.git/worktrees/wt\n');
        expect(isSourceCheckoutPackage(root)).toBe(true);
        expect(originForPackageRoot(root)).toBe('source-checkout');
    });

    it('the shipped condensed tree alone never makes a package a source checkout', () => {
        const root = tmp();
        fs.mkdirSync(path.join(root, 'dist', 'agent-src'), { recursive: true });
        expect(isSourceCheckoutPackage(root)).toBe(false);
    });
});
