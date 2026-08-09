---
complexity: structural
status: ready
---

# Road to rule delivery integrity — rules that arrive once, scoped, and provably

> **Source:** `agents/tmp.old/agent-quality.txt` — an external deep audit of
> this repo @ 9.27.0, plus its drafted roadmap and its review of PR #1218.
> Every claim in that file was re-verified against the live checkout on
> 2026-08-08. Three of its Phase-0 items target artefacts that do not exist or
> levers that do not move the quantity they aim at; one Phase-2 item is already
> shipped. Those are recorded below as prevented work, not carried forward.
>
> **Revised 2026-08-08** after a deep council pass (3 rounds, 2 members) that
> returned REJECT on four structural blockers. All eleven findings are applied;
> the review, the host verdicts, and the four rejected sub-points are appended
> verbatim at the end of this file.
>
> Related, deliberately **not** merged into this file:
> `road-to-rule-coherence-followup` (owns the default-flip decision and the
> `essential-plus` preset), `later/road-to-request-scoped-rule-load` (owns
> consumer scoping and the Cursor/Windsurf emitters, 34/36 done).

## Verified problem statement (2026-08-08)

1. **The rule corpus is delivered twice, both times eagerly.** On this machine
   `~/.claude/rules/` holds **112 real files, 409,606 B (~400 KB)** and the
   project's `.claude/rules/` holds **92 symlinks into `dist/agent-src/rules/`,
   305,161 B (~298 KB)**. **91 basenames appear in both.** Combined ≈ 715 KB
   ≈ **~178k tokens** of rule prose per session — which is where the
   coherence-followup's measured "~163k always-on" figure actually comes from.
   `src/scripts/install.ts` contains no detection of, or dedup against, an
   existing user-global rules directory. First-party evidence: a session in this
   checkout carries both copies of `downstream-changes`, `verify-before-complete`
   and `scope-control` in its standing context simultaneously.
2. **No host-native activation for Claude Code.** `condense.ts:1317`
   (`_emit_cursor_mdc`) and `condense.ts:1337` (`_emit_windsurf_rule`) have no
   Claude sibling. `.claude/rules` is a symlink projection carrying agent-config's
   own frontmatter (`type`, `tier`, `alwaysApply`, `load_context`, `workspaces`,
   `packs`) — none of which the host reads. `grep -l '^paths:' .claude/rules/*.md`
   → **0**.
3. **The `discipline_profile` flip is the wrong lever for the token mass.** The
   template ships `auto` (`src/server/io/yamlIO.ts:144`), absent resolves to
   `essential` (`src/shared/settingsCarveOut.ts:73`), and `essential` is
   `['__kernel__', 'downstream-changes']` (`src/scripts/compile_router.ts:285`) —
   `full` does not ship. Independently decisive:
   `src/scripts/compile_router.ts:266-272` states profiles name the
   **always-honoured** surface, while the projected file set is filtered by
   `rule_in_scope(p, scope, pack_scope)` (`src/scripts/condense.ts:1092-1099`) —
   workspace and pack, never profile. **No profile value changes how many bytes
   land in `.claude/rules/`.** The flip remains a defensible decision on its own
   merits; it is not a token-mass fix and must stop being sold as one.
4. **The router is off the runtime path.** `dist/router.json` has 20 consumers
   across lint, eval, telemetry and prepack, and **zero** under
   `src/scripts/hooks/`. No slot injects tier rules.
5. **Skill activation is measured and the measurement refuses a rate.** Live
   `report_skill_activation`: **288 shipped · 0 with a machine-matchable trigger
   key · 30 with a deterministic obligation · 12 invocations across 30 sessions ·
   4 distinct skills (1.4%)**. The report already counts real `Skill` tool calls
   and already names its own open falsifier: the host's injected catalogue is not
   persisted, so "did the description reach the model" is unmeasured. That 1.4%
   is an **invocation share**, not a selection-accuracy rate — the two are
   separate instruments and must not be mixed when setting targets.
