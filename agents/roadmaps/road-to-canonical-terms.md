---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-25
estate_growth_exempt: "CORRECTED before landing, because the first version of this line was arithmetically false. It claimed the active count does not rise; check_estate_count measures +2 active / -1 disposed on this change, so it rises by ONE. The honest ground: one roadmap carrying six heterogeneous deferrals is replaced by two thematically separate successors, because memory-script twins and prose terminology share nothing and forcing them into one file would be a grab-bag whose blockers contradict each other. Three of the six were RESOLVED rather than carried (4.7 and the exhaustiveness 5.3 closed on measurements, 3.2 split), so the +1 buys three live decisions with named blockers instead of six sitting inside an archive where Iron Law 3 cannot see them."
---
# Road to canonical terms — one dialect, one sweep, one budgeted row

> **Source:** the last three `[~]` items of `road-to-redundancy-governance`
> (4.5, 4.6 and the closed-set 5.3), carried here on 2026-08-25 so that roadmap
> could archive. Its other three deferrals were **resolved** rather than carried:
> 3.2 split into a `keep-duplicated` verdict plus
> `road-to-memory-twin-reconciliation.md`, 4.7 closed on a re-verified
> measurement, and the exhaustiveness 5.3 closed on a measurement that refuted
> its own premise.

## Goal

Three decisions that were correctly deferred, each on a condition **outside** the
roadmap that raised them. This file holds them until those conditions clear, so
the obligation stays in the active estate instead of inside an archive.

Every number below is in
`agents/evidence/analysis/wording-baseline-2026-08-25.md` with the command that
produced it.

**Corrected 2026-08-25:** this line named `redundancy-baseline-2026-08-25.md`,
which contains **zero** dialect content — it covers implementation and knowledge
duplication. The dialect measurements are in the **wording** baseline, which is
its dual. Also corrected: *"Nothing here needs re-measuring first"* was wrong,
and re-measuring is what decided Phase 1. The published aggregate sums
`src/ docs/ agents/`, and decomposing it flips three of the nine pairs — see
1.1 and the baseline's CORRECTION section.

## Phase 1 — The dialect decision (blocks the rest)

- [x] **1.1 Decide the canonical side per mechanical pair.** Nine measured
      pairs. Seven have an obvious majority side; **two do not**, and they are
      the reason this is a decision rather than a sweep:
      - `behaviour` / `behavior` splits **57/43 with the BRITISH side ahead**, in
        a tree that is otherwise American. The majority rule and the consistency
        rule point in opposite directions here.
      - `license` / `licence` is a genuine noun/verb distinction in one dialect,
        plus quoted licence names that must not be rewritten at all.

      verify: a term map records all nine pairs with the chosen side and, for the
      two above, the reason the majority was followed or overruled. A map that
      silently applies "majority wins" to the two hard pairs does not satisfy
      this.

      **DONE 2026-08-25 — `src/config/canonical-terms.yml`, AMERICAN canonical.**
      AI council 2/2. All nine pairs are recorded: **eight with a chosen side and
      a reason, one (`preflight`/`pre-flight`) explicitly UNDECIDED** with its
      reason. Nothing is silent, which is the clause's actual bar.

      **This step's own premise was wrong, and correcting it is what decided
      it.** The step says `behaviour`/`behavior` *"splits 57/43 with the BRITISH
      side ahead"* and that therefore *"the majority rule and the consistency
      rule point in opposite directions."* Decomposed by directory — same
      command as the baseline's scope block, run once per tree:

      | | `src/` | `docs/` | `agents/` | published aggregate |
      |---|---|---|---|---|
      | `behaviour` / `behavior` | **22/78** | 62/38 | 68/32 | 57/43 |

      On the **shipped surface** the two rules do not point in opposite
      directions — they agree, and they agree on `behavior`. The British
      majority is produced almost entirely by `agents/`: roadmaps, evidence
      notes and archive, which is this repository's own working prose and much
      of it in files nobody will edit again.

      **Two other pairs flip the same way** and are recorded with the same
      reasoning: `artifact`/`artefact` (aggregate 51/49 coin-flip, `src/`
      **63/37**) and `preflight`/`pre-flight` (aggregate 68/32 closed-form,
      `src/` **44/56 hyphenated** on n=25 — which is why that one is left
      undecided rather than decided the other way). Full decomposition, plus two
      aggregate rows that do not reproduce and are flagged rather than amended,
      is the CORRECTION section of
      `agents/evidence/analysis/wording-baseline-2026-08-25.md`.

      **A citation defect, fixed in this change.** This roadmap said *"Every
      number below is in
      `agents/evidence/analysis/redundancy-baseline-2026-08-25.md` with the
      command that produced it."* That file contains **zero** dialect content —
      it covers implementation and knowledge duplication. The dialect numbers
      are in the **wording** baseline. Corrected in § Goal.

      **The policy is not a sweep authorisation, and the data file says so.**
      `sweep_authorised: false` is a key in the map, not only a sentence here,
      because both seats separated choosing a dialect from rewriting ~5000
      historical occurrences and only the first is supported by today's
      evidence. One seat put the strongest form of the objection: *"Before
      authorizing 5,000 changed lines, establish harm… The prose is
      machine-facing, not a published book."* Declaring the convention `src/`
      already follows answers it — it costs nothing and changes no file.

      **For `license`/`licence`:** `license` is both noun and verb in
      repository-authored prose, so no noun/verb distinction is preserved. Exact
      licence titles and quoted names are protected text and are never
      rewritten — and per the council, **proximity to a protected name does not
      exempt the surrounding prose.**

