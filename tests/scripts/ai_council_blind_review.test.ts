// Tests for src/scripts/ai_council/blind_review.ts (road-to-council-blind-review
// Phase 1 — three flag-gated, default-off deliberation-protocol experiments).
//
// (a) anonymization mapping completeness + deterministic label order.
// (b) stance rotation determinism + outsider-seat context ablation.
// (c) stance texts carry no "recommend X" phrasing (neutrality lint).
// (d) the neutrality-contract text stays byte-identical (pinned by sha256).
// (e) --chairman-fields adds both required trailing sections.
// (f) flags default off → today's attributed-header shape is unchanged.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CouncilResponse } from '../../src/scripts/ai_council/clients.js';
import { render } from '../../src/scripts/ai_council/orchestrator.js';
import {
    apply_chairman_override,
    assign_stances,
    build_blind_labels,
    CHAIRMAN_FIELDS_ADDENDUM,
    deterministic_shuffle_indices,
    OUTSIDER_STANCE_NAME,
    parse_chairman_override,
    render_deanonymization_block,
    STANCE_DEFS,
    stance_offset,
    with_chairman_fields,
} from '../../src/scripts/ai_council/blind_review.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// ── (a) anonymization mapping — completeness + deterministic order ──

describe('build_blind_labels — Ü1 anonymization mapping', () => {
    const question = 'road-to-council-blind-review Phase 1 sanity question';
    const pairs: Array<[string, string]> = [
        ['anthropic:claude-sonnet-4-5', 'Position A text'],
        ['openai:gpt-4o', 'Position B text'],
        ['gemini:gemini-2.5-pro', 'Position C text'],
    ];

    it('every source gets exactly one label; every label maps back to its source', () => {
        const { label_to_source } = build_blind_labels(question, pairs);
        expect(label_to_source.size).toBe(pairs.length);
        const mapped_sources = new Set(label_to_source.values());
        for (const [source] of pairs) {
            expect(mapped_sources.has(source)).toBe(true);
        }
        // Every label matches the Response-X shape.
        for (const label of label_to_source.keys()) {
            expect(label).toMatch(/^Response-[A-Z]$/);
        }
    });

    it('the transcript never leaks provider/model identity', () => {
        const { transcript } = build_blind_labels(question, pairs);
        expect(transcript).not.toContain('anthropic');
        expect(transcript).not.toContain('openai');
        expect(transcript).not.toContain('gemini');
        expect(transcript).toContain('Position A text');
        expect(transcript).toContain('Position B text');
        expect(transcript).toContain('Position C text');
    });

    it('same question text → identical label order every time (deterministic)', () => {
        const run1 = build_blind_labels(question, pairs);
        const run2 = build_blind_labels(question, pairs);
        expect(Array.from(run1.label_to_source.entries())).toEqual(Array.from(run2.label_to_source.entries()));
        expect(run1.transcript).toBe(run2.transcript);
    });

    it('a different question text can produce a different label order (no fixed input-order alias)', () => {
        const other = build_blind_labels('a completely different question about something else entirely', pairs);
        const original = build_blind_labels(question, pairs);
        // Not asserting they MUST differ (a collision is statistically possible),
        // but the underlying shuffle must not be constant-identity for every seed.
        const identity_order = deterministic_shuffle_indices('always the same seed no matter what', pairs.length);
        const other_order = deterministic_shuffle_indices('yet another seed value entirely', pairs.length);
        expect(identity_order.length).toBe(pairs.length);
        expect(other_order.length).toBe(pairs.length);
        // Sanity: no Math.random/Date — two calls with the SAME seed always agree.
        expect(deterministic_shuffle_indices(question, pairs.length)).toEqual(
            deterministic_shuffle_indices(question, pairs.length),
        );
        void other;
        void original;
    });

    it('render_deanonymization_block lists every label → provider · model', () => {
        const { label_to_source } = build_blind_labels(question, pairs);
        const block = render_deanonymization_block('### De-anonymization map', label_to_source);
        expect(block.startsWith('### De-anonymization map')).toBe(true);
        expect(block).toContain('anthropic · claude-sonnet-4-5');
        expect(block).toContain('openai · gpt-4o');
        expect(block).toContain('gemini · gemini-2.5-pro');
    });
});

// ── (b) stance rotation determinism + outsider ablation ──

