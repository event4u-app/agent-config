# Owner questions

One list of every open decision that only the owner can take. Runs do not open a
pull request whose only content is a question; they add a row here and take the
next step. An answered question moves to `## Answered` with its date and the
answer verbatim, and the run that applies it links its PR.

## Open

### OQ-1 — Second approver for the authority surface

- **Context:** `road-to-authority-routing-mechanism` Phases 2–8 need a forge-side
  approval by a principal other than the merging account; ruleset `17749383`
  requires 0 approvals and no account besides the owner has ever reviewed.
- **Options:** (a) ask one of `h3xa2`, `php-jesus`, `phpjob`, `0sama` to accept
  the duty, then raise `required_approving_review_count` and name them, with the
  owner bypass as the liveness escape; (b) leave it — Phases 2–8 stay unbuilt.
- **Recommendation:** (a).
- **Blocks:** steps 1.2, 2.1–2.5, 3.2–3.4, 6.2, 6.3, 8.0–8.3 (blocker
  `external-bootstrap-boundary-for-phases-2-3`).

### OQ-2 — Request gateway for what no hook reaches

- **Context:** `road-to-placeholders-on-the-wire` Phase 7. On Claude Code only
  the request itself carries the typed prompt, `@file` mentions and instruction
  files in rewritable form; covering them needs a loopback gateway. Step 7.2
  (the host probe) is runnable without this answer.
- **Options:** (a) build the gateway, decided with the 7.2 probe in hand;
  (b) do not build it — those inputs stay `gated` / `uncovered` permanently.
- **Recommendation:** (a), conditional on 7.2.
- **Blocks:** steps 7.3–7.7 (blocker `request-gateway-build`).

### OQ-3 — Removing `projection.mode`

- **Context:** `road-to-a-setup-that-decides-itself` step 4.7. The reach
  condition holds, but removal is not default-neutral: upgraded installs without
  the key and `use --profile=legacy-all` rely on the full surface. Council 2/2:
  owner-reserved (PR #2643).
- **Options:** (1) remove it in the next major and retire the full-surface
  guarantee on hosts without a listing lever; (2) remove it in a minor only with
  an automatic, durable non-settings full/scoped control; (3) keep it until an
  equivalent host-independent control exists.
- **Recommendation:** (1), shipped in the same major as the `projection.rule_packs`
  retirement (PR #2644), so consumers migrate once.
- **Blocks:** step 4.7 and AC-1.

### OQ-4 — Which five roadmaps stay active

- **Context:** owner directive 2026-10-24, item 3: at most five active roadmaps,
  the rest to `later/`, chosen by benefit and nearness to finish. 16 non-draft
  roadmaps are active today; the drain queue no longer starts a sixth
  (`road-to-a-backlog-that-shrinks` 3.1).
- **Options:** (a) keep the five nearest to finish —
  `road-to-an-update-that-installs-itself-only-when-it-is-safe` (18 done / 1 open),
  `road-to-a-cold-start-paid-once` (34 / 2), `road-to-a-setup-that-decides-itself`
  (24 / 3), `road-to-self-modification-that-a-council-must-pass` (21 / 5),
  `road-to-an-installed-layer-that-is-thinned` (10 / 4) — and park the other
  eleven in `later/`, among them `road-to-authority-routing-mechanism` (held by
  OQ-1) and the zero-progress backlog `road-to-breadth-with-depth` (0 / 34);
  (b) name a different five; (c) park nothing — only the start cap applies.
- **Recommendation:** (a).
- **Blocks:** the `later/` moves; until answered the queue finishes started
  roadmaps and starts none.

### OQ-5 — Lower R0/R1 ceremony now, before 30 shadow steps

- **Context:** the 2026-10-21 decision
  (`agents/evidence/owner-directives/2026-10-21-review-cap-and-depth-flip.md`)
  lowers R0/R1 depth on structurally safe paths only after a committed reading of
  30 shadow steps; the reading stood at 0 on 2026-10-21. The 2026-10-24 directive
  already cut council and evidence in the `full` row; review rounds and retro
  stay full.
- **Options:** (a) set the depth table `active` for R0/R1 on safe paths now,
  relying on the sampled full-depth audit (1 in 4) and its automatic return to
  full depth; (b) keep waiting for the 30-step reading.
- **Recommendation:** (a) — reversible in one commit, and the audit rolls a
  class back on its own.
- **Blocks:** `road-to-a-step-that-costs-what-it-changes` steps 4.1 and 4.2
  (blocker `class-depth-flip-reopens-the-risk-null`).

### OQ-6 — The `openai` council seat fails on an unrelated MCP grant

- **Context:** the codex CLI exits before answering because the `linear-server`
  MCP's OAuth refresh token was rejected; the council needs two providers for any
  ratification, so every governance edit waits.
- **Options:** (a) remove or re-authorise `linear-server` in the codex CLI
  configuration on your machine; (b) ratify the waiting governance edit yourself
  as the independent reviewer; (c) leave the seat down.
- **Recommendation:** (a) — reversible, and it touches no council credential.
- **Blocks:** `road-to-agent-throughput-recovery` steps 4.3 and 4.5 (blocker
  `openai-council-seat-oauth-grant-rejected`).

## Answered

| ID | Date | Question | Answer |
|---|---|---|---|
| impact-numbering-model | 2026-10-24 | Does the Consumer-Impact trailer bind the bump? | 1 — bind, automatic migration is not a major (ADR-300) |
| AC-4 release wording | 2026-10-24 | Amend AC-4 to the shipped `action` form? | 1 — amend |
| 7-1-closure-standard | 2026-10-24 | Closure standard for authority-routing 7.1 | 1 — ledger + fail-closed gate |
| 7-1-r16d-waiver | 2026-10-24 | R16.d: absent composite store | 1 — exit 0, as the contract says |
| cold-start 2.5 user layer | 2026-10-24 | Skipping workers and the `~/.claude` layer | 2 — carry a user-layer digest |
| cold-start floor overflow | 2026-10-24 | Floor laws over the cap | 2 — first law block per rule |
| cold-start first-block precedence | 2026-10-24 | Order when first blocks overflow | 1 — safety floor first, then alphabetical |
| rule-packs-retirement | 2026-10-24 | Retire `projection.rule_packs`? | 1 — retirement step, next major |
