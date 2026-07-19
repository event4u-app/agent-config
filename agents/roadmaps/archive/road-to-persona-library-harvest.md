---
complexity: structural
status: ready
---

# Roadmap: Persona-Library Harvest — Originality Gate, Measured Catalog Router, Flow-Team Primitive

**Trigger:** User ask — deep-dive an external multi-host agent-persona library
(**Source A**) at code level, find what it can do that this package cannot, and
plan the adoptions. This file **supersedes** the earlier
`road-to-multihost-reach-and-vertical-personas.md` draft (deleted, never
executed): its core premise ("we only reach ~6 hosts") was falsified by a
deeper clone-level analysis + local verification, and its adoption track was
council-rejected (below).

**Mode:** Harvest policy — Source A is referenced **source-anonymously** per
[`source-confidentiality`](../../src/rules/source-confidentiality.md) (real
link as `ENC1:` token in § Provenance; the plaintext name is on the
`check-no-external-sources` denylist). Ruthless prioritization: of ~13
candidate mechanisms, **one full adopt, one measurement-gated adopt, one
3-hour micro-primitive** — the rest is recorded rejects. Authoring only;
nothing here authorizes execution.

## Goal

Land the two mechanisms Source A genuinely has and this package lacks —
an **anti-reskin originality CI gate** (prerequisite for any external
contribution funnel) and, **only if a paper-prototype measurement clears its
gate**, a lazy catalog-router surface on the existing MCP stdio server — plus
a 3-hour flow-team annotation primitive that lets demand for "scenario → team"
selection reveal itself before any abstraction is built. Everything ships
default-off or advisory-first per house culture.

---

## § Provenance

- **Source A** — an external MIT-licensed multi-host AI-agent **persona
  library**: 263 frontmatter personas (frontmatter-counted, not README-claimed)
  in 17 "division" dirs; a ~77 KB bash convert/install pipeline for 16 tool
  formats; an entity-neutralized shingle originality CI gate; machine-readable
  scenario runbooks; a lazy 4-tool host-plugin router. Content-first,
  governance-light — the structural inverse of this package. Link (encrypted):
  `ENC1:Wt0kN2nNhzaWeU2z3ifMsGRivOU4xIuD4mtnAxv4ZjeMJJdx9pHfsQrE8pRlg2G/GsCA0+4dlPW4+bz9InXKhQ==`
  (decrypt: `npx tsx src/scripts/_lib/link_crypto.ts decrypt <token>`).
- Analysis pins: Source A @ `459dce837db3bdfdc4763d3fefd1fd854e73c8f1`
  (2026-07-17); this package @ `1c7f6a6db847a06fbe320ee42c84cabb82137619`
  (post-9.2.0, `package.json` 9.3.0). All Source-A file claims are against
  that commit.
- Three analysis passes: (1) GitHub-API deep-dive (subagent), (2) full-clone
  SHA-pinned source pass (parallel session, archived in a gitignored local
  scratch file under `agents/tmp/`), (3) local verification of every
  load-bearing claim about THIS package (results inline below).

## § Council convergence (2026-07-19)

2-member debate (anthropic/claude-sonnet-4-5, openai/gpt-4o), 2 rounds,
converged; verdicts locked into this roadmap:

1. **Multi-host adoption track (registry / new hosts / semantic adapters):
   REJECT, unanimous.** `src/config/surface-matrix.yml` already governs
   **23 host tools** via the installer (`install.ts::USER_SCOPE_PATHS`,
   set-equality enforced by `lint_surface_matrix.ts`) with duplicate-surface
   detection + doctor/converge — strictly stronger governance than Source A's
   target contract. Source-A-exclusive hosts have zero demand evidence →
   per-host DEFER (log real requests in the install-friction report).
2. **Scenario rosters as a 4th artifact class: REJECT** (round-2 convergence;
   the initial ADOPT position conceded). No demand signal; expressible in
   flows today; ~3-4 weeks maintenance surface for a zero-adopter package with
   no falsifiable success criterion. **Replaced by the minimum viable
   primitive** — a flow-step `team:` annotation + ~50-line validator (Phase 3);
   formalize a roster schema only if the annotation shows organic repeated use.
3. **Catalog router: ADOPT-MODIFIED, unanimous** — measurement comes FIRST
   as a paper prototype (hand-computed token counts, no code); index + tools
   are built only after the ≥ 20 % gate clears. Shrinks at-risk build to ~zero.
