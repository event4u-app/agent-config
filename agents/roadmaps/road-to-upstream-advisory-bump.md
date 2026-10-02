---
complexity: lightweight
status: draft
estate_offset_exempt: "Nothing in this change can pay for it. This branch closes road-to-behavior-vocabulary-and-runner-truth, which Iron Law 3 refuses to archive while step 1.3 stays deferred — so the one roadmap this work could have disposed is the one it is forbidden to. Every other active roadmap belongs to a parallel session. The addition is also not a plan anyone chose to start: it is the second disposition fix-what-you-see allows for a red check this branch saw and cannot fix, since npm audit reads a lockfile this branch does not touch. Shipped draft, so it adds nothing a reader has to triage, and the alternative to the line is losing the finding."
execution:
  mode: phase-checkpoints
---
# Road to upstream advisory bump

> **Source:** the `npm audit (runtime deps, high+)` step of the Static Checks
> job, observed red on `drain/behavior-vocabulary-close` at `d6080619b`
> (2026-10-01) and reproduced locally with
> `npm audit --omit=dev --audit-level=high`. Raised here rather than fixed
> there because that branch changes neither `package.json` nor
> `package-lock.json`.

## Goal

`npm audit --omit=dev --audit-level=high` exits 0 on `main`, and the Static
Checks job's audit step is green again, because the advisories are resolved
by a dependency bump that the suite still passes. Someone else can tell this
happened by running that one command.

An exception path — suppressing the finding rather than fixing it — is
deliberately NOT offered: no step implements one, and AC-1 forbids it by
construction, since it asks for the command to exit 0 rather than for the job
to be green. Deciding to suppress instead is a change to this plan, which is
the point of not leaving the door ajar in the goal.

## Phase 1 — Establish the blast radius before touching the lockfile

- [x] **1.1 Record the two advisories and who actually pulls them in.**
      `fastify` (high: request-validation bypass via skipped boolean-false
      schemas, GHSA-hwr6-493r-vm6h; header-validation bypass via incomplete
      schema case normalization, GHSA-9q9j-q6p8-xq58) and `hono` (moderate:
      `hono/jsx` renders plain strings unescaped in boundary components,
      GHSA-hxh3-vqpv-xpqv). Both are RUNTIME dependencies, which is why the
      `--omit=dev` audit sees them — but only **fastify** can trip
      `--audit-level=high`; the hono finding is moderate and is in scope here
      because it is in the same report, not because it reds the gate. Establish
      whether this package imports them directly or inherits them transitively
      — the answer decides whether a bump is ours to make or an upstream wait.
      verify: `npm ls fastify hono` names the dependency path for each.

      **Finding.** `npm ls fastify hono` on this branch:

      - **`fastify` — DIRECT.** Declared by this package in `package.json`
        `dependencies` as `"fastify": "^5.11.0"` and resolved to `5.12.5`.
        The bump is ours to make, not an upstream wait.
      - **`hono` — TRANSITIVE.** Pulled only by
        `@modelcontextprotocol/sdk@1.30.0`, both directly (`hono@4.13.12`)
        and through `@hono/node-server@2.0.12` (deduped). This package
        declares no `hono` dependency of its own, so the only lever here is
        the SDK's own range.

      **The report is wider than this step assumed.** Re-running the audit
      against the pre-bump lockfile (`1f442155a`, fastify 5.12.1 / hono
      4.13.5) names **five** fastify advisories on `<=5.12.4`, not two:
      GHSA-4mh8-r7rc-xpvc (HTTP/2 trailer DoS), GHSA-667r-xxjv-c9mm (request
      body replacement via async validation result collision),
      GHSA-p68q-wchp-6fh7 (authentication bypass via malformed URLs reaching
      encapsulated not-found handlers), plus the two this step named —
      GHSA-hwr6-493r-vm6h and GHSA-9q9j-q6p8-xq58. The hono side is the one
      moderate, GHSA-hxh3-vqpv-xpqv, on `<4.13.7`. Recorded rather than
      quietly folded in, because a reader checking this plan against the
      report would otherwise find three findings it never mentions.

