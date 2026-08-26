---
stability: beta
keep-beta-until: 2026-08-13
---

# `.agent-user.md` schema (v1)

> **Status:** beta — locked for `1.18.0`. Re-evaluate fields after
> Phase 3 has been in active use for ≥1 week.

`.agent-user.md` is a single, project-root, gitignored Markdown file
that captures who the user is and how they want the agent to address
them. It is **deliberately minimal in v1** — name, language, role,
style, and a single voice sample. Everything else is deferred until
usage signal exists.

The file is owned by the user. The agent never edits it without an
explicit `accept` step.

## Locked frontmatter (v1)

```yaml
---
version: 1
identity:
  name: "Matze"            # required — how the user wants to be addressed (full name or shorthand)
language: "de"             # required — BCP-47-ish primary language ("de", "en", "fr", ...)
role:                      # optional — unordered list of role labels (may be empty)
  - founder
  - engineer
style:
  pace: "pragmatic"        # pragmatic | thorough | rapid
voice_sample: |            # optional — one paste of the user's typical writing
  Mach das einfach. Wenn unklar, frag im Council.
last_updated: "2026-05-15" # YYYY-MM-DD — bumped on every accepted change
---
```

`role` is an **unordered** YAML block-style list. Order carries no meaning
(no "primary" role). The seeded enum mirrors `SEED_PROFILE_IDS` in
[`scripts/config/profiles.py`](../../src/scripts/config/profiles.ts):
`founder`, `developer`, `content_creator`, `agency`, `finance`, `ops`.
Free-form additions are accepted (forward-compatibility) — closed
validation lives in the wizard / settings GUI, not in the loader.

After the frontmatter, the body is a single freeform **`# Notes`**
section. Hard cap: **100 lines** total file size (including
frontmatter, body, and the Notes section). The 100-line cap is
enforced by `/agents user accept` and `/agents user update`.

## Field reference

