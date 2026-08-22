---
complexity: lightweight
---

# Roadmap Stubs — successor placeholders

> **Status** · stubs only. Created by Phase 9 of
> [`road-to-employee-product-and-external-proof.md`](../archive/road-to-employee-product-and-external-proof.md)
> so cross-references from the deployment-posture document and the
> archived `road-to-internal-ai-os-deployment.md` resolve.

This directory holds two classes of file, and **none of them is active work** —
see § The two classes. The stub files themselves are the inventory; this file
carries only what is true of all of them.

The stubs live under `stubs/` (not `agents/roadmaps/*.md` directly)
so they do not register with `task lint-roadmap-complexity` and do
not appear on `agents/roadmaps-progress.md`. Promotion to active
status moves the file up one directory and adds the complexity
frontmatter expected by the linter.

## The two classes

This directory holds two structurally different classes of stub, and the
distinction decides which gates apply.

**Org-mode stubs** are *empty-named placeholders*: each enumerates the
prerequisites a future maintainer (or external contributor with funding) must
satisfy before it can be promoted. They are **demand-gated** — the work is
buildable today and the open question is whether it *should* be built. They are
governed by § Promotion criteria (shared).

**Drain-run transfers** are the opposite shape. They were not created
speculatively: they are work that was already planned and specified in an active
roadmap, then transferred out when an autonomous drain run reached it and found
it needed something no repository automation can supply — a live host session, a
repo secret, a repo-admin write, a legal signature, another human, or a
capability nobody is building. The parent roadmap closes against an explicit
outcome state (`transferred`), so a completed roadmap can never be read as an
achieved goal. They are **capability-gated**: the scope decision is already
made, the work is wanted, and the only thing missing is an environment the run
did not have. They are governed by their own probe, never by the shared
criteria.

**The per-stub table below was reintroduced during a merge.** The trunk
replaced it with the paragraphs above, which explain the CLASS but name no
stub; a tree-wide grep found these twelve rows in no other file, and each
carries a parent roadmap, an outcome state and a re-entry probe that the
prose does not. Restored rather than dropped because the loss looked
incidental and is cheap to reverse; if the removal was deliberate, delete
this section and say so here.

