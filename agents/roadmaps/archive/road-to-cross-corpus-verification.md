---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Roadmap: A cross-corpus proposal is measured before it is adopted

> The seven-phase plan an external comparison produced is checked claim by claim against the live tree, the three defects the check actually found are repaired, and the four axes it disproved are recorded so nobody re-argues them from the same stale numbers.

## Goal

Convert an external comparison artifact into the only two outputs it earned: **the three measured defects it exposed, repaired**, and **a durable record of what the measurement falsified** — so the proposal's larger phases cannot re-enter the tree on premises that are already known to be wrong.

## Prerequisites

- [x] Read the inbox artifact in full (`agents/tmp.old/ac-compare-1/`), both the proposed roadmap and the transcript that produced it.
- [x] Verify all seven claimed defects against `origin/main` @ `26c575f66` — three independent read-only passes plus direct spot checks.
- [x] Read `docs/CLAIMS.md § code-graph-retrieval-null` and `docs/decisions/ADR-220-skill-invocation-attestation.md` — the two standing locks the proposal's largest phases would have to reopen.

## Context

**What arrived.** An external comparison artifact proposing seven "confirmed defects" (D1–D7) and a seven-phase roadmap, pinned against `97e2937` and drawing on six external comparator corpora. Every claim carried a `file:line`. The artifact's own method statement says each phase starts from *"a confirmed agent-config defect verified against the live tree"*.

**What the verification found.** Of the seven defects, **one survives intact, two survive with the cure forbidden or already owned, three are false or dead as stated, and one points at a roadmap that does not exist.** The measurements, all re-derived rather than trusted:

- **D1 — "115 rule files, ~54,650 words, all always-active."** Measured: 115 files, **57,291** words, and the frontmatter splits **9 `always` (3,842 words) / 101 `auto` (52,745 words) / 5 `manual`**. Only the nine-rule kernel is unconditional. The "largest single lever" the proposal's ordering rationale rests on — an ~80 % cut to an always-on payload — is measuring a payload that is not always-on. The router genuinely has no *hook* consumer (0 hits for `dist/router.json` across all 38 manifest-declared script paths), but `docs/adrs/router/0001-three-tier-routing.md:25` makes the **agent** the reader, prompt-level, so the absence is the design rather than the defect. The manifest declares **38** concerns, not the claimed 53.
- **D1's real residue, which the proposal did not name.** `src/agent-src/templates/AGENTS.md:17` ships the line "**Behavior rules (always active)** — `.augment/rules/`" to every consumer, while **line 29 of the same file** says "kernel = 9 Iron-Law rules; tier-1 / tier-2 routed via `dist/router.json`". A file that contradicts itself about which rules are always active is the honest defect behind D1's framing, and it is two lines from the claim that missed it.
- **D2 — "No runtime learning loop."** Dead. `src/scripts/hook_manifest.yaml:209` wires a `memory-learn` concern into `session_end` on all six platforms; `src/scripts/learning_sidecar.ts:11-18` implements 30-day half-life decay, a two-distinct-origin corroboration threshold, contested-by-recency resolution and a dead-end ledger. It is default-OFF with human-gated promotion **by an explicit council mandate recorded at `learning_sidecar.ts:20-22`** — a deliberate constraint, not a missing feature.
- **D3 — code-graph reachability.** Every engine fact checks out, including the one wrong anchor (the nudge is at `hook_manifest.yaml:176-180`, not `159-162`). But `docs/CLAIMS.md:380` carries a **backed** honest null: on a pre-registered two-arm benchmark the graph scored **recall 0.365 against grep's 0.797** on graph-shaped questions, −43.2 pp against a pre-declared +10 pp win threshold, root-caused to TS arrow-function exports producing no symbol nodes. Its recorded consequence is not advisory: *"`code_graph.enabled` stays false permanently; deprecation at the next major."* The proposal asks to add an always-on pointer, a refresh concern and a default flip, and presents **no new retrieval evidence**.
- **D4 — progressive disclosure.** Headline true (289 skills, 6 with `references/`), numbers off (mean **1,187** not 1,146; max **7,094** not 6,889), gap narrower than stated: **6 skills exceed 2,500 words and 4 exceed 3,000**, and three size gates already exist. The finding worth keeping is one the proposal did not make — the layout uses **two spellings**, `references/` (6) and `reference/` (3), nothing lints either, and `src/skills/skill-writing/SKILL.md` **never mentions progressive disclosure or a references layout at all**. The split is unauthored convention, not drift from a standard.
- **D5 — fix-witness attestation.** True: `check_claims.ts` is public-surface-only (`SURFACE_ROOTS = ['README.md','docs']`). But the mechanism is already specified in `later/road-to-skill-ecosystem-runtime-enforcement.md:136` (`attest_artifact.ts`, content hash beside a tracked artifact, refuse on mismatch), and `ADR-220` is **accepted with the check deliberately deferred behind a named reopen trigger**. Building it here would be a second implementation of a decided question.
- **D6 — workflow chain contracts.** Half already shipped: PR #1289 deleted the exact "reference, not executor" line the claim quotes, and seven skills already declare hard gates. The remainder is owned by `road-to-frontend-skill-application.md`, **active** with 24 done / 9 open.
- **D7 — pack installability.** True in the narrow sense (install-time `--packs` exists, no `packs:add`/`packs:enable` verb). But the proposal defers it to `road-to-org-packs`, **which does not exist** in any roadmap directory; the org-pack question is a maintainer-owned blocker with a brief at `agents/settings/contexts/org-pack-reopening-brief.md`.

