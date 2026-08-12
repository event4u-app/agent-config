---
complexity: structural
---

# Road to zero settings — delete the flags whose answer the situation already carries

> **The direction, in the maintainer's words (2026-08-12):** *"das package soll
> immer weniger settings erhalten, bis es bald keine mehr gibt."* This roadmap
> turns that into a classification anybody can re-run, and a deletion order that
> starts with the keys whose removal is provably free.

> **It does not promise zero.** A settings surface has a floor, and naming it up
> front is the difference between a direction and a slogan: a value nothing in
> the environment can derive — the user's name, the user's chosen language — is
> not a flag, it is an input. The target is *every key that encodes a decision
> the situation already answers*, which is a strictly smaller and fully
> checkable set.

## Context / What is verified

**The surface, measured 2026-08-12.** `lint_settings_classes` walks the template
and reports **140 leaves**: class A (preference) 27, class B (consent) 3, class C
(guarded) 110. The crude section count is 38 top-level blocks. These are the
numbers this roadmap works against; re-derive with `task lint-settings-classes`
rather than trusting this paragraph.

**The precedent exists and has been walked twice.** `REMOVED_KEYS` in
`src/scripts/_lib/agent_settings.ts` ignores a deleted key and warns once per
process on stderr — the exit code never changes, so an older install keeps
booting. It carried five entries from the always-on-orchestration doctrine
(ADR-105: `subagents.enabled`, `subagents.auto`, `subagents.host_capabilities`,
`subagents.budget_routing`, `ai_team.enabled`) and gained four on 2026-08-12
(`hooks.turn_end_gate.*`). Deleting a key is therefore a solved mechanical
problem; what is unsolved is *which* keys.

**The turn-end-gate deletion is the shape to generalise, and it carries an
argument worth reusing.** That switch existed so the gate could soak before it
bound. A concern that is off does not run — so the flag protecting the soak was
the thing preventing it. The general form: **a flag whose stated purpose is to
delay a mechanism usually prevents the evidence that would justify the
mechanism.** Any key answering "should this run?" is a candidate for exactly
this reading.

**What replaced it is the honest part.** Not "always refuse" — the detectors'
own trigger conditions. The judgement moved from a config file to the place that
can actually see the situation. That is the test a deletion has to pass, and it
is why this is not a blanket removal exercise.

## The four classes — the disposition axis

The existing A/B/C classes answer *who may write a key*. They do not answer
*whether the key should exist*, so this roadmap adds an orthogonal axis:

| Disposition | Meaning | Action |
|---|---|---|
| **Derivable** | the mechanism itself can decide, from the situation, better than a flag can | delete; move the decision into the mechanism |
| **Un-inferrable** | a fact about the human that nothing in the environment carries (name, language, IDE binary) | keep — this is the floor |
| **Consent** | a standing authorisation for something the package would otherwise do to the user | keep, but re-examine whether the ACTION needs authorising at all |
| **Policy** | a project-level fact the tree could carry instead (audience, jurisdiction) | move into the project surface, then delete the key |

Every one of the 140 leaves lands in exactly one. A key with no disposition is
the finding.

## Phase 1 — classify all 140, with the number published

- [x] 1.1 Extend `lint_settings_classes` (or a sibling reporter) to emit a
  per-key **disposition** column alongside the existing class, sourced from a
  committed table rather than a heuristic — the classification is a judgement
  and must be reviewable as data, not re-derived per run.
  `verify:` the reporter prints 140 rows and 0 rows with an empty disposition.
- [x] 1.2 Fill the table for all 140 leaves. Each `derivable` row names, in one
  clause, **what would decide instead** — a mechanism, a probe, a file. A row
  that cannot name its replacement is not `derivable`; it is `policy` or
  `un-inferrable`, and mislabelling it is how a deletion becomes a regression.
  `verify:` every `derivable` row has a non-empty replacement clause.
- [x] 1.3 Publish the four counts. This roadmap deliberately does NOT predict
  them: a target number written before the classification would steer it, which
  is the same pre-registration failure the package has recorded twice.
  `verify:` the four counts sum to 140.

## Phase 2 — delete the free tier

- [x] 2.1 Take the `derivable` rows whose replacement is **already implemented**
  (the mechanism exists and the flag merely gates it) and delete them in one
  batch: template, zod schema, `settings-classes.md` row + Counts, `REMOVED_KEYS`
  entry with its own reason string, regenerated `settings-reference.md`.
  `verify:` `task lint-settings-classes` and `task check-settings-reference` green;
  a leftover key warns and is ignored rather than honoured (one spawned test per
  deleted mechanism, in the shape of `turn_end_gate_hook.test.ts`'s
  "a leftover … cannot disarm it").
