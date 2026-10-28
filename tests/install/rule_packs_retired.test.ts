/**
 * road-to-a-setup-that-decides-itself step 4.9 — `projection.rule_packs` is
 * retired (owner directive 2026-10-24, D14).
 *
 * The rule layer's pack axis is DERIVED from the active-pack set — what `auto`
 * did — whether or not a settings file says anything. The one-release window
 * in which an explicitly written legacy value still won closed with 19.0.0: a
 * leftover value is ignored. Runs against the real `packs.yml` and rule tree.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { RULE_PACKS_AUTO, resolve_rule_pack_scope } from '../../src/scripts/_lib/scoped_projection.js';
import { REMOVED_KEYS } from '../../src/scripts/_lib/settings_removed_keys.js';
import { ruleScopeFromSettings } from '../../src/install/rule_scope.js';

const REPO = path.resolve(__dirname, '..', '..');
const DERIVED = resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO) as string[];

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

describe('a leftover legacy value no longer decides (window closed at 19.0.0)', () => {
    it('an explicit list is ignored — the derived set decides', () => {
        expect(ruleScopeFromSettings({ projection: { rule_packs: ['brand'] } }, REPO).packs).toEqual(DERIVED);
    });

    it('an explicit empty list no longer switches the axis off', () => {
        expect(ruleScopeFromSettings({ projection: { rule_packs: [] } }, REPO).packs).toEqual(DERIVED);
    });

    it('without a package root a leftover value cannot narrow the scope either', () => {
        expect(ruleScopeFromSettings({ projection: { rule_packs: ['brand'] } }).packs).toBeNull();
    });
});

describe('the key is gone from every public surface, with a tombstone', () => {
    it('neither the template nor the schema carries it', () => {
        expect(fs.readFileSync(path.join(REPO, 'src/config/agent-settings.template.yml'), 'utf8')).not.toContain('rule_packs');
        expect(fs.readFileSync(path.join(REPO, 'src/server/schemas/settings.ts'), 'utf8')).not.toContain('rule_packs');
    });

    it('REMOVED_KEYS names what decides instead and no longer promises a window', () => {
        const entry = [...REMOVED_KEYS].find(([key]) => key === 'projection.rule_packs');
        expect(entry).toBeDefined();
        expect(entry?.[1]).toContain('active-pack set');
        expect(entry?.[1]).not.toContain('release window');
    });
});
