// Tests for src/scripts/ai_council/replay.ts (py2ts Phase 1).
//
// replay is a pure projection: it renders a `decision-replay.md` body from
// consensus findings / scores / metadata + per-member deliberation texts.
// No CLI, no network.
import { describe, expect, it } from 'vitest';

import { CouncilResponse } from '../../../src/scripts/ai_council/clients.js';
import {
    ConsensusMetadata,
    Finding,
    FindingScore,
} from '../../../src/scripts/ai_council/consensus.js';
import {
    DecisionReplayInputs,
    render_decision_replay,
} from '../../../src/scripts/ai_council/replay.js';

// ── Shared fixture ───────────────────────────────────────────────────────
// A single declarative spec consumed identically by both runtimes.

interface Spec {
    findings: Array<{ id: string; source: string; text: string }>;
    scores: Array<{
        finding_id: string;
        scorer: string;
        score: number;
        agree: boolean;
        reason: string;
    }>;
    metadata: Array<{
        finding_id: string;
        consensus_strength: number;
        dissent_count: number;
        scorers: string[];
        mean_score: number;
        concur_count: number;
        dissent_reasons: Array<[string, string]>;
        evidence_quality: string;
    }>;
    deliberation: Array<{ provider: string; model: string; text: string }>;
    original_ask: string;
    include_member_arguments: boolean;
}

function buildTsInputs(spec: Spec): DecisionReplayInputs {
    const findings = spec.findings.map((f) => new Finding(f.id, f.source, f.text));
    const scores = spec.scores.map(
        (s) => new FindingScore(s.finding_id, s.scorer, s.score, s.agree, s.reason),
    );
    const metadata = new Map<string, ConsensusMetadata>();
    for (const m of spec.metadata) {
        metadata.set(
            m.finding_id,
            new ConsensusMetadata({
                finding_id: m.finding_id,
                consensus_strength: m.consensus_strength,
                dissent_count: m.dissent_count,
                scorers: m.scorers,
                mean_score: m.mean_score,
                concur_count: m.concur_count,
                dissent_reasons: m.dissent_reasons,
                evidence_quality: m.evidence_quality,
            }),
        );
    }
    const deliberation = spec.deliberation.map(
        (d) => new CouncilResponse({ provider: d.provider, model: d.model, text: d.text }),
    );
    return new DecisionReplayInputs({
        findings,
        scores,
        metadata,
        deliberation,
        original_ask: spec.original_ask,
        include_member_arguments: spec.include_member_arguments,
    });
}

// Three findings with distinct consensus strengths (test the rank order),
// dissent reasons, a long-text title (truncation), whitespace collapsing,
// and a member whose argument falls back to the deliberation snippet.
const FULL_SPEC: Spec = {
    findings: [
        { id: 'F2', source: 'openai/gpt-4o', text: '  weak    finding   with\n\nmessy   whitespace  ' },
        { id: 'F1', source: 'anthropic/claude', text: 'x'.repeat(140) }, // > 120 → truncated
        { id: 'F3', source: 'openai/gpt-4o', text: 'moderate finding' },
        { id: 'F4', source: 'anthropic/claude', text: 'unscored finding (no metadata entry)' },
    ],
    scores: [
        { finding_id: 'F1', scorer: 'm2', score: 9, agree: true, reason: 'strong agree reason' },
        { finding_id: 'F1', scorer: 'm3', score: 4, agree: false, reason: 'dissent reason here' },
        { finding_id: 'F3', scorer: 'm2', score: 7, agree: true, reason: '' }, // empty reason → snippet fallback
        { finding_id: 'F2', scorer: 'm3', score: 3, agree: false, reason: 'weak dissent' },
    ],
    metadata: [
        {
            finding_id: 'F1',
            consensus_strength: 0.85,
            dissent_count: 1,
            scorers: ['m2', 'm3'],
            mean_score: 6.5,
            concur_count: 1,
            dissent_reasons: [['m3', 'dissent reason here']],
            evidence_quality: 'M',
        },
        {
            finding_id: 'F2',
            consensus_strength: 0.2,
            dissent_count: 1,
            scorers: ['m3'],
            mean_score: 3.0,
            concur_count: 0,
            dissent_reasons: [['m3', 'weak dissent']],
            evidence_quality: 'L',
        },
        {
            finding_id: 'F3',
            consensus_strength: 0.55,
            dissent_count: 0,
            scorers: ['m2'],
            mean_score: 7.0,
            concur_count: 1,
            dissent_reasons: [],
            evidence_quality: 'M',
        },
    ],
    deliberation: [
        { provider: 'm2', model: '', text: 'm2 deliberation snippet that is the fallback argument' },
        { provider: 'm3', model: '', text: 'm3 deliberation text' },
    ],
    original_ask: '   Should we adopt   the new\n\narchitecture?   ',
    include_member_arguments: true,
};

