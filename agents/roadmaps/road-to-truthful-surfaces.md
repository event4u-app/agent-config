---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that the update banner names `npx @event4u/agent-config update` while the global self-update is `upgrade` (update_check.ts:167 vs cmd_upgrade.ts:13-17), that `.github/about.yml:10` points at a retired `scripts/lint_positioning.py` while the check lives at `src/scripts/lint_positioning.ts`, that `check_update_banner.ts:11` points at a retired `update_check.py`, that `.github/topics.yml:29` still advertises `python` while `no-python-in-src.yml` forbids it, and that `update_counts.ts:275-292` keys the machine-checked badge row on shields URL patterns rather than on the claim line, so a non-derivable badge dropped into that row is silently ignored. No active, parked or stub roadmap owns any of these: a grep over agents/roadmaps/{*,later,stubs} for update_counts, _format_banner, lint_positioning, topics.yml and ISSUE_TEMPLATE returns nothing, and the visibility-sync stub owns the push channel rather than the in-tree text. Archiving or parking costs more because every item is a one-line in-tree correction already reproduced; merging into a neighbour would put five independent surface corrections behind an unrelated plan's blockers."
relates:
  - slug: road-to-a-release-that-says-whether-it-needs-you
    relation: disjoint
    note: "Owns what a version number means and how the bump is cut. This file changes no release logic and adds no trailer; the banner fix here is about which command a banner names, not about when it fires."
  - slug: road-to-an-update-that-installs-itself-only-when-it-is-safe
    relation: disjoint
    note: "That file depends on this one — its Phase 3 keeps the CLI banner as the fallback for hosts with no session slot and needs it to name the right command first. The edge is declared there; nothing here waits on it."
  - slug: road-to-a-setup-that-decides-itself
    relation: disjoint
    note: "Owns what the setup wizard decides. This file touches no setup path; `doctor_install_mode.ts` is read here, never changed."
---
# Road to truthful surfaces

> **Source:** `agents/tmp.old/inbox-2026-10-t/topic-1/` — one transcript and
> four supplied plans from two parallel sessions on this package's update,
> badge and distribution surfaces. The plans were pinned at `main@a10aa16a`;
> every reading below was re-taken at `main@5fa963cec` on 2026-10-16, and the
> six commits since that pin are all in the ratification and merge-gate area
> and touch none of the cited code. Readings marked *(executed)* ran against
> this tree in a scratch directory outside the repository.

## Goal

Every public surface of this package names the right command, the right file
and the right number. A user who follows the update banner changes the thing
they meant to change; a reader who follows a pointer in `.github/` reaches a
file that exists; the machine-checked badge row cannot silently acquire a badge
nothing re-derives.

No adoption question is touched here, and nothing in this file depends on one.
The download badge lands **outside** the claim row precisely so it needs no
claim contract and makes no growth argument.

## Prerequisites

