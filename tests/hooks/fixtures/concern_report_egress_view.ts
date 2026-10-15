#!/usr/bin/env tsx
// Test fixture concern — reports which view of the envelope it received: whether
// the planted value (passed by the test in EGRESS_TEST_PLANTED) or a placeholder
// token appears in the prompt and in the tool input. Booleans only, so a failing
// assertion never prints the planted value.
import { readHookStdin } from '../../../src/scripts/hooks/hook_stdin.js';
import { parseTokens } from '../../../src/scripts/_lib/egress_token.js';

const planted = process.env['EGRESS_TEST_PLANTED'] ?? '\u0000never';
let text = '';
try {
    const envelope = JSON.parse(readHookStdin()) as { payload?: Record<string, unknown> };
    const p = envelope.payload ?? {};
    text = JSON.stringify([p['prompt'] ?? null, p['tool_input'] ?? null]);
} catch {
    text = '';
}
const report = { sawPlanted: text.includes(planted), sawToken: parseTokens(text).length > 0 };
process.stdout.write(`${JSON.stringify({ decision: 'allow', reason: JSON.stringify(report) })}\n`);
process.exit(0);
