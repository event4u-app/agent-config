---
complexity: structural
---

# Road to Token Optimization

**Status:** PHASE 1 SHIPPED — closed for active execution 2026-05-06.
Phase 2 / Phase 3 are deferred-with-trigger by design and reopen
autonomously when their declared signals fire (telemetry threshold,
`/cost:report` ship, one-cycle audit cadence). They do not block
roadmap closure.
**Started:** 2026-05-06
**Phase 1 closed:** 2026-05-06
**Trigger:** User ask — a standing planned token-optimizer skill that ties all
existing token-saving assets together as a decision tree consulted at
the *moment of decision*, with mechanical drift-detection so it stays
honest as new tools/rules land.
**Mode:** Conservative validate-before-expand plate. Hard Cap 5 per
6-week plate; this plate uses **5 of 5 slots** — fully consumed by
design (skill + auto-rule + link validator + telemetry stub + suite
integration). Phase 2 reopens only on observable signal.

## Purpose

Close the architectural gap that today forces the agent to synthesize
`direct-answers` + `token-efficiency` + `cli-output-handling` +
`rtk-output-filtering` + `markitdown` + `agent-handoff` + `condense.*`
under cognitive load at every decision point. Land a single consult
surface — keyed by **intent** (verbose CLI / large doc / repeated
tool-call / context near limit / cost-aware) — with citation links to
the canonical assets, never duplicating them. Make it self-policing:
a CI gate fails when the decision tree references material that no
longer matches the cited source. Make it falsifiable: a 30-line
telemetry stub measures real consults so we know within one week
whether the skill is load-bearing or ghost infrastructure.

## Decisions (synthesized 2026-05-06 from council)

- **Skill shape: tree + catalog hybrid.** Sonnet's dual-audience
  argument accepted. ~30-line decision tree at the top (scannable
  under pressure for the live agent), catalog section below (cold-
  readable for reviewers updating it). GPT-4o's pure-tree alternative
  fails the second audience.
- **Maintenance: link validator, not edit trigger.** Both members
  voted (b) auto-rule + CI gate; Sonnet's critique of the original
  edit-trigger spec ("process debt disguised as automation") accepted.
  CI script parses `[asset](path)` citations, verifies each target
  exists, checks the trigger keywords still match. Fails only on
  **semantic drift**, not on whitespace/comment edits.
