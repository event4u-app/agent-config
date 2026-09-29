import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    concernSlotAudit,
    renderConcernAudit,
} from '../../src/scripts/check_enforcement_matrix.js';
import { parseHostLowering } from '../../src/scripts/hooks/host_lowering.js';

/**
 * Four hosts, because the behaviour has four outcomes and a fixture that cannot
 * separate them cannot test it:
 *
 *   - `denier`      — `pre_tool_use` denies. The guard bound there is NOT a finding.
 *   - `discarder`   — `pre_tool_use` row exists, `block_exit: null`. `null-block`.
 *   - `unlowered`   — `slots: {}` against real bindings. `unlowerable`. This is
 *                     the `cowork` shape, and an earlier version of the audit
 *                     skipped it, printing a clean `0/0` for the host with the
 *                     largest gap.
 *   - `expired`     — `block_exit: 2` but the `verified` block is in the past.
 *                     `stale-proof`, and it must NOT be worded as the host being
 *                     unable to deny.
 *
 * The same blocking concern is bound on all four, so every assertion below
 * distinguishes "classified this host correctly" from "flagged everything".
 */
const LOWERING = `hosts:
  denier:
    surfaces:
      any:
        entry_shape: json
        json_shape: claude
        fail_policy: propagate
        verified:
          docs_at: "2026-09-01"
          expires: "2099-01-01"
        slots:
          pre_tool_use:
            native: PreToolUse
            block_exit: 2
          post_tool_use:
            native: PostToolUse
            block_exit: null
  discarder:
    surfaces:
      any:
        entry_shape: json
        json_shape: claude
        fail_policy: discard
        verified:
          docs_at: "2026-09-01"
          expires: "2099-01-01"
        slots:
          pre_tool_use:
            native: PreToolUse
            block_exit: null
  unlowered:
    surfaces:
      any:
        entry_shape: none
        json_shape: none
        fail_policy: discard
        verified: null
        slots: {}
  expired:
    surfaces:
      any:
        entry_shape: json
        json_shape: claude
        fail_policy: propagate
        verified:
          docs_at: "2020-01-01"
          expires: "2020-06-01"
        slots:
          pre_tool_use:
            native: PreToolUse
            block_exit: 2
`;

const MANIFEST = `schema_version: 1
concerns:
  a-guard:
    script: src/scripts/hooks/x.ts
    severity: blocking
  a-reporter:
    script: src/scripts/hooks/y.ts
    severity: advisory
  no-severity:
    script: src/scripts/hooks/z.ts
platforms:
  denier:
    ask:           native
    pre_tool_use:  [a-guard]
    post_tool_use: [a-reporter]
  discarder:
    pre_tool_use:  [a-guard, no-severity]
  unlowered:
    ask:           text
    pre_tool_use:  [a-guard]
    post_tool_use: [a-reporter]
  expired:
    pre_tool_use:  [a-guard]
`;

function tree(manifest = MANIFEST): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'concern-audit-'));
    fs.mkdirSync(path.join(dir, 'src', 'scripts', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'), manifest, 'utf-8');
    return dir;
}

const lowering = (): ReturnType<typeof parseHostLowering> => parseHostLowering(LOWERING);

function audit(manifest = MANIFEST): Map<string, ReturnType<typeof concernSlotAudit>[number]> {
    return new Map(concernSlotAudit(tree(manifest), lowering()).map((h) => [h.host, h]));
}

describe('concernSlotAudit — a slot that can deny is not a finding', () => {
    it('the guard on a denying slot is absent from noDeny', () => {
        expect(audit().get('denier')!.noDeny.map((b) => b.concern)).not.toContain('a-guard');
    });

    it('denySlots counts the literal block_exit, per host', () => {
        const a = audit();
        expect(a.get('denier')).toMatchObject({ denySlots: 1, lowerableSlots: 2 });
        expect(a.get('discarder')).toMatchObject({ denySlots: 0, lowerableSlots: 1 });
    });
});

describe('concernSlotAudit — null-block', () => {
    it('names the blocking guard on a wired slot that cannot refuse', () => {
        const d = audit().get('discarder')!;
        expect(d.noDeny).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    concern: 'a-guard',
                    severity: 'blocking',
                    reason: 'null-block',
                }),
            ]),
        );
    });

    it('an advisory concern is recorded but not counted as blocking', () => {
        const d = audit().get('denier')!;
        expect(d.noDeny.find((b) => b.concern === 'a-reporter')).toMatchObject({
            slot: 'post_tool_use',
            severity: 'advisory',
            reason: 'null-block',
        });
        expect(d.noDeny.filter((b) => b.severity === 'blocking')).toEqual([]);
    });

    it('an undeclared severity is neither hidden nor called blocking', () => {
        const d = audit().get('discarder')!;
        expect(d.noDeny.find((b) => b.concern === 'no-severity')?.severity).toBe('(undeclared)');
        expect(d.noDeny.filter((b) => b.severity === 'blocking').map((b) => b.concern)).toEqual([
            'a-guard',
        ]);
    });
});

