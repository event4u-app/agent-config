// Phase 1B — inline findings, analysis lens only.
//
// The step replaces the SECOND (extraction) call of the consensus round with a
// findings block the member already wrote into its analysis reply. What is
// under test is therefore not "can we parse JSON" — `consensus.ts` already
// could — but the properties the phase and the AI council named:
//
//   1B.1  a reply carrying the block parses inline and issues NO second call
//   1B.2  a reply without a usable block still yields findings, via the
//         extraction call that is kept, and never costs more than today
//   1B.3  the contract reaches the analysis lens only; every other lens'
//         prompt is byte-unchanged
//
// plus the three the council (2026-08-30, 2 of 2 seats) made conditions of its
// verdict: the consumed block is stripped from what peer review and synthesis
// read; the SAME span is parsed and removed; and the repair path still sees the
// raw reply.
//
// Transport is stubbed the way `orchestrator.test.ts` stubs it — a subclass of
// `ExternalAIClient` whose `ask()` returns a canned response and COUNTS its
// calls, because the call count is the measurement 1B.1 rests on.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { synthesizeAiCouncilBlock } from '../../../src/scripts/_lib/council_settings_block.js';
import { load_council_config } from '../../../src/scripts/ai_council/config.js';
import {
    harvest_inline_findings,
    inlineFindingsActive,
    split_inline_findings,
} from '../../../src/scripts/ai_council/inline_findings.js';
import {
    consult,
    CouncilQuestion,
    run_consensus_scoring,
} from '../../../src/scripts/ai_council/orchestrator.js';
import {
    all_modes,
    ANALYSIS_MODE,
    INLINE_FINDINGS_CONTRACT,
    system_prompt_for,
} from '../../../src/scripts/ai_council/prompts.js';

/** Counts `ask()` calls and replays a scripted list — the call count IS the test. */
class Counting extends ExternalAIClient {
    calls = 0;
    prompts: string[] = [];
    constructor(
        name: string,
        model: string,
        private readonly script: readonly string[],
    ) {
        super();
        this.name = name;
        this.model = model;
        this.billable = false;
        this.transport = 'manual';
    }
    override ask(_system: string, user: string): CouncilResponse {
        this.prompts.push(user);
        const text = this.script[Math.min(this.calls, this.script.length - 1)] ?? '';
        this.calls += 1;
        return new CouncilResponse({ provider: this.name, model: this.model, text, latency_ms: 1 });
    }
}

const FINDINGS_JSON = '```json\n[{"id":"leaky-abstraction","text":"The audit conflates two layers."}]\n```';

/** A realistic analysis reply: prose, then the contract's trailing block. */
const analysisReply = (body: string, block = FINDINGS_JSON): string => `${body}\n\n${block}`;

const delib = (provider: string, model: string, text: string): CouncilResponse =>
    new CouncilResponse({ provider, model, text });

/** The production sequence: harvest first, then score. */
const harvestThenScore = (
    m: Counting,
    responses: CouncilResponse[],
): ReturnType<typeof run_consensus_scoring> => {
    const inline = harvest_inline_findings([m as never], responses);
    return run_consensus_scoring([m as never], responses, { inline_extractions: inline });
};

