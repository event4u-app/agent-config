# Global user-memory layer — the council cut (2026-07-29)

> Durable record of the council convergence on **where the agent remembers the
> user**, what it may learn from them, and where project facts live when a
> project has no managed `agents/` folder. Cite this file, not the council
> response directory.
>
> Council: `anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, debate mode, 2 rounds,
> 2026-07-29, actual cost $0.17. Necessity gate: borderline-strategic
> (necessary=4 / unnecessary=5) — proceeded per the borderline rule.

## The operator's ask (three layers)

- **U — user layer.** Who the user is, what they want, how they work; **learned
  over time**, not only interviewed once.
- **N — navigation layer.** Where the projects live, where to find what.
- **P — project layer with a fallback home.** Project facts belong in the
  project's own `agents/` folder *when it exists and is agent-config-managed*.
  Otherwise they persist at the user level but **project-scoped, "so you know
  what it belongs to"** — and a style fact should *also* reach layer U.

## Verified starting state (read in-tree 2026-07-29)

1. **The global root is already load-bearing.** `user_global_paths.ts` resolves
   `~/.event4u/agent-config/` (`$EVENT4U_CONFIG_HOME` override; legacy
   `~/.config/agent-config/` read-only fallback). Pure, never auto-creates dirs.
2. **A global file-first store already exists — for structural knowledge cards.**
   `~/.event4u/agent-config/knowledge/` (`knowledge_global.ts`). ADR-100: plain
   files, lazy-read, no daemon / DB / vector index / decay; unversioned; "a cache,
   never a source of truth, never a build input"; per-card provenance footer
   (`first_seen · promoted_at · last_verified · tier · seen_in`) substitutes for
   git history. ADR-119 flipped it default-ON after an adversarial redaction
   validation in which the **zero-width-smuggling probe failed on first run** and
   was closed by a `hidden_unicode` class + strip-then-rescan. ADR-121 added
   `prohibited` / `project` (default; promotion structurally refused) /
   `shareable` (needs redaction pass **and** `source_repo`, `owner`,
   `review_after`, `promotion_reason` — mandatory human input, **no auto-path**),
   plus an append-only `.revocations.jsonl` tombstone ledger.
3. **The user profile is project-local, tiny, manual.** `.agent-user.md` —
   project-root, gitignored, v1-minimal (`identity.name`, `language`, `role[]`,
   `style.pace`, `voice_sample`, `last_updated`, one `# Notes` section), hard cap
   **100 lines**. Loader order is literally "(1) project root, (2) nothing".
   Learning loop exists but is also project-local:
   `.agent-user.observations.jsonl` → `/agents:user review` → `accept`, closed
   `field` allowlist, anything else dropped on read. The agent **never** edits
   the file without an explicit accept.
4. **The engineering miner detects the needed signal and throws it away.**
   `memory-consolidation` Phase 2 carries a **Preference** signal family
   (`prefer|always|never|standard|i want|ich will`) and then instructs: the fact
   must be project-scoped, **"Drop user-attribute matches."** Exit gate ≤ 5
   normalised facts per cycle. It also carries persist-time write-guards worth
   reusing: never persist a verbatim standing command (a stored directive becomes
   a durable injection that re-fires forever); refuse self-harmful standing
   preferences ("never criticize me") — surface, do not store; `reference` shape
   stores the pointer not the value; derivability check (if git/config answers it,
   store the *surprising* part).
5. **The overlay cascade forbids project-shaped data at the global layer.**
   `agents_overlay.ts`: `CASCADE_ELIGIBLE_KINDS = {overrides, contexts,
   decisions}` but `USER_GLOBAL_OVERLAY_KINDS = {overrides}` only — "`contexts/`
   and `decisions/` are project-shaped and **must not leak across projects**".
   `memory/`, `roadmaps/`, `state/`, `runtime/` are not cascade-eligible at all.
   Global settings are whitelist-filtered (`MERGEABLE_KEYS`).
6. **Nothing exists for layer N.** The only global inventories are install-shaped
   (`installed.lock`, explicitly `$HOME`-leaking and never-committed;
   `deployed-files.json`). `linked_projects` is project-local, one sibling at a
   time, and explicitly never bulk-includes the sibling's files.
7. **No detector was found** for "is this a managed agent-config `agents/`
   folder?" — `find_project_root` resolves a repo root; the consumer-slim profile
   is prose in the layout contract. The ask requires one.

## Convergence

### Both members, both rounds

- **Q2 — the learning loop: give the miner a second, user-scoped channel** that
  writes to a **global** observation buffer, with the existing human
  `review → accept` gate unchanged. Automation means *proposing*, never
  *persisting*. The ≤ 5-facts-per-cycle cap applies **globally across channels**,
  not per channel, so the second channel cannot double write volume.
- **Q7 — privacy floor: reuse `knowledge_global_redaction.ts` verbatim**
  (including the `hidden_unicode` class) on every write to the new layers. The
  `.agent-user.md` exclusion list is **restated as capture-time write-guards**,
  not merely documented — refused at observation-capture, not at review. The
  **deferred-demographics exclusion strengthens at global scope** (global =
  longer retention = higher re-identification risk); the cold-start cost of
  re-asking is trivial against that. Delete/revoke reuses ADR-121's
  `.revocations.jsonl` tombstone-before-deletion pattern.
