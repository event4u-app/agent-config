---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
depends: road-to-delivery-for-every-host
depends_on: road-to-delivery-for-every-host
relates:
  - slug: road-to-delivery-for-every-host
    relation: depends
    note: >
      Predecessor. This file may not start before that one's Phase 1 has merged,
      because admitting a host means adding it to an axis that does not exist yet.
  - slug: road-to-host-enforcement-truth
    relation: extends
    note: >
      Archived. Its 2026-09-07 host table is the input to Phase 1; this file turns
      that table's slot counts into a measured injection verdict per host.
estate_growth_exempt: "Owner-instructed 2026-09-07. Charges +1 active roadmap against the origin/main `active_roadmaps` floor of 4 measured at 0918def55 — the floor is the base-ref measurement, not a stored number (ADR-243). Successor of road-to-delivery-for-every-host Phase 1; every step here can only make a non-Claude host cheaper while keeping its rule bodies reachable, and each step is gated on an observation the tree does not yet hold."
estate_offset_exempt: "Offsets nothing. It retires the L4 'no equivalent today' row at docs/enforcement-by-host.md:176, which is a sentence rather than a roadmap, so there is no archive move available to satisfy the one-in-one-out half in this change."
---

# Road to delivery on hook hosts

> **Source.** Owner instruction 2026-09-07 out of analysis round `inbox-2026-09-u`,
> consumed to `agents/tmp.old/inbox-2026-09-u/`. Re-measured at `0918def55` (v14.20.0)
> before authoring; corrections forced by that re-measurement carry
> `corrected-from-reproduction`. Owner ruling **E3** is decided in this file. Starts only
> after `road-to-delivery-for-every-host` Phase 1 has merged (host-scoped
> `lean_projection.hosts`).

## Goal

Every host other than Claude Code is measured for whether hook stdout on
`user_prompt_submit` reaches the model's context; hosts where it does join
`lean_projection.hosts` and pay the same standing tokens as Claude; hosts where it does not
keep their full rule bodies and lose nothing; and Cursor and Windsurf stop carrying `auto`
rules twice — witnessed by the per-host census from the predecessor's Phase 0, re-run after
each phase.

## Prerequisites

- [ ] Predecessor Phase 1 merged (`lean_projection.hosts` exists, non-regression gate
      green).
- [ ] Read `docs/enforcement-by-host.md:18-28` (2026-09-07 host table),
      `src/scripts/hook_manifest.yaml:1266-1322` (per-host bindings),
      `src/scripts/hook_effect_doctor.ts` (the "is any of this taking effect" doctor), and
      `src/scripts/_lib/host_capability.ts:168,183` (the committed registry and its
      observation protocol).
- [ ] Run `agent-config roadmap:context --roadmap road-to-delivery-on-hook-hosts` and record
      the probe's `scanned:` line against the `relates:` block above.

## Context

