/**
 * A plain `uninstall --global` must not consume the record `--purge` needs.
 *
 * THE READING THIS SUITE CLOSES
 *
 * `uninstall_purge_containment.test.ts` proves the deletion FUNCTION can run
 * twice — a `purge: false` call leaves the inventory a later `purge: true`
 * call reads. It says so itself, and it says what it does not prove: the CLI
 * flow around that function. An end-to-end run on 2026-10-16 measured the
 * difference and it is not cosmetic:
 *
 *     uninstall --global          -> plain_rc=0, lockfile deleted
 *     uninstall --global --purge  -> purge_after_rc=1, files_left=892
 *
 * The first invocation removed every tool from the lockfile, found nothing
 * left to keep and deleted the file. The second read no lockfile, resolved no
 * tools, printed `no tools to uninstall` and exited before `--purge` reached
 * the deletion function at all — leaving 892 files this package had recorded
 * writing on disk with no command that would remove them.
 *
 * The record IS the deletion allowlist (D1 of
 * `road-to-an-uninstall-that-only-removes-what-it-brought`): deleting it while
 * recorded content is still on disk makes that content permanently
 * unreachable. The repair is the one the roadmap's risk 5 allows — keep the
 * lockfile — and emphatically NOT letting the purge run without one, which is
 * the "delete when the record is missing" shape Phase 1 exists to remove.
 *
 * WHY THIS FILE DRIVES THE CLI AND ITS SIBLING DRIVES THE FUNCTION
 *
 * The defect lives between the deletion function and the lockfile block that
 * runs after it, so neither alone can see it. This file therefore calls
 * `main()` with real argv and asserts on the lockfile, which is the level the
 * measurement above was taken at and the level step 1.5 names.
 *
 * HOME IS INJECTED, NEVER INHERITED
 *
 * Both the lockfile and the inventory are redirected through their own env
 * overrides onto a `mkdtempSync` root, the anchor is patched in the child
 * process rather than resolved from HOME, and `assertUnderTemp` fails closed
 * before any invocation. A leaked HOME here would uninstall the operator's
 * own global layer.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CLI = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_uninstall.ts');
const INSTALL = path.join(REPO_ROOT, 'src', 'scripts', 'install.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const made: string[] = [];

afterEach(() => {
    while (made.length > 0) {
        fs.rmSync(made.pop() as string, { recursive: true, force: true });
    }
});

function assertUnderTemp(p: string): void {
    const real = fs.realpathSync(p);
    const tmp = fs.realpathSync(os.tmpdir());
    if (!real.startsWith(tmp + path.sep)) {
        throw new Error(`refusing to run: fixture ${real} is not under ${tmp}`);
    }
}

interface Fixture {
    readonly root: string;
    readonly anchor: string;
    readonly inventory: string;
    readonly lockfile: string;
    readonly ours: readonly string[];
}

/** A global install: one recorded tool, two recorded files, one lockfile. */
function makeFixture(): Fixture {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'unlock-')));
    made.push(root);
    assertUnderTemp(root);

    const anchor = path.join(root, '.claude');
    const ours = [
        path.join(anchor, 'rules', 'ac-managed.md'),
        path.join(anchor, 'skills', 'ac-skill', 'SKILL.md'),
    ];
    for (const f of ours) {
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, `content of ${path.basename(f)}\n`);
    }

    const inventory = path.join(root, 'deployed-files.json');
    fs.writeFileSync(
        inventory,
        `${JSON.stringify(
            {
                schema_version: 1,
                tools: {
                    'claude-code': {
                        anchor,
                        files: ours.map((f) => path.relative(anchor, f)).sort(),
                    },
                },
            },
            null,
            2,
        )}\n`,
    );

    const lockfile = path.join(root, 'installed.lock');
    fs.writeFileSync(lockfile, 'schema_version: 1\nagent_config_version: 0.0.0\ntools:\n  - claude-code\n');

    return { root, anchor, inventory, lockfile, ours };
}

/** Run `cmd_uninstall.main(argv)` with the fixture anchor patched in. */
function run(fx: Fixture, argv: readonly string[]): { status: number; stdout: string } {
    assertUnderTemp(fx.anchor);
    const driver = path.join(fx.root, `drive-${argv.join('_').replace(/\W+/g, '')}.ts`);
    fs.writeFileSync(
        driver,
        [
            `import * as install from ${JSON.stringify(INSTALL)};`,
            `import * as uninstall from ${JSON.stringify(CLI)};`,
            `(install.USER_SCOPE_PATHS as Record<string, string>)['claude-code'] = ${JSON.stringify(fx.anchor)};`,
            `for (const k of Object.keys(install.USER_SCOPE_PATHS)) { if (k !== 'claude-code') delete (install.USER_SCOPE_PATHS as Record<string, string>)[k]; }`,
            `process.exitCode = uninstall.main(${JSON.stringify([...argv])});`,
        ].join('\n'),
    );
    const res = spawnSync(TSX, [driver], {
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        env: {
            ...process.env,
            HOME: fx.root,
            AGENT_CONFIG_DEPLOY_INVENTORY: fx.inventory,
            AGENT_CONFIG_INSTALLED_LOCK: fx.lockfile,
        },
    });
    return { status: res.status ?? -1, stdout: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

describe('uninstall --global — the record the purge needs', () => {
    it('keeps the lockfile when recorded content is still on disk', () => {
        const fx = makeFixture();

        const plain = run(fx, ['--global', '--tools', 'claude-code']);

        expect(plain.status).toBe(0);
        expect(fs.existsSync(fx.lockfile), 'lockfile was deleted').toBe(true);
        expect(plain.stdout).toMatch(/--purge/);
    });

    it('lets the two-step flow finish: plain, then purge, removes the recorded files', () => {
        const fx = makeFixture();

        run(fx, ['--global', '--tools', 'claude-code']);
        const purge = run(fx, ['--global', '--purge', '--tools', 'claude-code']);

        expect(purge.status).toBe(0);
        expect(purge.stdout).toMatch(/purged/i);
        for (const f of fx.ours) {
            expect(fs.existsSync(f), `${path.basename(f)} survived the purge`).toBe(false);
        }
    });

    it('deletes the lockfile once nothing recorded is left on disk', () => {
        // Polarity. Without this the fix could satisfy the two cases above by
        // never deleting the lockfile at all, which would leave every machine
        // that uninstalls cleanly carrying a record of an install it no longer
        // has.
        const fx = makeFixture();

        const purge = run(fx, ['--global', '--purge', '--tools', 'claude-code']);

        expect(purge.status).toBe(0);
        expect(fs.existsSync(fx.lockfile), 'lockfile outlived the content it records').toBe(false);
    });

    it('keeps the lockfile when the purge refused', () => {
        // A refusal is the one state in which the record is most needed and
        // least able to defend itself: the purge exits 1 having deleted
        // nothing, and deleting the lockfile on the way out would strand the
        // content the refusal was protecting.
        const fx = makeFixture();
        fs.writeFileSync(fx.inventory, `${JSON.stringify({ schema_version: 1, tools: {} }, null, 2)}\n`);

        const purge = run(fx, ['--global', '--purge', '--tools', 'claude-code']);

        expect(purge.status).toBe(1);
        expect(purge.stdout).toMatch(/refusing to purge/);
        expect(fs.existsSync(fx.lockfile), 'lockfile was deleted by a refused purge').toBe(true);
        for (const f of fx.ours) {
            expect(fs.existsSync(f), `${path.basename(f)} was deleted by a refused purge`).toBe(true);
        }
    });
});