- `npx vitest` runs locally. No network: every check below is in-tree.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| F1 | **The update banner sends a global user to the project-pin command.** The banner prints `Update: npx ${PACKAGE_NAME} update` (`src/scripts/_lib/update_check.ts:167`). `update` flips the `agent_config_version` pin in `.agent-settings.yml` and is documented as "the only user-driven path that flips" it (`src/scripts/_cli/cmd_update.ts:11-13`); the global self-update is `upgrade` (`src/scripts/_cli/cmd_upgrade.ts:13-17`). Consumption is global-only through hosts (`README.md:188`), so following the banner on a global install changes nothing the user meant to change. |
| F2 | **The machine-checked badge row has no positional guard.** `README.md:7` and `:9` carry `<!-- claim:published-artifact-counts -->`, and `package.json:5` promises "every claim machine-checked, including the counts in these badges". `update_counts.ts:275-292` matches the six counts by **shields.io URL pattern**, never by line. *(executed)* a `/npm/dm/` badge placed on the claim line matches no pattern and is silently ignored — `update_counts --check` still exits 0. The hazard the supplied plans named is real and currently unguarded, and the guard is net-new work rather than an extension of a positional check that does not exist. |
| F3 | **`README.md:5` already carries five badges, not one.** Smoke, public-install smoke, npm version, a directory score and a toplist badge. The supplied plans state "an npm version badge only"; the inventory is wrong, the substance — no download badge anywhere — holds. |
| F4 | **Three stale in-tree pointers at retired Python files.** `.github/about.yml:10` names `scripts/lint_positioning.py`; the file is `src/scripts/lint_positioning.ts` — the **directory is wrong too**, not only the extension. `src/scripts/check_update_banner.ts:11` names `src/scripts/_lib/update_check.py` <!-- ref-ignore --> — the quoted defect, not a live link; the file is `.ts`. Both survive because nothing resolves a pointer inside a comment. |
| F5 | **`.github/topics.yml` advertises `python`.** The entry is at `:29` with a description at `:48` ("Maintenance scripts + build pipeline") and a synonym row, while `.github/workflows/no-python-in-src.yml` forbids Python under `src/`. *(executed)* `git ls-files '*.py'` returns **2** files repo-wide, both test fixtures. `cinematic-ai-video` is **not** in this class — `topics.yml:50` carries its recorded rationale. |
| F6 | **Three discovery surfaces disagree about this package.** `.github/about.yml:14` gives the organisation site as the homepage; `package.json:16` gives the documentation site. `about.yml:13`'s description differs from `package.json:5`'s. The sync is a manual dispatch (`about.yml:4-6`). |
| F7 | **A feedback path exists and no moment leads to it.** The self-repair loop renders a `user-reported` record into an issue form (`src/scripts/_lib/self_repair.ts:67-74`, `.github/ISSUE_TEMPLATE/self_repair_report.yml`), while `.github/ISSUE_TEMPLATE/config.yml` lists exactly two contact links and neither is Discussions. |

## Not in this file — the push channel is owner-reserved

`.github/workflows/sync-visibility.yml` is the declared write channel for the
repository description, homepage and topic list, and it **cannot write**: it
authenticates with `secrets.GITHUB_TOKEN` only, and a dispatch with
`dry_run=false` on 2026-10-15 returned `403 Resource not accessible by
integration`. That is already held at
`agents/roadmaps/stubs/road-to-a-visibility-sync-that-can-write.md`, on its
second arrival. **Phase 3 corrects the in-tree text and nothing else**; the
push is recorded against that stub rather than claimed here, so no step in this
file can report an externally visible change as done.

## Phase 1 — The banner names the command that does what it says

- [x] **1.1 Make `_format_banner` origin-aware.** `update_check.ts:164-168`
      reads the install origin from `src/scripts/_cli/doctor_install_mode.ts`
      — already shipped, no new detector — and emits `agent-config upgrade`
      for a global install, `agent-config update` for a project whose pin is
      behind latest, and no command line at all for an ephemeral `npx` run.
      One fixture per origin asserts the emitted command string.
      verify: `npx vitest run tests/scripts/update_check*` -> 0
- [x] **1.2 Fix the stale pointer in the banner entry point.**
      `src/scripts/check_update_banner.ts:11` names `_lib/update_check.py`.
      verify: `grep -rn 'update_check\.py' src/` -> 1

## Phase 2 — A download badge that cannot corrupt the claim row

- [x] **2.1 Add the downloads badge outside the claim row.** A
      `https://img.shields.io/npm/dm/@event4u/agent-config` badge on
      `README.md:5`, linked to the npm page, labelled with its window
      (`downloads/month`) so the number is not read as an install base.
      verify: a `grep -n` for `npm/dm` in `README.md` returns a line number that
      is neither 7 nor 9.
- [x] **2.2 Scope the machine-checked promise to what is actually
      re-derivable.** `README.md:3`, `package.json:5` and `.github/about.yml:13`
      say "the counts in these badges"; `update_counts` re-derives six artifact
      counts and nothing else. Narrow the phrase to "the artifact counts in
      these badges" on all three surfaces.
      verify: a `grep -c` for `artifact counts in these badges` over `package.json`, `.github/about.yml` and `README.md` returns 1 on each, and the same count for the unscoped phrase returns 0 on each.
- [x] **2.3 Give the claim row a positional guard.** Extend
      `src/scripts/update_counts.ts` so that every badge on the line carrying
      `<!-- claim:published-artifact-counts -->` must match one of the six
      re-derivable URL patterns at `:282-292`; anything else is a finding.
      This is new behaviour, not a seventh count.
      verify: a fixture README with a `/npm/dm/` badge on the claim line makes
      `update_counts --check` exit non-zero, and the same badge one line above
      exits 0. Both directions asserted — a guard never shown its own denial
      has untested sensitivity.

