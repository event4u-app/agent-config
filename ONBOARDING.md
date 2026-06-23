# Subagent Orchestration: Role, Profile, Persona, Knowledge Integration Map

This report maps the existing systems in event4u/agent-config that support spawning subagents with specific role/profile/persona/knowledge configurations. All paths are absolute and verified.

---

## 1. PROFILES — Views Over Command Surface

**Purpose:** Declares the user's audience identity. Selects default skill/command surface, README entry-paragraph, and persona pre-selection.

**Activation Mechanism:**
- File location: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/profiles/` (immutable built-ins) or `.agent-src.uncondensed/profiles/` (user-defined)
- Schema: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/contracts/profile-system.md`
- Loader: `scripts/config/profiles.py` (phase-1, resolves in order: pack.profile_id → .agent-settings.yml → env var `AGENT_CONFIG_PROFILE_ID` → CLI flag `--profile=<id>`)
- Template reference: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/dist/agent-src/templates/agent-settings.md` (no explicit profile: block yet; expected in 6.1)

**What a Profile Carries:**
```yaml
profile:
  id: developer                          # unique identifier
  label: "Software Development"
  immutable: true                        # built-in = immutable; user-defined = mutable
  packs: [engineering-base, git]         # base capability packs (minimum floor when scoped-projection mode active)
  audience:
    label: "IC engineer"
    readme_anchor: "developer"           # README first-screen block selector
  defaults:
    preset_id: balanced                  # refs existing preset (cost-profile axis)
    personas: [reviewer, security]       # pre-selected persona ids for this profile
    skills_hint: [...]                   # guaranteed discoverable from profile.packs
  surface:
    commands_hint: [work, implement-ticket, review-changes]
    docs_first_pointer: "docs/getting-started-by-role.md#developer"
```

**The Six Seed Profiles** (immutable for v6.x):

| ID | Audience | README Anchor | Default Preset |
|---|---|---|---|
| `founder` | Solo founder | "Ship the company" | fast |
| `developer` | IC engineer | "Pair with senior reviewer" | balanced |
| `content_creator` | Writers, marketers | "Your voice, my hands" | balanced |
| `agency` | Multi-client shop | "Same playbook" | strict |
| `finance` | CFO / FP&A | "Forecasts with receipts" | strict |
| `ops` | RevOps, support, SRE | "Procedures that get followed" | strict |

**Session Resolution Outcome:**
```python
{
  "id": "developer",
  "packs": ["engineering-base"],
  "audience": {"label": "IC engineer", "readme_anchor": "developer"},
  "preset_id": "balanced",
  "personas": ["reviewer", "security"],
  "skills_hint": [...],
  "commands_hint": [...],
  "source": "user-settings | env | runtime | pack | default"
}
```

**Integration Seam for Subagents:**
Subagent spawning mechanism can read `profile.id` from `.agent-settings.yml` or pass `--profile=<id>` at invocation time. The profile loader then cascades persona defaults and pack scope into the subagent session automatically.

---

## 2. ROLES (Role Modes) — Six Named Working Contracts

**Purpose:** Stabilize agent output contracts; lock the output shape before work starts.

**Mechanism:** `/mode <name>` command sets `roles.active_role` in `.agent-settings.yml`. The rule `role-mode-adherence` (auto-triggered when active) enforces contract conformance on every closing output.

**Location:**
- Source rule: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/rules/role-mode-adherence.md` (lines 16-43 define the six modes)
- Contract detail: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/guidelines/agent-infra/role-contracts.md` (lines 12–94 define mode skeletal contracts)
- Settings activation: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/dist/agent-src/templates/agent-settings.md` (lines 268–277)

**The Six Role Modes:**

