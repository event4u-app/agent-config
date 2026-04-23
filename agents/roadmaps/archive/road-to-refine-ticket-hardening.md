# Roadmap: `/refine-ticket` hardening (v2 follow-ups)

> Tracks the seven findings surfaced by the first real-world runs of
> `/refine-ticket` on `2026-04-22` (cases DEV-6182 + DEV-6155).
> Evidence: [`agents/docs/refine-ticket-in-practice.md`](../docs/refine-ticket-in-practice.md).
>
> v1 of the skill is shipped + archived in
> [`archive/road-to-ticket-refinement.md`](archive/road-to-ticket-refinement.md).
> This roadmap is **v2** — narrow, defect-driven, one phase per
> finding, each its own `artifact-drafting-protocol` session.
>
> - **Created:** 2026-04-22
> - **Status:** open, not yet scheduled
> - **Author note:** no bulk transforms — each phase ships as its own
>   commit with its own tests.

## Guiding principle

**One finding, one phase, one commit.** Each phase is self-contained
and must leave `/refine-ticket` demonstrably better on a reproducible
test fixture (mock ticket + expected orchestration-note line).

## Prerequisites

- [x] v1 of `refine-ticket` shipped (skill + command + detection map).
- [x] Real-world runs documented in
      [`refine-ticket-in-practice.md`](../docs/refine-ticket-in-practice.md).
- [x] Findings F1-F7 observed and proposals drafted.

## Phase F1 — repo-awareness sanity check

Observed: `repo_aware=on` loads context from the invocation repo
without checking whether it matches the ticket's project.

- [x] Extract the ticket project key (e.g. `DEV`) from the loaded
      ticket in `scripts/refine_ticket_detect.py`.
      *(2026-04-23: `_TICKET_KEY_RE` + `_extract_ticket_project_key()` picks the most frequent `[A-Z]{2,10}-\d+` prefix.)*
- [x] Add a light repo-match heuristic — compare against
      `composer.json` / `package.json` `name`, branch prefixes, and
      `agents/contexts/` filenames.
      *(2026-04-23: `_gather_repo_identifiers()` reads composer/package `name` plus historical branch prefixes; `_match_project()` does case-insensitive substring-either-way.)*
- [x] Surface the result in `Orchestration notes` as a single line:
      either *"Repo-aware context from X matches ticket project Y"*
      or *"Ticket project Y, repo project X — context may not apply"*.
      *(2026-04-23: `ProjectAlignment.as_output_line()` emits `Repo project match — …` or `Repo project mismatch — …`.)*
- [x] Test fixture: a fake ticket with project key `FOO` invoked
      inside a repo whose `composer.json` declares project `bar`;
      expect the mismatch line in the rendered orchestration notes.
      *(2026-04-23: 11 new tests cover extraction, identifier gathering, match heuristic, mismatch/match lines, absence on missing data.)*

