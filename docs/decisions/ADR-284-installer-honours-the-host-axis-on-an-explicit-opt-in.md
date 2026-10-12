---
adr: 284
status: accepted
date: 2026-10-12
decision: installer-honours-the-host-axis-on-an-explicit-opt-in
supersedes: ADR-228
supersedes_scope: >-
  Only ADR-228's verbatim-copy limb — "the global install continues to copy
  `dist/agent-src/rules` verbatim" — and only for a host inside
  `lean_projection.hosts` on an install whose consumer-controlled layer sets
  `mode: delivery`. The `paths:` limb of the same sentence is NOT superseded and
  is named in `## Not reopened`.
superseded_by: —
phase: road-to-an-installed-layer-that-is-thinned · Phase 3
type: structural
reopen_policy: unclassified
protected_dimensions: [none]
review_trigger: >-
  Reopened by evidence that the installed stub form loses a rule body a consumer
  relies on — a rule whose law section is absent from the installed stub while
  `src/config/rule-consequence-class.json` lists it, a stub whose body pointer
  does not resolve from the installed layer it was written into, or an arrival
  record under `agents/evidence/analysis/installed-arrival-*.md` showing a
  thinned rule that never reached a session that matched it. Also reopened if
  `check_host_tree_parity` stops exiting 0, which would mean the host axis is no
  longer honoured at one of its two writers. Not reopened by the size of the
  saving in either direction, and not by the default staying opt-in: that is a
  separate owner-reserved decision this record deliberately does not take.
provenance:
  kind: agentic
  decision_makers: [agent]
  human_directed: true
  agentic_mode: single
evidence:
  strength: E2
  basis:
    - agents/evidence/analysis/installed-layer-ceiling-measurement-2026-10-06.md
    - agents/evidence/analysis/thinned-layer-composition-2026-10.md
    - tests/scripts/install_thin_layer.test.ts
    - src/scripts/install.ts
    - src/scripts/_lib/lean_projection_mode.ts
    - src/scripts/_lib/agent_settings.ts
    - src/scripts/check_host_tree_parity.ts
    - docs/decisions/ADR-267-delivery-default-for-claude-code.md
    - docs/decisions/ADR-228-global-install-does-not-emit-paths.md
---

# ADR-284 — The installer honours the host axis, on an explicit opt-in only

## Status

**Accepted** · 2026-10-12. Records step 3.3 of
`road-to-an-installed-layer-that-is-thinned`, whose Phase 1 shipped the
behaviour this record describes. It performs a **scoped** supersession of
ADR-228 and **changes no default**: the default flip is a separate decision,
reserved to the owner, and is deliberately absent from this record.

## Context

ADR-267 decision 2 made `lean_projection.hosts` a real axis rather than a
comment, and ADR-267 decision 5 bound that axis to a completeness invariant:
every rule file is written for every host, every body is delivered on match, a
stub is a form and not a subset. Both statements were about the **projector** —
`condense.ts`, the maintainer tree a consumer never receives.

The layer a consumer actually gets was not covered. Reproduced 2026-10-01: the
global install step copied `dist/agent-src/rules` verbatim and rewrote
frontmatter only (`src/scripts/install.ts`), and `grep -c lean_projection
src/scripts/install.ts` returned 0. A real install into an empty `HOME` wrote
**102 unconditional files and 338,225 characters**, against the 150,000 the host
publishes for itself — 2.25 times its own limit, which is why the subject
arrived as an inbox round rather than as a measurement somebody went looking
for.

So the axis was honoured at one of its two writers. The gap was never decided;
it was simply not noticed, because ADR-267 was written about the tree the
maintainer can see.

Three facts constrain the repair:

1. **The shipped template already says `delivery`.**
   `src/config/agent-settings.template.yml` carries
   `lean_projection.mode: delivery` with `hosts: [claude-code]`, per ADR-267
   decision 1. An installer that simply read the resolved mode would therefore
   thin **every consumer** the moment the resolver was fixed — a default flip
   arriving as a side effect of a bug fix, decided by nobody.
2. **A global-only install has no project layer.** Under ADR-020 the only layer
   that can carry a consumer's own answer is the user-global one, and
   `lean_projection.*` was absent from `MERGEABLE_KEYS`, so
   `load_agent_settings` read that layer and discarded the value. The opt-in was
   unsatisfiable on exactly the install shape it is about.
