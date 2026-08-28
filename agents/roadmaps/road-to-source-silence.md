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
estate_growth_exempt: "Charges +1 on the count half. Warranted on a measurement, not an opinion: re-measured at 905087463, four readable source-token families the denylist does not contain appear in 17 tracked files across 29 lines (strict count; a loose grep reports 19/31 and includes two false positives on the reserved namespace token claude-memories) — every one of them invisible to the gate that exists to prevent exactly this — and the denylist itself publishes 65 harvest-source names in plaintext in a public repository. The leak GREW by two files between d176082 and this pin, which is the argument for owning it now. No existing roadmap owns source confidentiality; the owning rule has no enforcement roadmap and the gate's own config is its largest violation."
estate_offset_exempt: "No archive move is available in this change. The offset is in skip_paths: Phase 2 and 3 are scoped to shrink the gate's exception estate (35 entries at this pin, one of them already dead) instead of growing any file count."
---
# Road to source silence — the gate that hides the sources is where the sources are written down

> **Source:** `agents/tmp.old/source-silence/` — owner directive, 2026-08-27,
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

- [ ] **0.1 Build the full-surface sweep.** One script that scans tracked
      content, tracked *paths*, commit messages on `main`, and (via `gh api`)
      branch names, PR titles and PR bodies, against the current denylist plus
      the shape heuristic from 3.2 in prototype form. Output is a findings list
      with file:line / ref / PR-number anchors.
      verify: the sweep, run at the pinned commit, reports at least the 29 content lines and the filename hit named in the table above.
- [ ] **0.2 Encrypt the census; track only the counts.** The findings list
      itself contains every name this roadmap exists to remove, so it is stored
      `ENC1:` via `src/scripts/_lib/link_crypto.ts`; the tracked artefact
      carries only per-surface counts and the ciphertext.
      verify: `git grep -c 'ENC1:' <census-path>` is at least 1 and `check_no_external_sources` passes on the census file with zero skip_paths additions.
- [ ] **0.3 Extend the deny set from the census.** Every un-denied token family
      the census found is added — as hashes once Phase 1 lands, in a private
      staging file until then, never as new plaintext entries in the tracked
      config.
      verify: re-running the sweep with the extended set reports zero known-token misses on the surfaces it covers.

## Phase 1 — The denylist stops being readable

- [ ] **1.1 Replace plaintext tokens with keyed hashes.** The gate matches
      normalised candidate tokens (lowercased, separator-folded) against
      HMAC-SHA256 digests; the key lives in CI secrets and local `.env`, never
      in the tree. Plain unsalted hashes are explicitly rejected in the design
      note: the candidate space (public repo slugs) is small enough to
      dictionary-reverse, which is why the construction is keyed.
      verify: every `deny` entry matches `^[0-9a-f]{64}$` and none fails it, and the gate still exits 1 on a seeded fixture violation in CI. <!-- corrected-from-reproduction: the authored check was `zero entries matching [a-z].*[a-z]`, which a lowercase hex digest satisfies — the verify could never have passed. -->
- [ ] **1.2 Define the no-key mode loudly.** Without the key the gate cannot
      match, and a silently green gate is the failure mode this roadmap was
      written about. Local runs without the key exit with a distinct code and a
      one-line warning naming the missing capability; CI always has the key and
      always enforces.
      verify: running the gate with the key unset produces the warning exit code, not exit 0; the CI job asserts the key is present before the gate step.
- [ ] **1.3 Write the two-class distinction into the contract.** The rule
      `src/rules/source-confidentiality.md` gains the sentence this whole
      programme rests on: harvest attribution is prohibited everywhere;
      license-required attribution for vendored code is mandatory and lives
      only in the license surfaces (`CREDITS.md`, `docs/THIRD-PARTY-NOTICES.md`,
      `provenance/borrows.jsonl`), which remain the only principled skip_paths.
      verify: the rule file names the three license surfaces by path (`CREDITS.md`, `docs/THIRD-PARTY-NOTICES.md`, `provenance/borrows.jsonl`) and every surviving `skip_paths` entry maps to a key in `skip_reason`. <!-- corrected-from-reproduction: the two-class distinction itself is ALREADY in src/rules/source-confidentiality.md:48-50, so this step narrows to naming the three surfaces in rule prose; and `skip_reason` carries eight keys, not three, so "those three entries" describes no state the config can reach. -->

## Phase 2 — The tracked tree goes quiet

