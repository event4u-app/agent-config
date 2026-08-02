# Convention-parsing sweep — "first match wins" over the repo's own naming (2026-08-02)

Companion to [`gate-scope-sweep`](gate-scope-sweep.md) and
[`gate-scope-census`](gate-scope-census.md). Those two answer *does the gate read
anything*. This one answers the next question: *when it does read, does it read
the right thing* — or does the repo's own naming hand it an earlier match.

**Measured on `feat/road-to-gates-that-can-fail` @ `352e971e3`**, working tree
(Phase 1–5 edits from parallel work were uncommitted at measurement time; see
§ Scope). Population: every
`src/scripts/{lint,check,audit,verify}_*.ts` — **212** scripts, each with a
verdict below. Nothing is sampled.

## Why this exists

Road-to-gates-that-can-fail Phase 6. The exemplar is a gate that *did* read a
real file and still measured the wrong thing: the CHANGELOG release-section
check located its section with `/^(#+) [^\n]*\b<version>\b/m` — the first
heading containing the version. An era split names the archived era after the
**incoming** version, so `# Era: pre-9.9.0 — archived` sits above the real
`## [9.9.0](…)`. The gate read the archive pointer's two-line blockquote as the
release body, found no `Tests:` footer, and failed a correct release. The repair
was `^(#{2,}) ` — release headings are level 2+, era banners level 1.

The defect is not "a loose regex". It is a **positional assumption that the
repo's own conventions violate**: an era banner named after the release, a
template that tells authors to paste a draft body containing section headings,
a contract doc that shows two `**Mode:**` examples in one file. A sweep is
worth running because each instance looks locally reasonable.

## Headline

| | |
|---|--:|
| Gate scripts in population | **212** |
| Parse a repo convention (inspected in full) | **136** |
| — `vulnerable` (collision reproduced, not argued) | **6** |
| — `safe` | 107 |
| — `n/a` on inspection | 23 |
| Do not parse a convention (mechanically excluded) | **76** |
| Vulnerable gates repaired in this pass | **3** |
| Vulnerable gates recorded as open findings | **5** |

Every `vulnerable` row below was **executed**, not reasoned about. Four of the
six were proposed by static reading and then failed to reproduce on first
attempt until the collision input was corrected — a claimed collision that was
never run is not evidence.

## The six findings

Fixtures for all six live in
[`tests/scripts/convention_parsing_collisions.test.ts`](../../../tests/scripts/convention_parsing_collisions.test.ts)
(five) and
[`tests/scripts/check_pack_size.test.ts`](../../../tests/scripts/check_pack_size.test.ts)
(the repaired one). Each ships a CONTROL asserting the gate fires on the same
input **without** the collision — a fixture pair without that control would pass
equally well against a gate that reports nothing.

### 1. `check_iron_law_prominence` — ``` tracked, `~~~` not

