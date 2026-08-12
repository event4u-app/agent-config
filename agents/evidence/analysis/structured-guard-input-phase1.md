# Structured guard input — Phase 1 measurements

Answers the three falsifiers `road-to-structured-guard-input` Phase 1 pre-registers,
before any structured-field work is built. Measured 2026-08-12 against
`origin/main` @ `1432c7a45`.

The roadmap's own framing is that the council's recommendation must not be treated
as settled until these are answered. Two of the three answers move the plan.

## 1.1 — false-negative cost of the advisory downgrade

**Result: 0 genuine verdict-shopping dispatches over a 128-session corpus.**
The council's bar was *>2 % ⇒ the branch needs structure rather than advisory
status*. The measured rate is below it by the widest margin the instrument can
express.

### Instrument

`conformance_scan --why evidence-steering`. It already carries this exact
classifier and **imports it from the guard** (`isEvaluationPrompt`,
`isSelfScoped`, `preloadedVerdict` from `src/scripts/hooks/evidence_independence.ts`),
so the measurement and the gate cannot disagree silently. No new probe was
written — the one that was needed already existed, and a second copy of a
classifier is the drift this repo's own principle forbids.

### Corpus

| Store | Sessions | `evidence-steering` hits |
|---|---:|---:|
| `agent-config` (main checkout) | 55 | 1 — pre-loaded verdict |
| `agent-config` wt `worker-recycling` | 26 | 0 |
| `agent-config` wt `road-to-release-truth` | 11 | **6 — second self-review** |
| `private/agent-switch` | 19 | 0 |
| `private/capisco` | 17 | 0 |
| **Total** | **128** | **7** |

The two `private/*` stores carry no project-scope install, so they are a
single-carrier control group. Both are clean.

### Per-case classification of the six

The step asks for a classification per case, not a rate. All six sit in one
session (`road-to-release-truth/0fc3fbcc`, 2026-08-04) and are a single R2
review-and-repair arc over one change:

| # | Time | Dispatch | Genuine shopping? |
|---|---|---|---|
| 1 | 10:03 | `Final binding blind review` (R2 round 3) | No — follows a fix worker at 09:34 |
| 2 | 10:54 | `Binding final blind review` (round 4) | No — follows a fix worker at 10:17 |
| 3 | 11:10 | `Fix final five findings` | No — an **implementation** worker; `isEvaluationPrompt` false positive |
| 4 | 11:37 | `Final binding review round 6` | No — follows the fix at 11:10 |
| 5 | 12:00 | `Final confirmation review` | No — follows round 6's dispositions |
| 6 | 12:33 | `Binding review with terminal dispositions` | No — two-phase review + fix |

**Genuine verdict shopping: 0 of 6.**

The discriminator that matters, and it is not one a regex can reach: verdict
shopping is re-running an evaluation over **unchanged** work until the answer
changes. Every round here is separated by a dispatched fix worker, so each pass
judged a different artefact. Case 3 is a plain misclassification — an
implementation prompt naming *findings* and *review* because it is repairing a
review's output.

### What this does and does not settle

It settles the half the roadmap's Risk 1 names: the advisory downgrade is **not**
letting genuine shopping through, so the guard is not quietly inert. That risk is
retired on measurement rather than on argument.

It does not settle whether the *false-positive* cost justifies the field — that
is 1.2 and 1.3, below. And one honest limit: the corpus is retrospective. The
downgrade landed 2026-08-12, so no session in it postdates the severity change.
That is defensible because the downgrade changed the **severity**, not the
**classification** — the population "dispatches the guard now only warns about"
is decided by predicates the downgrade did not touch, so historical transcripts
enumerate exactly the same population a prospective window would. What a
prospective window would add is only behaviour change *caused by* the weaker
severity, which nothing in the recommendation depends on.

## 1.2 — do the secondary controls the council assumed actually exist?

**Result: for `evidence-independence` — the guard whose branch was downgraded —
there is NONE. It is the only control.** The step pre-registers that answer as
the one which *changes the severity answer for that guard*, so it is stated
first rather than buried in a table.

Census of every blocking `pre_tool_use` / `stop` concern in `hook_manifest.yaml`:

| Concern | What it prevents | Independent second control |
|---|---|---|
| `block-no-verify` | git hooks skipped via `--no-verify` / `-n` / `core.hooksPath` | **Yes** — CI re-runs the same gate set (`rule-backstops.yml`, `consistency.yml`, `tests.yml`); `check_secret_leak.ts:3-13` names itself the non-bypassable layer |
| `block-kernel-rule-writes` | agent loosening a kernel Iron Law | **Partial** — `check_safety_floor_untouched` covers 4 of 9 kernel rules in CI; the only all-9 content check (`check_rule_invariants`) is registered in `Taskfile.yml` alone and **no workflow runs `task ci`** |
| `block-config-weakening` | allowlist growth instead of fixing the code | **Exists but unwired** — `check_suppression_hygiene.ts` is a stronger ratchet, invoked by no workflow and by no git hook |
| `block-unauthorized-git` | unauthorized publish / tag / release / merge | **Partial, per op** — ruleset + OIDC publish + release-guard; all weaker or *later* than the hook (required approving reviews = 0, admin bypass always, release-guard is detective) |
| **`evidence-independence`** | **a self-commissioned review with a pre-loaded verdict booked as gate evidence** | **NONE** — `evaluator-independence.md:107-112` says so itself. `check_completion_review` validates artefact *grammar* and runs `--advisory`; `dispatch_r2_reviewer --verify-current` re-derives scope hashes. **Neither inspects the evaluator's prompt** |
| `turn-end-gate` | promissory closing · wrong-language reply · edit with no verification | **A and B: NONE.** `probe_promissory_closing` is exit-0 by declaration; `check_md_language` scans `docs/**.md`, never reply prose. C: partial (CI catches a breaking edit after push) |