- [x] 2.2 For each deleted key, assert the **inverted invariant** — the test that
  used to pin "absent ⇒ off" now pins "absent ⇒ armed". Deleting the old test
  without inverting it removes the only thing that would notice a silent
  regression to the old default.
  `verify:` no deleted key leaves its suite with a net loss of assertions.

## Phase 3 — the keys that need a mechanism first

- [ ] 3.1 For `derivable` rows whose replacement does **not** yet exist, write
  the replacement before touching the key. Order is the point: a key deleted
  ahead of its mechanism is a silently-changed default, not a simplification.
  `verify:` each such key's deletion commit is later than its mechanism's.
- [ ] 3.2 Re-examine the three class-B consent keys against the question
  *"does the action need authorising at all?"* — a consent gate on an action the
  package should not be taking is two problems wearing one flag.
  `verify:` each of the three carries a recorded verdict (keep / redesign the
  action), not a deferral.

## Phase 4 — state the floor and stop

- [x] 4.1 Publish the residual set with, per key, the sentence explaining why no
  mechanism can derive it. A floor nobody can argue with is the deliverable; a
  floor asserted without reasons is where the next round quietly re-grows.
  `verify:` every residual key has a non-empty reason.
- [x] 4.2 Add the authoring gate: a NEW settings key must arrive with its
  disposition, and `derivable` is rejected. Without this the surface re-grows at
  the rate features land, and every count above becomes historical.
  `verify:` the gate fails a fixture PR that adds a `derivable` key.

## What Phase 1 measured (2026-08-12)

The four counts 1.3 refused to predict, taken from the filled table rather than
estimated: **derivable 88 · consent 38 · un-inferrable 9 · policy 5**, total 140.
Re-derive with `./scripts-run src/scripts/lint_settings_classes` rather than
trusting this paragraph.

Two findings the classification produced that no step asked for:

- **Six keys have no reader at all** — `telegraph.speak_scope`,
  `chat_history.max_size_kb`, `chat_history.on_overflow`,
  `quality.wait_for_remote_ci`, `screenshots.data_bearing_gate`,
  `legal_review_prep.consented_at`. Each is in the template, the schema and the
  reference page, several are in the setup wizard, and no code path consults any
  of them. They are the obvious first batch for 2.1: an unread key needs no
  replacement mechanism, so it is the one deletion that cannot silently change a
  default. Two of them sit on consent-shaped surfaces, which means the
  authorisation they appear to carry is not enforced anywhere today.
- **A live schema-vs-doc drift on `telegraph.speak_scope`**: the Zod schema's
  enum is `off | reply | all` while the template and the frugality charter
  document `off | prose_only | aggressive`. Not repaired here — it belongs to
  whichever step deletes or fixes the key, and repairing it in passing would be
  the drive-by edit `minimal-safe-diff` forbids.

## Why 3.1 stays open, and what was built for it instead (2026-08-12)

**3.1 is not a step, it is the queue.** Its subject is "`derivable` rows whose
replacement does **not** yet exist", and there are 83 of them — writing those
mechanisms is the remaining programme, not a checkbox. Phase 2 deliberately
touched none of them: every key deleted either had no reader at all or had its
replacement already shipped, so 3.1's `verify:` ("each such key's deletion commit
is later than its mechanism's") holds for this change with no subject. Closing it
on that basis would be checkbox motion, so it stays open.

What was built instead is the missing half of the gate. `lint_settings_classes`
had five checks and all five police what is **added** — a new leaf needs a row, a
class, a disposition, a conservative default. Nothing policed what is **removed**,
which on a roadmap whose whole direction is deletion was the un-gated half doing
the work. Check 6 now fails the build on two decidable contradictions the loader
cannot see: a `REMOVED_KEYS` entry whose reason names no replacement, and a key
that is simultaneously removed and live in the template (which would make the
loader warn "ignored" about a value the schema honours). That makes the acceptance
criterion *"no key is deleted before the mechanism that replaces it exists"*
mechanical on its naming half.

Stated because the step asks for more than the gate delivers: **the gate does not
check that the replacement mechanism actually exists, nor that its commit precedes
the deletion.** Neither is decidable from the template and the contract, so both
stay model-carried — the same honesty boundary the A/B/C judgement itself carries.
Falsifiability was verified rather than assumed: re-adding a deleted key to the
template makes check 6 name it.

