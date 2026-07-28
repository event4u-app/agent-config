---
complexity: structural
status: later
---

# Road to credible install — survive the first five minutes of an external evaluation

> **Parked in `later/` (2026-07-28, council closeout sweep — 2-round debate,
> anthropic/claude-sonnet-4-5 + openai/gpt-4o).** All 29 buildable steps are
> closed. The single remaining item — the Phase-5 post-flip cadence observation
> — is real work with deliverables (four weeks of `latest`-channel monitoring,
> analysis, a recorded met/missed note), not a passive calendar event, so it
> belongs in `later/` rather than being re-homed into `docs/releases.md` (that
> doc is the *recording* location for the findings, not the tracking mechanism).
> **Resume when** the breaking release carrying the Phase-2 scoped-projection
> flip ships (human-gated) — then wait out the four-week window and record
> met-or-honestly-missed in `docs/releases.md` § Verification with the actual
> release list (`npm view @event4u/agent-config time --json`). The open `[ ]`
> item is intentionally kept open; this roadmap is parked whole, not dropped.
>
> **Source:** external adversarial review of 9.8.0
> (`agents/tmp.old/feedback-critical-1.txt`) — fresh clone, real registry
> install, measured findings, two pre-drafted remediation plans.
> **Every measurable claim was independently re-verified** by four parallel
> in-repo verification passes (2026-07-26) before this roadmap was cut; the
> verified-baseline table below is OUR measurement, not the reviewer's.
> **Council:** AI council debate 2026-07-26 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds) converged on ONE tightly-scoped roadmap; verdicts
> inlined in § Council convergence. **Activated 2026-07-27 by maintainer decision.**

## Goal

Make a fresh `npm i @event4u/agent-config` survive the first five minutes of
a competent external evaluation: `npm audit` clean of high/critical, no dead
lifecycle scripts, hook dispatch fast enough to be a feature instead of a
liability, a default install that ships the engineering surface (not the
whole lab), MCP metadata that is generated instead of hand-rotted — and a
**published, re-runnable verification surface** so the next external
reviewer can confirm the fixes instead of taking our word. The review's
core sentence stands verified: the adoption gap is partly the correct market
response to measurable defects; fix the defects in severity order, publish
the measurements, and only then let the (separately tracked) launch happen.

## Verified baseline (own re-measurement, 2026-07-26 @ 9.8.0)

| Finding | Verified value | Verdict on review's claim |
|---|---|---|
| `npm audit` fresh install | 1 HIGH (`@fastify/static`; `^9.1.0` can never resolve to the ≥10.1.2 fix) + 3 moderate (`@hono/node-server` via MCP SDK; latest SDK still pins the vulnerable range) | CONFIRMED |
| postinstall hook | `dist/scripts/postinstall_gui.js` absent from package AND repo; nothing builds it; fails silently on every install | CONFIRMED |
| Hook dispatch latency | p50 ≈ 1.6 s per PreToolUse on a fast multi-core Mac (reviewer: 3.3–4.9 s on 1 vCPU); CLI → bash → tsx → per-concern tsx re-spawn; no precompiled path; hooks auto-registered on install | CONFIRMED (magnitude hardware-dependent) |
| `tsx` in `dependencies` | yes — and the bash dispatcher execs it at runtime, so removal is ORDER-DEPENDENT | CONFIRMED |
| Package weight | ~28 MB unpacked incl. 7.1 MB `docs/` in `files[]`; 140 MB node_modules; 214 unique transitive packages | CONFIRMED (≈) |
| Windows | 61/74 CLI commands delegate to the bash dispatcher; 63 `.sh` files; README: PowerShell/cmd unsupported | CONFIRMED |
| CLI surface | **76** commands (more than the claimed ~55), incl. all 12 install/update verbs; `install` = browser wizard with headless gate | CONFIRMED+ |
| Default projection | `projection.mode: legacy-all` — all 281 skills ship to every consumer; packs mechanism exists and is opt-in | CONFIRMED |
| npm metadata | keywords `ai-video`, `cinematic-ai-video`; description "Universal AI Agent OS" | CONFIRMED |
| Doc rot | `install.sh` references removed `scripts/install.py` (4×); `pip install agent-config[mcp]` in the hand-maintained MCP catalog + Worker fallback; stale Python MCP Dockerfile | CONFIRMED |
| Kernel context | 31,597 bytes ≈ 7,899 tokens always loaded (9 rules); full corpus ≈ 83k tokens | CONFIRMED (exact) |
| "84/281 skills reference package internals" | real count **17** | REFUTED |
| "read-only lie" in MCP | writes are a documented contract amendment (path-guarded, safety-tiered) | REFUTED as framed |
| "gitignore the 1,107 dist/ files" | dist/ is a hash-verified, installer-consumed projection BY DESIGN | REJECTED (conflicts with architecture) |
| Worker "not Streamable HTTP" | true, but a documented deferral (F2, cloud-scope contract); client-failure prediction untested | PARTIAL |
| External market claims (registry scoring weights, competitor funding/stars, aggregator counts) | NOT verified — any step built on them verifies first | UNVERIFIED |

