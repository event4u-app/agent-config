/**
 * The metered proposer arm — role constraint, ladder walk, and the guard AC-3
 * asks for a caller of.
 *
 * `road-to-governed-evidence-production` step 2.1, session A (build half). The
 * comparison is NOT run here and no metered call is made: every case below uses
 * a stubbed generator, and the one real-transport case asserts a description of
 * a request rather than a response to one.
 *
 * Each `describe` names the property it pins. The role-constraint block is
 * written against `docs/contracts/metered-proposer-protocol.md`'s Role clause —
 * *"a metered call may generate candidate text; it may not score, rank, filter,
 * select between, or supply any input to the verdict"* — one case per forbidden
 * role, so a reader can check the test against the clause rather than against a
 * paraphrase of it.
 */
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    CandidateCountError,
    DECISION_FIELD_KEYS,
    GenerationRefusedError,
    INITIAL_CLASS,
    MAX_BODY_BYTES,
    SYSTEM_PROMPT,
    assertGenerationAcceptable,
    buildPrompt,
    classifyRefusal,
    plannedAttempts,
    proposeCandidatesWithModel,
    type GenerationRequest,
    type GenerationResult,
    type TextGenerator,
} from '../../src/scripts/_lib/llm_candidate_proposer.js';
import {
    TIER_MODEL,
    TransportRefusedError,
    describeRequest,
    estimateTokens,
    modelForTier,
} from '../../src/scripts/_lib/llm_proposer_transport.js';
import { proposeCandidates, type DefectObservation } from '../../src/scripts/_lib/candidate_proposer.js';
import { ladderFor } from '../../src/scripts/_lib/evolution_roi.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARM = path.join(REPO, 'src', 'scripts', '_lib', 'llm_candidate_proposer.ts');
const TRANSPORT = path.join(REPO, 'src', 'scripts', '_lib', 'llm_proposer_transport.ts');
const CLI = path.join(REPO, 'src', 'scripts', 'llm_propose.ts');

const SUBJECT_A = '.claude/rules/a.md';
const SUBJECT_B = '.claude/rules/b.md';
const BODIES: Record<string, string> = {
    [SUBJECT_A]: '# A\n\nband\n\n## Body\n\ntext\n',
    [SUBJECT_B]: '# B\n\nband\n\n## Body\n\ntext\n',
};
const read = (s: string): string => BODIES[s] ?? '# missing\n';

const OBS: DefectObservation[] = [
    { defectClass: 'over-broad-activation', subject: SUBJECT_A },
    { defectClass: 'unbacked-enforcement-claim', subject: SUBJECT_B },
];

/**
 * A generator that always succeeds.
 *
 * Its text sorts in the OPPOSITE order to the input, deliberately: subject `a`
 * gets a body beginning `zzz` and subject `b` one beginning `aaa`. A first
 * version returned the same string for every call, which made the
 * ordering-comes-from-the-input assertion vacuous — a content sort over equal
 * strings is a no-op, so the sabotage that reordered the output could not be
 * seen. Caught by running that sabotage and watching 26/26 stay green.
 */
function alwaysOk(): TextGenerator {
    return (req: GenerationRequest): Promise<GenerationResult> => {
        const subject = /Artifact path: (\S+)/.exec(req.prompt)?.[1] ?? '';
        const lead = subject === SUBJECT_A ? 'zzz' : 'aaa';
        return Promise.resolve({
            text: `${lead} rewritten by ${req.tier}\n`,
            model: `model-${req.tier}`,
        });
    };
}

/** A generator whose first `n` calls are refused by the output contract. */
function failsFirst(n: number, bodies: Record<string, string> = BODIES): TextGenerator {
    let seen = 0;
    return (req: GenerationRequest): Promise<GenerationResult> => {
        seen += 1;
        if (seen === 1) {
            // Byte-identical to the input: a proposal that changes nothing.
            const subject = /Artifact path: (\S+)/.exec(req.prompt)?.[1] ?? SUBJECT_A;
            return Promise.resolve({ text: bodies[subject] ?? '', model: 'm' });
        }
        if (seen <= n) return Promise.resolve({ text: '   ', model: 'm' });
        return Promise.resolve({ text: `accepted at call ${String(seen)}\n`, model: `model-${req.tier}` });
    };
}

