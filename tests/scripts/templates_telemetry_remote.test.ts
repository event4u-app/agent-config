/**
 * Class-A record schema + the `telemetry.remote` settings reader
 * (road-to-org-telemetry Phase 1).
 *
 * The two properties worth asserting are both negative: an install that did
 * not fully opt in is inactive, and a digest is never derivable without the
 * org-pack salt. The positive path (a record gets written) is the easy half
 * and is covered last.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    read_remote_settings,
    DEFAULT_REMOTE_LOG_PATH,
    DEFAULT_REMOTE_RETENTION,
} from '../../src/agent-src/templates/scripts/telemetry/settings.js';
import {
    append_class_a_record,
    build_class_a_record,
    derive_session_hash,
    derive_user_hash,
    enforce_retention,
    hour_bucket,
    normalise_skill_name,
    record_line_ms,
    retention_due,
    ClassARecordError,
    DEFAULT_RETENTION_MAX_AGE_DAYS,
    DEFAULT_RETENTION_MAX_BYTES,
    HASH_HEX_LEN,
    RETENTION_KEEP_FRACTION,
} from '../../src/agent-src/templates/scripts/telemetry/remote.js';

const tmpdirs: string[] = [];

function writeSettings(body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-telemetry-'));
    tmpdirs.push(dir);
    const p = path.join(dir, '.agent-settings.yml');
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

afterEach(() => {
    while (tmpdirs.length > 0) {
        const dir = tmpdirs.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

const FULL = `
telemetry:
  remote:
    enabled: true
    endpoint: "https://sink.example.invalid/ingest"
    org_id: "acme"
    salt: "org-pack-secret"
`;

describe('read_remote_settings — default-off on every axis', () => {
    it('is inactive when the file does not exist', () => {
        const s = read_remote_settings(path.join(os.tmpdir(), 'definitely-absent-xyz.yml'));
        expect(s.enabled).toBe(false);
        expect(s.active).toBe(false);
        expect(s.log_path).toBe(DEFAULT_REMOTE_LOG_PATH);
    });

    it('is inactive when the YAML is unparseable', () => {
        const s = read_remote_settings(writeSettings('telemetry: [: :\n  broken'));
        expect(s.active).toBe(false);
    });

    it('is inactive when the section is absent', () => {
        const s = read_remote_settings(writeSettings('telemetry:\n  artifact_engagement:\n    enabled: true\n'));
        expect(s.active).toBe(false);
    });

    // The load-bearing case: `enabled: true` alone must NOT switch it on,
    // because that is the shape a clone of the public repository could
    // reach by copying the documented block.
    it.each([
        ['endpoint', 'enabled: true\n    org_id: "acme"\n    salt: "s"'],
        ['org_id', 'enabled: true\n    endpoint: "https://x.invalid"\n    salt: "s"'],
        ['salt', 'enabled: true\n    endpoint: "https://x.invalid"\n    org_id: "acme"'],
    ])('is inactive when %s is missing, and says so', (field, body) => {
        const s = read_remote_settings(writeSettings(`telemetry:\n  remote:\n    ${body}\n`));
        expect(s.enabled).toBe(true);
        expect(s.active).toBe(false);
        expect(s.missing).toContain(field);
    });

    it('is active only with all four, and reports nothing missing', () => {
        const s = read_remote_settings(writeSettings(FULL));
        expect(s.active).toBe(true);
        expect(s.missing).toEqual([]);
        expect(s.org_id).toBe('acme');
    });

    it('falls back to session-end on an unknown flush value', () => {
        const s = read_remote_settings(writeSettings(`${FULL}    flush: whenever\n`));
        expect(s.flush).toBe('session-end');
    });
});

describe('normalise_skill_name', () => {
    // Phase 0 spike 3's measured defect: one skill, two spellings, counts
    // split roughly 64/22 on the busiest entries.
    it('collapses the cluster and flattened spellings onto one id', () => {
        expect(normalise_skill_name('roadmap:process-full'))
            .toBe(normalise_skill_name('roadmap-process-full'));
        expect(normalise_skill_name('roadmap:process-full')).toBe('roadmap-process-full');
    });

    it('leaves a dash-only name untouched', () => {
        expect(normalise_skill_name('brand-asset-generation')).toBe('brand-asset-generation');
    });

    it.each([
        ['a path', 'src/skills/foo/SKILL.md'],
        ['a file extension', 'foo.md'],
        ['a newline', 'foo\nbar'],
        ['an empty value', ''],
        ['a non-string', 42],
    ])('rejects %s rather than recording it', (_label, value) => {
        expect(() => normalise_skill_name(value)).toThrow();
    });
});

describe('hashes', () => {
    it('refuses to produce an unsalted digest', () => {
        expect(() => derive_user_hash('', 'host', 'user')).toThrow(ClassARecordError);
    });

    it('is stable per input and the documented length', () => {
        const a = derive_user_hash('salt', 'machine', 'alice');
        expect(a).toBe(derive_user_hash('salt', 'machine', 'alice'));
        expect(a).toHaveLength(HASH_HEX_LEN);
        expect(a).toMatch(/^[0-9a-f]+$/u);
    });

    it('changes with the salt — the whole point of having one', () => {
        expect(derive_user_hash('salt-a', 'machine', 'alice'))
            .not.toBe(derive_user_hash('salt-b', 'machine', 'alice'));
    });

    // The NUL join exists so that a username containing a space cannot
    // collide with a different (hostname, username) split.
    it('does not collide across an ambiguous space split', () => {
        expect(derive_user_hash('s', 'a b', 'c')).not.toBe(derive_user_hash('s', 'a', 'b c'));
    });

    it('domain-separates the user and session digests under one salt', () => {
        expect(derive_user_hash('s', 'x', 'y')).not.toBe(derive_session_hash('s', 'x'));
    });
});

describe('hour_bucket', () => {
    it('truncates to the hour — never an exact timestamp', () => {
        expect(hour_bucket(new Date('2026-08-18T21:47:13.512Z'))).toBe('2026-08-18T21:00Z');
    });
});

describe('build_class_a_record', () => {
    const base = {
        skill: 'roadmap:process-full',
        host: 'claude',
        org_id: 'acme',
        salt: 'org-pack-secret',
        hostname: 'machine',
        username: 'alice',
        session_id: 'sess-abc',
        now: new Date('2026-08-18T21:47:13Z'),
    };

    it('carries only structural fields, and no raw session id or login', () => {
        const rec = build_class_a_record({ ...base, package_version: '14.1.0', discipline_profile: 'essential' });
        expect(Object.keys(rec).sort()).toEqual([
            'discipline_profile', 'host', 'org_id', 'package_version', 'record_class',
            'schema_version', 'session_hash', 'skill', 'ts_bucket', 'user_hash',
        ]);
        const serialised = JSON.stringify(rec);
        expect(serialised).not.toContain('sess-abc');
        expect(serialised).not.toContain('alice');
        expect(serialised).not.toContain('org-pack-secret');
    });

    it('normalises the skill name on the way in', () => {
        expect(build_class_a_record(base).skill).toBe('roadmap-process-full');
    });

    it('records an unknown package version and rule tier as null, never a guess', () => {
        const rec = build_class_a_record(base);
        expect(rec.package_version).toBeNull();
        expect(rec.discipline_profile).toBeNull();
    });

    it('rejects a discipline profile outside the settings enum', () => {
        expect(() => build_class_a_record({ ...base, discipline_profile: 'turbo' })).toThrow(ClassARecordError);
        // The legacy tier vocabulary is NOT the profile vocabulary; recording
        // one under the other is the high finding this rename repaired.
        expect(() => build_class_a_record({ ...base, discipline_profile: 'balanced' })).toThrow(ClassARecordError);
    });

    it('rejects a record class outside the closed vocabulary', () => {
        expect(() => build_class_a_record({ ...base, record_class: 'failure' })).toThrow(ClassARecordError);
    });

    it('records an absent host as null rather than a sentinel string', () => {
        expect(build_class_a_record({ ...base, host: null }).host).toBeNull();
    });

    it('records an absent session id as null, never the empty-string digest', () => {
        const rec = build_class_a_record({ ...base, session_id: '' });
        expect(rec.session_hash).toBeNull();
        expect(rec.user_hash).not.toBeNull();
    });
});

describe('append_class_a_record', () => {
    it('writes one sorted compact JSONL line and creates the directory', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-telemetry-out-'));
        tmpdirs.push(dir);
        const log = path.join(dir, 'nested', 'out.jsonl');
        const rec = build_class_a_record({
            skill: 'brand-identity',
            host: 'claude',
            org_id: 'acme',
            salt: 's',
            hostname: 'm',
            username: 'u',
            session_id: 'sid',
            now: new Date('2026-08-18T21:00:00Z'),
        });
        append_class_a_record(log, rec);
        append_class_a_record(log, rec);

        const lines = fs.readFileSync(log, 'utf-8').trimEnd().split('\n');
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[0] as string)).toEqual(rec);
        // Sorted keys, compact separators — same convention as the
        // engagement records already in this tree. Asserted as the property
        // rather than by pinning whichever key happens to sort first, which
        // is a detail a field rename legitimately changes.
        const keys = (lines[0] as string).match(/"([a-z_]+)":/gu) as string[];
        expect(keys).toEqual([...keys].sort());
        expect(lines[0]).not.toContain(', ');
    });
});

// ── Retention (road-to-org-telemetry Phase 2 step 2) ────────────────────
//
// The property under test is a growth BUDGET, so every assertion here is
// derived from the inputs — a cap, a clock, and the records actually written
// — rather than pinned to a line count some future field rename would move.

function makeRecord(skill: string, when: string): ReturnType<typeof build_class_a_record> {
    return build_class_a_record({
        skill,
        host: 'claude',
        org_id: 'acme',
        salt: 's',
        hostname: 'm',
        username: 'u',
        session_id: 'sid',
        now: new Date(when),
    });
}

function newLog(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-telemetry-ret-'));
    tmpdirs.push(dir);
    return path.join(dir, 'telemetry.jsonl');
}

/** Write lines verbatim, bypassing the appender's own enforcement. */
function seed(log: string, lines: readonly string[]): void {
    fs.writeFileSync(log, lines.length === 0 ? '' : `${lines.join('\n')}\n`, 'utf-8');
}

