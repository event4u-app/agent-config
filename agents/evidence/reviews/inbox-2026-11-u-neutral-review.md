<!-- evidence-type: original-review -->

# Neutral review — round inbox-2026-11-u (2026-11-03)

Independent reviewer: a fresh subagent session (L1: another session, same model)
with no access to the implementers' reasoning, commissioned by the orchestrator
over the whole delta `git diff origin/main...HEAD` of branch
`analysis/inbox-2026-11-u`.

## Prompt (verbatim, as sent)

> Review a code change in the repo event4u/agent-config. Reply in English.
> Read-only: write no files, run no git commands that modify state, no network.
>
> Worktree: …/agent-config-wt-inbox-2026-11-u. The change under review is
> `git diff origin/main...HEAD` there (branch analysis/inbox-2026-11-u). Ignore
> generated projections (dist/, .augment/, .claude/, .cursor/, .clinerules/,
> .windsurfrules, docs/maintainers/doc-path-inventory.md,
> agents/roadmaps-owned.md, src/domains/*/pack.yaml token counts, llms.txt)
> except to check they are consistent with their sources.
>
> Scope: the whole delta. Areas include src/scripts/mcp_render.ts,
> src/install/hostConfigMerge.ts, src/scripts/install.ts,
> src/install/conflict.ts, src/scripts/_lib/production_reach.ts,
> src/scripts/check_step_production_reach.ts,
> src/scripts/report_production_reach.ts,
> src/scripts/_lib/reconstruction_ledger.ts, src/scripts/reconstruction_ledger.ts,
> src/scripts/check_web_launch_readiness.ts, src/scripts/_lib/html_tags.ts,
> src/scripts/web_launch_crawlers.ts, src/config/crawler-register.json,
> src/config/web-launch-readiness.json, src/cli/mcp/dispatch.ts,
> src/scripts/mcp_server/server.ts, src/scripts/_lib/fact_diff.ts,
> src/scripts/detect_ai_tells.ts, src/scripts/bench_humanizer_eval.ts,
> src/scripts/check_claims.ts and _lib/claims_stale_verified.ts,
> src/config/gate-violation-baselines.json, plus the skill/guideline/contract doc
> edits and the tests.
>
> Report findings: correctness bugs, data-loss risks in config writers, behaviour
> regressions for consumers, security issues, tests that cannot fail or assert
> the wrong thing, gate changes that weaken a check, docs that contradict code.
> For each: file:line, the concrete failure scenario, severity
> (critical/high/medium/low). Verify each finding by reading the code (and
> running a targeted `npx vitest run <file>` if useful) before reporting it. If
> you find nothing in an area, say which areas you read.

## Verdict

No critical or high findings; 594/594 tests in the 22 touched test files pass.
Four medium and six low findings, each fixed in this PR (see the fix commit
series on `impl/inbox-2026-11-u-fix`) except mcp:render re-sorting foreign keys,
which is cosmetic and documented.

**On the test weakening in `tests/install/conflict.test.ts`** (4 assertions
removed): the reviewer read `src/install/conflict.ts` and reported "no remaining
callers of the removed helpers". The removed assertions tested
`parseJsonLenient` and `mergeJsonContent`, which step 1.4 of
`road-to-a-ledger-that-can-say-no` deleted as dead code (test-only callers,
`grep` → 0). A test of deleted code is removed with it; no behaviour lost its
check.