describe('1B.1 — a reply carrying the block parses inline, with no second call', () => {
    it('block present → parsed-inline, 1 finding, and the member is never re-asked for it', () => {
        // The scripted answer would produce a DIFFERENT finding id. If the extraction
        // call were issued, that id is what would land — so the assertion on the id is
        // simultaneously the assertion that no second call happened, and it fails
        // loudly rather than silently if the short-circuit is removed.
        const m = new Counting('anthropic', 'c', ['[{"id":"from-extraction","text":"second call"}]']);
        const r = harvestThenScore(m, [delib('anthropic', 'c', analysisReply('A prose analysis.'))]);
        expect(r.parse_outcomes.get('anthropic:c')).toBe('parsed-inline');
        expect(r.findings.map((f) => f.id)).toEqual(['leaky-abstraction']);
        // With a single member there is nothing to score, so a correct run makes ZERO
        // calls. Any call at all is the extraction pass firing when it should not.
        expect(m.calls).toBe(0);
        expect(r.extraction_responses).toEqual([]);
    });

    it('the same reply WITHOUT the harvest costs a call and records the old outcome — the control arm', () => {
        // Without this arm the test above proves only that SOMETHING produced a
        // finding. This pins that the saving is caused by the harvest.
        const m = new Counting('anthropic', 'c', ['[{"id":"from-extraction","text":"second call"}]']);
        const r = run_consensus_scoring([m as never], [delib('anthropic', 'c', analysisReply('A prose analysis.'))]);
        expect(r.parse_outcomes.get('anthropic:c')).toBe('parsed');
        expect(r.findings.map((f) => f.id)).toEqual(['from-extraction']);
        expect(m.calls).toBe(1);
    });

    it('an empty array inline is a RESULT, not a failure — no repair call is bought', () => {
        const m = new Counting('anthropic', 'c', ['[{"id":"never","text":"reached"}]']);
        const r = harvestThenScore(m, [delib('anthropic', 'c', 'Nothing wrong here.\n\n```json\n[]\n```')]);
        expect(r.parse_outcomes.get('anthropic:c')).toBe('parsed-inline');
        expect(r.findings).toEqual([]);
        expect(m.calls).toBe(0);
    });
});

describe('1B.2 — the repair path survives, and never costs more than today', () => {
    it('no block at all → the extraction call still yields findings', () => {
        const m = new Counting('anthropic', 'c', ['[{"id":"repaired","text":"from extraction"}]']);
        const r = harvestThenScore(m, [delib('anthropic', 'c', 'Prose only. No block anywhere in this reply.')]);
        expect(r.findings.map((f) => f.id)).toEqual(['repaired']);
        expect(r.parse_outcomes.get('anthropic:c')).toBe('parsed');
        expect(m.calls).toBe(1);
    });

    it('a MANGLED block falls through to extraction rather than yielding garbage', () => {
        const m = new Counting('anthropic', 'c', ['[{"id":"repaired","text":"from extraction"}]']);
        // Array-shaped enough to be located, not valid enough to parse.
        const r = harvestThenScore(m, [
            delib('anthropic', 'c', 'Prose.\n\n```json\n[{"id": "broken", "text":]\n```'),
        ]);
        expect(r.findings.map((f) => f.id)).toEqual(['repaired']);
        expect(m.calls).toBe(1);
    });

    it('the repair call sees the RAW reply — an unparsed block is never stripped', () => {
        // The council made this a condition: stripping text we could not read would
        // remove evidence from the very prompt that has to recover from it.
        const raw = 'Prose.\n\n```json\n[{"id": "broken", "text":]\n```';
        const m = new Counting('anthropic', 'c', ['[{"id":"repaired","text":"x"}]']);
        const responses = [delib('anthropic', 'c', raw)];
        harvest_inline_findings([m as never], responses);
        expect(responses[0]?.text).toBe(raw);
    });

    it('worst case with the harvest equals worst case without it — one extraction plus one bounded re-ask', () => {
        // The bound is the claim: 1B may not turn one unreadable reply into more spend
        // than the shipped path already permits.
        const script = ['not json at all', '[{"id":"f1","text":"after the re-ask"}]'];
        const on = new Counting('anthropic', 'c', script);
        const off = new Counting('anthropic', 'c', script);
        const rOn = harvestThenScore(on, [delib('anthropic', 'c', 'Prose only, no block.')]);
        const rOff = run_consensus_scoring([off as never], [delib('anthropic', 'c', 'Prose only, no block.')]);
        expect(on.calls).toBe(off.calls);
        expect(rOn.parse_outcomes.get('anthropic:c')).toBe(rOff.parse_outcomes.get('anthropic:c'));
        expect(rOn.parse_outcomes.get('anthropic:c')).toBe('parsed-after-reask');
    });
});

