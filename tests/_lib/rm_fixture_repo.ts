import { rmSync } from 'node:fs';

/**
 * Remove a fixture directory that had a git repository in it.
 *
 * `rmSync(dir, { recursive: true, force: true })` is not enough for a `.git`
 * tree and CI proved it: `ENOTEMPTY: directory not empty, rmdir
 * the .git dir of a /tmp/ratchet-baseref-XXXX fixture` on both ubuntu and macOS, on three separate
 * pull requests, while the same suite passed locally every time. The mechanism
 * is a race, not a bug in the walk — git can leave work in flight (an auto-gc,
 * an index lock, a packed-refs rewrite) after the `spawnSync` that started it
 * has returned, so a file can appear inside a directory between the moment the
 * walk empties it and the moment it calls `rmdir`.
 *
 * `maxRetries` + `retryDelay` is Node's own documented remedy for exactly this
 * class (`EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, `EPERM`), and it belongs in
 * one place rather than at each call site.
 *
 * **Population, measured rather than guessed:** 44 test files in this tree call
 * `rmSync(..., { recursive: true, force: true })` on a temp dir AND run `git` in
 * it, and none of them passed `maxRetries` before this helper existed. Only
 * `ratchet_base_ref.test.ts` has been OBSERVED failing, so only it is migrated
 * here — the other 43 are a latent population, named so the next one to flake
 * has somewhere to go instead of being diagnosed from scratch.
 */
export function rmFixtureRepo(dir: string): void {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}
