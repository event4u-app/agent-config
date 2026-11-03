---
complexity: standard
status: ready
tree_pin: f9054d0f10
review_by: 2026-12-15
relates: []   # scanned: 1259 roadmap file(s), 0 sibling hits
estate_offset_exempt: "Operator-directed in the invocation (2026-11-03: analyse the round, then process its roadmaps with /roadmap:process-full and land them in one PR); archived in the same PR when its open work closes, so the active count on landing is unchanged. Owner search at f9054d0f10 (grep -rlF for check_web_launch_readiness, NOINDEX_RE, BLANKET_DISALLOW_RE, isError, suggest_skill_for_task over agents/roadmaps/*.md, later, stubs) found no roadmap owning gate correctness or the lite MCP error shape; the SEO recipes land on later/road-to-breadth-with-depth 5.6."
---
# Road to verdicts the markup cannot flip

> **Source:** `agents/tmp.old/inbox-2026-11-u/` (topic T2, supplied plan v3 plus transcript).
> **Arrivals:** 1 — `inbox-2026-11-u` (2026-11-03).

## Goal

A verdict depends on what the input says, never on its form. The web-launch gate
reads HTML and `robots.txt` with order-dependent regexes, so the same page is a
critical defect or clean depending on attribute order, and a deliberate AI
training block reads as a staging leftover. The lite MCP server reports errors
as success and lets a response grow without bound. Done means: reordered
attributes give the same verdict, a training-only block is not critical, and an
error comes back as `isError: true`.

## Verified at the pin (probes under `agents/runtime/tmp/t2-probe/`)

| Claim | Verdict | Evidence |
|---|---|---|
| `content="noindex" name="robots"` passes | reproduced (false green) | `src/scripts/check_web_launch_readiness.ts:438` |
| `content="none"` and `name="googlebot"` pass | reproduced | `:438` |
| reordered description / canonical read as missing | reproduced (false red) | `:595`, `:686` |
| second canonical and substring host match pass | reproduced | `:686`, `:692-693` |
| training-only `Disallow: /` is critical | reproduced | `:441`, `:485` |
| lite server hard-codes `isError: false` | reproduced | `src/cli/mcp/dispatch.ts:245` |
| `limit` unbounded (104 rows / 54 KB) | reproduced | `dispatch.ts:197-200,289` |
| `structuredContent` without `outputSchema` | reproduced | `dispatch.ts:244` |
| kernel stub calls return success | still-true (code read) | `src/scripts/mcp_server/tools.ts:1785`, `server.ts:405` |
| `llms.txt` carries no links | reproduced | `src/scripts/generate_catalog.ts:112` |

Already fixed since the source's pin: kernel annotations carry all four hints
(`src/scripts/mcp_server/annotations.ts:41`). Never true: `zod-to-json-schema`
as a dependency — use zod v4's native export.

## Phase 1 — One attribute reader, red first

- [x] **1.1 Form-variant fixtures.** `tests/fixtures/web-launch/form-variants/` <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      with the eight probes, cases in
      `tests/scripts/check_web_launch_readiness.test.ts`.
      verify: at the pin the seven defect cases fail and the control passes.
      Done: eight fixtures + README checked in; at the pin 7 cases fail, the control passes.
      production entry: `src/scripts/check_web_launch_readiness.ts`
- [x] **1.2 Shared reader.** Move `tagsOf` / `attr` from <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/html_tags.ts -->
      `web_launch_third_party.ts` into `src/scripts/_lib/html_tags.ts`, widen to
      `meta|link|title`, accept unquoted values.
      verify: unit tests for order, quotes, case, whitespace, self-closing,
      unquoted, `data-src` ≠ `src`; third-party tests stay green.
      Done: tagsOf/attr/titleOf live in src/scripts/_lib/html_tags.ts with a tag-set parameter; 12 unit cases + third-party suites green.
      production entry: `src/scripts/check_web_launch_readiness.ts`
- [x] **1.3 Replace the three order-dependent regexes** (robots meta incl. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/crawler-register.json -->
      `none` and search-crawler names, description, title).
      verify: 1.1 cases for these go green; grep for the construct -> 0 sites.
      Done: robots meta (incl. none and register search-crawler meta names), description, title, viewport and charset read via the shared reader; the four meta form-variant cases green; grep for `<meta[^>]+` / `<link[^>]+rel` / `<title[^>]*>` in the gate and web_launch_* -> 0 sites.
      production entry: `src/scripts/check_web_launch_readiness.ts`
