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

- [ ] Extract the ticket project key (e.g. `DEV`) from the loaded
      ticket in `scripts/refine_ticket_detect.py`.
- [ ] Add a light repo-match heuristic — compare against
      `composer.json` / `package.json` `name`, branch prefixes, and
      `agents/contexts/` filenames.
- [ ] Surface the result in `Orchestration notes` as a single line:
      either *"Repo-aware context from X matches ticket project Y"*
      or *"Ticket project Y, repo project X — context may not apply"*.
- [ ] Test fixture: a fake ticket with project key `FOO` invoked
      inside a repo whose `composer.json` declares project `bar`;
      expect the mismatch line in the rendered orchestration notes.

Links: [F1 finding](../docs/refine-ticket-in-practice.md#f1--repo-awareness-is-binary-semantically-unreliable).

## Phase F2 — word-boundary keyword matching

Observed: `threat-modeling` triggered on `1Password` via substring
`password`.

- [ ] Switch keyword matching in
      [`detection-map.yml`](../../.agent-src.uncompressed/skills/refine-ticket/detection-map.yml)
      + `scripts/refine_ticket_detect.py` to word-boundary regex
      (`\bpassword\b`, `\bapi\b`, …).
- [ ] Add a minimal blocklist for well-known composites
      (`1password`, `lastpass`, `bitwarden`) — defence in depth.
- [ ] Test fixture: body containing `1Password` must NOT trigger
      `threat-modeling`; body containing `password reset` must.

Links: [F2 finding](../docs/refine-ticket-in-practice.md#f2--threat-modeling-false-positive-on-substring-matches).

## Phase F3 — `validate-feature-fit` second signal

Observed: `require_count: 2` too conservative on single-domain
tickets that still have scope-creep risk.

- [ ] Add an alternative signal to `detection-map.yml`: if a ticket
      contains ≥ N distinct verbs in acceptance criteria **or**
      ≥ M sentences in the description body, consider that a
      `validate-feature-fit` trigger regardless of keyword count.
- [ ] Decide N and M empirically using the two existing case studies
      as calibration — DEV-6182 (multi-topic) should trigger, DEV-6155
      (single-topic) should not.
- [ ] Extend `tests/test_refine_ticket_detect.py` with both calibration
      fixtures.

Links: [F3 finding](../docs/refine-ticket-in-practice.md#f3--validate-feature-fit-require_count-2-too-conservative-on-single-domain-tickets).

## Phase F4 — auto-fetch parent on Story / Sub-task

Observed: DEV-6182 (Story) needed its parent epic (`DEV-6047`) for
AC context. Manual fetch today.

- [ ] Extend `jira-ticket` loader path used by `refine-ticket` to
      auto-fetch the parent when `issuetype ∈ {Story, Sub-task}`
      (+1 API call).
- [ ] Fold the parent's summary + description + AC into the analysis
      context under a clearly separated heading so the skill output
      can cite parent-level constraints explicitly.
- [ ] Skip auto-fetch for `Task` / `Bug` unless a `parent` link
      field is already populated.
- [ ] Test fixture: a Story with a mocked parent must surface at
      least one AC line sourced from the parent in the refined
      output's *Open questions* section.

Links: [F4 finding](../docs/refine-ticket-in-practice.md#f4--parent--linked-issue-context-is-manual).

## Phase F5 — language-strategy rule

Observed: output language was derived correctly but the fallback
hierarchy is undocumented.

- [ ] Add an explicit rule block to the skill procedure in
      [`refine-ticket/SKILL.md`](../../.agent-src.uncompressed/skills/refine-ticket/SKILL.md):
      *user-message language → ticket body language →
      `agent-settings.yml` default*.
- [ ] Mirror the rule in
      [`commands/refine-ticket.md`](../../.agent-src.uncompressed/commands/refine-ticket.md)
      so the command invocation path documents it too.
- [ ] No code change required — this is a documentation-only phase.

Links: [F5 finding](../docs/refine-ticket-in-practice.md#f5--language-strategy-not-documented).

## Phase F6 — close-prompt write-permission probe

Observed: Skill degrades to copy-paste if write access missing,
but only discovers this after the user picks option 1 or 2.

- [ ] Add an upfront permission probe in the skill procedure — one
      cheap `GET /myself` + `editmeta` check when the ticket is
      loaded.
- [ ] If write access is absent, hide options 1 and 2 from the
      close prompt and leave a single option: *"Copy-paste — no
      write access to this project"*.
- [ ] If the probe itself fails (network, auth), fall back to the
      current behaviour (all three options visible, degrade on
      selection).
- [ ] Test fixture: mocked loader reporting no write access must
      produce a close prompt with exactly one option.

Links: [F6 finding](../docs/refine-ticket-in-practice.md#f6--close-prompt-write-permission-not-probed).

## Phase F7 — cross-repo invocation warning

Natural follow-up to F1. Once the repo-awareness sanity check
(Phase F1) lands, extend it to also emit the explicit cross-repo
warning line.

- [ ] After F1 ships, add a second branch to the orchestration-note
      emitter: when `repo.project != ticket.project`, always print
      *"Ticket project X, repo project Y — context may not apply"*
      regardless of whether repo-aware mode is on.
- [ ] Test fixture: same as F1's mismatch fixture, but also
      asserting the line appears when `repo_aware=off`.
- [ ] Depends on: Phase F1.

Links: [F7 finding](../docs/refine-ticket-in-practice.md#f7--cross-repo-invocation-is-a-real-use-case).

## Acceptance criteria for v2 (roadmap-level)

- [ ] All seven phases shipped as individual commits (no bulk).
- [ ] `task ci` stays green across every phase.
- [ ] Each phase has a reproducible test fixture in
      `tests/fixtures/refine_ticket/` + matching assertions in
      `tests/test_refine_ticket_detect.py` (or a new test file
      where the defect lives outside detection logic).
- [ ] `refine-ticket-in-practice.md` gets a *"Findings resolved"*
      section with the commit hashes, per finding, as they land.

## Out of scope

- Rewriting the detection map from YAML to code — remain declarative.
- Replacing the persona voices — the voices worked as designed.
- Adding new sub-skills to the orchestration graph — Phases F1–F7
  all fit inside the existing three-skill graph.
- Performance optimisation — the current runtime is acceptable.

## Open questions

1. **Sequencing:** F2 (word-boundary regex) is the lowest-risk, fastest
   win and unlocks safer testing for F1/F7. Ship F2 first?
2. **F4 API-cost cap:** auto-fetching parents adds one API call per
   Story / Sub-task refinement. Worth it, or gate behind a
   `--with-parent` flag?
3. **F6 probe caching:** cache the probe result per Jira project for
   the session, or re-probe per run? Tradeoff: stale-access risk vs.
   noise.

## See also

- [`agents/docs/refine-ticket-in-practice.md`](../docs/refine-ticket-in-practice.md) — findings source
- [`archive/road-to-ticket-refinement.md`](archive/road-to-ticket-refinement.md) — v1 shipped
- [`open-questions-2.md`](open-questions-2.md) — Q27 resolution
- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame

