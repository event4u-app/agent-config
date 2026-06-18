#!/usr/bin/env tsx
// Test fixture concern — emits an allow decision and exits 0.
// TypeScript twin of concern_allow.py, used by the TS-only dispatcher
// (py2ts final deletion) so the end-to-end path-traversal test can run a
// concern without python3.
import { readFileSync } from 'node:fs';

// Drain stdin so the dispatcher's pipe completes cleanly.
try {
    if (!process.stdin.isTTY) {
        readFileSync(0, 'utf-8');
    }
} catch {
    // ignore — draining is best-effort
}
process.stdout.write(JSON.stringify({ decision: 'allow', reason: 'fixture allow' }) + '\n');
process.exit(0);
