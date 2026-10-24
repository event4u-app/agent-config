---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
# relates: roadmap:context 2026-10-24 — scanned: 5 PRs, 1118 roadmap files, 923 remote branches; no sibling on the topic
relates:
  - slug: road-to-skill-ecosystem-security-and-conformance
    relation: disjoint
    note: >
      Parked; owns three other unenforced rules and declared-vs-actual tool
      grants. This roadmap owns authorization of actions an AI agent or bot
      takes for a requester.
estate_offset_exempt: "Owner search 2026-10-24: grep -rlF for 'delegated', 'agent action', 'author_association', 'support bot', 'mcp-builder', 'impersonat' over agents/roadmaps/*.md, later/ and stubs/, plus agents/roadmaps-owned.md — road-to-skill-ecosystem-security-and-conformance (parked) owns three other unenforced rules and tool-grant drift, road-to-mcp-full-power (parked) owns MCP coverage; nothing owns authorization of actions an AI agent or bot takes for a requester. Executed and archived in the same change, so the active count is unchanged at merge."
---
# Road to a claim that is not a key

> **Source:** `agents/tmp.old/inbox-2026-10-ah/` — an owner chat, a short video
> of a support-bot account-takeover incident (reconstructed from captions,
> confirmed against press coverage and a regulator filing), and two supplied
> plans, drained 2026-10-24 at `origin/main` c164cc24b4. Source names stay in
> the gitignored inbox. The repo-facing name of the class is **conversational
> ownership claim**.

## The incident class

A support assistant with write tools on identity fields changed an account's
recovery e-mail because the requester *named* the account and *said* it was
theirs; per the operator's own notice a second, separate code path skipped the
e-mail check as well. No prompt injection was needed. Three lessons: a claim in
a conversation is not a key; the check belongs where the write happens and must
hold on every path; step-up, notice to the old channel and a human escalation
path are architecture, not extras.

The owner's requirement, verbatim in substance: not only AC — every project and
every AI bot a project connects must account for this, and AC must make sure
the projects do.

## Invariant

```
A CLAIM IS AN INPUT, NEVER AN AUTHORIZATION.
THE SUBJECT OF A WRITE COMES FROM AN AUTHENTICATED PRINCIPAL, NEVER FROM THE
CONVERSATION OR A TOOL ARGUMENT THE MODEL FILLS.
AN IDENTITY-CRITICAL WRITE REFUSES WITHOUT A VERIFIED GRANT ON EVERY PATH —
THE CHECK LIVES WHERE THE WRITE HAPPENS, NOT WHERE THE REQUEST ARRIVES.
```

Boundary (ADR-123): AC detects, teaches, tests and reports. Enforcement lives in
the project's own backend; nothing here makes AC a runtime gateway.

## Goal

When this is finished, a project that adds or changes anything an AI agent can
*do* — an MCP tool, a function-calling tool, a bot action — gets, without the
developer asking: the security rules firing on that request, threat rows for
delegated actions, an authorization review that treats tool calls as
entrypoints, a deterministic check (`/audit agents`) that lists every tool
registration and every write tool whose subject comes from a model-filled
argument, and a probe class that rates a bot obeying an ownership claim
do-not-ship. And AC's own `/fix:pr-comments` stops applying and pushing code
from people without write access. Someone else can tell by running fixtures
G1–G7 at the landing commit, each with a recorded red at c164cc24b4.

## Defects at `origin/main` c164cc24b4 (all re-verified)