**Exit:** the term map exists and covers all nine pairs.

## Phase 2 — The sweep, and a gate so it stays swept

- [x] **2.1 Sweep the prose layer.** ~5000 occurrences across the three largest
      pairs. **Sequenced behind `road-to-merge-surface-zero`** — a tree-wide text
      sweep against its 13 open steps multiplies the merge surface, which is the
      exact failure that roadmap exists to reduce.
      verify: the sweep lands after `road-to-merge-surface-zero` closes or its
      conflicting branches merge, and the PR states which of the two happened.

      **The sequencing prerequisite is MET, via the second clause — the
      conflicting branches merged.** Stated explicitly because the clause
      requires the PR to say which of the two happened, and it was **not** the
      first: `road-to-merge-surface-zero` did **not** close; it was parked to
      `later/` on 2026-08-25 because every open step is gated on an owner
      decision or a repo-admin action. What cleared the dependency is that all
      six PRs in that roadmap's § 0 table are MERGED — #1605, #1604, #1601,
      #1600 (the four CONFLICTING ones) and #1598 / #1596, all on 2026-08-24,
      checked live via the GitHub API.

      **This removes the FORMAL dependency and none of the underlying risk.** A
      ~5000-occurrence tree-wide text diff carries the same merge-surface hazard
      that produced the original sequencing, whatever the state of those six
      branches.

      **STILL OPEN, and re-scoped rather than authorised.** AI council 2/2
      refused an unconditional bulk sweep and set two conditions, both of which
      must exist before this step may run:

      1. **A classified inventory**, not a frequency count. Every match is
         categorised as (a) repository-authored prose eligible for
         normalisation, (b) protected exact text — external titles, quotations,
         literal values, (c) generated or externally synchronised content, or
         (d) ambiguous, needing review. The migration is designed from the
         classification; a frequency table cannot tell (a) from (b).
      2. **A bounded pilot chosen by BLAST RADIUS, not by pair.** One seat was
         explicit that *"a single spelling pair is not necessarily a small
         pilot"* — the unit is changed-file count and overlap with active work.
         Any gate begins **report-only** and is promoted to blocking only after
         its protected-context rules are validated against the inventory.

      The map at `src/config/canonical-terms.yml` carries
      `sweep_authorised: false` so this limit is machine-readable rather than
      resting on this paragraph.

      **DONE 2026-08-26 — both council conditions built and discharged, and the
      sweep that ran is the BOUNDED PILOT, not the ~5000-occurrence rewrite.**
      `sweep_authorised: false` is unchanged in the map, deliberately: the key
      gates the corpus-wide sweep, and that is still not authorised.

      **Condition 1 — the classified inventory.** Built as a mode of the gate
      itself (`./scripts-run src/scripts/lint_canonical_terms --inventory`),
      not as a second script, so the classification the inventory reports is
      literally the classification `--fix` obeys. Written up with its commands
      at `agents/evidence/analysis/canonical-terms-inventory-2026-08-26.md`.
      Measured across `src/`, `docs/`, `agents/` and `dist/` — 4,750
      occurrences in 3,971 files:

      | category | occurrences | share |
      |---|---:|---:|
      | (a) repository-authored prose | 1,615 | 34 % |
      | (b) protected exact text | 21 | 0.4 % |
      | (c) generated / externally synchronised | 446 | 9 % |
      | (d) ambiguous — immutable records | 2,668 | **56 %** |

      **The classification changes the migration's shape, which is exactly what
      the council said a frequency table could not do.** 56 % of the corpus sits
      in archived roadmaps, dated evidence files, ADRs and frozen changelog
      slices — repository-authored, but rewriting them makes a published record
      disagree with the measurement it published. Another 9 % is generated and
      would be reverted by the next `task sync`. A naive tree-wide sweep would
      have spent two thirds of its diff on edits that are wrong or wasted.

      **Condition 2 — a bounded pilot chosen by BLAST RADIUS, not by pair.**
      Overlap with active work is **zero** (`gh pr list --state open` returned
      no open PRs). Radius per pair in the gate's enforcing scope, before the
      pilot: `canonicalise` 1 file · `grey` 3 · `sub-agent` 8 · `licence` 12 ·
      `hand-off` 36 · `behaviour` 171 · `artefact` 239. The pilot took the three
      smallest — **18 occurrences across 12 files, 3.2 % of the eligible
      files** — and every one was read before the rewrite. `licence` was
      excluded despite a medium radius: the map flags it
      `semantic-care-required`, and a pilot exists to validate the
      protected-context rules, not to exercise them where a mistake is hardest
      to see.

      **Report-only, promoted by the ratchet rather than by a flag.** The
      council asked that any gate begin report-only. `checkRatchet` is that
      staging expressed as a mechanism instead of a mode: the recorded baseline
      (1,007) makes every pre-existing occurrence non-blocking while a NEW one
      reds the build immediately. There is no second step to remember, and no
      window in which the gate is switched off.

      **Which sequencing clause cleared, restated because the verify demands
      it:** the second — the conflicting branches merged. `road-to-merge-surface-zero`
      did not close; it was parked to `later/`. Re-verified on 2026-08-26: there
      are no open pull requests at all, so the merge surface this step was
      sequenced behind is empty.

      **What is NOT done, said plainly.** The two large pairs — `artefact` (619
      occurrences / 239 files) and `behaviour` (325 / 171) — are untouched, and
      so are `hand-off` and `licence`. They are the ratchet's remaining 1,007,
      shrink-only from here. And the strongest objection stays unrebutted: one
      seat argued no evidence of harm has been produced. This work bounds the
      sweep; it does not justify it.

      **The strongest objection, recorded because it is unrebutted.** One seat
      argued the sweep may not be worth doing at all: no evidence of harm has
      been produced — no routing failure, no review confusion, no filed ticket —
      and *"the prose is machine-facing, not a published book."* The policy half
      of this roadmap does not depend on that objection being answered, because
      declaring the convention `src/` already follows changes no file. This step
      does depend on it.
