---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Road to truth-and-reference hygiene — make the "machine-checked" headline true of its own artefacts

> One autonomous sweep over three drift classes the 8.0.0 audits surfaced and
> a 2026-07-08 re-verification confirmed still live: (1) **artefact-count
> drift** — README prose says "258 skills", "93 governed rules", and THREE
> different command numbers (150/162/166) while source truth is 264/95/166;
> (2) **py2ts parity residue** — 525 TS files still carry "twin of" comments
> and 48 carry "latent Python quirks" rationale pointing at a deleted Python
> original (re-baselined 2026-07-08; the older draft's 418/41 counts and its
> "twin of the Python original" grep phrase are stale); (3) **stale-reference
> drift** — two context locks still cite deleted `.py` script paths, plus
> small release-notes/claims hygiene. Council (claude-sonnet-4-5 + gpt-4o,
> 2026-07-08, 2 rounds) converged on merging these into ONE roadmap: zero
> domain overlap with active roadmaps, one shared verification run, single
> autonomous pass.

## Goal

Every public count, every determinism-contract rationale, and every
context-lock file reference traces to a live source — enforced by CI gates so
none of the three drift classes can silently return.

## Prerequisites

- [x] Count primitives exist (`discovery_stats.ts`, discovery manifest,
      badges generated from source).
- [x] Partial command-count guard exists (`check_command_count_messaging.ts`)
      — evidently matching too narrowly (the 150/162 strings survive).
- [x] Claims-gate precedent exists (`check_claims.ts` fails the build when a
      `<!-- claim:ID -->` marker outruns its evidence).
- [x] py2ts migration closed at parity-or-better (ADR-200 archived); byte-
      identity gates exist (`compile_router --check`,
      `check_discovery_determinism`, `check_artefact_checksums`,
      condensation hashes).

## Context (verified 2026-07-08 on main @ 8.3.0)

- README prose: "258 skills" ×2, "93 governed rules" ×1, "150 commands" ×1,
  "162 commands" ×2, "166 commands" ×1 — vs source 264 skills / 95 rules /
  166 commands. Badges are correct (machine-generated); prose is hand-typed.
- `grep -rl "twin of" src/scripts --include='*.ts' | wc -l` → 407 under
  `src/scripts` (525 repo-wide); `"latent Python quirks"` → 41 under
  `src/scripts` (48 repo-wide). The determinism these comments rationalize is
  still required — only its justification ("match the Python twin") is
  obsolete; the honest reason is "consumers pin these bytes"
  (validators, checksum gates).
- Stale `.py` references in context locks (lock-drift triage 2026-07-06,
  confirmed still unfixed): `agents/settings/contexts/chat-history-platform-hooks.md`
  cites `scripts/chat_history.py` (real: `src/scripts/chat_history.ts`);
  `agents/settings/contexts/rule-trigger-matrix.md` cites
  `scripts/build_rule_trigger_matrix.py` (real:
  `src/scripts/build_rule_trigger_matrix.ts`).
- `docs/CLAIMS.md`: 6 backed, **4 still `unbacked`** — the debt is honest but
  untriaged.
- Small release-hygiene asks from the 8.0.0 review dumps, still open:
  no `Tests: <N>` line in release summaries; fleet **input** schema
  (`fleet.yml`) carries no stability marker (output report is versioned).

## Phase 1 — Artefact counts: one generator, one gate, fixed prose

- [x] Extend the count source of truth to emit skills, rules, commands,
      guidelines, personas, advisors in one place (reuse
      `discovery_stats.ts` / the discovery manifest — do NOT add a second
      counting path that could itself drift). One command prints every
      canonical count. <!-- done 2026-07-08: count('router_rules') added
      (dist/router.json kernel+tier_1+tier_2); truth line prints every kind;
      TARGETS extended to README prose (3 lines), docs/CLAIMS.md claim
      numbers, getting-started-by-role, featured-skills,
      governance-advantage. -->
- [x] Replace/absorb `check_command_count_messaging.ts` with
      `check_artefact_count_messaging.ts` covering ALL artefact types across
      ALL public prose surfaces (README, docs/, site/) — count-shaped
      mentions that disagree with source, or with EACH OTHER (the
      150-vs-162-vs-166 failure mode), fail the build. That multi-number
      case is a dedicated regression test. <!-- done 2026-07-08:
      src/scripts/check_artefact_count_messaging.ts (absorb-not-delete: the
      old check-command-count target stays wired — required-check names are
      branch-protection contract surface; header documents the ownership
      split) + tests/scripts/check_artefact_count_messaging.test.ts (9 tests
      incl. the 150/162/166 multi-number regression case). -->
- [x] Fix the live prose in the same change (258→264, 93→95,
      150/162→166) so the gate lands green; where feasible replace
      hand-typed count sentences with generated fragments (badges already
      do this — extend to prose).
- [x] Wire the check into the same CI stage as `check-claims`; add the
      proof-page note: "artefact counts in public prose are generated from
      source and CI-drift-checked." <!-- done 2026-07-08: task
      check-artefact-counts in taskfiles/ci-fast.yml, wired next to
      check-claims in BOTH Taskfile.yml groups; proof note emitted by
      build_proof.ts § 1 (docs/proof.md regenerated + --check green);
      3 count claims in docs/CLAIMS.md flipped unbacked→backed with the
      gate as evidence pointer (check_claims green: 7 backed / 1 unbacked). -->

