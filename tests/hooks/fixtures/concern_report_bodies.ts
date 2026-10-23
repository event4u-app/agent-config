#!/usr/bin/env tsx
// Test fixture concern — reports the `tool_input` and `tool_response` it
// received, so the payload_fields test can assert the projection from the
// concern's own side of the stdin contract. Reads through `readHookStdin` for
// the reason concern_report_body.ts states.
import { readHookStdin } from '../../../src/scripts/hooks/hook_stdin.js';

let seen: unknown = null;
try {
    const envelope = JSON.parse(readHookStdin()) as { payload?: Record<string, unknown> };
    seen = { tool_input: envelope.payload?.['tool_input'] ?? null, tool_response: envelope.payload?.['tool_response'] ?? null };
} catch {
    seen = 'unparseable';
}
process.stdout.write(`${JSON.stringify({ decision: 'allow', reason: JSON.stringify(seen) })}\n`);
process.exit(0);
