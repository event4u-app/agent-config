---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane of road-to-leading-every-row; the set's growth is declared there. The skill ranker already unions neighbour skill roots into every route and silently drops a same-named second skill (score_skill_relevance.ts:182-193) — live behaviour with no owner in the estate; the fingerprint-slot stub it executes is a stub, not a roadmap, and is deleted on landing."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "the programme; blocker b6 there decides step 2.1"
  - slug: road-to-a-tree-that-keeps-its-neighbours
    relation: depends
    note: "the census (its 2.1-2.5) is the input every phase here reads"
  - slug: road-to-mcp-fingerprint-slot-binding
    relation: extends
    note: "step 3.2 executes that stub's decided binding and implementation list"
  - slug: road-to-a-stop-that-holds
    relation: disjoint
    note: "its per-layer shadow row already records stop_hook_active; step 3.1 adds who set it, serialised with its Q1 window"
depends: [road-to-leading-every-row, road-to-a-tree-that-keeps-its-neighbours]
---
# Road to neighbours that pull their weight

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — the owner's directive in the round's
> chat (this suite orchestrates the packages installed beside it, uses them where they
> are better, and keeps their rules from cancelling each other), plus the owner's last
> question of the round: can neighbours loaded first ignore this suite? Every anchor
> re-read at `9bc8cd4`. Class: owner directive + external comparison corpus.

## Goal

A neighbour's skill, index or instruction is used where it is better and never trusted
more than it has earned; ADR-124's doctrine for code graphs — orchestrator first, owner
where it wins (`docs/decisions/ADR-124-*.md:136`) — extends to every neighbour artefact.
At `9bc8cd4`: the ranker unions skills under `.claude/skills` and `~/.claude/skills`
(`src/scripts/_lib/skill_catalogue.ts:88,98,183-206`; used by `hooks/skill_route_hook.ts:355`
and `mcp_server/suggest_skill.ts:49`) with no origin and no scan
(`_lib/security_lint.ts:55-61` covers our corpus only), and the first same-named skill
wins (`skill_tools/score_skill_relevance.ts:182-193`), so a foreign `design-system` can
silently hide ours; no order is stated between this suite's guidance and a neighbour's
always-on text (`src/agent-src/contexts/override-system.md:15-29` orders only
original→override), and a static detector was measured at 67 % false positives
(`docs/contracts/rule-interactions.md:18-29`); the stop gate's `stop_hook_active` path
records a shadow row but not who set it (`hooks/turn_end_gate_hook.ts:1329-1339`); the
third-party MCP fingerprint store is bound to no slot (`src/scripts/mcp_tool_fingerprint.ts:12-22`).

What this suite can guarantee against a neighbour is only what it enforces as an effect:
a deny, or the stop gate's exit 2. Anything stated in prose — including the precedence
rule below — is something the model may still not follow; the lane makes that visible,
never claims it away. A neighbour whose effects this suite can observe is orchestrated;
one it cannot observe is an ambient actor whose output is advisory evidence only.

## Phase 1 — A route line that says where the skill came from

- [ ] **1.1 Origin from the lockfile, and both same-named skills ranked.** The catalogue
      returns each skill with `origin: package | project | home`, where `package` means
      claimed by the installed-tools lockfile — a consumer's own skills live in
      `~/.claude/skills`, so root is never origin. Drop the first-wins dedupe so two
      `design-system` skills both rank; a foreign one prints `project:design-system` or
      `home:design-system`, ours the bare name. `corrected-from-reproduction`.
      verify: fixture — a foreign `design-system` beside ours yields two ranked entries, one qualified
- [ ] **1.2 Overlap from a two-root mode of the existing audit.** `audit_skill_overlap`
      takes one `--root` (`:97,701-703`); add a cross-root pair mode (neighbour × ours),
      cached by the census digest, and print `also: <our-skill>` when a pair crosses its
      existing threshold. Each census entry gets one `compat` label computed without a
      model: `shadowed`, `overlapping`, `unscanned` or `unclassified`. Nothing is suppressed.
      verify: fixture — a near-duplicate foreign skill yields `also:` and `compat: overlapping`; a disjoint one `unclassified`
- [ ] **1.3 Scan before inject.** A neighbour skill body passes `security_lint`'s shape
      checks before its body may be injected; a failing body ranks by name with
      `unscanned: <finding-kind>`; a changed digest rescans first.
      verify: fixture — a foreign SKILL.md with a planted `curl | sh` line ranks by name only and no line of its body reaches the injected context

## Phase 2 — One stated order, no detector

- [ ] **2.1 A projected rule `neighbour-precedence` below the four authority bands.** It
      leaves `src/rules/agent-authority.md:12-26` untouched — those bands govern autonomy,
      and the current-turn instruction never lifts band 1 — and orders *instruction
      sources* beneath them: the current-turn instruction → `agents/overrides/` → the
      project's own instruction file → this suite's routed guidance → a neighbour's
      always-on text → a neighbour skill body → a neighbour MCP tool description. Ties go
      to the project file; the agent names which instruction it followed, once per turn.
      One paragraph: a neighbour's completion signal is a provider status, never this
      suite's completion, which stays with the stop gate's detectors.
      <!-- blocked-by: b6-neighbour-precedence | asked: no — programme blocker, inbox round authored without the owner present -->
      verify: `./scripts-run src/scripts/compile_router` -> 0 and `grep -c 'neighbour-precedence' dist/router.json` -> /[1-9]/
