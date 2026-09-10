<!-- evidence-type: analysis -->

# Autonomous drain run — 2026-09-10

One orchestrator and two subagent lanes, under an owner delegation authorising commits, pushes,
pull requests and token spend, with every decision that would normally reach the owner routed
to the AI council instead. Base `origin/main` at `7bf325f3b`, closing against `f92a4d4ee`.

```
FOUR PULL REQUESTS OPENED, ALL CI-GREEN, NONE MERGED.
ONE ROADMAP ARCHIVED. FIVE STILL OPEN. NOTHING WAS DESCOPED.
THE ROADMAP DIRECTORY DID NOT EMPTY, AND CLOSING IT WOULD HAVE REQUIRED
MISREPRESENTING THE ESTATE — WHICH THE COUNCIL REFUSED, 2/2.
```

## The seed order was stale; the queue was recomputed

The run's brief listed 36 active roadmaps at commit `c536dbd` and instructed a recompute. The
live count is **7**. The brief's top entry, `road-to-always-on-orchestration` at 37/38, is not
an active roadmap any more. Nothing in the brief's table below rank 7 exists. Recomputed queue
by the brief's own rule (≥10 % descending, then <10 % by ascending complexity and checkbox
count), with the dependency chain overriding rank where a `depends:` edge forced it.

## Terminal state of every roadmap

