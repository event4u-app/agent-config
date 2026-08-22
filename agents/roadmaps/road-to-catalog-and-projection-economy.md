---
estate_offset_exempt: "Authored by the 2026-08-22 inbox drain, which consumed 25 dropped artefacts carrying 53 pre-written roadmap drafts in one pass. It ships status: draft, so it is not active work and moves none of the three gated metrics; there is nothing yet to offset. The offset alternatives all cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking these in later/ is what the estate register calls burial and would hide twenty verified defect sets behind a disposition nobody reviews; and terminating another session's roadmap would be a judgement about their work rather than mine. The blockers these drafts carry will charge this ratchet on the day the maintainer flips one to ready, which is the point at which an offset is a real decision. Charged as one reviewable line, per this gate's own instruction."
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to catalog and projection economy

> **Source:** `agents/tmp.old/40k` — an external token-economy analysis pass,
> re-verified against this tree on 2026-08-22. Two of its claims did not survive
> re-verification and are recorded below as findings rather than dropped.

## Goal

The three largest un-gated prose corpora in this tree — personas, contexts and
skill bodies — have a **measured** load semantic instead of an assumed one, and
whichever of them turns out to cost standing context has a census bucket so a
future change to that semantic is visible instead of silent. The skill-catalog
bucket, which is the one of the four that demonstrably *is* standing cost, has a
ceiling derived from its own measured distribution rather than a number nobody
re-derived.

## Context

`src/config/preamble-payload-budget.json` gates exactly **three** buckets, named
in its own `gated_buckets` list: project-scope rules, the preloaded skills
catalog, and the CLAUDE.md hierarchy. Measured 2026-08-22 the catalog bucket is
**14,408 tok across 290 skills** (`ls src/skills/*/SKILL.md | wc -l` = 290).

Three much larger corpora have **no** bucket at all — not gated, not excluded,
simply absent from the accounting. Measured here on 2026-08-22 with the same
chars/4 basis the budget file itself declares:

| Corpus | Files | chars | ≈ tok (chars/4) | Census bucket |
|---|---|---|---|---|
| Personas (`src/agent-src/personas`) | 36 | 148,726 | ~37,181 | none |
| Contexts (`src/agent-src/contexts`) | 58 | 456,168 | ~114,042 | none |
| Skill bodies (`src/skills/*/SKILL.md`) | 290 | 2,383,372 | ~595,843 | none |

A number with no bucket is not "unbudgeted" — it is **unclassified**. Nobody has
recorded whether it is standing cost, on-demand cost, or zero. That is the gap
this roadmap closes, and closing it honestly means accepting nulls.

### Two source claims that did not survive re-verification

**Claim 1 — "no per-description cap lint found."** This is never-true, not
merely stale. `src/scripts/schemas/skill.schema.json:28` already carries
`"maxLength": 220` with the description *"≤ 200 chars recommended, 220 is the
ceiling … Over-cap is a soft warning, not a hard fail"*, and four scripts exist
alongside it: `src/scripts/lint_skill_descriptions.ts`,
`src/scripts/check_augment_description_cap.ts`,
`src/scripts/audit_skill_descriptions.ts`, `src/scripts/optimize_skill_description.ts`.
So Phase 2 is **not** "add a lint". It is "argue the existing ceiling down from
a measured distribution."

**Claim 2 — implicitly, that personas are worth pricing in tokens.** They are
not, and this was already established in this tree on 2026-08-21: **nothing
reads `.claude/personas`**. It appears only in this repository's own generators
and gates — `src/scripts/check_generator_output_coverage.ts:38`,
`src/scripts/check_bridge_derivation.ts:44`,
`src/scripts/_lib/tool_adapter_registry.ts:39`, `src/scripts/condense.ts:753` —
and in no host contract. The host's own subagent surface is `.claude/agents/`,
which on the measuring machine holds **0 files**. The ~37,181 tok of persona
prose therefore costs **zero** standing context, and Phase 1 exists to *confirm
and record* that rather than to reduce it.

### What the description distribution actually says

Measured across all 290 skills on 2026-08-22:

    median 181 · p75 189 · p90 195 · max 200 · over 220: 0 · over 200: 0

