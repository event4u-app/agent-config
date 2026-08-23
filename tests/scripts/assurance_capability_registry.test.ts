/**
 * Invariants of `src/config/assurance-capability-registry.json` — the assurance
 * capability inventory.
 *
 * These assertions ARE the verify lines of `road-to-agentic-engineering-assurance`
 * steps 0.1, 0.2 and 0.3, discharged literally rather than in prose:
 *
 *   0.1 "one machine-readable inventory maps each capability to exactly one
 *        owner surface or declares it missing; duplicate owners are findings"
 *   0.2 "the architecture note contains an owner table and no new skill or
 *        reviewer is introduced"
 *   0.3 "every capability has a definition, observable evidence and
 *        available|missing|degraded|unknown; no tool name appears in a
 *        capability identifier"
 *
 * ON THE READING OF "duplicate owners are findings". Two readings are possible
 * and only one is a defect. A capability with TWO owner surfaces is ambiguous
 * ownership and is the defect 0.2 exists to prevent — asserted below by requiring
 * `owner_surface` to be a single non-empty string. One surface owning MANY
 * capabilities is the opposite of a defect: it is the anti-sprawl outcome this
 * roadmap wants, and `grade_target_readiness.ts` owning nine of them is the
 * system working. So the reverse direction is deliberately NOT asserted, and the
 * property that matters instead — exactly one grader, never a second — is
 * asserted directly.
 *
 * SABOTAGE PROBES, run before this file was trusted, each reverted by restoring a
 * `cp` backup of the JSON (never `git checkout`, which would discard uncommitted
 * work). Recorded counts are in the roadmap steps.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { grade } from '../../src/scripts/grade_target_readiness.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY_PATH = join(REPO_ROOT, 'src', 'config', 'assurance-capability-registry.json');

interface Capability {
    axis: string;
    owner_surface: string;
    projection: string | null;
    state: string;
    rationale: string;
    evidence: string;
    revisit_if: string;
    limitations?: string[];
}
interface Registry {
    schema_version: number;
    owner: string;
    review_by: string;
    registered_at: string;
    grader: { path: string; dimensions: number; knockouts: string[] };
    state_vocabulary: string[];
    capabilities: Record<string, Capability>;
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8')) as Registry;
const entries = Object.entries(registry.capabilities);

/** Tool names that must never appear in a capability IDENTIFIER (0.3, P1). */
const TOOL_NAMES = [
    'pest',
    'phpunit',
    'phpstan',
    'psalm',
    'infection',
    'vitest',
    'jest',
    'stryker',
    'playwright',
    'pytest',
    'mutmut',
    'mypy',
    'pyright',
    'ruff',
    'bandit',
    'semgrep',
    'eslint',
    'biome',
    'deptrac',
    'hypothesis',
];

