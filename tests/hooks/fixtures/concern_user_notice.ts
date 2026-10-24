#!/usr/bin/env tsx
// Test fixture concern — replies with a user notice; with `context`, with
// session context instead; with `echo-platform`, with a notice naming the
// `platform` of the envelope the dispatcher built.
import { readFileSync } from 'node:fs';

let raw = '';
try {
    if (!process.stdin.isTTY) {
        raw = readFileSync(0, 'utf-8');
    }
} catch {
    // ignore — draining is best-effort
}
let reply: Record<string, string> = { user_notice: 'fixture notice for the user' };
if (process.argv.includes('context')) reply = { context: 'fixture context block' };
if (process.argv.includes('echo-platform')) {
    const envelope = JSON.parse(raw || '{}') as Record<string, unknown>;
    reply = { user_notice: `platform=${String(envelope['platform'])}` };
}
process.stdout.write(JSON.stringify(reply) + '\n');
process.exit(0);
