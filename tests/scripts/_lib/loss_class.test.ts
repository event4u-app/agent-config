import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    applyTransform,
    isLossClass,
    isProblem,
    LOSS_CLASSES,
    parseLossDeclaration,
    parseLossModulePointers,
} from '../../../src/scripts/_lib/loss_class.js';
import { evaluate } from '../../../src/scripts/check_loss_class_declared.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('loss classes — the vocabulary', () => {
    it('is exactly the five named classes', () => {
        expect([...LOSS_CLASSES]).toEqual(['exact', 'lossless', 'recoverable-lossy', 'ephemeral-lossy', 'forbidden']);
        expect(isLossClass('recoverable_lossy')).toBe(false);
    });
});

describe('loss classes — declaration parsing', () => {
    it('reads a class and a locator out of a docblock', () => {
        const d = parseLossDeclaration('/**\n * loss_class: recoverable-lossy\n * loss_recovery: a/b:1-2\n */');
        expect(isProblem(d)).toBe(false);
        if (!isProblem(d)) {
            expect(d.lossClass).toBe('recoverable-lossy');
            expect(d.recovery).toBe('a/b:1-2');
        }
    });

    it('rejects recoverable-lossy with no locator — the class would be indistinguishable', () => {
        const d = parseLossDeclaration('/**\n * loss_class: recoverable-lossy\n */');
        expect(isProblem(d) && d.kind).toBe('missing-recovery');
    });

    it('does not honour a misspelled class', () => {
        const d = parseLossDeclaration('/**\n * loss_class: recoverable_lossy\n */');
        expect(isProblem(d) && d.kind).toBe('unknown-class');
    });

    it('ephemeral-lossy owes no locator', () => {
        expect(isProblem(parseLossDeclaration('/**\n * loss_class: ephemeral-lossy\n */'))).toBe(false);
    });
});

describe("AC-5 — the classification is checked against the transforms' own source", () => {
    // Deliberately reads the real files, not this roadmap's summary of them.
    const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');

    it('fold_intake declares recoverable-lossy and carries its locator', () => {
        const d = parseLossDeclaration(read('src/scripts/fold_intake.ts'));
        expect(isProblem(d)).toBe(false);
        if (!isProblem(d)) {
            expect(d.lossClass).toBe('recoverable-lossy');
            expect(d.recovery).toContain('link-back');
        }
    });

    it('its declared class matches its stated behaviour — children are never mutated', () => {
        expect(read('src/scripts/fold_intake.ts')).toContain('Children never mutated');
    });

    // The two `hot_context_hook` cases that stood here are gone with the
    // transform they described: road-to-continuity-writer-activation step 3.1
    // retired the cache half, taking `_redact_lines` and `WORD_CAP` with it, so
    // the file no longer declares a loss class and no longer owes one. What is
    // NOT gone is the 30-row cap in `_lib/session_index_trust.ts`, and the
    // cases below are where it is now asserted — the hole the deleted pair left
    // is closed by the `loss_module:` pointer rather than by silence.

    it('session_index_trust declares recoverable-lossy and names a real corpus as its locator', () => {
        const d = parseLossDeclaration(read('src/scripts/_lib/session_index_trust.ts'));
        expect(isProblem(d)).toBe(false);
        if (!isProblem(d)) {
            expect(d.lossClass).toBe('recoverable-lossy');
            expect(d.recovery).toContain('agents/memory/');
        }
    });

    it('its declared class matches its stated behaviour — the cap drops rows the corpus still holds', () => {
        const src = read('src/scripts/_lib/session_index_trust.ts');
        expect(src).toContain('SESSION_INDEX_ROW_CAP');
        expect(src).toContain('export function capRows');
    });

    it('hot_context_hook points the gate at the module that applies the cap', () => {
        expect(parseLossModulePointers(read('src/scripts/hot_context_hook.ts'))).toContain(
            'src/scripts/_lib/session_index_trust.ts',
        );
    });
});

describe('the corpus is not empty, and the module in it is the one applying the surviving cap', () => {
    // The blocker `loss-class-corpus-is-empty-after-hot-context` resolves on
    // exactly this: the gate reports at least one matching module again, AND
    // that module is the one applying the cap. Asserted against the LIVE tree
    // rather than a fixture, because a fixture would prove the mechanism works
    // somewhere and this claim is about here.
    const v = evaluate(REPO_ROOT);

    it('reports at least one model-facing module', () => {
        expect(v.modelFacing).toBeGreaterThanOrEqual(1);
    });

    it('the matching module is session_index_trust, reached by pointer', () => {
        expect(v.pointedModules).toContain('src/scripts/_lib/session_index_trust.ts');
    });

    it('and it passes — no finding stands against it', () => {
        expect(v.findings.filter((f) => f.script === 'src/scripts/_lib/session_index_trust.ts')).toEqual([]);
    });

    it('a pointer is a claim, not an exemption: an undeclared pointed module is a finding', () => {
        // Sensitivity, without touching the tree: the same parser over a source
        // that declares nothing must report `missing`, which is what the gate
        // turns into a failing finding.
        expect(isProblem(parseLossDeclaration('/**\n * just a docblock\n */'))).toBe(true);
        expect(parseLossModulePointers('/**\n * loss_module: a/b.ts\n * loss_module: a/b.ts\n */')).toEqual(['a/b.ts']);
        expect(parseLossModulePointers('/**\n * nothing here\n */')).toEqual([]);
    });
});

describe('3.3 — the passthrough invariant, one fixture per degradation', () => {
    const shrink = (s: string): string => s.slice(0, 3);

    it('unparseable input returns the input bytes unchanged', () => {
        const r = applyTransform('abcdef', { transform: () => null });
        expect(r.output).toBe('abcdef');
        expect(r.passthrough).toBe('unparseable-input');
    });

    it('unavailable recovery storage returns the input bytes unchanged', () => {
        const r = applyTransform('abcdef', { transform: shrink, storeRecovery: () => false });
        expect(r.output).toBe('abcdef');
        expect(r.passthrough).toBe('recovery-unavailable');
    });

    it('no recovery path declared is the same degradation, not a silent success', () => {
        // A `recoverable-lossy` transform whose store is absent must not quietly
        // behave like an ephemeral one.
        const r = applyTransform('abcdef', { transform: shrink, storeRecovery: () => false });
        expect(r.passthrough).not.toBeNull();
    });

    it('output not smaller returns the input bytes unchanged', () => {
        const r = applyTransform('ab', { transform: (s) => s + '!!!' });
        expect(r.output).toBe('ab');
        expect(r.passthrough).toBe('not-smaller');
    });

    it('equal-length output is also a passthrough — a transform that bought nothing', () => {
        expect(applyTransform('abc', { transform: (s) => s.toUpperCase() }).passthrough).toBe('not-smaller');
    });

    it('a real shrink runs and reports no passthrough', () => {
        const r = applyTransform('abcdef', { transform: shrink, storeRecovery: () => true });
        expect(r.output).toBe('abc');
        expect(r.passthrough).toBeNull();
    });

    it('degradation is never silent — every passthrough carries its reason', () => {
        const reasons = [
            applyTransform('abcdef', { transform: () => null }).passthrough,
            applyTransform('abcdef', { transform: shrink, storeRecovery: () => false }).passthrough,
            applyTransform('ab', { transform: (s) => s + '!' }).passthrough,
        ];
        expect(reasons.every((r) => r !== null)).toBe(true);
        expect(new Set(reasons).size).toBe(3);
    });
});
