---
complexity: structural
status: ready
---

# Road to judgment and forensic evidence — one protocol against a measured defect, one evidence source git already holds

> Two harvests survive verification and share one property: both replace a
> narrative judgement with something checkable. The first swaps the adversarial
> council's critic prompt for a protocol that must name a single load-bearing
> assumption — aimed at a **measured 100 % false-positive rate**. The second
> computes hotspot and change-coupling scores from `git log` alone. Everything
> else in the source harvest is struck, folded, or blocked; the gap table says
> which and why.

> Source (consumed inbox): `agents/tmp.old/add-pac-features.txt` (2026-08-08) —
> five draft roadmaps from four external references plus a viral prompt. Raw
> links stay in that local-only file; sources are referred to here as A–D.

## Goal

Reduce the adversarial council's false-positive rate on the existing frozen
controversial-but-correct control set below 50 % at ≥ 80 % true-positive
retention, and publish per-release hotspot / change-coupling deltas as
machine-derived evidence — or record the honest null for each independently.

## Prerequisites

- [x] A measured target defect: the adversarial council scored a **100 %
      false-positive rate** on controversial-but-correct controls
      (`agents/settings/contexts/feedback-9x-council-cut.md`).
- [x] A frozen control set exists from that prior analysis.
- [x] Council infrastructure with a swappable prompt surface
      (`src/skills/ai-council/`, `scripts/ai_council/`).
- [x] Gate-ledger + scan-scope primitives the forensics pack must emit against
      (`src/scripts/_lib/gate_ledger.ts`, `_lib/scan_scope.ts`).

## Context (verified against the tree, do not relitigate)

- **The council defect is real and recorded**, which is what makes this harvest
  worth anything: a protocol with no named defect to attack would be ceremony.
- **Three of the source's five drafts are not plannable as written.** Two name
  target roadmaps that have never existed in this tree
  (`road-to-orchestrator-only-doctrine`, `road-to-video-perception`,
  `road-to-security-runtime-layer`, `road-to-memory-compilation`,
  `road-to-judgment-protocol-skills` — all absent), and they cross-reference
  each other's unbuilt phases. A plan whose dependencies are other drafts in the
  same file is a design sketch, not a roadmap.
- **One source claim is false against the tree.** Source D's "preventable
  mistakes and canonical-formula lock are absent from the SKILL.md standard" —
  `## Known pitfalls` is specified in `src/skills/skill-writing/SKILL.md:509`
  AND capped at ≤ 5 sourced entries by `src/rules/size-enforcement.md:27`. That
  half of the item was already built; only the attestation half survives.
- **The source's own honesty holds up.** Its 2-of-8 yield on the viral prompt,
  its refusal to import Source D's self-scored "98/100 effectiveness" and its
  unresolvable "4-9× defect rates" citation, and its correction of the
  "no tokens burnt" claim were all checked and are all correct. The rejected
  items are rejected here for the same reasons.
- **A 12-dimension release-review matrix could not be located** anywhere in
  `docs/` or `src/`. Phase 2 therefore wires the forensics output to the review
  surface that actually exists, and says so rather than planning against a
  remembered artefact.

## Gap table — what is kept, folded, and cut from the source harvest

| Source item | Verdict | Why |
|---|---|---|
| Load-bearing-assumption critic protocol (A/B against legacy) | **KEEP → Phase 2** | Targets a measured 100 % FP defect with a frozen control set already in hand |
| `premortem` skill + roadmap-template failure register | **KEEP → Phase 1** | Roadmaps pre-register success metrics and not failure signatures; retroactive validation is cheap |
| Hotspot + change-coupling analyzers | **KEEP → Phase 3** | Deterministic, git-only, gate-scriptable — the evidence class this repo prefers |
| Skill invocation attestation (`attest`) | **FOLD → Phase 4** | Real gap, but it edits the authoring standard across every pack; own ADR, own phase, last |
| "Preventable mistakes" section for SKILL.md | **CUT** | Already shipped as `## Known pitfalls`, with a cap the source did not have |
| Socratic phase-ordering planning mode | **CUT** | Source's own weakest-fit verdict; agent-to-agent workflows do not need human facilitation pacing |
| Source D's effectiveness and defect-rate numbers | **CUT** | Self-scored and unresolvable to a primary source; importing them would be the exact folklore this repo strips |
| Dollar-cost debt quantification | **CUT** | Undisclosed multipliers |
| Socio-technical / team analyses | **CUT** | Meaningless at one maintainer |
| Dispatch ambiguity gate · `assumptions[]` | **FOLD → elsewhere** | `assumptions[]` lands in `road-to-worker-generation-recycling` Phase 0; the ambiguity gate hangs off a cancelled mechanism (see blocker) |
| Memory compilation (G1–G5) · adaptive web perception (M1–M6) | **CUT from this roadmap → blocker** | Substantial and partly real, but capacity is a maintainer call and two of their phases depend on a capsule format that does not exist yet |

