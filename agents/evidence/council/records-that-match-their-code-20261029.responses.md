<!-- evidence-type: analysis -->

## Response-A

*tokens: 10 in / 2061 out · 50987 ms*

Matze, reviewing as an independent round 2 critic:

## Agreement with prior reviewers

**Agree with both A and B on Item A:** ADR-287 is stale. The owner directive post-dates it and carries authority. The minimal correction is recording the supersession in ADR-287's frontmatter. This is a **council record correction** — the transition already happened, the code implements it, the metadata must catch up. (Reviewers A and B both land here with clear reasoning.)

**Agree with both A and B on Item B needing discovery:** Cannot determine which record is wrong without ADR-299's actual text, approval status, and creation date. Reviewer B's critique is particularly strong here: "Code existence establishes neither permission nor policy precedence."

**Agree with Reviewer B's structural critique:**
- The T3 mismatch, P3 prohibition, and roadmap rejection are one conflict, not three findings — deduplicate.
- Calling speculative conclusions by name is correct discipline.

## Disagreement / refinement

**Reviewer B's "documentary tension" framing undersells the conflict.** The registry description *definitively* matches T3's stated definition:
- T3: "indefinite, aggregated, cross-repo"
- Registry: indefinite (kept forever), aggregated (one list), cross-repo (keyed per checkout, spans repos)

This isn't "inferred" — it's a direct match. So either:
1. ADR-299 opened T3 (explains how), OR
2. The contract is wrong (T3 has an unstated exception), OR  
3. ADR-299 is unauthorized (and the code violates governance)

**Both reviewers missed:** The roadmap says the rejection was **"on the enumeration argument"** — not a blanket T3 ban, but a specific concern about unbounded enumeration. ADR-299 might have addressed that concern (e.g., single-machine scope, no cross-machine sync). This distinction matters: if the rejection was narrow, ADR-299 could be compliant without reversing it.

## New points

1. **The minimal correction depends on a fourth scenario neither reviewer listed:** If ADR-299 is authorized *and* addresses the enumeration concern, then the roadmap's "Declined" section is accurate history but needs a resolution note ("Later opened via ADR-299 under scoped constraints"). No reversal, no contract change — just documentation that the specific blocker was resolved.

2. **The contract's "OPENING IT IS AN ADR" clause suggests T3 CAN be opened.** It's not an absolute prohibition like P3's "PROHIBITED, unchanged." So if ADR-299 exists and is approved, the contract might just be missing a citation. The prohibition is about *process* (no code writes T3 without an ADR), not outcome (T3 is forever closed).

3. **Authority distinction for B:** If ADR-299 is approved and the only issue is stale cross-references, that's a **council correction**. If ADR-299 was never approved or bypassed governance, removing it is an **owner transition** (it would effectively lower the floor ADR-299 raised).

## Ranked follow-ups

1. **Read ADR-299 in full** (status, approval, supersession, enumeration mitigation). This resolves whether B is a documentation lag or a governance breach.
2. **Correct ADR-287's supersession metadata** (A). Ready now, no discovery needed.
3. **If ADR-299 is authorized:** Update the T3 contract with a citation to ADR-299 as the opening decision, and add a resolution note to the roadmap's "Declined" section. Council correction.
4. **If ADR-299 is unauthorized:** Escalate to owner for a governance decision — either ratify it or remove the registry. Owner transition.

---

**Top-N consensus:**
- **A (confirmed):** ADR-287's unsuperseded status contradicts the later owner directive and implementation. Council corrects the record by citing the directive in ADR-287's supersession field.
- **B (confirmed conflict, resolution unclear):** The project registry definitively matches T3's definition. The roadmap rejection was scoped to "enumeration." Discovery: ADR-299's approval status and enumeration mitigation determine whether this is stale documentation or unauthorized code.

**Strongest blind spot:** Neither the original analysis nor the reviewers distinguished between *process violations* (opening T3 without an ADR) and *outcome prohibitions* (T3 is categorically closed). The contract's "OPENING IT IS AN ADR" suggests the former — which makes ADR-299's existence evidence it followed process, not evidence it violated it.

---

## Response-B

*tokens: 45996 in / 1036 out · 40196 ms*

Matze, **Reviewer B’s resolution is better supported**, with one refinement: ADR-299’s authority must be checked separately against each governing record.

### Agreement with round 1

- **Reviewer A, Item A; Reviewer B, finding A:** ADR-287 D1’s unsuperseded status conflicts with the later owner directive, item 3. Recording that existing owner decision is a **council record correction**. Reversing the five-roadmap cap would require the owner.
- **Reviewer B, scoped supersession:** Preserve ADR-287’s historical text and annotate D1 specifically. Reviewer A’s proposed whole-document `superseded_by` replacement could incorrectly supersede unrelated decisions; the supplied excerpts also do not establish that this field accepts directive paths.
- **Reviewer B, finding B:** Implementation and an ADR reference do not establish authorization. The full ADR-299 decision, status, approval, and scope are needed.
- **Reviewer B, deduplication and historical treatment:** T3, P3, and the declined registry are supporting records for **one unresolved registry-governance finding**, not three roadmap items. A historical “Declined” entry may remain accurate after a later reversal.