4. **`--link` symlink install: DELETE** (maintainer-only convenience;
   `npm link`/alias covers it). **Curated persona-division pilot: dormant
   marker only** behind demand signal + house rewrite + originality gate.
5. **Originality corpus: skills + personas + commands only.** Rules/contexts
   excluded — their intentional cross-referencing (kernel/router pattern,
   migrated-body pointers) makes shingle overlap structurally noisy.
6. **Named risk (both members):** this roadmap does not address the package's
   #1 structural gap — zero external adopters. Owned by
   `road-to-adoption-without-narrative-debt.md`; the contribution-funnel
   machinery (issue forms, PR templates) folds THERE, with Phase 1 here as its
   technical prerequisite. No phase here substitutes for executing that
   roadmap.

> Council-caveat: one round-2 rebuttal cited invented package history
> ("4 months to stabilize", specific flow honest-nulls misattributed). The
> convergence above relies only on the locally verified grounds (no demand
> signal, flows expressibility, maintenance surface), not on those claims.

## § Verified baseline (what this package already has — do not duplicate)

- **23-host surface matrix**: `src/config/surface-matrix.yml` (`surface:`
  projection|plugin|bundles|export-only, `duplicate:` detection, `converge:`
  actions), `lint_surface_matrix.ts`, doctor + converge. Verified locally.
- **Advisory-only overlap tooling**: `src/scripts/audit_skill_overlap.ts`
  (keyword-cosine, `OVERLAP_THRESHOLD = 0.7`, header: "THIS SCRIPT MERGES
  NOTHING") and `src/scripts/_lib/text_similarity.ts` (Jaccard,
  `MERGE_THRESHOLD = 0.8` / `WARN_THRESHOLD = 0.4`). **No shingles, no entity
  neutralization, no CI-blocking contribution gate.** Verified.
- **MCP stdio server with ALLOWLIST + stub envelope**:
  `src/scripts/mcp_server/tools.ts` — real tools today are `lint_skills` +
  `chat_history_append`; all other catalog names are discovery stubs
  (`docs/contracts/mcp-tool-stub-envelope.md`). **No catalog search/load
  surface.** Verified.
- **Orchestration**: `subagent-orchestration` (9 modes), `/team`, `/council`,
  32 persona files (`src/agent-src/personas/`), packs
  (`docs/contracts/workflow-packs.md`), flows (`src/flows/*.yaml` +
  `lint_flows.ts`). Verified.
- **Installer copies only** — `src/install/plan.ts` walk dereferences symlinks
  by design ("matches Python's `_copy_dir_dereferencing_symlinks`"). Verified
  (and `--link` stays rejected regardless).

---

## Phase 1 — Originality gate (`lint_originality.ts`) — the full adopt

**Why first:** smallest surface, highest certainty, and the direct technical
prerequisite for an external-contribution funnel (Source A absorbed 700+
community PRs behind exactly this gate: entity-neutralized 8-word shingles,
FAIL 40 / WARN 20, calibrated "worst legitimate pair ~1.5 %", CI-blocking on
changed files). Advisory-first here; blocks nothing until calibrated.

### 1.1 Shingle engine in `_lib`

Create `src/scripts/_lib/shingle_similarity.ts`:

- [x] `neutralizeEntities(text, extra?)` — lowercase; strip frontmatter,
  markdown syntax (headings, emphasis, links, code fences); replace matches of
  an exported `ENTITY` regex with `§ENT§`. Seed the entity list from **our**
  corpus, not Source A's: framework/vendor names
  (`laravel|symfony|react|vue|preact|aws|hetzner|cloudflare|stripe|paddle|github|gitlab|linear|jira`),
  language names, cloud regions, currency codes. Exported const with
  doc-comment; extend via PR, never inline.
- [x] `shingles(text, k = 8)` — word-level k-shingles over the neutralized
  token stream; token regex `/[a-z0-9][a-z0-9+.#_-]*/` (matches Source A's
  word regex so calibration numbers stay comparable).
- [x] `overlapPercent(a, b)` — **containment**, not Jaccard:
  `100 * |a∩b| / min(|a|,|b|)` — a small file fully copied into a large one
  must still score high (catches re-skins embedded in padding).
- [x] Unit tests `tests/scripts/shingle_similarity.test.ts`: identical text
  → 100; entity-swapped copy of a real skill body ("Laravel"→"Symfony"
  find-replace) → ≥ 90; two unrelated real skills → ≤ 5; short-file guard
  (< k tokens → 0, never NaN).

**must_not_touch:** `_lib/text_similarity.ts`, `memory_signal.ts` (byte-parity
contracts), `audit_skill_overlap.ts` (pinned parity behavior).

