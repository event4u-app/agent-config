---
complexity: structural
status: ready
---

# Road to provenance and license governance — code borrows get a paper trail

> **Source:** maintainer inbox `agents/tmp.old/copyright-council.txt`
> (2026-07-28) — AI coding agents can emit code near-verbatim from
> training data; output-side legal exposure is live (Doe v. GitHub
> proceeds on that factual premise). AC currently has no answer at the
> code layer: `lint_originality_shingles.ts` guards skill/doc *content*,
> not generated *code*; no rule tells a worker what to do on a conscious
> borrow; no deterministic detector runs in `ci`; no provenance record
> exists for adapted third-party code; the agent-ide-plugin repo ships
> without a LICENSE. Council-reviewed 2026-07-28 (§ Council review).

## Goal

Ship a three-layer provenance system: a **behavioral layer** (rule +
skill family that forces read → close source → re-derive → attribute),
a **deterministic detection layer** (jscpd offline + SCANOSS winnowing
online, warn-only with `--strict` ratchet), and a **provenance ledger**
(`provenance/borrows.jsonl` + THIRD-PARTY-NOTICES) — measured against a
pre-registered golden corpus before any gate blocks CI.

**Thesis.** Copilot's duplication filter and Amazon Q's reference
tracker match verbatim/near-verbatim only — restructured code passes
silently. A governance OS can do what a filter cannot: force the
transformation to happen and force the paper trail to exist, then
verify both cheaply. Detection is the backstop; discipline is the
product. Nobody ships *rule + skill + deterministic gate + provenance
ledger* as one governed unit — that combination is squarely AC's
identity. **Reliance order (council patch 2026-07-28): the
deterministic layer scans EVERY changed file regardless of what the
agent declared — coverage never depends on the agent's self-report;
the behavioral layer shapes discipline and creates audit surfaces, it
is never the control the system relies on.**

**Anti-thesis (recorded honestly).** We cannot prove absence of
copying. No tool sees model training data; SCANOSS matches against a
KB of *known* OSS — a subset. **Unconscious reproduction from training
data is NOT addressed by the behavioral layer at all — an LLM has no
introspective access to whether output is recalled or derived; only
the deterministic scan of all changed files partially covers it,
bounded by KB coverage.** Every claim is scoped to "reduces and
documents risk", never "eliminates". Overclaiming here is worse than
shipping nothing — and this paragraph must reach user-facing surfaces,
not stay buried here (S3.3).

## Design principles (inherited, not invented)