| Roadmap | Before | After | PR | CI | Disposition |
|---|---|---|---|---|---|
| `road-to-delivery-for-every-host` | 28/30 | **28/30** | [#1983](https://github.com/event4u-app/agent-config/pull/1983) `drain/delivery-for-every-host` | green, 39 checks on `f7fb052ff` | open, not archived — council forbade ticking |
| `road-to-continuity-writer-activation` | 9/11 | **archived** | [#1985](https://github.com/event4u-app/agent-config/pull/1985) `drain/continuity-writer-activation-close` | green, 45 checks on `fc5735cbb` | 10 criteria satisfied, 1 **cancelled** |
| `road-to-typed-grants-that-persist` | 2/31 | **2/31** | [#1984](https://github.com/event4u-app/agent-config/pull/1984) `drain/typed-grants-that-persist` | green, 45 checks on `d54ed6a3e` | open — root blocker decided, gate built, settings not |
| `road-to-delivery-on-hook-hosts` | 11/16 | **11/16** | — | — | open, one obstacle, closing criterion recorded |
| `road-to-decision-closure` | 0/22 | **0/22** | — | — | open, blocked on its dependency |
| `road-to-adversarial-verification-and-long-runs` | 0/30 | **0/30** | — | — | open, two dependencies + two Class-3 blockers |
| `road-to-the-packed-payload-cap` | 2/6 | **untouched** | [#1981](https://github.com/event4u-app/agent-config/pull/1981) (not this run) | not this run's | deliberately not entered — see below |
| — closeout | — | — | this PR | — | dispositions + this summary |

**Every PR is opened, none is merged.** A merge to `main` is a Hard-Floor action and the
delegation covered commits, pushes and pull requests, explicitly not merges. Four PRs are
awaiting a human.

**`road-to-the-packed-payload-cap` was deliberately not entered.** Its branch
`feat/packed-payload-cap` was checked out in a worktree with **another session live in it**,
writing to `tests/scripts/pack_payload_reduction.test.ts` and
`src/config/pack-size-budget.json` during this run's own measurement of them. Two sessions
pushing one branch is not parallelism. The run also removed the `dist/cli`, `dist/ui` and
`dist/mcp` artefacts its own test invocation had created in that worktree, because their
presence flips `payloadIsBuilt` and would have corrupted the peer session's pack-size reading.

**Green CI on #1984 did not satisfy its roadmap, and the PR says so in its own title and
body.** 45 green checks mean the change is sound; the roadmap stays at 2/31.

## Council decisions

Every decision below substituted for owner sign-off under the delegation. Transcripts live
under `agents/runtime/council/` — gitignored and auto-pruned — so verdicts are quoted verbatim
where they decided something, in the roadmap or ADR that carries the decision.

| # | Question | Seats | Verdict |
|---|---|---|---|
| 1 | `road-to-delivery-for-every-host` step 4.4 — retire the grace ceiling | 2/2, r1 split | **r1 split, r2 converged on P3** after the premise was corrected: delete the unenforced `grace_end_date`, keep the enforced `grace_ceiling`. Both seats withdrew their own r1 verdicts |
| 2 | The kernel crossing (typed-grants 0.2, Q0/Q1/Q2) | degraded 1/2 | Q0 **2/2** reopen the false blocker · Q1 **2/2** build the platform verification, fail closed · Q2 divergent, **not acted on** |
| 3 | The platform anchor, with the measurement in hand | 2/2 | **Option (a)**, build the full verifier; reject (b) — openai: *"Option (b) would therefore turn a known failed invariant into a green result"* |
| 4 | `continuity.auto_record` default flip | 2/2 | Converged on a **fourth shape no option named**: flip the default, retire the advisory, **keep** the verb |
| 5 | Continuity AC-2 tie-break (council 4 split on it) | 2/2 | A **third disposition neither seat proposed**: preserve AC-2 verbatim, mark `[-]`, archive as 10 satisfied + 1 cancelled |
| 6 | Fail-closed property lost by the flip | 2/2 | **Repair it** — openai: *"The defective implementation is grounds to repair the protection, not authority to repeal it"* |
| 7 | Terminal dispositions for the three unclosed roadmaps | 2/2 | **Keep all three open.** Refuse the run's own terminal descope rule |

Council 2 returned **degraded 1/2** (the openai seat did not answer round 2; its round-1
reading survives inside the anthropic seat's peer review). That is recorded as a degradation,
not as convergence, and its divergent Q2 was left unacted rather than resolved on one reading.

## Declined actions

- **A merge to `main`** — outside the delegation. Four green PRs wait.
- **Rebuilding `dist/hooks/dispatch.js` in the shared parent checkout**, which is what an E3
  observation for `road-to-delivery-on-hook-hosts` 1.1 needs. A worktree session's
  `CLAUDE_PROJECT_DIR` is the PARENT checkout, and another session was live in it. Both seats
  endorsed the refusal; openai: *"Mutating the runtime used by another live session is not
  justified by pressure to close a roadmap."* The cheap route nobody had named is a standalone
  non-worktree session, now recorded in the blocker.
- **Executing "dependency-free" steps** in the two dependency-blocked roadmaps. The council set
  a four-part independence test and required qualifying steps to be **named**; none were, so
  none ran. openai: *"No step should be presumed independent from the information supplied."*
- **Touching `feat/packed-payload-cap`**, above.

## Descopes

**None.** Zero stubs were created. This is the outcome of a decision, not the absence of one:
descoping was the run's own terminal rule and both seats refused to apply it. openai: *"do not
convert unmet obligations into completed stubs merely to make the drain appear empty."*
anthropic: *"the terminal rule's descoping clause applies only when work is impossible or
deliberately abandoned; here, all work remains valid and concrete unblocking actions are
recorded."* Lane A and lane B were each independently forbidden a stub route by their own
councils as well.

## Re-scoped criteria

| Where | Old criterion | New criterion | Why |
|---|---|---|---|
| `ratification-platform-anchor` `Resolved when` | *"either the gate verifies branch protection … or a recorded owner decision states that the platform's own enforcement is the anchor"* | the gate exits 0 against the live repo, **and** it is wired into `ci-fast` and a workflow step | Limb 2 **withdrawn**: the platform's enforcement measurably lacks an independent approval, so relying on it would rely on nothing. Limb 2 of the new form was added after a blind review found the first limb alone lets the blocker close with the gate inert |
| `forge-protection-settings` `Resolved when` | every `forge_protection` row true per `doctor --json` | a row is satisfied when current evidence from the **effective** protection mechanism, rulesets included, shows the behaviour; after Phase 3.2, `doctor --json` must report the same state without reading the classic endpoint's 404 as absence | The classic endpoint 404s here — this repository uses rulesets — so the old criterion could not distinguish "not configured" from "read the wrong API". No ruleset id is pinned, because rulesets can be split |
| `kernel-guard-first-crossing` `Resolved when` | the gate exists and runs in `ci-fast` | that, **and** the deny's file, its three manifest bindings and its registry entry are all gone | The old either/or closed on a technicality: the gate does exist, and the deny was never retired |

## Blockers touched

| Blocker | Roadmap | Before | After | Mechanism |
|---|---|---|---|---|
| `kernel-guard-first-crossing` | typed-grants | `resolved` | **`open`** | Reopened: it closed on the claim that `block_kernel_rule_writes.ts` was deleted. The file exists at 13,075 bytes, is bound at `src/scripts/hook_manifest.yaml:1265`, `:1296`, `:1342`, and is registered at `src/scripts/hooks/concern_registry.ts:117` |
| `ratification-platform-anchor` | typed-grants | `open` | `open` | Decision made and gate built; the three settings changes are admin-only |
| `forge-protection-settings` | adversarial | `open` | `open` | Re-scoped, plus a partial-evidence table |
| `chat-history-settings-description-needs-the-main-checkout` | continuity | `open` | **`resolved`** | Execution — its own deferral reason turned out avoidable |
| `loss-class-corpus-is-empty-after-hot-context` | continuity | `open` | **`resolved`** | Execution via route (b); route (a) of its own `What to do` was found not to work |
| `auto-record-fail-closed-was-carried-by-the-default` | continuity | — | filed **and** repaired | Found by a fixture written to pin a property the flip removed |

## What is agent-denied, and under which policy

`road-to-typed-grants-that-persist` Phase 1 rewrites seven rules. **Five are kernel members** —
`non-destructive-by-default` (1.1), `commit-policy` (1.2), `scope-control` (1.3),
`ask-when-uncertain` (1.5), `no-cheap-questions` (1.6) — and `block_kernel_rule_writes.ts`
denies Write/Edit against them at tool-call time, in source and in every projection, with no
agent-accessible override by design. `autonomous-execution` (1.4) and `tool-safety` (1.7) are
not kernel members and are reachable; they were not attempted, because the deny's retirement is
the gating decision and it was refused.

## Admin-controlled prerequisites — the whole of what blocks the chain

Three settings changes on `event4u-app/agent-config`, all in ruleset `17749383`:

1. `required_approving_review_count` **0 → ≥ 1**
2. `require_last_push_approval` **false → true**
3. `bypass_actors` — remove or restrict `{RepositoryRole#5, bypass_mode: always}`, or record
   administrators as a deliberate escape hatch with an audited emergency procedure

They are the open half of `ratification-platform-anchor`; the deny may retire only once
`check_platform_anchor` reads compliant; `typed-grants` closes only then; `decision-closure`
depends on `typed-grants`; `adversarial-verification` depends on both **and** carries
`forge-protection-settings` and `daemon-host-kill-switch` of its own. One admin visit unblocks
the chain's root. It does not unblock `adversarial-verification`, which needs more.

## Direct measurement versus inference

Everything below was read with `gh api` on **2026-09-10**, not inferred:

- `repos/event4u-app/agent-config/branches/main/protection` → **404, "Branch not protected"**.
  Classic branch protection is not in use.
- `repos/event4u-app/agent-config/rulesets` → one ruleset, `id 17749383`, `name "main
  protection"`, `target branch`, `enforcement active`, `source_type Repository`.
- `…/rulesets/17749383` → `include ["~DEFAULT_BRANCH"]`; rules `deletion`, `non_fast_forward`,
  `pull_request(required_approving_review_count: 0, require_last_push_approval: false,
  required_review_thread_resolution: true)`, `required_status_checks(strict: true, contexts:
  ["Sync + Generate Tools Consistency"])`; `bypass_actors [{RepositoryRole#5, always}]`;
  `current_user_can_bypass "always"`.

Forge rows, per the re-scoped criterion: default-branch protection **satisfied** · force-push
disabled **satisfied** · required checks **provisional** (one context; whether that is the
intended set is undecided) · auto-merge available **unmeasured** · deploy restricted to
pipeline **unmeasured**.

## Three premises this run got wrong and corrected

Recorded because a run reporting on itself is the least trustworthy narrator of its own
accuracy, and each of these was corrected only after it had already been acted on.

1. **"`check_kernel_edit_ratified` is not a required status check at all."** False. It runs as
   a step inside the job `Sync + Generate Tools Consistency`
   (`.github/workflows/consistency.yml:811-825`), which is the ruleset's one required context.
   It was carried into council 3 unverified. What survives is narrower and is the defect the
   round-2 ratification review actually refused the deny-retirement over: a required context
   pins a job's reported **name**, never the steps inside it, so a candidate branch may delete
   the step and the job still reports green. Council 3's verdict rests on three drivers; this
   correction touches one and leaves two intact.
2. **"Step 2.1 of `hook-hosts` has no target because `lean_projection.hosts` is on an unmerged
   branch."** False at `origin/main`: `hosts: [claude-code]` is at
   `src/config/agent-settings.template.yml:214`. The run read step 2.1's text of 2026-09-08 and
   missed that the blocker beside it superseded that on 2026-09-09. The correction makes the
   roadmap's position **better**: both open steps reduce to one obstacle, the E3 transcript.
3. **"Independent approval is one of the five `forge_protection` rows."** False, and both seats
   caught it. It belongs to `ratification-platform-anchor`. Treating it as a sixth row here
   would have silently changed what closes `forge-protection-settings`.

Lane A corrected a fourth, in its own roadmap: step 4.4's escalation rested on a
`grace_end_date` that **no code reads**, so the deadline it warned about would never have fired.
The lane had fed that premise to its own council from the roadmap's text, unverified, and round
2 reversed both seats' round-1 verdicts once it was measured.

## Review rounds

Each PR carries a blind completion review dispatched by the repository's own dispatcher, so no
lane authored its reviewer's prompt.

| PR | Findings | Outcome |
|---|---|---|
| #1983 | 9 | all fixed; the reviewer found both high-severity rows to be **the same defect class the change removes** — unenforced prose named as a forcing function, and a code-scoped reproduction grep that missed two live parked roadmaps |
| #1984 | 12 (2 critical) | 11 fixed, 1 `accepted-risk`. Both criticals defeated the module's own `NON_NEGOTIABLE_FLOOR` and were **reproduced by probe**, not inferred: the floor guarded six threshold fields and none of the three selector fields, and a non-finite approval value made the approval rule unreachable |
| #1985 | — | councils 5 and 6 above arose from its own fixtures |

## Honest nulls and residuals

- **No payload-reduction mechanism was found, proposed or attempted** (lane A). The
  ~30,800-token gap is unresolved and now honestly **undated** rather than falsely deadlined.
  What the change removed was a forcing function that was fictional.
- **Continuity AC-2 was not achieved** and is not claimed to be. The dashboard reads 100 %
  because it counts checkboxes and excludes `[-]`; that is a checkbox count, not an acceptance
  claim. Three different authorities hold AC-2 open.
- **Step 3.2's "retire the verb" half is not done** — its council refused it.
- **`check_gate_completeness` reads 230 against a baseline of 214** and reads the same on
  `main`. It has no workflow binding, which is how 16 un-adopted arrivals accumulated unseen
  since 2026-08-30. This run's contribution is **zero**: `check_platform_anchor` does not
  appear in its un-adopted list and the count did not move. The baseline is shrink-only and was
  not touched.
- **`lint_roadmap_later_disposition` reports both ratchets loose** (17/18, 66/68), identical on
  the untouched base ref. Not banked — lowering a ratchet on a local reading plants a false
  baseline.
- **The `~DEFAULT_BRANCH` required-context gap is not closed** by anything here.

## How this run ended

With four green pull requests, one archived roadmap, five open ones, and every obstacle named
with what closes it. The obligations that remain are blocked on a forge administrator, on a
merge only a human may perform, on one transcript that needs an isolated checkout, and on a
tool-call deny that exists precisely so an agent cannot lift it. None of that is abandoned
work, and none of it was closed to make a directory look empty.
