---
complexity: structural
status: ready
---

# Road to capability answerability — twelve places the agent must guess whether a capability exists

> Source: a defect-pattern search triggered by one reported failure, 2026-08-08.
> An agent in a consumer project announced *"Kein Council konfiguriert (keine
> `.agent-settings.yml`)"* and substituted a weaker path; the council was
> configured user-globally the whole time, and the user's correction was blunt
> and repeated — this had happened before.
> The reported instance is fixed in the same PR that carries this roadmap. The
> search then found **eleven more of the same shape**, and the reported one is
> only the second-worst.

## The shape

```
An agent must decide whether a capability is available.
The only route is an inference from a filename or a settings key.
No deterministic check exists, or the one that exists returns the misleading answer.
The wrong guess silently substitutes a weaker path, so nobody notices.
```

Silence is what makes this class expensive. A missing tool errors loudly and gets
fixed. A capability *believed* absent produces a plausible substitute, an honest
note saying so, and a user who only finds out by accident.

Round 5 measured this suite's rules and found the correct text usually exists but
does not reach the agent. This is the same finding one layer up: the correct
*answer* usually exists, and the agent has no way to obtain it at the moment it
decides.

## What was measured

Twelve instances: seven capability-availability, five settings-key variants where
the semantics of an absent key are unstated or silently permissive. Plus five
adjacent path/name defects that make the intuitive file the wrong one — reported
separately because they are a different shape that *causes* the wrong inference.

| # | capability | must be inferred from | deterministic check | why the wrong guess is plausible |
|---:|---|---|---|---|
| 1 | host subagent-spawn | a manifest field that is not a file | **misleading** — the probe derives it from settings; the shipped template makes it all-false | two adjacent artefacts use the word "capability" for different things |
| 2 | AI council configured | `.agent-settings.yml` (wrong file) | **none** until this PR | the legacy block *was* there; sibling features still are |
| 3 | pack installed (5 safety floors) | the active-pack set | **none** — no verb prints active packs | `packs ls` looks authoritative and lists the catalogue |
| 4 | MCP server / tool available | an unnamed "tool registry" | **none** — the registry is a 2-entry constant | a skill tabulates 6 servers; config declares 1 |
| 5 | hook bound on this host | whether the trampoline is installed | **exists** (`hooks:status`) — referenced by **zero** rules | a matrix row says `none` for the host a rule claims coverage on |
| 6 | consumer brand profile present | a `.tokens.json` at no stated path | **none** | silent fall-through to corpus defaults |
| 7 | render capability (design review) | Playwright / DevTools / preview presence | **none** | **mitigated** — the rule mandates disclosing the degradation |

Settings-key variants, ranked by whether a wrong read is silent:
`consistency.cross_source` (safety gate, absent semantics unstated) ·
`personal.autonomy` (absent → permissive) · `roles.active_role` (the rule names a
file the template has no key in) · `tokens.rich_skills` · `quality.local_auto_run`.

### Three systemic roots, each verified

1. **The rules teach the wrong mental model.** One rule of 114 states a
   user-global resolution chain inline; ten name `.agent-settings.yml` bare. An
   agent reading the corpus learns "settings are project-local", which is the
   belief that produced the reported failure.
2. **There is no read-side settings verb.** A function computing exactly
   `[key, value, source_path]` exists and is called by nothing. So "what is this
   setting, and which file did it come from" is unanswerable by any command.
3. **"Capability" names three different things** across three artefacts — artifact
   projection, hook-slot binding, and the model's own belief about its host — and
   the probe verbs that would settle any of them are named in **zero** rules.

### The fix pattern already exists in this tree

`rtk:detect` (presence + identity readout, and it disambiguates a name collision)
and `reach:doctor` (active backend plus the pinned fix per channel) are exactly
the shape the remaining gaps need. `council:status`, shipped with this roadmap, is
the third. The pattern is not new work to invent — it is work to repeat.

## Blockers

### blocker: host-capability-default-flip

- **Status:** open — **proposed closure by supersession, pending one maintainer
  answer** (see below; the answer is a scope clarification, not a design call)
- **Owner:** maintainer
- **Blocks:** the third acceptance criterion only. It no longer blocks 1.1, 1.2
  or 1.3 — the decision those steps were waiting to *apply* has been taken and
  merged, so applying it is no longer a blocked act. Narrowed on measured
  evidence, not on judgement; the evidence is below.
