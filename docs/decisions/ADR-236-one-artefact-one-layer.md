---
adr: 236
status: accepted
date: 2026-08-19
decision: one-artefact-one-layer
supersedes: ADR-226
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopens on either of two observations, not on a calendar. First — the host gains
  real dedup across `~/.claude/**` and `<project>/.claude/**`, which would make the
  partition unnecessary rather than wrong, and the cheaper topology would then be
  whatever the host prefers. Second — a package-only artefact is found that a
  consumer genuinely needs, which would mean `workspaces:` is the wrong partition
  key and the predicate has to move to something else. A third, weaker trigger: the
  `/compact` semantics recorded in ADR-227 change, since the one residue this
  record knowingly leaves is four package-only rules whose compaction survival
  depends on them.
---

# ADR-236 — One artefact, one layer: the two rule/skill layers are partitioned, not duplicated

## Status

**Accepted** · 2026-08-19. **Supersedes [ADR-226](ADR-226-package-repo-keeps-both-rule-layers.md)**,
which decided that this repository keeps both rule layers. That decision is
replaced by an owner decision about delivery topology, not by a refutation of its
reasoning — see § What ADR-226 got right.

## Context

Claude Code loads `~/.claude/rules/` **and** `<project>/.claude/rules/`, both, user
layer first, with no dedup.

**That premise is established for RULES and only for rules, and the distinction
survived R2 review rather than being smoothed over.** The tree's one first-party
loading observation
([`claude-code-rules-dir-contract.md:23-29`](../../agents/evidence/analysis/claude-code-rules-dir-contract.md))
records a session carrying `downstream-changes`, `verify-before-complete`,
`scope-control` and `commit-policy` in **two copies each**, one attributed to each
layer. Nothing comparable exists for **skills** or **commands**: their layers hold
different payload shapes (project symlinks into `dist/`, global real
directories/files), so a shared name there is a delivery collision whose payload
equivalence is **unverified**. This record therefore rests on the rules half; the
partition is applied to the other types because one-artefact-one-layer is the right
topology regardless, not because their doubling was measured.

Measured 2026-08-19 on a **freshly regenerated** projection at `b490f3845` (full
census, with its per-type projection-shape field, in
[`single-delivery-partition-census.md`](../../agents/evidence/analysis/single-delivery-partition-census.md)):

```
rules   115 global · 111 project · 110 in BOTH ·  5 global-only · 1 project-only
skills  298 global · 338 project · 290 in BOTH ·  8 global-only · 48 project-only
standing rule prose   203,873 tok / 110,000 cap  (185.3 %)
shared rules          0 prose-divergent · 110 frontmatter-divergent · 7 paths:-disagreeing
```

ADR-226's remedy question was **which layer wins**, because `install --layer` —
the tool the error message recommends — offers exactly that choice. Two facts
measured since make that framing unusable:

1. **`install --layer` is not available on a fresh tree at all.** The gate refuses
   a suppression over divergence, and a freshly emitted project layer is 110-way
   frontmatter-divergent from the installed one. The remedy the tooling prints
   cannot be taken here.
2. **Both directions of the choice lose something.** `--layer=global` drops
   `source-of-truth.md`, which exists only in the project layer by design;
   `--layer=project` drops the five global-only rules. That is the asymmetry
   ADR-226 identified, and it is real.

## Decision

**Every rule and every skill is delivered from exactly one layer.** The layer is
decided by scope, not by preference:

- An artefact that exists **only** for this package — `workspaces:
  [agent-config-maintainer]` and nothing else — lives in the **project** layer and
  is **not** installed globally.
- Every other artefact lives in the **global** layer and is **not** projected into
  this repository.
- **No artefact appears in both.** Overlap is zero by construction, not by
  suppression.

Read off the field that already governs consumer delivery, the partition is:

| | project layer | global layer |
|---|---:|---:|
| rules (117) | **16** | 101 |
| skills (290) | **0** | 290 |

**Zero package-only skills is a finding, not a parse error.** No skill declares
`workspaces: [agent-config-maintainer]` alone, so this repository's
`.claude/skills/` is empty under the partition and all 290 duplicate catalogue
entries disappear in one move.

This is the **operator's decision**, taken 2026-08-19 in their own framing: this
package does not need its own global rules; what exists only for the package may
be kept locally and not installed globally, and the reverse; the duplicates stop;
and ADR-226 is to be replaced rather than treated as binding. It is recorded as a
decision rather than derived as a conclusion, because the measurement alone does
not select it — the measurement rules out `--layer`, and an owner chose partition
over the alternatives.

## Amendment — 2026-09-07 · the withhold reads the directory, not `installed.lock`

