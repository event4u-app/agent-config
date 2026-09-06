---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Unblocks a 16-day-old parked stub (road-to-first-reference-analysis-run) and a pre-registered claim with a 180-day expiry window; the work exists to close two open estate entries, not to add a third."
estate_offset_exempt: "Offsets nothing on landing by design — the stub it closes is disposed in its final phase, so the disposal cannot be banked in the same change that opens the work."
---
# Road to the bounded reference-harvest loop

> **Source:** `agents/tmp.old/inbox-2026-09-h/` — verified against the tree at `93d63073e` on 2026-09-05.

## Goal

Make one command the only place in this package that analyses an external repository, give it a bounded refinement loop with three differently-scoped review lenses, stop it from writing source identity into tracked files, and put a thin harvester in front of it that walks the roadmap estate's encrypted reference tokens and feeds unique repositories through it one at a time without producing one roadmap per repository. Done when: the analysis command carries a machine-readable `limits:` contract whose lines the body restates, a single deterministic discovery script reports the estate census and writes nothing outside the gitignored local area, an interrupted batch resumes without re-running a completed repository, and one real analysis has run end to end under the command's own contract with its outcome written honestly into the pre-registered claim row.

Four things the drafts proposed are **not** in this roadmap because the tree already has them, and each one prevented a phase: the analysis command itself already exists with anchor-table-first ordering, a `--deep` clone tier, an interop probe, verdict convergence and ledger rows (`src/domains/analysis-workbench/analyze/reference-repo/command.md`, 361 lines) — so this is an extension, not a build; the encrypted-link primitive with project → global → environment key resolution already exists (`src/scripts/_lib/link_crypto.ts:216`); the gitignored local landing zone already exists (`.gitignore:290`); and the measurement of whether this loop is worth its cost is already pre-registered with a falsification bar fixed before the data (`docs/CLAIMS.md:487`), so no second evaluation is built. Two further draft proposals were dropped on verification rather than deferred: a "generic bounded-analysis-loop primitive" whose stated premise is refuted by the only existing consumer (`src/domains/meta/optimize/deep/command.md:11-16` ships `mode_default: plan` together with `max_iterations: 3`), and a reuse of a "canonical roadmap-estate reader" that does not exist in `src/scripts/_lib/`.

## Phase 1 — One analysis engine, one name

- [ ] **1.1 Rename `analyze/reference-repo/` to `analyze/repo/`** and set `name: analyze-repo`, `sub: repo`, `replaces: [analyze-reference-repo, analyze:reference-repo]`. `visibility: internal` and `workspaces: [agent-config-maintainer]` are already correct and stay. `replaces:` is the house alias mechanism, so no deprecation window and no second living implementation.
      verify: `./scripts-run src/scripts/skill_linter` reports 0 FAIL; `task sync` produces `dist/agent-src/commands/analyze/repo.md` and no `reference-repo.md`.
- [ ] **1.2 Update every inbound reference in the same change** — 18 files under `src/` and `docs/` name the old command, 17 of them outside `docs/archive/`; `src/rules/external-reference-deep-dive.md` calls it "the canonical flow" and must name the new one. `src/config/gate-violation-baselines.json` stays unchanged; its mention is a historical note, not a pointer. `corrected-from-reproduction` — the drafts asserted 16 files.
      verify: `grep -rln 'analyze-reference-repo\|analyze:reference-repo' src docs` returns only the `replaces:` line, the changelog, `docs/archive/`, and the baseline note.
- [ ] **1.3 Add the named chain exception to the cluster head.** `src/domains/analysis-workbench/analyze/command.md:116` forbids chaining sub-commands; the harvester is the single exception and gets one sentence saying so: it invokes `repo` once per repository, each in its own subagent, sequentially, never in the orchestrator's own turn and never as a fan-out.
      verify: the line at `:116` still forbids chaining generally and names exactly one exception; `routes_to` in the head's frontmatter lists `analyze-repo` and `analyze-roadmap-repos`.

## Phase 2 — A bounded loop with three different questions

- [ ] **2.1 Add the `limits:` block** to `analyze:repo`: `mode_default: plan`, `max_iterations: 3`, `hard_ceiling: 5`, `no_gain_stop: 2`, `target_metric: required`, and restate every one of those lines in the command body — the schema requires the body to carry what the frontmatter pins. The command has no loop contract today; its only convergence is inside the verdict table. `corrected-from-reproduction` — the loop contract goes on this command directly; no generic primitive is extracted first, because the schema already permits plan-mode loops and would give the primitive exactly one other consumer.
      verify: the command-schema test passes; `grep -c 'max_iterations\|hard_ceiling\|no_gain_stop' ` over the command body returns a hit for each limit line.
