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
    // 20 x 100 ms, raised from 10 x 50 ms. The smaller budget was not enough:
    // the same ENOTEMPTY came back on a later PR with this helper ALREADY in
    // the stack trace, so 500 ms is inside the window a CI runner needs and
    // 2 s is outside it on the evidence so far. A retry budget is a guess
    // about somebody else's scheduler; it is raised on a measurement, and this
    // sentence is the measurement.
    rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

/**
 * Git config that stops the race instead of retrying through it.
 *
 * `rmFixtureRepo` above treats the SYMPTOM — it waits for git to finish. This
 * removes the most common reason git is still working: `git commit` can trigger
 * `gc --auto`, which detaches and keeps writing inside `.git` after the
 * `spawnSync` that started it has already returned. With auto-gc and background
 * maintenance off, that particular writer never exists.
 *
 * Not a replacement for the retry budget, and deliberately so: an index lock or
 * a packed-refs rewrite can still be in flight, so the two layers cover
 * different halves and neither makes the other redundant.
 *
 * Apply per fixture repo, right after `git init`:
 *
 *     for (const [k, v] of FIXTURE_GIT_CONFIG) git('config', k, v);
 */
export const FIXTURE_GIT_CONFIG: ReadonlyArray<readonly [string, string]> = [
    ['gc.auto', '0'],
    ['maintenance.auto', 'false'],
    ['commit.gpgsign', 'false'],
];
