#!/usr/bin/env tsx
// Test-only probe: prints the env vars the spawn rig is supposed to control, so
// `wave8g_home_isolation.test.ts` can assert on what a CHILD actually sees
// rather than on what the parent intended to pass.
process.stdout.write(
    JSON.stringify({
        HOME: process.env['HOME'] ?? '',
        EVENT4U_CONFIG_HOME: process.env['EVENT4U_CONFIG_HOME'] ?? '',
    }) + '\n',
);