- **Q8 — three things are NOT buildable** under the ADR-094 sunset and ADR-100's
  reconciliation, and must be named as non-goals rather than silently dropped:
  **(a) passive/background learning** — "the agent learned your style while you
  worked" is a background process by definition; the buffer is
  explicit-review-only. **(b) cross-project style *inference*** — auto-detecting
  "these 5 projects show the same preference" is a batch job, i.e. a daemon by
  another name, or a 100× cost multiplier if every project-local write scans the
  global store. The `seen_count` path below works **only** on facts a human
  confirmed in each project. **(c) semantic project search** — "find my website
  project" needs embeddings; exact-match on registered name/path or an explicit
  tag is the ceiling.
- **Q10 — sequencing: U first, then the P-ask, N deferred** with a `revisit-if`.

### Round-2 reversal — the P-layer namespace is REFUSED (load-bearing)

Round 1 had both members at "physical namespace keyed by project identity under
the global root". Round 2 **both members reversed**, and the argument is the
cut's most important finding:

> A physical namespace fails on its own stated guarantee. "Wrong directory = load
> failure" addresses **content** leakage and ignores **metadata** leakage: the
> moment any code path — error handling, collision detection, a diagnostic —
> touches the parent directory, `readdir` on `~/.event4u/agent-config/projects/`
> hands the agent a list of every project the user has ever worked on. Collision
> *detection* is itself a forced enumeration, and the proposed
> "collision → manual rename" UI must show candidate matches, which **breaks**
> the fail-fast discipline the safety claim depends on. Collision rate is a red
> herring: at a 0 % collision rate the enumeration risk is still 100 %.

Lock #3 says project-shaped data "must not leak across projects" — not "must not
leak *content*". The miner's refusal to store user facts in project memory is the
same boundary read from the other side: **namespacing within a shared parent is
not isolation.** If it were, the miner could keep `agents/memory/user/` beside
`agents/memory/project/` and call it safe. It does not, on purpose.

**The re-read of the ask that resolves it: the operator wants *attribution*, not
*isolation*.** "Stored at the user level but project-scoped, so you know what it
belongs to" ≠ a global project registry. It means a **user observation carrying a
project-context field** — exactly the shape the global knowledge card's `seen_in`
footer already uses to say "seen in A, B, C" without per-project namespaces.

Resulting design:

- Project **with** a managed `agents/` folder → memory stays in `agents/memory/`,
  unchanged, committed, team-shared.
- Project **without** one → the observation lands in the global user buffer with
  `context: {project_path, project_name, first_seen}` plus `seen_count` /
  `seen_in[]`. Same observation seen in a second project increments the counter.
- At `seen_count ≥ 3` the review surface offers promotion into the durable global
  profile — which is the Q4 generalisation path, satisfied without a second
  storage system.

This satisfies the ask on all four counts (project attribution · global
persistence surviving project deletion · cross-project generalisation · no
enumeration surface) **and leaves lock #3 literally intact** — these are *user*
observations that happen to carry project context, not project-shaped artefacts
at the global layer.

### Residual dissent (recorded, not resolved)