The Decision above says **"No artefact appears in both. Overlap is zero by
construction, not by suppression."** The first implementation did not deliver
that, and this amendment is what makes the sentence true rather than a change to
what it says.

**What the implementation actually did.** `partitionActive` withheld only where
the claude host layer verified against `installed.lock` — exact version equality
plus a content fingerprint. Any mismatch fell back to the FULL projection, and
every generator gated on that one boolean. So the partition was off for the whole
of any release window by construction (the building version is always ahead of the
installed one) and off on any machine whose install lagged a release.

**Measured 2026-09-07** on the maintainer machine, `installed.lock` at 14.19.0
against a 14.21.0 checkout:

```
rules     global 104 · project  15 · BOTH   0     ← correct: partitioned per host directory
skills    global 307 · project 414 · BOTH 261     ← the veto's cost
personas  global  32 · project  29 · BOTH  29     ← the veto's cost
commands  global  94 · project   0 · BOTH   0
```

The rules row was right because rules were **already** partitioned per host
directory on that directory's own contents (`hostLayerCarries`, added 2026-08-22
for a different reason). Skills, personas and the colon-form commands hung off the
version veto and were delivered twice, in every session, indefinitely.

**The decision, taken by the owner on 2026-09-07 in their own framing:** the
project layer carries only what exists solely for this package; everything the
global layer holds is delivered from there and nowhere else; the version-based
fallback that reintroduced duplicates is revoked.

**What replaces it.** The withhold is per ARTEFACT NAME, on each host directory's
own contents — the shape rules already used, extended to the other three families
(`src/install/claudeLayerCarriage.ts`). An artefact `~/.claude/<family>` holds is
withheld whatever `installed.lock` says; one it lacks stays, on its own, without
keeping the rest alive with it. An unreadable layer withholds nothing, so a fresh
CI checkout — which has no host layer at all — is unaffected, which is the property
the 2026-08-19 council round protected by refusing a hard failure there.

`verifyHostLayer` (né `partitionVerdict`) survives as a **diagnostic**: it reports
whether the layer being withheld against is the one this checkout's installer
stamped, and an unverified layer produces a warning naming `agent-config install`
instead of a silent fallback to double delivery. It decides nothing.

**Result, same machine, same day:** `check_single_delivery` reports
`duplicated=0 name_overlap_different_shape=0` — down from 261 and 29.

### Two things this amendment does NOT do, named rather than implied

**Flat command wrappers are not withheld.** A flat command reaches the host as a
hyphen-named wrapper under `skills/`, because the host does not register flat
command FILES (probed ≤ 2.1.204, recorded at `condense.ts::_nested_command_subpath`).
`~/.claude/skills` carries **none** of those wrappers — measured the same day, 307
global skills = the 299 projected skills plus 8 unrelated — so withholding one
would deliver that command nowhere. They are not duplication: nothing else
delivers them. 49 remain in the project layer, and the open question is whether the
host registers `~/.claude/commands/<slug>.md`; if it does, those 53 global files
make 49 of the wrappers redundant. That is a host-behaviour claim and needs a probe,
not a reading of this paragraph.

**Package-only SKILLS are still installed globally.** The Decision's table records
`skills (290) | 0 | 290` on a measurement that no skill declared
`workspaces: [agent-config-maintainer]` alone. On 2026-09-07 **73 do**, and the
installer ships all 299 skills globally — it excludes package-only RULES
(`single_delivery_global_exclusion.test.ts`) and has no equivalent for skills. So a
package-only skill reaches a consumer's global layer, which the Decision's second
bullet says it should not. Per-name carriage makes that harmless for DUPLICATION
(the project layer withholds all 73, so delivery is single either way) and does not
address the scope question at all. Left open deliberately: closing it changes what
the installer ships to consumers, which is a separate decision with its own blast
radius.

## What ADR-226 got right, and is kept

Superseding it is not a claim that it was wrong. Both halves of its reasoning were
**re-verified on the fresh tree** and both hold:

- **`source-of-truth.md` is project-only** — still exactly 1 project-only rule,
  still `workspaces: [agent-config-maintainer]`. The partition keeps it in the
  project layer, which is where ADR-226 wanted it. Its concern is satisfied rather
  than overruled.
- **Divergence here is structural, not a defect to repair.** The project layer is
  generated from `src/`; the global layer comes from an installed release; this
  repository is ahead of its own release by construction, so "refresh until the
  layers agree" has no fixed point. Confirmed and strengthened: divergence went
  from 2 rules to **110**.

