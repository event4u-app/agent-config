<!-- evidence-type: analysis -->

# Skill delivery over MCP — inverted harvest, 2026-08-22
> **Source anonymisation (`source-confidentiality`).** External harvest sources
> are referenced as `Source A`…`Source M` rather than by org/repo name: this
> tree must not record which third-party packages seeded an idea. The real
> identifiers, their pinned revisions and their licences remain in the consumed
> inbox copy under `agents/tmp.old/`, which is gitignored and therefore
> maintainer-reachable only. Tool and product names used as *integration
> targets* (Nx, Turborepo, Storybook, shadcn, Base UI) are unaffected — naming a
> tool this package works with is not derivation-attribution.

> **Form:** ADR-211 C/D. Confirmed repo defects first; external sources are drawn
> in only where they bear on a listed defect. Sources that bear on nothing are
> recorded as nulls, not dropped.
> **Tree pinned at:** `event4u-app/agent-config@d1861bad2d276e78268d5515444b9ef36897dda2`
> (package.json `version: 14.8.0`).
> **Author:** Claude (browser session), for Matze. Everything under "Proposals"
> is a proposal and is marked as such; nothing here is adopted.

## 0. The premise, restated honestly

The user premise: *"We already have an MCP, but we load skills directly. A
skill MCP supposedly keeps context smaller."*

Both halves of that premise need correction against the tree before any
roadmap is written:

1. **"We load skills directly" is not what costs context.** Skill *bodies*
   (~595,843 tok, `agents/roadmaps/road-to-catalog-and-projection-economy.md`
   §Context table) are progressive-disclosure by the host's own design and are
   not standing cost. What *is* standing cost is the **catalogue** — name +
   description of every projected skill: **14,408 tok across 290 skills**
   (same file, same section; `ls src/skills/*/SKILL.md | wc -l` = 290 re-run
   here). Any "MCP keeps context smaller" claim is a claim about that 14.4k
   bucket, nothing else.