- [ ] **2.2 Pin the upstream revision before any reasoning.** The seed pass resolves the reference's head revision once; all three loops read that same revision; only `--refresh` re-resolves. Loop *n* cannot read deeper than the seed pass without a local clone, so `--deep` becomes the default whenever the loop runs, and the per-loop read ceiling is logged when it is hit.
      verify: a run's iteration record shows one resolved revision repeated on every pass, and one read-ceiling line per loop that hit it.
- [ ] **2.3 Give the three loops three different jobs.** Loop 1 Coverage — what was missed, what was wrongly marked absent, which rows have a weak anchor. Loop 2 Adversary — was the form copied instead of the principle, is this only different rather than better, does this package already solve it elsewhere, what does it cost in tokens, surface and maintenance. Loop 3 Convergence — resolve contradictions, fold duplicates, cut the speculative, bind every remaining line to evidence on both sides. Each loop takes the previous analysis **and** the previous roadmap as input and appends its own delta row (added / removed / flipped / folded, with a reason per line) to the existing `## Iteration record`.
      verify: a run with three loops writes three delta blocks, each naming its lens; a loop whose delta block is empty of added, removed, flipped and folded entries is recorded as a zero-delta loop, not omitted.
- [ ] **2.4 Make the target metric a decision-quality measure**, not an output-volume one: the count of ADOPT/ADAPT rows carrying a concrete `file:line` on both the reference side and this package's side. Halt on spin after two consecutive zero-delta loops; a contested verdict table stops the run with a maintainer question. A zero delta in one lens never cancels the remaining lenses — it is a signal about that lens, not about the next one.
      verify: a fixture run in which loop 1 produces zero delta still executes loop 2; a fixture run with two consecutive zero-delta loops stops before the next one and says why.
- [ ] **2.5 Drop the mandatory scope menu.** `src/domains/analysis-workbench/analyze/reference-repo/command.md:46-58` opens with a four-option prompt ending in "Wait for the user's choice", which in a batch is a prompt per repository. A bare repository argument means full scope; `--focus` means focused; the only remaining question is an unresolvable repository identity. The write-acts (roadmap landing, ledger rows) keep their confirmations.
      verify: a fixture invocation with an explicit repository argument asks nothing before its first fetch.

## Phase 3 — The output stops naming its source

- [ ] **3.1 Derive an opaque id** from the canonical repository identity and the pinned revision, and keep the plaintext-to-opaque mapping only in the local manifest under the gitignored area.
      verify: the opaque id is stable across two runs at the same revision and differs across revisions.
- [ ] **3.2 Move every pass and loop artefact to `agents/.harvest-local/repo/<opaque-id>/`** and stop writing `agents/evidence/analysis/compare-*.md`. That directory is already gitignored (`.gitignore:290`) and already exists; only `compare-*.md` is covered under the evidence directory (`.gitignore:285`), so any other tracked name there would be unprotected.
      verify: `git status --porcelain` after a full run shows nothing new except the tracked roadmap the run deliberately landed.
- [ ] **3.3 Name the tracked roadmap after the defect, never after the source.** Today the command offers `agents/roadmaps/adopt-<owner>-<repo>.md` (§ 7 option 1) with the plaintext URL in the document header — a tracked filename carrying the source identity. The landed roadmap is named for the capability gap and carries a provenance block with an encrypted token instead.
      verify: `./scripts-run src/scripts/check_no_external_sources` passes; the landed filename contains neither the owner nor the repository name.
- [ ] **3.4 Never pass plaintext to the subagent.** The orchestrator hands the subagent the opaque id; the subagent reads the URL from the local manifest itself. The cost of this is one indirection and it is taken on precaution — whether a transcript or audit log would actually retain the argument is host-dependent and was not verifiable from the tree.
      verify: the harvester's body contains no step that passes a resolved URL as an argument; the manifest read is the only resolution point.

## Phase 4 — Deterministic discovery and a thin harvester

- [ ] **4.1 Write one discovery script**, not a module family — discover, decrypt, classify, canonicalize, deduplicate, write the manifest, in the house form of `src/scripts/sweep_source_surfaces.ts`: refuse without a key rather than skipping silently, and never decrypt to stdout except at a terminal. Reuse `src/scripts/_lib/link_crypto.ts` rather than reimplementing the token format, and reuse its token regex from `sweep_source_surfaces.ts:587`. `corrected-from-reproduction` — the script enumerates the five roadmap directories itself; no shared estate-reader library exists to depend on.
      verify: a dry run reports 149 token occurrences, 117 unique tokens across 63 files, with 57 files in the archive directory, 6 in the later directory and 0 at the active level — the census re-derived by hand at this tree.
