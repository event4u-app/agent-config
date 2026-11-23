#!/usr/bin/env tsx
// Test fixture concern — refuses with the dispatcher's block code (1).
import { readFileSync } from 'node:fs';

try {
    if (!process.stdin.isTTY) {
        readFileSync(0, 'utf-8');
    }
} catch {
    // ignore — draining is best-effort
}
process.stdout.write(JSON.stringify({ decision: 'block', reason: 'fixture block' }) + '\n');
process.exit(1);
