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
- [ ] Linter checks: `personas:` entries resolve; orchestrated
  skill references resolve; output template presence enforced.

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

- [ ] Inside-repo detection — looks for `.git/`, `agents/`,
  `composer.json` / `package.json`, then loads
  `agents/contexts/*.md` for domain vocabulary.
- [ ] Nearby-ticket scan — recent branch names, recent commits,
  open PRs mined for naming conventions.
- [ ] Graceful degrade — outside-repo mode produces the same
  output shape, minus repo-specific citations.

### Phase 4 — estimate-ticket sibling

Same persona cast as refine-ticket. Separate skill + command so
each stays focused. May be invoked via `/estimate-ticket` or
chained after refine (`/refine-ticket --then-estimate`, TBD).

- [ ] `.agent-src.uncompressed/skills/estimate-ticket/SKILL.md`
  drafted via `artifact-drafting-protocol`. Output: size (S/M/L/XL),
  risk (Low/Med/High), split recommendation (yes/no + split points),
  uncertainty (High-confidence / Needs-spike / Underspecified).
- [ ] `.agent-src.uncompressed/commands/estimate-ticket.md`
  drafted.
- [ ] Fixtures: estimate output for three real tickets of varying
  shapes committed as reference.

### Phase 5 — integration with Q19 / Q20 / Q22

- [ ] `/refine-ticket` cited in the Q20 `feature-build.md` flow as
  the optional pre-step before `/brainstorm` or `/plan`.
- [ ] Q19 README demo candidates include a "paste a messy Jira
  ticket → watch it get refined" example if adoption signals are
  strong.
- [ ] Q22 `/onboard` orchestration does NOT auto-run refine-ticket
  (it's opt-in, not discovery — running it silently on random
  tickets would be surprising).

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

## See also

- [`open-questions.md`](open-questions.md) — Q24, Q25 (source)
- [`archive/road-to-personas.md`](archive/road-to-personas.md) — Core-6 persona primitive (shipped 2026-04-22)
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — pattern compliance for new skills
- [`.agent-src.uncompressed/skills/validate-feature-fit/SKILL.md`](../../.agent-src.uncompressed/skills/validate-feature-fit/SKILL.md) — orchestrated sub-skill
- [`.agent-src.uncompressed/skills/threat-modeling/SKILL.md`](../../.agent-src.uncompressed/skills/threat-modeling/SKILL.md) — orchestrated sub-skill
- [`.agent-src.uncompressed/skills/jira-ticket/SKILL.md`](../../.agent-src.uncompressed/skills/jira-ticket/SKILL.md) — ticket-loading helper
- [`.agent-src.uncompressed/rules/artifact-drafting-protocol.md`](../../.agent-src.uncompressed/rules/artifact-drafting-protocol.md) — mandatory per new artifact
