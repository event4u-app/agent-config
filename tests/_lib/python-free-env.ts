// Python-free test environment (py2ts teardown — Phase 5 completion).
//
// The Python→TypeScript migration removed every `src/scripts/**/*.py`. A large
// set of test files carry an obsolete migration-era "live python↔tsx parity"
// block, gated on `hasPython3()` (which probes the `python3` binary via PATH)
// and `describe.skipIf(!hasPython3())`. Those blocks compared the `.ts` twin's
// output against the now-deleted `.py` original by spawning `python3 <…>.py`.
//
// Post-migration there is no `.py` to compare against, so these blocks are
// obsolete. They are DESIGNED to skip in a python-free environment — but CI
// runners (and dev machines) ship a real `python3`, so without this setup the
// gate reports "python available", the block runs, and `python3 <deleted>.py`
// fails with FileNotFoundError.
//
// This setup enforces the migration's actual end-state — a python-free runtime
// — inside the vitest workers, so the obsolete live-parity blocks self-skip
// while the frozen-snapshot oracle tests (no live python) and the pure-TS unit
// tests run unchanged. The `.ts` twins remain fully specified by those.
//
// Scheduled follow-up: delete the obsolete live-parity blocks outright (see
// road-to-py2ts-teardown.md Phase 5). This shim is the minimal, reversible
// bridge that unblocks the python2ts→main gate without 249-file surgery.
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

// Skip on Windows: `spawnSync('python3', …)` there does not resolve an
// extensionless shell shim, and `python3` is typically absent anyway, so the
// gates already report false and the blocks already skip.
if (process.platform !== 'win32') {
    const shimDir = mkdtempSync(path.join(tmpdir(), 'py2ts-no-python-'));
    for (const name of ['python3', 'python']) {
        const p = path.join(shimDir, name);
        // Exit non-zero for every invocation (incl. `--version`) so the
        // `spawnSync('python3', …).status === 0` gates report "unavailable".
        writeFileSync(p, '#!/bin/sh\nexit 127\n');
        chmodSync(p, 0o755);
    }
    process.env.PATH = `${shimDir}${path.delimiter}${process.env.PATH ?? ''}`;
}
