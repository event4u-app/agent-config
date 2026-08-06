---
complexity: structural
execution:
  mode: phase-checkpoints
related_roadmaps: [road-to-zero-ceremony-detection, road-to-zero-ceremony-install]
related_adrs: [ADR-020, ADR-037, ADR-110]
related_contracts: [settings-api, settings-classes]
---

# Road to zero-ceremony settings — the user's file records decisions, the template stays the defaults source

> The 1,233-line template is materialised into every user's global settings
> file, so a fresh install starts with 1,233 lines of opinions nobody formed.
> Split the two jobs that file is doing: the template stays the package's
> internal defaults-and-schema source; what the *user* gets becomes a sparse,
> provenance-stamped record of decisions actually made.

> **UNBLOCKED 2026-08-05 per
> [`ADR-216`](../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
> § D4.** This roadmap was parked because the composition-ratchet polish gate
> named configuration-management work explicitly, and that gate's exit condition
> was "3 documented external adoptions, or `road-to-adoption-without-narrative-debt`
> archived". External adoption is not a project goal, so the first clause was
> unreachable; the second is now satisfied — that roadmap was disposed to
> `skipped/` on 2026-08-05. **The gate has exited on its own terms and this
> roadmap is active with 19 open steps.** Nothing was smuggled in as
> "simplification"; the gate is genuinely gone.

## Goal

A fresh install writes no settings opinions; the user's global settings file
contains one entry per decision actually made, each stamped with how it was
made — while the template↔schema parity gate that keeps the GUI honest stays
exactly as strict as it is today.

## Prerequisites

- [x] Global settings root is the decided storage answer (ADR-020).
- [x] A zod schema mirrors the template leaf-for-leaf, CI-enforced.
- [x] Atomic-write helpers exist.
- [x] The GUI settings editor, its schema routes, and its diff machinery exist.

## Context

Source: an external planning set, audited 2026-07-31. Corrections and refusals:
[`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).

The audit changed this roadmap's central claim. The draft's headline was **ship
NO settings template**. That is not available: the template is the source of
truth for every configurable setting, a CI parity test fails when a schema key
has no matching template path (its own comment: *loosen it and the GUI silently
drifts*), the installer hard-fails when the template or its placeholders are
missing, and nine further scripts read the template path directly.

But the draft's *goal* is available, because the template is doing two
unrelated jobs:

1. **package-internal**: the defaults and schema-parity source — keep, untouched;
2. **user-facing**: materialised verbatim into the user's global settings file —
   this is the one that should become sparse.

Separating them delivers the draft's outcome (a fresh install writes no
opinions; the file reads as a decision ledger) while every gate above stays
green. That reframe is the whole reason this roadmap survives at all.

Also verified: `settings set` does not exist (`settings` is a GUI alias, and
only `check` / `sync` / `migrate` mutate or validate) — the writer is greenfield.

### Prerequisite re-read, 2026-08-05 — what Risk 5 caught

Risk 5 mandates re-reading the prerequisites as the first act of execution
rather than trusting them from the parked state. That re-read fired. Six facts
above and in the phases below were stale; they are corrected here rather than in
place, so the diff between what was planned and what is true stays legible.

| Roadmap says | Measured 2026-08-05 | Where it bites |
|---|---|---|
| template is 1,233 lines | **1,359 lines / 139 parity leaves / 140 classified leaves** | Phase 1's table is that big |
| "nine further scripts read the template path directly" | **ten**, at eleven call sites (twelve counting the installer's two) | Phase 3's "every direct template reader untouched" |
| "the three existing ask-shaped settings" | **six** — `tokens.rich_skills`, `subagents.auto`, `subagents.budget_routing`, `subagents.adversarial_council`, `worktrees.mode`, `decision_engine.on_block` | Phase 5 step 3 |
| Phase 2: "the existing settings read path" (singular) | **two families, opposite precedence, three filenames** — see below | Phase 2 step 2 |
| the template "is materialised into every user's global settings file" | **true, but the writer is `src/server/routes/wizard.ts:1310`**, not the installer; `install_global` writes no settings file at all, and `ensure_agent_settings` is unreachable for consumers (`_enforce_consumer_global_only`) | Phase 3 step 1 aims at the wrong writer |
| `related_contracts: [settings-api, layered-settings]` | the `layered-settings` contract **does not exist** under `docs/contracts/` — the frontmatter now points at `settings-classes` instead | frontmatter reference |

**The read-path split, in full.** Root resolution is clean and single-sourced
(`~/.event4u/agent-config`, env override `EVENT4U_CONFIG_HOME`, read-only legacy
XDG fallback). The filenames under it are not:

- scripts / work-engine loader → `agent-settings.yml` (no dot, no subdir);
- installer + `settings:migrate` → `.agent-settings.yml` (dot, flat);
- GUI server write target and the installer's own global *read* →
  `settings/.agent-settings.yml` (typed subdir).

Precedence differs too: the scripts family merges
`{} < user-global (whitelist-filtered) < repo-root < CWD`, the server family
merges `template-defaults < global < project`.

**And the load-bearing correction the council did not have.** The council
(2026-08-05, `claude-sonnet-4-5` + `gpt-4o`, 2/2) treated this as blocking on the
premise that *"the two families disagree about what the default IS"*, and
prescribed a default-parity probe as the gate. That premise is falsifiable
in-tree and false: `_DEFAULTS` in the scripts loader is **`{}`** — the scripts
family has no settings defaults at all, so every consumer there already supplies
its own fallback at the read site and is already sparse-tolerant. Nothing can
disagree with an empty object. The probe would have compared a hardcoded table
that does not exist against the template.

What survives from the council verdict is its *shape* — prove, then scope — with
the probe replaced by the fact that settles the same question: the file the
wizard materialises is read by the server layered read and by the installer's
global read, and by **neither** of the scripts-family paths. Making it sparse
therefore cannot break the scripts family, because that family never read it.

### Gap audit against the source draft

| Draft item | Verdict | Why |
|---|---|---|
| A/B/C key taxonomy as a checked-in contract, with a lint refusing unclassified keys | **KEEP** | The C class is the injection fence; no conflict |
| `settings set` CLI: zod-validated, atomic, C-refusing, provenance-stamping, loud echo | **KEEP** | Greenfield |
| Sparse **user** settings file; absent = documented default | **KEEP, reframed** | Applies to the materialised user file, not to the template |
| Ship **no** settings template | **CUT** | Breaks the schema↔template parity gate, the installer invariant, and nine consumers |
| Provenance field (`jit-answer \| gui \| manual \| auto-detected`) + timestamp | **KEEP** | No conflict anywhere |
| Language auto-detected, never asked | **KEEP** | A question whose answer is already visible is a wasted question |
| Nickname as the single first-run question, prefilled, activating the canary | **KEEP** | Genuinely un-inferrable; one keypress to accept |
| B-class JIT asks with a one-ask-per-run budget + conservative-default summary | **KEEP** | The anti-nag mechanism is the load-bearing part |
| Hook verification of consent-class settings on capable hosts | **KEEP** | Deterministic teeth where the host allows them |
| GUI as the only C-class writer | **KEEP** | Server-side refusal mirrors the CLI's |

## Phase 1 — The taxonomy contract

- [x] Classify every key in the current template into A (preferences, never
      asked) / B (consent, JIT-asked once, persisted) / C (guarded, never
      agent-writable) in one table, checked in as
      `docs/contracts/settings-classes.md`.
- [x] Add a lint refusing any new or existing key without a class.
      <!-- verify: npx vitest run tests/scripts/lint_settings_classes.test.ts -->
- [x] Put every budget-raising key, allow/deny list, kill-switch, strict mode,
      and master flag in C — and justify each B assignment in one line, because
      a wrong B is the only way this design can hurt someone.
- [x] Council-review the C list specifically: the fence is only as good as its
      completeness, and completeness is not something a single reviewer should
      certify alone.

**Exit criteria:** the contract exists, the lint fails on a deliberately
unclassified key, and no key with irreversible or spend-raising effect sits
outside C.
**Rollback:** the contract and lint are additive — delete both.

## Phase 2 — The writer

- [x] `settings set <key> <value>`: zod-validated against the existing schema,
      atomic via the existing helper, refusing every C-class key from every
      caller, stamping `source` and a timestamp, echoing each write as one loud
      line.
      <!-- verify: npx vitest run tests/scripts/settings_set.test.ts -->
- [~] Effective-value resolution (sparse file → template defaults) sits behind
      the existing settings read path, so every consumer stays oblivious.
      <!-- verify: npx vitest run tests/server/schemas/parity.test.ts -->
      **Deferred — the premise is only half true, and closing the other half is
      a different roadmap.** The SERVER family already resolves absent keys from
      the template defaults layer, and the parity test still passes unchanged, so
      that half holds and is pinned. The SCRIPTS family has no defaults layer at
      all (`_DEFAULTS` is `{}`) — it is already sparse-tolerant, but only because
      every consumer supplies its own fallback at the read site, which is not the
      same guarantee. Giving it a template-defaults layer means touching
      `load_agent_settings`, whose precedence is the inverse of the server's and
      whose user-global layer is whitelist-filtered through `MERGEABLE_KEYS`
      under an ADR. That is the filename/precedence convergence, not this step.
      **Stays `[~]` — this is the one genuine deferral in the file.** It is not
      blocked by anything here; it was scope-transferred, and no successor
      roadmap names it yet. The 2026-08-07 council recommended cancelling it with
      an atomically-created successor stub, on the premise that the roadmap is
      about to archive and *"the dashboard has no mechanism to surface deferred
      work from archived roadmaps"*. **Declined: that premise is falsified by the
      same council's own Option A.** With the three Phase-3 steps re-encoded to
      `[ ]` this roadmap keeps `open_ ≥ 3`, so it does not archive, stays on the
      dashboard, and keeps rendering this item in its Deferred column. The
      thread-loss the cancellation was meant to avert does not exist while the
      roadmap is open — and cancelling into a stub nobody owns would convert a
      visible deferral into a second file to keep in sync.
      **The premise is TEMPORARY, and that is an exit condition, not a
      footnote.** It holds only while Phase 3 is open. The moment
      `absent-is-not-default-for-projection-mode` clears and Phase 3 closes,
      `count_open` returns to 0 with this one `[~]` still present and Iron Law 3
      fires again — the same repo-wide commit refusal, with no agent-side
      bypass. **Whoever closes Phase 3 must dispose of this item in the same
      change**, and by then the council's cancel-with-successor is the likely
      right answer, because at that point the roadmap really is archiving. See
      the blocker below, which now carries this as part of its resolution.
- [x] Refuse C-class writes server-side in the GUI's write route too — the CLI
      refusal must not be the only fence.
      <!-- verify: npx vitest run tests/server/routes/settings.test.ts -->
- [x] Add the provenance column to the GUI's settings view.

**Exit criteria:** every C-class key is refused from CLI and server routes; the
parity test is still green; a set/read round-trip preserves provenance.
**Rollback:** remove the command and the route guard; the file format is
backward-compatible because absent keys already mean defaults.

## Phase 3 — The user file becomes sparse

- [ ] Stop materialising the full template into the user's global settings file;
      write only what the install genuinely decided (the installer presets that
      fill profile-dependent keys stay, and stay explicit).
      <!-- verify: npx vitest run tests/install/settings_materialisation.test.ts -->
      **Blocked on `absent-is-not-default-for-projection-mode` below.** The
      writer is `src/server/routes/wizard.ts:1310`, and the change itself is one
      line. What stops it is a consumer that reads absent and default as
      different values on purpose.
      *(Re-encoded `[~]` → `[ ]` on 2026-08-07 — see § Glyph re-encoding.)*
- [x] Keep the template as the package-internal defaults source: parity gate,
      installer placeholder invariant, and every direct template reader
      untouched. Pin this with the parity test in the same change.
      <!-- verify: npx vitest run tests/server/schemas/parity.test.ts -->
- [ ] Generate the human-readable reference page from the schema plus the class
      table, so the long-form documentation survives the file shrinking.
      **Blocked with step 1.** The page exists to replace the explanation the
      user loses when the file shrinks; generating it before the file shrinks
      would ship a second surface to keep in sync for no reader.
      *(Re-encoded `[~]` → `[ ]` on 2026-08-07 — see § Glyph re-encoding.)*
- [ ] Migration: an existing populated user file is honoured as-is, every entry
      stamped `source: manual`. Nothing is rewritten under the user.
      <!-- verify: npx vitest run tests/install/settings_materialisation.test.ts -->
      **Blocked with step 1.** Migration is defined against the sparse shape:
      until the emitter exists there is nothing to migrate *to*, and stamping
      every existing entry `manual` on its own would write a provenance file
      claiming decisions the user never made.
      *(Re-encoded `[~]` → `[ ]` on 2026-08-07 — see § Glyph re-encoding.)*

**Exit criteria:** a fresh install produces a user settings file whose entry
count is bounded by what the install actually decided; the parity gate and the
installer invariant are both still green; an existing file upgrades with zero
behaviour change.
**Rollback:** restore full materialisation; sparse files remain readable
because absent means default in both directions.

## Phase 4 — First run: one question, one notice

- [x] Auto-set the language from the first message's language, falling back to
      the system locale, with a visible one-line notice and provenance
      `auto-detected`; any later explicit statement by the user overrides it.
      <!-- verify: npx vitest run tests/scripts/language_mirror_hook.test.ts -->
      **Shipped under a different storage design, on a recorded council
      decision.** `src/scripts/language_mirror_hook.ts` carries the detection,
      the `systemLocaleVerdict` fallback, the one-line notice, and the override
      (a `prompt` pin always outranks a `system-locale` one, so "a later
      statement wins" needs no second mechanism). It is wired for real —
      `hook_manifest.yaml` binds it to `user_prompt_submit` on six hosts.
      **Departure:** there is no `language` settings key and the provenance
      vocabulary is `prompt | system-locale` in `agents/state/language-mirror.json`,
      not `auto-detected` in the settings file. An AI council (2026-08-06) ruled
      against the key: a value documented as "never use this to decide reply
      language" is a footgun, and the per-turn mirror in `language-and-tone` is
      fresher than any stored one. Consequence for this phase's exit criterion:
      language contributes **zero** entries to the settings file, so "at most two
      entries" is satisfied by the nickname alone.
- [x] Ask the nickname once, prefilled from git user name then `$USER`, so
      accepting is one keypress; answering activates the session canary the
      package already ships dark.
      <!-- verify: npx vitest run tests/shared/nicknamePrefill.test.ts -->
      **The prefill chain now has exactly one implementation, and it is the
      documented one.** `src/rules/settings-ask-protocol.md` shipped the chain
      (git user name → `$USER` → `$USERNAME`) closed by the negation *"Never
      `$USER` alone"* — while the only surface that actually prefills,
      `src/server/routes/ping.ts`, read `userInfo().username` and nothing else:
      precisely the shape the rule forbids. A rule and the code it describes
      disagreeing is drift, so the order moved into `src/shared/nicknamePrefill.ts`
      (pure) with the Node half in `src/server/nicknameResolver.ts`, and the route
      delegates. `userInfo()` is kept as a floor rather than dropped — what
      changed is its rank, last instead of first. The tests pin the code AND
      re-read the rule, because a test over the code alone would not have caught
      the original drift.
      **Model-carried half, stated rather than implied:** the *ask* itself is
      agent-carried by the protocol's own design (`enforced_by: none`) — no
      chat-side trigger code exists, and `planSettingsAsks` names
      `personal.canary_name` as the one question a fresh session may pose.
- [x] Skip cleanly in non-TTY, CI, and headless contexts: no file, defaults,
      no questions, ever.
      <!-- verify: npx vitest run tests/scripts/first_run.test.ts -->
      **Predicate and planner shipped and pinned; the consumer is model-carried.**
      `nonInteractiveReason` (`src/shared/interactiveContext.ts`) takes the widest
      CI shape (`CI`, `GITHUB_ACTIONS`, `AGENT_CONFIG_CI`), plus an explicit no-UI
      request, both TTY streams and a headless display; `planSettingsAsks` yields
      `ask: null` by construction in that context. "No file" holds because both
      modules are pure. 16 cases green, including the contrast case (a human IS
      present → one ask), so the suite is not vacuous.
      **Recorded, not repaired:** the tree carries four other CI-detection shapes
      that disagree (`firstRunNotice.ts`, `initRouting.ts`, `install.ts`,
      `release.ts`, `exec_evidence.ts`, `reach_doctor.ts`). The module header
      declines to rewrite them as a drive-by and cites "the roadmap note on Phase
      4 step 3" — **this is that note**; it did not exist until now, which is
      itself one of the dangling citations under Findings below.

**Exit criteria:** a fresh interactive session asks exactly one question and
prints exactly one auto-set notice; a non-TTY session asks nothing; the
resulting file has at most two entries, each with provenance.
**Rollback:** disable the first-run trigger; the canary stays dark as today.

## Phase 5 — The JIT protocol

- [x] One normalised B-class ask template as a single rule: what is needed, why
      now, options with the default marked, and where the answer is stored.
      <!-- verify: npx vitest run tests/scripts/jit_ask_budget.test.ts -->
      `src/rules/settings-ask-protocol.md`. Slot 4 is read from the key's
      **class**, never from taste. **Widened on purpose:** the rule covers two
      classes, not one — B (persist once) and C-set-to-`ask` (this run only) —
      because the prerequisite re-read found all six ask-shaped keys are C.
- [x] Enforce the budget: at most ONE settings question per command execution.
      Further undecided B keys in the same run take the conservative default
      silently and are listed in the end-summary with the command that changes
      them.
      <!-- verify: npx vitest run tests/scripts/jit_ask_budget.test.ts -->
      The *split* is computed, not promised: `planSettingsAsks` returns the one
      key asked, the keys defaulted silently, and the keys skipped with a typed
      reason; `silentDefaultsSummary` renders them into the one end-summary that
      already exists. The exit criterion is therefore runnable — the planted
      three-B fixture is built from the contract's real three B keys. **The
      ceiling itself stays prose:** no gate can count the questions in a chat
      turn, and the rule says so under `enforced_by: none` rather than borrowing
      a neighbour's hook.
- [x] Migrate the three existing ask-shaped settings onto the protocol and
      delete their bespoke per-setting prose — the pattern already exists
      piecemeal; this universalises it.
      <!-- verify: npx vitest run tests/scripts/jit_ask_budget.test.ts -->
      **Four of six migrated; two carved out with a stated reason.** The step
      said "three" — the real set is six (prerequisite re-read). Migrated:
      `tokens.rich_skills` (`token-budget-discipline`), `subagents.auto`
      (`delegation-policy`), `subagents.budget_routing` (`subagent-routing`),
      `subagents.adversarial_council` (`review/changes`). Carved out, because
      neither is a settings-value ask: `worktrees.mode: ask` routes to
      `scope-control`'s per-creation **permission** gate, and
      `decision_engine.on_block: ask` is a TTY prompt in TypeScript.
      **Closed this run:** the migration was pinned by nothing, so a rewrite of
      any of the four could restore its bespoke prose unnoticed. Six cases now
      assert each site still cites the protocol *and* that the two carved-out
      keys did not quietly get migrated anyway — the absence is the load-bearing
      half. Note the prose was **rewritten to defer the shape while keeping the
      site-specific "why now"**, not deleted; only `review/changes/command.md`
      lost an actual block.
- [x] On hook-capable hosts, have the consent-gated action verify the recorded
      decision before it runs, and state the enforcement gradient honestly for
      prose-only hosts: the ask is model-carried there, and ask-once can
      degrade to ask-never.
      <!-- verify: npx vitest run tests/scripts/memory_learn_hook.test.ts -->
      **`consentVerdict` has its first production caller.** Until this run it was
      a library with a test and no consumer — the "defined but not wired" shape
      `senior-engineering-discipline` counts as not done, and a sharper instance
      of this roadmap's own Risk 3 than the one it predicted: the reader built to
      stop the provenance stamp becoming decoration had itself become decoration.
      `src/scripts/memory_learn_hook.ts` is the only action in the tree a class-B
      key actually gates, and it read the bare value through a local `=== 'true'`.
      It now asks `learnConsent()`. The class is pinned rather than parsed (the
      2 s teardown budget forbids reading the contract markdown on every session
      end) and a test asserts the contract still says `B`, so a reclassification
      reds CI instead of silently unbinding the gate.
      **What it does and does not discriminate, plainly:** the hook reads the
      PROJECT-LOCAL `.agent-settings.yml`, which the class contract names as a
      file only a human writes, so `handEdited: true` is a fact about the path
      and a permissive value there IS the recorded decision. What the check adds
      today is a live class binding and shared value semantics — `yes` / `1` /
      `on` no longer read as a permission. The sidecar's
      `auto-detected`-refusing power only becomes live on the user-global path,
      which the hook does not read; see Findings.

**Exit criteria:** a planted fixture needing three B decisions asks once,
assumes two conservatively, and lists both in the summary; the gated action on a
hook-capable host refuses to run without the record.
**Rollback:** revert to per-setting prose; no stored data changes shape.

## Glyph re-encoding, 2026-08-07 — and the discriminator it produced

Closing Phases 4 and 5 took `count_open` to 0 while four `[~]` items remained,
which fires `roadmap-progress-sync` Iron Law 3 — and that fires as a **commit
refusal**, not merely as an archive block (`update_roadmap_progress.ts:608` +
`install-hooks.sh:147-168`; `--no-verify` is independently blocked by
`block-no-verify`). There is no agent-side bypass, so the encoding had to be
right rather than worked around.

An AI council (2026-08-07, `claude-sonnet-4-5` + `gpt-4o`, 2 rounds, $0.09)
converged 2/2 that three of the four were **mis-encoded from the start**, and
produced the reusable test:

```
A STEP IS [ ] IF UNBLOCKING IT MEANS "NOW EXECUTE".
IT IS [~] ONLY IF UNBLOCKING IT STILL LEAVES "SHOULD WE?" UNANSWERED.
```

Applied here: if the maintainer closed `absent-is-not-default-for-projection-mode`
tomorrow, Phase 3 steps 1, 3 and 4 would be implemented immediately — there is no
"should we?" left in any of them. They are **sequencing-blocked, not
scope-deferred**, and "open and blocked" is exactly what a `[ ]` plus a recorded
blocker already means; the dashboard renders the blocker in its own column. So
the conversion is an accurate re-description, not gate-gaming. Steps 3 and 4
make the point sharpest: their stated reason was *"deferred with step 1"* — a
reference to a dependency, which is a `[ ]`, never a deferral.

The option of leaving one genuinely-done Phase 4/5 step unflipped to keep the
gate quiet was considered and rejected outright by both members: a knowingly
false checkbox to bypass a safety gate is an integrity violation, and it is the
precise failure this run exists to correct.

**Out of scope, recorded:** the council's structural fix is to tighten
`roadmap-progress-sync` Iron Law 2 to *"a step with a recorded blocker in the
same roadmap MUST be `[ ]`, not `[~]`"*, making `[~]` a planning state rather
than an execution state. That is a rule edit in a different subject area
(`roadmap-progress-sync` is not a kernel rule, so it needs no soak) — filed
here rather than done, per halt condition 4.

## Findings — recorded, not repaired

1. **PR #1197 claimed "six of the roadmap's seven open steps close."** Verified
   against the tree this run: **two** closed cleanly (5.1, 5.2), four were
   partial and one had not started. The overstatement is why this roadmap's
   checkboxes are flipped from evidence rather than from the PR body.
2. **Two dangling citations pointing at prose that did not exist.**
   `src/shared/interactiveContext.ts:26` cites "the roadmap note on Phase 4
   step 3", and commit `27e664999` says of the 5.4 deferral that "the roadmap
   records why". Neither existed. Both are written now (Phase 4 step 3, Phase 5
   step 4) — the class of defect is a citation added in the same breath as the
   decision to defer *documenting* it.
3. **`memory_learn_hook` reads only the project-local settings file.** A user
   who enables `memory.learn_on_session_end` in the GUI — which writes the
   user-global file plus the provenance sidecar — never triggers the hook.
   Reading the user-global file is also where `consentVerdict`'s
   `auto-detected`-refusing power would actually discriminate. It is a behaviour
   change (a file-writing hook would start firing for users it does not fire for
   today), so it is a decision, not this step.
4. **Three of the four Phase-5 modules still have no production caller.**
   `planSettingsAsks`, `silentDefaultsSummary` and `nonInteractiveReason` are
   imported only by their tests. That is correct *as designed* — the ask is
   agent-carried (`enforced_by: none`) — but it means the non-interactive skip
   is proven for a gate nothing consults. `consentVerdict` is no longer in this
   list.

## Blockers

### blocker: absent-is-not-default-for-projection-mode
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 steps 1, 3, and 4 — step 2 (keep the template as the
  package-internal defaults source) is independent and already closed — and
  Phase 4 by inheritance
- **What to do:** Phase 3 rests on *absent = documented default*. At least one
  consumer contradicts that **deliberately**, so the sparse file cannot ship
  until the exceptions are enumerated and carved out.

  `src/scripts/install.ts:3404 _resolve_scoped_projection` reads
  `_resolve_global_settings_doc() ?? _load_default_settings(package_root)` and
  then `projection['mode'] === 'scoped' ? 'scoped' : 'legacy-all'`. The template
  fallback applies only when **no global settings file exists at all**. Once a
  file exists — which is the case the moment the wizard has run — an absent
  `projection.mode` resolves to `legacy-all`, **not** to the template's
  `scoped`. `_resolve_global_rule_scope` (`:3429`) documents the same rule in
  prose: *"an existing global settings doc is authoritative, and only a
  genuinely fresh machine falls through to the packaged template."*

  So dropping `projection.mode` from the materialised file would silently flip
  every consumer from scoped to unscoped rule projection — every rule installed,
  for everyone, with no signal. That is the roadmap's own Risk 1 materialised,
  found by looking rather than by shipping.

  The work this blocker gates, in order:

  1. Audit every key for absent-vs-default semantics. `projection.mode` is one
     confirmed case; `runtime.active_packs` is read by the same function and is
     the obvious second candidate. The audit is mechanical — grep each C-class
     key's readers for a `?? default` / `=== value ? … : fallback` shape — but it
     has to be done before, not after.
  2. Give the sparse emitter an **always-written** set for the keys whose
     absence means something other than their default, with the reason recorded
     per key.
  3. Only then change `src/server/routes/wizard.ts:1310`.
  4. In the SAME change, dispose of the one remaining `[~]` (Phase 2 step 2).
     Closing Phase 3 takes `count_open` back to 0 with that item still
     deferred, which re-fires Iron Law 3 as a repo-wide commit refusal with no
     agent-side bypass — the deadlock this roadmap already hit once, recorded
     under § Glyph re-encoding. Announced here so the next contributor meets it
     in the plan rather than in a blocked commit.
- **Resolved when:** the absent-vs-default audit exists, every key whose absence
  changes behaviour is either carved out or fixed at its reader, and
  `tests/install/settings_materialisation.test.ts` pins a fresh install whose
  file is sparse AND whose resolved rule scope is unchanged — and step 4 above
  has disposed of the remaining `[~]` in the same change.

### blocker: polish-gate-open
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** every phase
- **What to do:** RESOLVED 2026-08-05 by the gate's own second exit clause. No
  exception was granted and none was needed — `road-to-adoption-without-narrative-debt`
  was disposed to `agents/roadmaps/skipped/` as a decision against pursuit
  (external adoption is not a project goal), which satisfies "or that roadmap is
  archived". The first clause ("3 external adoptions") is struck outright by
  [`ADR-216`](../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
  § D5: no gate in this tree may be anchored on an external-adoption signal.
- **Resolved when:** resolved. Kept rather than deleted so the disposition is
  visible — this blocker held 19 open steps and the reason it lifted matters.

## Acceptance criteria

- Every template key carries an A/B/C class; the lint fails on an unclassified
  key; no spend-raising or irreversible key sits outside C.
- `settings set` refuses every C-class key from every caller, including the
  GUI's server route.
- A fresh install writes no settings opinions beyond what it actually decided;
  the template↔schema parity gate and the installer placeholder invariant are
  both still green — pinned in the same change, not asserted.
- An existing populated settings file upgrades with zero behaviour change and
  is stamped `source: manual`.
- A fresh interactive session asks exactly one question; a non-TTY session asks
  none.
- No command execution ever asks more than one settings question; a planted
  three-need fixture produces one ask, two conservative defaults, and a summary
  naming both.
- The reference documentation is generated from the schema plus the class
  table — one source, not a second hand-maintained page.
- The honest non-claims are recorded in the shipped docs: no enforcement on
  prose-only hosts, no protection against a user answering a B question badly,
  and no shorter first *week* — the same decisions get made, later and in
  context.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A sparse user settings file breaks a consumer whose flow depended on a written default | implementation | Today the template writes opinions into the user's file; making it sparse means a key that used to be present is now absent, and any code path reading it without a fallback breaks at the consumer rather than here. | Phase 1 fixes the taxonomy contract before Phase 2 writes anything, and Phase 3 only removes a key once the resolver is proven to fall back to the schema default for it. | Phase 1 — The taxonomy contract |
| 2 | The template-to-schema parity gate is weakened to let the split land | implementation | Splitting one file into an internal defaults source and a user decision record is exactly the change that makes a parity gate inconvenient, and this package has recorded gate-weakening as its own failure class. | The parity gate is treated as a fixed constraint the split must satisfy, not a cost to negotiate; any relaxation would be a separate recorded decision rather than a step here. | Phase 3 — The user file becomes sparse |
| 3 | The provenance stamp becomes decoration | product | Recording how each decision was made is only worth the field if something reads it; an unread stamp is cost with no return, which is the anti-ceremony failure the sweep record names. | Phase 5's just-in-time protocol is the reader — it uses the stamp to decide whether to re-ask; if that protocol does not land, the stamp does not either. | Phase 5 — The JIT protocol |
| 4 | First-run reduction trades one prompt for a worse silent default | product | Cutting first-run to one question means every other setting resolves without asking, and a wrong silent default is harder to notice than a question. | The single question is chosen to be the one whose wrong answer is most expensive; everything else resolves to a schema default that is observable in the sparse file rather than hidden. | Phase 4 — First run: one question, one notice |
| 5 | The roadmap was unblocked by a governance change rather than by its own readiness | product | This roadmap moved out of `later/` because an adoption-anchored gate was retired, not because its own prerequisites were re-verified — so a stale assumption inside it could now execute. | The prerequisites section is re-read as the first act of execution rather than trusted from the parked state; the blocker above records exactly what changed and why. | blocker: polish-gate-open |

## Provenance

Source: an external planning set delivered through the user inbox, drafted by
an assistant that had the repository tree but not its decision memory. The
maintainer offered the idea explicitly for critical review; the review changed
its shape twice — the language question was dropped as answerable by
observation, and "ship no template" became "split the template's two jobs" once
the parity gate and installer invariant were verified. Corrections and refusals:
[`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).
