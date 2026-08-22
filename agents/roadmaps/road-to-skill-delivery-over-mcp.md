---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "FLIPPED TO READY on the owner's explicit instruction, 2026-08-22 — the estate charge this key said would wait for the owner's flip is now due, because the owner has taken that decision for every draft the previous /analyze:inbox run landed. What the key covers from here is the +1 active_roadmaps the flip itself creates, un-offset on that instruction; the file files no blockers, so open_blockers is unchanged. The draft-era text that follows is kept as history and no longer describes this file: Ships status: draft, so the estate charge waits for the owner's flip. Nothing to offset: its subject — how the skill catalogue reaches the host at all — is covered by no active roadmap, and its own harvest establishes that the two existing MCP servers are the reason a third must NOT be built. Landed by /analyze:inbox with six of seven defects re-verified at 577bdbf88."
---
# Road to skill delivery over MCP — without losing the skills the host can still route

> **Corrected on landing (`/analyze:inbox`, 2026-08-22):** frontmatter said
> `status: proposal`, which is not in the vocabulary — `update_roadmap_progress.ts:97`
> recognises exactly one draft value (`draft`), so the file read as an ACTIVE
> roadmap and tripped three gates at once: `check_estate_count` (active 17 → 18),
> `lint_plan_risk_register` (drafts are exempt, non-drafts are not) and
> `lint_roadmap_blockers`. Set to `draft`, which is what the header already means
> by calling everything below a proposal. The flip to `ready` — and with it the
> estate charge, the register and the blocker decidability — is the owner's.
>
> **Source:** `agents/tmp.old/skill-retrieval-mcp/road-to-skill-delivery-over-mcp.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Source:** external-source harvest of 2026-08-22
> (`agents/evidence/analysis/skill-delivery-over-mcp-harvest-2026-08-22.md`,
> proposed location), inverted per ADR-211 C/D: every phase below starts from a
> defect verified at `d1861bad2d276e78268d5515444b9ef36897dda2` and draws
> sources in only where they bear on it. **Iteration 3 of 3**; the iteration
> log is in `road-to-skill-delivery-over-mcp.iterations.md`.
>
> **This is a proposal.** Nothing in it is adopted, and nothing in it may be
> cited elsewhere as a foundation until the phase that would establish it has
> its `verify:` line green.

## Goal

On the default Claude Code install, every one of the 290 projected skills is
**reachable by task description** — through the host's native listing where
the host's own budget allows it, and through a tool the default install
actually registers where it does not — and the package can **predict** which
skills fall on which side of that line before the host ever truncates them,
instead of learning it one bare catalogue entry at a time.

"Smaller context" is a *consequence* this roadmap measures, not a goal it
assumes: the catalogue bucket is 14,408 tok today and the host already discards
most of it; the honest target is *routable skills per standing token*, with the
pre-registered possibility that the answer is "tiering does not beat
`legacy-all` on this corpus", in which case Phase 4 records the null and
Phases 1–2 still stand on their own defects.

## Context

Re-verified against the tree at `d1861bad` on 2026-08-22. Full defect table
with provenance in the harvest note; the five that shape the phases:

- **D1 — the turnkey server has no tools.** `src/cli/mcp/dispatch.ts:195-196`
  returns `tools: []`. `suggest_skill_for_task` exists only in the kernel
  server (`src/scripts/mcp_server/tools.ts:1270`).
- **D2 — the recovery rule promises that tool to everyone.**
  `src/rules/missing-skill-recovery.md:37-39` (Iron Law) and `:45-48`. A
  consumer on the documented end-user path (`docs/getting-started-local-stdio.md:9`)
  cannot comply.
- **D3 — Claude Code gets no server at all.** `mcp.json:1-3` is empty;
  `src/scripts/mcp_render.ts:11-14` never targets `.mcp.json`; `install.ts`
  writes no `mcpServers`.
- **D4 — the host's listing budget is deterministic upstream and unmodelled
  here.** Claude Code lists every skill name but keeps descriptions only up to
  1% of the context window (≈8,000 chars on 200k), filling by invocation
  frequency, capping each entry at 1,536 chars, configurable via
  `skillListingBudgetFraction` (code.claude.com/docs/en/skills, 2026-08-22;
  anthropics/claude-code#64606). The repo's 2026-08-08 observation — 5 of 8
  sampled entries bare, 414/414 described on disk
  (`agents/evidence/analysis/skill-catalogue-description-delivery.md`) — is
  that mechanism, unnamed. `grep -rn skillListingBudgetFraction src docs agents`
  → 0 hits.
- **D6 — routing is near-dead and the ranker ignores the trigger schema.**
  `skill-usage-report.md:9`: 337 tracked, 0 active. The ranker
  (`score_skill_relevance.ts:15-21`) reads `name + description` only; 19 skills
  already declare `triggers:` (`skill.schema.json:290`) and none of that text
  is indexed.

Two external facts bind the design and are carried as risks, not as
assumptions:

- **R1 (AAIF / MCP Skills-over-MCP WG, 2026-06-18):** in the WG's early
  experiments models *often ignored* skills served over MCP and went straight
  to tools; a server-instruction nudge helped, and adherence still declined as
  context grew. The pull path therefore cannot be the only path; the existing
  `skill-route` push hook stays primary.
- **R2 (Claude Code Tool Search, docs + #19890):** MCP tool definitions are
  deferred only above ~10% of context. A small server loads upfront. The
  kernel server's allowlist descriptions measure ≈1,972 tok (chars/4 over
  `tools.ts`), so registering it as-is to fix D3 would *add* standing cost.
  The surface this roadmap registers must be ≤3 tools and its cost a gated
  number.

## Phase 0 — Pin the host model and the baseline before touching delivery

- [ ] **0.1 Write the host listing-budget model into the tree as a checked
      artefact, with its upstream provenance and date.** A small pure
      function: given `(context_window, fraction=0.01, per_entry_cap=1536,
      usage_order)` and the projected catalogue, return the set of skills whose
      descriptions survive. Name the assumptions that are upstream prose
      rather than repo measurement (fill order, wrapper overhead).
      verify: `tests/scripts/host_listing_model.test.ts` pins that the model, run over the 2026-08-08 projection with an empty usage order, marks the five sampled-bare skills in `skill-catalogue-description-delivery.md` as **not surviving** and the three sampled-described ones as **surviving**; any disagreement is recorded in the test as a known gap, not suppressed.
- [ ] **0.2 Record the kernel server's standing tool cost and the threshold it
      sits under.** One row in `agents/evidence/metrics/` with the chars/4
      figure over `tools.ts` allowlist descriptions, the Tool Search threshold
      and the source date, so "registering the kernel server is free" can never
      be asserted again without a re-measurement.
      verify: the metric row exists and `grep -c "1972\|tool_search_threshold" <row>` ≥ 2; `docs/CLAIMS.md` gains an entry that quotes it.
- [ ] **0.3 Freeze the routing-matrix baseline for the incumbent ranker.**
      Run `trigger_coverage.ts --scope skill` and `score_skill_relevance` over
      the 496-line corpus and record top-1 / top-3 hit rate against the
      corpus's expected skill per line. This is the number Phase 3 and Phase 4
      must beat and it does not exist yet.
      verify: `agents/evidence/metrics/skill-ranker-baseline.json` carries `corpus_lines: 496`, `top1`, `top3`, `ranker: keyword-v1`, `commit: d1861bad`.

## Phase 1 — Make the promised tool reachable on the default path (D1, D2, D3)

- [ ] **1.1 Add a minimal skill-discovery surface to the lite server.** Exactly
      two tools, ported from the kernel handlers, read-only, shell-free:
      `suggest_skill_for_task` (unchanged contract: `task`, `limit`, returns
      names + scores + personas, never bodies) and `read_skill`
      (`name` → SKILL.md body from the projected tree, path-guarded to the
      catalogue root, refuses traversal). No `list_skills` — the host already
      lists names, and a 290-name tool result is the context cost this
      roadmap exists to avoid.
      verify: `dispatch.ts` `tools/list` returns exactly 2 entries; `task mcp:turnkey-parity` stays green for prompts/resources; chars/4 of the two descriptions + schemas ≤ 600 tok and that number is asserted in a test.
- [ ] **1.2 Add server `instructions` that tell the host when to search.**
      One paragraph, derived from `missing-skill-recovery.md`'s Iron Law, so
      Tool Search (if active) and the model (if not) both know the tool is the
      recovery path for a truncated listing. This is the AAIF WG's one
      positive finding; it is applied, and its decay (R1) is measured in 4.3.
      verify: `tools/initialize` result carries `instructions`; byte length ≤ 400 and pinned in the same test as 1.1.
- [ ] **1.3 Render the server into Claude Code's project-scope config.** Extend
      `mcp_render.ts` with a `.mcp.json` target whose entry is
      `{"agent-config": {"command": "npx", "args": ["-y", "@event4u/agent-config", "mcp-server"]}}`
      (the exact shape already documented at
      `docs/getting-started-local-stdio.md:21`). Default **on** for the
      `claude-code` projection, because a rule that is unfulfillable by
      default is a defect, not a feature; opt-out via `.agent-tools.yml`.
      verify: a fresh consumer install produces `.mcp.json` with that entry; `lint_mcp_config_security.ts` passes on the rendered file; the `mcp:check` sync task treats `.mcp.json` as a target.
- [ ] **1.4 Close the rule's unreachable branch.** Add to
      `missing-skill-recovery.md` the case "the tool is not registered": say
      so explicitly, point at the rendered `.mcp.json`, and proceed without a
      skill — the rule may never instruct a call it cannot verify is possible.
      Re-anchor the `# obligation:` line marker.
      verify: `trigger_coverage.ts --scope rule` unchanged; the rule's unintended-activation contribution replayed at 0 as in the 2026-08-16 review.

