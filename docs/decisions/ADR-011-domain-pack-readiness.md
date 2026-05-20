---
adr: 011
status: accepted
date: 2026-05-17
decision: domain-pack-readiness
supersedes: —
superseded_by: —
phase: v2.x · universal-platform-refinement Phase 6
type: prospective
---

# ADR-011 — Domain-Pack Readiness

## Status

**Accepted** · 2026-05-17 · one-round council pass complete
(`agents/runtime/council/responses/adr-011-domain-pack-readiness.json/debate-round-1.json`, actual spend $0.0300). <!-- council-ref-allowed: ADR decision trace; convergence summary inline in §Council-debate-trace -->
Split verdict — Anthropic accepted *with* tightened trigger; OpenAI
accepted as written. The host folded Anthropic's structural critique
into the trigger and added the escape clause both members' reasoning
implied. Trace under §Council-debate-trace.

## Context

`event4u/agent-config` shipped its first heavyweight domain capability
in PR #176 (AI Video Pipeline, merged at `2.24.0`): 5 provider
adapters, 3 personas, 5 skills, the `/video:*` command cluster, a
Banana-Arc pixel-similarity regression harness, secret redaction at
every adapter boundary, and 50 roadmap steps clean. The strategic
review that followed gave the work `8.9 / 10` overall (engineering
`9.7`, governance `9.2`, UX `10`) but flagged scope discipline at
`6.8 / 10` and named a `8.9 → 9.6` target delta. The named gap is
*not* engineering — it is the positioning / role-guide / rule-layer
surface that did not catch up to the new capability. The current
roadmap (`universal-platform-refinement`) closes that gap in Phases
1–5; Phase 6 records the *non-extraction* decision so the deferral is
auditable.

The pressure to extract video into a separately-installable
"domain pack" comes from three places:

1. The strategic review's `8.9 → 9.6` argument — "make the future
   audio / image / docs / exports domains land cheaply". Cited at
   `agents/roadmaps/universal-platform-refinement.md` lines 19 and 132.
2. PR #176's scope-discipline score (`6.8 / 10`) — the load-bearing
   data point against premature extraction. Cited at line 19, 117.