**Why this roadmap is small.** Three of five substantive axes duplicate work that is already shipped, already specified, or already owned by an active roadmap; a fourth is locked by a backed honest null. What is left is three measured defects and the obligation to write down why the rest was declined. An AI council converged 2/2 on exactly that split — adopt the three, park the ceiling lint behind a watch trigger, reject the three architectural axes — and its one refinement is folded in below: the spelling convergence and the authoring text land together, because documenting a canonical directory while three skills still use the other spelling manufactures the drift it is meant to prevent.

- **Feature:** none
- **Jira:** none

## Gap table

| Item from the source proposal | Verdict | Where it lands |
|---|---|---|
| D1 Phase 1 — router runtime application, −80 % static payload A/B | **reject** | Premise falsified: 93 % of the corpus is `type: auto`, not always-active. Recorded in the ADR. |
| D1 residue — `AGENTS.md` self-contradiction | **adopt** | Phase 2 |
| D2 Phase 4 — instinct loop | **reject** | The loop exists; it is default-OFF by council mandate. Recorded in the ADR. |
| D3 Phase 2 — code-graph pointer, refresh concern, default flip | **reject** | Contradicts a backed honest null with a bound consequence and no new evidence. Recorded in the ADR. |
| D4 Phase 3 — progressive-disclosure sweep + `lint_skill_disclosure` | **adapt** | Phase 3 authors the layout and converges the spelling; the ceiling lint is parked with a falsifiable watch trigger, because it would fire on 4–6 files today. |
| D5 Phase 5 — fix-witness layer | **reject** | Mechanism already specified in `later/`; `ADR-220` defers the check on purpose. Recorded in the ADR. |
| D6 Phase 6 — chain contracts | **reject (owned)** | Half shipped by PR #1289; remainder owned by an active roadmap. |
| D7 Phase 7 — pack installability | **reject (pointer wrong)** | Deferred to a roadmap that does not exist; the live artefact is a maintainer blocker brief. |
| 29-language extractors, graph visualisation, vector memory, tool-surface expansion | **reject** | The proposal already rejects these; recorded so the rejection is not re-litigated from the other direction. |

