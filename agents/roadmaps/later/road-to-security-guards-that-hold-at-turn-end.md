---
complexity: lightweight
status: later
review_by: 2027-01-25
entry_condition:
  what: an active roadmap slot is free (WIP < 5) and the dispatch hook bundle has room for a turn-end concern without a raise, or the owner pulls this roadmap
  when: `ls agents/roadmaps/*.md | wc -l` below 5, and `./scripts-run src/scripts/check_hook_bundle_composition` reporting at least 2,000 bytes of headroom
  who: any session pulling the next parked roadmap; steps 1 and 3 touch a hook concern and a rule, so each lands with its ratification record
execution:
  mode: phase-checkpoints
estate_offset_exempt: >
  Round inbox-2026-10-as: grep -rlF for "absence claim", "all-clear", "dispatch-subject",
  "check_upload_surface", "security-sensitive-stop" over agents/roadmaps/*.md, later/ and
  stubs/ (whole tree) found no owner for these four deferred items. They were deferred
  rather than built by road-to-security-answer-that-names-what-it-checked because each
  touches a hook concern, a rule or a new detector, and the bundle had 7 bytes of headroom.
estate_growth_exempt: >
  +1 later_roadmaps: parks the four items road-to-security-answer-that-names-what-it-checked
  did not build, so they are carried instead of dropped.
  Also +3 skill_description_tokens: the security-audit description names the casual
  whole-app question so it routes (6/6 probe prompts; tests/scripts/security_audit_route_probe.test.ts).
relates:
  - slug: road-to-security-answer-that-names-what-it-checked
    relation: extends
    note: >
      That roadmap shipped the scoped answer, the routing, the ledger run_status and the
      upload corpus; this file carries what needs a hook, a rule edit or a detector.
  - slug: road-to-a-security-chain-measured
    relation: disjoint
    note: >
      Stub. Owns the bench that would measure whether these guards change the
      false-all-clear rate.
---
# Road to security guards that hold at turn end

> **Source:** `agents/tmp.old/inbox-2026-10-as/` (topics t01–t03), parked
> 2026-10-25 by `road-to-security-answer-that-names-what-it-checked` Phase 6.

## Goal

The skill-level fixes are in: a casual security question now gets a scoped
answer. Nothing yet catches an agent that writes "all secure" anyway. This
roadmap adds that catch, scopes the verifier fan-out by subject, widens the
upload trigger of `security-sensitive-stop`, and adds a lexical upload-surface
detector. Each step is measured before it can block.

## Phase 1 — An absence claim carries its denominator

- [ ] **1.1 Shadow detector in `turn-end-gate`.** A pre-registered DE/EN
      multi-word phrase register ("all secure", "no vulnerabilities", "keine
      Sicherheitslücken") is only the trigger. The verdict comes from state:
      the reply names `checked:` / `not checked:`, or a security ledger was
      read this session. Log only. Pre-register the false-positive bar in
      `docs/CLAIMS.md` before it can block.
      verify: a vitest with positive and negative fixtures for the concern, then
      `./scripts-run src/scripts/check_hook_bundle_composition` green without a raise.

## Phase 2 — Verifier fan-out scoped by subject

- [ ] **2.1 `dispatch-subject` marker.** `<!-- dispatch-subject: <finding-id> -->`
      lets `evidence_independence` tell five verifiers over five findings
      (fan-out) from two verifiers over one finding (verdict shopping).
      verify: a test where 5 verifiers on 5 subjects warn 0 times and 2 on 1 subject warn once.

## Phase 3 — Upload prompts reach the security stop

- [ ] **3.1 Narrow triggers on `security-sensitive-stop`.** Add `uploaded file`,
      `upload endpoint`, `multipart`, `avatar upload`, `hochladen`, `Datei-Upload`;
      never bare `upload`, so "Upload the roadmap to the shared drive" stays silent.
      The rule's per-spawn token cost is offset in the same change.
      verify: `tests/eval/routing-matrix/security-sensitive-stop.yaml` gains the positives and keeps the near-miss, and its routing test is green.

## Phase 4 — A lexical upload-surface detector

- [ ] **4.1 Planted corpus and pre-registered claim first.** Violating,
      safe-twin and decoy files for PHP/Laravel and Node/multer, inert markers
      only, plus a `ground-truth.json`; claim `upload-surface-finds-planted`
      registered `unbacked` before any detector code. Written by a different
      session than the detector, so the corpus is held out.
      verify: a ground-truth test passes and no detector file exists yet.
- [ ] **4.2 `check_upload_surface`.** Lexical, read-only, reusing
      `_lib/scan_scope.ts`; classes bound to the `file-upload` threat rows; an
      unmatched class reports `unknown`, never "passed".
      verify: per-class recall and false positives against 4.1, reported without calling the claim backed.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The detector blocks on phrases | product | A phrase list misfires on ordinary prose and gets switched off | Shadow first; the verdict reads state; the bar is pre-registered | Phase 1 — An absence claim carries its denominator |
| 2 | The upload detector over-reports like its sibling | implementation | The account detector stayed unbacked after false positives on this tree | Held-out corpus by another session; `unknown` instead of a claim | Phase 4 — A lexical upload-surface detector |

## Acceptance Criteria

- [ ] AC-1 — An unbacked "all secure" in a reply is recorded in the shadow log, and the negative corpus stays under the pre-registered bar.
- [ ] AC-2 — Verifiers over distinct findings raise no independence warning; a second verifier on one finding does.