The 2026-09-07 host table replaced "static only" with slot bindings: Claude Code (plugin) 9
and the only host that refuses on a deny; Cowork 8; Augment 5; Cursor 5; Cline 5; Gemini 5;
Windsurf 3; Copilot 0 (`fallback_only`); Codex 0, no platform key
(`docs/enforcement-by-host.md:18-28`, the table's own correction note at `:21-23`).

Cursor (`beforeSubmitPrompt → user_prompt_submit`, `src/scripts/hook_manifest.yaml:1300`,
alias at `:1407`) and Cline (`:1315`) bind the slot the `rule-inject` concern needs — but the
concern is **not** in either host's list, which reads
`[chat-history, verify-before-complete, minimal-safe-diff, language-mirror,
git-authorization, session-canary, self-repair, session-register]` for both. And **whether
those hosts add hook stdout to the model's context is unmeasured**; Cowork is measured to
discard dispatcher output and `exit 0` (`docs/enforcement-by-host.md:21` —
`corrected-from-reproduction`: the draft cited `:20`). That is the one fact that decides
whether a host can get delivery.

Cursor and Windsurf already have a native lazy form for `auto` rules: `_emit_cursor_mdc`
writes `alwaysApply: false` plus globs (`src/scripts/condense.ts:1293,1304`) and
`_emit_windsurf_rule` writes `trigger: model_decision` when a rule has neither
`always_apply` nor globs (`:1313,1323`).

**How large the description-gated gap actually is — `corrected-from-reproduction`.** The
draft said "only 5 of 119 rules carry path-shaped triggers". Re-derived over
`dist/agent-src/rules/*.md` frontmatter: **21 of 119** carry a path-shaped trigger — 41
`path_prefix` entries plus 13 `file_pattern` entries across those 21 files — alongside 491
keyword and 212 phrase triggers (both exact as drafted) and 7 `command` triggers. No reading
yields 5: zero rules carry a host-native top-level `paths:` key. The gap is therefore
**98 of 119 rules**, not 114 — smaller than the draft argued and still the majority of the
corpus, so Phase 3 survives on a corrected number rather than on the one that was written
down. A step sized against 114 would have over-claimed its own win by 16 rules.

Whether Cursor additionally loads the `.cursor/rules/*.md` symlink tree alongside `*.mdc`
(double carry) is unmeasured.

**Owner ruling E3 (final):** the rule for admitting a host to `lean_projection.hosts` is one
observed transcript in which a body delivered by `rule-inject` on `user_prompt_submit` is
visibly acted on by the model in that host. Documentation of the host's hook API is not
admission. Cowork is excluded by the existing measurement.

## Phase 1: Measure context injection per host

- [ ] **1.1 Add an `injection_effect` dimension to `src/scripts/hook_effect_doctor.ts`:**
      with `rule-inject` gate-open on the doctor's own probe rule, does the model's next turn
      reflect the delivered body? Record `observed-true | observed-false | unobserved` per
      host under the host-capability observation protocol
      (`src/scripts/_lib/host_capability.ts:183`), with a transcript pointer.
      verify: doctor output shows the dimension for the current host; a run on Claude Code
      records `observed-true` with a transcript.
- [ ] **1.2 Run 1.1 on Cursor and Cline** (the two hosts binding `user_prompt_submit` with a
      `.md` rule tree). Record Windsurf, Gemini and Augment as `unobserved` unless a session
      exists.
      verify: the census artefact carries one line per host; no `observed-*` value without a
      transcript pointer.
- [ ] **1.3 Resolve Cursor double carry by observation:** does Cursor load
      `.cursor/rules/*.md` alongside `*.mdc`?
      verify: census line `cursor.md_tree_loaded: observed-true | observed-false |
      unobserved` with a pointer.

## Phase 2: Admit hosts that pass (E3)

- [ ] **2.1 For each host with `injection_effect: observed-true`:** add `rule-inject` to
      that host's `user_prompt_submit` and `pre_compact` concern lists in
      `hook_manifest.yaml`, add the host to the default `lean_projection.hosts`, and extend
      the predecessor's non-regression fixture so the host's stubs plus deliveries are
      byte-equal to the eager body on the routing corpus.
      verify: `./scripts-run src/scripts/model_rule_injection --endpoints` passes on the
      host's binding; census shows the host's rules bucket ≤ 20,000 tok.
- [ ] **2.2 For each host `observed-false` or `unobserved`:** nothing changes in projection;
      write the result into the host table with an expiry per the table's own discipline.
      verify: the host's rule tree is byte-identical to `eager-all` (predecessor 1.4 gate
      green).

## Phase 3: Native lazy forms get the triggers they need

- [ ] **3.1 Lower keyword and phrase triggers into the Cursor and Windsurf description
      field.** Append `Applies when: <up to N trigger terms>` to the emitted description in
      `_emit_cursor_mdc` and `_emit_windsurf_rule`, capped by the host's description length;
      measure by string match on the routing corpus — no LLM judge. The population is the
      **98 of 119** rules with no path-shaped trigger (21 already carry one); state that
      number in the commit so the win is not re-derived from the draft's 114.
      verify: for 102 `auto` rules the emitted description contains ≥ 1 of the rule's own
      triggers; string-match recall over corpus positives ≥ pre-change.
- [ ] **3.2 If 1.3 observed double carry:** make `.cursor/rules` mdc-only for `auto` rules;
      `always` and `manual` keep the `.md` body. Otherwise skip and say so.
      verify: census shows Cursor standing bytes down by at least the removed bodies; every
      `auto` rule present exactly once.

## Phase 4: Truth surfaces

