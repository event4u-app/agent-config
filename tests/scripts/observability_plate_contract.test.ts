// Contract test for the observability plate (road-to-observability-plate.md).
//
// The plate's blocker was resolved by AI council 2/2 to option (b) — three
// responsibility-aligned skills — with fixtures as option (ii): committed
// malformed/clean CONTRACT pairs living in the skill that owns each verdict,
// deliberately NOT registered in src/config/gate-coverage.yml (that manifest
// holds gate scripts and their mutation canaries, never fixture identifiers).
//
// The council was explicit that those pairs must never be called "executable".
// They are documentation-level contract evidence. This file is what keeps them
// honest anyway: it asserts the invariants the pairs encode, so a later edit
// that silently drops a verdict, promotes a `proposed` threshold, or introduces
// a numeric path around the readiness floor fails here rather than in review.
//
// Read-only by construction — it opens tracked files and asserts on their text.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const exists = (rel: string): boolean => fs.existsSync(path.join(ROOT, rel));

const LOGGING = 'src/skills/logging-monitoring/SKILL.md';
const ALERTING = 'src/skills/alerting-doctrine/SKILL.md';
const READINESS = 'src/skills/operational-readiness/SKILL.md';
const HARDENING = 'src/skills/server-hardening/SKILL.md';
const SCALE = 'src/rules/scale-discipline.md';

const SIGNALS = ['Latency', 'Traffic', 'Errors', 'Saturation'] as const;