## Phase 1: Record — the measurement outlives the proposal

- [x] **Step 1:** Write an ADR recording the verification: the claim-by-claim verdict table, the three adopted defects, the parked ceiling lint with its watch trigger, and the four rejected axes with the lock each one runs into. Sources stay anonymised per `source-confidentiality`; the thread links are retained as `ENC1:` tokens in the Provenance block. <!-- verify: ./scripts-run src/scripts/check_no_external_sources --> <!-- done: docs/decisions/ADR-225-cross-corpus-proposal-verification.md — 11-row measurement table, 3 adopted, 1 parked with a numeric trigger, 4 rejected each naming its lock and its reopening condition. External-source gate green. -->
- [x] **Step 2:** Regenerate the ADR index so the record is discoverable. <!-- verify: ./scripts-run src/scripts/check_references --> <!-- done: `--dir docs/decisions` (the regenerator defaults to `docs/adr`, which does not exist here and exits 0 silently); INDEX.md:170. `check_adr_frontmatter` green — 165 ADRs, 0 errors. -->

**Exit criteria.** A reader who receives the same proposal next month can see, without re-running anything, which of its numbers were wrong and which lock each rejected phase would have to reopen.

## Phase 2: Repair — the template stops contradicting itself

- [x] **Step 1:** Fix `src/agent-src/templates/AGENTS.md:17` so the always-active claim matches line 29 and the measured frontmatter split: the kernel is always active, the rest is routed. <!-- verify: grep -n "always active" src/agent-src/templates/AGENTS.md --> <!-- done: the Risk-4 tree sweep ran first and found the same categorical claim in a SECOND consumer-shipped surface, `src/agent-src/contexts/augment-infrastructure.md:174` ("Rules are always active, skills are on-demand"). Both corrected — same defect, same class, same change. Three further hits (`src/patterns/README.md:18`, `docs/architecture.md:202`, `src/skills/agents-md-thin-root/SKILL.md:94`) are repo-internal docs, not consumer-shipped; left untouched and noted rather than swept in. The template correction is terser than the prose first drafted for it: the Thin-Root contract caps the consumer template at 2,500 chars and the file sat at 2,488, so the honest fix had 12 characters of headroom and the detail stays where it already lived, in triage item 5. CI caught the overshoot, which is the gate working. -->
- [x] **Step 2:** Project the corrected template into `dist/agent-src/templates/AGENTS.md` and re-mark the condensation hash. <!-- verify: bash src/scripts/condense.sh --changed --> <!-- done: both files projected; `condense.sh --changed` reports "Every .md projection matches its source". -->

**Exit criteria.** No consumer-facing file asserts that all 115 rules are always active; the two statements in `AGENTS.md` agree, and both agree with the frontmatter.

## Phase 3: Author — the disclosure layout gets a specification and one spelling

- [x] **Step 1:** Add a progressive-disclosure section to `src/skills/skill-writing/SKILL.md`: `references/` is the canonical directory name, what belongs there versus in the body, and the existing gates a split has to respect. State the measured distribution so the guidance is calibrated rather than aspirational. <!-- verify: ./scripts-run src/scripts/skill_linter --all --> <!-- done: § "Progressive disclosure — the directory is `references/`, plural", placed with the size hints. It states the anti-goal explicitly: splitting is not a size escape hatch, because only 6 of 289 skills exceed 2,500 words and moving load-bearing prose out of a body to hit a number is the failure the estate already has. Linter 437 pass / 0 fail. -->
- [x] **Step 2:** In the same change, rename the three `reference/` directories to `references/` and update every inbound body link — `design-system-capture`, `prediction-pool-optimizer`, `react-shadcn-ui`, plus the cross-link in `existing-ui-audit`. <!-- verify: ./scripts-run src/scripts/check_references --> <!-- done: 3 `git mv`, 9 body links, plus two live pointers the pre-rename census found (ADR-205 ×2, a test comment). Risk 2 was half wrong in a useful direction — `agents/evidence/reports/` IS scanned by the checker, so the "historical record, leave it" call broke the gate and the evidence report was corrected too; only `agents/roadmaps/archive/` is genuinely skipped and genuinely left alone. Gate green, 1164 scanned. -->
- [x] **Step 3:** Project the edited skills into `dist/agent-src/skills/` and re-mark the condensation hashes. <!-- verify: bash src/scripts/condense.sh --changed --> <!-- done: the stale singular dirs are gone from dist (0 hits for a `reference` dir under `dist/agent-src/skills`), the plural ones present; "Every .md projection matches its source". -->

