---
complexity: structural
---

# Road to zero settings — delete the flags whose answer the situation already carries

> **COMPLETED 2026-08-14 — and the direction it opened is still running.**
> Every step is closed except 3.1, which was **extracted rather than finished**:
> it was a standing deletion queue, and a roadmap is the wrong container for
> work that is drained one row at a time forever. It now lives at
> `agents/settings/contexts/settings-deletion-queue.md`, with the ordering rule,
> the scouted next drains and the seven downstream surfaces intact.
>
> **What this roadmap actually delivered:** a classification anybody can re-run
> (`task lint-settings-classes`), a shrink-only ratchet that refuses re-growth,
> a 56-day non-stagnation clause, and a first drain of six unread keys — the one
> batch that provably cannot change a default silently. The direction outlived
> the artifact, which is the intended outcome and not a shortfall.
>
> **Do not read the archive date as the queue closing.** The queue is CI-carried
> and independent of this file.

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
  <!-- done 2026-08-12: FIVE keys deleted — telegraph.speak_scope,
  chat_history.max_size_kb, chat_history.on_overflow, quality.wait_for_remote_ci,
  legal_review_prep.consented_at. 140 → 135 leaves, derivable 88 → 83, and the
  `lint_settings_classes:derivable-surface` ratchet lowered to 83 so the gain
  cannot be given back. Both gates green.
  **The batch is deliberately the UNREAD subset, not every derivable row with an
  implemented replacement, and the narrowing is the safety argument rather than a
  shortcut.** "Replacement is already implemented" is a judgement per key; "no
  code path reads this" is a grep. Only the second makes the deletion provably
  free — an unread key cannot change a default by leaving, so no mechanism had to
  ship first and Risk 1 (a deleted key silently flipping a shipped default)
  cannot fire. Deleting on the looser criterion in the same pass would have made
  ~83 individually-arguable behaviour changes ride one commit, which is Risk 2
  ("derivable becomes the label for inconvenient to keep") executing itself.
  The sixth unread key, `screenshots.data_bearing_gate`, is NOT deleted and the
  reason is a finding: it is `consent`, and its missing reader means the
  authorisation it appears to carry is unenforced. Deleting it would remove the
  appearance of a gate and leave the unguarded action — the repair is to build
  the reader, which is 3.1 work with a real behaviour change behind it.
  Downstream surface touched: template, zod schema, contract rows + both count
  tables, REMOVED_KEYS, the MERGEABLE_KEYS user-global allowlist (both the script
  lib and the work_engine template copy), the two placeholder defaults in
  yamlIO, the wizard step list, the basic-settings path list, the regenerated
  reference page, and the rebuilt install bundle. -->
- [x] 2.2 For each deleted key, assert the **inverted invariant** — the test that
  used to pin "absent ⇒ off" now pins "absent ⇒ armed". Deleting the old test
  without inverting it removes the only thing that would notice a silent
  regression to the old default.
  `verify:` no deleted key leaves its suite with a net loss of assertions.
  <!-- done 2026-08-12: tests/lib/removed_zero_settings_keys.test.ts, 17
  assertions. **The invariant had to be re-derived rather than copied, and
  saying so is the point:** "absent ⇒ armed" names the behaviour a deleted
  switch used to suppress, and these five suppressed nothing. Writing that
  assertion anyway would have produced five tests that pass for the wrong
  reason — the tautology this suite exists to prevent. What IS falsifiable is
  pinned instead: the key is gone from the template AND from the Zod schema (so
  a fresh install cannot acquire it and the wizard cannot render it), and a
  leftover value in an older install produces exactly one stderr warning naming
  the key and what decides instead. A negative control asserts the schema path
  walker still resolves a surviving sibling, so the five absence assertions
  cannot pass because the walker is broken.
  Net assertions: +17 new, and the two pre-existing tests that named a deleted
  key were INVERTED rather than dropped — `compile_router.test.ts` now pins that
  a leftover `speak_scope` cannot move router membership (it never could; the
  deletion must not hand it power it never had), and the MERGEABLE_KEYS exact-list
  pin lost the entry with the key it whitelists. No suite lost an assertion. -->

