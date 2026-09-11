<!-- evidence-type: analysis -->

# The four contracts lapsing 2026-09-15, evaluated one at a time

Read 2026-09-11. The four are `harness-expectations`, `install-layout`,
`install-scopes` and `surface-tiers`, all carrying `keep-beta-until:
2026-09-15`. `check_beta_review_markers` reports them as **fresh** lapses —
absent from the frozen 85-entry baseline — so on 2026-09-15 each becomes an
ERROR rather than an inherited warning.

Evaluated against the three graduation criteria recorded in
`stubs/road-to-evidence-driven-stability.md`, and **against no date**: stability
is evidence-driven, a passed window means at most that a maturity decision is
due, and no criterion here contains an elapsed-time term. No contract is given a
new deadline by this reading.

1. **Active enforcement or real exercise** — something runs, and it runs against
   this contract rather than beside it.
2. **Consumer reliance** — a surface a consumer actually reads or depends on
   references it.
3. **No known pending incompatible change.**

## `surface-tiers` — all three met

| | Evidence |
|---|---|
| 1 | `check_surface_tiers` runs in `taskfiles/ci-fast.yml:1810`, and `tests/scripts/check_surface_tiers.test.ts` holds it to golden parity over both a fixture repo and the real tree. |
| 2 | `surface_tier` is read by `install.ts`, `_lib/scoped_projection.ts`, `generate_pack_manifests.ts`, `schemas/pack.schema.json`, `src/config/discovery/packs.yml`, `lint_legal_pack` and `lint_pack_risk_class`. |
| 3 | None found. The split is council-locked (2026-06-17) and the Python→TS port (ADR-200) is complete. |

**Promotable on evidence.** Nothing in this contract is waiting on anything.

## `install-layout` — criterion 1 fails **as the contract states it**

| | Evidence |
|---|---|
| 1 | Split. The layout IS exercised on every install: `installed_lock.ts` writes `install_layout_version`, refuses an unreadable lockfile, and carries a migration path that `install.ts:3586` reads. But the contract calls itself "the **frozen source** the install-ABI conformance test (`tests/test_install_layout_contract.py`) guards against" — **that file does not exist**, and `tests/fixtures/install_layout_v1.json` is read by nothing in the tree. |
| 2 | `BREAKING_CHANGES.md`, `docs/architecture.md`, `docs/contracts/conformance.md`, `docs/positioning-evidence.md`, and the installer itself. |
| 3 | None found. |

The defect is the same class the 2026-09-04 council run repaired on
`install-scopes`: a contract citing a guard that is not there. It is repairable
in either direction and both are small — port the conformance test against the
frozen fixture, or delete the sentence and say the lockfile version is what
carries the ABI. **Not promotable while the contract advertises a guard the tree
does not have**, because that is precisely a false `stability: stable` claim
against an objectively measurable criterion.

## `install-scopes` — criterion 1 fails; criterion 3's stated blocker is **stale**

| | Evidence |
|---|---|
| 1 | The `scope_guard` pre-flight and `cleanup_other_scope.sh` are real and shipped. The **safety regression the contract cites is absent** — `tests/test_cleanup_other_scope.py` exists under no extension, which the contract itself records at § 95 ("Safety regression — MISSING"). Restoring it is a named precondition on its own window. |
| 2 | `README.md:125` (§ Install scope), `ONBOARDING.md` twice, and `install-layout.md` names it as its companion contract. |
| 3 | **The recorded objection no longer holds.** The `keep-beta-reason` says § 23 "works toward" an invariant "and the work that would achieve it — single-delivery Phase 2 — is recorded HALTED since 2026-08-19". Both `road-to-single-delivery.md` and its closure correction `road-to-single-delivery-closure.md` are now in `agents/roadmaps/archive/`, i.e. closed, and `task generate-tools` reports the partition holding on this tree ("project layer carries only what ~/.claude lacks — host layer verified at 15.0.0"). |

So this contract is held beta by a reason that describes a world from three weeks
ago, plus one real gap. **The `keep-beta-reason` is wrong as written and should
be corrected whatever is decided about promotion** — a stale reason is how a
window renews itself on nobody's judgement.

## `harness-expectations` — one dead pointer, one borrowed precondition

| | Evidence |
|---|---|
| 1 | Diagnostic rather than enforced, which is its nature: it names three host behaviours the package cannot control and gives the probe (`task probe:skills`). But § 94 points at "`agents-md-thin-root` § Tool loading for the pattern" and **that skill has no such section and no mention of deferred tools** — the same defect the 2026-09-04 council run recorded against it, unrepaired. |
| 2 | `README.md:332`, `ONBOARDING.md` twice (including the first thing a new consumer is told to check), and `src/server/routes/wizard.ts`. Among the four, the strongest consumer reliance. |
| 3 | Its own window names one: "`install-scopes` reaches a non-beta disposition". That is a **borrowed** condition, not a property of this contract — it exists so the install-surface pair is reviewed together. |

Content-wise this is the closest of the four to promotable, which its own
`keep-beta-reason` already says. What blocks it is one broken pointer and one
sibling's disposition.

## What follows mechanically

On 2026-09-15 all four red. Under the recorded principle that is the wrong
outcome for every one of them — a date is not evidence — and the mechanical
change that removes `keep-beta-until` as a blocking gate is recorded in
`stubs/road-to-evidence-driven-stability.md` and not executed here.

Extending any of the four is excluded by the instruction this evaluation runs
under: no new deadline.

The repairs this reading names are small and independent of the promotion
decision: one missing conformance test or one deleted sentence
(`install-layout`), one missing regression (`install-scopes`), one corrected
`keep-beta-reason` (`install-scopes`), one repaired pointer
(`harness-expectations`). Promotion itself is a public compatibility commitment
and is not taken here.
