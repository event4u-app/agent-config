---
complexity: lightweight
---

# Stub: road to the frontend-power live measurements

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated stub.
> Created 2026-08-23 when
> [`road-to-frontend-power`](../archive/road-to-frontend-power.md) was drained.
> Seven steps need something no repository automation supplies: **a real session
> on each of eight hosts, and a human**. Framework of record:
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> (rule 4 — no instrument → `B`; rule 3 — a human-judged comparison is not a
> council call). Outcome state on the parent: **transferred** — chosen so that
> "archived" can never read as "achieved".
>
> Disposition source: AI council 2026-08-23, `prompt-mode analysis`, **1 of 2
> seats returned** (openai/codex-default; anthropic/claude-sonnet-4-5 timed out
> at 290 s). Recorded as a single-seat verdict, never as convergence — the
> parent roadmap's own § Council escalation forbids reporting a non-zero-exit
> seat as agreement.

## The criteria, verbatim from the parent

> **E1.5 Tiering by experiment** — all-per-edit, immediate-plus-stop, or
> stop-only — on the 0.2 corpus. Source A's 13-rule immediate set (Apache-2.0,
> pinned `56f44523f`, path `scripts/hook-lib.mjs:113-131`) is one labelled
> candidate; its stated rationale is unbacked and is not adopted with it.
> `verify:` results published with the corpus hash, and the shipped default
> cites the row it came from.

> **R1.1** Run the layer-1 resolver prereg (T1–T4, `ADR-212:87-90`) on the 0.2
> frontend population, with the current declarative pipeline as the control and
> a multi-signal treatment (prompt, touched paths, audit artefact,
> `ui_authority`). A dated population note is added to the prereg; the
> thresholds themselves are unchanged.
> `verify:` numbers published with the corpus hash. **If the treatment is below
> T1–T4, lane R closes here with a published null and the declarative pipeline
> stays.**

> **R1.2 (conditional on R1.1)** Ship the frontend resolver as Class A,
> producing the A1.1 `ui_authority` object — it is A1's resolver, not a second
> one.
> `verify:` exactly one resolver produces `ui_authority`, and the process tree
> is empty after the command exits.

> **R2.1** Measure the catalogue-delivery failure on the 0.2 corpus, per host,
> carrying the archive roadmap's observations as the prior rather than as the
> result.
> `verify:` one delivery number per host, published with the corpus hash.

> **R2.2 (conditional on R2.1)** Local file transport first; stdio-lite MCP
> stays read-only and hosted transport is out of scope.
> `verify:` the transport-equivalence test passes and no execution path runs
> over MCP.

> **Z.1** Every 0.3 metric published with its corpus hash, per host; every
> failed prereg recorded as a null beside its falsifier.
> `verify:` the published set covers every metric named in
> `internal/bench/frontend-power-PREREG.md`, with none missing and none present
> that the prereg does not name.

> **Z.2 Blind A/B** — the baseline against lanes E and A (and R if it shipped)
> on the 0.2 corpus, with the margin committed before any result is read, plus a
> human spot-check.
> `verify:` the commit recording the margin precedes the commit recording the
> results.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| E1.5 tiering arms | Phase E1 | An arm is a *behavioural* comparison across real turns. The corpus supplies inputs; it cannot supply the turns. |
| R1.1 T1–T4 on the frontend population | Phase R1 | Blocked one level deeper than measurement — see § The R-lane finding below. |
| R1.2 ship the resolver | Phase R1 | Declared conditional on R1.1. Shipping it unmeasured is the build-then-justify pattern the parent's Risk 2 names. |
| R2.1 per-host catalogue delivery | Phase R2 | "Per host" is eight live sessions. A manifest read gives the *capability*, never the *delivery*. |
| R2.2 transport | Phase R2 | Declared conditional on R2.1. |
| Z.1 publish every metric | Phase Z | Six of the metrics it must cover are the ones above. Publishing the subset that exists would be a set the prereg does not name — the exact failure its verify forbids. |
| Z.2 blind A/B + human spot-check | Phase Z | Names a human. |

Nothing else transfers from lanes E, A or Z. Phase 0 ran in full. Lane E's
carriers, both Class-A commands and the whole of lane A landed and are
`[x]` on the parent.

## The R-lane finding, carried because it dies with the parent otherwise

**Lane R is not blocked at its bar. It is blocked upstream of it, by a
precondition that is not in the parent roadmap at all.**

`internal/bench/layer1-resolver-PREREG.md:125-126` records precondition **P1 —
per-prompt injection transport — as still OPEN**. P2 (a labelled corpus) and P3
are satisfied. R1.1 proposes to run T1–T4 with a "multi-signal treatment", and
there is no transport to run the treatment arm *through*.

That distinction decides the disposition. "Unmeasured" would route to a
measurement; **unrunnable** routes to a transfer, and a promoter who reads only
the parent will reach for the corpus and the thresholds and find both already
in place, then discover the gap at the arm. It is recorded here so they do not.

## Producer and probe — named, not wished

- **Producer for E1.5 / R2.1 / Z.1:** a maintainer running the suite across the
  host set with `hooks.design_pass.enabled: true`, one session per host.