- **What to do:** confirm (or reject) the supersession. The decision this blocker
  asked for was made under `road-to-always-on-orchestration` Phase 1, which chose
  the **second** of the three options this blocker itself listed — keep all-false,
  correct the comment, fix every reader — and went further by deleting the
  settings key outright. Measured on `origin/main` at `c3a30060a`:
  `subagents.host_capabilities` is **absent from the shipped template** (the
  template's own comment says it "was REMOVED" and that a leftover key from an
  older install "is ignored"), absent from the settings schema, and absent from
  the production code path (`probeHostCapabilities` resolves from a committed
  host registry plus a live environment probe, and a test pins its arity at 1 so
  no override parameter can return). There is no empty `host_capabilities: {}`
  left to assign semantics to.
- **Resolved when:** the maintainer answers the scope question below. The
  original wording — "the decision is recorded and the template comment, the
  loader, and the reading rules agree" — is satisfied for production behaviour
  and, as of this change, for the documents that describe it.

**The one question left, and it is the whole blocker.** "…and the reading rules
agree" is ambiguous between two readings, and only the owner can say which was
meant:

1. **Production behaviour** — template, loader, and runtime code agree. This is
   **complete** and was already complete before this change.
2. **Documentation exhaustiveness** — every document that describes how to read
   the manifest is correct too. This had **two live gaps**, both closed here: the
   contract documented five of the interface's six fields (`worker_respawn`
   appeared in neither its table nor its example), and no surface reported where
   a field's value came from.

If reading 1 was meant, this blocker is resolved and the third acceptance
criterion closes. If reading 2 was meant, it is resolved as of this change. Under
either reading the remaining act is a confirmation, which is why it is filed as a
question rather than as work.

Still not decided by an agent, deliberately: **nothing here changes what ships to
a consumer.** The consumer-visible flip was made by a human merging a different
roadmap. Recognising that merge is bookkeeping; making it would have been the
class of change this repo does not let an agent make, and this change does not
make it. The distinction — decide-what-ships versus decide-whether-the-criteria-
are-met — is the one an AI council (anthropic claude-sonnet-4-5 + openai gpt-4o,
2 rounds, 2026-08-10) converged 2/2 on, while also converging that the closure
itself stays a maintainer act. Hence: proposed, not taken.

## Phase 1 — The worst instance, once its semantics are decided

- [x] 1.1 Apply the blocker's decision to the template comment, the loader, and
  every rule that reads the host-capability manifest, so the three agree.
  <!-- The template and the loader already agreed (the key is gone from both);
  the DOCUMENTS describing them did not. Closed: `host-capability-manifest.md`
  gains the missing `worker_respawn` row in its Fields table and its schema
  example, plus a Provenance section; `docs/contracts/capability-answerability.md`
  moves the "Host subagent-spawn" row off `undecided — blocked`;
  `delegation-policy` states the check. -->

  **What "the three" turned out to be.** Two of the three were already
  consistent, so the step's real content was the third — and the third had a
  defect the roadmap had not seen: the interface declares **six** capability
  fields and the contract documented **five**. `worker_respawn` existed in the
  code, was referenced by a *different* roadmap's blocker, and appeared in no
  document a reader would consult. A step written as "make the docs match the
  decision" closed by finding the docs did not match the *code*.

- [x] 1.2 Make the probe honest: it currently reports a settings-derived answer as
  though it were a detection. Either detect, or say the number came from settings
  and may not reflect the host.
  <!-- `describeHostCapabilities(hostId)` in `src/scripts/_lib/host_capability.ts`
  returns the manifest plus a per-field `sources` map (`registry` | `live-probe`
  | `default`); `routing:doctor` prints it with a legend. The manifest half
  delegates to `probeHostCapabilities` so the readout cannot disagree with the
  value the delegation layer gated on. -->

  **The dishonesty moved rather than existing as described.** The step says the
  probe "reports a settings-derived answer" — that path was deleted with the
  settings key. What survives is a different misattribution at the same spot:
  the function is named `probe*` and the contract called it "a live environment
  probe", while **five of its six fields** come from a hardcoded table with
  exactly one row and only `agent_teams` is ever read from the environment. So
  on any host but one, every field is the all-false safe default — meaning
  *nobody answered* — and it renders identically to *checked, absent*. Verified
  by running the verb, not by reading it: `subagent_spawn=true(registry)` on the
  known host, `agent_teams=true(live-probe)` under the env flag, and all six
  `default` for `--platform cursor`.

  **Shape chosen: extend the existing diagnostic, not a new verb.** `routing:doctor`
  already printed the manifest alongside its `ASSUMED`/`observed` host flag — the
  same "say how you know" shape this step needs — so provenance went there. An AI
  council (anthropic claude-sonnet-4-5 + openai gpt-4o, 2026-08-10) converged 2/2
  on this over a dedicated verb, on the roadmap's own Risk-1 grounds: a sixth
  probe nobody references repeats the defect at higher cost.

