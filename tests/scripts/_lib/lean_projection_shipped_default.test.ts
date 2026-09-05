/**
 * `lean_projection.mode` still resolves to `eager-all` — the held-change-set
 * guard for `road-to-the-tenth-arrival` step 3.2.
 *
 * WHY THIS TEST EXISTS. That roadmap's Phase 3 prepares the delivery-mode flip
 * and deliberately does not ship it: the shipped-default decision is
 * owner-reserved, and its own risk register names "the split is read as
 * authorization to flip" as risk 1. A prepared change set one approval away is
 * exactly the state where an autonomous run talks itself into landing it, so
 * the invariant is asserted rather than promised.
 *
 * WHAT "ON EVERY HOST" MEANS HERE, STATED SO IT IS NOT OVERREAD. The setting is
 * repo-scoped and single-valued — there is no per-host copy of it. The host
 * dimension of `lean_projection` is a different question: whether a THIN
 * projection is a no-op on a given host, which `probe_host_compliance.ts:82-87`
 * answers with an operator-run live probe and no committed artefact can. So
 * this test asserts the per-host half it CAN reach: every generated host tree
 * still carries full rule bodies, i.e. no host has been switched behind the
 * setting.
 *
 * WHEN THE OWNER SHIPS THE FLIP, THIS TEST GOES RED. That is intended, not a
 * defect: it is the tripwire that sends whoever lands it to the delivery-mode
 * decision packet first, because four budget rows and the settings-schema enum
 * must move in the same change or the config describes a state that is not
 * shipped.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DEFAULT_LEAN_PROJECTION_MODE,
    normalizeLeanProjectionMode,
} from '../../../src/scripts/_lib/lean_projection_mode.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Read `lean_projection.mode` out of a YAML file with the hook's own reader shape. */
function rawMode(file: string): string {
    if (!fs.existsSync(file)) return '';
    let inSection = false;
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
        if (/^\S/.test(line)) {
            inSection = /^lean_projection\s*:\s*$/.test(line);
            continue;
        }
        if (!inSection) continue;
        const m = /^\s+mode\s*:\s*(.+)$/.exec(line);
        if (m) return (m[1] ?? '').trim().replace(/^["']|["']$/g, '');
    }
    return '';
}

describe('lean_projection.mode — shipped default is eager-all', () => {
    it('the shipped settings template says eager-all', () => {
        const raw = rawMode(path.join(REPO_ROOT, 'src', 'config', 'agent-settings.template.yml'));
        expect(raw).toBe('eager-all');
        expect(normalizeLeanProjectionMode(raw)).toBe('eager-all');
    });

    it("this repository's own settings resolve to eager-all", () => {
        const raw = rawMode(path.join(REPO_ROOT, '.agent-settings.yml'));
        // Absent key is legitimate and means the same thing — the normaliser
        // maps anything unrecognised onto the shipped default by construction.
        expect(normalizeLeanProjectionMode(raw)).toBe('eager-all');
    });

    it('the default constant has not been moved', () => {
        expect(DEFAULT_LEAN_PROJECTION_MODE).toBe('eager-all');
    });

    it('the settings schema does not yet admit `delivery`', () => {
        const schema = JSON.parse(
            fs.readFileSync(
                path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'agent-settings.schema.json'),
                'utf-8',
            ),
        ) as { properties: { lean_projection: { properties: { mode: { enum: string[] } } } } };
        const modes = schema.properties.lean_projection.properties.mode.enum;
        // The fourth hold on the flip, and the one the roadmap's three-hold
        // table does not list: `delivery` is not a value the schema permits, so
        // the flip needs an enum widening before the setting can even be set.
        expect(modes).not.toContain('delivery');
        expect(modes).toContain('eager-all');
    });

    it('every generated host tree still carries full rule bodies, not pointers', () => {
        // `minimal-safe-diff` is a routed tier rule with a body long enough that
        // a pointer stub is unmistakable. One probe line per host tree.
        const probes: Array<[string, string]> = [
            ['augment', '.augment/rules/minimal-safe-diff.md'],
            ['claude', '.claude/rules/minimal-safe-diff.md'],
            ['dist projection', 'dist/agent-src/rules/minimal-safe-diff.md'],
        ];
        let checked = 0;
        for (const [host, rel] of probes) {
            const p = path.join(REPO_ROOT, rel);
            if (!fs.existsSync(p)) continue;
            const text = fs.readFileSync(p, 'utf-8');
            checked += 1;
            expect(text, `${host}: ${rel} is a pointer stub, not a body`).toContain(
                'THE DIFF CONTAINS THE SMALLEST CHANGE',
            );
        }
        // A probe set that resolves to nothing would pass vacuously, which is
        // the failure mode this whole file exists to avoid.
        expect(checked).toBeGreaterThan(0);
    });
});
