#!/usr/bin/env node
/**
 * write_bundle_digest.mjs — the sidecar `dist/hooks/dispatch.sha256`.
 *
 * Step 3.1 of `road-to-a-kernel-that-guards-its-plumbing`. The dispatcher
 * verifies at runtime that the bundle it is executing is the bundle the build
 * produced, and it needs something to compare against. This writes that
 * something, in the same `npm run build:hooks` invocation that writes the
 * bundle, so the two cannot be produced separately and cannot disagree.
 *
 * Plain `.mjs` rather than a TS script under `scripts-run`: it is chained into
 * `build:hooks`, which runs before anything is compiled and on machines where
 * a `tsx` startup is pure cost. `prepack-check.mjs` sets the precedent.
 *
 * Format is one line, `<64 hex>  <basename>`, i.e. what `shasum -a 256`
 * emits — so an operator can verify the claim with a tool they already have
 * instead of trusting this script:
 *
 *     shasum -a 256 -c dist/hooks/dispatch.js.sha256
 *
 * This is NOT a signature and does not pretend to be. Anyone who can rewrite
 * the bundle can rewrite the sidecar beside it. What it defends against is the
 * hand edit — a bundle changed in place between builds, which until now
 * survived until the next build, reached every dispatch meanwhile, and was
 * invisible in a source review. `block_plumbing_writes` refuses that edit at
 * tool-call time; this catches one that arrived by some other route.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { argv, exit, stderr, stdout } from 'node:process';

const bundle = resolve(argv[2] ?? 'dist/hooks/dispatch.js');
// `dispatch.sha256`, not `dispatch.js.sha256` — the name the roadmap step
// wrote. Either works with `shasum -c`, which reads the subject filename from
// INSIDE the file rather than from the sidecar's own name, so the choice is
// free and the step's spelling wins.
const sidecar = bundle.replace(/\.js$/u, '') + '.sha256';

let bytes;
try {
    bytes = readFileSync(bundle);
} catch (err) {
    stderr.write(`write_bundle_digest: cannot read ${bundle}: ${err.message}\n`);
    // Exit non-zero: a build that produced no bundle must not report success,
    // and a sidecar written from a missing file would be a digest of nothing.
    exit(1);
}

const digest = createHash('sha256').update(bytes).digest('hex');
writeFileSync(sidecar, `${digest}  ${basename(bundle)}\n`, 'utf-8');

// Read back what was just written and confirm it describes the bundle beside
// it. An independent review called a post-build verification the
// highest-leverage addition here, and the reason is the runtime posture: a
// MISSING or unreadable sidecar is `unverifiable` at dispatch time and ALLOWS,
// deliberately, so that a consumer whose package predates the sidecar is not
// wedged. That choice means a half-written or unreadable sidecar degrades the
// check silently instead of failing anything.
//
// `prepack-check.mjs` catches it at packaging time, which covers the published
// tarball and nothing else. This covers every path that produces a bundle at
// all — local build, CI build, packaging — because it is part of producing one.
// It costs one re-read of 78 bytes.
const readBack = readFileSync(sidecar, 'utf-8');
const claimed = /^([0-9a-f]{64})\s/u.exec(readBack.trim())?.[1] ?? null;
if (claimed !== digest) {
    stderr.write(
        `write_bundle_digest: wrote ${sidecar} but read back ${claimed ?? '(unparseable)'} ` +
            `instead of ${digest} — the sidecar does not describe the bundle it was written for.\n`,
    );
    exit(1);
}
stdout.write(`write_bundle_digest: ${digest}  ${basename(bundle)} (${String(bytes.length)} bytes, verified)\n`);
