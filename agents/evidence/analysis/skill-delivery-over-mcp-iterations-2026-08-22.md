<!-- evidence-type: analysis -->

# Iteration log — road-to-skill-delivery-over-mcp

Three passes over the same loop: read sources → verify the tree → draft →
re-search what the draft exposed → redraft. Each pass is kept here as the
delta it produced, so a reader can see which claims survived and which were
killed, and by what.

Tree pinned at `d1861bad` throughout. Dates are 2026-08-22.

## Loop 1 — the seven given sources + first repo pass

**Draft v1 thesis:** "Build a skill MCP server: semantic search over SKILL.md,
three tools (`find_skills`, `read_skill`, `read_skill_file`), move skills out
of `.claude/skills/` to shrink context."

**What the tree did to v1:**

- Killed "build a skill MCP server" — one already exists *twice*:
  `src/cli/mcp/` (turnkey, prompts+resources, **zero tools**) and
  `src/scripts/mcp_server/` (kernel, 27 tools incl. `suggest_skill_for_task`).
- Killed "move skills out to shrink context" as a *goal* — skill bodies are
  not standing cost; the catalogue bucket (14,408 tok) is, and it is already
  being truncated by the host. v1 was optimising the wrong number.
- Killed "semantic search" — K-Dense, the canonical reference for it, is
  deprecated by its authors and needed a 250 MB backend; the package's
  `package.json:4` claim is "zero runtime daemon".
- Two of seven sources were nulls (Agensi: JS-rendered, no body; OpenReview
  `KiscKsbqeW`: bot-blocked on three routes). One was off-topic
  (memory-search-2). Recorded, not dropped.

**Survived into v2:** the three-tool shape as a *minimum*, the
"index metadata not bodies" principle, the Medium post's "instrument
selection accuracy" checklist item.

## Loop 2 — re-search what v1 exposed

Queries that v1's failures demanded: (a) how does Claude Code actually
budget the skill listing; (b) does Claude Code defer MCP tool schemas and at
what threshold; (c) is there an MCP-standard way to serve skills; (d) has
anyone measured whether models use MCP-served skills.

**Found:**

- (a) Listing budget = 1% of context, fill by invocation frequency, 1,536-char
  per-entry cap, `skillListingBudgetFraction` (docs + #64606). **This names
  the mechanism behind the repo's 2026-08-08 "5 of 8 bare" observation** and
  is deterministic enough to model from the projection. → Phase 0.1, 2.1.
- (b) Tool Search defers only above ~10% of context (docs, #19890). → the
  kernel server (~1,972 tok, measured) would load upfront; a ≤3-tool lite
  surface is the only registrable shape. → 0.2, 1.1, R2.
- (c) SEP-2640 `skill://` resources + `skill://index.json` (AAIF). → tracking
  only, Phase 5; the lite server already serves the same content as
  prompts/resources.
- (d) **AAIF WG: models often ignored served skills; nudge helps; adherence
  decays with context.** → R1, and the reason Phase 4 is a pre-registered
  falsifier instead of a rollout.

**Draft v2 thesis:** "Register the lite server for Claude Code, add two tools,
tier the projection by a modelled host budget, measure before defaulting."

**What the tree did to v2:**

- Found D3 properly: `mcp.json` is empty and `mcp_render.ts` has no
  `.mcp.json` target — v1 and v2 had both assumed "we already have an MCP"
  meant "it is registered". It is not, on the primary host.
- Found D2: the per-turn rule `missing-skill-recovery.md` already instructs
  a call to the unreachable tool. v2 had treated the rule as a downstream
  nicety; it is a live defect on the default path. → 1.4.
- Found that 19 skills already declare `triggers:` and the ranker does not
  read them. → 3.1 becomes a concrete change instead of "improve ranking".
- Found the archived routing roadmap and its 13-finding review. Its fixes
  (`MIN_TOP_SCORE=31`, `MIN_TASK_TERMS`, no survivor count, no extrapolated
  host limit) are constraints v3 must not re-break. → carried verbatim into
  4.2's verify and R5.

## Loop 3 — adversarial pass against the repo's own discipline

Read v2 the way `feat-runtime-skill-routing.findings.md` read its branch.

- **Unverifiable numbers removed.** v2 quoted layered.dev's "85–91% reduction"
  as a fact; it is a third-party figure for Tool Search on MCP schemas, not
  re-verified, and irrelevant below the threshold. Now cited only as a
  ceiling with "not re-verified".
- **Adopted-vs-proposed separated.** v2's Context read as if tiering were
  the plan; v3 marks the whole file `status: proposal`, names the host model's
  upstream assumptions as assumptions (0.1), and makes the default flip a
  single gated step (4.4).
- **"Context smaller" demoted from goal to measured consequence (H2).**
  Tier A listing + a ≤600-tok server may or may not be under 14,408 tok once
  Tier A is sized to the budget; the honest metric is routable skills per
  standing token.
- **`list_skills` removed from the lite surface.** A 290-name tool result is
  the cost the roadmap exists to avoid; the host already lists names.
- **`suggest_skill_for_task` made tier-aware with an explicit unknown branch
  (3.3)** — returning Tier A from the recovery tool is noise, and a missing
  tiers file must say `unknown`, never imply "all native".
- **R3 (ToolFlood) scoped correctly.** Not applicable to a sealed local index;
  becomes applicable with org-pack injection — named the lockfile as the
  boundary instead of hand-waving "security".
- **Phase 4 given a live arm with stated N and a decay table (4.3)**, because
  the only controlled external datum is negative and a matrix-only arm would
  have let the roadmap declare victory on the instrument that cannot observe
  adherence.
- **Out-of-scope hardened:** no skill deletion, no embedding ranker, no second
  host in the live arm, kernel server untouched.

## What is still unverified after three loops

- SEP-2640 merge status (last seen "pending", 2026-06-18).
- Whether Claude Code's `auto:N` Tool Search fraction is settable from
  `.mcp.json` for the CLI (documented for the Agent SDK only).
- The exact wrapper overhead per listed skill (practitioner posts say
  75–150 tok incl. XML; the repo measures ≈50 tok of description only). 0.1
  must measure it rather than pick a number.
- The two null sources (Agensi, OpenReview). If Matze has the OpenReview PDF,
  it can be triaged in a fourth loop; nothing in v3 depends on it.
