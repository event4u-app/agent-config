/**
 * road-to-a-setup-that-decides-itself step 3.3 — promote after proof, never at
 * install. Verify: a fresh-HOME fixture where session 1 stays full, session 2
 * thins only with the arrival record present, and a record missing a standing
 * law yields `demoted`.
 *
 * The staged runtime is built by hand from the repository's own projection
 * rather than by `stageRuntime`, which copies the whole package: the module
 * reads exactly `package.json`, `dist/agent-src/rules`, `dist/router.json`,
 * `src/config` and the `claude-rules` snapshot, and those are what the fixture provides.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_THIN_ESTIMATE_MS,
    PROMOTING_MARKER,
    PROMOTION_RECORD,
    neverThinned,
    PROMOTION_SWITCH_REL,
    promotionEnabled,
    sessionLayerStep,
} from '../../src/install/layerPromotion.js';
import { CLAUDE_LAYER_DIRNAME, PACKAGE_STAMP_LINE, readCarrierState, recordCarrierProbe } from '../../src/install/stagedRuntime.js';
import * as inventory from '../../src/scripts/_lib/global_deploy_inventory.js';
import { captureInstructionsLoaded } from '../../src/scripts/_lib/instructions_loaded_event.js';
import { write_lockfile } from '../../src/scripts/_lib/installed_lock.js';
import { is_thin_entry } from '../../src/scripts/_lib/thin_rules.js';
import { runLayerPromotion } from '../../src/scripts/hooks/layer_promotion_hook.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERSION = '9.9.9';
const DEAD_PID = 2 ** 22 + 12345;
const AGENT = 'claude-code_2-1-299_agent';
const LAWS: readonly string[] = Object.keys(
    (JSON.parse(fs.readFileSync(path.join(REPO, 'src/config/rule-consequence-class.json'), 'utf8')) as { members: object }).members,
);

const temps: string[] = [];
afterEach(() => {
    for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

interface Fixture {
    readonly env: NodeJS.ProcessEnv;
    readonly runtimeRoot: string;
    readonly stage: string;
    readonly rulesDir: string;
    readonly ledgerPath: string;
}

function stamp(text: string): string {
    return text.replace(/^---\n/, `---\n${PACKAGE_STAMP_LINE}\n`);
}

/** A fresh HOME after `install`: full layer, staged runtime, ledger, lock, a reached carrier. */
function freshInstall(opts: { enabled?: boolean; observed?: boolean } = {}): Fixture {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer-promotion-'));
    temps.push(root);
    const home = path.join(root, 'home');
    const e4u = path.join(root, 'e4u');
    const runtimeRoot = path.join(e4u, 'runtime');
    const stage = path.join(runtimeRoot, `v-${VERSION}-test`);
    const rulesDir = path.join(home, '.claude', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(stage, { recursive: true });
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: VERSION }));
    fs.cpSync(path.join(REPO, 'dist/agent-src/rules'), path.join(stage, 'dist/agent-src/rules'), { recursive: true, dereference: true });
    fs.cpSync(path.join(REPO, 'src/config'), path.join(stage, 'src/config'), { recursive: true, dereference: true });
    fs.copyFileSync(path.join(REPO, 'dist/router.json'), path.join(stage, 'dist/router.json'));
    fs.symlinkSync(path.basename(stage), path.join(runtimeRoot, 'current'));

    const effectFile = path.join(stage, 'src/config/host-injection-effect.json');
    const effect = JSON.parse(fs.readFileSync(effectFile, 'utf8')) as Record<string, unknown>;
    if (opts.observed !== false) {
        effect['claude'] = { state: 'observed-true', host_version: '2.1.299', transcript: 'fixture', date: '2026-10-24', reason: 'fixture' };
    }
    fs.writeFileSync(effectFile, JSON.stringify(effect));
    const switchFile = path.join(stage, PROMOTION_SWITCH_REL);
    fs.writeFileSync(switchFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(switchFile, 'utf8')), enabled: opts.enabled !== false }));

    const snapshot = path.join(stage, CLAUDE_LAYER_DIRNAME);
    fs.mkdirSync(snapshot);
    const files = new Set<string>();
    const digests = new Map<string, inventory.LedgerDigest>();
    for (const name of fs.readdirSync(path.join(REPO, 'dist/agent-src/rules')).filter((n) => n.endsWith('.md'))) {
        const text = stamp(fs.readFileSync(path.join(REPO, 'dist/agent-src/rules', name), 'utf8'));
        fs.writeFileSync(path.join(rulesDir, name), text);
        fs.writeFileSync(path.join(snapshot, name), text);
        const sha = inventory.file_sha256(path.join(rulesDir, name)) as string;
        files.add(`rules/${name}`);
        digests.set(`rules/${name}`, { installed_sha256: sha, packaged_sha256: sha });
    }
    const ledgerPath = path.join(e4u, 'deployed-files.json');
    const lockPath = path.join(e4u, 'installed.lock');
    const inv = inventory.load_inventory(ledgerPath);
    inventory.record_deploy('claude-code', path.join(home, '.claude'), files, inv, digests);
    inventory.save_inventory(inv, ledgerPath);
    write_lockfile(VERSION, ['claude-code'], { path: lockPath });
    recordCarrierProbe(runtimeRoot, 'claude', 'reached', VERSION);

    const env: NodeJS.ProcessEnv = {
        HOME: home,
        EVENT4U_CONFIG_HOME: e4u,
        AGENT_CONFIG_DEPLOY_INVENTORY: ledgerPath,
        AGENT_CONFIG_INSTALLED_LOCK: lockPath,
        AI_AGENT: AGENT,
    };
    return { env, runtimeRoot, stage, rulesDir, ledgerPath };
}

