---
complexity: structural
status: ready
parent_roadmap: road-to-operator-runtime-harvest
---

# Road to positioning & enforcement — close the *perceived* gap, ship the one real one

**Trigger:** Maintainer re-ran an external third-party comparison of this package
against a high-momentum operator-runtime reference suite ("Source A"). The
external review undersold this package (read the **command** count as the skill
count → "162 skills") and re-did a README-only read of *our* internals, claiming
we lack capabilities we already ship. Maintainer goal: this package must credibly
be **both** "make the agent more capable" **and** "make it reliable / reproducible
/ team-ready" — never the runtime-suite-for-capability vs us-for-control split.

**Mode:** Positioning plate + one narrow engineering slice. Source referenced
source-anonymously per `source-confidentiality`; real link as an `ENC1:` token in
§ Provenance (maintainer to fill).

- **Source A** — the same external operator-runtime / Claude-Code reference as
  `road-to-operator-runtime-harvest` (runtime-first: deterministic PreToolUse
  hooks, SQLite state store, self-writing learned-skill memory, GAN MVP pipeline,
  compiled control plane).

## Goal

The decisive, council-confirmed finding: **our gap is positioning, not
capability.** Verified at HEAD — this package ships **258 skills, 93 rules, 162
commands, 26 personas + 5 advisors**, plus a capability router (`dist/router.json`,
88 rules, intent→skill), multi-agent orchestration + consensus
(`subagent-orchestration` do-and-judge, `ai-council`, ADR-105), lifecycle hooks
(work_engine 10 events + `hooks.json` 6 events), governance learning
(`skill-improvement-pipeline`), and cross-harness projection. Source A's genuine
edge is its **runtime** layer — but its strongest piece (deterministic hook
blocking) reaches only **~2 of our 7 projection hosts** (Claude Code, Cline/MCP);
Cursor, Windsurf, Copilot, Gemini are static-only. So the universal enforcement
lever is **compile-time frontmatter**, not runtime hooks.

This roadmap therefore (a) makes the existing depth **visible**, (b) ships the one
universal enforcement upgrade, (c) draws a public **"Do Not Cross"** boundary that
turns our rejections into positioning assets — never importing Source A's runtime
identity.

## Council convergence (inline per `no-roadmap-references`)

Council (claude-sonnet-4-5 + gpt-4o, 2026-06-25, 2 rounds) converged:
1. Gap is positioning/communication, not capability — top-leverage is README
   leading with capability, not governance taxonomy.
2. Universal enforcement lever = compile-time frontmatter strengthening; runtime
   hooks help <30% of hosts → niche, not platform.
3. Runtime MCP hooks = Tier-2 opt-in/experimental, clearly labelled MCP-only.
4. Live cost/loop telemetry is daemon-adjacent → post-session analysis command,
   not live mid-session injection.
5. Publish a "Do Not Cross" list (no self-writing memory, no SQLite state, no
   daemon/TUI, no GAN builder) as a positioning asset.
6. Positioning line: *"258 skills + auto-routing + multi-agent orchestration +
   compile-time governance enforcement, projecting into 7+ tools with zero runtime
   daemon."*
   Flip condition toward runtime hooks: evidence that >60% of *active* users are
   on hook-capable (MCP) hosts.

## Phase 0 — Positioning (no code, highest leverage)

- [x] Surface the catalog count badges into the README hero (out of the
  collapsed `<details>` "headline is the experience, not the counts" block). Done
  2026-06-25; `counts-check` + all README linters green.
- [x] Rewrite the README opening to **lead with capability** (258 skills + 162
  commands + router + multi-agent orchestration), then the no-daemon guarantee,
  then governance — not install-hygiene-first. Done 2026-06-25 (README lead
  paragraph + reframed "What's different").
- [x] Add a **host-capability matrix** — which enforcement mechanism each host
  gets: runtime hooks (Claude Code, Cline/MCP) vs compile-time frontmatter
  (Cursor, Windsurf, Copilot, Gemini). Done as `docs/enforcement-by-host.md`
  (not the generated `capability-matrix.md`), linked from the README; honest, no
  "deterministic everywhere" over-claim.