**Exit criteria.** One spelling exists in the estate, the authoring skill names it, and the reference checker is green on the renamed paths.

## Phase 4: Close — consume the inbox and prove the tree is green

- [x] **Step 1:** Move the consumed inbox artifact to `agents/tmp.old/` and point this roadmap's Provenance line at its new path. <!-- verify: ls agents/tmp.old/ac-compare-1 --> <!-- done: only `ac-compare-1` moved; the rest of the inbox is untouched (`feedback-9.35.0-1.txt` stays for whoever takes it, and two other files were consumed by a parallel session, not by this run). -->
- [x] **Step 2:** Regenerate the roadmap dashboard. <!-- verify: ./agent-config roadmap:progress-check --> <!-- done: 28 roadmaps, `progress-check` reports up to date. -->
- [x] **Step 3:** Run the changed-files static pass and the reference, external-source and skill-linter gates; record the result. <!-- verify: ./scripts-run src/scripts/check_references && ./scripts-run src/scripts/check_no_external_sources --> <!-- done: `check_references` 1164 scanned / 0 broken · `check_no_external_sources` clean · `skill_linter --all` 437 pass / 0 fail · `check_adr_frontmatter` 165 ADRs / 0 errors · `task typecheck-ts` exit 0 · full `task preflight` green, including the safety-floor guard, the legacy-path ratchet and lint-regression. Two diff-scoped gates reported "nothing to review" because the work was still uncommitted at that point; they run for real on the PR. -->

**Exit criteria.** The inbox is empty of this artifact, the dashboard matches the file, and every gate this change can red is green.

## Acceptance Criteria

- [x] Every one of the seven claimed defects carries a verdict backed by a re-derived measurement, not by the number the proposal stated. <!-- ADR-225 § "The measurement table", 11 rows; every count recomputed rather than read from the artifact. -->
- [x] No item was adopted without appearing in the gap table with a verdict — the plan integrates a verified subset rather than restating the source. <!-- 9 gap-table rows; the two adopted repairs are entered as "residue (unclaimed)" because the proposal did not name them. -->
- [x] The four rejected axes each name the specific lock they would have to reopen (a backed honest null, an accepted ADR, an active roadmap, a falsified premise), so a future proposal has to clear that lock rather than re-assert the claim. <!-- ADR-225 § "What is rejected"; each carries a reopening condition, and the frontmatter `review_trigger` restates all four as observable events. -->
- [x] The consumer-facing template no longer contradicts itself about which rules are always active. <!-- Both `AGENTS.md` statements now agree with each other and with the measured 9/101/5 frontmatter split; the same claim was repaired in `augment-infrastructure.md`, the second consumer-shipped surface the sweep found. -->
- [x] The estate uses one spelling for the disclosure directory, and the authoring skill specifies it. <!-- 9 `references/` dirs, 0 `reference/` dirs under `src/skills`; `skill-writing` names it and states the anti-goal. -->
- [x] No external comparator source is named in any tracked artifact this roadmap produces. <!-- `check_no_external_sources` green; the two thread links are retained only as ENC1 tokens. -->

## Blockers

