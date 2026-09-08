/**
 * `lean_projection.mode` is `delivery` for Claude Code and for no other host —
 * the shipped-state guard for ADR-265.
 *
 * WHY THIS FILE CHANGED SHAPE, STATED RATHER THAN SILENTLY REWRITTEN. It was
 * the held-change-set tripwire for `road-to-the-tenth-arrival` step 3.2, and
 * its own docstring said: "WHEN THE OWNER SHIPS THE FLIP, THIS TEST GOES RED.
 * That is intended, not a defect: it is the tripwire that sends whoever lands
 * it to the delivery-mode decision packet first, because four budget rows and
 * the settings-schema enum must move in the same change or the config
 * describes a state that is not shipped."
 *
 * The flip is now shipped, so the tripwire fired and was answered rather than
 * removed. What the answer looked like, checkable from the tree at this commit:
 *   · the decision record exists and is `status: accepted` with
 *     `reopen_policy: owner` — `docs/decisions/ADR-265-delivery-default-for-claude-code.md:2-8`;
 *   · the schema enum was widened to admit `delivery` —
 *     `src/scripts/schemas/agent-settings.schema.json:43`;
 *   · the activation charge was paid with a MEASURED number, not a chosen one:
 *     `user_prompt_submit` slot sum 4,096 -> 16,384 at
 *     `src/config/hook-token-budget.json:39-40`, p90 of 318 gate-open fires
 *     rounded up to 512 B;
 *   · `pre_tool_use` was deliberately NOT raised, because the concern's
 *     binding on that slot was removed in the same change —
 *     `src/config/hook-token-budget.json:41` still reads 2,048.
 *
 * SO THE GUARD DID NOT GO AWAY, IT MOVED. Every assertion below is the
 * post-flip form of an assertion that was here before, plus three that pin the
 * parts of the flip that are easiest to lose later: the per-host scope, the
 * unchanged in-code default, and the paid charge. A future run that widens the
 * flip beyond `claude-code`, moves the constant, or reverts the budget row goes
 * red here and is sent to ADR-265 first — which is the same job this file has
 * always had.
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

/** Read a scalar under the top-level `lean_projection:` block with the hook's own reader shape. */
function leanProjectionScalar(file: string, key: string): string {
    if (!fs.existsSync(file)) return '';
    let inSection = false;
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
        if (/^\S/.test(line)) {
            inSection = /^lean_projection\s*:\s*$/.test(line);
            continue;
        }
        if (!inSection) continue;
        const m = new RegExp(`^\\s+${key}\\s*:\\s*(.+)$`).exec(line);
        if (m) return (m[1] ?? '').trim().replace(/^["']|["']$/g, '');
    }
    return '';
}

const rawMode = (file: string): string => leanProjectionScalar(file, 'mode');

describe('lean_projection.mode — shipped default is delivery for claude-code only', () => {
    it('the shipped settings template says delivery', () => {
        const raw = rawMode(path.join(REPO_ROOT, 'src', 'config', 'agent-settings.template.yml'));
        expect(raw).toBe('delivery');
        expect(normalizeLeanProjectionMode(raw)).toBe('delivery');
    });

    it('the template scopes the flip to claude-code and to no other host', () => {
        const hosts = leanProjectionScalar(
            path.join(REPO_ROOT, 'src', 'config', 'agent-settings.template.yml'),
            'hosts',
        );
        // ADR-265's whole claim is per-host. A widening edit here is the one
        // that would silently thin cursor and cline, so it is pinned literally.
        expect(hosts).toBe('[claude-code]');
    });

    it('the in-code default has NOT been moved — an absent key still means eager-all', () => {
        // ADR-265 § Decision point 4 flips the shipped TEMPLATE and deliberately
        // leaves the constant alone, so a consumer with no key set is unaffected.
        expect(DEFAULT_LEAN_PROJECTION_MODE).toBe('eager-all');
        expect(normalizeLeanProjectionMode('')).toBe('eager-all');
    });

    it("this repository's own settings resolve to a mode the schema admits", () => {
        const raw = rawMode(path.join(REPO_ROOT, '.agent-settings.yml'));
        // Absent key is legitimate and means eager-all — the normaliser maps
        // anything unrecognised onto the shipped default by construction.
        expect(['eager-all', 'thin', 'delivery']).toContain(normalizeLeanProjectionMode(raw));
    });

    it('the settings schema admits `delivery`, so the template value is settable', () => {
        const schema = JSON.parse(
            fs.readFileSync(
                path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'agent-settings.schema.json'),
                'utf-8',
            ),
        ) as { properties: { lean_projection: { properties: { mode: { enum: string[] } } } } };
        const modes = schema.properties.lean_projection.properties.mode.enum;
        // The fourth hold on the flip: for months the enum did NOT list
        // `delivery` while the normaliser accepted it, so a consumer who set
        // the documented value failed validation. The flip had to widen it.
        expect(modes).toContain('delivery');
        expect(modes).toContain('eager-all');
        expect(modes).toContain('thin');
    });

    it('the activation charge is paid and is still the measured number', () => {
        const budget = JSON.parse(
            fs.readFileSync(
                path.join(REPO_ROOT, 'src', 'config', 'hook-token-budget.json'),
                'utf-8',
            ),
        ) as { per_slot_sum_caps_bytes: Record<string, unknown> };
        const caps = budget.per_slot_sum_caps_bytes;
        // Raised 4,096 -> 16,384 by the flip, from the p90 gate-open fire size
        // rounded up to 512 B. Reverting it while `delivery` ships would leave
        // the concern emitting above its own slot cap.
        expect(caps['user_prompt_submit']).toBe(16384);
        // NOT raised alongside it: the concern's `pre_tool_use` binding was
        // removed in the same change, so nothing new emits there.
        expect(caps['pre_tool_use']).toBe(2048);
    });

    it('the decision record exists, is accepted, and is owner-reopenable', () => {
        const adr = path.join(
            REPO_ROOT,
            'docs',
            'decisions',
            'ADR-265-delivery-default-for-claude-code.md',
        );
        expect(fs.existsSync(adr), `${adr} is the record this flip rests on`).toBe(true);
        const head = fs.readFileSync(adr, 'utf-8').split('\n').slice(0, 20).join('\n');
        expect(head).toMatch(/^adr:\s*265$/m);
        expect(head).toMatch(/^status:\s*accepted$/m);
        expect(head).toMatch(/^reopen_policy:\s*owner$/m);
    });

    it('every generated host tree still carries full rule bodies, not pointers', () => {
        // `minimal-safe-diff` is a routed tier rule with a body long enough that
        // a pointer stub is unmistakable. One probe line per host tree.
        //
        // This assertion SURVIVES the flip unchanged and that is the point: the
        // generated trees in THIS repository are produced under this repo's own
        // `.agent-settings.yml`, which does not set `delivery`. If it ever goes
        // red here, either this repo adopted the mode or the projection thinned
        // a host ADR-265 does not cover — both are things to look at, not to
        // adjust away.
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
