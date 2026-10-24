#!/usr/bin/env tsx
// Test fixture concern — replies with a user notice, or with session context
// when called with the `context` argument.
import { readFileSync } from 'node:fs';

try {
    if (!process.stdin.isTTY) {
        readFileSync(0, 'utf-8');
    }
} catch {
    // ignore — draining is best-effort
}
const reply = process.argv.includes('context') ? { context: 'fixture context block' } : { user_notice: 'fixture notice for the user' };
process.stdout.write(JSON.stringify(reply) + '\n');
process.exit(0);