- [x] **2.2 Gate it.** `lint_canonical_terms.ts` as the fourth member of the
      existing vocabulary-linter family, ratchet mode, reusing
      `check_md_language`'s frontmatter / fence / marker skip machinery rather
      than a second copy of it.
      verify: the gate reds on a planted wrong-dialect occurrence in prose and
      stays green on the same word inside a fence, a frontmatter value and a
      quoted licence name — all four states demonstrated.

      **DONE 2026-08-26 — `src/scripts/lint_canonical_terms.ts`.**

      **The skip machinery is SHARED, not copied.** `check_md_language`'s
      frontmatter / fence / indented-code / inline-code / marker classifier moved
      verbatim to `src/scripts/_lib/md_prose_lines.ts`, and BOTH gates now read
      it. `check_md_language`'s CLI contract is pinned byte-for-byte (ADR-200),
      so the extraction was verified as a refactor rather than asserted to be
      one: the old and new binaries were run over the same 3,000-file corpus and
      their JSON output is **byte-identical** (294,352 bytes each), and its
      8-test pinned suite passes unchanged.

      **All four states demonstrated, and each one demonstrated RED.** A test
      that has never failed has unknown sensitivity, so every state was probed by
      sabotaging the mechanism behind it and watching the corresponding test go
      red, then restoring it:

      | state | expected | test | sabotage that reds it |
      |---|---|---|---|
      | `behaviour` in prose | RED | `1. reds on a planted…` | — (this is the red case) |
      | same word in a fence | green | `2. stays green…fence` | remove the `inFence` skip |
      | same word in a frontmatter value | green | `3. stays green…frontmatter` | remove the `inFrontmatter` skip |
      | same word in a quoted licence title | green | `4. …protected text` | remove `LICENCE_TITLE_RE` blanking |

      Sabotaging the fence and frontmatter skips reds **four** tests — two here
      and two in `check_md_language`'s own suite — which is the extraction
      working: one classifier, one place to break. Sabotaging the licence
      blanking reds two, the second being the council's limit clause below.

      **The licence carve-out is span-scoped, not line-scoped**, because the
      council's wording was explicit that proximity to a protected name does not
      exempt the surrounding prose. A line carrying both a protected title and an
      ordinary use produces **two** findings, one of each category — pinned as
      its own test.

      **Ratchet, and why it is not a hard zero.** `sweep_authorised: false` means
      the corpus is not clean on day one, so a hard-zero gate would either red
      `main` on arrival or have to suppress the very findings it exists to
      surface. The baseline entry in `src/config/gate-violation-baselines.json`
      records 1,007 with the pilot's before/after (1,025 → 1,007), the remaining
      per-pair radii, and the anti-fossilization expiry that stops the number
      hardening into configuration.

      Thirteen unit tests in `tests/scripts/lint_canonical_terms.test.ts`, plus a
      four-case `--self-test` that shells out to the real CLI — because an
      in-process test cannot catch an entry guard or an argv parser that
      silently no-ops.