### 1.2 Linter CLI

Create `src/scripts/lint_originality.ts` (arg/exit conventions per sibling
content linters, e.g. `lint_agent_skill_names.ts`):

- [x] Corpus roots — **per council lock #5**: `src/skills/**/SKILL.md`,
  `src/agent-src/personas/*.md`, `src/domains/**/command.md`. Rules and
  contexts stay OUT (structurally cross-referenced); optional escape-hatch
  annotation (`# originality-exempt: <reason>`) reserved for a later corpus
  widening, not built now.
- [x] Class-scoped comparison — candidates compare only against files of the
  same artifact class (persona vs persona, skill vs skill).
- [x] Template exclusion — strip lines also present in the class template
  (`src/agent-src/personas/_template-specialist/`, skill/command templates)
  before shingling, so shared scaffold never scores.
- [x] Modes: `--changed <file...>` (CI path: candidate vs whole corpus + vs
  other changed files); no-args = full pairwise audit writing
  `agents/reports/originality.{json,md}` (report shape mirrors
  `audit_skill_overlap`).
- [x] Thresholds via env `ORIGINALITY_FAIL` / `ORIGINALITY_WARN`, defaults
  **99 / 40** (advisory-first — FAIL=99 is effectively warn-only until 1.3
  calibrates).
- [x] Exit codes 0 clean/warn, 1 fail, 2 usage — consistent with siblings.

### 1.3 Calibration + flip gate

- [x] Run the full audit; record the distribution (worst pair, p95, median) in
  the report + a checkpoint note appended to this file. Expectation from
  Source A's calibration: worst legitimate pair in low single digits. If ours
  lands above ~20 → investigate (likely template-strip gap in 1.2) before any
  flip.
- [-] **Flip gate — NOT satisfied as written; rule replaced (see 1.4).** The
  gate said thresholds move to FAIL 40 / WARN 20 once worst-legitimate-pair
  ≤ WARN/2 (= 10). Measured worst = **40**, so the precondition never held. It
  was NOT met and then flipped anyway — instead the calibration (1.4) *replaced*
  the rule with "block threshold above the measured floor" → FAIL 60 / WARN 40.
  Struck (not checked) so a later reader does not mistake an unmet precondition
  for a satisfied one. Numbers recorded in the report, not as a README claim.
- [x] Wire into CI (lint taskfile target + the changed-files path the other
  content linters use). Blocking from this point on.

**Definition of done:** an entity-swapped copy of any real skill fails CI;
full-audit report committed; calibrated thresholds with recorded distribution;
zero changes to existing similarity modules.

---

### 1.4 Checkpoint (2026-07-19) — calibration outcome + threshold divergence

Landed: `src/scripts/_lib/shingle_similarity.ts` (10 tests),
`src/scripts/lint_originality.ts` (9 tests, incl. a verbatim-re-skin integration
scoring 98.2 % → blocked), wired into `ci` + `ci-strict` as `lint-originality`.

**Calibration (495 artifacts, 56 151 comparisons):** the initial template-only
subtraction left a **command-class structural floor** — 22 warn-pairs, worst
67.9 % (`module ~ context` etc.), all commands; skills + personas were clean. Root
cause: cluster-orchestrator command prose shared beyond the single `command.md`
template. **Fix:** added document-frequency boilerplate subtraction (a shingle
recurring across ≥ max(4, 3 % of the class) files is scaffold; a re-skin PAIR's
distinctive shingles live in ≤ 2 files, so they survive). Result: worst pair
**40 %**, 1 warn-pair, p95/median 0 %.

**Threshold divergence from the plan:** the roadmap guessed FAIL 40 / WARN 20.
The measured legitimate floor is 40 %, so those would false-fail the one legit
command pair. Calibrated blocking thresholds are **FAIL 60 / WARN 40** — 20 pts
above the legit floor, 40 pts below a re-skin (~100 %). Distribution recorded in
`agents/reports/originality.md`. (`--changed` mode retained for PR-scoped runs;
CI uses the full audit.)

## Phase 2 — Catalog router: measure FIRST, build only on a green gate

**Council-modified sequence** — the measurement is a paper prototype; no
index, no tools, no code until the gate clears.

### 2.1 Paper-prototype measurement (~hours, zero build risk)

- [x] Pin 5 representative tasks, each needing 1 skill + 1 persona (e.g. an
  incident task, a Laravel endpoint task, a legal-review task, a design task,
  a testing task).