- [ ] **2.1 Opaque codenames replace speaking source references.** Every
      `> **Source:**` header and body reference anchored in the table above is
      rewritten to an opaque round identifier (`inbox-2026-08-g`,
      `source-set S17`); the codename→source mapping exists exactly once, as an
      `ENC1:` line in the Phase 0 census. The findings file named after the
      2026-08-27 round is renamed to its codename with an in-file redaction
      note.
      verify: the extended gate (Phase 1 set + Phase 3 path scan) passes on the whole tree with `skip_paths` reduced per 2.3; `git log --follow` still connects the renamed findings file.
- [ ] **2.2 The gate's test stops teaching evasion.** The fixture slug built
      from concatenated literals at `tests/scripts/check_no_external_sources.test.ts:62`
      is replaced by a synthetic token (`example-denied-slug`) seeded into the
      test's own config fixture, so the test proves matching without publishing
      a real name or demonstrating the bypass technique.
      verify: `git grep --line-number "' + '" tests/scripts/check_no_external_sources.test.ts` returns nothing — it returns **five** lines today (`:61-62`, `:150-152`) — and the explanatory comment at `:56-60` no longer describes how to evade the regex; the test still covers the slug-with-separator case. <!-- corrected-from-reproduction: one site was named, five exist, and the comment teaches the technique. `grep -n` is also rewritten to `--line-number`: the short flag is refused by the block-no-verify guard in this repo. -->
- [ ] **2.3 The skip_paths estate shrinks to the principled core.** Archived
      roadmaps currently excepted by name are redacted in place — readable
      source references replaced by codenames, each with a dated redaction
      marker so the archive edit is visibly a redaction, not a content change.
      The `*.review-input/diff.patch` carve-out is removed once 3.4 lands.
      This step executes whatever governance form the E2 decision in 2.4
      requires.
      verify: `python3 -c "import json; print(len(json.load(open('src/scripts/external_sources_denylist.json'))['skip_paths']))"` prints at most **20**, and every remaining entry maps to a key in `skip_reason` — a gate-own file, a license surface, or a `vendored_cluster` member. <!-- corrected-from-reproduction: 12 is arithmetically unreachable against step 1.3's own carve-outs — 2 gate-own + 3 license surfaces + `validate_safe_paths` is already 6, and the vendored corpus contributes 10 more entries that 1.3 declares legitimate. The realistic floor is 18-20. -->
- [ ] **2.4 Record the archive-redaction decision.** Redacting archived
      roadmaps touches a surface the suite treats as immutable. One ADR
      paragraph states that confidentiality redaction with a dated marker is
      not a content change; if the owner rejects that, 2.3 falls back to
      moving the affected archives behind encrypted wrappers instead.
      verify: the ADR paragraph exists and 2.3's chosen mechanism cites it.

## Phase 3 — The gate learns shape, not just names

- [ ] **3.1 Paths are scanned like content.** The scan loop additionally
      matches every tracked file *path* against the deny set, so a filename or
      directory name carrying a source token fails the same way a content line
      does.
      verify: a CI fixture with a denied token only in its filename makes the gate exit 1.
- [ ] **3.2 The attribution-shape heuristic lands.** Independent of any name
      list, the gate flags: a `> **Source:**` header whose value is not an
      opaque codename or `ENC1:` link; any quoted `agents/tmp(.old)?/<name>/`
      path whose `<name>` is not an opaque round identifier; and `owner/repo`
      slugs or `github.com` URLs outside a small allowlist (own org, integrated
      tools per the recommendation carve-out). The first two block; the slug
      class starts at the level the E4 blocker decides.
      verify: three fixtures — a speaking Source header, a speaking tmp quote, an un-allowlisted slug — produce the configured block/warn results in the gate's test.
- [ ] **3.3 skip_paths becomes a ratchet.** A check fails when the skip_paths
      count exceeds its recorded baseline; lowering the baseline is free,
      raising it requires a blocker reference in the same diff.
      verify: a CI fixture adding a 13th skip_path without a blocker reference fails the ratchet check.
- [ ] **3.4 Evidence snapshots are redacted at write time.** The review-input
      snapshot generator runs deny-set redaction over `diff.patch` and sibling
      files before writing, replacing hits with `[REDACTED:src-conf]`, so the
      evidence chain stays intact while the carve-out from 2.3 can be deleted.
      verify: generating a snapshot from a fixture diff containing a denied token yields the redaction marker, and the global `diff.patch` skip_path entry is gone.

## Phase 4 — The pipeline stops producing leaks upstream

- [ ] **4.1 The inbox command mandates opaque intake.**
      `src/domains/analysis-workbench/analyze/inbox/command.md` requires: inbox
      directories under `agents/tmp/` are created under opaque round
      identifiers; the true source is recorded once, `ENC1:`-encrypted, in the
      round's own intake note; roadmap Source headers cite the codename only.
      The directory name is the root of the whole leak chain — if it is opaque,
      nothing readable exists to be quoted.
      verify: the command file contains the naming rule and the encrypted-intake step; the roadmap template's Source line shows the codename form.
