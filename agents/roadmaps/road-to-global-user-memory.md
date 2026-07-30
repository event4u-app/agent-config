---
complexity: structural
status: ready
---

# Road to a global user-memory layer — the agent remembers the user, not just the repo

> Today the agent's memory of **the user** is a 100-line file at the root of one
> project. Seventeen projects means seventeen copies, or sixteen agents that have
> never met you. Meanwhile the miner that reads your sessions already detects
> preference signals — and is explicitly instructed to throw them away.
>
> This roadmap moves the user layer to the global root, gives it a learning
> channel with the human accept-gate intact, and — per the council's round-2
> reversal — satisfies the "project facts without a managed `agents/` folder" ask
> as **attribution on a user observation**, not as a global project registry.
>
> Council cut, verified starting state, the three lock verdicts, and the refused
> design: [`global-user-memory-cut`](../settings/contexts/global-user-memory-cut.md).

## Goal

Three layers were asked for. Two ship here, one is deferred:

- **U — the user layer.** A global `profile.md` under the existing
  `~/.event4u/agent-config/` root, with the project-local `.agent-user.md` as a
  deeper override. Plus a learning channel: the miner's already-detected
  preference signals reach a global observation buffer instead of `/dev/null`,
  and a human `accept` step remains the only thing that writes the profile.
- **P — project facts with no managed folder.** Not a second store. A
  `context` field plus a `seen_count` / `seen_in[]` counter on the user
  observation, so a fact knows which project it came from, survives that
  project's deletion, and generalises into the profile once a human has confirmed
  it in three places.
- **N — navigation ("where do my projects live").** Deferred with a stated
  `revisit-if`. It is a map of the user's disk; it earns the highest privacy
  stakes of the three and has the weakest demand evidence.

The success condition is not "a store exists". It is: **a fresh session in a
project the agent has never seen already knows how the user works, and the agent
never wrote a fact the user did not accept.**

## Non-goals — named, not silently dropped

Council-confirmed as unbuildable under the ADR-094 sunset and ADR-100's
storage-not-runtime reconciliation. Each is a **non-goal**, not a later phase:

- **Passive / background learning.** "The agent learned your style while you
  worked" is a background process by definition. The buffer is
  explicit-review-only; nothing is persisted to the profile without an accept.
- **Cross-project style *inference*.** Auto-detecting "these five projects all
  show the same preference" is a batch job over the whole store — a daemon by
  another name, or a 100× cost multiplier if every write scans globally. The
  `seen_count` path in Phase 3 counts only facts a human confirmed **per
  project**; it never discovers the pattern on its own.
- **Semantic project search.** "Find my website project" needs embeddings.
  Exact-match on a registered name or path is the ceiling — and that is inside
  the deferred N phase anyway.
- **Any network call.** The package contains zero network code and this work adds
  none; external profile enrichment stays rejected on
  determinism / ToS / test-impossibility grounds.
- **A second global store.** The knowledge store's patterns are reused. ADR-121's
  sensitivity classes are **not** extended, and no fourth class is introduced.

## Phase 0 — Ground the prerequisite: is this a managed `agents/` folder?

