/**
 * `uninstall --global --purge` removes only what this package recorded writing.
 *
 * THE READING THIS SUITE CLOSES
 *
 * Measured 2026-10-16 at `26c06aef7`, by reading
 * `src/scripts/_cli/cmd_uninstall.ts:280-284`: `_remove_global_content`
 * resolved a host anchor out of `USER_SCOPE_PATHS` and, under `--purge`, ran
 *
 *     fs.rmSync(target, { recursive: true, force: false })
 *
 * on it. The anchors are whole host configuration roots — `~/.claude/`,
 * `~/.codex/`, `~/.config/zed/` — so everything under them went, whoever wrote
 * it. A host's own credentials file sitting next to this package's deployed
 * rules was deleted by a command whose README line advertises a *surgical*
 * uninstall.
 *
 * `tests/install/` held 47 files at that commit and **none** of them was
 * uninstall- or purge-shaped, so the behaviour had never been pinned in either
 * direction. That absence is why the defect survived: the inventory that makes
 * reaping safe has existed since the 2026-06 Zed fix
 * (`_lib/global_deploy_inventory.ts`, whose own docstring states "Never deletes
 * a path that was not recorded by a previous deploy"), and the uninstall path
 * simply never consulted it.
 *
 * WHY THIS FILE DRIVES THE FUNCTION AND NOT THE CLI
 *
 * The defect is one function's deletion decision, and a unit-level driver is
 * the narrowest probe that proves it: it needs no install, no network and no
 * build artifact, so it runs in CI on every platform. The cost is that it does
 * not exercise argument parsing — covered separately — so this file asserts the
 * deletion semantics only, which is what the finding is about.
 *
 * HOME IS INJECTED, NEVER INHERITED
 *
 * Every fixture root is created with `mkdtempSync` and the anchor is pointed
 * into it explicitly through `AGENT_CONFIG_DEPLOY_INVENTORY` plus an absolute
 * anchor in the inventory. Nothing here reads `os.homedir()`, and
 * `assertUnderTemp` fails closed before any deletion runs: the function under
 * test is a recursive delete, so a leaked HOME would not fail the test, it
 * would destroy the machine running it.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CLI = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_uninstall.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const made: string[] = [];

afterEach(() => {
    while (made.length > 0) {
        const dir = made.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

/**
 * The guard that makes a recursive-delete test safe to run at all.
 *
 * Not decoration: every other assertion in this file is about what survived a
 * deletion, and a fixture rooted outside the temp directory would make those
 * assertions true of the developer's own machine.
 */
function assertUnderTemp(p: string): void {
    const real = fs.realpathSync(p);
    const tmp = fs.realpathSync(os.tmpdir());
    if (!real.startsWith(tmp + path.sep)) {
        throw new Error(`refusing to run: fixture ${real} is not under ${tmp}`);
    }
}

function digest(p: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

interface Fixture {
    readonly root: string;
    readonly anchor: string;
    readonly inventory: string;
    /** Files this package recorded writing — expected gone after a purge. */
    readonly ours: readonly string[];
    /** Files nothing recorded — expected byte-identical after a purge. */
    readonly foreign: readonly string[];
}

/**
 * A host anchor holding this package's deployed files next to a user's own.
 *
 * The foreign set is deliberately the real shape of the hazard rather than one
 * token file: a credentials document, a hand-written rule beside ours in the
 * SAME directory, a sibling tool's plugin tree, and a symlink pointing out of
 * the anchor — the last because a recursive delete that follows it leaves the
 * tree outside unreachable to any assertion made inside.
 */
function makeFixture(opts: { readonly record: boolean }): Fixture {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'purge-')));
    made.push(root);
    assertUnderTemp(root);

    const anchor = path.join(root, '.claude');
    const ours = [
        path.join(anchor, 'rules', 'ac-managed.md'),
        path.join(anchor, 'skills', 'ac-skill', 'SKILL.md'),
    ];
    const outside = path.join(root, 'outside-the-anchor.txt');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, 'must survive\n');

    const foreign = [
        path.join(anchor, '.credentials.json'),
        path.join(anchor, 'rules', 'my-own.md'),
        path.join(anchor, 'plugins', 'someone-else', 'plugin.json'),
    ];
    for (const f of [...ours, ...foreign]) {
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, `content of ${path.basename(f)}\n`);
    }
    fs.symlinkSync(outside, path.join(anchor, 'link-out'));

    const inventory = path.join(root, 'deployed-files.json');
    const doc = opts.record
        ? {
              schema_version: 1,
              tools: {
                  'claude-code': {
                      anchor,
                      files: ours.map((f) => path.relative(anchor, f)).sort(),
                  },
              },
          }
        : { schema_version: 1, tools: {} };
    fs.writeFileSync(inventory, `${JSON.stringify(doc, null, 2)}\n`);

    return { root, anchor, inventory, ours, foreign };
}

/**
 * Drive the deletion decision directly, with the anchor pointed at the fixture.
 *
 * `USER_SCOPE_PATHS` is patched through the module's own export rather than
 * through HOME, so no child process can resolve a real anchor even if the
 * environment leaks.
 */
