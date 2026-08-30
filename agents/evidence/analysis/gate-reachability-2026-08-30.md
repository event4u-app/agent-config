<!-- evidence-type: analysis -->

# Gate reachability — every gate-shaped task target, classified

> `road-to-concern-admission-ratchet`'s sibling finding, from
> `road-to-gates-that-do-not-run` Phase 1. Computed by
> `src/scripts/check_gate_reachability.ts`, which is committed so the reading
> keeps being reproducible rather than being a grep somebody once ran.

## Headline

```
gate-shaped targets: 287 · target-reachable 248 · script-runs-in-workflow 17 · UNREACHABLE 22
```

## The correction that changes the size of the problem

**The roadmap states 32 unreachable targets. The honest number is 22, and the
difference is a category the two-command method could not see.**

A gate can be reached two ways: a workflow calls `task <name>`, or a workflow
calls the SCRIPT directly (`./scripts-run src/scripts/foo`). Only the first is
visible to a task-graph reading. **17 targets fall in the second group** — the
gate genuinely runs in CI, and the unwired task target is a local ergonomic
rather than a hole.

Conflating the two overstates the problem by roughly a factor of two and, worse,
would have sent Phase 2 to "wire" seventeen gates that already run — each wiring
adding a duplicate CI invocation of a gate that was never silent.

The script therefore reports three categories, not two. `check_rule_projection_integrity`
is the worked example: its task target is unwired, and its script runs in the
Rule Backstops workflow — where it was observed failing during this drain run.
A reading that called it "unreachable" would have been wrong in the most
misleading direction, because the gate had been reporting all along.

## Class 1 — `variant`: the script runs in a workflow (17)

The gate is **not** silent. The task target is a convenience alias, usually a
different output shape (`--json`, `--strict`, `--report`) of a script a workflow
already invokes. No action; wiring these adds a second invocation of a gate that
already runs.

| Target | Script | Why it is a variant |
|---|---|---|
| `check-bridge-derivation` | `check_bridge_derivation` | script invoked directly by a workflow step |
| `check-detector-corpus` | `check_detector_corpus` | script invoked directly by a workflow step |
| `check-kernel-rule-bundle` | `check_kernel_rule_bundle` | script invoked directly by a workflow step |
| `check-no-new-legacy-path` | `check_no_new_legacy_path` | script invoked directly by a workflow step |
| `check-refs-json` | `check_references` | `--format json` shape of `check-refs`, which is target-reachable |
| `check-rule-projection-integrity` | `check_rule_projection_integrity` | runs in Rule Backstops; observed failing there this run |
| `check-secret-leak-pack` | `check_secret_leak` | `--pack` shape of `check-secret-leak`, target-reachable |
| `check-site-links` | `check_site_links` | script invoked directly by a workflow step |
| `lint-readme-strict` | `readme_linter` | `--strict` shape of `lint-readme`, target-reachable |
| `lint-skills-changed` | `skill_linter` | `--changed` shape of `lint-skills`, target-reachable |
| `lint-skills-json` | `skill_linter` | `--format json` shape of the same |
| `lint-skills-pairs` | `skill_linter` | `--pairs --condensation-quality` shape of the same |
| `lint-skills-regression` | `lint_regression` | script invoked directly by a workflow step |
| `lint-skills-report` | `skill_linter` | `--report` shape of the same |
| `lint-skills-strict` | `skill_linter` | `--strict-warnings` shape of the same |
| `lint-topics-yaml` | `lint_topics_yaml` | script invoked directly by a workflow step |
| `memory:shadow-report` | `check_memory` | `--shadow-report` shape of `check-memory`, target-reachable |

## Class 2 — `should-run`: absence from CI is a hole (8, after two Phase-2 reclassifications)

| Target | Reason |
|---|---|
| `lint-positioning` | **The lead instance.** Exits 1 on this tree; its closing roadmap step recorded CI wiring that never existed. Two publish surfaces carry a withdrawn claim and nothing has objected. |
| `check-augmentignore` | Guards the ignore surface that decides what an installed consumer sees; a drift here is invisible until a consumer reports it. |
| `check-knowledge-sharing` | Guards an egress surface. A gate on what may leave should not be optional. |
| `check-publish-surface` | Same class as `lint-positioning` — a published-string surface with no other guard. |
| `check-release-includes-discovery` | A release that omits the discovery manifest ships a broken install; the failure is silent until first use. |
| `check-requirements-trace` | Traceability decays continuously and nothing else reports it. |
| `lint-adr-sweep-routing` | ADR routing drift is invisible to every other gate. |
| `lint-mcp-registry-manifest` | The manifest is a published integration contract. |