## What Phase 2 did (2026-08-12)

**Deleted the six keys no code path read**, taking the surface 140 → 134 and the
`derivable` queue 88 → 83. `lint_settings_classes` re-derives it: `scanned: 134`,
`A=26 B=3 C=105`, and the ratchet in `gate-violation-baselines.json` is lowered to
83 so the gain cannot be given back.

Three things went differently from the step text, each worth stating:

- **One of the six was `consent`, not `derivable`, so 2.1's literal scope did not
  cover it.** `screenshots.data_bearing_gate` was reclassified to `derivable`
  before deletion, with the replacement named (the unconditional gate in
  `doc-screenshot-hygiene` routing into `non-destructive-by-default`). The
  argument, recorded in the contract rather than applied quietly: a data-bearing
  embed is a published egress, so its confirmation is a Hard Floor no settings
  value may lift — an `off` could never have been honoured, which is exactly why
  nothing read it. Risk 2 of this roadmap is the reason that reclassification is
  written down instead of assumed.
- **Two of the six carried a documented promise the code did not keep**, so the
  deletion repairs a live defect rather than only removing a line.
  `screenshots.data_bearing_gate` advertised an opt-out that did not exist, and
  `legal_review_prep.consented_at` was documented as "set automatically by the
  setup wizard" while nothing wrote it.
- **The blast radius was 25 files, not the five the step names.** Beyond template,
  schema, contract, `REMOVED_KEYS` and reference page: the JSON schema, the
  user-global `MERGEABLE_KEYS` whitelist (both the live copy and the projected
  work-engine template), the two placeholder defaults in `yamlIO`, all three
  profile `.ini` presets, the wizard step list and the GUI basic-paths list, the
  telegraph-speak rule's own frontmatter description, and five prose surfaces.

**The inverted invariants (2.2) are three assertions per key, not one.**
`tests/server/schemas/parity.test.ts` pins that each key is absent from BOTH
template and schema (the parity gate already reds on a one-sided deletion) and
that a stale file's hostile value is *stripped* rather than honoured —
`off` for a gate, `true` for a poll, a non-default enum for a scope.
`tests/lib/agent_settings.test.ts` pins each `REMOVED_KEYS` reason string
verbatim, because the reason is the whole value of that warning: it names what
decides instead, and a warning that only says "removed" sends the user looking
for a replacement key that does not exist.

Falsifiability was checked, not assumed: re-adding `speak_scope` to the Zod
schema reds exactly three assertions and leaves the other five keys green.

**Two findings recorded, not repaired** (both pre-date this change, so repairing
them here would be the drive-by edit `minimal-safe-diff` forbids):

- `docs/customization.md` documents the user-global whitelist as five exact
  dotted paths. `MERGEABLE_KEYS` has fifteen — `personal.ide`,
  `personal.pr_comment_bot_icon`, `memory.cadence` and the seven
  `knowledge.global_sharing.*` entries are absent from the doc. The count was
  already wrong before the deletion; only the arithmetic changed.
- `docs/architecture/current-onboard-baseline.md` still names the key, and is
  stale wholesale: it documents the retired `/onboard` command and cites
  `.agent-src.uncondensed/`, a tree that no longer exists.

`tests/fixtures/sync_yaml_rt/current-real.yml` keeps all three deleted
`chat_history` lines **deliberately**. That corpus asserts
`emit(parse(x)) == x`; a settings file written before a deletion is precisely
what must still round-trip, so editing the fixture would remove the case.

## Blockers

### blocker: consent-key-redesign-verdict

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 3.2 only. Phases 1 and 4.2 are closed; 2.1/2.2/3.1/4.1 are
  unblocked by it.
- **What to do:** 3.2 asks for a keep-vs-redesign verdict on the three class-B
  consent keys against *"does the action need authorising at all?"*. That is a
  product call about what the package may do to a user — not a classification —
  and the roadmap's own `verify:` demands a recorded verdict rather than a
  deferral, so it cannot be closed by an agent choosing one.
