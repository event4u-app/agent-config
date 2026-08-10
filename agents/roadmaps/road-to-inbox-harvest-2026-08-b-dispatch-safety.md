---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to inbox harvest 2026-08-b — dispatch safety

> Close four checkable gaps on the dispatch surface: a scoped `Bash(<prefix>:*)` grant
> becomes expressible and the one shipped subagent stops holding a full shell; a staged
> irreversible action gets a registry-level confirmation flag with exactly-once
> execution; the handoff envelope gains two validated fields plus one shape lint; and
> self-repair complaint creation gains a per-source rate cap. Zero new rules, zero new
> skills.

> Source (consumed inbox): `agents/tmp.old/ac-host-flag-compilation`,
> `agents/tmp.old/ac-orchestration-deltas`, `agents/tmp.old/better-handoff.txt`,
> `agents/tmp.old/ac-role-catalog`, `agents/tmp.old/ac-factory-mechanics` — part of the
> 2026-08-10 batch triaged by
> [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

**The tool grant is a build-time schema question, not a hook question.** The bundles
proposed a PreToolUse layer for per-agent tool scope; that layering is inverted.
`src/scripts/schemas/subagent.schema.json:46-55` enum-validates `tools` at build time
and `src/scripts/condense.ts:2045-2060` projects `{name, description, tools, model}`
verbatim into `.claude/agents/<name>.md`, so the host already enforces it. What is
broken is the enum — line 52 admits only the bare token `Bash`, making
`Bash(npm run:*)` inexpressible, while `src/rules/tool-safety.md:40` prescribes the
opposite ("Prefer scoped-grant syntax over bare tool names"). The one shipped subagent
therefore holds a shell: `.claude/agents/production-validator.md:4` reads
`tools: Read, Grep, Glob, Bash`. Precedent for both halves sits in the sibling schema —
`skill.schema.json:211-217` carries the scoped-grant guidance, `:218-224` carries
`disallowed_tools`. **The rule needs no edit**; ADR-109 gets an amendment note, not a
new record. And the detector that would catch this cannot see the file:
`src/scripts/lint_skill_frontmatter_safety.ts:39` carries a `_BARE_BASH` regex and
reports a bare grant as HIGH (`:220`), but its roots at `:261` are `src/skills`,
`src/agent-src`, `src/domains` — `src/subagents` is absent — and the key it reads is
`allowed_tools` / `allowed-tools` (`:48`, `:201`), not the subagent `tools:` key.

**The confirmation policy is complete; only the mechanism is missing.**
`src/rules/non-destructive-by-default.md` already states "Never act while asking", the
strictly-sequential ordering, and that the approval names the exact object.
`requires_confirmation` returns **0 hits** across `src/` and `docs/`, and no
exactly-once machinery exists. Extendable precedents: the `ask` / `ask_timeout` path in
`src/agent-src/templates/scripts/work_engine/hooks/builtin/decision_gate.ts:100-109`,
and `skill.schema.json:218` as the registry-flag shape. Host coverage bounds any guard:
`src/scripts/hook_manifest.yaml` binds `pre_tool_use` on 3 of 8 platform rows — augment
`:531`, claude `:539`, cowork `:578`; `agent-config hooks:status` is the per-install
check.

**The handoff test is presence, not effect.**
`agents/roadmaps/archive/road-to-cost-parity-3-handoff-envelope.md:229-231` (blocker
`handoff-content-adjudication`, resolved 2026-08-10): "A field whose presence is
checkable survives where a doctrine whose effect is unmeasured did not, and that is the
whole distinction." Against that bar: `do_not_touch` returns 0 hits in `src/`, nearest
is `constraints?` at `src/scripts/_lib/subagent_capsule.ts:238`; and while
`reversibility` appears 36 times in `src/` as prose, it appears **0 times** across the
four handoff surfaces (`_lib/subagent_capsule.ts`, `_cli/handoff_generate.ts`,
`_lib/envelope_grounding.ts`, `lint_handoffs.ts`) — the gap is field-absence, not
word-absence. `lint_handoffs.ts:342-360` validates required *headings* only.

**The turn-end primitive already ships, default OFF** —
`turn_end_gate_hook.ts:107` declares `DetectorId = 'promissory' | 'language'`,
`hook_manifest.yaml:445-449` carries `fail_closed: false`, and
`src/config/agent-settings.template.yml:1216-1219` keeps the master switch
`enabled: false` with both detectors on inside it, so the mechanism soaks before it
binds. Only a third detector is missing, and the soak stays.

## Phase 1 — Scoped tool grants

- [x] **1.1 Widen the subagent `tools` enum to admit a scoped grant.** Shipped as
      a `pattern` that keeps the base name closed — a typo still fails CI — while
      admitting an optional `(...)` suffix. Two pointer corrections worth
      recording: the field is `tools`, and `skill.schema.json`'s `allowed_tools`
      does **not** already model the syntax with a pattern — it permits it by
      validating nothing, which is a weaker thing and not a template to copy.
      The `curl` assertion still holds, but the test asserting it had pinned
      `rule === 'enum'` — the keyword rather than the subject — so it reddened
      on behaviour that had not changed. Rewritten keyword-agnostically and
      widened with the cases nothing covered: a scoped grant accepted,
      `Frobnicate(anything:*)` rejected, four malformed scopes rejected.
      <!-- verify: task test -- --filter=subagent_contract -->
- [ ] **1.2 Narrow `production-validator` to the prefixes it needs.** Edit
      `src/subagents/production-validator.md` so the shell grant becomes the command
      families the audit runs, then regenerate so
      `.claude/agents/production-validator.md:4` no longer carries a bare `Bash`.
      **Left OPEN deliberately, with the finding that argues against it.** 1.1
      made the narrowing expressible, which is all this step depended on. But the
      validator's own procedure step 3 is "find evidence the real path executed"
      — against whatever dependency and whatever runner the *consumer* project
      uses. A portable suite cannot enumerate those command families, and a scope
      that guesses wrong makes the validator report a missing run it was merely
      forbidden to attempt: the worst failure available to a gate whose output is
      a READY line. What shipped instead is the reason, written into the
      frontmatter so the bare `Bash` no longer reads as an oversight. Closing
      this needs a call on which is worse — an over-broad grant on a read-only
      auditor, or an auditor that cannot run the project's own tests. Maintainer
      decision, not an agent edit.
      <!-- verify: grep -n 'tools:' .claude/agents/production-validator.md -->
- [ ] **1.3 Extend the existing safety linter to the subagent corpus and key.** Add
      `src/subagents` to the roots at `lint_skill_frontmatter_safety.ts:261` and teach
      `_scan` the subagent `tools:` key so the `_BARE_BASH` finding at `:220` reaches it.
      The false-positive class is empty by construction: the key can only hold values
      the 1.1 schema admits, and a bare `Bash` is what `tool-safety.md:40` names as
      over-broad.
      <!-- verify: ./scripts-run src/scripts/lint_skill_frontmatter_safety -->
- [ ] **1.4 Record the contract change as an ADR-109 amendment note** — one paragraph in
      `docs/decisions/ADR-109-subagent-v1-contract.md` stating that the enum now admits
      scoped grants and why that is additive. Doc-only.
- [-] **1.5 Host-flag compiler (`--allowedTools` / `--max-turns` / `--model`) and an
      NDJSON `stream-json` driver — cancelled, no call site.**
      `src/scripts/_lib/subagent_spawn.ts:1-12` is declared "Pure, no-I/O" brief
      composition and the host spawns; the only `claude` subprocess is the council text
      client (`src/scripts/ai_council/clients.ts:1416,1447`,
      `--print --output-format json`, non-streaming). `stream-json`: 0 hits in `src/`.
- [-] **1.6 Spawn-env allowlist — cancelled, contradicts an accepted record.**
      `docs/decisions/ADR-123-runtime-security-scope-and-spawn-hardening.md:120-121`
      lists "Env allowlist instead of deny-by-family" as a **rejected** alternative and
      `:164-166` reaffirms "Deny-by-family stands unchanged";
      `src/scripts/_lib/spawn_env.ts:28-33` gives the reason. The proposed six-variable
      set omits the `ANTHROPIC_*` variants and config paths the council transport needs.

## Phase 2 — A confirmation primitive for staged irreversible actions

- [ ] **2.1 Add `requires_confirmation` as a registry-level flag.** Shape it on
      `skill.schema.json:218-224` (optional, additive, schema-backed) so a command or
      skill can declare that its action stages rather than executes. Schema plus fixture
      only — no binding yet.
      <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [ ] **2.2 Implement exactly-once confirmed execution.** A staged action carries a
      token; a double-approve executes once. Extend the `ask` / `ask_timeout` branch at
      `decision_gate.ts:100-109` rather than adding a second prompt path, and keep the
      non-interactive fallback it defines.
      <!-- verify: task test -- --filter=hooks_builtin_decision_gate -->
- [ ] **2.3 Make pending confirmations enumerable through an existing verb** — a flag,
      never a new command; the enumeration precedent is `self-repair:status`
      (`src/cli/registry.ts:118`, `src/scripts/self_repair_cli.ts:403-418`).
      <!-- verify: grep -rn 'requires_confirmation' src/cli/registry.ts -->
- [~] **2.4 Decide whether the primitive binds, and what the other five hosts get.**
      Deferred behind `blocker: confirmation-degraded-host-semantics` — a host without a
      `pre_tool_use` slot (5 of 8, per `hook_manifest.yaml:531,539,578`) can only carry
      the obligation in prose, and shipping a mechanism that claims enforcement it does
      not have is the failure `src/rules/ui-audit-gate.md` already names.

## Phase 3 — Checkable handoff-envelope fields

- [ ] **3.1 Add a validated `do_not_touch` envelope field.** Add to
      `RECYCLE_ENVELOPE_KEYS` (`subagent_capsule.ts:447-460`, beside `constraints` at
      `:459`), a `checkList` line beside `:522`, the interface entry beside `:238`, and
      the heading to `HANDOFF_ARTIFACT_REQUIRED` (`lint_handoffs.ts:342-349`), with a
      fixture pin.
      <!-- verify: task test -- --filter=_lib_subagent_capsule -->
- [ ] **3.2 Add `reversibility` to each decision line** — a one-line shape extension on
      `decisions` (`subagent_capsule.ts:236`) plus the writer's contract at
      `src/domains/meta/agent-handoff/command.md:169,227`. No claim is made that it
      improves resumption; that stays the registered, unmeasured
      `envelope_resume_success` metric.
      <!-- verify: task test -- --filter=lint_handoffs -->
- [ ] **3.3 Lint the Open-questions shape, not just the heading.**
      `validate_handoff_artifact` (`lint_handoffs.ts:351-360`) only tests that each
      required `##` heading exists; require at least one `?`-terminated line under
      `Open questions`. Roughly five deterministic lines, and the false-positive class is
      empty by construction — a section with no question in it is the defect.
      <!-- verify: task test -- --filter=lint_handoffs_artifact -->
- [ ] **3.4 Warn on a write against a `do_not_touch` path.** Sequenced strictly after
      3.1 — the field must exist before a guard can read it. Model on
      `block-kernel-rule-writes` (`hook_manifest.yaml:110`) and `reread-guard` (`:480`),
      register in `src/scripts/hooks/concern_registry.ts:98-108`, advisory and
      `fail_closed: false`. The `pre_tool_use` chain already runs nine concerns
      (`hook_manifest.yaml:531`) — a tenth pays latency on every tool call.
      <!-- verify: grep -rn 'do_not_touch' src/scripts/hooks/concern_registry.ts -->

## Phase 4 — Roles, lifecycles, and the two residues

- [ ] **4.1 Rate-cap self-repair complaint creation per source.** `upsertFinding`
      (`src/scripts/_lib/self_repair_store.ts:84-89`) folds on fingerprint (`:85`), but
      the only cap in the module pair is `MAX_EVIDENCE = 160`
      (`src/scripts/_lib/self_repair.ts:94`) — a cap on evidence *length*, not on record
      creation. Roughly ten lines. Note: the bundle calls this function `openOrMerge`,
      which does not exist; the exports are at `:18-110`.
      <!-- verify: task test -- --filter=self_repair -->
- [ ] **4.2 Quarantine a stale findings artefact before a revision re-dispatch.**
      `src/scripts/dispatch_r2_reviewer.ts:298-307` already owns the single review-scope
      hash both dispatcher and validator bind to (contract §2.1, cited at `:32`); reuse
      that hash as the staleness signal instead of adding a second definition, and read
      `docs/contracts/plan-review-gates.md` §5 for the artefact-then-fix ordering the
      re-dispatch must not break.
      <!-- verify: task test -- --filter=dispatch_r2_reviewer -->
- [ ] **4.3 Add an edit-without-fresh-verification detector to the turn-end gate.** A
      third `DetectorId` beside `'promissory' | 'language'`
      (`turn_end_gate_hook.ts:107`), inside the existing two-layer re-entrancy guard, and
      **the default-off soak stays** — `agent-settings.template.yml:1216-1219` is not
      flipped here. Before relying on a structured-error shape, re-confirm the severity
      mapping on this host: `dispatch_hook.ts:76-78,803-804` defines `EXIT_WARN = 2`
      alongside `EXIT_BLOCK = 1`, and an advisory finding delivered on the wrong exit
      code becomes a hard deny. Treat that as a probe, not an assumption.
      <!-- verify: task test -- --filter=turn_end_gate -->
- [-] **4.4 Role-contract budget fields and an eight-role catalog behind a flag —
      cancelled by record.** `ADR-109-subagent-v1-contract.md:75-76` lists
      `max_iterations` / `anomaly_caps` / per-role budget as "Banned fields (would imply
      runtime we do not have)"; Gate A (`:152-155`) ships a unit only if its eval beats
      both baselines, and no such eval result is recorded in the tree today — a unit
      without one "stays in `src/` as a documented honest-null". Seven of the eight
      proposed roles already exist as skills (`src/skills/judge-*`, 7 directories).
