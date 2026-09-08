---
kind: analysis
subject: self-imposed stop gates
observed_at: 2026-09-08
commit: 0ee772b9dff8807924a50d4ab9df367df1ec68ed
---

<!-- evidence-type: analysis -->

# Self-imposed stop-gate audit

> **This is evidence, not a decision.** Every claim cites `file:line` read at
> commit `0ee772b9d`. Where a fact could not be established the entry says so.
> The dispositions in § 4 are **proposals** and are marked as such; the ones
> executed in the same change are marked EXECUTED and name the commit that did
> it.

Commissioned by the maintainer's directive of 2026-09-08, Directive 3.3: *audit
the repo for other self-imposed gates of the same shape — statuses, probes,
"owner-reserved" exits, "needs human" markers — that an autonomous run would
treat as an excuse to stop.*

## 1. The finding that reframes the rest

**Nothing in this tree enforces that an autonomous run must stop at a
`status: carrier` roadmap.** No rule file, no command, no hook, no lint. The
stop rested entirely on prose inside three roadmap files.

Both drain commands define their corpus without naming `carrier`:

- `src/domains/product-basic/roadmap/process-full/command.md:96-98` — *"The
  corpus is the non-draft roadmaps directly under `agents/roadmaps/`; `later/`,
  `skipped/`, `archive/` and `stubs/` are out of scope."*
- `src/domains/product-basic/roadmap/next/command.md:60-62` — excludes
  `template.md`, `archive/`, `skipped/`, `later/`, and `status: draft` whose
  promotion trigger has not fired. `carrier` is absent.

And the same command **already forbids the stop that was taken**
(`process-full/command.md:262-291`):

```
FORBIDDEN NON-HALT REASONS — NEVER STOP THE RUN FOR ANY OF THESE:
  · "this step looks human-gated" — `blocked` is reached by the § 3c
    runnable test over PRE-EXISTING blockers, never by how a step feels
  · "a maintainer should do this" when the agent can perform the same action
  · any agent-invented caution not in the five halt conditions above.
INVENTING A HALT REASON IS A VIOLATION OF THE COMMAND AND THE USER'S WILL.
CAPABILITY BEFORE ROLE: IF THE AGENT CAN DO IT AND THE INVOCATION GRANTS IT,
DOING IT IS THE ONLY CONFORM ACTION.
```

So the 2026-09-08 stop was not a defensible reading of an ambiguity. It was a
violation of the executing command's own written contract, reached by reading
prose the command does not consult. That is the shape this audit looks for
everywhere else: **an authority claim living in a document that no mechanism
reads, cited by the party that benefits from citing it.**

The tree also already lints for the shape inside roadmaps —
`src/scripts/lint_roadmap_complexity.ts:306` flags
`/\bhuman review (required|needed|gate)\b/i` as an authoring defect, with
`_check_human_gate_steps` at `:334`, `_check_human_gate_phase_headings` at
`:351` and `_check_human_gate_exit_criteria` at `:366`, all three dispatched
from `:230-232`. It checks `- [ ]` step
lines, headings and criteria blocks. **It does not check body prose**, which is
exactly where all three carrier stops lived.

## 2. Classification method

Each hit is classified by one question: **does the stop protect against an
outcome the maintainer cannot undo, or does it only protect a decision the
maintainer already made?**

| Class | Meaning | Disposition |
|---|---|---|
| **(1) SAFETY FLOOR** | destructive · irreversible · external · spend · legal/public commitment · privacy | KEEP unchanged |
| **(2) ORDERING** | a real precondition, mislabelled as authority | KEEP the ordering, DELETE the authority language |
| **(3) SELF-IMPOSED STOP** | no safety content; the stop protects nothing but itself | REMOVE |

## 3. The audit

### 3a. Class 3 — pure self-imposed stops

