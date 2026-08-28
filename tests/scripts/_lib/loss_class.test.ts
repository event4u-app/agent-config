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

    it('hot_context_hook declares ephemeral-lossy and owes no locator', () => {
        const d = parseLossDeclaration(read('src/scripts/hot_context_hook.ts'));
        expect(isProblem(d)).toBe(false);
        if (!isProblem(d)) expect(d.lossClass).toBe('ephemeral-lossy');
    });

    it('its declared class matches its stated behaviour — violating lines are DROPPED', () => {
        expect(read('src/scripts/hot_context_hook.ts')).toMatch(/violating lines are DROPPED/);
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
