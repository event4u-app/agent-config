---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
---

# Road to mixed-trigger activation cost — the 12.0→12.1 behaviour regression, found and priced

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-mixed-trigger-activation-cost.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`. The draft's status line said PROPOSAL and its IDs
> were proposal IDs; § 1 below records which of its claims survived verification,
> which were overtaken, and the one that is refuted as written.

> **Arrivals:** the delivery/`eager-all` subject appears in **19** consumed inbox
> rounds under `agents/tmp.old/` (measured 2026-09-06, `grep -rl "eager-all"`,
> distinct round directories); `lean_projection` in **18**. Latest
> `inbox-2026-09-r`, which proposed a delivery roadmap whose own decision packet
> already exists. The figure counts rounds that RAISE the subject, not rounds
> that demand this roadmap specifically — it is a floor on the recurrence, not
> a count of asks. Written here so the next round meets a number.

> **Blocked until:** the host exposes an `InstructionsLoaded` observer that a
> session can read (step 3.3's instrument; absent from the 2.1.229 binary's token
> extraction, so building against it today would be designing on an assumption).
> **The other open step is not this one's dependency, and is recorded here so the
> conjunction stays out of the resume line:** step 2.3's just-in-time carrier
> waits on `road-to-cost-parity-1-rule-payload-diet`'s per-rule norm-line lint and
> on `road-to-per-turn-hook-economy` step 5.1 — two siblings, both open. Steps
> 3.1/3.2 additionally wait on blocker `b-behavioural-bench-spend`.
> **The repair already shipped**, which is why this is `later/` and not a live
> defect: Phase 2 restored `paths:` on the two path-dominant rules
> (−3,929 exact-BPE tokens, −3.7 %) and Phase 4's census ratchet is in. What
> remains is measurement plus one additive carrier owned elsewhere.
> **Parked** 2026-08-19 by `road-to-estate-drawdown` Phase 2 batch 1, verdict
> PARK-PROBEABLE.

> **Why this roadmap exists.** A colleague reported that the package "ran well and
> above all fast before 12.\*" and that "since the 12.1.\* release it has problems
> with rules and skills again and is slow". The dispatcher-latency hypothesis is a
> measured honest null (11.0.0 ≙ 13.0.0 on all four hot slots — see
> `road-to-per-turn-hook-economy` § 3). The mechanism that *does* reproduce in
> that exact window is rule activation, and it is behavioural, not latency:
> nineteen obligation-dense rules stopped being file-scoped and started loading in
> every session.

---

## 0. The defect, stated first

Commit `33c7c20` ("stop scoping from silently deleting a rule's keyword reach",
first containing tag **12.1.0**) added a mixed-triggers guard to
`_claude_paths_plan`: a rule carrying keyword or phrase triggers *in addition to*
path triggers now gets **no `paths:` frontmatter at all**, and therefore loads
**unconditionally on Claude Code**.

At `origin/main` the split is exact: **25** rules in `src/rules/` declare a
path-shaped trigger (`file_pattern` / `path_prefix`), **19** of those also declare
a keyword or phrase trigger, and the remaining **6** carry none — matching the
commit message's own "Scoped rules 25 → 6, and the six that remain carry zero
keyword triggers between them" verbatim.

**The flipped nineteen are not neutral prose.** For a Laravel/Vue consumer they
land on the daily path:

| Flipped rule | obligation frequency | consumer-scoped | behavioural effect when always-on |
|---|---|---|---|
| `design-review-after-ui-write` | per-edit | yes | pre-inventory **and** post-review mandated around every `*.vue` / `*.tsx` / `*.blade.php` edit |
| `ui-audit-gate` | per-edit | yes | audit gate on every UI write |
| `design-fidelity` | per-edit | yes | fidelity-comparison obligations (largest body in the set) |
| `php-coding` | per-edit | yes | phpstan / ecs discipline active every turn |
| `laravel-translations` | per-edit | yes | translation-key obligations |
| `settings-ask-protocol` | per-task | yes | structured ask-the-user protocol |
| `markdown-safe-codeblocks` | **per-turn** | yes | per-turn formatting obligation |
| `onboarding-gate`, `linked-projects-onboarding-gate` | per-session | yes | session-start gates |
| `doc-screenshot-hygiene`, `image-likeness-and-rights`, `provider-lifecycle-discipline`, `lethal-trifecta-guard`, `roadmap-ci-steps-policy` | per-event / per-edit | yes | assorted always-active obligations |
| `augment-edit-discipline`, `framework-neutrality-in-generic-skills`, `persona-governance`, `domain-adoption-policy`, `low-impact-corpus-privacy-floor` | per-edit / per-task | maintainer-only | dead weight in consumer sessions |

More standing obligations means more rethinking per turn, more mandated
review/verify loops per edit, and more asks — and, compounding, more turns that
trip the turn-end gate's detector C (an edit with no verify-shaped command ⇒ Stop
refused ⇒ one extra model turn). Dispatcher wall-clock is unchanged, which is
exactly why it *feels* as though the agent got slower while no script did.

**Stated honestly in both directions.** 12.0.0's behaviour was the *defect*
state: those nineteen rules were silently narrowed to path-only reach, and
`design-fidelity` alone lost 21 keyword routes with no recorded decision.
`33c7c20` restored correctness and paid for it with always-on cost. **The fix is
therefore not a revert.** The commit itself names the remedy — those nineteen
"should earn real `paths:` coverage or shed keywords they do not need" — and this
roadmap is that work.

> **State after Phase 2 landed (2026-08-17).** The paragraphs above describe the
> tree **as adopted**, and are kept as the record rather than rewritten. The
> current state is: **25 path-shaped · 17 mixed · 8 path-only · emitter verdict 8
> scoped / 100 unconditional / 9 always**, and the unconditional corpus is
> **103,265 exact-BPE tokens, down 3,929** from the 107,194 measured at adoption.
> `design-review-after-ui-write` and `ui-audit-gate` — the first two rows of the
> table above — are path-scoped again and no longer load in every session. The
> other seventeen rows are unchanged, and the honest size of the win is stated
> plainly: **−3.7 % of the standing rule corpus**. The value of the change is
> behavioural, not that number — a per-edit pre-inventory-and-review obligation and
> a UI audit gate leave every non-UI session — and the token half of the remaining
> seventeen belongs to `road-to-standing-context-40k` Phase 2, because the trigger
> ratio blocks scoping as its mechanism.

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`. Verdict vocabulary:
**still-true** (holds now) · **overtaken** (true when drafted, a later change
moved it) · **refuted** (not true as written) · **unverifiable** (no source in
this tree can settle it).

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Guard absent at 12.0.0, present at 12.1.0; commit `33c7c20` | **still-true** | `git tag --contains 33c7c20` → `12.1.0`, `13.0.0`; `_has_non_path_trigger` introduced in that commit's `src/scripts/condense.ts` diff |
| 2 | 25 path-shaped rules, 19 mixed, 6 path-only | **still-true, exact** | `grep -l 'file_pattern\|path_prefix' src/rules/*.md` → 25; of those, 19 also carry `- keyword:` / `- phrase:`; the 6 remainder are `rule-type-governance`, `no-roadmap-references`, `source-confidentiality`, `source-of-truth`, `roadmap-progress-sync`, `skill-quality` |
| 3 | The 19 load unconditionally on Claude | **still-true** | zero of the projected `.claude/rules/*.md` carry a `paths:` block; every sampled member of the 19 is present in the projection |
| 4 | Guard rationale + the `design-fidelity` 21-route finding | **still-true** | commit message of `33c7c20`; comment block in `src/scripts/condense.ts` at `_claude_paths_plan` |
| 5 | `design-review-after-ui-write` mandates pre-inventory + post-review per component edit, model-carried | **still-true** | `src/rules/design-review-after-ui-write.md` (Iron Law + allow-list + honest-scope sections) |
| 6 | `design-review-after-ui-write` and `settings-ask-protocol` have **no routing matrix at all** | **still-true** | `tests/eval/routing-matrix/` holds 96 `.yaml` files; neither rule appears. `design-fidelity`, `ui-audit-gate` and `php-coding` each have one |
| 7 | The host loads `paths:` rules on mid-turn file contact (read-triggered), witnessed first-party | **still-true** | `agents/roadmaps/archive/road-to-rule-delivery-integrity.md` P3.1 done-note |
| 8 | Detector C refuses turn-end on unverified edits | **still-true** | `src/scripts/hooks/turn_end_gate_hook.ts` (`_VERIFY_RE`, unverified-edit detector) |
| 9 | Rule *content* changes in the 12.0→12.1 window are negligible | **still-true** | `git diff --stat 12.0.0..12.1.0 -- src/rules/` |
| 10 | The one-command field check `grep -l '^paths:' .claude/rules/*.md \| wc -l` distinguishes "≈25 ⇒ pre-flip" from "≈6 ⇒ flip live" | **REFUTED as written** | it returns **0** on the maintainer machine, not 6 — the local projection emits no `paths:` for *any* rule, including the six that carry only path triggers. The check therefore cannot separate "the flip is live" from "this projection was built at a different scope, or is stale". Step 1.0 replaces it |
| 11 | The flip adds ~20.4k standing tokens | **unverifiable as exact** | 81,691 bytes ÷ 4 is a character proxy, and this repo ships an exact-BPE tokenizer. `33c7c20` records ~13,630 tokens for the *structural* subset — a different quantity, so the two do not contradict, but neither figure is an exact-BPE measurement of "what the flip added". Step 4.1 produces one |
| 11b | **RESOLVED 2026-08-17** — exact-BPE figures now exist | **measured** | Step 4.1's baseline: the unconditional corpus was **107,194** exact-BPE tokens before Phase 2 and **103,265** after, so restoring `paths:` on two of the nineteen returned **3,929 tokens**. Extrapolating that to all nineteen would be wrong in both directions — the two restored rules are among the largest in the set, and the trigger ratio blocks scoping the keyword-dominant remainder — so no whole-flip figure is claimed here either |
| 13 | `trigger-coverage.yaml` independently pins the same pre-contact reach the amendment retires | **still-true, found during execution** | its `ui-component` case expected `ui-audit-gate` from a file-less prompt. `fired_rules` in `src/scripts/trigger_coverage.ts` matches only `keyword` / `phrase`, so that corpus cannot express a path-backed positive at all — the reach was moved to the routing matrix and the case re-pointed to the only rule still firing on that prompt. A second pin the roadmap did not know about when it was written |
| 14 | `ui_rule_triggers.test.ts` asserted the keyword triggers MUST exist ("host-independent fallback") | **overtaken, and measured before retiring** | its stated reason was that the rules once had only two Laravel path prefixes, leaving keywords as the whole routing surface — a gap closed by the `components/` · `src/components/` · `pages/` prefixes the same file pins. Measured: no host activation surface reads a keyword (Cursor `.mdc` → `description` + `globs`; Windsurf → `trigger: glob` + `globs`; Claude → `paths:`), so "host-independent" did not hold. Retired as a `decision-revisit-gate` mechanism-match miss and replaced by the inverse assertion |
| 12 | The three PRs the delta doc analysed as open (#1391, #1393, #1395) | **overtaken** | all three merged into `main` (`097ab6549`, `01ec331ab`, `f0675de95`); #1393's twelfth `pre_tool_use` concern is live, not pending |
| 15 | **Pre-guard emitter arm:** running `_claude_paths_plan` at `12.0.0` yields **25** scoped · **85** unconditional · **340,028** bytes, against **6** · 105 · 421,719 at the guard-active tree | **draft-reported, not re-verified here** | the source draft's own census, method = importing the emitter's plan function at each tag. Recorded because step 3.1 requires exactly this arm ("one projection generated with the pre-guard plan") and nothing else in this file states what that arm should produce. **Method caveat, also from the draft:** `12.0.0` predates the export split, so confirm the symbol is exported at both tags before trusting the import. Re-derive before use; a number quoted from a draft is not a measurement |
| 16 | The only other change in the 12.0→12.1 window is the frontier tier added to `model-recommendations` — agent-visible, opt-in, not a loop-maker | **draft-reported alternative-cause elimination** | `git diff 12.0.0..12.1.0 -- src/agent-src/contexts/model-recommendations.md`. Recorded because § 0's causal story is exclusive ("the mechanism that *does* reproduce is rule activation") and an exclusive claim needs its co-change closed, not omitted |
| 17 | **17 of 19** flipped rules have routing-matrix positives that fire with no file in context; 2 have no matrix at all | **negative half verified (claim 6), positive half OPEN** | claim 6 confirms the two matrix-less rules. Nobody has confirmed a surviving file-less positive for each of the other 17, and **AC-2 lets a rule close on exactly that** — so 15 of the 17 dispositions currently rest on an unverified premise. Phase 2's disposition table gains a column for it |

## Phases

### Phase 1 — A field check that decides, then the two matrix-less rules

Claim 10 is refuted, so the roadmap opens by replacing it. Then: of the nineteen,
`design-review-after-ui-write` and `settings-ask-protocol` flipped to always-on
**without any routing-matrix evidence pinning their keyword reach** — the exact
authority the revert commit established as required — so they are both the most
decidable and the least defended.

- [x] **1.0** Replace the refuted field check with one that reads the *source*
      rather than a projection whose scope is unknown: a `--json` mode on the
      existing rule-census path reporting, per rule, whether it declares a
      path-shaped trigger, whether it declares a keyword/phrase trigger, and
      whether the emitter would give it `paths:`. Run it on the affected machine
      **and** name the projection scope it was generated at, so "0 scoped" can be
      read as either "the flip is live" or "this projection is not the one the
      host loads". `verify:` the command prints 25 / 19 / 6 on this tree.
      <!-- done 2026-08-17: `src/scripts/rule_activation_census.ts`, reading the
      emitter's own exported `_parse_frontmatter` / `_has_non_path_trigger` /
      `_claude_paths_plan` rather than a reimplementation (`_parse_frontmatter`
      exported for this in the same diff). Verified: 117 rule files · 25
      path-shaped · 19 mixed · 6 path-only · emitter verdict 6 scoped / 102
      unconditional / 9 always — claim 2 confirmed exactly, from source. The
      `--projection` column reproduces claim 10's refutation as a live warning:
      the maintainer projection reads 92 files / 0 `paths:` against a source
      verdict of 6, and the script names that a reason to regenerate rather than a
      reading of the emitter. Three projection states are kept distinct (read /
      directory-absent / flag-absent); collapsing the middle into the third was a
      defect in this script's first version and was fixed before the flip. -->
      <!-- finding 2026-08-17: `agents/evidence/analysis/rule-paths-coverage-census.md`
      still states ".claude/rules/ has 25 of 110 scoped today". Commit `33c7c20`
      set that to 6 and edited that same page in the same commit, so the page was
      made stale by the commit that changed the number — doc drift per
      `downstream-changes` § Doc-Impact. Corrected in step 1.1's diff. -->
- [x] **1.1** Author the two missing routing-matrix files (positives, near-misses,
      file-less cases) so each rule's reach becomes decidable **before** any
      scoping decision — the house lesson of `3b06e61`, where four scoping
      candidates were refuted 4/4 by matrices that already existed.
      `verify:` the routing-matrix test suite collects and passes both new files.
      <!-- done 2026-08-17: `tests/eval/routing-matrix/design-review-after-ui-write.yaml`
      and `settings-ask-protocol.yaml`. `npx vitest run tests/scripts/routing_matrix.test.ts`
      → 200 tests passed, so every positive routes and every near-miss stays
      silent against the REAL `trigger_matches` import rather than by eyeballing
      substrings, which the matrix README explicitly forbids.
      `TIER2_MATRIX_FLOOR` raised 72 → 74 in the same change, per the presence
      ratchet's own instruction; the comment there names the four tier-2 rules
      still without a matrix so the gap between 74 and 78 is explained rather
      than open. Scope correction recorded: exactly 2 of the flipped 19 lacked a
      matrix, but 6 tier-2 rules lack one overall — the other 4
      (council-availability, evaluator-independence, missing-skill-recovery,
      self-repair-loop) are keyword-only, not mixed, and are out of this
      roadmap's scope.
      Doc drift from the 1.0 finding corrected in the same change: the census page
      now carries a second correction with the measured 117/25/19/6 split and the
      92-files/0-`paths:` projection reading, stated as two different quantities
      instead of one merged number. -->
      <!-- finding 2026-08-17: the two rules are ASYMMETRIC, which changes 1.2.
      `design-review-after-ui-write` = 10 path triggers + 2 generic keywords
      ("component", "design token") → the keywords are the removable half, and it
      is a genuine scoping candidate. `settings-ask-protocol` = 6 keywords + 4
      phrases + exactly ONE path_prefix (`docs/contracts/settings-classes.md`) →
      that single path trigger is the only reason the emitter calls it mixed, and
      restoring `paths:` would narrow a prompt-driven per-task obligation to one
      docs file. Its honest disposition is "stays unconditional"; the removable
      half here is the incidental path trigger. Both matrices record this. -->
- [x] **1.2** Where the matrix shows the obligation is genuinely path-bound
      (expected for `design-review-after-ui-write`, whose own trigger table is
      purely file-globs), drop the non-path triggers as an **authoring decision** —
      the escape the guard's own comment names — which restores `paths:` emission
      for that rule. Where a file-less positive survives review, the rule stays
      unconditional and the matrix records why.
      `verify:` re-run 1.0's census; any rule that moved carries its matrix diff.
      <!-- partial 2026-08-17: one of the two rules has a terminal disposition, the
      other routes to an existing user-owned blocker. No trigger was edited, so the
      census is unchanged at 25/19/6 by construction.

      `settings-ask-protocol` — TERMINAL: stays unconditional. Its obligation is
      prompt-driven and per-task (6 keywords + 4 phrases); its single path trigger
      points at the contract it routes to. Restoring `paths:` would narrow the rule
      to one documentation file, which is a reach deletion rather than a scoping.
      The removable half here is the incidental path trigger, and removing it would
      change nothing the host receives — the rule is already unconditional — so it
      is left alone as a no-op edit. Its matrix records the reasoning.

      `design-review-after-ui-write` — ROUTED to `b-matrix-semantics-amendment`,
      deliberately not dropped. Dropping `keyword: "component"` / `"design token"`
      today would narrow a shipped consumer-facing obligation on the strength of
      the file-less positive being dispensable — which is exactly the question
      Phase 2.1's amendment is user-owned to answer. Acting first would also make
      the matrix authored in 1.1 dishonest within the same run: it records that
      positive as "recorded, not assumed either way". Per `ask-when-uncertain`, a
      reach change to a shipped rule is user-required and does not route to the
      council; the blocker already carries the question, so no second ask was
      raised.

      AC-1 therefore holds on its second branch for both rules — each carries a
      matrix, and each one's always-on status is backed by a file-less positive.
      The glyph is `[~]` rather than `[x]` because for the second rule that
      positive survives *pending* the amendment, not on review. -->
- **AC-1:** both rules carry a matrix; each is either paths-scoped with its matrix
  green, or its always-on status is backed by a file-less positive that survived
  review. No rule in the pair is left in the undocumented state that made it the
  starting point.

### Phase 2 — Re-adjudicate the seventeen with the read-trigger fact on the table

The matrices' file-less positives were authored **before** the first-party witness
that Claude Code loads `paths:` rules on **mid-turn file contact** (claim 7). For
a rule whose obligation binds only at file contact — `obligation_frequency:
per-edit`, which is 11 of the 17 — a file-less prompt like "run phpstan on the
changed files" reaches the rule the moment the first `.php` file is read, *before
any edit can occur*. The file-less positive then asserts pre-contact routing that
the obligation does not need.

- [x] **2.1** Maintainer decision, framed as a matrix-semantics amendment: a
      positive may be satisfied `by-first-file-contact` for rules whose obligation
      binds at file contact. Gates (`onboarding-gate`,
      `linked-projects-onboarding-gate`, and the per-session / per-task rules) are
      **excluded by construction** — they must shape behaviour before contact and
      stay unconditional. Blocked on `b-matrix-semantics-amendment`.
- [x] **2.2** Under that amendment, re-run the disposition per rule. Expected
      outcome, to be measured rather than assumed: the 11 per-edit rules return to
      `paths:` scoping; the gates and the per-turn rule stay unconditional. Each
      verdict lands as a row with its matrix diff attached.
      `verify:` every one of the 17 has a row; the census from 1.0 is re-run and
      recorded before and after.
      <!-- partial 2026-08-17: the DECISION half is blocked on
      `b-matrix-semantics-amendment`; the INPUT half is built and lands below. No
      trigger was edited, so the census is unchanged at 25/19/6 by construction. -->

  **Disposition input table** (measured 2026-08-17 from `src/rules/` frontmatter
  via step 1.0's census; `paths` / `kw+ph` are declared trigger counts):

  | Rule | obligation | paths | kw+ph | shape |
  |---|---|---:|---:|---|
  | `design-review-after-ui-write` | per-edit | 10 | 2 | path-dominant |
  | `ui-audit-gate` | per-edit | 10 | 2 | path-dominant |
  | `php-coding` | per-edit | 1 | 2 | balanced, low count |
  | `laravel-translations` | per-edit | 1 | 3 | balanced, low count |
  | `augment-edit-discipline` | per-edit | 2 | 3 | balanced, low count |
  | `low-impact-corpus-privacy-floor` | per-edit | 2 | 3 | balanced, low count |
  | `persona-governance` | per-edit | 2 | 6 | keyword-dominant |
  | `lethal-trifecta-guard` | per-edit | 2 | 6 | keyword-dominant |
  | `roadmap-ci-steps-policy` | per-edit | 2 | 9 | keyword-dominant |
  | `framework-neutrality-in-generic-skills` | per-edit | 3 | 13 | keyword-dominant |
  | `design-fidelity` | per-edit | 2 | 21 | keyword-dominant |
  | `onboarding-gate` | per-session | 1 | 2 | gate — excluded |
  | `linked-projects-onboarding-gate` | per-session | 2 | 3 | gate — excluded |
  | `markdown-safe-codeblocks` | per-turn | 1 | 1 | per-turn — excluded |
  | `domain-adoption-policy` | per-task | 1 | 3 | per-task — excluded |
  | `settings-ask-protocol` | per-task | 1 | 10 | per-task — excluded (terminal, § 1.2) |
  | `doc-screenshot-hygiene` | per-event | 1 | 15 | keyword-dominant |
  | `image-likeness-and-rights` | per-event | 1 | 7 | keyword-dominant |
  | `provider-lifecycle-discipline` | per-event | 4 | 10 | keyword-dominant |

  **This falsifies part of the expectation stated above, and the correction is the
  finding.** The step predicted "the 11 per-edit rules return to `paths:`
  scoping". There are exactly 11 per-edit rules — that count is confirmed — but
  obligation frequency turns out to be the wrong discriminator on its own. The
  **trigger ratio** is the one that matters: `design-fidelity` is per-edit *and*
  carries 21 keyword triggers against 2 path triggers, so scoping it is precisely
  the reach deletion `33c7c20` was written to stop. Applying the amendment by
  frequency alone would re-commit the original defect on the very rule that
  exposed it.

  The corrected candidate set is **path-dominant AND per-edit**: two rules,
  `design-review-after-ui-write` and `ui-audit-gate` — the write-side and
  read-side halves of the same UI loop, both 10 paths against 2 keywords. Four
  more are balanced at low counts (`php-coding`, `laravel-translations`,
  `augment-edit-discipline`, `low-impact-corpus-privacy-floor`) and are decidable
  per-rule but carry little payload. The seven keyword-dominant per-edit and
  per-event rules should be expected to **stay unconditional**, which is a
  smaller relief than the roadmap assumed and should be stated as such before the
  amendment is decided rather than after.
- [ ] **2.3** A **third** disposition beside "stays unconditional" and "returns to
      `paths:`": deliver the obligation as host-gated just-in-time injection. The
      host accepts an `if` field in permission-rule syntax on tool events, and a
      non-matching `if` skips the handler entirely — so a `PreToolUse` handler with
      `if: "Edit(*.blade.php)"` (or `"Bash(vendor/bin/phpstan *)"`) can inject a
      condensed form of `design-review-after-ui-write` / `php-coding` /
      `laravel-translations` as additional context exactly at the file or command
      that binds the obligation. Later than pre-contact routing, but guaranteed at
      the contact point, which sidesteps the pre-contact-positive question for
      per-edit rules entirely. This is the colleague's own gate-script idea, made
      governed. Binding design constraints: injected text phrased as factual
      statements (imperative out-of-band phrasing trips prompt-injection defences),
      each payload well under ~500 tokens (long injections get deprioritised), and
      resume-replay-safe content only.
      `verify:` a fixture per carrier — payload under cap, factual phrasing, and a
      non-matching `if` produces no injection.
      <!-- partial 2026-08-17: not started, and the reason is two real
      dependencies rather than a judgement about effort.

      (a) PAYLOAD OWNER. The step names the per-rule norm line as the natural
      condensed payload. That norm line and its drift lint are owned by
      `road-to-cost-parity-1-rule-payload-diet` and do not exist yet, so authoring
      a payload here would either invent a second condensed form per rule or pin
      one before the lint that keeps it honest exists.

      (b) MECHANISM OWNER. Splitting the monolithic per-event hook registration
      into `matcher` / `if` groups is `road-to-per-turn-hook-economy` Phase 5.1,
      whose own text sequences it FIRST because it changes the denominator every
      later benchmark divides by. Verified in this tree: `hooks/hooks.json` uses no
      `matcher` and no `if` today (`road-to-per-turn-hook-economy` § 1 claim 9 —
      NOT this file's claim 9, which is about rule-content churn in the window),
      so this is a new mechanism rather
      than an extension of one — and building it here is exactly the
      spawn-a-sibling-for-owned-scope that
      `agents/evidence/analysis/mixed-trigger-cleanup-ownership-map.md` forbids.

      Resume condition, probe-able: cost-parity-1's norm-line lint exists AND
      hook-economy 5.1 has landed the matcher/if split. Then 2.3 is authoring
      payloads into an existing carrier, which is a small step rather than this
      one. -->
- **AC-2:** every one of the 17 has a terminal disposition citing the amendment, a
  surviving pre-contact positive, **or** an `if`-gated carrier with its condensed
  payload committed; the scoped count and the unconditional-token census are
  re-measured and recorded. **The middle branch is not free** (claim 17): a
  "surviving pre-contact positive" is verified per rule, in a column of the
  disposition table, naming the matrix case — never assumed from the fact that a
  matrix exists.
- **Interlock — do not duplicate an existing owner.** The 5 maintainer-only rules
  in the set (`augment-edit-discipline`, `framework-neutrality-in-generic-skills`,
  `persona-governance`, `domain-adoption-policy`,
  `low-impact-corpus-privacy-floor`) leave consumer installs entirely once
  `later/road-to-request-scoped-rule-load` resumes — its resume condition fired
  and it sits at 34/36 done. Consumer relief for those five comes from scoping the
  *install*, not from touching the emitter here.

### Phase 3 — Behavioural regression bench (the falsifiability spine)

The claim "12.1 made the agent slower *behaviourally*" earns the same treatment a
latency claim would get: pre-registered, paired, refutable.

- [~] **3.1** Fixed task set (5–8 tasks: one UI edit, one PHP fix, one doc edit,
      one multi-file refactor, one pure-question turn) run A/B against two
      projections of the **same** package version — one generated with the
      pre-guard plan, one with the current plan — same model, same host version.
      Metrics registered before the first run: turns to completion, tool calls,
      Stop refusals per detector, tokens billed, wall clock. Blocked on
      `b-behavioural-bench-spend`.
- [~] **3.2** Success / kill, pre-registered before any run: if the current
      projection costs more than 20 % more turns, or one additional median Stop
      refusal on the UI and PHP tasks, the Phase-2 dispositions become mandatory
      rather than optional. If the delta is under 5 %, the behavioural-regression
      hypothesis is published as a null and the report is re-attributed — to
      context size, the stop gate, or the environment — with the numbers attached.
      Blocked on `b-behavioural-bench-spend`.
- [ ] **3.3** Instrument both arms with an observer on the host's
      `InstructionsLoaded` event, which fires per loaded `CLAUDE.md` /
      `.claude/rules/*.md` with a load-reason matcher (`session_start`,
      `path_glob_match`, `include`, `compact`). This measures which rules
      *actually* loaded per session — closing the "absence is unmeasured" gap the
      archived rule-delivery-integrity done-note named — and replaces emitter
      simulation as the census source for Phase 4.
      `verify:` the observer records a load event with its reason on this tree.
      <!-- partial 2026-08-17: BLOCKED ON A HOST FACT, and the fact is checkable in
      this tree rather than assumed either way.

      `src/scripts/hook_manifest.yaml` § native_event_aliases lists claude's event
      set as SessionStart, SessionEnd, Stop, UserPromptSubmit, PostToolUse,
      PreToolUse, PreCompact, SubagentStart, SubagentStop. `InstructionsLoaded` is
      **not among them**, and that list is not a guess: the manifest records the
      tokens as re-extracted from the installed binary at host 2.1.229. Nothing
      anywhere in `src/` binds such an event. So the observer has no slot to bind
      to, and writing one would be designing against an assumption — the failure
      `source-discovery-gate` and `think-before-action` § Ground the harness both
      forbid, and the same shape as the unverified-host-capability claims this
      package has had to correct before.

      This does NOT refute `road-to-per-turn-hook-economy` § 1 claim 12 (the
      `async`/`asyncRewake` row — NOT this file's claim 12, which is the three
      merged PRs) — that claim is marked
      "still-true, external", sourced from host documentation read at one version,
      and external docs and the extracted binary token set can legitimately
      disagree if the event is newer than 2.1.229 or is not hook-bindable at all.
      What it establishes is narrower and sufficient: the step cannot be built from
      this tree today.

      Resume condition, probe-able: the event appears in a re-extraction of the
      installed host binary's token set, or is otherwise witnessed first-party the
      way the read-triggered loading fact in § 1 claim 7 was. Then the observer is
      an ordinary concern binding. Until then the census from step 1.0 is the
      available substitute — it reads what the emitter WOULD deliver, which is
      strictly weaker than what the host DID load, and step 1.0's own output says
      so rather than implying equivalence. -->
- **AC-3:** the paired table exists in the shape `docs/benchmark.md` uses;
  whichever way it falls, a number replaces the anecdote.

### Phase 4 — Guard the surface

`33c7c20` moved nineteen rules and the only witnesses were an external analysis
and a census gap. That is the surface this phase closes.

- [x] **4.1** Census gate: scoped-rule count plus unconditional-token total per
      emission, ratcheted against a committed baseline, so a future emitter change
      that silently flips ±5 rules or moves the token total by more than a
      declared band fails the build **with the list of rules that moved**. Measure
      the token total with the repo's exact-BPE path, not a character proxy — claim
      11 is unverifiable precisely because no exact measurement of this quantity
      exists yet.
      `verify:` the gate is red against a fixture that flips one rule's triggers,
      and green on the committed tree.
      <!-- done 2026-08-17: `src/scripts/check_rule_activation_census.ts` +
      `src/config/rule-activation-census.json`.

      Two axes, because a count alone is satisfiable by coincidence (one rule in,
      one rule out): the scoped and mixed ID SETS are pinned by IDENTITY and any
      mover is NAMED, and the unconditional corpus's token total may only walk
      down past a stated drift allowance. Baseline measured with the repo's
      exact-BPE path: **6 scoped · 19 mixed · 107,194 unconditional tokens
      (exact BPE)** over 117 rule files. That figure is what § 1 claim 11 was
      missing — the inherited ~20.4k was bytes ÷ 4 quoted as a measurement, and
      the gate refuses to repeat it: a method change between baseline and reading
      is reported as UNRESOLVED rather than ratcheted as a corpus delta.

      `verify:` both directions run, with true exit codes rather than a pipeline's:
      fixture (one `keyword:` added to the path-only `skill-quality`) → exit 1,
      naming `scoped set moved (6 → 5): − skill-quality` and
      `mixed set moved (19 → 20): + skill-quality`; fixture reverted → exit 0.
      This is the check that would have caught `33c7c20`.

      Registered at three surfaces, because a defined-but-unlisted gate never
      fires: the task definition in `taskfiles/ci-fast.yml`, the aggregate deps
      list in `Taskfile.yml` (the surface that actually invokes it), and a row in
      `src/config/gate-coverage.yml` with `min_scanned: 100` as the
      anti-vacuity floor beside the gate's own `assertScanned`.
      `GateLedger` adopted with per-rule accounting; `check_gate_completeness`
      went 218 → 219 on the bare addition and back to **218 = exact parity with
      `origin/main`** once adopted, i.e. zero net violations added. Its 2
      pre-existing violations against a baseline of 216 are red on `main` too and
      are NOT from this change — noted, not fixed, since they sit outside this
      roadmap's path. `npx tsc --noEmit` → 0 errors. -->
      <!-- finding 2026-08-17: `rule_activation_census.ts` is deliberately NOT
      `check_`-prefixed. `_lib/gate_population.ts` treats that prefix set as
      gate-shaped, and a gate owes the ledger a per-target accounting an
      instrument that cannot fail has nothing honest to report. A first pass added
      a `// ledger-exempt:` marker there and it was removed: the file never enters
      the population, so the marker asserted an exemption from an obligation it
      does not incur. -->
- **AC-4:** the ratchet exists, is red/green against a committed baseline, and
  follows the same discipline as `preamble-payload-budget` — the baseline walks
  down only, and raising it needs a PR with a stated reason.

## Blockers

### blocker: b-matrix-semantics-amendment
- **Status:** RESOLVED 2026-08-17 — **option (b)**, narrowed to two rules
- **Decision:** the maintainer adopted the amendment narrowed to the
  **path-dominant per-edit** set, which the step-2.2 ratio analysis reduced to
  `design-review-after-ui-write` and `ui-audit-gate` (10 path triggers against 2
  keywords each). Option (a) was rejected on the ratio finding — applying the
  amendment by obligation frequency alone would have scoped `design-fidelity`
  (2 paths, 21 keywords) and reproduced the exact reach deletion `33c7c20` closed.
  Both keyword triggers were removed from both rules as an authoring decision;
  the emitter restored `paths:`; scoped 6 → 8, mixed 19 → 17, unconditional corpus
  **107,194 → 103,265 exact-BPE tokens (−3,929)**. The remaining 15 keep the
  terminal disposition "stays unconditional" under the narrowed amendment, and
  whether that costs behaviour rather than only tokens is what
  `b-behavioural-bench-spend` now gates.
- **Owner:** user
- **Blocks:** Phase 2 (step 2.1 and everything downstream of it). Phases 1 and 4
  are repo work and proceed without it.
- **What to do:** decide whether a routing-matrix positive may be satisfied
  `by-first-file-contact` for rules whose obligation binds at file contact.
  Three options: (a) adopt the amendment as written, with gates and per-turn rules
  excluded by construction; (b) adopt it narrowed to an enumerated subset of the
  11 per-edit rules, naming which; (c) reject it, in which case the 17 keep their
  current pre-contact positives and Phase 2 closes as a null with that reason.
  The amendment text and the excluded set are in Phase 2's preamble.
- **Recommendation:** **option (b) — adopt it narrowed to the enumerated per-edit
  subset.** Option (a) is the cleaner rule but it grants the amendment to rules
  nobody has examined, which is how the original silent narrowing happened: a
  general emitter decision applied to a set with mixed obligations. Option (c)
  keeps the current state, whose cost is measured and whose benefit — pre-contact
  routing for obligations that bind at contact — is the thing no evidence supports.
  (b) buys the same relief as (a) for the eleven rules where the argument is
  concrete, and leaves the rest to a second pass with their matrices in hand.
- **If you do nothing:** the seventeen stay unconditional, the standing-token cost
  stays on every session for every consumer, and Phase 2 cannot start — which also
  strands Phase 3's bench, because there is no second arm to compare against.
  Phases 1 and 4 still land, so the estate keeps the two new matrices and the
  census ratchet but none of the payload relief.
- **Resolved when:** one of the three options is recorded at this blocker, and —
  for (a) or (b) — the matrix-semantics documentation carries the amendment.

### blocker: b-behavioural-bench-spend
- **Status:** open — **sequenced as the next gate** (maintainer, 2026-08-17)
- **Sequencing decision:** the maintainer resolved this as a *follow-on gate to
  the amendment, not an alternative to it*: land the reversible, evidence-covered
  change first, then let the bench answer the question the amendment leaves open —
  do the **remaining 15** always-on rules cost measurable behaviour (turns, tool
  calls, refusals), or only tokens? A null closes Phase 2 honestly and hands the
  whole remainder to `road-to-standing-context-40k`; a positive result supplies the
  numbers that would prioritise the `if`-gated injection carrier (step 2.3). Note
  what the bench is now measuring: with the amendment applied, the A/B arms differ
  by 2 rules rather than 19, so the pre-registered bars in 3.2 are being asked
  about a smaller delta than when they were written — re-register them against the
  post-amendment corpus before the first run, not after.
- **Owner:** user
- **Class:** 2 — consent-once (name a budget at this entry, or re-date the step)
- **Blocks:** Phase 3 steps 3.1 and 3.2. Step 3.3's observer is repo work and
  proceeds without it.
- **What to do:** authorise the paired A/B run, which bills model tokens across
  5–8 tasks in two arms. Either name a per-run budget for it, or defer it until
  `road-to-gate-autonomy`'s class-1 budget ledger exists and let the ledger carry
  the consent. The pre-registered success and kill bars are in step 3.2 and must
  be recorded before the first run, not after.
- **Recommendation:** **defer it to the class-1 budget ledger** rather than naming a
  one-off budget now. The bench is the most expensive step in this roadmap and the
  least urgent: Phase 2's dispositions are justified by the token census on their
  own, and the bench decides only whether they are *mandatory* or merely *available*.
  Paying for it before the ledger exists spends the consent twice — once here, once
  again for the next bench — which is the exact couriering `road-to-gate-autonomy`
  was opened to end.
- **If you do nothing:** the behavioural-regression claim stays an argument rather
  than a number. Phase 2 can still ship on the token census, but the roadmap loses
  its falsifiability spine — nothing would refute the premise if it were wrong, and
  the honest-null consequence below becomes unreachable.
- **Resolved when:** a budget is named at this blocker, or the step is re-dated
  against the ledger mechanism with that dependency stated.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2's amendment re-opens the silent-reach-deletion defect through the front door | product | The guard exists because scoping silently deleted 21 keyword routes from one rule with no recorded decision; an amendment that lets a positive be satisfied "at file contact" could re-narrow reach by a different route | The amendment is per-rule, matrix-backed, and excludes gates by construction; `33c7c20`'s reported-drop mechanism stays; the Phase-4 ratchet makes any future flip loud instead of silent | Phase 2 — Re-adjudicate the seventeen |
| 2 | Read-triggered loading is a host behaviour that can change upstream | implementation | The entire amendment rests on the host loading a `paths:` rule when a matching file is read mid-turn — a first-party observation at one host version, not a documented contract | The witness fixture records its host version and Phase 2 verdicts cite it; a host bump re-opens the dispositions under the same staleness discipline reach-channels already use | Phase 2 — Re-adjudicate the seventeen |
| 3 | The bench's task set is too small to detect the bar it pre-registers | implementation | A 20 % turn delta across 5–8 tasks can be swamped by run-to-run variance, and a swamped bench invites quietly lowering the bar | Paired design over identical tasks; if variance exceeds the bar the report says so and the bar is **not** lowered — the same posture the thin-projection null took | Phase 3 — Behavioural regression bench |
| 4 | Restoring `paths:` on `design-review-after-ui-write` weakens UI quality | product | The rule exists so a UI change is reviewed; scoping it to file contact could read as removing the obligation | The obligation still fires on every actual UI file contact, which is the only place a UI edit can happen; step 1.1's matrix is the check that no non-contact scenario is load-bearing | Phase 1 |
| 5 | An `if`-gated carrier drifts into imperative phrasing or an oversized payload | implementation | The host deprioritises long injections and its prompt-injection defences react to imperative out-of-band phrasing, so a carrier can silently stop working | Payload fixture per carrier: factual-statement phrasing check plus a hard token cap; the one-sentence norm line is the default payload precisely because it is already one sentence | Phase 2 |
| 6 | The host's `if` semantics change, or fail open where the roadmap assumed they filter | implementation | `if` matching is best-effort and fails open on unparseable commands, so a carrier could inject when it should not | Each carrier records the host version it was verified on; fail-open is the safe direction for advisory injection (worst case: injected when unnecessary) and no blocking behaviour ever rides on `if` | Phase 2 |
| 7 | The census ratchet is built on a character proxy and enshrines a wrong number | implementation | Claim 11 is unverifiable precisely because the 20.4k figure is bytes ÷ 4; a ratchet anchored to a proxy would ratchet the proxy | Step 4.1 requires the exact-BPE path for the committed baseline, and the gate reports which measurement it used — the same honesty the rich-class ceiling gate already applies | Phase 4 — Guard the surface |

## CUT list — do not re-litigate

- **Reverting `33c7c20`.** Re-introduces silent keyword-reach deletion with no
  recorded decision. The guard's *reporting* is correct; only the *default
  disposition* of mixed rules is at issue. Cut.
- **Re-running the earlier scoping pass as it was.** Refuted 4/4 by the routing
  matrix (`3b06e61`). Phase 2 goes through a semantics amendment plus per-rule
  matrices instead. Cut.
- **A keyword-matching injection hook for rules.** Barred by the recorded
  rule-delivery-integrity non-goal ("no hook that matches keywords and injects
  rule bodies — keyword matching is already measured weak in this repo and
  `intent:` was retired on exactly that finding"). Any future runtime carrier is
  owned by `later/road-to-deferred-rule-retriever`. Cut. Note that step 2.3 is
  *not* this: an `if` prefilter is host-side path/command matching, not keyword
  matching over the prompt.
- **Treating 12.0.0 as the correct baseline.** It was the under-enforcement state.
  Phase 3 compares outcomes; it does not enshrine 12.0.0. Cut.

## Honest-null consequence

If Phase 3 measures no meaningful behavioural delta between the two projections,
this roadmap's premise dies in public: the flip cost tokens but not behaviour, the
token half is handed to `road-to-standing-context-40k` where it already has an
owner, and the colleague's report returns to Phase 0 of
`road-to-per-turn-hook-economy` with one hypothesis eliminated and documented.

## Deltas this finding forces in the sibling roadmaps

- **`road-to-per-turn-hook-economy`** Phase 0 gains step 1.0 above as its step 0.0
  — the cheapest decisive probe, run before any latency matrix. Note that the
  draft's version of that probe is the one claim 10 refutes; the replacement is
  the census, not the `grep`.
- **`road-to-standing-context-40k`** gains the window pin: the 6-scoped state is
  not "structural since forever" — nineteen of the unconditional rules became
  unconditional *at 12.1.0*, and its condensation priority list starts with those
  nineteen, largest body first. Measured at `86cdbf652` so step 2.1 does not have
  to re-derive the head of the list: `design-review-after-ui-write` 10,569 B ·
  `design-fidelity` 10,544 B · `settings-ask-protocol` 9,374 B · `ui-audit-gate`
  8,209 B. Bytes, deliberately — the exact-BPE ordering is Phase 4's tokenizer
  path, and a byte figure quoted as a token figure is the claim-11 error. Two of
  these four grew since the source draft measured them, so re-measure rather than
  cite. `road-to-rule-stub-projection` Phase 0 produces the exact-BPE table for
  the whole migrated corpus and hands it to step 2.1.
- **`road-to-stop-gate-honesty`** Phase 2 gains a causal link: detector-C refusal
  rates are predicted to correlate with the flip date on affected machines, so its
  Phase-1 counter should be split before and after the local 12.1 install date.
  This is a prediction to test, not a claim.
- **`road-to-estate-drawdown`** gains the Phase-4 census ratchet above as a
  previously unowned surface.