describe('the role constraint is structural, not intentional', () => {
    it('the metered port carries no field that could hold a judgement', () => {
        // The compile-time half is `_GenerationResultCarriesNoDecisionField`,
        // which turns a scoring key into a BUILD error. This is its readable
        // half: the shipped result type's keys, checked against the deny-list.
        const sample: GenerationResult = { text: 't', model: 'm' };
        for (const k of Object.keys(sample)) {
            expect(DECISION_FIELD_KEYS as readonly string[]).not.toContain(k);
        }
        expect(Object.keys(sample).sort()).toEqual(['model', 'text']);
        // Anti-vacuity: the deny-list is real and would catch a real key.
        expect(DECISION_FIELD_KEYS).toContain('score');
        expect(DECISION_FIELD_KEYS).toContain('rank');
    });

    it('the arm reaches no verdict module — it cannot supply an input to one', () => {
        const src = readFileSync(ARM, 'utf-8');
        for (const forbidden of ['paired_verdict', 'evaluation_vector', 'evaluation_cascade']) {
            expect(src, `the arm imports ${forbidden}`).not.toMatch(
                new RegExp(`from '\\./${forbidden}\\.js'`),
            );
        }
    });

    it('one record per observation — the output can never be a subset', async () => {
        const out = await proposeCandidatesWithModel(OBS, read, alwaysOk());
        expect(out.records).toHaveLength(OBS.length);
        expect(out.records.map((r) => r.mutations[0]?.path).sort()).toEqual([SUBJECT_A, SUBJECT_B]);
    });

    it('an unsatisfiable observation THROWS rather than being dropped', async () => {
        // Filtering is the failure this shape prevents: a returned list one
        // shorter than the input is a selection nobody authorised.
        const alwaysEmpty: TextGenerator = () => Promise.resolve({ text: '', model: 'm' });
        await expect(proposeCandidatesWithModel(OBS, read, alwaysEmpty)).rejects.toBeInstanceOf(
            GenerationRefusedError,
        );
    });

    it('output order comes from the INPUT, never from what the model returned', async () => {
        const forward = await proposeCandidatesWithModel(OBS, read, alwaysOk());
        const reversed = await proposeCandidatesWithModel([...OBS].reverse(), read, alwaysOk());
        expect(reversed.records.map((r) => r.id)).toEqual(forward.records.map((r) => r.id));
        // And it is the SAME ordering the deterministic arm applies, or the two
        // arms would not be walking one input in one order.
        const deterministic = proposeCandidates([...OBS].reverse(), read);
        expect(deterministic.map((r) => r.mutations[0]?.path)).toEqual(
            forward.records.map((r) => r.mutations[0]?.path),
        );
    });

    it('the dimension comes from the recipe, so the model cannot pick its own arm', async () => {
        const out = await proposeCandidatesWithModel(OBS, read, alwaysOk());
        const byPath = new Map(out.records.map((r) => [r.mutations[0]?.path, r.dimension]));
        expect(byPath.get(SUBJECT_A)).toBe('activation');
        expect(byPath.get(SUBJECT_B)).toBe('content');
    });

    it('CandidateCountError exists and is the named failure for a filtered return', () => {
        // Unreachable through the loop's own logic today, which is why it is an
        // assertion rather than a trusted invariant. Named so a reader checking
        // "no filtering" has something to grep for.
        expect(new CandidateCountError('x')).toBeInstanceOf(Error);
        expect(new CandidateCountError('x').name).toBe('CandidateCountError');
    });
});

describe('the output contract refuses shapes, never judges quality', () => {
    const obs: DefectObservation = { defectClass: 'over-broad-activation', subject: SUBJECT_A };
    const before = BODIES[SUBJECT_A] as string;

    it('accepts a changed, non-empty body', () => {
        expect(() => assertGenerationAcceptable(obs, before, '# A\n\nband only\n')).not.toThrow();
    });

    it('refuses empty, byte-identical, over-ceiling and NUL-bearing bodies', () => {
        const cases: Array<[string, string]> = [
            ['empty', '   '],
            ['identical', before],
            ['over-ceiling', 'x'.repeat(MAX_BODY_BYTES + 1)],
            ['nul', `ok${String.fromCharCode(0)}ok`],
        ];
        for (const [name, text] of cases) {
            expect(() => assertGenerationAcceptable(obs, before, text), name).toThrow(
                GenerationRefusedError,
            );
        }
    });

    it('refuses a routing generation that omits the required target', () => {
        const routed: DefectObservation = {
            defectClass: 'unrouted-obligation',
            subject: SUBJECT_A,
            routeTo: 'skill:somewhere',
        };
        expect(() => assertGenerationAcceptable(routed, before, '# A\n\nno pointer\n')).toThrow(
            GenerationRefusedError,
        );
        expect(() =>
            assertGenerationAcceptable(routed, before, '# A\n\nRouted to skill:somewhere.\n'),
        ).not.toThrow();
    });

    it('every refusal classifies to a pathology, and an unknown throw to execution_failed', () => {
        expect(classifyRefusal(new GenerationRefusedError('output_contract_violated', 'x'))).toBe(
            'output_contract_violated',
        );
        expect(classifyRefusal(new Error('socket hang up'))).toBe('execution_failed');
    });
});

