---
proposed_by: claude-code session 5413debc (roadmap-process-full run, 2026-09-29)
implemented_by: claude-code session 5413debc (same session — see § Independence)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai)
providers: [anthropic, openai]
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/kernel-guards-plumbing`

## What was proposed

Phases 1, 2 and 4 of `road-to-a-kernel-that-guards-its-plumbing`. Five
governance surfaces:

| Surface | Change |
|---|---|
| `src/config/gate-coverage.yml` | two rows — `lint_deny_text`, `lint_exit_codes`, both `status: enforced` |
| `.github/workflows/consistency.yml` | one step invoking both directly |
| `Taskfile.yml` · `taskfiles/ci-fast.yml` | one task definition, two chain entries |
| `src/scripts/hook_manifest.yaml` | the new `block-plumbing-writes` concern |
| `src/scripts/check_kernel_edit_ratified.ts` | `PLUMBING_SOURCE_RE` — five plumbing source paths now require a ratification artifact |

Phase 3 is **left open** with its blocker recorded; the roadmap is **not
archived**.

## Why `ratified`

Both seats, unprompted and independently: a new `status: enforced` gate creates
a new condition on which CI may block, and this branch goes further — it adds a
tool-call deny (`block_plumbing_writes`) and a per-key settings fence
(`block_config_weakening` class-c) that refuse at RUNTIME rather than at CI.
One seat put the consequence plainly: runtime denial does not change the label,
but it raises the evidence bar, because a false positive interrupts work
immediately rather than at review time.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` are the same session — the shape the Iron
Law forbids reviewing itself, which is why `reviewed_by` is the AI council: two
seats, two providers, neither of them the party that wrote the diff.
`council:quorum · 2/2 present`.

## What the review found — three blockers, all real, all fixed

The verdict was `ratified` **conditional on three defects being fixed before
merge**. They share one shape: a gate claiming more than it checked.

1. **`lint_exit_codes` counted an unreadable file as clean.** It skipped a file
   it could not read and then marked it complete — a false green with a number
   behind it, which is the exact shape `assertScanned` refuses one level up,
   reintroduced inside the loop. Unreadable files are now named and the gate
   exits 2. Probed live against a `chmod 000` fixture.

2. **The Class C fence modelled the wrong edit.** It applied `old_string` once,
   but the host's `replace_all` flag changes which text the edit produces — so
   a `replace_all` edit whose *second* occurrence was the Class C key passed
   the guard while the real edit changed it. Both modes are modelled now, and a
   `replace_all` value the guard cannot interpret refuses rather than guessing.
   The regression test asserts **both** directions against the same strings,
   which is what makes it a test about the flag rather than about the keys.

3. **The package root was resolved by hop count.** `path.resolve(dirname,
   '..','..','..')` is source-layout-relative; inlined into
   `dist/hooks/dispatch.js` every module shares the BUNDLE's `import.meta.url`,
   so the guard would read the contract from a different root — or none, and
   then fail closed on every settings edit in a consumer install. It now walks
   up to the nearest directory that actually carries the contract and returns
   `null` rather than a default. A packaging regression test pins
   `docs/contracts/settings-classes.md` in `files[]`, because the fence is only
   reachable in a consumer while it ships.

Each fix carries a sensitivity probe: reverting the `replace_all` modelling
reds its case, reverting the root search reds the null case, and the
unreadable-file path was probed against the real binary. Nothing else moves.

## What the reviewer checked, and what it could not

The complete governance diff, the full decision path of `lint_exit_codes`, and
the Class C fence. Both seats confirmed the per-key granularity is
load-bearing, that leaf-only path emission is correct (a Class C parent's
children carry no rows of their own, so walking up to the nearest classified
ancestor is what makes `hooks.injection_scan.enabled` resolve to C), and that
the `PLUMBING_SOURCE_RE` friction needs no carve-out — it is the ADR-268
mechanism already applied to kernel rules.

**Bounded out:** `block_plumbing_writes`' decision logic was truncated in the
supplied bundle (the council's 50 KB ceiling) and the test files were not
supplied. One seat said so explicitly and scoped its confidence accordingly.
That is a real gap in this record, not a formality: the guard's own tests pass
and its residual is declared in its header, but no independent party read them.

## What would have changed the verdict

Any of the three defects left unfixed. A settings fence on the FILE rather than
the key — both seats named per-key granularity as the thing that keeps it from
wedging ordinary work. A `PLUMBING_SOURCE_RE` carve-out added to reduce
friction, which one seat pre-emptively declined as unnecessary.

## Open, by the review's own note

Neither seat asked for the branch to be split. Phase 3 stays open because 3.3
requires an elapsed warn-only window and 3.2 a reference-runner measurement —
neither of which a session can declare done — and 3.1 edits the hot path of
every dispatch and was deliberately kept out of a diff carrying five governance
surfaces.