## Phase 1 — Pre-mortem as a roadmap authoring artefact

- [x] 1.1 Add a default-off `premortem` skill emitting a four-part failure
      register: the three most probable causes of death ranked, one untested
      hidden dependency, one modification that makes failure survivable, one
      tripwire metric with a horizon.
      <!-- done 2026-08-09: the skill already existed default-off in
      analysis-workbench (predates this roadmap; grandfathered in the
      trigger-eval freeze) — the step became an edit, not a create: § 3b now
      emits the four-part register and the output format names it. -->
- [x] 1.2 Add an optional `## Pre-mortem` section to the roadmap template.
      Optional, not required — a mandatory section becomes boilerplate, and
      boilerplate in a failure register is worse than its absence.
      <!-- done 2026-08-09: rule 25 + commented INCLUDE-ONLY block in the
      template fence (same pattern as Blockers/Provenance), matching § 5b2
      step in roadmap-writing. -->
- [x] 1.3 Validate retroactively and blind: for the last 4 initiatives that
      closed as null or were reverted, write a pre-mortem from the plan text
      alone, with the outcome withheld, then compare.
      <!-- verify: grep -c "## Pre-mortem" agents/roadmaps/*.md -->
      <!-- done 2026-08-09: orchestrator-first (08-07), activation red-baseline
      (08-02), Mode 9 (07-21), reminder-injection (07-06); thin-projection
      (07-31) excluded — outcome embedded in its own phase headings, no
      blindable plan text. Registers + blinding procedure:
      agents/evidence/analysis/premortem-blind-retro-validation.md -->
- [x] 1.4 Gate: ≥ 2 of those 4 name the actual failure cause in their top three.
      Below that the protocol adds ceremony rather than foresight → honest null,
      skill stays default-off and unrecommended.
      <!-- done 2026-08-09: 3 of 4 hit, all at rank 1 (orchestrator-first,
      activation, reminder-injection); Mode 9 missed (named statistical
      undecidability, actual cause was vendor redundancy). Gate PASSES under
      strict mechanism-match scoring. -->
- [x] 1.5 Do not import the cited +30 % prospective-hindsight effect size as
      support. It is a single study; the mechanism may be worth having and the
      number is not load-bearing. Evidence grade recorded as such.
      <!-- done 2026-08-09: the number appears nowhere in the skill, template
      rule, or validation doc; the validation doc states the bounds (n=4, one
      writer family, retrospective selection) explicitly. -->

**Exit:** four blind retro pre-mortems written and scored against real outcomes; the gate resolves either way.
**Rollback:** default-off skill and an optional template section — deleting both is a two-file revert.

## Phase 2 — Council critic protocol A/B against the measured defect

- [x] 2.1 Implement the protocol as an alternative critic prompt behind
      `council.critic_protocol: legacy | load_bearing` (default `legacy`). The
      protocol must (a) name the single load-bearing assumption, (b) state the
      cost of what is being avoided, (c) state what someone who already
      succeeded at a comparable thing would do differently.
      <!-- done 2026-08-09: top-level `critic_protocol` key in .ai-council.yml
      (config.ts + validation + tests + contract section); prompt in
      bench_critic_protocol.ts carries (a),(b),(c) plus the council-added
      failure-scenario forcing function (design pass anthropic+openai
      2026-08-09: assumption tied to named file+function, "holds" as a
      completed review, one-shot kept). -->
- [x] 2.2 The discriminating property is constraint (a): a correct plan HAS a
      load-bearing assumption that survives inspection, and the protocol must
      permit saying so. A critic that cannot return "this holds" cannot have a
      false-positive rate below 100 % by construction — that is the mechanism
      hypothesis, stated so it can be wrong.
      <!-- done 2026-08-09: stated verbatim in the CLAIMS registration; the run
      graded it — holds on the strong model (FP 100%→33%), falsified in its
      general form (gpt-4o collapsed to blanket approval). -->
- [x] 2.3 Pre-register in `docs/CLAIMS.md` BEFORE any run: FP < 50 % on the
      frozen controversial-but-correct control set AND ≥ 80 % true-positive
      retention on known-flawed controls. Both thresholds, or the arm does not
      promote.
      <!-- done 2026-08-09: claim critic-protocol-load-bearing-ab, committed
      with the frozen harness BEFORE the run (own commit). -->
- [x] 2.4 Run both arms on the frozen set. Publish both directions.
      <!-- verify: ./scripts-run src/scripts/check_claims --quiet -->
      <!-- done 2026-08-09: NO PROMOTION — anthropic passes both thresholds
      (FP 1/3, retention 0.80), openai fails retention (0/12, blanket
      approval). Both directions published in the claim resolution + runs/
      critic-protocol-ab-{report.json,trace.txt}. check_claims green. -->
- [x] 2.5 The prompt author is not the prompt's judge: the control set is
      frozen, the thresholds are registered first, and neither is adjusted after
      the numbers land.
      <!-- done 2026-08-09: registration commit precedes the run in this
      branch's history; corpus untouched; the incoherent-category scoring rule
      was fixed in the registration text, not after the numbers. -->

**Exit:** both arms scored on the same frozen set against thresholds fixed before the first run.
**Rollback:** `legacy` is the default throughout; the alternative arm is a config value away from gone.

## Phase 3 — Forensic analyzers as a read-only pack

- [x] 3.1 Implement two deterministic analyzers in a default-off pack:
      hotspot risk (normalised change frequency × normalised complexity) and
      change coupling (`co_changes(A,B) / min(changes(A), changes(B))`). Inputs
      are `git log` and file metrics — no external dependency, no network.
      <!-- done 2026-08-09: src/scripts/forensics_report.ts; pack `forensics`
      (default_install: false, surface_tier: lab) with skill forensics-report;
      ADR-013 vocabulary amended in the same PR. Complexity proxy documented:
      LOC + indentation units. -->
- [x] 3.2 Emit machine-readable JSON with a scan count through the shared
      scan-scope helper, so an analyzer that reads nothing fails loudly instead
      of publishing an empty finding set.
      <!-- verify: ./scripts-run src/scripts/check_gate_coverage --quiet -->
      <!-- done 2026-08-09: reportScanned/assertScanned — zero analyzed commits
      throws DeadScopeError (tested); check_gate_coverage green, and the
      emitter-registration test (44/44) confirms no unregistered emission. -->
- [x] 3.3 Byte-stable output on a frozen fixture repository — the same
      determinism bar the condensation pipeline holds.
      <!-- done 2026-08-09: frozen fixture log + metrics under
      internal/bench/forensics/; test asserts byte-identity across runs AND
      against the committed expected-report.json (11/11 green). -->
- [x] 3.4 Wire the output as **advisory** to the release-review surface that
      exists. Name that surface in the step when it is written; do not plan
      against a remembered one.
      <!-- done 2026-08-09: the surface that exists is the release findings
      pipeline — review-findings.schema.json-shaped items via --findings-out,
      ingested by check_finding_dispositions --ingest into
      agents/evidence/release-findings/<version>.json (the ledger the
      release-PR "Blocking review findings dispositioned" job reads). Emitted
      kinds are correctness/low|medium — non-blocking in isBlocking by
      construction. Documented in the forensics-report skill. -->
- [x] 3.5 Pre-register the value question: across 3 releases, do the
      machine-derived findings surface anything the manual review missed, or
      contradict it? ≥ 2 confirmed unique findings promotes the pack to a
      standing input; zero closes it as an on-demand tool.
      <!-- done 2026-08-09: claim forensics-pack-value in docs/CLAIMS.md,
      registered before any release is scored; 1-finding tie-break rule
      stated at registration. -->
- [x] 3.6 Cross-module coupling above a stated threshold between areas the
      router treats as independent is a contradiction between intended and
      actual boundaries — record it as a finding class, not as a failure.
      <!-- done 2026-08-09: boundary_contradictions[] in the report (threshold
      0.5, min support 3, modules = top-level path segments), emitted as the
      finding class forensics-boundary-* with severity medium — advisory,
      never a failure. Tested on the fixture. -->

**Exit:** both analyzers deterministic on the fixture; three releases scored against the pre-registered question.
**Rollback:** the pack is default-off and read-only; removing it changes no shipped behaviour.

## Phase 4 — Skill attestation, last and behind its own record

- [ ] 4.1 Specify an optional `attest` capability: a skill declaring it states
      its own invocation in a fixed form, making non-invocation and silent skip
      detectable in a transcript — the skill-layer analogue of a gate publishing
      its scan count.
- [ ] 4.2 Write the ADR first. This edits the authoring standard used by every
      pack, and the honest scope note belongs in the record: a self-reported
      attestation is evidence that a skill said it ran, never that it ran.
- [ ] 4.3 Build the transcript-scanning check only after the ADR lands, and only
      if the ADR concludes the signal is worth the surface.

**Exit:** ADR merged with the self-report limitation stated in it; the check exists only if the ADR says so.
**Rollback:** no capability ships before the ADR, so the rollback is not writing it.

## Phase 5 — What this roadmap will not do

- [ ] 5.1 No "golden prompt" text is imported anywhere. Behaviour is configured
      through rules with gates, not through pasted preambles.
- [ ] 5.2 No narrated chain-of-thought is added to worker outputs. It would
      regress kernel budget discipline directly, and this repo asks workers for
      evidence rather than narration. A future proposal must cite this line and
      bring budget arithmetic.
- [ ] 5.3 No external numbers from any source in this harvest enter a claim, a
      doc, or a commit message without resolving to a primary source first.

## Pre-mortem

Four-part failure register (rule 25; written at execution start, before the
Phase-2 run):

1. **Causes of death, ranked:**
   1. *The protocol trades blanket criticism for blanket approval.* The
      load_bearing arm clears the FP ceiling by rubber-stamping — naming a
      trivial assumption and voting "holds" on genuinely flawed fixtures — and
      dies at the TP-retention floor. The A/B then publishes a null and the
      measured 100 % FP defect stays unfixed.
   2. *The forensics pack ships and its value question never resolves.* The
      pre-registered three-release window needs three future releases to be
      scored; nobody scores them, the advisory output goes unread, and the
      pack rots as neither promoted nor closed.
   3. *Experimenter degrees of freedom leak into scoring.* The prompt author
      is also the experimenter; a post-hoc scoring choice (how "flawed with
      empty findings" counts) shifts the FP number after the run.
2. **Untested hidden dependency:** the two pinned vendor models stay available
   and behaviourally stable between pre-registration and the run — a model
   deprecation or silent revision redefines both arms mid-experiment.
3. **Survivable-failure modification:** commit the frozen prompts, scorer
   semantics, and CLAIMS thresholds in their own commit BEFORE the first paid
   call, and publish both directions — a failed arm is then still a
   publishable result, not a wasted run.
4. **Tripwire:** the `--mock` pipeline must produce a failing verdict for a
   deliberately bad arm and a passing verdict for a deliberately good arm
   before any paid call; if the mock cannot discriminate in both directions,
   halt before spend.

## Blockers

### blocker: memory-and-perception-capacity

- **Status:** open
- **Owner:** maintainer
- **Blocks:** whether the two remaining harvests become roadmaps at all
- **What to do:** decide whether the compiled-memory harvest (schema document,
  epistemic states on stored claims, a memory lint gate, crystallisation) and
  the web-perception harvest (sufficiency-based stopping, content pruning before
  ingestion) get roadmaps. Both were verified and are partly real. Two facts
  belong in the decision: the crystallisation phase and the perception
  checkpoint phase both consume a capsule format that does not exist yet
  (`road-to-worker-generation-recycling` Phase 0 creates it), and there are
  already more than twenty open roadmaps against one maintainer.
- **Resolved when:** the decision is recorded — roadmap, `later/`, or dropped —
  for each of the two independently.

### blocker: dispatch-ambiguity-gate-dependency

- **Status:** open
- **Owner:** maintainer
- **Blocks:** the ambiguity-gate item, which is deliberately in no phase here
- **What to do:** the gate's value argument is that a dispatcher's
  misinterpretation multiplies across N workers — which presumes the
  orchestrator-only posture that a pre-registered stopping rule cancelled on
  2026-08-07. Decide the posture first; the gate is downstream of it.
- **Resolved when:** `blocker: orchestrator-only-mode-decision` in
  `road-to-worker-generation-recycling` is resolved.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-08 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The new critic prompt is scored by the party that wrote it | product | The measured defect is a prompt defect, and the same session proposing the replacement also picks what counts as a false positive — the shape that manufactures a favourable verdict | 2.3 fixes both thresholds in CLAIMS before any run, 2.5 freezes the control set, and 2.4 publishes both directions; none of the three is adjustable after the numbers | Phase 2 |
| 2 | The protocol trades blanket criticism for blanket approval | product | A critic told to find one load-bearing assumption can satisfy that by finding a trivial one and declaring the plan sound — failing in the opposite direction, which the FP metric alone would score as success | The true-positive floor on known-flawed controls is a joint condition with the FP ceiling; neither threshold passes alone | Phase 2 |
| 3 | The forensics pack ships and nobody reads it | product | Advisory analyzers accumulate output that changes no decision, and an unread report is indistinguishable from a passing one | 3.5 pre-registers a value question with a zero-finding exit that closes the pack rather than keeping it, and the wiring stays advisory until it clears | Phase 3 |
| 4 | Hotspot scores become a proxy for code quality | product | A file that changes often and is complex is a hotspot even when both properties are correct for it, and a score with no interpretation rule invites decisions it cannot support | 3.6 files coupling findings as a finding class, not a failure, and the analyzers stay read-only with no gate authority in any phase here | Phase 3 |
| 5 | Attestation is mistaken for enforcement | implementation | A skill stating it ran is self-report, and this repo has already measured that self-report tracks nothing about compliance | 4.2 requires the limitation in the ADR text itself, and 4.3 makes the check contingent on that record rather than shipping ahead of it | Phase 4 |
| 6 | The pre-mortem section becomes required boilerplate | product | A failure register written to satisfy a template stops being a forecast, and the ceremony is then indistinguishable from the practice | 1.2 keeps the section optional by design and 1.4 pre-authorises the null that removes it | Phase 1 |
| 7 | Cutting the memory and perception harvests loses verified work | product | Both were checked against the tree at real cost, and a blocker is where analysis goes to be forgotten | The blocker carries the verification result and the two dependency facts, so a later decision starts from the finding rather than from a re-read of the source | Blockers |

## Acceptance criteria

- [ ] The council A/B publishes both arms against thresholds registered before the first run, in either direction.
- [ ] No number, effectiveness score, or defect-rate claim from any source in this harvest appears in a claim, doc, or commit message unresolved to a primary source.
- [ ] The forensics analyzers are byte-stable on a fixture and publish a scan count; an empty scan fails loudly.
- [ ] Every source item appears in the gap table with exactly one verdict — nothing is adopted without one, and nothing cut is quietly reintroduced in a phase.
- [ ] The attestation ADR states the self-report limitation in its own text, not in a linked file.
- [ ] Each pre-registered gate in this roadmap has a written null outcome that removes or closes the mechanism, not one that defers it.