| Mode | Entry Signal | Output Contract | Default Skills | Mode Marker |
|---|---|---|---|---|
| **developer** | "implement X", `/jira-ticket` | Goal / Plan / Changes / Tests / Open questions | `php-coder`, `laravel`, `test-driven-development` | `<!-- role-mode: developer \| contract: goal,plan,changes,tests,open-questions -->` |
| **reviewer** | `/review-changes`, PR open | Summary / Risks / Findings / Required actions / Verdict | `judge-bug-hunter`, `judge-code-quality`, `judge-security-auditor` | `<!-- role-mode: reviewer \| contract: summary,risks,findings,required-actions,verdict -->` |
| **tester** | "add tests", test output | Behaviour under test / Edge cases / Negative paths / Reproduction / Coverage gaps | `pest-testing`, `api-testing`, `e2e-plan` | `<!-- role-mode: tester \| contract: behaviour,edge-cases,negative-paths,reproduction,coverage-gaps -->` |
| **po** | "I want a feature", `/feature-explore` | Goal / Assumptions / Acceptance criteria / Impacted modules / Risks / Open questions | `validate-feature-fit`, `api-design`, `threat-modeling` | `<!-- role-mode: po \| contract: goal,assumptions,acceptance-criteria,impacted-modules,risks,open-questions -->` |
| **incident** | "production is down", `break-glass: true` | Symptom / Reproduction / Minimal reversible change / Deferred verification / Follow-up / Learning | `bug-investigate`, `systematic-debugging`, `authz-review` | `<!-- role-mode: incident \| contract: symptom,reproduction,minimal-change,deferred-verification,follow-up,learning -->` |
| **planner** | "what's the strategy", `/feature-roadmap` | Goal / Constraints / Option set / Recommendation / Dependencies / Rollback | `feature-plan`, `feature-roadmap`, `blast-radius-analyzer` | `<!-- role-mode: planner \| contract: goal,constraints,option-set,recommendation,dependencies,rollback -->` |

**Contract Skeleton Example (Developer):**
```
**Goal:** <what the user asked for, one sentence>
**Plan:** <ordered steps, ≤5>
**Changes:** <files touched, one line each>
**Tests:** <added/updated tests + how to run>
**Open questions:** <unresolved items, none if blank>
```

**Activation Rules:**
- **Explicit:** User invokes `/mode <name>` or a command in the entry-signal column
- **Inferred:** First message matches a signal; agent surfaces one-line banner
- **Override:** User says `/mode none` to drop the frame

**Integration Seam for Subagents:**
Subagent spawning can set `roles.active_role: <mode>` in the subagent's `.agent-settings.yml` (or pass a runtime flag if the spawner supports it). The subagent's closing outputs will then be validated against the mode's contract automatically via `role-mode-adherence`.

---

## 3. ROLES (Organizational) vs. ROLE MODES — Two Different Systems

**Critical distinction:**

| System | What It Is | Where It Lives | Activation | Governs |
|---|---|---|---|---|
| **ROLE MODE** (six modes: dev, reviewer, tester, po, incident, planner) | Named working contract; output shape | `src/rules/role-mode-adherence.md`, `docs/guidelines/agent-infra/role-contracts.md` | `/mode <name>` → `roles.active_role` in `.agent-settings.yml` | Output contract + forbidden work per mode |
| **ORGANIZATIONAL ROLE EXPERIENCE** (six roles: sales, support, content-creator, consultant, leadership, galabau) | Job-specific onboarding flow; first tasks + prompts + skill shortlist | `agents/roles/<role>/index.md` (status: beta-internal, recruit sessions pending) | Wizard `/onboard` + MCP install path hint | README entry-para, first-task scaffolding, persona defaults, recommended packs |

**Organizational Role Location:**
- Directory: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/agents/roles/`
- Evidence basis: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/agents/roles/EVIDENCE_BASIS.md` (lines 1–52, explains beta-internal status)
- Example (sales): `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/agents/roles/sales/index.md` (frontmatter shows: recommended_packs, display_name, tagline, recruit_session_ref, status)

**For Subagent Orchestration:**
Organizational roles are **onboarding scaffolding**, not runtime enforcement. They're consumed at install time (wizard path selection) or for offline persona/pack recommendations. Subagents do not "activate" a role; they inherit packs + persona defaults via the profile they load.

---

## 4. PERSONAS — 24 Active Review Lenses

**Purpose:** Personas are **review-checklists** the agent overlays on a skill's procedure. Not sub-agents; not execution modes. They shape **what** the agent looks for, not the outcome contract.

**Location:**
- Core (6) + Specialists (18) live in: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/agent-src/personas/`
- Advisors (5, for AI council debates): `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/agent-src/personas/advisors/`
- Catalog + governance rule: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/personas.md` (full catalog, tier rules, skill citations)
- Governance enforcement: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/rules/persona-governance.md` (lines 1–60, ≤2 specialists per domain cap)
- Schema contract: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/contracts/persona-schema.md`