## Phase 3 — the keys that need a mechanism first

- [-] 3.1 For `derivable` rows whose replacement does **not** yet exist, write
  the replacement before touching the key. Order is the point: a key deleted
  ahead of its mechanism is a silently-changed default, not a simplification.
  `verify:` each such key's deletion commit is later than its mechanism's.
  <!-- EXTRACTED 2026-08-14, not completed and not abandoned. The work is
  entirely intact; it moved to `agents/settings/contexts/settings-deletion-queue.md`,
  which now carries the ordering rule, the CI mechanism, the scouted next drains
  and the seven downstream surfaces. Nothing below was discarded — the note it
  replaces is reproduced there in substance.

  Why the container changed, on an outside opinion (1 seat, 2 rounds; the second
  seat failed to start, so a single-model judgement on its checkable merit and
  NOT a convergence). The step's own note called this "a DELETION QUEUE, not 83
  deletions" — an artifact stating it is the wrong kind of artifact. Two costs
  follow, and the second is what decided it:

    1. Standing work inside a completion percentage makes the dashboard
       unreadable; readers learn to discount the number, which defeats tracking.
    2. Draining a row moves 83 -> 82 and closes nothing, so under a completion
       percentage doing the work moves the number the WRONG WAY. An artifact
       that penalises progress on its own subject does not get drained.

  The queue was never prose-carried anyway, which is what makes the extraction
  safe rather than a quiet drop: the `lint_settings_classes:derivable-surface`
  ratchet in `src/config/gate-violation-baselines.json` pins the count
  shrink-only and reds on regrowth, and its 56-day non-stagnation clause is the
  thing that actually notices a queue nobody is walking. Neither depends on this
  file existing. -->
  <!-- SUPERSEDED NOTE, kept for the reasoning it carries — 83 derivable rows remain, and each
  one is a mechanism to write plus a behaviour change to defend. This is a
  standing queue, not a step that closes in a pass: the roadmap's own framing
  ("a DELETION QUEUE, not 88 deletions") is what makes 83 an amount of work
  outstanding rather than a backlog of edits. The ordering constraint this step
  states is already live and was honoured by 2.1 — the batch deleted was
  precisely the subset that needs NO replacement mechanism, so nothing was
  deleted ahead of its mechanism. The next drain picks a row, writes its
  replacement, and deletes the key after; the ratchet at 83 makes each such
  drain visible and forbids the number going back up. -->
  <!-- SCOUTED 2026-08-13 — the next drains, ranked, so the following run does not
  re-derive the search. Method that matters: an un-dotted last-segment grep on top
  of the dotted-path grep, because several keys are read via a YAML parse that
  never mentions the dotted form (`subagents.downshift` looks unread by dotted
  path and is read by `hooks/delegation_nudge_hook.ts`). Candidates below survived
  that check.
    · `project.pr_template` — zero CODE readers, and the cheapest drain available
      (83 -> 82). **Corrected on review: not "zero readers of any kind".**
      `src/agent-src/templates/agent-settings.md:557` carries a directive row —
      "Path to PR template file. Read this instead of searching for it." — which
      is a model-carried reader, not a description of a default. That file is
      authored rather than generated and is a seventh surface the enumeration
      below does not name separately. The distinction matters because it is the
      one this very note draws for `commands.create_pr.*`, and applying it
      unevenly is how a "free" drain turns into a silent behaviour change.
      Six further surfaces: `agent-settings.template.yml`, `src/server/schemas/settings.ts`,
      the contract row plus BOTH count tables in `docs/contracts/settings-classes.md`
      (Counts and Dispositions), a `REMOVED_KEYS` entry in
      `src/scripts/_lib/agent_settings.ts` naming the replacement, the ratchet in
      `gate-violation-baselines.json`, and the regenerated `docs/settings-reference.md`
      plus its site mirror. Also drop its `LEGACY_RENAME_MAP` alias in `install.ts`
      (an alias table, not a reader). A schema edit reds Install-Aux and
      Static-Checks until the install bundle is rebuilt in the same commit.
    · `commands.create_pr.{detail_level,api_examples,ui_paths,api_paths}` — four
      rows in one drain, zero CODE readers; five prose files describe them as
      defaults without gating on them.
    · `reasoning.*` — eleven rows, the largest single drain available, and NOT a
      free one: `contexts/execution/rdp-gate.md` signal 1 reads the block, so the
      gate's first signal has to be rewritten before the keys go. That rewrite IS
      the "write the replacement before touching the key" ordering this step
      states, which makes it the honest test case rather than the cheap one.
  Not drained in this pass on purpose: a single-key drain moves 83 -> 82 on a
  standing queue and closes no roadmap, while touching the schema and the install
  bundle. The scouting is the deliverable here; the deletion is a separate,
  reviewable change. -->
  <!-- verify: ./scripts-run src/scripts/lint_settings_classes reports derivable == the baseline in src/config/gate-violation-baselines.json -->
