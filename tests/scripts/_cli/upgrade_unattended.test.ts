import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    ACTIVATION_BLOCKED,
    EXIT_REFUSED,
    acquire_lock,
    read_skips,
    record_skip,
    run_unattended,
    type Packument,
    type StepResult,
    type UnattendedDeps,
} from '../../../src/scripts/_cli/upgrade_unattended';

const NOW = new Date('2026-10-18T12:00:00Z');
const HOURS = 3_600_000;

function packument(over: { version?: string; ageHours?: number; deprecated?: string; node?: string; provenance?: boolean; impact?: unknown } = {}): unknown {
    const version = over.version ?? '16.6.0';
    const manifest: Record<string, unknown> = {
        version,
        engines: { node: over.node ?? '>=20.11.0' },
        dist: over.provenance === false ? {} : { attestations: { provenance: { predicateType: 'https://slsa.dev/provenance/v1' } } },
        agentConfig: { impact: 'impact' in over ? over.impact : { [version]: { impact: 'automatic' } } },
    };
    if (over.deprecated !== undefined) manifest['deprecated'] = over.deprecated;
    return {
        'dist-tags': { latest: version },
        versions: { '16.5.0': { version: '16.5.0' }, [version]: manifest },
        time: { [version]: new Date(NOW.getTime() - (over.ageHours ?? 100) * HOURS).toISOString() },
    };
}

/** A machine with a global binary and an `installed.lock`, mutated only by the steps the run executes. */
class World {
    binary = '16.5.0';
    lock = '16.5.0';
    readonly cmds: string[][] = [];
    fault: ((cmd: string[], w: World) => StepResult | null) | null = null;

    run = (cmd: string[]): StepResult => {
        this.cmds.push(cmd);
        const injected = this.fault?.(cmd, this) ?? null;
        if (injected !== null) return injected;
        if (cmd[0] === 'npm') this.binary = (cmd[3] as string).split('@').pop() as string;
        if (cmd[1] === 'global') this.lock = this.binary;
        return { rc: 0, stderr: '' };
    };
}

let tmp: string;
let out: string;
let err: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unattended-'));
    out = '';
    err = '';
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function deps(world: World, over: Partial<UnattendedDeps> & { doc?: unknown; fetched?: Packument } = {}): UnattendedDeps {
    const fetched: Packument = over.fetched ?? { ok: true, doc: over.doc ?? packument() };
    return {
        fetchPackument: async () => fetched,
        run: world.run,
        readInstalled: () => world.lock,
        origin: 'global',
        agentConfigBin: '/global/bin/agent-config',
        globalSettings: [path.join(tmp, 'global', '.agent-settings.yml')],
        lockPath: path.join(tmp, 'state', 'upgrade-unattended.lock'),
        skipPath: path.join(tmp, 'state', 'upgrade-skip.json'),
        env: { ci: false, noUpdateCheck: false, nodeVersion: 'v22.11.0' },
        now: () => NOW,
        pid: 4242,
        isAlive: () => true,
        dryRun: false,
        activationBlocked: null,
        out: { write: (t) => (out += t) },
        err: { write: (t) => (err += t) },
        ...over,
    };
}

describe('upgrade --unattended — the happy path', () => {
    it('installs the exact candidate on the global surfaces and releases the lock', async () => {
        const w = new World();
        expect(await run_unattended(deps(w))).toBe(0);
        expect(w.lock).toBe('16.6.0');
        expect(w.cmds[0]).toEqual(['npm', 'install', '-g', '@event4u/agent-config@16.6.0']);
        expect(fs.existsSync(path.join(tmp, 'state', 'upgrade-unattended.lock'))).toBe(false);
    });

    it('a blocked activation passes the gates, names why, and installs nothing (D6)', async () => {
        const w = new World();
        expect(await run_unattended(deps(w, { activationBlocked: ACTIVATION_BLOCKED }))).toBe(EXIT_REFUSED);
        expect(w.cmds).toEqual([]);
        expect(out).toContain('every gate passed for 16.6.0, but not installing');
        expect(ACTIVATION_BLOCKED).toMatch(/live-session register/);
    });

    it('a dry run passes the gates and installs nothing', async () => {
        const w = new World();
        expect(await run_unattended(deps(w, { dryRun: true }))).toBe(0);
        expect(w.cmds).toEqual([]);
        expect(out).toContain('every gate passed for 16.6.0');
    });
});

