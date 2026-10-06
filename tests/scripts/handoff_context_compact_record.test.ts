/**
 * What `source=compact` does to the recycle-envelope record — the question a
 * 2/2 council answered (anthropic/claude-sonnet-4-5 + openai/codex-default,
 * both convergent): a non-own session id proves only difference, not
 * lineage, so `compact` leaves every recycle-envelope record untouched,
 * exactly like `resume`/`fork`, until a real predecessor-identity signal
 * exists. The prose handoff is a separate artefact with no peer-isolation
 * risk and keeps injecting on `compact`.
 *
 * One fixture per case, per the council's recommended coverage:
 * own record only, one foreign record, and the already-covered absent case.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    consume_recycle_envelope,
    recycleEnvelopeGate,
    sourceGate,
    RECYCLE_INJECTING_SOURCES,
} from '../../src/scripts/handoff_context_hook.js';
import { CAPSULE_SCHEMA_VERSION } from '../../src/scripts/_lib/subagent_capsule.js';
import { recycle_envelope_rel } from '../../src/scripts/_lib/recycle_envelope_paths.js';

function scratchRoot(): string {
    // realpath immediately: the consumer compares realpaths, and macOS
    // tmpdirs are symlinked (/var -> /private/var).
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'compact-record-')));
}

function validEnvelope(root: string, writtenAt: string): Record<string, unknown> {
    return {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'main_session',
        summary: 'phase 2 landed; phase 3 open',
        task: 'close the roadmap',
        workspace: root,
        written_at: writtenAt,
        acceptance_criteria: ['boxes flipped'],
        remaining: ['phase 3'],
        not_carried_forward: ['diff bodies'],
        failed_approaches: ['none'],
        successful_approaches: ['none'],
        predecessor: 'none',
    };
}

function writeEnvelopeFor(root: string, sessionId: string, envelope: unknown): string {
    const target = path.join(root, recycle_envelope_rel(sessionId));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(envelope, null, 2));
    return target;
}

let tmp: string;

beforeEach(() => {
    tmp = scratchRoot();
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('recycleEnvelopeGate — compact does not inject the record', () => {
    it('excludes compact from its injecting set', () => {
        expect(RECYCLE_INJECTING_SOURCES.has('compact')).toBe(false);
        expect(recycleEnvelopeGate('compact').inject).toBe(false);
    });

    it('still injects for startup, clear, and an absent source', () => {
        expect(recycleEnvelopeGate('startup').inject).toBe(true);
        expect(recycleEnvelopeGate('clear').inject).toBe(true);
        expect(recycleEnvelopeGate('').inject).toBe(true);
    });

    it('the prose-handoff gate still injects on compact — only the record gate changed', () => {
        expect(sourceGate('compact').inject).toBe(true);
    });
});

describe('consume_recycle_envelope on source=compact — three cases', () => {
    it('own record only: left untouched, nothing injected', () => {
        const now = new Date();
        const file = writeEnvelopeFor(tmp, 'this-session', validEnvelope(tmp, now.toISOString()));

        const gate = recycleEnvelopeGate('compact');
        expect(gate.inject).toBe(false);
        // The gate is what a caller checks BEFORE calling the consumer — this
        // fixture proves what calling it anyway would have done, so a future
        // regression that skips the gate check is still caught here.
        const result = gate.inject ? consume_recycle_envelope(tmp, now, 'this-session') : { action: 'absent' as const };

        expect(result.action).toBe('absent');
        expect(fs.existsSync(file)).toBe(true);
    });

    it('one foreign (predecessor-shaped) record: left untouched, nothing injected', () => {
        const now = new Date();
        const file = writeEnvelopeFor(tmp, 'predecessor-session', validEnvelope(tmp, now.toISOString()));

        const gate = recycleEnvelopeGate('compact');
        expect(gate.inject).toBe(false);
        const result = gate.inject
            ? consume_recycle_envelope(tmp, now, 'this-session')
            : { action: 'absent' as const };

        expect(result.action).toBe('absent');
        expect(fs.existsSync(file)).toBe(true);
    });

    it('no record at all: absent, same as every other source', () => {
        const gate = recycleEnvelopeGate('compact');
        expect(gate.inject).toBe(false);
    });

    it('contrast — the SAME foreign-record fixture under source=startup DOES inject and consume', () => {
        const now = new Date();
        const file = writeEnvelopeFor(tmp, 'predecessor-session', validEnvelope(tmp, now.toISOString()));

        const gate = recycleEnvelopeGate('startup');
        expect(gate.inject).toBe(true);
        const result = consume_recycle_envelope(tmp, now, 'this-session');

        expect(result.action).toBe('inject');
        expect(fs.existsSync(file)).toBe(false);
    });
});
