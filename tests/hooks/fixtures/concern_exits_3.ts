#!/usr/bin/env tsx
// Test fixture concern — exits 3, the dispatcher's "could not decide" band.
//
// Distinct from `concern_throws.ts` on purpose. An uncaught throw leaves exit
// code 1, which IS a verdict (`EXIT_BLOCK`) and reaches a different branch; the
// dispatcher synthesises rc 3 itself for an in-process crash, a spawn timeout
// and a missing script. This fixture reproduces that band directly, which is
// the only way to exercise the severity resolution over the spawn path.
import { readFileSync } from 'node:fs';

try {
    if (!process.stdin.isTTY) {
        readFileSync(0, 'utf-8');
    }
} catch {
    // ignore — draining is best-effort
}
process.stderr.write('fixture concern could not decide\n');
process.exit(3);
