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
    _prune_tier_b_modules,
    _resolve_tier_b,
    _tier_b_advisory,
    type DeployResult,
} from '../../src/scripts/install.js';
// The feature itself lives in `_lib/mcp_bridge.ts`; `install.ts` forwards the
// names above. Both surfaces are exercised: the forwarded ones here, and
// `applyTieredPrune` — the branch install.ts actually calls — below.
import { applyTieredPrune } from '../../src/scripts/_lib/mcp_bridge.js';
import { migrationEligibility } from '../../src/scripts/_lib/skill_catalogue.js';
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

describe('_resolve_tier_b — absent is null, never an empty prune set', () => {
    it('returns null when no split exists', () => {
        expect(_resolve_tier_b(root)).toBeNull();
    });

    it('returns null on malformed content — pruning on a half-read split would delete the tree', () => {
        writeTiers('{ oops');
        expect(_resolve_tier_b(root)).toBeNull();
        writeTiers(JSON.stringify({ tier_b: 'nope' }));
        expect(_resolve_tier_b(root)).toBeNull();
    });

    it('returns the names when the split is well formed', () => {
        writeTiers(JSON.stringify({ tier_a: ['keep'], tier_b: ['drop-me'] }));
        expect([..._resolve_tier_b(root)!]).toEqual(['drop-me']);
    });
});

describe('_prune_tier_b_modules — no Tier B SKILL.md survives the projection', () => {
    function skillTree(names: readonly string[]): { paths: string[]; dir: string } {
        const dir = path.join(root, 'host', 'skills');
        const paths: string[] = [];
        for (const n of names) {
            fs.mkdirSync(path.join(dir, n), { recursive: true });
            const f = path.join(dir, n, 'SKILL.md');
            fs.writeFileSync(f, `---\ndescription: d\n---\n\n# ${n}\n`);
            paths.push(f);
        }
        return { paths, dir };
    }

    it('drops exactly the Tier B skills and keeps Tier A', () => {
        const { paths } = skillTree(['alpha', 'beta', 'gamma']);
        const results: Record<string, DeployResult> = {
            claude: [3, 0, 'deployed', paths],
        };
        const [pruned, adjusted] = _prune_tier_b_modules(results, new Set(['beta', 'gamma']));
        expect(pruned).toBe(2);
        const kept = (adjusted['claude'] as DeployResult)[3];
        expect(kept.some((p) => p.includes(`${path.sep}alpha${path.sep}`))).toBe(true);
        expect(kept.some((p) => p.includes(`${path.sep}beta${path.sep}`))).toBe(false);
        expect(kept.some((p) => p.includes(`${path.sep}gamma${path.sep}`))).toBe(false);
    });

    it('prunes nothing when Tier B is empty', () => {
        const { paths } = skillTree(['alpha']);
        const [pruned] = _prune_tier_b_modules({ claude: [1, 0, 'deployed', paths] }, new Set());
        expect(pruned).toBe(0);
    });
});

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
        expect(line).toContain('projection.mode: tiered');
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

describe('applyTieredPrune — the branch the installer actually calls', () => {
    it('ships the full surface and WARNS when no split exists', () => {
        const dr = { claude: [1, 0, 'deployed', ['/x/skills/a/SKILL.md']] as DeployResult };
        const out = applyTieredPrune(dr, root, () => {
            throw new Error('must not prune without a split');
        });
        expect(out.level).toBe('warn');
        expect(out.deployResults).toBe(dr);
        expect(out.message).toContain('shipping the full surface');
    });

    it('prunes and reports at info level when a split exists', () => {
        writeTiers(JSON.stringify({ tier_a: ['a'], tier_b: ['b'] }));
        const dr = { claude: [1, 0, 'deployed', []] as DeployResult };
        const out = applyTieredPrune(dr, root, (d) => [2, d]);
        expect(out.level).toBe('info');
        expect(out.message).toContain('pruned 2 Tier-B skill artefact(s)');
        expect(out.message).toContain('suggest_skill_for_task');
    });
});

describe('migrationEligibility — a tiered install is already narrowed', () => {
    // Found by `task typecheck-ts`, not by `tsc -p tsconfig.json`, which does not
    // apply the repo's `exactOptionalPropertyTypes` / strict settings: widening
    // the projection union to three members left this call site narrowing to two.
    // `tiered` gets its OWN reason rather than reusing `already-scoped` — the two
    // narrow on different axes (packs vs the host's listing budget) and a caller
    // reading the reason should be able to tell which one the install is on.
    const limits = new Map();

    it('reports already-tiered, distinct from already-scoped', () => {
        expect(migrationEligibility('codex', 'tiered', 297, limits).reason).toBe('already-tiered');
        expect(migrationEligibility('codex', 'tiered', 297, limits).eligible).toBe(false);
        expect(migrationEligibility('codex', 'scoped', 297, limits).reason).toBe('already-scoped');
    });
});