The header promises "Code blocks are skipped to avoid false positives on quoted
text", implemented as `FENCE_RE = /^\s*```/`. But `markdown-safe-codeblocks`
mandates `~~~` as the **outer** fence when the wrapped content contains ```,
and the corpus uses it (`src/skills/emit-tickets/SKILL.md`,
`src/agent-src/templates/tickets.md`). Both directions reproduce:

- **false positive** — `### Iron Law` quoted inside a `~~~` block is reported.
- **false negative** — an odd number of ``` lines inside a `~~~` block leaves
  the fence flag stuck on, so a **real** deep Iron Law heading after it is
  silently skipped. `scan_file` returns `[]`.

**Not repaired, and the reason is measured.** The one-line repair
`/^\s*(```|~~~)/` — the shape `check_md_language.ts:137` and
`check_claims.ts:319` already use — was applied to the working copy and run: it
turns the false positive red and leaves the **false negative green**, because
the inner ``` then closes the `~~~` block and the next `~~~` reopens it. A real
repair has to remember which delimiter opened the fence. The file also pins a
py2ts port contract ("No behaviour changes — latent bugs replicated"), so the
scope of the change is a maintainer call.

### 2. `check_proposal` — first `## 7. Success signal` wins over a fenced example

`_checkSuccessSignal` (`src/scripts/check_proposal.ts:236`) uses a non-global
`/^##\s+7\.\s+Success signal\b…/m` and does not skip fenced spans. The proposal
template's Section 4 instructs the author to paste "the full body of the draft
rule / skill / command / guideline" into a ```markdown fence
(`src/agent-src/templates/agents/proposal.example.md:83-88`), so a proposal
whose draft artefact is itself about proposal writing legitimately contains an
example `## 7. Success signal` above the real one.

Reproduced against the real CLI: two fixtures with an **identical, incomplete**
real Section 7 (no `Baseline:`, no `Evaluation date:`); the one whose Section 4
fence carries a complete example section emits **zero** `success-signal`
findings, the other emits two. The gate validated the example and passed the
proposal.

Repair, not applied: strip fenced spans before section matching, as
`check_claims.ts:208-219` already does for its own markers. A consistent fix has
to cover `REQUIRED_SECTIONS`, `_checkSuccessSignal` and
`_checkOriginatingProject` alike — beyond a bounded edit, and it changes
outcomes on valid input.

### 3. `check_pack_size` — first `[` is not the JSON payload — **REPAIRED**

`parsePackJson` sliced npm's stdout from `stdout.indexOf('[')` to tolerate a
lifecycle banner. But npm echoes the lifecycle *command line*, and this repo's
own `prepare` script is `[ -d .git ] && bash src/scripts/install-hooks.sh ||
true` — its bracket comes first. Reproduced: `SyntaxError: No number after minus
sign in JSON at position 3`.

This one **fails closed** (`main` returns exit 2, "npm pack failed"), so it is a
robustness defect rather than a false green — and it is the same class as the
9.9.0 `evaluator_umbrella` incident whose fix introduced the slice.

**Repaired** (12 lines, `src/scripts/check_pack_size.ts:55-77`): try each `[`
offset in order and keep the first that actually parses; fall back to
`JSON.parse(stdout)` so a payload-less stream still throws. Behaviour on valid
input is identical — the first candidate parses. Mutation-proved: reverting the
repair turns the new fixture red with the exact historical error, restoring it
turns all 19 cases green.

### 4. `lint_framework_leakage` — unanchored frontmatter regex exempts the file — **REPAIRED**

`FRONTMATTER_FRAMEWORK_RE = /^---\s*\n([\s\S]*?)\n---/m`
(`src/scripts/lint_framework_leakage.ts:227`) carries `/m` and no start-of-file
guard — the only such parser in the suite; every sibling anchors at index 0. On
a file with no leading frontmatter it latches onto the first `---`-delimited
body span, and a non-null return makes `main()` `continue` at line 515: the file
is exempted from leakage scanning entirely.

Producible today: `src/skills/prediction-pool-optimizer/reference/ev-fixtures.md`
has no leading frontmatter and eight bare `---` lines, and is already in the
recursive `*.md` scan — it escapes only because none of those spans holds a
`framework:` line. `src/skills/command-writing/SKILL.md` demonstrates the house
convention of quoting a `---`-fenced frontmatter **example** in prose. One such
example carrying `framework: laravel` in a file without real frontmatter is the
collision; reproduced.

**REPAIRED 2026-08-02** — `/m` dropped, match required at index 0
(`src/scripts/lint_framework_leakage.ts:227`). A body `---` span can no longer
exempt a file from leakage scanning. Pinned in
`tests/scripts/convention_parsing_collisions.test.ts`; mutation-checked by
restoring `/m`, which turns the case red.

### 5. `lint_override_kernel_guard` — first `**Mode:**` line wins — **REPAIRED**

`parse_mode` (`src/scripts/lint_override_kernel_guard.ts:69`) is a non-global
`/im` exec over the whole file. The convention that collides is in the contract
doc itself: `src/agent-src/contexts/override-system.md` carries two `**Mode:**`
example lines (lines 105 and 130).

Both directions reproduced. The serious one is the false negative:
`classify_violations` raises "`replace` on a kernel rule — this class may be
tightened, never replaced" only when `mode === 'replace'`, so an override that
really does replace a kernel or safety-floor rule **passes** whenever any
earlier line in the file reads ``**Mode:** `extend` ``. A safety-floor guard
reporting clean on text it never read is precisely the class this roadmap
exists to close.

**REPAIRED 2026-08-02** — `parse_mode` now reads EVERY `**Mode:**` line and
resolves disagreement to `unknown`, which the caller already treats as a
violation: fail closed (`src/scripts/lint_override_kernel_guard.ts:68`). Chosen
over last-match-wins because a guard that cannot tell which mode a file declares
must say so, never pick one. Pinned in
`tests/scripts/lint_override_kernel_guard.test.ts` +
`tests/scripts/convention_parsing_collisions.test.ts`; mutation-checked by
restoring the non-global exec, which turns 2 cases red.

### 6. `lint_pack_risk_class` — first `key:` in the pack block wins

`_field` (`src/scripts/lint_pack_risk_class.ts:30`) is
`new RegExp('(^|\\n)\\s*' + key + ':\\s*([^\\n#]+)')` with no `g`, and `\s*`
accepts any indentation. Two shapes reproduce, both skipping every safety check
on a genuinely non-compliant high-risk pack (the gate prints its green
"risk_class invariant OK" line):

- a `description: |` block whose first content line begins `risk_class: medium …`
  → `risk !== 'high'` → the three checks never run;
- a nested mapping (`overlays: → lab-preview: → surface_tier: lab`, …) declared
  above the real top-level fields → all three lookups return the nested,
  compliant values.

A colliding token *inside* a sentence (`Historical note: risk_class: medium …`)
does **not** reproduce — the key must start its line. That distinction is why
the collision input was executed rather than asserted.

Repair, not applied (`lint_*` owned by parallel work): parse `packs.yml` with
the real YAML parser already used by `lint_topics_yaml` / `lint_flows`, or at
minimum anchor `_field` to the block's own indentation level.

## Full verdict table — 136 convention-parsing gates

`parses` = the convention read. `evidence` = for `vulnerable`, the finding
number above; otherwise the reason the first match cannot be wrong.

### vulnerable (6)

| gate | parses | verdict | evidence |
|---|---|---|---|
| check_iron_law_prominence.ts | markdown headings + code fences | vulnerable | finding 1 — `~~~` not tracked as a fence |
| check_pack_size.ts | `npm pack --json` stdout | vulnerable (repaired) | finding 3 — banner `[` precedes payload |
| check_proposal.ts | `## N. <Section>` proposal sections | vulnerable | finding 2 — fenced example section shadows the real one |
| lint_framework_leakage.ts | `framework:` frontmatter exemption | vulnerable (repaired) | finding 4 — `/m` regex, no start-of-file guard |
| lint_override_kernel_guard.ts | `**Mode:**` header + `> Overrides:` citation | vulnerable (repaired) | finding 5 — first `**Mode:**` anywhere wins |
| lint_pack_risk_class.ts | `risk_class`/safety keys in packs.yml | vulnerable | finding 6 — first `key:` in the block wins |

### safe (107)

| gate | parses | verdict | evidence |
|---|---|---|---|
| audit_adr_coverage.ts | ADR filename + frontmatter | safe | anchored, no `m`; every file enumerated (88-91,184) |
| audit_auto_rules.ts | rule frontmatter type/description/triggers | safe | `startsWith('---\n')` anchored (114) |
| audit_cloud_compatibility.ts | `<!-- cloud_safe: -->` marker | safe | one marker per file; corpus-checked (250) |
| audit_command_surface.ts | command frontmatter keys | safe | anchored, no `m`; key at column 0 (66) |
| audit_initial_context.ts | skill/rule frontmatter name/description | safe | anchored, no `m` (158) |
| audit_likelihood.ts | — | n/a | bag-of-words counter, no positional convention (68) |
| audit_mcp_tools.ts | tool name → catalog/handler line | safe | indent-depth disambiguation; 1:1 verified (34) |
| audit_overlap.ts | own generated `## Phase 5.2` section | safe | splits on a marker only it writes (403) |
| audit_skill_descriptions.ts | SKILL.md frontmatter description | safe | `m` flag gated by `m.index !== 0` (104) |
| audit_skill_overlap.ts | SKILL.md frontmatter + identity | safe | gated by `m.index === 0`; dir-basename key (164) |
| audit_user_type_axis.ts | `recommended_for_user_types` | safe | `startsWith('---\n')` + indexOf (129) |
| check_adr_frontmatter.ts | ADR frontmatter adr/status/review_trigger | safe | anchored; full line loop, not first-match (67) |
| check_always_budget.ts | rule frontmatter type/load_context | safe | anchored + real `YAML.parse` (173) |
| check_artefact_checksums.ts | artefact frontmatter via schema parser | safe | anchored, no `m`; delegates to validator (55) |
| check_augment_description_cap.ts | rule frontmatter type/description | safe | `startsWith('---\n')` anchored (45) |
| check_augmentignore.ts | — | n/a | mtime + active-line count only (71) |
| check_beta_review_markers.ts | `stability`/`keep-beta-until` | safe | anchored, no `m`; keys unique in block (26) |
| check_bite_sized_granularity.ts | roadmap `complexity:` | safe | `startsWith('---\n')` anchored (47) |
| check_claims.ts | `<!-- claim:ID -->` + `### claim:` ledger | safe | `matchAll` + explicit fence/inline-code exclusion (208) |
| check_cluster_patterns.ts | `## Locked clusters` table + dispatch | safe | fixed heading, grep-verified unique; unindented keys only (122,154) |
| check_command_count_messaging.ts | count badges in README/AGENTS.md | safe | anchored fm; each badge verified singular (31) |
| check_condensation.ts | headings + Iron-Law sections | safe | `IRON_LAW_HEADING` already requires `#{2,6}` — the exemplar's own fix (195) |
| check_condensed_paths.ts | `load_context:` + forbidden substrings | safe | anchored split; every line enumerated (146,272) |
| check_consumer_scope_flip.ts | rule frontmatter `workspaces:` | safe | anchored, no `m`; direct key access (44) |
| check_context_paths.ts | context sub-tree / collisions / orphans | safe | `.some()` any-match; grouped by basename (256) |
| check_council_config_location.ts | settings/`ai_council:` mentions | safe | per-line enumeration of every file (235,285) |
| check_dependency_floors.ts | — | n/a | reads package.json deps by key (90) |
| check_enforcement_coverage.ts | rule `enforced_by:` declarations | safe | anchored; comment/prose stripped; explicit rank not first (119,251) |
| check_generator_output_coverage.ts | generator-output roots vs manifest | n/a | exact-path Set membership, no scan (57) |
| check_gitignore_freshness.ts | `agents-paths.yml` entries vs block | safe | state machine pushes every entry (44) |
| check_host_loadability.ts | `.claude`/`.cursor` frontmatter | safe | anchored, no `m`; real `YAML.parse` (29,47) |
| check_knowledge_cards.ts | knowledge-card frontmatter | safe | anchored; only one field named `authoritative` (51,85) |
| check_knowledge_pages.ts | knowledge-page frontmatter | safe | anchored; keys read after `YAML.parse` (41) |
| check_knowledge_sharing.ts | knowledge-page `visibility:` | safe | anchored; `YAML.parse` key lookup (34) |
| check_md_language.ts | frontmatter/fence skip + DE-word scan | safe | `lineno===1` anchor; `matchAll` every line (125,137) |
| check_memory.ts | memory frontmatter + type-from-path | safe | real YAML parser; exact dir-name equality (234,302) |
| check_module_management_neutral.ts | SKILL.md frontmatter + carve-out span | safe | anchored; single fixed file, header unique (109) |
| check_no_external_sources.ts | denylist tokens | n/a | greps a forbidden literal anywhere (297) |
| check_no_local_settings_committed.ts | tracked-file basenames | n/a | exact basename filter over `git ls-files` (39) |
| check_no_roadmap_refs.ts | roadmap paths in stable docs | safe | `while` loop collects every match per line (155) |
| check_one_off_location.ts | `_one_off_*` archive path shape | n/a | exact directory-structure check (91) |
| check_pack_size.ts (non-JSON paths) | budget JSON keys | safe | direct key access; see finding 3 for the parse |
| check_portability.ts | project-identifier + banned phrases | safe | full per-line scan; identifiers unioned (376,229) |
| check_public_catalog_links.ts | markdown links in catalog | safe | `while` enumerates every link; `existsSync` (126,136) |
| check_public_links.ts | `stability:` frontmatter + links | safe | anchored, no `m`; full link enumeration (33,146) |
| check_reach_channels.ts | reach-channels.yml vs schema | safe | Draft-07 validator + exact key compare (267) |
| check_references.ts | personas frontmatter + refs | safe | `startsWith('---')`; refs resolved by `fs` existence (409,584) |
| check_release_includes_discovery.ts | discovery-manifest keys | n/a | one fixed JSON path, exact key |
| check_release_trunk_sync.ts | git tags / branch | n/a | full `reduce` over all tags, no markdown |
| check_reply_consistency.ts | numbered options + recommendation line | safe | `/g` `while` loop; ambiguity is an explicit failure (102) |
| check_roadmap_trackable.ts | `## Phase <id>` + frontmatter | safe | anchored fm; `while` enumerates every phase (46,182) |
| check_role_doc_links.ts | markdown links in role docs | safe | full link enumeration; `fs` existence (87,156) |
| check_skill_gaps.ts | `gaps[].witness` pointers | safe | anchored, no `m`; `existsSync` per witness (22,71) |
| check_skill_requires.ts | `requires_skills:`/`packs:` graph | safe | shared anchored parser; exact id keys |
| check_surface_tiers.ts | surface-tiers.yml cluster tiers | safe | exact Map lookup by dotted segment (122) |
| check_test_coverage_diff.ts | new-gate filename + pragma | safe | `^…$` full match; pragma order-invariant (26,101) |
| check_token_optimizer_freshness.ts | `## Catalog` table rows | safe | tracks the most-recent heading, not the first (49) |
| check_trigger_evals.ts | triggers.json keys | n/a | plain JSON key access |
| lint_agent_security.ts | child-linter JSON | n/a | aggregates child findings by key |
| lint_agent_skill_names.ts | `name:`/`user-invocable:` | safe | `startsWith('---')` + bounded slice; `^name:` unindented (81) |
| lint_agents_md.ts | AGENTS.md caps / pointer ratio / triage | safe | sequential fence state; `.includes` presence (139) |
| lint_archived_skills.ts | archive note + SKILL.md frontmatter | safe | `startsWith('---\n')` + `indexOf('\n---\n',4)` (59) |
| lint_artefact_frontmatter.ts | five ADR-013 discovery keys | safe | shared anchored parser; exact key membership (176) |
| lint_behavioural_eval_freshness.ts | frontmatter/body split for sha pin | safe | explicit no-frontmatter guard; real close is earliest (44) |
| lint_bench_ab.ts | required `## ` sections in benchmark.md | safe | `includes()` presence test, no positional resolution (244) |
| lint_bench_corpus.ts | corpus YAML prompts/categories | safe | real YAML parser; full loop; exact ids (237) |
| lint_breaking_changes_index.ts | `## [N.0.0]` CHANGELOG majors | safe | literal `## [` excludes era banners; every match Set-collected (57) |
| lint_changelog_rollback.ts | `## [X.Y.0]` CHANGELOG sections | safe | shares `VERSION_HEADING_RE`, anchored to `## ` — already the fixed shape |
| lint_command_flow_coverage.ts | command→flow bucket YAML | safe | full enumeration of all buckets (149) |
| lint_command_routing.ts | routing frontmatter | safe | anchored `^---\n…\n---`, no `m` (35) |
| lint_command_tiers.ts | `tier:`/`visibility:` frontmatter | safe | anchored; closed schema forbids nested collision (96) |
| lint_command_verbs.ts | name/tier/visibility/sub frontmatter | safe | `^key:` at column 0 excludes nested keys (34) |
| lint_consumer_internal_refs.ts | `workspaces:` + banned literals | safe | anchored fm, no `m`; full per-line scan (128,147) |
| lint_context_spine_usage.ts | `context_spine:` list | safe | operates on an already-anchored slice (45) |
| lint_design_quality.ts | HTML heading hierarchy | safe | `/gi` regex enumerates every heading (118) |
| lint_discovery_manifest.ts | manifest schema + checksum | n/a | schema/checksum validation (283) |
| lint_documented_commands.ts | doc claims vs CLI/task/mcp registries | safe | anchored fm; full registry enumeration (267,186) |
| lint_empty_roadmaps.ts | roadmap non-empty | n/a | whitespace-only check (109) |
| lint_eval_fixture_citations.ts | `daf-*` fixture ids | safe | `matchAll` enumerates every id (67) |
| lint_examples.ts | demo frontmatter + `## Demo N` | safe | anchored fm; global-regex heading enumeration (39,58) |
| lint_featured_skills.ts | featured-skill links + pack hints | safe | `/g` exec loop over every link (104) |
| lint_flows.ts | flow YAML vs Draft-07 | n/a | full schema validation (256) |
| lint_frontmatter_boilerplate.ts | fields equal to schema default | safe | shared anchored parser (validate_frontmatter:47) |
| lint_ghostwriter_source.ts | `fictional:`/`aliases:` | safe | `startsWith('---\n')` + indexOf (109) |
| lint_glama_drift.ts | README vs build/run script | n/a | literal substring containment (58) |
| lint_global_paths.ts | filesystem permission policy | n/a | stat/mode checks (60) |
| lint_governed_writes.ts | fs-write calls near protected paths | safe | global regex loop over every call site (198) |
| lint_handoffs.ts | `tier: senior` + Related-Skills links | safe | anchored per-line scan; closed schema (72) |
| lint_legal_pack.ts | `packs:` block + promotion fields | safe | keyed on a verified-unique pack id (58,166) |
| lint_load_context.ts | `load_context(_eager):` | safe | anchored + real `YAML.parse` (94) |
| lint_mcp_config_security.ts | MCP config secrets/smells | safe | full line/chunk enumeration (125) |
| lint_mcp_registry_manifest.ts | registry manifest vs schema | n/a | full JSON-schema validation (281) |
| lint_media_policy_linkage.ts | policy inbound references | n/a | substring containment over all files (160) |
| lint_missions.ts | mission/catalog YAML vs schema | n/a | full schema validation (239) |
| lint_model_tier_coverage.ts | `model_tier:` presence | safe | shared anchored real-YAML parser (validate_frontmatter:82) |
| lint_namespace.ts | artefact `name:` vs directory | safe | anchored per-line scan; closed schema (215) |
| lint_namespace_collisions.ts | name uniqueness | safe | anchored parser + real `YAML.parse` (43) |
| lint_new_skill_gate.ts | new-skill `name:`/`packs:` | safe | anchored, no `m`; real `YAML.parse` (45,176) |
| lint_no_new_atomic_commands.ts | `cluster:` + locked-cluster table | safe | unique `## Locked clusters` heading; last-key-wins fm (93,212) |
| lint_no_python_twin_rationale.ts | banned twin-rationale phrases | n/a | full per-line grep (66) |
| lint_one_off_age.ts | TTL-extension block | safe | rare 3-token signature, one block per file (39,119) |
| lint_orchestrator_auto_detect.ts | `auto_detect`/`type` frontmatter | safe | `startsWith('---\n')` anchored (68) |
| lint_originality.ts | corpus-wide shingle overlap | safe | full pairwise enumeration (263) |
| lint_originality_shingles.ts | masked shingle overlap | safe | full pairwise enumeration (160) |
| lint_pack_boundaries.ts | cross-pack link targets vs `requires` | safe | `while` collects every link; exact resolve (194) |
| lint_pack_dependencies.ts | pack.yaml deps vs derived sets | safe | real YAML parser + anchored fm (87) |
| lint_pack_first_win.ts | pack home precedence + onboarding YAML | safe | fixed 3-dir exact precedence (99) |
| lint_persona_governance.ts | persona fm + domain cap + citations | safe | anchored; exact `DOMAIN_MAP`; full enumeration (126) |
| lint_positioning.ts | README H1 anchor phrase | safe | the title is structurally the first heading (33,53) |
| lint_profile_overlay_set_only.ts | overlay/alias YAML leaks | safe | real YAML parser + recursive key walk (168) |
| lint_provenance.ts | NOTICES generation | n/a | emits headings, compares generated text (413) |
| lint_provenance_vocabulary.ts | banned phrases + scope-box anchors | safe | `while` loops over every line/anchor (143,237) |
| lint_roadmap_blockers.ts | `## Blockers` + `### blocker:` | safe | fences stripped first; full heading enumeration (64) |
| lint_roadmap_ci_steps.ts | CI literals in checkbox/fence lines | safe | every line scanned; settings block indentation-scoped (85) |
| lint_roadmap_complexity.ts | `complexity:`/`execution.mode` + caps | safe | anchored fm; full per-line enumeration (62,296) |
| lint_roadmap_later_disposition.ts | `status: later` + resume condition | safe | `^---` at string start, no `m`; presence test (62,179) |
| lint_role_experiences.ts | role frontmatter + `## Three first tasks` | safe | anchored fm; single expected heading (55,86) |
| lint_rule_interactions.ts | interaction pairs in YAML matrix | safe | real YAML parser + explicit `id` field (132,183) |
| lint_rule_tiers.ts | rule frontmatter `tier:` | safe | `startsWith('---\n')` guard; real close is earliest `\n---\n` (64) |
| lint_showcase_sessions.ts | session-log frontmatter | safe | `startsWith('---\n')`; `/g` loop over refs (107,184) |
| lint_skill_descriptions.ts | description-text heuristics | n/a | text-quality analysis, no section selection |
| lint_skill_frontmatter_safety.ts | execution/tool-grant keys | safe | anchored at the literal first line (64) |
| lint_skill_originality.ts | description/trigger token overlap | safe | full pairwise enumeration (168) |
| lint_skill_tools.ts | tool source naming/imports/CLI shape | safe | every line scanned for imports (69) |
| lint_subagent_determinism.ts | subagent frontmatter + name uniqueness | safe | exact schema keys + explicit uniqueness map (61) |
| lint_ticket_buildable.ts | ticket schema + roadmap markers | safe | anchored `^---\n`; full-tree schema validator (77,273) |
| lint_topics_yaml.ts | topics/notes/equivalents | safe | real YAML parser, direct key access (112) |
| lint_trust_coherence.ts | manifest trust/safety-floor invariants | safe | parsed JSON, exact Map lookups (198) |
| lint_ui_stack_bundles.ts | SKILL.md `packs:` for the agnostic lane | safe | first flush-left `\n---` is the real close; every list item walked (87,108) |
| lint_value_dashboard.ts | value.md structure + cost ladder | safe | JSON field access; bounded Panel-A loop (84) |
| lint_workflow_security.ts | workflow trigger/permission/pin rules | safe | real YAML parser; full job/step enumeration (187) |
| verify_physical_move.ts | pre/post file-tree + manifest diff | n/a | diffs hashes and manifest JSON |

Two structural observations fall out of the table and are worth keeping:

- **Hand-rolled frontmatter parsers are, with one exception, correct.** Roughly
  59 gates in the population carry a `startsWith('---')` or `^---` split of
  their own rather than delegating it to a YAML library
  (`grep -lE "startsWith\('---|\^---" src/scripts/{lint,check,audit,verify}_*.ts`).
  All of them anchor at index 0 — `startsWith('---\n')`, a regex without `/m`,
  or an explicit `m.index === 0` gate. `lint_framework_leakage` (finding 4) is
  the only unanchored one. "First `---` wins" is safe *because* the real close
  is always textually earlier than any body divider; the exemplar's shape is the
  opposite (the decoy is guaranteed to come first).
- **Fence tracking is the weak convention.** 23 gates track code fences; only
  five (`check_claims`, `check_md_language`, `lint_output_slop`,
  `lint_spawn_payload`, `check_council_config_location`) mention `~~~` at all,
  while `markdown-safe-codeblocks` mandates `~~~` as the outer fence. Only
  `check_iron_law_prominence` was executed against that gap (finding 1); the
  other ```-only trackers are an **unverified follow-up queue**, not a claim.

## Population that does not parse a convention (76, mechanically excluded)

These carry no convention-shaped construct in executable code after comments are
stripped — they compare file lists, read JSON/YAML by key, grep for a forbidden
literal anywhere, stat the filesystem, or shell out to git. Listed so the
exclusion is auditable rather than implied:

`check_artefact_count_messaging` · `check_backstop_debt` · `check_bridge_derivation` ·
`check_bundle_path_leakage` · `check_ci_local_parity` · `check_comparison` ·
`check_council_layout` · `check_council_references` · `check_discovery_determinism` ·
`check_evaluator_budgets` · `check_gate_coverage` · `check_gate_paths` ·
`check_generated_artefact_headers` · `check_installer_import_purity` ·
`check_kernel_prefix_stability` · `check_kernel_rule_bundle` · `check_media_deps` ·
`check_memory_contradiction` · `check_memory_proposal` · `check_memory_similarity` ·
`check_no_conflict_markers` · `check_no_new_legacy_path` · `check_originality_freshness` ·
`check_overlay_cascade_subdirs` · `check_preamble_payload_budget` ·
`check_quality_regression` · `check_reach_staleness` · `check_release_adjacent_health` ·
`check_release_pr_shape` · `check_release_published` · `check_rule_invariants` ·
`check_safety_floor_untouched` · `check_secret_leak` · `check_site_links` ·
`check_source_pointer_freshness` · `check_structural_breaking` ·
`check_template_pin_drift` · `check_token_quality_golden` · `check_token_regression` ·
`check_tracked_but_ignored` · `check_trigger_eval_presence` · `check_trunk_drift` ·
`check_update_banner` · `lint_agents_layout` · `lint_budget_ownership` ·
`lint_commit_subjects` · `lint_confusables` · `lint_design_slop` ·
`lint_discovery_vocabulary` · `lint_eval_freshness` · `lint_explain_trace` ·
`lint_hidden_unicode` · `lint_hook_concern_budget` · `lint_hook_manifest` ·
`lint_instruction_smuggling` · `lint_knowledge_scale` · `lint_marketplace` ·
`lint_marketplace_install_completeness` · `lint_memory_tripwire` ·
`lint_orchestration_dsl` · `lint_output_slop` · `lint_persistence` ·
`lint_pre_migration_refs` · `lint_readme_jargon` · `lint_readme_serial_comma` ·
`lint_readme_size` · `lint_regression` · `lint_skill_scripts_readonly` ·
`lint_spawn_payload` · `lint_store_boundary` · `lint_supported_tools_matrix` ·
`lint_surface_matrix` · `lint_versioned_cache` · `lint_workspace_boundary` ·
`verify_before_complete_hook`

The exclusion is a **filter, not a verdict of correctness** — these gates can
still be dead (that is the scan-scope sweep's question) or wrong in other ways.

## Criterion, in one line

A gate is `vulnerable` only when a collision input was **executed** against its
real code and produced the wrong resolution. A loose-looking regex with no
producible input is `safe`; four candidate collisions in this sweep failed to
reproduce on first attempt and were corrected or dropped.

## Reproducing

The candidate set is regenerated by the detector below (stdlib only, no new
script in `src/`). Save it anywhere and run it from the repo root:

~~~js
// triage.mjs — which gates parse a repo convention?
import * as fs from 'node:fs';
import * as path from 'node:path';

const DIR = path.resolve('src/scripts');
const strip = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');

const SIGNALS = [
    ['heading', /\/\^\(?#|\^#\{|\^#\+|\^##|startsWith\(['"]#|\\n#{1,6}/],
    ['section-literal', /['"`]#{1,6} [A-Z0-9]/],
    ['frontmatter', /frontmatter|front_matter|\^---|'---'|"---"|\bmatter\(/i],
    ['fm-slice', /slice\(4[,)]|indexOf\(['"`](\\n)?---|startsWith\(['"`]---|split\(['"`]---/],
    ['md-line', /\/\^\\?s\*[-*>]|\/\^\\d\+\\\.|\/\^\s*[-*>] /],
    ['checkbox', /\\\[[ x~-]\\\]|- \\\[ \\\]|\[x\]|\[~\]/],
    ['version-heading', /##\s*\\\[|\\d\+\\\.\\d\+\\\.\\d\+|# Era:/],
    ['path-shape', /\.split\(['"]\/['"]\)|relative\([^)]*\)\.split|\/\^\(?src\|/],
];

const files = fs.readdirSync(DIR)
    .filter((f) => /^(lint|check|audit|verify)_.*\.ts$/.test(f) && !f.endsWith('.test.ts')).sort();
const hits = [], nas = [];
for (const f of files) {
    const src = strip(fs.readFileSync(path.join(DIR, f), 'utf-8'));
    const found = SIGNALS.filter(([, re]) => re.test(src)).map(([n]) => n);
    (found.length ? hits : nas).push(found.length ? `${f}\t${found.join('+')}` : f);
}
console.log(`population ${files.length} · candidates ${hits.length} · n/a ${nas.length}`);
console.log(hits.join('\n'));
~~~

Expected at `352e971e3`: `population 212 · candidates 136 · n/a 76`. The
per-gate verdict is a **manual read** of each candidate — the detector selects
what to read, it does not decide.

The six findings replay as tests:

```
npx vitest run tests/scripts/convention_parsing_collisions.test.ts
npx vitest run tests/scripts/check_pack_size.test.ts
npx vitest run tests/scripts/changelog_release_section_gate.test.ts   # the exemplar
```

## Scope — what this sweep does NOT cover

- **Only `src/scripts/{lint,check,audit,verify}_*.ts`.** Gates that live
  elsewhere are out of population — including the exemplar itself, which is an
  inline `node -e` program inside `.github/workflows/release-validation.yml`.
  Hook scripts, `_cli/cmd_*.ts`, `_lib/*` helpers and `scripts/*.mjs` are not
  swept. A shared helper's defect is attributed to whichever gate was read.
- **Static reading plus targeted execution, not exhaustive fuzzing.** A `safe`
  verdict means no collision input was found, not that none exists. The
  `vulnerable` count is a floor.
- **The detector has known false negatives.** It was widened three times during
  this pass — `check_iron_law_prominence` (capture-paren before `#`),
  `lint_rule_tiers` (`slice(4, …)` frontmatter), `lint_bench_ab` (section
  literals) and three others were all initially misfiled as `n/a` and were only
  recovered by a manual grep over the excluded set. Six recoveries out of 82
  suggests the remaining 76 are mostly right, but "mostly" is the honest word.
- **Measured against a working tree, not a clean checkout.**
  `lint_artefact_frontmatter`, `lint_handoffs`, `lint_namespace`,
  `check_augment_description_cap` and `sweep_dead_scan_roots` carried
  uncommitted Phase 1–5 edits while their verdicts were taken.
- **Nothing here says a gate is alive.** A `safe` gate whose scan root is dead
  reads nothing at all; that is
  [`gate-scope-sweep`](gate-scope-sweep.md)'s question, and
  `check_iron_law_prominence` is in fact rooted at the retired
  `.agent-src.uncondensed/rules` container.
- **`~~~`-blind fence tracking is a named suspicion, not a measurement.** 18 of
  the 23 fence-tracking gates were not executed against a `~~~` fixture.

## Disposition

Three repairs landed, all behaviour-preserving on valid input and all
mutation-proved: `check_pack_size` (finding 3), `lint_framework_leakage`
(finding 4) and `lint_override_kernel_guard` (finding 5). The last two were
prioritised because both are **gate bypasses** rather than mis-parses — each
made a live gate report clean over input it never measured, and finding 5 did it
on the safety-floor surface.

Three findings are recorded and pinned by fixtures but **not repaired**:
`check_proposal` needs fence-stripping across three checks that must agree
(beyond a bounded edit, and it changes outcomes on valid input),
`check_iron_law_prominence` needs delimiter-aware fence tracking — its one-line
fix was measured and closes only one of its two directions, and the file also
pins a py2ts port contract — and `lint_pack_risk_class` needs a real YAML parse
rather than a regex over the block.

The pinned fixtures assert **observed** behaviour. A repair turning a
`KNOWN DEFECT` case red is the signal that a finding closed — not a regression.