- [x] 3.2 Re-examine the three class-B consent keys against the question
  *"does the action need authorising at all?"* — a consent gate on an action the
  package should not be taking is two problems wearing one flag.
  `verify:` each of the three carries a recorded verdict (keep / redesign the
  action), not a deferral.

  **Verdicts recorded 2026-08-13 (maintainer decision, informed by a council
  pass). Provenance stated plainly: 1 member, 3 rounds — the second seat failed
  to start, so this is a single-model pass and NOT convergence.** The arguments
  are admitted on their checkable merit, not on a quorum they did not have.

  | Key | Verdict | Reason |
  |---|---|---|
  | `memory.learn_on_session_end` | **KEEP** | A real consent gate: a real reader (`src/scripts/memory_learn_hook.ts`) can actually refuse the action, and the conservative default is `false`. The gate authorises something the package legitimately does and can genuinely withhold. |
  | `personal.open_edited_files` | **REDESIGN — keep the key, label it honestly** | Nothing can enforce it; the only "reader" is prose in `src/skills/file-editor/SKILL.md`. The suite's rule is *never claim enforcement you do not have* — and the honest discharge of that rule is to DECLARE the limit, not to delete the user's choice. Marked as prose-only in the contract rather than dressed as a gate. |
  | `personal.canary_name` | **REDESIGN — reclassify, it was never a consent key** | It authorises nothing; it holds a nickname used as a liveness marker. Its disposition is already `un-inferrable`; what was wrong is reading class B as implying a consent obligation. |

  **The cross-cutting finding, which is the actual result of asking the
  question.** Two of the three "problems" were not in the keys. Class B was doing
  two jobs at once — *asked once and persisted* (a persistence property) and
  *authorises an action* (a quality bar that demands enforcement). Those are
  independent: a consent key needs a mechanism that can refuse; un-inferrable
  config needs only persistence. The fix taken is the documentation one rather
  than splitting the class, because splitting would churn a contract to express
  something one paragraph states — see the consent-vs-config paragraph added to
  `docs/contracts/settings-classes.md`.

  The stricter alternative — delete `personal.open_edited_files` and its
  behaviour outright — was raised in the same pass and **rejected**: an
  unenforceable flag that says so is honest, while deleting it removes a real
  user choice over a real behaviour to fix a labelling problem.

## Phase 4 — state the floor and stop

- [x] 4.1 Publish the residual set with, per key, the sentence explaining why no
  mechanism can derive it. A floor nobody can argue with is the deliverable; a
  floor asserted without reasons is where the next round quietly re-grows.
  `verify:` every residual key has a non-empty reason.
  <!-- done 2026-08-12: docs/contracts/settings-classes.md § "The floor — the
  residual `un-inferrable` set". Nine rows, each naming what a mechanism would
  have to OBSERVE to derive the value and why nothing carries it — so a row is
  falsifiable by naming a probe, which is the property that keeps the floor an
  argument rather than an assertion. The section also states what is NOT in the
  floor: `consent` (38) is kept-for-now, not settled, because 3.2 may remove the
  action rather than the key. -->
  <!-- verify: grep -c '^| `' docs/contracts/settings-classes.md section "The floor" == 9 -->
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

