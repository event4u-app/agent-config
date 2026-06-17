---
status: ready
complexity: structural
---

# Roadmap: Install-Contract Stability — freeze the install ABI, split the lean core from the lab

> **The one surface-reducing engineering item** from the version-2 external review.
> Everything else in that review is either already council-locked or rejected
> (disposition table below). This roadmap carries only **D2**: the install layer
> is the highest-risk, most-frequently-broken surface, and stabilising it is the
> single move that both reviewers ranked first.

**Trigger:** Second external review pass of unreleased `main`
(`agents/tmp/feedback-v6.1.0-version2.txt`, 5 sub-reviews). Version-1 of this
reviewer's feedback was already dispositioned into `road-to-contract-integrity`
(parked in `later/`); version-2 re-raises most of it. Only the **genuine delta**
was routed to the council — D2 is the only delta that *reduces* surface/risk
rather than adding it.

**Mode:** Disposition-driven, then engineering. The disposition below is
council-locked; the phases implement the one item that survived.

> **Council convergence (2026-06-16, claude-sonnet-4-5 + gpt-4o, design mode,
> 1 round — full convergence, no second round needed; actual spend $0.05).**
> Both members independently converged on the same read: *the dominant reviewer
> signal across all five sub-reviews is "stop adding, control complexity, cut
> against adoption not ambition; the meta-to-value ratio is the health risk."*
> The correct response is **not** four new careful features — it is to ship the
> one structural fix that unblocks external adoption (the install contract) and
> reject the rest. Both ranked **D2 highest-leverage and surface-reducing**;
> both rejected D1 as the relabelled, already-sunset auto-accrual; both called
> D3 premature and D4 a documentation problem; both said D5 is just-do-it-now
> with no roadmap; both said **do not spawn another *governance* roadmap** (that
> would be the exact meta-bloat the reviewer warns about). This roadmap is the
> agreed exception: D2 is **engineering**, not governance, and warrants a focused
> home. The split — install-ABI freeze first (gives a stable contract to split
> against), product/lab separation second — is the council's sequencing.

## Disposition of the version-2 delta (auditable — nothing silently dropped)

| ID | Finding | Council verdict |
|----|---------|-----------------|
| **D1** | Passive `project-learning-gate` (auto-fire post-task "was there durable knowledge? → propose context update") | **REJECTED as a new build.** Architecturally identical to the agent-memory Layer-2 auto-accrual that council sunset, and to the global-store auto-promotion ADR-103 just defaulted OFF — "the cancelled feature wearing a learning-theory costume." `/memory mine`, `memory-consolidation`, `learning-to-rule-or-skill` already cover the manual path. The *real* residual gap is **workflow training** (when to run `/memory mine`) → folded into the D4 onboarding fix, not a new gate. |
| **D2** | Install-ABI freeze + product/lab separation | **ACCEPTED — highest leverage, surface-reducing. This roadmap.** |
| **D3** | Mission lifecycle metadata (`experimental/validated/recommended/deprecated`) + analytics | **PREMATURE.** ~5 missions, no runtime → no real telemetry; analytics rejected outright. Lifecycle is already covered by `trust_level` + trigger-gating in `road-to-mission-catalogue`. Adding a 4th orthogonal classification scheme = more bloat. Revisit only if a mission count makes the existing scheme insufficient. |
| **D4** | "Employee Mode" — hide platform concepts, show tasks | **DOCUMENTATION, not architecture.** Roles + profiles + `/mission:*` framing already are the task-first surface. Fix = a 2-page task-first quickstart ("install as `developer`, run `/mission:…`, ignore Directives/RDP/Governance until needed"), not a second parallel concept layer (which would create a fake-surface/real-surface two-tier system). Handled as immediate docs work, outside this roadmap. |
| **D5** | Housekeeping: recurring `add uncomitted roadmaps` typo commit; branch-protection unverified; semver-as-stability-signal; command-syntax (`/feature:plan` colon-canonical vs `/fix/ci` slash-form in the Cookbook) | **JUST-DO-IT-NOW, no roadmap.** Executed as immediate hygiene. Command-syntax = canonical is the colon form (`/feature:plan`, `/pr:create`); the slash-form leaks are a Cookbook/doc-consistency cleanup (lint candidate). |

