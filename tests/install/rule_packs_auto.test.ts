/**
 * `projection.rule_packs: auto` — the derived pack axis for the RULE layer
 * (road-to-renewal-foundation Phase 2).
 *
 * The pack axis was wired end-to-end but shipped inactive, so a rule whose
 * own body says "auto-activates when pack-X is installed" projected into
 * installs without pack-X. `auto` closes that by reusing the SAME active-pack
 * set the skill/command prune uses, rather than a hand-typed id list that
 * would silently rot whenever a pack is added.
 *
 * These assertions run against the REAL `packs.yml` + `dist/agent-src/rules`
 * tree — a fixture would let tag drift pass unnoticed, which is the failure
 * this axis exists to catch (same discipline as rule_scoping_plan.test.ts).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    RULE_PACKS_AUTO,
    compute_active_pack_ids,
    load_packs_registry,
    resolve_rule_pack_scope,
} from '../../src/scripts/_lib/scoped_projection.js';
import { LEGACY_ALL, ruleFileArrives, ruleScopeFromSettings } from '../../src/install/rule_scope.js';

const REPO = path.resolve(__dirname, '..', '..');
const RULES_DIR = path.join(REPO, 'dist', 'agent-src', 'rules');

function ruleFile(basename: string): string {
    return path.join(RULES_DIR, basename);
}

describe('resolve_rule_pack_scope', () => {
    it('derives the active-pack set for the auto sentinel', () => {
        const derived = resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO);
        const expected = [...compute_active_pack_ids(load_packs_registry(REPO), [])].sort();
        expect(derived).toEqual(expected);
        expect(derived?.length).toBeGreaterThan(0);
    });

    it('accepts the sentinel as a single-element list (YAML scalar-vs-list tolerance)', () => {
        expect(resolve_rule_pack_scope([RULE_PACKS_AUTO], REPO)).toEqual(
            resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO),
        );
    });

    it('unions the runtime.active_packs overlay into the derivation', () => {
        const base = resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO) ?? [];
        const withOverlay = resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO, ['finance-basic']) ?? [];
        expect(base).not.toContain('finance-basic');
        expect(withOverlay).toContain('finance-basic');
    });

    it('keeps an explicit list verbatim — the list wins over the derivation', () => {
        expect(resolve_rule_pack_scope(['brand'], REPO)).toEqual(['brand']);
    });

    it('treats absent / empty / wrong-typed values as an inactive axis', () => {
        expect(resolve_rule_pack_scope(undefined, REPO)).toBeNull();
        expect(resolve_rule_pack_scope([], REPO)).toBeNull();
        expect(resolve_rule_pack_scope('scoped', REPO)).toBeNull();
    });

    it('fails SAFE on an unreadable packs.yml — inactive, never an empty set', () => {
        // An empty set would prune every pack-tagged rule, the exact inversion
        // of the fail-safe contract rule_in_scope documents.
        expect(resolve_rule_pack_scope(RULE_PACKS_AUTO, path.join(REPO, 'no-such-root'))).toBeNull();
    });
});

describe('ruleScopeFromSettings with rule_packs: auto', () => {
    const SETTINGS = { projection: { rule_packs: RULE_PACKS_AUTO } };

    it('resolves the sentinel when a package root is supplied', () => {
        const scope = ruleScopeFromSettings(SETTINGS, REPO);
        expect(scope.packs).toEqual(resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO));
    });

    it('degrades to an inactive axis when no package root is available', () => {
        // No root means packs.yml cannot be located; over-shipping is the safe
        // direction, so the axis must go inactive rather than prune blindly.
        expect(ruleScopeFromSettings(SETTINGS).packs).toBeNull();
    });

    it('leaves the shipped default inactive', () => {
        expect(ruleScopeFromSettings({ projection: { rule_packs: [] } }, REPO).packs).toBeNull();
    });
});

describe('what the derived scope actually gates', () => {
    const scope = { ...LEGACY_ALL, packs: resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO) };

    // Each floor's own body declares the pack condition; under `auto` it stops
    // shipping where the guarded pack is absent.
    const DROPPED = [
        'finance-safety-floor.md',
        'legal-safety-floor.md',
        'strategy-safety-floor.md',
        'media-governance-routing.md',
        'media-sync-ground-truth.md',
        'image-likeness-and-rights.md',
        'provider-lifecycle-discipline.md',
        'spreadsheet-source-quality.md',
    ];

    it.each(DROPPED)('drops %s — its pack is not active', (name) => {
        expect(fs.existsSync(ruleFile(name))).toBe(true);
        expect(ruleFileArrives(ruleFile(name), scope)).toBe(false);
    });

    // Named in the roadmap step as candidates, but their packs carry
    // workspaces: [engineering], so they are active. Retaining them is the
    // mechanism working, not a miss — pin it so a later packs.yml edit that
    // silently drops an engineering floor fails here.
    it.each(['history-discipline.md', 'scale-discipline.md'])(
        'keeps %s — an engineering-workspace pack stays active',
        (name) => {
            expect(ruleFileArrives(ruleFile(name), scope)).toBe(true);
        },
    );

    it('never drops a kernel rule', () => {
        for (const name of fs.readdirSync(RULES_DIR)) {
            if (!name.endsWith('.md')) continue;
            const text = fs.readFileSync(ruleFile(name), 'utf-8');
            if (!/^type:\s*["']?always["']?\s*$/m.test(text)) continue;
            expect(ruleFileArrives(ruleFile(name), scope)).toBe(true);
        }
    });

    it('drops strictly fewer rules than it keeps', () => {
        const all = fs.readdirSync(RULES_DIR).filter((n) => n.endsWith('.md'));
        const kept = all.filter((n) => ruleFileArrives(ruleFile(n), scope));
        expect(kept.length).toBeGreaterThan(all.length - kept.length);
    });
});
