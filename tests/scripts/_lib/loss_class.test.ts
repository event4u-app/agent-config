import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluate, isLossy, stripNonCode } from '../../../src/scripts/check_loss_class_declared.js';
import {
    applyTransform,
    isLossClass,
    isProblem,
    LOSS_CLASSES,
    parseLossDeclaration,
} from '../../../src/scripts/_lib/loss_class.js';

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
    // the file no longer declares a loss class and no longer owes one. What
    // replaced them is the block below: the 30-row cap that survived, and the
    // detector that can now see it.

    const CAP_MODULE = 'src/scripts/_lib/session_index_trust.ts';

    it('session_index_trust declares recoverable-lossy and carries its locator', () => {
        const d = parseLossDeclaration(read(CAP_MODULE));
        expect(isProblem(d)).toBe(false);
        if (!isProblem(d)) {
            expect(d.lossClass).toBe('recoverable-lossy');
            expect(d.recovery).toContain('agents/memory/');
        }
    });

    it('its declared class matches its stated behaviour — the cap drops rows the corpus keeps', () => {
        const src = read(CAP_MODULE);
        expect(src).toContain('SESSION_INDEX_ROW_CAP = 30');
        expect(src).toContain('rows.slice(0, limit)');
    });
});

describe('the corpus is not empty, and it is the module applying the surviving cap', () => {
    // Closes blocker `loss-class-corpus-is-empty-after-hot-context`. Its
    // `Resolved when` has two limbs and a count satisfies only the first, so
    // this asserts IDENTITY: the matched module must be the one holding the cap.
    const CAP_MODULE = 'src/scripts/_lib/session_index_trust.ts';
    const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
    const verdict = evaluate();

    it('matches at least one module again', () => {
        expect(verdict.modelFacing).toBeGreaterThan(0);
        expect(verdict.modules.length).toBe(verdict.modelFacing);
    });

    it('and that module is the one applying the 30-row cap', () => {
        expect(verdict.modules).toContain(CAP_MODULE);
    });

    it('every matched module carries a usable declaration — the gate is green over a real set', () => {
        expect(verdict.findings).toEqual([]);
        for (const m of verdict.modules) {
            expect(isProblem(parseLossDeclaration(read(m)))).toBe(false);
        }
    });

    it('the detector sees the cap structurally, not because a declaration is present', () => {
        // Sensitivity: strip the declaration and the module must still be
        // LOSSY, or removing it would drop the module out of the corpus
        // instead of turning the gate red.
        const withoutDecl = read(CAP_MODULE).replace(/^\s*\*\s*loss_class:.*$/m, ' *');
        expect(withoutDecl).not.toContain('loss_class:');
        expect(isLossy(stripNonCode(withoutDecl))).toBe(true);
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