> **Already council-locked elsewhere — not re-planned here:** product simplification /
> artifact-growth gate (F2 rejected → family-first presentation, owned by
> `road-to-contract-integrity` Phase 2, blocked on pruning); structural
> breaking-change detector (F3, shipped as `check_structural_breaking.py`);
> mission content (`road-to-mission-catalogue`); command `tier:` deprecation
> (`road-to-tier-removal`, soak-gated); knowledge connectors (`stubs/`,
> stays-cancelled until a named org customer). Sequencing note: this roadmap does
> **not** un-park those; it ships ahead of them because install stability gates
> external adoption, which gates everything the parked tracks depend on.

## The problem (grounded)

- `src/scripts/install.py` is **5,259 lines** — the single largest module, on the
  most-critical path: it **mutates a foreign, shared host config** (Claude / Cursor /
  Augment / Windsurf / shell rc).
- `BREAKING_CHANGES.md` states majors are frequent **because the install layout
  changes**. For a tool whose promise is "install into your shared host config,"
  the install layout is the *worst* place for instability — it taxes precisely
  the few adopters there could be.
- There is **no install-layout version / ABI concept today** (grep of `install.py`
  for `layout_version` / `INSTALL_VERSION` / `*_manifest_version` returns nothing).
  `STABILITY.md` versions the *contract directory*, not the on-disk install layout.
- The lean stable core (rules + skills + install + condensation) shares one install
  surface with experimental meta-tooling (`ai_council` ~14.3k LOC, `_lib` ~8.8k,
  `_cli` ~6.1k, plus chat-history / prediction-pool / video / mcp). Lab churn rides
  the same release train as the core, so experiments destabilise the thing users
  actually install.

## Phase 1 — Freeze the install ABI (a versioned, deprecation-gated install layout)

Goal: the on-disk shape the installer writes into a host (paths, keys it owns,
removal-pointer schema) becomes a **versioned contract** that cannot change
shape without a declared version bump + a deprecation window. This is the
stable contract Phase 2 splits against.

- [x] **Step 1 — Census the current install layout.** From `install.py` +
      `install-scopes.md` + `installed-tools-lockfile.md`, enumerate exactly what
      the installer writes/mutates per host: file paths created, JSON-pointer keys
      claimed in shared configs, the surgical-uninstall pointer schema, the lockfile
      shape. Capture as `docs/contracts/install-layout.md` (a `stability: beta`
      contract). This is the source the freeze guards against — no behaviour change
      in this step.
- [x] **Step 2 — Stamp a `layout_version` into every written artefact.** Add a
      single `install_layout_version` constant (e.g. in `_lib`) and write it into
      the installed lockfile / manifest the installer emits, so an installed tree
      self-declares which ABI it was written under. Back-compatible: absent =
      "v0 / pre-freeze", treated as the current shape.
- [x] **Step 3 — Conformance test that locks the shape.** A test
      (`tests/.../test_install_layout_contract.py`) asserts the set of
      written-paths + claimed-pointer-keys + lockfile schema against a golden
      derived from `install-layout.md`. The test **fails** when the layout changes
      without (a) bumping `install_layout_version` and (b) a `### Breaking` /
      deprecation note. Run it once locally to confirm it passes on the current
      tree. <!-- carve-out: new-gate-verification -->
- [x] **Step 4 — Deprecation-window policy.** Extend `BREAKING_CHANGES.md` (and
      cross-link from `install-layout.md`) with the install-ABI rule: a layout
      change ships the **old + new shape side-by-side for one minor cycle**, the
      installer migrates an old-version installed tree in place, and only then is
      the old shape dropped. Removes "majors are frequent because the install
      layout changes" as a standing excuse.
- [x] **Step 5 — Migration path for an already-installed old-version tree.** The
      installer detects `install_layout_version < current`, migrates the on-disk
      shape in place (idempotent, surgical-uninstall pointers preserved), and
      surfaces what it changed. Verify once against a real plaintext installed tree
      from a prior version. <!-- carve-out: new-gate-verification -->