- [x] **1.4 Canonical.** Every canonical collected; conflicting or relative ones <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/crawler-register.json -->
      flagged; hosts compared exactly via `new URL`.
      verify: the two canonical probes produce their finding; `clean-marketing`
      stays silent.
      Done: every rel=canonical collected; relative and conflicting canonicals flagged; hosts compared exactly via new URL against sitemap <loc> hosts; both canonical probes fire, clean-marketing silent.
      production entry: `src/scripts/check_web_launch_readiness.ts`
- [x] **1.5 `robots.txt` groups.** Blanket `Disallow: /` is critical only for <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/crawler-register.json -->
      `*` or a search crawler; a training-only block never is.
      verify: the training-block probe yields no critical finding; the staging
      leftover stays critical.
      Done: robots.txt read as user-agent groups; blanket Disallow: / critical only for * or a live search-crawler row; training-block probe clean, staging-leftover still critical (web_launch_crawlers.test.ts, 19 cases).
      production entry: `src/scripts/check_web_launch_readiness.ts`
- [x] **1.6 Metamorphic invariance and coverage pairs.** Variants (attribute <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/web-launch-readiness.json -->
      order, quotes, case, whitespace) of every fixture keep their verdict;
      every check id has a firing and a silent fixture.
      verify: the test fails on a missing pair or a flipped verdict.
      Done: check_web_launch_readiness_invariance.test.ts rewrites every unit-corpus fixture four ways (attribute order, quotes, case, whitespace) and requires an identical verdict, plus a firing and a silent fixture per check id; run against the pre-fix gate it fails 18 cases.
      production entry: `src/scripts/check_web_launch_readiness.ts`

## Phase 2 — Checks that say what they rest on

