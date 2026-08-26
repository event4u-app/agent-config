---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: `agent-config roadmap:context` on 2026-08-27, run at promotion time —
# scanned 2 PRs, 783 roadmap file(s) across active/later/stubs/archive,
# 348 remote branch(es), 3 live session record(s), 0 inbox file name(s).
# No sibling roadmap on the topic, no remote branch carrying the slug, and no
# open-PR file overlap for this roadmap — the two open PRs (#1675, #1679) touch
# neither this file nor a path it cites. Context fingerprint 1fad1aa7901bc34b,
# base 0be1cf6b7.
estate_offset_exempt: "Landed as a draft proposal; promoted to ready on 2026-08-27. Archiving is impossible (nothing has run), parking in later/ would grow the later_roadmaps floor instead of the active one, and it cannot fold into either sibling roadmap because the defect is in the process that produced both of them, not in either subject."
estate_growth_exempt: "Promoted draft -> ready by the /analyze:inbox run of 2026-08-27. Measured after the change rather than predicted before it: check_estate_count reports active_roadmaps 7 -> 10 against a floor at +0, and open_blockers unchanged at 42. An earlier version of this line predicted +1 on the blocker metric; the gate contradicts it, so the measurement stands and the prediction is withdrawn. The promotion is warranted on the roadmap's own terms rather than on tidiness: its single blocker scopes to Phase 3 step 3.3 and states in writing that Phases 1-2 and steps 3.1-3.2 land regardless, so nothing about the file is waiting on a decision; the census it is built on exists at agents/evidence/analysis/consolidation-lineage-census-2026-08-26.md; and its Risk Register carries a dated review marker. Draft was an estate-ratchet accommodation at authoring time, not a statement that the work was undecided."
---
# Road to consolidation lineage integrity

> **Source:** `agents/evidence/analysis/consolidation-lineage-census-2026-08-26.md`,
> a census run while analysing `agents/tmp/evolve/` and `agents/tmp/evolver/`.
> The finding is not about either subject — it is about the consolidation
> pattern both folders used, and it reproduced on two older folders too.

## Goal

A consolidating roadmap cannot silently omit a sibling proposal. When this is
finished, every artefact that declares itself a consolidation states its parent
set in a machine-readable field, a check compares that set against the siblings
actually present, and an omission is a reported finding rather than an invisible
one. The obligation lives on the command that already produces these artefacts,
not on a new surface.

This roadmap does **not** try to make consolidations better. It makes an
incomplete one visible.

## The measurement

Four inbox folders contain a declared consolidation. All four have an incomplete
lineage — full table and method in the census file.

Three of the four share one shape and it is the sharper one: the omitted sibling
is a **later synthesis over the very parents the master did consolidate**, and
says so in its own header. The consolidation reached the first generation and
stopped one generation short, three times independently, in three unrelated
subject areas. The fourth folder holds two masters over the same four parents,
neither naming the other.

The consequence is what makes this worth a plan rather than a note. A
consolidating roadmap presents its content as adjudicated: parents named,
conflicts resolved, a kill register saying what was rejected and why. When a
parent is missing from that list its content is not killed, it is undiscussed —
and **nothing in the artefact distinguishes those two states.** On the two
current folders a structural read of the omitted parents surfaced 13 and 17
substantive items carrying no kill ID, several of which bear on a decision the
master made on the same mechanism. Those two figures are what the structural
reads reported, and **no command reproduces them** — they are a judgement about
what counts as one substantive item, not a count of anything the tree holds.
Corrected after a neutral review asked for their provenance; a first attempt at
that correction offered a `grep -c` marker count as a reproducible proxy, which
was worse than no number: it counts lines mentioning the marker, including prose
about it, and it moved while these very corrections were being written.

## Phase 1 — Make the lineage declarable and comparable

- [ ] **1.1 Fix one field name for the parent set.** The measured folders used
      **five** distinguishable forms, corrected after a neutral review found the
      earlier count of four had omitted one that the census's own `grep` searches
      for: `consolidates:` frontmatter · a `supersedes_analysis:` key · a prose
      "**Inputs consolidated:**" list · a "Master-Konsolidierung" heading with a
      table · and a prose "**Ersetzt als führendes Proposal:**" list. A check
      cannot read five shapes reliably, and the diversity is itself part of why
      nobody noticed. Pick one — `consolidates:` is already used by two of the
      four folders and is the recommendation — and state the rest as deprecated
      spellings a reader may still encounter.
      verify: the field is documented in the roadmap template contract, and a
      fixture in each of the five legacy shapes parses to the same parent set or
      is explicitly reported as unparseable.
