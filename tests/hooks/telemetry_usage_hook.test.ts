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