6. **Decision debt, correctly diagnosed.** `road-to-kernel-question-triangle.md`
   is open with a drafted amendment; `later/road-to-request-scoped-rule-load` is
   parked on a resume trigger ("`discipline_profile: essential` baseline has
   landed") whose target already partly exists and which, per item 3, would not
   deliver what the parked roadmap is waiting for.

## Prevented work — items from the source file that must NOT be built

| Source item | Verdict | Evidence (file:line) |
|---|---|---|
| P0.1 "flip default to `essential`" as the ≤30k token fix | wrong lever | `compile_router.ts:266-272` (profiles = always-honoured surface) + `condense.ts:1092-1099` (projection filters on workspace/pack) |
| same, premise "`full` is what ships" | never true | `yamlIO.ts:144` (`auto`) + `settingsCarveOut.ts:73` (absent → `essential`) + `compile_router.ts:285` (`essential` = kernel + `downstream-changes`) |
| P0.3 "add `agent-authority` to the `essential-plus` whitelist" | target absent | `src/server/schemas/settings.ts:17` (enum `auto\|off\|essential\|full`); zero tree hits for `essential_plus`; the preset is unbuilt item F1.2 of `road-to-rule-coherence-followup.md:46` |
| P2.1 "collector counts real invocations" | already shipped | `src/scripts/report_skill_activation.ts` — live output prints `Skill calls= 12` / `invocations total 12` |
| "337 tracked · Active 0 · Exposed-only 181 · Dead 156" | stale instrument | live census: 288 shipped, 4 invoked; no rate produced by design |
| "~90 open roadmaps" | never true | 26 open · 451 `archive/` · 38 `later/` · 6 `skipped/` |
| ADR-106 as the falsification of hidden re-run | mis-cited; substance holds | `docs/decisions/ADR-106-recursive-verification-benchmark-gate.md:14` is the *gate definition*, accepted 2026-06-23; the TERMINAL honest null is `src/skills/recursive-verification/SKILL.md:44` (2026-07-28) |

## Goal

A rule body reaches a session **once**, and only when its condition holds or it
is kernel. Any other state is a CI failure with a machine-readable count. The
delivery mechanism per host is documented as what it is, and the one host
capability the plan rests on is probed and **decided on** before anything is
built on it.

## Non-goals

- No runtime daemon; no hook that matches keywords and injects rule bodies —
  keyword matching is already measured weak in this repo and `intent:` was
  retired on exactly that finding.
- No bulk skill deletion. The census refuses a rate; cutting on it would be
  cutting on an instrument that says so.
- No default-flip decision here. That is the coherence-followup's, and it is the
  maintainer's.
- No revival of the hidden attempt→critic→re-attempt loop (see the pinned
  non-goal under Phase 4).

## Phase dependency shape

Phase 0's decision gates **Phase 3 only**. Phase 1 and Phase 2 proceed
regardless of the probe's answer: Phase 1 targets the 91-file overlap, which
exists independently of any scoping key, and Phase 2 closes a measurement gap
that has no host-capability dependency at all. Phase 2 precedes Phase 3 on
purpose — dispositioning a rule body to a skill is only defensible once skill
delivery is measured.

    P0.1 probe ──► P0.2 gate decision ──────────────► Phase 3 (Path A or B)
                                                          ▲
    P0.3 topologies ──► Phase 1 (dedup + ceiling)         │
    P0.4 un-deadlock                                      │
    Phase 2 (catalogue + de-collide) ─────────────────────┘
    Phase 4 (self-repair) — independent of all of the above

## Phase 0 — Decision gate: probe the premise, then decide

- [x] **P0.1 Probe Claude Code's rules-directory contract.** Establish, from the
      host's own documentation or a controlled two-session experiment, (a) whether
      every `.claude/rules/*.md` is loaded unconditionally at session start and
      (b) whether a frontmatter key that scopes loading exists at the pinned
      version. Record the answer as a fixture under `agents/evidence/` and a row
      in the cross-model capability matrix, which currently has no rules-dir
      entry at all.
      *Verify:* the fixture states version, method, and result, and names which of
      the three outcomes below it selects.
      <!-- done 2026-08-08: agents/evidence/analysis/claude-code-rules-dir-contract.md · host 2.1.226 · outcome A · capability-matrix row NOT added, deviation recorded in the fixture (that matrix scopes model capabilities; host_capability.ts is a versioned subagent-primitive contract) -->
      <!-- discovered: `claudeMdExcludes` (settings key, excludes a rules dir by glob) and the `InstructionsLoaded` hook — both shipped, both re-shape P1.1/P1.2 -->
- [x] **P0.1b Fold the two discovered mechanisms into Phase 1.** `claudeMdExcludes`
      turns P1.1 from detect-and-refuse into detect-and-suppress without deleting;
      the `InstructionsLoaded` hook gives P1.2 a record of what actually loaded
      instead of a filesystem inference.
      *Verify:* P1.1 and P1.2 name both mechanisms below.
- [x] **P0.2 Record the gate decision — blocking for Phase 3.** Exactly one of
      three outcomes is written into the fixture and into this roadmap:
      **(A) scoping key exists** → Phase 3 runs Path A.
      **(B) unconditional load, no scoping key** → Phase 3 runs Path B; the
      roadmap's premise that Claude Code can be made selective is **falsified**,
      and P3.4's upstream capability request becomes the only path to A.
      **(C) probe inconclusive** → Phase 3 does not open; escalate to the
      maintainer with what the probe could and could not establish. C is not a
      failure state, it is a stop.
      *Verify:* the outcome letter appears in the fixture and in Phase 3's header;
      no Phase 3 step is checked while the outcome is C.
      <!-- done 2026-08-08: outcome A — `paths:` frontmatter exists and scopes loading (host 2.1.226). Path A is active; Path B's P3.4 is not applicable. -->

- [x] **P0.3 Measure standing delivery across six topologies.** The 91-file
      overlap above is one machine. Measure the standing rule byte count for:
      global-only · project-only · **both, deliberate** (maintainer runs two
      layers on purpose) · **both, accidental** (a consumer installed twice
      without noticing) · **monorepo** (several projects under one global layer)
      · **multi-user machine** (per-user global layers). The deliberate/accidental
      distinction decides whether P1.1 warns or refuses.
      *Verify:* a table of six rows with measured bytes, token estimates, and the
      method stated per row; the accidental-both row is the defect's real blast
      radius and sets P1.2's ceiling.
      <!-- done 2026-08-08: agents/evidence/analysis/standing-rule-delivery-topologies.md · exact BPE via src/scripts/_lib/token_count.ts · both-layers = 176,354 tok, single layer = 101,247 / 75,107, redundant 74,137 (42%) · ceiling band 101,247–176,354, recommended 110,000 · Risk #2 resolved NOT-PRESENT (91/91 bodies identical after stripping the installer's package:/source_path: keys) · NEW defect found: project symlink set dated 2026-07-05 is short 21 rules / 24,961 tok incl. secret-vcs-guard, broken-access-control, session-canary — out of this roadmap's scope, surfaced to the maintainer -->

- [x] **P0.4 Un-deadlock the roadmap pair.** Amend the park note of
      `later/road-to-request-scoped-rule-load` so its resume trigger names an
      owner and a condition that item 3 above has not already voided; link this
      roadmap and the coherence-followup as its context.
      *Verify:* no roadmap's resume condition references a gate that is itself
      blocked without naming the owner.
      <!-- done 2026-08-08: park note of later/road-to-request-scoped-rule-load rewritten — new trigger "P2.1 of this roadmap closes", owner maintainer; the old discipline_profile trigger retired with the two measured reasons (no single landing event; profile governs the always-honoured set, not the projected file set) and both context roadmaps linked as non-prerequisites -->


## Phase 1 — Deliver the corpus once

- [x] **P1.1 Duplicate-delivery detection with an explicit layer choice.** The
      installer detects an existing user-global rules directory before writing a
      project projection (and the reverse) and reports the overlap count. The
      choice is a flag, `--layer=<global|project|both-acknowledged>`:
      `global` installs to `~/.claude/rules/` and warns about the existing project
      layer · `project` installs to `.claude/rules/` and warns about the existing
      global layer · `both-acknowledged` proceeds with a doubled corpus and logs
      the byte cost. With an overlap detected and no flag, the installer **exits
      non-zero** with the overlap count and one example line per flag.
      **The installer never deletes or modifies an existing layer** — it only
      controls what the current operation writes. Deleting a user's
      `~/.claude/rules/` would be a Hard-Floor action per
      `non-destructive-by-default`, so no code path may reach it.
      **Suppression instead of deletion (P0.1 finding).** Detection alone leaves
      the byte cost in place. The host ships `claudeMdExcludes` — a settings key,
      honoured at any layer, that skips instruction files by absolute-path glob,
      and whose own documented example excludes a `.claude/rules/**` directory.
      So on `--layer=global` or `--layer=project` the installer **offers to write
      a `claudeMdExcludes` entry** for the layer the user did not choose, into
      `.claude/settings.local.json` (local, so it stays off the shared tree).
      That removes the duplicate load without unlinking one file, which is what
      makes the no-delete guarantee and an actual byte reduction compatible.
      Arrays merge across settings layers, so the entry composes with an existing
      one rather than replacing it. Managed-policy instruction files cannot be
      excluded and are out of scope. Contract + citations:
      `agents/evidence/analysis/claude-code-rules-dir-contract.md`.
      *Verify:* fixture install over a pre-seeded global rules dir exits non-zero
      with the overlap count; each of the three flag values produces its stated
      write set; the offered `claudeMdExcludes` entry appends to an existing array
      rather than overwriting it; a test asserts no existing file outside the
      chosen layer is unlinked or rewritten in any of the four paths.
      <!-- done 2026-08-08: src/scripts/_lib/rule_layer_overlap.ts (pure compare + claudeMdExcludes merge) · install.ts `--layer` flag + `_gate_rule_layer_overlap` + `_suppress_rule_layer` writing .claude/settings.local.json · 35 tests green (tests/scripts/_lib_rule_layer_overlap.test.ts 19, tests/scripts/install_rule_layer_gate.test.ts 16) · typecheck-ts + eslint exit 0 · lib reproduces the P0.3 hand measurement on the live layers (91/91 duplicate, 0 divergent, 21 global-only, 1 project-only) -->
      <!-- deviation: `--dry-run` cannot exercise the gate — main() returns from _dry_run_summary before scope resolution. Documented in the function docstring; tests call it directly. Hoisting scope resolution is a main() restructure, deliberately not bundled. -->
      <!-- test-found defect, fixed: path.resolve does not dereference symlinks, so the exclude glob would silently match nothing on a symlinked home or checkout (a case the host docs explicitly support). _suppress_rule_layer now realpaths with a literal fallback. -->

- [x] **P1.2 `check_standing_rule_delivery` with a governed ceiling.** A gate that
      sums the rule bytes a session would actually receive for the detected
      topology and fails above a ceiling. The ceiling is derived from P0.3's
      accidental-both row, is recorded in one file with its derivation, and is
      **raised only in a PR that states which rule added the bytes and why** —
      never as a drive-by baseline bump. `assertScanned` posture: a zero-file scan
      exits non-zero rather than green. That is not defensive boilerplate here —
      this repo has shipped gates that scanned nothing and exited green, and the
      posture is the recorded fix.
      **Measure what arrived, not what was projected (P0.1 finding).** The host
      ships an `InstructionsLoaded` hook that logs exactly which instruction files
      loaded, when, and why. Where it is available the gate reads that record as
      its primary input and the filesystem sum becomes the cross-check; where it
      is not, the filesystem sum stands alone and the gate says which input it
      used. A rule that is projected but never loaded, and a rule that loads from
      a layer nobody projected, are both invisible to a filesystem-only sum — and
      the second one is the duplication defect itself.
      *Verify:* seeded doubled-corpus fixture reds the gate; current topology green
      with its count printed on the green path AND the input source named
      (`instructions-loaded` | `filesystem`); a ceiling-raise without a stated
      cause reds a companion lint.
      <!-- done 2026-08-08: src/scripts/check_standing_rule_delivery.ts · cap + derivation in src/config/budgets.yml standing_rule_delivery (110,000 tok, band 101,247–176,354) · 18 tests green · live: both layers 176,354/110,000 = 160.3% EXIT 1 (correctly red on the real defect); project-only via a fake empty HOME 75,107 = 68.3% EXIT 0 · registered as `task dev:standing-rule-delivery` -->
      <!-- deviation: NOT a CI gate, and not in gate-coverage.yml. Both inputs are machine-local — `.claude/rules/` is gitignored (.gitignore:123) and no CI leg does a user-scope install, so on a runner BOTH layers are absent: the gate could only be green-by-blindness there, the exact failure gate-coverage.yml exists to end. Rationale in the script docstring. The ENFORCED layer is P1.1's installer gate, which refuses to create the doubled state. -->
      <!-- deviation: the "companion lint" for an unstated cap raise is folded INTO this gate (cap_raise_reason must be a real sentence; placeholders exit 1) rather than shipped as a second script — one gate, one config block, no second registration surface. -->
      <!-- pre-existing red, NOT from this diff: check_gate_completeness reports 223 un-adopted vs baseline 217. Measured 223 both WITH and WITHOUT this new script, so all 6 are pre-existing. Not fixed here (out of scope) and the baseline is deliberately not raised — the checker calls that a defect. Surfaced to the maintainer. -->


## Phase 2 — Close the census's own falsifier

> Runs before Phase 3 by design. P3.2's `skill` disposition moves a rule body
> behind a skill description; that is only defensible once it is known whether
> descriptions reach the model at all.

- [x] **P2.1 Log the injected skill catalogue once per session** — the exact
      falsifier `report_skill_activation` names for its own NOT MEASURED clause:
      whether each skill reached the model with its description or as a bare name.
      The snapshot schema carries a `description_hash` per entry so a catalogue
      row can be correlated with the census's own record.
      *Verify:* one recorded session yields a catalogue snapshot; the census gains
      a descriptions-vs-bare-names count and either retires or confirms the
      truncation hypothesis.
      <!-- done 2026-08-08: agents/evidence/analysis/skill-catalogue-description-delivery.md. The question is ANSWERED but not by the proposed mechanism: 414/414 installed skills carry a description on disk (measured), while 5 of 8 sampled catalogue entries reached the model without one (first-party observation). So the projection is complete and the LOSS IS HOST-SIDE — hypothesis "our projection is missing descriptions" is refuted. -->
      <!-- deviation: "log the catalogue via a hook" has no available implementation — no hook slot receives the system prompt or the injected catalogue, and the host's InstructionsLoaded hook covers instruction FILES (P1.2's surface), not the skill catalogue. What closed the question was reading the catalogue that arrived and diffing it against disk. No total bare-vs-described RATE is claimed: the catalogue is not persisted, and hand-counting a context window would be an unverifiable number. -->
      <!-- consequence, folded into P3.2 below: the `skill` disposition relies on a surface that demonstrably drops descriptions, so it can silently turn an always-loaded rule into an unreachable one. `digest` becomes the default for anything load-bearing. -->

