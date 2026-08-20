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
