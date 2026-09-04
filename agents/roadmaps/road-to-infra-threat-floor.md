---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `threats.csv`, `surfaces.csv`, `terraform` and `aws-infrastructure` — no
# roadmap owns the threat corpus. The production-safety-spine proposal of the
# 2026-09-c round named the same gap and was declined as authored; this carries
# the one part of it that verified.
estate_offset_exempt: "Adds one active roadmap against a floor of 1. It is not foldable into road-to-deterministic-defect-detectors, whose subject is diff-local checks over agent behaviour, while this one adds rows to a threat corpus and two stack skills; the two share no file and no gate. Parking it leaves the rule layer naming IaC controls that the corpus behind it cannot supply."
---
# Road to an infrastructure threat floor

> **Source:** `agents/tmp.old/inbox-2026-09-d/set-1/` — the infrastructure half
> of an external research pass, re-checked against `main@46022ddd8`.

## Goal

The threat corpus covers the surface the rule layer says it covers.
`src/skills/threat-modeling/data/surfaces.csv` carries nine surface classes —
authentication, authorization, billing, data-exposure, external-integration,
file-upload, public-endpoint, secrets, tenancy — and
`data/threats.csv` carries fifteen threat rows across exactly those nine. Not
one of them is infrastructure. Meanwhile `senior-engineering-discipline` § 2
tells an agent that an infra or IaC change owes least-privilege, encryption at
rest, no `0.0.0.0/0` to management or database ports, and no hardcoded
credentials — controls whose threat rows do not exist in the corpus that skill
is supposed to ground them in. When this is finished the corpus carries an
infrastructure surface class, and the two stack skills carry the permissiveness
canon they are missing.

## Phase 1 — The surface class the corpus does not have

- [ ] **1.1 Add an infrastructure surface class to `surfaces.csv`.** The file is
      the keyword seed the surface classifier reads, and a class absent there is
      a class the classifier can never return. One row, with the keywords an
      IaC change actually carries — terraform, security group, ingress, bucket,
      IAM, policy, KMS, subnet — and its data classes.
      verify: the classifier returns the infrastructure class for a described
      change that names a security group or a storage bucket, and returns the
      existing classes unchanged for the nine surfaces already covered.
- [ ] **1.2 Add the threat rows behind it.** `threats.csv` is the mitigation
      authority, so a control with no row there is a control with no binding
      home. The five classes the research names and the tree does not carry:
      an ingress rule open to `0.0.0.0/0` on a management or database port;
      storage public by default; a missing encryption block at rest or in
      transit; a wildcard IAM action or resource; a credential in a
      configuration file rather than a secret manager. Each row keeps the
      file's existing columns, including its negative test.
      verify: `grep -icE '0\.0\.0\.0|security group|cidr'` over
      `data/threats.csv` returns a non-zero count, and every added row has a
      populated Required Controls and Negative Tests column.
- [ ] **1.3 Say where no detector exists.** Several of these are not decidable
      from a diff by anything this tree ships. A row that names a control the
      repository cannot check states that, rather than implying a gate behind
      it.
      verify: every added row either names the check that decides it or says
      plainly that none exists.

## Phase 2 — The two stack skills

- [ ] **2.1 Give `terraform` the permissiveness canon.** The skill covers
      version pinning — `:51`, "Always pin provider versions in
      `versions.tf`" — and `grep -c '0\.0\.0\.0'` over it returns zero, so the
      failure class the research puts first is uncovered while the one it puts
      fourth is covered. Add a section for permissive defaults and missing
      security blocks, with backstop greps in the shape the skill already
      uses: `0.0.0.0/0`, `publicly_accessible`, a wildcard action or resource.
      verify: the greps are present and each names what a hit means and what
      the override condition is.
- [ ] **2.2 Give `aws-infrastructure` the least-privilege lines.**
      `grep -icE 'least.privilege|Action: ?\*|Resource: ?\*'` over the skill
      returns zero across its 157 lines. Add the same canon in that skill's own
      idiom, pointing at the corpus rows from 1.2 rather than restating them.
      verify: the skill cites the threat rows by their surface class, and the
      grep returns a non-zero count.
- [ ] **2.3 Keep the two skills pointing at one authority.** The rows live in
      `threats.csv`; the skills reference them. A second copy of the mitigation
      text in a skill is the drift this phase must not create.
      verify: neither skill restates a Required Controls cell; both link to the
      surface class instead.

## Phase 3 — Reach, measured rather than assumed

- [ ] **3.1 Answer whether secret scanning sees consumer IaC diffs at all.** The
      research raises this as an open question rather than a defect, and it is
      one: `check_secret_leak` exists, and whether it runs over a consumer diff
      that changes only `.tf` or `.yaml` files is not established anywhere.
      Read the gate's scope and write the answer down.
      verify: the answer is recorded with the file and line that decides it,
      and says which file extensions the scope actually covers.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The corpus grows into a compliance list | product | Five rows invite fifty, and a threat corpus that enumerates every cloud misconfiguration stops being read at all — the nine existing classes are curated, not exhaustive | 1.2 fixes the five to the classes the research measured as the weakest, and 1.3 forbids a row that implies a check the tree does not have | Phase 1 — The surface class the corpus does not have |
| 2 | The skills and the corpus drift apart | implementation | The cheapest way to write 2.1 is to paste the control text into the skill, after which the two say different things within a release | 2.3 is a step rather than a note, and its verification is the absence of a restated cell | Phase 2 — The two stack skills |
| 3 | The classifier regresses on the nine covered surfaces | implementation | Adding keywords to `surfaces.csv` can pull an existing description into the new class — `policy` and `bucket` are not unambiguous | 1.1 requires the nine existing classes to return unchanged, which is a check on the addition rather than a hope about it | Phase 1 — The surface class the corpus does not have |
| 4 | Phase 3 turns into an implementation | implementation | An open reach question invites building the coverage it asks about, which is a different roadmap and a much larger one | 3.1 is scoped to recording an answer, and names no remedy | Phase 3 — Reach, measured rather than assumed |

## Acceptance Criteria

- [ ] AC-1 — `surfaces.csv` carries an infrastructure class, the classifier
      returns it for an IaC change, and the nine existing classes are unchanged.
- [ ] AC-2 — `threats.csv` carries the five infrastructure threat rows, each
      with populated controls and negative tests, and each either naming the
      check that decides it or stating that none exists.
- [ ] AC-3 — `terraform` and `aws-infrastructure` each carry the permissiveness
      canon with backstop greps, and neither restates a control cell from the
      corpus.
- [ ] AC-4 — Whether secret scanning covers consumer IaC diffs is recorded with
      the file and line that decides it.