The whole P-routing question ("does this project have a managed folder, or does
the fact go global?") depends on a detector nobody has found yet. Build the
answer before building on top of it.

- [x] Confirm by search that no managed-`agents/`-folder detector exists today —
      `find_project_root` resolves a repo root, and the consumer-slim profile is
      prose in `docs/contracts/agents-layout.md`. Record the finding either way;
      if one *does* exist, this phase collapses to "reuse it" and the rest of the
      roadmap binds to that function instead.
      <!-- done 2026-07-30 — does NOT collapse to reuse: find_project_root_with_anchor (src/scripts/_lib/agent_settings.ts:368-401) is a settings-cascade root walker, returns [root, anchor] | null with no third state, and two of its four _AGENTS_DIR_MARKERS never exist in an installed consumer -->
- [x] Decide and document the detection predicate. Candidate signals, cheapest
      first: an `agents/` directory exists **and** a package-managed marker is
      present (the managed `.gitignore` block, an `agents/overrides/` dir, or a
      resolvable `.agent-settings.yml`). Pick the set that cannot false-positive
      on an unrelated `agents/` folder in a third-party repo — that false positive
      writes project facts into someone else's tree.
      <!-- done 2026-07-30 — predicate: agents/ dir AND any managed marker (the .gitignore SECTION_HEADER imported from sync_gitignore.ts, agents/overrides/, or a resolvable .agent-settings.yml); rejected agents/-existence-alone and agents/roadmaps/ (Optional in the slim profile). Rationale + rejects recorded in the helper -->
- [x] Implement it as one pure, read-only helper in `src/scripts/_lib/`
      returning a three-state answer — `managed` / `unmanaged` /
      `not-a-project` — never a boolean. The third state is what a bare directory
      outside any repo resolves to, and it must route differently from an
      unmanaged repo.
      <!-- done 2026-07-30 — src/scripts/_lib/managed_agents_folder.ts, single named export, three-state union, injectable start dir, no ancestor walk, no writes -->
- [x] Unit-test the three states plus the adversarial case: a third-party repo
      that happens to contain an `agents/` directory resolves `unmanaged`.
      <!-- done 2026-07-30 — 10 cases; exit gate proven red-then-green: removing the marker guard fails exactly the adversarial third-party-agents/-dir case -->

**Exit gate:** the predicate is named, implemented, and its false-positive case
is covered by a test that fails without the guard.

## Phase 1 — The global user profile (read path)

- [x] Write the ADR. It records: the loader-order change (the contract currently
      reads, literally, "(1) `.agent-user.md` at project root, (2) nothing"), the
      mechanism-match verdict that this changes **location, not richness**, and
      the explicit note that the deferred-demographics exclusion is *strengthened*
      rather than reopened by the move to global scope.
      <!-- done 2026-07-30 — docs/decisions/ADR-138-global-user-profile-layer.md; records the loader-order change, the location-not-richness mechanism-match verdict, and that the demographics exclusion is strengthened not reopened -->
- [x] Add `~/.event4u/agent-config/user/profile.md` as the **weakest** layer via
      `user_global_paths.write_target(...)`, honouring `$EVENT4U_CONFIG_HOME` and
      the legacy `~/.config/agent-config/` read-only fallback like every sibling
      global artefact.
      <!-- done 2026-07-30 — src/scripts/_lib/agent_user_profile.ts resolves via user_global_paths write_target/resolve_with_fallback, honours $EVENT4U_CONFIG_HOME + the legacy read-only fallback -->
- [x] Extend the overlay/settings whitelist to admit the user layer at the global
      level — and in the same edit, add a comment at
      `USER_GLOBAL_OVERLAY_KINDS` recording **why** `contexts/` and `decisions/`
      remain excluded, so the next reader does not mistake this addition for the
      asymmetry being relaxed.
      <!-- done 2026-07-30 — comment added at USER_GLOBAL_OVERLAY_KINDS recording why contexts/ and decisions/ stay excluded: the profile is a different mechanism, the asymmetry is NOT relaxed -->
- [x] Pin the merge rule in `docs/contracts/agent-user-schema.md`: the authoring
      discipline is **disjoint fields** (global owns durable identity and style;
      project-local owns project-specific addenda, and the two should not carry
      the same field), and the mechanism for when they do anyway is
      **primitive-level deepest-wins** — project `style.pace` replaces global
      `style.pace`, no object merging. `# Notes` **concatenates** with `[global]`
      / `[project]` provenance markers so neither voice is silently dropped.
      <!-- done 2026-07-30 — disjoint-fields discipline + primitive-level deepest-wins (no object merging) + # Notes concatenation with [global]/[project] markers -->
- [x] Apply the **100-line cap per layer**, not shared. A shared total forces the
      pathological choice the council named: deleting global identity to make room
      for project context.
      <!-- done 2026-07-30 — per-layer cap; a test asserts the shared-total anti-pattern is NOT what ships -->
- [x] State the load model in the contract: the global profile is read at session
      start **exactly as the project-local file is read today** — same loader,
      same cap. This is parity, not new always-on cost. No session-start digest
      mechanism ships in this phase (the 200-word-digest proposal is the recorded
      Q6 dissent, and it needs its own measurement).
      <!-- done 2026-07-30 — parity statement in the contract: same loader, same cap, no session-start digest in this phase (the 200-word digest stays recorded dissent) -->
- [x] Cover the cascade with tests: global-only · project-only · both (deepest
      wins per primitive) · neither (the existing "agent uses generic address
      forms" path must still work) · `# Notes` concatenation order and markers ·
      per-layer cap enforcement.
      <!-- done 2026-07-30 — 14 new cases (global-only / project-only / both-deepest-wins / neither / notes concatenation + markers / per-layer cap) plus 37 sibling regression tests green -->
- [x] Downstream sweep for the contract change: `agent-user-schema.md`,
      `agents-md-thin-root` (the user-state vs project-state boundary it
      complements), the `/agents:user *` command bodies, the gitignore block
      (the global file lives outside any repo, so confirm nothing new needs
      ignoring), and the staleness warning path (`last_updated` > 90 days) which
      must now consider both layers.
      <!-- done 2026-07-30 — agent-user-schema.md + /agents:user command.md + show/command.md changed; agents-md-thin-root needs none (never described the storage location); gitignore needs none (global root is outside every repo); staleness now keys off the merged last_updated -->

**Exit gate:** a project with **no** `.agent-user.md` picks the user up from the
global profile; a project **with** one still wins on the fields it declares; the
ADR is written and the schema contract matches the implementation.

## Phase 2 — The learning channel (write path + the guards)

The miner already carries a **Preference** signal family and is instructed to
drop what it matches. This phase gives those matches a destination without
letting anything reach the profile unaccepted.

- [x] Add `~/.event4u/agent-config/user/observations.jsonl` — append-only,
      never read by the profile loader directly, mirroring the existing
      project-local buffer's contract exactly.
      <!-- done 2026-07-30 — src/scripts/_lib/user_global_observations.ts: append-only writer, path via user_global_paths, never rewrites on refusal -->
- [x] Give `memory-consolidation` a **second, user-scoped channel**: user-attribute
      matches route here instead of being discarded. The project-scoped rule in
      Phase 2 of that skill is **unchanged** — no user fact enters
      `agents/memory/` curated YAML, so the recorded lock stays literally intact.
      Add the routing as an explicit branch, and update the skill's "Do NOT" and
      "WHEN NOT to use this" sections, which currently send user-attribute facts
      to the onboard flow.
      <!-- partial 2026-07-30 — mineUserObservationCandidates() ships and is independently tested (the signals mine() used to discard now shape a candidate), and the skill documents the channel. NOT wired: the --commit-intake CLI does not yet auto-append, because the existing pinned parity suite spawns that script with no $HOME/$EVENT4U_CONFIG_HOME isolation and a real write would land in the live global root. Follow-up: isolate that suite env first, then wire the last mile -->
      <!-- completed 2026-07-30 — the blocker is gone, not worked around: the Wave-8g spawn rig now hands children a sandbox $HOME/$EVENT4U_CONFIG_HOME (explicit inheritHome opt-out), verified as its own green state across all 11 consuming suites before the wiring was touched. --commit-intake then landed the global append, shared ≤5 cap honoured, guards + redaction on every write, and a test snapshots the REAL buffer size around a run to prove it stays untouched -->
- [x] Enforce the ≤ 5-normalised-facts-per-cycle gate **globally across both
      channels**, not per channel, so the second channel cannot double the write
      volume. Make the shared counter explicit in the skill text — a per-channel
      reading of the existing gate is the obvious misimplementation.
      <!-- done 2026-07-30 — applySharedFactCap enforces one shared budget across both channels, not one per channel; covered by a test that fails if the cap is applied per-channel -->
- [x] Restate — not cross-reference — three persist-time write-guards in the user
      layer, because each one gets *worse* at global scope:
      **(a)** never persist a verbatim standing command (a stored directive
      becomes a durable injection that re-fires forever, and now in every
      project); **(b)** refuse a self-harmful standing preference
      ("never criticize me", "always agree with me") — surface it, never store
      it, per `direct-answers`; **(c)** the derivability check — if git or config
      answers it, store the *surprising* part, not the derivable value.
      The `reference`-shape rule may stay a cross-reference; its mechanics do not
      change with scope.
      <!-- done 2026-07-30 — restated in the user-scoped surface where the write happens, not linked -->
- [x] Turn the `.agent-user.md` exclusion list into **capture-time write-guards**:
      credentials · third-party names and birthdays · financial figures ·
      health / legal / therapy status · demographics · external-source
      identifiers are refused when the observation is captured, not filtered at
      review. Rejecting the same class fifty times at review is the noise problem
      this avoids.
      <!-- done 2026-07-30 — four guard classes, each independently tested: standing_command + self_harmful_preference (own matchers) · exclusion_list + hidden_unicode (routed through redaction_scan). Capture-time, before the append -->
- [x] Route every write through the existing `knowledge_global_redaction.ts` gate,
      **including** the `hidden_unicode` class. That class exists because the
      zero-width-smuggling probe failed on first run during the ADR-119
      validation — reuse the hardened gate rather than writing a second one.
      <!-- done 2026-07-30 — every write passes the gate; a redaction hit REFUSES the observation rather than silently rewriting it -->
- [x] Extend `/agents:user review` and `accept` to read the global buffer
      alongside the project-local one, showing the layer per proposed observation.
      The accept step remains the **only** writer of `profile.md`; keep the closed
      `field` allowlist and keep dropping anything outside it on read.
      <!-- done 2026-07-30 — review + accept read both buffers; applyObservationToGlobalProfile is the ONLY function that writes profile.md, and a test asserts appendGlobalObservation never touches it -->
- [x] Tests: a preference signal reaches the global buffer · a standing command is
      refused at capture · a self-harmful preference is surfaced not stored · a
      credential-shaped and a hidden-unicode-carrying observation are both
      refused · the shared ≤ 5 cap holds when both channels fire in one cycle ·
      `accept` writes the profile and `review` alone never does.
      <!-- done 2026-07-30 — 18 buffer cases + 5 sole-writer/cap cases; tests/lib green at 580 passed / 2 skipped -->

**Exit gate:** a real session's preference signal lands in the global buffer,
survives review, and only reaches `profile.md` through an explicit accept — and
each guard above has a test that fails when the guard is removed.

## Phase 3 — Project attribution and the generalisation promotion

This is the operator's third ask, implemented as the council's round-2 reading:
**attribution, not isolation.** No global project registry, no project-indexed
directory tree, no fourth sensitivity class.

- [x] Add a `context` object to the observation schema —
      `{project_path, project_name, first_seen}` — plus `seen_count` and
      `seen_in[]`, reusing the semantics of the global knowledge card's `seen_in`
      provenance footer rather than inventing a parallel primitive.
      <!-- done 2026-07-30 — ObservationContext {project_path, project_name, first_seen}; additive, so every Phase 2 test still passes unmodified -->
- [x] Wire the Phase 0 predicate as the router: `managed` → the fact stays in that
      project's `agents/memory/` exactly as today; `unmanaged` / `not-a-project` →
      the observation goes to the global user buffer **with** its `context`. Cover
      both branches with a test.
      <!-- done 2026-07-30 — routeProjectObservation calls detect_managed_agents_folder: managed → local (nothing reaches the global buffer), unmanaged + not-a-project → global via the Phase 2 guard pipeline. One detector, not a second one -->
- [x] Increment `seen_count` and append to `seen_in[]` when the same observation
      recurs in a different project. Reuse the existing similarity thresholds from
      `_lib/text_similarity.ts` (`MERGE_THRESHOLD` / `WARN_THRESHOLD`) — never
      hardcode a new one — so "same observation" means the same thing here as it
      does in the curated-memory dedup path.
      <!-- done 2026-07-30 — computeRecurrence merges on Jaccard similarity via the existing text_similarity lib, cross-project only -->
- [x] At `seen_count ≥ 3`, surface the observation in `review` as a **promotion
      candidate** for the durable profile, with a mandatory `promotion_reason` as
      human input — mirroring ADR-121's rule that there is no auto-`shareable`
      path. Show the count and the project list so the human can judge "seen in
      five projects" against "seen in one, three times".
      <!-- done 2026-07-30 — PROMOTION_SEEN_COUNT_THRESHOLD = 3; review surfaces a candidate and accept collects a mandatory promotion_reason. Never an automatic promotion -->
- [x] Document in the schema contract that this is the **only** generalisation
      path, and that the agent never infers the cross-project pattern itself
      (non-goal above). The counter is a human-confirmation tally, not a detector.
      <!-- done 2026-07-30 — recorded in agent-user-schema.md § Project attribution as the only generalisation path -->
- [x] Add the guard that makes the refused design stay refused: a test asserting
      **no project-indexed directory is ever created** under the global root.
      The metadata-enumeration risk — any `readdir` on a per-project parent
      handing the agent the user's whole project history — is precisely why the
      namespace was rejected, and a future contributor will otherwise re-propose
      it as an obvious optimisation.
      <!-- done 2026-07-30 — a test appends observations from 5 distinct projects and asserts the global user dir contains only observations.jsonl and no directory entry. Fails the moment anyone adds a project-indexed dir -->

### `seen_in[]` is a narrower metadata surface, not a null one

State this in the schema contract rather than leaving it implicit, because the
design that replaced the namespace **carries the same metadata class the
namespace was rejected for** — a buffer accumulating project keys over time is a
partial project map. The difference is real and it is the whole reason this shape
is acceptable, but it is a difference in *surface*, not in *kind*:

- A **directory namespace leaks passively**, to any parent-directory access —
  error handling, a diagnostic, a glob, and unavoidably to collision detection
  itself. Nobody has to intend it.
- A **`seen_in[]` field leaks only to a targeted read of that one file.** No
  incidental code path stumbles into it, and there is no collision-detection
  requirement forcing an enumeration.

Narrower, not zero. Two consequences follow, both cheap enough to build now
rather than defer:

- [x] **Put the buffer in the redaction paths.** The buffer must never reach a
      project-tracked artefact or a hook capture. Verified constraint (read
      2026-07-30): `src/scripts/redact_hook_capture.ts` exists but its policy
      deliberately **preserves** path-shaped envelope keys (`cwd`,
      `workspace_roots`, `transcript_path`) "so the schema is reviewable", and
      `--strict` only redacts strings longer than `--max-len` (default 120) — a
      project path sits comfortably under that. So reuse is not enough: extend
      `_USER_CONTENT_KEYS` (or add a sibling path-key set) to cover `seen_in`,
      `project_path`, and `project_name`, and add a fixture proving a captured
      payload carrying the observation shape comes out redacted. Route the same
      keys through `knowledge_global_redaction.ts` on write, per Phase 2.
      <!-- done 2026-07-30 — seen_in / project_path / project_name added to the hook-capture redaction key set, with a fixture test proving an observation-carrying capture comes out redacted; the append path already ran the redaction gate from Phase 2 -->
- [x] **Prune `seen_in[]` on promotion.** The counter is *counting evidence*, and
      only the buffer entry needs it. Once a fact is promoted, the profile entry
      carries the fact and **no `seen_in` list** — not a truncated one, not a
      count, none. The buffer entry keeps its list until the entry itself is
      pruned or revoked.
      <!-- done 2026-07-30 — the per-project list is dropped at promotion; the counter was counting evidence, not carrying it forward -->
- [x] **Test the resulting invariant:** the long-lived artefact (`profile.md`)
      converges to **zero project references**, and only the short-lived buffer
      ever holds any. Assert it directly — a test that greps the profile for a
      path-shaped or project-name-shaped value and fails on a hit. This is the
      property that makes the whole layer defensible over time: the thing that
      persists longest is the thing that names no project.
      <!-- done 2026-07-30 — asserted: profile.md holds zero project references after a promotion -->

**Exit gate:** an observation from an unmanaged project persists globally with its
project attribution, survives that project's deletion, reaches promotion
candidacy only at the third human-confirmed sighting, the no-project-namespace
test is green, the buffer is covered by both redaction paths, and `profile.md`
holds zero project references after a promotion.

## Phase 4 — Delete, revoke, audit

- [x] Implement per-observation delete and whole-project-context purge, writing an
      append-only tombstone **before** deletion — reusing ADR-121's
      `.revocations.jsonl` pattern verbatim, not a variant of it.
      <!-- done 2026-07-30 — user_global_revocations.ts reuses ADR-121 verbatim (same .revocations.jsonl filename, append-per-entry, tolerant reader, tombstone-before-delete). One disclosed adaptation: entity_id replaces card_id because neither a buffered observation nor a profile field has a content-slug analogue. Deletion is GATED on the tombstone succeeding — proven by a test that makes the tombstone throw and asserts the buffer is byte-identical -->
- [x] Add a read surface that renders what the global layer currently holds, so
      the user can audit their own profile and buffer without reading raw JSONL.
      <!-- done 2026-07-30 — /agents user show --audit on the existing cluster (no new top-level command), rendered through the same redaction gate the write path uses -->
- [x] Confirm and document that the global tree is outside every repo and
      therefore unignorable-by-construction — and that no code path copies it into
      a project, a committed artefact, or a PR body. `installed.lock` is the
      precedent for a global, `$HOME`-leaking, never-committed inventory; state
      that the same posture applies, and that the profile's *content* stays out of
      any generated or committed file.
      <!-- done 2026-07-30 — documented with the installed.lock posture as precedent. Claim deliberately NARROWED after checking: the guarantee stated is that the three Phase 2-4 modules only ever write under the global root — a repo-wide no-path-ever-surfaces claim would have been false, since the byte census reads the resolved profile path for a token count -->
- [x] Tests: tombstone precedes deletion · a purged project context leaves no
      residue in the buffer · the audit render carries no secret and no path
      outside the allowlist.
      <!-- done 2026-07-30 — 33 Phase-4 cases incl. purge-leaves-no-residue and a redaction assertion on the audit render -->

**Exit gate:** every write has a matching user-invocable delete, and the deletion
is auditable after the fact.

## Phase 5 — The gate that can actually fire

ADR-119 exists because a previous gate could not fire by construction: reuse
could only accrue while the layer was ON, and ON was withheld pending reuse. This
gate is keyed to **promotion behaviour**, which is observable whether or not the
layer ever loads.

- [~] Instrument counts only — no content, no PII: projects with ≥ 10 sessions ·
      projects with ≥ 1 promoted global observation · observations proposed ·
      observations accepted.
      <!-- partial 2026-07-30 — the two observable counters are WIRED where the writes land: recordObservationProposed inside appendGlobalObservation, recordObservationAccepted inside applyObservationToGlobalProfile (both fail-open: a counter never gates the user own data). The two project-level counters exist and are tested but stay UNWIRED on purpose — no per-project session counter exists, and building one would recreate the per-project enumeration surface the council refused. Wiring them needs a design that counts without enumerating -->
- [x] Pin the kill-criterion in the ADR: after 90 days live, **< 40 %** of
      projects with ≥ 10 sessions carrying ≥ 1 promoted observation, **or** a
      median review→accept rate **< 30 %**, triggers a mandatory teardown review
      whose default outcome is deprecation-with-archive unless defended with
      evidence.
      <!-- done 2026-07-30 — ADR-138 § Promotion-behaviour gate: 90-day window, <40% of projects with ≥10 sessions carrying ≥1 promoted observation OR median review→accept <30%, default outcome deprecation-with-archive unless defended with evidence -->
- [x] Write the non-self-locking argument into the ADR explicitly: promotion
      happens through human accepts regardless of whether the profile loads at
      session start, so the metric moves independently of further package work.
      Record the residual dissent on the window (90 days vs 6 months) and which
      one shipped.
      <!-- done 2026-07-30 — recorded: promotion moves through human accepts whether or not the profile ever loads, so the metric is independent of further package work. Residual dissent (90 days vs 6 months) recorded with the shipped choice -->
- [x] Add the counters to the enforcement/telemetry surface using the existing
      PII-exclusion-by-construction shape — a struct of allowlisted scalars with
      no field capable of holding free-form content.
      <!-- done 2026-07-30 — PromotionGateCounters is four readonly number fields; no field can hold free-form content (a compile-time fact, not a scrubbing pass), and coerceCounters drops any key outside the closed allowlist on read. Both halves tested -->

**Exit gate:** the four counters are recorded, the criterion is written with its
window, and the ADR states in one line why the gate can fire.

## Deferred (not scheduled) — layer N, "where do my projects live"

Deferred by council convergence: highest privacy stakes of the three layers (it
is literally a map of the user's disk) against the weakest demand evidence. Not
part of this roadmap's open work; recorded so the design is not re-derived from
scratch.

**Shape if it is ever built:** a new artefact (not an extension of
`linked_projects`, which is project-local, one-sibling-at-a-time, and explicitly
never bulk-includes) — append-only, minimal fields
(`path`, `remote_url`, `last_touched`, `has_managed_agents_folder`), omitting
`stack` (derivable from the project) and `role` (that is a U-layer fact about the
user's relationship to the project, not about the project). Hard boundary: never
auto-injected into context, never quoted into a committed artefact, and never
enumerating project B while the agent works in project A except on an explicit
navigation ask — after which it unloads.

**Open questions inside the deferral**, in the order they should be asked:

1. **Does the registry need plaintext paths at all?** A file holding `path` /
   `remote` / `last_touched` is functionally a `readdir` in file form — the
   anti-enumeration argument that killed the P-layer namespace has *not* been
   thought through for the registry case, and the council explicitly flagged that
   it may apply. Ask this **before** asking which fields the registry carries: if
   resolve-on-demand through the Phase-0 managed-folder detector is sufficient,
   the plaintext-path question dissolves and the field list is moot.
2. **The write trigger** — explicit command only risks an empty and therefore
   useless registry; a `session_start` hook buys convenience at the cost of
   per-project consent and a disk write on every shell tab.

**The deferral is the experiment, not just the sequencing.** If U ships and the
navigation pain persists, that is the first real evidence N is an *independent*
need rather than a symptom of missing user context. If the pain disappears once U
exists, building N first would have paid the highest privacy stakes in the design
for a phantom problem. Read the revisit-if that way — as a measurement, not a
queue position.

**Revisit-if:** sessions show the user repeatedly asking "where is my X project"
— i.e. the navigation problem is observed, not assumed. Until then this is a
hypothesis about a need, and the honest state is deferred rather than built.

## Acceptance criteria

- [x] A fresh session in a project with no `.agent-user.md` addresses the user
      correctly and applies their style, sourced from the global profile.
      <!-- verified — cascade tests cover global-only; the weakest-layer resolution honours $EVENT4U_CONFIG_HOME and the legacy fallback -->
- [x] A project-local `.agent-user.md` still wins on the fields it declares, and
      `# Notes` from both layers survive with provenance markers.
      <!-- verified — primitive-level deepest-wins per field, and # Notes concatenates with [global]/[project] markers; both covered -->
- [~] The miner's preference signals reach the global buffer; nothing reaches
      `profile.md` without an explicit human accept.
      <!-- partial — the second half holds outright: applyObservationToGlobalProfile is the ONLY writer of profile.md and a test asserts appendGlobalObservation never touches it. The first half is a callable, tested primitive (mineUserObservationCandidates) that the skill instructs CONSOLIDATE to call, but the --commit-intake CLI does not yet auto-append: the pinned parity suite spawns that script without $HOME/$EVENT4U_CONFIG_HOME isolation, so a real write would land in the live global root. Isolate that suite first, then wire the last mile -->
- [x] `agents/memory/` curated YAML still contains **zero** user-attribute facts —
      the recorded lock is verifiably intact, with a test asserting it.
      <!-- verified 2026-07-30 — tests/lib/curated_memory_no_user_attributes.test.ts asserts the lock, deriving the forbidden key set from the observation schema enum so the two cannot drift. Red-proofed: planting voice_sample turns it red, restoring turns it green, curated memory left byte-identical. The first draft of this test failed on a clean tree by matching bare words in prose — fixed to match declarations only -->
- [x] No project-indexed directory exists anywhere under the global root, with a
      test that fails if one is created.
      <!-- verified — red-proofed by injecting a per-project mkdir into the append path: the guard fires, and it asserts the INVARIANT (no directory entry, no project-named entry) rather than an exact file list, so a legitimate flat sibling file cannot tempt a later reader to loosen it -->
- [x] `profile.md` holds **zero** project references after a promotion — the
      `seen_in[]` list is pruned at promotion and lives only on the short-lived
      buffer entry, with a test that fails on a path- or project-name-shaped
      value in the profile.
      <!-- verified — seen_in[] pruned at promotion; a test fails on a path- or project-name-shaped value in the profile -->
- [x] The observation buffer is covered by **both** redaction paths — the
      write-time `knowledge_global_redaction.ts` gate and an extended
      `redact_hook_capture` key set — with a fixture proving a hook capture
      carrying `seen_in` / `project_path` / `project_name` comes out redacted.
      <!-- verified — write-time knowledge_global_redaction gate plus seen_in / project_path / project_name added to the hook-capture key set, with a fixture proving a capture carrying them comes out redacted -->
- [x] Every one of the four capture-time guard classes (standing command ·
      self-harmful preference · exclusion-list content · hidden unicode) has a
      test that fails when its guard is removed.
      <!-- verified — sampled red-proof: neutralising detectStandingCommand turns exactly its two tests red (guard-class test + write-path test) and restoring turns them green -->
- [x] Every write has a user-invocable delete, and deletion leaves a tombstone.
      <!-- verified — three write paths mapped to deleteGlobalObservation / purgeProjectContext / revokeGlobalProfileField; deletion is gated on the tombstone succeeding, proven by making the tombstone throw and asserting the buffer is byte-identical -->
- [~] The kill-criterion counters are recorded and the criterion is written with
      its window and its non-self-locking argument.
      <!-- partial — the criterion, its 90-day window, the non-self-locking argument and the residual dissent are written in ADR-138. Two of four counters are wired at the real write sites; the two project-level counters remain deliberately unwired because no per-project session counter exists and building one would recreate the per-project enumeration surface the council refused -->
- [x] `agent-user-schema.md` and the layout contract describe what the code
      actually does — loader order, merge rule, per-layer caps, and the global
      path.
      <!-- verified — loader order, merge rule, per-layer caps, global path, project attribution, and the delete/revoke/audit surface all documented against the shipped code -->

## Risks

- **The merge rule is where this silently gets confusing.** Two layers holding
  the same field is the ambiguity the disjoint-field discipline exists to prevent,
  but discipline is not enforcement — the primitive-level deepest-wins mechanism
  must be tested, not just documented, or the first real collision produces a
  surprise nobody can explain.
- **The refused namespace will be re-proposed.** A per-project directory under the
  global root looks like the obvious clean design, and its flaw (metadata
  enumeration on any `readdir` of the parent, forced by collision handling) is not
  visible from the code. The Phase 3 guard test plus the cut document are the only
  things standing between a future contributor and re-introducing it.
- **The replacement inherits a smaller version of the rejected risk.** `seen_in[]`
  is a partial project map too — the buffer accumulates project keys over time.
  The asymmetry that makes it acceptable (passive parent-dir leak vs. targeted
  single-file read) is a *narrowing*, not an elimination, and the two controls
  that keep it narrow are both easy to lose: the redaction-key extension can rot
  when `redact_hook_capture`'s key set is next edited (its default policy actively
  preserves path-shaped envelope keys, so the extension is swimming against the
  file's own grain), and the promotion-time prune is exactly the kind of step a
  later refactor drops as "harmless metadata". Both are pinned by tests in Phase 3
  for that reason — if either test is ever deleted rather than updated, treat it
  as the regression, not the cleanup.
- **A global profile raises the stakes of every capture bug.** A wrongly captured
  fact used to pollute one project; now it follows the user everywhere. This is
  the reason the guards moved to capture time and the demographics exclusion got
  stronger rather than looser — but it also means a capture regression is a
  cross-project regression.
- **The second channel could flood the review queue.** The shared ≤ 5 cap is the
  control; if preference signals turn out to have a higher false-positive rate
  than project-scoped signals, the cap is insufficient and the regex families need
  tightening before the loop is trusted. Watch the accept rate from Phase 5 — a
  low rate is the early signal, and it is also the kill-criterion's second floor.
- **Deferring N may be deferring the actual ask.** "Where the projects live" was
  named explicitly by the operator; the council deferred it on privacy stakes and
  demand evidence, not on it being unwanted. If the U layer ships and the
  navigation pain persists, the `revisit-if` should fire quickly rather than the
  deferral hardening into a silent no.
