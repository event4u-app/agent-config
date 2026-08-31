/**
 * Free explain mode — step 12.2.
 *
 * The verify clause is *"explain mode issues zero provider calls"*, and the
 * strongest available form of that is structural: the module imports nothing
 * that could make one. That is asserted over the import graph, not promised in
 * prose.
 *
 * The step stays UNCHECKED: *"which topology would run"* is unanswerable
 * because no selector exists, so 12.2 cannot close whole.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    TOPOLOGY_UNAVAILABLE,
    estimateSpend,
    explainRoute,
    renderRouteExplanation,
} from '../../../src/scripts/ai_council/explain_route.js';
import type { EstimateMember } from '../../../src/scripts/ai_council/explain_route.js';
import { priceKey } from '../../../src/scripts/ai_council/_default_prices.js';
import type { PriceTable } from '../../../src/scripts/ai_council/pricing.js';
import type { LadderInputs } from '../../../src/scripts/_lib/judgment_ladder.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const MODULE_REL = 'src/scripts/ai_council/explain_route.ts';
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, MODULE_REL), 'utf8');
/** Comments stripped — the module's own docstring says the words the gate forbids in CODE. */
const MODULE_CODE = MODULE_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const TABLE: PriceTable = {
    last_updated: '2026-08-31',
    currency: 'USD',
    unit: 'per_1M_tokens',
    source: 'test fixture',
    prices: new Map([
        [priceKey('anthropic', 'm-a'), { provider: 'anthropic', model: 'm-a', input_per_1m_usd: 3, output_per_1m_usd: 15 }],
        [priceKey('openai', 'm-o'), { provider: 'openai', model: 'm-o', input_per_1m_usd: 2, output_per_1m_usd: 8 }],
    ]),
} as unknown as PriceTable;

const MEMBERS: EstimateMember[] = [
    { name: 'anth', provider: 'anthropic', model: 'm-a', billable: true },
    { name: 'oai', provider: 'openai', model: 'm-o', billable: true },
];

function inputs(taskText: string): LadderInputs {
    return {
        taskText,
        activation: { halted: false, subagent_spawn: true },
        signals: {},
        agentTeams: true,
    } as unknown as LadderInputs;
}

const COUNCIL_TASK = 'We need an architecture decision on whether synthesis stays host-side.';