- [-] **4.5 `role@version` in every dispatch trace, plus PreToolUse per-role tool scope —
      cancelled, precondition unpassable.** A resolved live probe
      (`archive/road-to-token-economy-dispatch.md:435-455`) established that a subagent's
      env is indistinguishable from the parent's (`CLAUDE_CODE_SESSION_ID` carries the
      parent id) and that upstream marked per-spawn identity NOT_PLANNED;
      `src/scripts/_lib/session_role.ts:20-26` fails open to `orchestrator` by contract.
      `reviewer` is already enum-reserved at `:33-36` and already scheduled as Phase 3.2
      of `later/road-to-token-economy-dispatch-followup.md:53-57` — unpark that rather
      than re-author it.
- [-] **4.6 Typed lifecycle state machines, a per-role-branch lint, and an asyncio
      in-flight lint — cancelled.** There is one two-state runtime store
      (`src/scripts/_lib/self_repair.ts:71`, `'open' | 'released'`); the other three
      claimed lifecycles are static frontmatter enums and a grep for `transition` over
      `src/scripts/` returns only CSS rule text. A per-role-branch lint would fire on the
      dispatcher's own deliberate fail-open branch at
      `src/scripts/hooks/dispatch_hook.ts:315-322` on day one. An asyncio lint would scan
      nothing — zero authored Python remains under `src/` (`find src -name '*.py'`
      returns 0) — and the doctrine already ships at
      `src/skills/async-python-patterns/SKILL.md:63-65`.
