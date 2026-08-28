<!-- evidence-type: analysis -->

# Consumption-acknowledgment adoption — measured at 0 %, and the denominator is 1

> `road-to-runtime-event-journal` step 3.3, measured 2026-08-28 on
> `drain/runtime-event-journal` at `3d684bdf5`, in the same change that adds the
> field. Risk 5 of that roadmap names this exact outcome as the thing to publish
> rather than re-scope: *"a field nobody fills makes the ignored-blocker detector
> look green while measuring nothing."* This is that measurement, and it lands
> where the risk predicted.

## The question

What share of returns carry a consumption acknowledgment?

## Method

The population is *returns constructed through
`src/scripts/_lib/outcome_envelope.ts`* — the tree's sole return channel, per
the roadmap's own "will NOT build" clause ("there is no second envelope"). It is
NOT every function that returns a value, and it is not the unrelated `envelope`
symbols in `src/scripts/hooks/envelope.ts` or the local helper in
`tests/scripts/orchestration_record_hook.test.ts`, both of which are a different
function of the same name.

```bash
# the population — every file that imports the return channel
grep -rl "_lib/outcome_envelope" src tests --include="*.ts"

# denominator — production construction sites (src/, excluding tests)
grep -rn "envelope({" src --include="*.ts" | grep -v "\.test\.ts"

# numerator — sites passing an acknowledgment, plus every acknowledge() caller
grep -rn "acknowledgment:" src --include="*.ts" | grep -v "\.test\.ts" \
  | grep -v "_lib/outcome_envelope.ts"
grep -rn "acknowledge(" src --include="*.ts" | grep -v "_lib/"
```

## The result

| Measure | Count |
|---|---:|
| Files importing the return channel (production) | **1** |
| Production `envelope({…})` construction sites — **the denominator** | **1** |
| …of those, carrying an acknowledgment at construction | **0** |
| `acknowledge()` call sites outside `_lib/` | **0** |
| **Adoption share** | **0 % (0 / 1)** |

The single denominator site is `src/scripts/lint_host_portability.ts:332`.

The one hit for `acknowledgment:` outside the envelope module is
`src/scripts/_lib/ignored_blocker.ts:124`, where the detector *rehydrates* a
journal row's `consumption` column into an acknowledgment in order to test it.
That is the reader, not a producer, so it is excluded from the numerator. Had it
been counted the share would read 100 %, which is the shape of an adoption
metric measuring its own instrument.

## The second denominator, which is worse and is the real finding

The share above (0 / 1) understates how empty this is, because the denominator
itself is nearly empty and its one member does not fire.

1. **The one construction site is behind `--json`.** Lines 331–345 of
   `lint_host_portability.ts` build the envelope only when `argv` contains
   `--json`.
2. **Nothing in the tree passes `--json` to it.** The sole invocation is
   `taskfiles/ci-fast.yml:1373` — `./scripts-run src/scripts/lint_host_portability
   {{.QUIET_FLAG}}`. Grepping the task tree for a `--json` invocation of this
   script returns **0**.
3. **So the count of envelopes actually constructed on the tree's own execution
   path is 0**, and the count of orchestrator-side *consumers* that receive one
   and could acknowledge it is also **0**.

That makes the honest verdict sharper than "adoption is low": with no consumer,
the acknowledgment rate is **undefined**, not merely zero. There is nobody to
fill the field. `0 / 1` is the number a reproducible grep yields; `0 / 0` is what
the runtime population actually is.

## What this does and does not license

**Does not license** any claim that the ignored-blocker detector is measuring
ignored blockers in this tree. It is measuring an empty set. A green detector
here is Risk 5 realised, exactly as written, and it is recorded as such rather
than reported as a pass.

**Does license** the two claims the phase actually makes: the field set exists
and the type system enforces the `rejected-with-reason` pairing (Phase 3.1), and
the predicate answers correctly over a fixture population in both directions,
with its sensitivity established by neutralising the core condition and
observing the tests fail (`tests/scripts/envelope_consumption*.test.ts`).

## What would move this number

Not a nudge, and not a wider grep. Two structural things, in order:

1. **A consumer.** Adoption cannot exceed the number of call sites that receive
   an envelope and decide something. Today that is zero. Until an orchestrator
   consumes a return in-process, `acknowledge()` has no caller by construction.
2. **The journal (Phases 1–2).** The runtime denominator — how many returns are
   actually produced per run, as opposed to how many `envelope({` literals exist
   in the source — is not measurable by grep at all. It needs the durable record
   this roadmap's earlier phases write. Stated plainly because it bounds this
   file: **every figure above is a static source count, not a runtime one.**

## Re-measure

Re-running the four commands under § Method reproduces every figure in the table
at the stated pin. The `--json` claim is checkable with
`grep -rn "lint_host_portability" taskfiles Taskfile.yml | grep -c json` → `0`.