## Phase 2 — Tier the projection against the modelled budget (D4, D5)

- [ ] **2.1 Compute the tier split at install time, from data, and write it
      down.** Using 0.1's model: Tier A = skills predicted to survive the
      host's listing budget under the consumer's observed usage order
      (`agents/runtime/metrics/skill-usage.jsonl`, falling back to pack scope
      then alphabetical when usage is empty — and saying which fallback was
      used). Tier B = everything else. The split is emitted as
      `agents/runtime/state/skill-tiers.json` with the model inputs, so the
      next session can see *why* a skill was Tier B.
      verify: the file carries `model_inputs` (context_window, fraction, usage_rows_used, fallback) and `tier_a` / `tier_b` arrays whose union equals the projected catalogue.
- [ ] **2.2 Project Tier B as MCP-reachable only, behind a Human Gate.** In
      `install.ts`, a new projection mode `tiered` writes Tier A to
      `.claude/skills/` as today and Tier B **only** into the lite server's
      content tree. Default stays `legacy-all`; `tiered` is opt-in until
      Phase 4 says otherwise. `scoped` remains as the pack-level lever it is.
      verify: under `tiered`, `capture_skill_catalogue.ts --projection-modes` reports `tier_a_count + tier_b_count = 290`; `read_skill` resolves every Tier B name; no Tier B SKILL.md exists under `.claude/skills/`.
