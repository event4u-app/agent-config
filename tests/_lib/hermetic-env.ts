/**
 * Global test setup — neutralise the ambient environment the suite must not read.
 *
 * WHY THIS EXISTS, measured rather than assumed. PR #1458 went green on two
 * developer machines and on every ubuntu shard, then failed on
 * `Node Tests (macos-latest, shard 2/4)` with three `expected 2 to be +0` in
 * `language_mirror_hook.test.ts`. Cause: those tests call
 * `run(envelope(…), { consumer_root: tmp })` with no `env`, so the hook's
 * `systemLocaleVerdict(options.env ?? process.env)` read the RUNNER's locale.
 * macOS CI exports an English `LANG`; the developer machines and the ubuntu
 * images did not. The system-locale fallback therefore fired only there, wrote a
 * pin, and returned 2 instead of 0.
 *
 * Reproduced locally in one command before this file was written:
 *
 *     LANG=en_US.UTF-8 npx vitest run tests/scripts/language_mirror_hook.test.ts
 *     → the same 3 failures
 *
 * THE SHAPE, not the three symptoms. That file makes 88 `run()` calls and only 7
 * pin `env`, so 81 of them read the ambient locale and were passing by accident
 * of where they ran. Patching the three that happened to fail would have left
 * the class intact and the next locale-sensitive assertion would fail on the
 * next machine. A test that reads `process.env` is invisibly broken on the
 * machine whose environment happens to suit it — the same "never seen red, so
 * sensitivity unknown" hazard the four-process lock test exists to avoid.
 *
 * WHAT IS NEUTRALISED, and the boundary. Only the locale variables the hook
 * layer reads. This is deliberately NOT a blanket `process.env = {}`: the suite
 * legitimately depends on `CI`, `HOME`, `PATH`, `EVENT4U_CONFIG_HOME` and the
 * replay flag, and clearing those would trade a locale flake for a much larger
 * one. Tests that WANT a locale keep passing one explicitly — the
 * `systemLocaleVerdict({ LANG: 'de_DE.UTF-8' })` cases are unaffected, because
 * an explicit argument never consults the environment.
 *
 * `delete` rather than a fixed value: `systemLocaleVerdict` returns `und` for an
 * absent locale and a real verdict for `C`/`POSIX` on some readings, so absent
 * is the only value that means "no ambient answer" without asserting which
 * answer a neutral locale gives.
 */

/** The locale variables `systemLocaleVerdict` consults, highest precedence first. */
export const NEUTRALISED_LOCALE_VARS = ['LC_ALL', 'LC_MESSAGES', 'LANG', 'LANGUAGE'] as const;

for (const name of NEUTRALISED_LOCALE_VARS) {
    delete process.env[name];
}

// Same shape as the locale problem above, different variable. The council
// spend ledger resolves its path from the user-global configuration home ONCE,
// at import time (`budget_guard.ts`'s `LEDGER_PATH` is a module constant), and
// nothing pinned that home — so a test exercising a billable seat appended to
// the developer's REAL ledger, recording test traffic as spend.
//
// Pinned here rather than in a `beforeEach`: this file is a `setupFiles`
// entry, which is the only window that precedes a module-level constant.
//
// Set rather than deleted — deleting it falls back to `~/.event4u/
// agent-config/`, the real home this exists to avoid. One directory per worker
// process, so parallel shards never share a ledger.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * The variable `user_global_paths.event4u_root()` honours first.
 *
 * Deliberately a literal, NOT an import of `user_global_paths.ts` (tried and
 * reverted): this file is a vitest `setupFiles` entry, loaded once per worker
 * before any test file's own `vi.mock('node:os', ...)` factory is wired up.
 * `user_global_paths.ts` imports `node:os` at module scope, so pulling it in
 * here pre-caches that module graph with the REAL `os.homedir()` — and a test
 * file that mocks `node:os` to assert HOME-derived resolution (e.g.
 * `tests/server/serverInfo.test.ts`) then silently reads the real homedir
 * instead of its own mock, because the already-evaluated module keeps its
 * live binding to the real implementation. `tests/scripts/hermetic_env.test.ts`
 * guards the drift this literal risks instead: it asserts this string equals
 * `user_global_paths.EVENT4U_HOME_ENV` from an ordinary (non-setup) test file,
 * where importing that module has no such side effect.
 */
export const CONFIG_HOME_VAR = 'EVENT4U_CONFIG_HOME';

/**
 * The temporary configuration home this process is pinned to.
 *
 * Exported so a test can assert that a write landed INSIDE it — the only way
 * to tell "the ledger was not written" from "the ledger was written somewhere
 * else".
 */
export const HERMETIC_CONFIG_HOME: string = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), `agent-config-home-${String(process.pid)}-`),
);

process.env[CONFIG_HOME_VAR] = HERMETIC_CONFIG_HOME;