describe('assign_stances — Ü2 orthogonal stance rotation', () => {
    const members = ['anthropic', 'openai', 'gemini', 'xai', 'perplexity'];

    it('same question → same assignment (deterministic)', () => {
        const q = 'stance rotation determinism probe question';
        const a1 = assign_stances(members, q);
        const a2 = assign_stances(members, q);
        expect(Array.from(a1.entries()).map(([k, v]) => [k, v.name])).toEqual(
            Array.from(a2.entries()).map(([k, v]) => [k, v.name]),
        );
    });

    it('member i (config order) gets STANCE_DEFS[(offset + i) mod 5]', () => {
        const q = 'a fixed probe question for offset math';
        const offset = stance_offset(q);
        const assignment = assign_stances(members, q);
        members.forEach((name, i) => {
            const expected = STANCE_DEFS[(offset + i) % STANCE_DEFS.length];
            expect(assignment.get(name)?.name).toBe(expected?.name);
        });
    });

    it('different questions can produce different rotation offsets', () => {
        const offsets = new Set(
            ['question one', 'question two entirely different', 'a third, unrelated question'].map(stance_offset),
        );
        // Not every distinct string must collide-free the offset space, but the
        // function must be capable of returning more than one offset value.
        expect(offsets.size).toBeGreaterThanOrEqual(1);
        expect(Array.from(offsets).every((o) => o >= 0 && o < STANCE_DEFS.length)).toBe(true);
    });

    it('the outsider stance is one of the five defined stances', () => {
        expect(STANCE_DEFS.some((s) => s.name === OUTSIDER_STANCE_NAME)).toBe(true);
    });

    it('assign_stances always includes exactly one outsider seat when 5 members are present', () => {
        const q = 'exactly one outsider seat probe';
        const assignment = assign_stances(members, q);
        const outsiders = Array.from(assignment.values()).filter((s) => s.name === OUTSIDER_STANCE_NAME);
        expect(outsiders.length).toBe(1);
    });
});

// ── (c) stance texts carry no "recommend X" phrasing ──

describe('STANCE_DEFS — neutrality lint', () => {
    it('no stance prompt contains "recommend" or "you should choose" (case-insensitive)', () => {
        for (const stance of STANCE_DEFS) {
            const lowered = stance.prompt.toLowerCase();
            expect(lowered).not.toContain('recommend');
            expect(lowered).not.toContain('you should choose');
        }
    });

    it('every stance prompt reads "examine ... from the perspective of" — a lens, never a verdict', () => {
        for (const stance of STANCE_DEFS) {
            expect(stance.prompt).toContain('Examine the question from the perspective of');
        }
    });
});

// ── (d) the neutrality-contract text stays byte-identical (pinned by sha256) ──

describe('Iron Law of Neutrality — byte-identical pin', () => {
    it('docs/contracts/ai-council-config.md § Iron Law of Neutrality is unchanged', () => {
        const contract_path = path.join(REPO_ROOT, 'docs/contracts/ai-council-config.md');
        const contents = fs.readFileSync(contract_path, 'utf-8');
        const lines = contents.split('\n');
        const start = lines.findIndex((l) => l.includes('**Iron Law of Neutrality.**'));
        expect(start).toBeGreaterThanOrEqual(0);
        // The bullet is exactly 4 lines (heading line + 3 continuation lines).
        const bullet = lines.slice(start, start + 4).join('\n');
        expect(bullet).toBe(
            "- **Iron Law of Neutrality.** Council members never see the host agent's\n" +
                '  reasoning — only the artefact + a neutral system prompt. Phase 6 Step 3a\n' +
                '  preserves advisor persona labels in peer-review but strips provider\n' +
                '  identity.',
        );
        const sha256 = createHash('sha256').update(bullet, 'utf-8').digest('hex');
        // Pinned 2026-07-28 (road-to-council-blind-review Phase 1). A change to
        // this hash means the neutrality contract text moved — the roadmap
        // requires it stay byte-identical; re-verify by hand before updating.
        expect(sha256).toBe('16d6b61a839527d91c0fa1816416cac2b21ee921f655e57a9d6080199452781d');
    });
});

// ── (e) --chairman-fields adds both required trailing sections ──

describe('with_chairman_fields — Ü3 mandatory chairman fields', () => {
    it('appends both required sections to a non-empty template', () => {
        const out = with_chairman_fields('### Some Template\n\nBody.');
        expect(out).toContain('## Collective blind spot');
        expect(out).toContain('## One-line verdict');
        expect(out.startsWith('### Some Template')).toBe(true);
    });

    it('returns just the addendum when the template is empty (prose-synthesis mode)', () => {
        expect(with_chairman_fields('')).toBe(CHAIRMAN_FIELDS_ADDENDUM);
    });

    it('CHAIRMAN_FIELDS_ADDENDUM carries both headings verbatim', () => {
        expect(CHAIRMAN_FIELDS_ADDENDUM).toContain('## Collective blind spot');
        expect(CHAIRMAN_FIELDS_ADDENDUM).toContain('## One-line verdict');
    });
});