The 220 ceiling **describes no artefact that exists**. Every description in the
tree already sits at or under 200, and the distribution is compressed hard
against that recommended line — which means the *recommendation* is the binding
constraint and the *ceiling* is dead headroom. Modelled savings from tightening:

| Cap | Descriptions over cap | ≈ tok returned |
|---|---|---|
| 200 | 0 | 0 |
| 189 (p75) | 72 | ~87 |
| 180 | 149 | ~353 |
| 160 | 242 | ~1,397 |
| 150 | 259 | ~2,026 |
| 120 | 290 | ~4,143 |

This is a **small** lever and the roadmap says so up front. The catalog bucket is
14,408 of a 135,436-token measured total; even a brutal 120-char cap returns
~4,143 tok, roughly 3 % of the standing payload, at the price of rewriting all
290 descriptions. Phase 2 is worth doing because the free half is genuinely free
and because a trigger-first rewrite improves routing independently of tokens —
not because it closes the budget gap.

## Phase 1 — measure the load semantics of the three un-bucketed corpora

Lead with this because it is the only phase whose answer is unknown. The other
two phases work on numbers this tree already has.

- [ ] **1.1 Record the persona null and stop the corpus being re-proposed.**
      Write the 2026-08-21 finding into an evidence note under
      `agents/evidence/analysis/`: the four in-repo references, the absence of
      any host contract, the empty `.claude/agents/`, and the resulting
      conclusion that persona prose is not priced in standing tokens. State the
      condition that would reverse it — a host that reads a personas directory,
      or a generator that starts folding persona prose into an instruction file.
      verify: the note exists and `grep -c "check_generator_output_coverage\|tool_adapter_registry" <the note>` is non-zero; the pre-state is `git show HEAD:src/scripts/check_generator_output_coverage.ts | grep -c "\.claude/personas"` = 1, i.e. the reference is in-repo only.
- [ ] **1.2 Establish whether contexts are standing or on-demand.** Measured
      here, **0 rules declare `load_context_eager:`** (`grep -rln "^load_context_eager:" src/rules/`), 21
      declare the lazy `load_context:`, and the schema
      (`src/scripts/schemas/rule.schema.json:49`) documents eager as *"Counts
      against the per-rule char budget"*. That is a declaration, not a
      measurement. Confirm at the delivery layer whether any context file
      reaches a session without being asked for, and record the answer either
      way.
      verify: `grep -rln "^load_context_eager:" src/rules/ | wc -l` is quoted in the written finding alongside a delivery-layer observation; the finding names which of the two inputs it used, the way `check_standing_rule_delivery` names its own.
- [ ] **1.3 Establish the same for skill bodies.** ~595,843 tok is by far the
      largest corpus in the table and progressive disclosure is the claimed
      reason it does not cost that. Record whether a body reaches a session
      before the skill is invoked, and if the answer is "only the description
      does", say so — that makes Phase 2 the *whole* skill-side lever rather
      than a fragment of one.
      verify: the finding is written with the observation that produced it, and it explicitly reconciles against the 14,408 catalog figure `check_preamble_payload_budget` already reports.