## Phase 3 — Pointers and metadata that resolve

- [ ] **3.1 Correct `.github/about.yml:10-12`** to `src/scripts/lint_positioning.ts`
      — directory and extension.
      `./scripts-run src/scripts/lint_positioning` exits 0, and no `.py` pointer
      survives.
      verify: `grep -rn 'lint_positioning\.py' .github/ src/` -> 1
- [ ] **3.2 Drop `python` from `.github/topics.yml`** — the entry at `:29`, its
      description at `:48` and its synonym row. Add the search terms the file
      is missing: `claude-code-plugin`, `mcp-server`, `agent-rules`. Leave
      `cinematic-ai-video` alone; `:50` records why it is there.
      verify: `grep -n 'python' .github/topics.yml` -> 1
- [ ] **3.3 Link Discussions from the issue chooser.** Add the two Discussions
      contact links to `.github/ISSUE_TEMPLATE/config.yml` beside the existing
      contributing and troubleshooting entries.
      verify: `grep -c 'discussions' .github/ISSUE_TEMPLATE/config.yml` -> /^[1-9][0-9]*$/
- [ ] **3.4 Record the push items against the stub that owns them.** Add an
      arrivals line to
      `agents/roadmaps/stubs/road-to-a-visibility-sync-that-can-write.md`
      naming the homepage, description and topic-list push as blocked on the
      403, with this round's codename. Do **not** mark them done anywhere.
      verify: that file carries an `Arrivals:` line naming `inbox-2026-10-t`.
- [ ] **3.5 Stage, do not flip, the registry tracking row.** Prepare the
      corrected text for `docs/distribution/registry-submissions.md:37`, whose
      status reads `submitted` while the upstream pull request is closed. The
      flip needs an upstream read that is not available offline, so the step
      ships the text and names the read.
      verify: the row carries a dated status with a reason, or the PR body
      names the read as outstanding.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The downloads badge goes **outside** the claim row, not inside it with a footnote | `update_counts.ts:275-292` matches by URL pattern, so a badge in the row is silently unguarded either way; placing it outside removes the hazard instead of documenting it | the counts gate gains a positional check that makes the row safe by construction |
| D2 | reversible-technical | evidence | Narrow the headline phrase rather than widen `update_counts` to re-derive a download count | a live third-party count cannot be re-derived from the tree, which is what `package.json:5` promises | npm publishes a signed, pinnable count the tree can verify |
| D3 | deterministic | evidence | The origin signal comes from `doctor_install_mode.ts`, not a new detector | it already classifies the install origin and `upgrade` consumes it | that module stops distinguishing global from project-pinned |
| D4 | deterministic | agent | `cinematic-ai-video` stays in `topics.yml` | `:50` carries a recorded differentiator rationale; only `python` is stale | the rationale is withdrawn |
| D5 | contested-technical | agent | The push half is recorded against the existing stub rather than carried as a blocker here | a blocker duplicating a stub the tree already holds grows the estate twice for one obligation | the stub is closed or cancelled |

## What this roadmap deliberately does not do

- It adds no star prompt and argues for none: `ADR-286` § D2 refuses in-product
  asking outright, in the same round that produced this file. It also submits
  nothing to a directory — `ADR-286` § D1 permits that work and
  `road-to-a-distribution-ledger-that-is-true` owns it; this file corrects
  in-tree text and nothing outward.
- It does not change when the banner fires, what it is throttled by, or whether
  an update installs itself. Only the command it names.
- It does not touch `agent_config_version`, `installed-tools.lock` or any team
  reproducibility surface.
- It does not push anything to the repository's own settings. Phase 3 edits
  tracked files; the externally visible push stays with the stub.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The origin-aware banner names the wrong command for an origin nobody enumerated | implementation | A user on an install shape `doctor_install_mode` does not classify gets a command that does nothing, which is today's defect wearing new code. | A fixture per origin, and an unknown origin emits the notice with **no** command line rather than a guessed one. | Phase 1 — The banner names the command that does what it says |
