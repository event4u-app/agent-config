/**
 * The six conditions the AI council attached to ratifying `update-notice` and
 * `update-auto-invite` as DECLARED authority expansions (2/2, 2026-10-20).
 *
 * Conditions 2-5 are testable and are tested here. Condition 1 (ratify the
 * vocabulary before registering) is discharged by the artifact covering both
 * in one subject, and condition 6 (document staged-state visibility) is prose
 * in the roadmap — neither is asserted here, and saying so is cheaper than a
 * test that pretends to cover them.
 *
 * The point of the file is that the two properties the ratification RESTS ON
 * cannot quietly regress: if `updateNotice` ever activates, or if the ring-0
 * record is ever read before the user's opt-in, the verdict that permitted
 * the registration no longer describes the code.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CONCERN_EFFECTS } from '../../src/scripts/lint_hook_manifest.js';
import { autoInviteDecision, type InviteInput } from '../../src/scripts/_lib/update_invite.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'hook_manifest.yaml'), 'utf-8');
const NOTICE_SRC = fs.readFileSync(path.join(ROOT, 'src', 'scripts', '_lib', 'update_notice.ts'), 'utf-8');

/** The concern's block in the manifest, from its key to the next key. */
function concernBlock(name: string): string {
    const m = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9-]*:\\n|\\nroles:)`, 'u').exec(MANIFEST);
    expect(m, `${name} is registered in hook_manifest.yaml`).not.toBeNull();
    return (m as RegExpExecArray)[1] as string;
}

describe('condition 1 — the vocabulary the registration needs exists', () => {
    it('carries the two terms the council added, and still refuses an invented one', () => {
        expect(CONCERN_EFFECTS.has('state_change')).toBe(true);
        expect(CONCERN_EFFECTS.has('interaction')).toBe(true);
        // Polarity: the set is still CLOSED. A ratification that widened it to
        // anything would have bought nothing.
        expect(CONCERN_EFFECTS.has('staging')).toBe(false);
        expect(CONCERN_EFFECTS.has('anything')).toBe(false);
    });
});

describe('condition 5 — the manifest declares the effect the council assigned', () => {
    it('`update-notice` is state_change, not notification', () => {
        const block = concernBlock('update-notice');
        expect(block).toContain('effect: state_change');
        // The weaker declaration is the one that was refused; assert its
        // ABSENCE rather than only the presence of the right one, because a
        // block carrying both would pass a presence-only check.
        expect(block).not.toContain('effect: notification');
    });

    it('`update-auto-invite` is interaction, not notification', () => {
        const block = concernBlock('update-auto-invite');
        expect(block).toContain('effect: interaction');
        expect(block).not.toContain('effect: notification');
    });
});

describe('condition 2 — every updateNotice path leaves activate null', () => {
    it('the type itself forbids any other value', () => {
        // Stronger than enumerating call sites: `activate: null` as a TYPE
        // means no path CAN return anything else, so this survives a new path
        // being added, which a behavioural sweep would not.
        expect(NOTICE_SRC).toMatch(/readonly activate:\s*null;/u);
    });

    it('no return literal in the module sets activate to anything else', () => {
        const assignments = [...NOTICE_SRC.matchAll(/activate:\s*([A-Za-z0-9_.]+)/gu)].map((m) => m[1]);
        expect(assignments.length).toBeGreaterThan(0);
        expect([...new Set(assignments)]).toEqual(['null']);
    });
});

describe('condition 3 — the user opt-in is read BEFORE the ring-0 kill switch', () => {
    const base: InviteInput = {
        mode: 'ask',
        ringZeroExited: true,
        registerAvailable: true,
        env: { ci: false, jsonOutput: false, subagent: false, headless: false, interactive: true },
    } as unknown as InviteInput;

    it('refuses without the opt-in even when ring-0 has exited', () => {
        const d = autoInviteDecision({ ...base, mode: 'auto' } as unknown as InviteInput);
        expect(d.ask).toBe(false);
        if (!d.ask) expect(d.reason).toContain('no user opt-in');
    });

    it('names the OPT-IN as the reason when both are missing — the order is the invariant', () => {
        // The ordering claim is what the ratification rests on: a rollout
        // switch may only ever subtract from a human's yes. If ring-0 were
        // read first this would report the ring-0 reason instead, and the
        // council's condition (d) would be false while every other case here
        // still passed.
        const d = autoInviteDecision({ ...base, mode: 'auto', ringZeroExited: false } as unknown as InviteInput);
        expect(d.ask).toBe(false);
        if (!d.ask) expect(d.reason).toContain('no user opt-in');
    });

    it('still refuses on the ring-0 switch when the opt-in IS present', () => {
        const d = autoInviteDecision({ ...base, ringZeroExited: false } as unknown as InviteInput);
        expect(d.ask).toBe(false);
        if (!d.ask) expect(d.reason).toContain('ring-0');
    });
});

describe('condition 4 — neither concern may invoke an upgrade command', () => {
    for (const rel of [
        'src/scripts/_lib/update_notice.ts',
        'src/scripts/_lib/update_invite.ts',
        'src/scripts/update_notice_hook.ts',
        'src/scripts/update_invite_hook.ts',
    ]) {
        it(`${rel} cannot reach a child process`, () => {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
            // The invariant is IMPORT reachability, not a name. A first pass
            // grepped for `exec(` and failed on `RING_ZERO_EXIT_LINE.exec()`
            // and `/re/.exec()` — a regex method, not a process. Matching the
            // name would have had to be loosened until it matched nothing,
            // which is how a guard becomes decoration. A module that never
            // imports `child_process` cannot spawn whatever it calls things.
            expect(src).not.toMatch(/from\s+'node:child_process'/u);
            expect(src).not.toMatch(/require\(['"]child_process['"]\)/u);
            // And no dynamic reach into it either.
            expect(src).not.toMatch(/import\(\s*['"]node:child_process['"]/u);
        });
    }
});
