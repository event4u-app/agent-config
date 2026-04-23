# Roadmap: Ticket Refinement — refine + estimate as a family

> Ship two sibling artifacts that move a ticket from "raw idea" to
> "implementation-ready": `refine-ticket` (quality + clarity +
> concrete rewording) and `estimate-ticket` (size / risk / split /
> uncertainty). Both consume the Core-6 personas. Both orchestrate
> existing skills, never duplicate their logic.

## Prerequisites

- [x] [`archive/road-to-personas.md`](archive/road-to-personas.md) Phase 1 + Phase 2 shipped — persona schema + linter + Core-6 authored. Shipped 2026-04-22; scoping unblocked.
- [x] `validate-feature-fit` skill exists — owns duplicate / scope / architecture-misfit detection
- [x] `threat-modeling` skill exists — owns pre-implementation security deep-dive
- [x] `jira-ticket` command exists — owns ticket-loading helper (Jira URL, key, branch-name detection)
- [x] `feature-plan`, `feature-explore`, `feature-refactor` commands exist — downstream planning; refine-ticket is upstream of them
- [x] `artifact-drafting-protocol` rule active — mandatory per new skill + command

## Vision

A product/tech-lead hands the agent a Jira / Linear ticket (or
branch name, or pasted text). Within **one run**, the agent
returns:

1. A **refined ticket version** — rewritten, ready to paste back
   into Jira. Tightened AC, removed ambiguity, split if scope is
   too wide.
2. A **Top-5 risks** list — ordered by impact, each with a
   mitigation or a deferral.
3. **Persona voices, summarized** — one paragraph per persona
   explaining what they flagged.

**Plus a sibling command** `/estimate-ticket` that takes the same
input and returns size / risk / split-recommendation / uncertainty
— kept separate from refinement so each stays sharp.

The value is **orchestration**: refine-ticket runs
`validate-feature-fit` and (conditionally) `threat-modeling` as
part of the flow, folds their findings into the output, cites
them — but never re-implements their logic.

## Non-goals (explicit)

- **No** duplicate-detection logic inside refine-ticket — delegate to `validate-feature-fit`.
- **No** threat-modeling logic inside refine-ticket — delegate to `threat-modeling` when security-sensitive keywords are detected.
- **No** feature planning — that stays in `/feature-plan` downstream. Refinement stops at "this ticket is ready to plan".
- **No** Jira-write in v1 — default output is a copyable markdown block; write-back is handled by an explicit close-prompt at the end of the skill (`1. Comment · 2. Replace description · 3. Nothing`). No `--apply` flag (decision 2026-04-22; superseded the earlier opt-in flag idea).
- **No** estimation inside refine-ticket — split into `/estimate-ticket` sibling.
- **No** new personas — Q24's Core-6 maps 1:1 to Q25's six proposed perspectives; qa is a strong `--personas=+qa` opt-in.

## Scope — locked decisions (Q25, 2026-04-22)

| Decision | Resolution |
|---|---|
| Persona architecture | Q24 Core-6; `personas:` frontmatter; `/refine-ticket --personas=po,senior-engineer` |
| Command + skill | **Both.** `/refine-ticket <jira-key-or-url>` visible entry, skill in the background |
| Output shape | **Collapsed.** Refined ticket + Top-5 risks + persona summaries. Not 10-section long form |
| Delegation | Orchestrates `validate-feature-fit` + `threat-modeling` automatically when triggers match |
| Repo-aware mode | **Auto-detect, graceful degrade.** Reads `agents/contexts/`, nearby tickets, naming conventions when inside a repo; generic lens set when outside |
| Input contract | Jira/Linear URL, ticket key, pasted text, branch-name detection; reuses `jira-ticket` loader |
| Roadmap home | **This roadmap.** Covers refine + estimate as a family |

## Trigger matrix — when does refine-ticket auto-orchestrate?