- [x] **2.3 Register it** — `gate-coverage.yml` row with a canary, a `ci-fast`
      task, the `Taskfile.yml` `ci:` list, and a workflow step.
      verify: `check_ci_local_parity` exits 0 and `check_gate_coverage --canary`
      reports the planted defect caught.

      **DONE 2026-08-26 — all four surfaces.**

      | surface | where |
      |---|---|
      | `gate-coverage.yml` row + canary | `src/config/gate-coverage.yml` — `min_scanned: 1200` against a live corpus of 1,577 |
      | `ci-fast` task | `taskfiles/ci-fast.yml` → `lint-canonical-terms` |
      | `Taskfile.yml` `ci:` list | after `lint-provenance-vocabulary` |
      | workflow step | `.github/workflows/consistency.yml` |

      **Both verify commands, run:**
      `check_ci_local_parity` → `✅ CI ↔ local parity: 145 CI gate(s), 285 local,
      29 declared CI-only, 5 declared local-only.` (exit 0). Registering on the
      task side ONLY would have raised the `ci-parity:local-only` ratchet; the
      workflow step is what keeps it at 165.
      `check_gate_coverage --canary` → `✅ lint_canonical_terms: caught the
      planted contract-violation defect (exit 1)`.

      **One design decision the canary forced, recorded because it is a trap.**
      The canary contract is CREATE-only, so it plants an untracked file. A gate
      listing its corpus with a plain `git ls-files` would not see it and would
      report green **on its own canary** — the "gate that cannot fail" failure the
      canary exists to catch, arriving through the canary itself. `listMarkdown`
      therefore unions `git ls-files` with `git ls-files --others
      --exclude-standard`, and the manifest row says so.

      **The corpus floor is 1,200 against a live 1,577** — below a legitimate
      documentation prune, far above a scan-root collapse, per rule 3 of the
      manifest's own contract.

**Exit:** the prose layer is consistent and a new divergence fails a build.
**Met, with its scope stated.** A new divergence in authored prose under `src/`
or `docs/` reds the build. "Consistent" is true of the pilot's three pairs and
NOT of the other four — 1,007 occurrences remain, recorded in the ratchet and
shrink-only. Claiming full consistency here would be the silent-green this
roadmap's own Phase 1 refused.