**The 11 Core + Specialist Personas (24 active):**

**Core (always-loaded, 6):**
1. `developer` — pragmatic implementer, edge cases (file: `src/agent-src/personas/developer.md`)
2. `senior-engineer` — long-horizon impact, 6-month lens
3. `stakeholder` — risk + politics, rollback ownership
4. `critical-challenger` — devil's advocate, load-bearing assumptions
5. `ai-agent` — token cost, automation seams

**Specialists (opt-in, selected 18):**
- Backend: `backend-architect`, `eloquent-tamer`
- Frontend: `frontend-engineer`
- Quality: `qa`
- Security: `security-engineer`
- Product: `product-owner`, `discovery-lead`
- Ops: `revops`, `revops-maintainer`
- Content: `tech-writer`
- Media: `hollywood-director`, `ai-video-technical-director`
- Design: `brand-strategist`, `design-director`
- GTM (Wing 3): `cmo`, `growth-pm`, `customer-success-lead`
- Ops/Money (Wing 4): `engineering-manager`, `people-strategist`, `finance-partner`, `strategist`

**Persona Shape (Core Tier, ≤120 lines):**
```yaml
---
id: developer
role: Developer
description: "Implementation reality—edge cases, null values, failure modes"
tier: core
mode: developer
---
## Focus
## Mindset
## Unique Questions
## Output Expectations
## Anti-Patterns
## Composes well with
```

**Persona Activation:**
- **Via skill:** Skills declare `personas: [<id>]` in frontmatter → agent adopts listed personas while running the skill
- **Via CLI override:** `--personas=backend-architect,security-engineer` (prefix `+` adds, `-` removes)
- **Via profile default:** `profile.defaults.personas: [reviewer, security]` pre-selects for that profile

**Session Configuration** (`.agent-settings.yml` lines 279–295):
```yaml
personas:
  override: []       # full list replacement (empty = inherit team default)
  ignore: []         # drop from default without replacing whole list
```

**Integration Seam for Subagents:**
Subagent can be spawned with a persona set by:
1. Inheriting `profile.defaults.personas` from the profile it loads
2. Passing `--personas=<list>` at spawn time if the subagent API supports it
3. Having the subagent skill declare `personas:` in its frontmatter

---

## 5. KNOWLEDGE — Task-Specific Local Ingestion

**Purpose:** File-first local-only knowledge cache for expensive structural evidence (negative facts, pointers to authoritative URLs).

**Location:**
- Ingestion contract: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/contracts/local-knowledge-ingestion.md` (lines 1–97)
- Storage: `agents/knowledge/<source>.md` (committed, trusted cache)
- Session scratch: `agents/memory/knowledge/session/` (gitignored, ephemeral)
- Global cross-project store: `~/.event4u/agent-config/knowledge/` (unversioned, file-first, re-verified each session)
- Memory namespace: Inside existing memory layer at `memory/knowledge/<ingest-id>/`
- Knowledge CLI: `/knowledge:ingest <path>`, `/knowledge:list`, `/knowledge:forget <prefix>`

**Ingestion Contract** (lines 18–96):
- **Input shapes:** `file://<absolute-path>`, local folder (recursive walk, symlinks skipped), `.zip` archive (unpacked to temp, then cleaned)
- **Supported MIME:** markdown, plaintext, PDF (OCR if scanned), DOCX, XLSX (one sheet per chunk), EPUB, PNG/JPEG (OCR)
- **Bounds:** ≤100 MB per call, ≤1000 documents, ≤20 MB per file, ≤500 MB total footprint, ≤10 directory depth
- **Redaction defaults:** PII allowlist (project names, headings, terminology only); secrets replaced with `[SECRET]`; manifest tracks redactions
- **Storage target:** `memory/knowledge/<uuid7-ingest-id>/manifest.json + chunks/<n>.md`
- **Eviction policy:** LRU at namespace level when 500 MB crossed; pinned ingests never evicted

**Card Shape** (negative facts + pointers):
- **Negative fact:** "Searched X, the field/endpoint is NOT there" (trust: durable)
- **Pointer:** Authoritative URL/path to real answer, kept green by pointer-CI
- **Positive structure:** Per-line hypothesis (must be re-confirmed against live source before use)