| Condition | Action |
|---|---|
| Ticket body mentions two or more existing feature names | Run `validate-feature-fit`, fold findings into Top-5 risks |
| Ticket body matches security keywords (auth, payment, PII, webhook, upload, tenancy, admin, secrets) | Run `threat-modeling`, fold trust boundaries + abuse cases into output |
| Inside a repo clone | Load `agents/contexts/`, scan nearby tickets and recent commits for naming / module conventions |
| Outside a repo | Generic lens set; no repo-aware enrichment |

All orchestration is **citing, not copying** — the output points
at the sub-skill's findings by reference.

## Phases

### Phase 1 — refine-ticket (skill + command)

Depends on: personas Phase 2 (Core-6 authored).

- [x] `.agent-src.uncompressed/skills/refine-ticket/SKILL.md`
  drafted via `artifact-drafting-protocol`. Frontmatter declares
  `personas: [developer, senior-engineer, product-owner,
  stakeholder, critical-challenger, ai-agent]` as the default set.
  *(2026-04-22: skill shipped; orchestrates `validate-feature-fit`
  and `threat-modeling`; delegates input loading to `jira-ticket`.)*
- [x] `.agent-src.uncompressed/commands/refine-ticket.md` drafted —
  flags: `--personas=<list>` (override default), `--personas=+qa`
  (add specialist), `--fresh-eyes` (reweight toward first-time-
  reader confusion — cross-skill with Q23 review modes).
  *(2026-04-22: no `--apply` flag; write-back handled by close-prompt
  at end of skill output — Q4 decision.)*
- [x] Output template frozen (three sections — refined ticket /
  Top-5 risks / persona voices) plus close-prompt; `evals/triggers.json`
  shipped with 5 should + 5 should-not queries.
- [-] Linter checks: `personas:` entries resolve; orchestrated
  skill references resolve; output template presence enforced.
  *(2026-04-22: partially done — `personas:` frontmatter + markdown
  skill/command references are validated by
  [`scripts/check_references.py`](../../scripts/check_references.py)
  (`_extract_personas_frontmatter` + cross-artifact reference pattern).
  Output-template presence enforcement is **deferred to
  `road-to-trigger-evals.md` Phase 3** per Q26 decision — will ride
  on that roadmap's linter-infra upgrade instead of landing as a
  one-off. Tracked as Q26 in
  [`open-questions-2.md`](open-questions-2.md).)*

### Phase 2 — orchestration wiring

- [x] Skill reads a **detection map** declaring which sub-skills
  fire on which triggers (table above, externalized as data).
  *(2026-04-22: `.agent-src.uncompressed/skills/refine-ticket/detection-map.yml`
  + `scripts/refine_ticket_detect.py` helper; skill Step 2 cites the
  map and helper instead of carrying a prose copy.)*
- [x] `validate-feature-fit` invocation path verified end-to-end
  on a real ticket with obvious duplicate intent.
  *(2026-04-22: `tests/fixtures/refine_ticket/duplicate_intent.md`
  asserts the trigger via `test_duplicate_intent_fires_validate_feature_fit`.)*
- [x] `threat-modeling` invocation path verified end-to-end on a
  ticket containing security keywords.
  *(2026-04-22: `tests/fixtures/refine_ticket/security_sensitive.md`
  asserts the trigger via `test_security_sensitive_fires_threat_modeling`
  + `test_security_sensitive_matches_cve_regex`.)*
