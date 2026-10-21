#!/usr/bin/env tsx
// Test fixture concern — injects a stored entry back into the session the way
// hot context and a handoff do (`context` at session start) and the way memory
// recall does (`additional_context` on a prompt). The entry comes from
// EGRESS_TEST_STORED so no value sits in this file.
import { readHookStdin } from '../../../src/scripts/hooks/hook_stdin.js';

const stored = process.env['EGRESS_TEST_STORED'] ?? '';
let event = '';
try {
    event = String((JSON.parse(readHookStdin()) as { event?: unknown }).event ?? '');
} catch {
    event = '';
}
if (event === 'session_start') {
    process.stdout.write(`${JSON.stringify({ decision: 'allow', reason: 'stored entry', context: stored })}\n`);
    process.exit(0);
}
process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: 'recalled', additional_context: stored })}\n`);
process.exit(2);
