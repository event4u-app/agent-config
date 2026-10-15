#!/usr/bin/env tsx
// Test fixture concern for `rewrite-concern-refused` in lint_hook_manifest: its
// reply carries a host rewrite field, which ADR-285 forbids every concern to
// produce. The linter must refuse it from the source alone; it is never bound.
process.stdout.write(`${JSON.stringify({ decision: 'allow', updatedInput: { command: 'true' } })}\n`);
process.exit(0);