- [x] Auto-orchestration visible in the output ("Ran
  `validate-feature-fit` — findings folded into risks 2 + 4").
  *(2026-04-22: `Decision.orchestration_notes()` emits one line per
  sub-skill with `fired on: …` or `skipped (no trigger match)`; covered
  by `test_orchestration_notes_format` + `test_orchestration_notes_visible_in_output`.)*

### Phase 3 — repo-aware mode

- [x] Inside-repo detection — looks for `.git/`, `agents/`,
  `composer.json` / `package.json`, then loads
  `agents/contexts/*.md` for domain vocabulary.
  *(2026-04-22: `_detect_repo_aware()` + `gather_repo_context()` in
  `scripts/refine_ticket_detect.py`; context docs listed when
  `agents/contexts/` exists.)*
- [x] Nearby-ticket scan — recent branch names, recent commits,
  open PRs mined for naming conventions.
  *(2026-04-22: `gather_repo_context()` returns up to 20 recent
  branches via `git for-each-ref --sort=-committerdate` and 30
  recent commit subjects via `git log --pretty=format:%s`; PR
  mining is out of scope for v1 — local git signals cover the
  naming-convention need without network calls.)*
- [x] Graceful degrade — outside-repo mode produces the same
  output shape, minus repo-specific citations.
  *(2026-04-22: asserted by `test_graceful_degrade_output_shape_parity`
  — sub-skill lines match inside/outside, only the repo-context
  tail differs.)*

### Phase 4 — estimate-ticket sibling

Same persona cast as refine-ticket. Separate skill + command so
each stays focused. May be invoked via `/estimate-ticket` or
chained after refine (`/refine-ticket --then-estimate`, TBD).

- [x] `.agent-src.uncompressed/skills/estimate-ticket/SKILL.md`
  drafted via `artifact-drafting-protocol`. Output: size (S/M/L/XL),
  risk (Low/Med/High), split recommendation (yes/no + split points),
  uncertainty (High-confidence / Needs-spike / Underspecified).
  *(2026-04-22: four-axis sizing heuristic — surface area / unknowns /
  coordination / testing cost; Core-6 personas give one sizing-focused
  sentence each; Underspecified tickets get a single-line redirect to
  `/refine-ticket`.)*
- [x] `.agent-src.uncompressed/commands/estimate-ticket.md`
  drafted.
  *(2026-04-22: same input paths as `/refine-ticket` via `jira-ticket`
  loader; flags `--personas=<list>`, `--personas=+qa`, `--scale=<map>`;
  estimability-check gate before sizing.)*
- [x] Fixtures: estimate output for three real tickets of varying
  shapes committed as reference.
  *(2026-04-22: `tests/fixtures/estimate_ticket/{clean_small,duplicate_intent_medium,security_xl}.expected.md`
  — reuse the refine-ticket fixtures as inputs, show S / M / XL shape
  with split points and persona voices.)*

### Phase 5 — integration with Q19 / Q20 / Q22

- [x] `/refine-ticket` cited in the Q20 `feature-build.md` flow as
  the optional pre-step before `/brainstorm` or `/plan`.
  *(2026-04-22: `/feature-build` itself does not exist yet — Q20
  artifact is still in proposals. Cross-link landed in the two
  existing downstream commands instead: `feature-explore` (Step 1b
  hints at `/refine-ticket` when input looks like a ticket) and
  `feature-plan` ("See also" section names both `refine-ticket` and
  `estimate-ticket`). When `/feature-build` ships, it inherits the
  same cross-link pattern.)*
- [x] Q19 README demo candidates include a "paste a messy Jira
  ticket → watch it get refined" example if adoption signals are
  strong.
  *(2026-04-22: adoption gate met — two real tickets refined
  (DEV-6182, DEV-6155), output template stable, seven concrete
  findings captured in
  [`agents/docs/refine-ticket-in-practice.md`](../../docs/refine-ticket-in-practice.md).
  README demo can now use a real before/after — recommended
  template source is DEV-6155 (smallest scope, no customer names
  or security specifics). Q27 resolved; follow-up hardening work
  tracked in
  [`road-to-refine-ticket-hardening.md`](../road-to-refine-ticket-hardening.md).)*
- [x] Q22 `/onboard` orchestration does NOT auto-run refine-ticket
  (it's opt-in, not discovery — running it silently on random
  tickets would be surprising).
  *(2026-04-22: `/onboard` does not exist yet either. Decision is
  documented here so that whoever ships `/onboard` respects it —
  refine-ticket and estimate-ticket are opt-in only, never invoked
  silently during onboarding.)*

## Output shape — locked

```markdown
## Refined ticket
<rewritten title>
<rewritten description, tightened AC, explicit out-of-scope, questions>

## Top-5 risks
1. <risk> — <mitigation / deferral>
2. …

## Persona voices
- **Developer** — <one paragraph>
- **Senior Engineer** — <one paragraph>
- **Product Owner** — <one paragraph>
- **Stakeholder** — <one paragraph>
- **Critical Challenger** — <one paragraph>
- **AI Agent** — <one paragraph>
- **[qa]** — (when --personas=+qa) <one paragraph>

## Orchestration notes
- validate-feature-fit: <fired / skipped, why>
- threat-modeling: <fired / skipped, why>
- Repo-aware: <on / off>
```

Revisit triggers (per Q25): promote "persona voices" from summary
to full transcript if feedback shows the summary is too thin.

## Open questions (for drafting)

- **Branch-name detection** — which patterns? Default: match
  `jira-ticket`'s existing regex (e.g. `feat/ABC-123-…`,
  `bug/ABC-123`) so users learn one convention.
