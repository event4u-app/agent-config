/**
 * Tests for the agent-mode JSON envelope (ADR-016 § 4, § 6).
 *
 * Asserts protocol_version pinning, optional-field omission via
 * exactOptionalPropertyTypes, and strict question-id sequencing in
 * the answer matcher.
 */

import { describe, expect, it } from 'vitest';

import {
    PROTOCOL_VERSION,
    done,
    emit,
    error,
    matchAnswer,
    question,
} from '../src/agent-mode/protocol.js';

describe('agent-mode protocol envelopes', () => {
    it('PROTOCOL_VERSION is 1', () => {
        expect(PROTOCOL_VERSION).toBe(1);
    });

    it('question() emits the canonical shape', () => {
        const q = question({
            id: 'q1.workspaces',
            prompt: 'Which workspaces does this project need?',
            multi: true,
            choices: [
                { value: 'engineering', label: 'Engineering' },
                { value: 'finance', label: 'Finance' },
            ],
            nextCall: 'init --agent --answer q1.workspaces=engineering,finance',
        });
        expect(q.status).toBe('question');
        expect(q.protocol_version).toBe(1);
        expect(q.id).toBe('q1.workspaces');
        expect(q.multi).toBe(true);
        expect(q.choices).toHaveLength(2);
        expect(q.next_call).toContain('--answer q1.workspaces=');
    });

    it('question() omits choices when undefined', () => {
        const q = question({
            id: 'q2.profile',
            prompt: 'Pick a profile',
            multi: false,
            nextCall: 'init --agent --answer q2.profile=php',
        });
        expect('choices' in q).toBe(false);
    });

    it('done() embeds the summary payload', () => {
        const d = done(42, 'a'.repeat(64));
        expect(d.status).toBe('done');
        expect(d.protocol_version).toBe(1);
        expect(d.summary.files_written).toBe(42);
        expect(d.summary.lockfile_sha256).toHaveLength(64);
    });

    it('error() omits optional context when not provided', () => {
        const e = error('manifest_missing');
        expect(e.status).toBe('error');
        expect(e.reason).toBe('manifest_missing');
        expect('expected_question_id' in e).toBe(false);
        expect('received' in e).toBe(false);
    });

    it('error() includes expected/received when provided', () => {
        const e = error('out_of_order', { expected: 'q1.workspaces', received: 'q2.packs' });
        expect(e.expected_question_id).toBe('q1.workspaces');
        expect(e.received).toBe('q2.packs');
    });
});

describe('matchAnswer — strict question-id sequencing', () => {
    it('returns null when no answers are provided', () => {
        expect(matchAnswer('q1.workspaces', undefined)).toBeNull();
        expect(matchAnswer('q1.workspaces', [])).toBeNull();
    });

    it('returns the value when ids match', () => {
        const result = matchAnswer('q1.workspaces', ['q1.workspaces=engineering,finance']);
        expect(result).toEqual({ value: 'engineering,finance' });
    });

    it('returns an out_of_order error when ids mismatch', () => {
        const result = matchAnswer('q1.workspaces', ['q2.packs=php']);
        expect(result && 'status' in result && result.status).toBe('error');
        if (result && 'status' in result) {
            expect(result.reason).toBe('out_of_order');
            expect(result.expected_question_id).toBe('q1.workspaces');
            expect(result.received).toBe('q2.packs');
        }
    });

    it('returns answer_malformed on missing `=`', () => {
        const result = matchAnswer('q1.workspaces', ['q1.workspaces-engineering']);
        expect(result && 'status' in result && result.status).toBe('error');
        if (result && 'status' in result) {
            expect(result.reason).toBe('answer_malformed');
        }
    });

    it('handles empty values after the equals sign', () => {
        const result = matchAnswer('q1.workspaces', ['q1.workspaces=']);
        expect(result).toEqual({ value: '' });
    });
});

describe('emit', () => {
    it('writes a single line of JSON terminated by newline', () => {
        const chunks: string[] = [];
        const sink: NodeJS.WritableStream = {
            write: (data: string | Uint8Array) => {
                chunks.push(typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));
                return true;
            },
        } as NodeJS.WritableStream;

        emit(done(0, 'c'.repeat(64)), sink);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.endsWith('\n')).toBe(true);
        const parsed = JSON.parse(chunks[0]!.trim());
        expect(parsed.status).toBe('done');
        expect(parsed.protocol_version).toBe(1);
    });
});