## Council convergence (2026-07-26, claude-sonnet-4-5 + gpt-4o, 2 rounds)

- **One roadmap, not two.** The problem cluster is install-shaped and
  tightly coupled; MCP expansion, CLI-verb consolidation, Windows-native and
  the agent proposal-loop are routed or demand-gated, not bundled. 456
  roadmap files exist; this one must be execution-shaped.
- **Supply-chain hotfix is uncontested P0**, plus `publint` in the release
  gate (catches the dead-script-target class structurally). The `tsx`
  removal is ordered AFTER hook precompilation — the dispatcher execs tsx
  today.
- **Hook budget accepted**: p95 ≤ 150 ms on CI hardware, binding null
  consequence (hooks default-off + published numbers). Resident-dispatcher
  daemon REJECTED for this roadmap (new machinery under the freeze);
  precompile + single-process + lazy I/O first.
- **Scope lever = default-projection flip, not extraction.** Creative-pack
  extraction stays behind ADR-011's demand gates; the packs mechanism
  already exists — flip the default from `legacy-all` to the
  engineering-scoped profile. A skill-count target (≤120) is wrong framing;
  "default install ships only the engineering surface" is the deliverable.
- **Windows**: honest README non-goal now + "supported via MCP" story; the
  bash→TS dispatcher port is demand-gated (a named Windows adopter who
  cannot use WSL2/MCP), not scheduled.
- **MCP locks hold, with two evidence-scoped openings**: stub-by-default
  pillar stays (its telemetry revisit-trigger has not fired) BUT stubs get
  self-identifying descriptions, and the external scoring-model claim gets
  VERIFIED — if the minimum-tool weighting is real, that is
  mechanism-relevant new evidence and the pillar's revisit trigger is
  recorded as fired. Streamable-HTTP/hosted endpoint stays deferred (F2)
  unless the client-compatibility spike FAILS. Registry paperwork is
  mechanical — proceed. Capability-watch + agent proposal-loop REJECTED
  under the freeze (post-launch revisit).
- **Verification surface is part of the fix** (round-2 correction): the
  dead postinstall survived because checks were one-time, not standing.
  Every claim this roadmap repairs ships with a re-runnable check (bench
  harness, audit gate, client-compat test, generated catalog) — published,
  not maintainer-internal.
- **Cadence policy yes, version pins no**: the roadmap describes release
  TYPES (security patch, batched minor, breaking release), never version
  numbers or dates.

## Non-goals — routed or rejected

**Routed:**
- Launch execution, friction study, external listing →
  `road-to-adoption-without-narrative-debt.md` (B9 instruments exist);
  launch-decision ADR → `road-to-feedback-9.8.0-followups.md` Phase 1.
- Galawork internal dogfood study (the one named escape from
  self-referential benchmarking) → `road-to-adoption-without-narrative-debt.md`
  as its first real-usage evidence item.
- GOVERNANCE.md, FUNDING.yml, upstream-contribution trust graph, second
  maintainer → `road-to-maintainer-bus-factor.md`.
- CLI verb consolidation (76 → small public surface + `dev` namespace,
  headless-first init) → `road-to-surface-consolidation.md` (same-surface
  owner); the design questions (which verbs merge, alias policy) need that
  roadmap's utilization data, not a hotfix guess.
- MCP write/exec tool changes, bridge codegen →
  `later/road-to-mcp-full-power.md` (council-gated there).

**Rejected (council-confirmed):**
- Creative/media pack extraction into a second package — ADR-011's three
  trigger gates stand; the projection flip achieves the perception fix
  without the maintenance split.
- Gitignoring `dist/` — contradicts the hash-verified projection
  architecture the installer consumes.
- Resident hook-dispatcher daemon — new machinery under freeze; only
  reopens if precompile + single-process misses the budget.
- Capability-watch job + agent proposal-loop (M5.5–M5.7 of the review's MCP
  plan) — new subsystem under freeze; revisit after the launch decision.
- Skill-compression sweep (−30% median length) — collides with
  `preservation-guard` and the `rich` token-budget class as proposed;
  revisit only with activation evidence that length hurts triggering.
- Bulk-adding hosts to match a distributor's host count — breadth is the
  competitor's axis; conceded deliberately.
- Opt-in install-telemetry ping — worker exists, but without a consumer
  question to answer it is complexity for its own sake; demand-gated.
- "Universal AI Agent OS" stays REMOVED either way (see Phase 0) — no
  repackaging follows from it (per the parallel 9.8.0-feedback roadmap's
  positioning phase, which owns the framing text).

## Phase 0 — Supply-chain and metadata hotfix (ships as a security patch)

