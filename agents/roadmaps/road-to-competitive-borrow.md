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

- [ ] Drive `lint-readme-jargon` above-fold hits to **0** (currently 2).
- [ ] Surface the **three shipped differentiators** above the fold, one line each:
      - pointer-level uninstall — "removes only its own keys from a shared host
        config (JSON-pointer + SHA-256), never a neighbour tool's entries";
      - pack-scoped projection — "installs the active pack only, not a
        500-artifact dump";
      - portability guard — "CI-enforced source confidentiality; works in any
        project".
- [ ] **Validation gate (council guardrail — blocking before any hero copy
      ships).** By P1 midpoint, validate the two INFERRED differentiator claims
      (scoped projection, portability guard) against the sources. Because the
      roadmap is **source-anonymous**, the audit evidence lives in the gitignored
      harvest-evidence store — never in this file or the README; the README
      cites only "validation: confirmed `<date>`" with no source disclosed.
      **Failure protocol:** if a claim is disproved — (1) pull it from the README
      hero immediately, (2) downgrade its Phase 0 row to "parity achieved (not a
      differentiator)", (3) log the correction in § Acceptance.
- [ ] Render the **existing role-level taglines** (`lint_role_experiences.py`,
      WorkspacePage) in profile/catalog pages — do **not** add a per-skill
      `tagline` field (227 strings + a locked `additionalProperties:false`
      schema change; see Phase 3 drop).
- [ ] Link the capability matrix (P1.3) from the README ("works on N hosts").

### P1.1 — Anti-duplicate originality gate

Promote the existing **report** to a guard-railed **gate**.

- [ ] New `task lint-skill-originality` wrapping `skill_overlap.py` / `audit_overlap.py`.
- [ ] **Within same domain/pack:** jaccard ≥ FAIL threshold → CI fail.
      **Cross-domain:** ≥ lower threshold → WARN only.
- [ ] Documented allowlist for legitimate cluster-head pairs already
      disambiguated by ADRs (`laravel`↔`symfony-workflow`, `project-analysis-*`,
      `devcontainer`↔`copilot-config`). **Hard cap the allowlist** per the
      `autonomous-execution` allowlist-growth antipattern (>20 entries = the
      linter is wrong, not the content).
- [ ] Wire into `consistency.yml` / `ci-fast`.
- Why: reuses an existing primitive (no new engine) and *enforces* the
  `persona-governance` ≤2-cap that already exists on paper.

### P1.2 — Untrusted-input / prompt-defense rule

- [ ] New `src/rules/untrusted-input-defense.md` (`type: auto`, tier-2) routing
      to a guideline: no role-takeover, no secret-leak, treat fetched/untrusted
      content as suspect, unicode/homoglyph/zero-width awareness.
- [ ] Cite it from the security skills (`threat-modeling`, `security-audit`,
      `judge-security-auditor`) instead of inlining a block per artifact.
- [ ] `evals/triggers.json` for the rule (5 should / 5 should-not).
- Why: one frugal source block, projection-clean. Rejects per-artifact
  injection (a token tax against the package's frugality identity).

### P1.3 — Generated capability matrix

- [ ] `generate_capability_matrix` (TS, per the py→ts direction) derived from
      `generate_tools()` projection logic — never hand-maintained.
- [ ] Output `docs/capability-matrix.md` + `dist/discovery/capability-matrix.json`
      (per-host: artifact type → native / adapter / none / excluded).
- [ ] Drift-checked in CI like the other generated docs (sync-check).
- Why: cheapest durable win (self-regenerating); names real already-biting
  complexity (the `tools:[]` gating / host-specific regen pain). Doubles as
  honest "what works where" credibility.

### P1.4 — Named cookbook

- [ ] `generate_cookbook` (TS) → `docs/cookbook.md` from `src/flows/` + commands
      + roles; ~10–15 **named** recipes ("PR review", "feature from ticket",
      "security audit", "release readiness", "research report").
- [ ] **Every recipe validated** against real existing commands/skills —
      generation FAILS if a recipe references a non-existent command. (The
      anti-lesson of Source C: its recipes reference agents with no real tools.)
- [ ] Linked from README as the "10 things you can do in a minute" surface.
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

## Acceptance criteria

- [ ] Plate-owner go/no-go recorded on the four P1 units + the P1.0 docs task.
- [ ] Each shipped P1 unit lands with verification evidence (linter green for
      P1.1; eval stub for P1.2; drift-check for P1.3; validation-fails-on-bad-
      recipe test for P1.4).
- [ ] **P1.0 validation gate cleared** — both INFERRED differentiator claims
      validated (or disproved + downgraded per the failure protocol) before any
      hero copy ships; evidence stored source-anonymously; correction logged
      here if a claim fell.
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
