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

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 (all steps)
- **What to do:** decide what an empty `host_capabilities: {}` means. The
  template comment says "leave empty to let the agent resolve the manifest from
  host knowledge"; the loader coerces every absent field to `false`, i.e. *no
  capability*. Those are opposite semantics for the shipped default, and the
  difference decides whether the subagent-orchestration layer is on or off for
  every consumer. Options: make the empty case mean agent-resolved (behaviour
  change on every install), keep all-false and correct the comment plus every
  rule that reads the manifest, or add a third explicit state.
- **Resolved when:** the decision is recorded and the template comment, the
  loader, and the reading rules agree.

Not decided here on purpose: this changes what ships to a consumer, which is the
one class of change this repo does not let an agent make. Naming it is the whole
of Phase 1 until the decision lands.

## Phase 1 — The worst instance, once its semantics are decided

- [ ] 1.1 Apply the blocker's decision to the template comment, the loader, and
  every rule that reads the host-capability manifest, so the three agree.
- [ ] 1.2 Make the probe honest: it currently reports a settings-derived answer as
  though it were a detection. Either detect, or say the number came from settings
  and may not reflect the host.
- [ ] 1.3 A test that the shipped template and the loader agree about the empty
  case — the contradiction above is exactly what no test asserts today.

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

- [ ] 4.1 The one agent-reachable settings writer persists to a path the loader
  does not read. Worse, it writes into the directory the council config lives in,
  which is how a wrong mental model gets reinforced by a real file appearing in
  the wrong place.
- [ ] 4.2 The onboarding gate reads the legacy repo-root path and treats "file
  missing" as "do not block", so an Iron-Law gate never fires on a canonically
  installed consumer.
- [ ] 4.3 A whitelisted settings key does not match the template's real key name,
  so a user-global value is silently dropped.
- [ ] 4.4 The settings-classes contract asserts "a sparse file means absent =
  default"; the defaults map is empty, so no code implements it. Either implement
  it or delete the claim.

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
| A second profile resolver | `src/scripts/config/profiles.ts` resolves `<root>/profiles/<id>.yml` via `artefact_roots()`, while `src/cli/commands/profiles.ts` reads `src/profiles/<id>.yaml` — different directory, different extension. Same shape as the table's five adjacent path defects, found while building 2.1, and outside the four this roadmap enumerated. |

## Acceptance criteria

- [ ] Every capability in the seven-row table either has a probe that answers it,
  or a rule that states the answer is unavailable and what the agent should do
  instead. No row is left implying coverage it does not have.
- [ ] No probe ships without at least one rule or command referencing it; a verb
  nobody points at counts as unshipped.
- [ ] The host-capability default is decided, and the template comment, the
  loader, and the reading rules agree — pinned by a test.
- [ ] The ten rules naming `.agent-settings.yml` bare either carry the resolution
  chain or point at it.
- [ ] The four adjacent path defects are fixed or each carries a stated reason for
  staying.