- [ ] **1.2 Require the field on any artefact that claims to consolidate.** The
      trigger is the claim, not the filename: `-master` in a name is not the
      signal, because two of the four omissions were in files without it.
      verify: an artefact using consolidation vocabulary without the field is
      reported.

## Phase 2 — Compare the declared set against what is present

- [ ] **2.1 Report every sibling roadmap in the same folder that the declared
      set omits.** Plain set difference over `road-to-*.md` in the
      consolidation's own directory. No judgement about whether the omission was
      correct — the output is "declared 2, present 3, omitted X".
      verify: run against all four census folders and reproduce the census table
      exactly; run against a synthetic complete folder and get zero findings.
- [ ] **2.2 Report the reverse direction too.** A declared parent that is not
      present is the other half of the same defect and cheaper to get wrong: it
      means the lineage names a file nobody can open. Both sibling roadmaps
      authored from this inbox carry a verified instance of this shape — a master
      citing a plan that exists nowhere in the repository.
      verify: a declared parent with no matching file is reported with its name.
- [ ] **2.3 Detect the second shape: two artefacts, one parent set.** When two
      artefacts in one folder declare overlapping parent sets and neither names
      the other, report both. A plain set comparison finds it.
      **Corrected after a neutral review: this fires on three of the four census
      folders, not on `redundanz/` alone.** In `evolve/`,
      `road-to-gated-harness-evolution-deep-v4.md:10-11` declares supersession
      over *exactly* the two parents the master names, and neither document names
      the other; in `evolver/`, `supersedes_analysis:` and `consolidates:` list
      the identical pair. So the two shapes the census presented as disjoint
      overlap, and an earlier `verify:` line here expected the finding in one
      folder while the data produces it in three — a verification that would have
      failed on its own evidence.
      verify: `evolve/`, `evolver/` and `redundanz/` each produce this finding
      and `impeccable /` does not, since there the omitted sibling declares a
      `research.basis:` grounding list rather than an overlapping parent set.

## Phase 3 — Put the obligation where the artefacts are produced

- [ ] **3.1 Extend `/analyze:inbox` rather than adding a surface.** That command
      already triages inbox folders, already has a `recurrence` column in its
      Phase 2 table, and already asks "is this the second time?" in Phase 4c.
      Lineage completeness is one more triage column on the same pass, and no
      other artefact in the tree carries this discipline.
      **The verification behind that last clause was corrected after a neutral
      review.** It originally cited zero hits across `src/skills/`, `src/rules/`
      and `src/agent-src/commands/` — but that third path holds only `evals/`,
      no command prose at all, so the zero was guaranteed by the scope rather
      than by absence. Command bodies live under `src/domains/`, including the
      target of this step
      (`src/domains/analysis-workbench/analyze/inbox/command.md`). Re-run over
      `src/skills/`, `src/rules/` and `src/domains/`, there is exactly **one**
      hit — `src/domains/product-basic/roadmap/next/command.md`, and it concerns
      the concurrent-session register, not consolidation lineage. The conclusion
      holds; the earlier evidence for it did not.
      verify: the command's Phase 2 table gains the column, and its Phase 5
      artefact-mapping table says what an omission becomes.
- [ ] **3.2 Say what an omission obliges.** Not "consolidate it too" — that is a
      judgement the operator makes. The obligation is to **name it**: either fold
      the omitted parent in, or record a kill ID for it, or state that it was
      read and adds nothing. Silence is the failure mode; any of the three is a
      discharge.
      verify: the command text enumerates the three discharges and forbids
      silence.
- [~] **3.3 Consider a gate.** Deferred: needs E1. A check that runs over
      gitignored inbox directories cannot be a CI gate, because CI never sees
      them. It could run locally from the command, or as a pre-commit check on
      any roadmap carrying the field. Whether it enforces or reports is E2.

## Blockers

### lineage-check-enforcement-surface

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 step 3.3 only. Phases 1, 2 and steps 3.1–3.2 land
  regardless.