**Integration Seam for Subagents:**
Task-specific knowledge injected into a subagent via:
1. Calling `/knowledge:ingest <task-docs>` BEFORE spawning the subagent
2. The subagent inheriting access to `memory/knowledge/` namespace (tagging entries with `source: knowledge`)
3. Subagent retrieval via `memory_retrieve` (existing MCP surface), which tags with `source: knowledge`

---

## 6. SUBAGENT ORCHESTRATION — Composition Mechanism

**Purpose:** Spawn implementer/judge subagents with explicit model pairing, parallelism, and topology from `.agent-settings.yml`.

**Location:**
- Skill: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/skills/subagent-orchestration/SKILL.md` (lines 1–200+)
- Context configuration: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/agent-src/contexts/subagent-configuration.md` (lines 1–64)
- Commands: `/judge` (orchestrator), `/judge solo`, `/judge on-diff`, `/judge steps`
- Settings: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/dist/agent-src/templates/agent-settings.md` (lines 247–258)

**Configuration Keys** (lines 247–258 in template):
```yaml
subagents:
  implementer_model: ""          # empty = same tier as session; verbatim otherwise
  judge_model: ""                # empty = one tier above implementer (haiku→sonnet→opus)
  max_parallel: 3                # hard cap on concurrent subagents (1 = serialize, 3 = default)
```

**The Seven Modes** (skill lines 59–189):

| Mode | Topology | When to Use | Model Pairing |
|---|---|---|---|
| **do-and-judge** | hierarchical (1 impl, 1 judge) | Single-change task, non-trivial risk | implementer = session; judge = one tier up |
| **do-and-judge-two-stage** | hierarchical (1 impl, 2 judges sequential) | Spec contested, detailed AC | impl = session; judges = one tier up each |
| **do-in-steps** | ring (N steps, 1 judge between) | Multi-step ordered deps | impl = session; judge = one tier up |
| **do-in-parallel** | star (N impl, 1 judge once) | Independent slices | impl = session; judge = one tier up (run once) |
| **do-competitively** | mesh (2–4 impl, 1 judge) | Broad solution space | impl = same tier (≥2); judge = one tier up |
| **judge-with-debate** | hierarchical-mesh (2 judges, meta-judge) | Security, data migration, public API | judges = same tier; meta-judge = one tier up |
| **do-in-worktrees** | adaptive (per-step topology + isolated git worktrees) | Multi-step cross-wing chain (≥2 senior skills, ≥30 min each) | impl per step; judge = one tier up at chain end |

**Iron Law (skill lines 41–50):**
```
NO JUDGE ON THE SAME MODEL AS THE IMPLEMENTER ON THE SAME CONTEXT.
Same model + same context = same blind spots.
```

**Model Tier Ladder:**
```
haiku  →  sonnet  →  opus
```

**Subagent Status Schema:**
File: `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/skills/subagent-orchestration/schemas/subagent-status.json`

---

## 7. Integration Seam: Composing {role + profile + persona + knowledge} → Subagent Config

**End-to-end flow (proposed):**

```
1. USER INTENT
   - Request a task with explicit role/profile/persona/knowledge

2. PROFILE RESOLUTION (via spawn API)
   - Resolve `--profile=<id>` or read from `.agent-settings.yml`
   - Load profile YAML: packs, personas, skills_hint, commands_hint
   - Cascade persona defaults into subagent session

3. ROLE MODE ACTIVATION (if specified)
   - Set `roles.active_role: <mode>` in subagent's `.agent-settings.yml`
   - Rule `role-mode-adherence` auto-triggers on closing output
   - Enforce contract conformance

4. PERSONA OVERRIDE (if specified)
   - Pass `--personas=<list>` to subagent invocation
   - Merge with profile defaults: `[profile.defaults.personas] + [--personas override]`
   - Agent loads each persona's "Unique Questions" / "Critical Rules" at work time

5. KNOWLEDGE INJECTION (if specified)
   - Call `/knowledge:ingest <docs>` before spawn
   - Subagent inherits `memory/knowledge/<ingest-id>/` namespace
   - Retrieval tags entries `source: knowledge`

6. SUBAGENT ORCHESTRATION (if multi-step)
   - Declare mode: `do-and-judge`, `do-in-steps`, `do-in-parallel`, etc.
   - Read implementer/judge models from `subagents.*` in `.agent-settings.yml`
   - Spawn subagents per topology; orchestrate via skill