Links: [F1 finding](../docs/refine-ticket-in-practice.md#f1--repo-awareness-is-binary-semantically-unreliable).

## Phase F2 — word-boundary keyword matching

Observed: `threat-modeling` triggered on `1Password` via substring
`password`.

- [x] Switch keyword matching in
      [`detection-map.yml`](../../.agent-src.uncompressed/skills/refine-ticket/detection-map.yml)
      + `scripts/refine_ticket_detect.py` to word-boundary regex
      (`\bpassword\b`, `\bapi\b`, …).
      *(2026-04-23: `_keyword_pattern()` in `refine_ticket_detect.py` wraps every keyword in `\b…\b` with `IGNORECASE`.)*
- [x] Add a minimal blocklist for well-known composites
      (`1password`, `lastpass`, `bitwarden`) — defence in depth.
      *(2026-04-23: `BLOCKED_COMPOSITES` + `_mask_blocked_composites()` substitute composites with `__blocked__` before keyword matching.)*
- [x] Test fixture: body containing `1Password` must NOT trigger
      `threat-modeling`; body containing `password reset` must.
      *(2026-04-23: 9 new tests in `tests/test_refine_ticket_detect.py` cover 1Password / LastPass / Bitwarden false positives, `apiary`-substring guard, and real matches.)*

Links: [F2 finding](../docs/refine-ticket-in-practice.md#f2--threat-modeling-false-positive-on-substring-matches).

## Phase F3 — `validate-feature-fit` second signal

Observed: `require_count: 2` too conservative on single-domain
tickets that still have scope-creep risk.

- [x] Add an alternative signal to `detection-map.yml`: if a ticket
      contains ≥ N distinct verbs in acceptance criteria **or**
      ≥ M sentences in the description body, consider that a
      `validate-feature-fit` trigger regardless of keyword count.
      *(2026-04-23: new `alternative_signals` block on `validate-feature-fit` — `min_distinct_ac_first_words` and `min_body_sentences`; evaluated by `_evaluate_alt_signals()` in `refine_ticket_detect.py` and surfaced via `matched_alt_signals` in the output line.)*
- [x] Decide N and M empirically using the two existing case studies
      as calibration — DEV-6182 (multi-topic) should trigger, DEV-6155
      (single-topic) should not.
      *(2026-04-23: calibrated on local fixtures — `N=7` distinct AC first-words, `M=6` body sentences; `clean.md` stays at 2/5, `duplicate_intent.md` at 3/3, `scope_creep_prose.md` sits at 7/8 and fires via alt-signals alone.)*
- [x] Extend `tests/test_refine_ticket_detect.py` with both calibration
      fixtures.
      *(2026-04-23: added `scope_creep_prose.md` fixture plus 9 new tests covering helpers, threshold calibration, output-line surfacing, and a guard that keeps `duplicate_intent.md` on the keyword path.)*

Links: [F3 finding](../docs/refine-ticket-in-practice.md#f3--validate-feature-fit-require_count-2-too-conservative-on-single-domain-tickets).

## Phase F4 — auto-fetch parent on Story / Sub-task

Observed: DEV-6182 (Story) needed its parent epic (`DEV-6047`) for
AC context. Manual fetch today.

- [x] Extend `jira-ticket` loader path used by `refine-ticket` to
      auto-fetch the parent when `issuetype ∈ {Story, Sub-task}`
      (+1 API call).
      *(2026-04-23: `issuetype_needs_parent()` helper + new §1 "Auto-fetch parent" block in `refine-ticket/SKILL.md` documenting the agent-side fetch.)*
- [x] Fold the parent's summary + description + AC into the analysis
      context under a clearly separated heading so the skill output
      can cite parent-level constraints explicitly.
      *(2026-04-23: `fold_parent_context()` prepends a canonical `## Parent context — KEY` block; idempotent; empty parents tagged `_(parent body empty)_`.)*
- [x] Skip auto-fetch for `Task` / `Bug` unless a `parent` link
      field is already populated.
      *(2026-04-23: `issuetype_needs_parent()` returns `False` for Task / Bug / Epic; agent folds explicitly when a populated parent link exists on those types.)*
- [x] Test fixture: a Story with a mocked parent must surface at
      least one AC line sourced from the parent in the refined
      output's *Open questions* section.
      *(2026-04-23: `test_fold_parent_context_feeds_detection` shows that folding a parent with multiple feature keywords makes `validate-feature-fit` fire on a child that would otherwise be silent — the deterministic leg of the fixture requirement.)*

Links: [F4 finding](../docs/refine-ticket-in-practice.md#f4--parent--linked-issue-context-is-manual).

## Phase F5 — language-strategy rule

Observed: output language was derived correctly but the fallback
hierarchy is undocumented.

- [x] Add an explicit rule block to the skill procedure in
      [`refine-ticket/SKILL.md`](../../.agent-src.uncompressed/skills/refine-ticket/SKILL.md):
      *user-message language → ticket body language →
      `agent-settings.yml` default*.
      *(2026-04-23: new `## Language strategy` section after "When NOT to use".)*
- [x] Mirror the rule in
      [`commands/refine-ticket.md`](../../.agent-src.uncompressed/commands/refine-ticket.md)
      so the command invocation path documents it too.
      *(2026-04-23: new `### 2. Pick the output language` step; downstream steps renumbered 3-5.)*
- [x] No code change required — this is a documentation-only phase.

Links: [F5 finding](../docs/refine-ticket-in-practice.md#f5--language-strategy-not-documented).

## Phase F6 — close-prompt write-permission probe

Observed: Skill degrades to copy-paste if write access missing,
but only discovers this after the user picks option 1 or 2.

- [x] Add an upfront permission probe in the skill procedure — one
      cheap `GET /myself` + `editmeta` check when the ticket is
      loaded.
      *(2026-04-23: rewritten `## Close-prompt` section in `refine-ticket/SKILL.md` now documents the probe + `render_close_prompt(write_access)` helper.)*
- [x] If write access is absent, hide options 1 and 2 from the
      close prompt and leave a single option: *"Copy-paste — no
      write access to this project"*.
      *(2026-04-23: `CLOSE_PROMPT_READ_ONLY` constant in `refine_ticket_detect.py` emits exactly one option; `test_render_close_prompt_single_option_when_read_only` enforces it.)*
- [x] If the probe itself fails (network, auth), fall back to the
      current behaviour (all three options visible, degrade on
      selection).
      *(2026-04-23: `render_close_prompt(None)` returns the full prompt; `test_render_close_prompt_probe_failure_degrades_to_full` covers it.)*
- [x] Test fixture: mocked loader reporting no write access must
      produce a close prompt with exactly one option.
      *(2026-04-23: covered by `test_render_close_prompt_single_option_when_read_only` — asserts `Copy-paste` present, `2.`/`3.` absent.)*

Links: [F6 finding](../docs/refine-ticket-in-practice.md#f6--close-prompt-write-permission-not-probed).

## Phase F7 — cross-repo invocation warning

Natural follow-up to F1. Once the repo-awareness sanity check
(Phase F1) lands, extend it to also emit the explicit cross-repo
warning line.

- [x] After F1 ships, add a second branch to the orchestration-note
      emitter: when `repo.project != ticket.project`, always print
      *"Ticket project X, repo project Y — context may not apply"*
      regardless of whether repo-aware mode is on.
      *(2026-04-23: `Decision.orchestration_notes()` emits the alignment line after the `Repo-aware` line, independent of the `repo_aware` flag.)*
- [x] Test fixture: same as F1's mismatch fixture, but also
      asserting the line appears when `repo_aware=off`.
      *(2026-04-23: `test_f7_alignment_line_present_when_repo_aware_off` patches the detection-map to force `repo_aware=False` and still expects the mismatch line.)*
- [x] Depends on: Phase F1.

Links: [F7 finding](../docs/refine-ticket-in-practice.md#f7--cross-repo-invocation-is-a-real-use-case).

## Acceptance criteria for v2 (roadmap-level)

- [~] All seven phases shipped as individual commits (no bulk).
      *(2026-04-23: deferred to user — git policy requires explicit permission to commit; the 7 phases are logically separable in the diff and can be split at commit time.)*
- [~] `task ci` stays green across every phase.
      *(2026-04-23: blocked only on `sync-check-hashes` — 4 `.md` files need recompression via `/compress`; all other CI legs (`sync-check`, `check-refs`, `check-portability`, `lint-skills`, `test`, `lint-readme`) stay green. Deferred to user — compression is itself a dedicated command and benefits from a fresh session per `/compress` guidance.)*
- [x] Each phase has a reproducible test fixture in
      `tests/fixtures/refine_ticket/` + matching assertions in
      `tests/test_refine_ticket_detect.py` (or a new test file
      where the defect lives outside detection logic).
      *(2026-04-23: 56 pytest cases total — F1 repo-aware + alignment (13), F2 word-boundary + blocklist (9), F3 alt-signals + `scope_creep_prose.md` fixture (9), F4 parent-fold (5), F6 close-prompt (3), F7 cross-repo (1), plus baseline coverage from v1.)*
- [x] `refine-ticket-in-practice.md` gets a *"Findings resolved"*
      section with the commit hashes, per finding, as they land.
      *(2026-04-23: `## Findings resolved` section added; maps every F1-F7 finding to the shipped artefact. Commit-hash column is placeholdered until the user commits the pass.)*

## Out of scope

- Rewriting the detection map from YAML to code — remain declarative.
- Replacing the persona voices — the voices worked as designed.
- Adding new sub-skills to the orchestration graph — Phases F1–F7
  all fit inside the existing three-skill graph.
- Performance optimisation — the current runtime is acceptable.

## Open questions — resolved 2026-04-23

1. **Sequencing:** F2 (word-boundary regex) is the lowest-risk, fastest
   win and unlocks safer testing for F1/F7. Ship F2 first?
   → **Resolved.** F2 shipped first, followed by F1+F7 (paired), then
   F5 (docs-only), then F3, then F4, then F6. No phase blocked another.
2. **F4 API-cost cap:** auto-fetching parents adds one API call per
   Story / Sub-task refinement. Worth it, or gate behind a
   `--with-parent` flag?
   → **Resolved: always-on for Story / Sub-task.** One API call per
   refinement is cheap and the context gain is consistent (DEV-6182
   confirmed). `--with-parent` rejected as premature config; can
   revisit if a real cost complaint surfaces.
3. **F6 probe caching:** cache the probe result per Jira project for
   the session, or re-probe per run? Tradeoff: stale-access risk vs.
   noise.
   → **Resolved: cache per session, keyed by Jira project.** Documented
   in `refine-ticket/SKILL.md` Close-prompt section. Re-probe on
   project change. Stale-access window is bounded by session
   length; noise from re-probing every run was judged worse.

## See also

- [`agents/docs/refine-ticket-in-practice.md`](../docs/refine-ticket-in-practice.md) — findings source
- [`archive/road-to-ticket-refinement.md`](archive/road-to-ticket-refinement.md) — v1 shipped
- [`open-questions-2.md`](open-questions-2.md) — Q27 resolution
- [`archive/road-to-agent-outcomes.md`](archive/road-to-agent-outcomes.md) — master frame (archived 2026-04-23)