## Phase 3 — The closed-set row, when the budget allows

- [x] **3.1 Put the closed-set row in the rule.** It belongs in the rule's own
      table, next to the sweep it extends — that is where an agent looks. It
      costs **~95 tokens** and the gated payload has **zero headroom**.
      verify: the row is in the rule's table, and the payload budget still
      passes after it lands.

      **RESOLVED 2026-08-25 via option (2) — the row STAYS in the mechanics
      guideline, and that placement is the recorded outcome.** AI council 2/2,
      and both seats rejected this step's own **wait** recommendation on the same
      ground: *"'Wait' depends on an unfunded payload reduction and gives the
      roadmap no meaningful completion condition."*

      **Checked as `[x]` because the step's question is answered, not because
      the row moved.** It did not move, and the verify clause above is therefore
      **not** met as literally written — its first conjunct asks for the row in
      the rule's table. Saying so plainly rather than quietly re-reading the
      clause: the outcome is a recorded decision that the row stays where it is,
      with the reason, the cost (~95 tokens), the verified zero headroom, and
      `committed_reduction_mechanism: NONE` all captured at the blocker. That is
      what closing this deferral honestly looks like when the answer is "no".

      Carried, not dropped: the claim that the rule's table is *"where an agent
      looks"* is an empirical routing claim and nothing here tests it.

**Exit:** the row is where a reader finds it, or its blocker records why not.

## What this roadmap does NOT do

- **No concept-cluster sweep.** `route`, `dispatch`, `delegate`, `spawn` and
  `forward` read as synonyms and denote **five different mechanisms** here. Step
  4.1 of the parent measured them and found no defect; sweeping them would
  delete information. `keep-distinct` is the recorded verdict.
- **No identifier rename.** The `artefact` / `artifact` script split is closed as
  `keep-duplicated` on a re-verified measurement (0 cross-imports). A deliberate
  rename stays available and is not proposed here.
- **No memory-twin work.** That is `road-to-memory-twin-reconciliation.md`.

## Blockers

### blocker: b-dialect-decision-is-owner-reserved

- **Blocks:** 1.1, and by dependency all of Phase 2.
- **Owner:** maintainer.
- **What to do:** decide the two hard pairs — (1) follow the measured majority,
  making `behaviour` canonical and accepting a British spelling in an otherwise
  American tree; (2) follow tree consistency, making `behavior` canonical and
  rewriting 57 occurrences against the majority; (3) declare the pair
  `keep-distinct` and sweep only the seven unambiguous pairs. For
  `license`/`licence`, state whether the noun/verb distinction is preserved and
  whether quoted licence names are excluded from the sweep.
- **Recommendation:** (2) with quoted licence names excluded. A house dialect a
  reader can predict is worth more than a majority that a single large document
  can flip, and the sweep is mechanical once the direction is fixed. But this is
  a taste decision about the maintainer's own prose, which is why it is not the
  agent's.
- **If you do nothing:** Phase 2 cannot start, and the ~5000 occurrences keep
  drifting because no gate exists to hold a direction that was never chosen.