One supporting figure of ADR-226 has expired and it is named so nobody re-derives
it: it recorded `--layer=project` as costing **22** rules and cited two
body-divergent rules as an additional reason the gate would refuse. On a fresh
tree the cost is **5** rules and prose divergence is **0**. Neither moves the
conclusion — the gate still refuses, now over frontmatter rather than prose, and
the asymmetry still exists, now smaller.

**A prior draft of this reconciliation read ADR-226's asymmetry as "24 global-only
live obligations including `secret-vcs-guard` and `session-canary`".** That was a
stale-projection artefact: those rules are in **both** layers on a fresh tree. It
is recorded here because the number circulated in three parallel analyses.

## Consequences

- **The producers change, not the filesystem.** The project projection stops
  emitting global-bound artefacts; the global install stops carrying package-only
  ones. Nothing under `~/.claude/` is deleted by this record — that would be a
  Hard-Floor action per `non-destructive-by-default`.
- **`install --layer` becomes irrelevant to this repository** rather than declined.
  It stays the right tool for a consumer who ends up with two installs.
- **The invariant needs a machine check, and the precedent here is bad.**
  `check_standing_rule_delivery` measures this exact defect and is registered only
  in `taskfiles/dev.yml:136` — NOT in `ci-fast`, as an earlier revision of this
  record and its roadmap both claimed; corrected on R2 review, and `dev.yml`
  documents it as a local reading on purpose rather than as an orphan;
  `check_rule_projection_integrity` is
  inert when `agents/.agent-tools.yml` selects zero tools, which is the
  maintainer's normal local state. A third unbound gate would read as coverage
  while adding none, so the binding surface is an explicit decision in
  `road-to-single-delivery` Phase 4 rather than a default.
- **The partition has a precondition, and it was not obvious when this record was
  written.** Every artefact the project layer stops carrying is then delivered
  *only* by the global layer, so a machine with the project layer and no current
  global one — a fresh clone, a CI runner, a colleague who never ran the installer
  — would receive **16 rules and no skills** where it receives 111 and 338 today.
  The failure mode is not a token cost but an **under-governed session**.
  Discovered while implementing the mechanism and recorded rather than assumed
  away; `road-to-single-delivery` Phase 2 is **halted** on blocker
  `partition-requires-global-layer` until the fallback is chosen (refuse / warn /
  project the full set). The agent-drafted recommendation is to make the partition
  a property of a machine that holds **both** layers, so no checkout can lose
  governance by omission.
- **One residue is knowingly left open.** Four package-only rules carry `paths:` —
  `no-roadmap-references`, `rule-type-governance`, `skill-quality`,
  `source-confidentiality`. Once their unscoped global twin is gone they are
  path-scoped only, and ADR-227:79-80 records that path-scoped rules are **not
  re-injected after `/compact`**. Three of the four carry Iron Laws. The partition
  narrows this from seven rules to four; it does not answer it. Blocker
  `compact-survival-of-package-only-rules` carries three enumerated options and a
  recommendation, and the direction is the maintainer's.
- **Consumers are unaffected by this record.** The 16 package-only artefacts are
  already excluded from consumer installs by `workspaces:`, so the partition moves
  this repository's topology only. Any consumer-visible default change stays
  permission-gated.

## Alternatives considered

- **Keep both layers (ADR-226 as it stands).** Rejected by the operator. Its cost
  is now measured at 185.3 % of the standing cap plus 290 duplicate catalogue
  entries, and the duplication grew rather than shrank between the two readings.
- **`install --layer=global` or `=project`.** Unavailable — the gate refuses over
  110-way divergence — and lossy in both directions even if it were.
- **Per-artefact suppression via `claudeMdExcludes`.** The key *is* file-glob
  capable (`claude-code-rules-dir-contract.md:81-92`; the host's own example
  excludes a single file), so this was a genuine candidate. Rejected as the primary
  mechanism because it is a *consumer-machine settings* lever maintained per
  machine, while the partition is a property of what the producers write and
  therefore holds for every checkout without a settings write. It remains the
  fallback for a consumer holding two installs.
- **A delivery manifest with logical artefact identity.** Proposed by one of the
  inbox drafts. Deferred as premature: identity is only hard when both layers
  legitimately hold the same artefact, which the partition removes by construction.

## References

- [ADR-226](ADR-226-package-repo-keeps-both-rule-layers.md) — superseded by this record.
- [ADR-227](ADR-227-paths-scoping-is-saturated-not-a-corpus-lever.md) — the `/compact` semantics the residue depends on.
- [ADR-228](ADR-228-global-install-does-not-emit-paths.md) — why the global layer carries no `paths:`.
- [`single-delivery-partition-census.md`](../../agents/evidence/analysis/single-delivery-partition-census.md) — the measurement, with its projection shape.
- `road-to-single-delivery` — the roadmap that implements this record.