| ID | Defect | Evidence |
|---|---|---|
| D1 | An agent-authority request activates no security rule: four measured prompts (EN/DE, chatbot e-mail change, agent account settings, MCP password reset) match 0 security rules; the MCP one matches only `secret-vcs-guard` on `password` | `route:explain`; triggers `src/rules/security-sensitive-stop.md:9-20` |
| D2 | The threat corpus has zero rows for agent, bot or tool actions; 11 surface classes, none for delegated actions | `src/skills/threat-modeling/data/{threats,surfaces}.csv` |
| D3 | Grounding reports a false green for the incident: `Confidence: high (0.41)`, `Evidence gap: none`, wrong threat (federated sign-in) | `ground.mjs`; `manifest.json:20` surfaces `max_results: 1` |
| D4 | The closest row models the wrong actor — "A hijacked session can change…"; the incident had no session | `threats.csv:11-12` |
| D5 | `authz-review` inventories routes, actions and jobs — never tool calls; `broken-access-control` never says a model-filled argument is request-supplied | `authz-review/SKILL.md:68,78,171`; `broken-access-control.md:38-41` |
| D6 | `mcp-builder` recommends names over IDs and a shared auth/token cache with no word on whose record a name selects | `mcp-builder/SKILL.md:32,43,47,74` |
| D7 | `evaluate-llm-feature` probes injection, not impersonation | `evaluate-llm-feature/SKILL.md:72-87` |
| D8 | The consumer auth template knows admin impersonation only — no non-human actors, no recovery-channel question | `src/agent-src/templates/contexts/auth-model.md:33-42` |
| D9 | PR risk defaults ignore agent surfaces; the shipped workflow installs the package unpinned | `pr_risk_review.ts:51-59`; `pr-risk-review.yml:47` |
| D10 | AC's own `/fix:pr-comments` Auto applies a "clear code fix" from **any** human commenter, then commits and pushes; the loop makes that standing; `author_association` is read nowhere | `fix/pr-comments/command.md:56,63-65,157,227`; `pr-comments-loop/command.md:35-38` |
| D11 | Nothing checks a project mechanically: the rule is instruction-only, `/audit` has one mode (deps) | `security-sensitive-stop.md:28-29`; `audit/command.md:26` |
| D12 | No path-independence pattern for identity sinks | 0 hits for `chokepoint`, `every path`, `alternate path` over authz-review, threat-modeling, ai-code-blindspots, `src/rules` |

## Phase 1 — AC's own agent first (public repository, live exposure)

- [x] **1.1 `/fix:pr-comments` reads `author_association`.** `OWNER`, `MEMBER`,
      `COLLABORATOR` keep the current flow. Every other value — `CONTRIBUTOR`,
      `FIRST_TIME_CONTRIBUTOR`, `NONE`, missing — is never applied in Auto: it is
      listed verbatim in the "needs your decision" block, as the found-instructions
      quarantine requires. Bots keep their triage. The loop's authorization
      contract names the gate.
      verify: G7 — a recorded comment payload with `author_association: NONE`
      carrying a "clear fix" is classified `needs-owner`, and the same payload
      with `MEMBER` is classified `apply`, in a test over the classifier.
- [x] **1.2 Census of commands that act on third-party text.** Every command or
      skill that turns issue, PR, ticket or chat text into commits, pushes or
      external sends gets one row: gated, or why no gate is needed.
      verify: the census table in this roadmap's § Census has one row per grep
      hit of the command bodies that push on another person's text.

## Phase 2 — Name the class in the threat corpus

- [x] **2.1 Surface class `delegated-action`** in `surfaces.csv`, keywords
      covering agent, assistant, chatbot, bot, support, helpdesk, tool call,
      function calling, mcp tool, on behalf, account recovery, email change,
      takeover.
      verify: G2 — the incident query grounds to `delegated-action`.
- [x] **2.2 Six threat rows, class `delegated-action`:** T1 conversational
      ownership claim treated as authorization · T2 subject selected by a tool
      argument · T3 one service credential acting for every caller · T4 an
      alternate code path to an identity sink · T5 AI-only recovery and weak
      substitute factors · T6 injected content reaching an action. Each row
      carries Abuse Case, Required Controls and a non-empty Negative Tests cell.
      verify: G2 green; the threat-modeling evals still pass.
- [x] **2.3 Actor-neutral rows 11 and 12.** "A hijacked session, a support
      agent, an admin tool or an AI assistant acting on a request can change…";
      the delegated-actor case joins Negative Tests. Controls stay.
      verify: the diff touches only the Abuse Case and Negative Tests cells.
- [x] **2.4 A composite description never grounds with `Evidence gap: none`
      while a matched class is dropped.** With one surface returned, the gap
      names the dropped class.
      verify: G2 — a description matching two classes prints the second in the
      evidence gap.