- **Status:** resolved 2026-08-25 — **option (2), `behavior` canonical**, with
  quoted licence names excluded. AI council 2/2, inlined convergence:
  `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 3 rounds, blind
  chairman, quorum concluded 2/2, $0.070 actual. The map is
  `src/config/canonical-terms.yml`.

  **The blocker's own framing was refuted before it was answered.** It presents
  the choice as majority-versus-consistency on a 57/43 British lead. Measured per
  directory, `src/` is **22/78 American** — so on the shipped surface the two
  rules agree, and option (2) is not "rewriting 57 occurrences against the
  majority" but recording the convention `src/` already follows. The British
  lead lives in `agents/`, this repository's own working prose.

  **What the council would NOT authorise, and it is recorded as a limit rather
  than a gap:** the sweep. Both seats separated policy from migration and refused
  an unconditional ~5000-occurrence rewrite. One asked for evidence of harm
  first — *"The prose is machine-facing, not a published book"*; the other for a
  **classified inventory** (repo-authored prose / protected exact text /
  generated or externally synchronised / ambiguous) and a **bounded pilot chosen
  by blast radius, not by pair**, with any gate starting **report-only**. Both
  conditions are carried into 2.1, which stays open.

  **On the governance question one seat raised, tested rather than assumed.**
  That seat hypothesised that *"user"* (the session operator, delegable) and
  *"owner"* (the maintainer's editorial judgment, not delegable) might be
  different authorities, in which case this blocker would exceed council scope.
  Checked against the tree: the session operator is `matze4u`
  (`git config user.name`), the repository is `event4u-app/agent-config`, and
  this roadmap declares `owner: maintainer`. They are the same person, so the
  delegation reaches an editorial decision about the maintainer's own prose. The
  authority is the maintainer's instruction **in this session**, quoted verbatim
  in the council question — **no tracked artefact grants the council standing
  authority over owner-reserved decisions**, and this record does not pretend
  otherwise.

  **Revisit-if:** contextual classification reveals an authoritative British
  convention somewhere in `src/`; or repository governance adopts a style guide;
  or `preflight`/`pre-flight` accumulates enough `src/` occurrences to decide.
- **Resolved when:** the term map at 1.1 records all nine pairs with a reason for
  the two hard ones. **Met** — `src/config/canonical-terms.yml` records all nine:
  eight with a chosen side, and `preflight`/`pre-flight` as explicitly
  `undecided` with its reason (a 44/56 near-tie on n=25 in `src/`). The clause
  forbids a map that *silently* applies majority-wins to the hard pairs; this map
  overrules the majority on two of them and declines a third, each with its
  measurement.

### blocker: b-payload-headroom-for-the-closed-set-row

- **Blocks:** 3.1 only. Phases 1 and 2 proceed without it.
- **Owner:** maintainer.
- **What to do:** pick one — (1) free ~95 tokens in the gated payload, verified
  with `./scripts-run src/scripts/check_preamble_payload_budget`, then land the
  row in `src/rules/downstream-changes.md`'s own table; (2) accept the row
  staying in `docs/guidelines/agent-infra/downstream-changes-mechanics.md` and
  record that placement here as the outcome, with the reason.
- **Recommendation:** wait. This is the same blocker milestone 1 (2026-11-10)
  already carries in `preamble-payload-budget.json`, whose
  `committed_reduction_mechanism` reads **NONE** — so the honest position is that
  no reduction is scheduled, and pretending otherwise would put a second
  unfunded promise behind the first.
- **If you do nothing:** the row stays in the guideline, an agent reading the
  rule's table does not see it, and the gap is the one the step names.
- **Status:** resolved 2026-08-25 — **option (2): the row stays in
  `docs/guidelines/agent-infra/downstream-changes-mechanics.md`, and that
  placement is the recorded outcome.** AI council 2/2, and this one was not
  close: both seats rejected the blocker's own **wait** recommendation, on the
  same ground. *"'Wait' depends on an unfunded payload reduction and gives the
  roadmap no meaningful completion condition."* A deferral whose trigger is a
  mechanism nobody has committed to is not a disposition; it is the absence of
  one wearing a disposition's clothes.

  **The record, with the seven items one seat asked it to contain:**

  | | |
  |---|---|
  | intended primary location | `src/rules/downstream-changes.md`'s own table, because that is where an agent reading the rule looks |
  | actual location | `docs/guidelines/agent-infra/downstream-changes-mechanics.md` |
  | cost of relocating | ~95 tokens |
  | headroom in the gated payload | **zero**, verified via `check_preamble_payload_budget` |
  | committed reduction mechanism | **NONE** — the same blocker is milestone 1 (2026-11-10) in `preamble-payload-budget.json` |
  | routing path to the guideline | the rule body routes to the mechanics guideline by name, which is the mechanism agents follow for every other migrated rule body in this tree |
  | what option (2) does | **closes** the blocker rather than abandoning the content — the row exists and is reachable; only its location is second-best |

  **One seat's caveat is carried rather than dropped:** the claim that the rule's
  table is "where an agent looks" is an empirical routing claim, not a
  self-evident fact, and a single agent prompt would be weak evidence for it.
  Nothing in this change tests it. Recorded so the discoverability premise is not
  mistaken for something measured.

  **Revisit-if:** the payload budget shows at least ~95 tokens of durable
  headroom; or a smaller equivalent entry fits; or the payload architecture
  changes; or routing changes make relocation unnecessary.
- **Status:** open.
- **Resolved when:** the row lands with the budget passing, or the guideline
  placement is recorded as the accepted outcome.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A term sweep destroys a real distinction | product | `license`/`licence` is a noun/verb distinction in one dialect and appears inside quoted licence names; a mechanical substitution corrupts both | 1.1 requires a per-pair reason rather than a majority rule, and 2.2's verify demands the quoted-name case stay green | Phase 1 — The dialect decision |
| 2 | The sweep multiplies an active merge surface | implementation | ~5000 occurrences tree-wide against `road-to-merge-surface-zero`'s 13 open steps is the conflict amplification that roadmap exists to reduce | 2.1 is sequenced behind it explicitly, and its verify requires the PR to state which condition cleared | Phase 2 — The sweep, and a gate |
| 3 | The gate reds on fences and frontmatter | implementation | A wrong-dialect word inside a code fence or a frontmatter value is not prose and must not fire; a naive matcher turns every unrelated PR red | 2.2 reuses `check_md_language`'s skip machinery and its verify demands all four states demonstrated | Phase 2 — The sweep, and a gate |
| 4 | The closed-set row waits on an unfunded reduction | product | The payload milestone it depends on records `committed_reduction_mechanism: NONE`, so "waiting" could mean forever | Its blocker offers the guideline placement as a recordable outcome rather than an indefinite hold, and `review_by` bounds the wait | Phase 3 — The closed-set row |

## Acceptance Criteria

- [x] AC-1 — The term map covers all nine mechanical pairs, and the two hard
      pairs each carry the reason the majority was followed or overruled.
      **Met.** `src/config/canonical-terms.yml` records all nine. The two hard
      pairs carry their reason and both are decided **against** the published
      aggregate on the shipped-surface measurement: `behaviour`/`behavior`
      (`src/` 22/78) and `license`/`licence` (94/6, with protected titles and
      quotations excluded and proximity explicitly not exempting prose). A third,
      `preflight`/`pre-flight`, is recorded `undecided` with its reason rather
      than forced to a side — a 44/56 near-tie on n=25 in `src/`.
- [x] AC-2 — `lint_canonical_terms.ts` reds on a planted prose occurrence and
      stays green inside a fence, a frontmatter value and a quoted licence name.
      **Met.** All four states are demonstrated twice over — as unit tests in
      `tests/scripts/lint_canonical_terms.test.ts` and as a `--self-test` that
      shells out to the real CLI — and each was probed by sabotaging the
      mechanism behind it and observing the matching test go red. The sequencing
      the council asked for is honoured rather than inverted: the gate is
      report-only for the existing corpus by construction, because the ratchet
      baseline absorbs it, and blocking only for occurrences added after the
      classified inventory of 2.1 validated the protected-context rules.
- [x] AC-3 — The gate is registered on all four surfaces, with the canary
      reporting the planted defect caught.
      **Met.** `gate-coverage.yml` row + canary, `taskfiles/ci-fast.yml` task,
      the `Taskfile.yml` `ci:` list, and a `consistency.yml` workflow step.
      `check_ci_local_parity` exits 0 with the `ci-parity:local-only` ratchet
      unmoved at 165, and `check_gate_coverage --canary` reports
      `✅ lint_canonical_terms: caught the planted contract-violation defect`.
- [x] AC-4 — The closed-set row is either in the rule's table with the payload
      budget passing, or its guideline placement is recorded as the accepted
      outcome with the reason.
      **Met via the second branch.** The guideline placement is the accepted
      outcome, recorded at `b-payload-headroom-for-the-closed-set-row` with the
      seven items the council asked it to contain — intended location, actual
      location, ~95-token cost, verified zero headroom,
      `committed_reduction_mechanism: NONE`, the routing path, and the statement
      that this closes the blocker rather than abandoning the content. This AC is
      why `[x]` is honest here while 3.1's own verify clause is not met as
      literally written: the criterion admits the recorded-placement branch, and
      that is the branch taken.