3. The predecessor council's explicit rejection of milestone-split
   shipping of the video pipeline. Trace:
   [`archive/ai-video-pipeline.md` § Divergences (no consensus)](../../agents/roadmaps/archive/ai-video-pipeline.md#L162-L164):
   *"Single-PR vs. milestone split — Reviewer B recommended splitting
   into milestone PRs; Sonnet R3 and GPT-4o final pass both reject
   this, citing the roadmap's explicit single-PR iron constraint and
   the dead-code risk of partial states. Host: the iron constraint
   stands."* Same reasoning applies one level up: extracting video
   today creates a domain-pack abstraction with no peer to share with
   and a dead-code risk in the not-yet-built domains.

The repository currently has exactly **one** heavyweight domain
(video). Audio, image, docs, and exports are named future concerns —
none is built. An abstraction whose only consumer is the abstraction
itself is a structural liability, not an asset.

## Decision

> **The platform stays thin-root and ships future domains (audio,
> image, docs, exports) as in-repo capability bundles, not as
> separately-installable packs, until at least two independent
> domains exist with overlapping execution surfaces.**

"Overlapping execution surfaces" means shared code beyond the kernel
+ router — e.g. two adapters that both implement the four-method
shell contract, two skill clusters that both consume the
`media-governance-routing` rule, two domains that both need
provider-lifecycle tiering. The video adapters alone do not satisfy
this — they are a single execution surface.

## Consequences

### (i) What stays under `.agent-src.uncompressed/` today

The complete video capability stays in the existing flat layout —
no path changes, no symlink relocation, no namespace prefix:

- `.agent-src.uncompressed/skills/{character-consistency,motion-choreographer,pixar-storyteller,scene-expander,video-director}/`
- `.agent-src.uncompressed/personas/{ai-video-technical-director,hollywood-director}.md`
  (the third video persona, `pixar-storyboard-artist`, was folded
  into `skills/pixar-storyteller/` per the persona-cap council pass
  recorded in `persona-governance`)
- `.agent-src.uncompressed/commands/video/{from-script,scene,storyboard,stitch}.md`
- `scripts/ai-video/` (the 5 adapter scripts + `lib/`)
- `agents/policies/media/` (Phase 2 output — already structured as
  a project-local policy directory, *not* a pack)

### (ii) The trigger that flips this decision

The non-extraction stance is **falsifiable**. The trigger is split
into a *design gate* (fires before domain 2 is built) and two
*confirmation gates* (fire after domain 2 ships) — sequenced this way
to avoid the "two-domain monolith" trap the council flagged in
round 1 (Anthropic, Option 2): if condition 1 only fires *after*
domain 2 is built, the shared infrastructure is already entangled
and extraction is materially harder than predicting overlap in
advance.

**Design gate (fires BEFORE domain 2 implementation starts):**

1. **Overlap-prediction document.** Before the first commit on a
   second heavyweight domain (audio, image, docs, exports, or other),
   write `docs/contracts/domain-pack-overlap-inventory.md` listing
   ≥ 3 structural patterns *predicted* to be shared between video
   and the new domain (e.g. shared adapter contract, shared
   governance routing, shared provider-lifecycle declaration, shared
   persona-cap policy). Each prediction includes a falsifiable test
   that confirms or refutes it after domain 2 ships. If ≥ 3 testable
   predictions cannot be written, the domain is not yet a candidate
   for shared abstraction — build it in-repo, revisit when patterns
   emerge.

**Confirmation gates (fire AFTER domain 2 ships):**

2. **Heavyweight-domain landing.** A second domain has landed in
   `main` matching the PR #176 shape: adapter cluster + skill
   cluster + command cluster + governance rule + policy directory.
   One-skill additions do not count.
3. **Shared-abstraction stability.** The patterns named in the
   prediction document have shipped without breaking changes for at
   least one minor release. Stability proves the predictions were
   real, not refactoring churn.

**Escape clause (Anthropic round-1 critique, folded back):** if all
three gates fire and extraction is then judged "too expensive" by
the team, **this decision was wrong**. Re-open the ADR and record
the failure mode — the trigger structure is one-way unless this
clause is honoured. Without it, the ADR becomes a one-way door
disguised as a two-way door.

The placeholder roadmap
[`agents/roadmaps/domain-pack-extraction-when-triggered.md`](../../agents/roadmaps/domain-pack-extraction-when-triggered.md)
holds the marker; status `draft` keeps it dashboard-suppressed until
the design gate fires.

### (iii) What is **not** extracted today

Explicitly enumerated so a future reader does not mistake silence
for ambiguity:

- The five video adapters (`gemini-veo`, `kling`, `openai-images`,
  `higgsfield`, `sora`) — stay in `scripts/ai-video/`.
- The two remaining video personas — stay in `.agent-src.uncompressed/personas/`.
- The `/video:*` command cluster — stays in `.agent-src.uncompressed/commands/video/`.
- The `media-governance-routing` rule + `agents/policies/media/`
  policy files — stay where Phase 2 placed them.
- The provider-lifecycle contract + the `provider-lifecycle-discipline`
  rule — stay where Phase 3 placed them.
- The three Phase 4 test files (`tests/test_ai_video_blueprint_schema.py`,
  `test_prompt_optimization.py`, `test_ai_video_adapter_contract.py`)
  — stay in the root `tests/` tree.

## Alternatives Considered

### A) Extract video into `agents/domain-packs/ai-video/` today

Rejected. The extraction creates an abstraction with no peer, so the
shape of the pack interface is determined by exactly one consumer.
When the second domain arrives, the interface is likely wrong (cited
predecessor council reasoning on milestone-split: dead-code risk of
partial states). The strategic review's `8.9 → 9.6` argument is
**real** but **not unlocked by extracting today** — see roadmap §Notes
line 132.

### B) Ship the placeholder roadmap as `proposed` instead of `draft`

Rejected. A `proposed` roadmap appears in the dashboard and creates
implicit pressure to schedule it. A `draft` marker keeps the trigger
visible to future maintainers without scheduling work that depends
on conditions that do not yet hold.

### C) Pin a date for re-evaluation

Rejected. The trigger is structural (two domains + overlap inventory),
not temporal. Pinning a date (e.g. "review 2027-Q1") replaces a
condition-based gate with a calendar-based one, which `no-roadmap-references`
treats as a smell.

## Council-debate trace

One round · 2 members · actual spend $0.0300 · raw responses at
[`agents/runtime/council/responses/adr-011-domain-pack-readiness.json/debate-round-1.json`](../../agents/runtime/council/responses/adr-011-domain-pack-readiness.json/debate-round-1.json). <!-- council-ref-allowed: ADR decision-trace to originating council response -->

| Member | Pick | Core argument | Folded back? |
|---|---|---|---|
| `anthropic/claude-sonnet-4-5` | **Option 2** (accept with tightened trigger) | Trigger as originally written is waterfall-sequenced (build → discover → stabilise) — condition 1 only fires *after* domain 2 is built, creating the "two-domain monolith" trap. Fix: move overlap-prediction to a *design gate* before domain 2 implementation, plus add an escape clause naming the failure mode when extraction is later judged too expensive. | **Yes** — Consequences §(ii) split into design gate + confirmation gates; escape clause added verbatim. |
| `openai/gpt-4o` | **Option 1** (accept as written) | Triggers are structural, not temporal — appropriate guard against premature abstraction. Secondary signal worth tracking: developer-sentiment / community feedback on perceived lack of shared infrastructure. | **Partial** — host did not promote qualitative signals to gates (would conflict with the "structural, not temporal" principle both members affirmed), but the escape clause covers the team-cost case Anthropic named and OpenAI implied. |

### Host verdict

Anthropic's structural critique is load-bearing: the original trigger
was sequenced as a waterfall where the gating condition could not be
checked until after the gate had implicitly been passed. The fix —
moving overlap-prediction to a design-stage document — is a strict
improvement that costs nothing today (no domain 2 exists; no design
gate to clear). Folding the escape clause closes the one-way-door
risk both members' reasoning pointed at, even though only Anthropic
named it explicitly.

OpenAI's qualitative-signal point is noted but not promoted to a
gate: every "is the lack of shared infrastructure slowing us down?"
question is answerable by writing the overlap-prediction document
and seeing whether ≥ 3 testable predictions emerge. The design gate
absorbs the qualitative signal into a structural check.

Status: `proposed → accepted` with the council-driven trigger
revision and escape clause in place.