/** One session's arrival lines: every listed rule file loaded at session start. */
function arrive(f: Fixture, session: string, ts: string, ruleIds: readonly string[]): void {
    const dir = path.join(f.runtimeRoot, 'arrivals');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const lines = ruleIds.map((id) =>
        JSON.stringify(
            captureInstructionsLoaded(
                { hook_event_name: 'InstructionsLoaded', session_id: session, load_reason: 'session_start', file_path: path.join(f.rulesDir, `${id}.md`) },
                ts,
                f.env['HOME'] as string,
                f.env,
            ),
        ),
    );
    fs.writeFileSync(path.join(dir, `${session}.jsonl`), `${lines.join('\n')}\n`);
}

const allRules = (f: Fixture): string[] => fs.readdirSync(f.rulesDir).filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, ''));
const stubCount = (f: Fixture): number =>
    allRules(f).filter((id) => is_thin_entry(fs.readFileSync(path.join(f.rulesDir, `${id}.md`), 'utf8'))).length;
const ledgerMatchesDisk = (f: Fixture): boolean => {
    const rec = inventory.recorded_digests('claude-code', path.dirname(f.rulesDir), inventory.load_inventory(f.ledgerPath));
    return allRules(f).every((id) => rec.get(`rules/${id}.md`)?.installed_sha256 === inventory.file_sha256(path.join(f.rulesDir, `${id}.md`)));
};
/** Put back the stamped full bodies of all files (or all but `keep` stubs), as a pass cut short leaves them. */
function restoreAll(f: Fixture, keep = 0): void {
    let kept = 0;
    for (const id of allRules(f)) {
        const file = path.join(f.rulesDir, `${id}.md`);
        if (!is_thin_entry(fs.readFileSync(file, 'utf8'))) continue;
        if (kept++ < keep) continue;
        fs.copyFileSync(path.join(f.stage, CLAUDE_LAYER_DIRNAME, `${id}.md`), file);
    }
}

const step = (f: Fixture, extra: Partial<Parameters<typeof sessionLayerStep>[0]> = {}) =>
    sessionLayerStep({ env: f.env, date: () => new Date('2026-10-24T12:00:00Z'), ...extra });