| # | file:line | Quoted | Disposition |
|---|---|---|---|
| 1 | `agents/roadmaps/road-to-council-topology-evidence-followups.md:80-81` | "a `status: carrier` roadmap is human-gated and an autonomous run may not execute, promote, close, or advance it" | REMOVE — EXECUTED this change |
| 2 | `agents/roadmaps/road-to-council-topology-evidence-followups.md:87,93,102` | "its sole stated transition is *'a human flips it to `ready`'*" · "'a human flips it' is the whole path" · "*Reopening:* a human flips `status` to `ready`. Nothing else." | REMOVE — EXECUTED this change |
| 3 | `agents/roadmaps/road-to-continuity-retirement-sequencing.md:50-51` | same verdict sentence | REMOVE — EXECUTED this change |
| 4 | `agents/roadmaps/road-to-continuity-retirement-sequencing.md:83` | "The measured-null exit is owner-reserved." | REMOVE — EXECUTED this change |
| 5 | `agents/roadmaps/stubs/road-to-command-runtime-requirements.md:27` | heading: "## Why an autonomous run may not take it" | **PROPOSAL** — convert to a named precondition or delete. Not executed here; out of this change's scope. |
| 6 | `agents/roadmaps/stubs/road-to-make-it-stick-telemetry.md:21` | same heading | **PROPOSAL** — as above |
| 7 | `agents/roadmaps/stubs/road-to-owner-authority-decisions.md:179-187` | "reopening it is owner-reserved" — governance self-amendment justified by the same estate that wrote it | **PROPOSAL** — genuinely self-referential; needs the maintainer's read, per Directive 3.3's "keep" path |
| 8 | `agents/roadmaps/stubs/road-to-adr-134-expiry.md:32` | "Resolving it is owner-reserved by ADR-134's own terms" | **PROPOSAL** — authority derived from a self-authored ADR |
| 9 | `src/config/gate-violation-baselines.json:88-92` | `lint_carrier_integrity` ratchet at 243, whose note rules out both fixing the findings and lowering the count, leaving only periodic `reaffirmed:` | **PROPOSAL** — a ratchet with no permitted escape is a stop wearing a gate's clothes. Left standing: lowering it is a separate measured change, not a prose edit. |

### 3b. Class 2 — ordering constraints carrying authority language

| # | file:line | Quoted | Disposition |
|---|---|---|---|
| 10 | `road-to-continuity-retirement-sequencing.md:16-18` | "until a human flips it to `ready`" | REWRITE — the P1–P4 probe is the real ordering; the human flip is not. EXECUTED |
| 11 | `road-to-continuity-retirement-sequencing.md:23-24` | "**Nothing here is scheduled work**, and nothing here may start until the probe reads true" | REWRITE — EXECUTED. P1 is additionally *misdrawn*: it cannot become true without performing step 3.1, the step it gates. |
| 12 | `road-to-continuity-retirement-sequencing.md:172-175` | "Promotion is a human flipping `status: carrier` to `status: ready`" | REWRITE — EXECUTED |
| 13 | `src/rules/decision-revisit-gate.md:142,147,148` | owner-reserved rows "Changes the project's purpose" (`:142`), "Governance self-amendment" (`:147`), "Cannot be bounded from available evidence" (`:148`) | **PROPOSAL** — the other four rows of that table are Class 1 and stay. These three carry no destructive/external content. Kernel-adjacent; a rule edit there needs its own PR and soak per `scope-control`. |
| 14 | `src/agent-src/scripts/archive_completed_roadmaps.ts:390-398` | `[-]` is owner-reserved AND pinned to mean "won't happen at all" | KEEP the semantics, and note the cost: this is why 243 archived `[~]` are ratcheted rather than repaired (`gate-violation-baselines.json:91`). The reservation protects a *meaning*, not a floor. |
| 15 | `src/scripts/_lib/promotion_capability.ts:302` | "promotion into canonical agent-config is gated on the owner-reserved blocker" | **PROPOSAL** — cross-repo promotion is process ordering |
| 16 | ADR-245, ADR-252, ADR-259, ADR-216 (`reopen_policy: owner`) | design/product preferences wearing owner authority | **PROPOSAL** — contrast ADR-251/254/255, which carry `protected_dimensions: security_floor` and are Class 1 |
| 17 | `agents/roadmaps/road-to-the-skill-surface-framing-choice.md:25-27` | "The decision is owner-reserved. It changes what the package claims to be for its consumers" | **KEEP the reservation on the DECISION** (a public commitment is a named Class-1 dimension, `src/rules/decision-revisit-gate.md:146`) — but the reservation is on the decision, not on the file. Its steps are executable; the file should not wear a status that stops a run. |