describe('concernSlotAudit — unlowerable is reported, never skipped', () => {
    /**
     * The regression this exists for: skipping a slot with no lowering row made
     * a host with `slots: {}` and sixty bindings print identically to a host
     * that binds nothing.
     */
    it('a bound slot with no lowering row is classified, not dropped', () => {
        const u = audit().get('unlowered')!;
        expect(u.noDeny).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    slot: 'pre_tool_use',
                    concern: 'a-guard',
                    reason: 'unlowerable',
                }),
            ]),
        );
    });

    it('its bound-slot count separates it from a host that binds nothing', () => {
        const u = audit().get('unlowered')!;
        expect(u).toMatchObject({ denySlots: 0, lowerableSlots: 0 });
        // `ask` is excluded as a non-verdict slot, so 2 of the 3 bound keys count.
        expect(u.boundSlots).toBe(2);
        expect(u.noDeny.length).toBeGreaterThan(0);
    });

    it('a host absent from the manifest is absent from the audit', () => {
        expect(audit().has('nosuchhost')).toBe(false);
    });
});

describe('concernSlotAudit — stale-proof is about the citation, not the host', () => {
    it('an expired verified block is its own reason, not null-block', () => {
        const e = audit().get('expired')!;
        expect(e.noDeny).toEqual([
            expect.objectContaining({
                slot: 'pre_tool_use',
                concern: 'a-guard',
                reason: 'stale-proof',
            }),
        ]);
    });

    it('the host still counts as able to deny — the literal is what decides', () => {
        // `host_lowering.yaml` states that an absent/expired `verified` does NOT
        // mean the host cannot enforce, so denySlots must read the literal.
        expect(audit().get('expired')).toMatchObject({ denySlots: 1, lowerableSlots: 1 });
    });
});

describe('concernSlotAudit — the ask slot', () => {
    it('is excluded as a non-verdict slot rather than silently miscounted', () => {
        // `denier` binds `ask: native` plus two verdict slots.
        expect(audit().get('denier')!.boundSlots).toBe(2);
        expect(audit().get('denier')!.noDeny.map((b) => b.slot)).not.toContain('ask');
    });
});

describe('concernSlotAudit — ordering and degradation', () => {
    it('unlowerable sorts ahead of null-block, and blocking ahead of advisory', () => {
        const u = audit().get('unlowered')!;
        expect(u.noDeny[0]).toMatchObject({ reason: 'unlowerable', severity: 'blocking' });
    });

    it('an unreadable manifest yields no audit rather than a crash', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'concern-audit-empty-'));
        expect(concernSlotAudit(dir, lowering())).toEqual([]);
    });
});

describe('renderConcernAudit', () => {
    const text = (): string =>
        renderConcernAudit(concernSlotAudit(tree(), lowering())).join('\n');

    it('prints the deny count, the bound-slot denominator and the flagged concerns', () => {
        expect(text()).toMatch(/denier\s+1\/2 lowerable slot\(s\) can deny · 2 verdict-bearing/);
        expect(text()).toMatch(/discarder\s+0\/1 lowerable slot\(s\) can deny/);
        expect(text()).toContain('a-guard (blocking)');
    });

    it('words stale-proof without claiming the host cannot deny', () => {
        const out = text();
        const line = out.split('\n').find((l) => l.includes('verified'))!;
        expect(line).not.toMatch(/cannot (deny|refuse)/);
        expect(line).toContain('proof has expired');
    });

    it('names the unlowerable reason for a host with no slot rows', () => {
        expect(text()).toContain('no lowering row for this slot');
    });

    it('does not flag an advisory concern with a warning line', () => {
        expect(text()).not.toMatch(/⚠️.*a-reporter/);
    });
});
