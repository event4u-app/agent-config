/**
 * The always-written carve-out set for the sparse settings file
 * (`road-to-zero-ceremony-settings` Phase 3).
 *
 * These assertions run against the REAL template, not a fixture. A carve-out
 * list that only agrees with a fixture would keep passing while the key it
 * protects was renamed out from under it — and the whole point of the set is
 * that omitting one of these keys silently changes behaviour.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { SETTINGS_CARVE_OUT, carveOutKeys } from '../../src/shared/settingsCarveOut.js';

const ROOT = join(__dirname, '..', '..');

function templateTree(): Record<string, unknown> {
    const raw = readFileSync(join(ROOT, 'src', 'config', 'agent-settings.template.yml'), 'utf8');
    return yamlLoad(raw) as Record<string, unknown>;
}

function readPath(root: Record<string, unknown>, dotted: string): unknown {
    let node: unknown = root;
    for (const segment of dotted.split('.')) {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

describe('settings carve-out set', () => {
    it('names every key the 2026-08-07 audit found where absent !== template default', () => {
        // Pinned explicitly: the audit is the expensive artefact, and a set that
        // silently shrank would re-open the blocker without anyone noticing.
        expect([...carveOutKeys()].sort()).toEqual([
            'chat_history.enabled',
            'chat_history.frequency',
            'discipline_profile',
            'onboarding.onboarded',
            'profile.id',
            'projection.mode',
            'projection.rule_workspaces',
            'quality.local_auto_run',
            'subagents.auto',
        ]);
    });

    it('every carved-out key resolves to a real value in the shipped template', () => {
        const tree = templateTree();
        const missing = carveOutKeys().filter((key) => readPath(tree, key) === undefined);
        expect(missing).toEqual([]);
    });

    it('every entry carries a checkable reader and a non-empty reason', () => {
        for (const entry of SETTINGS_CARVE_OUT) {
            expect(entry.reader, entry.key).toMatch(/^src\/|^work_engine\//);
            expect(entry.reader, entry.key).toMatch(/:\d+/);
            expect(entry.absentResolvesTo.trim().length, entry.key).toBeGreaterThan(0);
            // A reason short enough to be a restatement of the key is not a reason.
            expect(entry.reason.trim().length, entry.key).toBeGreaterThan(40);
        }
    });

    it('carries no duplicate keys', () => {
        const keys = carveOutKeys();
        expect(new Set(keys).size).toBe(keys.length);
    });
});