describe('step 3.3 — promote after proof, never at install', () => {
    it('session 1 full, session 2 thinned only with the arrival record present', () => {
        const f = freshInstall();
        expect(stubCount(f)).toBe(0);

        expect(step(f)).toEqual({ action: 'none', reason: 'no-arrival-record' });
        expect(readCarrierState(f.runtimeRoot).layer).toBe('full');
        expect(stubCount(f)).toBe(0);

        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        expect(step(f)).toEqual({ action: 'promoted', reason: 'all-conditions-hold' });
        expect(readCarrierState(f.runtimeRoot).layer).toBe('thinned');
        expect(stubCount(f)).toBeGreaterThan(0);
        // Never thinned under any input: the consequence class and the safety-floor tier.
        const never = neverThinned(f.stage);
        expect(never.safetyFloor.size).toBeGreaterThan(0);
        for (const id of [...never.consequenceClass, ...never.safetyFloor].filter((x) => allRules(f).includes(x))) {
            expect(is_thin_entry(fs.readFileSync(path.join(f.rulesDir, `${id}.md`), 'utf8'))).toBe(false);
        }
        // The next install must see its own bytes, not a user edit.
        expect(ledgerMatchesDisk(f)).toBe(true);
        const record = JSON.parse(fs.readFileSync(path.join(f.runtimeRoot, PROMOTION_RECORD), 'utf8')) as Record<string, unknown>;
        expect(record['promoted_at']).toBe('2026-10-24T12:00:00.000Z');
        expect(record['version']).toBe(VERSION);
    });

    it('a record after the promotion missing a standing law demotes and restores the full layer', () => {
        const f = freshInstall();
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        expect(step(f).action).toBe('promoted');

        // A thinned layer the record agrees with holds.
        arrive(f, 'session-2', '2026-10-24T13:00:00Z', allRules(f));
        expect(step(f)).toEqual({ action: 'none', reason: 'thinned-holds' });

        const missing = LAWS.find((id) => allRules(f).includes(id)) as string;
        arrive(f, 'session-3', '2026-10-24T14:00:00Z', allRules(f).filter((id) => id !== missing));
        expect(step(f)).toEqual({ action: 'demoted', reason: 'arrival-standing-law-missing' });
        expect(readCarrierState(f.runtimeRoot).layer).toBe('demoted');
        expect(stubCount(f)).toBe(0);
        expect(ledgerMatchesDisk(f)).toBe(true);
        // A demoted machine is not promoted again by a session.
        arrive(f, 'session-4', '2026-10-24T15:00:00Z', allRules(f));
        expect(step(f)).toEqual({ action: 'none', reason: 'demoted' });
    });

    it('a record taken BEFORE the promotion never demotes it', () => {
        const f = freshInstall();
        const missing = LAWS.find((id) => allRules(f).includes(id)) as string;
        arrive(f, 'old', '2026-10-24T09:00:00Z', allRules(f).filter((id) => id !== missing));
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        expect(step(f).action).toBe('promoted');
        // Only the pre-promotion record is missing a law; nothing later contradicts the layer.
        fs.rmSync(path.join(f.runtimeRoot, 'arrivals', 'session-1.jsonl'));
        expect(step(f)).toEqual({ action: 'none', reason: 'thinned-holds' });
    });

    it('the shipped switch is off, and off means nothing on disk moves', () => {
        expect(promotionEnabled(REPO)).toBe(false);
        const f = freshInstall({ enabled: false });
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        expect(step(f)).toEqual({ action: 'none', reason: 'promotion-disabled' });
        expect(stubCount(f)).toBe(0);
    });

    it('each unmet condition keeps the layer full with its own reason', () => {
        const unobserved = freshInstall({ observed: false });
        arrive(unobserved, 's', '2026-10-24T10:00:00Z', allRules(unobserved));
        expect(step(unobserved)).toEqual({ action: 'none', reason: 'delivery-unobserved' });

        const lawless = freshInstall();
        arrive(lawless, 's', '2026-10-24T10:00:00Z', allRules(lawless).filter((id) => !LAWS.includes(id)));
        expect(step(lawless)).toEqual({ action: 'none', reason: 'arrival-standing-law-missing' });

        const otherHost = freshInstall();
        arrive(otherHost, 's', '2026-10-24T10:00:00Z', allRules(otherHost));
        expect(step(otherHost, { env: { ...otherHost.env, AI_AGENT: 'claude-code_2-1-300_agent' } })).toEqual({
            action: 'none',
            reason: 'arrival-host-version-mismatch',
        });

        const skew = freshInstall();
        arrive(skew, 's', '2026-10-24T10:00:00Z', allRules(skew));
        write_lockfile('9.9.8', ['claude-code'], { path: skew.env['AGENT_CONFIG_INSTALLED_LOCK'] as string });
        expect(step(skew)).toEqual({ action: 'none', reason: 'version-skew' });
        for (const fx of [unobserved, lawless, otherHost, skew]) expect(stubCount(fx)).toBe(0);
    });

    it('a promotion that would exceed the latency budget is not attempted in that session', () => {
        const f = freshInstall();
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        let t = 0;
        const clock = (): number => t;
        // 240 ms already spent, plus the default estimate, is over the 250-ms budget.
        expect(DEFAULT_THIN_ESTIMATE_MS).toBeGreaterThan(10);
        t = 240;
        expect(step(f, { now: clock, startedAt: 0 })).toEqual({ action: 'skipped', reason: 'over-latency-budget' });
        expect(stubCount(f)).toBe(0);
        t = 0;
        expect(step(f, { now: clock, startedAt: 0 }).action).toBe('promoted');
    });

    it('a file the user edited after install is never thinned', () => {
        const f = freshInstall();
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        const victim = allRules(f).find((id) => !LAWS.includes(id) && id === 'scope-control') ?? allRules(f).find((id) => !LAWS.includes(id)) as string;
        const file = path.join(f.rulesDir, `${victim}.md`);
        fs.appendFileSync(file, '\nmy own note\n');
        expect(step(f).action).toBe('promoted');
        expect(fs.readFileSync(file, 'utf8')).toContain('my own note');
        expect(is_thin_entry(fs.readFileSync(file, 'utf8'))).toBe(false);
    });

    it('a rule file the ledger does not record is never thinned', () => {
        // A rule a normal promotion DOES thin, so keeping it whole is the ledger's doing.
        const probe = freshInstall();
        arrive(probe, 'session-1', '2026-10-24T10:00:00Z', allRules(probe));
        expect(step(probe).action).toBe('promoted');
        const victim = allRules(probe).find((id) => is_thin_entry(fs.readFileSync(path.join(probe.rulesDir, `${id}.md`), 'utf8'))) as string;
        const f = freshInstall();
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        const inv = inventory.load_inventory(f.ledgerPath);
        const entry = (inv['tools'] as Record<string, { digests: Record<string, unknown> }>)['claude-code'] as { digests: Record<string, unknown> };
        delete entry.digests[`rules/${victim}.md`];
        inventory.save_inventory(inv, f.ledgerPath);
        expect(step(f).action).toBe('promoted');
        expect(stubCount(f)).toBeGreaterThan(0);
        expect(is_thin_entry(fs.readFileSync(path.join(f.rulesDir, `${victim}.md`), 'utf8'))).toBe(false);
    });

    it('without a readable promotion record the thinned marker sets the boundary', () => {
        for (const record of [null, '{not json', JSON.stringify({ promoted_at: 'yesterday' })]) {
            const f = freshInstall();
            arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
            expect(step(f).action).toBe('promoted');
            const file = path.join(f.runtimeRoot, PROMOTION_RECORD);
            if (record === null) fs.rmSync(file);
            else fs.writeFileSync(file, record);
            const marked = fs.statSync(path.join(f.runtimeRoot, 'thinned')).mtime.getTime();
            const missing = LAWS.find((id) => allRules(f).includes(id)) as string;
            const lawless = allRules(f).filter((id) => id !== missing);
            // Before the marker: not evidence about this layer.
            arrive(f, 'before', new Date(marked - 60_000).toISOString(), lawless);
            fs.rmSync(path.join(f.runtimeRoot, 'arrivals', 'session-1.jsonl'));
            expect(step(f)).toEqual({ action: 'none', reason: 'thinned-holds' });
            // After it: the layer is contradicted.
            arrive(f, 'after', new Date(marked + 60_000).toISOString(), lawless);
            expect(step(f)).toEqual({ action: 'demoted', reason: 'arrival-standing-law-missing' });
        }
    });

    it('an interrupted promotion is restored to full by the next session, whatever its arrivals say', () => {
        // Simulate termination at three points: after the markers, after some files, after the pass.
        for (const cut of ['markers', 'partial', 'before-record'] as const) {
            const f = freshInstall();
            arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
            expect(step(f).action).toBe('promoted');
            const stubs = stubCount(f);
            if (cut === 'markers') restoreAll(f);
            if (cut === 'partial') restoreAll(f, 2);
            // An owner that is gone: no live process holds this pid.
            fs.writeFileSync(path.join(f.runtimeRoot, PROMOTING_MARKER), `${DEAD_PID} ${Date.now()}\n`);
            if (cut === 'before-record') fs.rmSync(path.join(f.runtimeRoot, PROMOTION_RECORD));
            expect(stubs).toBeGreaterThan(0);
            arrive(f, 'session-2', new Date(Date.now() + 60_000).toISOString(), allRules(f));
            expect(step(f)).toEqual({ action: 'none', reason: 'promotion-interrupted' });
            expect(stubCount(f)).toBe(0);
            expect(readCarrierState(f.runtimeRoot).layer).toBe('full');
            expect(fs.existsSync(path.join(f.runtimeRoot, PROMOTING_MARKER))).toBe(false);
            expect(ledgerMatchesDisk(f)).toBe(true);
            // And the session after that converges: it promotes again.
            expect(step(f).action).toBe('promoted');
            expect(fs.existsSync(path.join(f.runtimeRoot, PROMOTING_MARKER))).toBe(false);
        }
    });

    it('a promotion still running in another session is left alone; a stale one is recovered', () => {
        const f = freshInstall();
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        expect(step(f).action).toBe('promoted');
        const lock = path.join(f.runtimeRoot, PROMOTING_MARKER);
        const stubs = stubCount(f);
        // Live owner (this process), fresh: neither restore nor a second pass.
        fs.writeFileSync(lock, `${process.pid} ${Date.now()}\n`);
        expect(step(f)).toEqual({ action: 'none', reason: 'promotion-in-progress' });
        expect(stubCount(f)).toBe(stubs);
        expect(readCarrierState(f.runtimeRoot).layer).toBe('thinned');
        // Same live owner, but older than any real pass: recovered.
        fs.writeFileSync(lock, `${process.pid} ${Date.now() - 60_000}\n`);
        expect(step(f)).toEqual({ action: 'none', reason: 'promotion-interrupted' });
        expect(stubCount(f)).toBe(0);
    });

    it('two sessions never promote at once, and a pass whose lock was taken records nothing', () => {
        const f = freshInstall();
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        const lock = path.join(f.runtimeRoot, PROMOTING_MARKER);
        fs.writeFileSync(lock, `${process.pid} ${Date.now()}\n`);
        expect(step(f)).toEqual({ action: 'none', reason: 'promotion-in-progress' });
        expect(stubCount(f)).toBe(0);
        fs.rmSync(lock);
        // Interleave: right after the thin pass, another session takes the lock.
        let calls = 0;
        const clock = (): number => {
            calls += 1;
            if (calls === 3) fs.writeFileSync(lock, `${DEAD_PID} 0\n`);
            return 0;
        };
        expect(step(f, { now: clock, startedAt: 0 })).toEqual({ action: 'none', reason: 'promotion-preempted' });
        expect(fs.existsSync(path.join(f.runtimeRoot, PROMOTION_RECORD))).toBe(false);
        // The taker's recovery then converges the layer to full.
        expect(step(f)).toEqual({ action: 'none', reason: 'promotion-interrupted' });
        expect(stubCount(f)).toBe(0);
        expect(ledgerMatchesDisk(f)).toBe(true);
    });

    it('the concern honours its kill switch and never throws without a staged runtime', () => {
        const f = freshInstall();
        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
        expect(runLayerPromotion({ ...f.env, AGENT_CONFIG_LAYER_PROMOTE: 'off' })).toEqual({ action: 'none', reason: 'kill-switch' });
        expect(stubCount(f)).toBe(0);
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'layer-promotion-bare-'));
        temps.push(bare);
        expect(sessionLayerStep({ env: { HOME: bare, EVENT4U_CONFIG_HOME: bare } })).toEqual({ action: 'none', reason: 'no-staged-runtime' });
    });
});