describe('upgrade --unattended — one refusal per gate (2.1)', () => {
    const cases: Array<[string, Partial<UnattendedDeps> & { doc?: unknown }, RegExp]> = [
        ['a release younger than 72 h', { doc: packument({ ageHours: 10 }) }, /published less than 72 h ago/],
        ['a deprecated release', { doc: packument({ deprecated: 'broken, use 16.6.1' }) }, /deprecated/],
        ['an unmet engines.node', { doc: packument({ node: '>=99.0.0' }) }, /engines\.node '>=99\.0\.0' is not satisfied/],
        ['a missing provenance attestation', { doc: packument({ provenance: false }) }, /provenance attestation missing/],
        ['a release in range that needs action', { doc: packument({ impact: { '16.6.0': { impact: 'action' } } }) }, /needs consumer action/],
        ['an unavailable impact map', { doc: packument({ impact: null }) }, /impact map unavailable/],
        ['a CI run', { env: { ci: true, noUpdateCheck: false, nodeVersion: 'v22.11.0' } }, /suppressed: CI/],
        ['the update-check kill switch', { env: { ci: false, noUpdateCheck: true, nodeVersion: 'v22.11.0' } }, /AGENT_CONFIG_NO_UPDATE_CHECK/],
        ['a source checkout', { origin: 'source-checkout' }, /source checkout/],
        ['an unknown install origin', { origin: 'unknown' }, /install origin unknown/],
        ['a candidate that is not newer', { doc: packument({ version: '16.5.0' }) }, /not newer/],
    ];
    for (const [name, over, reason] of cases) {
        it(`refuses ${name}, names the reason, and runs no step`, async () => {
            const w = new World();
            expect(await run_unattended(deps(w, over))).toBe(EXIT_REFUSED);
            expect(out + err).toMatch(reason);
            expect(w.cmds).toEqual([]);
            expect(w.lock).toBe('16.5.0');
        });
    }

    it('under CI, the kill switch or a source checkout it fetches nothing and writes nothing', async () => {
        for (const over of [
            { env: { ci: true, noUpdateCheck: false, nodeVersion: 'v22.11.0' } },
            { env: { ci: false, noUpdateCheck: true, nodeVersion: 'v22.11.0' } },
            { origin: 'source-checkout' as const },
        ]) {
            let fetches = 0;
            const w = new World();
            const rc = await run_unattended(deps(w, { ...over, fetchPackument: async () => ((fetches += 1), { ok: true, doc: packument() }) }));
            expect(rc).toBe(EXIT_REFUSED);
            expect(fetches).toBe(0);
            expect(fs.existsSync(path.join(tmp, 'state'))).toBe(false);
        }
    });

    it('refuses a version the user skipped (2.5)', async () => {
        const w = new World();
        const d = deps(w);
        record_skip(d.skipPath, '16.6.0');
        expect(read_skips(d.skipPath)).toEqual(['16.6.0']);
        expect(await run_unattended(d)).toBe(EXIT_REFUSED);
        expect(out).toMatch(/16\.6\.0 is on the skip list/);
        expect(w.cmds).toEqual([]);
    });

    it('refuses when the installed version is unknown, because nothing could be restored', async () => {
        const w = new World();
        w.lock = '';
        expect(await run_unattended(deps(w))).toBe(EXIT_REFUSED);
        expect(w.cmds).toEqual([]);
    });
});

describe('upgrade --unattended — single flight (2.2)', () => {
    it('two concurrent invocations produce exactly one install and one recorded refusal', async () => {
        const w = new World();
        const results = await Promise.all([run_unattended(deps(w, { pid: 1 })), run_unattended(deps(w, { pid: 2 }))]);
        expect(results.sort()).toEqual([0, EXIT_REFUSED]);
        expect(w.cmds.filter((c) => c[0] === 'npm')).toHaveLength(1);
        expect(err).toMatch(/another unattended upgrade holds the lock \(pid 1\)/);
    });

    it('a lock left by a dead owner, or past its TTL, is taken over', () => {
        const lockPath = path.join(tmp, 'state', 'l.lock');
        const base = { lockPath, now: () => NOW, isAlive: () => false };
        expect(acquire_lock({ ...base, pid: 1 })).toBeNull();
        expect(acquire_lock({ ...base, pid: 2 })).toBeNull();
        const stale = { lockPath, pid: 3, isAlive: () => true, now: () => new Date(NOW.getTime() + 31 * 60_000) };
        expect(acquire_lock(stale)).toBeNull();
        expect(acquire_lock({ lockPath, pid: 4, isAlive: () => true, now: () => new Date(NOW.getTime() + 31 * 60_000) })).toMatch(/pid 3/);
    });
});