function lineFor(skill: string, when: string): string {
    return JSON.stringify(makeRecord(skill, when));
}

function readLines(log: string): string[] {
    return fs.readFileSync(log, 'utf-8').split('\n').filter((l) => l.length > 0);
}

describe('record_line_ms', () => {
    it('dates a real record from its own ts_bucket', () => {
        const when = '2026-05-04T07:00:00Z';
        const rec = makeRecord('brand-identity', when);
        // Derived from the bucket the record carries, not from `when` — the
        // record is hour-bucketed, so asserting against the raw input would
        // pin the truncation rather than the parse.
        expect(record_line_ms(JSON.stringify(rec))).toBe(Date.parse(rec.ts_bucket));
    });

    it('returns null for every shape it cannot date', () => {
        for (const bad of [
            '',
            '   ',
            'not json',
            '[1,2,3]',
            'null',
            '"a string"',
            JSON.stringify({ skill: 'x' }),
            JSON.stringify({ ts_bucket: 42 }),
            JSON.stringify({ ts_bucket: 'yesterday' }),
        ]) {
            expect(record_line_ms(bad)).toBeNull();
        }
    });
});

describe('retention_due', () => {
    const policy = { max_age_days: 30, max_bytes: 4096 };

    it('is false for an absent or empty log', () => {
        const log = newLog();
        expect(retention_due(log, policy)).toBe(false);
        fs.writeFileSync(log, '', 'utf-8');
        expect(retention_due(log, policy)).toBe(false);
    });

    it('is false while the oldest record is inside the window and the file is under the cap', () => {
        const log = newLog();
        seed(log, [lineFor('a', '2026-05-01T00:00:00Z'), lineFor('b', '2026-05-20T00:00:00Z')]);
        expect(retention_due(log, policy, new Date('2026-05-21T00:00:00Z'))).toBe(false);
    });

    it('fires on age as soon as the OLDEST record leaves the window', () => {
        const log = newLog();
        const oldest = '2026-05-01T00:00:00Z';
        seed(log, [lineFor('a', oldest), lineFor('b', '2026-06-01T00:00:00Z')]);
        const cutoffDay = new Date(Date.parse(oldest) + policy.max_age_days * 86_400_000);
        // One hour before the record ages out: nothing owed.
        expect(retention_due(log, policy, new Date(cutoffDay.getTime() - 3_600_000))).toBe(false);
        // One hour after: owed.
        expect(retention_due(log, policy, new Date(cutoffDay.getTime() + 3_600_000))).toBe(true);
    });

    it('fires on size regardless of age', () => {
        const log = newLog();
        const line = lineFor('a', '2026-06-01T00:00:00Z');
        const needed = Math.ceil(policy.max_bytes / (line.length + 1)) + 1;
        seed(log, Array.from({ length: needed }, () => line));
        expect(fs.statSync(log).size).toBeGreaterThan(policy.max_bytes);
        // Every record is same-day fresh, so only the byte cap can be firing.
        expect(retention_due(log, policy, new Date('2026-06-01T12:00:00Z'))).toBe(true);
    });

    it('does not fire on age it cannot read', () => {
        const log = newLog();
        seed(log, ['not a record', lineFor('a', '2026-06-01T00:00:00Z')]);
        expect(retention_due(log, policy, new Date('2030-01-01T00:00:00Z'))).toBe(false);
    });
});

