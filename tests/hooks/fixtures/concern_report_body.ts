#!/usr/bin/env tsx
// Test fixture concern — reports WHAT IT RECEIVED for `payload.tool_response`,
// so the payload-opt-in test (`road-to-per-turn-hook-economy` step 2.1) can
// assert the stub from the concern's own side of the stdin contract rather
// than from the dispatcher's internals.
//
// Reads through `readHookStdin` on purpose, never `process.stdin.isTTY`:
// touching that property puts fd 0 into non-blocking mode, after which a
// payload above the pipe buffer reads as empty — the measured bypass this same
// roadmap fixed in Phase 1. A fixture that reproduces it would make this test
// pass for the wrong reason.
import { readHookStdin } from '../../../src/scripts/hooks/hook_stdin.js';
import { isPayloadStub } from '../../../src/scripts/hooks/payload_stub.js';

interface Report {
    saw: 'stub' | 'string' | 'object' | 'absent' | 'other';
    bytes: number | null;
}

function report(): Report {
    let envelope: Record<string, unknown> = {};
    try {
        envelope = JSON.parse(readHookStdin()) as Record<string, unknown>;
    } catch {
        return { saw: 'absent', bytes: null };
    }
    const payload = envelope['payload'];
    if (typeof payload !== 'object' || payload === null) return { saw: 'absent', bytes: null };
    const v = (payload as Record<string, unknown>)['tool_response'];
    if (v === undefined || v === null) return { saw: 'absent', bytes: null };
    if (isPayloadStub(v)) return { saw: 'stub', bytes: typeof v.bytes === 'number' ? v.bytes : null };
    if (typeof v === 'string') return { saw: 'string', bytes: Buffer.byteLength(v, 'utf8') };
    if (typeof v === 'object') {
        return { saw: 'object', bytes: Buffer.byteLength(JSON.stringify(v), 'utf8') };
    }
    return { saw: 'other', bytes: null };
}

process.stdout.write(`${JSON.stringify({ decision: 'allow', reason: JSON.stringify(report()) })}\n`);
process.exit(0);
