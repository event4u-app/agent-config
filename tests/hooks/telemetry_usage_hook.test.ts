/**
 * `telemetry-usage` concern — road-to-org-telemetry Phase 1, step 1.2.
 *
 * The exit criterion has two halves and the disabled half is the one that
 * matters: "a disabled install performs zero file operations". So the first
 * assertion is not that a record appears — it is that the log file does not
 * exist at all, on every not-fully-opted-in shape.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    extractDisciplineProfile,
    _resolveRoot,
    resolveSettingsPath,
    extractPackageVersion,
    extractSkillName,
    run,
    _resetSettingsCache,
} from '../../src/scripts/hooks/telemetry_usage_hook.js';

const roots: string[] = [];

function makeRoot(settingsBody: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-usage-'));
    roots.push(dir);
    if (settingsBody !== null) {
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settingsBody, 'utf-8');
    }
    _resetSettingsCache();
    return dir;
}

function logPath(root: string): string {
    return path.join(root, '.agent-telemetry.jsonl');
}

function envelope(skill: string, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'post_tool_use',
        session_id: 'host-session-token',
        payload: { tool_name: 'Skill', tool_input: { skill } },
        ...extra,
    });
}

const ACTIVE = `
telemetry:
  remote:
    enabled: true
    endpoint: "https://sink.example.invalid/ingest"
    org_id: "acme"
    salt: "org-pack-secret"
discipline_profile: essential
`;

afterEach(() => {
    while (roots.length > 0) {
        const dir = roots.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
    _resetSettingsCache();
});

describe('inactive installs write nothing', () => {
    it.each([
        ['no settings file at all', null],
        ['no telemetry section', 'quality:\n  local_auto_run: false\n'],
        ['enabled but no endpoint/org/salt', 'telemetry:\n  remote:\n    enabled: true\n'],
        ['fully configured but disabled', `${ACTIVE.replace('enabled: true', 'enabled: false')}`],
    ])('%s → exit 0 and no log file', (_label, body) => {
        const root = makeRoot(body);
        expect(run(envelope('brand-identity'), { consumer_root: root })).toBe(0);
        expect(fs.existsSync(logPath(root))).toBe(false);
    });
});

describe('the tool filter', () => {
    it('ignores a non-Skill tool even on an active install', () => {
        const root = makeRoot(ACTIVE);
        const other = JSON.stringify({
            platform: 'claude',
            payload: { tool_name: 'Read', tool_input: { file_path: '/etc/passwd' } },
        });
        expect(run(other, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(logPath(root))).toBe(false);
    });

    it('ignores a Skill call carrying no skill name', () => {
        const root = makeRoot(ACTIVE);
        const bare = JSON.stringify({ platform: 'claude', payload: { tool_name: 'Skill', tool_input: {} } });
        expect(run(bare, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(logPath(root))).toBe(false);
    });
});

describe('the outbound spool wiring (Phase 2, step 2.1)', () => {
    // The spool is written by the appender, in the same call that logs the
    // record. This asserts the WIRING rather than the appender: a hook that
    // stopped passing the spool path would still log correctly and would
    // silently never send anything, which is the failure with no symptom.
    it('spools the same line it logs when the install declared a flush', () => {
        const root = makeRoot(ACTIVE.replace('org_id: "acme"', 'org_id: "acme"\n    flush: session-end'));
        expect(run(envelope('brand-identity'), { consumer_root: root })).toBe(0);

        const spool = `${logPath(root).replace(/\.jsonl$/u, '')}.spool.jsonl`;
        expect(fs.existsSync(spool)).toBe(true);
        expect(fs.readFileSync(spool, 'utf-8')).toBe(fs.readFileSync(logPath(root), 'utf-8'));
    });

    // `flush: never` means no transport, so a spool would be a file that
    // grows and is never drained.
    it('writes no spool under flush: never', () => {
        const root = makeRoot(ACTIVE.replace('org_id: "acme"', 'org_id: "acme"\n    flush: never'));
        expect(run(envelope('brand-identity'), { consumer_root: root })).toBe(0);

        expect(fs.existsSync(logPath(root))).toBe(true);
        const spool = `${logPath(root).replace(/\.jsonl$/u, '')}.spool.jsonl`;
        expect(fs.existsSync(spool)).toBe(false);
    });
});

describe('an active install records the invocation', () => {
    it('writes one Class-A record with the resolved tier and host', () => {
        const root = makeRoot(ACTIVE);
        expect(run(envelope('brand-identity'), { consumer_root: root })).toBe(0);

        const lines = fs.readFileSync(logPath(root), 'utf-8').trimEnd().split('\n');
        expect(lines).toHaveLength(1);
        const rec = JSON.parse(lines[0] as string) as Record<string, unknown>;
        expect(rec['skill']).toBe('brand-identity');
        expect(rec['host']).toBe('claude');
        expect(rec['org_id']).toBe('acme');
        expect(rec['discipline_profile']).toBe('essential');
        expect(rec['record_class']).toBe('usage');
    });

    // Phase 0's note: without normalisation the busiest skills undercount by
    // roughly a quarter because the host sends two spellings of one name.
    it('records both host spellings of one skill under a single id', () => {
        const root = makeRoot(ACTIVE);
        run(envelope('roadmap:process-full'), { consumer_root: root });
        run(envelope('roadmap-process-full'), { consumer_root: root });

        const skills = fs.readFileSync(logPath(root), 'utf-8').trimEnd().split('\n')
            .map((l) => (JSON.parse(l) as Record<string, unknown>)['skill']);
        expect(skills).toEqual(['roadmap-process-full', 'roadmap-process-full']);
    });

    it('never writes the raw host session id or the salt', () => {
        const root = makeRoot(ACTIVE);
        run(envelope('brand-identity'), { consumer_root: root });
        const body = fs.readFileSync(logPath(root), 'utf-8');
        expect(body).not.toContain('host-session-token');
        expect(body).not.toContain('org-pack-secret');
    });

    it('is silent on a malformed envelope rather than throwing', () => {
        const root = makeRoot(ACTIVE);
        expect(run('not json at all', { consumer_root: root })).toBe(0);
        expect(run('', { consumer_root: root })).toBe(0);
        expect(fs.existsSync(logPath(root))).toBe(false);
    });
});

describe('extractDisciplineProfile', () => {
    it('reads the explicit profile', () => {
        expect(extractDisciplineProfile('discipline_profile: full\n')).toBe('full');
        expect(extractDisciplineProfile('discipline_profile: "off"\n')).toBe('off');
    });

    // The settings template is comment-dense and its own opt-in example
    // carries a trailing comment on this very key.
    it('accepts a trailing inline comment', () => {
        expect(extractDisciplineProfile('discipline_profile: essential      # ~3.3x kernel tokens\n'))
            .toBe('essential');
    });

    // The high R2 finding: `rule_loading_tier` is the LEGACY knob and
    // `discipline_profile` supersedes it, so the explicit key must win.
    it('prefers the explicit profile over the legacy tier', () => {
        expect(extractDisciplineProfile('discipline_profile: off\nrule_loading_tier: full\n')).toBe('off');
    });

    it('maps the legacy tier only when no profile is declared', () => {
        expect(extractDisciplineProfile('rule_loading_tier: balanced\n')).toBe('essential');
        expect(extractDisciplineProfile('rule_loading_tier: minimal\n')).toBe('off');
        expect(extractDisciplineProfile('rule_loading_tier: full\n')).toBe('full');
    });

    // The shipped template carries placeholders until `install` fills them
    // in; that is "not yet resolved", not a value.
    it('treats the unfilled template placeholders as unresolved', () => {
        expect(extractDisciplineProfile('discipline_profile: __DISCIPLINE_PROFILE__\n')).toBeNull();
        expect(extractDisciplineProfile('rule_loading_tier: __RULE_LOADING_TIER__\n')).toBeNull();
    });

    // Never the resolver's both-absent default: a record must not claim a
    // declaration the install never made.
    it('is null when neither key is declared', () => {
        expect(extractDisciplineProfile('quality:\n  local_auto_run: false\n')).toBeNull();
    });
});

describe('resolveSettingsPath', () => {
    it('finds the settings file from a subdirectory of the project', () => {
        const root = makeRoot(ACTIVE);
        const nested = path.join(root, 'src', 'deep');
        fs.mkdirSync(nested, { recursive: true });
        expect(resolveSettingsPath(nested)).toBe(path.join(root, '.agent-settings.yml'));
    });

    // Which is what production actually needs: a session started in a
    // subdirectory used to read no settings and go silently inactive.
    it('records the invocation when the envelope cwd is a subdirectory', () => {
        const root = makeRoot(ACTIVE);
        const nested = path.join(root, 'src', 'deep');
        fs.mkdirSync(nested, { recursive: true });
        expect(run(envelope('brand-identity'), { consumer_root: nested })).toBe(0);
        // Beside the settings file, not in the subdirectory the session
        // happened to start in.
        expect(fs.existsSync(logPath(root))).toBe(true);
        expect(fs.existsSync(path.join(nested, '.agent-telemetry.jsonl'))).toBe(false);
    });

    it('returns the start-relative path when no settings file exists anywhere above', () => {
        const root = makeRoot(null);
        expect(resolveSettingsPath(root)).toBe(path.join(root, '.agent-settings.yml'));
    });
});

describe('_resolveRoot', () => {
    it('prefers cwd, then the workspace keys, then the process cwd', () => {
        expect(_resolveRoot({ cwd: '/a', workspace_root: '/b' })).toBe('/a');
        expect(_resolveRoot({ workspace_root: '/b' })).toBe('/b');
        expect(_resolveRoot({ project_root: '/c' })).toBe('/c');
        expect(_resolveRoot({})).toBe(process.cwd());
        expect(_resolveRoot('not an object')).toBe(process.cwd());
    });
});

describe('extractPackageVersion', () => {
    it('reads the installer-set env var and nothing else', () => {
        expect(extractPackageVersion({ AGENT_CONFIG_PACKAGE_VERSION: '14.1.0' })).toBe('14.1.0');
        expect(extractPackageVersion({ AGENT_CONFIG_PACKAGE_VERSION: '  ' })).toBeNull();
        expect(extractPackageVersion({})).toBeNull();
    });
});

describe('extractSkillName', () => {
    it('accepts the confirmed key and the casing variants', () => {
        expect(extractSkillName({ tool_input: { skill: 'a' } })).toBe('a');
        expect(extractSkillName({ toolInput: { skill: 'a' } })).toBe('a');
        expect(extractSkillName({ tool_input: {} })).toBeNull();
        expect(extractSkillName({})).toBeNull();
    });
});

// ── Retention reaches the write path (Phase 2 step 2) ───────────────────
//
// The unit tests in `templates_telemetry_remote.test.ts` prove the budget
// works when it is passed. These prove the hook passes it — the seam where a
// declared setting most easily becomes decoration.

describe('telemetry-usage — the declared growth budget reaches the log', () => {
    it('honours a byte cap the install declared, not the appender default', () => {
        // The smallest LEGAL cap: below MIN_RETENTION_MAX_BYTES the reader
        // falls back to the default, so a smaller number here would silently
        // test the default and pass for the wrong reason.
        const cap = 4096;
        const root = makeRoot(`${ACTIVE}
`.replace('    salt: "org-pack-secret"', `    salt: "org-pack-secret"
    retention:
      max_bytes: ${cap}`));

        // One record is ~270 B, so a 4 KiB cap binds within ~15 writes; the
        // appender default (2 MiB) would not bind at all across 40.
        for (let i = 0; i < 40; i += 1) {
            expect(run(envelope(`skill-${i}`), { consumer_root: root })).toBe(0);
        }

        expect(fs.existsSync(logPath(root))).toBe(true);
        expect(fs.statSync(logPath(root)).size).toBeLessThanOrEqual(cap);
    });

    it('leaves the log unbounded-looking under the default cap, so the test above is not vacuous', () => {
        const root = makeRoot(ACTIVE);
        for (let i = 0; i < 40; i += 1) {
            run(envelope(`skill-${i}`), { consumer_root: root });
        }
        // 40 records at ~270 B is far under the 2 MiB default: the previous
        // test's small file is the declared cap acting, not the writer.
        const lines = fs.readFileSync(logPath(root), 'utf-8').split('\n').filter((l) => l.length > 0);
        expect(lines).toHaveLength(40);
    });
});