- [ ] **1.4 Give a census bucket to whichever corpus Phase 1 finds is standing.**
      A bucket for a corpus measured at zero is noise; a corpus measured above
      zero with no bucket is the gap this roadmap opened on. Add buckets only
      where 1.1–1.3 found cost, and record the nulls in
      `src/config/preamble-payload-budget.json`'s `excluded_buckets` with the
      measurement that justified the exclusion — the way `user-scope rules` is
      already excluded there with its reason attached.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget 2>&1 | tail -6` still runs and the JSON's `gated_buckets` / `excluded_buckets` lists changed only where a measurement supports it.

## Phase 2 — argue the description ceiling down, then rewrite the tail trigger-first

- [ ] **2.1 Take the free tightening first: 220 → 200.** Zero descriptions exceed
      200 today, so lowering the ceiling to the recommended line costs no
      rewrites and removes 20 characters × 290 of dead headroom that a future
      author could otherwise fill without any gate objecting. This is the same
      move `preamble-payload-budget.json`'s own `baseline_history` records as
      *"free tightening … a lower measurement becomes the new ceiling instead of
      becoming unused headroom."*
      verify: `grep -n '"maxLength": 220' src/scripts/schemas/skill.schema.json` returns nothing afterwards; the pre-state is `git show HEAD:src/scripts/schemas/skill.schema.json | grep -c '"maxLength": 220'` = 1.
- [ ] **2.2 Derive the real target from p75, and record the argument.** p75 is
      189. A ceiling below p75 is a rewrite programme, not a schema edit, so the
      number has to be argued against the table in Context: what the tighter cap
      returns in tokens, how many descriptions it forces open, and what that
      does to routing quality. Publish the choice with its rejected alternatives
      — a cap picked without the distribution in front of it is an invented
      threshold.
      verify: the written argument cites the measured distribution (median 181 / p75 189 / max 200) and names the rejected caps; `./scripts-run src/scripts/audit_skill_descriptions 2>&1 | tail -3` runs against the new number.
- [ ] **2.3 Rewrite the over-cap tail trigger-first, in ranked batches.** The
      four existing scripts are the tooling — `lint_skill_descriptions` for the
      gate, `audit_skill_descriptions` for the ranking,
      `optimize_skill_description` for the per-skill rewrite,
      `check_augment_description_cap` for the second projection's own limit. A
      shortened description that loses its trigger phrase costs more in missed
      routing than it saves in tokens, so each batch is checked for trigger
      survival, not just length.
      verify: `./scripts-run src/scripts/lint_skill_descriptions 2>&1 | tail -3` and `./scripts-run src/scripts/check_augment_description_cap 2>&1 | tail -3` both exit green after each batch.
- [ ] **2.4 Publish the delta against the 14,408 baseline, including the misses.**
      Skills whose description could not shorten without losing a trigger are a
      row in the table with the reason, not an omission.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget 2>&1 | grep -i catalog` reports a lower catalog figure than 14,408, and the published table names any skill that did not shorten.

## Phase 3 — spike the on-demand catalog, or absorb the stub that already owns it

The catalog is preloaded in full because the host's contract is assumed to
require it. That assumption has never been probed here, and it is the same class
of assumption this tree has overturned before.

- [ ] **3.1 Reconcile with the existing stub before spiking anything.**
      `agents/roadmaps/stubs/road-to-host-aware-skill-projection.md` already
      owns most of this ground: its transferred steps 1.1–1.4 cover a measured
      per-host catalogue profile, composing the projected set from that profile,
      gating the aggressive path on measurement sufficiency, and explicitly
      leaving the primary host unchanged. Decide in writing whether this phase
      **absorbs** that stub or **defers** to it. Do not run both.
      verify: `ls agents/roadmaps/stubs/road-to-host-aware-skill-projection.md` resolves and the decision is recorded at this step with the disposition named.
- [ ] **3.2 Probe what the host actually does with a large catalog.** The stub's
      own step 1.1 makes the point this phase must not lose: record *measured*
      catalogue behaviour per host rather than deriving the limit from this
      package's model of the host. That probe is a host-contract question, which
      is why it sits behind a blocker.
      verify: the probe output is written under `agents/evidence/analysis/` and names the host build it was taken against.
- [ ] **3.3 Keep the safe direction as the default.** The stub's step 1.3 already
      states it: an unmeasured host receives the full catalogue, because
      under-projecting a skill is worse than paying for one that is never used.
      Whatever 3.2 finds, the fallback stays the full set.
      verify: `./scripts-run src/scripts/lint_featured_skills 2>&1 | tail -3` exits green and the default-path behaviour is unchanged for any host with no measurement.

## Blockers

### blocker: b-catalog-preload-host-contract
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — consent-once (a host-contract observation, not a repo edit)
- **Blocks:** Phase 3 steps 3.2 and 3.3. Phase 1 and Phase 2 proceed without it;
  3.1 is a written disposition and also proceeds.
- **What to do:** pick exactly one — (a) obtain a real per-host catalogue
  observation, the way `road-to-instructions-loaded-observer` proposes to obtain
  a real instruction-load record, and pin it to a named host build so a later
  reader knows what it describes; or (b) declare Phase 3 **spike-only for one
  release** — the reconciliation in 3.1 lands, no projection behaviour changes,
  and the phase closes with the host question recorded as open.