### 3c. Class 1 — safety floors, all correctly scoped, all kept

`src/domains/product-basic/roadmap/process-full/command.md:158-176` (never
merges) · `next/command.md:353` (no merge, ever) ·
`src/scripts/check_no_automerge_key.ts:259` (merge authority) ·
`src/rules/lethal-trifecta-guard.md:72` (egress) ·
`src/rules/domain-safety-pii.md:153` · `src/rules/doc-screenshot-hygiene.md:4`
(published egress) · `src/rules/source-discovery-gate.md:84` (untrusted source
trust/commit) · `src/agent-src/contexts/execution/user-memory-channels.md:89`
(user-global writes) ·
`src/agent-src/contexts/execution/subagent-spawn-contract.md:171` ·
`src/scripts/detect_target_license.ts:108,139` (licensing) ·
`next/command.md:120` (spend + public release) ·
`src/rules/decision-revisit-gate.md:146` (legal / regulatory / contractual /
licensing / compatibility / public commitment) ·
`docs/contracts/value-report-schema.md:19`.

**None of these is touched by this change, and none should be.** Every one of
them names an outcome the maintainer cannot undo by saying so afterwards.

### 3d. Two constructs that are already the right shape

Worth recording because they are the pattern the carrier status did not follow.

- `src/domains/product-basic/roadmap/next/command.md:115-119` splits **human
  ACTION** (install a secret, click a repo setting, approve spend, let a date
  pass) from **judgement call**, and routes only the first to a disqualifier:
  *"a blocker that is a judgement call … is not a disqualifier — it is
  council-resolvable."* That is the discriminator this audit adopts.
- `src/rules/decision-revisit-gate.md:155-159` — `reopen_policy` defaults to
  `unclassified`, **not** `owner`, with the stated reason that an owner default
  *"would encode today's blockage into the new schema."* Fail-open by default,
  explicit opt-in to the stop.

### 3e. Non-gates, recorded to prevent a false positive later

`src/agent-src/scripts/stub_queue.ts:34-43` and `src/scripts/stubs_due.ts:57-65`
define `OWNER_ROUTING` — nine authority phrases. **These count; they do not
stop.** They are the best available census surface for this class and should not
be mistaken for the thing they measure.

`src/scripts/report_carrier_divergence.ts` and every "carrier" hit in
`src/rules/session-canary.md:88-137`, `src/rules/delegation-policy.md:100-109`,
`src/scripts/schemas/rule.schema.json:218` use *carrier* in the unrelated sense
of an obligation-delivery vehicle. Out of scope for the status change.

## 4. Disposition summary

| Disposition | Count | Where |
|---|---|---|
| EXECUTED in this change | 7 | entries 1–4, 10–12 |
| PROPOSAL — needs the maintainer's read | 8 | entries 5–9, 13, 15, 16 |
| KEEP with a stated reason | 3 | entries 14, 17, and all of § 3c |

Per Directive 3.3, "keep" is the exception and needs the maintainer's sign-off
**after** this run, not before. The eight proposals are listed above with
`file:line` so that read is a read of the tree, not of this document.

## 5. What was NOT audited

- `docs/decisions/` in full. 146+ accepted ADRs; only those surfacing a
  `reopen_policy: owner` field were read (`grep -rn 'reopen_policy: owner'
  docs/decisions/`), which is 10 files. An ADR that reserves authority in prose
  without that field would not appear here.
- Skill bodies under `src/skills/`. Grepped for the nine `OWNER_ROUTING`
  phrases; zero hits outside the surfaces already listed.
- `agents/evidence/`. Evidence records the past and gates nothing; the six hits
  there (`drain-run-summary*.md`) restate the carrier claim rather than
  creating it.