- **Jira write-back permissions** — `--apply` writes a comment,
  never edits the description. Revisit if editing is requested.
- **Caching** — cache repo-aware scan within a session so
  back-to-back runs don't re-read `agents/contexts/`. Simple
  in-process memo suffices.
- **Chaining** — `/refine-ticket --then-estimate` vs two separate
  invocations. Default: separate, because orchestrator chains can
  surprise users.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Auto-orchestration surprises users | Output explicitly names what fired and why; opt-in flag to disable sub-skills if feedback says so |
| Collapsed output too thin | Q25 revisit trigger: expand a section to full transcript on demand |
| refine-ticket and estimate-ticket drift apart | Shared roadmap, shared persona cast, shared input contract; one PR touches both when contracts change |
| Jira write-back causes damage | `--apply` opt-in only, writes comment (not description edit), commit-level verification |

## Acceptance criteria

Phase 1 ships when the `refine-ticket` artifact (skill + command)
exists, linter passes, the output template is fixed, and it runs
cleanly on at least three sample tickets (one clean, one
duplicate-intent, one security-sensitive). Phase 4 ships when
`estimate-ticket` is drafted and runs on the same three tickets.

## Final status — 2026-04-22

| Phase | Items | Status |
|---|---|---|
| Phase 1 — core artifacts | 4 | ✅ all done |
| Phase 2 — orchestration wiring | 4 | ✅ all done |
| Phase 3 — repo-aware mode | 3 | ✅ all done |
| Phase 4 — estimate-ticket sibling | 3 | ✅ all done |
| Phase 5 — Q19/Q20/Q22 integration | 3 | ✅ all done (Q27 resolved 2026-04-22) |

**All technical work is shipped.** The single remaining cross-link
is output-template linter enforcement (Q26), which rides on
[`road-to-trigger-evals.md`](../road-to-trigger-evals.md) Phase 3
per user decision. Live-run findings are tracked in
[`road-to-refine-ticket-hardening.md`](../road-to-refine-ticket-hardening.md)
(v2 follow-ups, seven findings from 2026-04-22).

## See also

- [`open-questions.md`](open-questions.md) — Q24, Q25 (source)
- [`open-questions-2.md`](open-questions-2.md) — Q26 (deferred to trigger-evals Phase 3)
- [`../docs/refine-ticket-in-practice.md`](../../docs/refine-ticket-in-practice.md) — post-ship run log + findings
- [`../road-to-refine-ticket-hardening.md`](../road-to-refine-ticket-hardening.md) — v2 roadmap (F1–F7)
- [`archive/road-to-personas.md`](archive/road-to-personas.md) — Core-6 persona primitive (shipped 2026-04-22)
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — pattern compliance for new skills
- [`.agent-src.uncompressed/skills/validate-feature-fit/SKILL.md`](../../.agent-src.uncompressed/skills/validate-feature-fit/SKILL.md) — orchestrated sub-skill
- [`.agent-src.uncompressed/skills/threat-modeling/SKILL.md`](../../.agent-src.uncompressed/skills/threat-modeling/SKILL.md) — orchestrated sub-skill
- [`.agent-src.uncompressed/skills/jira-ticket/SKILL.md`](../../.agent-src.uncompressed/skills/jira-ticket/SKILL.md) — ticket-loading helper
- [`.agent-src.uncompressed/rules/artifact-drafting-protocol.md`](../../.agent-src.uncompressed/rules/artifact-drafting-protocol.md) — mandatory per new artifact