describe('enforce_retention', () => {
    const policy = { max_age_days: 30, max_bytes: 4096 };

    it('drops exactly the records outside the window and keeps the rest in order', () => {
        const log = newLog();
        const kept = [
            lineFor('fresh-1', '2026-06-10T00:00:00Z'),
            lineFor('fresh-2', '2026-06-20T00:00:00Z'),
        ];
        const stale = [lineFor('old-1', '2026-01-01T00:00:00Z'), lineFor('old-2', '2026-02-01T00:00:00Z')];
        seed(log, [...stale, ...kept]);

        const res = enforce_retention(log, policy, new Date('2026-06-25T00:00:00Z'));

        expect(res.dropped_by_age).toBe(stale.length);
        expect(res.kept).toBe(kept.length);
        expect(readLines(log)).toEqual(kept);
    });

    it('keeps a line it cannot date rather than deleting data it could not classify', () => {
        const log = newLog();
        const undatable = 'corrupted-half-line';
        seed(log, [undatable, lineFor('old', '2026-01-01T00:00:00Z'), lineFor('new', '2026-06-20T00:00:00Z')]);

        enforce_retention(log, policy, new Date('2026-06-25T00:00:00Z'));

        expect(readLines(log)).toContain(undatable);
    });

    it('holds the file under the keep-fraction of the byte cap, keeping the NEWEST records', () => {
        const log = newLog();
        const day = 86_400_000;
        const base = Date.parse('2026-06-01T00:00:00Z');
        const line = lineFor('a', '2026-06-01T00:00:00Z');
        const count = Math.ceil((policy.max_bytes * 2) / (line.length + 1));
        // Distinct skill names make ordering observable; all same-hour, so
        // the age pass cannot be what prunes.
        const lines = Array.from({ length: count }, (_, i) =>
            lineFor(`s${i}`, new Date(base + i * 1000).toISOString()));
        seed(log, lines);

        const res = enforce_retention(log, policy, new Date(base + day));

        expect(res.dropped_by_age).toBe(0);
        expect(res.dropped_by_size).toBeGreaterThan(0);
        expect(fs.statSync(log).size).toBeLessThanOrEqual(
            Math.floor(policy.max_bytes * RETENTION_KEEP_FRACTION),
        );
        // The survivors are the tail of the input, unreordered.
        const survivors = readLines(log);
        expect(survivors).toEqual(lines.slice(lines.length - survivors.length));
    });

    it('rewrites nothing and reports no drops when the log is already inside budget', () => {
        const log = newLog();
        const lines = [lineFor('a', '2026-06-20T00:00:00Z')];
        seed(log, lines);
        const before = fs.statSync(log).mtimeMs;

        const res = enforce_retention(log, policy, new Date('2026-06-21T00:00:00Z'));

        expect(res).toEqual({ kept: lines.length, dropped_by_age: 0, dropped_by_size: 0 });
        expect(fs.statSync(log).mtimeMs).toBe(before);
    });

    it('empties the log when nothing survives, and leaves no temp file behind', () => {
        const log = newLog();
        seed(log, [lineFor('a', '2026-01-01T00:00:00Z')]);

        const res = enforce_retention(log, policy, new Date('2027-01-01T00:00:00Z'));

        expect(res.kept).toBe(0);
        expect(fs.readFileSync(log, 'utf-8')).toBe('');
        expect(fs.existsSync(`${log}.retention.tmp`)).toBe(false);
        // An emptied log must not re-trigger on the next append.
        expect(retention_due(log, policy, new Date('2027-01-01T00:00:00Z'))).toBe(false);
    });

    it('is a no-op on an absent log rather than throwing', () => {
        const res = enforce_retention(path.join(os.tmpdir(), 'absent-retention-xyz.jsonl'), policy);
        expect(res).toEqual({ kept: 0, dropped_by_age: 0, dropped_by_size: 0 });
    });
});

