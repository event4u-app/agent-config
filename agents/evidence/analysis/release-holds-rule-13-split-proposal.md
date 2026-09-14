<!-- evidence-type: analysis -->

# The rule-13 split, prepared and not applied — one decision, one patch

Prepared 2026-09-13 against `7182f5d07` for the `rule-13-amendment` blocker of
`agents/roadmaps/road-to-release-holds-that-refuse.md`. The blocker is `Class: 3 —
human-only` and this artifact does not change that: approving a contract-layer rule is the
owner's act, not an action an agent can perform on its own authority. What is prepared here
is everything *except* the approval, so the decision is a yes or a no rather than a research
task.

**Nothing in `src/agent-src/templates/roadmaps.md` has been modified.** The proposed change
lives as a patch beside this file and applies cleanly to the template at HEAD.

> **Rebased 2026-09-14 — the new rule is 28, not 27, and until today the patch did not
> apply at all.** `088f98fc2` and `5ed431b04` added a *different* rule 27 to the template —
> `## Decisions` — on 2026-09-13, hours after this proposal was cut against `7182f5d07`.
> Two consequences, both measured rather than inferred: hunk 3's tail context had moved, so
> `git apply --check` failed and the approval command at the top of this file would have
> errored in the owner's hands; and the release-holds rule's number collided with a live
> one. The patch is re-cut onto the moved base with the rule renumbered 27 → 28 and its two
> cross-references moved with it (rule 13's *per rule 28*, rule 20's *(rule 28)*). The
> semantic content is unchanged, the patch is still purely additive, and the prohibition
> block still hashes to the same pin — verified at all three points. The number was always
> positional. The verifier gained a further check for the collision itself, because the
> rule *count* cannot see one: two rules both numbered 27 still total 28. It was observed
> red against a copy renumbering the new rule back to 27 — where the count check passes.

| Artifact | What it is |
|---|---|
| `agents/evidence/analysis/release-holds-rule-13-split.patch` | the complete proposed change, applying to `src/agent-src/templates/roadmaps.md` |
| `agents/evidence/analysis/release-holds-rule-13-split-verify.sh` | verifies the five properties below without applying anything to the working tree |

To review: read the patch. To check it is what this file says it is:

    bash agents/evidence/analysis/release-holds-rule-13-split-verify.sh

To approve: apply it, run the two roadmap gates named below, flip steps 1.1, 1.2 and 1.3
and the blocker to `resolved`.

    git apply agents/evidence/analysis/release-holds-rule-13-split.patch

---

## Why this is one decision and not three

The roadmap splits the contract change across steps 1.1 (split rule 13), 1.2 (add the release-holds rule, now 28)
and 1.3 (one sentence on rule 20). They are three steps and one decision, because none of
them is coherent alone:

- Rule 13 split **without** the release-holds rule obliges a roadmap to declare a state in a grammar that
  does not exist.
- The release-holds rule **without** the rule 13 split mandates a marker that rule 13 forbids by its own
  letter — which is precisely what the blocker says.
- The rule 20 sentence exists only to keep a reader from confusing the two mechanisms once
  both are in the file.

The `rule-13-amendment` blocker's own `Resolved when` already says this out loud: it
requires the template to carry the new rule *and* rule 13's prohibition to be byte-identical.
One condition, spanning two steps. So the patch is single and the decision is single.

> **The `Resolved when` was worded as "carries rule 27" and that has gone stale into a false
> positive** — corrected in the roadmap on 2026-09-14. The template gained an unrelated rule
> 27 on 2026-09-13, so read literally the condition is now satisfied at HEAD *without the
> split*, by a rule about `## Decisions`. A resolution condition that reads true when nothing
> was done is worse than a vague one, because it closes silently. It now names the
> release-holds rule by its content and its number, and points at the verifier rather than at
> a count.

## The five properties, and how each is checked

**1. The patch is purely additive — zero deletion lines.** This is a stronger guarantee than
the roadmap asks for. Step 1.1 asks that the prohibition sentences be unchanged character for
character; a patch that removes nothing anywhere in the file cannot have changed them, or
anything else. Checked mechanically (`grep '^-' | grep -vc '^--- '` reads 0).

**2. The prohibition block hashes identically before and after.** Pinned:

    sha256 = 5827d0e4b5a1c88e7d646e7157fed36564890a5aaa5f2e33c0007ad77b9ed407

over the five lines of rule 13 from `13. **No tags, releases, or version numbers.**` through
`This is enforced by [scope-control](...)`. The verifier hashes the block at HEAD and again
on a scratch copy with the patch applied, and refuses on either mismatch.

**3. The numbered rules read 28, up from 27.** Step 1.2's verify condition, reproduced at
HEAD on 2026-09-14: `grep -cE '^[0-9]+\. \*\*' src/agent-src/templates/roadmaps.md` reads
**27** today and **28** with the patch applied. Step 1.2 as authored pins this as *27, up
from 26*; that baseline was true on 2026-09-13 and moved the same day when `## Decisions`
landed as rule 27. The roadmap step carries the correction.

**4. Rule 28 carries the non-goal sentence verbatim** — *roadmap `*incompleteness*` is never
a release condition*. Checked as a literal substring, which is why the sentence is written
unbroken across the line wrap rather than reflowed for evenness.