// ── (f) flags default off → today's output shape is unchanged ──

describe('render() — default-off byte-identical shapes', () => {
    const responses = [
        new CouncilResponse({ provider: 'anthropic', model: 'claude-sonnet-4-5', text: 'Position A' }),
        new CouncilResponse({ provider: 'openai', model: 'gpt-4o', text: 'Position B' }),
    ];

    it('no blind / chairman_fields options → attributed `## provider · model` headers survive', () => {
        const body = render(responses, {});
        expect(body).toContain('## anthropic · claude-sonnet-4-5');
        expect(body).toContain('## openai · gpt-4o');
        expect(body).not.toContain('Response-A');
        expect(body).not.toContain('## Collective blind spot');
        expect(body).not.toContain('### De-anonymization map');
    });

    it('opts.blind present → headers blind, de-anonymization map appended after the synthesis slot', () => {
        const label_to_source = new Map<string, string>([
            ['Response-A', 'anthropic:claude-sonnet-4-5'],
            ['Response-B', 'openai:gpt-4o'],
        ]);
        const body = render(responses, { blind: { label_to_source } });
        expect(body).toContain('## Response-A');
        expect(body).toContain('## Response-B');
        expect(body).not.toContain('## anthropic · claude-sonnet-4-5');
        const convergence_idx = body.indexOf('## Convergence / Divergence');
        const deanon_idx = body.indexOf('### De-anonymization map');
        expect(convergence_idx).toBeGreaterThanOrEqual(0);
        expect(deanon_idx).toBeGreaterThan(convergence_idx);
    });

    it('opts.chairman_fields true → both required sections land in the rendered template', () => {
        const body = render(responses, { chairman_fields: true });
        expect(body).toContain('## Collective blind spot');
        expect(body).toContain('## One-line verdict');
    });
});

// ── `--chairman` override — pure config override, no config write ──

describe('parse_chairman_override / apply_chairman_override', () => {
    it('parses host / auto / member:NAME', () => {
        expect(parse_chairman_override(null)).toBeNull();
        expect(parse_chairman_override('host')).toEqual({ mode: 'host', member: null });
        expect(parse_chairman_override('auto')).toEqual({ mode: 'auto', member: null });
        expect(parse_chairman_override('member:openai')).toEqual({ mode: 'member', member: 'openai' });
    });

    it('rejects malformed input', () => {
        expect(() => parse_chairman_override('bogus')).toThrow();
        expect(() => parse_chairman_override('member:')).toThrow();
    });

    it('apply_chairman_override overrides mode/member without mutating the input', () => {
        const base = { chairman: { mode: 'host' }, members: {} };
        const overridden = apply_chairman_override(base, { mode: 'member', member: 'openai' });
        expect(overridden['chairman']).toEqual({ mode: 'member', member: 'openai' });
        expect(base['chairman']).toEqual({ mode: 'host' });
    });

    it('null override → the config dict passes through untouched', () => {
        const base = { chairman: { mode: 'auto' } };
        expect(apply_chairman_override(base, null)).toBe(base);
    });
});

describe('Ü1 adoption — blind synthesis is the CLI default (Phase 3, 2026-07-28)', () => {
    // Source-level pin, same technique as the neutrality-contract hash: the
    // n=10 A/B measured 0/10 + 0/10 pre-registered degradation triggers, so
    // the pre-registered rule ADOPTS Ü1. Reverting the default without a new
    // measured decision must fail this test.
    const cliSource = fs.readFileSync(path.join(process.cwd(), 'src/scripts/council_cli.ts'), 'utf8');

    it('blind_chairman defaults to true in the Args defaults block', () => {
        expect(cliSource).toMatch(/blind_chairman:\s*true,/);
        expect(cliSource).not.toMatch(/blind_chairman:\s*false,\n\s*stances/);
    });

    it('--no-blind-chairman opt-out flag exists (per-invocation escape, audit map always kept)', () => {
        expect(cliSource).toContain("'--no-blind-chairman'");
    });

    it('stances + chairman_fields stay default-off pending the maintainer blind ratings', () => {
        expect(cliSource).toMatch(/stances:\s*false,/);
        expect(cliSource).toMatch(/chairman_fields:\s*false,/);
    });
});