describe('Phase 2.1 — the four Golden Signals are defined, each exactly once', () => {
    it('logging-monitoring carries exactly four `### Golden Signal:` headings', () => {
        const headings = read(LOGGING).match(/^### Golden Signal: .+$/gm) ?? [];
        expect(headings).toHaveLength(4);
    });

    for (const sig of SIGNALS) {
        it(`defines ${sig} exactly once`, () => {
            const hits = read(LOGGING).match(new RegExp(`^### Golden Signal: ${sig}$`, 'gm')) ?? [];
            expect(hits).toHaveLength(1);
        });
    }

    it('no second skill defines a Golden Signal — one definer, per AC-2', () => {
        const dir = path.join(ROOT, 'src/skills');
        const definers = fs
            .readdirSync(dir)
            .map((d) => path.join('src/skills', d, 'SKILL.md'))
            .filter((rel) => exists(rel))
            .filter((rel) => /^### Golden Signal: /m.test(read(rel)));
        expect(definers).toEqual([LOGGING]);
    });
});

describe('Phase 2.2 — SLI/SLO provenance is a four-value enum, and proposed never renders operational', () => {
    it('all four provenance values are named', () => {
        const body = read(LOGGING);
        for (const v of ['measured', 'committed', 'proposed', 'unknown']) {
            expect(body, `provenance value '${v}' missing`).toMatch(
                new RegExp(`\`${v}\``),
            );
        }
    });

    it('carries the malformed/clean provenance pair with both verdicts', () => {
        const body = read(LOGGING);
        expect(body).toMatch(/invalid-provenance/);
        expect(body).toMatch(/operational:\s*false/);
    });

    it('states no path promoting a proposed threshold to operational', () => {
        // The clean counterpart must keep provenance: proposed AND operational: false.
        expect(read(LOGGING)).toMatch(/provenance:\s*proposed/);
    });
});

describe('Phase 1.3 + 2.3 — missing signals and unavailable signals are verdicts, not silent drops', () => {
    it('carries the missing-signal fixture verdict', () => {
        expect(read(LOGGING)).toMatch(/missing-signal/);
    });

    it('carries the unavailable-without-reason verdict', () => {
        expect(read(LOGGING)).toMatch(/invalid-unavailable-signal/);
    });

    it('keeps `unknown` distinct from affirmatively `unavailable`', () => {
        const body = read(LOGGING);
        expect(body).toMatch(/unavailable/);
        expect(body).toMatch(/unknown/);
    });

    it('pairs every malformed case with a clean counterpart', () => {
        const body = read(LOGGING);
        const malformed = (body.match(/\bmalformed\b/gi) ?? []).length;
        expect(malformed).toBeGreaterThan(0);
        expect(body).toMatch(/clean/i);
    });
});

describe('Phase 3 — alerting doctrine is provider-neutral and a page has three mandatory fields', () => {
    it('the skill exists at the council-named destination', () => {
        expect(exists(ALERTING), `${ALERTING} not found`).toBe(true);
    });

    it('defines all three classes', () => {
        const body = read(ALERTING);
        for (const cls of ['page', 'action', 'info']) {
            expect(body, `class '${cls}' missing`).toMatch(new RegExp(`\`${cls}\``));
        }
    });

    it('carries one malformed/clean pair per mandatory page field', () => {
        const body = read(ALERTING);
        for (const v of ['missing-owner', 'missing-runbook', 'missing-diagnostic-step']) {
            expect(body, `verdict '${v}' missing`).toMatch(new RegExp(v));
        }
        expect(body).toMatch(/valid-page-alert/);
    });

    it('states the wake-a-human criterion as a condition, not a preference', () => {
        // A page must be earned by a stated condition; "prefer"/"consider" alone is not one.
        expect(read(ALERTING)).toMatch(/malformed-alert/);
    });
});

describe('Phase 4.3 — the readiness verdict cannot average a red away', () => {
    it('the skill exists at the council-named destination', () => {
        expect(exists(READINESS), `${READINESS} not found`).toBe(true);
    });

    it('one red yields not-ready', () => {
        expect(read(READINESS)).toMatch(/not-ready/);
    });

    it('defines no numeric aggregation path over the verdict', () => {
        const body = read(READINESS);
        // The forbidden shapes are scores/averages/weights applied to the verdict.
        for (const banned of [
            /\baverage[sd]?\s+the\s+verdict/i,
            /\bweighted\s+score\b/i,
            /\breadiness\s+score\b/i,
            /\bpercent(?:age)?\s+ready\b/i,
        ]) {
            expect(body, `numeric aggregation path present: ${banned}`).not.toMatch(banned);
        }
    });

    it('never treats unknown as green', () => {
        expect(read(READINESS)).toMatch(/unknown/i);
    });
});

describe('Phase 4.1 — finite-resource readiness lands on the existing rule, and it stays a rule', () => {
    it('scale-discipline asks the finite-resource question', () => {
        expect(read(SCALE)).toMatch(/quota|saturation|exhaust/i);
    });

    it('stays under the 200-line rule hard cap', () => {
        expect(read(SCALE).split('\n').length).toBeLessThan(200);
    });

    it('is still a rule — the Iron Law block survives', () => {
        expect(read(SCALE)).toMatch(/^## The Iron Law$/m);
    });
});

describe('Phase 4.2 — host hardening has exactly one owner', () => {
    it('the skill exists', () => {
        expect(exists(HARDENING), `${HARDENING} not found`).toBe(true);
    });

    it('covers ssh posture, a firewall baseline and unattended upgrades', () => {
        const body = read(HARDENING).toLowerCase();
        expect(body).toMatch(/ssh/);
        expect(body).toMatch(/firewall|ufw|nftables/);
        expect(body).toMatch(/unattended|automatic (security )?update/);
    });

    it('is the only owner — no sibling claims the same procedure', () => {
        const dir = path.join(ROOT, 'src/skills');
        const owners = fs
            .readdirSync(dir)
            .map((d) => path.join('src/skills', d, 'SKILL.md'))
            .filter((rel) => exists(rel))
            .filter((rel) => /unattended[ -]upgrade|fail2ban/i.test(read(rel)));
        expect(owners).toEqual([HARDENING]);
    });
});

describe('Phase 1.2 — the specialists stay specialists, untouched', () => {
    it('dashboard-design still names Golden Signals exactly twice and defines none', () => {
        const body = read('src/skills/dashboard-design/SKILL.md');
        expect((body.match(/Golden Signals/g) ?? []).length).toBe(2);
        expect(body).not.toMatch(/^### Golden Signal: /m);
    });

    it('incident-commander keeps its status-page cadence and post-mortem-owner lines', () => {
        const lines = read('src/skills/incident-commander/SKILL.md').split('\n');
        expect(lines).toContain(
            '- **Status page** — update on SEV-1 / SEV-2; on by default unless',
        );
        expect(lines).toContain(
            '- Do NOT close an incident without a post-mortem owner assigned.',
        );
    });

    it('the capability model reaches the specialists by pointer', () => {
        const body = read(LOGGING);
        expect(body).toMatch(/dashboard-design/);
    });
});