**2 of 6 blocking concerns have no independent second control for their blocking
class**, and one of the two is the guard this roadmap is about.

What that means for the severity answer, stated without smoothing: the council's
tier rule was applied to this branch on the assumption that other controls
absorb the residual risk. For this guard that assumption is false. It does not
reverse 1.1 — a risk with no backstop that has produced zero instances in 128
sessions is still zero instances — but it removes the argument that advisory is
*safe because something else catches it*. Advisory here is safe only for as long
as the measured rate holds, which is an argument for keeping the rate measured,
not for leaving the severity untested.

## 1.3 — dispatch call sites that would need the new fields

**Result: 50 sites, 48 % external. The falsifier's external half fires by a wide
margin; its count half sits exactly on the boundary.**

The council's falsifier: *>50 sites with >30 % external makes the
structured-metadata path too expensive, and the recommendation changes.*

| Boundary | Sites | Internal | External | Falsifier |
|---|---:|---:|---:|---|
| Production dispatch paths | 50 | 26 (52 %) | 24 (**48 %**) | count `50 > 50` is **false**; external `48 % > 30 %` is **true** |
| Including 7 bench / eval harness dispatchers | 57 | 26 (46 %) | 31 (**54 %**) | both halves **true** — fires |

Read literally as a conjunction, the falsifier fires on the wider boundary and
not on the narrower one. Read for what it was protecting against — an
unaffordable share of dispatches the field cannot reach from code — it fires on
both: 48 % is more than half again the bar.

**Why the external share is the load-bearing number.** An "external" site is
prose in a skill or command telling the model to spawn; there is no code line
where a caller could set `role` / `evidence_scope` by construction. For those 24
sites the field would be *model-set*, which is the same inference the field
exists to replace — moved from a regex over the prompt to a self-declared label
on the envelope. Phase 3 already pre-registers that as the adversarial question
(>10 % mislabelling ⇒ structured gates do not survive an adaptive model). The
census says nearly half the population would enter Phase 2 already in Phase 3's
failure mode.

**The envelope today carries no intent field at all.** `envelope.ts` is
transport-only. The one intent-shaped field in the tree — `role_mode` on
`subagent_spawn.ts:37` — has **zero production call sites**; `composeSpawnBrief`
is referenced only by docs and its own tests. So Phase 2 is not "add a field to
an existing mechanism"; it is building the mechanism and the field together.

## Consequence for Phases 2–3

Phase 2 is written conditionally — *"the structured field, if Phase 1 supports
it"*. On the roadmap's own pre-registered bars, Phase 1 does not support it:

- the risk Phase 2 buys down (false negatives) measures **0 in 128 sessions**;
- the cost bar it had to clear is **exceeded on the external share** in both
  boundary readings;
- and the sub-population where the field would work by construction is the 52 %
  that is *already* least likely to steer an evaluator, because those prompts
  are authored by repo code rather than composed in the moment.

That is a published null on the mechanism, not on the problem. The problem
1.2 surfaces — this guard is the only control — is real and unaddressed by
either the advisory status or the field.

## Phase 4 — pre- vs post-expansion

Recorded in `docs/contracts/hook-architecture-v1.md` § *What text a guard
actually receives*. Two points belong here rather than in the contract, because
they are about how the answer was obtained:

**The step's verify condition was not met, and that is the result.** It asked for
a worked example per guard *taken from a real envelope*. No captured envelope
exists in the tree — the sole hook fixture is hand-authored and its README
forbids real content — so the honest outcome is "by construction, and here is
what would settle it" rather than a fabricated example. The capture rig
(`AGENT_HOOK_CAPTURE_DIR`, which writes raw stdin before the envelope is built)
is the procedure; running it needs a host-environment change.

**One probe was designed and deliberately not run.** The clean discriminator is
to assemble a blocked token at runtime (`A=-; B=n; git log $A$B 1`) and see
whether the guard still refuses. It would have settled the shell half on a live
host in one command, with a read-only payload. It was not run: `block-no-verify`
states that a legitimate bypass requires a human action outside the agent
session, and assembling a token specifically to get past it is that bypass in
form regardless of how harmless the payload is. Recording the refusal is worth
more than the datum — the alternative reading, that a measurement purpose
licenses evading a guard, is exactly the reasoning this whole roadmap exists to
close off.

What was taken instead is a positive observation that required no evasion: a
literal `-n` inside a `git log` command was refused by the live guard, which
confirms it reads the model-emitted text and that transport delivers it intact.

## Council attempt on the Phase 2–3 disposition — INCONCLUSIVE

Convened 2026-08-12 on which disposition Phases 2–3 should take given the three
measurements. Result: **0/2 members present, `cli_quota_exhausted` on both**
(anthropic 148/50, openai 152/50). Recorded rather than silently replaced: the
mandated mechanism was unavailable, and a solo verdict presented in its place
would be the substitution `council-availability` forbids. The question file is
preserved under the local council questions directory (gitignored, and pruned on
the session-retention window) for a re-run once quota resets; its four options
are reproduced in the roadmap's own Phase 2 disposition note, so the decision
survives that prune.