- [x] **1.2 Decide whether either advisory can reach this package's code.**
      The `hono/jsx` finding is an XSS in a JSX renderer; the `fastify`
      findings are request-validation bypasses. Both describe server
      surfaces. State, with the import sites as evidence, whether this
      package runs either of them on a request path at all — an advisory
      that cannot be reached is a different decision from one that can.
      verify: the import sites, cited by `file:line`, or an explicit "no
      import site exists" with the search that establishes it.

      **Verdict — neither advisory is reachable from this package's code.**

      **fastify — NOT REACHABLE.** One runtime import site exists:
      `src/server/app.ts:22` (`import Fastify, { type FastifyInstance } from
      'fastify'`). Every other `fastify` import under `src/server/` is
      `import type` and compiles away —
      `src/server/routes/{settings,settingsChanges,workspace,ping,userMd,schema,wizard,install,discovery}.ts`.
      Both named advisories live in fastify's own JSON-schema validation
      path, which is entered only by a route registered with a `schema`
      option. **No route in this package registers one.** Request bodies are
      validated with zod inside the handler instead — the shape is
      `src/server/routes/install.ts:441-444`
      (`const schema = z.object({...}); schema.safeParse(req.body ?? {})`).
      The two `schema:` keys that do appear, `src/server/routes/settings.ts:373`
      and `:382`, are fields of a RESPONSE body, not route options. The
      header-validation finding needs a `schema.headers` declaration, of
      which there are none. The server additionally binds 127.0.0.1 only and
      rejects any `Host` outside `127.0.0.1:<port>` / `localhost:<port>` with
      HTTP 421 (`src/server/app.ts:6-9,164`), so there is no remote request
      path to bypass validation on in the first place.

      **hono — NOT REACHABLE, and never loaded.** No import site exists:
      `grep -rnI "hono" src/ scripts/` returns only the English word
      "honour"/"honor" in prose. The advisory is specific to `hono/jsx`
      boundary components, and the only file in the installed SDK that
      imports hono at all is
      `node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/honoWebStandardStreamableHttp.js`
      — an example, reached from no SDK entry point. It imports `hono` and
      `hono/cors`; `hono/jsx` appears nowhere in the SDK. This package
      imports only `@modelcontextprotocol/sdk/server/index.js`,
      `/server/stdio.js` and `/types.js`
      (`src/scripts/mcp_server/server.ts:252-254`), i.e. the stdio transport.
      hono is installed and never loaded.

      **Per-advisory verdict — the same for all six**, which is what AC-3
      asks a future reader to be able to look up:

      | advisory | package | severity | reachable here? | why |
      |---|---|---|---|---|
      | GHSA-4mh8-r7rc-xpvc | fastify | high | no | HTTP/2 trailer responses; this server is HTTP/1.1 on 127.0.0.1 |
      | GHSA-667r-xxjv-c9mm | fastify | high | no | needs a route `schema` with async validation; no route declares one |
      | GHSA-p68q-wchp-6fh7 | fastify | high | no | needs an encapsulated not-found handler; none is registered |
      | GHSA-hwr6-493r-vm6h | fastify | high | no | skipped boolean-`false` sub-schemas in fastify's JSON-schema path, which is never entered — validation is zod, in-handler |
      | GHSA-9q9j-q6p8-xq58 | fastify | high | no | needs `schema.headers`; none is declared |
      | GHSA-hxh3-vqpv-xpqv | hono | moderate | no | `hono/jsx` boundary components; `hono` has no import site here and the SDK never loads it |

      **So this is transitive-dependency hygiene, not a closed exposure.**
      Both are fixed anyway — an unreachable advisory still gets the bump —
      but the record says which it was.

## Phase 2 — Close it