describe('the ladder walk, and assertCheapestFirst over a REAL population (AC-3)', () => {
    it('the first attempt is the cheapest rung of the initial class', async () => {
        const out = await proposeCandidatesWithModel([OBS[0] as DefectObservation], read, alwaysOk());
        expect(out.attempts).toHaveLength(1);
        expect(out.attempts[0]).toEqual({ defect_class: INITIAL_CLASS, tier: 'lite', sequence: 1 });
        // INITIAL_CLASS licenses exactly one rung — "escalating on a reason
        // nobody established is spending on a guess".
        expect(ladderFor(INITIAL_CLASS)).toEqual(['lite']);
    });

    it('a refusal escalates on the CLASSIFIED class, cheapest rung first', async () => {
        const out = await proposeCandidatesWithModel(
            [OBS[0] as DefectObservation],
            read,
            failsFirst(2),
        );
        expect(out.attempts).toEqual([
            { defect_class: 'reason_unknown', tier: 'lite', sequence: 1 },
            { defect_class: 'output_contract_violated', tier: 'lite', sequence: 2 },
            { defect_class: 'output_contract_violated', tier: 'medium', sequence: 3 },
        ]);
        // A real escalation, produced by the real walk: this is the population
        // `assertCheapestFirst` polices, and it is not empty.
        expect(out.records).toHaveLength(1);
    });

    it('the walk STOPS when the class licenses no further rung', async () => {
        // `output_contract_violated` licenses lite < medium and nothing above,
        // so a generator that never satisfies the contract runs out rather than
        // escalating forever or silently returning nothing.
        const neverOk: TextGenerator = () => Promise.resolve({ text: '', model: 'm' });
        await expect(
            proposeCandidatesWithModel([OBS[0] as DefectObservation], read, neverOk),
        ).rejects.toThrow(/no tier left/);
    });

    it('an inconsistent resumed history is REFUSED by the ordering guard', async () => {
        // The one input from which `assertCheapestFirst`'s red is producible
        // through this caller, and therefore the case that makes it a guard
        // rather than a comment. A history claiming `medium` was spent on a
        // class whose `lite` rung was never tried is a costlier tier before a
        // cheaper one, whatever order the walk itself then runs in.
        await expect(
            proposeCandidatesWithModel([OBS[0] as DefectObservation], read, alwaysOk(), [
                { defect_class: 'output_contract_violated', tier: 'medium', sequence: 1 },
            ]),
        ).rejects.toThrow(/cheaper models go first/);
    });

    it('a CONSISTENT resumed history passes, and leads the audit trail', async () => {
        // Anti-vacuity for the case above: the guard is not simply rejecting
        // every history handed to it.
        const out = await proposeCandidatesWithModel(
            [OBS[0] as DefectObservation],
            read,
            alwaysOk(),
            [{ defect_class: 'output_contract_violated', tier: 'lite', sequence: 1 }],
        );
        expect(out.attempts[0]).toEqual({
            defect_class: 'output_contract_violated',
            tier: 'lite',
            sequence: 1,
        });
        // The new attempt continues the sequence rather than restarting it.
        expect(out.attempts[1]?.sequence).toBe(2);
        expect(out.records).toHaveLength(1);
    });

    it('a fresh observation starts at the cheapest rung again, across subjects', async () => {
        // Per-observation spend, not per-run: the guard allows a repeat of a
        // spent rung, and a shared map would exhaust the ladder on subject two.
        const out = await proposeCandidatesWithModel(OBS, read, alwaysOk());
        expect(out.attempts.map((a) => a.tier)).toEqual(['lite', 'lite']);
    });

    it('the dry-run plan is a real, non-empty attempt list the guard accepts', () => {
        // Derived from the real observations by the same `nextTier` call the
        // live walk uses — not a fixture written beside the code.
        const planned = plannedAttempts(OBS);
        expect(planned).toHaveLength(OBS.length);
        for (const a of planned) expect(a.tier).toBe('lite');
        expect(new Set(planned.map((a) => a.sequence)).size).toBe(OBS.length);
    });
});