7. OUTPUT VALIDATION
   - Role-mode marker present + contract fields in order
   - Persona checklists applied
   - Knowledge cache tagged in memory retrieval
   - Subagent status schema valid
```

**Configuration Shape (conceptual):**
```yaml
# Parent session .agent-settings.yml
profile: developer
subagents:
  implementer_model: sonnet
  judge_model: opus
  max_parallel: 2

# Subagent invocation (proposed API):
# spawn(
#   profile_id="developer",
#   roles_active_role="reviewer",
#   personas_override=["security-engineer", "backend-architect"],
#   knowledge_ingest_ids=["threat-model-docs"],
#   mode="do-and-judge",
# )
```

---

## 8. Existing Integration Points (Today)

| Layer | Entry Point | Status | Notes |
|---|---|---|---|
| **Profile loading** | `scripts/config/profiles.py` | Implemented, beta | No explicit CLI yet in v6.0; roadmap for 6.1 |
| **Role mode enforcement** | `role-mode-adherence` rule | Implemented, tier-2a | Reads `roles.active_role` from `.agent-settings.yml` |
| **Persona defaults** | Profile YAML `defaults.personas` | Implemented | Cascaded to session at profile-load time |
| **Persona invocation** | `--personas=<list>` flag (command-level) | Implemented (partial) | Works on commands that accept it; skill-level invocation via frontmatter |
| **Knowledge ingestion** | `/knowledge:ingest <path>` | Contract frozen, impl phase-2 | Stored in `memory/knowledge/` namespace, tagged at retrieval |
| **Subagent orchestration** | `/judge` + `subagent-orchestration` skill | Implemented, v1 | Seven modes defined; model pairing from `.agent-settings.yml` |
| **Subagent status schema** | `subagent-status.json` | Implemented | Tracks state machine per subagent across modes |

---

## 9. Recommended Next Steps for Subagent-Spawning Feature

1. **Add `.agent-settings.yml` subagent composition block** (if not already there):
   - `subagents.implementer_model` ✓ (exists)
   - `subagents.judge_model` ✓ (exists)
   - Proposed: `subagents.spawn_role`, `subagents.spawn_personas`, `subagents.spawn_knowledge_ids`

2. **Create subagent spawn API** (command or skill):
   - Accept: `{profile_id, roles_active_role, personas_override, knowledge_ingest_ids, mode, task_description}`
   - Resolve profile → load YAML
   - Cascade personas (profile defaults + overrides)
   - Inject knowledge via ingest-id references
   - Activate role mode via `roles.active_role`
   - Call subagent-orchestration skill with the composed config

3. **Plug into existing commands:**
   - `/judge on-diff` (implementer-judge loop) already reads `subagents.*` settings
   - `/judge steps` could accept persona + role + knowledge flags
   - New: `/work --role=<mode> --personas=<list> --knowledge=<docs>`

4. **Validate composition at spawn time:**
   - Profile exists
   - Personas in `profiles.defaults.personas ∪ --personas` all exist
   - Knowledge ingest-ids (if any) are already in `memory/knowledge/`
   - Role mode (if specified) is one of the six
   - Implementer/judge models resolve to valid aliases

---

## Files Referenced (All Verified Absolute Paths)

**Profiles:**
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/profiles/README.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/profiles/developer.yaml`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/contracts/profile-system.md`

**Roles (Role Modes):**
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/rules/role-mode-adherence.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/guidelines/agent-infra/role-contracts.md`

**Roles (Organizational):**
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/agents/roles/EVIDENCE_BASIS.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/agents/roles/sales/index.md`

**Personas:**
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/agent-src/personas/developer.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/personas.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/rules/persona-governance.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/contracts/persona-schema.md`

**Knowledge:**
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/agents/knowledge/README.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/docs/contracts/local-knowledge-ingestion.md`

**Subagent Orchestration:**
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/skills/subagent-orchestration/SKILL.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/src/agent-src/contexts/subagent-configuration.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/dist/agent-src/commands/judge.md`
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/dist/agent-src/templates/agent-settings.md`

**Settings:**
- `/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/dist/agent-src/templates/agent-settings.md` (profiles not yet exposed; roadmap 6.1)