- [x] **2.1 Apply the smallest bump that clears the audit.**
      `npm audit fix` reports a fix is available for both. Prefer the
      narrowest change that clears `--audit-level=high`; a major bump of
      either package is a separate decision and is not taken under this
      step.
      verify: `npm audit --omit=dev --audit-level=high` exits 0.

      **This branch applies no lockfile change, because the smallest bump
      that clears the audit was already in the tree when the step ran.**
      `e51a1dfda` ("A reader for the shadow corpus...", PR #2142, merged to
      `main` 2026-10-01 — the same day this plan was written) carried
      fastify `5.12.1 -> 5.12.5` and hono `4.13.5 -> 4.13.12`. Both are
      inside the declared `^5.11.0` range, neither is a major, and
      `package.json` is untouched — exactly the shape this step asked for.
      Confirmed an ancestor of `origin/main` with `merge-base
      --is-ancestor`.

      Fixed-version floors from the report: fastify `>=5.12.5`, hono
      `>=4.13.7`. `main` sits at or above both.

      **RED to GREEN, measured rather than asserted.** Same command, same
      flags, two lockfiles:

      | lockfile | fastify / hono | exit |
      |---|---|---|
      | `1f442155a` (pre-bump) | 5.12.1 / 4.13.5 | **1** — 2 vulnerabilities (1 high, 1 moderate) |
      | `origin/main` (this branch) | 5.12.5 / 4.13.12 | **0** — found 0 vulnerabilities |

      Taking a further bump here would be churn against an already-clean
      audit, so none is taken.

- [x] **2.2 Prove the bump did not break the suite.**
      A lockfile change touches every consumer of the bumped package, so the
      evidence is the full suite rather than a targeted file.
      verify: the project's test suite green on the bumped lockfile, and
      `npx tsc --noEmit` clean.

      **Evidence.** `npm run typecheck` (both projects — `tsconfig.json
      --noEmit` and `tsconfig.scripts.json`) exits 0, and `npx tsc --noEmit`
      alone exits 0. `npm run test:ts` (full `vitest run`, no filter):
      **1617 of 1621 files passed, 25542 of 25573 tests passed**, 2 files
      failed, 2 skipped.

      Both failures are environment artifacts of running in a deep worktree,
      not consequences of the lockfile, and neither sits anywhere near
      fastify or hono:

      - `tests/scripts/reach_doctor.test.ts:769` — the failure is the test's
        own PREMISE line, `expect(confineCredentialPath(path.resolve(REPO,
        TRAVERSAL))).toBe(false)`. `path.resolve` clamps at `/`, so a
        checkout nested eight or more directories deep lands the fixture
        back INSIDE a permitted root and the assertion stops testing
        confinement at all. Known, and reproduced in both directions on
        `origin/main` worktrees; CI checks out shallow and is green.
      - `tests/scripts/tool_probe.test.ts` — "deadline exceeded ... exactly
        one retry" saw 1 attempt instead of 2 under full-suite parallel
        load. Re-run alone: **11 of 11 passed, exit 0.** A timing flake on a
        deadline assertion, not a regression.

      Neither file imports fastify or hono, and this branch changes no
      dependency, so no lockfile edit could have produced either.

## Acceptance Criteria

- [x] AC-1 — `npm audit --omit=dev --audit-level=high` exits 0 in a clean
      checkout of `main`.
- [ ] AC-2 — The Static Checks job's audit step is green on a PR built from
      that `main`.
- [x] AC-3 — Each advisory is recorded with its reachability verdict from
      step 1.2, so a future reader can tell whether this was a real exposure
      or a transitive-dependency hygiene fix.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: agent -->

- **Risk 1 — the bump breaks a consumer, and the breakage lands on `main`.**
  A lockfile bump is the widest-blast-radius change this repository makes
  per line of diff. Mitigation: step 2.2 requires the full suite, not a
  targeted run, and the bump is the narrowest one that clears the audit.
- **Risk 2 — the advisory is unreachable and the bump is pure churn.**
  Both advisories describe server request paths. Mitigation: step 1.2
  settles reachability BEFORE the bump, so the change is made knowing which
  it is; an unreachable advisory still gets fixed, but the record says so
  rather than implying an exposure that was never there.
- **Risk 3 — a new advisory lands before this is merged and the audit stays
  red for a different reason.** Mitigation: the goal is phrased as the
  command exiting 0, not as "these two advisories", so a third one is
  in-scope for the same closure rather than a surprise at the gate.