## Reclassified during Phase 2 — because 2.2 said run it locally first

Three of the ten `should-run` rows were wrong, and running each gate before wiring
it is what caught them. This is the rule earning its keep rather than a
formality.

| Target | Was | Is | Why the first reading was wrong |
|---|---|---|---|
| `lint-explain-trace` | `should-run` | `manual` | **Not a gate.** It is a validator taking a JSON document; a bare invocation exits non-zero with `pass a JSON file path or --stdin`. Wiring it would have made CI permanently red. |
| `check-knowledge-sharing` | `should-run` | declared local-only | **Staging-scoped.** It inspects the STAGED set, and CI has no staged set — the commit already happened by the time a workflow runs. `src/config/ci-local-parity.yml` already recorded this as a declared local-only exemption; wiring it to a workflow made that exemption STALE, and the honest fix was to respect the recorded reason rather than override it. Found by `check_ci_local_parity`, not by review. |
| `check-trunk-drift` | `should-run` | `manual` | **Advisory by its own docstring** — *"run it in the /create-pr pre-flight or wire into CI per your branch-protection policy"*. Its red state is "this branch is behind trunk", which is the normal state of an open PR, so wiring it would fail correct work. |

## Class 3 — `manual`: deliberately human-invoked (14, including the two above)

Each names what would make it run.

| Target | Why manual | What would make it run |
|---|---|---|
| `ci-strict` | An ENTRY POINT, not a gate — the stricter sibling of `ci` itself. Wiring it into `ci` would be a cycle. | A decision to make strict the default; that is a policy change, not a wiring one. |
| `check-augment-budget` | Emits a MEASUREMENT, not a verdict. A gate that cannot fail is a report. | A pre-registered threshold. Until one exists there is nothing to fail on. |
| `check-corpus` | Requires council configuration, which is user-global and absent in CI by construction. | A fixture corpus that does not need a configured council. |
| `check-media-deps` | Requires external media tooling not installed on runners. | Those dependencies in the runner image, or a skip-with-reason path. |
| `dev:standing-rule-delivery` | `dev:` namespace — an inspection aid for a maintainer mid-change. | Promotion out of `dev:`, which is a scope decision. |
| `lint-bench-ab` | Bench namespace, spend-bearing. | A cached or dry arm that costs nothing per run. |
| `lint-originality-shingles` | `--top 10` is a ranked REPORT, not a pass/fail. | A ratcheted threshold, like the other originality gates carry. |
| `lint-agents-layout-strict` | `--strict` over a corpus whose non-strict form is already reachable; strict has a known backlog. | The backlog cleared, then promote strict to the default. |
| `mcp:glama-drift-check` | Queries an external registry — network-dependent and flaky by construction. | A recorded snapshot to diff against instead of a live query. |
| `migration-verify` | Verifies a physical move during a migration; there is no migration in flight. | A migration in flight. |
| `value` | Renders a dashboard; the render is the product, not a check. | Nothing — it is not a gate. |
| `value:lint` | Lints that dashboard, which is generated and regenerated on demand. | The dashboard becoming a committed artefact a drift could break. |

## Outcome after Phase 2

**22 unreachable → 14.** The eight that left were wired one target per commit,
each run locally first; all eight were green on arrival, which the commits state
rather than imply.

**Wiring into `task ci` turned out to be only HALF of reachable**, and the tree
said so: `check_ci_local_parity` went 165 → 169 (+4). A gate in `task ci` with no
workflow step is local-only, so it still does not run on a PR — which is this
roadmap's own defect, reproduced by its own fix. Eight matching workflow steps in
`rule-backstops.yml` took it to **161**, four below the baseline.

The baseline is deliberately NOT lowered here. Its own note records the rule: it
is walked down on a reading from the ENFORCING environment, never a local one —
a prior 165 → 164 lowering was reverted when CI measured 165 and the local
reading turned out to be worktree-dependent — a gate wired while already green is wired on an unverified
sensitivity claim. Every one of the remaining 14 now carries a row in
`src/config/gate-reachability-exemptions.json` with a reason **and** what would
make it run, and `check_gate_reachability --gate` fails on any unreachable
target without one — in both directions, so a stale exemption for a
now-reachable target fails too.

## Not acted on in Phase 1

Per step 1.3, that phase touched no taskfile and no workflow. Wiring a gate that
has never run in CI is how a green pipeline goes red for reasons nobody
scheduled; Phase 2 does it deliberately, one target at a time, each seen red or
explained.
