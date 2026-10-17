/**
 * analysis_emit.ts — turns a round's surviving findings into what lands
 * locally: owner-first arrivals on existing roadmaps, and at most one new
 * central roadmap with every other finding as a phase.
 *
 * Owner-first is the growth cap: a finding whose subject already has a
 * roadmap becomes a step plus an `Arrivals:` line there, so a round adds at
 * most one file to the estate. New roadmaps land `ready`, except above the
 * harvest intake limit, where they land `draft` and the run says so in one
 * line. Nothing here validates or writes; `analysis_validate.ts` gates the
 * result before anything leaves the machine.
 */
import type { EvidenceTier } from './analysis_ledger.js';

/** More `ready` roadmaps than this at 0 ticked steps make a new roadmap land `draft`. */
export const INTAKE_LIMIT = 8;

export interface FindingStep {
    text: string;
    verify: string;
}

export interface Finding {
    id: string;
    title: string;
    claim: string;
    anchor: string;
    tier: EvidenceTier;
    steps: FindingStep[];
    /** Slug (without `road-to-`) of the roadmap that already owns the subject. */
    owner?: string;
    blocked_until?: string;
}

export interface EmittedRoadmap {
    slug: string;
    status: 'ready' | 'draft';
    body: string;
}

export interface Arrival {
    slug: string;
    finding_id: string;
    step: string;
    arrivals_line: string;
}

export interface EmitResult {
    roadmaps: EmittedRoadmap[];
    arrivals: Arrival[];
    estate_delta: number;
    status_note: string | null;
}

export interface EmitInput {
    roundId: string;
    date: string;
    slug: string;
    findings: readonly Finding[];
    readyAtZero: number;
    intakeLimit?: number;
}

function stepLines(n: string, step: FindingStep): string {
    return `- [ ] **${n} ${step.text}.**\n      verify: ${step.verify}`;
}

function phaseHeading(i: number, f: Finding): string {
    return `Phase ${String(i + 1)} — ${f.title}`;
}

function roadmapBody(input: EmitInput, findings: readonly Finding[], status: 'ready' | 'draft'): string {
    const phases = findings.map((f, i) => {
        const steps = f.steps.map((s, k) => stepLines(`${String(i + 1)}.${String(k + 1)}`, s)).join('\n');
        const blocked = f.blocked_until === undefined ? '' : `> Blocked until ${f.blocked_until}.\n\n`;
        return `## ${phaseHeading(i, f)}\n\n${f.claim} Evidence (${f.tier}): \`${f.anchor}\`.\n\n${blocked}${steps}\n`;
    });
    const risks = findings.map(
        (f, i) =>
            `| ${String(i + 1)} | ${f.title} not delivered | implementation | The claim at \`${f.anchor}\` still holds after the phase | each step carries its \`verify:\` line | ${phaseHeading(i, f)} |`,
    );
    const acs = findings.map(
        (f, i) => `- [ ] AC-${String(i + 1)} — ${f.title}: the claim of Phase ${String(i + 1)} no longer holds at the tree.`,
    );
    return [
        '---',
        'complexity: lightweight',
        `status: ${status}`,
        'execution:',
        '  mode: phase-checkpoints',
        '---',
        `# Road to ${input.slug.replace(/-/g, ' ')}`,
        '',
        `> **Source:** analysis round \`${input.roundId}\` (${input.date}).`,
        '',
        '## Goal',
        '',
        `Every finding of round \`${input.roundId}\` below is resolved against the tree.`,
        '',
        ...phases,
        '## Risk Register',
        `<!-- risk-review: v1 | reviewed: ${input.date} | reviewer: claude/host -->`,
        '',
        '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
        '|------|------|-----------|-------------|------------|----------------|',
        ...risks,
        '',
        '## Acceptance Criteria',
        '',
        ...acs,
        '',
    ].join('\n');
}

export function emitRound(input: EmitInput): EmitResult {
    const limit = input.intakeLimit ?? INTAKE_LIMIT;
    const owned = input.findings.filter((f) => f.owner !== undefined);
    const fresh = input.findings.filter((f) => f.owner === undefined);

    const arrivals = owned.map((f) => ({
        slug: f.owner as string,
        finding_id: f.id,
        step: f.steps.map((s, k) => stepLines(`N.${String(k + 1)}`, s)).join('\n'),
        arrivals_line: `> **Arrivals:** latest \`${input.roundId}\` (${input.date}) — ${f.id}`,
    }));

    if (fresh.length === 0) return { roadmaps: [], arrivals, estate_delta: 0, status_note: null };

    const draft = input.readyAtZero > limit;
    const status = draft ? 'draft' : 'ready';
    const status_note = draft
        ? `draft: ${String(input.readyAtZero)} ready roadmaps sit at 0 ticked steps, above the intake limit of ${String(limit)}`
        : null;
    return {
        roadmaps: [{ slug: input.slug, status, body: roadmapBody(input, fresh, status) }],
        arrivals,
        estate_delta: 1,
        status_note,
    };
}