describe('append_class_a_record enforces the budget itself', () => {
    it('evicts records that aged out, without the caller running a sweep', () => {
        const log = newLog();
        const policy = { max_age_days: 30, max_bytes: 4096 };
        seed(log, [lineFor('ancient', '2026-01-01T00:00:00Z')]);

        const fresh = makeRecord('current', '2026-06-20T00:00:00Z');
        append_class_a_record(log, fresh, policy, new Date('2026-06-20T00:00:00Z'));

        const lines = readLines(log);
        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0] as string)).toEqual(fresh);
    });

    it('leaves an in-budget log untouched apart from the new line', () => {
        const log = newLog();
        const policy = { max_age_days: 30, max_bytes: 4096 };
        const existing = lineFor('kept', '2026-06-19T00:00:00Z');
        seed(log, [existing]);

        append_class_a_record(
            log,
            makeRecord('added', '2026-06-20T00:00:00Z'),
            policy,
            new Date('2026-06-20T00:00:00Z'),
        );

        expect(readLines(log)[0]).toBe(existing);
        expect(readLines(log)).toHaveLength(2);
    });

    it('bounds an unbounded writer — the defect Phase 1 shipped', () => {
        const log = newLog();
        const policy = { max_age_days: 3650, max_bytes: 2048 };
        const base = Date.parse('2026-06-01T00:00:00Z');

        // Every record is inside the age window, so only the byte cap can
        // stop this. Without one, this loop grows the file without limit.
        for (let i = 0; i < 200; i += 1) {
            const at = new Date(base + i * 3_600_000);
            append_class_a_record(log, makeRecord(`s${i}`, at.toISOString()), policy, at);
            expect(fs.statSync(log).size).toBeLessThanOrEqual(policy.max_bytes);
        }
    });
});

