# Evaluator page — re-run every claim yourself

> road-to-credible-install Phase 4. Every claim the credible-install work
> repaired ships with a **standing, re-runnable check** — this page lists
> them with their commands and last-published numbers so an external
> reviewer verifies instead of re-measuring from scratch. Setup on a fresh
> clone: `npm ci && npm run build`. Numbers dated **2026-07-27** unless
> noted; each count pins its counting method (two honest methods can
> disagree — the pinned method is the one the number reproduces under).
>
> This page operates under the **publish-regardless rule**
> ([`adversarial-review-protocol` § 7](contracts/adversarial-review-protocol.md#-7--publish-regardless-rule)):
> external scores and scan results are recorded here good or bad, same
> prominence. Current external surface: the MCP evaluator score badge in
> the README links the live score page (its scoring model — 70%
> tool-definition quality / 30% coherence; server grade 60% mean + 40%
> minimum tool score — was verified against the evaluator's own published
> page and drove [ADR-132](decisions/ADR-132-stub-tools-off-the-wire.md)).

| Check | Command (fresh clone) | Last published | Method (pinned) |
|---|---|---|---|
| Runtime-dep audit | `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** (0 high / 0 critical / 0 total) | npm audit over the lockfile, dev tree excluded — the consumer install surface. CI: every PR (Static Checks) + every release PR (release-validation `audit-gate`). |
| Published-package shape | `npm run lint:publint` | All good | publint over the packed artifact. |
| No dead lifecycle scripts | `node src/scripts/prepack-check.mjs` (after `npm run build`) | lifecycle script targets OK | Gate 3: every consumer-side lifecycle script target (preinstall/install/postinstall/prepare) exists AND ships in `files[]`. Red/green: `tests/scripts/prepack_lifecycle_check.test.ts`. |
| Hook-dispatch latency | `npm run build:hooks && ./scripts-run src/scripts/bench_hook_latency --gate` | p50 76–103 ms · p95 81–103 ms per event across CI runners (budget: pre_tool_use p95 ≤ 150 ms, any event ≤ 250 ms; a darwin dev machine measures ~10 ms faster) | 50 invocations/event of `node dist/hooks/dispatch.js` with a synthetic payload, temp workspace, replay mode; recorded in [`hook-latency.json`](hook-latency.json). The 250 ms any-event cap is the BLOCKING CI gate; the 150 ms pre_tool_use cap is ADVISORY since 2026-08-19, because one unchanged commit measured that slot at p95 107, 152, 152 and 187 ms across four CI runs — a cap inside its own metric's spread decides builds on runner load rather than on code. A control-normalized excess row (bare `node -e 0` in the same run) ships observe-only and is the intended replacement. The regression net is a loose ×3 pathology catch, because two CI runs of identical code measured +23% apart (shared-runner wall-clock variance falsified a tight creep window — same rationale as the evaluator timing budgets). Was ~1.6 s p50 via the retired CLI→bash→tsx→per-concern-tsx chain. |
| Default-install context cost | see [`benchmark.md` § Default-install context cost](benchmark.md) | 283 → 212 skills · ≈577k → ≈428k tokens (−26%) | Sum of `dist/agent-src/skills/*/SKILL.md` bytes partitioned by the installer's scoped-prune predicate; tokens = chars/4 (labeled approximation). |
| MCP client compatibility | `npx vitest run tests/contracts/mcp_client_compat_stdio.test.ts` (Leg A) · Leg B network-gated, see [`mcp-client-compat.md`](mcp-client-compat.md) | Leg A green (prompts + resources consumed over real JSON-RPC) | Raw JSON-RPC against the packed stdio server; Leg B (remote raw-POST Worker) re-runs with `AC_CLIENT_COMPAT_NET=1`; a failing Leg B is the only thing that reopens the Streamable-HTTP deferral. |
| MCP catalog drift | `./scripts-run src/scripts/build_mcp_catalog --strict` | in sync | Catalog generated from the tool registry; hand-edits fail CI. |
| MCP public tool count | `tools/list` on `node dist/mcp/server.mjs` | **19** implemented, 0 stubs on the wire | tools/list length (post-[ADR-132](decisions/ADR-132-stub-tools-off-the-wire.md)); the 12 on-demand entries live in the catalog as marked documentation, not as callable tools. |
| CLI command count | `node -e "const t=require('fs').readFileSync('src/cli/registry.ts','utf-8');console.log((t.match(/\{ name: /g)||[]).length)"` | **79** | Registry enumeration (count of `{ name: '...', disposition` entries in `src/cli/registry.ts`). NOT `--help` prose parsing — independent methods historically measured 74 vs 76 vs 79; this page's number reproduces under the registry method only. |
| Consumer-internal references | `./scripts-run src/scripts/lint_consumer_internal_refs` | **0** findings (was 17 verified; the review claimed 84) | Grep-level scan of `dist/agent-src/skills/*/SKILL.md` (the consumer projection), maintainer-workspace skills excluded per ADR-013; allowlist entries carry inline rationale. |
| Pre-migration install hints | `./scripts-run src/scripts/lint_pre_migration_refs` | 0 findings | Instructional-hint patterns (pip install / python install.py / retired MCP entry) over the `files[]` whitelist; CHANGELOG/MIGRATION carve-outs (historical records). |
| Budget ownership | `./scripts-run src/scripts/lint_budget_ownership` | OK | Every `src/config/*budget*.json` carries `owner` + `review_by`; missing date fails, overdue date warns. |
| Rule-trip counts | inspect `agents/runtime/state/rule-trips.json` after a caught violation | mechanism verified (seeded `--no-verify` → block counter) | Dispatcher increments per-concern BLOCK/WARN counters; fixed-field schema (PII-exclusion-by-construction). Red/green: `tests/hooks/rule_trips.test.ts`. |
| Package size | `npm pack --dry-run --ignore-scripts` | 26.0 MB unpacked (was ~28 MB; `docs/` no longer ships except `docs/guidelines/`, and the precompiled hook/MCP bundles ~2.1 MB moved IN — the trade that bought the 23x hook-latency win) | npm's own `unpacked size` line; the umbrella gates it plus node_modules size and dep count. |
| The whole first five minutes | `task evaluator-umbrella` | green (see CI: `evaluator-umbrella.yml`, release PRs + nightly) | Containerized suite over the PACKED tarball: all of the above + cold-start budgets (CLI `--version`, MCP boot-to-initialize) + size/surface budgets from [`evaluator-budgets.json`](../src/config/evaluator-budgets.json) (>10% creep fails even under budget). |

## Reproducing a disagreement

If your measurement disagrees with a number above: check the pinned method
first (most historical disagreements were method mismatches — e.g. the
74-vs-76 CLI count). If the method matches and the number still differs,
that is a real finding — file it; per the publish-regardless rule it gets
recorded here either way.
