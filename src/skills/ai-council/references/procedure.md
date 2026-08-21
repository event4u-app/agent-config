# ai-council — procedure and critical evaluation

> Mode body of the [`ai-council`](../SKILL.md) skill (router-head retrofit,
> 2026-08-20). Content moved VERBATIM from SKILL.md — load this file when the
> mode table in SKILL.md routes here.

### Neutrality — context-handoff

External reviewers do better critique when they know **what the
project is**, not just what the artefact looks like. The council
ships a neutral **handoff preamble** (modelled on `/agent-handoff`)
in front of every member's system prompt, assembled by
`prompts.handoff_preamble(project, original_ask)`:

| Carried | Forbidden |
|---|---|
| Project name (from `composer.json` / `package.json` / repo dir) | Host-agent identity (Augment, Claude Code, Cursor, Cline, Windsurf, Copilot agent) — stripped line-by-line before send |
| Stack one-liner inferred from manifest files | Host-agent reasoning, prior turns, internal analysis |
| One paragraph of repo purpose from `README.md` (max 400 chars) | Host-agent framing language ("I think this looks weak", "the user probably wants…") |
| The user's **original ask** verbatim (the free-form sentence that triggered `/council`) | Anything the host agent generated about the artefact |

`detect_project_context()` in `scripts/ai_council/project_context.ts`
reads only the manifest files + root README; missing fields collapse
to `None` and the preamble silently omits the line. With both
`project=None` and `original_ask=""`, the preamble degrades to the
bare `NEUTRALITY_PREAMBLE` (v1 shape — back-compat for callers that
have not migrated yet).

## Procedure

1. **Resolve target.** Identify the artefact mode (`prompt`, `roadmap`,
   `diff`, `files`) and locate the source. Refuse to proceed if the
   target is ambiguous.
2. **Bundle + redact.** Call `scripts/ai_council/bundler.ts` to produce
   a redacted artefact bundle. If `BundleTooLarge` fires, surface the
   size and ask the user to narrow scope — do NOT truncate silently.
3. **Clear the spend bound.** The council is standing-authorized — there is
   no per-invocation approval. What still binds is a *bound*, resolved in
   this order:
   - **No billable member** (every member is `mode: cli` under
     subscription auth — `billable=False`) → nothing is spent. Render the
     estimate table as information and fan out. No gate.
   - **Billable members with a configured ceiling** (`cost_budget.max_total_usd`
     non-zero, or `daily_limit_usd` non-zero) → the ceiling **is** the
     authorization the user already gave. Render the estimate and fan out.
     `on_overrun` still fires per member on breach (below) — that is where
     the user regains the decision.
   - **Billable members with no ceiling at all** (`max_total_usd: 0` AND
     `daily_limit_usd: 0`) → unbounded paid spend, so surface the estimate
     and require an explicit `1`. Nothing bounds the call, so the user must.

   Autonomy settings do not *create* a bound and do not lift the last case.
   Consumers who want the old per-run gate back set a small
   `cost_budget.max_total_usd`: every call then breaches and `on_overrun`
   asks, per member.
4. **Fan out.** Dispatch the bundle to each enabled council member via
   `scripts/ai_council/orchestrator.ts`. Each member receives the
   neutrality preamble from `prompts.ts` plus the artefact — nothing
   from the host agent's prior reasoning.
5. **Render results.** Stack each member's response under its own
   provider-attributed heading. Never merge or paraphrase responses
   into the host agent's voice.
6. **Summarise.** Write a `Convergence / Divergence` block listing
   agreements, disagreements, and unique insights — provider-attributed.
7. **Critically evaluate** every finding before it leaves the host
   (see *Critical evaluation* below). The host is the convener **and**
   the skeptic — never a reviewer of the artefact itself, but always a
   reviewer of the **council's output**.
8. **Translate validated findings to options.** Convert each finding
   the host accepts (or accepts with modification) into a concrete
   numbered option for the user. Tag every option with the host's
   verdict so the user sees the agent's reasoned position, not the
   council's raw output. The user decides; the council advises; the
   host filters.