- [ ] **2.2 Contradiction review on demand, council-seated, report-only.**
      `doctor neighbours --contradictions` forms candidate pairs only from strong signals —
      a shared subject noun with opposite modality, or a name collision from 1.2 — and
      hands them to one council seat with 2.1 as the rubric. Output `pair | verdict |
      which wins by 2.1`; it never edits or gates, and prints `n/a — no council configured`
      when `council:status` says so.
      verify: fixture — "spawn agents and wait" against "never end a turn waiting" yields one pair naming the project line
- [ ] **2.3 Non-negotiables are effects.** Every obligation this suite means to hold
      against a neighbour is listed with its enforcing effect (a fail-closed `permission`
      concern or the stop gate's refusal); an obligation with no such effect is listed as
      `prose-only — may be outvoted`. The list is a section of 2.1's rule.
      verify: `grep -c 'prose-only' src/rules/neighbour-precedence.md` -> /[1-9]/

## Phase 3 — The gate and the fingerprint know a neighbour acted

- [ ] **3.1 Record who set `stop_hook_active`.** Extend the existing shadow row
      (`turn_end_gate_hook.ts:1332`, `layer: stop_hook_active`) with
      `set_by: ours | foreign | unknown` — `ours` iff our previous stop of the session
      refused, `unknown` when that record is missing. No new record kind; serialised with
      the stop-gate lane's Q1 window. `corrected-from-reproduction`.
      verify: fixture — a stop with `stop_hook_active` and no prior refusal of ours writes `set_by: foreign`
- [ ] **3.2 Execute the fingerprint-slot stub.** Bind `mcp_tool_fingerprint` to
      `post_tool_use`, observe-only, per `agents/roadmaps/stubs/road-to-mcp-fingerprint-slot-binding.md`:
      its admissions-ledger row, `severity: advisory`, `fail_closed: false`, its three
      tests (first sighting silent, mutation reported, malformed input exit 0), the
      concern comment, then delete the stub. This raises the concern count, which the
      programme's growth claim covers.
      verify: fixture — the same foreign tool with a mutated description on the second call yields one context line and one ledger row
- [ ] **3.3 Foreign MCP servers counted by use.** `telemetry_usage_hook.ts` returns early
      for every non-`Skill` tool (`:250`), so a small recorder of foreign `mcp__*` tool
      names is new; the census gains distinct tools used per server in 30 days.
      Advertised counts stay `unknown` — nothing launches a server to ask.
      verify: `agent-config doctor neighbours --json` -> /"tools_used_30d":\s*[0-9]+/
- [~] **3.4 Suggest `permissions.deny` for never-used foreign tools.** Deferred: writing a
      consumer's permission block is Class C and a product decision (K15).

## Acceptance criteria

- Two same-named skills both appear on the route line, the foreign one qualified; our skills are unchanged.
- A neighbour skill failing the shape scan is never injected as a body.
- `neighbour-precedence` compiles, leaves `agent-authority.md` byte-identical, carries the provider-status paragraph and the prose-only list.
- `doctor neighbours --contradictions` prints a verdict table or `n/a` and changes no file.
- The stop-gate shadow row carries `set_by`; the fingerprint ledger gets one row on a mutated foreign tool and none on a stable one.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | PENDING programme blocker b6 — proposed: the source order of 2.1, neighbours visible | ADR-124 doctrine; programme blocker b6 | the owner answers b6 differently |
| D2 | deterministic | evidence | no static contradiction detector | `rule-interactions.md:18-29` — 67 % false positives | a detector is measured below 20 % |
| D3 | reversible-technical | agent | scan with the existing `security_lint` shapes | `_lib/security_lint.ts` is the corpus scanner | a planted fixture slips through |
| D4 | reversible-technical | evidence | fingerprint observe-only on `post_tool_use` | the stub's council record, 2026-09-06 | the stub's owner record chooses refusal |
| D5 | deterministic | evidence | source precedence sits below the four bands, never beside them | `agent-authority.md:12-26` "Hard Floor wins, always"; the second author's eight-band order put the user's turn above the floor (K26) | the band table is superseded |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The precedence rule is read as permission to ignore a neighbour | product | "The project file wins" is one reading away from "skip the neighbour". | 2.1 requires naming the followed instruction; D1 forbids suppression; 2.2 shows which rank won. | Phase 2 — One stated order, no detector |
| 2 | The precedence rule is read as a guarantee | product | A prose rule cannot outrank a neighbour's prose; the model follows what it follows. | 2.3 lists every non-negotiable with its enforcing effect and marks the rest `prose-only`. | Phase 2 — One stated order, no detector |
| 3 | The overlap pass slows the route hook | implementation | Pairwise over the corpus on every prompt is not a hook-budget shape. | 1.2 runs once per census and caches by digest; the route reads the cache. | Phase 1 — A route line that says where the skill came from |
| 4 | The shape scan cripples a legitimate neighbour skill | product | Shell snippets can be an installer skill's whole point. | The skill still ranks by name with the finding visible. | Phase 1 — A route line that says where the skill came from |
| 5 | `set_by` misattributes our own refusal | implementation | A crashed hook that recorded nothing makes the next stop look foreign. | A missing previous record writes `unknown`, counted separately. | Phase 3 — The gate and the fingerprint know a neighbour acted |