## Phase 2 — Split the lean stable core from the experimental lab

Goal: a core-only install path that does not carry experimental meta-tooling, so
lab churn cannot destabilise what users install. The install-ABI from Phase 1 is
the stable contract this splits against.

- [x] **Step 1 — Tag each domain/pack/script-module `core` vs `lab`.** Add a
      `surface_tier: core | lab` (name TBD in Step 1) to pack/domain manifests and a
      module-level marker for `src/scripts/` clusters. `core` = rules + skills +
      install + condensation (the lean multi-host engine). `lab` = `ai_council`,
      prediction-pool, chat-history, video, mcp-server, and other pilot tooling.
      Output: an inventory listing every artefact's tier with a one-line reason.
- [x] **Step 2 — Core-only install path.** The installer can write a **core-only**
      tree (no lab tooling) as a first-class, documented mode. Existing full install
      stays the default for the maintainer's own use; core-only is the adoptable
      surface. Verify a core-only install produces a working rules+skills+condensation
      tree with zero lab modules. <!-- carve-out: new-gate-verification -->
- [x] **Step 3 — Boundary guard.** A CI lint asserts no `core`-tier artefact
      imports / depends on a `lab`-tier module (so lab churn cannot reach the core
      install surface). Run once to confirm the current tree is clean or to surface
      the existing violations as the work list. <!-- carve-out: new-gate-verification -->
- [x] **Step 4 — Document the split.** One section in `docs/architecture.md`
      (or the install-layout contract) stating the core/lab boundary, why it exists
      (lab churn must not tax adopters), and how to install each. No new concept for
      end-users beyond "core install vs full install."

## Out of scope (recorded so the boundary is auditable)

- **D1 / D3 / D4** — dispositioned above; not built here.
- **Adoption work** (recruit sessions, role promotion, encrypt-at-rest flip) —
  owned by `road-to-external-proof-upgrade` (parked, human-owner-gated). This
  roadmap is the install-stability *prerequisite* that the external-proof reviewer
  identified as the chicken-and-egg unblock, but the two stay separate roadmaps
  (different surfaces, different gating).
- **No `install.py` rewrite for its own sake.** The 5,259-line size is a symptom;
  this roadmap freezes the *contract* and splits the *surface*, it does not
  refactor the module wholesale (that would be ambition-driven, the exact pattern
  the reviewer flags). Decomposition of `install.py` may follow once the ABI is
  frozen, as a separate behaviour-preserving refactor.

## Acceptance criteria

- [x] `docs/contracts/install-layout.md` exists, declares the written-paths +
      claimed-keys + lockfile schema, and is referenced by the conformance test.
- [x] A conformance test fails CI on any unversioned install-layout shape change;
      green on the current tree.
- [x] `BREAKING_CHANGES.md` carries the install-ABI deprecation-window rule.
- [x] Every domain/pack/script cluster is tagged `core` or `lab` with a reason; a
      core-only install produces a working engine tree with zero lab modules.
- [x] A boundary guard prevents `core` → `lab` dependencies.
- [x] The disposition table above is the single auditable record of why D1/D3/D4/D5
      were not turned into roadmap work.

## Notes

- **No commit / push / merge implied.** Per `commit-policy` and `scope-control`.
- **No version / release-date pinning.** Phases plan work, not releases
  (`scope-control`). The deprecation-window *policy* is authored; concrete version
  numbers are decided at release time.
- **D5 housekeeping is executed outside this roadmap** as immediate hygiene
  (commit-message template fix, branch-protection verification against
  `branch-protection-policy.md`, command-syntax Cookbook cleanup toward the
  colon-canonical form). Tracked in the chat reply that produced this roadmap, not
  as roadmap steps (council: "just do it now, no roadmap").
- **D4 onboarding doc** (task-first quickstart) is the home for the D1 residual
  ("when to run `/memory mine`") and the D4 "show tasks not concepts" need —
  a documentation deliverable, sequenced after Phase 2 ships the core/full split
  it would describe.
