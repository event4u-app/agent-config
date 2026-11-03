<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-03, committed verbatim so the
     verdict can be checked against what was asked (evaluator-independence).
     Verdict: neither seat discarded or landed blind; both asked for a
     main-side check first. That check found engine recognition, the dotnet
     suppression, the installer kinds and the cache dirs already on main;
     the two confirmed gaps (recorded refusal reason, domain-watch note) land
     in this PR. The Veo exit-14 refusal was dropped per the #2819 D3 clamp
     decision. -->

# Question: what in an abandoned worktree is still missing from main?

## Situation

Two agent sessions processed the same inbox round in parallel. Session B's work merged to `main` as PR #2819 (roadmaps `road-to-toolchains-the-gate-can-see` and `road-to-host-and-media-steps-that-say-what-ran`, both archived). Session A's own extra pieces were then ported by hand into PR #2820, also merged. Session A's original worktree (base 81788b6e63) still holds uncommitted changes and is about to be removed.

A mechanical filter compared every added line (>12 chars) of session A's uncommitted diff against `main`'s version of the same file: 543 of 940 lines have no exact match on `main`. An exact-line miss does not by itself mean the content is missing; `main` may carry the same capability in different words or in a different file.

## What to decide

For each file listed below, give one disposition:

- `superseded`: `main` carries this capability or claim (possibly differently); nothing to land.
- `missing`: a real capability, fix, test or doc claim that `main` lacks and that would be worth landing as a follow-up PR. Say in one line what it is.
- `discard`: session A's own process residue (roadmap/evidence/directive text describing session A's run), or something contradicted by `main`'s decisions.

Then give an overall answer: is there anything worth a follow-up PR, and if so which files form it.

End your answer with exactly one line:
STANCE: <land-follow-up|discard-all> | CONFIDENCE: <low|medium|high> | DEALBREAKER: <none|one-line reason>

## Context: main's two roadmaps for this round (headings and steps)

~~~text
### road-to-toolchains-the-gate-can-see
# Road to toolchains the gate can see
## Goal
## Phase 1 — The gate accepts the resolver's own commands
- [x] **1.1 Resolver↔gate parity.** `segmentVerifies` accepts `dotnet test`, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/verification_command.ts -->
## Phase 2 — An engine project is recognised, not misrouted
- [x] **2.1 Extract the dotnet basis into a leaf module.** `runner.ts` sits at <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/stack/runner.ts -->
- [x] **2.2 An engine marker suppresses `dotnet test`.** A Unity <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/stack/dotnet.ts -->
- [x] **2.3 An engine project is not `plain`.** `detect_stack` returns <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/stack/detect.ts -->
- [x] **2.4 Installer engine kinds.** `ProjectKind` gains `godot`, `unity`, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/install/detect.ts -->
## Phase 3 — The code graph skips engine caches
- [x] **3.1 Engine cache dirs, conditional on a root marker.** With a Unity <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/build.ts -->
## Phase 4 — Carry the round's other findings to their owners
- [x] **4.1 Arrivals lines on existing owners.** `later/road-to-reach-transcribe.md` <!-- receipt: class=R2 · shadow · scope=safe · would-skip=revalidation · bound=raised to R2 from R0 -->
## Decisions
## Risk Register
## Outcome (2026-11-03)

### road-to-host-and-media-steps-that-say-what-ran
# Road to host and media steps that say what ran
## Goal
## Phase 1 — Host truth in words and docs
- [x] **1.1 "managed hooks" becomes "agent-config hooks".** User-visible doctor <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/runtime_wiring_checks.ts -->
- [x] **1.2 Class D — a host mod can override a refusal.** A section in <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
## Phase 2 — Foreign agent assets go through intake
- [x] **2.1 Intake routes plugins, mods and agent skills.** Description and <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: src/skills/supply-chain-intake/SKILL.md -->
## Phase 3 — Media steps that do not change silently
- [x] **3.1 The Veo clamp says so.** A requested duration outside {4,6,8} <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai-video/adapters/gemini-veo.sh -->
- [x] **3.2 Reference-index check.** A script refuses a prompt that cites <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai-video/lib/check-ref-index.sh -->
- [x] **3.3 A supplied photo of a person is a likeness trigger.** Policy and <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
## Decisions
## Risk Register
## Outcome (2026-11-03)
~~~