- [x] **2.1 `basis: {level, ref, checked_at}` on all 13 checks.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/web-launch-readiness.json -->
      verify: `npx vitest run tests/scripts/web_launch_readiness_config.test.ts` -> 0 and
      and the test fails on a check without `basis`.
      Done: basis {level: official|heuristic|estate, ref, checked_at} on all 15 checks (the 13 plus 2.3's two); official refs cite the page read; loadConfig refuses a check without a usable basis; config test -> 0 and its new case fails on a check without basis.
      production entry: `src/scripts/check_web_launch_readiness.ts`
- [x] **2.2 Crawler register.** `src/config/crawler-register.json` (token, <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/crawler-register.json -->
      operator, purpose, `affects_search_inclusion`, source URL, `checked_at`,
      `review_by`); a lapsed row reads `unknown`; 1.3 and 1.5 read it.
      verify: schema test rejects a row without source or date; `--as-of` past
      `review_by` yields `unknown`.
      Done: src/config/crawler-register.json with 11 rows, each from the operator's own page read 2026-11-03 (Google, OpenAI, Anthropic, Apple); Bingbot omitted — its official page did not render. Schema test rejects a row without source or date; a spawned run with --as-of past review_by reports unknown.
      production entry: `src/scripts/check_web_launch_readiness.ts`
- [x] **2.3 `snippet-eligibility` and `structured-data-parses` checks** (no type <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/web-launch-readiness.json -->
      scoring).
      verify: firing and silent fixture each, under 1.6.
      Done: both checks in the config and IMPLS; snippet-blocked/ and structured-data-broken/ fire, clean-marketing (now with valid JSON-LD) is silent; both covered by 1.6's pairs and variants.
      production entry: `src/scripts/check_web_launch_readiness.ts`

## Phase 3 — MCP answers that say what happened

- [x] **3.1 Lite `isError: true`** for `error`, `not_found`, `no_catalogue`; <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/mcp/dispatch.ts -->
      `structuredContent.status` unchanged; CHANGELOG behaviour note.
      verify: `npx vitest run src/cli/mcp/dispatch.test.ts` -> 0 asserting each
      error path.
      Done: toolTextResult sets isError from the payload status (error, not_found, no_catalogue); status unchanged; dispatch.test.ts -> 0 with one case per error path; CHANGELOG sentence handed to the release owner (this branch does not edit CHANGELOG.md).
      production entry: `src/cli/mcp/stdio.ts`
      reach exempt: liteToolsTokenCost and LITE_TOOLS_TOKEN_CAP are budget figures only the cap test reads; isError is set in dispatch(), served by src/cli/mcp/stdio.ts
- [x] **3.2 `limit` maximum 20** in schema and server, `clamped_from` reported. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/mcp/dispatch.ts -->
      verify: `npx vitest run src/cli/mcp/dispatch.test.ts` -> 0 with a case
      calling limit 100000 and getting ≤ 20 rows, and
      `npx vitest run tests/scripts/mcp_lite_tools.test.ts` -> 0 under the cap.
      Done: SUGGEST_LIMIT_MAX = 20 in the published schema and the handler; limit 100000 returns 20 rows with clamped_from: 100000; dispatch.test.ts -> 0, mcp_lite_tools.test.ts -> 0 at 311 of 600 tokens.
      production entry: `src/cli/mcp/stdio.ts`
      reach exempt: liteToolsTokenCost, LITE_TOOLS_TOKEN_CAP and INSTRUCTIONS_BYTE_CAP are budget figures only the cap test reads; the clamp itself is in dispatch(), served by src/cli/mcp/stdio.ts
- [x] **3.3 `outputSchema` from one zod schema**, kept open. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/mcp/dispatch.ts -->
      verify: every `structuredContent` validates against the shipped schema;
      tools/list stays under the token cap (a raise is a budget decision, not
      taken here).
      Done: SUGGEST_OUTPUT and READ_SKILL_OUTPUT (zod looseObject) shipped as outputSchema via z.toJSONSchema, never additionalProperties: false; ajv validates the structuredContent of all seven success and error paths; tools/list costs 527 of 600 tokens, cap unchanged.
      production entry: `src/cli/mcp/stdio.ts`
      reach exempt: liteToolsTokenCost and LITE_TOOLS_TOKEN_CAP are budget figures only the cap test reads; outputSchema is served by tools/list in dispatch(), reached from src/cli/mcp/stdio.ts
- [x] **3.4 Kernel stubs answer `isError: true`**, envelope unchanged; amend <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/mcp_server/server.ts -->
      `docs/contracts/mcp-tool-stub-envelope.md`.
      verify: `npx vitest run tests/scripts/mcp_server_serve.test.ts` -> 0 with the
      stub case asserting `isError`.
      Done: toCallToolResult answers isError: true for a not_implemented envelope, body unchanged; the default stdio registry no longer serves stubs (ADR-132), so a served stub name already failed as an unknown tool — both pinned in mcp_server_serve.test.ts -> 0 (9 cases); contract amended.
      production entry: `src/scripts/mcp_server/__main__.ts`

## Phase 4 — `llms.txt` in its own format

- [x] **4.1 Render H1, blockquote and `## Skills` with one link per skill.** No <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/generate_catalog.ts -->
      visibility claim; serving it from the site is a separate owner step.
      verify: generator test asserts the structure; consistency CI green.
      Done: render_llms_txt emits one H1, a blockquote summary and ## Skills with one - [name](dist/agent-src/skills/<name>/SKILL.md): description line per skill, no visibility claim; generator test asserts the structure; llms.txt regenerated (docs/skills-catalog.md picked up one stale description); task consistency -> 0. Serving it from the site stays a separate owner step.
      production entry: `src/scripts/generate_catalog.ts`

## Not in this roadmap

- Paid keyword / rank / backlink data, an AI-visibility tracker, an own crawler
  or Search Console adapter, a new SEO capability family — owner-gated (spend,
  accounts, domain-adoption gates).
- SEO recipes and guardrails — `later/road-to-breadth-with-depth` 5.6.
- `tests/fixtures/web-launch-benchmark/` stays untouched; whoever edits the
  checks is ineligible to freeze that benchmark's protocol.

## Decisions

| # | Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|---|
| D1 | The active-estate addition is covered by the invocation and offset by archiving this file in the same PR | park in `later/` | the operator asked for execution in this run | a step cannot close in this PR → carry it |
| D2 | `isError: true` on error paths ships as a behaviour change with a CHANGELOG line | keep `false`, add a field | the MCP result contract says a failed tool call is an error; `status` stays for readers that use it | a consumer depends on `isError: false` |


## Risk Register

| Risk | Mitigation |
|---|---|
| 3.1 is a consumer-visible wire change | `status` unchanged; CHANGELOG entry |
| 3.3 pushes tools/list over its cap | stop and surface, never raise silently |
| 1.3 changes verdicts on real sites | that is the fix; 1.6 pins it |