- [ ] **2.3 Surface the consumer-side host setting as an alternative, not a
      default.** Document `skillListingBudgetFraction` as the *other* lever —
      raising it restores descriptions at a measured token price (14,408 tok at
      100% delivery) — and add it to the install's `--doctor` output as a
      recommendation only when Tier B is non-empty. Never write the
      consumer's `settings.json` for them.
      verify: `grep -c skillListingBudgetFraction docs/` ≥ 1; the doctor line appears only when `tier_b.length > 0`.

## Phase 3 — Index what routes, not what reads (D6)

- [ ] **3.1 Extend the ranker's term source to `triggers:`.** `name +
      description + triggers.keyword/phrase` become the indexed text; body
      prose stays out (the one design note every surveyed skill-MCP converged
      on, and the reason the K-Dense design needed a 250 MB embedding backend
      this package will not ship). Scoring stays deterministic; no model
      download, no network.
      verify: re-run 0.3; `top1` and `top3` for `ranker: keyword-v2` are recorded beside v1; the change is kept only if `top3` does not regress and the per-prompt cost stays within `hook-latency-budget.json` (measured, stated in the header as the 2026-08-16 fix did).
- [ ] **3.2 Make trigger coverage a ratchet, Tier B first.** A Tier B skill
      with no `triggers:` is reachable only through whatever its description
      happens to share with the prompt. Seed triggers for Tier B skills in
      tranches, each measured against the matrix before merge, exactly as
      Phase 3.3 of the archived routing roadmap did for the first 19.
      verify: `trigger_coverage.ts --scope skill` count only increases; unintended-activation census ≤ its current value (433 was the last recorded ceiling) after each tranche.
- [ ] **3.3 Stop `suggest_skill_for_task` from returning Tier A.** When the
      host already lists a skill with its description, returning it from the
      recovery tool is noise. Filter on `skill-tiers.json` when present; when
      absent, return everything and say `tiers: unknown`.
      verify: unit test with a fixture tiers file; the `no tiers file` branch returns the full ranked list and the `tiers` field.

## Phase 4 — The falsifier (pre-registered; decides the default)

Hypothesis H1: on this corpus, a `tiered` install (Tier A native + Tier B via
the two-tool server) yields **more correct skill invocations per session**
than `legacy-all`, and **not more** unintended activations.
Hypothesis H2: the server's push-side cost (1.1 + 1.2) plus Tier A listing is
**below** the current 14,408-tok catalogue bucket.
The AAIF WG null is the prior for H1 being false. Both are recorded either
way.

- [ ] **4.1 Routing-matrix arm (deterministic).** Replay the 496-line corpus
      under `legacy-all` (modelled listing from 0.1) vs `tiered`, counting
      lines whose expected skill is (a) listed with description, (b) listed
      bare, (c) reachable only via the tool. This is computable without a
      host.
      verify: `agents/evidence/analysis/skill-tiering-matrix-arm.md` carries the three counts per mode at the pinned commit.
- [ ] **4.2 Live arm (observed, small N, stated as such).** ≥ 20 sessions per
      arm on one machine, same repo, `skill-usage.jsonl` + MCP telemetry
      (`mcp_telemetry_query.ts`) as the only instruments. Report invocations,
      distinct skills, `suggest_skill_for_task` calls and their hit rate. No
      survivor count is inferred from host silence (the repo's standing rule).
      verify: the note states N per arm, the date range, the host version, and whether H1 held; a "did not hold" is a valid close.
- [ ] **4.3 Measure R1 directly.** From the live arm, the fraction of sessions
      where a Tier B skill was *needed* (matrix says so) and the tool was
      *called* — by context position in the session. If adherence decays with
      context as the WG saw, the number is published and the `skill-route`
      push hook is confirmed as primary.
      verify: a table of `(session_context_tokens_bucket, tool_called_rate)` with ≥ 3 buckets, or an explicit statement that N was too small to bucket.
- [ ] **4.4 Decide the default, once.** If H1 and H2 hold, flip `tiered` to
      default for `claude-code` in a single PR that cites 4.1–4.3 by file. If
      either fails, `tiered` stays opt-in, the null is written into
      `docs/CLAIMS.md`, and this roadmap closes with outcome `measured-null`.
      verify: exactly one of the two outcomes is recorded in `agents/roadmaps/roadmaps-progress.md` with the three evidence paths.

## Phase 5 — Tracking only: SEP-2640 `skill://` alignment

