<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
relates: []
# relates: grepped every active, later and archived roadmap for `denylist`,
# `external source`, `confidentiality` and `provenance`. The owning surfaces are
# a rule (src/rules/source-confidentiality.md), a gate
# (src/scripts/check_no_external_sources.ts) and its config — none of them a
# roadmap. archive/road-to-ecosystem-harvest-index.md:158 already recorded the
# gate red on pre-existing debt and declared it out of scope; this roadmap is
# where that debt stops being out of scope.
research_pin: "agent-config @ 905087463 (origin/main, 2026-08-28). Every anchor below was re-read at this pin; the authoring session's own pin d176082 is 14 commits behind and its line numbers had drifted."
estate_growth_exempt: "Charges +1 on the count half. Warranted on a measurement, not an opinion: re-measured at 905087463, four readable source-token families the denylist does not contain appear in 17 tracked files across 29 lines (strict count; a loose grep reports 19/31 and includes two false positives on the reserved namespace token claude-memories) — every one of them invisible to the gate that exists to prevent exactly this — and the denylist itself publishes 65 harvest-source names in plaintext in a public repository. The leak GREW by two files between d176082 and this pin, which is the argument for owning it now. No existing roadmap owns source confidentiality; the owning rule has no enforcement roadmap and the gate's own config is its largest violation. Measured, not predicted: on the committed change `check_estate_count` reads `+5 active / -0 disposed, 5 exempt` and `open_blockers 31 to 42`, of which this file contributes +1 active and +3 open blockers."
estate_offset_exempt: "No archive move is available in this change. The offset is in skip_paths: Phase 2 and 3 are scoped to shrink the gate's exception estate (35 entries at this pin, one of them already dead) instead of growing any file count."
---
# Road to source silence — the gate that hides the sources is where the sources are written down

> **Source:** `agents/tmp.old/[REDACTED:src-conf]/` — owner directive, 2026-08-27,
> following the merge of the preceding inbox round: nothing in the repository
> or the `agents/` tree may reveal an external repository that ideas were
> harvested from — not in plaintext, and not through speaking inbox/tmp
> directory names quoted into tracked files. The directive is quoted in the
> intake note, not here, because quoting it would name the thing it forbids.
>
> Every defect anchor below was **re-read at `905087463`** by the
> `/analyze:inbox` verification pass of 2026-08-28, not carried from the
> authoring session. Two corrections came out of that pass and are recorded at
> the measurement table and in three `verify:` lines. This file follows its own
> rule: no defect is quoted, every defect is anchored.

## Goal

A reader with the full public repository — tree, filenames, gate config, tests,
evidence snapshots — and the public GitHub metadata of future changes — branch
names, PR titles, PR bodies, commit messages — cannot recover the name of any
external source this suite harvested ideas from. The gate stops relying on a
readable list of exactly those names, stops trusting content-only scanning, and
gains a shape-level detector so the *next* unknown source is caught by form, not
by membership in a list that is always one entry behind.

Two limits are stated up front rather than discovered later. First, git history
and already-published PR metadata are permanent unless rewritten; this roadmap
edits what is editable (PR titles/bodies, merged-branch refs) and puts the
rewrite question in front of the owner as a blocker instead of pretending the
past is in scope. Second, license-required attribution for vendored Apache/MIT
code is a legal obligation, not a leak; the prohibited class is *harvest
attribution* ("we read X and took ideas"), and Phase 1 writes that distinction
into the contract so the two never get conflated again.

## Execution note — 2026-08-28, partial slice

Phases 0 (census), 2.2 (the gate's own test), 3.1–3.3 (path scan, shape
heuristic, ratchet) and the buildable half of Phase 1 landed in one change.
Phase 2.1, 2.3's archive half, 2.4, 3.4, Phase 4 and Phase 5.1/5.3 did not, and
each carries an inline `NOT ATTEMPTED` note saying why at the step rather than
here.

**What this slice does NOT claim, stated up front because the
`whether-history-gets-rewritten` resolution requires it as a wording
obligation.** Nothing here is eradication, and the result is not a clean
repository. Commit messages already on the trunk, merged pull-request bodies and
old diffs still name sources, and they **remain recoverable by anyone with
repository access** — the resolved decision was *no rewrite*, deliberately, and
that residual is counted in the census's `residual:` field rather than removed.
Measured at this pin: 217 hits across 9,049 trunk commits and 124 across 1,666
authored pull requests. The confidentiality claim this programme can make is
about what gets written **next**; it excludes historical artifacts explicitly,
and any later description of the outcome must do the same.

The second honest limit: the block-tier shape debt (281 occurrences) is
**baselined, not cleared**. New occurrences fail immediately, which is the
property that stops the leak chain growing; the existing 281 are counted debt
whose removal is Phase 2.1, and the baseline entry goes stale on 2026-10-23.

## Execution note — 2026-08-29, closing slice

