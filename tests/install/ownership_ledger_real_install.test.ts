// Whether a consumer's edit to a GLOBALLY installed file survives — Phase 1 of
// `road-to-an-ownership-record-that-belongs-to-the-user`.
//
// Three losses, each driven through the real bash orchestrator with an
// injected HOME, so nothing here touches the machine running it:
//
//   1.1 an install run from a directory with no project settings — the
//       project manifest is never written there (`install.ts`, the
//       `_resolve_settings_read(project_root)` gate on the manifest update), so
//       the next install has no recorded digest and overwrites the edit;
//   1.2 a second project under the same HOME — project A recorded the digest,
//       project B's manifest does not, and the edit is overwritten instead of
//       staged beside the file as a sidecar;
//   1.3 a file the package retired while the user edited it — the deploy
//       inventory (`global_deploy_inventory.ts`) records paths and no digest,
//       so the reaper deletes the edit without ever seeing it.
//
// Every assertion compares SHA-256 digests of bytes, never output text
// (step 1.5) — a file recreated empty, or rewritten with the package's bytes,
// fails the same assertion an absent file fails.
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { SIDECAR_SUFFIX } from '../../src/install/preserve.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const TOOL = 'cursor';
const TAG = 'event4u/agent-config';

const made: string[] = [];

function mkTmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(dir);
    return dir;
}

afterEach(() => {
    while (made.length > 0) fs.rmSync(made.pop() as string, { recursive: true, force: true });
});