const REDACTED_SPEC: Spec = {
    ...FULL_SPEC,
    include_member_arguments: false,
};

const EMPTY_SPEC: Spec = {
    findings: [],
    scores: [],
    metadata: [],
    deliberation: [],
    original_ask: '',
    include_member_arguments: true,
};

// ── Unit tests (pure logic) ──────────────────────────────────────────────

describe('replay — render structural unit', () => {
    it('empty findings renders the placeholder + trailing newline', () => {
        const out = render_decision_replay(buildTsInputs(EMPTY_SPEC));
        expect(out).toBe(
            '# Decision Replay\n\n*No findings were extracted for this session.*\n',
        );
    });

    it('ranks findings by consensus_strength descending', () => {
        const out = render_decision_replay(buildTsInputs(FULL_SPEC));
        const idxF1 = out.indexOf('## F1 —');
        const idxF3 = out.indexOf('## F3 —');
        const idxF2 = out.indexOf('## F2 —');
        const idxF4 = out.indexOf('## F4 —'); // no metadata → strength 0.0, last
        expect(idxF1).toBeGreaterThanOrEqual(0);
        expect(idxF1).toBeLessThan(idxF3);
        expect(idxF3).toBeLessThan(idxF2);
        expect(idxF2).toBeLessThan(idxF4);
    });

    it('collapses whitespace in the original ask blockquote', () => {
        const out = render_decision_replay(buildTsInputs(FULL_SPEC));
        expect(out).toContain('> Should we adopt the new architecture?\n');
    });

    it('truncates a >120-char finding title with an ellipsis', () => {
        const out = render_decision_replay(buildTsInputs(FULL_SPEC));
        expect(out).toContain('## F1 — ' + 'x'.repeat(119) + '…');
    });

    it('redacted mode omits member arguments + sets footer label', () => {
        const out = render_decision_replay(buildTsInputs(REDACTED_SPEC));
        expect(out).not.toContain('**Agreeing members**');
        expect(out).not.toContain('**Dissenting members**');
        expect(out).toContain('_artefact mode: redacted (counts only)_');
    });

    it('full mode includes the footer label + synthesis verdict', () => {
        const out = render_decision_replay(buildTsInputs(FULL_SPEC));
        expect(out).toContain('_artefact mode: full_');
        expect(out).toContain('**Synthesis verdict**: Strong consensus — anthropic/claude sourced.');
    });

    it('empty-reason scorer with no matching deliberation key → "no argument captured"', () => {
        const out = render_decision_replay(buildTsInputs(FULL_SPEC));
        // F3 / m2 has an empty reason. member_texts is keyed by
        // `provider:model` ("m2:"), so the bare scorer name "m2" misses the
        // lookup → empty snippet → the captured-fallback sentinel (matches
        // the Python twin exactly).
        expect(out).toContain('_m2_ — no argument captured');
    });

    it('consensus float formatting uses :.2f / :.1f', () => {
        const out = render_decision_replay(buildTsInputs(FULL_SPEC));
        expect(out).toContain('**Consensus**: Strong (0.85)');
        expect(out).toContain('(mean 6.5/10)');
    });

    it('empty-reason scorer DOES fall back to snippet when keyed provider:model', () => {
        // Scorer id matches the deliberation key (`provider:model`), so the
        // snippet lookup hits and the collapsed text is used as the argument.
        const spec: Spec = {
            findings: [{ id: 'F1', source: 's/m', text: 'a finding' }],
            scores: [{ finding_id: 'F1', scorer: 'prov:model-1', score: 8, agree: true, reason: '' }],
            metadata: [
                {
                    finding_id: 'F1',
                    consensus_strength: 0.9,
                    dissent_count: 0,
                    scorers: ['prov:model-1'],
                    mean_score: 8.0,
                    concur_count: 1,
                    dissent_reasons: [],
                    evidence_quality: 'H',
                },
            ],
            deliberation: [{ provider: 'prov', model: 'model-1', text: '  some   raw   snippet  ' }],
            original_ask: '',
            include_member_arguments: true,
        };
        const out = render_decision_replay(buildTsInputs(spec));
        expect(out).toContain('_prov:model-1_ — some raw snippet');
    });
});
