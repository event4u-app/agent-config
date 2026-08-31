// Pins `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 11.4:
// "Keep the deterministic fallback permanently — no daemon, cloud router or
// learned model becomes necessary for basic council operation."
//
// The step's verify line is "the suite runs green with the model artifact
// deleted". Today there is no model artifact to delete, so the property holds
// vacuously — and a vacuous property is exactly the kind that regresses
// unnoticed. This file turns it into a falsifiable guard: the day a learned
// routing model lands on a runtime path, one of these tests goes red.
//
// HONEST SCOPE. This is a naming-based shape gate over source text, not a
// module-graph proof. A loader written under a name none of the patterns below
// anticipate escapes it. That is why the polarity test exists: a zero in the
// claim test only means something when the detector is known to fire on a real
// violation. Per this repo's gate-authoring discipline, the DENIAL is tested
// explicitly, not just the claim.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** The council runtime plus the ONE task-side resolver the roadmap names. */
const RUNTIME_SCOPE = [
    path.join(REPO_ROOT, 'src', 'scripts', 'ai_council'),
    path.join(REPO_ROOT, 'src', 'scripts', '_lib', 'judgment_ladder.ts'),
];

/** Model-artifact extensions a learned router would have to load from. */
const MODEL_ARTIFACT_EXT = ['.pkl', '.onnx', '.joblib', '.safetensors', '.gguf'];

/**
 * Fires on source text that loads or references a learned-routing model.
 * Kept as one exported-shaped constant so the polarity test below scores the
 * same detector the claim test uses — two regexes would let them drift.
 */
const LEARNED_MODEL_LOAD_RE = new RegExp(
    [
        'load_?model', // loadModel( / load_model(
        'onnxruntime',
        'tensorflow',
        '@tensorflow/',
        'learned_?rout', // learnedRouting / learned_route
        `\\.(?:${MODEL_ARTIFACT_EXT.map((e) => e.slice(1)).join('|')})['"\`]`, // a model-artifact path literal
    ].join('|'),
    'i',
);

function collectTsFiles(target: string): string[] {
    if (statSync(target).isFile()) {
        return target.endsWith('.ts') ? [target] : [];
    }
    const out: string[] = [];
    for (const entry of readdirSync(target, { withFileTypes: true })) {
        const full = path.join(target, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectTsFiles(full));
        } else if (entry.name.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

const RUNTIME_FILES = RUNTIME_SCOPE.flatMap(collectTsFiles);

describe('deterministic fallback — no learned routing model on a runtime path', () => {
    it('the scan scope is non-empty (a gate that scans nothing exits green)', () => {
        expect(RUNTIME_FILES.length).toBeGreaterThan(20);
    });

    it('no council runtime file loads or names a learned-routing model', () => {
        const offenders: string[] = [];
        for (const file of RUNTIME_FILES) {
            const text = readFileSync(file, 'utf8');
            for (const [i, line] of text.split('\n').entries()) {
                if (LEARNED_MODEL_LOAD_RE.test(line)) {
                    offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('no model artifact file ships inside the council runtime scope', () => {
        const artifacts: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                } else if (MODEL_ARTIFACT_EXT.some((e) => entry.name.endsWith(e))) {
                    artifacts.push(path.relative(REPO_ROOT, full));
                }
            }
        };
        walk(path.join(REPO_ROOT, 'src', 'scripts', 'ai_council'));
        expect(artifacts).toEqual([]);
    });

    // POLARITY. Without this, the two zeros above are indistinguishable from a
    // detector that matches nothing at all.
    it.each([
        ['const m = await loadModel(routerPath);', 'a model loader call'],
        ['import * as ort from "onnxruntime-node";', 'an ONNX runtime import'],
        ['const ROUTER = "models/router.onnx";', 'a model-artifact path literal'],
        ['const p = learnedRoutingPolicy(features);', 'a learned-routing policy call'],
    ])('the detector fires on %s (%s)', (snippet) => {
        expect(LEARNED_MODEL_LOAD_RE.test(snippet)).toBe(true);
    });

    it('the detector stays silent on ordinary council source lines', () => {
        for (const line of [
            'const members = load_members(config);',
            '// the deterministic policy is the permanent fallback',
            'export function estimate(question: CouncilQuestion): CostPreview {',
        ]) {
            expect(LEARNED_MODEL_LOAD_RE.test(line)).toBe(false);
        }
    });
});
