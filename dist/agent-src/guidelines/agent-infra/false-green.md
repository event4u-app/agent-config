# False Green — the ways a passing result can be wrong here

> Eleven failure modes, each with the detection command that distinguishes "found nothing" from "looked at nothing". Every one is drawn from this repository's own history, not from a generic checklist.

_Origin: `road-to-skill-ecosystem-gate-integrity` Phase 3. The recurring shape is not that a gate reports a wrong finding — it is that a gate reports **no** finding for a reason unrelated to the property it guards, and no output distinguishes the two cases._

## The catalogue

### 1. Dead scan root

The gate walks a directory that moved or was deleted. Zero units, zero findings,
exit 0, green checkmark. Fourteen gates in this tree were in this state
simultaneously after a container move; their own output said `0 file(s) scanned`
and nothing asserted on the number.

```bash
./scripts-run src/scripts/<gate> | grep -E '^scanned: '   # 0, or absent entirely
./scripts-run src/scripts/sweep_dead_scan_roots
```

**Structural fix:** `assertScanned` from `_lib/scan_scope.ts`. A gate that read
nothing has not passed.

### 2. Planned-but-never-judged targets

The root is alive and the corpus is real, but the loop `continue`s past most of
it on unwritten conditions. The published count says "enumerated", the reader
hears "checked". `lint_framework_leakage` published 438 while judging 368.

```bash
./scripts-run src/scripts/<gate> | grep 'ledger:'   # scanned=N planned=M — compare N and M
```

**Structural fix:** `_lib/gate_ledger.ts`. Every planned target reaches exactly
one terminal outcome, and the skip codes are counted per reason.

### 3. Allowlist growth

The gate is honest, the corpus is real, and the finding was suppressed. Count-
based ratchets cannot see swap-one-out-add-one-in: remove a real entry, add a
fresh suppression, the number is identical and the estate moved backwards.

```bash
./scripts-run src/scripts/check_suppression_hygiene     # entry SETS vs the base ref
git diff origin/main -- 'src/scripts/*allowlist*.json' 'src/config/*baselines*.json'
```

**Structural fix:** `_lib/ratchet_base_ref.ts` — compare entry sets against
`git show <baseRef>:<path>`, the one reading of the baseline the change under
review cannot rewrite.

### 4. Ratchet-entry deletion

Subtler than growth: deleting a baseline entry whose `count` is 0 is **weaker**
than leaving it, because the absence of an entry means "unbaselined" and an
unbaselined gate's `ok` flips to `actual === 0` with no recorded intent. Harden
first, then delete, and pin the absence.

```bash
git diff origin/main -- src/config/gate-violation-baselines.json | grep '^-'
```

### 5. Threshold re-anchoring

The gate still runs, the corpus is real, and the bar moved. A lowered floor and
a genuine improvement look identical in the exit code.

```bash
git diff origin/main -- src/config/gate-coverage.yml | grep -E '^[-+].*min_scanned'
git diff origin/main -- 'src/config/*budget*.json'
```

**Discriminator:** a legitimate ratchet lowers *severity* while keeping *reach*;
threshold-lowering reduces reach. Ask which one the diff does.

### 6. Suppression sweep

Not one entry — twenty. Allowlist growth past ~20 entries in a session is the
signal that the linter (or the content) is wrong, not that the list is short by
twenty. The tool-call guard blocks past that count; the honest response is to
fix the gate's shape.

```bash
./scripts-run src/scripts/check_suppression_hygiene | grep 'entry(ies)'
```

### 7. Crashed gate read as passing gate

A gate that throws is not a gate that passed, but an aggregator that only
inspects exit codes cannot tell an exception from a clean run when the harness
swallows it. Three of this repository's recorded traps are estate invalidation
misreported as a per-gate red, or the reverse.

```bash
./scripts-run src/scripts/<gate>; echo "EXIT=$?"     # capture BEFORE any $( )
```

**Structural fix:** capture `EXIT=$?` on the line immediately after the command,
never after a command substitution; and fail closed when a registered gate
reports a null or missing verdict.

### 8. A derived page reporting an unmeasured dimension

The generator has no data for a category and renders a `0`, or worse a computed
share, which reads as a measurement. The always-budget report printed `60.1%`
for a dimension it counted **zero** artefacts in.

```bash
./scripts-run src/scripts/check_derived_page_truthfulness   # where present
grep -rn '0%\|0 of 0' docs/*.md
```

**Structural fix:** an unmeasured category renders as absent or explicitly
"not measured" — never as a zero and never as a share.

### 9. Equality without validity

Two things are compared and found equal — because neither exists. `diff a b`
over two absent files returns equal; two empty lists both serialize to `[]`; an
empty rendered template equals an absent target file. The gate reports
"in sync" having compared nothing.

```bash
./scripts-run src/scripts/<gate>            # then delete ONE side and re-run
```

**Structural fix:** assert both sides exist and are well-formed BEFORE
comparing. Two absences are the absence of a comparison, not the presence of a
match. The estate-wide audit is below.

### 10. Hook-bypass override

The gate never ran because the hook that runs it was disabled for that
invocation. `git commit --no-verify` (and its short `-n` form) skips every
pre-commit hook; `core.hooksPath` repointed at an empty directory skips them
permanently and silently. Both produce a commit that looks exactly like a
commit whose hooks passed. The same shape reaches the runtime hook layer: a
concern bound in the manifest is still inert on a host that does not honour a
deny, so "the guard is registered" is not "the guard fired".

