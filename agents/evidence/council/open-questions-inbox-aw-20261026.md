<!-- evidence-type: analysis -->

# Council — three open questions from round inbox-2026-10-aw (2026-10-26)

Question: `open-questions-inbox-aw-20261026.question.md` beside this file. Members ["anthropic/claude-sonnet-4-5","openai/codex-default"], rounds 2, cost $0 (subscription seats).

Outcome, both seats `STANCE: Q1 a Q2 a Q3 council`: wake `road-to-a-graph-that-wins`; unpark `road-to-release-finding-ordering` with 2.2 and AC-2 behind the owner blocker; quarantine the seven unsupported owner attributions as unverified, relabel nothing, and leave the historical fact to the owner. The openai seat marked `DEALBREAKER: yes` on its stated conditions (never touch a `release/*` PR; reconcile the step inventory), which this change keeps.

## Seat: anthropic

## Round 2 Response

### Points I agree with

**Reviewer A:**
- Q1 is council-decidable: entry conditions objectively met, under cap (4 of 5), reversible work
- Q2's blocker explicitly scopes to "2.2 and AC-2 only" - not the whole roadmap
- Q3 confirmation is owner-reserved: only the owner can confirm his own historical decisions
- The one-question formulation for Q3 is well-structured

**Reviewer B:**
- Q1's operational defect: no detector evaluates `entry_condition`, causing repeated manual review
- Q2's sequencing risk: 1.1-1.3's "completion manifest" may encode semantics needed by 2.2
- Q3's key distinction: evidence-policy remediation (council) ≠ historical-fact confirmation (owner)
- Trust boundary concern: mutable roadmap headers/metadata as authority evidence

### Points I disagree with

**Reviewer B:**
- "Underspecified" may overstate Q2. The blocker text saying "gates 2.2 and AC-2 only" IS the specification.
- `DEALBREAKER: yes` seems too strong - the concerns raised are valid process improvements, not fundamental blockers to the decision framework.

### New points not raised in round 1

1. **Q2 - The expired `review_by` date is material but doesn't block unparking.** The blocker itself offers three options including "move `review_by` with a reason." Passing 2026-09-20 means the blocker is overdue for owner resolution, not that it auto-expires or invalidates the roadmap. The 13 unblocked steps can still proceed while the blocker remains binding for 2.2/AC-2.

2. **Q3 - Two-phase remediation is cleaner.** The council doesn't need owner confirmation to enforce "owner-decision requires cited directive" - that's an existing evidentiary standard. Phase 1 (council): remove unsupported owner attributions now. Phase 2 (owner): confirm which decisions were actually his, cite the evidence. This separates evidence control from historical-fact confirmation.

3. **Q1 - The operational defect is the real finding.** Waking the roadmap is correct, but the fourth arrival of this request shows the `entry_condition` mechanism is coupled to manual review rather than automated transition. That's a process gap, not a decision blocker.

4. **Trust boundary that neither reviewer named:** If `decision_makers: owner` in an ADR is mutable metadata anyone with write access can edit, then ADR-286's false attribution could recur without the lint. The integrity fix is: make owner attribution immutable once set, or require a signed directive file before `decision_makers: owner` is writable at all.

### My stance

**Q1: (a) wake it.** Entry conditions satisfied, reversible, under cap. Note the operational defect for process improvement.

**Q2: (a) unpark unblocked work.** The blocker explicitly scopes to 2.2/AC-2. Steps 1.1-1.3, 2.1, 2.3, 3.1-3.3 are council-executable. The expired `review_by` makes the blocker overdue but doesn't void it - the owner still must resolve it before 2.2 can run.

**Q3: council.** Removing unsupported owner attributions is evidence-policy enforcement, not governance self-amendment. The council can quarantine the seven ADRs and remove owner attribution where no directive is cited. The owner confirms historical facts separately. Fabricating replacement attribution (option b as written) would be wrong; removing invalid attribution is enforcement.

**Hardest pushback:** I'd reject treating expired `review_by` dates as immaterial. If a blocker was meant to be reviewed by 2026-09-20 and hasn't been, that's an overdue owner decision - but it doesn't block unparking work the blocker explicitly doesn't gate. The real risk is if the owner meant to re-evaluate the whole roadmap and the expired date is the signal we missed.

**What would change my mind:** Evidence that the `review_by` date applied to the roadmap's viability, not just the blocker's resolution. Or if the owner states the seventh-arrival pattern (Q2) means the park was meant to be permanent.

STANCE: Q1 a Q2 a Q3 council | CONFIDENCE: high | DEALBREAKER: no

