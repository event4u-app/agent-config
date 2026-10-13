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
export const VARIANTS = [
    'reference',
    'variant-defects',
    'variant-renamed',
    // Added by `road-to-a-probe-that-cannot-report-a-false-green`. The first
    // captures zero nodes on purpose — it is the empty observation the probe
    // used to report as a clean comparison; the second carries one handle the
    // reference does not.
    'reference-no-handles',
    'variant-added',
    // Added by `road-to-a-structure-reading-without-handles`. Three
    // single-change variants of the handle-free reference: each carries exactly
    // one difference, so a reading that fires on one of them cannot be crediting
    // a defect it did not isolate.
    'variant-no-handles-declared',
    'variant-no-handles-media-rule',
    'variant-no-handles-removed',
    // D11, added after an independent review of the first implementation. Two
    // pages that render the same thing and differ only in markup technique:
    // the second wraps its buttons in a `display: contents` element. Neither
    // carries a script, because neither has anything to bind to.
    'reference-boxless',
    'variant-boxless',
] as const;

/**
 * The port pair, which lives one directory up and is not laid out as a variant.
 *
 * These three files are the evidence base for the handle-free reading's two
 * registered controls — a faithful port must read as unchanged, a regenerated
 * one must not — and they are pinned by `internal/bench/ui/fixtures.lock.json`,
 * so they are READ here and never written. They carry no handle and no
 * `index.html`, which is why they need their own list rather than a sixth entry
 * above: `VARIANTS` names directories, and these name files.
 */
export const PORT_PAIR = [
    { name: 'design', rel: '../design.html' },
    { name: 'port-faithful', rel: '../port-faithful.html' },
    { name: 'port-regenerated', rel: '../port-regenerated.html' },
] as const;

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
    for (const { name, rel } of PORT_PAIR) {
        const obs = await captureVariant(path.join(HERE, rel));
        // `captureVariant` names a variant after its parent directory, which is
        // `fixtures` for all three of these. Named explicitly rather than left to
        // collide.
        obs.variant = name;
        obs.source = path.posix.join('tests/design-artifacts/fixtures', `${name}.html`);
        fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(obs, null, 2)}\n`);
        process.stdout.write(`captured ${name}: ${obs.nodes.length} node(s)\n`);
    }
    return 0;
}

main().then((c) => process.exit(c));
