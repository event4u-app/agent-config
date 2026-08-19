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
} from '../../src/agent-src/templates/scripts/telemetry/settings.js';
import {
    append_class_a_record,
    build_class_a_record,
    derive_session_hash,
    derive_user_hash,
    hour_bucket,
    normalise_skill_name,
    ClassARecordError,
    HASH_HEX_LEN,
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