function sha(bytes: Buffer | string): string {
    return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** Digest of the bytes at `p`, or `null` when nothing readable is there. */
function digestOf(p: string): string | null {
    try {
        return sha(fs.readFileSync(p));
    } catch {
        return null;
    }
}

/** Run one global install of {@link TOOL} from `cwd` into `home`. */
function install(home: string, cwd: string): { status: number | null; out: string } {
    const r = spawnSync('bash', [ORCHESTRATOR, '--global', `--tools=${TOOL}`, '--yes'], {
        cwd,
        encoding: 'utf8',
        timeout: 240_000,
        env: {
            ...process.env,
            HOME: home,
            EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
            // Both name FILES and both would send this install's records
            // somewhere other than the injected HOME on a maintainer machine.
            AGENT_CONFIG_DEPLOY_INVENTORY: undefined,
            AGENT_CONFIG_INSTALLED_TOOLS: undefined,
            AGENT_CONFIG_NO_UI: '1',
            CI: '1',
        },
    });
    return { status: r.status, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

function rulesDir(home: string): string {
    return path.join(home, '.cursor', 'rules');
}

/** The first deployed rule file — a file this package demonstrably wrote. */
function aDeployedRule(home: string): string {
    const name = fs
        .readdirSync(rulesDir(home))
        .filter((n) => n.endsWith('.md'))
        .sort()[0];
    expect(name, 'the install deployed no rule file').toBeDefined();
    return path.join(rulesDir(home), name as string);
}

function inventoryPath(home: string): string {
    return path.join(home, '.event4u', 'agent-config', 'deployed-files.json');
}

/** A project directory carrying settings, so the project manifest is written. */
function projectWithSettings(prefix: string): string {
    const dir = mkTmp(prefix);
    fs.writeFileSync(path.join(dir, '.agent-settings.yml'), 'cost_profile: minimal\n');
    return dir;
}

describe('step 1.5 — the assertions compare bytes, not existence or text', () => {
    it('a file recreated empty fails the digest comparison an edit must pass', () => {
        const dir = mkTmp('own-ledger-bytes-');
        const p = path.join(dir, 'f.md');
        const edited = '# rule\nmy own note\n';
        fs.writeFileSync(p, edited);
        expect(digestOf(p)).toBe(sha(edited));
        fs.writeFileSync(p, '');
        expect(digestOf(p)).not.toBe(sha(edited));
    });
});

describe('ownership record — a global install from anywhere keeps a user edit', () => {
    it(
        '1.1 an edit survives a re-install run from a directory with no project settings',
        { timeout: 600_000 },
        () => {
            const home = mkTmp('own-ledger-home-');
            const bare = mkTmp('own-ledger-bare-');
            const first = install(home, bare);
            expect(first.status, first.out).toBe(0);

            const target = aDeployedRule(home);
            const edited = `${fs.readFileSync(target, 'utf8')}\nmy own note\n`;
            fs.writeFileSync(target, edited);

            const second = install(home, bare);
            // The install.ts manifest gate on `_resolve_settings_read(project_root)`
            // is why no digest existed here before the user-scoped ledger.
            expect(
                digestOf(target),
                `edit overwritten — no ownership record outside a project with settings:\n${second.out}`,
            ).toBe(sha(edited));
            expect(second.status).toBe(3);
        },
    );

    it(
        '1.2 the record from project A still decides an install run from project B',
        { timeout: 600_000 },
        () => {
            const home = mkTmp('own-ledger-home-');
            const projectA = projectWithSettings('own-ledger-a-');
            const projectB = projectWithSettings('own-ledger-b-');
            const first = install(home, projectA);
            expect(first.status, first.out).toBe(0);

            const target = aDeployedRule(home);
            const shipped = digestOf(target);
            const edited = `${fs.readFileSync(target, 'utf8')}\nmy own note\n`;
            fs.writeFileSync(target, edited);

            const second = install(home, projectB);
            expect(digestOf(target), `edit overwritten from project B:\n${second.out}`).toBe(sha(edited));
            // The package content is staged beside the edit as a sidecar —
            // the object the install-layout contract has to be able to name.
            const sidecar = `${target}${SIDECAR_SUFFIX}`;
            expect(digestOf(sidecar), 'no sidecar staged beside the preserved edit').toBe(shipped);
            expect(second.status).toBe(3);
        },
    );

    it(
        '1.3 a file the package retired while the user edited it is not deleted silently',
        { timeout: 600_000 },
        () => {
            const home = mkTmp('own-ledger-home-');
            const bare = mkTmp('own-ledger-bare-');
            const first = install(home, bare);
            expect(first.status, first.out).toBe(0);

            // A file an earlier package version shipped and recorded, which the
            // current package no longer ships: written to disk exactly as that
            // version's deploy would have, and recorded in the inventory with
            // the digest of the bytes it wrote.
            const rel = 'rules/zz-retired-ownership-probe.md';
            const retired = path.join(home, '.cursor', rel);
            const shippedBytes = `---\ntype: auto\npackage: ${TAG}\n---\n\n# retired\n`;
            fs.writeFileSync(retired, shippedBytes);
            const inv = JSON.parse(fs.readFileSync(inventoryPath(home), 'utf8')) as {
                tools: Record<string, { files: string[]; digests?: Record<string, unknown> }>;
            };
            const entry = inv.tools[TOOL];
            expect(entry, 'the install recorded no inventory entry').toBeDefined();
            (entry as { files: string[] }).files.push(rel);
            (entry as { digests?: Record<string, unknown> }).digests = {
                ...((entry as { digests?: Record<string, unknown> }).digests ?? {}),
                [rel]: { installed_sha256: sha(shippedBytes), packaged_sha256: sha(shippedBytes) },
            };
            fs.writeFileSync(inventoryPath(home), `${JSON.stringify(inv, null, 2)}\n`);

            const edited = `${shippedBytes}my own note\n`;
            fs.writeFileSync(retired, edited);

            const second = install(home, bare);
            // `global_deploy_inventory.ts` reaps it: no digest, so the edit is
            // never seen before the unlink.
            expect(digestOf(retired), `edited retired file was deleted:\n${second.out}`).toBe(sha(edited));
            expect(second.out).toContain(retired);

            // The same file left unedited IS ours to remove — the protection
            // is for the edit, not for every retired path.
            const third = install(home, bare);
            expect(third.status, third.out).toBe(0);
            fs.writeFileSync(retired, shippedBytes);
            const fourth = install(home, bare);
            expect(fourth.status, fourth.out).toBe(0);
            expect(digestOf(retired)).toBeNull();
        },
    );
});
