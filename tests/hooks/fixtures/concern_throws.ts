#!/usr/bin/env tsx
// Test fixture concern — crashes. Used to prove one concern's failure does not
// stop the dispatcher from running the concerns after it.
import { readFileSync } from 'node:fs';

try {
    if (!process.stdin.isTTY) {
        readFileSync(0, 'utf-8');
    }
} catch {
    // ignore — draining is best-effort
}
throw new Error('fixture concern deliberately crashed');