<!-- example-fence-allow: git-no-verify -- the fence teaches how to DETECT the core.hooksPath bypass; the forbidden form has to appear for the diagnostic to be readable, and every line here is a read-only query -->
```bash
git config --get core.hooksPath                       # empty = repo default, good
./scripts-run src/scripts/hooks/block_no_verify --help # the tool-call guard
agent-config hooks:status                             # per-host bindings, not the manifest
```

**Structural fix:** the bypass is blocked at tool-call time by
`block-no-verify` on the one host that honours a deny, and the authoritative
gate is remote CI, which no local override can skip. Never read a local green
as evidence when the hook path was overridden — re-run in CI, or run the gate
directly rather than through the hook.

### 11. Cached-green reuse

The green belongs to a different input than the one being judged. Three real
shapes here. A gate that reads `dist/agent-src/` passes against a **stale
projection** while the `src/` change it was meant to judge is not in the tree it
scanned — the recorded trap is a worktree whose stale `dist` faked generator
drift, and its mirror, a golden capture reading `dist` where the assertion was
about `src`. A count ratchet sits inside its limit for so long that "within
budget" stops meaning anything, which is why a baseline carries an expiry at
all. And the conversational form: trusting a verification run earlier in the
same session, after the tree has moved underneath it.

```bash
bash src/scripts/condense.sh --changed        # dist != rewrite(src) => the scan root is stale
./scripts-run src/scripts/check_condensation --summary   # byte-exactness dist vs rewrite(src)
```

**Structural fix:** regenerate before judging (`task sync` then
`task generate-tools`, in that order), and treat a baseline unchanged past
`STALE_AFTER_DAYS` (56, `_lib/gate_baseline.ts:39`) as suppression rather than
as headroom. A completion claim rests on a run made **after** the last edit, not
on the freshest run you happen to remember.

## The audited sync/parity gates

Comparison-shaped gates carry entry #9's failure mode by default: `diff a b`
where neither side exists returns **equal**. Audited 2026-08-05 across
`src/scripts/` — **27 comparison gates, 19 guarded, 8 vulnerable, 0 undecided.**

A gate is GUARDED when it asserts both sides exist and are well-formed *before*
comparing — in this tree, almost always via `assertScanned` /
`assertWatchlistResolves` from `_lib/scan_scope.ts`.

### Guarded (19)

`check_release_surface_equality` · `check_trunk_drift` · `lint_glama_drift` ·
`check_ci_strict_superset` · `check_condensation` · `check_artefact_checksums` ·
`check_bridge_derivation` · `check_discovery_determinism` ·
`check_cli_registry_budget_sync` · `check_template_pin_drift` ·
`check_gitignore_freshness` · `check_token_optimizer_freshness` ·
`lint_eval_freshness` · `lint_behavioural_eval_freshness` ·
`check_release_trunk_sync` · `sync_gitattributes` · `sync_gitignore` ·
`iron_law_sha` · `check_test_coverage_diff`

Two carry caveats worth knowing: `check_template_pin_drift` has an
`--allow-empty` opt-in that is a deliberate empty-side pass, and
`check_test_coverage_diff` is guarded but warn-only, so its guard is currently
inert.

### Vulnerable (8) — shrink-only from here

| Gate | The both-absent / both-empty path |
|---|---|
| ~~`verify_physical_move`~~ | **FIXED in this change.** `_diff_manifest(null, null)` returned `[]`, and an empty issue list means clean. |
| `check_ci_local_parity` | a missing workflow dir reads as `''` and a missing taskfile is skipped; two empty corpora ⇒ no delta ⇒ exit 0 |
| `mcp_parity_smoke` | two empty lists both serialize to `[]`; prints "0 entries match" and returns 0 |
| `probe_projection_fidelity` | a fixture that loses its `entries:` key yields 0 checks and `fail=0` |
| `sync_agent_settings` | empty template + absent target ⇒ `'' === ''` ⇒ "already in sync" under `--check` |
| `sync_github_metadata` | two empty topic lists ⇒ no drift ⇒ exit 0 **even under `--strict`** |
| `check_kernel_prefix_stability` | deleting the committed snapshot returns `'warmup'` ⇒ exit 0 |
| `bench_drift_check` | fewer than 2 reports ⇒ "no drift gate yet" ⇒ exit 0 |

The seven open rows are recorded rather than swept: fixing release, sync, and
bench gates in one change would be a large diff across surfaces this change does
not otherwise touch, which is the unreviewable-batch failure the authoring
guideline warns about. The fixed row shows the pattern — assert both sides
exist, and treat two absences as the absence of a comparison.

## The ease tripwire

A verification that was **far easier than expected** is a signal to check the
path, not a signal of success. Every entry above felt like a pass at the moment
it happened. When a gate you expected to fight goes green on the first run, run
one of the detection commands before believing it.

## See also

- [`gate-authoring.md`](gate-authoring.md) — the authoring path that prevents these at the source.
- `docs/contracts/ci-green-floor.md` § CI delta — what a local pass does and does not cover.
- `src/scripts/_lib/gate_ledger.ts`, `_lib/scan_scope.ts`, `_lib/ratchet_base_ref.ts` — the three structural fixes above.