**Exit:** all prose counts match source; the guard covers every artefact type
and every prose surface; internal inconsistency is a tested failure mode.
**Rollback:** demote the gate to warn-only (one line) — prefer fixing prose.

## Phase 2 — py2ts comment teardown (re-baselined): rewrite, don't just delete

- [ ] **Inventory + classify (no edits):**
      `grep -rn "twin of\|latent Python quirks\|byte-identical to the Python\|Python original" src/scripts --include='*.ts'`
      → classify every hit: (a) pure obsolete parity prose → delete;
      (b) a real, still-true determinism contract wrongly attributed to
      Python → rewrite to cite the live consumer (which validator/checksum
      gate pins the bytes and why); (c) a literal that other tooling keys on
      (legacy-path guards, ADR-051 twin-parity exemptions) → migrate the
      guard first, then the comment, same change. Record class counts
      inline; (c) is the trap.
- [ ] Execute the rewrite per class across the full hit list (407 files
      under `src/scripts`, remainder repo-wide). Comment-only diff — zero
      behaviour change by construction.
- [ ] Prove nothing changed: `compile_router --check`,
      `build_discovery_manifest --strict`, `check_discovery_determinism`,
      `check_artefact_checksums`, condensation-hash checks, `task test`,
      typecheck, `lint:ts` all green.
- [ ] Add a CI guard that rejects reintroduced Python-twin rationale
      (grep-based lint or extension of an existing docs-hygiene lint), tuned
      to the actually-current comment shapes ("TypeScript twin of `…py`",
      "latent Python quirks") — not the stale draft phrase.

**Exit:** zero Python-twin rationale in `src/scripts/*.ts`; every determinism
contract cites a live consumer; all byte-identity gates green; regression
guard in place; no class-(c) guard silently broken.
**Rollback:** `git revert` — comment-only diff.

## Phase 3 — Stale references, claims triage, release-notes nits

- [ ] Fix the two `.py` path references:
      `agents/settings/contexts/chat-history-platform-hooks.md` →
      `src/scripts/chat_history.ts`;
      `agents/settings/contexts/rule-trigger-matrix.md` →
      `src/scripts/build_rule_trigger_matrix.ts` — and re-run the matrix
      generator to confirm the table content itself hasn't silently gone
      stale.
- [ ] `agents/settings/contexts/senior-personas-and-skills-map.md`
      disposition: it predates the 2026-05-17 persona-cluster resolution
      (`pixar-storyboard-artist` deleted). Either refresh it against
      `docs/personas.md` + `persona-governance.md`, or mark it superseded by
      those two as the living inventory — one recorded decision, no silent
      staleness. <!-- maintainer call flagged in lock-drift triage 2026-07-06 -->
- [ ] Triage the 4 `unbacked` CLAIMS entries: for each, either (i) back it
      with existing evidence (pointer exists but was never linked),
      (ii) scope/reword it so existing evidence resolves it, or (iii) record
      why it stays honestly `unbacked` with the concrete missing evidence
      named. No entry left untriaged; do NOT manufacture evidence.
- [ ] Release-notes hygiene: add a `Tests: <N>` line to the release-summary
      generator (count from the test-run output, never hand-typed); add a
      stability marker to the fleet **input** schema (`fleet.yml`) mirroring
      the output report's `schema_version` treatment.
- [ ] Move `agents/tmp/lock-drift-candidates-2026-07-06.md` to
      `agents/tmp.old/` per the inbox contract — only after the fixes above
      land, so nothing is lost if a phase stalls. (The roadmap-draft dirs and
      review dumps were already moved on 2026-07-08 when they were converted
      into the current active-roadmap set.)

**Exit:** no context lock cites a deleted script; personas-map has a recorded
disposition; every CLAIMS entry is backed or has a named missing-evidence
note; release summaries carry a machine-derived test count.
**Rollback:** `git revert` — docs/config only.

## Acceptance criteria

- [ ] `check_artefact_count_messaging` green, covering skills, rules,
      commands, guidelines, personas, advisors across README + docs + site;
      the conflicting-numbers case is a regression test.
- [ ] Zero Python-twin rationale under `src/scripts/`; determinism contracts
      cite live consumers; a CI guard blocks reintroduction; all
      byte-identity gates pass with a comment-only diff.
- [ ] Both `.py` context references fixed; personas-map disposition
      recorded; all 4 unbacked claims triaged with named outcomes.
- [ ] All quality gates pass (remote CI is the gate).

## Notes

- Sources: `agents/tmp/road-to-alternatives/` drafts
  `road-to-artefact-count-single-source.md` +
  `road-to-py2ts-comment-teardown.md` (re-baselined) +
  `agents/tmp/lock-drift-candidates-2026-07-06.md` + open nits from the
  8.0.0/8.1.0 review dumps.
- Council: claude-sonnet-4-5 + gpt-4o, 2026-07-08, 2 rounds; convergence:
  merge the three lightweight mechanical drafts into one autonomous roadmap
  (shared verification run, zero overlap with active roadmaps).