> Blocks everything: an external evaluation currently ends at `npm audit`.
> All items verified. No new mechanisms except standing gates.

- [x] **Bump `@fastify/static` to the patched major** (`^10.1.2`); run the
  UI-server test surface after the bump.
  *Verify:* fresh scratch install → `npm audit --omit=dev` shows 0 high/0
  critical from this package. <!-- done 2026-07-27: ^10.1.2 + v10 setHeaders(reply) API fix in src/server/app.ts; tests/server/ 233 green; npm audit --omit=dev = 0 vulnerabilities total (also cleared fast-uri/find-my-way/js-yaml/brace-expansion/hono via npm audit fix) -->
- [x] **Resolve the MCP-SDK moderate chain** — decision fork, recorded as a
  short ADR: (a) npm `overrides` for `@hono/node-server ^2.x` + MCP smoke
  test of the stdio path; if red → (b) documented risk acceptance in
  SECURITY.md with the non-reachability claim VERIFIED against our stdio
  transport usage (grep the SDK usage surface), and (c) an upstream issue on
  the SDK repo linked either way.
  *Verify:* ADR exists; audit output matches the chosen fork; upstream issue
  URL recorded. <!-- done 2026-07-27: fork (a) — ADR-131; overrides @hono/node-server ^2.0.5 (resolves 2.0.12 under SDK 1.29.0); MCP smoke green (mcp-server.e2e, mcp_server_server, mcp_parity_smoke); upstream issues linked: typescript-sdk#2531 + #2548 (already filed, not duplicated) -->
- [x] **Remove the dead postinstall hook** (`dist/scripts/postinstall_gui.js`
  does not exist and nothing builds it). If the GUI notice matters, print it
  on first CLI invocation instead. Add a **prepack assertion that every
  `package.json` `scripts.*` target referenced at runtime exists in the pack
  file list**, and add `publint` to the release gate.
  *Verify:* fresh install runs no failing lifecycle script; prepack check red
  when a script target is missing (red/green test); publint green. <!-- done 2026-07-27: postinstall removed + orphaned src/scripts/postinstall_gui.ts + test deleted; gate 3 in prepack-check.mjs via prepack_lifecycle_check.mjs; red/green in tests/scripts/prepack_lifecycle_check.test.ts (10 green); publint devDep + lint:publint + Static Checks step; install-friction baseline updated deliberately -->