- [x] 1.3 A test that the shipped template and the loader agree about the empty
  case — the contradiction above is exactly what no test asserts today.
  <!-- `tests/scripts/_lib_host_capability.test.ts`: a provenance block (5 cases,
  incl. a cannot-drift-from-probeHostCapabilities property) and a
  contract↔interface parity block (3 cases). 35 tests green. -->

  **Most of the literal ask was already pinned — by other work, and that is
  stated rather than re-claimed.** `lint_no_activation_gates` fails the build if
  the shipped template reintroduces a subagent activation key, and
  `routing_doctor.test.ts` + `delegation_nudge_hook.test.ts` each already pin
  that a leftover `subagents.host_capabilities` override no longer applies. So
  the template↔loader half had a gate and two tests before this change.

  **What nothing pinned is the drift that had actually shipped**, so that is what
  the new tests assert: contract table ↔ interface, contract example ↔ interface,
  and the provenance field list ↔ interface — three independent drift axes, all
  anchored on the interface declaration parsed from source. Each was verified by
  **mutate-then-revert**, not by reading: deleting the `worker_respawn` table row
  fails exactly one case, deleting it from the example fails exactly one other,
  and dropping it from the provenance list fails two. A parity test that has
  never been red is a tautology.

## Phase 2 — Answerability for the gaps with no probe at all

Ordered by whether a wrong guess is silent, which is the ranking that matters.

- [x] 2.1 `packs:active` — which packs are active here, and from which file. Five
  safety floors currently say "auto-activates when pack X is installed" with no
  way to check, and the shipped default makes them project regardless.
  <!-- Shipped as `src/scripts/_cli/cmd_packs_active.ts`. The verb reports the
  resolved profile id, its source layer, the pack list, and the file the body
  was read from — via the resolver's own `profile_file`, now exported rather
  than re-derived, so the probe cannot drift from what `resolve_profile` did.
  It also names the DEGRADED branch (settings file present, no `profile.id` →
  default id with an empty body: zero packs, zero personas), confirmed by a
  real run against a scratch project rather than by reading the code. -->

  **Measured while building it:** the degraded branch is not hypothetical — it
  fires on any project that has a settings file and never set `profile.id`, and
  in that state every pack-gated rule is inert while `packs ls` still lists the
  full catalogue. That is the "looks authoritative, answers a different
  question" failure the table's row 3 predicted.
