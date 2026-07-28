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
6. **~~Rename-only is not transformation~~ — REFUTED BY MEASUREMENT
   2026-07-28.** Original claim: *"Winnowing normalizes away
   identifiers/whitespace by construction — a snippet hit cannot be cleared
   by renaming variables."* Measured on the frozen corpus: SCANOSS
   rename-only recall **0/8**, jscpd **4/8**. Neither layer delivers the
   guarantee, and 4/8 actively disproves "by construction" (a
   construction-level property scores 8/8). Council 2026-07-28 rejected
   re-founding the same *architectural* claim on policy ("conceptual
   malpractice — you cannot replace a tool property with an aspiration").
   **Honest replacement:** rename-only laundering is NOT detectable by our
   layers, so *the ledger is the anti-launder control*, not a backstop to
   one. Clearing requires (a) structural re-derivation a human reviewer
   confirms, or (b) an attributed ledger entry whose transformation_note
   survives `lint_provenance`'s rename-only phrase rejection. The tooling
   records and checks the *record*; it does not detect the laundering.
   Nothing in this package may claim otherwise.
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

- [x] **S0.1 Build `internal/bench/provenance/` golden corpus**:
  24 seeded-copy samples (real snippets from permissive MIT/Apache/BSD
  and copyleft GPL/AGPL repos, eight per transformation depth — four TS
  + four PHP each: verbatim / rename-only / structural-rewrite) + 12
  independent samples (same tasks solved in-house before seeing the
  source — striking-similarity control, LiCoEval-style). Seeded-copy
  samples live only in `internal/` (never shipped in the npm package),
  each with source URL + license recorded — the corpus practices what
  it enforces.
  *Verify:* corpus README lists all 36 samples with source URL +
  license per seeded sample; npm pack output contains none of them.
  <!-- done 2026-07-28 (sonnet subagent + verified: 36 samples, 8 per
  depth, 18 TS / 18 PHP, 13/13 tests green). DOCUMENTED DEVIATION with a
  load-bearing consequence: samples are `synthetic-canonical` —
  independently authored implementations of widely-known algorithm shapes
  (debounce, LRU, Levenshtein, topo-sort, semver, backoff, deep-merge,
  binary-insert + 4 FP-only extras), NEVER fetched or pasted from any
  upstream file, so the corpus itself carries zero third-party license
  exposure and practices what the roadmap enforces. CONSEQUENCE the G0
  verdict must carry: a synthetic corpus can measure transformation-depth
  sensitivity and the false-positive rate on independently authored code,
  but it CANNOT measure L0 recall against SCANOSS's real-OSS KB — none of
  these snippets are indexed anywhere, so a KB lookup would return zero
  hits for reasons that say nothing about the detector. Measuring real-KB
  recall needs a second, real-snippet corpus. npm-pack exclusion asserted
  via the package.json `files` allowlist (a live `npm pack --dry-run`
  triggers the repo's prepack build chain — not a deterministic per-test
  check); documented in the README + test header -->`
  <!-- fix 2026-07-28 (pre-S0.2-freeze, reviewer-found denominator bug):
  the merged draft said 12 seeded / "three per transformation depth" —
  arithmetically inconsistent with every threshold (S0.2 ≥10/16 needs a
  16-sample verbatim+rename subset; 12 seeded caps it at 8; 3×3 ≠ 12).
  Corpus enlarged to 24 seeded (8/depth) so 10/16 parses; S5.1 rebased
  ratio-preserving to 21/24 (87.5%). More samples per depth also makes
  the G0 gate statistically steadier — one-time corpus cost -->`
- [x] **S0.2 Pre-register acceptance thresholds in `docs/CLAIMS.md`
  BEFORE any scanner runs** (SHA-freeze the corpus — implements the
  Critic-prompt-freeze gap recorded in the quality-stack review):
  detector recall on verbatim+rename-only seeded copies ≥ 10/16 (the
  16 = 8 verbatim + 8 rename-only samples of the 24-seeded corpus);
  false positives on independent samples ≤ 1/12. The floor is a GO/NO-GO
  gate for building the CI layer — it is never the marketed
  capability; the marketed capability is the actual measured rate,
  published per S3.1/S3.3 (council patch 2026-07-28).
  *Verify:* CLAIMS.md entry carries the corpus tree-SHA; entry commit
  predates the first baseline-run commit.
  <!-- done 2026-07-28: claim `provenance-detector-transformation-sensitivity`
  registered unbacked, corpus frozen at content-sha256 dbbc84a7…34bb3 over
  internal/bench/provenance/ (36 files); four thresholds fixed BEFORE any
  scanner ran (>=10/16 verbatim+rename recall, <=1/12 FP on the independent
  controls, rename-only MUST hit per principle 6, structural-rewrite recall
  feeds the Phase-5 >=21/24 drop gate) + K1 honest-null consequence. The
  claim carries the S0.1 scope bound: real-KB recall is explicitly
  unmeasured on a synthetic corpus. check_claims green (38 entries).
  Registration lands in its own commit BEFORE the S0.3 baseline commit —
  the ordering IS the acceptance criterion -->`
- [x] **S0.3 Baseline run**: SCANOSS (online) and jscpd (offline)
  against the frozen corpus; record per-sample results.
  *Verify:* per-sample result table committed under
  `internal/bench/provenance/reports/`.
  <!-- done 2026-07-28: reports/baseline-2026-07-28.md. BOTH layers measured
  for real — scanoss-py 1.54.2 installed during execution, api.osskb.org
  reachable, full 36-file scan in 3s (inside the K2 60s bound, so K2 does NOT
  fire). L-1 jscpd@25 (best FP-clean value of a pre-declared, fully reported
  sweep): v+r 10/16, FP 0/12. L0 scanoss: v+r 4/16, rename-only 0/8, FP 2/12.
  UNION: v+r 12/16, full 18/24, FP 2/12 -->`
- [x] **Gate G0**: thresholds met → Phases 2–3 proceed as designed.
  Thresholds missed → deterministic layer stays a research note,
  Phases 2–3 re-scope to behavioral-only (rules + ledger, no CI gate),
  honest-null published (Team-Mode Δ=0 precedent). No silent threshold
  adjustment.
  *Verify:* gate verdict recorded in CLAIMS.md against the
  pre-registered thresholds.
  <!-- G0 VERDICT 2026-07-28: **THRESHOLDS MISSED** — criterion 2 (FP <= 1/12;
  measured union 2/12) and criterion 3 (rename-only MUST hit; measured union
  4/8, SCANOSS 0/8) both failed. Criterion 1 passed (union 12/16), criterion 4
  did not reach 21/24 (union 18/24) so Phase 5 is NOT auto-dropped. No
  threshold was adjusted. K1 fires: the deterministic layer becomes a research
  note, no deterministic-gate claim is ever made, the behavioural layer ships
  alone. Re-scope shape decided by council debate 2026-07-28 (sonnet-4-5 +
  gpt-4o, 2 rounds) — see § G0 re-scope. Honest null published in
  docs/CLAIMS.md -->`

## Phase 1 — Behavioral layer (rules + skill; zero external deps)

- [x] **S1.1 New rule `code-provenance`** (roles: all; kernel-adjacent):
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
  <!-- done 2026-07-28 (sonnet subagent + verified: skill_linter 428 pass /
  0 fail, validate_frontmatter 428/0, typecheck clean). type: auto, tier 2a,
  roles = all six (council Q5). BUDGET OVERAGE STATED HONESTLY: measured
  1,219 Claude tokens vs the roadmap's aspirational <1k — already trimmed
  from ~1,587; further cuts would drop required content (Iron Law, the
  non-load-bearing self-interrogation rationale, the honest no-backstop
  section) rather than prose fat. Not CI-gated (the hard per-rule cap
  applies to `type: always` kernel rules only), and the rule is role-scoped
  so it does not load for every turn. `enforced_by: ["none"]` — deliberately
  NOT pointing at lint_provenance, which enforces the ledger's record shape,
  not the borrowing discipline; claiming it would overclaim exactly the gap
  G0 exists to name -->`
- [x] **S1.2 License-policy DERIVATION** (Council Q1 RESOLVED
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
  <!-- done 2026-07-28 (sonnet subagent + verified: 50/50 tests, 73/73 with
  the ledger suite, typecheck clean; this repo detects MIT -> permissive,
  workspace_scope=single). Includes the council-resolved Q1 workspace
  escalation: divergent workspace SPDX ids escalate through the SAME
  disagree path, no policy file written. Interpretive calls documented in
  code: SSPL-1.0 as the real SPDX id, the GPL-row AGPL qualifier split
  across GPL-2.0/GPL-3.0 target buckets per FSF one-directional
  compatibility, and unstated matrix cells defaulting to conditional
  (escalate) rather than guessed. Residual coupling flagged by the agent,
  not silently patched: lint_provenance's built-in fallback deny set is
  WIDER (covers -only/-or-later variants) than the emitted top-level deny
  list, so once license-policy.yaml exists the linter narrows — tracked in
  the roadmap's own follow-up note rather than cross-edited -->`
- [x] **S1.3 Provenance ledger**: `docs/THIRD-PARTY-NOTICES.md` +
  machine file `provenance/borrows.jsonl`
  (`{source_url, license, source_sha, borrowed_at, files,
  transformation_note, cleared_by}`) + linter `lint_provenance.ts`:
  every `deny`-class entry fails; every entry missing a
  transformation_note fails. Wired into `ci` immediately — this linter
  checks OUR OWN RECORDS, not fuzzy similarity; strict from day one.
  *Verify:* fixture jsonl with a deny entry fails ci; valid entry
  passes; NOTICES regenerates from jsonl.
  <!-- done 2026-07-28 (sonnet subagent + verified: 23/23 tests, linter exit 0
  on the empty real ledger, task lint-provenance wired into ci + ci-strict,
  enforcement-coverage ratchet holds): provenance/borrows.jsonl (empty) +
  README + schema + docs/THIRD-PARTY-NOTICES.md (generated, honest
  no-borrows line) + lint_provenance.ts strict-from-day-one. Rename-only
  transformation notes are rejected by a 15-phrase deterministic list —
  note that after the G0 finding this ledger discipline is the PRIMARY
  anti-launder control, not a backstop -->`
- [x] **S1.4 Skill family `license-compliance/`** (consumer-facing):
  `license-compliance-borrow-check` (paste URL ⇒ license fetch ⇒ policy verdict ⇒ ledger
  entry draft), `license-compliance-credits` (regenerate NOTICES from jsonl),
  `license-compliance-audit` (run Phase-2 scanners on demand). Descriptions follow
  the contributor-precheck pattern; content passes
  `lint_originality --changed`.
  *Verify:* skills pass lint-skills; borrow-check golden transcript
  produces a valid ledger entry draft.
  <!-- done 2026-07-28 (sonnet subagent + verified): three skills
  license-compliance-{borrow-check,credits,audit} (flat dirs with a shared
  prefix, matching the judge-* family convention where `name` must equal the
  parent dir), each with a trigger-eval set. borrow-check states up front
  that a passing verdict is NOT a copying clearance; audit is now the ONLY
  home of the scan capability post-G0 and carries the measured baseline plus
  its synthetic-corpus scope bound + the mandatory self-match filter from
  the S4.1 exhibit. lint_originality --changed: no overlap >= 40% -->`

## Phase 2 — RE-SCOPED by Gate G0 (behavioural-only; no CI gate)

**G0 missed ⇒ K1 fired.** Council debate 2026-07-28 (claude-sonnet-4-5 +
gpt-4o, 2 rounds) resolved the re-scope to **Option A — K1 literal**: no
`lint_code_provenance.ts` in ANY form, not even advisory. Round 1 split
(A vs an advisory-only B); round 2 converged on A when the alert-fatigue
argument carried and the B-proponent withdrew: at a measured 2/12 (~17%) FP,
roughly one in six clean changes would be flagged, which is above the
empirical threshold where alert response collapses — an advisory annotation
nobody reads is **illusory compliance**, strictly worse than no signal,
because it manufactures the appearance of due diligence. Option C
(L-1-only in CI, since L-1 measured FP 0/12) was rejected as "sophisticated
motivated reasoning": you cannot partition a system that failed on
*principle* grounds by cherry-picking the metric one arm happened to pass,
and L-1's 0/12 came from the same small synthetic corpus that makes its
recall unmeasurable — a statistical accident, not a property to stake a gate
on.

**What Phase 2 therefore is:** the deterministic layer exists ONLY as the
on-demand `license-compliance-audit` skill (S1.4) a human invokes deliberately — where
every hit gets investigated *because* the human asked for it. CI carries
only `lint_provenance.ts` (S1.3), which checks OUR OWN RECORDS and is
unaffected by any of this (it is not a similarity detector).

**Gate-revisit condition (recorded, not open-ended):** a gate may be
proposed again only on real-world FP evidence — the council named
>= 10,000 real internal files with FP <= 1% as the bar. A new roadmap, not
a phase revival.

- [-] **S2.1 `lint_code_provenance.ts`, warn-only, `--strict`
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
  <!-- CANCELLED 2026-07-28 by Gate G0 + council Option A: no CI-facing
  detector is built, in warn-only or advisory form. The scan capability
  lives only in the on-demand license-audit skill. Not deferred — cancelled;
  revival requires the real-world FP evidence named in the phase header -->`
- [x] **S2.2 Clearing protocol** (principle 6): a warn clears only by
  (a) rescan-clean after rewrite or (b) ledger entry referencing the
  hit; `cleared_by` recorded. Rename-only rewrites re-hit by
  construction — pin that property with a golden test so nobody "fixes"
  the normalizer later.
  *Verify:* rename-only golden still hits after clearing attempt;
  structural-rewrite golden clears.
  <!-- RE-FOUNDED 2026-07-28 (principle 6 refuted above): the original verify
  criterion is unachievable — rename-only goldens do NOT reliably re-hit
  (0/8 SCANOSS, 4/8 jscpd), so no golden test can pin a property the tools
  lack. What ships and IS tested: the clearing protocol lives in the LEDGER,
  where it is deterministic — lint_provenance.ts rejects rename-only
  transformation notes via a 15-phrase list, requires a substantive note,
  closes `cleared_by` to rescan|ledger|human, and fails deny-class or
  unknown licenses outright (23/23 tests). The measured rename-only recall
  is published in the baseline report so nobody re-derives the refuted
  guarantee from a tool description -->`
- [-] **S2.3 Telemetry** — additive fields on the existing audit object
  (`schema_version` stays 1, reader-tolerance test like PR #1028):
  `provenance_scan` (ran|skipped|offline), `snippet_hits`,
  `license_class` (allow|conditional|deny|unknown), `ledger_ref`,
  `cleared_by` (rescan|ledger|human), `origin` (reusing the PR #1028
  field).
  *Verify:* old reader parses new lines; schema_version unchanged.
  <!-- CANCELLED 2026-07-28 — decided by applying an existing recorded lock,
  not by fresh deliberation (stated so the method is auditable). The fields
  instrument a CI-facing scan that G0 cancelled: `provenance_scan` /
  `snippet_hits` have no producer left. The meaningful remainder
  (`license_class`, `ledger_ref`, `cleared_by`) is ALREADY carried by the
  ledger record itself, so landing audit fields would create a SECOND record
  of the same facts — which the package's standing no-second-ledger
  discipline forbids (the same lock that governs the lean-init audit-field
  work: one canonical location, never a parallel one). The step's own verify
  criterion ("old reader parses new lines; schema_version unchanged") is only
  reachable by landing fields, so this is a cancellation, not a completion.
  An on-demand invocation counter was considered and rejected as
  instrumentation without a question: nobody has asked how often the audit
  skill runs, and inventing the metric first is the speculative surface this
  package subtracts. Revisit-if: audit-run frequency becomes a real decision
  input -->`
- [-] **S2.4 Strict promotion gate (pre-registered)**: promote to
  `ci-strict` only after ≥ 25 audited PR lines with 0 uncontested false
  positives (lint_spawn_payload evidentiary shape).
  *Verify:* promotion PR cites the 25-line audit window.
  <!-- CANCELLED 2026-07-28: there is nothing to promote — S2.1 was
  cancelled by G0. The promotion machinery would be a gate for a gate that
  does not exist -->`

## Phase 3 — Claims + measurement

- [x] **S3.1 Pre-register `provenance-gate-effectiveness` in
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
  <!-- done 2026-07-28 (sonnet subagent + verified: check_claims green, 39
  entries). CLAIM TEXT REWRITTEN — the roadmap's original wording ("AC's
  provenance gate detects seeded verbatim and rename-only OSS copies…") is
  FALSE after G0: there is no gate and rename-only is not detected. The
  registered claim describes what actually shipped (derived license policy +
  strict own-records ledger linter in CI + the on-demand
  license-compliance-audit skill) and states explicitly what it is NOT: not
  a detection gate, not a certification of absence of copying, not
  rename-only detection. kind: qual (there is no gate rate left to quantify);
  cites the G0 honest null via the sibling
  provenance-detector-transformation-sensitivity entry rather than a
  roadmap path (no-roadmap-references) -->`
- [x] **S3.2 README section under claims discipline**: no
  "copyright-safe" language anywhere, ever. Approved vocabulary:
  "provenance-governed", "license-policy-enforced", "audited borrow
  trail". Banned-phrases list added to the docs linter.
  *Verify:* docs linter fails a fixture containing "copyright-safe".
  <!-- done 2026-07-28: lint_provenance_vocabulary.ts (444 lines, 15 tests)
  bans "copyright-safe" + near variants across README + docs/**, strict from
  day one, wired into ci + ci-strict. A quoted-span exemption mirrors the
  existing banned-phrase carve-out so a doc that CITES the vocabulary as
  documentation (ADR-136 does) is not treated as making the claim -->`
- [x] **S3.3 User-facing "Scope & limits" box (council finding 1)**:
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
  <!-- done 2026-07-28: anchor `<!-- provenance-scope-box -->` + a
  `#### Scope & limits` heading within 5 lines; the box must state
  unconscious-training-data non-detectability, known-OSS-only KB scope, that
  NO CI-facing detection gate exists (the G0 consequence, added beyond the
  roadmap's three required elements), rename-only non-detection, and >=1
  measured N/D figure that must appear verbatim in docs/CLAIMS.md — the
  cross-check the roadmap demanded. Real README section shipped and passes
  the repo's own new linter (exit 0) -->`

## Phase 4 — Dogfood + hygiene (practice before preach)

- [x] **S4.1 Run the full pipeline on `agent-config` itself**; publish
  the result as a proof exhibit regardless of outcome (honest-null
  precedent: a clean run is evidence; a dirty run fixed in public is
  better evidence).
  *Verify:* exhibit committed with scan verdicts per file class.
  <!-- done 2026-07-28: reports/self-audit-2026-07-28.md. HEADLINE FINDING —
  551 of 552 L0 hits on src/scripts are SELF-MATCHES against our own
  published package (npm + golang proxy have indexed our releases): a naive
  L0 gate would have flagged ~74% of src/scripts on day one, all noise. This
  is a THIRD independent argument for the G0 verdict, found after the fact
  and pointing the same way — and it shows the synthetic corpus's 2/12
  UNDERSTATED the real-world FP surface. Self-match filtering by purl/URL
  origin is now mandatory in the on-demand skill. The single genuine
  third-party hit (a secret-detection test fixture matching an MIT package)
  is canonical-pattern convergence, judged in the exhibit rather than
  laundered into a machine clearance. L-1's 14.87% intra-repo duplication is
  the command-per-file convention, not a borrow signal -->`
- [x] **S4.2 REUSE/SPDX headers on `src/`**; `reuse lint` added to
  `ci-strict` once green.
  *Verify:* `reuse lint` green in ci-strict.
  <!-- done 2026-07-28 — **REUSE.toml path globs instead of per-file
  headers**, and the deviation is the point: stamping ~1,700 src/ files (plus
  their generated projections, which would also churn every condensation
  hash) buys ZERO additional compliance over REUSE 3.3's supported glob
  declaration, while producing an unreviewable diff. Measured outcome
  identical: `reuse lint` reports 7102/7102 files with copyright AND license
  information, "compliant with version 3.3". LICENSES/MIT.txt added; task
  `reuse-lint` wired into ci-strict ONLY (it needs the optional `reuse`
  Python tool) and it skips with a notice rather than failing when the tool
  is absent, so an optional dependency never breaks the build -->`
- [x] **S4.3 Fix known ecosystem gaps**: LICENSE file for
  `agent-ide-plugin`; verify `agent-switch` + `data-helpers` NOTICES
  (data-helpers has a recorded license contradiction — resolve under
  S1.3 discipline).
  *Verify:* all three sibling repos carry LICENSE + consistent NOTICES.
  <!-- done 2026-07-28 by live verification (not by editing other repos):
  the roadmap's premise is STALE. agent-ide-plugin carries LICENSE (MIT,
  2026 event4u) and declares MIT in package.json; data-helpers carries
  LICENSE (MIT, 2025-2026) and declares MIT in composer.json — so the
  recorded data-helpers license contradiction is already resolved and both
  gaps are closed. agent-switch is not present locally, so its state is
  unverified and explicitly NOT claimed. Neither sibling has a NOTICES file,
  which is CORRECT under this package's discipline: NOTICES is generated
  from a borrow ledger and neither repo has recorded borrows — a NOTICES
  file with no borrows would be decoration. State recorded in the self-audit
  exhibit; no cross-repo commits made (another repo's history needs its own
  authorization) -->`
- [x] **S4.4 ADR `provenance-governance`** recording the legal-honesty
  boundary (§ Anti-thesis) so future marketing cannot drift past it.
  *Verify:* ADR merged + indexed; cites the banned-vocabulary list.
  <!-- done 2026-07-28: ADR-136-provenance-governance-honesty-boundary.md +
  INDEX row. Records the five decisions (no gate in any form incl. advisory,
  scan lives in the on-demand skill, the ledger IS the anti-launder control
  since principle 6 is refuted, REUSE by glob not by stamping, vocabulary
  boundary linter-enforced) and the five consequences — including the two
  findings that only dogfooding produced: the 551/552 self-match hazard and
  canonical-algorithm convergence producing true-looking false positives.
  review_trigger names the only route back to a gate (>=10k real files at
  FP <=1%). Every rejected alternative is recorded with its reason so future
  marketing cannot drift past the boundary -->`

## Phase 5 — IP-Critic vertical (conditional; sparring-critic unpark)

Gives the parked `later/road-to-sparring-critic-spike.md` its first
concrete non-cosmetic vertical — but ONLY if the deterministic layer
leaves a measurable gap.

- [x] **S5.1 Gap measurement first**: on the Phase-0 corpus the
  structural-rewrite seeded copies define the residual class. If
  deterministic recall on the FULL seeded corpus ≥ 21/24 (87.5% — the
  ratio the merged draft's unreachable "14/16" froze), **DROP this phase**
  (an LLM layer riding on a solved problem = sippenhaft-coupling in
  reverse; record the drop like L2/L3).
  *Verify:* drop-or-proceed verdict recorded against the corpus report.
  <!-- verdict 2026-07-28: full seeded recall = 18/24 (union of both layers),
  BELOW the >=21/24 drop threshold — so the mechanical drop condition does
  NOT fire and a residual class demonstrably exists (6 seeded copies no layer
  detected, incl. 4 of 8 rename-only). BUT Phase 5 is DROPPED anyway on a
  stronger, independent ground: G0 killed the deterministic layer entirely
  (K1), so there is no "solved problem" for an LLM layer to ride on — and
  more decisively, the residual class here is dominated by RENAME-ONLY
  laundering, which an IP-Critic cannot fix either: council finding 6 already
  bounds probe answers to transformation-depth evidence ONLY, never
  provenance proof (a derivation narrative can be confabulated), so a critic
  would produce exactly the unverifiable signal the G0 re-scope just refused
  to ship. Building it would re-create the illusory-compliance failure mode
  one layer up -->`
- [-] **S5.2 If gap confirmed: IP-Critic rubric** for the sparring
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
  <!-- CANCELLED 2026-07-28 per S5.1's verdict: no critic is built. K4 says
  no appeal path; revival requires a new roadmap -->`
- [-] **S5.3 Critic trigger discipline**: runs only on
  `origin: uncertain` flags (S1.1) and residual-class file types —
  never blanket (lean-init token lesson).
  *Verify:* trigger conditions encoded in the dispatch config;
  blanket-run impossible by construction.
  <!-- CANCELLED 2026-07-28: nothing to trigger — S5.2 cancelled -->`

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

## Council questions — ALL RESOLVED (debate 2026-07-28, execution round)

Second debate (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
`--input-mode prompt`) resolved every open question below. Resolutions are
binding for this execution; dissent recorded where it was real.

- **Q1-residual → workspace-license ESCALATION (v1 scope-limiter).** Real
  clash: one member held per-workspace derivation day-one mandatory (root
  Apache-2.0 silently deriving "GPL borrow permitted" while the borrow
  lands in an MIT-published workspace is a latent legal liability that
  surfaces only at external audit — "a compliance incident, not feature
  adoption metrics"); the other held root-only v1 sufficient (YAGNI,
  ship-and-learn). Adopted: the mind-changer the dissenting member itself
  named — an explicit v1 scope-limiter. S1.2 scans declared workspaces for
  their own license declarations; ANY divergence from the root SPDX id
  **escalates** through the existing sources-disagree path (no second
  mechanism, no policy file written); homogeneous or single-workspace repos
  derive root-only as designed. Full per-workspace policy derivation stays
  out of v1 → `later/` note.
- **Q2 → NEW SURFACE (both members, unanimous).** `provenance/borrows.jsonl`
  is structurally incompatible with the prose Claims ledger: forcing them
  together either constrains claims prose to jsonl (killing readability) or
  relaxes the legal records to narrative (killing machine parsability, and
  "license compliance has zero error budget"). Separate surfaces + a
  dedicated strict linter, shared append-only culture.
- **Q3 → changed-files + verdict cache is sufficient; self-host parked
  (both members).** K2 already demotes L0 to on-demand if latency or
  instability bites, and offline always yields an honest partial — so a
  self-host bet is a `later/` note, not v1 scope.
- **Q4 → NO anomaly bound in v1 (converged in round 2).** Round 1 split
  (necessary vs over-engineering); the round-2 rebuttal carried: because
  the flag is non-load-bearing by construction, no gate outcome depends on
  it, so there is nothing to route around — the misuse incentive does not
  exist. Anomaly bounds are a solution to a currently non-existent problem.
  **Revisit-if:** the flag ever becomes load-bearing, OR empirical data
  shows systematic overuse degrading review quality.
- **Q5 → project to ALL roles.** The clause costs ~0 tokens, and a
  planner-mode exclusion buys nothing while creating a hole exactly where
  a planner drafts implementation sketches. Measured projection delta
  stays the budget check.
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
  on-demand skill (`license-compliance-audit`); CI keeps only L-1.
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

Debate run 2026-07-28, members anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 3 rounds, roadmap input mode. Raw response JSONs are
local-only and auto-pruned per the council retention policy — the
convergence, clashes, and host verdict above are the durable record.

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