describe('the consumed block is stripped from what peer review and synthesis read', () => {
    it('a harvested reply loses the JSON and gains an observable marker', () => {
        const m = new Counting('anthropic', 'c', ['unused']);
        const responses = [delib('anthropic', 'c', analysisReply('The audit conflates two layers.'))];
        harvest_inline_findings([m as never], responses);
        const text = responses[0]?.text ?? '';
        expect(text).toContain('The audit conflates two layers.');
        expect(text).not.toContain('leaky-abstraction');
        expect(text).not.toContain('```json');
        // Observable, not silent: one seat made a visible marker a condition of its
        // verdict, and the other reached the same concern from auditability. A reader
        // of the artefact must be able to tell that something was removed.
        expect(text).toContain('inline findings block extracted: 1 item(s)');
    });

    it('an error or empty response is never touched', () => {
        const m = new Counting('anthropic', 'c', ['unused']);
        const errored = new CouncilResponse({ provider: 'anthropic', model: 'c', text: FINDINGS_JSON, error: 'boom' });
        const blank = new CouncilResponse({ provider: 'anthropic', model: 'c', text: '   ' });
        const got = harvest_inline_findings([m as never], [errored, blank]);
        expect(got.size).toBe(0);
        expect(errored.text).toBe(FINDINGS_JSON);
        expect(blank.text).toBe('   ');
    });

    it('a member the roster does not know is skipped rather than keyed under a guess', () => {
        const m = new Counting('anthropic', 'c', ['unused']);
        const responses = [delib('gemini', 'g', analysisReply('body'))];
        expect(harvest_inline_findings([m as never], responses).size).toBe(0);
        expect(responses[0]?.text).toContain('```json');
    });
});

describe('1B.1 — the contract rides the FINAL round, and OFF is byte-identical', () => {
    const q = (): CouncilQuestion => new CouncilQuestion({ mode: 'analysis', user_prompt: 'Critique this.' });

    it('inline on → the final round carries the contract; earlier rounds do not', () => {
        const a = new Counting('anthropic', 'm', ['round one', analysisReply('round two')]);
        const b = new Counting('openai', 'm', ['round one', analysisReply('round two')]);
        consult([a, b], q(), null, { rounds: 2, inline_findings: true });
        expect(a.prompts).toHaveLength(2);
        expect(a.prompts[0]).not.toContain(INLINE_FINDINGS_CONTRACT);
        expect(a.prompts[1]).toContain(INLINE_FINDINGS_CONTRACT);
    });

    it('inline off → the prompt is byte-identical to the bare question', () => {
        const a = new Counting('anthropic', 'm', ['reply']);
        consult([a], q(), null, {});
        expect(a.prompts[0]).toBe('Critique this.');
    });

    it('inline on + stance tally on → the STANCE line is still LAST', () => {
        // One unambiguous grammar, which the council asked for explicitly: the stance
        // contract demands the stance be the final line of the reply, so a findings
        // block appended after it would contradict the instruction the member reads.
        const a = new Counting('anthropic', 'm', ['reply']);
        consult([a], q(), null, { inline_findings: true, stance_tally: true });
        const p = a.prompts[0] ?? '';
        expect(p.indexOf(INLINE_FINDINGS_CONTRACT)).toBeGreaterThan(-1);
        expect(p.indexOf('STANCE: <option-label>')).toBeGreaterThan(p.indexOf(INLINE_FINDINGS_CONTRACT));
    });
});

describe('1B.3 — analysis lens only', () => {
    it('no lens system prompt is touched by this phase', () => {
        // The contract is appended to the USER prompt by `consult`, gated by a flag the
        // CLI only sets for a lens in `consensus_scoring.lenses`. Nothing this phase
        // adds touches a system prompt — asserted rather than assumed, because a
        // future edit folding the contract into `ANALYSIS_MODE` would leak it into the
        // lens table for every mode and would be invisible otherwise.
        //
        // `all_modes()` rather than a literal list: a lens added later is then covered
        // without anyone remembering to add it here.
        expect(all_modes().length).toBeGreaterThan(1);
        for (const mode of all_modes()) {
            expect(system_prompt_for(mode), `${mode} system prompt`).not.toContain(INLINE_FINDINGS_CONTRACT);
        }
        // And the analysis lens body itself is untouched — the contract is an additive
        // suffix, never a rewrite of the lens.
        expect(system_prompt_for('analysis')).toContain(ANALYSIS_MODE);
    });

    it('the contract never appears when the flag is off, whatever the lens', () => {
        for (const mode of ['analysis', 'prompt', 'roadmap']) {
            const a = new Counting('anthropic', 'm', ['reply']);
            consult([a], new CouncilQuestion({ mode, user_prompt: 'X' }), null, {});
            expect(a.prompts[0], mode).toBe('X');
        }
    });
});