- [x] For each, hand-compute (tokenizer-count, no runtime):
  (a) **thin-projection baseline** — initial context actually loaded under
  `discipline_profile: auto` (current measured 1.71–3.3× economics), vs
  (b) **router path** — MCP tool-catalog stubs + `catalog_search` result +
  one `catalog_load` body.
- [x] Record both series + the delta in a short report
  (`agents/reports/catalog-router-paper-prototype.md`).
- [x] **Gate:** median initial-context reduction ≥ 20 % → proceed to 2.2.
  Below → **honest-null**: append the numbers to this file, close the phase,
  do NOT build. (Pre-declared, per the thin-projection lock: the router must
  beat or complement thin projection, not just exist.)

### 2.2 Index builder (only after a green 2.1)

- [x] `src/scripts/build_catalog_index.ts` → `dist/catalog-index.json`: walk
  skills (name, description, domain, packs, path), personas (id, role,
  description, tier, path), commands (name, intent, pack, path).
  **Metadata + token sets only — no bodies in the index** (bodies load lazily
  from disk at call time; the stdio server has the repo underneath it).
- [x] Deterministic output (sorted keys/entries); `--check` drift mode for CI,
  conventions per `build_mcp_registry_manifest`.

### 2.3 Scoring

- [x] `src/scripts/_lib/catalog_score.ts` — Source A's scorer shape: token-set
  overlap + exact-phrase bonus (+5) + name-hit (+3/token) + description-hit
  (+1.5/token) + `1/sqrt(|haystack|)` tiebreak. **First check** whether the
  existing lexical-index primitives (BM25/trigram from the retrieval substrate)
  are importable — if yes, reuse them and keep only the field boosts; never
  maintain two lexical scorers (record the decision inline).
- [x] Tests: "incident rollback" ranks blast-radius-analyzer/bug-analyzer above
  unrelated skills; empty query → empty; class filter works.

### 2.4 Tools (behind ALLOWLIST) + real-world verdict