### Disagreements and refinements

**Must fix — Reviewer A’s chronology-based resolution of B.** “ADR-299 came later” does not establish that the council validly reversed a binding restriction or owner decision. Its later date would establish sequence, not authority. Conversely, an earlier ADR does not by itself establish that subsequent roadmap text overruled it.

**Must fix — Reviewer A’s removal proposal.** “Remove `project_registry.ts` and ADR-299” is unsupported and exceeds record reconciliation. Preserve historical decisions; determine governing authority before proposing a separate implementation transition. Calling removal a floor-lowering action is also unsubstantiated: removing persistence could strengthen the stated prohibition.

**Refinement to Reviewer B — authorization is provision-specific.** Even an authoritative ADR-299 might authorize a registry without explicitly amending both T3 and P3. Reconcile its language against each restriction rather than treating “ADR-299 is authoritative” as blanket permission.

**Reject as established fact — executable behavior from descriptions alone.** Item B supplies a module description and storage characteristics, but no writer call site. That supports documentary tension; it does not independently demonstrate an executed T3 write.

### Evidence and readiness

“Confirmed” here means supported by the supplied citations or excerpts, not independently verified files.

| Unique finding | Evidence quality | Readiness |
|---|---|---|
| **A — Stale current-status representation in ADR-287 D1** | **Confirmed:** D1 rejects any cap; the later owner directive imposes five; `estate_wip.ts:7` implements five. | **Ready:** annotate D1’s supersession and cite the directive using supported record syntax. |
| **B — Unresolved registry authorization and classification** | **Confirmed:** contradictory documentary claims. **Inferred:** indefinite storage across checkout entries meets T3’s “aggregated, cross-repo” definition. P3 applicability remains unresolved. | **Discovery first:** inspect ADR-299 and complete T3/P3 scope before selecting corrections. |

Explicitly **speculative** conclusions are: “ADR-299 validly reversed the rejection,” “the registry is exempt from T3,” “the registry is definitively prohibited today,” and “deleting it requires owner approval.”

### Follow-up actions, ranked by leverage

1. **Resolve B’s governing authority:** inspect ADR-299’s operative decision and approval against T3, P3, and the July rejection.
2. **Land A’s scoped annotation:** record the already-issued owner directive without superseding unrelated ADR content.
3. **Verify B’s classification:** identify writer call sites and stored fields; determine whether T3 and P3 apply independently.
4. **Draft B’s reconciliation:** name each stale assertion if authorization exists; otherwise identify the precise owner decision required.

**Top-2 consensus**

- **A:** ADR-287 D1’s unsuperseded status is stale; its scoped correction is council-ready.
- **B:** The registry presents one unresolved governance conflict requiring authority and scope discovery.

The analysis’s strongest blind spot is treating chronology and implementation as substitutes for provision-specific authorization.

---

## Convergence / Divergence

Summarise the council with the analysis-lens shape below.

### Top-10 by consensus
Findings ranked by how many reviewers surfaced them. Format each
line as: `N. <finding> — cited by <reviewer labels> · evidence:
confirmed | inferred | speculative · roadmap-ready: yes | needs-discovery`.
Stop at ten or when only single-reviewer items remain, whichever
comes first.

### Supporting
Findings that one reviewer raised and at least one other treated as
plausible but did not independently surface. One line each, same
metadata shape as Top-10.

### Outliers
Single-reviewer findings the others did not engage with. Keep them
— they are signal for a future deeper analysis pass — and give each
the SAME metadata shape as Top-10, including its `evidence:` term.
The heading is the corroboration statement: everything under it was
raised by one reviewer and engaged with by none. Do not invent a
separate certainty word for that; `evidence:` measures how well a
finding is supported, and being alone in raising it is a different
property the section already carries.

### Resolving evidence
One line per unresolved disagreement above, in this shape:
`<clash> — strongest minority evidence: <what the losing side actually
showed> · resolved by: <the observation that would settle it>`.
Name a measurement, an artefact or a run — never a further opinion. Write
`no resolving evidence identified — <why>` when nothing observable would
settle it: an unanswerable disagreement is a finding, and silence is not.

### Kill criteria
Observable conditions that would falsify the analysis's leading finding
without re-convening the council. Each entry names a threshold or event.
Omit only if genuinely none exist, and say so.

### Concrete next step
Exactly one artefact-producing action the user can take in their current
turn.

---

### De-anonymization map

- Response-A → anthropic · claude-sonnet-4-5
- Response-B → openai · codex-default

---

**Quorum:** 2/2 present, needed 1 — concluded.

---

### Absent Members

- **anthropic** — anthropic: unknown (live_probe: no exchange with this provider has ever been recorded)
- **openai** — openai: unknown (live_probe: no exchange with this provider has ever been recorded)