**5. No rule number appears twice.** Added 2026-09-14, because property 3 is blind to the
failure that actually occurred: a duplicate 27 leaves the total at 28 and the count check
green. Asserted over `sort | uniq -d` of the rule headings.

**The checks were observed red before they were trusted.** Run against a deliberately
tampered copy of the patch — one context line of the prohibition turned into a delete+add
pair rewriting "user" to "maintainer" — property 1 and property 2 both fail and the script
exits 1. Property 3 and 4 stay green, correctly: the tamper did not touch them. The *apply*
check also stays green, and that is the finding rather than a flaw — a tampered patch is
still a valid patch, which is exactly why "it applies" is not the property that matters and
why properties 1 and 2 exist at all. The reading is recorded in the script's own header.

## What the patch contains

### Rule 13 — the split

The five prohibition sentences are untouched. A second paragraph is appended inside the same
numbered rule, saying that the prohibition governs the *schedule* and not the *state*: a
roadmap still may not decide when or in which version work ships, and must declare an
intentionally unreleasable intermediate tree state with the machine-verified condition that
clears it.

The load-bearing sentence, because it is the one a sceptical reader will test: *naming a
state that must not be published is not a release decision — it is a fact about the tree that
the release path has no other way to learn.* Measured, not asserted: `src/scripts/release.ts`
carries exactly one occurrence of the word `roadmap`, at `:322`, inside a comment
(`agents/evidence/analysis/release-holds-phase-0-2026-09-13.md` § 0.3). The release path is
roadmap-blind today.

> Re-measured 2026-09-14: the file is **1,730** lines, not the 1,814 recorded here on
> 2026-09-13 nor the 1,826 the roadmap's Goal section states. The line count is incidental
> and moves with unrelated work; the load-bearing half — **exactly one** `roadmap`
> occurrence, in a comment — reproduces unchanged. Only the count is corrected, and it is
> corrected downward rather than quietly dropped.

### Rule 28 — release holds

New rule, after rule 27. It carries, in this order: the non-goal first; the authoring order
`re-sequence → guard → hold` with the mandatory `Why not a guard:` field; the entry shape;
the marker grammar binding a hold to the checkbox that opens it and the one that clears it;
the channel vocabulary (`all` default, `latest`, no third value, no override); the four-state
table whose `not-evaluable` row refuses on every channel; the per-folder lifecycle; and a
closing sentence that rule 13's version prohibition applies inside a hold entry exactly as it
does everywhere else.

Two of those are there to answer risks this roadmap already registered against itself:

- **The authoring order and the `Why not a guard:` field** answer risk rank 2 — that a hold
  is easier to write than a re-sequenced phase, so trunk ends up held most of the time. The
  ladder makes a hold the third answer, and the mandatory field makes skipping the second
  rung visible rather than silent.
- **The closing no-versions sentence** answers risk rank 7 — that touching rule 13 at all
  reads as a licence for "Target release" to creep back. The prohibition is restated inside
  the new surface rather than left to inference.

### Rule 20 — one sentence

*A blocker stops execution; a hold stops publication.* Plus the four lines that make the
distinction operational: a blocker is cleared by a person, a hold by a checkbox whose
`verify:` a machine runs, and a merely unfinished roadmap has neither.

## What is NOT in the patch, deliberately

- **Step 1.4** — `new_roadmap.ts` emitting the commented `## Release holds` block, and the
  authoring self-check in `roadmap-writing/SKILL.md` and `/roadmap:create`. It is downstream
  of this decision: the emitted block's grammar is rule 28's, and emitting it before the rule
  exists would put a rule-13 violation into every newly created roadmap. Left open.
- **Any evaluator, gate, or wiring.** Phases 2 through 6 are what the blocker blocks.
- **The approval itself.** Applying this patch is the approval, and it is not an agent action.

## Gates to run after applying

Both were re-measured green at HEAD on 2026-09-14, so a red after applying is attributable
to the patch. The counts moved with the estate and are restated rather than left stale — on
2026-09-13 both read 14 roadmaps:

    ./scripts-run src/scripts/lint_roadmap_complexity    # 10 roadmap(s) complexity-clean
    ./scripts-run src/scripts/lint_roadmap_blockers      # 10 roadmap(s) blocker-contract-clean

Step 1.1's verify also names `lint_roadmap_complexity` specifically; step 1.3's names
`lint_roadmap_blockers`, whose pre-change baseline the roadmap records as measured green on
2026-09-11 and which reproduces green at HEAD.

After applying, `task sync` and then `task generate-tools` regenerate the projections that
carry the template.

## Recommendation

Approve. It is the roadmap's own recommendation and the evidence supports it unchanged: the
prohibition the rule exists for is provably untouched — zero deletion lines, an identical
hash — and what is added is an obligation to declare a state the tree already has and
currently cannot name.

One caveat the owner should price, and it is a cost question rather than an evidence one:
the Phase 0 sweep found **no live subject**. Approving the contract does not commit to
building Phases 2 through 5 against a latent need; it makes the vocabulary available and
unblocks step 1.4. The separate `zero-live-subjects` blocker is where that spend decision
sits, and its evidence is now recorded.