## Seat: openai

## Greenlight decision

I would approve Q1 and a restricted Q2, bringing the repository from three to exactly five active roadmaps. For Q3, the council may quarantine unsupported attribution, but only the owner can confirm historical authorship.

### 1. Prior points I agree with

- **Reviewer A on Q1:** Both stated `entry_condition` clauses are satisfied, activation is reversible, and the owner-reserved repository selection has already occurred. Waking the roadmap is council-decidable.
- **Reviewer B on Q1’s operational defect:** “No detector evaluates `entry_condition`” means lifecycle state depends on repeated human review. The fourth arrival is evidence of missing automation, not a reason to keep the roadmap parked.
- **Both reviewers on Q2:** The owner blocker expressly gates only step 2.2 and AC-2. It should not silently become a roadmap-wide blocker.
- **Reviewer B on Q2 sequencing:** The “completion manifest” may encode assumptions later exercised by 2.2. Fixture validation is legitimate; claiming end-to-end completion is not.
- **Reviewer B on Q3’s trust boundary:** Accepted ADR metadata is not proof of owner authorization. ADR-286 demonstrates that the writing and acceptance path can manufacture false authority.
- **Reviewer A on the owner question:** Only the owner can confirm whether the seven historical decisions were actually his.

### 2. Where I disagree

- **Reviewer A is too restrictive on Q3.** The underlying historical fact is owner-reserved, but evidence-integrity remediation is not. The council can immediately mark the seven attributions `unverified`, quarantine the ADRs from authority-dependent use, and prevent them from serving as precedent. Those are reversible controls within the existing authority envelope.
- **Reviewer B goes slightly too far in permitting removal of the owner attribution outright.** Absence of cited evidence proves that the attribution is unsupported, not necessarily false. Until the owner answers, `unverified` is more defensible than substituting `council` or `agent`.
- **Neither prior review accounts for the combined WIP effect.** Q1 says activation makes four active; Q2 is assessed separately. Approving both makes five active, exactly the cap—not four. That is still permissible, but it eliminates all remaining WIP capacity and should be treated as one atomic allocation decision.

### 3. New findings and refinements

**Q1 — approve (a), with rollback criteria.**

Wake it because the explicit entry conditions are met. Re-park it if either corpus attribution cannot be tied to the claimed 2026-10-23 owner directive, the archived parent becomes active again, or activation would exceed the cap because another roadmap wins the final slot first.

The trust-boundary weakness is that a mutable `## Corpus header` is apparently treated as proof of an owner-reserved selection. The header should reference immutable owner evidence; otherwise any editor able to change roadmap prose can simulate satisfaction of the gate.

**Q2 — approve (a), but the proposal’s inventory is internally inconsistent.**

The text claims “14 open steps” but enumerates only nine:

- 1.1–1.3: three
- 2.1–2.3: three
- 3.1–3.3: three

The five missing steps could contain additional dependencies or owner gates. Therefore, “run every step but 2.2” is not safe as written. Unpark only the explicitly enumerated, verified-unblocked steps after reconciling the complete step inventory.

Required stop conditions:

- Never create, target, or mutate a `release/*` PR.
- Keep 2.2 and AC-2 explicitly owner-blocked.
- Do not mark the roadmap complete while AC-2 remains unresolved.
- Re-park if an “unblocked” step requires the synthetic PR, consumes the fifth WIP slot without executable work, or materially constrains the owner’s eventual choice.

Option (c) remains impermissible because it directly lifts a stated Hard-Floor owner gate.

**Q3 — council-decidable remediation, owner-reserved attribution.**

The council should immediately classify all seven records as having unsupported owner attribution and prevent them from authorizing downstream decisions. It must not choose between `owner`, `council`, and `agent` without evidence.

Ask the owner one question:

> For ADRs 283, 287, 288, 293, 297, 298, and 299, which decisions did you personally make, and for each confirmed decision what prior words or directive should be recorded as evidence?

Anything not confirmed should then be relabelled according to repository evidence—not automatically assigned to the council.

### Hardest architectural pushback

The most serious defect is allowing editable governance metadata to cross the owner-authority boundary without independently verifiable evidence. That permits ordinary repository acceptance to impersonate owner consent.

I would change my mind only if the system demonstrated that every `decision_makers: owner` value is derived from or validated against an immutable, owner-authenticated directive, and that unverified records cannot influence gates, precedents, or automation.

STANCE: Q1 a Q2 a Q3 council | CONFIDENCE: high | DEALBREAKER: yes

