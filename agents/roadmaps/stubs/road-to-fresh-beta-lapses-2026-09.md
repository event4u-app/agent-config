---
complexity: lightweight
review_by: 2026-09-15
---

# Stub: six beta contracts lapse fresh between 2026-09-10 and 2026-09-15

> **FIRED — the first of the six lapsed on 2026-09-10 and is now red.**
> `docs/contracts/release-sizing.md` carries `keep-beta-until: 2026-09-10`, the
> date passed, and `check_beta_review_markers` now exits 1 on **every** pull
> request in the repository — not only on changes to that contract's surface.
> First observed 2026-09-11 on PR #2003, whose diff is markdown under
> `agents/` and touches no contract at all; `main`'s last Consistency run was
> 2026-09-10T22:10Z, before the date rolled, so `main` is green only because
> nothing has re-run there since.
>
> Nothing was decided here and nothing was edited under time pressure, which is
> what this stub exists to prevent. The four legal actions below are unchanged
> and all four remain owner-reserved; this line records that the prediction came
> true on schedule, so the next reader meets a fired condition rather than an
> upcoming one.
>
> **The horizon re-read on 2026-09-11**, because the set is not the six this
> stub was written about. `check_beta_review_markers --horizon 14` now reports
> **six upcoming fresh lapses**: `harness-expectations.md`, `install-layout.md`,
> `install-scopes.md` and `surface-tiers.md` on 2026-09-15 (4 days), plus
> `auto-orchestration-v1.md` on 2026-09-23 and `write-engine.md` on 2026-09-24 —
> the last two are **not** in the original six and are new to this stub.
> `reasoning-discipline-protocol.md` no longer appears in the upcoming set at
> all; its disposition is recorded in the analysis this stub already cites, and
> nothing in this edit re-opens it.

> **Council, 2026-09-11, on `release-sizing.md` specifically — extend or
> promote.** Two seats (anthropic/claude-sonnet-4-5, openai/codex-default), two
> rounds, peer-review, blind chairman, subscription transport, nothing billed.
> Both **final** texts answered *promote to stable*, on the policy's own stated
> criterion: the contract has not changed since the day it was written 63 days
> ago, it is the normative source for a live changelog gate, it is referenced
> from consumer-facing distribution documentation, and it passed through a major
> release. Both seats also agreed the decision RULE generalises to the four
> contracts lapsing 2026-09-15 while the RESULT does not — each is evaluated on
> passage through a major, real enforcement or reliance, and known pending
> incompatible change.
>
> **It is not a clean 2/2, and the reason is a fact the council did not have.**
> One seat listed, among the conditions that would flip it: *"15.0.0 shipped
> this morning and post-release testing is incomplete. If the merge happened
> hours ago, extend 30 days"* — and resolved it by guessing the merge was
> "yesterday or earlier". It was **5 h 09 min** before the run (merged
> 2026-09-10T22:10:26Z, council 2026-09-11T03:19Z). That seat's own stated flip
> condition is met on the evidence, so its answer is not the one its text
> records. The other seat weighed the same proximity explicitly, called it the
> strongest counter-argument, and stayed on promote because live enforcement and
> consumer references resolve it.
>
> The peer-review stage produced the thing the extend option was missing — a
> falsifiable readiness condition: *extend roughly 60 days, promote once the
> first post-15.0.0 minor ships without requiring a scope-discipline revision.*
> That is now a real option rather than a deadline moved because a deadline
> arrived.
>
> **Nothing was executed.** Promotion creates a public compatibility commitment
> (a breaking change would then require a major), which `decision-revisit-gate`
> reserves to the owner, and a council split is an escalation condition rather
> than a verdict. One further caution the council raised and this record keeps:
> the blocked pull request establishes urgency, never which answer is correct.

> **Stub — not active work.** It exists so that six dates inside two weeks are
> reachable by grep from a non-archived roadmap, and so that each has an owner
> before it fires rather than on the day it does. Created by
> `road-to-a-beta-window-that-is-not-a-surprise` step 3.1.

## Why these six are different from the other 84

`src/config/lapsed-beta-baseline.json` holds 85 entries. A lapsed contract
**in** that list is an inherited warning and the gate still exits 0. A lapsed
contract **not** in it is a FRESH lapse, `LAPSED_SEVERITY_FRESH = 'error'`, and
the gate exits 1 — which reds **every** pull request in the repository, not
only changes to the contract's own surface.

The baseline is frozen and **may not grow**. So none of the six below can be
absorbed into it; each has to be promoted, extended, superseded, or accepted.

## The six, as reported on 2026-09-06

```
$ ./scripts-run src/scripts/check_beta_review_markers
Upcoming FRESH lapses within 14 day(s) — advisory, exit code unchanged:
   docs/contracts/release-sizing.md               2026-09-10   4 day(s)
   docs/contracts/reasoning-discipline-protocol.md 2026-09-14  8 day(s)
   docs/contracts/harness-expectations.md         2026-09-15   9 day(s)
   docs/contracts/install-layout.md               2026-09-15   9 day(s)
   docs/contracts/install-scopes.md               2026-09-15   9 day(s)
   docs/contracts/surface-tiers.md                2026-09-15   9 day(s)
```

**`release-sizing.md` is the nearest and was the least expected.** The roadmap
that produced this stub was written about `reasoning-discipline-protocol.md`
and named no other contract; the horizon report it asked for found a contract
lapsing four days sooner. That is the mechanism working on its first run.

## Why this is not active work

Each of the three legal actions — `stability: stable`, a new `keep-beta-until`
at most 90 days out with a stated reason, or `superseded-by:` — is a public
statement about what consumers may rely on. `decision-revisit-gate`'s reserved
set puts creating, removing or weakening a public commitment out of agent
reach, in either direction.

An AI council was asked twice on 2026-09-06 under a maintainer delegation and
declined to take the substantive decision in either round; the reasoning and the
accepted consequence are recorded at
`agents/evidence/analysis/rdp-beta-window-lapse-accepted-2026-09-06.md`. The
lapse of `reasoning-discipline-protocol.md` is **accepted, not avoided** — no
date was moved. The other five carry the same reservation and no separate
council round; they are named here because the roadmap's Goal is that no beta
contract reaches its date unowned, and owning one of six would not meet it.

## What to do, and by when

**Per contract, before its date**, exactly one of:

1. **Promote** — set `stability: stable` and delete the `keep-beta-until` line.
2. **Extend** — a new date at most 90 days out, with the reason in the same
   edit. `MAX_REVIEW_WINDOW_DAYS = 90` is enforced; a date beyond it is its own
   error.
3. **Supersede** — add `superseded-by: <contract-id>`.
4. **Accept the lapse**, in a record that names it, as was done for
   `reasoning-discipline-protocol.md`.

Doing nothing is not a fifth option: it selects (4) without the record, and the
repository reds until someone edits a contract under time pressure.

## Verification

```bash
./scripts-run src/scripts/check_beta_review_markers --horizon 14 | tail -8
./scripts-run src/scripts/check_beta_review_markers > /dev/null; echo "exit=$?"
```

The first names the set that is still unowned. The second is 0 while every
lapse is inherited and 1 from the first fresh one.
