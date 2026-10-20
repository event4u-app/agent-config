/**
 * road-to-skills-that-arrive-when-called 4.2–4.6.
 *
 * Each describe block is one step's verify. The refusal fixtures (4.3) are the
 * failure shapes K4 names from public reports against an external skills CLI —
 * each one is built here, not reasoned about.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    STAGING_SUFFIX,
    materialiseUnderLease,
    hashFolder,
    inspectPayload,
    loadLock,
    materialise,
    materialisedNames,
    release,
    saveLock,
} from '../../src/scripts/_lib/skill_materialisation.js';
import {
    collectLeases,
    holdLease,
    leaseDir,
    readLeaseNames,
    releaseLease,
    type SkillLease,
} from '../../src/scripts/_lib/skill_leases.js';
import {
    PLACEMENT,
    RECORDED_COMPLETENESS_ANSWER,
    REQUIRED_CELLS,
    RETRY_ONCE_AFTER_PLACEMENT,
    firstHostMaterialisation,
    materialisationEnabled,
    materialisationEnabledFrom,
} from '../../src/scripts/_lib/skill_materialisation_gate.js';
import {
    declaredSkills,
    triggeredNames,
} from '../../src/scripts/_lib/skill_materialisation_triggers.js';
import { iso_now } from '../../src/scripts/_lib/session_register.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

interface Fixture {
    tmp: string;
    payload: string;
    store: string;
    lock: string;
    anchor: string;
    skillsRoot: string;
}

function fixture(): Fixture {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'materialise-'));
    const payload = path.join(tmp, 'payload');
    const anchor = path.join(tmp, 'host');
    const f: Fixture = {
        tmp,
        payload,
        store: path.join(tmp, 'store'),
        lock: path.join(tmp, 'materialised-skills.json'),
        anchor,
        skillsRoot: path.join(anchor, 'skills'),
    };
    fs.mkdirSync(payload, { recursive: true });
    fs.mkdirSync(f.skillsRoot, { recursive: true });
    return f;
}

function payloadSkill(f: Fixture, name: string, body = 'body\n'): string {
    const dir = path.join(f.payload, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: d\n---\n\n${body}`);
    return dir;
}

function opts(f: Fixture, extra: Record<string, unknown> = {}) {
    return {
        host: 'claude-code',
        hostSkillsRoot: f.skillsRoot,
        hostAnchor: f.anchor,
        payloadDir: f.payload,
        storeDir: f.store,
        lockFile: f.lock,
        packageRoot: REPO_ROOT,
        skipGate: true,
        ...extra,
    } as Parameters<typeof materialise>[1];
}

describe('4.3 — from the staged payload, checked', () => {
    it('places a payload skill as a symlink into a hashed store, and is idempotent', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        const first = materialise('alpha', opts(f));
        expect(first.refusal).toBeNull();
        expect(first.placed).toBe(true);
        const dest = path.join(f.skillsRoot, 'alpha');
        expect(fs.lstatSync(dest).isSymbolicLink()).toBe(true);
        expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf-8')).toContain('name: alpha');

        const lock = loadLock(f.lock);
        expect(lock.entries).toHaveLength(1);
        expect(lock.entries[0]!.sha256).toBe(hashFolder(path.join(f.payload, 'alpha')));

        const before = fs.readFileSync(f.lock, 'utf-8');
        const second = materialise('alpha', opts(f));
        expect(second.placed).toBe(true);
        expect(fs.readFileSync(f.lock, 'utf-8')).toBe(before);
    });

    it('writes a lock that is byte-stable across two runs and carries no timestamp', () => {
        const f = fixture();
        payloadSkill(f, 'b');
        payloadSkill(f, 'a');
        materialise('b', opts(f));
        materialise('a', opts(f));
        const once = fs.readFileSync(f.lock, 'utf-8');

        // `b` went in first, so insertion order and file order differ.
        expect(JSON.parse(once).entries.map((e: { name: string }) => e.name)).toEqual(['a', 'b']);
        expect(once).not.toMatch(/\d{4}-\d{2}-\d{2}T/);

        // The same two rows handed over in the other order serialise to the
        // same bytes — which is what makes the lock diffable.
        const rows = loadLock(f.lock).entries;
        const other = path.join(f.tmp, 'other.json');
        saveLock(other, { schema_version: 1, entries: [rows[1]!, rows[0]!] });
        expect(fs.readFileSync(other, 'utf-8')).toBe(once);
    });

    it('refuses a tampered payload against a recorded hash', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        materialise('alpha', opts(f));
        fs.writeFileSync(path.join(f.payload, 'alpha', 'SKILL.md'), '---\nname: alpha\n---\nTAMPERED\n');
        const res = materialise('alpha', opts(f));
        expect(res.refusal?.code).toBe('hash-mismatch');
        expect(res.placed).toBe(false);
    });

    it('refuses a path that escapes the payload root', () => {
        const f = fixture();
        const res = materialise(path.join('..', 'outside'), opts(f));
        expect(res.refusal?.code).toBe('path-escape');
    });

    it('refuses a symlink inside the payload that points outside it', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        const outside = path.join(f.tmp, 'secret.txt');
        fs.writeFileSync(outside, 'secret');
        fs.symlinkSync(outside, path.join(f.payload, 'alpha', 'leak.txt'));
        expect(inspectPayload(f.payload, 'alpha')?.code).toBe('symlink-escape');
        const res = materialise('alpha', opts(f));
        expect(res.refusal?.code).toBe('symlink-escape');
        expect(fs.existsSync(path.join(f.skillsRoot, 'alpha'))).toBe(false);
    });

    it('refuses a half-written entry rather than reusing or deleting it', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        const staging = path.join(f.store, 'claude-code', `alpha${STAGING_SUFFIX}`);
        fs.mkdirSync(staging, { recursive: true });
        fs.writeFileSync(path.join(staging, 'half'), 'x');
        const res = materialise('alpha', opts(f));
        expect(res.refusal?.code).toBe('partial-write');
        // K4: the interrupted directory survives. Deleting it silently is the
        // unmanaged-directory removal this refusal exists to avoid.
        expect(fs.existsSync(staging)).toBe(true);
    });

    it('refuses a name the payload does not carry', () => {
        const f = fixture();
        expect(materialise('absent', opts(f)).refusal?.code).toBe('not-in-payload');
    });

    it('hashes a folder deterministically and notices one changed byte', () => {
        const f = fixture();
        const dir = payloadSkill(f, 'alpha');
        const h1 = hashFolder(dir);
        expect(hashFolder(dir)).toBe(h1);
        fs.writeFileSync(path.join(dir, 'extra.md'), 'x');
        expect(hashFolder(dir)).not.toBe(h1);
    });
});

describe('4.5 — only its own entries', () => {
    it('leaves a foreign entry untouched through a full collect', () => {
        const f = fixture();
        payloadSkill(f, 'ours');
        materialise('ours', opts(f));
        const foreign = path.join(f.skillsRoot, 'theirs');
        fs.mkdirSync(foreign, { recursive: true });
        fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'theirs');

        const res = release(f.lock, f.skillsRoot, ['ours', 'theirs'], f.store);
        expect(res.removed).toEqual(['ours']);
        expect(fs.existsSync(path.join(foreign, 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(f.skillsRoot, 'ours'))).toBe(false);
        expect(fs.existsSync(f.lock)).toBe(false);
    });

    it('refuses to shadow a name already on disk that the lock does not claim', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        fs.mkdirSync(path.join(f.skillsRoot, 'alpha'), { recursive: true });
        const res = materialise('alpha', opts(f));
        expect(res.refusal?.code).toBe('would-shadow');
    });

    it('refuses to shadow a host built-in', () => {
        const f = fixture();
        payloadSkill(f, 'init');
        expect(materialise('init', opts(f)).refusal?.code).toBe('would-shadow');
    });

    it('never writes into a tree outside the host anchor', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        const project = path.join(f.tmp, 'some-project', '.claude', 'skills');
        fs.mkdirSync(project, { recursive: true });
        const res = materialise('alpha', opts(f, { hostSkillsRoot: project }));
        expect(res.refusal?.code).toBe('project-tree');
        expect(fs.existsSync(path.join(project, 'alpha'))).toBe(false);
    });

    it('keeps a locked entry whose host side is a real directory, not our link', () => {
        const f = fixture();
        saveLock(f.lock, {
            schema_version: 1,
            entries: [{ host: 'claude-code', name: 'x', root: f.skillsRoot, sha256: 'deadbeef' }],
        });
        fs.mkdirSync(path.join(f.skillsRoot, 'x'), { recursive: true });
        const res = release(f.lock, f.skillsRoot, ['x'], f.store);
        expect(res.kept_foreign).toEqual(['x']);
        expect(fs.existsSync(path.join(f.skillsRoot, 'x'))).toBe(true);
    });

    it('removes nothing for a lock written under a different root', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        materialise('alpha', opts(f));
        const res = release(f.lock, path.join(f.tmp, 'other-profile', 'skills'), ['alpha'], f.store);
        expect(res.removed).toEqual([]);
        expect(materialisedNames(f.lock, f.skillsRoot)).toEqual(['alpha']);
    });
});

describe('4.4 — lifetime is a lease, not a task', () => {
    function lease(id: string, names: string[], lastSeen: string): SkillLease {
        return {
            session_id: id,
            platform: 'claude',
            worktree: '/w',
            branch: null,
            roadmap_slug: null,
            started_at: lastSeen,
            last_seen: lastSeen,
            host_root: '/host',
            names,
        };
    }

    it('removes nothing under a live lease and collects an expired one', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leases-'));
        const now = new Date('2026-10-20T12:00:00Z');
        const fresh = iso_now(new Date(now.getTime() - 60_000));
        // The claude TTL is measured at 4 h; 5 h back is past it.
        const stale = iso_now(new Date(now.getTime() - 5 * 60 * 60 * 1000));
        holdLease(dir, lease('live', ['alpha'], fresh));
        holdLease(dir, lease('dead', ['beta'], stale));

        const res = collectLeases(dir, ['alpha', 'beta'], now);
        expect(res.held).toEqual(['alpha']);
        expect(res.releasable).toEqual(['beta']);
        expect(res.expired).toHaveLength(1);

        // Second collect: the expired file is gone and the verdict is stable.
        const again = collectLeases(dir, ['alpha', 'beta'], now);
        expect(again.expired).toEqual([]);
        expect(again.held).toEqual(['alpha']);
    });

    it('two sessions holding the same entry keep it until both are gone', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leases-'));
        const now = new Date('2026-10-20T12:00:00Z');
        const fresh = iso_now(new Date(now.getTime() - 60_000));
        holdLease(dir, lease('one', ['alpha'], fresh));
        holdLease(dir, lease('two', ['alpha'], fresh));
        expect(collectLeases(dir, ['alpha'], now).held).toEqual(['alpha']);
        releaseLease(dir, 'one');
        expect(collectLeases(dir, ['alpha'], now).held).toEqual(['alpha']);
        releaseLease(dir, 'two');
        expect(collectLeases(dir, ['alpha'], now).releasable).toEqual(['alpha']);
    });

    it('treats an unreadable lease as expired rather than as a live one', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leases-'));
        fs.writeFileSync(path.join(dir, 'junk.json'), '{not json');
        const res = collectLeases(dir, ['alpha'], new Date());
        expect(res.expired).toEqual(['junk.json']);
        expect(res.releasable).toEqual(['alpha']);
    });

    it('ignores a name the caller does not own', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leases-'));
        holdLease(dir, lease('live', ['not-ours'], iso_now()));
        const res = collectLeases(dir, ['alpha'], new Date());
        expect(res.held).toEqual([]);
        expect(res.releasable).toEqual(['alpha']);
    });

    it('keeps two host config roots in separate lease directories', () => {
        const env = { EVENT4U_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'e4u-')) };
        const a = leaseDir('/Users/x/.claude', env);
        const b = leaseDir('/Users/x/.claude-work', env);
        expect(a).not.toBe(b);
        expect(path.dirname(a)).toBe(path.dirname(b));
        // Keyed by digest, so a separator or a space in the root cannot become
        // a second directory level.
        expect(path.basename(a)).toMatch(/^[0-9a-f]{16}$/);
        expect(leaseDir('/Users/x/.claude/', env)).toBe(a);
    });

    it('is empty, not thrown, when no lease directory exists yet', () => {
        const res = collectLeases(path.join(os.tmpdir(), 'no-such-lease-dir-xyz'), ['alpha']);
        expect(res.expired).toEqual([]);
        expect(res.releasable).toEqual(['alpha']);
    });
});

describe('4.2 — triggers are the package\'s own', () => {
    const installed = new Set<string>(['already']);

    it('materialises on a command expansion that declares the skill', () => {
        expect(triggeredNames({ kind: 'command-expanded', names: ['refine-ticket', 'already'] }, installed))
            .toEqual(['refine-ticket']);
    });

    it('materialises on a search row that was read', () => {
        expect(triggeredNames({ kind: 'search-read', names: ['threat-modeling'] }, installed))
            .toEqual(['threat-modeling']);
    });

    it('materialises on a name that was called', () => {
        expect(triggeredNames({ kind: 'called-by-name', names: ['docker'] }, installed)).toEqual(['docker']);
    });

    it('never materialises on a model guess', () => {
        expect(triggeredNames({ kind: 'model-suggested', names: ['docker'] }, installed)).toEqual([]);
    });

    it('reads both declaration keys, inline and block', () => {
        expect(declaredSkills('skills: [a, b]\nrequires_skills:\n  - c\n  - "d"\n')).toEqual(['a', 'b', 'c', 'd']);
        expect(declaredSkills('name: x\n')).toEqual([]);
    });
});

describe('4.6 — the first host waits, as a decision test', () => {
    it('enables the first host on its own observed rows', () => {
        const v = materialisationEnabled('claude-code', REPO_ROOT);
        expect(v.reasons).toEqual([]);
        expect(v.enabled).toBe(true);
        expect(v.cells.map((c) => c.id)).toEqual(REQUIRED_CELLS['claude-code']);
    });

    it('denies the second host while its pickup cell is unobserved', () => {
        const v = materialisationEnabled('codex', REPO_ROOT);
        expect(v.enabled).toBe(false);
        expect(v.reasons.join(' ')).toContain('unobserved');
    });

    it('denies a host nobody has decided about', () => {
        expect(materialisationEnabled('cursor', REPO_ROOT).enabled).toBe(false);
    });

    it('denies on an expired row even when it reads observed-true', () => {
        const rows = {
            'a-same-turn-pickup-symlink': {
                host: 'claude', state: 'observed-true', host_version: '1', transcript: 't',
                date: '2026-01-01', expiry: '2026-02-01', reason: 'x'.repeat(30),
            },
            'b-removed-skill-second-session': {
                host: 'claude', state: 'observed-true', host_version: '1', transcript: 't',
                date: '2026-01-01', expiry: '2099-01-01', reason: 'x'.repeat(30),
            },
        };
        const v = materialisationEnabledFrom('claude-code', rows, new Date('2026-10-20T00:00:00Z'));
        expect(v.enabled).toBe(false);
        expect(v.reasons.join(' ')).toContain('expired');
    });

    it('denies on observed-false, the same as on unobserved', () => {
        const rows = {
            'a-same-turn-pickup-symlink': {
                host: 'claude', state: 'observed-false', host_version: '1', transcript: 't',
                date: '2026-01-01', expiry: '2099-01-01', reason: 'x'.repeat(30),
            },
            'b-removed-skill-second-session': {
                host: 'claude', state: 'observed-true', host_version: '1', transcript: 't',
                date: '2026-01-01', expiry: '2099-01-01', reason: 'x'.repeat(30),
            },
        };
        expect(materialisationEnabledFrom('claude-code', rows).enabled).toBe(false);
    });

    it('refuses to materialise into a host the gate denies', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        const res = materialise('alpha', opts(f, { host: 'codex', skipGate: false }));
        expect(res.refusal?.code).toBe('host-not-enabled');
    });

    it('decides the first host for each completeness answer, not only the one that won', () => {
        // (a) presence: everything is installed, so there is nothing to bring in.
        expect(firstHostMaterialisation('presence', 'no-harm').materialises).toBe(false);
        // (c) pack-scoped: the install as it stands IS the promise.
        expect(firstHostMaterialisation('pack-scoped', 'no-harm').materialises).toBe(false);
        // (b) reach: presence is per host — the only answer that makes it legal.
        expect(firstHostMaterialisation('reach', 'no-harm').materialises).toBe(true);
    });

    it('keeps the first host on its full install until Phase 5 reads no harm', () => {
        expect(RECORDED_COMPLETENESS_ANSWER).toBe('reach');
        const waiting = firstHostMaterialisation(RECORDED_COMPLETENESS_ANSWER, 'not-read');
        expect(waiting.materialises).toBe(false);
        expect(waiting.reason).toContain('has not read');
        expect(firstHostMaterialisation(RECORDED_COMPLETENESS_ANSWER, 'harm').materialises).toBe(false);
    });

    it('names the observed placement mechanism and the retry the race needs', () => {
        expect(PLACEMENT['claude-code']).toBe('symlink');
        expect(PLACEMENT['codex']).toBeUndefined();
        expect(RETRY_ONCE_AFTER_PLACEMENT.has('claude-code')).toBe(true);
    });
});

describe('4.4 — the collect runs where materialisation runs', () => {
    const session = { session_id: 's1', platform: 'claude', worktree: '/w' };

    function leased(f: Fixture, extra: Record<string, unknown> = {}) {
        return {
            ...(opts(f) as Record<string, unknown>),
            session,
            leaseDirectory: path.join(f.tmp, 'leases'),
            ...extra,
        } as Parameters<typeof materialiseUnderLease>[1];
    }

    it('takes a lease for what it places', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        const res = materialiseUnderLease('alpha', leased(f));
        expect(res.placed).toBe(true);
        expect(readLeaseNames(path.join(f.tmp, 'leases'), 's1')).toEqual(['alpha']);
    });

    it('collects an entry no live lease holds, before placing the next one', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        payloadSkill(f, 'beta');
        const now = new Date('2026-10-20T12:00:00Z');
        materialiseUnderLease('alpha', leased(f, { now }));
        // Five hours later the claude TTL has passed, so s1's lease is dead.
        const later = new Date(now.getTime() + 5 * 60 * 60 * 1000);
        const res = materialiseUnderLease('beta', leased(f, {
            now: later,
            session: { ...session, session_id: 's2' },
        }));
        expect(res.collected).toEqual(['alpha']);
        expect(fs.existsSync(path.join(f.skillsRoot, 'alpha'))).toBe(false);
        expect(fs.existsSync(path.join(f.skillsRoot, 'beta'))).toBe(true);
    });

    it('never collects an entry a live lease still holds', () => {
        const f = fixture();
        payloadSkill(f, 'alpha');
        payloadSkill(f, 'beta');
        const now = new Date('2026-10-20T12:00:00Z');
        materialiseUnderLease('alpha', leased(f, { now }));
        const soon = new Date(now.getTime() + 60_000);
        const res = materialiseUnderLease('beta', leased(f, {
            now: soon,
            session: { ...session, session_id: 's2' },
        }));
        expect(res.collected).toEqual([]);
        expect(fs.existsSync(path.join(f.skillsRoot, 'alpha'))).toBe(true);
    });

    it('does not take a lease for an entry it refused', () => {
        const f = fixture();
        const res = materialiseUnderLease('absent', leased(f));
        expect(res.refusal?.code).toBe('not-in-payload');
        expect(readLeaseNames(path.join(f.tmp, 'leases'), 's1')).toBeNull();
    });
});