| Field | Required | Purpose |
|---|---|---|
| `version` | yes | Schema version. v1 is the only valid value today. |
| `identity.name` | yes | How the agent addresses the user (full name or shorthand — user's choice). |
| `language` | yes | Primary language; the agent mirrors per [`language-and-tone`](../../dist/agent-src/rules/language-and-tone.md). |
| `role` | no | Unordered list of role labels (may be empty). Drives reviewer-voice selection and persona pairing when populated. Seeded enum mirrors `SEED_PROFILE_IDS`; additional free-form entries accepted; each present entry must be non-empty. The setup wizard never blocks a save on it. |
| `style.pace` | yes | `pragmatic` (default), `thorough` (more verification), or `rapid` (shorter replies). |
| `voice_sample` | no | Optional representative paste — sharpens mirror-back and tone calibration when present; may be empty. The setup wizard never blocks a save on it. |
| `last_updated` | yes | ISO date, bumped on every accept. |

## Explicit exclusions

The agent NEVER writes any of the following to `.agent-user.md`, even
with the user's explicit consent — they violate the privacy floor:

- Credentials, API keys, passwords, tokens.
- Third-party names (children, partners, colleagues, clients).
- Third-party birthdays or dates.
- Financial figures (salary, revenue, net worth, runway numbers).
- Health, legal, or therapy status.
- Demographics (relationship status, family context, age, location) —
  **deferred to v2** pending usage data per the re-validation gate. The
  global profile layer (ADR-138) does not reopen this — global scope
  means longer retention and higher re-identification risk, so the
  exclusion is **strengthened**, not relaxed, at that layer.
- LinkedIn URL or any other external-source identifier — **deferred**
  until a written host-agent-fetch contract and a "what counts as a
  public profile field" privacy floor exist.

## Global profile layer (ADR-138)

`.agent-user.md` at project root is no longer the only layer. A weaker,
global layer sits beneath it:

```
~/.event4u/agent-config/user/profile.md
```

Resolved via `user_global_paths.ts` — the same rules as every other
global artefact: `$EVENT4U_CONFIG_HOME` overrides the root, and the
legacy `~/.config/agent-config/` tree is read as a fallback for
pre-migration installs. It uses the **same v1 schema** as
`.agent-user.md` (this file's "Locked frontmatter" and "Field
reference" apply unchanged) and the **same 100-line cap**, enforced
**per layer** — never as a shared total across both files.

**Merge rule.** Authoring discipline is *disjoint fields*: the global
profile owns durable identity and style; the project-local file owns
project-specific addenda, and the two should not normally declare the
same field. When they do anyway, the mechanism is
**primitive-level deepest-wins** — the project value for a leaf field
(e.g. `style.pace`) replaces the global value outright; there is no
object or array merge. `# Notes` is the one exception: both layers'
text is concatenated, under `[global]` / `[project]` markers, so
neither voice is dropped. Implemented in
[`agent_user_profile.ts`](../../src/scripts/_lib/agent_user_profile.ts).

**Load model.** The global profile is read at session start *exactly*
as `.agent-user.md` is read today — same loader, same cap. This is
parity with the existing project-local read, not new always-on cost.
No session-start digest mechanism exists; the global layer is read in
full, same as the project layer.

**Write path (road-to-global-user-memory Phase 2).** The global profile now
has a write path: `~/.event4u/agent-config/user/observations.jsonl`, an
append-only buffer mirroring [§ Observation buffer](#observation-buffer)
one level up, and the `applyObservationToGlobalProfile` function in
[`agent_user_profile.ts`](../../src/scripts/_lib/agent_user_profile.ts) —
the **only** thing anywhere in this channel that writes
`profile.md`, invoked exclusively by the human-confirmed
`/agents user accept` step. Every candidate observation passes four
capture-time guards
(`src/scripts/_lib/user_global_observations.ts`'s `evaluateCaptureGuards`)
before it is even buffered — see § Observation buffer, below, for the
global-scope detail.

## Loader contract

Host agents resolve the effective user profile at session start, in
this priority order (deepest wins):

1. `~/.event4u/agent-config/user/profile.md` — global, weakest layer
   (see above).
2. `.agent-user.md` at project root (this contract) — wins on every
   field it declares.
3. Neither present — agent uses generic address forms.

The host agent surfaces the effective (merged) `identity.name` on
first reply whenever either layer supplies one.

## Determinism floor

The `agent-config` package itself contains **zero network code**.
External enrichment (e.g. LinkedIn profile fetch) was rejected on
determinism / ToS / test-impossibility grounds, and the host-agent
delegation workaround was additionally rejected on contract-floor
grounds (AI Council convergence — Anthropic, OpenAI, Google · 2026-05-14).
v1 is paste-only via `/agents user init`.

## Staleness

When the **effective** `last_updated` — the merged value per the
Loader contract above, i.e. the project-local date when a project file
declares one, otherwise the global profile's date — is older than 90
days, any `/agents user *` command surfaces a one-line warning (not a
blocker):

```
⚠️  .agent-user.md was last updated YYYY-MM-DD (>90 days ago). Run /agents user review or /agents user update.
```

The warning is computed against the effective date, so a stale global
profile is still surfaced even when the project has no local file at
all.

## Commands

| Command | Role |
|---|---|
| `/agents user init` | Creates the file from a short interview. Refuses overwrite without `--force`. |
| `/agents user show` | Read-only render — `--audit` mode renders the global-layer holdings. (Phase 2, audit mode Phase 4.) |
| `/agents user review` | List buffered observations. (Phase 3.) |
| `/agents user accept` | Apply selected observations; bumps `last_updated`. (Phase 3.) |
| `/agents user update` | Open in IDE for manual edit; validates on save. (Phase 3.) |
| `/agents user delete` | Delete one observation, purge a project's observations, or revoke a promoted profile field — with a tombstone in every case. (Phase 4.) |

See [`command-clusters.md`](command-clusters.md) for the locked
cluster registration.

## Observation buffer

Agents MAY append observations about the user (preferred reply style,
detected language drift, repeated correction patterns) to a JSONL buffer.
Two buffers exist, one per profile layer, with the identical line shape:

| Layer | Buffer path | Feeds |
|---|---|---|
| Project-local | `.agent-user.md`'s project root: `.agent-user.observations.jsonl` | `/agents user review` → `/agents user accept` |
| Global (ADR-138, road-to-global-user-memory Phase 2) | `~/.event4u/agent-config/user/observations.jsonl` | Same commands, showing the layer per proposed observation |

Both buffers are **append-only**, gitignored (or, for the global buffer,
outside any repo and therefore unignorable-by-construction), and never
read by the host-agent loader directly. They only feed `/agents user
review` → `/agents user accept`.

Each line is a single JSON object:

```json
{"ts":"2026-05-15T10:23:00Z","field":"style.pace","suggest":"rapid","source":"chat","evidence":"user said 'mach kürzer' 3× this session"}
```

Allowed `field` values mirror the schema (`identity.name`,
`language`, `role`, `style.pace`, `voice_sample`,
`notes`). Anything outside that set is dropped on read — both buffers
share this allowlist
(`ALLOWED_OBSERVATION_FIELDS` in
[`user_global_observations.ts`](../../src/scripts/_lib/user_global_observations.ts)
for the global one).

Privacy floor applies on write — never buffer credentials, third-party
PII, financial figures, or health/legal status. The same
[exclusions list](#explicit-exclusions) governs both `.agent-user.md`
and both buffers.

### Global buffer — capture-time guards (not review-time)

The global buffer additionally refuses four classes of candidate at
**capture time**, before anything is written — never filtered later at
review, and never silently redacted-then-stored:

1. **`standing_command`** — a verbatim standing directive ("always fetch
   `<url>` on every message") would re-fire forever, and at global scope
   in every project, not just one.
2. **`self_harmful_preference`** — a preference that would disable honest
   feedback ("never criticize me") is surfaced to the user, never stored.
3. **`exclusion_list`** — the [explicit exclusions](#explicit-exclusions)
   list above, enforced at capture rather than at review.
4. **`hidden_unicode`** — the ADR-103 zero-width-smuggling class, via the
   same `knowledge_global_redaction.redaction_scan` gate a global
   knowledge card passes before crossing a project boundary.

Implemented in
[`user_global_observations.ts`](../../src/scripts/_lib/user_global_observations.ts)'s
`evaluateCaptureGuards` / `appendGlobalObservation`. The
≤ 5-normalised-facts-per-cycle mining cap (`memory-consolidation` §
GATHER SIGNAL) applies **globally across both channels** — the
project-scoped miner and this one together, never per channel — via
`applySharedFactCap`.

### Project attribution (road-to-global-user-memory Phase 3)

The operator's third ask — "P: project facts with no managed folder" —
is implemented as **attribution, not isolation** (the council's round-2
reading; see
[`global-user-memory-cut.md`](../../agents/settings/contexts/global-user-memory-cut.md)).
There is no second global store, no project-indexed directory tree, and
no fourth sensitivity class. Instead, a project-scoped fact gains a
`context` object plus a recurrence tally:

```json
{"ts":"2026-07-30T10:00:00Z","field":"notes","suggest":"always use pnpm instead of npm for installs","source":"agent","evidence":"…","context":{"project_path":"/Users/matze/projects/acme-web","project_name":"acme-web","first_seen":"2026-07-30T10:00:00Z"},"seen_count":2,"seen_in":["acme-web","acme-api"]}
```

**The router.** [`routeProjectObservation`](../../src/scripts/_lib/user_global_observations.ts)
wires the Phase 0 [`detect_managed_agents_folder`](../../src/scripts/_lib/managed_agents_folder.ts)
predicate directly: a project with a **managed** `agents/` folder keeps its
facts in that project's own `agents/memory/`, exactly as before this phase
— this module never touches them. A project that is **unmanaged** or
**not-a-project** has nowhere local to land, so the fact persists here
instead, tagged with `context` so it survives that project's deletion.
`field` defaults to `notes` — the schema's free-form catch-all — since a
project-scoped fact (a convention, an invariant, a recurring gotcha) has no
natural mapping onto the closed identity/style enum; `context` is what
marks it as project-attributed, not a new field value.

**`seen_count` / `seen_in[]`.** Recurrence of the *same* observation
(Jaccard similarity ≥ `MERGE_THRESHOLD` from
[`_lib/text_similarity.ts`](../../src/scripts/_lib/text_similarity.ts) —
never a hardcoded second threshold, so "same observation" means the same
thing here as in the curated-memory dedup path) **in a different project**
bumps `seen_count` and appends that project's name to `seen_in[]`.
Recurrence in the same project again does not — the counter is a
cross-project confirmation tally, not a same-project noise counter. This
mirrors the semantics of the global knowledge card's `seen_in` provenance
footer (`knowledge_global.ts`) one level up, rather than inventing a
parallel primitive.

**`seen_in[]` is a narrower metadata surface, not a null one.** The buffer
accumulating project names over time is the same metadata class the
namespace design was rejected for — the difference is that a directory
namespace leaks passively (to any parent-directory access, error handling,
or collision detection), while a `seen_in[]` field leaks only to a
targeted read of the one buffer file. Narrower, not zero. Two controls
follow directly from that difference:

- **Redaction coverage.** The buffer must never reach a project-tracked
  artefact or a hook capture. `seen_in`, `project_path`, and `project_name`
  are keys in
  [`redact_hook_capture.ts`](../../src/scripts/redact_hook_capture.ts)'s
  `_USER_CONTENT_KEYS` (a hook-captured payload that happens to carry an
  observation object comes out with these three redacted), and every
  `context` written to the buffer passes
  [`evaluateContextCaptureGuards`](../../src/scripts/_lib/user_global_observations.ts)
  first — the same `knowledge_global_redaction.redaction_scan` gate Phase
  2 already runs on `suggest`/`evidence`. `project_path` is checked for
  `hidden_unicode` only (the generic `project_path` leak category would
  refuse every real value here by design, since a project path is
  *supposed* to look like one); `project_name` gets the full scan, since a
  hostile or careless directory name could otherwise smuggle a secret or a
  hidden character past capture.
- **No project-indexed directory, ever.** Covered by a test
  (`tests/lib/user_global_observations_project_attribution.test.ts`) that
  asserts nothing under `~/.event4u/agent-config/user/` is ever a
  directory — the metadata-enumeration risk that killed the namespace
  design in the first place, made mechanical so a future contributor
  cannot silently re-introduce it as "an obvious optimisation".

**The only generalisation path.** At `seen_count ≥ 3`
(`PROMOTION_SEEN_COUNT_THRESHOLD`), `findPromotionCandidates` surfaces the
observation in `/agents user review` as a promotion candidate — never an
automatic promotion. `/agents user accept` requires a human-supplied
`promotion_reason` before writing anything, mirroring ADR-121's rule that
there is no auto-`shareable` path for a knowledge card. This is the
**only** way a cross-project pattern reaches the durable profile; the
agent never infers the pattern itself (a named non-goal — cross-project
style *inference* is a batch job, i.e. a daemon by another name, or a
100× cost multiplier if every project-local write scanned the global
store). `seen_count` only ever grows one write at a time, from
`routeProjectObservation` observing a genuinely new project.

**Zero project references in `profile.md`.** `promotionValueFor` returns
only the fact's `suggest` text — never `context`, never `seen_in`. The
counter was evidence that lived on the short-lived buffer entry; once
promoted, the durable profile carries the fact and nothing that names a
project, not even a truncated list or a bare count. This is the property
that keeps the whole layer defensible over time, and it is asserted
directly by a test rather than trusted to discipline.

## Delete, revoke, and audit (road-to-global-user-memory Phase 4)

Every write the learning channel can make has a matching, user-invocable
delete — reached through [`/agents user delete`](#commands) — and every
deletion leaves an audit trail. Nothing in this section runs
automatically; each function below is invoked exclusively from a human
confirmation step, exactly like `applyObservationToGlobalProfile`.

| Write (Phase 2/3) | Delete counterpart | Implementation |
|---|---|---|
| `appendGlobalObservation` — buffers a pure user-attribute observation | `deleteGlobalObservation(observation_id, reason)` — removes ONE buffered line by its content-derived id | [`user_global_observations.ts`](../../src/scripts/_lib/user_global_observations.ts) |
| `routeProjectObservation` — buffers a project-attributed observation (via `appendGlobalObservation`) | `deleteGlobalObservation` (single fact) **or** `purgeProjectContext(project_path, reason)` (every fact attributed to a project at once) | [`user_global_observations.ts`](../../src/scripts/_lib/user_global_observations.ts) |
| `applyObservationToGlobalProfile` — sets/overwrites a field in `profile.md` (both the plain-accept write and the Phase 3 promotion write call this SAME function, so one delete covers both) | `revokeGlobalProfileField(field, reason)` — unsets that field in `profile.md` | [`agent_user_profile.ts`](../../src/scripts/_lib/agent_user_profile.ts) |

### The revocation ledger — ADR-121's `.revocations.jsonl` pattern, reused

[`user_global_revocations.ts`](../../src/scripts/_lib/user_global_revocations.ts)
mirrors ADR-121's knowledge-card revocation ledger
(`knowledge_global_promote.ts`'s `append_tombstone` / `load_tombstones`) at
the mechanism level: the same filename (`.revocations.jsonl`, here under
`user/` instead of the knowledge store's own root), the same single
`fs.appendFileSync` per entry — never rewritten — the same "the caller
MUST call this BEFORE deleting the thing it documents" contract, and the
same tolerant reader (a malformed line is skipped, never crashes the
read). Every delete/purge/revoke function above calls it first, and only
proceeds to rewrite the buffer or `profile.md` once the tombstone write
has succeeded — verified by tests that gate the tombstone write and
assert the buffer/profile file is left byte-identical when it throws.

**The one adaptation.** ADR-121's `RevocationEntry.card_id` addresses a
knowledge CARD via its content-derived slug (`card_id_from`). Neither a
buffered observation nor a `profile.md` field has that natural id — the
Phase 2/3 JSONL schema never added a stored `id`, and a profile field is a
YAML key, not a file with a stem. This ledger's entries therefore carry
`entity_id` in place of `card_id` — a content hash
(`observationId(entry)`, over `ts` + `field` + `suggest`) for a buffered
observation, or `profile:<field>` for a revoked profile field. Field
order, the `{revoked_at, <id>, reason}` shape, and every operational
guarantee are otherwise unchanged.

`purgeProjectContext` writes ONE tombstone per removed observation before
the buffer is rewritten once — mirroring `knowledge_global_cli.ts`'s
`cmd_purge` (one tombstone per card, written before that card is wiped),
so every purged fact has its own audit line rather than one line covering
an unspecified batch.

### Audit render — `/agents user show --audit`

[`user_global_memory_audit.ts`](../../src/scripts/_lib/user_global_memory_audit.ts)'s
`renderGlobalMemoryAudit` is the read surface that lets the user see what
the GLOBAL layer currently holds — `profile.md`'s fields, the buffer's
entry count and per-field counts, promotion candidates, and the
revocation ledger's tombstone count — without reading raw JSONL. It is
reached via [`/agents user show --audit`](#commands), an extension of the
existing read-only render command, not a new top-level command.

Every free-text value the render might include — a profile field's string
value, a buffered `suggest`/`evidence`, a promotion candidate's project
list, a tombstone's `reason` — is routed through the SAME
`knowledge_global_redaction.redaction_scan` gate the write path already
runs, and is replaced with `[redacted]` on any hit. That gate's
`project_path` category already flags absolute-path shapes in free text
(`/Users/`, `/home/`, `/opt/`, `/private/`, a configured `repo_root`), so
a path mentioned inside an observation's own text is caught the same way
a credential or an email would be. `context.project_path` itself is never
read by the render at all — only `context.project_name` (already a
basename) ever reaches it, and it still passes the same scan. The only
path-shaped strings the render ever emits verbatim are the two canonical,
tool-owned storage locations it resolves itself (`profile.md`'s and the
buffer's paths) — never a value that came from user- or agent-authored
content.

### The global tree is unignorable-by-construction

`~/.event4u/agent-config/user/` — `profile.md`, `observations.jsonl`, and
now `.revocations.jsonl` — lives outside every git repository this
package's agent ever operates inside. A `.gitignore` block can only
exclude paths *inside* a repo; there is no repo-relative pattern that
could ever match a path under the user's home directory, so nothing needs
to "remember" to ignore it — it is unignorable by construction, not by a
maintained ignore rule that could rot.

`installed_lock.ts`'s `installed.lock` at the same root is the existing
precedent for this posture: a global, `$HOME`-leaking, never-committed
inventory that every install/update reads and writes without ever being a
candidate for `git add`. The user-memory tree adopts the identical
posture, verified for the modules THIS phase owns: `user_global_observations.ts`,
`agent_user_profile.ts`, and `user_global_revocations.ts` contain exactly
three write calls (`appendGlobalObservation`, `_writeBufferEntries`,
`applyObservationToGlobalProfile`/`revokeGlobalProfileField`,
`appendTombstone`), and every one of them targets a path built from
`user_global_paths.write_target(...)` — i.e. rooted at
`user_global_paths.event4u_root()` — never a project directory, a
generated or committed artefact, a roadmap, an ADR, or a PR body. The
audit render (§ above) is a terminal/chat-output surface only; it is a
plain in-memory struct + string, never itself written to a file. This is
a within-this-phase guarantee, not a repo-wide one: a downstream
consumer of `resolveGlobalProfilePath` (e.g. a cost/telemetry census that
only ever reads a byte count, never field content) could in principle
still embed the resolved *path* — which reveals nothing about the
profile's content but does reveal a directory name — into its own
report; auditing every present and future caller of the read-only
resolver functions is out of this phase's scope.

## Gitignore

`.agent-user.md` and `.agent-user.observations.jsonl` are added to the
package-managed `.gitignore` block
([`src/config/gitignore-block.txt`](../../config/gitignore-block.txt)) and
ignored by default. A `--shared` opt-in to commit `.agent-user.md` is
deferred — only the doc note lands in v1. The observation buffer is
**never** shared.

## Example

A complete, paste-ready fixture lives at
[`docs/examples/agent-user.example.md`](../examples/agent-user.example.md).
Copy it to the project root as `.agent-user.md` and edit, or run
`/agents user init` for the interactive flow.

## See also

- [`language-and-tone`](../../dist/agent-src/rules/language-and-tone.md) — language-mirroring rule the loader feeds.
- [`agents-md-thin-root`](../../dist/agent-src/skills/agents-md-thin-root/SKILL.md) — Thin-Root contract that this file complements (user-state vs project-state).
- [`ghostwriter-schema`](ghostwriter-schema.md) — sibling voice primitive for **external public-figure** voices (`/ghostwriter:write`, mandatory disclosure footer). `.agent-user.md` covers the maintainer's **own** voice (`/post-as:me`, no footer); the three-primitive model is summarised in [`personas/README.md § See also — sibling voice primitives`](../../dist/agent-src/personas/README.md).
- [`ADR-138`](../decisions/ADR-138-global-user-profile-layer.md) — the global profile layer, its merge rule, and the mechanism-match verdicts on the two prior locks it touches.
- [`agent_user_profile.ts`](../../src/scripts/_lib/agent_user_profile.ts) — the cascade implementation (path resolution, parsing, deepest-wins merge, per-layer cap) plus `applyObservationToGlobalProfile` (Phase 2) and `revokeGlobalProfileField` (Phase 4), its delete counterpart.
- [`user_global_observations.ts`](../../src/scripts/_lib/user_global_observations.ts) — the global observation buffer's write/read path, its four capture-time guards (Phase 2), the Phase 3 router (`routeProjectObservation`), recurrence (`computeRecurrence`), and promotion (`findPromotionCandidates`, `promotionValueFor`) primitives, and the Phase 4 delete/purge (`observationId`, `deleteGlobalObservation`, `purgeProjectContext`).
- [`user_global_revocations.ts`](../../src/scripts/_lib/user_global_revocations.ts) — the Phase 4 tombstone ledger shared by the two modules above; reuses ADR-121's `.revocations.jsonl` pattern.
- [`user_global_memory_audit.ts`](../../src/scripts/_lib/user_global_memory_audit.ts) — the Phase 4 audit render behind `/agents user show --audit`.
- [`managed_agents_folder.ts`](../../src/scripts/_lib/managed_agents_folder.ts) — the Phase 0 `managed` / `unmanaged` / `not-a-project` predicate the Phase 3 router is wired to.
- [`memory-consolidation`](../../dist/agent-src/skills/memory-consolidation/SKILL.md) § Global user-scoped channel — how a mined preference signal reaches this buffer instead of being discarded.
- [`global-user-memory-cut`](../../agents/settings/contexts/global-user-memory-cut.md) — the council convergence behind Phase 3's "attribution, not isolation" design and the round-2 namespace refusal.
- ADR-121 (`docs/decisions/ADR-121-knowledge-sensitivity-classes.md`) — the revocation-ledger pattern Phase 4 reuses.
- [`installed_lock.ts`](../../src/scripts/_lib/installed_lock.ts) — the existing `$HOME`-leaking, never-committed global inventory whose posture this layer adopts unchanged.