## Session A's added lines with no exact match on main, per file (max 14 lines each)

~~~text
=== README.md  (1/1 added lines absent on main)
  +- **Blocking on Claude Code only, and only while its hooks run.** A host setting or a user-installed mod can switch them off or lift a refusal; `agent-config doctor neighbours` lists installed mods. Elsewhere the rules are instructions: they cut violations but do not remove them. <!-- claim:conformance-advisory-vs-blocking -->
=== agents/evidence/owner-directives/2026-11-03-inbox-2026-11-t-process-full.md  (21/21 added lines absent on main)
  +<!-- evidence-type: analysis -->
  +# Owner directive 2026-11-03 — process round inbox-2026-11-t to a merged PR
  +Recorded verbatim from the invocation of `/analyze:inbox` on 2026-11-03
  +(German original; the speaking folder name is replaced by `<T1>`, the round's
  +opaque topic id):
  +> agents/tmp/<T1> & alle inhaltlich ähnlichen und passenden agents/tmp-folder- danach arbeite die roadmaps ab mit /roadmap:process-full - arbeite in einem worktree und erstelle am ende einen pr und merge ihn. <!-- md-language-check: ignore -->
  +EN: analyse the T1 inbox folder and every content-similar inbox folder, then
  +work the resulting roadmaps with `/roadmap:process-full`, in a worktree, and end
  +with a PR that is merged.
  +What this authorises, and nothing more:
  +- active roadmaps for the round — `road-to-limits-the-surfaces-already-state`
  +  and `road-to-an-engine-project-it-recognises` (the operator asked for
  +  execution in the invocation itself, the exception the WIP cap of five names in
  +  `/analyze:inbox` Phase 6), each closed and archived in the same PR so the
  [... truncated]
=== agents/roadmaps-owned.md  (1/1 added lines absent on main)
  +| road-to-a-game-the-agent-can-playtest | later | later | Engine tests, runtime capture and a stated budget for game projects. |
