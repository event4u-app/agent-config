---
complexity: structural
execution:
  mode: phase-checkpoints
depends_on: road-to-delivery-for-every-host
estate_growth_exempt: "Owner-instructed, 2026-09-07. Successor of road-to-delivery-for-every-host Phase 1; every step here can only make a non-Claude host cheaper while keeping its rule bodies reachable, and each step is gated on an observation the tree does not yet hold. Charges +1 active roadmap."
estate_offset_exempt: "Offsets nothing. It retires the L4 'no equivalent today' row in docs/enforcement-by-host.md:176, which is a sentence, not a roadmap."
---

# Road to delivery on hook hosts

> **Source:** owner instruction 2026-09-07, verified against `6a98e0e` (v14.20.0). Owner ruling **E3** is decided in this file. Starts only after `road-to-delivery-for-every-host` Phase 1 has merged (host-scoped `lean_projection.hosts`).

## Goal

Every host other than Claude Code is measured for whether hook stdout on `user_prompt_submit` reaches the model's context; hosts where it does join `lean_projection.hosts` and pay the same standing tokens as Claude, hosts where it does not keep their full rule bodies and lose nothing, and Cursor and Windsurf stop carrying `auto` rules twice — witnessed by the per-host census from the predecessor's Phase 0, re-run after each phase.

## Prerequisites

- [ ] Predecessor Phase 1 merged (`lean_projection.hosts` exists, non-regression gate green).
- [ ] Read `docs/enforcement-by-host.md:18-44` (2026-09-07 host table), `src/scripts/hook_manifest.yaml:1266-1322` (per-host bindings), `src/scripts/hook_effect_doctor.ts` (the "is any of this taking effect" doctor).

## Context

The 2026-09-07 host table replaced "static only" with slot bindings: Cursor 5 slots, Cline 5, Gemini 5, Augment 5, Windsurf 3, Cowork 8, Copilot 0, Codex 0; only Claude Code honours a deny (`docs/enforcement-by-host.md:18-28`). Cursor (`beforeSubmitPrompt → user_prompt_submit`, `hook_manifest.yaml:1300,1407`) and Cline (`:1315,1416`) bind the slot the `rule-inject` concern needs — but the concern is not in their concern lists, and **whether those hosts add hook stdout to the model's context is unmeasured** (Cowork is measured to discard dispatcher output: `enforcement-by-host.md:20`). That is the one fact that decides whether a host can get delivery.

Cursor and Windsurf already have a native lazy form for `auto` rules: `_emit_cursor_mdc` writes `alwaysApply: false` plus globs from path triggers or an empty `globs:` (Agent-Requested via description) (`src/scripts/condense.ts:1293-1304`); `_emit_windsurf_rule` writes `trigger: model_decision` (`:1313-1325`). Only 5 of 119 rules carry path-shaped triggers; 491 keyword and 212 phrase triggers are invisible to those description-gated forms unless the description names them. Whether Cursor additionally loads the `.cursor/rules/*.md` symlink tree (double carry) is unmeasured.

**Owner ruling E3 (final):** the rule for admitting a host to `lean_projection.hosts` is one observed transcript in which a body delivered by `rule-inject` on `user_prompt_submit` is visibly acted on by the model in that host. Documentation of the host's hook API is not admission. Cowork is excluded by the existing measurement.

## Phase 1: Measure context injection per host

- [ ] **1.1 Add an `injection_effect` dimension to `hook_effect_doctor.ts`:** with `rule-inject` gate-open on the doctor's own probe rule, does the model's next turn reflect the delivered body? Record `observed-true | observed-false | unobserved` per host under the host-capability observation protocol (`_lib/host_capability.ts`), with a transcript pointer.
      verify: doctor output shows the dimension for the current host; a run on Claude Code records `observed-true` with a transcript.
- [ ] **1.2 Run 1.1 on Cursor and Cline** (the two hosts binding `user_prompt_submit` with a `.md` rule tree). Record Windsurf, Gemini, Augment as `unobserved` unless a session exists.
      verify: the census artefact carries one line per host; no `observed-*` value without a transcript pointer.
- [ ] **1.3 Resolve Cursor double carry by observation:** does Cursor load `.cursor/rules/*.md` alongside `*.mdc`?
      verify: census line `cursor.md_tree_loaded: observed-true | observed-false | unobserved` with pointer.

## Phase 2: Admit hosts that pass (E3)

- [ ] **2.1 For each host with `injection_effect: observed-true`:** add `rule-inject` to that host's `user_prompt_submit` and `pre_compact` concern lists in `hook_manifest.yaml`, add the host to the default `lean_projection.hosts`, and extend the predecessor's non-regression fixture so the host's stubs plus deliveries are byte-equal to the eager body on the routing corpus.
      verify: `model_rule_injection --endpoints` passes on the host's binding; census shows the host's rules bucket ≤ 20,000 tok.
- [ ] **2.2 For each host `observed-false` or `unobserved`:** nothing changes in projection; write the result into the host table with an expiry per the table's own discipline (`archive/road-to-host-enforcement-truth.md`).
      verify: the host's rule tree is byte-identical to `eager-all` (predecessor 1.4 gate green).

## Phase 3: Native lazy forms get the triggers they need

- [ ] **3.1 Lower keyword/phrase triggers into the Cursor and Windsurf description field.** Append `Applies when: <up to N trigger terms>` to the emitted description in `_emit_cursor_mdc` and `_emit_windsurf_rule`, capped by the host's description length; measure by string match on the routing corpus — no LLM judge.
      verify: for 102 `auto` rules the emitted description contains ≥ 1 of the rule's own triggers; string-match recall over corpus positives ≥ pre-change.
- [ ] **3.2 If 1.3 observed double carry:** make `.cursor/rules` mdc-only for `auto` rules; `always` and `manual` keep the `.md` body. Otherwise skip and say so.
      verify: census shows Cursor standing bytes down by at least the removed bodies; every `auto` rule present exactly once.

## Phase 4: Truth surfaces

- [ ] **4.1 Replace the L4 row** at `docs/enforcement-by-host.md:176` with per-host facts (Claude: hook delivery; admitted hosts: hook delivery; Cursor/Windsurf: description-gated native form; Cline/Copilot/Gemini/Augment/Codex: full corpus), each cell citing the emitter or binding `file:line`, with expiry.
      verify: `grep -c 'no equivalent today' docs/enforcement-by-host.md` returns 0.
- [ ] **4.2 One sentence** in the same file and in the predecessor's ADR: hosts without a measured injection path receive the full corpus; this is the cost of the host, not a defect.
      verify: sentence present; predecessor 1.4 gate green.

## Acceptance Criteria

- [ ] Every host has an `injection_effect` line with provenance in the census.
- [ ] Every admitted host measures rules ≤ 20,000 tok; every other host is byte-identical to `eager-all`.
- [ ] 102/102 `auto` rules carry ≥ 1 trigger term in their Cursor/Windsurf descriptions.
- [ ] L4 row replaced; all quality gates green.

## Kill register

- **K1** Admitting a host from documentation or by analogy to Claude.
- **K2** Any LLM-judged recall measurement (string match on the frozen corpus only).
- **K3** Thinning a host that is `observed-false`/`unobserved`.
- **K4** Removing `.cursor/rules/*.md` bodies before 1.3 observed double carry.
- **K5** New CLI verb; a daemon; a retriever.
- **K6** Moving this file to `later/` or descoping to a carrier. Unobserved hosts are recorded as unobserved and the file stays active with those lines `[ ]` and the observation protocol named.