- **Producer for R1.1 / R1.2:** whoever closes P1 in
  `internal/bench/layer1-resolver-PREREG.md`. Nobody else can, and no amount of
  frontend work substitutes.
- **Producer for Z.2:** a named human for the spot-check. Not delegable.
- **Probe — four readings, all cheap:**
  1. `grep -n 'P1' internal/bench/layer1-resolver-PREREG.md` → does P1 still
     read OPEN? Positive result unblocks R1.1 and only R1.1.
  2. `agent-config hooks:status` on the target host → is `design-pass` bound and
     enabled there?
  3. Does any file under `internal/bench/frontend-power/` carry a per-host
     delivery number with a corpus digest? Absent today.
  4. Is there a commit recording a Z.2 margin *before* a commit recording Z.2
     results? Absent today.
- **Measured on this machine, 2026-08-23, so a later reader can tell movement
  from noise** — each reading is recorded as the control, not as data:
  - P1: **OPEN** (`:125-126`), verbatim "P1 (per-prompt transport) remains open".
  - `design-pass` is **bound** on six `post_tool_use` chains and
    `design-pass-stop` on seven `stop` chains, and `hooks.design_pass.enabled`
    ships **false**. So the carrier exists and has never fired in anger.
  - Per-host delivery numbers: **none exist**. The frozen baseline
    (`internal/bench/frontend-power/BASELINE-2026-08-23.md`) records M-E1 and
    M-E2 as "not obtainable in this run" rather than as zero.
  - Z.2 margin commit: **none**.
  - Carrier **grades** are, by contrast, fully measured and stay on the parent:
    A = `claude`; B = `augment`, `cowork`, `cursor`, `cline`, `gemini`,
    `windsurf`; C = `copilot`. A grade is a manifest fact; a delivery rate is a
    session fact. Only the second one moved here.

## Promotion gates

The README's shared criteria (recruited customer, funded audit, ADR sign-off) do
**not** govern this stub. These do:

1. **Per item, never per file.** Reading 1 alone unblocks R1.1; it says nothing
   about Z.2. Delete a row when it lands; delete the file when the last row goes.
2. **R1.2 and R2.2 stay shut until their own arm clears its bar.** They are
   conditional in the parent and the condition does not weaken by being moved.
3. **Z.2's margin is committed before its results are read.** A margin chosen
   after the numbers are visible is not blind, at any sample size.

## Seed content on promotion

- Enable `hooks.design_pass.enabled` on the target host and run one real session
  per host before comparing anything. The carrier has never fired; a first-run
  false-positive rate is a finding, not a nuisance.
- Score against the frozen corpus digest
  `bf5d0a852d8c1538621ac967c6e36125d81c534083cb680dcbc1a4ff0033b208` and cite
  it. `./scripts-run src/scripts/frontend_corpus_hash --check` refuses a drifted
  population.
- **Do not measure M1 on `tests/eval/frontend-corpus/`.** That corpus was
  authored by the same run that wrote the T7/T8 register scope. The clean
  population is `internal/bench/corpora/design-slop-clean/`, and the prohibition
  is in the prereg because the ordering mitigation the parent specified controls
  sequence and not authorship.
- Respect the power floor: below 12 scored cases on a grade, or a single host
  presented as a suite figure, publish it as an anecdote or not at all.

## Graft from the 2026-08-24 inbox drain

A frontend roadmap draft arriving in that run (`Draft C`, held in
`agents/tmp.old/nxt-lvl-frontend/`, not landed) proposed a two-tier detector
economics lane: tier every deterministic rule `immediate` or `deferred`, run the
deferred registry at Stop against touched UI files with deduplication, name the
state owner or record a null, and preserve the hot-path latency budget while
measuring the Stop pass separately.

**Adjudicated into E1.5, and it adds nothing.** That is the finding, and it is
recorded rather than filled in:

- E1.5 above already states the experiment as **three named arms** —
  all-per-edit, immediate-plus-stop, stop-only — on the 0.2 corpus. Draft C's
  four phases describe the *second* arm only, as an implementation to build.
  An arm you can only build is not a comparison.
- E1.5 already names the corpus and requires results published with its hash and
  the shipped default citing the row it came from. Draft C named no corpus and
  no publication requirement.
- Draft C's state-ownership phase ("reuse an existing ledger if fit for purpose;
  otherwise record the null instead of inventing a new persistent subsystem") is
  a discipline this stub's § Producer and probe already applies to every row.
- Draft C's latency phase measures a hot path whose carrier
  (`hooks.design_pass.enabled`) ships **false** and, per the control reading
  above, has never fired in anger. It would measure the same absent thing.

So nothing is added to § The criteria, § What moves here, § Promotion gates, or
§ Seed content. The blocker is unchanged and is the same one E1.5 already
records: **a maintainer running the suite across real sessions**, one per host.
Draft C supplies inputs; it does not supply the turns.

The one thing worth carrying forward is negative and cheap to state: a promoter
who reads Draft C first may believe the tiering work is unstarted design. It is
not — it is a specified experiment blocked on session time, and building
Draft C's single arm would produce the immediate-plus-stop implementation with
no comparison to the other two, which is the shape E1.5 exists to prevent.