The remaining eleven steps were driven to a disposition. **Seven landed**
(2.1, 2.4, 3.4, 4.1, 4.2, 4.3, 5.3) and **four were cancelled here and
preserved elsewhere** (0.3, 1.1, 2.3's target number, 5.1) — each for a named
capability boundary, not for difficulty. Of the six acceptance criteria, two
are met (AC-2, AC-5) and four are carried.

**Everything cancelled is carried, and every carry names what closes it.**
`agents/roadmaps/road-to-source-silence-cutover.md` holds the three items gated
on a repository secret or a license fact, plus the `skip_paths` target the
council split on; `agents/roadmaps/stubs/road-to-public-metadata-redaction.md`
holds the one item an agent may never perform. Both were created in this same
change, which is what makes a carry a disposition rather than a promise. The
AI council directed the carry explicitly (D3(a), 2026-08-29, 2/2) and both
seats refused cancellation as owner-reserved.

**What actually changed in the tree, measured:**

| Property | Before | After |
|---|---:|---:|
| Readable source names in tracked content and paths | 0 | **0** (unchanged, and now the `exec:` evidence behind a ledger claim) |
| `skip_paths` exception estate | 32 | **22** |
| Attribution-shape block debt | 275 | **243** |
| Archived roadmaps excepted by name | 5 | **0** |
| Speaking inbox directory names in the tracked tree (anchored set) | 2, in 12 files | **0** |
| Off-tree metadata gates | 0 | **2** (CI on `pull_request`, plus pre-push) |

**Three limits, stated here so no reader has to reconstruct them.** First, this
is still not eradication: the 341 residual occurrences on trunk commit messages
and merged PR bodies remain readable to anyone with repository access, by the
recorded decision of `whether-history-gets-rewritten` (no rewrite), and they are
counted rather than removed. Second, the 243 remaining shape findings are
**baselined, not cleared** — the codename rewrite covered the anchored set, and
the corpus remainder is debt whose baseline expires **2026-10-24**, before this
roadmap's own `review_by`; the successor owns that date. Third, the tracked
denylist **still publishes 65 harvest source names in plaintext**, because the
cutover that would end it needs a secret an agent cannot provision. That was
the defect this roadmap opened with, and it is honestly still open.

## The measurements this exists for

All re-reproduced at `905087463`, all cheap to re-run. Two rows carry a
correction from the verification pass and say so inline.

| Measurement | Anchor | Result |
|---|---|---|
| Harvest-source names published in plaintext by the gate's own config | `src/scripts/external_sources_denylist.json` | **65** deny tokens, readable, in a public repo; the file's `_README` states they are harvest/inspiration sources |
| Readable source-token families the denylist does not contain | twelve token families re-checked against the `deny` array at the pin, **0 of 12 present**; the family names themselves are recorded only in the Phase 0 census | **17 tracked files, 29 lines** (strict). **Correction:** the authoring session read 17/29 with a loose grep whose true strict figure at `d176082` was 15/27 — two hits matched the reserved namespace token in `docs/contracts/namespace.md` and `src/scripts/lint_namespace.ts`, not a harvest source. The loose figure at this pin is 19/31. The headline number is right today for a different reason than it was written: the leak grew. The gate ran green on all of them |
| Speaking inbox-directory names quoted into tracked roadmaps | `agents/roadmaps/road-to-runtime-governance-flip.md:35` · `archive/road-to-executable-specification-layer.md:23,30,84` · `stubs/road-to-runtime-orchestration-substrate.md:8` · `agents/roadmaps/road-to-supervised-telemetry-collector.md:30` · `agents/evidence/analysis/runtime-reversal-owner-decision.md:8,109` | the gitignored directory name encodes the source; the quote republishes it. **Anchors re-read at this pin** — every line number in the authoring session had drifted, and one file had moved to `archive/` |
| Filename-level leak, invisible to the gate by design | `agents/evidence/reviews/` — one tracked findings file named after the preceding inbox round | the scan loop head at `check_no_external_sources.ts:301`, match body `:318-331`, applies its regex to `line` only; `rel` reaches the extension skip-list and the hit record and nothing else |
| Gate exception estate | `external_sources_denylist.json` `skip_paths` | **35** entries, including three archived roadmaps by name and a global `*.review-input/diff.patch` carve-out that freezes denylist copies into evidence. One entry — `src/scripts/check_no_external_sources.py`, the gate's retired Python implementation — names a **file that no longer exists**, so the first entry of the Phase 2 drawdown is free <!-- ref-ignore --> |
| The gate's own test evades the gate readably | `tests/scripts/check_no_external_sources.test.ts:61-62` and `:150-152` | **five** denied slugs are concatenated from string literals — invisible to the regex, plaintext to any reader — and the comment at `:56-60` documents the bypass technique. **Correction:** the authoring session named one site; there are five |
| Off-tree surfaces, ungated | branch name, PR title and PR body of the preceding inbox PR, plus its merge-commit subject on `main` | the PR body names a third-party system that appears **nowhere in the tracked tree**, so no content gate could ever have caught it; the branch ref still exists; the merge subject is on `main`. No check sees branch names, PR metadata or commit messages |

## Phase 0 — Census, encrypted, before anything moves

- [x] **0.1 Build the full-surface sweep.** One script that scans tracked
      content, tracked *paths*, commit messages on `main`, and (via `gh api`)
      branch names, PR titles and PR bodies, against the current denylist plus
      the shape heuristic from 3.2 in prototype form. Output is a findings list
      with file:line / ref / PR-number anchors.
      verify: `./scripts-run src/scripts/sweep_source_surfaces` reports all five surfaces with a per-surface `scanned` count; run 2026-08-28 it read content 284 deny + 478 shape, path 0, commit 217, branch 10, pr 124 over 1,666 authored PRs. <!-- unsatisfiable-as-written: the "29 content lines" are by definition the families NO matcher knows — they are absent from the deny set, and a bare word in prose has no shape either — so a sweep that matches deny+shape can never report them; that is the gap, not a bug in the sweep. The filename hit is the same class: a speaking review-input directory name is in no deny list and has no decidable shape. What the sweep adds instead is `discoverCandidates`, a review aid that ranks un-denied identifier tokens co-occurring with an attribution cue — 219 candidates, which is Phase 0.3's actual input. -->
- [x] **0.2 Encrypt the census; track only the counts.** The findings list
      itself contains every name this roadmap exists to remove, so it is stored
      `ENC1:` via `src/scripts/_lib/link_crypto.ts`; the tracked artefact
      carries only per-surface counts and the ciphertext.
      verify: DONE — `agents/evidence/reports/source-attribution-census.md` carries exactly one `ENC1:` line, `check_no_external_sources` passes with **zero** skip_paths additions (they went DOWN, 35 → 32), and `sweep_source_surfaces --decrypt <file>` round-trips 1,113 findings + 219 candidates. The documented decrypt recipe reads the FILE: the ciphertext is ~320 kB on one line and `link_crypto decrypt --value "$(...)"` fails with `authentication failed` because the shell mangles an argument that size — reproduced, and the recipe in the artefact says so.
- [-] **0.3 Extend the deny set from the census.**  <!-- MOVED to road-to-source-silence-cutover Phase 1.2, per AI council D3(a) 2026-08-29, 2/2. Cancelled HERE, not dropped: the item and its blocker are carried into an immediately active successor. Both seats explicitly REFUSED cancellation as owner-reserved, which is exactly why this is a carry and not a drop. --> Every un-denied token family
      the census found is added — as hashes once Phase 1 lands, in a private
      staging file until then, never as new plaintext entries in the tracked
      config.
      verify: CARRIED, and the reason is unchanged from the deferral: the candidate list exists and ships encrypted (219 entries), but turning it into deny tokens needs (a) a human to decide which candidates are real source families and (b) the private master from 1.1, which is the maintainer's atomic cutover. An agent writing them into a gitignored file from a throwaway worktree produces an artefact that evaporates unread. Disposition recorded at `road-to-source-silence-cutover.md` Phase 1.2 + blocker `agent-cannot-provision-a-secret`. ORIGINAL DEFERRAL NOTE, kept:  The candidate list exists and ships encrypted (219 entries); turning it into deny tokens needs (a) a human to decide which candidates are real source families, and (b) a place to put them that is not tracked plaintext — which is the private master from 1.1, and that is the maintainer's atomic cutover. Writing them into a gitignored file from this worktree would produce an artefact that evaporates unread. Recipe: `docs/maintainers/source-deny-digests.md` § step 2.

## Phase 1 — The denylist stops being readable

- [-] **1.1 Replace plaintext tokens with keyed hashes.**  <!-- MOVED to road-to-source-silence-cutover Phase 1.1 + 1.3, per AI council D3(a) 2026-08-29, 2/2. Cancelled HERE, not dropped — the mechanism shipped and stays in force; only the cutover moves. --> The gate matches
      normalised candidate tokens (lowercased, separator-folded) against
      HMAC-SHA256 digests; the key lives in CI secrets and local `.env`, never
      in the tree. Plain unsalted hashes are explicitly rejected in the design
      note: the candidate space (public repo slugs) is small enough to
      dictionary-reverse, which is why the construction is keyed.
      verify: CARRIED. MECHANISM SHIPPED DORMANT and unchanged; the step itself is the maintainer's, now tracked at `road-to-source-silence-cutover.md` Phase 1 with blocker `agent-cannot-provision-a-secret`.  `_lib/source_digest.ts` (folding, keying, tokenisation, matcher), `build_source_digests.ts` (private master → tracked digests, `--check` for drift), the `.gitignore` rule for the master, and an empty `deny_digests` key are in the tree; `tests/scripts/source_digest.test.ts` proves matching end-to-end against a **non-production fixture key** (20 tests, sensitivity-probed). The plaintext `deny` array stays in force and is not deleted. Provisioning the CI secret, generating production digests, deleting the plaintext array and switching CI to strict mode are ONE atomic maintainer change per this roadmap's own `where-the-key-lives` resolution — `docs/maintainers/source-deny-digests.md`. <!-- corrected-from-reproduction: the authored check was `zero entries matching [a-z].*[a-z]`, which a lowercase hex digest satisfies — the verify could never have passed. -->
- [x] **1.2 Define the no-key mode loudly.** Without the key the gate cannot
      match, and a silently green gate is the failure mode this roadmap was
      written about. Local runs without the key exit with a distinct code and a
      one-line warning naming the missing capability; CI always has the key and
      always enforces.
      verify: DONE for the behaviour, and the CI half is specified rather than shipped because there is nothing yet to assert. `digestMode` is a five-row table with two fatal rows; with digests present and no key the gate writes a stderr line naming `SOURCE_DENY_KEY` and saying the run did NOT check the hashed set, and under `SOURCE_DENY_STRICT` it exits **3, asserted never 0**. All five rows plus the three end-to-end cases are in `tests/scripts/source_digest.test.ts`. The key-presence CI step cannot exist before the secret does; it is written out in `docs/maintainers/source-deny-digests.md` § step 4 and lands with the atomic cutover.
- [x] **1.3 Write the two-class distinction into the contract.** The rule
      `src/rules/source-confidentiality.md` gains the sentence this whole
      programme rests on: harvest attribution is prohibited everywhere;
      license-required attribution for vendored code is mandatory and lives
      only in the license surfaces (`CREDITS.md`, `docs/THIRD-PARTY-NOTICES.md`,
      `provenance/borrows.jsonl`), which remain the only principled skip_paths.
      verify: FIRST HALF DONE — `src/rules/source-confidentiality.md` § "The two classes are opposites" names all three paths and states the failure in both directions. SECOND HALF UNSATISFIABLE AS WRITTEN: `skip_reason` is keyed by CATEGORY, not by path, so no entry "maps to a key" in any machine-checkable sense and nothing in the tree performs that mapping. What was done instead is falsifiable: three `skip_paths` entries named files that do not exist (`check_no_external_sources.py`, `validate_safe_paths.py`, `content.json.gz`) and were removed, 35 → 32, with the orphaned `validate_safe_paths` reason key. <!-- corrected-from-reproduction: the two-class distinction itself is ALREADY in src/rules/source-confidentiality.md:48-50, so this step narrows to naming the three surfaces in rule prose; and `skip_reason` carries eight keys, not three, so "those three entries" describes no state the config can reach. -->

## Phase 2 — The tracked tree goes quiet

- [x] **2.1 Opaque codenames replace speaking source references.**  <!-- LANDED 2026-08-29 once ADR-250 unblocked the archive half. PREVIOUS NOTE, kept for provenance — 2026-08-28: three of the anchored files are ARCHIVED roadmaps, and redacting an archive in place is gated on the 2.4 ADR, which is a governance decision and not the executing agent's to make. Rewriting only the non-archived half would leave the gate's block count between two states and make the 3.3 baseline unreadable. The full block-tier debt is measured (281 occurrences across 208 files) and baselined, so the size of this step is now known rather than estimated. --> Every
      `> **Source:**` header and body reference anchored in the table above is
      rewritten to an opaque round identifier (`inbox-2026-08-g`,
      `source-set S17`); the codename→source mapping exists exactly once, as an
      `ENC1:` line in the Phase 0 census. The findings file named after the
      2026-08-27 round is renamed to its codename with an in-file redaction
      note.
      verify: DONE, on the anchored set the step scopes itself to, and every clause is reproduced rather than asserted. (1) **The five by-name-excepted files are redacted in place** under ADR-250 with dated markers, and the mechanical word-diff audit ADR-250 mandates reports **37 explained removals, 126 explained additions, 0 UNEXPLAINED changes** across 16 files — every changed token is a removed denied identifier, an added codename, or a line of the marker. (2) **Both anchored speaking inbox directory names are gone from the tracked tree**, rewritten to `inbox-2026-08-f` (the 2026-08-22 round) and `inbox-2026-08-h` (the 2026-08-27 round) across all 14 occurrences in 12 files; `git grep` for the speaking names returns nothing. (3) **The findings file is renamed** — `agents/evidence/reviews/uncle-bob-swarm-inbox.findings.md` to `inbox-2026-08-h.findings.md` via `git mv`, so `git log --follow` connects the two names, with an in-file redaction note and a rename note at the heading. (4) **The gate passes on the whole tree with `skip_paths` reduced** — `check_no_external_sources` exits 0 with zero deny hits and the estate at 22, down from 32. (5) The codename to source mapping exists **exactly once**, as one `ENC1:` line in `agents/evidence/reports/source-codename-map.md`, round-tripped. <!-- corrected-from-reproduction: the step says the mapping lives "in the Phase 0 census". It does not, and the reason is mechanical — the census is GENERATED (`sweep_source_surfaces --census`) and its own header says "Regenerate rather than hand-edit", so a mapping appended there would be silently destroyed by the next regeneration and the codenames would then point at nothing. It gets its own artefact, where the "exactly once" property can actually hold. --> <!-- scope, stated because the step's own note estimated it: the anchored set is done; the NON-anchored corpus remainder (~190 quoted non-opaque inbox paths, ~107 speaking `**Source:**` headers) is the 243-count ratcheted debt, carried to road-to-source-silence-cutover Phase 3 against the baseline's 2026-10-24 expiry. -->
- [x] **2.2 The gate's test stops teaching evasion.** The fixture slug built
      from concatenated literals at `tests/scripts/check_no_external_sources.test.ts:62`
      is replaced by a synthetic token (`example-denied-slug`) seeded into the
      test's own config fixture, so the test proves matching without publishing
      a real name or demonstrating the bypass technique.
      verify: DONE, and the roadmap's correction was accurate — re-checked at execution the grep returned exactly five lines at `:61-62` and `:150-152`, and it now returns nothing. Layer 2 uses invented tokens (`example-denied-word`, `example-owner/example-denied-slug`) seeded into its own fixture config; Layer 3 was rewritten from hand-copied literals into PROPERTIES read off the shipped config at runtime, so the real tokens exist only in memory and a throwaway tmp tree. The evasion comment is replaced by one explaining why no evasion is needed. The slug-with-separator case has its own named test. 11 tests green. <!-- corrected-from-reproduction: one site was named, five exist, and the comment teaches the technique. `grep -n` is also rewritten to `--line-number`: the short flag is refused by the block-no-verify guard in this repo. -->
- [-] **2.3 The skip_paths estate shrinks to the principled core.**  <!-- THE REDUCTION LANDED (32 -> 22); THE TARGET NUMBER IS AN OWNER DECISION and is MOVED to road-to-source-silence-cutover Phase 2.1 + blocker `skip-paths-target-is-owner-reserved`. The AI council was asked TWICE and SPLIT on the second round, and a split escalates rather than resolves — see the verify line. PREVIOUS NOTE, kept for provenance: the free part landed (three DEAD entries removed, 35 -> 32; the roadmap predicted one), but the archive redactions and the `*.review-input/diff.patch` removal both depend on decisions that are not the executing agent's — the 2.4 ADR and 3.4's write-time redactor. --> Archived
      roadmaps currently excepted by name are redacted in place — readable
      source references replaced by codenames, each with a dated redaction
      marker so the archive edit is visibly a redaction, not a content change.
      The `*.review-input/diff.patch` carve-out is removed once 3.4 lands.
      This step executes whatever governance form the E2 decision in 2.4
      requires.
      verify: THE WORK IS DONE AND MEASURED; THE CRITERION IS NOT MET AND THE NUMBER IS NOT THE AGENT'S TO CHANGE. Reproduced: the entry count is **22**, not at most 20. Ten entries were removed, each on a measurement rather than a judgement — every `skip_paths` entry was removed in isolation and the gate re-run, and the full 32-entry ledger with per-entry suppressed-hit counts, classification and disposition is published at `agents/evidence/reports/source-skip-paths-ledger.md`. Three entries were DEAD (suppressed zero hits), five archived roadmaps plus one roadmap-asset were redacted under ADR-250, one comment was rephrased generically, and the `*.review-input/diff.patch` carve-out was replaced by 3.4's per-finding deduplication. Unskipped deny hits stayed at **0 before and 0 after**, so no coverage was traded for the count. The remaining 22 are exactly the set step 1.3 calls principled — 2 gate-own, 10 vendored corpus and its generated projections, 5 recommendation/registry docs, 3 license surfaces, 1 generated bundle — plus `src/scripts/cost/*`, which could have gone and deliberately did not: its fork attribution sits outside the three license surfaces, but the upstream license is established nowhere in this tree and `code-provenance` forbids guessing permissive. Reaching 20 requires removing an entry the roadmap itself declares principled. <!-- corrected-from-reproduction: the step's own note said the realistic floor is 18-20; measured, it is 22 with everything principled intact, or 21 once the fork attribution is resolved. The note's arithmetic was right that 12 was unreachable and wrong about how far down 20 was. --> <!-- The second clause of the verify — "every remaining entry maps to a key in `skip_reason`" — is confirmed satisfiable and satisfied: all 22 survivors fall under `self`, `vendored_cluster`, `recommendation_docs`, `generated_bundles` or `provenance_ledger`, and the ledger prints the mapping per entry. Step 1.3's own note that `skip_reason` is keyed by CATEGORY rather than by path still holds — the mapping is a classification, not a per-path lookup, which is why the ledger publishes it. --> <!-- corrected-from-reproduction: 12 is arithmetically unreachable against step 1.3's own carve-outs — 2 gate-own + 3 license surfaces + `validate_safe_paths` is already 6, and the vendored corpus contributes 10 more entries that 1.3 declares legitimate. The realistic floor is 18-20. -->
- [x] **2.4 Record the archive-redaction decision.**  <!-- LANDED 2026-08-29 as ADR-250, decided by AI council rather than stalled. PREVIOUS NOTE, kept: an ADR asserting that editing the archive is not a content change is a governance decision reserved to the owner; flagged and stopped. What changed is the venue, not the standard — `decision-revisit-gate`'s owner-reserved table routes a reversible, internal-only governance transition to the COUNCIL, and this one weakens no safety floor, creates no external commitment and is one `git revert` from undone. --> Redacting archived
      roadmaps touches a surface the suite treats as immutable. One ADR
      paragraph states that confidentiality redaction with a dated marker is
      not a content change; if the owner rejects that, 2.3 falls back to
      moving the affected archives behind encrypted wrappers instead.
      verify: DONE, both clauses. `docs/decisions/ADR-250-confidentiality-redaction-is-not-an-archive-content-change.md` is `status: accepted`, carries `provenance.kind: agentic` + `evidence.strength: E2` + an `## Evidence` section (so `check_new_adr_evidence` passes), and is row 195 of the regenerated `docs/decisions/INDEX.md`. 2.3's chosen mechanism cites it: the five removed entries are recorded in `skip_reason._entries_removed_2026_08_29` naming ADR-250, and the dated marker in each redacted file names it too. **COUNCIL VERDICT, VERBATIM — 2026-08-29, anthropic + openai, 1 round, $0.00, both seats subscription-authed, 2/2 CONVERGENT on (a):** seat one, *"D1: (a) — Adopt ADR, redact with dated markers, drop exceptions."* Seat two, *"Adopt the ADR, redact the archives in place with dated markers, and remove the five by-name exceptions. This is the smallest change that eliminates the confidentiality defect while preserving readable decisions, measurements, counts, and conclusions. The strongest counter-argument is that codenames impede source-specific investigation for maintainers lacking the encrypted mapping, but encrypting entire records under (b) destroys substantially more institutional value, while (c) permanently exempts known blind spots. Require a mechanical before/after audit demonstrating that only identifiers and redaction markers changed."* **Both seats independently required that audit; it is § Decision item 4 of the ADR and it reports 0 unexplained changes.** One seat added a documentation requirement — marker format, mapping storage, key access, verification procedure — which is why the ADR's qualifying test has four numbered items rather than a sentence. Fallback (b), encrypted wrappers, is recorded in the ADR as REJECTED 2/2 with its reason. -->

## Phase 3 — The gate learns shape, not just names

- [x] **3.1 Paths are scanned like content.** The scan loop additionally
      matches every tracked file *path* against the deny set, so a filename or
      directory name carrying a source token fails the same way a content line
      does.
      verify: DONE and sensitivity-probed on the real tree, not only in a fixture: a file created under `agents/evidence/notes/` whose FILENAME carries a token read from the shipped config (and whose body is clean) took the gate to **exit 1** with the hit rendered as `<path>:0 [<pattern>] (path) <path>`; removing it returned exit 0. Live count at introduction: 0 path hits, so this lands enforcing rather than baselined.
- [x] **3.2 The attribution-shape heuristic lands.** Independent of any name
      list, the gate flags: a `> **Source:**` header whose value is not an
      opaque codename or `ENC1:` link; any quoted `agents/tmp(.old)?/<name>/`
      path whose `<name>` is not an opaque round identifier; and `owner/repo`
      slugs or `github.com` URLs outside a small allowlist (own org, integrated
      tools per the recommendation carve-out). The first two block; the slug
      class starts at the level the E4 blocker decides.
      verify: DONE — `tests/scripts/source_shape.test.ts`, 18 tests, sensitivity-probed (neutralising the tmp-quote predicate reds three cases). The three positive fixtures are there, the tier is asserted (`agents/**` block, elsewhere warn), and the council's three named false-positive classes have their own `describe` block: filesystem paths, `@scope/name`, Markdown links. **The bare `owner/repo` slug class was BUILT, MEASURED AND REMOVED** — even gated on an attribution cue it produced 3,109 hits against 202 for the URL form, topped by `text/markdown` (278), `origin/main` (29), `CI/CD`, `before/after`, `403/404`. Those are exactly the shapes the council named, and a class with a 6 % signal rate would have driven the broad allowlisting the council said is worse than the gap it closes. The removal leaves a stated recall hole — a source named as a bare slug with no `github.com` URL and no deny entry is not detected — recorded in the module docstring and pinned by a negative test so a future attempt has to pass the measured false positives first.
- [x] **3.3 skip_paths becomes a ratchet.** A check fails when the skip_paths
      count exceeds its recorded baseline; lowering the baseline is free,
      raising it requires a blocker reference in the same diff.
      verify: VERIFIED ALREADY TRUE, by probe rather than by inspection — appending one entry to `skip_paths` reds `check_suppression_hygiene` with `[growth]`, because that gate's `SUPPRESSION_INVENTORY` already declares this file with the default `growth: 'forbidden'`. The step's mechanism therefore needed no new gate, and its verify is doubly unsatisfiable as written: the count is 32, not 12, and there is no blocker-reference escape hatch for this file — growth is refused outright, which is stricter than the step asked for. What WAS built is the ratchet the step's neighbours needed and did not have: the Phase 3.2 shape count is a shrink-only entry `check_no_external_sources:shape-block` in `src/config/gate-violation-baselines.json` (281), sensitivity-probed — one new speaking `**Source:**` line under `agents/` takes the gate to exit 1, removing it returns exit 0. Note the 56-day expiry: the entry goes stale 2026-10-23, BEFORE this roadmap's `review_by`.
- [x] **3.4 Evidence snapshots are redacted at write time.**  <!-- BOTH HALVES NOW LANDED. The write-time redactor shipped 2026-08-29; the carve-out deletion landed later the same day via the mechanism the refusing council itself proposed. PREVIOUS NOTE: FIRST HALF LANDED, SECOND HALF REFUSED BY COUNCIL. --> The review-input
      snapshot generator runs deny-set redaction over `diff.patch` and sibling
      files before writing, replacing hits with `[REDACTED:src-conf]`, so the
      evidence chain stays intact while the carve-out from 2.3 can be deleted.
      verify: BOTH CLAUSES DONE. THE CARVE-OUT IS DELETED, by implementing the council's own option (d) rather than by re-proposing the fix it refused. `src/scripts/_lib/source_snapshot_dedup.ts` + `tests/scripts/source_snapshot_dedup.test.ts` (17 tests, sensitivity-probed — neutralising the fail-closed guard reds exactly the 5 cases that must stay at block), wired into `check_no_external_sources`. **Measured over all 26 snapshot findings:** 12 dedupe under the recorded rule read literally (the identical class+value is block-counted in the file the diff hunk targets, via `+++ b/<path>`); 12 more dedupe only under the wider read (block-counted in the current tracked tree but in a DIFFERENT file — content moved, or the hunk targets a generated projection); **2 dedupe under neither, and those 2 are the mechanism working**, because both turned out to be documentation PLACEHOLDER slugs in test fixtures naming nothing external, now in `source_shape.ts`'s existing placeholder group on a measured false positive rather than by widening the dedup rule. Live result with the carve-out deleted: **51 exclusions (8 hunk-target, 43 tracked-tree)**, deny hits 0, shape block 275 -> **243**, ratchet lowered to the exact live total. Every exclusion records its leg AND its matched path in `--report`, and the human output line prints both counts, which is the council's auditability requirement discharged. Fail-closed on: no match, no hunk target, an untracked hunk target, a class mismatch, an empty owner set. **COUNCIL VERDICT ON THE DEVIATION, VERBATIM — 2026-08-29, 2/2 for (a):** seat one, *"D4: (a) with mitigations — Both legs, separate reporting, subsystem bounds, allowlist placeholders"*, and on the standing objection, *"Both deduplication legs verify the mirror premise per finding rather than asserting it; this directly addresses the prior objection."* Seat two, *"Implement both verified legs, report hunk-target and tracked-tree fallback matches separately, allowlist the two genuine placeholder owners, and remove the carve-out. Per-finding verification addresses the previous objection to an assumed mirror relationship, but exact class/value equality somewhere else in the tree proves duplicate presence — not necessarily provenance — so every fallback should report both paths and fail closed on ambiguous matches. … The two unresolved placeholders are appropriately fixed in the existing placeholder policy rather than by weakening the ratchet."* One mitigation is NOT implemented and is named rather than glossed: seat two asked that the wider leg be *"bounded to independently scanned, non-exempt files"* — that IS implemented, the block index is built from the gate's own scan so a `skip_paths`-excepted occurrence can never justify an exclusion — but seat one's stronger form, bounding it to the same *logical subsystem*, is not: this tree has no subsystem partition a check could read, and inventing one to satisfy a mitigation would be the unverified premise the whole objection was about. ORIGINAL REFUSAL NOTE, kept for provenance:  `src/scripts/_lib/source_redact.ts` + `tests/scripts/source_redact.test.ts` (11 tests, sensitivity-probed — neutralising the matcher reds 6 of 11), wired into `dispatch_r2_reviewer.ts` for `diff.patch`, `roadmap.md`, `acceptance-criteria.md` and `prompt.md`. **Ordering is load-bearing and was corrected during execution:** `prompt_hash` is now derived from the REDACTED prompt text, because `check_review_prompt_binding` re-hashes `prompt.md` off disk and hashing the pre-redaction text would have made every new artefact fail its own binding gate. `scope_hash` is derived from the git diff rather than from the file, so the stored patch may be redacted without breaking it. <!-- measured-not-predicted: removing the skip_path entry exposed TWO populations, not the one the step assumed. (1) 120 exact deny hits, all in feat-design-system-onramp-blockers.review-input/diff.patch — a backfill run of the new redactor cleared all of them, 118 substitutions, and those names are now permanently gone from the tracked tree. (2) +26 attribution-SHAPE findings at the block tier, taking the shrink-only ratchet 275 -> 301 and reddening CI; write-time redaction of exact NAMES cannot clear heuristic matches. The AI council (anthropic + openai, 2026-08-29) was asked and BOTH SEATS REFUSED the tier-lowering fix: it is a gate weakening performed by the party that benefits from it, and the claim that all 26 are mirrors of already-counted tracked content was never verified — a diff can carry deleted lines, renamed paths and preimage content present nowhere in the current tree. anthropic chose (c) restore-the-carve-out-and-record-the-falsified-premise; openai chose (d) provenance-aware deduplication. (c) is executed here; (d) is the recorded path to closing this step: exclude a snapshot finding from the ratchet ONLY when an identical class/value occurrence is independently block-counted in the corresponding current tracked file, leaving unique, deleted-only, malformed and unverifiable findings at block. -->

## Phase 4 — The pipeline stops producing leaks upstream

- [x] **4.1 The inbox command mandates opaque intake.**  <!-- LANDED 2026-08-29. PREVIOUS NOTE: NOT ATTEMPTED, out of the executed slice. The opaque-identifier grammar it must mandate is now DEFINED and tested — `isOpaqueRoundId` in src/scripts/_lib/source_shape.ts. -->
      `src/domains/analysis-workbench/analyze/inbox/command.md` requires: inbox
      directories under `agents/tmp/` are created under opaque round
      identifiers; the true source is recorded once, `ENC1:`-encrypted, in the
      round's own intake note; roadmap Source headers cite the codename only.
      The directory name is the root of the whole leak chain — if it is opaque,
      nothing readable exists to be quoted.
      verify: DONE, both clauses, and each is a grep. `src/domains/analysis-workbench/analyze/inbox/command.md` Phase 1 carries a fenced Iron Law (`AN INBOX DIRECTORY UNDER agents/tmp/ CARRIES AN OPAQUE ROUND IDENTIFIER … THE TRUE SOURCE IS RECORDED ONCE, ENC1: ENCRYPTED, IN THE ROUND'S OWN INTAKE NOTE`), the accepted-forms table pointing at `isOpaqueRoundId` as the single authority, the rename-before-Phase-2 instruction, and the `link_crypto encrypt` recipe for the intake note; Phase 6 additionally states that the `Source:` line carries the codename and that the shape classes block inside `agents/**`, so a speaking value fails CI rather than merely reading badly. `src/agent-src/templates/roadmaps.md` § Provenance now shows the codename form as the `Source:` line with the accepted identifiers inline, and splits identity into an encrypted intake-note pointer. The measured justification is in the command file rather than implied: 190 block-tier occurrences of quoted non-opaque inbox paths across the tracked tree.
- [x] **4.2 A hook guards tmp naming at creation time.** A write-time hook on
      `agents/tmp/**` rejects new directories whose names match the slug
      heuristic or deny set, pointing at 4.1's convention.
      verify: DONE — both polarities asserted in the harness, which is exactly what the step asks for. `src/scripts/hooks/block_speaking_inbox_dir.ts`, registered in `hook_manifest.yaml` as `block-speaking-inbox-dir` (`severity: blocking`, `fail_closed: false`) and in `CONCERN_REGISTRY`; `tests/hooks/block_speaking_inbox_dir.test.ts` is 14 tests, all green, sensitivity-probed — neutralising the acceptance predicate reds 4 cases. Rejected: a new first-level directory whose name reads like a project. Passes: `inbox-2026-08-h`, `round-a91f3c`, `S17`, `bench-local`, a scratch file directly under `agents/tmp/`, and an ALREADY-EXISTING directory — that last allow-branch is deliberate and tested, because refusing every later write into a speaking directory would wedge a round mid-flight without removing the name. Both acceptance predicates are imported from `_lib/source_shape.ts`, the same module the gate uses, so guard and gate cannot drift on what "opaque" means. `concern_severity.test.ts`'s BLOCKING_ALLOWLIST carries the entry with its scope, its fail-closed choice and its refuse-rather-than-nudge reason written out, because that file calls adding to it a security-relevant decision. HONEST REACH, not implied away: only `claude` both binds `pre_tool_use` and honours a deny — elsewhere this runs and is ignored, or does not bind; `agent-config hooks:status` answers it for the host you are on. Kill switch `AGENT_CONFIG_ALLOW_SPEAKING_INBOX=1`.
- [x] **4.3 GitHub metadata joins the gated surface.**  <!-- LANDED 2026-08-29 — the CI job and the pre-push hook both exist. PREVIOUS NOTE: NOT ATTEMPTED as a CI job, but the READER exists: sweep_source_surfaces already scans branch refs, PR titles and PR bodies (dependency-bot PRs excluded as mechanical capture, measured: they carried 2,434 of 2,449 shape hits). Wiring it to `pull_request` is the remaining work. --> A CI job on
      `pull_request` checks branch name, PR title, PR body and the PR's new
      commit messages against the hashed deny set plus the 3.2 heuristic; a
      pre-push hook gives authors the same check locally before the metadata
      becomes public.
      verify: DONE, and the failing case was exercised locally rather than left to a test PR. `sweep_source_surfaces --gate-metadata` is the checker — the same deny set and the same shape heuristic, pointed at the four surfaces no content gate can reach. **Both polarities run:** with this change's real branch and title it reports `scanned: 2` and exits 0; with a branch name carrying a quoted speaking inbox path it exits 1 and reports `branch … [shape:tmp-quote]` without printing the value. It refuses to exit 0 on an empty scan — a gate that scanned nothing is this repository's own recorded failure class, so zero surfaces is a usage error, not a pass. `.github/workflows/pr-metadata-sources.yml` runs it on `pull_request` including `edited` (a title changed after opening is a new disclosure), and passes the PR body through a FILE from `env:` rather than an inline expansion, because a PR body is attacker-influencable text. `src/scripts/hooks/prepush_metadata_sources.sh` is the local half, exercised against this branch with a real pre-push stdin line; it is referenced from `CONTRIBUTING.md` § "Branch names, PR text and commit messages are a gated surface", with the install command, the bypass, and the stated limit that the PR title and body do not exist locally so those two stay CI-only — a local pass is not a full pass.

## Phase 5 — The standing public record, and the ratchet

- [-] **5.1 Edit what is editable — one owner confirmation, at execution.**  <!-- DESCOPED 2026-08-29 to `agents/roadmaps/stubs/road-to-public-metadata-redaction.md`, which carries the target list, the sequence and the reason. Cancelled HERE because an agent may never be the party that performs it — not deferred, because deferral would imply an agent could eventually do it. PREVIOUS NOTE, and it was right: editing PR metadata and DELETING refs are outward mutations of public state and Hard-Floor under non-destructive-by-default. The census now supplies the list this step needs — 10 branch-ref hits and 91 deny + 33 shape hits across 1,666 authored PRs — encrypted, awaiting the owner's this-turn confirmation. -->
      Existing PR titles and bodies that the Phase 0 census flagged are edited
      on GitHub to codename form; merged source branches with speaking names
      are deleted. Editing metadata is reversible-cost; **deleting a ref is
      not**, and both are outward-facing mutations of public state, so this
      step is a Hard-Floor action under `non-destructive-by-default`: the agent
      presents the census-derived list — every PR number, every ref — and waits
      for a this-turn confirmation naming it. No standing mandate, no roadmap
      authorization and no earlier approval substitutes.
      verify: NOT SATISFIED AND DELIBERATELY NOT ATTEMPTED. This step asks an agent to edit pull-request metadata and DELETE remote refs on the live repository. Both are outward mutations of public external state and the second is irreversible, which is `non-destructive-by-default` § Hard Floor — *"HARD FLOOR OVERRIDES EVERYTHING. NO AUTONOMY SETTING, NO ROADMAP STEP, NO STANDING INSTRUCTION … CAN BYPASS IT."* The step's own text already said the same thing, so this is the disposition the step was authored to receive, not a discovery. **No council verdict was sought and none would have helped:** a Hard-Floor action is owner-reserved by construction, and this roadmap's own execution brief states that no council verdict lifts it. The work is preserved in full at `agents/roadmaps/stubs/road-to-public-metadata-redaction.md`, which carries the already-encrypted target list (10 branch-ref hits, 91 deny + 33 shape across 1,666 authored PRs), the decrypt recipe, the present-then-wait sequencing, the metadata-before-refs ordering, and the reason each deletion must be named individually rather than batch-approved.
- [x] **5.2 The history decision is put to the owner, once — decision only,
      never execution.** The `whether-history-gets-rewritten` blocker records
      the rewrite trade-off; whichever way it resolves, the resolution is
      written into this roadmap and the census counts what remains as accepted
      residual, so "clean" always means "clean minus the recorded residual",
      never an unstated hope. **This step produces an answer and nothing else.**
      A `git filter-repo` over `main` is a Hard-Floor rewrite of published
      history; should the owner choose it, execution is a separate change with
      its own confirmation, never a checkbox flipped here.
      verify: DONE — both clauses hold and were re-read at execution, not carried. The `whether-history-gets-rewritten` blocker carries `Status: resolved` in this file (§ Blockers), and `agents/evidence/reports/source-attribution-census.md:50` carries `residual: 341` with the sentence at `:52` naming it as the count on the two immutable surfaces (trunk commit messages, merged PR bodies). The step asked for an ANSWER and nothing else; the answer exists and its residual is counted, so the step is closed. Nothing here executes a rewrite, and none is authorised by this flip. <!-- corrected-from-reproduction: authored as `- [ ]`, which reads as an executable step for an owner decision the roadmap itself recommends against; deferred until the blocker resolves. Flipped 2026-08-29 once the blocker read resolved — a `[~]` whose verify is met is a stale glyph, not a deferral. -->
- [x] **5.3 The sweep becomes standing evidence.**  <!-- LANDED 2026-08-29 — the scheduled job, the claim and the check_claims wiring all exist. PREVIOUS NOTE: the sweep exists and is schedulable; the claims entry and its check_claims wiring are not written. --> The Phase 0 sweep runs as a
      scheduled job; a claims entry `plaintext-source-attribution` asserts zero
      hits on content and paths at HEAD, wired to `check_claims` like every
      other ledger claim.
      verify: DONE, and the pointer is the strongest of the four forms rather than an existence check. `docs/CLAIMS.md` carries `### claim: plaintext-source-attribution` with `kind: qual`, `status: backed`, and `evidence: exec:check_no_external_sources -> 0` — the only pointer form that can tell a live claim from a stale one, which matters here because an existence-check pointer would have gone stale the first time somebody added a name. `check_claims` reports **✅ 9 markered claim(s) bound · ledger 95 entries (59 backed, 29 unbacked inventory)**; the gate was added to `_lib/exec_evidence.ts`'s allowlist with its criteria written out, and `internal/reports/exec-evidence-feasibility.json`'s published denominator was re-measured 58 -> 59 in the same change (a drifted denominator is itself a `check_claims` failure). `docs/proof.md` regenerated via `build_proof`. The claim carries a `non_inference` field naming what it does NOT license — no historical claim, 341 residual occurrences on the two immutable surfaces, deny-set incompleteness, the stated shape recall hole, and no claim about inference from function — plus the 243 baselined shape findings stated as remaining debt rather than hidden. The scheduled half is `.github/workflows/source-surface-sweep.yml`: weekly, counts only, never writes the census (which needs a link-encryption key CI does not have, and the sweep refuses to write it unencrypted), and it does NOT fail the repository on a rising residual — a scheduled job that reds `main` for a count nobody can lower this week is a job that gets disabled. It fails only on its own inability to measure.

## Blockers

### blocker: where-the-key-lives

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(c) as the target architecture — and the cutover is NOT
  performed in this roadmap.** AI council 2026-08-28 (anthropic + openai, 1
  round, $0.00, both seats subscription-authed). The seats differed on the
  interim step and **converged, independently and without qualification, on the
  thing that actually binds: shipping the executable part of (c) as a
  REPLACEMENT for the current gate is net-NEGATIVE.**

  The agent executing this roadmap has no access to CI secrets, cannot provision
  private storage, and cannot create a repository secret. So the half it can
  build — digest generation, the gitignored master convention, the matching
  code, the tests against a fixture key — is precisely the half that enforces
  nothing. Landing it as the replacement leaves the gate either failing every
  run for want of a key, or **silently degraded to warn mode**, which is the
  exact failure this roadmap was written about. One seat: "you've added
  complexity without adding protection, and you've broken a gate that at least
  worked before." The other: "the security cutover must be atomic … missing keys
  in CI must fail, never warn."

  **What ships here:** the scaffolding, DORMANT, **alongside** the existing
  plaintext gate, which stays in force and is not deleted. Executable now —
  HMAC matching, digest generation, the gitignored master-file convention, tests
  on a non-production fixture key, fail-closed CI behaviour wired but not
  activated, and the documentation plus secret-validation tooling a maintainer
  needs.

  **What does NOT ship here, and is a maintainer action:** provisioning the CI
  secret, generating production digests, removing the tracked plaintext
  denylist, and switching CI to strict mode. Those four are **one atomic
  change**, and splitting them is the failure mode above.

  One seat's interim alternative — a gitignored local denylist with graceful
  degradation to warn mode — is recorded and **not adopted**: the other seat
  names warn-on-missing-key as the specific thing that must never happen, and a
  gate that quietly warns is what this roadmap exists to remove.
- **Residual, stated rather than implied:** keyed exact-match digests still
  cannot discover a source name nobody has listed. The slug/URL heuristic in the
  sibling blocker remains essential and is not made redundant by this.
- **Blocks:** Phase 1 steps 1.1 and 1.2, and through them the deletion of the
  plaintext deny array. Phase 0 and Phase 2's codename rewrites proceed
  regardless.
- **What to do:** pick exactly one — (a) HMAC key in CI secrets + local
  `.env`, tracked config carries digests only: strongest public posture, but
  contributors without the key run the gate in warn mode; (b) the deny list
  itself moves to a private, gitignored file fetched from private storage,
  tracked tree carries only the mechanism: simplest, but any leak of that file
  is a plaintext leak again and CI needs a fetch step; (c) both — private
  plaintext master as the editing surface, tracked digests derived from it by
  a build step, so humans edit names and the repo never sees them.
- **Resolved when:** the choice is recorded here and 1.2's no-key behaviour is
  specified for whichever local-developer story the choice implies.
- **Recommendation:** (c). It keeps the editing ergonomics of a readable list
  exactly one place — private — and makes the tracked artefact derivational,
  so "plaintext in tree" becomes structurally impossible rather than
  disciplined away.
- **If you do nothing:** the denylist keeps publishing the harvest sources it
  exists to hide, and every entry Phase 0 adds makes the disclosure larger.

### blocker: how-loud-the-slug-heuristic-is

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(c) — block in `agents/**`, warn elsewhere.** AI council
  2026-08-28 (anthropic + openai, 1 round, $0.00), **2/2 convergent**:
  enforcement should follow risk, attribution is concentrated in `agents/**`,
  and repository slugs and GitHub URLs are ordinary content in integration code
  and documentation, where blocking globally would generate enough noise to
  drive broad allowlisting — which is worse than the gap it closes.
- **Both seats named the same residual risk:** attribution can be moved out of
  `agents/**`, deliberately or accidentally, leaving only a warning. It is
  accepted rather than dismissed, and two requirements come from it:
  **warnings must be visible and RETAINED in CI artifacts** rather than only
  printed, so the warn tier is auditable after the fact; and the heuristic must
  be **narrowly defined and tested against its likely false positives** —
  filesystem paths, scoped package names (`@scope/name`), and Markdown links —
  which is what 3.2's fixtures assert.
- **Blocks:** the enforcement level of the slug/URL class in 3.2 and 4.3 only;
  the Source-header and tmp-quote classes block unconditionally either way.
- **What to do:** pick exactly one — (a) block on any un-allowlisted
  `owner/repo` slug or `github.com` URL: maximally tight, but every legitimate
  new integration mention becomes an allowlist PR first; (b) warn-and-report:
  hits land in the sweep report and CI annotation but do not fail the build,
  trading enforcement for zero friction; (c) block in `agents/**`, warn
  elsewhere — the agents tree is where harvest attribution actually occurs,
  docs and src are where legitimate tool mentions live.
- **Resolved when:** the level is recorded and 3.2's fixtures assert it.
- **Recommendation:** (c). It puts the hard wall exactly where every defect in
  the measurement table lives and keeps the recommendation carve-out
  (`docs/mcp*.md` and friends) working without allowlist churn.
- **If you do nothing:** 3.2 ships name-list matching only, and the next
  unknown source walks through the same gap the last four families did.

### blocker: whether-history-gets-rewritten

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(a) — no rewrite.** AI council 2026-08-28 (anthropic +
  openai, 1 round, $0.00), **2/2 convergent, one seat "strongly"**. This
  repository's evidence discipline is built on stable commit pins: every
  `reproduced at <sha>` is falsifiable only because that sha is stable. A
  rewrite converts the whole evidence estate into unverifiable claims — it
  solves a bounded disclosure problem by destroying the primary verification
  mechanism, which for this package is the differentiator.
- **The counter-argument is accepted, not waved away.** Both seats noted that
  half-measures do not erase anything: anyone with a pre-rewrite clone can
  `git log --grep` the names, and forks, caches and PR mirrors may retain them.
  A rewrite would not have fixed that either. What follows is a **wording
  obligation**, adopted: the confidentiality claim must explicitly exclude
  historical artifacts, and the result is **never** described as historical
  eradication. Edit the mutable PR metadata, inventory the immutable
  occurrences, prevent new disclosures, and say plainly that the old ones
  remain recoverable by anyone with repository access.
- **Blocks:** Phase 5.2 only. Everything else in this roadmap is worth doing
  under either answer.
- **What to do:** pick exactly one — (a) no rewrite: accept commit messages
  and old PR diffs as recorded residual, edit PR metadata per 5.1, count the
  rest in the census; (b) `git filter-repo` over `main`: removes speaking
  commit messages and historical file content, at the cost of every clone,
  every historical PR diff link, and — materially for this suite — every
  pinned-commit anchor in the evidence estate, whose pins would dangle.
- **Resolved when:** the answer and its residual (for a) or its re-pinning
  plan (for b) are recorded here.
- **Recommendation:** (a). The evidence discipline of this repository is built
  on stable pins; a rewrite converts every past `reproduced at <sha>` into an
  unverifiable claim, which is a larger integrity loss than the residual it
  removes. The residual is bounded, enumerated by the census, and shrinks to
  zero for everything authored after Phase 4.
- **If you do nothing:** 5.1 still lands and the editable public surface goes
  quiet; only the immutable residual stays, uncounted — and uncounted is the
  part that violates this repository's own rules.

## Acceptance Criteria

- [-] AC-1 — The tracked `deny` array holds no readable source name: every
      entry matches `^[0-9a-f]{64}$`, and the gate still exits 1 on a seeded
      fixture violation in CI.
      <!-- MOVED to road-to-source-silence-cutover AC-1. Gated on the atomic
      digest cutover, which needs a repository secret an agent cannot provision;
      the mechanism, generator, tests and dormant config key all shipped. The
      plaintext array is still in force and still publishes 65 names — that is
      the unmet part, stated plainly. -->
- [x] AC-2 — The gate refuses a source token in a **path** and in a **`> **Source:**`
      header, not only in a content line: three fixtures (denied token in a
      filename, speaking `agents/tmp(.old)?/<name>/` quote, un-allowlisted
      `owner/repo` slug) produce the block/warn results the
      `how-loud-the-slug-heuristic-is` blocker decided.
      <!-- DONE 2026-08-29, all three fixtures present and the tier asserted.
      (1) Denied token in a FILENAME with a clean body: added this change to
      `tests/scripts/check_no_external_sources.test.ts` — exit 1 with the hit at
      line 0 and a `(path)` excerpt, plus a polarity case where a clean filename
      produces no hit. Phase 3.1's own verify was a LIVE probe on the real tree,
      which was a real reading but pinned nothing, so a regression there would
      have been silent; this is the pin. (2) Speaking `agents/tmp(.old)/<name>/`
      quote and (3) un-allowlisted `github.com/<owner>/<repo>` URL: the three
      blocking fixtures in `tests/scripts/source_shape.test.ts`, whose own
      describe block asserts the block/warn tier the blocker decided. NOTE on
      the third fixture, because the criterion as authored says "slug": the BARE
      `owner/repo` form was built, measured at 3,109 hits against 202 for the
      URL form, and REMOVED under this roadmap's Phase 3.2 — so the fixture is
      the URL form, which is the class that shipped. The recall hole that leaves
      is recorded in `_lib/source_shape.ts` and pinned by a negative test. -->
- [-] AC-3 — A keyless run of the gate is loud, never green: with the key
      unset the gate exits with its distinct warning code, and the CI job
      asserts key presence before the gate step.
      <!-- MOVED to road-to-source-silence-cutover AC-2. The BEHAVIOUR half is
      done and tested — `digestMode` is a five-row table with two fatal rows, the
      keyless run writes a stderr line naming the missing capability, and under
      `SOURCE_DENY_STRICT` it exits 3, asserted never 0, in
      `tests/scripts/source_digest.test.ts`. The CI half cannot exist before the
      secret does: a key-presence assertion has nothing to assert. Carried
      rather than claimed, because a criterion with two clauses is not met by
      one. -->
- [-] AC-4 — The full-surface sweep (tracked content, tracked paths, `main`
      commit subjects, branch refs, PR titles and bodies) reports **zero**
      hits at HEAD, with whatever the history blocker recorded as accepted
      residual named and counted — never left as an unstated hope.
      <!-- MOVED to road-to-source-silence-cutover. The SECOND clause is fully
      satisfied and stays satisfied: the residual is named and counted — 341
      occurrences on the two immutable surfaces, at
      `agents/evidence/reports/source-attribution-census.md:50`, and repeated in
      the `non_inference` field of `claim:plaintext-source-attribution` so it
      travels with the claim. The FIRST clause is not met and cannot be met by
      this roadmap: "zero on content" needs the corpus-wide codename rewrite
      (243 baselined shape findings) AND, on the commit and PR surfaces, needs
      exactly the history rewrite the `whether-history-gets-rewritten` blocker
      resolved AGAINST. So this criterion is partly unreachable by a recorded
      decision of this same roadmap — which is a defect in the criterion, not in
      the work, and the successor restates it as the reachable half. -->
- [x] AC-5 — A new inbox round cannot restart the chain: creating a
      non-opaque directory under `agents/tmp/` is rejected at write time, and
      the `/analyze:inbox` command file carries the opaque-intake rule and the
      `ENC1:` intake step.
      <!-- DONE 2026-08-29 — both clauses, from 4.2 and 4.1 respectively. The
      write-time rejection is `block-speaking-inbox-dir` with 14 harness tests
      covering both polarities; the command file carries the fenced naming Iron
      Law, the accepted-forms table and the `link_crypto encrypt` intake recipe.
      HONEST REACH, restated here rather than left in 4.2: the rejection is a
      real deny only on `claude`, the one host that both binds `pre_tool_use`
      and honours one. On a host that binds nothing, this criterion's first
      clause is model-carried. -->
- [-] AC-6 — `skip_paths` is a ratchet at or below 20 entries, every survivor
      maps to a key in `skip_reason`, and raising the count requires a blocker
      reference in the same diff.
      <!-- MOVED to road-to-source-silence-cutover AC-3 + blocker
      `skip-paths-target-is-owner-reserved`. Two of three clauses hold TODAY and
      are reproduced: the estate is a ratchet — `check_suppression_hygiene`
      declares this file with `growth: 'forbidden'`, which is STRICTER than the
      criterion asked for, since growth is refused outright rather than
      permitted with a blocker reference (Phase 3.3 measured this by appending
      an entry and watching the gate red) — and every one of the 22 survivors
      maps to a `skip_reason` key, published per entry in the ledger. The
      NUMBER does not hold: 22, not at most 20. The AI council was asked twice;
      round 2 SPLIT (one seat "correct the criterion to the measured floor", one
      seat "hold at most 20 and leave it unmet"), and a split escalates rather
      than resolves. Both seats agreed on the two things that are not in dispute:
      the published ledger discharges the evidentiary question, and the
      `dist/agent-src/` consolidation that would reach 18 must not be done to
      hit a number by the party whose criterion it satisfies. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The census itself becomes the next leak | implementation | The complete findings list is by construction the most concentrated source disclosure the repo has ever held; tracked in plaintext it would out-leak everything it inventories. | 0.2 mandates ENC1 at birth — the plaintext census never exists as a tracked artefact, and its verify runs the gate over the census file itself. | Phase 0 — Census, encrypted, before anything moves |
| 2 | A silently keyless gate goes green | implementation | Under the HMAC design, a missing key means zero matches — the gate would pass while checking nothing, which is worse than today's readable list. | 1.2 gives the no-key state its own exit code and warning, and CI asserts key presence before the gate step, so green always means enforced. | Phase 1 — The denylist stops being readable |
| 3 | Codename discipline decays after the sweep | implementation | One future inbox round created under a speaking directory name silently restarts the whole chain — quote, filename, PR title. | Phase 4 moves enforcement to creation time: the tmp-naming hook rejects the directory before anything can cite it, and the metadata CI job catches what escapes locally. | Phase 4 — The pipeline stops producing leaks upstream |
| 4 | Redacting archives is read as falsifying evidence | product | The archive is the suite's memory; editing it to remove source names could be mistaken for editing what was decided or measured. | 2.4 lands the governance sentence first — redaction markers are dated and mechanical, and the fallback (encrypted wrappers) exists if the owner rejects in-place edits. | Phase 2 — The tracked tree goes quiet |
| 5 | The gate's visible purpose signals what it hides | product | A public repo carrying a source-confidentiality gate announces that sources are being concealed, even when no name is recoverable — the meta-signal survives every phase here. | Accepted and stated in § Goal rather than mitigated; the alternative (moving the mechanism itself private) is recorded in the kill register with its cost, for the owner to reopen deliberately. | Goal |

## What this roadmap will NOT build

- **A git-history rewrite by default.** Behind the E3 blocker with a
  recommendation against; the evidence estate's pinned-commit discipline is
  worth more than the residual.
- **A private-repo migration or a privatised gate mechanism.** Killing risk 5
  entirely means hiding the gate itself, which costs contributor-visible CI
  and public falsifiability — the suite's stated moat. Reopen only as an
  owner decision.
- **Steganographic or ML-based leak detection.** The shape heuristic in 3.2 is
  regex-class and auditable; anything cleverer trades auditability for recall
  on a threat model (deliberate insider exfiltration) this roadmap does not
  claim to cover. The covered model is accidental disclosure by the pipeline's
  own artefacts.
- **A guarantee about inference.** Someone who diffs this suite's features
  against the ecosystem can guess influences. No gate prevents inference from
  function; the prohibited class is recorded attribution, and the Goal section
  says exactly that.