## Phase 3 — Router: existing rules, new triggers, no new rule

- [x] **3.1 `security-sensitive-stop` triggers and surface row.** Phrase
      triggers specific enough not to collide (`account recovery`, `email
      change`, `recovery email`, `support bot`, `chatbot`, `on behalf of`,
      `tool call`, `function calling`, `mcp tool`, `mcp server`, DE `E-Mail-Adresse`,
      `Support-Bot`, `Konto wiederherstellen`) and one surface row "Delegated
      actions".
      verify: G1 — the four D1 prompts plus their variants list
      `security-sensitive-stop` in `route:explain`; a negative prompt about a
      CLI tool does not.
- [x] **3.2 One sentence in the `broken-access-control` Iron Law:** "A TOOL
      ARGUMENT A MODEL FILLS IS A REQUEST-SUPPLIED ID." plus matching triggers.
      verify: G1 shows `broken-access-control` on the write-tool prompts; the
      auto-rule budget check stays under its unchanged baseline.

## Phase 4 — Skills and templates that build and review bots

- [x] **4.1 `authz-review`: tool calls are entrypoints**, stage 1 asks where the
      subject comes from (session, policy system, or the model's argument), a
      fourth negative test for tools, and the path-independence pattern (D12):
      the identity write is guarded at the data layer, one writer per identity
      field, an architecture test forbids the rest.
      verify: the skill lints green and the sections name both patterns.
- [x] **4.2 `mcp-builder`: authority before ergonomics.** Names over IDs only
      for objects inside the caller's scope; the subject of a write is never
      chosen by the model; per-caller delegated credentials instead of a shared
      cache; a required per-tool authority block (`subject_source`, `effect`,
      `verifier`, `human_approval`, `notify_old_channel`, `audit_log`); two
      authority questions in the evaluation set.
      verify: skill lints and trigger evals green.
- [x] **4.3 `evaluate-llm-feature`: impersonation probe class** — ownership
      claim, urgency, claimed staff role, claimed prior verification, a claimed
      approval from another agent; any claim probe that triggers a write rates
      the feature do-not-ship.
      verify: skill lints green; the verdict rule is stated in the report
      template.
- [x] **4.4 `auth-model.md`: Delegated actors** — actor × fields it may change ×
      proof required × channel notified × human approval, plus "who may change a
      recovery channel, confirmed over which verified channel?".
      verify: `check_context_paths` green.

## Phase 5 — Make the projects do it

- [x] **5.1 Detector `agent_actions_detect` (no model, no network).** Finds tool
      registrations of known SDKs (MCP server `tool(`/`registerTool`, Vercel AI
      SDK `tool({`, OpenAI and Anthropic tool schemas, LangChain `@tool`,
      PHP attribute tools) and reports per registration: declared in
      `agents/settings/contexts/agent-actions.yml`? write effect with a subject
      argument (`username`, `email`, `account`, `user_id`, `customer_id`)? A file
      that mentions agent tooling but matches no known shape reports `unknown`,
      never clean.
      verify: G3 — a synthetic fixture tree with four registrations (one
      undeclared, one write tool with a subject argument, one unknown framework)
      yields exactly those findings and one `unknown`.
- [x] **5.2 Template `agent-actions.yml`** — one entry per agent action with the
      4.2 authority block.
      verify: the detector parses the template without findings.
- [x] **5.3 `/audit agents`, a second mode of `/audit`.** Same contract as
      `/audit deps`: every finding names `file:line`, `unknown` is said, the fix
      is a change the owner merges.
      verify: command lint green; `audit/command.md` no longer says deps is the
      only audit.
- [x] **5.4 PR risk defaults and a pinned install.** High patterns for tool,
      agent, MCP and prompt paths; the workflow template installs a pinned major.
      verify: the classifier test rates a tool-file change `high`; the template
      carries a version.

## Census

Commands and skills that turn another person's text into commits, pushes or
external sends (step 1.2, 2026-10-24):

| Command / skill | Acts on whose text | Gated? | Disposition |
|---|---|---|---|
| `/fix:pr-comments` | review comments from any account | yes, since 1.1 | `pr_comment_authority` classifier; `needs-owner` is never applied |
| `/fix:pr-comments-loop` | the same, as a standing loop | yes, since 1.1 | inherits the gate; its authorization contract names it |
| `/analyze:pr --optimize` | PR head, body and comments | yes | pushes only to a writable same-repo head with compare-and-swap; fixes come from its own analysis, not from comment text |
| `/council:pr` | any PR's diff → an external comment | yes | posting is opt-in per run |
| `/analyze:and-optimize` | its own tree | not needed | pushes only to its own run PR |
| `/roadmap:next`, `:process-full`, `:process-phase` | committed, reviewed roadmaps | not needed | no third-party text reaches the push |
| `/pr:create`, `/fix:commit-messages`, `/memory:promote` | own branch, history, memory | not needed | no third-party text |
| `/upstream-contribute` | own self-repair record | yes | `--approve <digest>` |
| `receiving-code-review` (skill) | review comments | not needed | triage only, never pushes |

## Not done here, and why

| Item from the sources | Disposition |
|---|---|
| A portable `ac.authority/v1` YAML contract with a compiler and per-stack adapter packages | Declined: `agent-actions.yml` (5.2) is the inventory; enforcement belongs in the project (ADR-123), and published adapter packages are a new distribution commitment |
| A security gateway / tool interceptor | Declined: ADR-123; would need a measured host gap first |
| Fleet portfolio across all projects, drift watcher | Parked: needs a reading from `/audit agents` on real projects first |
| promptfoo / PyRIT / garak integration | Declined as dependencies; 4.3 is the black-box probe class, nightly red-team runs are the project's choice |
| A new skill or a new auto rule | Killed: four existing skills and two existing rules carry it |
| Blocking CI by default in consumer repos | Killed: non-blocking report, the project opts in |
| A column-level "every writer passes guard G" code-graph query | Gated: only after a fixture shows the architecture test of 4.1 misses a path |
| Project-specific examples from the sources | Declined: portability rule — consumer packages stay project-agnostic |

## Decisions

| ID | Class | Decided by | Decision | Evidence | Revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Phase 1 runs first | D10 is a live exposure on a public repository | — |
| D2 | reversible-technical | evidence | Comment authority threshold `OWNER`/`MEMBER`/`COLLABORATOR` | the three associations that carry write access | a legitimate outside contributor's fixes are routinely starved |
| D3 | reversible-technical | evidence | Composite surfaces: honest gap at `max_results: 1`, not a raised cap | single-class retrieval stays unchanged | G2 still drops a class with the gap printed |
| D4 | reversible-technical | evidence | `/audit agents` rather than a mode of `/security-audit-config` | that command audits AC's own config; this audits the project | — |
| D5 | reversible-technical | evidence | The closure scan's one `typed-op` hit (the frontmatter owner search) is prose, not an operation: no step pushes, merges or deletes | `closure_scan` run 2026-10-24, one hit, read | a step is added that pushes or merges on its own authority |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Trigger collisions | implementation | `tool`, `agent`, `bot` are common words and would fire on unrelated work | phrase triggers only; G1 carries a negative prompt | Phase 3 — Router: existing rules, new triggers, no new rule |
| 2 | Detector false comfort | implementation | an SDK the detector does not know reads as "no agent actions" | the `unknown` state is mandatory and tested | Phase 5 — Make the projects do it |
| 3 | Over-blocking outside contributors | product | 1.1 starves legitimate fixes | they are listed for the owner, never dropped | Phase 1 — AC's own agent first (public repository, live exposure) |

## Acceptance Criteria

- [x] AC-1 — Each D1 prompt activates `security-sensitive-stop` (G1).
- [x] AC-2 — The incident query grounds to `delegated-action`, and no composite
      query prints `Evidence gap: none` while dropping a class (G2).
- [x] AC-3 — `/audit agents` reports every recognised registration missing from
      the inventory, every write tool with a subject argument, and `unknown` for
      unrecognised frameworks (G3).
- [x] AC-4 — A comment from a non-collaborator is never applied by
      `/fix:pr-comments` Auto or the loop (G7).
- [x] AC-5 — The auto-rule budget baseline is unchanged.