describe('retention settings', () => {
    it('takes the measured defaults when no retention section is declared', () => {
        const s = read_remote_settings(writeSettings(FULL));
        expect(s.retention_max_age_days).toBe(DEFAULT_REMOTE_RETENTION.max_age_days);
        expect(s.retention_max_bytes).toBe(DEFAULT_REMOTE_RETENTION.max_bytes);
    });

    it('pairs with the enforcing module, so the two cannot drift apart', () => {
        expect(DEFAULT_REMOTE_RETENTION.max_age_days).toBe(DEFAULT_RETENTION_MAX_AGE_DAYS);
        expect(DEFAULT_REMOTE_RETENTION.max_bytes).toBe(DEFAULT_RETENTION_MAX_BYTES);
    });

    it('honours a positive integer override', () => {
        const s = read_remote_settings(writeSettings(`${FULL}
    retention:
      max_age_days: 7
      max_bytes: 12345
`));
        expect(s.retention_max_age_days).toBe(7);
        expect(s.retention_max_bytes).toBe(12345);
    });

    it('refuses every value that would mean "unbounded" or "prune everything"', () => {
        for (const bad of ['0', '-1', '1.5', 'true', '"90"', '[]']) {
            const s = read_remote_settings(writeSettings(`${FULL}
    retention:
      max_age_days: ${bad}
      max_bytes: ${bad}
`));
            expect(s.retention_max_age_days).toBe(DEFAULT_REMOTE_RETENTION.max_age_days);
            expect(s.retention_max_bytes).toBe(DEFAULT_REMOTE_RETENTION.max_bytes);
        }
    });
});