describe('split_inline_findings — one locator produces both halves', () => {
    it('reads the LAST block, so a quoted array in the prose does not win', () => {
        // This is the defect the locator exists for. `_extract_json_array` returns the
        // FIRST match, which is right for an extraction reply (the reply IS the array)
        // and wrong for an analysis reply — the analysis lens critiques analyser
        // OUTPUT, so a quoted JSON array above the block is ordinary, not exotic.
        const text = [
            'The analyser emitted:',
            '```json',
            '[{"id":"quoted-from-the-artefact","text":"not my finding"}]',
            '```',
            'which conflates two layers. My findings:',
            FINDINGS_JSON,
        ].join('\n');
        const split = split_inline_findings(text);
        expect(split.found).toBe(true);
        expect(split.block).toContain('leaky-abstraction');
        // The quoted array survives the strip — it is the member's evidence, not its
        // findings block, and removing it would delete argument.
        expect(split.deliberation_text).toContain('quoted-from-the-artefact');
        expect(split.deliberation_text).not.toContain('leaky-abstraction');
    });

    it('the end-to-end path picks the trailing block too, not just the locator in isolation', () => {
        const m = new Counting('anthropic', 'c', ['[{"id":"unused","text":"x"}]']);
        const text = `Prose.\n\n\`\`\`json\n[{"id":"quoted","text":"artefact"}]\n\`\`\`\n\nMine:\n${FINDINGS_JSON}`;
        const r = harvestThenScore(m, [delib('anthropic', 'c', text)]);
        expect(r.findings.map((f) => f.id)).toEqual(['leaky-abstraction']);
    });

    it('parsed span and removed span are the same span', () => {
        // The council's other condition: an independent stripping regex could disagree
        // with the parser about what was consumed. One locator makes that impossible,
        // and this is the assertion that keeps it that way.
        const text = analysisReply('Body.');
        const split = split_inline_findings(text);
        expect(`${split.deliberation_text.slice(0, text.indexOf(split.block))}${split.block}${text.slice(text.indexOf(split.block) + split.block.length)}`).toBe(text);
    });

    it('a bare array is found when no fenced block is present', () => {
        const split = split_inline_findings('Prose.\n\n[{"id":"bare","text":"unfenced"}]');
        expect(split.found).toBe(true);
        expect(split.block).toContain('bare');
        expect(split.deliberation_text.trim()).toBe('Prose.');
    });

    it('fenced beats bare at the same position, matching _extract_json_array precedence', () => {
        const text = '[{"id":"bare-first","text":"a"}]\n\n```json\n[{"id":"fenced-later","text":"b"}]\n```';
        expect(split_inline_findings(text).block).toContain('fenced-later');
    });

    it('no array anywhere → found:false and the text is returned untouched', () => {
        const split = split_inline_findings('nothing array-shaped here');
        expect(split.found).toBe(false);
        expect(split.deliberation_text).toBe('nothing array-shaped here');
        expect(split.block).toBe('');
    });

    it('an empty string is not a block', () => {
        expect(split_inline_findings('').found).toBe(false);
    });
});

