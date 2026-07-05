# A3 — `production-validator` Gate-A eval results

> Real-session run of the `pv-*` corpus (see [`README.md`](README.md) § A3),
> operator-authorised 2026-07-05. Three arms per task, each a fresh independent
> agent given only the task prompt + the fixture path (no orchestrator priming).
> `token_delta_provenance: measured` — token counts are the real per-subagent
> usage reported by the `Task` tool, not estimated.

## Arms

1. **inline host** — a plain capable agent answers directly (no reviewer identity).
2. **generic inline dispatch** — a generic "code reviewer" agent, no `production-validator` identity.
3. **production-validator** — the shipped wedge subagent.

## Results

| task | arm | verdict | verdict_changed_outcome | subagent_tokens | token_delta (vs inline host) | verify_mode |
|---|---|---|---|---|---|---|
| pv-01 hollow | inline host | NOT READY (`charge.ts:13`) | — (baseline) | 274,940 | — | deterministic |
| pv-01 hollow | generic dispatch | NOT READY (`charge.ts:13`) | false | 274,941 | +1 | deterministic |
| pv-01 hollow | production-validator | NOT READY (`charge.ts:13`) | **false** | 229,663 | **−45,277** | deterministic |
| pv-02 control | inline host | READY | — (baseline) | 274,393 | — | deterministic |
| pv-02 control | generic dispatch | READY | false | 274,393 | 0 | deterministic |
| pv-02 control | production-validator | READY | **false** | 229,053 | **−45,340** | deterministic |

All six citations are checkable against the planted fixture: pv-01 arms all cite
the hard-coded `return { ok: true, transactionId: 'mock_txn_00000000' }` at
`charge.ts:13` (with the `TODO` at line 11); pv-02 arms all correctly find no
blocker on the clean `slugify.ts`.

## Gate-A verdict — HONEST NULL (unit stays default-off)

**pv-01 (positive case): no lift.** Gate A ships the unit only if
`production-validator` flips a **false baseline READY → NOT READY** that a
baseline missed. Here **no baseline was fooled** — both the inline host and the
generic reviewer read the source, saw the hard-coded return + `TODO`, and
already returned NOT READY. `production-validator` returned the same verdict, so
`verdict_changed_outcome: false`. Per ADR-109 Gate A / the corpus rule: *"If no
baseline is fooled on pv-01, there is no lift — record the honest null and the
unit stays default-off."*

**pv-02 (negative control): passes.** Every arm — including
`production-validator` — returned READY (`verdict_changed_outcome: false`); no
spurious blocker was invented on clean code. The control does not fail the gate.
This is the one clean signal: the subagent is correctly **silent when there is
nothing to catch**.

**Net:** the control is clean but the positive case shows zero verdict lift, so
`production-validator` does **not** clear Gate A on this eval. It remains
default-off in `src/` (already `discovery.visible: false`,
`requires_capability: claude_subagents`), exactly as ADR-109 Gate A prescribes.

### Why the baseline was not fooled (the finding under the finding)

The fixture's premise — *"a naive tests-pass → done reviewer says READY"* — did
not hold. Given the **source file** (not just the green test), a capable
2026-era baseline agent reads the code and catches the hollow path unaided. The
trap only traps a reviewer that looks at the test result without reading the
implementation; the arms all read the implementation. So on this task the
subagent's discipline is already the baseline's behaviour.

### Honest limitations (do not over-read this result)

- **N=1 per arm.** The corpus README calls for ≥ 20 dispatches per entry to
  reduce variance; this is a single directional sample, not a statistically
  robust gate. The direction (baselines not fooled) is clear and consistent
  across both baseline arms, but a promotion/retirement decision (D3) needs the
  fuller run and, above all, **real external-adopter tasks**, not this static
  fixture.
- **Favourable token_delta is not lift.** `production-validator` was ~16% cheaper
  than the general-purpose baselines (tighter tool grant + prompt), but cost is
  not the gate — verdict lift is, and there was none.
- The stronger signal remains real `ask`-mode telemetry from diverse tasks
  (feeds D3), not this controlled fixture.