| 2 | The positional guard fires on a legitimate future badge | implementation | A seventh re-derivable count is added and the guard refuses it. | The guard reads the same pattern list the counts use, so adding a count adds a pattern; the fixture asserts both directions. | Phase 2 — A download badge that cannot corrupt the claim row |
| 3 | Narrowing the headline reads as weakening a published claim | product | "artifact counts" is a smaller promise than "the counts", and the diff makes that visible. | It is the promise the code already keeps; the alternative is a claim the tree cannot check. D2 records the trade. | Phase 2 — A download badge that cannot corrupt the claim row |
| 4 | A `downloads/month` badge is read as an install base | product | Downloads count fetches, including CI and mirrors, not users. | The badge carries its window in the label and links to the source; no total counter and no derived rate is published anywhere. | Phase 2 — A download badge that cannot corrupt the claim row |
| 5 | Dropping the `python` topic loses incoming search traffic | product | The topic may be carrying discovery the file cannot measure. | Three accurate terms are added in the same step; the inaccurate one is the only removal. | Phase 3 — Pointers and metadata that resolve |

## Acceptance Criteria

- [ ] **AC-1** On a global install the update banner names `upgrade`; in a
      project whose pin is behind latest it names `update`; under an ephemeral
      `npx` run it names no command. Asserted by fixture, one per origin.
- [ ] **AC-2** `grep -rn 'update_check\.py\|lint_positioning\.py' src/ .github/`
      returns 0.
- [ ] **AC-3** A README whose claim line carries a non-re-derivable badge makes
      `update_counts --check` exit non-zero; the same badge outside the row
      exits 0.
- [ ] **AC-4** `README.md` carries a `downloads/month` badge that is not on a
      line bearing `claim:published-artifact-counts`.
- [ ] **AC-5** `grep -n 'python' .github/topics.yml` returns 0 and
      `lint_positioning` exits 0.
- [ ] **AC-6** `.github/ISSUE_TEMPLATE/config.yml` links Discussions.
- [ ] **AC-7** No step in this file reports a change to the repository's own
      description, homepage or topic list as done; the visibility-sync stub
      carries this round in its arrivals line.
- [ ] **AC-8** `task ci` green.

## Provenance

Source-derived under template rule 19. The source set is one transcript and
four supplied plans produced in two parallel sessions outside this tree, plus
nine external references the sessions consulted. Neither the sessions nor the
references are named here, per `source-confidentiality`; the retained links are
`ENC1`-encrypted in the round's intake note.

Gap table — every item audited against the shipped surface before it entered a
phase:

| Proposed | Verdict | Why |
|---|---|---|
| Download badge | KEEP | No download badge exists on any surface. |
| Banner names the wrong command | KEEP | Reproduced at `update_check.ts:167`. |
| Positional guard on the claim row | KEEP | Reproduced absent at `update_counts.ts:275-292`; the supplied plans assumed it existed. |
| "`README.md:5` has a version badge only" | CUT | Five badges are there; the inventory was wrong and the substance is covered by the badge item. |
| "`about.yml` has a stale file extension" | KEEP, corrected | The directory is wrong too. |
| Post-upgrade `doctor` | CUT | Already shipped — `cmd_upgrade.ts:618-624`. |
| Install-mode detection | CUT | Already shipped — `doctor_install_mode.ts`. |
| A release channel | CUT | Already shipped — `publish-npm.yml:154-168`. |
| Repo description / homepage / topic push | FOLD | Owned by `stubs/road-to-a-visibility-sync-that-can-write.md`; folded in as an arrival, not planned here. |
| Registry submissions, Packagist claim, awesome-list | FOLD | Owned by `stubs/road-to-bus-factor-external-actions.md` under a council disposition that forbids a parent recording them as done. |
| Star prompt | CUT | Refused outright by `ADR-286` § D2 (owner ruling, same round). |
| Directory listings, registry submissions | FOLD | Permitted by `ADR-286` § D1 and owned by `road-to-a-distribution-ledger-that-is-true`; this file corrects in-tree text only. |

## Notes — how this file was derived

Three extraction passes over the source set, converging at pass 2 with a 14.6 %
delta; the claim set was verified against the working tree rather than against
the pin, and the two numeric claims that could be re-derived offline (the CI
Node-version histogram and the major-release classification) reproduce to the
digit. Four findings in this file are **not** in the source set: the absent
positional guard (F2), the wrong badge inventory (F3), the second stale Python
pointer (F4, the banner entry point) and the stale topic description (F5,
`:48`). They came from verification, not from re-reading.
