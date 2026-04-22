# `/refine-ticket` in practice

> Post-ship observation log for the `refine-ticket` skill + command
> (shipped via `archive/road-to-ticket-refinement.md` on 2026-04-22).
> Captures real-world runs and the findings they surface, so the
> adoption story is evidence-backed rather than intuition-backed.
>
> New findings land in this file as they appear. Implementation work
> tracked in [`road-to-refine-ticket-hardening.md`](../roadmaps/road-to-refine-ticket-hardening.md).

## Why this doc exists

The original roadmap had a README-demo item (Q19 → Q27) gated on
"at least one consumer project has used `/refine-ticket` on real
tickets and reports back". This doc **is** that report. Keeping it
outside the roadmap means: adoption evidence accumulates as a log,
not as a roadmap checkbox.

## Case studies — 2026-04-22

### Case 1 — `DEV-6182` (Story · Urgent · In Progress)

- **Repo of invocation:** `event4u/agent-config`
- **Ticket project:** `galawork-api` (different repo)
- **Topic:** Foundation work for an external-system integration
  (multi-tenant configuration, activation per tenant, credential
  handling, observability hooks).
- **What was tested:** Full resolver path — URL input, loader, detection
  map, repo-aware mode, sibling-skill triggering (`threat-modeling`
  fired, `validate-feature-fit` skipped), output template, close prompt.

**Observed:**

- Output template rendered cleanly — three `##` sections + an
  `Orchestration notes` trailer + the close prompt (3 options).
- Persona voices differentiated: `critical-challenger` called out a
  split candidate; `senior-engineer` named three architecture
  decisions that belong in the foundation ticket, not in follow-ups.
- Repo-aware mode fired, but pulled context from the invocation
  repo (`event4u/agent-config`), not the ticket's repo
  (`galawork-api`). Skill **correctly surfaced the mismatch** in a
  notes paragraph — this is the desired fail-safe behaviour, but
  the heuristic itself is binary and noisy (see F1).
- `threat-modeling` triggered on a substring match of `password`
  inside the string `1Password` (finding F2). The security surface
  was genuinely real (multi-tenant config + external API keys), so
  the trigger was a lucky false-positive — still a detection defect.

### Case 2 — `DEV-6155` (Task · Medium · POOL)

- **Repo of invocation:** `event4u/agent-config`
- **Ticket project:** `galawork-api`
- **Topic:** Test-level refactor + enforcement policy for an
  enum-vs-string rule.
- **What was tested:** Smaller-scope ticket, no external-system
  interaction, no security surface.

**Observed:**

- Output template identical in shape to Case 1 — template is stable
  across ticket sizes.
- `threat-modeling` correctly skipped (no security keywords).
- `validate-feature-fit` skipped on `require_count: 2` — only one
  matching keyword (`api`) in the body. `critical-challenger` in
  the persona voices still flagged a split-candidate risk, so the
  scope-creep warning was reachable via a different path. Finding
  F3 proposes a second signal for single-domain tickets.
- Persona `ai-agent` produced an actionable recommendation
  (mirror the rule as a guideline in `event4u/agent-config`) —
  exactly the kind of cross-repo insight the persona set is
  designed to surface.

## Observed findings — 2026-04-22

Seven concrete defects / improvement opportunities surfaced across
the two runs. Each is tracked as a phase in
[`road-to-refine-ticket-hardening.md`](../roadmaps/road-to-refine-ticket-hardening.md).

### F1 — Repo-awareness is binary, semantically unreliable

`repo_aware=on` fires on `.git` + `agents/contexts/` +
`composer.json` — without checking whether the repo actually
**belongs to the ticket**. In the two case studies, 17 branches +
30 commits + 1 context-doc from `event4u/agent-config` were loaded
for a `galawork-api` ticket. Signal was not wrong (the repo
exists), but not useful — the skill then cited domain-foreign
vocabulary.

**Proposal:** match the ticket's project key (e.g. `DEV-`) against
repo heuristics (branch prefixes, `composer.json`/`package.json`
name, `agents/contexts/` body) — or at minimum, print the source
repo in `Orchestration notes` so the reader sees the mismatch
themselves.

### F2 — `threat-modeling` false-positive on substring matches

Case 1 triggered on the keyword `password` inside `1Password`.
Keyword list does substring matches without word boundaries.

**Proposal:** switch to `\bpassword\b`-style regex; or keep a
blocklist for well-known composites (`1password`, `lastpass`,
`bitwarden`).

### F3 — `validate-feature-fit require_count: 2` too conservative on single-domain tickets

Both cases: only one matching keyword → skipped. Case 1 had a real
scope-creep risk (Config + Client + UI + Monitoring all at once)
but the trigger didn't catch it.

**Proposal:** add an alternative signal — verb count in
acceptance criteria, or sentence count in the description as a
proxy for "many topics in one ticket".

### F4 — Parent / linked-issue context is manual

Skill documents ticket fetch, but not parent-epic auto-fetch. In
Case 1, the parent epic (`DEV-6047`) carried AC context
(`GraphQL vs. XML`) that the story itself did not. Without
fetching it manually, the skill would have missed a relevant open
question.

**Proposal:** when `issuetype = Story` or `Sub-task`, auto-fetch
the parent (+1 API call) and fold its AC / description into the
analysis context. Keep it off for `Task` / `Bug` unless linked.

### F5 — Language strategy not documented

User input was only the slash command + URL — no prose language.
Output language (German in both cases) was derived from ticket
body + project context. SKILL.md does not document the fallback
hierarchy.

**Proposal:** add a short rule to the skill procedure —
`user-message > ticket-language > agent-settings.yml default`.
Locks the behaviour so future maintainers don't second-guess it.

### F6 — Close-prompt write-permission not probed

Skill says "degrade to copy-paste if `jira-ticket` write
permissions missing". No upfront probe — user only finds out
after picking option 1 or 2.

**Proposal:** one cheap `GET /myself` + `editmeta` check when the
ticket is loaded. If write access is absent, grey out / hide
options 1 and 2 in the close prompt.

### F7 — Cross-repo invocation is a real use case

Monorepo setups (here: `galawork-packages`) make it likely that
developers invoke `/refine-ticket` from one package against
tickets of another. Currently no warning line — user has to
detect the mismatch themselves.

**Proposal:** when ticket-project-key ≠ detected repo-project-key,
print an explicit line in `Orchestration notes`:
*"Ticket project X, repo project Y — context may not apply."*
Natural follow-up to F1.

## Adoption impact

Q27 in [`open-questions-2.md`](../roadmaps/open-questions-2.md)
(README demo, adoption-gated) is resolved by this file:

- ≥ 2 real tickets refined (DEV-6182, DEV-6155).
- Output template stable across ticket sizes.
- Seven concrete, actionable findings documented.
- Hardening roadmap created with one phase per finding.

The README demo can now reference a real run. Recommended template
source: **DEV-6155** — smaller scope, no customer / partner names,
no security-surface specifics, fits cleanly into a single README
section without redaction.

## See also

- [`archive/road-to-ticket-refinement.md`](../roadmaps/archive/road-to-ticket-refinement.md) — v1 shipped (all phases done)
- [`road-to-refine-ticket-hardening.md`](../roadmaps/road-to-refine-ticket-hardening.md) — v2 follow-ups (F1–F7)
- [`open-questions-2.md`](../roadmaps/open-questions-2.md) — Q27 resolution
- [`.agent-src.uncompressed/skills/refine-ticket/SKILL.md`](../../.agent-src.uncompressed/skills/refine-ticket/SKILL.md)
- [`.agent-src.uncompressed/skills/refine-ticket/detection-map.yml`](../../.agent-src.uncompressed/skills/refine-ticket/detection-map.yml)
- [`.agent-src.uncompressed/commands/refine-ticket.md`](../../.agent-src.uncompressed/commands/refine-ticket.md)
- [`scripts/refine_ticket_detect.py`](../../scripts/refine_ticket_detect.py)
- [`tests/test_refine_ticket_detect.py`](../../tests/test_refine_ticket_detect.py)

