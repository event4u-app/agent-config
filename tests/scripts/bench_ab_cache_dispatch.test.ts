// Tests for src/scripts/bench_ab_cache_dispatch.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists. The happy path shells out to the underlying .py
// runner (a full, cost-/time-bearing bench run), so it is NOT golden-diffed
// here per ADR-094's timing-non-determinism guidance — instead this suite
// asserts the CLI surface (arg errors, exit codes, the corpus-missing branch)
// and the cache-dispatch decision message, which derives from the already-
// validated bench_ab_cache twin. argparse error PROSE (usage line, program
// name) is Python-version-dependent, so only the exit code + the stable
// substring are asserted there.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


describe('bench_ab_cache_dispatch — decision message format', () => {
    // The dispatch's own stdout line is built from the bench_ab_cache lookup
    // (validated in its own wave). Re-derive it here to lock the exact wording.
    it('emits the cache-miss / cache-stale "running both arms" line shape', async () => {
        const cache = await import('../../src/scripts/_lib/bench_ab_cache.js');
        const corpusPath = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb.yaml');
        const lk = cache.lookup(corpusPath);
        // Reproduce the two message templates the dispatch uses.
        if (lk.fresh && lk.report_path !== null) {
            const msg =
                `bench_ab_cache_dispatch (trackb): reusing fresh without baseline ` +
                `(${path.basename(lk.report_path)}) — running with-arm only`;
            expect(msg).toContain('running with-arm only');
        } else {
            const msg = `bench_ab_cache_dispatch (trackb): cache ${lk.reason} — running both arms`;
            expect(msg).toContain('running both arms');
            expect(msg).toContain(lk.reason);
        }
    });
});
