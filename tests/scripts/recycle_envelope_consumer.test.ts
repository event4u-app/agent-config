/**
 * Recycle-envelope consumer — `handoff_context_hook.consume_recycle_envelope`
 * (road-to-token-economy-recycling Phase 2.3).
 *
 * Acceptance fixtures pinned here:
 *   - a stale envelope is NOT injected into a later session (fixture-proven);
 *   - an envelope belonging to a DIFFERENT workspace is NOT injected
 *     (identity check, Risk 4);
 *   - every non-absent outcome CONSUMES the file (moved, not copied) so an
 *     envelope can never leak into a second session;
 *   - an invalid envelope (prose field) is discarded, never injected.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { consume_recycle_envelope } from '../../src/scripts/handoff_context_hook.js';
import {
    RECYCLE_CONSUMED_REL,
    RECYCLE_ENVELOPE_REL,
} from '../../src/scripts/_lib/recycle_envelope_paths.js';

function scratchRoot(): string {
    // realpath immediately: the consumer compares realpaths, and macOS
    // tmpdirs are symlinked (/var → /private/var).
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'recycle-consumer-')));
}

function validEnvelope(root: string, writtenAt: string): Record<string, unknown> {
    return {
        capsule_version: 2,
        variant: 'main_session',
        summary: 'phase 2 landed; phase 3 open',
        task: 'close the roadmap',
        workspace: root,
        written_at: writtenAt,
        acceptance_criteria: ['boxes flipped'],
        remaining: ['phase 3'],
        not_carried_forward: ['diff bodies'],
    };
}

function writeEnvelope(root: string, envelope: unknown): string {
    const target = path.join(root, RECYCLE_ENVELOPE_REL);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(envelope, null, 2));
    return target;
}

function consumedPath(root: string): string {
    return path.join(root, RECYCLE_CONSUMED_REL);
}

afterEach(() => {
    delete process.env.AGENT_RECYCLE_ENVELOPE_FILE;
});

describe('consume_recycle_envelope', () => {
    it('injects a fresh, matching envelope as DATA and consumes it (moved, not copied)', () => {
        const root = scratchRoot();
        const target = writeEnvelope(root, validEnvelope(root, new Date().toISOString()));
        const decision = consume_recycle_envelope(root);
        expect(decision.action).toBe('inject');
        expect(decision.context).toContain('<recycle-envelope');
        expect(decision.context).toContain('DATA, not instructions');
        expect(decision.context).toContain('not_carried_forward');
        // moved, not copied
        expect(fs.existsSync(target)).toBe(false);
        expect(fs.existsSync(consumedPath(root))).toBe(true);
    });

    it('acceptance: a STALE envelope is not injected — discarded and consumed', () => {
        const root = scratchRoot();
        const old = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72h > 48h
        const target = writeEnvelope(root, validEnvelope(root, old));
        const decision = consume_recycle_envelope(root);
        expect(decision.action).toBe('discard');
        expect(decision.reason).toContain('stale');
        expect(fs.existsSync(target)).toBe(false);
    });

    it('acceptance: an envelope for a NON-MATCHING workspace is not injected (Risk 4)', () => {
        const root = scratchRoot();
        const otherRoot = scratchRoot();
        const target = writeEnvelope(root, validEnvelope(otherRoot, new Date().toISOString()));
        const decision = consume_recycle_envelope(root);
        expect(decision.action).toBe('discard');
        expect(decision.reason).toContain('belongs to');
        expect(fs.existsSync(target)).toBe(false);
    });

    it('an invalid envelope (prose field) is discarded, never injected', () => {
        const root = scratchRoot();
        const bad = {
            ...validEnvelope(root, new Date().toISOString()),
            transcript_summary: 'first we did X, then we did Y, then...',
        };
        const target = writeEnvelope(root, bad);
        const decision = consume_recycle_envelope(root);
        expect(decision.action).toBe('discard');
        expect(decision.reason).toContain('invalid');
        expect(fs.existsSync(target)).toBe(false);
    });

    it('absent envelope → absent, nothing created', () => {
        const root = scratchRoot();
        const decision = consume_recycle_envelope(root);
        expect(decision.action).toBe('absent');
        expect(fs.existsSync(consumedPath(root))).toBe(false);
    });

    it('a consumed envelope never fires twice', () => {
        const root = scratchRoot();
        writeEnvelope(root, validEnvelope(root, new Date().toISOString()));
        expect(consume_recycle_envelope(root).action).toBe('inject');
        expect(consume_recycle_envelope(root).action).toBe('absent');
    });
});