- [ ] **4.2 Classify after decryption, never from the surrounding prose.** The tokens are a mixed pool — repositories, articles, threads, packages, a paper, a video — and the descriptors around them are inconsistent enough that a proximity count is not reproducible. Classification reads the resolved URL: a repository host or a `.git` suffix is a repository; anything else is recorded as not-a-repository and never analysed. `corrected-from-reproduction` — the drafts' descriptor census did not reproduce.
      verify: unit tests cover extraction (a prose placeholder is not matched), canonicalization (four spellings of one repository collapse to one identity), and classification (a documentation URL is not a repository).
- [ ] **4.3 Deduplicate on identity plus pinned revision, never on the token.** Encryption is randomised, so two tokens for one repository do not compare equal; and one repository at two historical pins is two pieces of evidence, not one. Each unique entry fans in the roadmap files that cited it.
      verify: a fixture with two distinct tokens for one repository yields one manifest entry with two citing files; a fixture with two revisions of one repository yields two entries.
- [ ] **4.4 Write a resumable manifest** under the gitignored area, one line per identity, with an explicit status vocabulary covering pending, running, done, skipped-as-not-a-repository, skipped-as-duplicate, skipped-as-fresh, blocked-on-missing-key, blocked-as-unresolvable, and failed. Freshness is keyed on identity, upstream revision, contract version, loop count and focus — **not** on this package's own revision, which would change with every commit and make every entry permanently stale.
      verify: interrupt a run after the second repository and resume; repositories one and two do not run again, and the run says which entries it skipped and why.
- [ ] **4.5 Add the harvester command** at `analyze/roadmap-repos/`, `type: orchestrator`, `visibility: internal`, with no analysis steps in its body at all: call the script, read the manifest, dispatch one subagent per repository, then run the ownership pass. Default batch limit is small; every external fetch is spent deliberately.
      verify: the command body contains no analysis instruction; every analysis reference points at `analyze-repo`.

## Phase 5 — One gap, one roadmap, and one real run

- [ ] **5.1 Gate every new roadmap behind an ownership check.** Before a run lands anything, it consults `src/scripts/roadmap_context.ts` and the run's own candidate registry and picks one disposition per repository: no action, already planned, extend an existing roadmap, create a follow-up, create new, or contested. Three repositories showing the same gap strengthen the evidence on one owning roadmap; they do not create three.
      verify: a fixture with two repositories surfacing the same gap produces one roadmap with two registered sources, and `./scripts-run src/scripts/check_estate_count` stays green.
- [ ] **5.2 Run one real analysis end to end under the command's own contract** against a small reference, before any batch work, so the pre-registered claim's window is not spent on scaffolding. The claim at `docs/CLAIMS.md:487` requires each of the next two runs to produce at least one interop-probe finding at `file:line` precision **and** at least one bound-claim routing, compared against a shadow run of the pre-upgrade command text.
      verify: the run's artefacts exist under the gitignored area and the iteration record shows the contract's passes; nothing about the outcome is asserted before the run.
- [ ] **5.3 Write the outcome honestly into the claim row** — backed or honest null, with the null consequence the claim already specifies, and no goalpost moved after the data. Then dispose of `agents/roadmaps/stubs/road-to-first-reference-analysis-run.md`, whose two stated trust boundaries (an outbound third-party fetch and raw named evidence) are exactly what Phases 3 and 4 resolve.
      verify: the claim row carries a `last_verified` date and a status that matches what the runs produced; the stub is archived and the archive index regenerated.

## Blockers

### blocker: wave-consolidate-estate-slot

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5 — One gap, one roadmap, and one real run
- **Recommendation:** none; this is the owner's call — it turns on how much of the estate's growth allowance a recurring, automated process may consume, which is a policy decision, not a technical one.
- **If you do nothing:** every run keeps writing its consolidated result to the gitignored local area only, so no batch is visible in the roadmap dashboard, and the estate-ratchet allowance question stays open indefinitely.
- **What to do:**
  1. Decide whether a per-run consolidate roadmap may take an active top-level estate slot, or whether consolidated results stay local-only, or land in the parked directory instead.
  2. Record the decision (e.g. a short note in `docs/decisions/` or an update to this blocker) and, if a slot is granted, adjust the T2/T4 boundary conditions in `src/scripts/check_estate_count.ts` to account for the recurring addition.
- **Resolved when:** the owner states either that a per-run consolidate may take an active top-level slot, or that consolidated results stay local-only or land in the parked directory.

One draft lineage proposes a per-run consolidate roadmap landing at the active top level so a batch is visible in the dashboard; the other proposes no wave roadmap at all, because a batch having run is not by itself a reason to create an estate entry. The disagreement is not resolvable from tree evidence: it is a question about how much of the estate's growth allowance a recurring, automated process may consume.