- **Recommendation:** **(b) — spike-only.** This is the same class of question as
  the instruction-load record: the tree can state what it *projects* and cannot
  state what the host *loaded*, and inventing the second is how a package ends up
  optimising against its own model of a host instead of the host. Option (b)
  banks Phase 3's cheap half — the stub reconciliation — and leaves the expensive
  half honestly open.
- **If you do nothing:** Phase 3 either stalls or proceeds on an assumption about
  the host's catalogue handling, which is exactly the assumption class this tree
  has already had to overturn once.
- **Resolved when:** one of (a) or (b) is recorded at this blocker, and — for (b) —
  step 3.1's disposition is written and steps 3.2/3.3 are marked deferred rather
  than left open-looking.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 1 returns three nulls and reads as wasted work | product | Personas are already measured at zero standing cost, contexts declare lazy loading, and skill bodies claim progressive disclosure. All three probes may confirm what is assumed | The phase is written to bank nulls as its output: 1.4 records exclusions with their measurements in the budget file, which is what stops the same three corpora being re-proposed as levers next quarter | Phase 1 — measure the load semantics of the three un-bucketed corpora |
| 2 | The description lever is priced as if it closed the gap | product | The catalog bucket is 14,408 of 135,436 measured tokens; the most aggressive modelled cap returns ~4,143 tok, about 3 % | Context states the ceiling of the lever before Phase 2 starts, and 2.2 requires the argument to publish what the chosen cap actually returns | Phase 2 — argue the description ceiling down, then rewrite the tail trigger-first |
| 3 | A shortened description loses its trigger phrase | implementation | Descriptions are the routing surface; 290 rewrites at a tight cap will strip trigger vocabulary before they strip filler, because filler is what a rewriter finds hardest to identify | 2.3 checks trigger survival per batch rather than length alone, and runs both existing description gates after each batch | Phase 2 — argue the description ceiling down, then rewrite the tail trigger-first |
| 4 | Phase 3 duplicates an existing stub | implementation | `road-to-host-aware-skill-projection` already carries four transferred steps covering per-host catalogue profiling, and two roadmaps working the same ground produce two partial answers | 3.1 is a hard reconciliation step that must record absorb-or-defer before 3.2 runs | Phase 3 — spike the on-demand catalog, or absorb the stub that already owns it |
| 5 | A census bucket is added for a corpus measured at zero | implementation | Adding buckets is cheap and feels like progress; a bucket over a zero-cost corpus is a permanently green gate certifying nothing, which this tree has shipped before | 1.4 conditions bucket creation on 1.1–1.3 finding non-zero cost, and routes the nulls to `excluded_buckets` with their measurement attached | Phase 1 — measure the load semantics of the three un-bucketed corpora |
| 6 | The chars/4 proxy is carried into a claim that needs the exact tokenizer | implementation | The Context table is a proxy measurement, matching the budget file's declared basis. A published reduction quoted in proxy tokens and compared against an exact-tokenizer figure is a false delta | Every published figure names its method, the way `check_standing_rule_delivery` already prints `tokens_gpt: exact` versus `tokens_claude: proxy` | Phase 2 — argue the description ceiling down, then rewrite the tail trigger-first |

## Acceptance Criteria

- [ ] AC-1 — Each of the three un-bucketed corpora carries a written, dated load
      semantic under `agents/evidence/analysis/`: standing, on-demand, or zero,
      with the observation that produced it and the input it used.
- [ ] AC-2 — The persona null is recorded with its four in-repo references and
      the condition that would reverse it, so the corpus is not re-proposed as a
      token lever.
- [ ] AC-3 — `src/config/preamble-payload-budget.json` reflects Phase 1's
      answers: a gated bucket where cost was measured, an entry in
      `excluded_buckets` with its reason where it was not.
- [ ] AC-4 — The skill-description ceiling in `src/scripts/schemas/skill.schema.json`
      is no longer 220. The replacement number is published together with the
      measured distribution it came from and the alternatives that were rejected.
- [ ] AC-5 — The catalog bucket reported by `check_preamble_payload_budget` is
      below the 14,408 recorded in Context, and the accompanying table names
      every skill whose description could not shorten without losing a trigger.
- [ ] AC-6 — Phase 3's relationship to the existing host-aware-projection stub is
      recorded in writing as absorbed or deferred, and no projection default
      changed for a host that has no measurement behind it.
