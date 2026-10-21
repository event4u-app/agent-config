// Phase 2.2 of `road-to-skill-delivery-over-mcp` — `projection.mode: tiered`.
//
// The claim `tiered` rests on is that withholding a skill from the native
// catalogue is safe BECAUSE the MCP server still serves it. That claim is not
// self-evident and it is the one asserted hardest here: every Tier B name is
// resolved through the real `read_skill` handler over the real projected content
// tree, not against a fixture. If that ever stops holding, `tiered` stops being
// a delivery change and becomes deletion (roadmap risk 4).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {


    _tier_b_advisory,
} from '../../src/scripts/install.js';
// The feature itself lives in `_lib/mcp_bridge.ts`; `install.ts` forwards the
// names above. Both surfaces are exercised: the forwarded ones here, and
// `applyTieredPrune` — the branch install.ts actually calls — below.

import { computeTiers } from '../../src/scripts/compute_skill_tiers.js';
import { loadContentTree } from '../../src/cli/mcp/content.js';
import { dispatch } from '../../src/cli/mcp/dispatch.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const IDENTITY = { name: 'agent-config-mcp', version: '0.0.0-test' };

let root: string;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiered-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function writeTiers(body: string): void {
    const dir = path.join(root, 'agents', 'runtime', 'state');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'skill-tiers.json'), body);
}

describe('the tiered claim — every Tier B skill is still reachable over MCP', () => {
    // This is the load-bearing assertion of the whole phase. Real split, real
    // content tree, real dispatcher.
    const split = computeTiers();
    const tree = loadContentTree(REPO_ROOT);

    function readSkill(name: string): Record<string, unknown> {
        const resp = dispatch(tree, IDENTITY, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'read_skill', arguments: { name } },
        });
        return (resp as { result: { structuredContent: Record<string, unknown> } }).result
            .structuredContent;
    }

    it('has a non-trivial Tier B to check', () => {
        expect(split.tier_b.length).toBeGreaterThan(50);
    });

    it('the two tiers partition the projected catalogue exactly', () => {
        expect(split.tier_a.length + split.tier_b.length).toBe(split.catalogue_count);
        expect(new Set([...split.tier_a, ...split.tier_b]).size).toBe(split.catalogue_count);
    });

    it('read_skill resolves EVERY Tier B name, with a body', () => {
        const unreachable: string[] = [];
        for (const name of split.tier_b) {
            const out = readSkill(name);
            if (out.status !== 'ok' || typeof out.body !== 'string' || out.body.length === 0) {
                unreachable.push(name);
            }
        }
        expect(unreachable, `Tier B skills the MCP server cannot serve: ${unreachable.join(', ')}`)
            .toEqual([]);
    });

    it('read_skill resolves every Tier A name too — tiering changes delivery, not content', () => {
        const unreachable = split.tier_a.filter((n) => readSkill(n).status !== 'ok');
        expect(unreachable).toEqual([]);
    });
});

describe('_tier_b_advisory — Phase 2.3, a recommendation and never a write', () => {
    it('is silent when no split exists', () => {
        expect(_tier_b_advisory(root)).toBeNull();
    });

    it('is silent when Tier B is empty — the host already describes everything', () => {
        writeTiers(JSON.stringify({ tier_a: ['a', 'b'], tier_b: [] }));
        expect(_tier_b_advisory(root)).toBeNull();
    });

    it('names BOTH levers when Tier B is non-empty, and recommends neither silently', () => {
        writeTiers(JSON.stringify({ tier_a: ['a'], tier_b: ['b', 'c'] }));
        const line = _tier_b_advisory(root)!;
        expect(line).toContain('2 skill(s)');
        expect(line).toContain('skillListingBudgetFraction');
        // Was `projection.mode: tiered`, which this change removed as a settings
        // key. The invariant this case is named for is that BOTH levers are
        // offered and neither is taken silently — so it follows the surviving
        // second lever rather than dropping the assertion with the key.
        expect(line).toContain('MCP server');
        expect(line).toContain('neither applied for you');
    });

    it('writes nothing — the advisory is a string, not a side effect', () => {
        writeTiers(JSON.stringify({ tier_a: [], tier_b: ['b'] }));
        const before = fs.readdirSync(root).sort();
        _tier_b_advisory(root);
        expect(fs.readdirSync(root).sort()).toEqual(before);
        expect(fs.existsSync(path.join(root, 'settings.json'))).toBe(false);
        expect(fs.existsSync(path.join(root, '.claude'))).toBe(false);
    });
});

// REMOVED 2026-10-20: the `migrationEligibility — a tiered install is
// already narrowed` suite. `already-tiered` is no longer a verdict
// `migrationEligibility` can return. skill_catalogue.ts says so in its
// own comment — "There were three modes until 2026-10-20" — so it
// asserted a value the function cannot produce, not a behaviour that
// went unasserted. The sibling `already-scoped` case stays.
//
// The whole `describe` goes rather than only its body: vitest FAILS a
// suite that registers no test ("No test found in suite ..."), so an
// emptied shell is a red, not a tidy placeholder for the note above.