- **Q1 — the U-layer merge rule.** One member: global `profile.md` as the
  *weakest* layer with project-local `.agent-user.md` as a deeper override,
  primitive-level merge (`style.pace` deepest-wins, `# Notes` concatenated with
  `[global]` / `[project]` provenance markers), **100-line cap per layer** —
  because a shared total cap forces a pathological choice ("delete global
  identity to make room for project context?"). Other member: split by content
  so the two layers **never carry the same field**, making merge trivial by
  construction. Recorded resolution for the roadmap: **do both** — the
  disjoint-field split is the authoring discipline, the cascade is the mechanism
  that handles the collision case anyway. Not a blocking conflict.
- **Q6 — session-start cost.** One member: a 200-word U digest at
  `session_start`, justified by the 3–4 turns per new project currently burnt
  re-establishing identity. Other member: strictly on-demand, **no**
  `session_start` load at all. Recorded resolution: the global profile is read at
  session start **exactly as `.agent-user.md` is read today** — the existing
  loader gains a weaker layer under the same 100-line cap, so this is parity, not
  new always-on cost. The observation buffer and layer N stay strictly
  on-demand. No new digest mechanism ships in Phase 1.
- **Q5 / Q9 — N-layer write trigger and gate window.** Explicit-command-only
  registration risks an empty and therefore useless registry; auto-registration
  on `session_start` buys convenience at the cost of a per-project consent and
  writes to disk on every shell tab. Gate window: 90 days vs 6 months. Both
  land inside the deferred N phase; neither blocks Phases 1–2.

### Falsifiable gate for the U layer (must be able to fire)

This package has a documented history of instruments that can never fire —
ADR-119 broke exactly that deadlock. The gate agreed here is deliberately keyed
to **promotion behaviour**, which is observable whether or not the layer ever
loads at session start, so it is **not self-locking**:

> After 90 days live: if **< 40 %** of projects with ≥ 10 sessions have ≥ 1
> promoted global observation, **or** the median review→accept rate is **< 30 %**,
> a teardown review is mandatory and the default outcome is
> deprecation-with-archive unless defended with evidence.

The < 40 % floor catches "only power users use this"; the < 30 % floor catches
"the loop proposes mostly junk". Counts only, no content, no PII.

## The three locks — mechanism-match verdicts

Per `decision-revisit-gate`, each recorded lock was checked for **mechanism
match** before being treated as blocking:

| Lock | Verdict |
|---|---|
| `.agent-user.md` is project-local and v1-minimal; demographics deferred to v2 pending usage data | **Different mechanism — does not block.** The change is *location*, not *richness*: the schema stays identical, the 100-line cap stays, and the demographics exclusion is not merely kept but **strengthened** at global scope. A contract edit + ADR is still required because the loader order is a pinned contract. |
| User-attribute facts are out of the memory pipeline (`memory-consolidation` drops them; the onboard flow owns them) | **Different mechanism — lock preserved literally.** No user fact enters `agents/memory/` curated YAML. The second channel has its own store, its own allowlist, and its own human gate; curated project memory keeps refusing user-scoped facts exactly as today. |
| Project-shaped data must not live at the user-global layer (`agents_overlay.ts` asymmetry; ADR-121 `project` default refuses promotion) | **Lock UPHELD, unamended.** The council refused the namespace that would have bent it. Project context becomes a *field on a user observation*; no project-shaped artefact and no project-indexed directory tree is created at the global layer. |

## Operator amendment (2026-07-30) — the replacement's own metadata surface

The council's round-2 reversal replaced a project namespace with a `seen_in[]`
field, and the cut recorded that as satisfying the ask "without an enumeration
surface". The operator sharpened this before the roadmap left draft, and the
amendment stands as part of the record:

**`seen_in[]` is itself a partial project map.** The global observation buffer
accumulates project keys over time — the same metadata class the namespace was
rejected for and layer N was deferred for. The difference is real and it is why
the shape is acceptable, but it is a difference in **surface**, not in kind, and
saying "no enumeration surface" overstates it:

- A directory namespace **leaks passively**, to any parent-directory access, and
  unavoidably to collision detection itself. Nobody has to intend it.
- A `seen_in[]` field **leaks only to a targeted read of that one file.** No
  incidental code path stumbles into it; no collision check forces an enumeration.

Narrower, not zero. Two controls follow, both cheap enough to build in the same
phase rather than defer:

1. **The buffer belongs in the redaction paths** — never into a project-tracked
   artefact or a hook capture. Verified constraint (read 2026-07-30):
   `src/scripts/redact_hook_capture.ts` exists, but its policy deliberately
   **preserves** path-shaped envelope keys (`cwd`, `workspace_roots`,
   `transcript_path`) "so the schema is reviewable", and `--strict` only redacts
   strings longer than `--max-len` (default 120) — a project path sits under that.
   Reuse alone is therefore insufficient: the key set needs an explicit extension
   for `seen_in` / `project_path` / `project_name`, plus a fixture. Note the
   extension runs against that file's own grain, so it is loss-prone on future
   edits.
2. **Prune `seen_in[]` at promotion.** The list is counting evidence and only the
   buffer entry needs it. The promoted profile entry carries the fact and **no**
   `seen_in` list — not a truncated one, not a count. The long-lived artefact then
   converges to **zero project references** and only the short-lived buffer ever
   holds any. This is the property that makes the layer defensible over time, and
   it is worth asserting in a test rather than trusting to discipline.

## Layer-N decision (2026-07-30) — deferral as experiment, not sequencing

The operator took the deferral and named a stronger reason for it than
sequencing: **the deferral is itself the experiment.** If layer U ships and the
navigation pain persists, that is the first real evidence that N is an
independent need rather than a symptom of missing user context. If the pain
disappears once U exists, then building N first would have paid the highest
privacy stakes in the whole design for a phantom problem.

Scheduling N now was also rejected for a reason that outlives the sequencing
call: **the enumeration argument has not been thought through for the registry
case.** The council itself flagged that it may bite a single-file registry too,
and a file holding `path` / `remote` / `last_touched` is functionally a `readdir`
in file form. So when the `revisit-if` fires, the first question is **not** which
fields the registry carries — it is whether the registry needs to hold paths **in
plaintext at all**, or whether resolve-on-demand through the Phase-0
managed-folder detector is sufficient. Recording that here so the deferral
reopens on the right question.

## What this cut explicitly does not decide

- Whether layer N is built at all (deferred with a `revisit-if`: repeated
  in-session "where is my X project" asks constitute the demand evidence).
- The N-layer write trigger (explicit command vs `session_start` hook) and its
  gate window — both inside the deferred phase.
- Any change to the global knowledge store's own sensitivity classes; ADR-121
  stands untouched, and its patterns are reused, not extended.
