<!-- evidence-type: analysis -->

# Inbox verification — `mixed-analysis`, 2026-08-27

A record of what an inbox drop of 24 files claimed, what survived verification
against this tree, and what was already owned. Written so the next harvest that
meets the same source does not re-derive any of it.

- **Input:** `agents/tmp.old/mixed-analysis/` — 24 files, ~250 KB, produced by an
  external analysis session on 2026-08-27.
- **Provenance stated by the source:** drafted against `main` at `3738c23e3`.
  Verified: exactly one commit merged between that pin and the HEAD this
  verification ran on (`0be1cf6b7`, PR #1680), so the staleness window is one
  commit and almost every claim is evaluable rather than overtaken.
- **Output:** two roadmaps —
  `agents/roadmaps/road-to-turn-bound-authorization-integrity.md` and
  `agents/roadmaps/road-to-composition-before-creation.md` — plus this record.
- **Sources named in the drop:** eight external repositories and two preprints.
  They are not named here; per `source-confidentiality` they are referred to by
  role only. Nothing in either emitted roadmap carries a derivation attribution.

## Triage

Two generations, both from the same session. The second supersedes the first,
and the first is the second's own input set — so only the second was read at
depth.

| Generation | Files | Disposition |
|---|---|---|
| First, 00:12–00:32 | `00-deep-analysis`, `01-three-review-loops`, `02-architecture-reframe`, `03-three-new-challenge-loops`, `MASTER-ROADMAP`, eight `road-to-*` drafts, `roadmap-00A/00B/08` | superseded — consumed by the second generation, which cites them by name in its own source list |
| Second, 00:44–00:45 | `00-DEEP-REANALYSIS`, three `LOOP-*` challenge files, `FINAL-ROADMAP`, `SOURCES`, `chat.txt`, `road-to-extensible-ac-consolidated-master` | read at depth; `FINAL-ROADMAP` is the actionable artefact |

`FINAL-ROADMAP` restructures the first generation's "ten mostly independent
roadmaps" into one program with eight tracks (growth spine, runtime composition,
human output, knowledge, provider routing, workflow, security, continuous
harvest). The verification below is per track.

## The headline finding

> **Corrected 2026-08-27, after the PR's own adversarial-review gate flagged it
> `74007388aa70` (high, blocking-advisory): "Headline 70% ownership claim lacks
> denominator".** The finding is right and the percentage is withdrawn rather
> than re-derived. What follows is the countable version. The original sentence
> read: *"Roughly seventy per cent of the eight tracks is already owned by this
> tree."* It was never computed against a stated set — a claim of exactly the
> shape this record exists to refuse, made by the record itself.

**The denominator, stated.** The source program carries **47 numbered sub-items**
across its eight tracks (`grep -c '^## [GRHKPWSX][0-9]\.'` over `FINAL-ROADMAP.md`
in `agents/tmp.old/mixed-analysis/`). This record verifies **16 claims**; the
composition roadmap's dropped table names **6** items with an owner. So:

| Set | Count |
|---|---|
| Numbered sub-items in the source program | 47 |
| Claims verified in this record | 16 |
| Of those, carrying an explicit ownership verdict (`already-fixed` 1, `already-owned` 2, `already-decided` 1) | **4** |
| Of those, `corrected` — right claim, colliding remedy | 2 |
| Of those, `still-true` — the gap holds | 9 |
| `unverifiable` under this command's reproduction bound | 1 |
| **Sub-items never checked at all** | **31** |

**What is therefore supportable:** of the sixteen claims this record actually
checked, **four** are owned outright and two more are right-but-colliding. That
is a statement about 16 claims, not about 47 sub-items and not about 8 tracks.
Two thirds of the program was never verified, and the two roadmaps this drain
landed were selected from the third that was.

*The ownership count fell from five to four on 2026-08-27* — the prose
detect/edit row was re-checked during the post-merge reconciliation and its
`already-fixed` verdict did not hold. A count that moves when a row is
re-examined is the reason the percentage above was withdrawn rather than
recomputed.

**What is not supportable, and was asserted anyway:** any percentage over the
program. The tracks are not equal in size (8 sub-items in one, 4 in another), so
even a complete per-item count would not license a per-track percentage without
a weighting nobody chose.

The qualitative reading survives the correction and is worth keeping separate
from the number: the estate holds 66 parked roadmaps, about twenty of them
harvest roadmaps from earlier cycles, and the source's own third challenge loop
asks whether more per-package analysis "will actually produce more insight, or
only more roadmaps, terminology, and merge conflicts". Every claim this record
did check that bore on that question pointed the same way. That is a direction
supported by 16 of 47, not a measured proportion.