| Stub | Transferred from | Outcome state | Re-entry gate (its own probe, baseline at transfer) |
|---|---|---|---|
| [`road-to-host-aware-skill-projection.md`](road-to-host-aware-skill-projection.md) | `road-to-release-review-p0.md` Phase 1 + AC1, 2026-08-20 | `transferred` | P1-P3 in the stub: a same-`projection_mode` observation pair, a non-throwing scoped path in `condense.ts`, and a published projected-away-skill finding — each with a probe, all three measured failing |
| [`road-to-bus-factor-external-actions.md`](road-to-bus-factor-external-actions.md) | [`road-to-maintainer-bus-factor.md`](../road-to-maintainer-bus-factor.md) Phase 1-4, 2026-08-20 | `transferred` | 4 items: `ANTHROPIC_API_KEY` present **and** a non-skipped `live-advisory` run (absent; 0 live runs) · ruleset 17749383 requires code-owner review, ≥ 1 approval, > 1 check (`false` / `0` / `1`) · a dated cold-dry-run record (none) · distinct trailing-90-day reviewers > 1 (1) |
| [`road-to-main-protection-ruleset-changes.md`](road-to-main-protection-ruleset-changes.md) | `road-to-inbox-harvest-2026-08-b-ci-economy.md` Phase 4, blockers `required-check-set-change` + `merge-queue-enablement`, 2026-08-20 | `transferred` | One gate, in the stub: a repo-admin write on ruleset `17749383` by the named producer. Two probes, both measured at transfer time: required checks **1**, `merge_queue` entries **0**, `merge_group` files **0** |
| [`road-to-multi-host-screenshot-census.md`](road-to-multi-host-screenshot-census.md) | [`road-to-source-first-frontend`](../road-to-source-first-frontend.md) — Phase 1 Step 2, the screenshot dimension of Phase 6 Step 1, and the W5 URL / live-page handover class | `transferred` | A **page-reaching** capture primitive on a second supported host. Measured 2026-08-20: this host has `screencapture` only, which photographs the display. Display-only capture on a second host changes nothing. |
| [`road-to-session-closeout-gated.md`](road-to-session-closeout-gated.md) | [`road-to-session-closeout.md`](../archive/road-to-session-closeout.md) — Phase 2 entire, Phase 7 entire, steps 1.2/1.4/1.4b/1.5/4.1/4.2/4.4/5.3/8.1/8.2/8.4 and the classification half of 5.2, 2026-08-20 | `transferred` | Six groups, each with its own probe measured at transfer: burned-version record `grep -rl burned src/config/` **0** · `release-drift.yml` triggers cron+dispatch only, **no** merge trigger · `payloadOf` in `injection_scan_hook.ts` **0** (sibling **2**) · pack cap **8.4** MB / census **111 012** recorded vs **111 035** measured, `measured_at_commit: "unrecorded"` · **165** local-only gates at baseline · estate **384** worktrees / **973** local / **267** remote / **18** open PRs (parent reasoned from 346/929/245/**0**) · **5** orphaned `src/domains/**/evals/triggers.json`, not the 1 the parent named |
| [`road-to-gate-preauth-authorization.md`](road-to-gate-preauth-authorization.md) | [`road-to-gate-autonomy.md`](../road-to-gate-autonomy.md) step 2.3, 2026-08-20 | `transferred` | 1 item, both probe halves required: an authorisation artefact `lint_settings_classes` reports as class **C** and naming a blocker id (none of today's 107 C keys is one) · the abort intact, `grep -c 'Refusing to run under automation' src/scripts/skill_trigger_eval.ts` still `1` (`1`) |
| [`road-to-org-telemetry-sink.md`](road-to-org-telemetry-sink.md) | [`road-to-org-telemetry.md`](../road-to-org-telemetry.md) Phase 2 (`sink-choice`), 2026-08-20 | `transferred` | 1 item: a private, package-CI-inaccessible repository identifier resolves **and** appears in org-pack settings (measured FAIL on every clause — no identifier exists in the tree, `read_remote_settings` reports `missing: endpoint, org_id, salt`). Producer: the org repository administrator. **The pending act is itself Hard-Floor** — repository creation and pointing an endpoint at it; monitoring owner + rollback recorded in the stub |
| [`road-to-org-telemetry-enablement.md`](road-to-org-telemetry-enablement.md) | [`road-to-org-telemetry.md`](../road-to-org-telemetry.md) Phase 3 (`dpo-signoff`), 2026-08-20 | `transferred` | 1 item: a written internal data-protection outcome covering the Class-A field list **and** the disclosure line is linked from ADR-233 (measured FAIL — ADR-233 exists and is indexed, `grep -c "sign-off"` returns 0). Producer: the named internal data-protection reviewer. Its four measurement items are gated by the sink stub as well; both must clear |
| [`road-to-solution-minimalism-full-tier-run.md`](road-to-solution-minimalism-full-tier-run.md) | [`road-to-solution-minimalism.md`](../road-to-solution-minimalism.md) Phase 3 + the full-tier AC, 2026-08-20 | `transferred` | 3 items, all gated on one paid sweep: ≥ 30 corpus tasks declaring `repo` + `sha` (**1**) · a `Gate verdict:` in `docs/benchmark.md` from a pinned report with a non-empty `sha` (**none**; 0 full-tier runs ever) · that verdict carrying all four pre-registered endpoints (all four implemented, 0 reports rendered). Blocked by an absent credential and by a Hard Floor that a 2026-08-14 pre-authorisation does not clear |
| [`road-to-subagent-payload-capture.md`](road-to-subagent-payload-capture.md) | [`road-to-subagent-lifecycle-integrity.md`](../road-to-subagent-lifecycle-integrity.md) Phase 0 Steps 2+4 raw-payload halves (Phase 4 Step 1 blocked by, not moved), 2026-08-20 | `transferred` | P1-P4 in the stub: a captured `SubagentStop` payload, a captured in-subagent `PreToolUse` payload, their field lists recorded, and the `AGENT_HOOK_CAPTURE_DIR` setting absent again afterwards (P1/P2 directory does not exist · P3 absent · P4 correctly no match today). Producer: the host owner, one time-boxed fresh session, under the 7 containment requirements in the stub — the capture writes payloads verbatim and "remove it afterwards" is not a kill switch |
| [`road-to-estate-triage-remaining-batches.md`](road-to-estate-triage-remaining-batches.md) | [`road-to-estate-drawdown.md`](../archive/road-to-estate-drawdown.md) steps 2.1 + 2.2 + AC-2, 2026-08-21 | `transferred` | 1 probe: files in the active tree and `later/` with no `- file:` / `moved_to:` row in `agents/decisions/estate-triage-dispositions.yml` reaches **0** (**71** at the council's decision commit `52cfb4bb8` — 24 active, 47 `later/`; **70** on the merged tree, one file having left the denominator by being archived untriaged, which is the failure mode the stub names). Producer: the repository maintainer, **independently of the abandoned Phase-4 pass** (a binding condition of the council's confirmation). AC-2's ceiling clause is separately unsatisfiable — T1's `target` is read by nothing — so the probe can reach 0 with that clause still open. Batches carry a snapshot commit and skip PR-held files with a recorded reason |
| [`road-to-draft-status-ratchet-boundary.md`](road-to-draft-status-ratchet-boundary.md) | [`road-to-estate-drawdown.md`](../archive/road-to-estate-drawdown.md) target T2 (anti-regrowth), 2026-08-21 | `transferred` | 2 clauses, either branch resolves: the raw active-file count and the gate's `active_roadmaps` **agree** (measured **26 vs 23**, a gap of **3**, at transfer — three `status: draft` files opt themselves out at `update_roadmap_progress.ts:91,284,747,815`), **or** `estate-count-budget.json` records a written decision naming `draft` (0 matches). Producer: the repository maintainer, who owns the estate metric. Not fixed in the parent because changing a shipped gate's counting semantics plus its committed baseline may fall under Rule 3; the observe-only rollout, baseline migration and rollback criteria are inside the transferred scope |
| [`road-to-standing-rule-delivery-per-machine.md`](road-to-standing-rule-delivery-per-machine.md) | [`road-to-standing-context-40k.md`](../archive/road-to-standing-context-40k.md) step 0.1 + AC-0, 2026-08-21 | `transferred` | Per machine in the affected set: `task dev:standing-rule-delivery` exits 0, or a dated exemption note. Measured 2026-08-21 — maintainer machine **non-zero at 197,358 tok / 110,000 cap (179.4 %)**, 91 rules in both layers with 6 divergent, up **+21,004 tok** from the 2026-08-08 reading; colleague machines **no reading exists** and none can be taken from here. The remedy on every machine, the maintainer's own included, is a per-machine settings write — a Rule 3 host-env act |
| [`road-to-instructions-loaded-observer.md`](road-to-instructions-loaded-observer.md) | [`road-to-standing-context-40k.md`](../archive/road-to-standing-context-40k.md) steps 3.0 + 3.1 + blocker `b-rules-efficiency-signal`, 2026-08-21 | `transferred` | 3 merged items (framework rule 5 — one evidence chain). (1) Bind the event: `grep -c '"instructions_loaded"' src/scripts/hooks/dispatch_hook.ts` and `grep -c 'InstructionsLoaded' src/scripts/hook_manifest.yaml` (**0** / **0**) — now buildable, because the host capability was **measured present** at Claude Code 2.1.238 (exact-token 9, in the host's own event enum, `executeInstructionsLoadedHooks` + `hasInstructionsLoadedHook`, payload `load_reason` / `trigger_file_path` / `parent_file_path`), overturning the parent's refuted-premise reading. (2) A producer for the `rules_carried` pair: `dispatch_economy_report` reports `envelopes with pair` > 0 (**0**, `no data`; settled by #1484, not reopened). (3) Decide the fork, gated on (2). Kill switch required on (1) |
| [`road-to-per-turn-hook-economy-host-repro.md`](road-to-per-turn-hook-economy-host-repro.md) | [`road-to-per-turn-hook-economy`](../road-to-per-turn-hook-economy.md) — the whole of Phase 0 (steps 0.1, 0.2, 0.3) plus 0.2's else-branch hand-off, 2026-08-20 | `transferred` | The **affected machine**, at the version installed on it when the slowdown was reported — the reporter is the named producer. Three probes measured on THIS machine as the wrong-machine control, 2026-08-20: `AGENT_CONFIG_HOOKS_ISOLATED` **unset** (7 tracked mentions, none a shell profile or CI export) · installed **14.6.0**, not the report's version · turn-end-gate refusal records **0** — the only file present is a May smoke fixture whose schema carries no refusal counter at all. |

```
THE SHARED PROMOTION CRITERIA BELOW — RECRUITED CUSTOMER, FUNDED SECURITY
AUDIT, ADR SIGN-OFF — DO **NOT** GOVERN A DRAIN-RUN TRANSFER.
A TRANSFER IS PROMOTED BY ITS OWN NAMED PROBE RETURNING TRUE. NOTHING ELSE.
```

Applying a recruited customer or a funded security audit to a capability-gated
transfer is a category error: there is no customer to recruit for a tool surface
that simply is not connected, and no audit clears a missing capability. Promote
**per item**, not per file, and delete a stub when its last item is gone.

**A transfer crossing no *new* surface is not a transfer crossing no Hard
Floor.** Some pending acts here — a repo-admin ruleset write, a
branch-protection change — **are** Hard-Floor actions in their own right, and
each such stub says so.

**A gate is not always a measurement.** For such a row the gate is the
*authority* itself, exercised by a named human — not a number anyone can read.
Requiring a recruited customer and a funded audit before a maintainer may edit
their own repository settings would gate on nothing and make the stub unclosable.

Framework of record for drain-run dispositions:
[`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
and its batch-B sibling. That pointer is kept here deliberately: it is the only
central path to where disposition B and the numbered rules are formally defined,
and most transfer stubs do not link it themselves.

## What every stub carries — and why this file no longer lists them

Each stub carries the framework's three-point stub-integrity check: the original
criterion **verbatim**, the complete list of dependent steps moved, and a **named
producer with a detection probe** (never "when some subsystem exists", which
names nobody) — plus the probe's measured baseline on the transfer date, so a
later reader can tell real movement from noise, and any reasoning that would
otherwise die with the parent. Council disposition **B — transferred**,
2026-08-20 (anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2) for
the always-on-orchestration set; see each parent roadmap for the others.

Where several stubs come from one roadmap, that is deliberate and merging them
was refused: two host-probe cases can look adjacent while probing different
mechanisms against different telemetry streams, and the council assigned them
separate re-entry producers. One stub per distinct evidence gap; a merged stub
would have one probe standing in for two facts.

**The inventory is the directory listing, not a table in this file.** Until
2026-08-21 this file carried two index tables — 6 demand-gated rows and 27
transfer rows. They were deleted, and the reason is measured rather than
stylistic:

- The tables were an **authored append surface**: every transfer added a row by
  hand, and the file conflicted in **every** open PR GitHub reported
  `CONFLICTING`. It was the largest *authored* conflict path in the repository —
  everything above it in the ranking is generated.
- They **duplicated** the stubs. All 33 rows were checked cell by cell against
  their stub file before deletion; every measured number in every row was
  already there. Two facts that were not literally spelled out — one `grep -c`
  result and one parent item number — were written into their stubs first.
- The index **did not stay true**. It had drifted stale within a day of its own
  last repair, missing a stub created that same afternoon. An index that lies is
  worse than no index, because a reader trusts it.
- An earlier repair had already had to fix *two competing tables and
  non-rendering markdown* produced by six parallel union merges. That is the
  failure mode of a hand-maintained index under concurrent work, and it does not
  get better with more rules.

To see what is here, list the directory:

```bash
ls agents/roadmaps/stubs/*.md
# or, with each stub's first heading:
head -n 20 agents/roadmaps/stubs/road-to-*.md | grep -E '^(==>|# )'
```

## Promotion criteria (shared)

Governs the **demand-gated** org-mode stubs only — never a drain-run transfer,
which names its own probe in its own file (§ The two classes). Any such stub may move from `stubs/`
to `agents/roadmaps/` only when **all three** of these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

### Closing a drain-run transfer — either direction counts

A drain-run transfer is promoted when **its own probe reads positive**, and
**closed when its criterion is satisfied in either direction** — including the
honest-null direction, where one is registered. Two of the six carry such a null
already: the point-of-action carrier's "no discriminator is publishable", and the
auto-dispatch gate's "telemetry says auto-fire adds nothing and the gate stays
recommend-only". **A measured null closes a stub as legitimately as shipped work
does**, and saying so is what keeps a probe-gated stub from becoming the parking
lot the disposition framework's fifth disposition (`E — abandon`) exists to
avoid.