- [x] 2.2 `settings:get <key>` — value plus the resolved source path. The
  computation already exists and has no caller; this exposes it. It is also the
  general answer to the settings-key variants, which is why it outranks fixing
  them one by one.
  <!-- Shipped as `src/scripts/_cli/cmd_settings_get.ts`, delegating to
  `iter_setting_overrides` — the caller-less function the roadmap named — rather
  than re-walking the cascade, so the probe cannot disagree with the loader.
  Reports value · winning source file · the full layer chain · class (via
  `classOfPath`, so a C-class map's children inherit their fence) · the template
  default · and two warnings the roadmap's own analysis implies: the carve-out
  divergence, and the silent whitelist drop. -->

  **Two things beyond the step text.** (1) The verb reports the **silent
  user-global drop**: `load_agent_settings` filters that layer through
  `MERGEABLE_KEYS` and discards the rest without a word, so a key set there has
  no error, no warning, and no effect. Verified on a real case —
  `install.auto_converge` is in the live user-global file and is discarded.
  (2) **Credential redaction**, which the roadmap does not ask for: a general
  settings reader is a general secret reader by default, and the user-global
  file on the machine this was built on holds `secrets.link_encryption_key`.
  Values on credential-shaped paths are masked; presence and source are still
  reported, so the verb still answers the question.
- [x] 2.3 `mcp:available` — which servers and tools are reachable now, as opposed
  to which are configured. Keep the two apart in the output; conflating them is
  the current defect.
  <!-- Shipped as `src/scripts/_cli/cmd_mcp_available.ts`. Prints three labelled
  sections: servers declared in `mcp.json`, whether each one's command resolves
  to an executable, and the static `TOOL_REGISTRY` allowlist — which is not MCP
  at all and is marked as such. Confirmed on the live tree: 1 declared server, a
  2-entry tool registry, and the `mcp` skill's prose table, which is a fourth
  number none of the three produce. -->

  **The step said "reachable" and the verb deliberately does not say that.** It
  performs no MCP handshake, so it reports `launchable` — the command resolves
  to an executable on `PATH` — and prints, in the output itself, that this is
  strictly weaker than "the server responds". Claiming reachability from a
  `PATH` lookup would be the same defect Phase 1.2 exists to fix, committed in a
  new verb. Remote (`url`) servers are reported as declared-but-unprobed rather
  than fetched: a read-only status verb must not grow an egress leg
  (`lethal-trifecta-guard`). An unparseable `mcp.json` exits 1 rather than
  reporting "no servers" — a declaration that does not parse is a failure to
  answer, not an answer.
- [x] 2.4 Brand-layer presence: state the canonical path in the rule that depends
  on it, then a probe. The path is stated nowhere at all today, not even in a
  lazily-loaded surface.
  <!-- `brand-source-of-truth` now carries the four canonical paths in
  precedence order, imported from the only resolver (`BRAND_TOKEN_PATHS`), plus
  `agent-config brand:status` (`src/scripts/_cli/cmd_brand_status.ts`), which
  reports which path holds a file or that none does. The probe IMPORTS the path
  list rather than restating it. -->

  **The path was not merely unstated — the stated filename was wrong.** The rule
  named `.tokens.json`, with a leading dot, in four places; the resolver searches
  `tokens.json`, without one. A consumer following the rule literally authors a
  file nothing can load, and no surface reports it. The rule is corrected and
  `brand:status` flags a dot-prefixed file explicitly, because "no brand" and "a
  brand file nothing reads" need opposite actions.

  **Not swept, deliberately.** The exact construct <code>&#96;.tokens.json&#96;</code> appears
  **43 times across 15 files** (skills, contracts, one ADR). That is not sloppy
  prose in one rule: the AUTHORING side (`brand-to-tokens`: "Author
  `.tokens.json`") and the READING side (the resolver) disagree about the
  filename, so picking one renames a file consumers may already have. That is a
  consumer-visible decision, not a cleanup, and it is recorded in the deferred
  table rather than taken here.

## Phase 3 — Make the answers reachable without knowing they exist

A verb an agent must know about is weaker than a fact it already has. That is the
lesson the reported failure taught, and the council fix applies it: a
`session_start` concern carries the availability fact, and the verb re-checks on
demand.

- [x] 3.1 Point every rule that claims hook-backed enforcement at `hooks:status`.
  The verb exists and is referenced by **zero** rules, which is why a rule can
  claim deterministic blocking on a host where the guard has nowhere to bind.
  <!-- 0 → 7 rules now name the verb: autonomous-execution, context-hygiene,
  evaluator-independence, external-code-graph-interop, git-history-discipline,
  self-repair-loop, session-canary. -->

  **The named successor item is closed here, and the premise was re-measured
  rather than inherited.** `autonomous-execution` asserted *"Enforced at
  tool-call time by the `block-config-weakening` PreToolUse guard"* with no host
  qualification. Counted from `hook_manifest.yaml`: **8** platforms are declared,
  a `pre_tool_use` concern list exists on exactly **3** (augment, claude,
  cowork). The claim now carries that qualification, matching what
  `git-history-discipline` and `evaluator-independence` already said about the
  identical slot.

  **A correction to the inherited note:** that item was deferred previously as
  "a kernel rule → own PR + ≥24 h soak". It is **not** kernel. The authoritative
  list is `KERNEL_RULE_IDS` in `src/scripts/_lib/kernel_rules.ts` — nine ids, and
  `autonomous-execution` is not among them; `kernel-membership.md` names it only
  as a *swap candidate* ("if swap accepted"). So no soak applies and the fix
  lands here.

  **One candidate deliberately not touched:** `domain-safety-pii` matches a
  PreToolUse grep, but its mention describes a hook that does **not** exist yet
  ("that is the trigger for a dedicated `legal-privilege-guard` PreToolUse
  hook"). It claims no current enforcement, so pointing it at `hooks:status`
  would answer a question it never asks.
- [x] 3.2 For each capability whose absence changes behaviour, decide once
  whether it is a fact worth carrying at `session_start` or a check worth naming
  in the rule. Carrying costs context on every session; naming costs an inference
  the agent may not make. Record the choice per capability rather than applying
  one answer to all four.
  <!-- Recorded in `docs/contracts/capability-answerability.md`: a per-capability
  table with the reason for each side of the trade, plus the revisit bar. -->

  **Outcome: one carry, four names, one conditional carry, one blocked.** Council
  stays carried (it earned it through a repeated real failure). Settings is
  `name` because carrying ~140 leaves is not a trade-off but an impossibility.
  MCP is `name` because the live session already receives its real tool list —
  the verb answers an authoring question instead. Brand and hook-binding are
  `name` because each is only relevant inside a specific rule, which now states
  the check. Host subagent-spawn is **undecided on purpose**: it depends on the
  open `host-capability-default-flip`, and choosing the carry before the
  semantics would be recording a preference, not a decision.

  **The one non-obvious answer:** packs is a **conditional** carry — emit nothing
  in the healthy case, emit loudly only when resolution is degraded. That shape
  is recorded as the decision; **the concern is not implemented here**, so today
  packs remains a named check via `packs:active`. Stated rather than left to be
  discovered as a gap.

  **The revisit bar is empirical, not architectural:** flip a `name` to a `carry`
  when the same wrong guess has been observed twice. Carrying costs tokens every
  session with certainty, so it should be bought with evidence rather than with
  the suspicion that somebody might one day guess wrong.
- [x] 3.3 Fix the mental model at its source: the ten rules that name
  `.agent-settings.yml` bare. Each gets the resolution chain or a pointer to it,
  because "settings are project-local" is a belief the corpus currently teaches.
  <!-- Verified after the edit: zero rules now name the file without also naming
  the cascade. Each pointer also names the concrete `settings:get <key>` call for
  that rule's own key, so the check is one paste rather than one inference. -->

  **The count was 11, not 10, and 2 already carried the chain.** Measured
  directly rather than inherited: 11 rules name `.agent-settings.yml`;
  `council-availability` and `session-canary` already state the user-global chain,
  and `source-confidentiality` already says "resolved project-then-global" — a
  phrasing the roadmap's own grep for "user-global" would have missed. So **8**
  rules were edited, not ten. None is a kernel rule (checked against
  `KERNEL_RULE_IDS`, not against the prose in `kernel-membership.md`), so no soak
  applies.

  **One pointer carries more than the chain.** `roadmap-ci-steps-policy` reads
  `quality.local_auto_run`, which is the inverted-polarity carve-out: an absent
  key resolves to `true` at its reader and therefore DISABLES the gate the
  template arms. Naming only the cascade there would have been true and still
  misleading, so that rule states both.

## Phase 4 — The adjacent path defects that make the intuitive file wrong

These are not inference burdens; they are mismatches that guarantee the inference
fails. Listed because fixing the reasoning while leaving these in place would be
half a fix.

- [x] 4.1 The one agent-reachable settings writer persists to a path the loader
  does not read. Worse, it writes into the directory the council config lives in,
  which is how a wrong mental model gets reinforced by a real file appearing in
  the wrong place.
  <!-- Fixed on the READER side, additively: `user_global_settings_paths()` now
  returns both user-global files in precedence order and `load_agent_settings` /
  `iter_setting_overrides` merge them. Pinned by
  `tests/lib/user_global_settings_paths.test.ts`; the 97 existing
  `agent_settings` tests stay green. -->

  **Measured, not read: it is three writers against one reader, and the reader
  was the outlier.** `src/server/routes/settings.ts`, `src/server/routes/wizard.ts`
  and `src/scripts/install.ts` all write
  `<event4u_root>/settings/.agent-settings.yml`; `load_agent_settings` read
  `<event4u_root>/agent-settings.yml`. On the machine this was built on the first
  file is **58 KB** of real decisions dated 2026-08-04 and the second is **107
  bytes** dated 2026-07-08. So every value set through the only surfaces that
  write settings was inert — silently.

  **Fixed on the reader, not the writer, and additively.** Moving the writer
  would have meant changing three writers and relocating every existing user's
  file. The flat file also is not dead: `link_crypto.ts` reads it **directly**
  for `secrets.link_encryption_key`, so removing it from the cascade would have
  broken key resolution. It stays first; the canonical file layers on top and
  wins per key.

  **Blast radius, stated rather than hoped:** the user-global layer is filtered
  through `MERGEABLE_KEYS`, so of the ~140 leaves in that 58 KB file exactly the
  **14 whitelisted** ones become reachable. Confirmed live — `personal.autonomy`
  now resolves to the value the wizard wrote, where before the same read returned
  "not set in any settings file". This is a real behaviour change for every
  consumer whose canonical file sets a whitelisted key, and it is the change that
  makes the documented behaviour true.
- [x] 4.2 The onboarding gate reads the legacy repo-root path and treats "file
  missing" as "do not block", so an Iron-Law gate never fires on a canonically
  installed consumer.
  <!-- `onboarding_gate_hook.ts` now resolves through `SETTINGS_CANDIDATES`
  (canonical `agents/settings/.agent-settings.yml` before the legacy root file) <!-- ref-ignore -->
  via the exported `resolve_settings_path`. The 10 existing tests stay green;
  4 new ones pin the canonical hit, the precedence, the legacy-only case, and the
  missing case. -->

  **The missing-file branch is left as it is, deliberately.** "No settings file
  at all → do not block" is the documented pre-rule/cloud carve-out the rule
  itself states, so it is not a bug. The defect was purely the path: the hook
  built `<root>/.agent-settings.yml` while the canonical project file is
  `agents/settings/.agent-settings.yml`, so a correctly installed consumer took <!-- ref-ignore -->
  the missing branch every time. Fixing the path makes the existing carve-out
  mean what it says instead of swallowing every install.

  One detail worth stating: when neither file exists the resolver now returns the
  **canonical** path rather than the legacy one, so the state file names the file
  a consumer should create.
- [x] 4.3 A whitelisted settings key does not match the template's real key name,
  so a user-global value is silently dropped.
  <!-- `personal.ide` and `personal.pr_comment_bot_icon` added to
  `MERGEABLE_KEYS`, legacy spellings kept. Recorded as ADR-219 because the list's
  own comment says widening it requires one; the exact-list pin in
  `tests/lib/agent_settings.test.ts` is that requirement in executable form and
  was updated with the ADR cited, plus a test that the additive property holds. -->

  **Not one key — three, and the cause is a migration the whitelist never
  followed.** `install.ts` carries a migration map that moved `ide` →
  `personal.ide` and `pr_comment_bot_icon` into its `personal.` home;
  `MERGEABLE_KEYS` stayed at the pre-migration spellings. So it protected names
  the template does not have (`ide`, `personal.bot_icon`, and `name`, which has
  **no reader anywhere** and no template key) while filtering out the names it
  does. `personal.pr_comment_bot_icon` is documented as *"Personal preference —
  each developer decides"*, which is exactly the shape that is supposed to be
  user-global and was the one shape it could not be.

  **Additive on purpose:** both spellings are listed rather than swapped, so a
  user-global file still using a pre-migration name keeps resolving. `name` is
  kept despite being dead — removing it is a narrowing change and does not belong
  bundled into this one.

  **Named as not-fixed:** the migration map and the whitelist remain two lists
  that can drift apart again. A gate asserting every whitelist entry is either in
  the template or explicitly marked legacy would stop the next occurrence; it is
  not built here.
- [x] 4.4 The settings-classes contract asserts "a sparse file means absent =
  default"; the defaults map is empty, so no code implements it. Either implement
  it or delete the claim.
  <!-- Claim deleted and replaced with what is actually true, in
  `docs/contracts/settings-classes.md` § half one. `lint_settings_classes` still
  green (140 keys, A=27 B=3 C=110); `settings_set` consumers unchanged. -->

  **Deleted, not implemented — and the choice is not a shortcut.** Implementing a
  defaults layer would mean loading the template as a base layer so every absent
  key resolves to its shipped default. That is precisely what
  `src/shared/settingsCarveOut.ts` documents as **false for nine keys**, where a
  reader deliberately resolves absent to something else. Implementing the claim
  would therefore have changed behaviour on every install *and* made the
  carve-out module incoherent.

  What actually makes half one hold is the **reader**, not a defaults layer: each
  reader supplies its own fallback, and the lint guarantees the template value it
  is expected to mirror is the conservative one. The contract now says that, and
  names `quality.local_auto_run` as the case where the literal reading is
  actively wrong — template `false` arms a gate, absent resolves to `true` and
  disarms it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-08 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A probe is added and nothing points at it | product | `hooks:status` already exists and no rule mentions it, which is exactly how a capability stays unanswerable despite being answerable. Adding four more verbs nobody references repeats the defect at higher cost | Phase 3 is not optional polish — 3.1 and 3.2 are what make Phase 2 land. A verb shipped without a reference is counted as unshipped in the acceptance criteria | Phase 3 |
| 2 | Deciding the host-capability default silently changes every consumer | product | Making the empty case mean agent-resolved switches the orchestration layer on everywhere; keeping all-false leaves five rules claiming activation that cannot happen. Both directions are consumer-visible | The blocker exists so the trade is chosen rather than defaulted, and 1.3 pins whichever answer wins so the contradiction cannot silently return | Blockers |
| 3 | `settings:get` becomes an attack on the class rather than a probe | implementation | A read verb invites a write verb, and a general settings surface is how the C-class ask-protocol gets bypassed | 2.2 is read-only by construction, and the class contract already refuses writes for the C keys; the verb exposes an existing computation and adds no new authority | Phase 2 |
| 4 | The count is inflated by lumping shapes together | implementation | Twelve is only meaningful if each instance really is the same defect; the five adjacent path defects are a different shape and were separated for that reason | The table names, per instance, what must be inferred and whether a probe exists — a reader can drop any row they disagree with and the pattern survives at nine | The shape |
| 5 | Fixing the mental model turns into a prose sweep | product | Phase 3.3 touches ten rules, and "add a sentence to ten rules" is the shape this suite has repeatedly found to be a non-fix | 3.3 adds a pointer to a resolution chain that exists, not an exhortation. If a rule cannot be fixed by a pointer it means the chain is not documented, which is a Phase 2 gap and gets routed there | Phase 3 |
| 6 | The reported instance is treated as the whole problem | product | It is fixed, tested, and shipped — which makes it the most likely thing to be mistaken for closure while eleven remain | The roadmap opens by stating the reported case is the second-worst, and Phase 1 is the worst one rather than the reported one | The shape |

## Measured, deferred, and why

| item | why not fixed here |
|---|---|
| Host-capability default | Consumer-visible default flip; maintainer-owned by this repo's own discipline. The blocker names the three options rather than picking one. |
| The five settings-key variants individually | 2.2 answers all five at once by making the resolved source readable. Fixing them one rule at a time would be five prose edits and no mechanism. |
| `cmd_quota` reading a removed `ai_council` block | Real, adjacent, and found while fixing the council instance. It needs its own change and its own test; folding it in would mix a bug fix with a behaviour question about where quota config should live. |
| Skill-body sweep for further instances | The rule corpus was swept exhaustively; ~290 skill bodies were not. More instances are likely there, and the count above is therefore a floor, not a total. |
| Running the probes to confirm the code-path conclusions | The sweep was read-only. The rank-1 "false on every stock install" is a code-path reading, not an observed run — 1.2 is where that gets executed rather than argued. |
| The `.tokens.json` ↔ `tokens.json` naming split (43 sites, 15 files) | Found while doing 2.4. The authoring surface (`brand-to-tokens`) and the reading surface (`BRAND_TOKEN_PATHS`) name different files, so this is a rename decision with consumer-visible reach, not a prose sweep. `brand-source-of-truth` is corrected because it is 2.4's own target and its two halves would otherwise contradict each other; `brand:status` reports the mismatch wherever it occurs. Picking the surviving name is a maintainer call. |
| Renaming `probeHostCapabilities` to something that is not a claim | The name is the misattribution 1.2 is about — five of six fields are table lookups, not probes. But it is referenced from the contract, two hooks, the doctor, a judgment-ladder comment and its own test file, so a rename is a cross-surface sweep whose only payload is a word. The provenance readout removes the *consequence* of the wrong name at the point a reader would be misled, which is where it costs the least. Recorded so the next reader knows the name was seen and left. |
| Widening the capability registry beyond its one row | Seven of eight declared platforms have no row, so `subagent_spawn` is `default` (no answer) there — which is now visible instead of implied. Adding a row requires OBSERVING the primitive on that host, which is a measurement campaign, not a documentation change. The registry's own comment already forbids speculative entries. |
| A second profile resolver | `src/scripts/config/profiles.ts` resolves `<root>/profiles/<id>.yml` via `artefact_roots()`, while `src/cli/commands/profiles.ts` reads `src/profiles/<id>.yaml` — different directory, different extension. Same shape as the table's five adjacent path defects, found while building 2.1, and outside the four this roadmap enumerated. |

## Acceptance criteria

- [x] Every capability in the seven-row table either has a probe that answers it,
  or a rule that states the answer is unavailable and what the agent should do
  instead. No row is left implying coverage it does not have.
  <!-- All seven rows covered. Rows 2-7 as before (council:status, packs:active,
  mcp:available, hooks:status, brand:status, plus the design-review rule's
  existing degradation disclosure). Row 1 — host subagent-spawn — closed by 1.2:
  `routing:doctor` answers it and states per field whether the answer is a
  committed observation, a live read, or no answer at all. -->

  **Row 1 was the row whose probe implied coverage it did not have, and the fix
  is the disclosure rather than a detection.** This repo cannot detect
  `subagent_spawn` on an arbitrary host — no such check exists — so the honest
  close is the one the rule for render capability already models: state what is
  known, name what is not, and never let an unanswered field read as a measured
  absence. `delegation-policy` now carries that instruction at the point the
  `false` would be misread.

- [x] No probe ships without at least one rule or command referencing it; a verb
  nobody points at counts as unshipped.
  <!-- Verified by count: packs:active 5 rules (the five pack floors that claim
  auto-activation), settings:get 8, mcp:available 1 (tool-safety, which is where
  the tool-registry-vs-MCP conflation lives), brand:status 1
  (brand-source-of-truth), hooks:status 7. The Risk-1 failure mode — "a probe is
  added and nothing points at it" — is the one this criterion exists to catch,
  and it was caught: packs:active and mcp:available had only the contract until
  this pass. -->

  **Where the pointer went is part of the fix.** `packs:active` is named in the
  five safety floors that say "auto-activates when pack X is installed" — the
  exact sentences that were unverifiable — and each now also names the degraded
  case in which the floor cannot activate at all. `mcp:available` is named in
  `tool-safety` beside the tool-registry allowlist, because the registry and the
  reachable MCP surface being the same thing is the belief that verb exists to
  break.
- [ ] The host-capability default is decided, and the template comment, the
  loader, and the reading rules agree — pinned by a test.
  <!-- OPEN on the first clause only, and deliberately. "Decided" is satisfied in
  substance (all-false, settings key removed, merged under
  road-to-always-on-orchestration Phase 1) but the closure of a maintainer-owned
  blocker stays a maintainer act — council 2/2, 2026-08-10. The rest of the
  criterion is met: template, loader, reading rules and the documents describing
  them agree, pinned by the parity block in
  tests/scripts/_lib_host_capability.test.ts. Flip this when the blocker's one
  scope question is answered. -->

  Left open **on purpose**, not by omission: an agent recording "already decided
  elsewhere" against a maintainer-owned blocker is exactly the inference by which
  an agent would make a consumer-visible change without making one visibly. The
  work is done; the signature is not the agent's to forge.

- [x] The ten rules naming `.agent-settings.yml` bare either carry the resolution
  chain or point at it.
  <!-- Verified mechanically after the edit: iterating every rule that names the
  file, zero lack a chain statement. The real count was 11, of which 3 already
  carried it (see 3.3). -->

- [x] The four adjacent path defects are fixed or each carries a stated reason for
  staying.
  <!-- All four fixed, none deferred. 4.1 loader cascade (3 writers vs 1 reader,
  fixed additively on the reader, pinned by a new test file). 4.2 onboarding-gate
  path (canonical before legacy, 4 new tests, missing-file carve-out left intact
  on purpose). 4.3 MERGEABLE_KEYS migration drift (ADR-219, additive, the
  exact-list pin updated with the ADR cited). 4.4 the sparse-file claim deleted
  rather than implemented, because implementing it would have contradicted the
  nine-key carve-out and changed behaviour on every install. -->

  Each also carries a stated non-goal: the migration-map-vs-whitelist drift gate
  (4.3), the `name` key removal (4.3), and the defaults layer itself (4.4) are
  named as not-built rather than left to be discovered.
