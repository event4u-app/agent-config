---
complexity: structural
status: ready
---

# Roadmap: Competitive Borrow

**Trigger:** User ask — analyse three external agent-suites' feedback, verify
their "borrow list" critically, and plan which mechanics to adopt.
**Mode:** Hard cap **5 adoption units per six-week plate** (harvest policy).
Sources are referenced source-anonymously per the `source-confidentiality`
rule (real links retained as `ENC1:` tokens in § Provenance):

- **Source A** — an external operator-runtime / agent-harness reference (OS-style).
- **Source B** — a large persona-catalog reference.
- **Source C** — a high-volume persona-dump reference.

## Goal

Achieve competitive-borrow parity **within the 5-unit plate cap** by (1)
surfacing the differentiators v6 already shipped, (2) executing the
high-leverage P1 borrows, and (3) gating P2 items on demand triggers. The
adoption gap (this package ≈7 stars vs the sources' very large counts) is
**external visibility, not feature delivery** — v6 shipped three mechanics the
sources are not known to match (pointer-level uninstall, pack-scoped
projection, a portability guard), yet all three are invisible in a README scan.
Decide, with evidence and a council, which *remaining* mechanics are worth
borrowing and reject the large fraction agent-config **already ships** or that
would cargo-cult a source's surface.

> **Differentiator grading (council, 2026-06-13).** "Shipped" is CONFIRMED
> against `src/` (file paths in Phase 0). "Differentiator vs the sources" is
> **INFERRED** from the sources' write-ups, not from a code audit of their
> repos — so it stays a claim pending the P1.0 validation gate, never asserted
> as fact in user-facing copy until validated.

---

## Phase 0 — Reality check (do NOT build these — already shipped)

Both external write-ups materially **understated** what this package has.
Verified against `src/` (capability audit, 2026-06-13):

| Borrow claim | Verdict | Evidence |
|---|---|---|
| "No `uninstall` command" | **FALSE — shipped, finer-grained than Source A** | `src/scripts/_cli/cmd_uninstall.py` (two-phase, `--purge`); ownership tracked at **JSON-pointer** level via `src/scripts/_lib/json_pointers.py` (named-key pointers + SHA-256 `value_hash` array discriminator) — subtracts only its own keys from a shared host config without touching a neighbour tool's entries. Source A's install-state tracks at *file* level; this is the harder, finer case. The reader only checked `src/cli/commands/`. |
| "Build a reversible install / transaction log" | **Shipped** | `src/install/txlog.ts` — append-only JSONL, `kind: write\|skip\|abort\|rollback`, per-file sha256, rotation. |
| "Add install-state per target" | **Shipped** | `installed-tools.lock` + global `installed.lock`. |
| "Add plan/apply/doctor/drift lifecycle" | **Shipped** | `plan.ts` + `atomic.ts`; `cmd_doctor.py`; `cmd_validate.py`; `cmd_prune.py`. |
| "Build a canonical→multi-host converter pipeline" | **Shipped** | `src/` is canonical; `generate_tools()` projects to 11 hosts. |
| "Declarative install manifests + packs" | **Equivalent shipped** | 15 packs (`src/packs/*/pack.yaml`) with `requires`/`suggests`/`trust_level_default`/`dependencies`. |
| "Docs-from-manifest to stop README drift" | **Shipped** | `generate_catalog.py` / `generate_index.py`; `lint-readme-jargon` gate. |
| "Typed agent/skill schema + linter" | **Shipped** | schemas in `src/scripts/schemas/`; `skill_linter.py`. |
| "Lean / scoped install (not a 500-artifact dump)" | **Shipped (CONFIRMED) — differentiator vs sources (INFERRED)** | Pack-scoped projection, ADR-040 (accepted, v6): the projector writes only the active profile/pack's artifacts, not all ~150 commands / ~223 skills. Sources are not known to project a scoped subset — claim pending the P1.0 validation gate. |
| "Portability / source-confidentiality governance" | **Shipped (CONFIRMED) — differentiator vs sources (INFERRED)** | `src/scripts/check_portability.py` (CI): forbids project/customer/team-specific refs in the condensed output ("must work in any project"). No source is known to enforce this — claim pending the P1.0 validation gate. |

- [x] Reality check complete — 10 items confirmed already shipped, excluded from the plate (8 from the original audit + scoped projection + portability guard surfaced by the post-v6 re-read).

**Skeptical flags carried into the council:** the sources' star counts are
extraordinary for individual-maintainer repos and possibly inflated — no
decision below rests on them. At least one borrow item ("no uninstall") was a
provable misreading, so the whole list got per-item source verification.

---

## Phase 1 — Adopt-now plate (4 units + 1 rolling docs task)

> Buffer left intentionally (cost discipline): 4 substantive units, 1 free slot.
> Each unit lands as its own change with verification evidence. Plate-owner
> go/no-go is recorded in § Acceptance before any unit starts.

### P1.0 — README / profile above-fold narrative pass (rolling, not a slot)

- [x] Drive `lint-readme-jargon` above-fold hits to **0** (already 0; confirmed green).
- [x] Surface the **three shipped differentiators** above the fold, one line each
      — shipped as **factual capability statements** (council 2026-06-15, Decision 3,
      Option A), no "vs the sources" comparison (see validation-gate disposition below).
      README § "What's different": surgical uninstall (JSON-pointer + SHA-256),
      pack-scoped install (active pack only), portability guard (CI-enforced).
- [x] **Validation gate (council guardrail).** Disposition: the two INFERRED
      "differentiator vs the sources" claims (scoped projection, portability
      guard) were **NOT validated this session** — no harvest evidence for
      Sources A/B/C in the local store, sources are ENC1-encrypted and not
      auditable. Per council 2026-06-15 (Decision 3, Option A) the README ships
      the mechanics as **factual capabilities** (all CONFIRMED against `src/` in
      Phase 0), NOT as a comparative claim. No hero comparison shipped → the
      failure-protocol downgrade is moot; the comparative claim stays INFERRED
      and deferred. Logged in § Acceptance.
- [x] Render the **existing role-level taglines** (`lint_role_experiences.py`,
      WorkspacePage) in a catalog page — generated `docs/role-experiences.md`
      (`generate_role_experiences_catalog.py`, drift-checked), reusing the
      `agents/roles/*/index.md` taglines; linked from `getting-started-by-role.md`.
      No per-skill `tagline` field added (Phase 3 drop respected).
- [x] Link the capability matrix (P1.3) + cookbook (P1.4) from the README
      ("what works on which host").

### P1.1 — Anti-duplicate originality gate

Promote the existing **report** to a guard-railed **gate**.

- [x] New `task lint-skill-originality` (`src/scripts/lint_skill_originality.py`)
      reusing `skill_overlap.py`'s Jaccard/tokeniser primitives — but reading the
      **canonical** `src/skills` tree (the legacy overlap scripts scan the dead
      `.agent-src.uncondensed` path) and adding domain-awareness via `packs:`.
- [x] **Within same domain/pack:** jaccard ≥ 0.6 = would-fail class.
      **Advisory warns** ≥ 0.40. **WARN-ONLY by default** (council 2026-06-15,
      Decision 1) — `adr-architectural-consensus-mechanism` deferred
      fail-the-build until thresholds are stable one full release cycle.
      Promotion path: `--strict` (exits 1 on same-domain violations) once stable.
- [x] Documented allowlist (`lint_skill_originality_allowlist.json`) for the
      ADR-disambiguated cluster heads (`laravel`↔`symfony-workflow`,
      `devcontainer`↔`copilot-config`, `blade-ui`↔`livewire`), each citing its
      rationale. **Hard-capped at 20** (`ALLOWLIST_CAP`) per the
      `autonomous-execution` allowlist-growth antipattern.
- [x] Wired into `ci` / `ci-strict` (Taskfile) + defined in `taskfiles/ci-fast.yml`.
- Why: reuses an existing primitive (no new engine) and *enforces* the
  `persona-governance` ≤2-cap that already exists on paper.

### P1.2 — Untrusted-input / prompt-defense rule

- [x] `src/rules/untrusted-input-defense.md` (`type: auto`, tier-2a) routing to
      `docs/guidelines/agent-infra/untrusted-input-spotlighting.md` — already
      shipped (verified 2026-06-15): no role-takeover, no secret-leak, untrusted
      content as data, unicode/homoglyph/zero-width awareness.
- [x] Cited from the security skills (`threat-modeling`, `security-audit`,
      `judge-security-auditor`, `agent-security-review`) — verified present.
- [-] `evals/triggers.json` for the rule — **N/A (erroneous line)**: per
      `skill-writing` ("Rules / commands / guidelines do **not** get eval stubs —
      only skills route through the top-level catalogue"); no rule in the repo has
      an `evals/` dir. The line was a copy-paste from the skill template.
- Why: one frugal source block, projection-clean. Rejects per-artifact
  injection (a token tax against the package's frugality identity).

### P1.3 — Generated capability matrix

- [x] `generate_capability_matrix.py` derived from `generate_tools()` projection
      logic in `condense.py` — **Python**, not TS (council 2026-06-15, Decision 2:
      no TS-generator-with-drift-check precedent; the 5 existing generated-doc
      drift-checks are all Python; py→ts is the CLI/runtime direction, not one-off
      doc generators). Carries a **coverage guard**: every `generate_*` call in
      the dispatcher must be mapped in `_FN_SPEC` or generation fails (the
      "never silently drift" guarantee).
- [x] Output `docs/capability-matrix.md` + `dist/discovery/capability-matrix.json`
      (per-host: native / adapter / none; `†` = install-time surface).
- [x] Drift-checked in CI (`generate-capability-matrix-check` in `ci`/`ci-strict`).
- Why: cheapest durable win (self-regenerating); names real already-biting
  complexity (the `tools:[]` gating / host-specific regen pain). Doubles as
  honest "what works where" credibility.

### P1.4 — Named cookbook

- [x] `generate_cookbook.py` (**Python**, council 2026-06-15 Decision 2) →
      `docs/cookbook.md` from `src/flows/cookbook.yaml` (curated recipe seed) +
      the four validated `src/flows/<flow>.yaml`; **14 named recipes** ("Review a
      change", "Build a feature from a ticket", "Security-audit a surface",
      "Research a topic deeply", …).
- [x] **Every recipe validated** against real commands/skills via `resolve_logical`
      (the same primitive `lint_flows.py` uses) — generation FAILS on any
      non-existent ref. Test: `tests/test_generate_cookbook.py`
      (`test_bad_command_ref_fails_generation`). Anti-Source-C guard.
- [x] Linked from the README ("things you can do in a minute") + drift-checked
      (`generate-cookbook-check` in `ci`/`ci-strict`).
- Why: directly attacks the legibility bottleneck (227 skills illegible to a
  newcomer in 60s); generated → low rot; validated → never a boilerplate dump.

---

## Phase 2 — out-of-horizon (deferred-with-trigger)

> Not counted against the 5-slot cap. Each carries all four required fields
> (trigger / shape / sunset / owner+cadence) per the harvest policy.
> Glyph `[~]` = deferred-with-trigger, not abandoned.

- [~] **P2.1 — Readiness-audit funnel (the strategic bet).**
  - **Trigger (quantified, council guardrail — falsifiable).** Any one of:
    (a) **3+ distinct users/issues** asking "is my repo ready / what should I
    install" with the same root need; OR (b) a source ships a readiness-check
    equivalent AND it draws public adoption; OR (c) **10+ inbound validation
    questions** after P1.0 + P1.4 ship that a pre-flight funnel would resolve.
  - **Shape.** An `agent-config audit` command that *runs the existing*
    `project-analyzer`/`project-health` skills, maps findings onto the
    profile/pack recommendation already in the wizard's `auto-detect`, and emits
    a shareable one-screen summary + "run setup with profile X". No new rubric.
    A **queryable run-state + `status` handoff** (Source A's observability lead)
    folds in here as this command's output store — **not a separate adoption
    unit** (telemetry primitives in `engagement.py` already exist; the gap is a
    queryable surface, which this funnel provides).
  - **Sunset.** Never fork a standalone maturity-rubric catalog — the skills
    *are* the rubric items.
  - **Owner / cadence.** Plate owner; reviewed each plate.

- [~] **P2.2 — Selective-install `--skill` / `--division` flags.**
  - **Trigger.** ≥3 requests for single-skill or division-scoped install.
  - **Shape.** Extend `cmd_install.py` / `selectedTools.ts`; install-state
    already represents partial installs.
  - **Sunset.** **DROP `--link` (symlink dev-mode) permanently** — collides
    with the documented dangling-symlink-on-delete failure mode.
  - **Owner / cadence.** Plate owner; reviewed each plate.

- [~] **P2.3 — Cross-host parity REPORT (not a gate).**
  - **Trigger.** ≥1 user-reported "works in Claude, broken in <host>" issue.
  - **Shape.** A report mode over P1.3's matrix flagging skills native in ≥1
    host but absent in another; advisory only.
  - **Sunset.** **Never a hard gate** — projection is *intentionally* asymmetric;
    a gate manufactures false drift and forces a `host_exclude` schema field to
    silence itself.
  - **Owner / cadence.** Plate owner; reviewed each plate.

- [~] **P2.4 — Security pack slice.**
  - **Trigger.** A named maintenance owner + a CI-tooling decision (per
    `domain-adoption-policy`), AND demand (P2.1 audit shows security as
    top-requested pack across ≥10 repos, OR explicit user direction).
  - **Shape.** Extract security skills + the P1.2 defense rule into an
    installable **pack** slice using the existing pack-manifest system — *not* a
    second npm package.
  - **Sunset.** No second npm release lifecycle until adoption justifies the
    doubled CI/version surface (the trap that rots competitor packages).
  - **Owner / cadence.** Plate owner; reviewed each plate.

---

## Phase 3 — Dropped (reject reason; not carried forward)

- [-] **Cross-host parity GATE** — fights the intentionally-asymmetric
  projection; forces a new schema field to silence itself. (Report survives as
  P2.3.)
- [-] **Per-skill `tagline` field** — 227 hand-written strings + a locked-schema
  change; role-level taglines already exist and cover the funnel.
- [-] **Domain-organized "agent library" / "more agents"** — conflicts the
  `persona-governance` ≤2-per-domain cap; volume ≠ capability (the Source-C
  anti-lesson: 600+ agents, ~99% sharing one personality boilerplate, ~2/600
  with real tools).
- [-] **Declarative install-manifest rewrite** — already have declarative pack
  manifests + plan/apply; a shape-for-shape rewrite is churn.
- [-] **Visible uninstall / txlog / converter pipeline** — already shipped (Phase 0).
- [-] **Queryable observability state-store as a *standalone* borrow** — folds
  into P2.1 as that command's output store; adopting it separately double-counts
  effort and burns a slot (council, 2026-06-13).
- [-] **"Six-majors-in-eight-weeks" cadence / instability note in the README** —
  speculative (no user feedback, metric, or issue cites the perception); would
  consume hero real estate the three differentiators need (council, 2026-06-13).

---

## Council notes — four-lens panel (2026-06-13)

The repo-local council CLI could not make live calls this session (no
provider keys). Substitute: four independent adversarial lenses
(adoption-strategist · architecture-guardian · maintainer-cost-realist ·
critical-skeptic) scored each candidate; synthesis + tie-break:

- **Defense baseline** split ADOPT/DROP → reframed to **one rule**, not
  per-artifact injection (resolves the frugality objection).
- **Cookbook** split ADOPT/DEFER → adopt **generated + validated only** (the
  "no demand" objection is weak for a low-rot generated artifact attacking the
  real bottleneck).
- **Readiness audit** four-way split → **defer**, and when it fires build it
  **thin** over existing analyzers, not a new rubric.
- Consensus DROP: parity **gate**; consensus ADOPT: capability matrix
  (generated), anti-dup gate (guard-railed).

### v6 refresh — live two-member council (2026-06-13, deep)

Done — the real run the four-lens panel asked for. Live keys
(claude-sonnet-4-5 + gpt-4o, analysis lens, deep) scored the post-v6.0.0
reviewer pass. Convergence:

- **ADOPT** — strengthen Phase 0 (pointer-level uninstall + scoped projection +
  portability guard); rewrite the Goal (the old "only distribution gap" wording
  contradicts Phase 0 once it lists shipped differentiators — internal-
  consistency repair, not narrative); surface the three differentiators above
  the README fold.
- **REJECT** — queryable state-store as a *standalone* unit (it is P2.1's
  implementation detail); the "six-majors = instability" cadence note
  (speculative, no cited signal, displaces differentiator messaging).
- **Guardrails (both members):** the two new differentiator claims are
  **INFERRED** from the sources' write-ups, not code-audited — gate them behind
  the P1.0 validation step with a disprove-and-downgrade failure protocol; keep
  the audit evidence **source-anonymous** (gitignored store; README cites only
  "validated `<date>`"); quantify the P2.1 triggers so "deferred-with-trigger"
  stays falsifiable.
- **Sharpest catch (claude-sonnet-4-5):** the validation gate and source-
  anonymity collide — competitor code citations cannot live in a source-
  anonymous doc, so the evidence goes to the gitignored harvest store, never
  this file. This guardrail is now baked into the P1.0 validation step.

---

### Execution council — three decisions (2026-06-15, deep + peer-review)

Live council (claude-sonnet-4-5 + gpt-4o, design lens, deep, peer-reviewed)
adjudicated the three points where the P1 directives collided with repo
reality. Both members + the peer-review round converged:

- **Decision 1 (P1.1 gate severity).** Ship **warn-only**, not a hard CI fail —
  `adr-architectural-consensus-mechanism` already deferred fail-the-build until
  thresholds are stable one release cycle; a roadmap directive does not override
  a standing ADR. Reuse the existing Jaccard primitive, do not build a second
  similarity engine. Promotion path (`--strict`) documented.
- **Decision 2 (P1.3/P1.4 language).** Ship **Python**, not TS — no
  TS-generator-with-drift-check precedent; the five existing generated-doc
  drift-checks are all Python; the py→ts direction is the CLI/runtime, not
  one-off doc generators. Reversible; logged as a deliberate deviation.
- **Decision 3 (P1.0 validation gate).** **Option A** — surface the
  differentiators as factual capability statements (CONFIRMED against `src/`),
  not as an unverifiable "vs the sources" comparison; defer the comparative
  claim until source evidence exists; record the disposition (done in
  § Acceptance).

## Acceptance criteria

- [x] Plate-owner go/no-go: the three contested decisions (P1.1 gate severity,
      P1.3/P1.4 generator language, P1.0 validation-gate disposition) were routed
      to a live AI council (claude-sonnet-4-5 + gpt-4o, design lens, deep,
      peer-review, 2026-06-15) per the executor's mandate; dispositions below.
- [x] Each shipped P1 unit lands with verification evidence: `lint-skill-originality`
      green (230 skills, 0 would-fail, 2 allowlisted) for P1.1; rule+guideline+
      citations verified present for P1.2 (eval-stub line struck as N/A); drift-check
      green for P1.3; `tests/test_generate_cookbook.py` (4 passed, incl.
      validation-fails-on-bad-recipe) for P1.4.
- [x] **P1.0 validation gate — disposition recorded (Option A).** The two INFERRED
      "differentiator vs the sources" claims were NOT validated this session (no
      harvest evidence; ENC1 sources not auditable). Per council Decision 3, the
      README ships the mechanics as **factual capabilities** (CONFIRMED against
      `src/`), not as a comparative claim — so no unvalidated hero comparison was
      shipped. The comparative claim remains INFERRED and deferred to a future
      session with source access. No Phase 0 row disproved → no downgrade needed.
- [ ] P2 deferred items reviewed at the next plate boundary; any fired trigger
      (per the quantified P2.1 criteria) promotes to adopt-now (consumes a slot).
- [x] Live council re-run recorded (claude-sonnet-4-5 + gpt-4o, deep,
      2026-06-13) — dispositions folded into Goal / Phase 0 / P1.0 / P2.1 /
      Phase 3 above. Supersedes the four-lens substitute panel.

## Provenance

- Feedback inputs: local harvest evidence (gitignored), cross-read against the
  package's own `src/` capability audit (2026-06-13), plus a post-v6.0.0
  reviewer pass verified against `src/` (`json_pointers.py`, ADR-040,
  `check_portability.py`, ADR-086 = rejected). 10 borrow items confirmed already
  shipped; the genuine gaps drive Phase 1 / Phase 2.
- Source identities (recoverable by the maintainer via
  `src/scripts/_lib/link_crypto.py decrypt`):
  - Source A — `ENC1:0VGF0oQGy1++2LZ7J08eq/9/u/4CHfXgmsKIKkpiyYxtsdKB3sjHIcD8pqFzRWyw3Mc3Q/THxUjU+YEWQUpfGBlGssQPglkM98w62uaxZmt08UIe1BWr5YFKHPmk62I=`
  - Source B — `ENC1:pMcCJPiF4aJk2EXmSEXNhWnyOwffE7bD6egqIdQS8qH56ex8qkyT8oS+6o6+D1XQp6G6fQX3MBYGWY5hqS/G3AW7doi3nW/NK1f1fGZzRAx8aOhjoL/MPuB1lCT4iZDnq3rdfK0OF4wK03eJvA==`
  - Source C — `ENC1:MksmcIO40Qxua7Fuzw4iXID96m1+jteECu4f9TuUby2lWE3osfaoHNhyyyU6fdU0Fj6ZXh1tAHAjPDC+jV3hG+xms0Q8Bg5upQd5z73kk/Vos4bL4r2mfz65txi8wsGPHcS0LKveFe6kGnkfuIH5TQ==`
- Council: live two-member run (claude-sonnet-4-5 + gpt-4o, deep, 2026-06-13)
  plus the earlier four-lens substitute panel; syntheses + tie-breaks in
  § Council notes.