That is not a criticism of the source. It is drafted against a repository whose
`agents/` tree is largely invisible from outside, so it could not have seen the
parked estate. It is exactly the failure mode `/analyze:inbox` exists to catch
before the work is planned.

## Per-claim verification

`still-true` = the claim holds at HEAD. `already-fixed` = a mechanism or an owner
exists. `corrected` = the claim is right but its proposed remedy collides with
something here.

| Claim | Verdict | Evidence |
|---|---|---|
| A projection-mode selector exists with three modes | still-true, path corrected | `src/scripts/_lib/lean_projection_mode.ts:19` — the source put it at `src/scripts/` |
| `delivery` is not the shipped default | still-true | same file `:21`, `DEFAULT_LEAN_PROJECTION_MODE = 'eager-all'` |
| Runtime hook dispatch is centralised | still-true | `docs/contracts/hook-architecture-v1.md:210-226` — sequential, manifest order, stated reduction order |
| A shared redundancy taxonomy landed | still-true | `docs/guidelines/redundancy-taxonomy.md` |
| Recent drain evidence reports an authorization-ledger overwrite | still-true | `agents/evidence/pr-drain-run-summary.md:13`, `:116` — two authorization stalls |
| Overlap tooling exists and can be extended | still-true | `audit_overlap.ts`, `audit_skill_overlap.ts`, `report_layer_overlap.ts`, `skill_overlap.ts` |
| A canonical controlled vocabulary needs a hard lint | already-fixed | `lint_canonical_terms.ts`, 1,583 files scanned, 1,006 violations against a 1,007 ratchet |
| Relationship metadata is missing | corrected | `runtime_requires` (`skill.schema.json:45`) and `harness_compat` (`:37`) exist; `requires` is **reserved** for pack edges (`:48`) and reusing it makes a skill unassignable in the discovery manifest |
| Closure states for research candidates | still-true | no `open_proof_gap` / `ruled_out` token anywhere in `src/` or `docs/` |
| An eight-state security finding lifecycle | corrected | `check_finding_dispositions.ts` already ships a committed ledger with `fixed \| false_positive \| accepted_risk` plus rationale and `verified_by`; a parallel eight-state enum is the duplicate-terminology defect the source's own third pass names |
| A task execution envelope (`scope` / `risk` / `depth`) | still-true | no `runtime_level` or equivalent in `src/scripts/` or `docs/contracts/` |
| Make `delivery` observable, then migrate in stages | already-owned | `later/road-to-thin-flip-under-anchor-scoring.md` — three gates, two recorded failed measurements (36.2 % against a 48 % floor; a length-neutral rerun inconclusive at κ=0.46), ADR-202 |
| One automatic routing hop; a second router is an experiment | already-decided, more strongly | a second retrieval router was rejected by council on 2026-07-07; `later/road-to-deferred-rule-retriever.md` holds it behind three named re-open conditions |
| Merge state is not a correctness label | already-owned | `agents/roadmaps/road-to-evidence-gated-change.md` |
| A separately invokable prose detect/edit/preserve capability | **corrected 2026-08-27 — `still-true` for the agent's own output** | Was `already-fixed`, citing `humanizer`. Too coarse: `humanizer` is scoped to **deliverable** prose (posts, articles, drafts), sits in `domain: product` under the `gtm-marketing` pack, and that pack has no `default_install` and lists `workspaces: [gtm, founder]` — an engineering install does not receive it. `lint_output_slop.ts` scans authored markdown for placeholders, not emitted prose for AI tells. The obligation is real; its home is the undeclared-82 cohort, not a new skill — see § Post-merge reconciliation |
| Two preprints are cited for the disclosure-depth and merge-label claims | unverifiable | no network under this command's reproduction bound; carried as unverified, not as fact |

## The authorization defect, independently verified

> **Added 2026-08-27, after the PR's own adversarial-review gate flagged it
> `45e24dabfed9` (critical, blocking-advisory): "Authorization defect claim
> depends on a single evidence file with no independent verification".** The
> finding was correct as written — the claim rested entirely on two prose lines
> in `agents/evidence/pr-drain-run-summary.md`, which is a narrative record of
> one run. Two independent legs are added here. The claim survives both, and a
> second instance of the same defect class was found while verifying it.

**Leg 1 — the host records a task notification as a user turn.** Session
transcripts carry each turn with its role. Counting the exact user-role form
across this project's transcript store:

```
grep -l  '"role":"user","content":"<task-notification>'  → 92 of 167 sessions
grep -ho '"role":"user","content":"<task-notification>'  → 561 occurrences
```