- [x] Publish a **"What it deliberately is *not*"** block (README): no daemon, no
  state database, no self-rewriting memory, no auto-build pipeline — the Do-Not-Cross
  list framed as a positioning asset. Done 2026-06-25.
- [x] Verify: `readme_linter` + `lint_readme_size` (441/750) + `lint_readme_jargon`
  (2/3 above the fold) green; `update_counts.ts --check` green; `check_references`
  no broken refs. All green 2026-06-25.

## Phase 1 — Universal compile-time enforcement (Tier-1)

- [x] Design `governance-enforcement-linter` (compile-time): turn the strongest
  cooperative Iron Laws into **frontmatter-native HARD CONSTRAINT** blocks
  injected at projection time, with explicit override-guard phrasing. Spec drafted
  2026-06-25 at `docs/contracts/governance-enforcement-projection.md` (Status:
  Proposed) — selector = the 3 `tier: safety-floor` rules (no schema change),
  injection in `condense.ts`, drift-gate verification, length-controlled eval.
  **Awaiting maintainer approval before implementation.**
- [-] Per-host projection tuning — **cancelled**: the eval baseline (`package`)
  sits at the discipline ceiling (1.0) on trapD/trapE, so no phrasing has headroom
  to improve. Moot until a pressure/long-context corpus shows the cooperative
  rules actually degrade.
- [x] Enforcement eval — **ran 2026-06-25, honest-null (discipline ceiling).**
  54 paired runs (6 tasks × 3 arms × 3 seeds, sonnet-4-6, $1/run cap). Result:
  `discipline_score = 1.000` for `package`, `hardened` AND `hardened-placebo`
  across all 18 paired instances; **Δ(hardened − package) = 0.000 (0/0/18)**.
  `capability_pass = 15/18` (real edits — not a floor artefact). The `package` arm
  already catches trapD (non-destructive) + trapE (scope-control) at ceiling, so the
  hardened blocks add nothing measurable. **Per the spec → `condense.ts` is NOT
  wired; the feature does not ship.** Caveat: single-shot micro-fixtures do NOT
  reproduce the token-pressure / long-horizon condition the treatment targets
  (corpus saturates). The opt-in `hardened` arm stays in `bench_ab_v2_run.ts` as a
  reusable measurement tool. Report:
  `internal/bench/reports/ab-v2/2026-06-25T18-27-13Z-ab-v2-paired.json`.
- [x] Verify: new-arm unit tests green (7/7, `bench_ab_v2_run.test.ts`); eval run
  completed (exit 0, 54 runs); paired stats computed. Done 2026-06-25.

## Phase 2 — MCP-only opt-in runtime (Tier-2, gated)

- [-] Governance hook pack (opt-in MCP-only) — **cancelled** (Iron Law 3
  resolution, 2026-06-25): the cheaper universal lever measured honest-null at
  ceiling, so Tier-2 runtime enforcement is unjustified on current evidence.
  Revisit only behind a pressure/long-context corpus.
- [-] `agent-config analyze-session` — **moved out** to a draft follow-up
  (`road-to-session-analytics.md`): a genuinely useful post-session utility, kept
  alive separately rather than buried in the (now-null) enforcement thesis.
- [-] Verify (Phase 2) — **cancelled** with the hook pack above.

## Acceptance criteria

- README leads with capability; count badges visible in hero; host-capability
  matrix + "Do Not Cross" published.
- Compile-time enforcement spec approved and (if built) backed by a measured
  before/after eval — no unsourced violation-rate claims.
- Any runtime hook work is opt-in, MCP-only, labelled experimental, and no-ops on
  static hosts.
- Nothing on the "Do Not Cross" list is built.
- Source A stays anonymized in every tracked artifact.

## Provenance

- Source A link: `ENC1:` token — maintainer to fill via `link_crypto.ts`.
- Sibling: `road-to-operator-runtime-harvest.md` (same Source A, harvest plate).