## What this branch added beyond Phase 2 (2026-08-12, reconciled)

Phase 2 landed twice, in parallel, and the two runs converged on the same five
deletions independently — the step's own note above is the record of that work.
What follows is only what this branch adds on top, kept because none of it was
duplicated:

**Four live contracts made a claim the code contradicts, and now do not.**
`condensation-default-kill-criterion` said the runtime rule *reads*
`telegraph.speak_scope` from settings; `telegraph-telemetry` gated a multiplier on
it; `layered-settings` and `mcp-client-config` both listed it as a user-global
mergeable preference after it had been removed from `MERGEABLE_KEYS`. A reader
following any of the four would have been misled about what the code does. The
ADRs and the archived changelog that also name the key are deliberately
untouched: they record what was decided while it existed, which is not drift.

**The telegraph-speak rule now states its own scope.** Its frontmatter
`description` was literally `telegraph.speak_scope != off`, so the rule announced
its activation condition in terms of a key that no longer exists. The Scope table,
three body clauses and the projected `domains/meta` description follow. What the
key called `prose_only` is simply what the rule does; what it called `aggressive`
is refused outright, because each of the seven carve-outs protects another rule's
Iron Law.

**The deletion side of the gate is now gated** — see § Why 3.1 stays open.

**Two findings recorded, not repaired**, both pre-dating this work, so fixing
them here would be the drive-by edit `minimal-safe-diff` forbids:

- `docs/customization.md` documents the user-global whitelist as five exact
  dotted paths. `MERGEABLE_KEYS` has fifteen — `personal.ide`,
  `personal.pr_comment_bot_icon`, `memory.cadence` and the seven
  `knowledge.global_sharing.*` entries are absent from the doc. Only the
  arithmetic changed here; the omission is older.
- `docs/architecture/current-onboard-baseline.md` still names the deleted key and
  is stale wholesale: it documents the retired `/onboard` command and cites
  `.agent-src.uncondensed/`, a tree ADR-051 abandoned.

**One fixture deliberately keeps the deleted keys.**
`tests/fixtures/sync_yaml_rt/current-real.yml` asserts `emit(parse(x)) == x`, and
a settings file written *before* a deletion is precisely what must still
round-trip. Editing it would delete the case rather than fix it.

## Blockers

### blocker: consent-key-redesign-verdict

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** step 3.2 only. Phases 1 and 4.2 are closed; 2.1/2.2/3.1/4.1 are
  unblocked by it.
- **What to do:** 3.2 asks for a keep-vs-redesign verdict on the three class-B
  consent keys against *"does the action need authorising at all?"*. That is a
  product call about what the package may do to a user — not a classification —
  and the roadmap's own `verify:` demands a recorded verdict rather than a
  deferral, so it cannot be closed by an agent choosing one.
- **Why it is not council-resolved:** it is a judgement call, so the
  action-vs-judgement split would normally route it to the AI council. The
  council was **configured and both members failed** on 2026-08-12 —
  `anthropic` exit 1, `openai` exit 2 (`unexpected argument '--system'` from the
  `codex exec` transport). The run also printed `2/2 present, needed 1 —
  concluded` while its own JSON recorded `present: 0, status: inconclusive`,
  which is worth repairing separately: a transport failure that reports as a
  quorum is worse than one that reports as an outage.
