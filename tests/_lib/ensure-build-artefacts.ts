/**
 * Build the gitignored artefacts the e2e suites assert on, if they are absent.
 *
 * ## The failure this removes
 *
 * Measured on a fresh worktree, 2026-08-20: a full local run reported
 * `32 failed | 15515 passed`, and **31 of the 32 came from one cause** —
 * `dist/cli/agent-config.js` and `dist/ui/index.html` do not exist. `dist/*` is
 * gitignored (`.gitignore:178`), so a clean checkout has never built them:
 *
 *   - `tests/cli/cli-e2e.test.ts` (11)
 *   - `tests/cli/settings.e2e.test.ts` (9)
 *   - `tests/cli/mcp-server.e2e.test.ts` (8)
 *   - `tests/ui/build.test.ts` (3)
 *
 * Every one passes the moment the artefacts exist — verified by building and
 * re-running the four files: `32 passed`. So these were never test defects and
 * never regressions; they were a test asking a question about an artefact
 * nobody had produced. That is the same SCOPE defect shape as a test asserting
 * over the developer's live working tree: it tells the truth about the wrong
 * question, and the remedy is a fixture boundary rather than a relaxed
 * expectation.
 *
 * ## Why build rather than skip
 *
 * Skipping would satisfy "not red" and lose the coverage, and it would make a
 * clean checkout and a built checkout produce DIFFERENT results — the exact
 * property the roadmap's acceptance criterion forbids. Building makes them
 * produce the same result, which is the criterion met rather than dodged.
 *
 * It is also the house pattern, not a new one: `cli-e2e.test.ts`'s own
 * `beforeAll` already builds the gitignored discovery manifest when absent, for
 * this reason in these words — "CI checkouts don't carry it — build it once so
 * the e2e suite exercises the real artefact instead of the missing-manifest
 * error path". This applies that to the artefacts the same suites spawn.
 *
 * ## Why `globalSetup` and not `beforeAll`
 *
 * Vitest runs test FILES in parallel workers. Four files need these artefacts,
 * so a per-file `beforeAll` would race four concurrent builds onto the same
 * output paths. `globalSetup` runs once in the main process before any worker
 * starts, so there is no race to guard against — no lockfile, no mutex.
 *
 * ## Deliberate limits
 *
 * ABSENT, never STALE. A developer holding a deliberately old build keeps it;
 * this only fills in what was never produced. Detecting staleness would mean
 * owning a dependency graph over `src/`, which the build tools already own and
 * which would rebuild on every run.
 *
 * In CI this is a NO-OP by construction: `.github/workflows/tests.yml` runs
 * `npm run build` before `npm run test:ts`, so the artefacts always exist and
 * nothing here fires. A genuinely broken build therefore still fails at the CI
 * build step — it cannot hide behind this shim. Locally a broken build now
 * surfaces as this script's own build error, which names the failing target
 * instead of reporting a missing file four files later.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** `[artefact that proves the target ran, npm script, what needs it]` */
const TARGETS: ReadonlyArray<readonly [string, string, string]> = [
    ['dist/cli/agent-config.js', 'build:cli', 'tests/cli/*.e2e.test.ts, tests/cli/cli-e2e.test.ts'],
    ['dist/ui/index.html', 'build:ui', 'tests/ui/build.test.ts, tests/cli/settings.e2e.test.ts'],
    ['dist/mcp/server.mjs', 'build:mcp-bundle', 'tests/cli/mcp-server.e2e.test.ts'],
];

export default function setup(): void {
    const root = process.cwd();
    for (const [artefact, script, consumers] of TARGETS) {
        if (existsSync(resolve(root, artefact))) {
            continue;
        }
        process.stderr.write(
            `[ensure-build-artefacts] ${artefact} missing — running \`npm run ${script}\` ` +
                `(needed by ${consumers})\n`,
        );
        try {
            execFileSync('npm', ['run', script, '--silent'], {
                cwd: root,
                stdio: ['ignore', 'ignore', 'inherit'],
            });
        } catch (err) {
            // Fail LOUD and name the target. Swallowing this would put the suite
            // back where it started, with four files reporting a missing file
            // and nothing saying why.
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(
                `[ensure-build-artefacts] \`npm run ${script}\` failed, so ${artefact} ` +
                    `is still absent and ${consumers} cannot run: ${msg}`,
            );
        }
    }
}