The boundary is the estate ratchet (`src/scripts/check_estate_count.ts`, T2 and T4). The active floor is currently 1, and an addition that cannot be offset raises the allowance by one — permanently, per run, if a recurring process is permitted to take one each time. Raising one's own growth allowance is not a decision an agent may take, so this stays with the owner rather than being resolved by recommendation.

Blocks: the landing-zone half of Phase 5 step 5.1 — the fold gate itself is unaffected, but where a run's consolidated result lands is undecided. Until the decision lands, a run writes its consolidated result to the gitignored local area only.

Resolved when: the owner states either that a per-run consolidate may take an active top-level slot, or that consolidated results stay local-only or land in the parked directory.

## Open questions

Carried deliberately as questions rather than as steps, because each refines a mechanism that does not exist yet and would otherwise be built before it has anything to refine:

- Whether resume state needs a per-pass state machine (seed done, loop 1 done, loop 2 done, finalizing) rather than the status vocabulary in step 4.4. Revisit after the first interrupted batch shows where it actually resumes badly.
- Whether freshness should become capability-sensitive, so that an unrelated documentation commit in this package does not invalidate historical analyses. Step 4.4 already excludes this package's revision from the key, which is the cheap version of the same fix; the expensive version waits for evidence that it is needed.
- Whether the not-a-repository tokens (articles, threads, a paper, a video) should be routed to inbox analysis rather than only recorded in the manifest.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Source identity leaks into a tracked surface | implementation | Filenames, document headers, subagent arguments and error snapshots are all surfaces; the command leaks through two of them today (`command.md` § 6 slug rule and § 7 draft path) | Phase 3 in full — opaque id, gitignored artefacts, defect-derived filename, no plaintext argument; verified by `check_no_external_sources` and a `git status` check after a run | Phase 3 — The output stops naming its source |
| 2 | The loop becomes three rewordings | product | Four passes over one reference produce prose churn instead of new findings, and the cost is paid in external fetches | Three named lenses with different questions, a decision-quality target metric, and a delta block per loop that records zero as zero | Phase 2 — A bounded loop with three different questions |
| 3 | The claim window expires unmeasured | product | The pre-registered measurement has a fixed window from its merge, and expiry counts as the bar not cleared, reverting three mechanisms | Step 5.2 runs before any batch work, so scaffolding does not consume the window | Phase 5 — One gap, one roadmap, and one real run |
| 4 | Batch output floods the estate | product | Over a hundred unique tokens, each capable of proposing a roadmap, against an active floor of 1 | Ownership fold gate and candidate registry in step 5.1; a small default batch limit in step 4.5; landing zone undecided and local-only until the blocker resolves | Phase 5 — One gap, one roadmap, and one real run |
| 5 | The rename breaks inbound references | implementation | 18 files name the old command, one of them a rule calling it the canonical flow | Step 1.2 in the same change, with a grep as its verification | Phase 1 — One analysis engine, one name |
| 6 | Context exhaustion during a batch | implementation | Over a hundred identities at four passes each cannot share one session | One subagent per repository, sequential, no fan-out; the manifest is the only shared state | Phase 4 — Deterministic discovery and a thin harvester |
| 7 | The discovery script silently under-reports | implementation | A missing key, a prose placeholder matched as a token, or a repository host not in the pattern set all produce a quietly short census | Refuse-without-key rather than skip; unit tests for extraction, canonicalization and classification; the dry-run census is checked against the hand-derived figures in step 4.1 | Phase 4 — Deterministic discovery and a thin harvester |

## Acceptance Criteria

- [ ] AC-1 — A single command directory holds the repository-analysis engine; the old name resolves through `replaces:`; no second implementation and no alias command exist.
- [ ] AC-2 — That command's frontmatter carries a `limits:` block and its body restates every limit line.
- [ ] AC-3 — A run with three loops leaves three delta records, each naming a different lens, and a zero-delta loop is recorded rather than skipped.
- [ ] AC-4 — After a full run, the only new tracked file is the roadmap the run deliberately landed; the source-name check passes and no landed filename contains the reference's owner or repository name.
- [ ] AC-5 — The discovery script's dry run reproduces the estate census by hand-checkable counts and writes nothing outside the gitignored local area.
- [ ] AC-6 — An interrupted batch resumed with the resume flag runs no repository twice, and fresh entries are skipped unless refresh is requested.
- [ ] AC-7 — Two repositories surfacing one capability gap leave one roadmap carrying two registered sources.
- [ ] AC-8 — The pre-registered claim row carries a verification date and an outcome that matches what the runs produced, and the parked stub is disposed.
