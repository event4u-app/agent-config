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
const DOCTOR = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_doctor.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
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

/**
 * A project directory carrying settings at the canonical location, so the
 * project manifest IS written there. (A root-level `.agent-settings.yml` is a
 * legacy layout the global install migrates away before it gets that far.)
 */
function projectWithSettings(prefix: string): string {
    const dir = mkTmp(prefix);
    fs.mkdirSync(path.join(dir, 'agents', 'settings'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'agents', 'settings', '.agent-settings.yml'), 'cost_profile: minimal\n');
    return dir;
}

/** `doctor --ci` run from `cwd` against `home`: exit code and parsed payload. */
function doctor(
    home: string,
    cwd: string,
): { status: number | null; modified: string[]; drift: number; failing: string[]; raw: string } {
    const r = spawnSync(TSX, [DOCTOR, '--ci'], {
        cwd,
        encoding: 'utf8',
        timeout: 240_000,
        env: {
            ...process.env,
            HOME: home,
            EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
            AGENT_CONFIG_DEPLOY_INVENTORY: undefined,
            AGENT_CONFIG_INSTALLED_TOOLS: undefined,
            AGENT_CONFIG_NO_UI: '1',
            CI: '1',
        },
    });
    let modified: string[] = [];
    let drift = 0;
    // `--ci` exits 1 on drift OR on any check at `fail`, so the exit code alone
    // cannot say WHICH of the two fired. The failing-check names are what lets
    // a case assert that the preserved file is the reason rather than a
    // coincidence on the same tree.
    let failing: string[] = [];
    try {
        const payload = JSON.parse(r.stdout) as {
            missing?: unknown[];
            modified?: Array<{ path?: string }>;
            foreign?: unknown[];
            tag_drift?: unknown[];
            checks?: Array<{ name?: string; id?: string; status?: string }>;
        };
        modified = (payload.modified ?? []).map((m) => String(m.path ?? ''));
        // `bridge-drift` fails on the SUM of the four drift lists, so a case
        // reading only `modified` cannot tell its own signal from a baseline
        // carrying a `missing` or `foreign` item.
        drift =
            (payload.missing ?? []).length +
            (payload.modified ?? []).length +
            (payload.foreign ?? []).length +
            (payload.tag_drift ?? []).length;
        failing = (payload.checks ?? [])
            .filter((c) => c.status === 'fail')
            .map((c) => String(c.id ?? c.name ?? '?'));
    } catch {
        /* an unparseable payload leaves both lists empty and fails the case loudly */
    }
    return { status: r.status, modified, drift, failing, raw: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
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

            // The documented resolution — merge the sidecar — clears it.
            fs.renameSync(sidecar, target);
            const third = install(home, projectA);
            expect(third.status, third.out).toBe(0);
            expect(digestOf(target)).toBe(shipped);
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

describe('step 3.1 — the installer and doctor say the same thing about one tree', () => {
    it(
        'installer rc=3 and doctor --ci exit 1 naming the preserved file, on the same tree',
        { timeout: 600_000 },
        () => {
            const home = mkTmp('own-ledger-home-');
            const project = projectWithSettings('own-ledger-doc-');
            const first = install(home, project);
            expect(first.status, first.out).toBe(0);
            const target = aDeployedRule(home);
            // THE BASELINE IS HALF THE PIN, and measuring it corrected what
            // this case was taken to prove. `doctor --ci` already exits 1 on
            // this freshly installed throwaway HOME, because the `hook-wiring`
            // check fails there — a temp HOME carries no host configuration to
            // wire into. So `after.status === 1` on its own cannot tell
            // "doctor exits 1 BECAUSE of the preserved file" from "doctor exits
            // 1 on this tree anyway", and `1` is a code the register gives a
            // deliberately broad meaning.
            //
            // The discriminating fact is therefore captured explicitly: the
            // `modified` list gains the target, and the failing-CHECK set gains
            // exactly `bridge-drift` while losing nothing. That delta is what
            // says doctor noticed THIS edit, which an exit code of 1 against a
            // baseline of 1 cannot say on its own.
            //
            // ONE FACT, STATED TWICE — not two witnesses. `_check_bridge_drift`
            // fails on the SUM of missing + modified + foreign + tag_drift, so
            // its status is a function of the same drift the `modified`
            // assertion reads. What the pair adds is ATTRIBUTION: the 1 after
            // the edit is traceable to drift rather than to another check
            // tripping. The whole drift total is asserted zero at baseline for
            // that reason — reading only `modified` would let a baseline
            // `missing` item swallow the delta and red the case for an
            // unrelated reason.
            const before = doctor(home, project);
            expect(before.modified, before.raw).toEqual([]);
            expect(before.drift, before.raw).toBe(0);
            const baselineFailing = [...before.failing].sort();

            fs.writeFileSync(target, `${fs.readFileSync(target, 'utf8')}\nmy own note\n`);
            const second = install(home, project);
            expect(second.status, second.out).toBe(3);

            // `cmd_doctor` skipped every global-scope tool, so the file the
            // installer had just called not-current was invisible to it.
            const after = doctor(home, project);
            expect(after.modified, after.raw).toContain(target);
            const gained = [...after.failing].sort().filter((c) => !baselineFailing.includes(c));
            const lost = baselineFailing.filter((c) => !after.failing.includes(c));
            expect(gained, after.raw).toEqual(['bridge-drift']);
            expect(lost, after.raw).toEqual([]);
            // The exact code, not merely non-zero: `docs/contracts/exit-code-register.md`
            // publishes this pair as `init` 3 / `doctor` 1, and a published
            // code nothing pins is a code that can drift to 2 unnoticed. On
            // this fixture it corroborates rather than discriminates; the two
            // assertions above are what carry the causation.
            expect(after.status).toBe(1);
        },
    );
});