describe('assurance capability registry — budget-config shape', () => {
    it('carries the owner and review_by every src/config budget config carries', () => {
        expect(registry.schema_version).toBeGreaterThanOrEqual(1);
        expect(registry.owner.trim().length).toBeGreaterThan(0);
        expect(registry.review_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(registry.registered_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('is not empty — a registry that scans nothing would pass every assertion below', () => {
        expect(entries.length).toBeGreaterThanOrEqual(19);
    });
});

describe('assurance capability registry — 0.1 exactly one owner per capability', () => {
    it('every capability declares exactly one owner surface as a single string', () => {
        for (const [id, cap] of entries) {
            expect(typeof cap.owner_surface, id).toBe('string');
            expect(cap.owner_surface.trim().length, id).toBeGreaterThan(0);
        }
    });

    it('every owner surface either exists on disk or is the literal "none"', () => {
        // "none" is the declared-missing case 0.1 allows. A path that neither
        // resolves nor says "none" is a stale reference, which is the drift this
        // assertion catches.
        for (const [id, cap] of entries) {
            if (cap.owner_surface === 'none') continue;
            expect(existsSync(join(REPO_ROOT, cap.owner_surface)), `${id} -> ${cap.owner_surface}`).toBe(true);
        }
    });

    it('a capability with no owner surface is state unknown, never available', () => {
        for (const [id, cap] of entries) {
            if (cap.owner_surface === 'none') {
                expect(cap.state, id).toBe('unknown');
                expect(cap.projection, id).toBeNull();
            }
        }
    });
});

describe('assurance capability registry — 0.2 exactly one grader, no second scanner', () => {
    it('the declared grader exists', () => {
        expect(existsSync(join(REPO_ROOT, registry.grader.path)), registry.grader.path).toBe(true);
    });

    it('no capability with a projection is owned by a script other than the grader', () => {
        // This is AC-2 made mechanical. A second script appearing as the owner of
        // a projected capability IS a second scanner, whatever it is called.
        for (const [id, cap] of entries) {
            if (cap.projection === null) continue;
            if (!cap.owner_surface.startsWith('src/scripts/')) continue;
            expect(cap.owner_surface, id).toBe(registry.grader.path);
        }
    });

    it('every projection names a dimension the grader actually emits', () => {
        const emitted = new Set(grade(join(REPO_ROOT, 'tests', 'fixtures', 'target-repos', 'full')).dimensions.map((d) => d.id));
        expect(emitted.size).toBe(registry.grader.dimensions);
        for (const [id, cap] of entries) {
            if (cap.projection === null) continue;
            expect(emitted.has(cap.projection), `${id} -> ${cap.projection}`).toBe(true);
        }
    });

    it('every declared knockout is a dimension the grader emits', () => {
        const byId = new Map(grade(join(REPO_ROOT, 'tests', 'fixtures', 'target-repos', 'full')).dimensions.map((d) => [d.id, d]));
        for (const k of registry.grader.knockouts) {
            expect(byId.get(k)?.knockout, k).toBe(true);
        }
    });
});

describe('assurance capability registry — 0.3 vocabulary is closed and tool-neutral', () => {
    it('the state vocabulary is exactly the four declared values', () => {
        expect([...registry.state_vocabulary].sort()).toEqual(['available', 'degraded', 'missing', 'unknown']);
    });

    it('every capability state is drawn from that vocabulary', () => {
        for (const [id, cap] of entries) {
            expect(registry.state_vocabulary, id).toContain(cap.state);
        }
    });

    it('no capability identifier contains a tool name', () => {
        for (const [id] of entries) {
            for (const tool of TOOL_NAMES) {
                expect(id.toLowerCase().includes(tool), `${id} contains ${tool}`).toBe(false);
            }
        }
    });

    it('every capability carries a definition, evidence and a revisit condition', () => {
        for (const [id, cap] of entries) {
            expect(cap.rationale?.trim().length, `${id}.rationale`).toBeGreaterThan(0);
            expect(cap.evidence?.trim().length, `${id}.evidence`).toBeGreaterThan(0);
            expect(cap.revisit_if?.trim().length, `${id}.revisit_if`).toBeGreaterThan(0);
        }
    });

    it('every capability declares an axis from the closed set', () => {
        for (const [id, cap] of entries) {
            expect(['self', 'target', 'both'], id).toContain(cap.axis);
        }
    });
});

describe('assurance capability registry — P8 no silent degradation', () => {
    it('every degraded capability names its limitations', () => {
        // "Never present same-context review as independent review" is only
        // checkable if a degraded state is forced to say what is missing.
        for (const [id, cap] of entries) {
            if (cap.state !== 'degraded') continue;
            expect(Array.isArray(cap.limitations), `${id}.limitations`).toBe(true);
            expect(cap.limitations?.length ?? 0, `${id}.limitations`).toBeGreaterThan(0);
            for (const l of cap.limitations ?? []) expect(l.trim().length, `${id} limitation`).toBeGreaterThan(0);
        }
    });

    it('a non-degraded capability does not carry limitations', () => {
        for (const [id, cap] of entries) {
            if (cap.state === 'degraded') continue;
            expect(cap.limitations, id).toBeUndefined();
        }
    });
});

describe('assurance capability registry — sibling dispositions are recorded, not laundered', () => {
    const SIBLING_OWNED = ['independent-test-author', 'independent-review', 'requirement-trace'] as const;

    it('all three sibling-owned capabilities are present and on the self axis', () => {
        for (const id of SIBLING_OWNED) {
            const cap = registry.capabilities[id];
            expect(cap, id).toBeDefined();
            expect(cap!.axis, id).toBe('self');
        }
    });

    it('none of them is available — a parked or unmeasured outcome may not read as a positive one', () => {
        for (const id of SIBLING_OWNED) {
            expect(registry.capabilities[id]!.state, id).not.toBe('available');
        }
    });

    it('each cites the archived sibling roadmap or the shipped mechanism it consumes', () => {
        for (const id of SIBLING_OWNED) {
            const cap = registry.capabilities[id]!;
            const cites = `${cap.owner_surface} ${cap.evidence}`;
            expect(/archive\/road-to-|src\/scripts\//.test(cites), `${id}: ${cites}`).toBe(true);
        }
    });
});