function purge(
    fx: Fixture,
    opts: { readonly plainFirst?: boolean } = {},
    extra: Record<string, string> = {},
): { status: number; stdout: string } {
    assertUnderTemp(fx.anchor);
    const driver = path.join(fx.root, 'drive.ts');
    const first = opts.plainFirst
        ? `uninstall._remove_global_content('claude-code', { dry_run: false, purge: false });`
        : '';
    fs.writeFileSync(
        driver,
        [
            `import * as install from ${JSON.stringify(path.join(REPO_ROOT, 'src', 'scripts', 'install.ts'))};`,
            `import * as uninstall from ${JSON.stringify(CLI)};`,
            `(install.USER_SCOPE_PATHS as Record<string, string>)['claude-code'] = ${JSON.stringify(fx.anchor)};`,
            `for (const k of Object.keys(install.USER_SCOPE_PATHS)) { if (k !== 'claude-code') delete (install.USER_SCOPE_PATHS as Record<string, string>)[k]; }`,
            first,
            `const r = uninstall._remove_global_content('claude-code', { dry_run: false, purge: true });`,
            `console.log(JSON.stringify(r));`,
        ].join('\n'),
    );
    const res = spawnSync(TSX, [driver], {
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        env: {
            ...process.env,
            HOME: fx.root,
            AGENT_CONFIG_DEPLOY_INVENTORY: fx.inventory,
            ...extra,
        },
    });
    return { status: res.status ?? -1, stdout: res.stdout ?? '' };
}

describe('uninstall --purge — containment', () => {
    it('leaves every file this package did not record, byte for byte', () => {
        const fx = makeFixture({ record: true });
        const before = new Map(fx.foreign.map((f) => [f, digest(f)]));

        purge(fx);

        for (const [f, d] of before) {
            expect(fs.existsSync(f), `${path.basename(f)} was deleted`).toBe(true);
            expect(digest(f), `${path.basename(f)} changed`).toBe(d);
        }
    });

    it('removes the files it did record', () => {
        const fx = makeFixture({ record: true });

        purge(fx);

        for (const f of fx.ours) {
            expect(fs.existsSync(f), `${path.basename(f)} survived`).toBe(false);
        }
    });

    it('does not follow a symlink out of the anchor', () => {
        const fx = makeFixture({ record: true });
        const outside = path.join(fx.root, 'outside-the-anchor.txt');

        purge(fx);

        expect(fs.existsSync(outside)).toBe(true);
        expect(fs.readFileSync(outside, 'utf-8')).toBe('must survive\n');
    });

    it('does not delete through a symlinked directory inside the anchor', () => {
        // A recorded path whose parent directory is now a link out of the
        // anchor passes a lexical containment check; the file it resolves to
        // lives elsewhere and must survive.
        const fx = makeFixture({ record: true });
        const elsewhere = path.join(fx.root, 'elsewhere', 'skills');
        fs.mkdirSync(path.join(elsewhere, 'ac-skill'), { recursive: true });
        const victim = path.join(elsewhere, 'ac-skill', 'SKILL.md');
        fs.writeFileSync(victim, 'not ours\n');
        fs.rmSync(path.join(fx.anchor, 'skills'), { recursive: true });
        fs.symlinkSync(elsewhere, path.join(fx.anchor, 'skills'));

        purge(fx);

        expect(fs.readFileSync(victim, 'utf-8')).toBe('not ours\n');
        expect(fs.existsSync(fx.ours[0] as string)).toBe(false);
    });

    it('refuses rather than guessing when no inventory records the anchor', () => {
        // Polarity for the refusal arm. Without it the fix could satisfy every
        // assertion above by deleting nothing at all, ever.
        const fx = makeFixture({ record: false });
        const before = new Map(
            [...fx.ours, ...fx.foreign].map((f) => [f, digest(f)]),
        );

        const res = purge(fx);

        expect(res.stdout).toMatch(/refus|no recorded|inventory/i);
        // The caller decides the exit code from this flag, never from the
        // message's wording.
        expect(JSON.parse(res.stdout.trim().split('\n').at(-1) as string)[2]).toBe(true);
        for (const [f, d] of before) {
            expect(fs.existsSync(f), `${path.basename(f)} was deleted`).toBe(true);
            expect(digest(f)).toBe(d);
        }
    });

    it('is still possible after a plain removal — the two-step case, at this level', () => {
        // SCOPE, because this case is easy to over-read. It proves the DELETION
        // FUNCTION can run twice: a `purge: false` call does not consume the
        // record a later `purge: true` call needs.
        //
        // It does NOT prove the two-step CLI flow works. That flow was broken
        // when this case was written: `uninstall --global` deleted the
        // LOCKFILE, so a second invocation found no tools and exited 1 before
        // reaching this function at all — the source round's own expectation
        // line predicted that `rc=1`. Fixed 2026-10-17 as step 1.5 of
        // `road-to-an-uninstall-that-only-removes-what-it-brought` and pinned
        // at CLI level in `uninstall_lockfile_retention.test.ts`, which is
        // where a future regression of the flow will show, not here.
        const fx = makeFixture({ record: true });
        const foreignBefore = new Map(fx.foreign.map((f) => [f, digest(f)]));

        const res = purge(fx, { plainFirst: true });

        expect(res.stdout).toMatch(/purged/i);
        for (const f of fx.ours) {
            expect(fs.existsSync(f), `${path.basename(f)} survived`).toBe(false);
        }
        for (const [f, d] of foreignBefore) {
            expect(fs.existsSync(f)).toBe(true);
            expect(digest(f)).toBe(d);
        }
    });

    it('reports a purge it performed', () => {
        const fx = makeFixture({ record: true });

        const res = purge(fx);

        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/purged/i);
    });
});