- [ ] **4.1 Replace the L4 row** at `docs/enforcement-by-host.md:176` with per-host facts
      (Claude: hook delivery; admitted hosts: hook delivery; Cursor/Windsurf:
      description-gated native form; Cline/Copilot/Gemini/Augment/Codex: full corpus), each
      cell citing the emitter or binding `file:line`, with an expiry.
      verify: `grep -c 'no equivalent today' docs/enforcement-by-host.md` returns 0.
- [ ] **4.2 One sentence** in the same file and in the predecessor's ADR: hosts without a
      measured injection path receive the full corpus; this is the cost of the host, not a
      defect.
      verify: sentence present; predecessor 1.4 gate green.

## Kill register

- **K1** Admitting a host from documentation or by analogy to Claude.
- **K2** Any LLM-judged recall measurement — string match on the frozen corpus only.
- **K3** Thinning a host that is `observed-false` or `unobserved`.
- **K4** Removing `.cursor/rules/*.md` bodies before 1.3 observed double carry.
- **K5** New top-level CLI verb; a daemon; a retriever.
- **K6** Moving this file to `later/` or descoping to a carrier. Unobserved hosts are
  recorded as unobserved and the file stays active with those lines `[ ]` and the observation
  protocol named.

## Provenance

- **Source:** an owner-directed external LLM ideation round, consumed to
  `agents/tmp.old/inbox-2026-09-u/`. No third-party repository, product or vendor is a
  source of this plan; the host names are this package's own delivery targets.
- **Gap table:** `KEEP` — the host table's slot counts (all nine verified), the Cursor and
  Cline `user_prompt_submit` bindings, `rule-inject`'s absence from both concern lists, the
  two native lazy emitters, the keyword (491) and phrase (212) trigger totals, and E3's
  admission rule. `KEEP, corrected` — the path-shaped trigger count (21 of 119, not 5, so
  the addressable population is 98 rather than 114) and the Cowork row's line
  (`enforcement-by-host.md:21`, not `:20`). `CUT` — nothing; every drafted step survived,
  two on corrected numbers.
- **Council:** none. E3 is an owner ruling.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | A host is admitted on a plausible reading rather than an observation | product | Cursor and Cline bind the right slot, which makes "it must work" the cheapest conclusion available. Cowork binds eight slots and discards dispatcher output — the same shape, measured false. Admitting on the binding would thin a host whose rules then reach nobody. | E3 requires one observed transcript in which the model visibly acts on a delivered body, K1 forbids admission by documentation or analogy, and 1.2 refuses to write an `observed-*` value without a transcript pointer | Phase 2: Admit hosts that pass (E3) |
| 2 | The census fills with `unobserved` and the file reads as stalled | implementation | Most hosts cannot be observed from a Claude session, so several lines will stay open for a long time and a reader may treat the roadmap as abandoned. | K6 makes `unobserved` an outcome rather than a deferral: the line stays `[]`, the file stays active, and 2.2 keeps the host's tree byte-identical to `eager-all` in the meantime so nothing is lost while it waits | Phase 1: Measure context injection per host |
| 3 | Description-lowering leaks trigger terms into a user-visible field | product | The emitted description is the host's routing surface and a reader's first line about the rule. Appending up to N raw trigger terms can turn a sentence into a keyword list. | 3.1 caps by the host's own description length and measures recall by string match on the frozen corpus, so a change that reads worse and routes no better is visible before it lands | Phase 3: Native lazy forms get the triggers they need |
| 4 | The corrected 98-rule population is itself re-derived wrongly later | implementation | The draft's 5 became 21 on one re-measurement. A later run summing only `path_prefix` or only `file_pattern` lands on a third number and re-scopes Phase 3 silently. | The Context states the derivation (41 `path_prefix` + 13 `file_pattern` across 21 files) and 3.1 requires the population figure in the commit message, so a divergent count is a visible contradiction rather than a quiet re-scope | Phase 3: Native lazy forms get the triggers they need |

## Acceptance Criteria

- [ ] Every host has an `injection_effect` line with provenance in the census.
- [ ] Every admitted host measures rules ≤ 20,000 tok; every other host is byte-identical to
      `eager-all`.
- [ ] 102/102 `auto` rules carry ≥ 1 trigger term in their Cursor and Windsurf descriptions.
- [ ] L4 row replaced; all quality gates green.