describe('12.2 — explain mode issues zero provider calls', () => {
    it('STRUCTURAL — the module imports no client, transport or dispatch', () => {
        const imports = [...MODULE_SRC.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] as string);
        // The DISTINCT module set — value and type imports both count.
        expect([...new Set(imports)].sort()).toEqual(['../_lib/judgment_ladder.js', './pricing.js'].sort());
        for (const forbidden of ['clients.js', 'transport', 'orchestrator', 'consult', 'fetch(', 'node:https']) {
            expect(MODULE_CODE).not.toContain(forbidden);
        }
    });

    it('its two dependencies are themselves free — a regex resolver and a price table', () => {
        const ladder = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/_lib/judgment_ladder.ts'), 'utf8');
        const pricing = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/ai_council/pricing.ts'), 'utf8');
        for (const src of [ladder, pricing]) {
            expect(src).not.toContain('fetch(');
            expect(src).not.toMatch(/from ['"]node:https?['"]/);
        }
    });

    it('says so in the rendered output, so a reader is not left guessing', () => {
        const out = renderRouteExplanation(
            explainRoute(inputs(COUNCIL_TASK), MEMBERS, 2, 'a short question', 1000, TABLE),
        );
        expect(out).toContain('no provider call was issued');
    });
});

describe('field 1 — why task-side orchestration resolved to council', () => {
    it('carries the resolution and the full per-rung trail', () => {
        const e = explainRoute(inputs(COUNCIL_TASK), MEMBERS, 2, 'q', 1000, TABLE);
        expect(e.ladder.result.verdict).toBe('council');
        expect(e.ladder.result.rung).toBe(4);
        expect(e.ladder.result.reason).toContain('design-decision signal');
        expect(e.ladder.trail.length).toBeGreaterThan(1);
        expect(new Set(e.ladder.trail.map((r) => r.status)).size).toBeGreaterThan(1);
    });

    it('renders the trail with each rung’s own status and reason', () => {
        const out = renderRouteExplanation(explainRoute(inputs(COUNCIL_TASK), MEMBERS, 2, 'q', 1000, TABLE));
        expect(out).toMatch(/rung 0 → script\s+rejected/);
        expect(out).toMatch(/rung 4 → council\s+taken/);
    });

    it('explains a NON-council resolution just as well — it is not a council-only surface', () => {
        const e = explainRoute(inputs('Who calls select_chairman?'), MEMBERS, 2, 'q', 1000, TABLE);
        expect(e.ladder.result.verdict).toBe('script');
        expect(e.ladder.result.rung).toBe(0);
    });
});

describe('field 2 — which topology would run: UNANSWERABLE, and present anyway', () => {
    it('carries the unavailable marker rather than omitting the field', () => {
        const e = explainRoute(inputs(COUNCIL_TASK), MEMBERS, 2, 'q', 1000, TABLE);
        expect(e.topology).toBe(TOPOLOGY_UNAVAILABLE);
        expect(TOPOLOGY_UNAVAILABLE).toContain('no topology selector exists');
        // A field silently missing from an explanation reads as "not
        // applicable"; this one has to read as "not built yet".
        expect(renderRouteExplanation(e)).toContain('topology     unavailable');
    });

    it('never names a topology, which would be a guess dressed as an explanation', () => {
        const out = renderRouteExplanation(explainRoute(inputs(COUNCIL_TASK), MEMBERS, 2, 'q', 1000, TABLE));
        for (const t of ['single_external', 'dual_independent', 'peer_review', 'judge_synthesis', 'full_debate']) {
            expect(out).not.toContain(t);
        }
    });
});

describe('field 3 — estimated spend and calls, arithmetic only', () => {
    it('counts one call per member per round', () => {
        expect(estimateSpend(MEMBERS, 3, 'q', 1000, TABLE).calls).toBe(6);
        expect(estimateSpend(MEMBERS, 0, 'q', 1000, TABLE).calls).toBe(0);
    });

    it('a subscription seat contributes calls but ZERO dollars, and is named', () => {
        const mixed: EstimateMember[] = [
            MEMBERS[0] as EstimateMember,
            { name: 'cli-seat', provider: 'anthropic', model: 'm-a', billable: false },
        ];
        const s = estimateSpend(mixed, 2, 'q', 1000, TABLE);
        expect(s.calls).toBe(4);
        expect(s.perMember.find((m) => m.name === 'cli-seat')?.usd).toBe(0);
        expect(s.nonBillableMembers).toEqual(['cli-seat']);
        // The billable member's spend is unaffected by the free one.
        expect(s.usd).toBe(estimateSpend([MEMBERS[0] as EstimateMember], 2, 'q', 1000, TABLE).usd);
    });

    it('renders the subscription caveat next to the zero rather than hiding it', () => {
        const mixed: EstimateMember[] = [{ name: 'cli-seat', provider: 'anthropic', model: 'm-a', billable: false }];
        expect(renderRouteExplanation(explainRoute(inputs(COUNCIL_TASK), mixed, 2, 'q', 1000, TABLE))).toContain(
            'calls are real, spend is not',
        );
    });

    it('an unpriced model estimates $0 rather than throwing — pricing.ts’s own fallback', () => {
        const unknown: EstimateMember[] = [{ name: 'x', provider: 'nobody', model: 'nothing', billable: true }];
        expect(estimateSpend(unknown, 2, 'q', 1000, TABLE).usd).toBe(0);
    });
});

describe('field 4 — evidence source', () => {
    it('defaults to none and renders it, rather than leaving the line out', () => {
        const out = renderRouteExplanation(explainRoute(inputs(COUNCIL_TASK), MEMBERS, 2, 'q', 1000, TABLE));
        expect(out).toContain('evidence     none');
    });

    it('carries a supplied source verbatim', () => {
        const e = explainRoute(inputs(COUNCIL_TASK), MEMBERS, 2, 'q', 1000, TABLE, 'internal/bench/council-topology/call-manifest.json');
        expect(e.evidenceSource).toBe('internal/bench/council-topology/call-manifest.json');
    });
});

describe('DENIAL — the import scanner fires on a real violation', () => {
    it('would catch a client import added to this module', () => {
        const violating = "import { consult } from './orchestrator.js';";
        expect([...violating.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])).toEqual(['./orchestrator.js']);
        expect(violating).toContain('orchestrator');
        // …and the real module carries neither.
        expect(MODULE_CODE).not.toContain("from './orchestrator.js'");
    });
});