=== agents/roadmaps/archive/road-to-an-engine-project-it-recognises.md  (85/85 added lines absent on main)
  +complexity: lightweight
  +status: archived
  +tree_pin: 81788b6e63
  +  mode: phase-checkpoints
  +review_by: 2026-12-15
  +estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-03 in the /analyze:inbox invocation itself (\"danach arbeite die roadmaps ab mit /roadmap:process-full\"); closed and archived in the same PR, so the active estate returns to its prior count."
  +estate_offset_exempt: "Owner search at 81788b6e63: grep -rliE 'godot|unreal|unity|uproject|playtest|game engine' over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs found no owner of engine-project detection or engine-aware runner precedence; hits are incidental words. archive/road-to-slices-at-agreed-seams owns ticket slices (disjoint)."
  +  - slug: later/road-to-a-game-the-agent-can-playtest
  +    relation: disjoint
  +    note: "The parked remainder of the same topic: engine runner rows, GDScript graph, playtest capture, tool tiers, game pack, asset ledger, budgets. Blocked on the domain-adoption gate and owner-reserved items."
  +  - slug: later/road-to-reach-transcribe
  +    relation: disjoint
  +    note: "Owns the ASR rung; this round's transcription failure landed there as arrival 2."
  +# Road to an engine project it recognises
  [... truncated]
=== agents/roadmaps/archive/road-to-limits-the-surfaces-already-state.md  (56/80 added lines absent on main)
  +tree_pin: 81788b6e63
  +estate_offset_exempt: "Owner search at 81788b6e63: grep -rlF -e allowed_durations -e 'agent-asset' -e archive_precheck -e 'managed-settings-block' -e 'Class D' over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs found no owner of a duration grid, a third-party agent-asset intake reference, an archive pre-check or the block rename. later/road-to-mod-surfaces-that-read-what-ac-knows (live-arm probes, sensor, holder) and later/road-to-host-inputs-the-installer-honours (policy-aware doctor) own the host-side mod work and take this round's recurrences as arrivals; later/road-to-a-witness-for-made-and-found-media owns video verify."
  +    note: "Owns live-arm reach probes, the trace sensor, the holder and further surfaces; this round's mod findings landed there as arrivals."
  +  - slug: later/road-to-host-inputs-the-installer-honours
  +    note: "Owns the policy-aware doctor (disableAllHooks / allowManagedHooksOnly); this file only documents the limit."
  +  - slug: later/road-to-a-witness-for-made-and-found-media
  +    note: "Owns post-render video verification (2.3)."
  +> **Source:** `agents/tmp.old/inbox-2026-11-t/` (topic T1: owner transcript, two
  +> **Arrivals:** 1 — `inbox-2026-11-t` (2026-11-03). The mods half of the topic is
  +> a recurrence of `inbox-2026-10-av`; it is not re-planned here.
  +Every place that states a limit says it where a reader acts on it: the Veo
  +adapter refuses an off-grid duration instead of silently rounding 7 s to 8 s and
  +the planner snaps to the grid; the deny-row consent screen, the README and the
  +harness contract say that a host switch or a user-installed mod can lift a hook
  [... truncated]
=== agents/roadmaps/later/road-to-a-game-the-agent-can-playtest.md  (39/44 added lines absent on main)
  +review_by: 2027-01-15
  +estate_growth_exempt: "+1 later_roadmaps from /analyze:inbox round inbox-2026-11-t: the non-executable residue of topic T2; no active roadmap is added by this file."
  +estate_offset_exempt: "Owner search at 81788b6e63: grep -rliE 'godot|unreal|unity|uproject|playtest|game engine|asset ledger' over agents/roadmaps/*.md, later and stubs found no owner of engine runners, playtest capture or a game pack; hits are incidental words."
  +  what: "domain-adoption gates for game development pass (named maintainer + cadence, CI-tooling decision), see agents/settings/contexts/domain-watch/game-development.md"
  +  when: "next inbox or planning round after the gates are answered"
  +  - slug: road-to-an-engine-project-it-recognises
  +    relation: extends
  +    note: "The executed, domain-neutral half of the same topic; this file is what was gated."
  +> **Source:** `agents/tmp.old/inbox-2026-11-t/` (topic T2; external sources S1–S5,
  +> mapped only in the round's encrypted intake note).
  +> **Arrivals:** 1 — `inbox-2026-11-t` (2026-11-03).
  +Engine tests, runtime capture and a stated budget for game projects. Gated
  +until the domain is adopted. Until then this file records the gated remainder with its blockers.
  +### blocker: domain-gate
  [... truncated]
=== agents/roadmaps/later/road-to-mod-surfaces-that-read-what-ac-knows.md  (1/10 added lines absent on main)
  +> **Arrivals:** 2 — latest `inbox-2026-11-t` (2026-11-03): an earlier-dated plan on
=== agents/roadmaps/later/road-to-reach-transcribe.md  (1/1 added lines absent on main)
  +> **Arrivals:** 2 — latest `inbox-2026-11-t` (2026-11-03): speech recognition failed again on an owner-uploaded clip and the analysis fell back to burned-in text; the ASR rung still probes only `whisper-cli`/`whisper` (`media_bundle.ts`). Earlier: `inbox-2026-10-ao` (2026-10-25): a video task failed at speech recognition (model download refused by a proxy) and was rescued only by burned-in subtitles. That is the resume trigger in its pure form — no caption track, not an install. `road-to-a-post-the-analysis-can-watch` 2.4 builds the ladder this file is rung 2 of.
=== agents/settings/contexts/domain-watch/game-development.md  (25/25 added lines absent on main)
  +# Domain watch — Game development (native engines)
  +> Watch-only note per `domain-adoption-policy`. Opened 2026-11-03 by the
  +> `/analyze:inbox` round `inbox-2026-11-t` (topic T2).
  +> **Not** a commitment to build — a record of the ask, the gate state and what
  +> would reopen it, so the next harvest re-evaluates without relitigating.
  +## The deferred ask
  +The owner named game development as a focus and plans a first-party 3D game.
  +The supplied plans propose a `gamedev` pack (engine runner rows, a GDScript
  +code-graph provider, a playtest capture command, scene/asset skills, a runtime
  +performance budget, an asset licence and AI-use ledger).
  +## Gate state
  +| Gate | State |
  +| Demand signal | One owner statement (2026-11-03). No second consumer, no usage count. |
  +| Named maintenance owner + cadence | None named. Engine CLIs and test frameworks churn per release. |
  [... truncated]
=== agents/settings/policies/media/likeness.md  (1/1 added lines absent on main)
  +- A reference image or video the user supplies (upload, path, URL) shows an identifiable person — **including a photo of the user themself**, the "turn my selfie into a film" case. Being the uploader is not a consent record; without one of the lines below, ask one question.
=== docs/contracts/harness-expectations.md  (19/22 added lines absent on main)
  +## Class D — Host switches and mods that run ahead of the hooks
  +On Claude Code a refusal the package documents as blocking does not fire: a
  +deny row in `permissions.deny` is honoured on one machine and not on another, or
  +no hook of the package runs at all in a session.
  +The host decides before the package does. Per Claude Code's documentation (not
  +measured on a live account here): `disableAllHooks` switches every hook off; a
  +managed `allowManagedHooksOnly` keeps only organisation-managed hooks; and a
  +user-installed mod runs ahead of the `PreToolUse` hooks and, on an account
  +without managed settings, can lift a deny. Only managed settings are final.
  +The reproduced half of this is recorded in
  +[`claude-code-mod-harness-probes-2026-10-25`](../../agents/evidence/analysis/claude-code-mod-harness-probes-2026-10-25.md).
  +1. **Show it.** `agent-config doctor neighbours` lists every installed plugin
  +   that ships a hooks module, with the events it hooks.
  +2. **Say it where consent is given.** The deny-row consent screen names the mod
  [... truncated]
=== docs/enforcement-by-host.md  (1/7 added lines absent on main)
  +[`harness-expectations` § Class D](contracts/harness-expectations.md#class-d--host-switches-and-mods-that-run-ahead-of-the-hooks).
=== src/agent-src/contexts/execution/toolchain-resolver.md  (7/7 added lines absent on main)
  +**A game-engine marker outranks the .NET files.** When the scope root carries
  +`project.godot`, `ProjectSettings/ProjectVersion.txt` (Unity) or a `*.uproject`
  +(Unreal), the `.csproj`/`.sln` there is engine-generated — Unity's
  +`Assembly-CSharp.csproj` references nunit and would otherwise read as HIGH — and
  +`dotnet test` is not the engine's runner. The row is withheld and recorded in the
  +result's `refusals` with the reason; no engine test command is emitted, because
  +none is pinned to the engine's own documentation yet.
=== src/agent-src/templates/scripts/work_engine/stack/runner.ts  (32/34 added lines absent on main)
  +     * Rows the resolver withheld, each with the reason — so a missing runner
  +     * reads as a decision, never as "nothing was found". Empty in the normal case.
  +    readonly refusals: readonly RunnerRefusal[];
  +        refusals?: readonly RunnerRefusal[];
  +        this.refusals = args.refusals ?? [];
  +            // Only when something was withheld, so every existing config stays byte-identical.
  +            ...(this.refusals.length > 0
  +                ? { refusals: this.refusals.map((r) => ({ ecosystem: r.ecosystem, runner: r.runner, reason: r.reason })) }
  +/** A runner row the resolver withheld on purpose, and why. */
  +export interface RunnerRefusal {
  +    readonly reason: string;
  + * The game engine whose project file sits in `root`, or `null`.
  + * Unity and Unreal generate `.csproj` / `.sln` files (Unity's
  + * `Assembly-CSharp.csproj` references nunit), which the .NET basis would read
  [... truncated]
=== src/domains/meta/pack.yaml  (2/2 added lines absent on main)
  +  commands_tokens: 268876
  +  total_tokens: 337689
=== src/install/detect.ts  (7/7 added lines absent on main)
  +import { detectEngine, type EngineMarker } from '../scripts/_lib/engine_marker.js';
  +     * The game engine whose project file sits in the root, independent of `kind`:
  +     * an engine project usually has no manifest and would otherwise read as
  +     * `unknown`. Additive so `kind` keeps driving scope detection unchanged.
  +    readonly engine: EngineMarker | null;
  +        return { kind: 'unknown', root, manifest: null, kinds: [], manifests: [], engine: detectEngine(root) };
  +        engine: detectEngine(root),
=== src/scripts/_lib/engine_marker.ts  (49/49 added lines absent on main)
  + * Game-engine project markers — Godot, Unity, Unreal.
  + * An engine project carries no package manifest, so manifest detection calls it
  + * `unknown`, and a Unity/Unreal tree carries generated `.csproj`/`.sln` files that
  + * look like a .NET test project to a resolver that has never heard of an engine.
  + * The marker is the engine's own project file, read at the scope root only.
  +import * as fs from 'node:fs';
  +import * as path from 'node:path';
  +export type EngineKind = 'godot' | 'unity' | 'unreal';
  +export interface EngineMarker {
  +    readonly kind: EngineKind;
  +    /** Root-relative marker path, POSIX. */
  +    readonly marker: string;
  +    /** The version the project file states, or null when it states none. */
  +    readonly version: string | null;
  [... truncated]
=== src/scripts/_lib/runtime_wiring_checks.ts  (1/1 added lines absent on main)
  +            remedy: 'agent-config refresh --global (writes the package-owned hook block in settings.json)',
=== src/scripts/ai-video/adapters/gemini-veo.sh  (7/7 added lines absent on main)
  +# 4|6|8 ASSUMED accepted on veo-3.0 GA — recorded as `allowed_durations`
  +# in the capability manifest; an off-grid stdin `duration` is refused with
  +# exit 14 before submit, never rounded; a rejected parameter surfaces as a
  +  # stdin duration → Veo durationSeconds. An off-grid value never reaches here:
  +  # aiv_assert_duration_on_grid refused it against allowed_durations {4,6,8}.
  +  dur="$(printf '%s' "${stdin_json}" | jq -r '.duration // 8')"
  +export AIV_DEFAULT_MODEL="veo-3.0-generate-001"
=== src/scripts/ai-video/lib/model-capabilities/README.md  (2/5 added lines absent on main)
  +  requested `duration` outside it is refused with exit `14`, never rounded;
  +  absent means any value in the range.
=== src/scripts/ai-video/lib/model-capabilities/gemini-veo.json  (1/2 added lines absent on main)
  +      "input_notes": "model id from adapters/gemini-veo.sh:129 and agents/templates/.ai-video.xml.example:72; durationSeconds enum {4,6,8} is ASSUMED in the adapter header and recorded as allowed_durations (an off-grid request is refused with exit 14, never rounded), upper bound matching the template tuning <max-duration>8</max-duration> (xml:77); audio_sync true from the declared audio=native (:4), the dispatch flag (tail) and <audio-native>true</audio-native> (xml:78); aspect is passed through as aspectRatio with no enum check (:151) so the accepted set is unknown — the template's tuning default is 16:9 (xml:75); cost_per_second_usd from _veo_model_rate_usd_per_s veo-3.0* = 0.40 (:94), corroborated by the header's ~$1.60 per 4 s render at $0.40/s (:10)",
=== src/scripts/code_graph/build.ts  (6/6 added lines absent on main)
  +import { ENGINE_CACHE_DIRS, detectEngine } from '../_lib/engine_marker.js';
  +    // Without git there is no ignore list, so an engine project's regenerated
  +    // caches (Unity `Library/`, Unreal `Intermediate/`) would be walked as source.
  +    const engine = visible ? null : detectEngine(abs);
  +    const engineCaches: ReadonlySet<string> = new Set(engine ? ENGINE_CACHE_DIRS[engine.kind] : []);
  +                if (engineCaches.has(rel)) continue;
=== src/scripts/media/lib/adapter-common.sh  (20/24 added lines absent on main)
  +# A requested duration off the model's grid is refused, never rounded. Before
  +# this gate the Veo adapter turned 7 s into 8 s without a word: the clip came
  +# back a second longer than the plan and was billed for it.
  +AIV_EXIT_DURATION_NOT_ON_GRID=14
  +# aiv_assert_duration_on_grid <adapter> <stdin-json> — no-op when stdin carries
  +# no duration, or the resolved model's entry declares no `allowed_durations`.
  +# Model resolution: stdin model_id, else AIV_MODEL, else AIV_DEFAULT_MODEL (the
  +# adapter's own default, exported before aiv_dispatch).
  +aiv_assert_duration_on_grid() {
  +  local adapter="${1}" stdin_json="${2}" dur model manifest grid
  +  dur="$(printf '%s' "${stdin_json}" | jq -r 'if type == "object" and (.duration | type) == "number" then .duration else empty end' 2>/dev/null || true)"
  +  [ -n "${dur}" ] || return 0
  +  [ -n "${model}" ] || model="${AIV_MODEL:-${AIV_DEFAULT_MODEL:-}}"
  +  [ -n "${model}" ] || return 0
  [... truncated]
=== src/scripts/media/lib/adapter-contract.md  (1/1 added lines absent on main)
  +| `14` | a requested `duration` is not in the model's `allowed_durations` — refusal over silent rounding | `aiv_assert_duration_on_grid` |
=== src/server/routes/install.ts  (1/1 added lines absent on main)
  +            .object({ kind: z.enum(['godot', 'unity', 'unreal']), marker: z.string(), version: z.string().nullable() })
=== src/skills/song-to-script/SKILL.md  (6/6 added lines absent on main)
  +- **The entry declares `allowed_durations`** (a grid, e.g. Veo `{4,6,8}`) →
  +  every scene length is a member of it: split a long section into grid lengths
  +  (30 s on Veo → 8 + 8 + 8 + 6) and merge or extend a short one onto the
  +  nearest grid value. An off-grid length is refused by the adapter (exit 14),
  +  never rounded, so it must not leave the plan.
  +`min_duration ≤ duration ≤ max_duration`, and is on the grid when one exists. When the manifest entry is
=== src/skills/supply-chain-intake/SKILL.md  (1/1 added lines absent on main)
  +- About to install a **third-party skill or agent bundle** — a `.skill` / `.zip` upload, a repo link with "install this", `npx skills add` — → [`references/agent-asset-intake.md`](references/agent-asset-intake.md).
=== src/skills/supply-chain-intake/evals/triggers.json  (11/14 added lines absent on main)
  +    "description": "8 should-trigger + 7 should-not-trigger queries. Should-trigger covers DE + EN phrasings for verifying a new third-party dependency before install (existence/slopsquatting, pin+lock, CVE, no curl|bash). Should-not-trigger covers near-miss neighbours (upgrading existing deps, secrets, generic checklist, server auth) whose vocabulary overlaps.",
  +            "q": "install this skill from the GitHub repo link for me",
  +            "trigger": true
  +            "q": "lade die zip vom skill einfach unverändert hoch und aktivier ihn",
  +            "trigger": true
  +            "q": "run npx skills add on that repo so I have the skill",
  +            "trigger": true
  +            "q": "write a new skill for our deploy workflow",
  +            "note": "authoring our own skill → skill-writing"
  +            "q": "change the Claude Desktop extension settings",
  +            "note": "host settings, nothing is installed"
=== src/skills/supply-chain-intake/references/agent-asset-intake.md  (1/34 added lines absent on main)
  +   `./scripts-run src/scripts/archive_precheck <file>` reads the archive's
=== tests/fixtures/engines/build.ts  (26/26 added lines absent on main)
  + * Engine-project fixture trees, built into a temp dir per test. Text files only:
  + * the marker files plus the generated/cache files that mislead a resolver.
  +import { mkdirSync, writeFileSync } from 'node:fs';
  +import { dirname, join } from 'node:path';
  +export type EngineFixture = 'godot' | 'unity' | 'unreal';
  +const FILES: Record<EngineFixture, Record<string, string>> = {
  +        'project.godot': '; Engine configuration file.\nconfig_version=5\n\n[application]\nconfig/name="Fixture"\nconfig/features=PackedStringArray("4.4", "Mobile")\n',
  +        'scripts/player.gd': 'extends CharacterBody3D\n',
  +        '.godot/imported/cache.cs': 'class Cache {}\n',
  +        'ProjectSettings/ProjectVersion.txt': 'm_EditorVersion: 6000.0.23f1\nm_EditorVersionWithRevision: 6000.0.23f1 (1c4764c07fb4)\n',
  +        'Assembly-CSharp.csproj':
  +            '<Project><ItemGroup><Reference Include="nunit.framework" /></ItemGroup></Project>\n',
  +        'Assets/Scripts/Player.cs': 'public class Player {}\n',
  +        'Library/PackageCache/x/y.cs': 'public class Cached {}\n',
  [... truncated]
=== tests/install/detect.test.ts  (17/22 added lines absent on main)
  +import { writeEngineFixture } from '../fixtures/engines/build.js';
  +    it('detectProjectShape reports no engine on a plain manifest repository', () => {
  +        expect(detectProjectShape(root).engine).toBeNull();
  +        ['godot', 'project.godot', '4.4'],
  +        ['unity', 'ProjectSettings/ProjectVersion.txt', '6000.0.23f1'],
  +        ['unreal', 'Game.uproject', '5.4'],
  +    ] as const)('detectProjectShape recognises a %s project and its version', (kind, marker, version) => {
  +        writeEngineFixture(root, kind);
  +        expect(shape.engine).toEqual({ kind, marker, version });
  +        // `kind` keeps meaning "package manifest": an engine tree with none is still unknown there.
  +        expect(shape.kind).toBe('unknown');
  +    it('detectProjectShape keeps an engine beside a manifest without changing kind', () => {
  +        writeEngineFixture(root, 'godot');
  +        expect(shape.engine?.kind).toBe('godot');
  [... truncated]
=== tests/scripts/ai_video_duration_grid.test.ts  (66/66 added lines absent on main)
  + * A duration off the model's grid is refused, never rounded.
  + * Before this gate `gemini-veo.sh` clamped any requested duration into {4,6,8}
  + * without saying so: a 7 s scene came back 8 s long and was billed as 8 s. The
  + * refusal must fire in the default dry-run mode, before `aiv_assert_dryrun`
  + * (exit 4) — the lesson `ai_video_end_image_refusal.test.ts` records — and an
  + * on-grid request, or a manifest that declares no grid, must still pass through.
  +import { spawnSync } from 'node:child_process';
  +import * as fs from 'node:fs';
  +import * as os from 'node:os';
  +import * as path from 'node:path';
  +import { fileURLToPath } from 'node:url';
  +import { describe, expect, it } from 'vitest';
  +const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  +const ADAPTERS = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'adapters');
  [... truncated]
=== tests/scripts/code_graph_discovery_visibility.test.ts  (11/12 added lines absent on main)
  +import { writeEngineFixture } from '../fixtures/engines/build.js';
  +describe('file discovery without git skips engine caches', () => {
  +        ['unity', ['Assets/Scripts/Player.cs']],
  +        ['unreal', ['Source/Game/Game.cs']],
  +    ] as const)('%s: cache directories are not walked as source', (kind, expected) => {
  +        writeEngineFixture(root, kind);
  +        expect(rels(discoverFiles(root)).sort()).toEqual([...expected]);
  +    it('the same directory names are walked when no engine marker is present', () => {
  +        write('Library/x.cs', 'class X {}\n');
  +        write('Intermediate/y.cs', 'class Y {}\n');
  +        expect(rels(discoverFiles(root)).sort()).toEqual(['Intermediate/y.cs', 'Library/x.cs']);
=== tests/scripts/work_engine/stack_runner.test.ts  (17/21 added lines absent on main)
  +        ['unity', () => {
  +            write('ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 6000.0.23f1\n');
  +            write('Assembly-CSharp.csproj', '<Project><ItemGroup><Reference Include="nunit.framework" /></ItemGroup></Project>');
  +        ['unreal', () => {
  +            write('Game.uproject', '{"EngineAssociation":"5.4"}');
  +        ['godot', () => {
  +            write('project.godot', 'config_version=5\n');
  +            write('Game.csproj', '<Project><PackageReference Include="xunit" /></Project>');
  +    ] as const)('dotnet-test REFUSED on a %s project, and the refusal names why', (engine, setup) => {
  +        expect(res.runners.map((r) => r.runner)).not.toContain('dotnet-test');
  +        expect(res.selected.map((r) => r.command)).not.toContain('dotnet test');
  +        expect(res.refusals).toEqual([
  +            expect.objectContaining({ ecosystem: 'dotnet', runner: 'dotnet-test', reason: expect.stringContaining(engine) }),
  +        expect(res.to_config()['refusals']).toHaveLength(1);
  [... truncated]
~~~
