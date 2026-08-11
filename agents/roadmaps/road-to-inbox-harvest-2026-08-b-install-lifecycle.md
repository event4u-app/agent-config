---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to install lifecycle — every write recorded, org packs decided

> Close the three writes an install performs that its own uninstall cannot undo, so
> `agent-config uninstall` leaves zero unrecorded artefacts; and put the org-pack
> question in front of the maintainer as a named reopening of ADR-011 rather than a
> silent park.

> Source (consumed inbox): `agents/tmp.old/plugin-system.txt` — part of the
> 2026-08-10 batch triaged by [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

The source proposed an org-level plugin system. Two things are true about it, and both
change the plan.

**The removal path already ships.** The source's headline gap — no clean removal — is
overtaken. `uninstall` (874 lines, `src/scripts/_cli/cmd_uninstall.ts`), `prune` (629
lines, `src/scripts/_cli/cmd_prune.ts`) and a read-only drift report `doctor`
(`src/scripts/_cli/cmd_doctor.ts`, orphan check at `:1528`) are all registered
(`src/cli/registry.ts:39,40,41`). Provenance is specified and implemented: per-tool
`files[]` with `kind` ∈ `{deployed, bridge, marker}` plus `sha256`, `merged_keys[]`
with RFC-6901 pointers, and a two-phase `status: uninstalling` resume
(`docs/contracts/install-layout.md:177-191`; `--resume-uninstall` at
`cmd_prune.ts:478-479`, sha256 drift-skip documented at `cmd_prune.ts:31-33`).
Searching `src/scripts/install.ts` alone for "uninstall" returns one comment at `:3682`
— that is a fact about that file, not about the repo.

**What is genuinely open is narrower and sharper.** The layout contract freezes three
writes as known gaps and states plainly that "fixing them is an additive change
(recording a previously-untracked write), never a breaking one"
(`docs/contracts/install-layout.md`, § Untracked surfaces). All three are the same
construct — a recorded-write channel that exists and is not used — and the population
is countable, not open-ended:

- `install.ts:984` is **the only one of 11** `merge_json_file(` call sites in
  `install.ts` that discards the returned merged keys; the other 10 capture them. It
  writes `.vscode/settings.json` `chat.pluginLocations`. `ensure_vscode_bridge`
  (`:978`) is typed `: void`, unlike the five bridge writers that return
  `Record<string, unknown>[]`.
- `install.ts:3858` calls `_update_installed_tools_manifest(...)` with five arguments,
  omitting the sixth parameter `merged_keys_by_tool` declared at `:2504`. The project
  path at `:5138-5145` passes all six. So user-scope JSON merges are unrecorded.
- `install.ts:1038-1050` (`_remove_legacy_augment_trampolines`) swallows the failure in
  a bare `catch { /* OSError → ignore */ }`, leaving a stale file with no manifest entry.

Finally, `docs/CLAIMS.md:94-99` carries `claim: surgical-uninstall` with
`status: backed` and `evidence: docs/contracts/install-layout.md#JSON-pointer` — a
behavioural claim whose only evidence is the document specifying it, while executable
tests for that behaviour exist (`tests/scripts/_cli/cmd_uninstall.test.ts`,
`tests/lib/installed_tools.test.ts`).

## Phase 1 — record the three writes uninstall cannot undo

- [x] **1.1 Return and record the `.vscode/settings.json` merge.** Make
      `ensure_vscode_bridge` (`src/scripts/install.ts:978-989`) return the
      `merge_json_file` result like its nine sibling call sites, and thread it into
      `merged_keys_by_tool` at the project call site (`:5138-5145`). Extend the
      existing manifest writer; add no new module.
      <!-- verify: task test -- --filter=cmd_uninstall -->
- [-] **1.2 Pass `merged_keys_by_tool` on the global install path.** Cancelled —
      the premise's consequence is false at HEAD, per Risk-Register rank 4.
      The omitted sixth argument is real (`install.ts:3862`, parameter declared at
      `:2504`) but **inert**: `install_global` spans `install.ts:3646-3909` and
      contains zero `merge_json_file` / `ensure_*` calls, so there is no JSON merge
      on that path to record. The `~/.augment/settings.json` and
      `~/.cursor/hooks.json` merges the step cites are opt-in flags on the
      *project* path (`install.ts:5116-5130`), which already captures each into
      `merged_keys_by_tool` and passes it at `:5150`. Confirmed sole call site of
      `install_global` at `:4897`. The one genuine user-scope residual — Cline's
      `void`-returning `ensure_cline_user_hooks` (`:1251`) — is recorded as
      still-frozen by 1.5 instead.
- [x] **1.3 Stop discarding legacy-trampoline removal failures.** Replace the bare
      `catch` in `_remove_legacy_augment_trampolines` (`install.ts:1038-1050`) with a
      surfaced non-fatal warning naming the path, so a failed removal is visible rather
      than a silent stale file. Do not change removal semantics.
      <!-- verify: task test -- --filter=cmd_prune -->
- [x] **1.4 Re-point the `surgical-uninstall` claim at executable evidence.** In
      `docs/CLAIMS.md:94-99` the claim is `backed` by the contract that specifies it.
      Retarget `evidence` to the tests that exercise the behaviour and re-stamp
      `last_verified`. **Correction:** neither test this step names demonstrates the
      claim — `cmd_uninstall.test.ts` covers arg errors, marker fallback and
      whole-file removal, and `installed_tools.test.ts` covers manifest shape. The
      behaviour ("only its own keys … never a neighbour tool's entries", matched by
      pointer + SHA-256) is proven in `tests/lib/json_pointers.test.ts`
      (`test_preserves_foreign_keys`, `test_two_tools_share_parent_uninstalling_one_leaves_other`,
      `test_ancestor_with_foreign_sibling_stops_trim`, `test_list_with_drifted_hash_skips_with_warning`),
      so the pointer targets that file in the re-executing `exec:` form.
      <!-- verify: rg -n 'claim: surgical-uninstall' -A5 docs/CLAIMS.md -->
- [x] **1.5 Shrink the frozen-gaps list to what remains.** Update § Untracked surfaces
      in `docs/contracts/install-layout.md` so each closed item is struck with its
      commit, and anything still untracked (user-scope *files* such as the Cline
      trampoline at `install.ts:1247-1262`) is named as still-frozen. Landed: the
      `.vscode` bullet struck as closed; the user-scope-`merged_keys` bullet struck
      as **withdrawn** (its mechanism does not exist — see 1.2); three residuals
      named as still-frozen, one of them new — both unconditional bridges are
      recorded only when `augment` is among the selected tools, because the lockfile
      keys `merged_keys` by a name that must be in `_VALID_TOOLS`. Also corrected two
      wrong pointer renderings of `chat.pluginLocations`, which is a literal dotted
      key rather than a nesting level (`_escape_segment`, `json_pointers.ts:50-52`).
- [-] **1.6 Add provenance markers, a marked-content-only removal path, and an
      orphan report.** Cancelled — all three ship: `files[]`/`merged_keys[]`/`sha256`
      (`docs/contracts/install-layout.md:177-191`), `uninstall` + `prune`
      (`src/cli/registry.ts:39,40`), orphan reporting (`cmd_doctor.ts:1528`,
      `cmd_prune.ts:24-33`).

## Phase 2 — put the org-pack question to the maintainer

- [x] **2.1 Write the reopening brief, not the implementation.** Landed as
      `agents/settings/contexts/org-pack-reopening-brief.md`. One artefact stating:
      (a) the governing lock — `docs/decisions/ADR-011-domain-pack-readiness.md`,
      `status: accepted` (`:3`), holding that future domains ship as in-repo capability
      bundles "not as separately-installable packs, until at least two independent"
      domains with overlapping surfaces exist (`:66-67`), triggers unmet, with
      `agents/roadmaps/domain-pack-extraction-when-triggered.md` (`status: draft`) as
      the parked sibling; (b) why it is surfaceable under
      [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) — the
      **mechanism differs**, ADR-011 governs extracting core domains *out* while the
      source proposes pulling org content *in*; (c) the bar any reopening clears, per
      `docs/decisions/ADR-088-no-external-runtime-federation.md:93-102` § 3 —
      identity, generic design, the maintenance model for N bridges, and the trust
      contract naming who validates external output and how the safety floors are
      enforced across the boundary. State honestly that ADR-088 does **not** forbid
      this proposal — it scopes to driving an external agent *runtime* — so it is cited
      as the bar, never as a prohibition; (d) the unresolved contradiction below.
      Do not route around the lock and do not pre-commit the answer.
- [x] **2.2 Record the overrides contradiction as a precondition.** Recorded as
      § (d) of the 2.1 brief; re-verified at HEAD. The source's claim
      that manual duplication is the only option today is false:
      `agents/overrides/` is the shipped project-local extension layer and
      `src/skills/override-management/SKILL.md:50-51` defines **`extend` and
      `replace`** modes. The source's own non-goal "no override semantics" therefore
      contradicts a shipped, documented mechanism. Any reopening must reconcile the two
      first or they contradict at runtime.
      <!-- verify: rg -n 'extend|replace' src/skills/override-management/SKILL.md | head -5 -->
- [-] **2.3 Decide whether an external pack source root opens.** **Declined
      2026-08-11.** The source root does not open, ADR-011 stands, and no ADR is
      commissioned. Decided against the 2.1 brief
      (`agents/settings/contexts/org-pack-reopening-brief.md`, which carries no
      recommendation by construction) via an AI-council pass that converged **2/2 on
      decline**; the reasoning and the falsifiable reopen condition are recorded in
      that brief under `## Decision`. Citation order, as the council weighted it:
      **(1)** the unresolved `replace` contradiction — the brief's § (d) names
      reconciling it a *precondition* of any reopening, and it is unreconciled, so the
      proposal fails its own precondition before any external argument is reached;
      **(2)** the capacity frame — 116 rules, 289 skills, 12 in-repo packs, one
      maintainer, and a pack system externalises the error surface, since an external
      artefact's syntax error surfaces at runtime rather than at PR time and a kernel
      change then needs N external maintainers to act; **(3)** the closed id
      vocabulary — `src/config/discovery/packs.yml:1-4` requires "an ADR-013 amendment
      in the same PR", so an externally-supplied vocabulary is a direct contract
      change, not an additive feature. ADR-011's unfired design gate is deliberately
      **not** the lead citation: it was written against *extraction*, so the brief's
      § (b) mechanism-match reading holds. It still bears indirectly — the
      identity-collision, precedence and trust-boundary questions its overlap
      inventory would have forced are unanswered in the ingestion direction too.
- [-] **2.4 Build the pack system.** Cancelled — it ships: `packs:` is a schema'd
      frontmatter key (`src/scripts/schemas/skill.schema.json:244-253`) carried by all
      **289** skills; **12** in-repo packs at `src/domains/*/pack.yaml`;
      `packs:active` at `src/cli/registry.ts:54`; pack-scoped projection via
      `projection.mode: scoped` + a `runtime.active_packs` overlay
      (`src/scripts/install.ts:3475-3478`), installer flags `--packs` / `--core-only`
      (`:3981`, `:4016`), rule scoping via `rule_in_scope`
      (`src/install/ruleInScope.ts:107`).
- [-] **2.5 Add a `templates/pack/` scaffold.** Cancelled — `templates/` does not
      exist at repo root, and a stale `templates/**` path filter already sits at
      `.github/workflows/smoke-public-install.yml:50`.
- [-] **2.6 Ship a plugin-marketplace export channel.** Cancelled —
      `.claude-plugin/marketplace.json:8` describes itself as "DEPRECATED as a content
      channel", shipping only dispatcher hooks plus one pointer skill. Reviving it needs
      its own decision.
- [-] **2.7 Build per-pack token accounting.** Cancelled as new work — the measurement
      apparatus exists (`src/scripts/check_always_budget.ts`, `measure_rule_budget.ts`,
      `check_token_regression.ts`, `lint_token_budget_discipline.ts`); only per-pack
      attribution is absent, and it is downstream of 2.3.

**Capacity frame for 2.1.** The estate measures **116 rules** (`src/rules/*.md`) and
**289 skills** (`src/skills/*/`). A pack system is a capacity multiplier on the surface
furthest from its own budget, and
`docs/decisions/ADR-216-restraint-reanchored-to-capacity.md` re-anchors every restraint
gate to maintainer capacity — with external adoption explicitly struck as a valid
condition (`:10-17`). That is the frame the decision is taken in.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Recording a write changes what uninstall deletes | implementation | A `.vscode/settings.json` or `~/.cursor/hooks.json` key that previously survived removal now gets removed, on trees installed before the change. | The layout contract already classifies this as additive, never breaking; `cmd_prune.ts:31-33` hashes recorded content and skips removal on drift, so a consumer edit is preserved. | Phase 1 — record the three writes uninstall cannot undo |
| 2 | The brief reads as advocacy | product | A reopening brief that argues for org packs pre-commits the maintainer to the answer the source wanted, defeating the point of surfacing the lock. | 2.1 fixes the brief's shape to lock, mechanism distinction, bar, contradiction — no recommendation; the decision stays a maintainer-owned blocker. | Phase 2 — put the org-pack question to the maintainer |
| 3 | Surfacing removal failures adds output noise | implementation | Turning a swallowed `OSError` into a warning may fire on ordinary permission conditions and read as a broken install. | Non-fatal, path-named, single line; removal semantics unchanged, so no exit-code shift. | Phase 1 — record the three writes uninstall cannot undo |
| 4 | Residual scope smaller than the phase implies | product | If a closed gap turns out already recorded elsewhere, Phase 1 collapses toward doc-only and the roadmap outlives its content. | Each step cites the exact omitted argument or discarded return value; a step whose premise fails is marked `- [-]` with the citation rather than reinterpreted. | Phase 1 — record the three writes uninstall cannot undo |

## Blockers

### blocker: org-pack-reopening
- **Status:** resolved 2026-08-11 — **declined**
- **Owner:** maintainer
- **Blocks:** step 2.3 only. Steps 2.1 and 2.2 are authoring and verification and are
  not blocked; all of Phase 1 is independent of the pack question entirely.
- **What to do:** read the 2.1 brief and either decline (ADR-011 stands, 2.3 closes as
  `- [-]`) or reopen by commissioning an ADR that answers the four ADR-088 § 3 questions
  and reconciles the `agents/overrides/` `replace` mode.
- **Resolved when:** either 2.3 is marked `- [-]` citing a decline, or a new ADR exists
  with `status: accepted` amending ADR-011 and ADR-013 § packs.
- **Resolution:** the first branch. 2.3 is `- [-]` citing the decline; no ADR was
  commissioned, so ADR-011 and ADR-013 § packs are unamended and the closed pack-id
  vocabulary is untouched. The decision was taken by an AI-council pass that converged
  2/2 (2026-08-11), against the recommendation-free 2.1 brief; the reasoning and the
  two-part falsifiable reopen condition live in
  `agents/settings/contexts/org-pack-reopening-brief.md` § Decision, which is the
  durable home — this roadmap archives with the PR that records it.