- **Triggers: hybrid proactive + reactive.** Sonnet's frame accepted —
  proactive description ("before any verbose tool call, large file
  read, document conversion, or near-context-limit handoff") +
  reactive sub-bullets + one-line "consult BEFORE the action, not
  after" Iron Law inside the skill body.
- **Telemetry stub lands in Phase 1.** Sonnet net-new candidate (ICE
  504) accepted — `<!-- TELEMETRY: consulted=[ts] context=[…] -->`
  append-line + 10-line `count_token_optimizer_usage.sh` = early-kill
  signal within one week.
- **Phase 2 deferred-with-trigger.** Cost-telemetry feedback loop
  (Sonnet candidate #3, ICE 280) reopens only on P1.2 of
  `road-to-ruflo-adoption.md` shipping AND P1.4 telemetry showing
  ≥5 consults/week sustained for 2 weeks.

## Authoritative-Link Sunset path

For tooling we cite but do not own:

- `rtk` upstream (https://github.com/rtk-ai/rtk) → authoritative-link
  in skill catalog, never inlined.
- `markitdown` upstream → authoritative-link in skill catalog.
- Anthropic / OpenAI pricing constants → live in `/cost:report` source,
  never copy-pasted into `token-optimizer.md`.

## Horizon (6-week visible plate)

Phase 1 ships **4 adoptions + suite integration** (5/5 Hard Cap slots).
Phase 2 reopens only on documented telemetry triggers. Phase 3
governance cross-cut runs after Phase 1 has been live one full cycle.

## Phase 1 — token-optimizer Phase-1 plate (READY)

- [x] **P1.1 — `token-optimizer` skill (tree + catalog hybrid).**
  Author new skill at `.agent-src.uncondensed/skills/token-optimizer/SKILL.md`.
  Frontmatter: `type: auto`, `tier: 2a`, hybrid trigger description.
  Body: ~30-line decision tree keyed by intent (verbose CLI → cite
  `cli-output-handling` + `rtk-output-filtering`; large doc → cite
  `markitdown`; repeated tool-call → cite `token-efficiency`; near
  context limit → cite `agent-handoff`; cost-aware → cite
  `/cost:report` once it ships, otherwise placeholder note); catalog
  section below with one row per asset (path, trigger condition, what
  it does); explicit "consult BEFORE the action" Iron Law inside skill
  body; never restate any rule. Lines budget: ≤300.

- [x] **P1.2 — `token-optimizer-maintenance` rule.** Author new rule at
  `.agent-src.uncondensed/rules/token-optimizer-maintenance.md`.
  `type: auto`, `tier: 2a`. Triggers when the agent intends to edit
  any of the tracked assets (`rtk-output-filtering`, `markitdown`,
  `cli-output-handling`, `token-efficiency`, `agent-handoff`,
  `condense.*`, anything new added to the catalog). Rule body says:
  "If the edit changes trigger keywords or what the asset does, also
  update the corresponding citation in `token-optimizer.md`. The CI
  link validator (P1.3) is a backstop, not a substitute." Lines
  budget: ≤120.

- [x] **P1.3 — `scripts/check_token_optimizer_freshness.py` link
  validator.** Implement CI gate. Parse `token-optimizer.md` for
  every `[asset](path/to/asset.md)` citation. For each citation:
  (a) verify the target file exists; (b) extract the trigger keywords
  the decision tree associates with it; (c) `grep -q` those keywords
  in the target file. Fail on missing target OR keyword mismatch with
  a structured diff (which leaf, which keyword, which target). Wire
  into `task ci` after `check-refs`. Lines budget: ≤150.

- [x] **P1.4 — Telemetry stub.** Append `<!-- TELEMETRY: consulted=
  [timestamp] context=[CLI|doc|handoff|cost] -->` line at end of
  `token-optimizer.md`. Add `scripts/count_token_optimizer_usage.sh`
  (≤30 lines: `grep -c "TELEMETRY: consulted=" token-optimizer.md`,
  print 7-day and 30-day counts). Document in P1.1 skill body that
  the agent uncomments and dates the line each consult. Decision
  rule: if <5 consults in 2 weeks of live use → P3.1 sunset audit
  fires.

- [x] **P1.5 — Suite integration.** Add new skill, new rule, new
  scripts to manifests. Run `task sync` → `.agent-src/` regenerated.
  Run `task generate-tools` → `.claude/`, `.cursor/`, `.clinerules/`,
  `.windsurfrules` regenerated. Verify `task ci` exits 0 with the
  new `check_token_optimizer_freshness` step in the pipeline:
  `lint-skills`, `check-portability`, `check-refs`,
  `check-token-optimizer-freshness`, `lint-readme`,
  `check-roadmap-trackable`, `lint-roadmap-complexity`, `test`.

## Phase 2 — Out-of-horizon (deferred-with-trigger)

- [~] **P2.1 — Cost-telemetry feedback loop.** *Deferred-with-trigger by design.* Reopen only when **both**
  triggers fire: (a) P1.2 of `road-to-ruflo-adoption.md` shipped and
  `/cost:report` is producing JSONL, AND (b) P1.4 telemetry shows
  ≥5 token-optimizer consults/week sustained for 2 weeks. Adoption
  shape: extend `/cost:report` to surface "this session would have
  saved $X with rtk on commands Y/Z" in the next handoff. Citation
  hooks land in `token-optimizer.md` cost-aware leaf.

- [~] **P2.2 — Decision-tree expansion for new tooling.** *Deferred-with-trigger by design.* Reopen when
  ≥2 net-new token-saving tools (CLI filters, conversion utilities,
  context-management primitives) have landed since Phase 1 ship.
  Adoption shape: add catalog rows + tree leaves; never grow the
  decision tree beyond ~50 lines (tree must remain scannable). Tools
  that don't fit go to catalog only.

- [~] **P2.3 — Rule slimming against `token-optimizer`.** *Deferred-with-trigger by design.* Reopen only
  after P3.1 Sunset Audit confirms ≥5 consults/week sustained over a
  full cycle (i.e., the skill is load-bearing, not ghost
  infrastructure). Adoption shape: replace catalog/example material
  inside `token-efficiency.md` with pointers to corresponding
  `token-optimizer` leaves; keep ALL Iron Laws and Anti-Loop sections
  verbatim (always-loaded floor stays intact). `direct-answers` and
  `cli-output-handling` are **out of scope** — `direct-answers` is a
  pure Iron-Law floor with zero shrink room, `cli-output-handling`
  already delegates lookup material to `rtk-output-filtering` and the
  mechanics context. Estimated reduction: ~20–40 lines in
  `token-efficiency.md`. Hard prerequisite: every relocated paragraph
  must have a citation match in `token-optimizer.md` so the P1.3
  link validator catches drift. Lines budget for `token-efficiency`
  after slim: ≤80% of pre-slim line count.

## Phase 3 — Governance cross-cut

- [~] **P3.1 — Sunset audit.** *Deferred-with-trigger by design.* After Phase 1 has been live one full
  cycle: read 7-day and 30-day telemetry counts. If <5 consults/week
  sustained → sunset the skill, strengthen the underlying rules
  instead, document the null result in this roadmap so the same
  proposal isn't reproposed. If ≥5/week → keep, audit citations for
  drift, verify all link-validator targets resolve, re-run `task ci`.

## Risk register

- **Ghost-infrastructure risk:** skill ships and is never consulted.
  Mitigated: P1.4 telemetry + P3.1 kill-criterion gives early signal.
- **Decision-tree rot:** new tools land, tree never updated.
  Mitigated: P1.2 rule + P1.3 link validator catches semantic drift.
- **Iron Law over-fires:** "consult BEFORE action" treated as blocking
  directive instead of consultation checkpoint. Mitigated: skill body
  explicitly frames it as a checkpoint, with "trivial known-cheap
  action" exception; revisit in P3.1 if telemetry shows over-consult.
- **Premature rule slimming:** moving material out of always/auto-
  loaded rules into the skill before consult rate is validated would
  hollow out the floor if the skill is later sunset. Mitigated: P2.3
  is hard-gated on P3.1 confirming ≥5 consults/week sustained; Iron
  Laws and Anti-Loop sections never move.
- **Catalog grows unbounded:** every harvest adds rows.
  Mitigated: P2.2 caps the tree at ~50 lines; overflow goes to
  catalog-only; catalog itself capped by skill 300-line budget.

## Provenance

- Council artefacts: `agents/council-questions/token-optimizer-design.md`,
  `agents/council-responses/token-optimizer-design.json`
- Analysis: `agents/evidence/analysis/compare-token-optimizer-design.md`
- Existing assets cross-checked: `direct-answers`, `token-efficiency`,
  `cli-output-handling`, `rtk-output-filtering`, `markitdown`,
  `agent-handoff`, `condense.{sh,py}`, `check_condensation.py`
- In-flight dependency: P1.2 of `road-to-ruflo-adoption.md`
  (`/cost:report` command) — Phase 2 reopens depend on this
- Sunset Policy: `docs/contracts/STABILITY.md`
- Hard Cap: 5 adoptions per 6-week plate (5/5 used here)