1. **Unknown escalates, never down-guessed** (classifyLookup, PR #1028).
   Unknown license ⇒ most restrictive; ambiguous match ⇒ human.
2. **Warn-only first, `--strict` promotion path** (lint_spawn_payload,
   PR #1028). No new gate blocks CI until FP rate is proven on goldens.
3. **Additive audit fields, `schema_version` stays 1** (PR #1028).
4. **Claims pre-registered unbacked, fixed falsification criteria,
   explicit backing trigger** (lean-init precedent).
5. **Baseline gate may DROP later phases** (L2/L3 precedent).
6. **Rename-only is not transformation.** Winnowing normalizes away
   identifiers/whitespace by construction — a snippet hit cannot be
   cleared by renaming variables. Clearing requires (a) structural
   re-derivation (hit disappears on rescan) or (b) an attributed ledger
   entry. Closes the launder-by-rename loophole.
7. **Privacy by construction.** Only fingerprints leave the machine
   (SCANOSS WFP); offline mode always produces an honestly-labeled
   partial result — never a fake green.

## Dependencies

- `src/scripts/lint_originality_shingles.ts` (exists — content
  originality, PR #969 lineage).
- `docs/CLAIMS.md` ledger + check_claims gate (exists).
- **PR #1028 (OPEN at authoring time)** — lint_spawn_payload warn-only/
  `--strict` lifecycle, classifyLookup escalation principle, additive
  audit-fields discipline, `roles:` frontmatter axis, `origin` audit
  field. Phases 2–3 consume these patterns; do not start Phase 2 before
  #1028 merges.
- `agents/roadmaps/later/road-to-sparring-critic-spike.md` (parked;
  Phase 5 candidate vertical).

## Phase 0 — Golden corpus + baseline (gate for everything)

- [ ] **S0.1 Build `internal/bench/provenance/` golden corpus**:
  12 seeded-copy samples (real snippets from permissive MIT/Apache/BSD
  and copyleft GPL/AGPL repos, TS + PHP, three per transformation
  depth: verbatim / rename-only / structural-rewrite) + 12 independent
  samples (same tasks solved in-house before seeing the source —
  striking-similarity control, LiCoEval-style). Seeded-copy samples
  live only in `internal/` (never shipped in the npm package), each
  with source URL + license recorded — the corpus practices what it
  enforces.
  *Verify:* corpus README lists all 24 samples with source URL +
  license per seeded sample; npm pack output contains none of them.
- [ ] **S0.2 Pre-register acceptance thresholds in `docs/CLAIMS.md`
  BEFORE any scanner runs** (SHA-freeze the corpus — implements the
  Critic-prompt-freeze gap recorded in the quality-stack review):
  detector recall on verbatim+rename-only seeded copies ≥ 10/16; false
  positives on independent samples ≤ 1/12. The floor is a GO/NO-GO
  gate for building the CI layer — it is never the marketed
  capability; the marketed capability is the actual measured rate,
  published per S3.1/S3.3 (council patch 2026-07-28).
  *Verify:* CLAIMS.md entry carries the corpus tree-SHA; entry commit
  predates the first baseline-run commit.
- [ ] **S0.3 Baseline run**: SCANOSS (online) and jscpd (offline)
  against the frozen corpus; record per-sample results.
  *Verify:* per-sample result table committed under
  `internal/bench/provenance/reports/`.
- [ ] **Gate G0**: thresholds met → Phases 2–3 proceed as designed.
  Thresholds missed → deterministic layer stays a research note,
  Phases 2–3 re-scope to behavioral-only (rules + ledger, no CI gate),
  honest-null published (Team-Mode Δ=0 precedent). No silent threshold
  adjustment.
  *Verify:* gate verdict recorded in CLAIMS.md against the
  pre-registered thresholds.

## Phase 1 — Behavioral layer (rules + skill; zero external deps)

- [ ] **S1.1 New rule `code-provenance`** (roles: all; kernel-adjacent):
  NEVER adopt external code verbatim — borrowing = read → close the
  source → re-derive against house standards → adapt. Any *conscious*
  borrow (algorithm, non-trivial structure, >~10 lines of logic shape)
  REQUIRES a provenance ledger entry (S1.3) and a license-compatibility
  check (S1.2) BEFORE the code lands. Unknown license ⇒ do not borrow;
  escalate. Self-interrogation clause (AUXILIARY, explicitly
  non-load-bearing — council 2026-07-28): before finalizing any
  non-trivial function the agent answers internally *"Did I derive
  this, or do I remember it?"* — "remember" + nameable source ⇒ treat
  as borrow; "remember" + no nameable source ⇒ flag `origin: uncertain`
  in the PR description (~0 tokens). The flag is an extra audit
  surface, never a control: an LLM cannot reliably introspect recall
  vs derivation, so the deterministic layer scans all changed files
  regardless of this signal, and no gate outcome may depend on the
  flag's presence.
  *Verify:* rule passes lint-skills + rule-type governance; projection
  delta measured on reviewer role (< 1k tokens, § Budget).
- [ ] **S1.2 License-policy DERIVATION** (Council Q1 RESOLVED
  2026-07-28, owner: detect, don't assume):
  - Detection (`detect_target_license.ts`, installer + `agents:update`
    hook): precedence (1) `LICENSE`/`LICENSE.md`/`COPYING` matched to
    SPDX IDs, (2) `package.json` `license`, (3) `composer.json`
    `license`. Sources disagree ⇒ escalate, never auto-pick. Nothing
    detectable ⇒ strictest default PLUS a warning that the target repo
    itself has no license (the agent-ide-plugin lesson, automated).
  - Derived policy via a closed compatibility matrix (target class →
    borrowable source classes), no free-text:

    | Target license class | allow | conditional | deny |
    |---|---|---|---|
    | permissive (MIT/Apache-2.0/BSD/ISC/0BSD) | permissive, CC0/Unlicense | MPL-2.0, LGPL (file-scoped ⇒ escalate) | GPL, AGPL, SSPL, unknown |
    | weak copyleft (MPL-2.0/LGPL) | permissive + same-class | GPL (direction-dependent ⇒ escalate) | AGPL, SSPL, unknown |
    | GPL-2.0/3.0 | permissive + GPL-compatible copyleft | LGPL/MPL | AGPL (for GPL-2.0), SSPL, unknown |
    | AGPL | permissive + GPL-family | — | SSPL, unknown |
    | none detected / proprietary | permissive only, ledger mandatory | everything else ⇒ escalate | copyleft, unknown |

  - `license-policy.yaml` stays as the OVERRIDE surface (consumer can
    tighten, or loosen with explicit `derived_from: manual`); derived
    file carries `derived_from: <SPDX ID>` + detection source + SHA of
    the LICENSE file — a later license change invalidates the policy
    deterministically (re-derive on mismatch, escalate on downgrade).
    Closed enum, schema-validated. Matrix rows are goldens: one fixture
    repo per target class in the Phase-0 bench proves derivation.
  *Verify:* per-class fixture repos derive the expected policy in a
  test; disagree-fixture escalates; no-license-fixture warns + defaults
  strict.
- [ ] **S1.3 Provenance ledger**: `docs/THIRD-PARTY-NOTICES.md` +
  machine file `provenance/borrows.jsonl`
  (`{source_url, license, source_sha, borrowed_at, files,
  transformation_note, cleared_by}`) + linter `lint_provenance.ts`:
  every `deny`-class entry fails; every entry missing a
  transformation_note fails. Wired into `ci` immediately — this linter
  checks OUR OWN RECORDS, not fuzzy similarity; strict from day one.
  *Verify:* fixture jsonl with a deny entry fails ci; valid entry
  passes; NOTICES regenerates from jsonl.
- [ ] **S1.4 Skill family `license-compliance/`** (consumer-facing):
  `borrow-check` (paste URL ⇒ license fetch ⇒ policy verdict ⇒ ledger
  entry draft), `credits` (regenerate NOTICES from jsonl),
  `license-audit` (run Phase-2 scanners on demand). Descriptions follow
  the contributor-precheck pattern; content passes
  `lint_originality --changed`.
  *Verify:* skills pass lint-skills; borrow-check golden transcript
  produces a valid ledger entry draft.

## Phase 2 — Deterministic detection layer (the verifier)

Blocked on: PR #1028 merged (consumes its lint lifecycle + audit-field
patterns) AND Gate G0 passed.

- [ ] **S2.1 `lint_code_provenance.ts`, warn-only, `--strict`
  promotion path** (verbatim lint_spawn_payload lifecycle):
  L-1 (offline, always) = jscpd token-clone scan of the diff against
  repo + vendored deps (catches within-project laundering). L0 (online,
  changed-files-only, cached) = scanoss-py WFP scan of changed files —
  `--changed` scoping mandatory (free-tier rate limits; PR #969
  `--changed` wiring lesson: wire to the PR CI path in the SAME PR).
  Verdict joins license policy: `hit+allow` ⇒ warn "attribute or
  re-derive"; `hit+deny` ⇒ strict-fail candidate; `hit+unknown` ⇒
  escalate — escalation target named (council finding 8): a CI
  annotation carrying the hit + license lands on the PR, and the
  borrow decision routes to the repo maintainer as a numbered-options
  ask (per `ask-when-uncertain`); never auto-cleared, never
  agent-resolved. Network unavailable ⇒ honest `partial (offline)`
  line.
  *Verify:* golden-corpus rerun reproduces Phase-0 measured recall/FP;
  offline mode emits the partial marker, never green.
- [ ] **S2.2 Clearing protocol** (principle 6): a warn clears only by
  (a) rescan-clean after rewrite or (b) ledger entry referencing the
  hit; `cleared_by` recorded. Rename-only rewrites re-hit by
  construction — pin that property with a golden test so nobody "fixes"
  the normalizer later.
  *Verify:* rename-only golden still hits after clearing attempt;
  structural-rewrite golden clears.
- [ ] **S2.3 Telemetry** — additive fields on the existing audit object
  (`schema_version` stays 1, reader-tolerance test like PR #1028):
  `provenance_scan` (ran|skipped|offline), `snippet_hits`,
  `license_class` (allow|conditional|deny|unknown), `ledger_ref`,
  `cleared_by` (rescan|ledger|human), `origin` (reusing the PR #1028
  field).
  *Verify:* old reader parses new lines; schema_version unchanged.
- [ ] **S2.4 Strict promotion gate (pre-registered)**: promote to
  `ci-strict` only after ≥ 25 audited PR lines with 0 uncontested false
  positives (lint_spawn_payload evidentiary shape).
  *Verify:* promotion PR cites the 25-line audit window.

## Phase 3 — Claims + measurement

- [ ] **S3.1 Pre-register `provenance-gate-effectiveness` in
  `docs/CLAIMS.md`, unbacked.** Claim text (maximum honest form): "AC's
  provenance gate detects seeded verbatim and rename-only OSS copies at
  the Phase-0 measured rate and enforces a documented borrow trail; it
  does not and cannot certify absence of copying." Falsification: any
  seeded verbatim golden passing silently in strict mode; any
  deny-license ledger entry passing `ci`. Backing trigger: G0 pass +
  ≥ 25 audit lines (S2.4) + one full self-audit of the AC repo (Phase 4).
  At backing time the claim MUST carry the actual measured numbers
  (recall X/16, FP Y/12) — "at the measured rate" without the numbers
  is not a backed claim (council finding 3).
  *Verify:* check_claims passes; entry marked unbacked with the
  triple trigger.
- [ ] **S3.2 README section under claims discipline**: no
  "copyright-safe" language anywhere, ever. Approved vocabulary:
  "provenance-governed", "license-policy-enforced", "audited borrow
  trail". Banned-phrases list added to the docs linter.
  *Verify:* docs linter fails a fixture containing "copyright-safe".
- [ ] **S3.3 User-facing "Scope & limits" box (council finding 1)**:
  every user-facing surface that uses an approved-vocabulary term
  (README section, marketing page, install output) MUST co-locate a
  quantified scope statement: (a) unconscious training-data
  reproduction is not detectable at this layer — no tool sees model
  training data; (b) detection covers matches against a KB of KNOWN
  OSS only; (c) the actual Phase-0 measured recall + FP numbers, kept
  in sync with CLAIMS.md. Approved vocabulary WITHOUT the co-located
  box = violation of the S3.2 global consequence bound. Docs linter
  enforces co-location (term found ⇒ box anchor must be present in the
  same file).
  *Verify:* linter fixture with "provenance-governed" and no box
  fails; fixture with box passes; numbers cross-checked against
  CLAIMS.md by the linter.

## Phase 4 — Dogfood + hygiene (practice before preach)

- [ ] **S4.1 Run the full pipeline on `agent-config` itself**; publish
  the result as a proof exhibit regardless of outcome (honest-null
  precedent: a clean run is evidence; a dirty run fixed in public is
  better evidence).
  *Verify:* exhibit committed with scan verdicts per file class.
- [ ] **S4.2 REUSE/SPDX headers on `src/`**; `reuse lint` added to
  `ci-strict` once green.
  *Verify:* `reuse lint` green in ci-strict.
- [ ] **S4.3 Fix known ecosystem gaps**: LICENSE file for
  `agent-ide-plugin`; verify `agent-switch` + `data-helpers` NOTICES
  (data-helpers has a recorded license contradiction — resolve under
  S1.3 discipline).
  *Verify:* all three sibling repos carry LICENSE + consistent NOTICES.
- [ ] **S4.4 ADR `provenance-governance`** recording the legal-honesty
  boundary (§ Anti-thesis) so future marketing cannot drift past it.
  *Verify:* ADR merged + indexed; cites the banned-vocabulary list.

## Phase 5 — IP-Critic vertical (conditional; sparring-critic unpark)

Gives the parked `later/road-to-sparring-critic-spike.md` its first
concrete non-cosmetic vertical — but ONLY if the deterministic layer
leaves a measurable gap.

- [ ] **S5.1 Gap measurement first**: on the Phase-0 corpus the
  structural-rewrite seeded copies define the residual class. If
  deterministic recall on the FULL corpus ≥ 14/16, **DROP this phase**
  (an LLM layer riding on a solved problem = sippenhaft-coupling in
  reverse; record the drop like L2/L3).
  *Verify:* drop-or-proceed verdict recorded against the corpus report.
- [ ] **S5.2 If gap confirmed: IP-Critic rubric** for the sparring
  loop — derivation probes ("walk me through the derivation of this
  function", "what changes if the requirement were X"),
  transformation-depth scoring. Rubric-mandatory, budget-capped per
  `max_tokens_per_worker` tiers, PASS/FAIL pre-registered on the
  residual-class goldens. Confabulation bound (council finding 6): a
  probe answer counts as transformation-depth evidence ONLY — never as
  provenance proof; an LLM's derivation narrative can be confabulated,
  so a fluent answer clears nothing by itself.
  *Verify:* rubric + PASS/FAIL registered before first critic run;
  rubric text carries the evidence-only bound.
- [ ] **S5.3 Critic trigger discipline**: runs only on
  `origin: uncertain` flags (S1.1) and residual-class file types —
  never blanket (lean-init token lesson).
  *Verify:* trigger conditions encoded in the dispatch config;
  blanket-run impossible by construction.

## Explicitly NOT in scope (cuts)

- **C1** Training-data litigation posture, indemnity, legal advice
  surfaces. AC ships engineering controls, not lawyering.
- **C2** Building/mirroring an OSS knowledge base. We consume SCANOSS's
  KB; if it fails the kill criteria we fall back to L-1 + ledger.
- **C3** LLM-based license *classification* (deterministic policy file
  only — same cut as lean-init C3).
- **C4** Blocking generation in-flight (IDE interception). AC governs
  at the diff/PR boundary where it has deterministic footing.
- **C5** Non-code assets (images, lyrics, docs beyond existing
  originality linting). One roadmap, one domain.

## Council questions (pre-registered for the debate round)

1. ~~Static GPL-deny vs installer license detection~~ **RESOLVED
   2026-07-28 (owner): detect and derive** — landed in S1.2. Residual:
   does monorepo/workspace layout need per-workspace derivation via the
   `workspaces:` axis, or is root-LICENSE sufficient for v1? (Leaning
   root-only v1, per-workspace as `later/` note.)
2. Is `borrows.jsonl` a new surface or a record *type inside* the
   Claims Ledger? (Consolidation vs clean legal-export path.)
3. Free-tier SCANOSS limits: changed-files + verdict cache enough for
   fleet scale, or park a self-host bet as `later/`?
4. Does `origin: uncertain` self-flagging create a perverse incentive
   (over-flagging to route around strict mode)? Counter-design:
   uncertain-flag rate becomes an audited telemetry field with an
   anomaly bound.
5. Should S1.1's self-interrogation clause project to ALL roles or
   exclude planner-mode? `roles:` axis decides; measure the delta.

## Kill criteria / honest-null paths

- **K1** G0 thresholds missed ⇒ no deterministic-gate claim, ever;
  behavioral layer ships alone; null published.
- **K2** SCANOSS API unusable at our cadence (rate limits, latency
  > 60s per PR scan, or instability across 2 weeks) ⇒ L0 demoted to
  on-demand skill (`license-audit`); CI keeps only L-1.
- **K3** Warn-only phase produces > 2 uncontested false positives in
  the first 25 lines ⇒ strict promotion blocked pending normalizer fix
  + fresh 25-line window (ratchet resets, no creep).
- **K4** Phase 5 auto-drops per S5.1. No appeal path; revival requires
  a new roadmap.
- **Global consequence bound**: any published artifact using prohibited
  vocabulary (S3.2) voids the claim and pulls the README section —
  same honest-null consequence culture as the 9.2.0 adversarial
  council thresholds.

## Token/cost budget

- Phases 1–4: deterministic + rules only; agent-side cost ≈ rule
  projection delta (expect < 1k tokens on reviewer role, less
  elsewhere via `roles:` scoping).
- Phase 5 (if alive): capped by existing worker-tier budgets
  (15k/60k/150k); critic runs conditional-trigger only.
- CI wall-clock: L-1 offline ≈ seconds; L0 online ≤ 60s (K2 bound).

## Success shape

A PR that borrows a GPL routine fails `ci` with the source URL, the
license, and the exact policy line that killed it. A PR that borrows an
MIT routine passes only with a ledger entry and lands with NOTICES
updated automatically. A PR whose author renamed variables in copied
code re-hits the scanner and cannot clear without a real rewrite. And
the README says exactly what we measured — nothing more.

## Council review (2026-07-28)

Debate run: 2 members (anthropic/claude-sonnet-4-5, openai/gpt-4o) ×
3 rounds, `--input-mode roadmap`, actual spend $0.20.

### Agreement

- User-facing limitation disclosure must be prominent AND quantified —
  the Anti-thesis buried in a roadmap document is not enough; the
  README must state what is NOT covered and publish the measured
  detection rate (Sonnet R1/R3 "footnote nobody will read", GPT-4o R3
  "clearer parameters and documentation… explicit admissions of what
  remains vulnerable").
- The S1.1 self-interrogation clause is unreliable as a signal — an
  LLM has no introspective access to whether output is recalled or
  derived; it must never be load-bearing (Sonnet R1/R3 "architecturally
  impossible", GPT-4o R1 "variability and unanticipated legal risks",
  R3 "not just self-flagged honesty triggers").
- Approved vocabulary ("provenance-governed") can still mislead users
  into inferring broader protection than exists; the term needs a
  co-located scope statement (Sonnet R1/R3, GPT-4o R3).
- SCANOSS third-party dependency is a real risk axis (GPT-4o R1;
  Sonnet acknowledges KB-subset limitation throughout).

### Clashes

- **Overall verdict** — Sonnet R1/R3: the conscious/unconscious
  borrowing boundary is a category error, partial detection marketed
  as governance is "worse than shipping nothing" (documented false
  assurance). GPT-4o (+ Sonnet's own R2 rebuttal): domain separation
  is architecturally correct — training-data reproduction is the
  model provider's layer; output-layer governance (license policy,
  attribution, detectable-copy prevention) has real standalone value;
  demanding training-data verification is "nihilism dressed as
  principle".
- **The 10/16 recall floor** — Sonnet R3: a 37.5% acceptable miss rate
  within the detectable class calibrates to a false standard. GPT-4o:
  seeded-corpus calibration is standard benchmark practice.

### Blind spots

- The deterministic layer (S2.1) scans ALL changed files regardless of
  declared intent — coverage does not depend on the agent's
  self-report. Neither reviewer credited this; the roadmap under-sold
  it, which is what enabled the "Maginot Line" reading.
  `needs-verification: no — read directly from S2.1 (--changed scope).`
- PR #1028 merge dependency for Phase 2 was not challenged by either
  reviewer; it remains the sequencing constraint.
- Escalation target for `hit+unknown` verdicts ("the human") is
  undefined — which role/surface receives the escalation.
  `needs-verification: yes — host-inferred.`

### Recommendation

Ship the roadmap with the disclosure-and-reliance patches below: keep
the three-layer architecture (the clash resolves in its favor — output
layer is the only governable layer), but make the deterministic layer
the stated primary control, demote self-interrogation to an auxiliary
signal, and move the quantified limitation disclosure into every
user-facing surface that uses the approved vocabulary.

### Kill criteria

- Any published surface uses approved vocabulary without the
  co-located quantified scope statement ⇒ the S3.2 global consequence
  bound fires (claim voided, README section pulled).
- Phase-0 measured recall published as a range/number diverges from
  the README statement ⇒ docs drift, falsifies the disclosure patch.
- `origin: uncertain` flag-rate anomaly bound (Q4) triggers without an
  audit ⇒ self-interrogation signal is retired entirely, not re-tuned.

### Concrete next step

Apply the Host-verdict `accept` patches to this roadmap, then open the
PR that lands roadmap + council trace.

### Predecessor council trace

`agents/runtime/council/responses/road-to-provenance-and-license-governance-roadmap.json/debate-round-{1,2,3}.json` (this run).

### Host verdict

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Quantified user-facing limitation disclosure (README "Scope & limits" box, measured numbers, co-located with approved vocabulary) | `accept` | matches S3.2 gap — Anti-thesis lives only in this roadmap today; no user-facing surface carries it |
| 2 | Self-interrogation must be explicitly non-load-bearing; deterministic scan of ALL changed files is the primary control | `accept` | S2.1 already scans changed files unconditionally; S1.1 wording under-stated this — text fix, no architecture change |
| 3 | Claim text must publish actual measured numbers when backed (recall X/16, FP Y/12), not "measured rate" | `accept-with-modification` | S3.1 already scopes to Phase-0 rate; patch adds number-publication duty at backing time |
| 4 | SCANOSS dependency risk needs elaborated fallback | `reject` | already addressed — K2 demotes L0 to on-demand skill, C2 forbids KB-building, L-1 stays offline |
| 5 | 10/16 floor calibrates to a false standard | `accept-with-modification` | floor stays pre-registered (G0 is a go/no-go gate, not marketed capability); patch clarifies the distinction + README publishes the measured rate per finding 1 |
| 6 | Phase-5 derivation probes risk confabulation | `accept-with-modification` | S5.2 patch: probe answers count as transformation-depth evidence only, never provenance proof |
| 7 | "Worse than shipping nothing" (drop the roadmap) | `reject` | contradicts the converged disclosure remedy; license governance + ledger + detectable-copy gate have standalone value independent of the unconscious-reproduction gap (Sonnet's own R2 rebuttal) |
| 8 | Escalation target for `hit+unknown` undefined | `accept` | blind spot confirmed — S2.1 says "escalate" without naming the surface; patch names the owner |
