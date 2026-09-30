import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

const BASE_ALIAS: Record<string, string> = {
    '@cli': new URL('./src/cli', import.meta.url).pathname,
    '@server': new URL('./src/server', import.meta.url).pathname,
    '@shared': new URL('./src/shared', import.meta.url).pathname,
    '@ui': new URL('./src/ui', import.meta.url).pathname,
    '@install': new URL('./src/install', import.meta.url).pathname,
};

// `AGENT_CONFIG_COLLECTOR_ABSENT=1` is the second half of
// `src/scripts/check_static_parity.ts` (roadmap step 4.2): it resolves the
// collector's denominator module to a do-nothing stub, so the dispatcher runs
// with the collector genuinely ABSENT rather than merely disabled. Unset — which
// is every normal run, local and CI — this branch does nothing at all.
const COLLECTOR_ABSENT = process.env.AGENT_CONFIG_COLLECTOR_ABSENT === '1';
const COLLECTOR_STUB = new URL('./tests/_lib/collector-absent-stub.ts', import.meta.url).pathname;

// tests/golden/sandbox/repo/** is the golden-transcript toy-repo fixture — its
// tests run only when the replay harness drives them in a temp workspace, never
// in the outer suite (mirrors the retired conftest `collect_ignore_glob`).
// Shared by both projects below: one list, so a new exclusion cannot be added
// to one project and forgotten in the other.
const SHARED_EXCLUDE = [
    'node_modules/**',
    'dist/**',
    'dist/agent-src/**',
    '.agent-src.uncondensed/**',
    'tests/golden/sandbox/repo/**',
];

export default defineConfig({
    plugins: [preact()],
    resolve: {
        alias: COLLECTOR_ABSENT
            ? [
                  ...Object.entries(BASE_ALIAS).map(([find, replacement]) => ({
                      find,
                      replacement,
                  })),
                  { find: /^.*collector_denominator\.js$/, replacement: COLLECTOR_STUB },
              ]
            : BASE_ALIAS,
    },
    test: {
        // Two projects, not `environmentMatchGlobs`, which Vitest 5 REMOVED.
        // It does not warn and it does not error — it is silently ignored, so
        // every UI test ran under `environment: 'node'` and 104 of them failed
        // on `window is not defined`. A config key that stops working quietly
        // is the whole reason this migration is a topology change rather than a
        // rename: the replacement has to be something the runner validates.
        //
        // `extends: true` inherits the plugins, aliases, setup files and
        // timeouts above, so the two projects differ in exactly two fields —
        // which files they claim and which environment they claim them in. The
        // node project subtracts the UI globs, because a file matched by both
        // would run twice and a flaky duplicate is worse than a missing one.
        projects: [
            {
                extends: true,
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
                    exclude: [...SHARED_EXCLUDE, 'tests/ui/**', 'src/ui/**'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'ui',
                    environment: 'happy-dom',
                    include: ['tests/ui/**/*.test.{ts,tsx}', 'src/ui/**/*.test.{ts,tsx}'],
                    exclude: SHARED_EXCLUDE,
                },
            },
        ],
        // Runs before every test file. Strips the ambient locale variables the
        // hook layer reads through `process.env`, so a suite cannot pass on one
        // machine's `LANG` and fail on another's — the exact failure that made
        // PR #1458 red on `macos-latest, shard 2/4` while green everywhere else.
        // Rationale and the deliberate narrowness live in the file itself.
        setupFiles: ['tests/_lib/hermetic-env.ts', 'tests/_lib/skills-dir-guard.ts'],
        // Runs ONCE, in the main process, before any worker spawns. Builds the
        // gitignored `dist/` artefacts the four e2e suites spawn, but only when
        // they are absent. On a fresh checkout those four files accounted for 31
        // of 32 local failures purely because `dist/*` had never been built; in
        // CI (`tests.yml` runs `npm run build` first) this is a no-op. Full
        // rationale, and why building beats skipping, in the file itself.
        globalSetup: ['tests/_lib/ensure-build-artefacts.ts'],
        // The python-free-env shim (tests/_lib/python-free-env.ts) is DISABLED:
        // the py2ts test-layer purge converted every live python↔tsx parity
        // block to tsx-only intent tests, so no test needs the python3 shadow.
        // Per the teardown council D3 protocol the file itself is deleted in a
        // follow-up PR after this disable has soaked ≥1 CI cycle on main.
        // PINNED, because an unpinned default is what broke this suite.
        //
        // WHAT IS VERIFIED: Vitest 5 defaults `maxWorkers` to
        // `availableParallelism() - 1` — read out of the shipped
        // `node_modules/vitest/dist/chunks/doctor.*.js`, not from the docs. And
        // the failure: on the Vitest 5 upgrade, 7 of 61 CI checks went red and
        // ALL 18 failures across the seven shards were `Test timed out in
        // 10000ms` — counted per shard (2+4+2+1+2+1+6), with no assertion error
        // anywhere in the set. Every one of the ten files is a CLI-contract test
        // that SPAWNS a `tsx` subprocess over the whole repo, so they are the
        // slowest and most contention-sensitive tests here.
        //
        // WHAT IS NOT VERIFIED: what Vitest 2's fork pool actually defaulted to.
        // It is plausibly half, which would make `'50%'` a restoration — but
        // that number was not read out of the old package, so this is NOT
        // claimed as one. What it is: halving the worker count to halve the
        // contention, on the reasoning that the tests are spawn-bound.
        //
        // WHY NOT RAISE `testTimeout`: it is a real guard on a CLI's wall-clock,
        // and widening it to absorb a concurrency change would retire the guard
        // to hide the cause. A percentage rather than an absolute count because
        // the latter is not portable between a 4-core runner and an 18-core
        // laptop. If CI still times out at 50%, the next move is a
        // per-test timeout on the spawn-bound files — named here so it is not
        // re-derived as a global raise.
        maxWorkers: '50%',
        testTimeout: 10_000,
        hookTimeout: 10_000,
        reporters: process.env.CI ? ['default'] : ['default'],
    },
});