- [ ] **4.2 A hook guards tmp naming at creation time.** A write-time hook on
      `agents/tmp/**` rejects new directories whose names match the slug
      heuristic or deny set, pointing at 4.1's convention.
      verify: creating `agents/tmp/<real-looking-slug>/` in the hook's test harness is rejected; an opaque identifier passes.
- [ ] **4.3 GitHub metadata joins the gated surface.** A CI job on
      `pull_request` checks branch name, PR title, PR body and the PR's new
      commit messages against the hashed deny set plus the 3.2 heuristic; a
      pre-push hook gives authors the same check locally before the metadata
      becomes public.
      verify: a test PR (or the job's dry-run fixture) with a denied token in the branch name fails the metadata job; the pre-push hook script exists and is referenced from the contributor docs.

## Phase 5 — The standing public record, and the ratchet

- [ ] **5.1 Edit what is editable — one owner confirmation, at execution.**
      Existing PR titles and bodies that the Phase 0 census flagged are edited
      on GitHub to codename form; merged source branches with speaking names
      are deleted. Editing metadata is reversible-cost; **deleting a ref is
      not**, and both are outward-facing mutations of public state, so this
      step is a Hard-Floor action under `non-destructive-by-default`: the agent
      presents the census-derived list — every PR number, every ref — and waits
      for a this-turn confirmation naming it. No standing mandate, no roadmap
      authorization and no earlier approval substitutes.
      verify: re-running the 0.1 metadata sweep against the live repo reports zero hits on PR titles/bodies and branch refs, and the confirmation is recorded in this file beside the step.
- [~] **5.2 The history decision is put to the owner, once — decision only,
      never execution.** The `whether-history-gets-rewritten` blocker records
      the rewrite trade-off; whichever way it resolves, the resolution is
      written into this roadmap and the census counts what remains as accepted
      residual, so "clean" always means "clean minus the recorded residual",
      never an unstated hope. **This step produces an answer and nothing else.**
      A `git filter-repo` over `main` is a Hard-Floor rewrite of published
      history; should the owner choose it, execution is a separate change with
      its own confirmation, never a checkbox flipped here.
      verify: the blocker is resolved in-file and the census artefact carries a `residual:` count field. <!-- corrected-from-reproduction: authored as `- [ ]`, which reads as an executable step for an owner decision the roadmap itself recommends against; deferred until the blocker resolves. -->
- [ ] **5.3 The sweep becomes standing evidence.** The Phase 0 sweep runs as a
      scheduled job; a claims entry `plaintext-source-attribution` asserts zero
      hits on content and paths at HEAD, wired to `check_claims` like every
      other ledger claim.
      verify: `docs/CLAIMS.md` contains the claim with `kind: qual` or measured kind, and `check_claims` verifies it green at HEAD.

## Blockers

### blocker: where-the-key-lives

- **Status:** open
- **Owner:** maintainer
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

- **Status:** open
- **Owner:** maintainer
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

- **Status:** open
- **Owner:** maintainer
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

- [ ] AC-1 — The tracked `deny` array holds no readable source name: every
      entry matches `^[0-9a-f]{64}$`, and the gate still exits 1 on a seeded
      fixture violation in CI.
- [ ] AC-2 — The gate refuses a source token in a **path** and in a **`> **Source:**`
      header, not only in a content line: three fixtures (denied token in a
      filename, speaking `agents/tmp(.old)?/<name>/` quote, un-allowlisted
      `owner/repo` slug) produce the block/warn results the
      `how-loud-the-slug-heuristic-is` blocker decided.
- [ ] AC-3 — A keyless run of the gate is loud, never green: with the key
      unset the gate exits with its distinct warning code, and the CI job
      asserts key presence before the gate step.
- [ ] AC-4 — The full-surface sweep (tracked content, tracked paths, `main`
      commit subjects, branch refs, PR titles and bodies) reports **zero**
      hits at HEAD, with whatever the history blocker recorded as accepted
      residual named and counted — never left as an unstated hope.
- [ ] AC-5 — A new inbox round cannot restart the chain: creating a
      non-opaque directory under `agents/tmp/` is rejected at write time, and
      the `/analyze:inbox` command file carries the opaque-intake rule and the
      `ENC1:` intake step.
- [ ] AC-6 — `skip_paths` is a ratchet at or below 20 entries, every survivor
      maps to a key in `skip_reason`, and raising the count requires a blocker
      reference in the same diff.

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