- [-] **P2.2 De-collide the descriptions the census predicted wrong.** Rewrite the
      guard-clause-first descriptions so discriminating content precedes
      `ONLY when user explicitly requests`, and add sibling-routing lines where a
      wrong sibling was predicted. Success is **not** a single pre-registered
      floor — a selector is probabilistic and one number invites Goodharting. All
      three must hold: (i) the `skill-selection-accuracy` per-cluster hit rate
      improves by a factor pre-registered against **that instrument's own measured
      baseline**, taken before the rewrite (the census's 1.4% invocation share is
      a different instrument and is not the baseline) · (ii) no individual skill
      degrades by more than 20% in isolation, so sibling-routing cannot make a
      previously-reachable skill invisible · (iii) measurement spans at least 100
      requests across at least three request shapes.
      *Verify:* the re-run emits baseline-vs-post rates per skill, per-skill change
      with any >20% degradation flagged, the overall rate with a confidence
      interval, and one of `proceed` / `iterate` / `revert`.
      <!-- PARTIAL 2026-08-08 — the rewrite landed, the measurement is human-gated. -->
      <!-- done: 9 descriptions rewritten discriminator-first (the census predicted 7; the tree carries 9) — adversarial-review, analysis-autonomous-mode, performance-analysis, persona-improvement, project-analyzer, security-audit, sequential-thinking, skill-improvement-pipeline, universal-project-analysis. All ≤ 200 chars (133–191). Sibling-routing lines kept/added. `grep 'description: "ONLY '` over src/skills now returns 0. validate_frontmatter: 435 artefacts, 0 failing, 0 warnings. task sync + task generate-tools run. -->
      <!-- OPEN and why: score_skill_selection.ts is a SCORER — it consumes a predictions JSON (`{fixture_id: selected_skill}`) that only a live model run produces. No baseline can be computed locally, and a live trigger-eval is a human gate (it hard-aborts under automation), so the pre-rewrite baseline is UNMEASURED and no lift is claimed. Pre-registered criteria, unchanged by the outcome: (i) per-cluster hit rate improves against that instrument's own pre-rewrite baseline, (ii) no single skill degrades > 20% in isolation, (iii) ≥ 100 requests across ≥ 3 request shapes. -->
      <!-- defect found while reading the scorer, not fixed here: score_skill_selection.ts documents that it reads the `.agent-src.uncondensed/skills` literal, which ADR-051 retired as dead legacy. A scorer pointed at a dead tree cannot produce a valid baseline — that has to be repointed BEFORE the human-gated run, or the measurement is void. -->