- **What to do:** pick exactly one — (a) local-only, invoked by
  `/analyze:inbox`, reporting and never blocking, since the inputs are
  gitignored and CI cannot see them; or (b) local-only for inbox folders **plus**
  a tracked-tree check on any roadmap in `agents/roadmaps/` carrying the field,
  which CI *can* run; or (c) no check at all — the command text carries the
  obligation and the honest enforcement note says `instruction-only`.
- **Resolved when:** the decision is recorded and, if (a) or (b), the script is
  registered in `src/config/gate-coverage.yml` with a `reportScanned` count and a
  `--self-test`.
- **Recommendation:** (b). The inbox half must be local because the data is
  gitignored, and the tracked half is where an omission would actually survive
  into the estate — a consolidating roadmap that lands with a missing parent is
  the case worth blocking, and it is the only one CI can see.
- **If you do nothing:** Phases 1–2 produce a script nothing runs, and 3.1–3.2
  make the obligation model-carried. That is the same honesty position several
  rules in this tree already state, and it is a legitimate outcome — but it
  should be a decision, not a default reached by not deciding.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The check becomes a nag on legitimate folders | product | An inbox folder often holds files that are not parents — transcripts, notes, an unrelated roadmap. A set difference over `road-to-*.md` will report those, and a finding that is usually wrong gets ignored, which is worse than no finding | 2.1 is validated in both directions against all four census folders and a synthetic complete folder; 3.2 makes naming-it a one-line discharge so a false positive costs a sentence, not a re-run | Phase 2 — Compare the declared set against what is present |
| 2 | Four legacy declaration shapes are silently misparsed | implementation | The measured folders used four different forms. A parser that reads one and returns empty for the others reports every legacy consolidation as declaring zero parents — a finding storm that discredits the check on its first run | 1.1 requires a fixture per legacy shape that either parses identically or is reported as unparseable, never as empty | Phase 1 — Make the lineage declarable and comparable |
| 3 | A gate that cannot see its own inputs | implementation | The inbox directories are gitignored, so a CI gate over them scans nothing and exits green — the "gates that scan nothing exit green" failure this tree has recorded before | The blocker forces the surface decision before the script is registered, and option (b) splits the check into the half CI can see and the half it cannot | Phase 3 — Put the obligation where the artefacts are produced |
| 4 | n=4 is read as a law | product | Four folders is enough to show the pattern is not an outlier and not enough to characterise the population. A plan written as if the rate were known invites a mechanism sized for a certainty that does not exist | The census states its own bound explicitly, and this roadmap's deliverable is visibility rather than prevention | Phase 1 — Make the lineage declarable and comparable |

## Acceptance Criteria

- [ ] AC-1 — Running the comparison over a committed fixture set that mirrors the
      four census folders reproduces the census table exactly, and running it over
      a synthetic complete folder produces zero findings. **The fixtures are the
      criterion, not the live folders**: both inbox directories are gitignored and
      `agents/tmp/` is already emptied, so an acceptance criterion phrased against
      them would be satisfiable on one machine and nowhere else. Corrected after a
      neutral review; E4 carries the same limitation from the retention side.
- [ ] AC-2 — A declared parent with no matching file is reported by name, and a
      present sibling absent from the declared set is reported by name.
- [ ] AC-3 — Each of the five legacy declaration shapes either parses to the same
      parent set as the canonical field or is reported as unparseable — never as
      an empty set. The count is five, not four: a parser fixed at four accepts
      the omitted shape blind, and the omitted shape is one the census greps for.
- [ ] AC-4 — `/analyze:inbox` carries the lineage column and enumerates the three
      discharges for an omission, so an omission cannot be discharged by silence.
- [ ] AC-5 — The enforcement surface is a recorded decision, and if a script
      exists it is registered with a scanned count and a self-test.

## Open maintainer decisions

- **E1 — Enforcement surface.** See Blockers.
- **E2 — Report or block,** if a check lands at all. Reporting is the safe start
  given risk 1.
- **E3 — Does this generalise beyond consolidations?** The same shape —
  an artefact asserting it adjudicated a set, without stating the set — could
  apply to a council synthesis or a review that claims a scope. Out of scope
  here; worth naming so it is not rediscovered.
- **E4 — Retention of `agents/tmp.old/`.** The census is reproducible only while
  that directory is retained. It is gitignored and holds **347** entries — an
  earlier revision said 345, which was the count before this drain moved its own
  two folders there. If it is ever pruned, the evidence file becomes the only
  record. No action asked for — just
  the awareness that this finding's substrate is not durable.