Not executable today. Carried so it is not re-proposed as new.

- [ ] **5.1 Re-verify SEP-2640's status quarterly** (pending as of the
      2026-06-18 AAIF post; not re-verified on 2026-08-22). When it merges
      *and* a second host implements Resources-based skill discovery, add a
      `skill://index.json` resource to the lite server that mirrors
      `skill-tiers.json` Tier B. Until then, the existing `prompts/` +
      `resources/` surface is the same content under a different name, and
      renaming it for a pending spec would be an unmeasured change.
      verify: a dated line in this file per check; the step's checkbox can only be ticked with a spec URL that says "merged".

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Models ignore skills served over MCP | product | The AAIF WG measured models going straight to tools and ignoring served skills, with adherence declining further as context grew — a pull-only delivery path would ship a catalogue nothing reads | The deterministic `skill-route` push hook stays primary and 1.2 adds the WG's one positive finding as server `instructions`; 4.3 measures the adherence decay by context bucket instead of assuming the nudge holds | Phase 4 — The falsifier (pre-registered; decides the default) |
| 2 | The registered server costs more standing context than tiering saves | implementation | MCP tool definitions are deferred only above ~10% of context, so a small server loads upfront; registering the kernel server as-is would add its ≈1,972-tok allowlist surface to every session | 0.2 records that figure and the Tool Search threshold as a metric row so "registering it is free" cannot be re-asserted, and 1.1 caps the two-tool surface at ≤600 tok asserted in a test | Phase 1 — Make the promised tool reachable on the default path |
| 3 | The host listing-budget model is upstream prose, not repo measurement | implementation | Fill order and wrapper overhead are documented behaviour rather than something this tree measured, and every tier decision in Phase 2 inherits whatever the model gets wrong | 0.1 names which assumptions are upstream prose and pins the model against the 2026-08-08 sampled projection — five bare and three described — recording disagreement as a known gap rather than suppressing it | Phase 0 — Pin the host model and the baseline before touching delivery |
| 4 | Tiering makes a skill unreachable rather than merely undescribed | product | Tier B is projected only into the server content tree, so on a host that never calls the tool a Tier B skill goes from bare-but-listed to absent — strictly worse than the defect being fixed | `legacy-all` stays the default and `tiered` is opt-in behind a Human Gate until 4.4 decides on evidence; 2.2 asserts that `tier_a_count + tier_b_count` equals the full projected catalogue | Phase 2 — Tier the projection against the modelled budget |
| 5 | The tier split oscillates with observed usage | implementation | A skill that flips between Tier A and Tier B across installs makes the agent's memory of where it found a skill unreliable, and the flip is invisible after the fact | 2.1 writes `model_inputs` and the fallback actually used into `skill-tiers.json` so a tier is explicable; hysteresis is added only if 4.2 observes flipping, not pre-emptively | Phase 2 — Tier the projection against the modelled budget |
| 6 | The lite and kernel servers drift after the two tools are ported | implementation | Two implementations of `suggest_skill_for_task` and `read_skill` diverge silently, and the existing parity task only covers the surfaces listed in its subset | 1.1 keeps `task mcp:turnkey-parity` green as a verify condition and the two ported tools must enter that task's subset list, or parity is a claim rather than a check | Phase 1 — Make the promised tool reachable on the default path |
| 7 | Trigger seeding raises unintended activations while raising coverage | implementation | Indexing `triggers:` text and then seeding triggers for Tier B skills widens what matches a prompt, and coverage rising is indistinguishable from noise rising without the second number | 3.1 keeps the ranker change only if matrix `top3` does not regress and per-prompt cost stays inside the latency budget; 3.2 gates each tranche on the unintended-activation census not exceeding its recorded ceiling | Phase 3 — Index what routes |
| 8 | The small-N live arm is read as proof in whichever direction it points | product | Twenty sessions per arm on one machine cannot settle H1, and a roadmap that treats the result as decisive would either adopt tiering on noise or bury it on noise | 4.2 states N, date range and host version in the artefact and admits "did not hold" as a valid close; 4.4 records the null in `docs/CLAIMS.md` and closes with outcome `measured-null` rather than leaving the default unstated | Phase 4 — The falsifier (pre-registered; decides the default) |

