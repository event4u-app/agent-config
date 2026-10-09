// `doctor` is offline by DEFAULT; `--online` opts the forge read back in.
//
// Step 3.3 of `road-to-findings-that-get-a-disposition`, implementing blocker
// `doctor-network-default` option (a) — AI council 2026-10-07, anthropic +
// openai, 2/2, adopted 2026-10-08 under the owner's delegation. Phase 3.1
// shipped the opt-OUT (`--no-forge` / `--offline`) and deliberately did not
// decide the default; this flips it.
//
// The council attached one condition to (a), and it is the reason this file
// exists rather than a one-line flip: the skipped read must be reported
// EXPLICITLY, so that an aggregate verdict cannot read a block nobody queried
// as a block that passed. `read_from_forge: false` alone did not carry that —
// five `unread` rows and no failures is exactly what "everything is fine"
// looks like to a consumer summing states.
//
// Every assertion below is paired with its opposite wherever the opposite is
// expressible: a default run against an `--online` run, a not-checked reason
// against a read that happened, and the no-spawn property against a runner
// that WOULD have spawned.
import { describe, expect, it } from 'vitest';

import {
    forgeDepsFor,
    forgeProtectionJson,
    forgeProtectionJsonFor,
} from '../../src/scripts/_cli/doctor_execution.js';
import { UNREAD_FORGE } from '../../src/scripts/_lib/forge_protection.js';

type Dict = Record<string, unknown>;

describe('doctor — offline by default', () => {
    // --- The default itself, both directions. ---

    it('skips the forge read when `--online` is absent', () => {
        expect(forgeDepsFor({ online: false, check: null }).offline).toBe(true);
    });

    it('performs the forge read when `--online` is passed', () => {
        expect(forgeDepsFor({ online: true, check: null }).offline).toBe(false);
    });

    // `--check <id>` reads no forge row, so it stays offline even under
    // `--online`. Without this the opt-in would re-introduce a network read on
    // the one path Phase 3.1 established never needs it.
    it('stays offline for a single-check run even under `--online`', () => {
        expect(forgeDepsFor({ online: true, check: 'python-runtime' }).offline).toBe(true);
    });

    // --- The council's condition: the skip is reported, not merely implied. ---

    it('names WHY the block was not checked on a default run', () => {
        const deps = forgeDepsFor({ online: false, check: null });
        expect(deps.not_checked).toBe('online_not_requested');
    });

    it('distinguishes a single-check skip from the default skip', () => {
        const deps = forgeDepsFor({ online: true, check: 'python-runtime' });
        expect(deps.not_checked).toBe('single_check');
    });

    it('reports no reason when the read actually happened', () => {
        expect(forgeDepsFor({ online: true, check: null }).not_checked).toBeNull();
    });

    it('carries the reason into the JSON block', () => {
        const block = forgeProtectionJson(UNREAD_FORGE, null, 'online_not_requested') as Dict;
        expect(block['not_checked']).toBe('online_not_requested');
        expect(block['read_from_forge']).toBe(false);
        expect(block['repository']).toBeNull();
    });

    // The pairing that makes the field meaningful: a read that HAPPENED must
    // not carry a reason, or a consumer cannot use the key to tell the two
    // apart and the condition buys nothing.
    it('carries no reason when a reading was supplied', () => {
        const block = forgeProtectionJson(UNREAD_FORGE, null, null) as Dict;
        expect(block['not_checked']).toBeNull();
    });

    // A skipped block must not look like a passing one to something summing
    // row states. Every row stays `unread` AND the reason is present.
    it('leaves every row unread so no row reads as satisfied', () => {
        const block = forgeProtectionJson(UNREAD_FORGE, null, 'online_not_requested') as Dict;
        const rows = block['rows'] as { state: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.state === 'unread')).toBe(true);
    });

    // --- No spawn on the default path, shown with a runner that would record one. ---

    it('spawns nothing on a default run', () => {
        const calls: string[][] = [];
        const run = (cmd: string, args: readonly string[]): never => {
            calls.push([cmd, ...args]);
            throw new Error('the default path must not spawn');
        };
        const deps = { ...forgeDepsFor({ online: false, check: null }), run, env: {} };
        const block = forgeProtectionJsonFor('/nonexistent', deps) as Dict;
        expect(calls).toEqual([]);
        expect(block['not_checked']).toBe('online_not_requested');
    });

    it('spawns nothing on a single-check run', () => {
        const calls: string[][] = [];
        const run = (cmd: string, args: readonly string[]): never => {
            calls.push([cmd, ...args]);
            throw new Error('a single-check run must not spawn');
        };
        const deps = { ...forgeDepsFor({ online: true, check: 'python-runtime' }), run, env: {} };
        forgeProtectionJsonFor('/nonexistent', deps);
        expect(calls).toEqual([]);
    });

    // The denial half of the two above: with `--online` and no check, the
    // runner IS reached. Without this, a gate that simply never spawned would
    // pass both tests above and the opt-in would be dead.
    it('reaches the runner under `--online`', () => {
        const calls: string[][] = [];
        const run = (cmd: string, args: readonly string[]): { status: number; stdout: string } => {
            calls.push([cmd, ...args]);
            return { status: 1, stdout: '' };
        };
        const deps = { ...forgeDepsFor({ online: true, check: null }), run, env: {} };
        forgeProtectionJsonFor('/nonexistent', deps);
        expect(calls.length).toBeGreaterThan(0);
    });
});