- **Why it is not council-resolved — re-measured 2026-08-12, and the reason has
  changed.** It is a judgement call, so the action-vs-judgement split routes it to
  the AI council, and the council **is** configured (2 members, both CLI
  transport — `council:status` confirms). The transport defect this blocker used
  to name is **fixed**: `openai` exit 2 (`unexpected argument '--system'` from
  `codex exec`) was repaired in PR #1308, and the false-quorum line it also named
  now reads correctly — the run prints `after the run · 0/2 present … INCONCLUSIVE`
  beside the stale pre-run `2/2 present … concluded`. Do not re-diagnose either.
  What blocks it today is different and simpler: **both members returned
  `cli_quota_exhausted`** (`anthropic 125/50`, `openai 134/50`). That is a
  spend/quota hard blocker — the kind that is surfaced rather than retried — so
  the pass produced no verdict and cost $0.00. Re-run when the quota window
  resets; the question is written and needs no re-derivation.
  **Retried once, deliberately, because the environment changed** — PR #1309
  landed another transport repair between the two attempts — and it confirmed the
  reading rather than lifting it: same `cli_quota_exhausted`, both members absent.
  **A failed attempt still counts against the quota**: the counters rose from
  125/50 · 134/50 to 140/50 · 146/50 across the two runs. So do not burn further
  attempts probing whether it works yet; check `council:status` quota output
  first.
- **The step's own premise is wrong in two ways, verified against the tree
  2026-08-12 — hand the corrected version to the council, not the original.**
  (a) It says "the three class-B consent keys". Only **two** of the three carry the
  `consent` disposition: `personal.open_edited_files` and
  `memory.learn_on_session_end`. The third, `personal.canary_name`, is
  `un-inferrable` — it is now one of the nine keys in the published floor (§ The
  floor), so asking whether its *action* needs authorising is the wrong question
  for it. (b) The two real consent keys are not comparable, and the difference is
  the whole substance: `memory.learn_on_session_end` has a **real** reader
  (`src/scripts/memory_learn_hook.ts` parses it itself and stays dark unless it
  reads `true`), while `personal.open_edited_files` is enforced by **prose only** —
  `src/skills/file-editor/SKILL.md` instructs the agent to read it, and no code
  path or hook can refuse the action. Whether an authorisation that only prose
  enforces is a consent gate at all is the question the step should be asking
  about that key.
- **Resolved when:** each of the two consent keys carries a recorded verdict
  (keep, redesign the action, or delete with a named replacement), in this roadmap
  or an ADR, and the third key's mis-grouping is either corrected or argued.

## Acceptance criteria

- The 140 leaves each carry a disposition, published as data.
- Every deleted key: gone from template + schema + contract + reference, present
  in `REMOVED_KEYS` with a per-key reason, and covered by an inverted-invariant
  test.
- No key is deleted before the mechanism that replaces it exists.
- The residual set is published with a per-key reason.
- A new `derivable` key cannot be added without the gate refusing it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A deleted key silently changes a shipped default | implementation | `REMOVED_KEYS` ignores the old value, so an install that had opted OUT is silently opted IN. That is the intended direction for a safety gate and the wrong one for anything cost- or spend-bearing | Phase 2.2 requires the inverted-invariant test per key, and Phase 3.1 forbids deleting ahead of the mechanism. Any spend-bearing key is `policy` or `consent` by construction, never `derivable` | Phase 2, Phase 3 |
| 2 | `derivable` becomes the label for "inconvenient to keep" | product | The classification is a judgement with no mechanical check, and the direction of this roadmap pushes every borderline row toward deletion | 1.2 requires each `derivable` row to NAME its replacement; a row that cannot is reclassified. The replacement clause is the falsifier | Phase 1 |
| 3 | Removing a kill-switch removes the only escape from a misfire | implementation | The turn-end gate now has no config escape; the same trade repeats per deletion, and a noisy mechanism with no off-switch teaches users to uninstall | Deletion is admissible only where a misfire is BOUNDED and the bound is stated (for the gate: one extra turn, two re-entrancy layers). An unbounded misfire keeps its switch | Phase 2 |
| 4 | The floor is asserted rather than argued, and the surface re-grows | product | "We are down to N keys" is a number that decays the moment the next feature lands | 4.1 requires a per-key reason; 4.2 adds the authoring gate so re-growth needs an explicit disposition | Phase 4 |
| 5 | The classification table drifts from the template | implementation | A second artefact that must stay in sync IS a new drift source — the exact objection this package has recorded against index-shaped mechanisms | 1.1 puts the table behind the existing linter, which already walks the template, so a key with no row fails the same gate that counts them | Phase 1 |

## See also

- `docs/contracts/settings-classes.md` — the A/B/C axis this roadmap is orthogonal to.
- `src/scripts/_lib/agent_settings.ts` — `REMOVED_KEYS`, the deletion mechanism.
- `docs/decisions/ADR-105-automatic-subagent-orchestration.md` — the first walk of this path.