3. **ADR-228's title is already contradicted by shipped code**, recorded in that
   record's own successor note of 2026-10-02: `renderClaudeRule`
   (`src/install/claudeRuleRewrite.ts:213`, emitting branch `:221-226`) writes a
   `paths:` block for every rule whose plan yields globs, and the anchor on a
   consumer install is the global `~/.claude`. That note states the repair
   "belongs to that file's Phase 1 or to a successor ADR — not here", and names
   two candidate owners for two different limbs of one sentence.

## Decision

1. **The host axis of ADR-267 decision 2 extends from the projector to the
   installer.** The global install step writes the stub form for a host inside
   `lean_projection.hosts`; a host outside that list receives exactly what
   `eager-all` writes. `check_host_tree_parity` asserts the second half
   byte-for-byte in CI and is unchanged by this record.
2. **The template value is not a consent.** The installer thins only when
   `lean_projection.mode: delivery` is set on a layer the **consumer controls** —
   user-global or project — and never when the only layer carrying it is the
   shipped template. This is the roadmap's decision D3, recorded here because a
   decision that lives only in a roadmap disappears when the roadmap archives.
3. **The user-global layer is where the opt-in lives.** `lean_projection.*` is a
   mergeable key for that reason, and not as a convenience: on a global-only
   install it is the only layer that can carry the answer at all.
4. **Rollback stays one setting.** ADR-267 decision 3 is untouched:
   `lean_projection.mode: eager-all` plus a reinstall writes today's full layer
   again, asserted by the `rollback` cases of
   `tests/scripts/install_thin_layer.test.ts`.
5. **The completeness invariant holds at the installer too.** ADR-267 decision 5
   is not weakened: every rule file is written, every body is delivered on match,
   and a rule in the consequence class carries its law **standing** inside the
   stub, byte-equal to its source section. A stub's body pointer is absolute, so
   it resolves from the installed layer it was written into — the shipped
   project-relative prefix resolved from `~/.claude/rules` never, not merely
   imprecisely.
6. **No default changes here.** Whether the thinned layer becomes the default is
   decision D4/D5 of the roadmap and is reserved to the owner. The owner answered
   (a) on 2026-10-06 under a condition — an arrival record for the current host
   version — which is **not met** as of this date, and whose instrument the same
   owner cancelled elsewhere on the same day. This record states that condition
   rather than discharging it.

## Scope of the supersession of ADR-228

ADR-228's operative sentence carries two limbs:

> The global install continues to copy `dist/agent-src/rules` verbatim **and**
> does not emit `paths:`.

**Limb 1 — "copies verbatim" — is superseded by this record**, and only under the
conditions of decision 2 above. It was an unconditional statement about the
installer; it is now conditional, because an opted-in install for a host on the
axis writes the stub form instead of a verbatim copy. A reader citing ADR-228 for
what the installer does to the rule bodies would have been wrong since Phase 1 of
`road-to-an-installed-layer-that-is-thinned` merged, and `superseded_by: —` gave
them no reason to check. That is the specific failure a scoped supersession
exists to repair.

ADR-228 keeps `status: accepted`. A partial supersession narrows a record; it
does not retire one, and the limb that still stands is the one the record is
titled after.

## Not reopened

- **ADR-228's `paths:` limb.** Whether the global install should emit `paths:`,
  and whether the 24 scope disagreements stay as over-delivery, is untouched
  here. Its correctness objection — that path-scoping a safety-floor or Iron-Law
  rule makes the obligation stop applying after `/compact` — is not weighed,
  weakened, or answered by this record. Its repair belongs to
  `road-to-a-rule-carrier-that-works-outside-the-repo`, which that record's own
  successor note already names.
- **ADR-267 decisions 1, 3, 4 and 5.** The shipped template value, the one-setting
  rollback, the `eager-all` code fallback that keeps an unparseable settings file
  from thinning anything, and the completeness invariant all stand exactly as
  written. This record extends decision 2's reach and reads the other four
  unchanged. ADR-267 carries `reopen_policy: owner`, and nothing here is a
  transition that policy reserves: extending an axis to a second writer that
  already honours the same predicate adds no permission and removes no floor.
- **The default.** Owner-reserved, unmet condition, named in decision 6 and not
  taken.
- **ADR-020's global-only install shape.** Decision 3 describes where the opt-in
  can live under that shape; it does not revisit the shape.

## Consequences

- A consumer who sets nothing gets today's full layer. Nothing changes for them,
  which is the point of decision 2 and the reason this record can be accepted
  without an arrival record.