Every occurrence carries `"type":"user","message":{"role":"user"}`. A background
completion is therefore not merely *treated* as a prompt by one hook — it **is** a
user turn in the host's own record, 561 times across 92 sessions. This is a
different instrument from the drain summary (a transcript store, not a
narrative), it is re-runnable, and it does not depend on any one session.

**Leg 2 — the writer replaces the ledger on every non-empty prompt.**
`git_authorization_hook.ts:468-513`: `run()` returns early only when the prompt
text is empty (`:490`), then builds the ledger from
`classifyAuthorization(prompt)` (`:494`) and writes it with
`prompt_chars: prompt.length` (`:512`). A notification's text is non-empty and
carries no git prose, so `authorized` is `[]`. Nothing in the path distinguishes
its origin.

The two legs together entail the defect without the drain summary: the host
delivers the notification as a user turn, and the writer clears the ledger on
any user turn. The summary remains as the *operational* record — two stalls, and
the foreground-wait workaround — but it is no longer the sole basis.

**A discriminator exists, which the roadmap's Phase 1 had left open.** The
notification's content begins with the literal element `<task-notification>` and
carries `<task-id>`, `<tool-use-id>`, `<status>` and `<summary>` children. That
is a field in the prompt text itself, present in all 561 occurrences, so the
"if no field differs, this roadmap stops here" branch does not fire.

**A second instance, same function, found while verifying.** `takePending`
(`:427`) is called on **every** prompt (`:499`) and `rmSync`s the pending-refusal
file at `:440` — before any affirmative check and before any origin check. So a
background notification arriving between a refusal and the user's "ja" **deletes
the pending record**, and the affirmative that follows has nothing to confirm.
This is the sibling the roadmap's step 3.2 sweep was written to look for; it is
recorded here so the step starts from one confirmed instance rather than from
zero.

## Steps reproduced

| # | Step | How | Verdict |
|---|---|---|---|
| 1 | "Generate current inventory of skills, rules, commands, guidelines, hooks" | counted the directories | reproduced — 299 skills, 120 rules, 114 guidelines, 56 hook concerns |
| 2 | "Hard lint: enums, statuses, lifecycle values, command verbs, evidence terms, artifact types" | ran `lint_canonical_terms` | reproduced, and the premise is already satisfied — the lint exists and is ratcheted; the source's item is a scope extension, not a new mechanism |
| 3 | "Read the current dispatcher/resolvers and document the real order" | read `docs/contracts/hook-architecture-v1.md:210-226`, then grepped `rule-router.md`, `kernel-membership.md` and `agent-authority.md` for a load-order or precedence statement — zero hits | **`reproduced`, with a bounded result** — corrected 2026-08-27 per gate finding `eb0533f7b0f8`. The step said "read and document"; reading it succeeded and produced a definite two-part answer, so the verdict is `reproduced`, not `diverged`. The earlier `diverged` label conflated *the step failing* with *the answer being partial*. The answer: hook dispatch order **is** documented; rule and context load order across projection layers is **not**, and `agent-authority.md` states authority-band precedence rather than load order |
| 4 | "Repair the PR-drain authorization persistence defect" | read the writer | diverged, and the divergence is the finding — `git_authorization_hook.ts:28` states per-turn replacement is deliberate. The defect is the **input classification**, not the retention; "make it durable" would break a correct property to hide a different bug |
| 5 | "Adopt `implements / requires / extends / replaces / …`" | read the schema | unexecutable as written — `requires` is a reserved key; adopting the list verbatim breaks the discovery manifest |
| 6 | "Parallel read-only deep dives, one agent per external package" | not attempted | out-of-bound — the command's reproduction bound forbids network access |

The three ceilings (12 steps, 20 minutes, 3 attempts per step) did not fire;
step selection stopped at six because the remaining instructions were neither
paired with an asserted outcome nor phrased as reusable procedures.

## The inbox folder was never committed — and what that does and does not settle

> Recorded 2026-08-27 against gate finding `6eeb76b47521` (medium, security):
> "No validation that `tmp.old/mixed-analysis/` was sanitized before commit".

**The premise does not hold, and saying so is the whole answer to half of it.**
`agents/tmp.old/` is gitignored — `git check-ignore -v` resolves it to
`.gitignore:51` — so the folder was never staged, never committed, and is not in
the diff the gate read. There was no commit to sanitize before.

**The half that does hold, and how it was discharged.** Both roadmaps cite
`agents/tmp.old/mixed-analysis/` on their `Source:` line, so the tracked tree
points at content no reviewer can open from a clone. That is by design here —
[`source-confidentiality`](../../../src/rules/source-confidentiality.md) keeps
raw named evidence local-only — but it means the tracked side carries the whole
burden of not leaking. That side **was** validated:
`./scripts-run src/scripts/check_no_external_sources` ran green over the tracked
tree before the PR was opened, and the drop names eight external repositories
and two preprints, none of which appears in any emitted artefact.