## Phase 3 — Host-native scoping for Claude Code

> **Gated on P0.2. Outcome letter: A** (recorded 2026-08-08 — `paths:` frontmatter
> exists and scopes loading; host `2.1.226`; contract fixture
> `agents/evidence/analysis/claude-code-rules-dir-contract.md`). **Path A is
> active.** Path B's P3.4 is therefore not applicable and is marked skipped, not
> open — the roadmap's own gate design says so. Outcome C would have kept this
> phase closed and did not occur.

**Path A — a scoping key exists**

      <!-- MIGRATED 2026-08-09 (PR #1231): the deferred half moved to `road-to-skill-description-measurement` (status ready, one open blocker, the human-gated live trigger eval, owner user), with the three pre-registered criteria carried over verbatim so the outcome cannot renegotiate them. Disposition chosen by the maintainer at the Iron-Law-3 gate: follow-up ready plus blocked. Marked `[-]` because the work left this file, not because it was cancelled; the rewrite half stayed done and is not re-opened there. -->
      <!-- what the successor gained that the deferral did not have: `score_skill_selection` read the uncondensed legacy tree ADR-051 retired, which does not exist. A glob over a missing directory does not fail, it scores every fixture against an empty skill set and emits a baseline of SILENT ZEROS, which is exactly what the pre-registered criteria would have been compared against. Repointed at the live tree via the shared resolver (289 skills, was 0), which is what makes the successor runnable at all. Lowered the hardcoded-scan-roots ratchet 49 to 48. -->
- [x] **P3.1 `_emit_claude_rule()` in `condense.ts`** (Path A only), sibling of the
      existing two emitters: kernel → unscoped; path-shaped triggers
      (`file_pattern`, `path_prefix`) → the host's scoping key via
      `derive_trigger_globs()`; the symlink projection for `.claude/rules`
      replaced by emitted files under the existing byte-exact copy-plus-rewrite
      discipline.
      *Verify:* one unit fixture per trigger shape; emitted frontmatter contains
      only keys P0.1's fixture records as documented by the host.

**Both paths**

      <!-- done 2026-08-09 (PR #1231, parallel to #1232 which closed Phase 4): `_emit_claude_rule` + `_claude_paths_plan` in condense.ts, wired into generate_rule_symlinks for `.claude/rules` only. Emitted frontmatter is `paths:` and NOTHING else, the one key P0.1 records as read by this host; a rule with no path-shaped trigger gets no frontmatter at all, because absent `paths:` IS this host way of saying load-unconditionally and a block it ignores is pure standing-context cost. Measured: 110 symlinks became 110 emitted files, 25 carrying `paths:`; project-scope standing load 418,570 B to 272,824 B = **34.8%, ~36.4k tokens per session**, 64,700 B moved to on-demand. check_rule_projection_integrity EXIT=0 (330 entries). 23 fixtures in tests/scripts/condense_glob_emit.test.ts: one per trigger shape plus body byte-fidelity and an assertion pinning `paths` as the only emitted key. -->
      <!-- THE BLOCKER BELOW IS DISSOLVED, not overridden, and the distinction matters. It asked which of the 115-vs-92 sets the emitter emits. The emitter emits NEITHER as a new decision: it reads `projected_rule_trees()`, the SAME emit plan `generate_rule_symlinks` already used, so the set is unchanged by construction and no scope decision was taken. Only the REPRESENTATION changed, symlink to emitted file. The live count on this checkout is 110, so the 92 in the blocker text is a stale measurement, and the 115 in `dist/agent-src/rules/` includes the 5 ADR-004 `type: manual` rules the per-tool trees deliberately omit. Diagnosing the projection filter stays out of scope, exactly as the P0.3 note says. -->
      <!-- VERIFIED FIRST-PARTY, and by accident, which is the strongest form available: while reading `src/` files in the same session the host injected `.claude/rules/augment-edit-discipline.md` (`path_prefix: "src/"`) on its own; a later roadmap edit pulled in three `agents/roadmaps/`-scoped rules plus `markdown-safe-codeblocks` (`file_pattern: "*.md"`). Both emitted trigger shapes are witnessed firing with the documented read-triggered semantics, which no fixture could have supplied since the fixtures exercise the emitter and the host exercised itself. -->
      <!-- what that does NOT establish: no sweep over all 25, and nothing observed a scoped rule correctly STAYING OUT of a session touching no matching file. Absence is the property the 34.8% actually rests on and it remains unmeasured; a witness can only show that loading DOES happen. -->
      <!-- two defects found while building, both fixed here. (1) `path_prefix: "{module_root}/"` in roadmap-ci-steps-policy is an agent-config PLACEHOLDER resolved from `modules.root_paths`, not a glob: emitted verbatim the host reads a brace group with no comma, expands it to the literal `{module_root}`, and matches no file, so the rule would reach the model NEVER instead of on-demand, silently. Dropped; the discriminator is the comma, so `{ts,tsx}` still works. Fail-safe direction: no pattern means loads unconditionally (status quo), a no-op pattern means invisible. (2) the stale-entry sweep tested `_isSymlink` only, so with two paths now writing REAL files a renamed or de-duplicable rule would have left its body behind, loaded forever. -->
      <!-- host budget constraints encoded rather than trusted: 1,000 expanded patterns with per-pattern cost, `[` escaped. Both degradations are silent host-side; both carry a fixture. `.claude/rules/` is gitignored, so this ships as generator behaviour reproducible by `task generate-tools`, not as 110 committed files. -->
- [x] **P3.2 Disposition table for the keyword/phrase-only residue.** Every
      non-kernel rule with no path-shaped trigger gets exactly one recorded
      disposition in `agents/decisions/rule-activation-dispositions.yml`:
      `digest` (a one-to-three-line obligation in a single always-on digest, body
      demoted to `type: manual`) · `skill` (body behind a SKILL.md — permitted
      only once Phase 2 has shown descriptions reach the model; until then every
      `skill` row carries a named reason) · `drop`. Under Path B, `skill` and any
      scoping-dependent row is recorded as **blocked on host capability** and only
      `digest` rows proceed to implementation.
      *Verify:* table covers 100% of the residue; a zero-row table fails; under
      Path B no non-`digest` row is implemented.
      <!-- done 2026-08-09 (PR #1231): agents/decisions/rule-activation-dispositions.yml, 76 rows, one per residue rule, validated by parse (76 rows = 76 declared, unique keys, zero unclassified). The residue is MEASURED off the P3.1 output rather than estimated: emitted-with-no-frontmatter (85) minus the 9 kernel rules = 76. The file carries its reproduction command. -->
      <!-- DEVIATION and a finding: a FOURTH disposition `keep` holds 46 of 76. 38 of the residue are classed `stay` by rule-body-migration-inventory, whose criterion is that the non-Iron-Law body IS the enforcement surface and does not shrink usefully by relocating. Demoting such a body to `type: manual` removes an enforcement surface from context, the defect this roadmap repairs, so `digest` would have falsely recorded what happened to them, `skill` is barred, and `drop` is false. Forcing those 38 into the three given classes would have passed the verify clause while misdescribing half the corpus. -->
      <!-- `skill` = 0 rows, which is the Phase 2 answer and not an omission: P2.1 measured 5 of 8 sampled catalogue entries reaching the model with NO description while 414/414 carry one on disk, so the loss is host-side and a `skill` row risks turning an always-loaded obligation into an unreachable one. `drop` = 0 rows, measured: the closest candidates were the 7 `tier: mechanical-already` rules, already adjudicated `stay` by ADR-004. -->
      <!-- 67 of 76 classes come from the existing inventory (`class_source: inventory`); 9 rules postdate its compilation and were classified here by the same criterion, marked `classified-here` so a reader can tell them apart. Reusing the inventory was deliberate: a second independent classification of one corpus would drift with nothing to reconcile them. -->
      <!-- NOT built, named instead: a CI gate asserting the table still covers the residue. The verify clause holds today, but a new trigger-less rule would silently make it incomplete. Also honest: the 46 `keep` rows rest on an inherited criterion, not on a measurement of what those bodies cost per session. -->
- [x] **P3.3 Amend the rule-router contract** to describe the router as a
      compile-time source for host-native emission and lint tooling, not a runtime
      lookup any host performs. Under Path B the amendment also records
      "Claude Code: scoping capability requested `<date>`, ticket `<link>`".
      *Verify:* grep — the retired formulation appears nowhere outside archives;
      under Path B the requested-capability note names a real ticket.
      <!-- done 2026-08-08: docs/contracts/rule-router.md § "What reads router.json — and what does not". The sentence "host agents read [it] once at session start" is retired and replaced by the measured fact (20 consumers, ZERO under src/scripts/hooks/) plus a per-host activation table naming Cursor's globs:, Windsurf's trigger:, and Claude Code's paths: with the emitter gap called out. grep for the retired phrasing outside archives: 0. check_references EXIT=0, 1096 scanned, no broken references. Path B's ticket clause does not apply — outcome A. -->


**Path B — no scoping key**

- [-] **P3.4 Open an upstream capability request** (Path B only) for a scoping
      mechanism on `.claude/rules/*.md`, citing the measured byte cost from P0.3.
      Under Path B this is the only route back to Path A, so the ticket is a
      deliverable, not a courtesy.
      *Verify:* ticket link recorded in P3.3's contract note and in P0.1's fixture.
      <!-- skipped 2026-08-08: P0.2 recorded outcome A — the scoping key exists, so there is no capability to request. Not a deferral; the branch is closed by the gate. -->


## Phase 4 — Self-repair loop: close the verified gap

> PR #1218 is **merged** (2026-08-08T11:41Z). The loop's spine ships:
> `self-repair-loop` rule (`type: auto`, tier 2a), the `self-repair` concern bound
> on `user_prompt_submit` + `stop` across the hosts that have those slots, pure
> detectors, fingerprint-deduped records, and the
> `self-repair:status` / `self-repair:release` CLI. One functional defect is
> verified; the rest of this phase is growth. Independent of Phases 0–3.

**Recorded non-goal (pinned):** the hidden variant — silently re-running a turn
so the user never notices the miss — stays out. It was built, benchmarked and
falsified: `src/skills/recursive-verification/SKILL.md:44` records the 2026-07-28
honest null as TERMINAL. Correction is always visible.

- [x] **P4.1 Fork-aware egress with a pre-flight probe and per-step timeouts.**
      `self_repair_cli.ts:77` computes `canPush` as
      `run('git', ['remote'], checkout).out.trim().length > 0` — remote
      *existence*, not push *rights*. Any consumer who cloned the public repo has
      a remote and no write access, so the route classifies as `pull-request` and
      fails at push. Replace the heuristic with a **pre-flight probe of actual
      push rights** and implement the real consumer path (fork → push to fork →
      cross-repo PR). Each egress step carries a **30 s timeout**; on timeout or
      failure the ladder degrades within the same `release` call — push/PR
      failure → `issue`; issue failure → record stays `open` with the error
      attached.
      *Verify:* route matrix over (upstream-write / fork-only / auth-no-push /
      no-auth / privacy-refusal); a mocked push failure and a mocked timeout each
      produce an issue attempt within the same invocation; a mocked triple failure
      leaves the record `open` with all three errors recorded.
      <!-- done 2026-08-09: `probeUpstreamRights` reads `gh api repos/<repo>` → permissions.push + allow_forking (the `git remote` heuristic is gone); `chooseEgress` returns {route, pushVia} with the fork rung; `executeRelease` runs the ladder upstream-push → fork (gh repo fork → whoami → remote add → push → cross-repo PR with --head) → issue → open-with-errors, every step under EGRESS_STEP_TIMEOUT_MS=30s (spawnSync timeout); `attachReleaseErrors` keeps the record open with sanitized errors, markReleased clears them. Route matrix (all 5 named cases), push-fail→issue, timeout→issue, fork-path, triple-failure (3 errors recorded), branch-check precondition stop: tests/scripts/self_repair.test.ts — 52 tests green; typecheck-ts + eslint exit 0. -->
      <!-- deviation, stated: a branch-check failure (fix not on its own branch) is a precondition STOP, not an issue downgrade — degrading there would file an issue while an authored fix exists locally, dropping the fix. The ladder engages from the push onward, which is what the step's own failure list names. -->

- [x] **P4.2 Structured upstream intake.** A GitHub issue form with defect class,
      fingerprint, occurrence count and evidence span, plus a label, so reports
      from independent installs cluster by fingerprint without any telemetry.
      *Verify:* `renderReport` output round-trips through the form's fields.
      <!-- done 2026-08-09: .github/ISSUE_TEMPLATE/self_repair_report.yml (form, label `self-repair`, field ids = the record's structured fields) + `parseReport` as the executable inverse of `renderReport`. Round-trip pinned both ways: parseReport(renderReport(rec)) == rec's fields (1x and Nx occurrences), form ids == ParsedReport keys, dropdown options == DEFECT_CLASSES (a new detector class without a form extension is now a red test). 58 tests green. -->
      <!-- open maintainer step, stated: the `self-repair` label does not exist on the upstream repo yet (checked via `gh label list`); GitHub silently drops unknown labels on form submit. Creating it is a one-click repo mutation that rides with the PR review, not an agent action. -->

- [x] **P4.3 Detector corpus gate with three fixture classes.** Precision and
      recall are separate obligations and need separate fixtures:
      **fire** — a recorded real failure the detector must catch ·
      **near-miss-fire** — a real failure that looks unlike the canonical one and
      must still be caught (recall at the boundary) ·
      **must-not-fire** — text that superficially matches and must stay silent
      (precision). A detector missing any class fails CI. Complaint-pattern
      hardening rides here: *"du hast nicht zufällig …?"* and
      *"you didn't need to, it's fine"* are **must-not-fire**.
      *Verify:* a detector missing any one class reds the gate; current detectors
      carry all three and are green.
      <!-- done 2026-08-09: DETECTOR_REGISTRY in _lib/self_repair.ts is now the single list runDetectors AND the gate iterate; corpus under tests/fixtures/self-repair-detectors/<class>/{fire,near-miss-fire,must-not-fire}.json; gate = tests/scripts/self_repair_detector_corpus.test.ts (CI runs the vitest suite in tests.yml) — missing/empty class per registered detector reds it, orphan corpus dirs red it, the two roadmap-mandated must-not-fire prompts are pinned by name. Complaint hardening: COMPLAINT_EXONERATIONS silences "nicht zufällig"/"didn't need to, it's fine" shapes before the complaint match. 70 tests green. -->
      <!-- deviation, stated: the gate is a structural vitest test over the registry, not a seventh lint_* script — the detectors are TS functions the fixtures exercise directly, CI carries the suite, and a standalone gate script would re-buy the six-surface registration (gate-coverage header figures, ledger ratchet, taskfile/workflow parity) for no additional failure mode. -->
      <!-- found by the near-miss class while building it, fixed: JS \b is ASCII-only, so the leading \b before the complaint alternation made "übersehen" (umlaut-initial) a DEAD branch — no boundary exists between a space and "ü". Defect-pattern search over src/scripts: exactly 1 site, no other \b-before-umlaut-initial construct in the tree. -->

- [x] **P4.4 Never-silent lint.** No shipped rule, skill or command may direct a
      silent re-run or concealment of a detected miss, with an allowlist for prose
      that *describes* the falsified mechanism.
      *Verify:* seeded violation fixture reds the gate; current corpus green.
      <!-- done 2026-08-09: src/scripts/lint_never_silent.ts over src/rules + src/skills + src/agent-src/commands (444 artefacts). Two directive families (silent re-run · conceal-the-miss); describe-vs-direct decided per line+preceding-line via negation/falsification markers, plus an explicit <!--never-silent-allow--> escape. Self-test 5/5 (2 seeded violations red the gate, forbidding prose and the allow-marker pass); live corpus green. Registered: taskfiles/ci-fast.yml + Taskfile.yml ci list + rule-backstops.yml step (CI-identical bare argv); adopts GateLedger (completeness ratchet unchanged at its pre-existing 224) + reportScanned. check_ci_local_parity green. -->
      <!-- classified before wiring, per this repo's shape-gate discipline: the first corpus run returned 4 hits, all four descriptions (a prohibition with bare "No", and three bullet continuations whose "Do NOT" sat on the previous physical line) — fixed by widening the marker set (no/kein/disguise/mask) and checking the preceding line, not by allowlisting the files. -->


## Success criteria

- P0.3's six-topology table exists, and no topology in which the corpus is
  silently delivered twice survives Phase 1.
- P0.2 records outcome A, B, or C, and Phase 3's header names it.
- The Claude Code rules-directory contract is a committed fixture with a
  capability-matrix row, not an inference.
- Phase 2's NOT MEASURED clause is closed in one direction or the other **before**
  any `skill` disposition is implemented in P3.2.
- Every non-kernel rule carries exactly one recorded activation disposition; under
  Path B the non-`digest` ones are explicitly blocked, not silently pending.
- Self-repair: the full ladder (fork-PR → issue → local) exercised including a
  timeout path; every detector carries all three fixture classes; never-silent
  lint green.

## Blockers

| Blocker | Owner | Unblocks |
|---|---|---|
| ~~Claude Code rules-dir contract unknown (P0.1)~~ — **CLEARED 2026-08-08**: `paths:` exists, outcome A, fixture committed | — | Phase 3 opened on Path A |
| ~~P3.1 cannot be executed as written — which 115-vs-92 set does the emitter emit?** `.claude/rules/` holds 92 symlinks while `dist/agent-src/rules/` holds 115, and the 23-rule difference (all `type: auto`, incl. `secret-vcs-guard`, `broken-access-control`, `self-repair-loop`) survives a fresh `task sync` + `task generate-tools` unexplained. Emitting 92 hardens a gap nobody has explained; emitting 115 silently widens consumer scope. Both are scope decisions this roadmap does not authorize, and diagnosing the projection filter is explicitly out of its scope (§ P0.3 note). ~~ **DISSOLVED 2026-08-09 (PR #1231)**: the emitter reads the existing `projected_rule_trees()` emit plan, so the set is unchanged by construction and neither 92 nor 115 was chosen as a new scope decision; the live count is 110 and the 92 was stale. | resolved | none |
| `discipline_profile` default decision (coherence-followup F1.1) | maintainer | nothing in this roadmap — recorded so it stops being treated as this scope's prerequisite |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-08 | reviewer: deep-council-3-rounds-plus-host-verdict -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | Phase 3 builds an emitter for a key the host ignores | implementation | The source audit asserted a scoping key exists; nothing in this tree corroborates it | P0.1 probes and P0.2 **decides**; Path B has its own deliverables so a null answer is not a stalled phase | Phase 0 |
| 2 | The two layers are a version skew, not just a duplicate | product | The global layer is 112 real files, the project layer 92 symlinks into `dist/` — if the global copy is older, dedup alone leaves a stale corpus winning | P0.3 diffs content, not just basenames, per topology row; a skew finding re-scopes P1.1 from "choose a layer" to "choose and refresh" | Phase 0 |
| 3 | Dedup breaks an intentional two-layer setup | product | A maintainer may deliberately run global + project layers | P1.1 reports and refuses rather than deciding; `--layer=both-acknowledged` preserves the doubled shape; no code path deletes | Phase 1 |
| 4 | Digest becomes a second kernel | implementation | Every retired rule "just adds one line" | Digest bytes counted inside P1.2's ceiling; additions require a disposition row and a stated cause | Phase 3 |
| 5 | Rule→skill dispositions move mass into an unmeasured surface | product | P3.2's `skill` disposition assumes description delivery works | Phase 2 precedes Phase 3 in the numbering **and** in the success criteria; until it closes, every `skill` row carries a named reason | Phase 2 |
| 6 | P2.2's target becomes the metric | implementation | A single pre-registered floor invites tuning to the number | Three-part success criterion including per-skill degradation detection and a stated confidence interval | Phase 2 |
| 7 | Complaint intake as injection or spam vector | product | Attacker-controlled text opens records; unattended egress would make it a channel | Egress stays Hard-Floor gated for consumers; fingerprint dedup caps volume; P4.3's must-not-fire class raises precision | Phase 4 |
| 8 | This roadmap adds mass instead of removing it | implementation | It is the 27th open roadmap and spans five phases | P0.4 links rather than forks the two parents. **Review-or-decide stamp: 2026-11-06** — 90 days from authoring on 2026-08-08. Decision procedure on that date: under 30% of steps closed → archive; 30–70% → extend with a re-cut scope or archive the unstarted phases; over 70% → extend to completion. The stamp is a decision date, not a suggestion | Phase 0 |

## Council review (2026-08-08)

Deep tier, 3 rounds, 2 members. Response-A (`anthropic/claude-sonnet-4-5`)
carried the substance; Response-B (`openai/gpt-4o`) converged on three of its
points and dissented on one. Neither member saw the codebase — every finding
below carries a host verdict against the tree. **All eleven findings are applied
in the revision above**, four of them in the modified form the verdict names.

### Agreement

- Phase 2 (now Phase 3) has no specified work if the probe returns "no scoping
  key" — Response-A calls it a 67% phase failure with no fallback; Response-B
  calls it the roadmap's single largest execution risk.
- The duplication measurement and the byte ceiling are coupled and the coupling
  was unstated — the ceiling cannot be chosen before the measurement exists (A, B).
- Verify clauses named an artefact but not a measurement method for the installer
  step and the catalogue-logging step (A, B).

### Clashes

- **Does Phase 1 wait on Phase 0?** Response-A wants Phase 0 as a blocking gate
  ahead of Phase 1. Response-B holds that measuring and fixing duplicate
  delivery is valuable regardless of the probe's outcome, so no strict
  re-sequencing is warranted. **Host resolution: B.** Phase 1 targets the
  91-file overlap, which exists independently of any scoping key; the decision
  gate A asks for is right, but it gates Phase 3. Recorded in § Phase dependency
  shape.

### Blind spots

- The global layer is 112 **real files** while the project layer is 92
  **symlinks into `dist/`**. That is not only duplication — it may be a version
  skew, in which case dedup alone leaves a stale corpus winning. Now Risk #2.
  `needs-verification`
- P0.1 is a harness-grounding step that `think-before-action` § Environment
  grounding says belongs *before* a plan is scheduled, not inside it as step
  one. Kept inside the roadmap, but P0.2 gives it a real stop (outcome C) so a
  failed probe halts rather than degrades. `needs-verification`

### Convergence findings

1. **Phase 0 is not a gate** — three tasks with no phase-exit decision; the probe's
   null result changed nothing structurally · trace: §Response-A critique 1, §Response-B 1
2. **The installer's "explicit choice" is unspecified** — no flag, no outcome, no
   data-safety guarantee · trace: §Response-A critique 2
3. **The byte ceiling has no governance** — who raises it, when, under what approval
   · trace: §Response-A critique 3
4. **The scoping phase needs two documented paths** — Path A (scoping exists) /
   Path B (absent: emitter deleted, digest only, upstream capability request opened)
   · trace: §Response-A critique 4, §Response-B 1
5. **A single pre-registered hit-rate floor is the wrong success criterion** for a
   probabilistic selector — needs improvement-factor plus degradation detection
   · trace: §Response-A critique 5
6. **The egress ladder lacks a pre-flight auth probe and a per-step timeout**
   · trace: §Response-A critique 6
7. **The scoping phase ran before the measurement phase** — rules dispositioned to
   `skill` before skill delivery is measured · trace: §Response-A critique 7
8. **The topology set was too narrow** — monorepo and multi-user shapes missing;
   deliberate vs accidental "both" not distinguished · trace: §Response-A critique 8
9. **The detector corpus conflated precision and recall** — needs fire /
   near-miss-fire / must-not-fire as three classes · trace: §Response-A critique 9
10. **Prevented-work citations were compound** — "item 3" should be line-specific
    · trace: §Response-A critique 10
11. **The 90-day stamp had no decision procedure** · trace: §Response-A critique 11

### Host verdict

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Phase 0 is not a gate | `accept` | the old P0.1 verify said a null "re-shapes the phase" but no step consumed the branch — applied as P0.2 with outcomes A/B/C |
| 2 | Installer choice unspecified | `accept` | real gap; and deleting a user's `~/.claude/rules/` would be a Hard-Floor action per `non-destructive-by-default`, so the no-delete guarantee is now explicit in P1.1 |
| 3 | Ceiling governance | `accept-with-modification` | governance gap is real and applied; the "assertScanned is security theater" framing is **rejected** — this repo has shipped gates that scanned zero files and exited green, so the posture is scar tissue, and P1.2 now says why |
| 4 | Path A / Path B | `accept` | converged; applied, with P3.4's upstream capability request as Path B's own deliverable |
| 5 | Hit-rate floor is wrong criterion | `accept-with-modification` | shape accepted; its arithmetic is **rejected** — it treated the census's 1.4% *invocation share* (4 of 288) as the *selection-accuracy* baseline; P2.2 now pins the baseline to that instrument's own pre-rewrite measurement |
| 6 | Egress auth + timeout | `accept-with-modification` | the auth states were already in the route matrix (`auth-no-push`, `no-auth`); genuinely new and applied are the pre-flight push-rights probe replacing the `git remote` heuristic and the 30 s per-step timeout |
| 7 | Scoping phase before measurement phase | `accept` | strongest finding — Risk #4 already prescribed "Phase 3 precedes any bulk `skill` disposition", which the numbering contradicted; phases swapped and the dependency shape made explicit |
| 8 | Topology set too narrow | `accept-with-modification` | monorepo and multi-user accepted, and the deliberate/accidental split now decides whether P1.1 warns or refuses; **CI rejected** — CI installs nothing into a user-global rules dir, so it is not a delivery topology here |
| 9 | Three fixture classes | `accept` | clean; applied as P4.3's fire / near-miss-fire / must-not-fire |
| 10 | Line-specific citations | `accept` | applied; matches this repo's own `file:line` evidence discipline |
| 11 | 90-day decision procedure | `accept-with-modification` | three-branch procedure and the "from authoring" anchor applied; the weighted phase-percentage formula is **rejected** as over-engineering for a risk row |

### Council provenance

Run 2026-08-08 · deep tier · 3 rounds · members `anthropic/claude-sonnet-4-5`
and `openai/gpt-4o` · necessity check borderline (necessary=5 / unnecessary=5),
proceeded on the maintainer's explicit request · cost estimated \$0.4333, actual
\$0.1682.

The response JSON is deliberately **not** linked. Council artefacts under
`agents/runtime/council/` are gitignored, local-only, and auto-pruned after
`ai_council.session_retention_days` — a path there rots by design, which is what
`no-roadmap-references` § council clause forbids. The convergence, the
divergence, the host verdicts and the four rejected sub-points are inlined above,
which is the durable form.

**Noted for the maintainer:** `/roadmap:ai-council` § 4 instructs the agent to
append exactly the forbidden `Predecessor council trace` path. Following the
command produced the violation `check_council_references` then caught. The
command and the rule disagree; the rule is right, so the command needs the fix.