- A consumer who opts in gets the stub form, measured at **111,197 characters**
  on 2026-10-06 against the 75,000 the roadmap's D2 targets — an improvement over
  338,225 and still over the target. That gap is step 3.2's subject, not this
  record's: 89 stubs account for 52,925 characters and 16 rules the predicate
  keeps full-bodied account for 58,272.
- An upgrade from a pre-opt-in `HOME` converges to the thinned layer; a
  user-modified rule file is preserved and reported rather than overwritten.
- The receipt reports package-owned and foreign instruction characters against
  the host's published limit and warns at 80 % of it, so a consumer sees the
  combined total rather than only our half of it.
- ADR-228 gains a `superseded_by` a reader can follow. It had none, and the
  contradiction its 2026-10-02 note recorded was reachable only by reading that
  record to the end.

## Alternatives

1. **Read the resolved mode, template included.** Rejected: the template already
   says `delivery`, so this flips every consumer as a side effect of a resolver
   fix. A default change that nobody decided is the worst version of a default
   change, because there is no record to reopen.
2. **Thin unconditionally for `claude-code`.** Rejected for the same reason plus
   one more: the owner's answer on the default is conditional on records that do
   not exist, and shipping the flip would make that condition retroactively
   meaningless.
3. **Leave the installer alone and fix only the projector's reach.** Rejected: the
   projector's output is the maintainer tree. The 338,225 characters are in the
   consumer's `~/.claude/rules`, and no amount of thinning a tree consumers do not
   receive moves that number.
4. **Supersede ADR-228 wholesale.** Rejected: its `paths:` limb rests on a
   correctness objection about compaction that this work neither tested nor
   addressed, and another roadmap owns it. Retiring a record to tidy a reference
   is how a live objection disappears without being answered.

## Evidence

`strength: E2` — repeated and comparative rather than a single observation, and
the grade is a measurement of the sources, not a claim of confidence.

- **Two independent measurements of the same install, in the same unit.**
  `agents/evidence/analysis/installed-layer-ceiling-measurement-2026-10-06.md`
  and `agents/evidence/analysis/thinned-layer-composition-2026-10.md` both read
  111,197 characters / 105 files for a real opt-in install into a fresh `HOME`,
  arrived at by different paths (install receipt vs `buildInstalledLayerReport`)
  and reconciled against a third reader (`project_thin_rules --measure`) whose
  different corpus is stated rather than averaged in. Both carry a reproduce
  block.
- **A bounded two-direction test of decision 2.** The `template-is-not-consent`
  block of `tests/scripts/install_thin_layer.test.ts` asserts seven cases in both
  directions: no thinning when only the shipped template carries the mode;
  thinning when a user-controlled layer sets it; no thinning on an explicit
  `eager-all`; no thinning for a host outside the list; a project layer ignored in
  both directions; the shape `install.ts` actually calls, from a cwd that
  disagrees; and an explicitly pinned `settingsPath` still honoured. A gate that
  only refuses is a gate whose sensitivity is unknown.
- **Tree constraints, verifiable in a clone.** `installerThinsHost` is called at
  `src/scripts/install.ts:3018`; `lean_projection.*` is in `MERGEABLE_KEYS` in
  `src/scripts/_lib/agent_settings.ts`; `check_host_tree_parity` exits 0 with "2
  non-delivery host tree(s) byte-identical to eager-all", re-run 2026-10-12.
- **What the evidence does NOT establish**, stated because the gap is the reason
  decision 6 exists: there is no record of what an opted-in install **loads** in a
  real session. `agents/evidence/analysis/installed-arrival-*.md` matches nothing,
  and `check_standing_rule_delivery.ts` labels its own reading a filesystem
  projection because the `InstructionsLoaded` event is "a host feature this suite
  does not yet bind". Every claim here is about what is **written**, not about
  what arrives. Reading one as the other is the substitution this record refuses
  to make.

## References

- `docs/decisions/ADR-267-delivery-default-for-claude-code.md` — decisions 2 and
  5, extended and preserved respectively.
- `docs/decisions/ADR-228-global-install-does-not-emit-paths.md` — scoped
  supersession, limb 1 only.
- `docs/decisions/ADR-020-*` — the global-only install shape decision 3 rests on.
- `agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md` — Phase 1,
  step 3.3, and decisions D2, D3, D4, D5.
- `src/scripts/_lib/lean_projection_mode.ts` — `installerThinsHost`, the
  predicate, and the `eager-all` fail-safe constant.
- `tests/scripts/install_thin_layer.test.ts` — the behaviour this record
  describes, in both directions.