- [x] **Drop `docs/` from `files[]`** (keep README, CHANGELOG, MIGRATION,
  llms.txt; ship a docs URL).
  *Verify:* unpacked size reported by `npm view … dist.unpackedSize` drops by
  ~7 MB; docs site still linked from README. <!-- done 2026-07-27: files[] now ships docs/guidelines/ ONLY (748K — runtime-consumed by MCP guideline:// resources in src/cli/mcp/content.ts); rest of docs/ (~6.4M) dropped; npm pack --dry-run: 23.9 MB unpacked (was ~28); README links the docs site; live npm view number lands with the next publish -->
- [x] **npm metadata fix**: remove `ai-video` / `cinematic-ai-video`
  keywords; replace the "Universal AI Agent OS" description with the
  doctrine-accurate framing (owned by the 9.8.0-feedback roadmap's
  positioning phase — this step only makes npm match it).
  *Verify:* `npm view` shows the new description/keywords after the next
  publish. <!-- done 2026-07-27: keywords cut; description now carries the README proof-identity anchor; .github/about.yml aligned + topics.yml ai-agent equivalent "host agent"; lint_positioning green (was red on main); CONTRIBUTING anchor example updated -->
- [x] **Standing audit gate**: `npm audit --omit=dev --audit-level=high`
  green required on every release PR (same floor status as ci-green).
  *Verify:* gate visible in the release workflow; a seeded vulnerable range
  fails it (red/green). <!-- done 2026-07-27: audit-gate job in release-validation.yml (release PRs) + npm-audit step in tests.yml Static Checks (all other PRs); red-test: seeded lodash@4.17.20 scratch package → same command exits 1; green on this tree -->
- [x] **Doc-rot sweep**: fix the 4 `install.py` references in `install.sh`,
  the stale Python MCP Dockerfile (`internal/docker/mcp-server/`), and add a
  lint for pre-migration references (python/pip install hints) in shipped
  files. (The MCP catalog pip hint dies via Phase 3's generator.)
  *Verify:* lint green; zero `install.py` / `pip install agent-config`
  references in shipped files. <!-- done 2026-07-27: install.sh (4) + install (6) comments fixed; Dockerfile ported Python 3.11 → node:20-slim running `agent-config mcp-server` (docs/setup/mcp-server-docker.md updated); pip hints killed in consumer_tool_catalog.json + worker content.ts; README/CONTRIBUTING/hermetic-install/src-install comments de-rotted; lint_pre_migration_refs green over the shipped set (carve-outs: CHANGELOG/MIGRATION), wired into rule-backstops.yml + task ci -->

**Acceptance (pre-registered):** fresh install on a clean project → 0 high /
0 critical; every remaining moderate linked to an upstream issue; no dead
lifecycle scripts; unpacked size reduced and published.
**Honest-null consequence:** if the `overrides` fork breaks the MCP smoke,
publish the incompatibility in SECURITY.md rather than silently keeping the
vulnerable range.

## Phase 1 — Hook latency: make enforcement real or switch it off

> Verified: ~1.6 s p50 per PreToolUse dispatch on fast hardware, paid on
> every tool call for every consumer with hooks installed, while only
> block-no-verify is default-on. The enforcement layer is the positioning
> differentiator — it must be fast or honestly off.

- [x] **Pre-register the budget** before optimizing: `pre_tool_use` p95 ≤
  **150 ms** on CI hardware (≤ 400 ms on a 1-vCPU reference container); no
  hook event p95 > 250 ms; regression > 20% fails the PR.
  *Verify:* budget file committed before the first optimization lands. <!-- done 2026-07-27: src/config/hook-latency-budget.json (owner + review date + honest-null consequence recorded); chunked-commit plan orders this file before the optimization chunks -->
- [x] **Precompile all hook entry points** to plain-JS dist bundles (same
  esbuild pipeline as the install bundle); the dispatcher invokes
  `node dist/…`, never tsx.
  *Verify:* zero tsx invocations in the hook hot path (grep + runtime
  probe). <!-- done 2026-07-27: build:hooks esbuild bundle → dist/hooks/dispatch.js (dispatcher + all 21 concerns statically inlined via concern_registry); CLI dispatch:hook now NATIVE (imports the bundle in-process, no bash/tsx delegation); _dispatch.bash cmd_dispatch_hook prefers `exec node dist/hooks/dispatch.js`; bundling landmine fixed (esbuild collapses import.meta.url per module → banner realpath-detects direct invocation, sets __AC_HOOKS_BUNDLE_DIRECT, rewrites argv[1] to a sentinel so inlined CLI-entry guards cannot false-fire); runtime probe: bench runs pure `node dist/hooks/dispatch.js`, no tsx -->
- [x] **Single-process dispatch**: one spawn per hook event; concerns run
  in-process; lazy state I/O (fast-path for non-matching tools touches at
  most one stat).
  *Verify:* process-count probe shows 1 child per event; disk-I/O trace on
  the fast path. <!-- done 2026-07-27: _run_concern_inproc in dispatch_hook.ts (stdin via hook_stdin override seam patched into all 21 concerns, argv swap, cwd chdir, hardened env, stdout/stderr write-capture, crash→rc3 fail-open unchanged); AGENT_CONFIG_HOOKS_ISOLATED=1 escape hatch keeps the spawn path; parity CI-enforced (tests/hooks/concern_registry_parity.test.ts); probe: in-process ~60-70ms vs ISOLATED spawn-path ~810ms per pre_tool_use event (the eliminated per-concern re-spawns); settings/manifest parse now once per event (single process) -->
- [x] **Bench harness as a standing, published gate**: 50 invocations per
  event, p50/p95 recorded in-repo per release, wired into CI — a shipped
  artifact an external reviewer can re-run, not an internal note.
  *Verify:* harness in the repo, CI-wired, numbers published in the docs. <!-- done 2026-07-27: src/scripts/bench_hook_latency.ts (50 runs/event, temp workspace, replay mode, pinned method); --gate enforces budget + >20% regression vs recorded; --update wrote docs/hook-latency.json (p50 67-80ms, p95 69-83ms across all 6 events — budget 150/250ms met); CI step in tests.yml Static Checks; local gate run green -->
- [x] **Only after the precompiled path is live**: move `tsx` from
  `dependencies` to `devDependencies` (Phase-0 item deliberately deferred to
  here — the dispatcher execs tsx until this phase lands). Sweep remaining
  runtime tsx invocations (`mcp:run` launch path included).
  *Verify:* fresh install contains no tsx in the runtime tree; all
  installed-surface commands still work. <!-- done 2026-07-27: tsx → devDependencies (npm ls tsx --omit=dev empty; baseline fixture updated deliberately); mcp:run precompiled via build:mcp-bundle → dist/mcp/server.mjs (bundle-aware _project_root + catalog path; initialize handshake green: 473 prompts/265 resources/31 tools); _dispatch.bash prefers the bundle; hooks hot path already node-only. Remaining tsx sites are dev-tree/npx-fallback only: require_tsx/exec_ts fall back to `npx tsx` for delegate maintainer commands (one-time download in a consumer, documented safety net) — no tsx in the shipped runtime tree -->

**Acceptance (pre-registered):** budget met on CI hardware; harness gates
regressions; latency numbers published.
**Honest-null consequence (binding):** if the budget is missed after
precompile + single-process + lazy I/O, hooks ship **default-off** with an
explicit opt-in flag and the measured numbers published under a "known cost"
heading. A resident-dispatcher daemon is NOT improvised as a rescue — it
would need its own scoped proposal after the freeze clears.

## Phase 2 — Default projection: ship the engineering surface

> Verified: `legacy-all` is the default; all 281 skills (incl. creative/
> video/fun packs) reach every consumer. The packs mechanism and profile
> scoping already exist — this is a default flip, not new machinery, and it
> deliberately does NOT extract packs (ADR-011 gates stand).

- [x] **Flip the default** `projection.mode` from `legacy-all` to the
  engineering-scoped profile for NEW installs (existing installs keep their
  recorded setting; the flip lands with the next breaking release and a
  migration note). Creative/media/fun packs become opt-in
  (`use --profile=…` / explicit packs).
  *Verify:* fresh default install projects only engineering-pack skills;
  opt-in path verified; upgrade preserves prior mode. <!-- done 2026-07-27: template default mode: scoped + MIGRATION.md note; scoped skill/command prune IMPLEMENTED in install.ts global deploy (the TS port never had it — _prune_modules_by generalization, packs.yml workspaces {engineering, agent-config-maintainer} + requires closure + runtime.active_packs, untagged=core kept, fail-safe full-tree on any error, AGENT_CONFIG escape via use --profile=legacy-all); upgrade-compat: existing file or missing key = legacy-all; tests: active-set computation, predicate, mode resolution incl. corrupt-YAML fail-safe, real-registry sanity (video-director pruned / systematic-debugging kept), hermetic global-install smoke green (236 tests) -->
- [x] **Publish the before/after context cost** with the existing benchmark
  command (default-install token load before vs after) as the proof exhibit.
  *Verify:* numbers in the benchmark doc, claims-ledger entry if a public
  number is cited. <!-- done 2026-07-27: docs/benchmark.md § Default-install context cost — 283→212 skills, ≈577k→≈428k tokens (−26%), counting method pinned (same predicate as the installer prune, chars/4 honesty-labeled); no README/marketing citation → no ledger marker needed; audit_initial_context flagged 31 MCP tools >25 soft cap as side-evidence for the stub verdict -->
- [x] **Escalation rule:** if the flip breaks a documented consumer
  contract or CI gate, stop and take it to a council round (potential
  lock-revisit) instead of forcing it.
  *Verify:* rule stated in the migration note. <!-- done 2026-07-27: pre-registered in MIGRATION.md § Migrating past 9.8 (escalation-rule paragraph) -->

**Acceptance:** fresh install ships the engineering surface only; the full
catalog remains one explicit opt-in away; token delta published.

## Phase 3 — MCP hygiene: generated truth, honest stubs, registry paperwork

> Locks respected: stub-by-default pillar, 2026-07-07 tool-cut verdict,
> ADR-111/112, Worker read-only + F2 deferral. What proceeds is drift-kill,
> honesty labeling, mechanical listings — and two evidence-scoped probes
> that may legitimately fire existing revisit triggers.

- [x] **Generate `consumer_tool_catalog.json`** via a `build:mcp-catalog`
  step derived from the tool registry (same `--write`/`--strict` pattern as
  the discovery builder); hand-edits fail CI; the dead
  `pip install agent-config[mcp]` hint (catalog + Worker fallback) dies with
  the first generation run.
  *Verify:* zero hand-edited MCP metadata; strict mode red on drift
  (red/green); no pip string in the shipped package. <!-- done 2026-07-27: src/scripts/build_mcp_catalog.ts (--write/--strict, mirrors build_discovery_manifest.ts's CLI contract) derives every entry from ALLOWLIST (src/scripts/mcp_server/tools.ts) + STUB_TOOLS (new src/scripts/mcp_server/tool_catalog_source.ts); npm run build:mcp-catalog + CI gate in tests.yml Static Checks (`--strict`); red/green test tests/scripts/build_mcp_catalog.test.ts (tampered-copy + missing-file red cases via a path-override seam, real committed file green); install_hint_stdio derived from package.json name — no pip string anywhere -->
- [x] **Stub honesty, pillar intact**: every `not_implemented` stub
  self-identifies in its description (e.g. a leading "[stub — implemented on
  demand]" clause) and carries honest MCP tool annotations
  (`readOnlyHint` etc.) on the implemented set.
  *Verify:* catalog-parity tests assert the stub marker; annotations on 100%
  of implemented tools. <!-- done 2026-07-27: generator prefixes every implemented_on:[] entry's description with the literal "[stub — implemented on demand] " marker; BuiltinTool.side_effect (new field) drives annotations.readOnlyHint on every implemented (ALLOWLIST) entry via to_mcp_tool_meta + the generated JSON; tests/scripts/audit_mcp_tools.test.ts new describe block asserts 100% stub-marker on stubs / 0% on implemented / 100% readOnlyHint-present on implemented; tests/scripts/mcp_server_tools.test.ts golden-envelope test extended for the new annotations key -->
- [x] **Verify the external scoring-model claim** (tool-definition quality
  weights, minimum-tool weighting) against the evaluator's published
  documentation BEFORE acting on it. Reviewer alignment 2026-07-26: the
  reviewer states the model IS sourced from the evaluator's own published
  score pages (70% tool-definition quality / 30% coherence; server grade =
  60% mean + 40% MINIMUM), so confirmation is the EXPECTED outcome and the
  stub-self-identification marker mitigates transparency, not the
  minimum-drag — plan for the revisit, but the verification step still
  runs first (evidence, not testimony). If confirmed, record it as
  mechanism-relevant new evidence against the stub-by-default pillar's
  cost side and open the pillar's revisit (council round) — do not
  silently eradicate stubs.
  *Verify:* verification note committed; either "claim unconfirmed — pillar
  untouched" or the scheduled revisit council. <!-- done 2026-07-27: CONFIRMED against glama's own score page (70/30 + 60% mean + 40% minimum, quoted verbatim); verification note in agents/settings/contexts/mcp-scoring-model-verification.md; revisit trigger recorded as fired; revisit council round OPENED same day (debate running); stubs not touched pending the verdict -->
- [x] **Client-compatibility falsification spike, shipped as a re-runnable
  test — TWO legs** (second leg added 2026-07-26 per reviewer alignment:
  the F2 question is a REMOTE-transport question; a stdio-only spike would
  rest the F2 disposition on the wrong measurement). Leg A: does the
  current stdio server's prompt/resource surface actually get consumed by
  the major MCP clients in-session? Leg B: do mainstream remote clients
  connect to the Worker in its CURRENT raw-POST form at all? Both
  published as runnable checks (not one-time notes) so they re-run when
  clients update. The results SCOPE the MCP positioning claim; a failing
  leg B (remote clients genuinely cannot connect) is the evidence that
  reopens the F2 (Streamable HTTP) deferral — not the review's assertion.
  *Verify:* both test artifacts in-repo + documented results; positioning
  text matches the measured results; F2 reopened only on a failing leg B. <!-- done 2026-07-27: tests/contracts/mcp_client_compat_stdio.test.ts (leg A, spawns dist/mcp/server.mjs falling back to tsx __main__.ts) — 7/7 green, real content over real stdio (473 prompts / 265 resources); tests/contracts/mcp_client_compat_remote.test.ts (leg B, network-gated on AC_CLIENT_COMPAT_NET=1 + MCP_WORKER_URL) — mechanism verified against a local mock server, but the REAL production run is still outstanding: this sandbox has no access to the CI-only CLOUDFLARE_WORKER_SUBDOMAIN secret, so leg B has not yet executed against the live Worker; docs/mcp-client-compat.md records this honestly with the exact re-run command. F2 stays un-reopened (correct — an un-run leg B is neither pass nor fail). Follow-up: a maintainer or CI run with MCP_WORKER_URL set closes the outstanding real-production probe. -->
- [x] **Registry paperwork (mechanical)**: `mcpName` in package.json,
  `mcp-name` README marker, `server.json` emitted by the existing
  registry-manifest builder with a CI version-equality check, resolve the
  tracked schema-bump blocking the official-registry submission, flip the
  two `pending` tracking-sheet rows, fix or retire the stale Python MCP
  Dockerfile (retire unless the Docker catalog listing is pursued this
  cycle).
  *Verify:* tracking sheet has zero stale `pending` rows; server.json
  version == package version in CI; official-registry listing state
  recorded (listed, or the concrete blocker documented). <!-- done 2026-07-27: mcpName in package.json + mcp-name README marker; schema bump (3rd registry id mcp-official-registry, listing_format server-json, registries bounds 2→3) per mcp-submission-checklist; dist/mcp/server.json emitted by build:mcp-manifest; lint_mcp_registry_manifest now gates server.json version==package.version AND name==mcpName (runs in prepack --strict chain + task ci); Dockerfile already ported (Phase 0, kept — Docker catalog not pursued this cycle); tracking rows: no stale pendings — every pending row now carries its concrete documented blocker (human web-form / mcp-publisher interactive auth = Hard-Floor outward actions) -->
- [x] **Windows story via MCP**: README states plainly — native
  PowerShell/cmd unsupported for the file install (WSL2), the MCP stdio
  path is the supported Windows surface. The bash→TS dispatcher port is
  recorded as demand-gated (a named Windows adopter who cannot use
  WSL2/MCP reopens it).
  *Verify:* README section present; demand gate recorded. <!-- done 2026-07-27: README § Requirements › Windows (WSL2 for file install, `npx -y @event4u/agent-config mcp-server` as the native surface, demand gate named); stale "Python 3.10+ bridge" requirement line removed in the same block (ADR-200 rot) -->

**Acceptance:** MCP metadata fully generated; stubs self-identify; scoring
claim verified-or-dismissed on evidence; client spike result published and
binding on positioning; registry rows closed.

## Phase 4 — Published verification surface (the trust fix)

> Round-2 council correction: the dead postinstall survived because checks
> were one-time. Everything this roadmap fixes gets a standing, published,
> re-runnable check — so the NEXT external reviewer verifies instead of
> re-measuring from scratch, and drift of the same class cannot recur
> silently.

- [x] **One "evaluator page"** in the docs listing the re-runnable checks
  with their commands and last-published numbers: audit gate, publint,
  prepack script-target assertion, hook-latency harness (p50/p95),
  default-install token cost, MCP client-compat tests, catalog drift gate.
  Generated where possible, never hand-rotted. **Every count pins its
  counting method** (e.g. CLI command count: registry enumeration vs
  `--help` output yielded 74 vs 76 in two independent measurements — the
  page states which method its number uses so it reproduces exactly). The
  page cites the **publish-regardless rule**
  (`docs/contracts/adversarial-review-protocol.md` § 7) and records
  external scores/scan results under it — good or bad, same prominence.
  *Verify:* page exists, each row's command reproduces on a fresh clone,
  each count names its method, the publish-regardless citation is present. <!-- done 2026-07-27: docs/evaluator.md — 15 rows incl. commands + last-published numbers + pinned methods (CLI count pins the registry method, 74/76/79 divergence stated); publish-regardless cites adversarial-review-protocol § 7 and records the external-score surface + ADR-132 linkage -->
- [x] **Decouple the 17 internal-referencing skills** (verified count; the
  review claimed 84): replace maintainer-internal path/task references in
  consumer-projected skills with the existing indirections or drop them;
  add the grep-level lint to `lint-skills` so the count cannot silently
  regrow.
  *Verify:* lint green at 0 findings in the consumer projection. <!-- done 2026-07-27: 16 real offenders (recalibrated from the 17 estimate; reviewer's 84 was uncalibrated grep) decoupled in src/skills + dist twins via consumer-safe indirections (node_modules paths, CLI verbs, dropped repo-test citations); lint_consumer_internal_refs pins 0 (workspace-aware, ADR-013 maintainer-skill carve-out, allowlist with inline rationale); wired into rule-backstops.yml + task ci; check-refs + lint-skills + condensation green -->
- [x] **Claims hygiene for the fixed numbers**: the repaired surfaces
  (audit-clean, hook latency, default-install size) enter the claims ledger
  with `exec:`-style or pointer evidence per the house rules — no marketing
  number without a backing check.
  *Verify:* claims check green; no unbacked number on the new surfaces. <!-- done 2026-07-27: 3 backed ledger entries (install-audit-clean → CI-gate pointer; hook-dispatch-latency → hook-latency.json; default-install-context-cost → benchmark.md section); exec-evidence denominator re-derived (27→30); check_claims green -->

**Acceptance:** an external evaluator can re-run every claim this roadmap
makes from the evaluator page alone.

## Phase 5 — Release cadence policy (types, not versions)

> 126 versions / 9 majors in 94 days reads as "no contract". Policy change,
> no version pinning in this roadmap.

- [x] **Publish the cadence contract** (CONTRIBUTING/RELEASES doc): security
  patches anytime; minors batched (at most ~weekly); breaking releases rare
  and bundled with migration notes; the stability surface (config formats,
  CLI verbs, hook protocol, installed-tree layout) named explicitly.
  *Verify:* contract published; release workflow references it. <!-- done 2026-07-27: docs/releases.md (types table, channels, 4-surface stability list, registry-observable verification); publish-npm.yml channel-routing step cites it; CONTRIBUTING points to it -->
- [x] **`latest` / `next` dist-tag split**: experiments publish to `next`;
  `latest` receives only the batched, contract-respecting line.
  *Verify:* both tags live on the registry; release workflow routes by
  type. <!-- done 2026-07-27: publish-npm.yml resolves the dist-tag from the version shape (semver prerelease → --tag next, plain → latest); contract in docs/releases.md. The live `next` tag appears on the registry with the first next-channel publish — routing is in place, publishing itself stays Hard-Floor-gated -->
- [ ] **Post-flip cadence check** (observational): after the breaking
  release that carries the Phase-2 flip, the first four weeks on `latest`
  stay within the contract; result recorded (met or honestly missed).
  *Verify:* recorded note with the actual release list.
  <!-- BLOCKED (time-gated, 2026-07-27): the observation window physically
       opens only when the breaking release carrying the Phase-2 flip ships
       (cutting a release is Hard-Floor, human-gated) and closes four weeks
       later. Everything buildable is built (contract in docs/releases.md,
       dist-tag routing live in publish-npm.yml, the verification command is
       `npm view @event4u/agent-config time --json`). Record the result in
       docs/releases.md § Verification when the window closes. -->

### Blockers

- **post-flip-observation-window** (owner: maintainer) — blocks the single
  Phase-5 observational step above, nothing else (all 29 buildable steps
  are closed).
  - **What to do:** ship the breaking release that carries the
    scoped-projection flip (human-gated), wait out the four-week `latest`
    window, then record met/missed in `docs/releases.md` § Verification
    with the actual release list.
  - **Resolved when:** the recorded note exists with the release list for
    the window.

**Acceptance:** contract public; dist-tags live; first observation window
recorded honestly.

## Phase 6 — Outside-in umbrella gate (added 2026-07-26 per the self-critical council cut)

> Extension decided by the 2026-07-26 self-critical council (see
> `road-to-self-critical.md`): the individual gates from Phases 0–4 get one
> standing, containerized umbrella so the evaluator's "first five minutes"
> run as ONE suite on the PACKED artifact — never the checkout — on every
> release PR and nightly. Budget VALUES are frozen from the measured
> acceptance numbers of Phases 0–3, never invented.

- [x] **Containerized umbrella harness**: one task that runs, in a clean
  container against the packed tarball: audit gate, tarball/script-target
  integrity + publint, headless install, staleness lint, hook-latency
  bench, cold-start budgets (CLI `--version`, `mcp-server`
  boot-to-initialize), size budgets (unpacked, node_modules, dep count;
  regression >10% fails even under budget), surface budgets (default
  `--help` count, public MCP tool count — frozen from post-Phase-3 values),
  npx smoke of the first-touch paths.
  *Verify:* suite green on a release-shaped branch; each check individually
  red-testable; wired into the release PR path and a nightly schedule. <!-- done 2026-07-27: src/scripts/evaluator_umbrella.sh (9 sections over the PACKED tarball: audit, publint+prepack, headless tarball install, staleness lints, hook bench, cold-start/size/surface measurements → check_evaluator_budgets vs evaluator-budgets.json, npx smoke); FULL RUN GREEN locally end-to-end; .github/workflows/evaluator-umbrella.yml (release PRs + nightly 03:17 UTC + dispatch, clean node:20 container); task evaluator-umbrella; red-testable via per-gate tests + check_evaluator_budgets red/green (5 tests); budgets frozen from measured values (26.05MB unpacked incl. the deliberate +2.1MB bundles, 127MB node_modules, 187 deps, 19 MCP tools, 79 registry commands; timing metrics carry a 200% creep override — absolute caps bind, sizes/counts keep 10%) -->
- [x] **Budget ownership lint**: every budget in the gate config carries an
  owner and an annual review date; a budget without a review date fails the
  lint (anti-ossification).
  *Verify:* lint red on a seeded date-less budget. <!-- done 2026-07-27: lint_budget_ownership over src/config/*budget*.json (owner + review_by; overdue warns, missing fails); red/green unit tests incl. seeded date-less budget; wired into rule-backstops.yml + both task ci lists -->
- [x] **Checkable-rule trip counting** (scoped P3 cut): existing
  gates/hooks record violation-caught trips per rule into the evidence
  tree — extends existing machinery only; NO LLM-sampled prose audits
  (rejected under the freeze; post-launch candidate).
  *Verify:* trip counts appear after seeded violations; no new
  free-form-content field (PII-exclusion-by-construction). <!-- done 2026-07-27: _record_rule_trips in dispatch_hook.ts (BLOCK/WARN concerns → agents/runtime/state/rule-trips.json; fixed-field schema concern→{block,warn,last_trip}, atomic write, fail-open, replay-skipped); tests/hooks/rule_trips.test.ts: seeded --no-verify violation increments block counter, clean dispatch writes nothing, schema field-set pinned (5 green); evidence tree consumes via the evaluator page's generated report -->

## Acceptance criteria (roadmap-level)

1. Fresh registry install: 0 high/0 critical audit findings, no dead
   lifecycle scripts, docs/ not shipped — all gated, not just fixed
   (Phase 0).
2. Hook dispatch meets the pre-registered budget with a standing published
   harness, OR hooks are default-off with published numbers (Phase 1) — no
   third state.
3. Default install ships the engineering surface; full catalog opt-in;
   token delta published (Phase 2).
4. MCP metadata generated; stubs self-identify; registry rows closed;
   positioning scoped to the measured client-compat result; locks reopened
   only via their own recorded triggers (Phase 3).
5. Every repaired claim has a re-runnable, published check; the
   17-internal-references count is lint-pinned at 0 (Phase 4).
6. Cadence contract + dist-tags live; no version numbers pinned anywhere in
   this roadmap (Phase 5).
7. Nothing rejected in § Non-goals was smuggled back in without its named
   gate firing.
8. The outside-in umbrella runs as one containerized suite on release PRs +
   nightly, with owner-dated budgets and rule-trip counting (Phase 6).
