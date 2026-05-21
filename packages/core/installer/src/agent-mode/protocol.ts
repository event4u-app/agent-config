/**
 * Agent-mode protocol envelope helpers.
 *
 * ADR-016 § 4 mandates strict question-id sequencing; § 6 mandates a
 * `protocol_version` on every response. This module is the single
 * place that constructs response envelopes so the version and shape
 * stay consistent across commands.
 */

import type { AgentDone, AgentError, AgentQuestion, AgentResponse } from '../types.js';

export const PROTOCOL_VERSION = 1;

export interface QuestionChoice {
    readonly value: string;
    readonly label: string;
}

export interface QuestionDescriptor {
    readonly id: string;
    readonly prompt: string;
    readonly multi: boolean;
    readonly choices?: readonly QuestionChoice[];
    readonly nextCall: string;
}

export function question(desc: QuestionDescriptor): AgentQuestion {
    return {
        status: 'question',
        protocol_version: PROTOCOL_VERSION,
        id: desc.id,
        prompt: desc.prompt,
        ...(desc.choices !== undefined ? { choices: desc.choices } : {}),
        multi: desc.multi,
        next_call: desc.nextCall,
    };
}

export function done(filesWritten: number, lockfileSha256: string): AgentDone {
    return {
        status: 'done',
        protocol_version: PROTOCOL_VERSION,
        summary: { files_written: filesWritten, lockfile_sha256: lockfileSha256 },
    };
}

export function error(reason: string, ctx: { expected?: string; received?: string } = {}): AgentError {
    return {
        status: 'error',
        protocol_version: PROTOCOL_VERSION,
        reason,
        ...(ctx.expected !== undefined ? { expected_question_id: ctx.expected } : {}),
        ...(ctx.received !== undefined ? { received: ctx.received } : {}),
    };
}

/**
 * Strict question-id validator — ADR-016 § 4.
 *
 * Given the expected question id and the incoming `--answer` flag
 * payloads (`key=value` strings), return either the matched answer
 * value or an `AgentError` envelope. Returns `null` when no `--answer`
 * was passed (caller emits the question).
 */
export function matchAnswer(
    expected: string,
    answers: readonly string[] | undefined,
): { value: string } | AgentError | null {
    if (answers === undefined || answers.length === 0) return null;
    const first = answers[0];
    if (first === undefined) return null;
    const eq = first.indexOf('=');
    if (eq < 0) return error('answer_malformed', { expected, received: first });
    const id = first.slice(0, eq);
    const value = first.slice(eq + 1);
    if (id !== expected) return error('out_of_order', { expected, received: id });
    return { value };
}

export function emit(response: AgentResponse, stream: NodeJS.WritableStream = process.stdout): void {
    stream.write(`${JSON.stringify(response)}\n`);
}
