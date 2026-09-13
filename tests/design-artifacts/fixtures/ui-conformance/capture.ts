#!/usr/bin/env tsx
/**
 * Re-capture the frozen observation records from a real browser.
 *
 * The records under `observations/` are what CI compares against, because CI
 * installs no browser binaries. They are a recording of a real Chromium run,
 * not a hand-written expectation — and `ui_conformance_probe.test.ts` re-runs
 * this capture live wherever a browser IS present and fails if the fresh
 * observations differ, which is what keeps them from going stale unnoticed.
 *
 * Run from the repository root:
 *   ./scripts-run tests/design-artifacts/fixtures/ui-conformance/capture
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureVariant, chromiumAvailable } from '../../../../src/scripts/ui_conformance_probe.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VARIANTS = ['reference', 'variant-defects', 'variant-renamed'] as const;

async function main(): Promise<number> {
    if (!chromiumAvailable()) {
        process.stderr.write('capture: no Chromium binary — run `npx playwright install chromium` first\n');
        return 1;
    }
    const outDir = path.join(HERE, 'observations');
    fs.mkdirSync(outDir, { recursive: true });
    for (const variant of VARIANTS) {
        const obs = await captureVariant(path.join(HERE, variant, 'index.html'));
        // The absolute source path is machine-specific; freeze it relative so the
        // record is identical on every machine that re-captures it.
        obs.source = path.posix.join('tests/design-artifacts/fixtures/ui-conformance', variant, 'index.html');
        fs.writeFileSync(path.join(outDir, `${variant}.json`), `${JSON.stringify(obs, null, 2)}\n`);
        process.stdout.write(`captured ${variant}: ${obs.nodes.length} node(s)\n`);
    }
    return 0;
}

main().then((c) => process.exit(c));