describe('the harvest runs BEFORE peer review and synthesis read the responses', () => {
    // The defect the AI council caught (2026-08-30): `_maybe_run_peer_review` and the
    // chairman synthesis consume `responses` before the consensus round does, so
    // parsing the block inside `run_consensus_scoring` would have left the schema
    // block in the very text those two evaluate — the amplification the strip exists
    // to prevent.
    //
    // Pinned by source ORDER rather than by execution, and the limit is stated rather
    // than implied: `cmd_run` is a single ~400-line function that builds a live
    // roster, so driving it here would be a rewrite of the CLI's seams, not a test.
    // A source-order assertion is weaker — it cannot see a call moved into a helper —
    // but it fails on the exact edit that reintroduced the defect, which nothing else
    // in this file does.
    const cli = fs.readFileSync(
        path.resolve(__dirname, '../../../src/scripts/council_cli.ts'),
        'utf-8',
    );

    it('harvest_inline_findings is invoked before _maybe_run_peer_review in cmd_run', () => {
        const harvest = cli.indexOf('harvest_inline_findings(members, responses)');
        const peer = cli.indexOf('const peer_review = _maybe_run_peer_review(');
        const consensus = cli.indexOf('const consensus = _maybe_run_consensus(');
        expect(harvest, 'harvest call site not found').toBeGreaterThan(-1);
        expect(peer, 'peer-review call site not found').toBeGreaterThan(-1);
        expect(consensus, 'consensus call site not found').toBeGreaterThan(-1);
        expect(harvest).toBeLessThan(peer);
        expect(peer).toBeLessThan(consensus);
    });

    it('the consensus round is handed the harvested map, not a flag it would act on too late', () => {
        // `inline_findings: inlineFindingsActive(...)` is CORRECT on the `consult`
        // call — that is the prompt-side flag, and it has to be read before the
        // deliberation. What must not come back is the consensus round computing it
        // for itself, which is what put the parse downstream of peer review.
        expect(cli).toContain('run_consensus_scoring(members, responses, {\n        inline_extractions,');
    });
});

describe('the config key survives the projection and gates on all three conjuncts', () => {
    // This block exists because a LIVE analysis run on 2026-08-30 found the feature
    // silently off with every unit test green. `inlineFindingsActive` reads the
    // SYNTHESISED settings dict, not the typed config, and the synthesiser did not
    // carry the new key — so a `true` in the YAML resolved to `undefined` and the
    // contract never reached a prompt. The tests below are the ones that would have
    // caught it before the call was spent.
    const cfg = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
        consensus_scoring: { enabled: true, lenses: ['analysis'], inline_findings: true, ...over },
    });

    it('all three conjuncts present → active', () => {
        expect(inlineFindingsActive(cfg() as never, 'analysis')).toBe(true);
    });

    it('consensus scoring off → inactive, even with the key set', () => {
        expect(inlineFindingsActive(cfg({ enabled: false, lenses: ['analysis'], inline_findings: true }) as never, 'analysis')).toBe(false);
    });

    it('the key absent → inactive, and absent is the shipped state', () => {
        expect(inlineFindingsActive({ consensus_scoring: { enabled: true, lenses: ['analysis'] } } as never, 'analysis')).toBe(false);
    });

    it('a lens outside the lens list → inactive', () => {
        expect(inlineFindingsActive(cfg() as never, 'roadmap')).toBe(false);
        expect(inlineFindingsActive(cfg({ enabled: true, lenses: ['roadmap'], inline_findings: true }) as never, 'roadmap')).toBe(true);
    });

    it('no consensus_scoring block at all → inactive', () => {
        expect(inlineFindingsActive({} as never, 'analysis')).toBe(false);
    });

    it('the YAML key survives load → synthesise → predicate, in both states', () => {
        // The predicate above can be perfect and the feature still dead if the value
        // never reaches it. This walks the ACTUAL chain the CLI walks — parse the
        // config file, synthesise the settings block, read the predicate — because
        // the defect a live run found on 2026-08-30 lived between two of those three
        // steps and every test that stopped short of the chain passed.
        const base = [
            'enabled: true',
            'defaults:',
            '  mode: api',
            'cost_budget:',
            '  max_total_usd: 20.0',
            'members:',
            '  anthropic:',
            '    enabled: true',
            '    model: claude-x',
            '    api_key_ref: env:ANTHROPIC_KEY',
            'consensus_scoring:',
            '  enabled: true',
            '  lenses:',
            '    - analysis',
        ].join('\n');
        const walk = (yaml: string): boolean => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-1b-'));
            try {
                const file = path.join(dir, '.ai-council.yml');
                fs.writeFileSync(file, `${yaml}\n`, 'utf-8');
                const block = synthesizeAiCouncilBlock(load_council_config(file));
                return inlineFindingsActive(block as never, 'analysis');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        };
        expect(walk(`${base}\n  inline_findings: true`)).toBe(true);
        expect(walk(`${base}\n  inline_findings: false`)).toBe(false);
        // Absent is the shipped state and must read as off, never as "unset so on".
        expect(walk(base)).toBe(false);
    });
});
