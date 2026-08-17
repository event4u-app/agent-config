<!-- evidence-type: analysis -->

# Ownership map for the mixed-trigger-cleanup roadmap cohort

**Source:** `agents/tmp.old/mixed-trigger-cleanup/roadmap-deltas-2026-08-17.md`
**Adopted:** 2026-08-17 via `/analyze:inbox`
**Verified against:** `origin/main` @ `097ab6549`
**Drafted against:** `de76c38b932d1612d36cfc85d6b9fbaff4832350`

This is **not** a roadmap. It is the record of which scope in the seven-roadmap
cohort was cut because an existing owner already holds it, so a future review does
not re-derive the merge — and does not re-open scope that was deliberately handed
away. The rule applied throughout is this repo's own council-confirmed pattern:
**extend an existing owner, never spawn a sibling for owned scope.**

## Why this is an analysis artefact and not a roadmap

The source document is a change log. Its § C deltas were applied into the roadmap
drafts themselves before handover, and this adoption folded each supersession note
into the roadmap it constrains. What has no home in any single roadmap is the
*map* — and a map that lives inside one of the seven files would be invisible from
the other six.

## The existing owners, and what each one takes

| Owner | Holds | Cohort scope cut or deferred |
|---|---|---|
| `later/road-to-request-scoped-rule-load` (34/36 done, **resume condition fired**) | Consumer rule scoping | `road-to-standing-context-40k` Phase 1 shrinks to a resumption evidence note. `road-to-mixed-trigger-activation-cost` Phase 2's interlock defers the five maintainer-only rules here — consumer relief comes from scoping the *install*, not the emitter |
| `later/road-to-deferred-rule-retriever` (gated on the registered `rules_efficiency` metric) | The rule runtime-carrier question, with a pre-registered comparison against the shipped lexical core | `road-to-standing-context-40k` Phase 3's fork option (a) as originally drafted — a `rule-route` hook sibling — is **dropped**, on two grounds: it duplicates this owner, and it collides with the recorded non-goal below |
| `road-to-cost-parity-1-rule-payload-diet` (active, standalone tranche authorised) | Skill-cluster consolidation, the per-rule norm line under a drift lint, and the hook chain-length cap | `road-to-per-turn-hook-economy` Phase 4 lands as an extension of its chain-cap steps rather than a free-standing budget row. `road-to-catalogue-host-fit` Phase 2 cuts count-reduction-by-consolidation and keeps only projection scoping. `road-to-standing-context-40k` Phase 2 sequences after the norm-line lint exists |
| `road-to-user-out-of-the-loop` (active) | Ask reduction *inside* a roadmap run, and the single decision-sheet surface | `road-to-gate-autonomy` feeds that surface and does not build one; `road-to-estate-drawdown` Phase 0 reuses its shape |
| `archive/road-to-rule-delivery-integrity` (closed) | The double-delivery measurement, the installer layer gate, the suppression path, and the host-side catalogue-loss finding | `road-to-standing-context-40k` gains Phase 0 from it rather than re-measuring. `road-to-catalogue-host-fit` inherits the refutation of the missing-descriptions hypothesis |
| `road-to-skill-description-measurement` (ready) | The selection-accuracy baseline behind the live trigger eval | `road-to-catalogue-host-fit` Phase 0 runs the eval it waits on; the eval's own pre-registration owns the parameters |

## Recorded non-goals the cohort inherits

Carried verbatim so no phase re-opens them:

- **No hook that matches keywords and injects rule bodies.** Keyword matching is
  already measured weak in this repo, and the `intent:` field was retired on exactly
  that finding. Note the boundary: an `if` prefilter on a tool event is host-side
  path and command matching, not keyword matching over the prompt, so
  `road-to-mixed-trigger-activation-cost` step 2.3 does not fall under this.
- **No bulk skill deletion.** The usage census refuses to be read as a rate, and
  cutting on it would be cutting on an instrument that says so.
- **No extrapolation of one host's catalogue limit to another.** The library refuses
  it by construction.
- **The Hard Floor never falls.** Merges, pushes, deploys, kernel edits and their
  soak, the DPO signoff, and judge independence are class 3 in
  `road-to-gate-autonomy` and anti-goals everywhere in the cohort.

## Verification corrections to the source document

Four findings from the adoption pass that change what the source said:

1. **The three PRs its § A analysed as open are all merged** (`097ab6549`,
   `01ec331ab`, `f0675de95`). Its verdicts are settled rather than pending, and the
   twelfth `pre_tool_use` concern it flagged as a coming cost is live. The
   consequence it drew stands and strengthens: the chain grows faster than the cap
   that should govern it, and the cap's own recorded baseline is stale in the
   growing direction.
2. **The one-command field check is refuted as a discriminator.**
   `grep -l '^paths:' .claude/rules/*.md | wc -l` returns **0** on a maintainer
   machine, not the 6 the source predicts, because the local projection emits no
   `paths:` for any rule — including the six that carry only path triggers. It
   therefore cannot separate "the activation flip is live here" from "this
   projection was built at a different scope". The replacement is a source-reading
   census; it is step 1.0 of `road-to-mixed-trigger-activation-cost` and step 0.0 of
   `road-to-per-turn-hook-economy`.
3. **The PHP-toolchain concern behind the stop gate's verify audit is overtaken.**
   `_VERIFY_RE` already matches bare `phpunit` and `pest`, and `composer` and
   `php artisan` followed by a verify-shaped subcommand. The audit in
   `road-to-stop-gate-honesty` step 2.2 is narrowed to commands not on that list.
4. **The +20.4k token figure is a character proxy, not an exact-BPE measurement.**
   81,691 bytes divided by four. The repo ships an exact tokenizer, and
   `road-to-mixed-trigger-activation-cost` Phase 4 requires it for the committed
   census baseline. The ~13,630-token figure in the emitter commit measures a
   different quantity — the structural subset — so the two do not contradict, but
   neither is an exact measurement of what the flip added.

## Two estate-level findings, and where they now live

- **Fired-but-unresumed trigger.** A resume condition closed and nothing resumed
  the parked roadmap. A liveness probe over `later/` park notes catches the class
  mechanically, and it is `road-to-gate-autonomy` Phase 4 with that case as its
  regression fixture.
- **A stale chain-length baseline while the chain grows.** The cap's recorded
  census is aging in the opposite direction from the surface it caps. The refresh
  is `road-to-per-turn-hook-economy` step 4.3, in the same PR as the composite it
  shares a surface with.

## What the cohort exclusively owns after the merge

1. Serialize-once, payload opt-in, and de-spawning the two per-event spawns.
2. The per-turn latency composite, as an extension of the chain cap.
3. The per-turn injection aggregate cap.
4. Stop-gate refusal measurement and everything downstream of it.
5. The catalogue observation cadence, the host-honest pointer filter, and
   projection scoping of skills.
6. The activation-flip re-adjudication and its census ratchet.
7. The verification runbook for the reported regression.