## Acceptance criteria

- [ ] A consumer on the documented end-user path can call
      `suggest_skill_for_task` without hand-editing any config (Phase 1).
- [ ] No rule instructs a tool call the default install cannot make (1.4).
- [ ] The catalogue's host-side fate is *predicted* per skill before install,
      with the model's assumptions named (0.1, 2.1).
- [ ] The registered server's standing cost is a measured, pinned number ≤ 600
      tok, and the kernel server's ≈1,972-tok cost is recorded as the reason
      it is not the one registered (0.2, 1.1).
- [ ] The ranker indexes `triggers:` and its matrix hit rate is recorded
      before and after (0.3, 3.1).
- [ ] `tiered` becomes default only by 4.4, or the null is published.
- [ ] No embedding model, daemon, or network call is introduced anywhere in
      the skill path ("zero runtime daemon" claim in `package.json:4` stays
      machine-checked).

## Risks

- **R1 — models ignore served skills (AAIF WG, measured).** Mitigated by
  keeping the deterministic push hook primary and by measuring adherence
  decay in 4.3 rather than assuming the nudge holds.
- **R2 — Tool Search threshold.** A ≤3-tool server loads upfront; cost is
  budgeted in 1.1, not assumed deferred. If Anthropic lowers the threshold or
  `auto:N` becomes settable from `.mcp.json`, re-measure; do not pre-empt.
- **R3 — retrieval-layer flooding (ToolFlood, arXiv 2603.13950).** Not
  applicable while the index is sealed to the projected tree and scoring is
  deterministic. Becomes applicable the day org-packs can inject skills into
  the index; that day, the pack lockfile (SHA+content-hash) is the boundary.
- **R4 — the tier split oscillates with usage.** A skill that flips tiers
  between installs confuses the agent's memory of where it found it. 2.1
  writes the inputs; add hysteresis only if 4.2 shows flipping, not before.
- **R5 — two servers drift.** Lite and kernel already have a parity task
  (`taskfiles/mcp.yml:31`); the two ported tools must be in its subset list
  or parity is a claim, not a check.

## Out of scope

- Replacing the kernel server, its 27-tool surface, or its beta criteria.
- Deleting skills to fit the host budget (ruled out by the archived routing
  roadmap's scope section; the estate-count target has its own roadmap).
- Any embedding- or LLM-judge-based ranker.
- Hosts other than Claude Code for the live arm (Codex's
  `budget-strip-and-drop` mode is a different mechanism; its model is a
  separate 0.1-style step if ever needed).
- Remote/Cloudflare MCP — same content, separate safety contract; untouched.
