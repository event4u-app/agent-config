// Tests for src/install/preserve.ts — the pure half of the owner ruling of
// 2026-09-21 (road-to-a-conformance-check-that-can-fail, Phase 5.1): a managed
// file the user has edited is preserved rather than overwritten.
//
// Expectations are derived from the inputs (digests computed here from the
// content under test) rather than pinned to literals, so a change to the
// hashing would fail the installer tests rather than silently agreeing with
// itself here.
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
    EXIT_COMPLETED_WITH_CONFLICTS,
    SIDECAR_SUFFIX,
    conflictSummaryMessage,
    decideDeployWrite,
    foreignSidecarMessage,
    preservedFileMessage,
    sidecarPathFor,
    type DeployWriteInputs,
} from '../../src/install/preserve.js';

function hex(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function inputs(overrides: Partial<DeployWriteInputs> = {}): DeployWriteInputs {
    return {
        exists: true,
        recordedSha256: hex('package content'),
        onDiskSha256: hex('package content'),
        force: false,
        ...overrides,
    };
}

describe('preserve — decideDeployWrite', () => {
    it('writes a target that does not exist', () => {
        expect(decideDeployWrite(inputs({ exists: false, recordedSha256: undefined, onDiskSha256: null })))
            .toBe('write');
    });

    it('writes a recorded file whose bytes still match what we recorded', () => {
        const same = hex('managed body');
        expect(decideDeployWrite(inputs({ recordedSha256: same, onDiskSha256: same }))).toBe('write');
    });

    it('preserves a recorded file whose bytes diverge from what we recorded', () => {
        expect(
            decideDeployWrite(
                inputs({ recordedSha256: hex('as we wrote it'), onDiskSha256: hex('as the user edited it') }),
            ),
        ).toBe('preserve');
    });

    it('preserves on a one-character divergence — no semantic classification', () => {
        // The ruling admits no comment-only detection and no format-aware diff.
        // A trailing-newline-sized edit is treated exactly like a rewrite.
        const original = '# heading\nbody\n';
        expect(
            decideDeployWrite(inputs({ recordedSha256: hex(original), onDiskSha256: hex(`${original}\n`) })),
        ).toBe('preserve');
    });

    it('writes a modified file when the run is forced', () => {
        expect(
            decideDeployWrite(
                inputs({ recordedSha256: hex('ours'), onDiskSha256: hex('edited'), force: true }),
            ),
        ).toBe('write');
    });

    it('writes when nothing is recorded for the path', () => {
        // The pre-hash behavior, kept: no recorded digest is no divergence to
        // measure, so a tree with no manifest installs exactly as before.
        expect(decideDeployWrite(inputs({ recordedSha256: undefined, onDiskSha256: hex('whatever') })))
            .toBe('write');
    });

    it('writes when the path is recorded without a digest', () => {
        // Bridge entries carry `sha256: null`.
        expect(decideDeployWrite(inputs({ recordedSha256: null, onDiskSha256: hex('whatever') })))
            .toBe('write');
    });

    it('writes when the bytes on disk could not be read', () => {
        expect(decideDeployWrite(inputs({ recordedSha256: hex('ours'), onDiskSha256: null }))).toBe('write');
    });
});

describe('preserve — sidecar naming', () => {
    it('appends the tool-owned suffix rather than a bare .new', () => {
        expect(sidecarPathFor('/x/a/AGENTS.md')).toBe(`/x/a/AGENTS.md${SIDECAR_SUFFIX}`);
        expect(SIDECAR_SUFFIX).toBe('.agent-config.new');
        expect(sidecarPathFor('/x/a/AGENTS.md')).not.toBe('/x/a/AGENTS.md.new');
    });
});

describe('preserve — report wording', () => {
    const target = '/x/a/AGENTS.md';
    const sidecar = sidecarPathFor(target);

    it('names the preserved file, the sidecar, the staleness and the escape hatch', () => {
        const msg = preservedFileMessage(target, sidecar);
        expect(msg).toContain(target);
        expect(msg).toContain(sidecar);
        // The staleness clause is the half that converts a silent stale install
        // into a stated one — the objection the exit code and this line answer.
        expect(msg).toContain('the active installation is not current');
        expect(msg).toContain('--force');
    });

    it('summarises the conflict count and agrees with itself on plurality', () => {
        expect(conflictSummaryMessage(1)).toContain('1 user-modified file preserved');
        expect(conflictSummaryMessage(3)).toContain('3 user-modified files preserved');
        for (const n of [1, 3]) {
            expect(conflictSummaryMessage(n)).toContain(SIDECAR_SUFFIX);
            expect(conflictSummaryMessage(n)).toContain('is not current');
        }
    });

    it('states that nothing was staged when a foreign sidecar blocks the run', () => {
        const msg = foreignSidecarMessage(target, sidecar);
        expect(msg).toContain(sidecar);
        expect(msg).toContain('NOT staged');
    });
});

describe('preserve — exit code', () => {
    it('is distinct from success, failure and the argparse usage code', () => {
        expect(EXIT_COMPLETED_WITH_CONFLICTS).not.toBe(0);
        expect(EXIT_COMPLETED_WITH_CONFLICTS).not.toBe(1);
        expect(EXIT_COMPLETED_WITH_CONFLICTS).not.toBe(2);
    });
});