2. **The host already throws most of that bucket away — silently.** Claude
   Code's skill listing budget is 1% of the context window (≈8,000 chars on a
   200k model), dropping descriptions of least-invoked skills first
   (code.claude.com/docs/en/skills, fetched 2026-08-22; anthropics/claude-code
   #64606). The repo observed exactly that mechanism without naming it:
   `agents/evidence/analysis/skill-catalogue-description-delivery.md` — 414/414
   descriptions on disk, 5 of 8 sampled catalogue entries arrived **bare**. So
   "context is too big" and "skills are not found" are the *same* defect seen
   from two sides: the projection is ~6–7× over the host's listing budget, and
   the host resolves that by making most skills unroutable.

Therefore the real question is not "MCP vs. direct". It is: **which skills
must survive in the host's native listing (auto-routable), and how does the
agent reach the rest reliably?** The repo already has half an answer
(`suggest_skill_for_task`, `skill-route` hook). The defects below are about
why that half does not reach the default consumer.

## 1. Confirmed defects (each verified at the pinned commit)

| # | Defect | Provenance (file:line) | Status |
|---|---|---|---|
| D1 | **The turnkey MCP server exposes zero tools.** `agent-config mcp-server` (the documented end-user path) answers `tools/list` with `[]`. The `suggest_skill_for_task` recovery tool lives only in the contributor/kernel server. | `src/cli/mcp/dispatch.ts:10` ("`tools/list` is empty"), `:195-196` (`return rpcResult(id, { tools: [] })`); tool defined at `src/scripts/mcp_server/tools.ts:1270`; end-user path documented at `docs/getting-started-local-stdio.md:9-32` | confirmed |
| D2 | **The recovery rule points at a tool the default install cannot reach.** `missing-skill-recovery.md` (tier 2a, per-turn obligation) instructs the agent to call `suggest_skill_for_task`. On a consumer running the turnkey server, or no MCP server at all (D3), that instruction is unfulfillable. The rule does not say what to do in that case. | `src/rules/missing-skill-recovery.md:4`, `:37-39` (Iron Law), `:45-48` (step 1) | confirmed |
| D3 | **No MCP server is registered for Claude Code by default.** `mcp.json` at the repo root is `{"servers": {}}`; `mcp_render.ts` targets are `.cursor/mcp.json`, `.windsurf/mcp.json`, and opt-in Claude Desktop — **not** Claude Code's project-scope `.mcp.json`. `install.ts` contains no `mcpServers` write. So on the primary host the package's own server — lite or kernel — is not wired unless the user hand-edits config. | `mcp.json:1-3`; `src/scripts/mcp_render.ts:11-14`; `grep -n mcpServers src/scripts/install.ts` → no hits | confirmed |
| D4 | **The host's listing-budget mechanism is unknown to the repo.** No file in `src/`, `docs/`, or `agents/` mentions `skillListingBudgetFraction`, `skillListingMaxDescChars` or `SLASH_COMMAND_TOOL_CHAR_BUDGET`. The evidence note models the loss as an unexplained "per-entry" mode and explicitly declines to give a rate. The mechanism is documented upstream and is deterministic enough to be **modelled from the projection alone**: `budget ≈ context × 4 × 0.01` chars, fill by invocation frequency, 1,536-char per-entry cap. | `grep -rn skillListingBudgetFraction src docs agents` → 0 hits; `agents/evidence/analysis/skill-catalogue-description-delivery.md:36-48` | confirmed |
| D5 | **The projection is wholesale and the only trim lever is pack scope, which is measured as insufficient.** `_CLAUDE_SKILL_BUNDLE` hands the full rules+skills+commands+personas bundle to 13 hosts unchanged. `scoped` removed 71 skills and the host still stripped every description. | `src/scripts/install.ts:1916`, `:1924-1940`; `agents/evidence/analysis/scoped-projection-host-delivery.md` table (297→226 skills, 402→330 dropped) | confirmed (prior measurement, 2026-08-16) |
| D6 | **Routing signal is near zero and the ranker is keyword-overlap over description only.** Usage baseline: 337 tracked, **0 active**, 181 exposed-only, 156 dead. Earlier census: 12 invocations / 30 sessions / 4 distinct skills. The ranker scores `keyword_overlap×70 + persona×30` over `name + description` — it does **not** read the 19 skills that now declare `triggers:`. | `agents/evidence/metrics/skill-usage-report.md:9`; `skill-catalogue-description-delivery.md:14-16`; `src/scripts/skill_tools/score_skill_relevance.ts:15-21`; `grep -c "triggers:" src/skills/*/SKILL.md` → 19 skills | confirmed |
| D7 | **The kernel server's own tool surface would cost standing context if it were registered.** Allowlist tool + parameter descriptions in `tools.ts` sum to ~7,887 chars ≈ 1,972 tok (chars/4). Below Claude Code's 10% deferral threshold, so Tool Search would **not** defer them; they would load upfront. Fixing D3 naively by registering the kernel server therefore *adds* ~2k tok to the exact budget the roadmap is trying to shrink. | measured here: `node -e` over `src/scripts/mcp_server/tools.ts` description strings; threshold: code.claude.com/docs/en/agent-sdk/tool-search (fetched 2026-08-22) | confirmed (measurement), threshold = upstream doc |

Two things the tree does **right** and that every proposal below must preserve:

- `skill-route` hook already binds the ranker to `user_prompt_submit` with a
  budgeted emission (271–323 B), floors `MIN_TOP_SCORE=31` / `MIN_TASK_TERMS`,
  and ten tests (`src/scripts/hooks/skill_route_hook.ts:161`;
  `agents/evidence/reviews/feat-runtime-skill-routing.findings.md` #2, #5, #7).
  This is the deterministic, model-discipline-free route. MCP cannot replace
  it; MCP can only add a *pull* path next to this *push* path.
- `suggest_skill_for_task` refuses to return bodies and refuses to invent a
  zero from a missing catalogue (`tools.ts:1238-1251`). Keep both.

## 2. Sources, drawn in against the defects

| Source | Retrieved | Bears on | Verdict |
|---|---|---|---|
| GitBook, *MCP vs skill.md* (2026-05-27) | full | D2 (framing) | Conceptual only: MCP = transport, SKILL.md = behaviour. No token numbers, no mechanism. Confirms the hybrid is the norm, nothing more. |
| Source E (a skills-over-MCP bridge, deprecated by its own authors) | full (README) | user premise | **Deprecated by its own authors**: "no longer hosted or maintained… no longer a need for an MCP bridge" because hosts adopted skills natively. Its architecture (vector search, 3 tools, 2-package split to dodge Cursor's startup timeout) is still a useful negative: a heavy embedding backend (~250 MB, PyTorch) is exactly what this package's "zero runtime daemon" claim and deterministic-gate culture rule out. |
| Medium, *Rethinking MCP — RAG-MCP* (2026-01-01) | full | D6 | Generic "index metadata → retrieve → read body" pattern; migration checklist. The tree already implements steps 1–7. Step 8 ("instrument skill-selection accuracy") is the one this package lacks a pre-registered metric for beyond the usage collector. |
| mcpmarket.com memory-search-2 | full | none | Null. It is a session-memory search skill for a third-party plugin, unrelated to skill delivery. Recorded so it is not re-proposed. |
| layered.dev, *MCP vs Agent Skills* (2026-01-22) | full | D7, D4 | Quantifies spec-level progressive disclosure (≈100 tok per skill at startup, <5k on activation) and notes Claude Code Tool Search defers MCP schemas (85–91% reduction cited, not re-verified). Useful as a ceiling: at spec-ideal 100 tok/skill, 290 skills = ~29k tok — i.e. even a *perfect* native listing cannot hold this estate on a 200k host. Confirms that the estate-count target (289→~130) and delivery tiering are the same problem. |
| agensi.io, *How to build an MCP server for skills* | **body not retrievable** (JS-rendered; fetch returned only nav chrome) | — | Null. Nothing cited from it. |
| openreview.net `KiscKsbqeW` | **not retrievable** (bot detection on both `/pdf` and `/forum`; container `curl` returned a 101-byte stub) | — | Null. The paper is not cited anywhere below. If Matze has the PDF, it can be re-triaged; a search for the ID surfaced only unrelated tool-retrieval papers (ToolFlood, arXiv 2603.13950 — see Risk R3). |
| **aaif.io, *Skills Over MCP* (Angie Jones, 2026-06-18)** — found by search | full | D1, D3, **Risk R1** | The single most important external input. (a) MCP WG proposal **SEP-2640** serves skills as *Resources* under `skill://…`, with an optional `skill://index.json` catalogue (name, description, url) — i.e. it standardises exactly the lite server's existing `prompts/` + `resources/` shape, just under a different URI scheme. (b) **WG early experiments: models often ignored served skills and used tools directly; a server `instructions` nudge helped but adherence declined as context grew.** This is a documented falsifier of the naive "put skills behind MCP and the model will fetch them" design. Status: "pending" as of the post; not re-verified today. |
| Claude Code docs, *Extend Claude with skills* + issues #40121, #47627, #64606 | full / snippets | D4 | Documents the listing budget (1% of context, invocation-frequency fill order, 1,536-char per-entry cap, `skillListingBudgetFraction` setting, `/doctor` estimate, `--debug` warning). Gives the repo a **deterministic host model** it can compute against the projection before install. |
| Claude Code docs, *Scale to many tools with tool search* + issues #19890/#18298/#19560 | full / snippets | D7 | Tool Search defers MCP tools only above ~10% of context (auto mode; configurable `auto:N`). Reported auto-mode misfires in 2.1.x. Consequence: a small server is loaded upfront; the roadmap must either stay tiny (2–3 tools) or use `serverInstructions` as the routing hint. |
| Source F; Source G; Source H (search hits) | snippets | D6 | Three independent implementations converge on the same 3-tool shape (`find/search`, `load SKILL.md`, `read file`). One design note worth harvesting: **embed/index only `description + trigger_phrases` (~100 tok), never the body**, because body prose pollutes the search space. This maps one-to-one onto the repo's existing `triggers:` schema and is a deterministic-index fix, not an embedding fix. |
| developersdigest.tech, *Skills delivered over MCP* (2026-07-02) | snippet | framing | Same thesis as AAIF; no independent evidence. |
| codersera / stork.ai / claudefa.st (2026 practitioner posts) | snippets | D4 | Back-of-envelope: 75–150 tok per listed skill incl. XML wrapper; 15–25 skills fit the default 1% budget on 200k. Consistent with the repo's 14,408 tok / 290 ≈ 50 tok of description per skill *before* wrapper. |
| arXiv 2603.13950 *ToolFlood* (surfaced while searching for the OpenReview ID) | snippet | Risk R3 | Embedding-based top-k tool retrieval can be flooded by adversarial metadata. Not directly applicable to a local, repo-controlled skill index, but it is the strongest argument on record for keeping the ranker deterministic and the index sealed to the projected tree. |

## 3. What the sources do **not** establish

- That an MCP skill server reduces *standing* context for this package. The
  catalogue bucket is already compressed by the host; moving skills behind MCP
  reduces what the host *lists*, at the cost of the agent having to *ask*. The
  net effect on task success is unmeasured and the only controlled data point
  (AAIF WG) is negative.
- That semantic/embedding retrieval outperforms keyword ranking on this
  corpus. No source measured it on a SKILL.md estate; the repo's own 496-line
  routing matrix is the only instrument available and it has not been run
  against an alternative ranker.
- Anything from the Agensi page or the OpenReview paper.

## 4. Proposals (all marked PROPOSAL; see the roadmap for phases and verifies)

- **P1 — Ship the tool surface the rule already promises.** Promote a
  *minimal* skill-discovery surface (`suggest_skill_for_task`, `read_skill`)
  into the turnkey lite server, and register it for Claude Code via `.mcp.json`
  rendering. Keep it ≤3 tools so it stays under the Tool Search threshold by
  design and costs a measured, budgeted amount.
- **P2 — Model the host budget deterministically and tier the projection.**
  Compute, at install time, which skills would survive the host's listing
  budget; project those natively (Tier A) and the rest as MCP-reachable only
  (Tier B). Selection is data-driven (usage + triggers + pack scope), not
  hand-picked.
- **P3 — Index triggers, not prose.** Extend the ranker's term source to
  `triggers:` and make trigger coverage a ratchet, so Tier B skills are
  reachable by task phrasing even with a bare name.
- **P4 — Pre-register the falsifier before any of it ships default-on.** A
  tiered install must beat `legacy-all` on the routing matrix and on live
  invocation counts, or it stays default-off. The AAIF null is the prior.
- **P5 — SEP-2640 alignment as a tracking item only**, gated on the SEP
  merging and on a second host implementing Resources.
