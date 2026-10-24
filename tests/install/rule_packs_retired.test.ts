/**
 * road-to-a-setup-that-decides-itself step 4.9 — `projection.rule_packs` is
 * retired (owner directive 2026-10-24, D14).
 *
 * The rule layer's pack axis is DERIVED from the active-pack set — what `auto`
 * did — whether or not a settings file says anything. For one release window
 * an explicitly written legacy value still wins, so nobody who chose a scope
 * loses it silently on upgrade; `doctor` names how that value differs from the
 * derived set. Runs against the real `packs.yml` and rule tree.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RULE_PACKS_AUTO, resolve_rule_pack_scope } from '../../src/scripts/_lib/scoped_projection.js';
import { REMOVED_KEYS } from '../../src/scripts/_lib/settings_removed_keys.js';
import { ruleScopeFromSettings } from '../../src/install/rule_scope.js';
import { rulePacksLegacyCheck } from '../../src/install/rulePacksLegacy.js';

const REPO = path.resolve(__dirname, '..', '..');
const DERIVED = resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO) as string[];

const temps: string[] = [];
afterEach(() => {
    for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('the pack axis is derived, not configured', () => {
    it('a settings file with no projection block gets the derived set', () => {
        expect(DERIVED.length).toBeGreaterThan(0);
        expect(ruleScopeFromSettings({}, REPO).packs).toEqual(DERIVED);
        expect(ruleScopeFromSettings({ projection: {} }, REPO).packs).toEqual(DERIVED);
    });

    it('the runtime.active_packs overlay reaches the derivation without any rule_packs key', () => {
        const scope = ruleScopeFromSettings({ runtime: { active_packs: ['finance-basic'] } }, REPO);
        expect(scope.packs).toContain('finance-basic');
        expect(DERIVED).not.toContain('finance-basic');
    });

    it('without a package root the axis stays inactive — more ships, never less', () => {
        expect(ruleScopeFromSettings({}).packs).toBeNull();
    });
});

describe('one release window: an explicit legacy value wins', () => {
    it('an explicit list is honoured verbatim', () => {
        expect(ruleScopeFromSettings({ projection: { rule_packs: ['brand'] } }, REPO).packs).toEqual(['brand']);
    });

    it('an explicit empty list keeps the axis inactive, as it meant before', () => {
        expect(ruleScopeFromSettings({ projection: { rule_packs: [] } }, REPO).packs).toBeNull();
    });

    it('`auto` is the derived set', () => {
        expect(ruleScopeFromSettings({ projection: { rule_packs: 'auto' } }, REPO).packs).toEqual(DERIVED);
    });
});

describe('the key is gone from every public surface, with a tombstone', () => {
    it('neither the template nor the schema carries it', () => {
        expect(fs.readFileSync(path.join(REPO, 'src/config/agent-settings.template.yml'), 'utf8')).not.toContain('rule_packs');
        expect(fs.readFileSync(path.join(REPO, 'src/server/schemas/settings.ts'), 'utf8')).not.toContain('rule_packs');
    });

    it('REMOVED_KEYS names what decides instead and that the window still reads it', () => {
        const entry = [...REMOVED_KEYS].find(([key]) => key === 'projection.rule_packs');
        expect(entry).toBeDefined();
        expect(entry?.[1]).toContain('active-pack set');
        expect(entry?.[1]).toContain('release window');
    });
});

describe('doctor names a legacy value and its difference from the derived set', () => {
    function settingsFile(doc: string): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-packs-retired-'));
        temps.push(dir);
        const file = path.join(dir, '.agent-settings.yml');
        fs.writeFileSync(file, doc);
        return file;
    }

    it('no legacy value: ok, and says the axis is derived', () => {
        const res = rulePacksLegacyCheck([settingsFile('profile:\n  id: developer\n')], REPO);
        expect(res.status).toBe('ok');
        expect(res.message).toContain('derived');
    });

    it('an explicit list that differs: warn, naming what it adds and drops against the derived set', () => {
        const res = rulePacksLegacyCheck([settingsFile('projection:\n  rule_packs: [brand, finance-basic]\n')], REPO);
        expect(res.status).toBe('warn');
        expect(res.message).toContain('+finance-basic');
        expect(res.message).toContain('-engineering-base');
        expect(res.remedy).toContain('rule_packs');
    });

    it('an explicit empty list: warn — the axis is off where the derivation would scope it', () => {
        const res = rulePacksLegacyCheck([settingsFile('projection:\n  rule_packs: []\n')], REPO);
        expect(res.status).toBe('warn');
        expect(res.message).toContain('inactive');
    });

    it('`auto`: ok — it equals the derived set', () => {
        expect(rulePacksLegacyCheck([settingsFile('projection:\n  rule_packs: auto\n')], REPO).status).toBe('ok');
    });
});