**What is still not validated, stated rather than closed.** Nothing scans the
untracked folder itself for secrets or injected instructions before an agent
reads it, and this record's own reproduction bound (no network, no secret reads)
is model-carried. A future inbox drop containing a credential would be read, not
refused. That is a real gap in the `/analyze:inbox` path, it is not this
change's to fix, and it is named here so a later reader does not mistake the
green `check_no_external_sources` run for a scan of the input.

## What was emitted, and why so little

Two roadmaps, from the residue that is genuinely new, verified and unowned.

1. **`road-to-turn-bound-authorization-integrity`** — from reproduced step 4. A
   verified defect with in-tree evidence and no owner: an agent-originated wake
   is processed as a user prompt and clears turn-bound git authorization
   mid-run. The remedy is corrected from the source's: classify the wake, do not
   make the ledger durable.
2. **`road-to-composition-before-creation`** — from the growth track, minus the
   six items dropped above. The one question nothing in the estate asks, with
   both of the source's collisions repaired in the roadmap body.

Everything else is either already owned or a duplicate. The estate stood at
`active_roadmaps 7 (floor 7, +0)` when this ran, so each addition costs a
recorded exemption line; adding eight tracks would have been the roadmap
explosion the source itself warns against.

## Post-merge reconciliation — the three claimed survivors, checked

> Added 2026-08-27 after `612b817` merged. The operator's reconciliation of the
> source program against this drain named **three** items as neither owned by
> the tree nor landed here, and asked for them to be set up. Each was checked
> before anything was written. One survives, two do not, and the reason is the
> same discipline this record was built on.

**1. "Slop-resistant surfaces — no skill catches AI tells in the agent's own
output."** *Partly right, and the drain's own table was too coarse.* This record
originally marked it `already-fixed` citing the `humanizer` skill. That verdict
does not hold on inspection: `humanizer`'s description scopes it to **deliverable
prose** ("posts, articles, drafts"), it sits in `domain: product` under the
`gtm-marketing` pack, and that pack carries no `default_install` and lists
`workspaces: [gtm, founder]` — so an engineering install does not receive it.
`lint_output_slop.ts` is a different thing again: it scans authored markdown for
placeholder patterns, not emitted prose for AI tells.

*But the remedy does not follow.* Traced further, the four rules that carry this
obligation — `communication-through-line`, `direct-answers`, `no-cheap-questions`,
`user-interaction` — are all inside `check_enforcement_coverage`'s **undeclared
82**. The gap is not a missing skill; it is 82 rules whose enforcement nobody has
dispositioned. That is `road-to-undeclared-obligation-disposition`, and it is the
only roadmap this reconciliation emits.

**2. "Output-shaping contract — the shape is scattered."** *Real gap, no
observed failure, therefore no roadmap.* There is no typed output-shape contract;
the obligations sit across `direct-answers`, `user-interaction`,
`communication-through-line` and `reply-close-mechanics`. A fifth artefact
consolidating four is exactly the new-architecture-term this session learned to
refuse, and nothing in the tree records a failure caused by the scattering.
Recorded as a candidate; it earns a roadmap when a failure is measured, not
before.

**3. "Runtime load-order and depth selector."** *Gap confirmed, no observed
failure, therefore no roadmap.* Grepping `rule-router.md`,
`kernel-membership.md` and `agent-authority.md` for a load-order or precedence
statement returns nothing — `agent-authority.md` states **authority-band**
precedence, which is a different axis. So the gap is real. No measured failure
is attributable to it. Same disposition as (2).

**One claimed anchor was checked and is closed.** A prior measurement recorded
that `lint_hidden_unicode` could not see `src/scripts/`, so a raw control byte
there escaped every gate. At `612b817` the linter runs a **second pass** over
all tracked text files — `source pass: 8462 tracked text file(s) read for raw C0
control bytes` — and the gap no longer exists. Checking it was the cheapest step
in this reconciliation and it removed the strongest-looking anchor for (1).

## Not emitted, deliberately

- **The eight-track program as a program.** Its value is the framing, and the
  framing is recorded here rather than as a roadmap that would own nothing.
- **A second harvest wave.** The estate already holds about twenty harvest
  roadmaps in `later/`. A new wave before those are dispositioned adds inputs to
  a queue that is not being drained.
- **Runtime Commons, workspace persistence, a resident runtime.** The source
  correctly gates all three on real consumers; this tree has none yet, and
  `docs/contracts/no-runtime-boundary.md` plus ADR-124 already govern the
  question.