## Critical evaluation — convener-skeptic stance

```
COUNCIL CONVERGENCE IS NOT CORRECTNESS.
DO NOT BLINDLY ACCEPT FINDINGS. DO NOT BLINDLY REJECT THEM.
EVERY FINDING GETS A REASONED VERDICT BEFORE IT REACHES THE USER.
```

### Mechanism claims need a probe, not a second opinion

```
A MECHANISM CLAIM IN A COUNCIL ARTEFACT IS MARKED `unverified:` UNTIL A PROBE COVERS IT.
A VERDICT RESTING ON AN UNVERIFIED MECHANISM CLAIM DOES NOT BIND.
SEVERAL MODELS AGREEING MULTIPLIES PLAUSIBILITY. IT DOES NOT PRODUCE EVIDENCE.
```

A **mechanism claim** asserts how the machine behaves: "this toggle removes the
cost", "that gate scans X", "the host reads the router". The council deliberates
over **arguments**, never against the running system — it cannot execute a command,
so it has no way to falsify one. Marking such a claim `unverified:` in the artefact
keeps the reader from mistaking a well-argued mechanism for a measured one, and the
non-binding clause means the fix for a wrong claim is a probe, not a re-vote.

**Case zero (2026-07-29).** An accepted ADR claimed a compile-time toggle gave
"zero-cost dormancy" because the rule was dropped from `dist/router.json`. Two
council members praised the reasoning; neither could check it. A one-line `grep`
later showed the toggle was read by the router compiler and by **nothing in the
projector**, so the rule's body kept shipping as a file — and the host reads the
file. The claim was half wrong, the verdict that rested on it was void, and what
caught it was a probe, not a third opinion.

The council is **uninformed about the codebase, ADRs, locked
contracts, prior decisions, and project history** — it sees only the
artefact + neutrality preamble. That is the source of its diversity
**and** its blind spots. Convergence between members can mean shared
generic best-practice priors, not project-specific correctness.

The host applies a critical lens to **every finding** (convergence
**and** divergence) before surfacing it as a numbered option:

| Check | Question | Tool |
|---|---|---|
| **Codebase fit** | Does the finding match the actual code, files, signatures, conventions? | `view` / `codebase-retrieval` / `grep` |
| **Locked-decision conflict** | Does it contradict an ADR, kernel rule, contract under `docs/contracts/`, or `docs/decisions/`? | `view` |
| **Already addressed** | Is it a generic best-practice already covered by an existing rule, skill, or test? | `view` / `grep` |
| **Cost / benefit** | Is the change worth the diff size, churn, and review cost vs. the marginal benefit? | reasoning |
| **Hallucination** | Does the finding cite a file, function, or behavior that does not exist? | `view` |

Each finding receives one of three verdicts:

- **`accept`** — codebase fits, no locked-decision conflict, benefit clears cost. Surface as a normal numbered option.
- **`accept-with-modification`** — core insight valid, but the proposed shape needs adjusting (wrong file, contradicts ADR detail, scope creep). Surface with the **modified** patch and a one-line note.
- **`reject`** — finding is wrong (hallucinated reference, contradicts a locked decision, already addressed, generic noise). Surface as a **Rejected by host** entry with a one-line reason. Still visible — the user can override.

The verdict is the host's **own** reasoning, not the council's.
Pretending convergence equals correctness, or paraphrasing council
output as host analysis, both breach the [`direct-answers`](../../../rules/direct-answers.md)
no-invented-facts rule. When the host cannot reach a confident
verdict on a finding (mixed evidence, ambiguous scope), it surfaces
the finding as `needs-input` with the open question — the user
decides, the host does not guess.

### What this is NOT

- **Not a re-review by the host.** The host did not write the artefact independently and cannot critique it independently — that boundary still holds.
- **Not a vote against the council.** Rejecting a finding requires evidence (file, line, contract reference), not preference.
- **Not silent filtering.** Every finding reaches the user with its verdict and reason. The user can pick a `reject` option and override the host.