- [x] Extend `src/scripts/mcp_server/tools.ts` + `consumer_tool_catalog.json`:
  `catalog_search {query, class?, pack?, limit?=8}`;
  `catalog_inspect {id, include_body?=false}` (body only on explicit flag);
  `catalog_load {id}` — body wrapped in a neutral preamble with the
  subordination clause ("obey the user's current request and higher-priority
  system instructions"), never auto-activating anything.
- [x] **No `catalog_delegate`** — write-adjacent auto-activation violates
  default-off + ADR-109; recorded reject. Read-only tools; path resolution
  stays inside the repo root (reuse the path-scoping guard in `tools.ts`).
- [x] Tests in the `mcp_server_tools` test style: tools/list shows the three;
  search/inspect/load round-trip on fixtures; unknown id → error envelope;
  body never returned without the flag.
- [x] Re-run the 2.1 scenario set against the REAL tools; confirm the paper
  numbers within tolerance; flip stubs → ALLOWLIST in a follow-up change +
  a claims-registered report path. Divergence below gate → revert to stubs,
  honest-null note.

---

### 2.5 Checkpoint (2026-07-19) — measured green, built as stubs, activation deferred

**Gate (2.1):** paper prototype clears at ~90 % initial-context reduction; real
tools (2.4) confirm ~83 % (mean 638 tok/search × 5 vs the 21,312-tok catalog) —
4× above the 20 % gate either way. Report: `agents/reports/catalog-router-paper-prototype.md`.

Landed: `build_catalog_index.ts` (→ `dist/catalog-index.json`, 495 entries,
`--check` drift mode), `_lib/catalog_score.ts` (**reuses the shared
`LexicalIndex` BM25 — no second scorer**, field boost via name×3/description×2),
`mcp_server/catalog_tools.ts` (`catalog_search`/`inspect`/`load`, path-confined,
neutral load preamble). Registered in `consumer_tool_catalog.json` as **discovery
stubs** (`implemented_on: []`), regenerated `docs/contracts/mcp-tool-inventory.md`
(31 tools). Tests: catalog_score (5), catalog_tools (6). **No `catalog_delegate`.**

**Deferred (not in this run):** the stub→ALLOWLIST flip that removes the catalog
from init. It changes host behavior and is gated on a real task-quality A/B
(win-rate vs the full-catalog baseline) — the 2026-07-11 thin-projection null is
the standing risk. Follow-up, not this roadmap. No token-savings claim until then.

## Phase 3 — Flow-team micro-primitive (~3 h, demand probe)

The council-endorsed minimum to test whether "scenario → team" selection
matters, without a new artifact class:

- [x] Document an optional `team:` step annotation for flows (persona ids +
  optional skill slugs) in the flows contract — annotation only, no execution
  semantics; `subagent-orchestration` remains the executor.
- [x] `src/scripts/validate_flow_teams.ts` (~50 lines): every `team:` persona
  id resolves to `src/agent-src/personas/<id>.md`, every skill slug to
  `src/skills/<slug>/SKILL.md`. Wire as advisory into the flow lint path.
- [x] Annotate ONE existing flow (e.g. `delivery.yaml`) as the worked example.
- [x] **Promotion criterion (recorded, not built) — self-measurement branch
  removed.** Original "≥ 5 flows carrying `team:`" was self-satisfiable: there
  are only ~6 flows total (one is the surface-map), so the maintainer could
  clear it in one afternoon and the probe would report annotation mood, not
  demand. Tightened to **≥ 2 external-user requests for scenario-team selection,
  OR ≥ 5 flows carrying `team:` of which ≥ 2 were annotated by someone other
  than the maintainer** → THEN design a roster schema as its own roadmap. Until
  then, no schema, no linter class, no `/roster` commands.

---

## § Reject log (recorded — do not re-propose without new evidence)

| Item | Verdict | Ground |
|---|---|---|
| Declarative projection-target registry + new host targets + semantic adapters (the superseded draft's core) | **REJECT (council, unanimous)** | `surface-matrix.yml` (23 hosts) + `lint_surface_matrix` + doctor/converge already stronger; zero demand for Source-A-exclusive hosts — per-host DEFER on a real logged request |
| Scenario rosters as a 4th artifact class (`rosters/*.yml`, `lint_rosters`, `/roster` family) | **REJECT (council, round-2 convergence)** | No demand signal; expressible in flows; weeks of maintenance surface; no falsifiable success criterion. Phase 3 micro-primitive + promotion criterion replaces it |
| `catalog_delegate` tool | **REJECT** | Write-adjacent auto-activation; violates default-off + ADR-109 |
| `--link` symlink install mode | **REJECT (council)** | Maintainer-only convenience; `npm link`/alias suffices; doctor/converge assume real files |
| Bulk import of the 263-persona catalog | **PERMANENT CUT** | Bodies carry unfalsifiable capability prose, zero governance hooks; would convert audited-quality positioning into a prompt zoo |
| Curated ≤5-persona division pilot | **DORMANT MARKER** | Only behind ALL of: demand signal per `docs/contracts/adoption-signal-floor.md`, house rewrite passing the Phase-1 gate (target: zero surviving source text), roster/flow-team integration home. Same convention as `domain-pack-extraction-when-triggered.md` |
| Host-plugin runtime router (live search/delegate plugin on a third-party host runtime) | **REJECT** | ADR-109 no-runtime floor + ADR-088 no external-runtime bridge; reopen only via superseding ADR |
| Orchestration-doctrine prose (7-phase pipeline playbooks), zh-CN static i18n, bash TTY wizard, `--parallel` copy, presentation-metadata catalog file | **REJECT / ALREADY-HAVE** | Unfalsifiable doctrine; runtime translation + `.md`-English rule; browser wizard + 2PC installer; no measured bottleneck; discovery-manifest covers it |
| BYO MCP-memory 4-tool contract | **REJECT** | File-first memory ships; heavyweight memory removed (ADR-094) |
| Contribution-funnel machinery (issue forms, PR templates) | **FOLD OUT** → `road-to-adoption-without-narrative-debt.md` | Funnel belongs to the adoption roadmap; Phase 1 here is its technical prerequisite |

## § Execution order & protocol

**1 → 2 → 3.** Phases are independent-additive; each lands as its own change
with verification evidence (per `verify-before-complete`) and a checkpoint
note appended here (numbers, verdicts, deviations). Rollback = revert; no data
migration anywhere. Phases 1 and 3 may run in parallel by two agents IF the
Phase-3 agent does not touch `src/scripts/_lib/`.

## § No-claims note

Nothing here licenses a public claim. Forbidden until gates pass:
"duplicate-proof contribution pipeline" (needs 1.3 calibration numbers),
any token-savings claim for the router (needs the 2.1/2.4 measured reports,
claims-registered), "team deploy" (Phase 3 is an annotation probe, not a
feature). The zero-external-adopters gap is NOT addressed by this roadmap and
remains the top structural issue — owned by
`road-to-adoption-without-narrative-debt.md`.
