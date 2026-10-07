import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    GIT_CONVENTION_ENUMS,
    GIT_CONVENTION_KEYS,
    checkoutSource,
    fileSource,
    isRefusal,
    readGitConvention,
    readGitConventionKey,
} from '../../../src/scripts/_lib/git_convention.js';

const DEFAULTS = { commit_format: 'ticket-scope', branch_pattern: '{type}/{slug}', update_strategy: 'merge' };

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tmp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-'));
    made.push(dir);
    return dir;
}

function file(dir: string, name: string, body: string): string {
    const p = path.join(dir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    return p;
}

describe('the five states', () => {
    it('absent: no layer sets the key, the template default is reported', () => {
        const dir = tmp();
        const r = readGitConventionKey('update_strategy', fileSource({ developer: [path.join(dir, 'none.yml')] }), DEFAULTS);
        expect(r.state).toBe('absent');
        expect(r.value).toBe('merge');
        expect(r.source).toBeNull();
        expect(isRefusal(r.state)).toBe(false);
    });

    it('valid: the deepest layer that sets the key wins and is named', () => {
        const dir = tmp();
        const low = file(dir, 'low.yml', 'git:\n  update_strategy: merge\n');
        const high = file(dir, 'high.yml', 'git:\n  update_strategy: " Rebase "\n');
        const r = readGitConventionKey('update_strategy', fileSource({ developer: [low, high] }), DEFAULTS);
        expect(r).toMatchObject({ state: 'valid', value: 'rebase', source: high, reason: null });
    });

    it('malformed: an unreadable file is never the default', () => {
        const dir = tmp();
        const broken = file(dir, 'broken.yml', 'git:\n  update_strategy: rebase\nother: [unclosed\n');
        const r = readGitConventionKey('update_strategy', fileSource({ developer: [broken] }), DEFAULTS);
        expect(r.state).toBe('malformed');
        expect(r.value).toBeNull();
        expect(r.source).toBe(broken);
        expect(r.reason).toBe('git-convention-malformed');
        expect(isRefusal(r.state)).toBe(true);
    });

    it('malformed: a top layer that does not parse is not skipped in favour of a healthy lower one', () => {
        const dir = tmp();
        const healthy = file(dir, 'healthy.yml', 'git:\n  update_strategy: merge\n');
        const broken = file(dir, 'broken.yml', ':\n  - [\n');
        const r = readGitConventionKey('update_strategy', fileSource({ developer: [healthy, broken] }), DEFAULTS);
        expect(r).toMatchObject({ state: 'malformed', source: broken, reason: 'git-convention-malformed' });
    });

    it('a malformed layer BELOW the deciding one does not change the answer', () => {
        const dir = tmp();
        const broken = file(dir, 'broken.yml', ':\n  - [\n');
        const healthy = file(dir, 'healthy.yml', 'git:\n  update_strategy: rebase\n');
        const r = readGitConventionKey('update_strategy', fileSource({ developer: [broken, healthy] }), DEFAULTS);
        expect(r).toMatchObject({ state: 'valid', value: 'rebase', source: healthy });
    });

    it('invalid: a typo is reported with the file, never coerced', () => {
        const dir = tmp();
        const typo = file(dir, 's.yml', 'git:\n  update_strategy: rebsae\n');
        const r = readGitConventionKey('update_strategy', fileSource({ developer: [typo] }), DEFAULTS);
        expect(r).toMatchObject({ state: 'invalid', value: 'rebsae', source: typo, reason: 'git-convention-invalid' });
        expect(r.detail).toContain('merge');
    });

    it('invalid: a non-string value and a non-map `git:` are invalid', () => {
        const dir = tmp();
        const num = file(dir, 'n.yml', 'git:\n  update_strategy: 3\n');
        expect(readGitConventionKey('update_strategy', fileSource({ developer: [num] }), DEFAULTS).state).toBe('invalid');
        const scalar = file(dir, 'g.yml', 'git: rebase\n');
        expect(readGitConventionKey('update_strategy', fileSource({ developer: [scalar] }), DEFAULTS).state).toBe('invalid');
    });

    it('discarded: a user-global value the loader throws away is named, not read as absent', () => {
        const dir = tmp();
        const global = file(dir, 'global.yml', 'git:\n  update_strategy: rebase\n');
        const r = readGitConventionKey(
            'update_strategy',
            fileSource({ userGlobal: [global], developer: [path.join(dir, 'none.yml')] }),
            DEFAULTS,
        );
        expect(r).toMatchObject({ state: 'discarded', value: 'rebase', source: global, reason: 'git-convention-discarded' });
        expect(isRefusal(r.state)).toBe(true);
    });

    it('a user-global value equal to the template default changes nothing and reads absent', () => {
        const dir = tmp();
        const global = file(dir, 'global.yml', 'git:\n  update_strategy: merge\n');
        const r = readGitConventionKey('update_strategy', fileSource({ userGlobal: [global] }), DEFAULTS);
        expect(r.state).toBe('absent');
    });

    it('a developer layer that sets the key outranks a user-global one', () => {
        const dir = tmp();
        const global = file(dir, 'global.yml', 'git:\n  update_strategy: rebase\n');
        const project = file(dir, 'p.yml', 'git:\n  update_strategy: merge\n');
        const r = readGitConventionKey('update_strategy', fileSource({ userGlobal: [global], developer: [project] }), DEFAULTS);
        expect(r).toMatchObject({ state: 'valid', value: 'merge', source: project });
    });
});

describe('all three keys', () => {
    it('reads every key in one pass', () => {
        const dir = tmp();
        const p = file(dir, 'p.yml', 'git:\n  commit_format: ticket-scope\n  branch_pattern: "{ticket}-{slug}"\n');
        const all = readGitConvention(fileSource({ developer: [p] }), DEFAULTS);
        expect(Object.keys(all)).toEqual([...GIT_CONVENTION_KEYS]);
        expect(all.commit_format.state).toBe('valid');
        expect(all.branch_pattern).toMatchObject({ state: 'valid', value: '{ticket}-{slug}' });
        expect(all.update_strategy.state).toBe('absent');
    });

    it('carries the schema enums', () => {
        const schema = JSON.parse(
            fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../src/scripts/schemas/agent-settings.schema.json'), 'utf-8'),
        ) as { properties: { git: { properties: Record<string, { enum?: string[] }> } } };
        const props = schema.properties.git.properties;
        expect([...(GIT_CONVENTION_ENUMS.commit_format ?? [])]).toEqual(props.commit_format?.enum);
        expect([...(GIT_CONVENTION_ENUMS.update_strategy ?? [])]).toEqual(props.update_strategy?.enum);
    });
});

describe('checkoutSource', () => {
    let home: string;
    const prevHome = process.env.EVENT4U_CONFIG_HOME;
    beforeEach(() => {
        home = tmp();
        process.env.EVENT4U_CONFIG_HOME = home;
    });
    afterEach(() => {
        if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
        else process.env.EVENT4U_CONFIG_HOME = prevHome;
    });

    it('reads the checkout cascade the loader reads', () => {
        const repo = tmp();
        file(repo, '.agent-settings.yml', 'git:\n  update_strategy: rebase\n');
        const r = readGitConventionKey('update_strategy', checkoutSource(repo));
        expect(r).toMatchObject({ state: 'valid', value: 'rebase' });
        expect(fs.realpathSync(r.source as string)).toBe(fs.realpathSync(path.join(repo, '.agent-settings.yml')));
    });

    it('sees a malformed canonical file under agents/settings/', () => {
        const repo = tmp();
        file(repo, '.agent-settings.yml', 'git:\n  update_strategy: merge\n');
        file(repo, 'agents/settings/.agent-settings.yml', 'git: [\n');
        expect(readGitConventionKey('update_strategy', checkoutSource(repo)).state).toBe('malformed');
    });
});

describe('the commit_format value is named after its family', () => {
    it('accepts ticket-conventional and no longer the family name ticket-prefix', () => {
        expect(GIT_CONVENTION_ENUMS.commit_format).toContain('ticket-conventional');
        expect(GIT_CONVENTION_ENUMS.commit_format).not.toContain('ticket-prefix');
    });
});