describe('upgrade --unattended — every failure restores the previous version (2.3)', () => {
    const faults: Array<[string, Partial<UnattendedDeps> & { fetched?: Packument }, ((cmd: string[], w: World) => StepResult | null) | null]> = [
        ['offline', { fetched: { ok: false, reason: 'getaddrinfo ENOTFOUND registry.npmjs.org' } }, null],
        ['registry 403', { fetched: { ok: false, reason: 'HTTP 403' } }, null],
        ['registry 404', { fetched: { ok: false, reason: 'HTTP 404' } }, null],
        ['npm 404 on the tarball', {}, (cmd, w) => (cmd[0] === 'npm' && w.binary === '16.5.0' && cmd[3]!.endsWith('16.6.0') ? { rc: 1, stderr: 'npm error code E404' } : null)],
        [
            'disk full mid-extract',
            {},
            (cmd, w) => {
                if (cmd[0] === 'npm' && cmd[3]!.endsWith('16.6.0')) {
                    w.binary = 'half-written';
                    return { rc: 1, stderr: 'npm error code ENOSPC' };
                }
                return null;
            },
        ],
        [
            'SIGTERM during the global step',
            {},
            (cmd, w) => (cmd[1] === 'global' && w.binary === '16.6.0' ? { rc: 143, stderr: '' } : null),
        ],
        [
            'a partial settings sync',
            {},
            (cmd, w) => {
                if (cmd[1] === 'settings:sync' && w.lock === '16.6.0') return { rc: 1, stderr: 'yaml error' };
                return null;
            },
        ],
        ['EACCES', {}, (cmd) => (cmd[0] === 'npm' && cmd[3]!.endsWith('16.6.0') ? { rc: 243, stderr: 'npm error code EACCES' } : null)],
    ];
    for (const [name, over, fault] of faults) {
        it(`${name}: the installed version after equals the version before, with a reason printed`, async () => {
            const w = new World();
            w.fault = fault;
            const rc = await run_unattended(deps(w, over));
            expect(rc).not.toBe(0);
            expect(w.lock).toBe('16.5.0');
            expect(w.binary).toBe('16.5.0');
            expect((out + err).trim()).not.toBe('');
        });
    }

    it('EACCES prints the exact command and never escalates', async () => {
        const w = new World();
        w.fault = (cmd) => (cmd[0] === 'npm' ? { rc: 243, stderr: 'npm error code EACCES' } : null);
        await run_unattended(deps(w));
        expect(err).toContain('npm install -g @event4u/agent-config@16.6.0');
        expect(w.cmds.flat()).not.toContain('sudo');
    });

    it('a restore that cannot reach the previous version is reported, not hidden', async () => {
        const w = new World();
        w.fault = (cmd, world) => {
            if (cmd[1] === 'global' && world.binary === '16.6.0') {
                world.lock = '16.6.0';
                return { rc: 1, stderr: 'boom' };
            }
            if (cmd[0] === 'npm' && cmd[3]!.endsWith('16.5.0')) return { rc: 1, stderr: 'offline' };
            return null;
        };
        expect(await run_unattended(deps(w))).toBe(4);
        expect(err).toMatch(/the restore did not reach 16\.5\.0/);
    });
});

describe('upgrade --unattended — global surfaces only (2.4)', () => {
    it('a project carrying a pin is byte-identical before and after, and no step names it', async () => {
        const project = path.join(tmp, 'project');
        fs.mkdirSync(project);
        fs.writeFileSync(path.join(project, '.agent-settings.yml'), 'agent_config_version: 16.0.0\n');
        fs.writeFileSync(path.join(project, 'agent-config'), '#!/bin/sh\n', { mode: 0o755 });
        const digest = (): string => {
            const h = createHash('sha256');
            for (const f of fs.readdirSync(project).sort()) h.update(f).update(fs.readFileSync(path.join(project, f)));
            return h.digest('hex');
        };
        const before = digest();
        const w = new World();
        const cwd = process.cwd();
        expect(await run_unattended(deps(w))).toBe(0);
        expect(process.cwd()).toBe(cwd);
        expect(digest()).toBe(before);
        expect(w.cmds.flat().some((a) => a.includes(project))).toBe(false);
    });
});

describe('upgrade — the flags (2.1, 2.5)', () => {
    it('parses --unattended and --skip, and carries no --to', async () => {
        const { _parse } = await import('../../../src/scripts/_cli/cmd_upgrade');
        expect(_parse(['--unattended']).unattended).toBe(true);
        expect(_parse(['--unattended', '--dry-run']).dry_run).toBe(true);
        expect(_parse(['--skip', 'v16.6.0']).skip).toBe('16.6.0');
        expect(_parse(['--skip=16.6.0']).skip).toBe('16.6.0');
        const src = fs.readFileSync(path.join(__dirname, '../../../src/scripts/_cli/cmd_upgrade.ts'), 'utf-8');
        expect(src.split("'--to'").length - 1).toBe(0);
    });
});