- [-] **4.7 Programmatic tool calling (executing model-authored scripts against a tool
      RPC) — cancelled.** The largest novel mechanism in the batch and the wrong shape
      here: ADR-123 holds behavioural enforcement out of scope, and the gate-equivalence
      precondition presumes guards that bind on 3 of 8 hosts.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Confirmation primitive claims enforcement it lacks | product | On 5 of 8 hosts there is no `pre_tool_use` slot, so a staged-action guard degrades to prose while the flag reads like a control. | 2.4 stays deferred behind the blocker; the flag ships unbound until the degraded semantics are decided. | Phase 2 — A confirmation primitive for staged irreversible actions |
| 2 | Narrowing the shipped subagent weakens its audit | implementation | `production-validator` uses the shell for real probes; a too-narrow prefix set makes the audit quietly weaker rather than failing loudly. | 1.2 lands after 1.1 and is verified by regenerating and reading the projected frontmatter, not by inspecting the source. | Phase 1 — Scoped tool grants |
| 3 | Envelope-field additions inflate the payload | implementation | Two new fields plus a heading push against `RECYCLE_ENVELOPE_MAX_BYTES = 6144` (`_lib/recycle_envelope_paths.ts:35`, enforced at `_cli/cmd_session_recycle.ts:162`) and the required-heading list existing fixtures pin. | Both fields are single lines under the existing `MAX_LINE_CHARS = 240` limit (`subagent_capsule.ts:51`); fixture pins are part of 3.1 and 3.2. | Phase 3 — Checkable handoff-envelope fields |
| 4 | The third turn-end detector lands on the wrong exit code | implementation | `EXIT_WARN = 2` sits beside `EXIT_BLOCK = 1` (`dispatch_hook.ts:76-78`), so an advisory finding delivered on the wrong path becomes a hard deny. | 4.3 re-confirms the mapping as a probe and leaves the master switch off, so a mistake soaks before it binds. | Phase 4 — Roles, lifecycles, and the two residues |

## Blockers

### blocker: confirmation-degraded-host-semantics
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 2.4 only. Steps 2.1-2.3 are unblocked and land default-unbound;
  Phases 1, 3 and 4 are not blocked at all.
- **What to do:** decide what a host without a `pre_tool_use` slot gets when a
  `requires_confirmation` action is staged — a model-carried obligation stated as such,
  or a refusal to stage at all — and whether the primitive is default-on or default-off
  where the slot does exist.
- **Resolved when:** the decision is recorded (an ADR, or the ADR-109 amendment note
  from 1.4) and names both the degraded-host behaviour and the default.