- **Re-attempted 2026-08-12 (later the same day) — the stated cause is gone and
  the route is still shut, for a different reason.** Both sub-defects named
  above are fixed: the `--system` transport failure landed in PR #1309, and the
  quorum line now reports honestly (`before the run · 2/2 present` is labelled
  as a pre-run estimate; `after the run · 0/2 present, needed 1 — INCONCLUSIVE
  — release gate holds` matches the JSON's `present: 0` exactly). So the
  misreporting this blocker flagged as "worse than an outage" no longer occurs.
  What stopped the run instead: **both members returned `cli_quota_exhausted`**
  — an org-level subscription limit, outside this repo. Cost was $0.0000
  (`billable=0`, both transports are CLI/subscription), so nothing was spent on
  the failure.
  The consequence for this blocker is unchanged but its shape is not: this is
  now a **wait-for-quota** condition on the council route, not a broken route.
  Re-run when quota resets, with `council_cli run --confirm` over a question
  file in the gitignored council-question directory. The question is reproduced
  here rather than linked, because a council artefact is local-only and pruned
  after the retention window (`no-roadmap-references`): for each of the three
  keys, return KEEP (the action is legitimate and needs a standing human
  authorisation) or REDESIGN THE ACTION (the action itself is the problem —
  name what replaces it, after which the key disappears rather than being
  deleted), with the constraint that a REDESIGN verdict must never make the
  action happen by default, since every class-B key ships a conservative
  default and absent must stay indistinguishable from "no".
- **One correction the re-attempt forced, and it changes what 3.2 must decide.**
  This blocker and the step both say "the three class-B **consent** keys". The
  data says otherwise: there are exactly three class-B keys —
  `personal.open_edited_files`, `memory.learn_on_session_end`, and
  `personal.canary_name` — and only the first two carry disposition `consent`.
  `personal.canary_name` is class B with disposition `un-inferrable`, i.e. the
  two axes disagree about it: the class says "this is an authorisation the user
  grants", the disposition says "this is a fact about the human". Both cannot be
  right, and the step's `verify:` demands a verdict for all three. So 3.2 has a
  third question the wording hid: does asking for a nickname authorise anything,
  or is class B doing the wrong job for that key?
- **A FAILED council attempt still spends quota — measured, and it changes how to
  wait.** The re-attempt above was itself repeated once more from a parallel
  branch, and the counters rose across the two runs: `anthropic 125/50 · openai
  134/50` became `140/50 · 146/50`, with `actual $0.0000` both times. So probing
  "does it work yet" makes the wait longer rather than shorter. Read the quota
  line in `council:status` instead of firing a run to find out. One retry IS
  legitimate when the environment changed underneath you — a transport-repair PR
  landing between attempts is exactly that case, and it is what produced the
  `cli_quota_exhausted` reading rather than an assumption.
- **The two real consent keys are not comparable, and the asymmetry is what 3.2
  has to weigh.** `memory.learn_on_session_end` has a **real** reader:
  `src/scripts/memory_learn_hook.ts` parses it itself and stays dark unless it
  reads `true`. `personal.open_edited_files` is enforced by **prose only** —
  `src/skills/file-editor/SKILL.md` instructs the agent to read it, and no code
  path or hook can refuse the action. Whether an authorisation that only prose
  enforces is a consent gate at all is a different question from whether the
  action needs authorising, and the step's single wording collapses the two.
- **Resolved when:** each of the three keys carries a recorded verdict (keep, or
  redesign the action), in this roadmap or an ADR.

## Acceptance criteria

- [x] Every leaf carries a disposition, published as data. (140 at the opening
  measurement; 135 after the Phase-2.1 deletion — the gate rejects a leaf with
  no disposition, so the property holds at whatever the count currently is.)
- [x] Every deleted key: gone from template + schema + contract + reference,
  present in `REMOVED_KEYS` with a per-key reason, and covered by an
  inverted-invariant test. (Five keys, 2026-08-12.)
- [x] No key is deleted before the mechanism that replaces it exists. (Held
  trivially by the batch chosen: all five had NO reader, so there was no
  mechanism to be ahead of. The constraint binds the next drain, not this one.)
- [x] The residual set is published with a per-key reason.
- [x] A new `derivable` key cannot be added without the gate refusing it.
- [x] The three class-B keys each carry a recorded verdict. **Recorded
  2026-08-13 at step 3.2**: `memory.learn_on_session_end` KEEP,
  `personal.open_edited_files` REDESIGN (kept, labelled prose-only),
  `personal.canary_name` REDESIGN (reclassified — it was never a consent key).
  The cross-cutting finding is in `docs/contracts/settings-classes.md` § "Class B
  is a persistence property, not an enforcement claim". 3.1's queue remains
  standing work and is not an acceptance gap.

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