describe('the transport is one file, and it has not been run', () => {
    it('describeRequest returns exactly what would be sent, and sends nothing', () => {
        const req: GenerationRequest = { tier: 'lite', system: SYSTEM_PROMPT, prompt: 'p' };
        const d = describeRequest(req);
        expect(d.url).toBe('https://api.anthropic.com/v1/messages');
        expect(d.model).toBe(TIER_MODEL.lite);
        expect(d.body).toMatchObject({ temperature: 0, system: SYSTEM_PROMPT });
        expect(d.body['messages']).toEqual([{ role: 'user', content: 'p' }]);
    });

    it('an unpinned tier REFUSES rather than resolving a floating alias', () => {
        // A frozen protocol whose model id can move is not frozen.
        expect(() => modelForTier('high')).toThrow(TransportRefusedError);
        expect(modelForTier('lite')).toMatch(/^claude-haiku-4-5-\d{8}$/);
        expect(modelForTier('medium')).toMatch(/^claude-sonnet-4-5-\d{8}$/);
    });

    it('the ARM carries no transport construct — only the transport file may', () => {
        const armSrc = readFileSync(ARM, 'utf-8');
        for (const needle of ['fetch(', 'api.anthropic.com', 'api.openai.com', 'child_process']) {
            expect(armSrc, `the arm carries ${needle}`).not.toContain(needle);
        }
        // Anti-vacuity in the other direction: the transport DOES carry one, so
        // the assertion above is discriminating rather than trivially true.
        expect(readFileSync(TRANSPORT, 'utf-8')).toContain('api.anthropic.com');
    });

    it('estimateTokens is a stated estimate, not a tokenizer', () => {
        expect(estimateTokens('a'.repeat(400))).toBe(100);
    });

    it('the prompt is pure — same observation and body, same bytes', () => {
        const a = buildPrompt(OBS[0] as DefectObservation, BODIES[SUBJECT_A] as string);
        const b = buildPrompt(OBS[0] as DefectObservation, BODIES[SUBJECT_A] as string);
        expect(a).toBe(b);
        expect(a).toContain('Defect class: over-broad-activation');
    });
});

describe('the metered arm is outside the archived roadmaps live-harness scan, deliberately', () => {
    // `tests/scripts/governed_harness_no_live_harness.test.ts` half B owns every
    // `.ts` under `src/` whose text contains the slug `road-to-governed-harness-
    // evolution`, and applies a live-harness pattern set to it. That scan
    // enforces step 5.2 of the ARCHIVED parent over the parent's own tree. The
    // metered arm belongs to `road-to-governed-evidence-production`, whose park
    // was narrowed on 2026-09-01 to permit exactly a metered proposer — so
    // extending that scan here would enforce a lock a council has since
    // narrowed. The exclusion is by path, and it is asserted rather than assumed
    // because the ownership predicate is a substring match: one docstring
    // mentioning the old slug would pull the transport's real model endpoint
    // into a scan that must fail on it.
    const OLD_SLUG = 'road-to-governed-harness-evolution';

    it('none of the three new modules declares itself as the archived roadmaps', () => {
        for (const f of [ARM, TRANSPORT, CLI]) {
            expect(readFileSync(f, 'utf-8'), path.basename(f)).not.toContain(OLD_SLUG);
        }
    });

    it('exactly one file in the metered arms own closure carries a model endpoint', () => {
        // The containment claim that replaces the scan for this arm: the
        // endpoint lives in the transport and nowhere else.
        const own = [ARM, TRANSPORT, CLI];
        const carriers = own.filter((f) => /api\.(openai|anthropic)\.com/.test(readFileSync(f, 'utf-8')));
        expect(carriers.map((f) => path.basename(f))).toEqual(['llm_proposer_transport.ts']);
    });

    it('the ownership predicate is the real one — it finds the archived roadmaps modules', () => {
        // Anti-vacuity for the first case: a substring scan that matched
        // nothing anywhere would make "not owned" meaningless.
        const owned: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of readdirSync(dir)) {
                const full = path.join(dir, entry);
                if (statSync(full).isDirectory()) walk(full);
                else if (entry.endsWith('.ts') && readFileSync(full, 'utf-8').includes(OLD_SLUG)) {
                    owned.push(path.basename(full));
                }
            }
        };
        walk(path.join(REPO, 'src'));
        expect(owned.length).toBeGreaterThan(5);
        expect(owned).toContain('evolution_lab.ts');
        expect(owned).not.toContain('llm_candidate_proposer.ts');
    });
});
