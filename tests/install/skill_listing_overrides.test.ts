import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    NAME_ONLY,
    OVERRIDE_KEY,
    applyListingOverrides,
    computeOverrides,
    ensureListingOverrides,
    ownedSkillNames,
    removeListingOverrides,
} from '../../src/scripts/_lib/skill_listing_overrides.js';
import { record_deploy, save_inventory } from '../../src/scripts/_lib/global_deploy_inventory.js';

function read(p: string): Record<string, unknown> {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
}

function writeSkill(skillsDir: string, name: string, descChars: number): void {
    mkdirSync(join(skillsDir, name), { recursive: true });
    writeFileSync(
        join(skillsDir, name, 'SKILL.md'),
        `---\nname: ${name}\ndescription: ${'d'.repeat(descChars)}\n---\nbody\n`,
    );
}

describe('skill_listing_overrides', () => {
    let root: string;
    let settings: string;
    let record: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'slo-'));
        settings = join(root, 'claude', 'settings.json');
        record = join(root, 'event4u', 'skill-overrides.json');
        mkdirSync(join(root, 'claude'), { recursive: true });
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('reads owned skill names from a deploy file set only', () => {
        expect(
            ownedSkillNames(['skills/b/SKILL.md', 'skills/a/SKILL.md', 'skills/a/ref.md', 'commands/x.md']),
        ).toEqual(['a', 'b']);
    });

    it('keeps the resident set described and sends only owned overflow to name-only', () => {
        const skills = join(root, 'claude', 'skills');
        // Budget on a 200k window is 8,000 chars; 1,500 each → five fit, the rest overflow.
        for (const n of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) writeSkill(skills, n, 1500);
        writeSkill(skills, 'zz-user-own', 1500);
        const wanted = computeOverrides(skills, ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
        expect(wanted).toEqual({ a6: NAME_ONLY, a7: NAME_ONLY });
    });

    it('writes into a settings file it did not create and keeps every other key', () => {
        writeFileSync(settings, JSON.stringify({ model: 'x', hooks: { Stop: [] } }, null, 2));
        const res = ensureListingOverrides(settings, record, { a: NAME_ONLY, b: NAME_ONLY });
        expect(res).toEqual({ changed: true, written: ['a', 'b'], removed: [], skipped_user: [] });
        const doc = read(settings);
        expect(doc['model']).toBe('x');
        expect(doc['hooks']).toEqual({ Stop: [] });
        expect(doc[OVERRIDE_KEY]).toEqual({ a: NAME_ONLY, b: NAME_ONLY });
    });

    it('never writes over a pre-existing user value and reports it', () => {
        writeFileSync(settings, JSON.stringify({ [OVERRIDE_KEY]: { a: 'on', mine: 'off' } }));
        const res = ensureListingOverrides(settings, record, { a: NAME_ONLY, b: NAME_ONLY });
        expect(res.skipped_user).toEqual(['a']);
        expect(res.written).toEqual(['b']);
        expect(read(settings)[OVERRIDE_KEY]).toEqual({ a: 'on', mine: 'off', b: NAME_ONLY });
    });

    it('is idempotent: a second run changes nothing on disk', () => {
        ensureListingOverrides(settings, record, { a: NAME_ONLY });
        const before = readFileSync(settings, 'utf8');
        const res = ensureListingOverrides(settings, record, { a: NAME_ONLY });
        expect(res.changed).toBe(false);
        expect(readFileSync(settings, 'utf8')).toBe(before);
    });

    it('drops its own entry when a skill rejoins the resident set or leaves the deploy', () => {
        ensureListingOverrides(settings, record, { a: NAME_ONLY, b: NAME_ONLY });
        const res = ensureListingOverrides(settings, record, { b: NAME_ONLY });
        expect(res.removed).toEqual(['a']);
        expect(read(settings)[OVERRIDE_KEY]).toEqual({ b: NAME_ONLY });
    });

    it('leaves a non-object skillOverrides alone', () => {
        writeFileSync(settings, JSON.stringify({ [OVERRIDE_KEY]: 'weird' }));
        const before = readFileSync(settings, 'utf8');
        const res = ensureListingOverrides(settings, record, { a: NAME_ONLY });
        expect(res.changed).toBe(false);
        expect(readFileSync(settings, 'utf8')).toBe(before);
    });

    it('uninstall removes exactly what it wrote and keeps the user value beside it', () => {
        writeFileSync(settings, JSON.stringify({ [OVERRIDE_KEY]: { mine: 'off' } }));
        ensureListingOverrides(settings, record, { a: NAME_ONLY, b: NAME_ONLY });
        const res = removeListingOverrides(settings, record);
        expect(res.removed).toEqual(['a', 'b']);
        expect(read(settings)[OVERRIDE_KEY]).toEqual({ mine: 'off' });
        expect(existsSync(record)).toBe(false);
    });

    it('uninstall removes the key it created and restores the file to its prior shape', () => {
        writeFileSync(settings, `${JSON.stringify({ model: 'x' }, null, 2)}\n`);
        const original = readFileSync(settings, 'utf8');
        ensureListingOverrides(settings, record, { a: NAME_ONLY });
        removeListingOverrides(settings, record);
        expect(readFileSync(settings, 'utf8')).toBe(original);
    });

    it('a value the user changed after install is theirs: neither rewritten nor removed', () => {
        ensureListingOverrides(settings, record, { a: NAME_ONLY });
        const doc = read(settings);
        (doc[OVERRIDE_KEY] as Record<string, string>)['a'] = 'off';
        writeFileSync(settings, JSON.stringify(doc));
        expect(ensureListingOverrides(settings, record, { a: NAME_ONLY }).skipped_user).toEqual(['a']);
        const res = removeListingOverrides(settings, record);
        expect(res.removed).toEqual([]);
        expect(read(settings)[OVERRIDE_KEY]).toEqual({ a: 'off' });
    });

    it('uninstall keeps a value the user changed since the last install', () => {
        ensureListingOverrides(settings, record, { a: NAME_ONLY, b: NAME_ONLY });
        const doc = read(settings);
        (doc[OVERRIDE_KEY] as Record<string, string>)['a'] = 'off';
        writeFileSync(settings, JSON.stringify(doc));
        const res = removeListingOverrides(settings, record);
        expect(res).toEqual({ changed: true, removed: ['b'], kept_user: ['a'] });
        expect(read(settings)[OVERRIDE_KEY]).toEqual({ a: 'off' });
    });

    it('uninstall without a record touches nothing', () => {
        writeFileSync(settings, JSON.stringify({ [OVERRIDE_KEY]: { a: NAME_ONLY } }));
        const before = readFileSync(settings, 'utf8');
        expect(removeListingOverrides(settings, record).changed).toBe(false);
        expect(readFileSync(settings, 'utf8')).toBe(before);
    });

    it('the installer call writes under a scratch config home and never throws', () => {
        const prev = process.env['EVENT4U_CONFIG_HOME'];
        const prevInv = process.env['AGENT_CONFIG_DEPLOY_INVENTORY'];
        process.env['EVENT4U_CONFIG_HOME'] = join(root, 'event4u');
        process.env['AGENT_CONFIG_DEPLOY_INVENTORY'] = join(root, 'event4u', 'deployed-files.json');
        try {
            const anchor = join(root, 'claude');
            for (const n of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) writeSkill(join(anchor, 'skills'), n, 1500);
            writeSkill(join(anchor, 'skills'), 'zz-user-own', 1500);
            // a7 is recorded but was pruned from disk after the deploy: never written.
            const recorded = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((n) => `skills/${n}/SKILL.md`);
            const inventory = { schema_version: 1, tools: {} };
            record_deploy('claude-code', anchor, new Set(recorded), inventory);
            save_inventory(inventory);
            const lines: string[] = [];
            applyListingOverrides(anchor, (m) => lines.push(m));
            expect(read(settings)[OVERRIDE_KEY]).toEqual({ a6: NAME_ONLY });
            expect(existsSync(record)).toBe(true);
            expect(lines.join('\n')).toContain('1 set name-only');
        } finally {
            if (prev === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
            else process.env['EVENT4U_CONFIG_HOME'] = prev;
            if (prevInv === undefined) delete process.env['AGENT_CONFIG_DEPLOY_INVENTORY'];
            else process.env['AGENT_CONFIG_DEPLOY_INVENTORY'] = prevInv;
        }
    });
});
