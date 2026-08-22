<!-- evidence-type: analysis -->
# Mutation census — how many negative tests are a claim rather than evidence

**Measured:** 2026-08-22 · **Method:** the hand-probe this tree already ships (`src/skills/testing-anti-patterns/SKILL.md:171-185`), applied as a census rather than as an authoring step
**Pre-registration:** `agents/evidence/analysis/test-independence-prereg.md`, committed **before** this file — threshold **> 10 % survivors** supports the claim, **≤ 10 %** is a null

## Result: 3 survivors of 10 = 30 % — the claim is SUPPORTED

Each probe deletes or neutralises the control an existing spec claims to pin,
runs **that spec only**, and records whether it fails. Every mutation was
restored immediately; `git status --porcelain` over the mutated paths is clean.

| # | control | spec | verdict |
|---|---|---|---|
| 1 | `is_ancestor` path-confinement predicate → `return true` | `tests/install/copy_symlink_confinement.test.ts` | killed |
| 2 | commit-subject blocklist filter → empty | `tests/scripts/lint_commit_subjects.test.ts` | killed |
| 3 | blocker five-field contract check → empty | `tests/scripts/lint_roadmap_blockers.test.ts` | killed |
| 4 | kernel-rule write denial → deny everything | `tests/scripts/hooks/block_kernel_rule_writes.test.ts` | killed |
| 5 | pack content-class limit → never report | `tests/scripts/check_pack_size.test.ts` | **SURVIVED** |
| 6 | scan-scope dead-scope throw → always allow empty | `tests/scripts/scan_scope.test.ts` | killed |
| 7 | augment description cap → never exceed | `tests/scripts/check_augment_description_cap.test.ts` | killed |
| 8 | secret-gate exclude filter → never exclude | `tests/scripts/check_secret_leak_baseline.test.ts` | **SURVIVED** |
| 9 | description-allowlist 20-entry hard cap → never trip | `tests/scripts/lint_skill_descriptions.test.ts` | **SURVIVED** |
| 10 | workflow first-party exemption → exempt everything | `tests/scripts/lint_workflow_security.test.ts` | killed |

## What the three survivors mean, and what they do not

**None of the three is covered by a `--self-test` either.** That matters because
it is the obvious mitigating explanation and it is false here: none of
`check_pack_size`, `check_secret_leak` or `lint_skill_descriptions` carries a
`--self-test` flag on the measured tree, so the mutation is not caught anywhere.

**A correction to my own first reading, recorded because it changed the
conclusion.** I initially read survivor 5 as "the vitest file misses it but the
gate's own `--self-test` kills it", on the strength of `--self-test` exiting 1.
It exits 1 because **the flag does not exist there** — the gate ran normally and
failed a *size budget* on a polluted tree. An unknown flag being ignored looks
exactly like a self-test failing. Verified by grepping for the flag rather than
by reading an exit code.

**What a survivor is NOT.** It is not a claim that the guard is broken, or that
the feature is untested. Survivors 8 and 9 both have specs that exercise the
surrounding function; what they do not do is assert the specific control. A
survivor says: *if someone deleted this control, this suite would stay green.*

## The threshold, and the fragility of the number

30 % against a 10 % line, so the verdict is not knife-edge — but **n = 10** and
the sample is not random. It is drawn from gates and guards with a single-line,
mechanically identifiable control, which is exactly the population where a probe
is cheap. Two directions of bias, both stated because they point opposite ways:

* Single-line guards are the **easiest** to write a targeted negative test for,
  which argues the true rate over the whole suite is **higher**.
* They are also the population most likely to be covered by a gate's own
  `--self-test` rather than by a vitest file, which argues some of what looks
  like a survivor here is caught elsewhere — refuted for these three
  specifically, above, but not in general.

Not resolved, because resolving it needs a bigger sample and this census's job
was to produce a number, not a rig.

## What this does NOT license

**It does not license building a mutation rig.** The threshold opening the
tool-assisted half is one gate; `blocker: mutation-tool-availability` is
another, and it is unresolved. A 30 % survivor rate says hand-probing is finding
real gaps, not that a rig is the cheapest way to keep finding them — with 10
probes costing minutes, the hand-probe kept up here.

**And it does not license per-change mutation CI**, which the roadmap excludes
by name: cost per change against a signal that is at best weekly.
