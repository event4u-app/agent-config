/**
 * The proposer survival bar — road-to-governed-harness-evolution step 5.4.
 *
 * The step: *"An LLM proposer must beat the deterministic one to survive. On at
 * least one pre-registered eval family, with an explicit hypothesis and a named
 * falsifier per mutation. Otherwise the deterministic path stays."*
 * `verify: the comparison is a `paired_verdict` run, not an argument.`
 *
 * **The comparison cannot be run, and that is a fact about the tree rather than
 * about effort: there is no second arm.** `_lib/candidate_proposer.ts` is the
 * only proposer, it is deterministic by construction, and Phase 5 ships no live
 * model harness — step 5.2 pins that with its own scan. A `paired_verdict` run
 * needs two arms; one of them does not exist.
 *
 * So this file does NOT claim the comparison happened. It is an
 * **absence-assertion**: it pins the state the step's own fallback clause names
 * — *"Otherwise the deterministic path stays"* — so that the day an LLM
 * proposer appears, it cannot quietly become the default without the
 * comparison. The guard is the thing that makes "otherwise" enforceable instead
 * of aspirational.
 *
 * What it asserts:
 *   1. The proposer path is deterministic — no model client, no network, no
 *      subprocess anywhere in it or its dependencies.
 *   2. The assertion is not vacuous: the scanned set is non-empty and contains
 *      the module it names.
 *
 * What it deliberately does NOT assert: that the deterministic recipes are any
 * good. That is the paired verdict's question, and answering it here would be
 * the "argument, not a run" the step forbids.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/** The proposer path: the module plus every `_lib` sibling it imports. */
const PROPOSER_CHAIN = [
    'src/scripts/_lib/candidate_proposer.ts',
    'src/scripts/_lib/candidate_record.ts',
];

/**
 * Constructs that would put a model in the proposer loop.
 *
 * Named literally rather than described, so the scan is falsifiable: adding any
 * one of these to the chain must turn this file red.
 */
const MODEL_IN_THE_LOOP = [
    'fetch(',
    'node:http',
    'node:https',
    'node:net',
    'child_process',
    'spawnSync',
    'api.anthropic.com',
    'api.openai.com',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
];

// Bare vendor names — `anthropic`, `openai` — were in this list and were
// REMOVED after they fired on the clean tree. Both appear in
// `candidate_record.ts`, not as a client but inside an error-message STRING
// naming which council seats decided something ("2026-08-29, anthropic +
// openai, 2/2"). Stripping comments does not remove a string literal, and it
// should not: the detector was simply wrong. A vendor's name in prose is not
// evidence of a model call, and a scan that reds on it measures the writing
// rather than the code. What is left cannot appear innocently: a transport
// import, a subprocess spawn, an API host, or a key env var.
// Measured 2026-08-31 — with the names in, the clean tree reported
// 2 hits, both prose.

/** Strip comments, so a docstring naming a construct is not a hit. */
function code(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('the deterministic path stays until a comparison is run', () => {
    const bodies = PROPOSER_CHAIN.map((rel) => ({
        rel,
        body: code(readFileSync(path.join(REPO, rel), 'utf8')),
    }));

    it('the scan is not vacuous — it reads real, non-empty modules', () => {
        // A scan over nothing exits green, which is the failure mode this
        // assertion exists to make impossible.
        expect(bodies.length).toBeGreaterThan(0);
        for (const b of bodies) {
            expect(b.body.length).toBeGreaterThan(500);
        }
        expect(bodies.map((b) => b.rel)).toContain('src/scripts/_lib/candidate_proposer.ts');
    });

    it('the comment stripper does not empty the file it scans', () => {
        // Its own anti-vacuity: a stripper returning '' would make every
        // assertion below pass over nothing.
        for (const b of bodies) {
            expect(b.body).toMatch(/export/);
        }
    });

    it('no model is in the proposer loop', () => {
        const hits: string[] = [];
        for (const b of bodies) {
            for (const needle of MODEL_IN_THE_LOOP) {
                if (b.body.includes(needle)) hits.push(`${b.rel}: ${needle}`);
            }
        }
        expect(hits).toEqual([]);
    });

    it('the construct list is non-empty, so the scan above can actually fail', () => {
        expect(MODEL_IN_THE_LOOP.length).toBeGreaterThan(5);
    });
});