**None.** Every step is an in-repo edit or a regeneration; nothing needs spend, a human action, a date to pass, or a kernel-rule edit. The items that *would* have needed one — the code-graph default flip (30-day telemetry window), the instinct-loop adoption metric (4-week window), the pack install verb (maintainer decision) — are the ones this roadmap rejects rather than schedules, which is why it can close.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The rejection record reads as hostility to external input | product | A record whose visible content is "four axes rejected" trains the next reader to skip the artifact class entirely, and the next proposal that *does* carry new evidence gets dismissed on precedent rather than on merit. | Record the lock each rejection runs into, not the rejection itself, and state the reopening condition for each — a backed null reopens on new retrieval evidence, ADR-220 has a named trigger. The record is a map of what evidence would change the answer, which is the opposite of a closed door. | Phase 1: Record |
| 2 | The spelling rename breaks a link the checker does not scan | implementation | `check_references` scans `dist/agent-src` and `agents` and explicitly skips `agents/roadmaps/archive`, so an inbound link from an archived roadmap or a test comment survives the rename silently and rots. | Enumerate every inbound reference before the rename rather than after, and leave the archived-roadmap and evidence-report mentions untouched on purpose — they are historical records of a path that was correct when written, and rewriting them would falsify the record to satisfy a checker that does not read them. | Phase 3: Author |
| 3 | The parked ceiling lint is never revisited | implementation | "Park with a watch trigger" is the shape that quietly becomes "never", because nothing measures the trigger and the population that would fire it grows one skill at a time. | Write the trigger as a falsifiable number in the ADR — re-evaluate when p95 word count crosses 3,000 or when more than ten skills exceed 2,500 — and record today's distribution beside it so a future check is a single command rather than a fresh census. | Phase 1: Record |
| 4 | The template fix is cosmetic and the real contradiction is elsewhere | product | Correcting one line in `AGENTS.md` closes the visible contradiction while the same always-active framing survives in other consumer surfaces, so the repair reads as complete and is not. | Grep the full tracked tree for the always-active phrasing before editing, not only the file the verification happened to open, and state in the exit criteria that the claim is checked against the frontmatter rather than against the sibling line. | Phase 2: Repair |

## Notes

- The proposal is not doctrine and this roadmap does not adopt its framing. Its method statement — every phase starting from a verified defect — is sound and is the reason the verification was worth running; the failure is that four of the seven verifications did not survive being repeated.
- The transcript that accompanies the proposal carries a second, differently-framed plan from another model (capability contracts, episode evidence, behavioural evals). It carries no verified defects and is not evaluated here; it would need the same claim-by-claim pass before any of it becomes work.
- The generated file-ownership matrix still references a `.agent-src.uncondensed/` tree that no longer exists. That is pre-existing debt, unrelated to this change and not repaired here; it is noted because the rename in Phase 3 touches paths that appear in it and a reader may otherwise mistake the staleness for damage this roadmap caused.

## Provenance

- Source: an external comparison artifact dropped into the maintainer inbox, consumed as `agents/tmp.old/ac-compare-1/`. Originating threads, via `./scripts-run src/scripts/_lib/link_crypto decrypt`: ENC1:UFrKUqnfavC6avBPK+YvXtqPKkewAR71PSKcHigJYo5ttbtrcLRSlEwqm95cu1DFSLK2Qlywv00sj2HuSLNeuw== and ENC1:2d5y5KRgo1KDVU8Ryv8a4I2uGzoTvgKPyPReqBD4onJPRbiM0uq4A+0biT52EaTtXdKiLdUCTUJaCYb89ow2ZQ==
- Comparator corpora are referred to as external sources without names, per `source-confidentiality`. The proposal's own pinned-commit table is not carried into the tracked tree.
- Council: run 2026-08-12, 2 members, $0.061 actual. Converged 2/2 on the adopt/park/reject split above. Its one refinement — land the spelling convergence and the authoring text in the same change, so the documented canon never disagrees with the tree — is adopted as Phase 3.
