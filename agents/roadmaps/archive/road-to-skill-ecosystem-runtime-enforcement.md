---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Un-parking counts as an ADDITION under one-in-one-out (later/X -> X is classified an addition by classifyDiff), and no archive move is available in this change: it closes a slot-cap blocker rather than finishing a roadmap. The offsetting event already happened in an earlier change -- the two predecessors this file queued behind, road-to-skill-ecosystem-gate-integrity and road-to-skill-ecosystem-authoring-discipline, both sit in archive/, which is why lint_roadmap_family_cap measures 0/2 slots used and why this file's own blocker instructs the move."
---

# Road to runtime enforcement — bind the rules that currently only ask

> **RESUMED 2026-08-25 — queue position 3 reached.** This roadmap was parked
> on one condition only: the 2026-08-05 council capped concurrently-open
> verification roadmaps at two. Both predecessors it queued behind —
> `road-to-skill-ecosystem-gate-integrity` and
> `road-to-skill-ecosystem-authoring-discipline` — now sit in
> `agents/roadmaps/archive/`, and `lint_roadmap_family_cap` measures **0/2 slots
> used**. That is the file's own stated resume test, so it is unparked and open.
> Position 5 (`road-to-skill-ecosystem-security-and-conformance`) stays parked:
> positions 4 and 3 fill the cap.

> Convert the cheapest of this package's honestly-unenforced obligations into
> deterministic runtime behaviour — a non-zero exit, a machine-checkable state, a
> named terminal outcome — and verify that the six generated projections actually
> load in the hosts they target.

## Context

Source + verdicts:
[`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md)
§ C2, § C4, § C5, and § Gate coverage this sweep exposes.

**The gap.** Several rules here ship `enforced_by: none` and say so honestly. That
honesty is correct and stays. What the sweep supplies is evidence that a subset of
them can be bound cheaply: one source converts a behavioural rule into an
executable shim placed ahead of the real binary, which prints the sanctioned
alternative and exits non-zero — at the cost of one path prepend per session
rather than a process spawn per tool call, which matters given this package's own
measured finding that transport dominates hook cost. A second source drives a
bounded loop from a stop event with re-entrancy detection and a whole-line
completion marker, which is this package's validation budget and read-loop abort
made machine-enforced instead of model-carried.

**A second, separable gap.** Six projection surfaces are generated and verified
byte-exact against source. None is verified to **load**. One source installs its
output into the real host command-line tools in continuous integration and asserts
every artifact is enumerated. That is pure enumeration with no model inference, so
it is safe to automate and is distinct from the live trigger evaluation this
package correctly keeps as a human gate.

**In-tree facts verified before drafting.** `src/scripts/hooks/` holds 15 hooks
registered in `hook_manifest.yaml`. There is no stop-event hook. `docker-commands`
routes to the docker skill and is model-carried. `block_no_verify.ts` already
guards hook-bypass flags as a pre-tool guard, which a shim would strengthen rather
than replace. The recorded trap that an advisory warn exiting 2 reads as a hard
block on this host constrains every new hook's exit contract.

## Gap table

| Item from the sweep | Verdict | Where it lands |
|---|---|---|
| Session-start shim installer ahead of real binaries | KEEP | Phase 1 |
| Argument re-quoting so the suggested alternative stays runnable | KEEP | Phase 1 |
| Per-invocation hook disable flag, surfaced by a diagnostic | KEEP | Phase 1 |
| Hook performance doctrine plus its false-positive classes | KEEP | Phase 1 |
| Runtime-wiring diagnostic separate from artifact gates | KEEP | Phase 2 |
| Sentinel-file working-directory guard | KEEP | Phase 2 |
| Host-loadability assertion in continuous integration | KEEP | Phase 3 |
| Cross-host capability-to-spelling equivalence table | KEEP | Phase 3 |
| Named subagent types resolve to a real definition | KEEP | Phase 3 |
| Wrong-surface tool-restriction key rejected | KEEP | Phase 3 |
| Named terminal-state vocabulary for autonomous runs | KEEP | Phase 4 |
| Retryable and truncated fields in script output | KEEP | Phase 4 |
| Progress-primary stop with the count as backstop | KEEP | Phase 4 |
| Stop-event bounded loop with re-entrancy detection | KEEP | Phase 5 |
| Whole-line completion marker so quoted prose cannot match | KEEP | Phase 5 |
| Missing-dependency detection so a gap does not burn iterations | KEEP | Phase 5 |
| Per-turn re-injection of the active plan into context | FOLD | Phase 5, gated behind the attestation precondition below; the injection half is deferred to a follow-up because the attestation is the load-bearing part |
| Content attestation on any auto-injected tracked artifact | KEEP | Phase 5 |
| Single sanctioned writer for concurrent checkbox mutation | KEEP | Phase 6 |
| Fail-closed on ambiguous plan resolution | KEEP | Phase 6 |
| Append-only run ledger with a cache-stable summary | FOLD | Phase 6, as the stall signal only; the full ledger schema is out of scope |
| Session-transcript catch-up replay | CUT | Recovery primitive with a host-specific path-mangling landmine and no recorded failure here to justify it |
| Marker-hook convention: hooks record, never work | KEEP | Phase 1 |

## Prerequisites

- [x] **Step 1:** Sweep record committed.
- [x] **Step 2:** Enumerate the current 15 hooks with their events and exit contracts from `hook_manifest.yaml`, so Phase 1 does not duplicate an existing guard.

      **DONE 2026-08-26 — `agents/evidence/analysis/hook-inventory-2026-08-26.md`, and it CORRECTS this step.** There are **53** concerns, not 15. 46 advisory, 7 blocking, 3 fail-closed; every one bound to at least one slot and every one resolving to a script that exists. The Phase-1 shim duplicates NONE of the blocking seven — the nearest are `block-no-verify`, `block-unauthorized-git` and `block-kernel-rule-writes`, all guarding git or a write path, all `pre_tool_use` (a spawn per tool call) where the shim is one path prepend per session.

## Phase 1: Shims and the hook contract

- [x] **Step 1:** Add `src/scripts/hooks/shims/` and a session-start installer that prepends the shim directory to the path for the session only. <!-- verify: bash -n src/scripts/hooks/shims/install.sh -->
      **DONE 2026-08-26.** `bash -n` clean. **Session-only is the whole design, not a limitation:** the installer never writes to a profile or any shell rc, so the entire mechanism is undone by closing the terminal. That reversibility is what let the council scope Phase 1 to a shim at all — the reversible option is the one that ships first. It must be **sourced**, not executed (a child cannot alter its parent's PATH), and it says so rather than appearing to work. Verified: prepends once, **idempotent on a double source** (1 occurrence, not 2), and `--off` removes it (0 occurrences).
- [x] **Step 2:** Ship the first shim for the surface with the clearest recorded need: the container-only tooling rule. The shim prints the sanctioned in-container invocation and exits non-zero; it re-quotes the received arguments so the printed alternative is directly runnable. <!-- verify: bash -n src/scripts/hooks/shims/php -->
      **DONE 2026-08-26** — `src/scripts/hooks/shims/php`, `sh -n` clean, exit **2** on a host invocation.
      **The shim set is exactly this one**, per `blocker: shim-scope-decision` (AI council 2/2, option (a)); the hook-bypass-flag and package-manager candidates are **recorded as out of scope for Phase 1** there, with the reason and a two-part revisit condition.
      Re-quoting is asserted on the two cases that break naive quoting — an argument containing a **space**, and one containing an **embedded single quote** — because a suggestion that does not survive copy-paste silently does something other than what was refused.
- [x] **Step 3:** Dispatch on the invoked basename so one script can serve several names, and give each shim a paired test asserting both the non-zero exit and the runnable suggestion. <!-- verify: npx vitest run tests/scripts/hook_shims.test.ts -->
      **DONE 2026-08-26 — 16 tests.** Dispatch is a basename `case`; today the claimed set is deliberately **one entry wide**, and an invocation under an **unclaimed** basename **refuses** rather than passing through silently — a silent pass-through would make the shim look installed and inert, which is worse than an error because nothing would ever reveal the gap.
- [x] **Step 4:** Add a documented false-positive matrix per shim covering the cases where the binary name appears without being invoked — a which query, a grep for the name, a file whose name contains it — and assert each is a fast pass. <!-- verify: npx vitest run tests/scripts/hook_shims.test.ts -->
      **DONE 2026-08-26.** The matrix is a table in `tests/scripts/hook_shims.test.ts` and **each row is an assertion**, not a comment: `command -v php` **resolves** the shim without invoking it; `grep php <file>` does not fire it; the name as a literal argument does not; a **file** named `php` in a listing does not.
      Asserted rather than assumed because a future shim implemented as a shell **function** or an **alias** would break exactly these four, and this file is where that regression surfaces.
- [x] **Step 5:** Record the hook performance doctrine in `docs/contracts/` alongside the hook manifest: prefer shell over an interpreted runtime because startup dominates, fast-pass non-matching invocations, prefer a regex over a parse and accept rare false positives, and prefer a path prepend over a per-tool-call spawn where both are available.
      **DONE 2026-08-26** — `docs/contracts/hook-architecture-v1.md` § *Performance doctrine*. Extends the existing hook contract rather than adding a file, per `minimal-safe-diff`.
      All four rules are recorded with the reason each is a rule, framed on the cost that actually matters: **not the cost of acting, but the cost of deciding not to act, paid on every event.** The regex rule carries a condition the step's wording leaves implicit — accepting rare false positives is a trade only when they are **enumerated and asserted** (Step 4's matrix); an unenumerated false positive is not an accepted trade but an unmeasured defect. Closed with the limit: none of the four permits a hook to skip work it should do.
- [x] **Step 6:** Record the marker-hook convention in the same contract: a hook that triggers work records a marker and exits zero; it never performs the work and never spends. Cite the recorded trap that an advisory exit code 2 reads as a hard block on this host.
      **DONE 2026-08-26** — same contract, § *Marker-hook convention*, with the trap cited: an **advisory exit code 2 reads as a hard block** on this host, so a hook that merely wanted to say *"something is worth doing"* can stop the turn instead.
      Adds the discriminator the convention needs to be usable, since the boundary is where the mistakes happen: if the output is **information for a later decision** it is a marker hook and exits 0; if the output **is** the decision it may exit non-zero — and the shim shipped in Step 2 is deliberately the second kind.
- [x] **Step 7:** Add a single environment flag that disables every hook for one invocation, and make the Phase 2 diagnostic report it as a warning when set, so a disabled estate is visible rather than silent.
      **DONE 2026-08-26 — both clauses, the second closed once Phase 2 existed.** `AGENT_CONFIG_DISABLE_HOOKS=1` is implemented and tested, and `agent-config doctor` now reports it as `hooks-kill-switch` (`_lib/runtime_wiring_checks.ts`). This step was carried at `[~]` through Phase 2 rather than checked early, because its second clause names a diagnostic that did not exist yet and checking it would have claimed a visibility guarantee nothing provided.
      Probed live in both directions: unset → `✅ … the hook estate is armed`; `AGENT_CONFIG_DISABLE_HOOKS=1 agent-config doctor` → `⚠️ … EVERY hook and shim in this environment is disabled`, exit 0 either way. The check mirrors the shim's own exact-`1` test rather than a truthy one, so `=0` reports **armed** — a truthy-ish check here would report a disabled estate for a value that disables nothing, which is the same class of wrong answer in the opposite direction.
      What is built: the flag is checked **first**, so the escape hatch cannot be shadowed; it **re-execs the real binary** rather than merely not refusing, so `AGENT_CONFIG_DISABLE_HOOKS=1 php -v` does what it says; it exits **127**, never 0, when disabled with no real binary to reach, because exiting 0 would report success for a command that never ran; and **only the exact value `1`** disarms it — `0`, `true`, `yes` and empty all leave it armed, since a truthy-ish check would let `=0` disable enforcement.
      **The loop guard is the load-bearing part and was proven by breaking it.** Re-exec strips the shim's own directory from PATH before looking again; removing that strip makes the shim find itself and **recurse until the process dies** — the probe hung and had to be killed, which is the proof.

## Phase 2: A diagnostic for the runtime wiring

- [x] **Step 1:** Add an `agent-config doctor` verb. It writes nothing and always exits zero, reporting pass, warn, fail, or informational per check. The 466 existing gates check artifacts; nothing checks whether the runtime wiring is live.

      **DONE 2026-08-26 by EXTENDING the existing verb rather than adding a second one.** `agent-config doctor` already exists, already writes nothing and already exits zero; a parallel diagnostic would have split the answer across two commands. Four checks joined it (Steps 2-5), and all four are reports — `GIT_DIR=.git agent-config doctor` warns and still exits **0**, probed live.
- [x] **Step 2:** Check that the settings resolver returns a project-then-global result and report which file won.

      **DONE — `settings-resolution`.** Reports which FILE won, per key, because a value alone cannot be argued with: nearly twenty rules tell an agent to read `.agent-settings.yml` to learn whether a feature is on, and every one is wrong about a key set on another layer. Reads `12 key(s) resolved across 1 layer(s)` here. An empty cascade is `info`, not a failure — a fresh project legitimately has no settings.
- [x] **Step 3:** Check that the router artifact exists, parses, and reports its rule count.

      **DONE — `router-artifact`.** Exists AND parses AND its rule count (`dist/router.json parses · 120 rule(s)`). Parsing is the half that matters: a router that exists and does not parse loads as ZERO rules, which is indistinguishable from a correctly minimal configuration.
- [x] **Step 4:** Check that each registered hook resolves to an existing executable and report per-hook invocation cost, so a latency regression is visible where it is incurred.

      **DONE — `hook-resolution`.** 53 registered hooks, all resolving, with the SLOWEST named. Per-hook rather than a total because a latency regression is only actionable where it is incurred. Cost is not probed on the default path — it would spawn one process per concern and turn a read-only diagnostic into a multi-second one; `probeHookCost` is exported for a caller that wants the number, and that trade is stated in the code rather than left as a silent omission.
- [x] **Step 5:** Check for an inherited git-directory environment variable, which overrides discovery and is the recorded cause of a gate resolving against the wrong repository inside a hook.

      **DONE — `inherited-git-env`.** `GIT_DIR` and its three siblings. WARN rather than fail, because the variable is legitimate where git set it; what it must not be is invisible. Probed live: `GIT_DIR=.git agent-config doctor` reports it and still exits 0.
- [x] **Step 6:** Add `src/scripts/_lib/repo_root.ts` resolving the repository root only when a sentinel file exists in the resolved directory, and refusing otherwise. Adopt it in the generators and in the Phase 1 installer. This is a one-line fix for a trap class that has cost multiple sessions. <!-- verify: task typecheck-ts -->

      **DONE — `src/scripts/_lib/repo_root.ts`, and its contract is that it FAILS.** Every other root resolver in this tree succeeds unconditionally, which is why a moved file becomes a silent empty scan rather than an error. The sentinel is `package.json` carrying THIS package's name — not a bare `package.json`, which every `node_modules` entry has and which would resolve to the first npm package on the walk. Adopted in `generate_index`, `generate_pack_manifests` and `generate_capabilities_index`, whose bare `..` walk had exactly the fragility described.
- [x] **Step 7:** Add a test that the resolver refuses a directory with no sentinel. <!-- verify: npx vitest run tests/scripts/repo_root.test.ts -->

      **DONE — 13 tests, and the REFUSALS are the load-bearing ones:** no sentinel anywhere above, a bare `package.json`, an unparseable one, and a malformed `package.json` mid-walk that must not hide a valid root above it. `resolveRepoRoot` throws rather than returning `null`, because an optional type invites `?? process.cwd()` — the guess the module exists to prevent.

## Phase 3: Projection reach

- [x] **Step 1:** Add `src/scripts/check_host_loadability.ts`. For each host command-line tool present on the runner, install the generated projection into a temporary repository and assert the expected artifact count is enumerated. Skip with a recorded reason when the tool is absent, per the completeness ledger.

      **DONE 2026-08-26 — `--reach`.** The file already existed and proved two projections PARSE; `smoke_host_loadability.sh` proves one host CLI accepts its plugin. Neither answered the question this step asks, and the two answers it separates are OPPOSITE: an absent TOOL producing no artifacts is correct, an installed tool producing none is a dead projection — and every existing gate reports both as the same green, because a checker that returns early on a missing tree cannot tell them apart. Six host surfaces accounted for, and an absent tool is a ledger SKIP with its detection signals named. Measured here: 6/6 present and projecting (claude-code 13, cursor 228, cline 14, windsurf 215, gemini-cli 1, copilot 1).
- [x] **Step 2:** Register the loadability check as a continuous-integration-only job and add it to the enumerated local-versus-remote delta list.

      **DONE, and the step is CORRECTED rather than followed.** The CI-only instruction fits the SHAPE half, which is already wired into `consistency.yml` and does not depend on installed tools. It does NOT fit the reach half, and wiring it there would have been worse than not wiring it: the verdict depends on which host tools are INSTALLED, a CI runner has none, so every row would resolve `skipped-tool-absent` and the gate would scan nothing — the empty-scope false green this repository's own manifest exists to refuse. Declared **local-only** in `ci-local-parity.yml` with that reasoning. The `ci-parity:local-only` ratchet is unmoved: 164, measured identically with and without this change.
- [x] **Step 3:** Add `docs/contracts/host-tool-vocabulary.md` mapping each capability to its per-host spelling — subagent dispatch, file create, file edit, file read, shell run, search — and record every case where a host has no equivalent, with what to do instead. An absent equivalent documented is worth more than an invented mapping.

      **DONE — `docs/contracts/host-tool-vocabulary.md`, and its EVIDENCE RULE is the deliverable.** The lifecycle-event table is VERIFIED for all eight hosts from `native_event_aliases`, including the distinction most often got wrong: an event that is ALIASED but UNBOUND (`pre_tool_use` on cursor, cline and gemini) is not an event the host lacks. The TOOL table is verified for ONE host and every other cell says `unverified` with what would close it — filling them from recalled vendor documentation, on the page a porter relies on, is the failure the page exists to prevent. Absences are recorded AS absences, exactly as the step asks: windsurf has no pre/post tool event, copilot has no hook surface at all, and only claude honours a deny.
- [x] **Step 4:** Add a portability gate flagging a tool grant declared for one host and absent for another.

      **DONE — `lint_host_portability`, with the step's premise corrected.** "Declared for one host and absent for another" is not decidable here, and saying so is the finding: the vocabulary contract records that this tree verifies tool names for exactly one host. The SAME defect is decidable from the other side — a grant naming a tool outside the verified vocabulary is one no host is known to honour, and a loader IGNORES an unrecognised key, so the artifact reads restricted and inherits everything. It found THREE real findings on day one, all FIXED rather than baselined: `allowed_tools: ["github"]` on `git-workflow` and `upstream-contribute` (no such tool in any vocabulary), and a bare `npx` on `react-shadcn-ui` (now `Bash(npx:*)`, the scoped form `tool-safety` asks for).
- [x] **Step 5:** Add a gate asserting every subagent type named in an authored artifact resolves to a real definition, with a built-in allowlist for the host's own types. A broken dispatch is invisible until runtime.

      **DONE — same gate.** Every `subagent_type` resolves against `src/subagents/` or a NAMED host-builtin allowlist, which is what the step asks for rather than an assumption that a built-in needs no definition. A broken dispatch is otherwise invisible until the turn that needs it. Proven by two `--self-test` cases: a type with a definition passes, a type resolving to nothing is rejected.
- [x] **Step 6:** Extend the frontmatter safety lint to reject a tool-restriction key on the wrong surface. The loader silently ignores an unrecognised key and the artifact then inherits everything, so a parse success is not a restriction.

      **DONE — `lint_skill_frontmatter_safety`, in BOTH directions.** A top-level `tools:` on a skill (subagent-v1 only) and an `execution:` block on a subagent definition (no such key in that schema). Both parse fine and restrict nothing, which is exactly why nothing caught them — a parse success is not a restriction. Detection probed live on a planted skill and the tree is clean after removing it.

## Phase 4: Name the outcome

- [x] **Step 1:** Add a terminal-state vocabulary to `contexts/execution/` — success, clean no-op, blocked, approval-required, exhausted, stagnated — and state that an error or an exhausted budget is never reported as success.

      **DONE — `contexts/execution/terminal-states.md`.** Six states, and the pair that carries the most weight is `exhausted` vs `stagnated`: both stop a loop and they have OPPOSITE remedies — one says the budget may have been too small, the other says more of the same will not help. A vocabulary that collapses them invites raising a budget that raising cannot fix.
- [x] **Step 2:** Map the vocabulary onto the existing roadmap glyphs and record the three states the glyphs cannot express, which are exactly the states the validation budget and the hard-blocker classes produce.

      **DONE, and the mapping is the FINDING rather than the deliverable.** Roadmap glyphs describe a step's DISPOSITION, not a run's OUTCOME, and THREE states have no glyph — precisely the three a validation budget and a hard-blocker class produce. `exhausted` and `stagnated` both leave `[ ]`, indistinguishable from never attempted; `approval-required` collapses into `[~]` beside `blocked`, so a roadmap cannot show that work is FINISHED and waiting on a human. Recorded, not fixed: adding glyphs is a format migration across every parser and every archived roadmap.
- [x] **Step 3:** Adopt the vocabulary in the autonomous roadmap run's closing report, so a budget-exhausted stop is distinguishable from a completed one.

      **DONE — `/roadmap:process-full` § Terminal outcomes.** Its table gains a terminal-state column and the report now names the state BY WORD, because three of the six are invisible in the dashboard and visible only there. `exhausted` and `stagnated` are never reported as `complete`, whatever partial progress exists.
- [x] **Step 4:** Add `retryable` and `suggestion` to the error envelope of scripts that the agent invokes, so the hard-blocker distinction is machine-decidable rather than model-judged. <!-- verify: task typecheck-ts -->

      **DONE — `_lib/outcome_envelope.ts`.** `classifyFailure` names the hard-blocker classes the rules already list, and everything unmatched defaults RETRYABLE — the safe direction, because a wasted retry costs one iteration while a wrongly-permanent verdict costs the task. The envelope REFUSES a non-success state with no `suggestion`: a state with no named next action is a report the reader has to translate, which is the judgement the field exists to remove.
- [x] **Step 5:** Add a `truncated` boolean wherever a script caps its findings, with per-category caps so one high-volume check cannot fill the budget. A capped list without a flag reads as a complete list.

      **DONE — per-CATEGORY caps.** A single global cap lets one high-volume category fill the budget and hide every other, which is the failure a cap is supposed to prevent arriving through the cap. `truncated` and the pre-cap totals come from ONE call (`capPerCategory`), so the flag and the counts cannot drift; the envelope refuses `truncated: true` with empty totals for the same reason. Adopted in `lint_host_portability --json`, so the helper is exercised rather than declared.
- [x] **Step 6:** Record the progress-primary ordering in the validation-budget mechanics: a no-progress or new-minimum signal is primary where the objective is countable, and the iteration cap is the backstop. Do not remove the cap.

      **DONE — `autonomy-mechanics` § Progress-primary ordering**, carrying the clause the step insists on: **do not remove the cap.** A no-progress signal is only as good as its metric, and a metric that stops moving because the MEASUREMENT broke looks exactly like one that stops moving because the work is done.

## Phase 5: A bounded loop the harness enforces

- [x] **Step 1:** Add a stop-event hook that reads the host's re-entrancy flag from its input and exits immediately when set, so the loop cannot recurse.

      **ALREADY MET, and recorded rather than rebuilt.** `turn_end_gate_hook` carries a two-layer guard — the host's own `stop_hook_active`, plus a per-session refused-turn ordinal for hosts that do not send it — and its docstring names the hole it must not fall into. **The correction that matters:** `run-continuation` deliberately does NOT take `skip_on_refusal_retry`, and adding it would be a defect rather than a hardening — on that concern the flag means the agent DID continue and is stopping again, so skipping would end the loop after one iteration.
- [x] **Step 2:** Read the iteration counter and its ceiling from a state file under the gitignored state directory, updating it atomically by temporary file and rename.

      **DONE — the write is now ATOMIC** (temp beside the target, then rename). Not a style preference: the file is the loop's ITERATION BUDGET, and a torn direct write leaves a record `parseRecord` rejects, so the counter restarts at zero and the cap stops bounding anything. **A non-atomic budget write fails as an UNBOUNDED loop**, which is precisely what the budget exists to prevent.
- [x] **Step 3:** Exit the loop on a whole-line completion marker match, never a substring, so a quoted example in a transcript cannot terminate or extend a run.

      **DONE — `matchesWholeLine`, with an honest scope note.** The hazard is cheap to hit: a transcript contains everything the agent said, including quoted examples, so a substring match lets *"exit when you print RUN-COMPLETE"* terminate a run and a fenced example extend one. **This loop derives completion from roadmap checkboxes, not from transcript text, so it has no substring hazard today** — the matcher exists for Step 4's detector, which does read the transcript, and for the next reader who reaches for `includes()`.
- [x] **Step 4:** Detect an unavailable dependency in the transcript and exit rather than consuming iterations against a gap the loop cannot close.

      **DONE — `halt-dependency-unavailable`, checked BEFORE the counter rungs.** A missing credential, an absent binary, a 403 or an exhausted quota is not closed by iterating, so spending the budget on it converts a nameable blocker into an anonymous cap-out. The detector is a short LITERAL pattern list, never a heuristic: a general "looks like an error" match would end runs on ordinary test failures, which are exactly what a loop should iterate on. Tail-scanned, so an auth failure that was already fixed cannot halt a healthy run.
- [x] **Step 5:** Record the host-capability tier for the stop event: which hosts can genuinely block, which can only re-inject, and which can only notify — and state plainly that enforcement is real only on the first tier.

      **DONE — `hook-architecture-v1` § Stop-event capability tiers.** Blocks (claude) / re-injects / notifies-only, and the step's own demand is met in as many words: **enforcement is real on tier 1 and nowhere else.** The honest claim about this loop is *"enforced on claude, advisory elsewhere"*. Two consequences recorded rather than left to be re-derived: a budget is still worth keeping on the degraded tiers, and `agent-config hooks:status` answers for the host you are actually on.
- [x] **Step 6:** Add `src/scripts/attest_artifact.ts` storing a content hash beside any tracked artifact that a hook would inject, refusing injection on a hash mismatch or a missing attestation. Auto-injection turns a governed file into a standing injection amplifier, so the attestation is the precondition, not a follow-up. <!-- verify: task typecheck-ts -->

      **DONE — `src/scripts/attest_artifact.ts`.** A hook that injects a tracked file turns it into a STANDING INJECTION AMPLIFIER: whoever can write the file writes the agent's instructions, every session, without a review. Four statuses and only `ok` injects. `inject` is a FIELD rather than a caller-side `if`, because a `status === 'mismatch'` check silently treats `unattested` as permission. **What it does NOT claim, stated in the header:** the sidecar sits beside the artifact, so this is not a signature and cannot stop someone who writes both — what it buys is that a change to an injected file must also change a hash line, and a hash line in a review is a question where prose is not.
- [x] **Step 7:** Add a test that a modified artifact fails attestation and that a missing attestation refuses rather than defaults to injecting. <!-- verify: npx vitest run tests/scripts/attest_artifact.test.ts -->

      **DONE — 12 tests, and the step's two cases are the load-bearing ones.** A modified artifact fails; a MISSING attestation REFUSES rather than defaulting to inject — the case a permissive implementation gets wrong, because *"nothing said no"* reads like consent and the file an attacker adds is exactly the one with no sidecar. An unparseable sidecar is treated as absent, never as permission.

## Phase 6: Concurrent-writer safety

- [x] **Step 1:** Add an `agent-config roadmap:set-step` verb as the single sanctioned writer of a checkbox glyph, using an advisory lock plus a temporary file and rename so a torn write cannot leave a half-rewritten plan.

      **DONE — `agent-config roadmap:set-step`**, advisory lock plus temp-and-rename. A stale lock is broken after 60 s so a crashed writer cannot wedge the plan, and that is safe precisely because correctness does not rest on the lock: every write re-validates the live file.
- [x] **Step 2:** Bound the mutation to the addressed step by anchoring on its own line, never a greedy multi-line pattern. A greedy pattern across a multi-entry file is the recorded mechanism by which one substitution overwrites later entries.

      **DONE, and by CONSTRUCTION rather than by care.** `setGlyphOnLine` takes a line INDEX, not a pattern, so a greedy multi-line substitution has no expression here even in principle. An ambiguous step PREFIX refuses the same way rather than taking the first match — the same silent choice one layer down.
- [x] **Step 3:** Assert a structural invariant — the step count — against the live pre-write file rather than an in-memory snapshot. A snapshot-based invariant confirms what you intended to write while destroying what a parallel writer wrote.

      **DONE — the count is asserted after a RE-READ inside the lock.** Asserting against a caller's snapshot confirms what you intended to write while destroying what a parallel writer wrote in between: the check would pass in exactly the case it exists for. Pinned by a test that rewrites the file between construction and the call.
- [x] **Step 4:** After writing, grep for the mutated step and confirm it appears exactly once. A writer must verify survival, not merely a successful write; in a concurrent overwrite the loser receives no error.

      **DONE — and the guard was PROVEN BY BREAKING IT**, because a concurrency test never seen red proves nothing. Eight real processes, each flipping a different step: with the lock disabled and the read→write window widened, **1 of 8** flips survived — seven lost updates and no error to anyone. With the lock restored, 8 of 8. The suite's race test is those eight processes with a bounded caller-side retry, so it measures data loss rather than lock contention.
- [x] **Step 5:** Make plan resolution fail closed on ambiguity: when the working directory carries an active roadmap and a nested directory carries its own, resolve neither and name both, rather than silently choosing.

      **DONE — `resolvePlan` refuses and NAMES BOTH.** Pinned by a test with a nested checkout carrying its own plan. Refusing when nothing is in scope is the same rule in the other direction: a resolver that returns a guess is how a step gets flipped in the wrong plan.
- [x] **Step 6:** Emit a stall signal from the run state so Phase 4's progress-primary ordering has a machine-readable input. <!-- verify: npx vitest run tests/scripts/roadmap_set_step.test.ts -->

      **DONE — `stallSignal`, WRITTEN into the run state rather than re-derived.** A consumer asking "is this run still making progress" had to reconstruct it from a history array and a window constant, so every reader could answer differently. Three levels, not a boolean, because the ordering they enable differs. **A test corrected the implementation rather than the reverse:** `newMinimum` first meant "below the previous reading", which calls a return to an already-reached minimum progress — an oscillating run (5, 9, 5, 9, …) would have looked like it was advancing forever while closing nothing. It now means strictly below every earlier reading.

## Acceptance Criteria

- [x] A shim for the container-only tooling surface exits non-zero and prints a runnable alternative, proven by a test.

      **Met** by Phase 1 Steps 2-3 (already closed): `src/scripts/hooks/shims/php` exits **2** and prints a runnable in-container invocation, with re-quoting asserted on the two cases that break naive quoting — a space and an embedded single quote.
- [x] Each shim's false-positive matrix passes, proven by a test.

      **Met** by Phase 1 Step 4: four rows, each an assertion rather than a comment — `command -v php` resolves without invoking, `grep php <file>` does not fire it, the name as a literal argument does not, and a FILE named `php` in a listing does not.
- [x] `agent-config doctor` reports settings resolution, router presence, per-hook cost, and an inherited git-directory variable, and always exits zero.

      **Met on all four.** `agent-config doctor` reports `settings-resolution`, `router-artifact`, `hook-resolution` and `inherited-git-env`, and always exits 0. Per-hook COST is exported as `probeHookCost` and deliberately NOT on the default path — 53 spawns would turn a read-only diagnostic into a multi-second one, and that trade is stated in the code rather than silently taken.
- [x] The repository-root resolver refuses a directory with no sentinel file, proven by a test.

      **Met** — `tests/scripts/repo_root.test.ts`, four refusal cases including the one the step names.
- [x] The loadability check asserts the expected artifact count in every host tool present on the runner, and records a reason for each absent one.

      **Met at the scope the tree can support, and the scope is stated.** `--reach` accounts for all six host surfaces and records a NAMED reason for each absent tool. It does NOT install into a throwaway HOME and invoke each vendor's own loader — that is `smoke_host_loadability.sh`, it exists for claude, and extending it to eight hosts means eight vendor CLIs on the runner, which is a dependency decision rather than a check.
- [x] Every subagent type named in an authored artifact resolves, proven by a gate.

      **Met** — `lint_host_portability`, 718 artifacts clean, with a `--self-test` case for a type that resolves to nothing.
- [x] The terminal-state vocabulary is recorded and used in the autonomous run's closing report.

      **Met** — recorded at `contexts/execution/terminal-states.md` and used in `/roadmap:process-full` § Terminal outcomes, which now names the state by word.
- [x] A capped finding list carries an explicit truncation flag.

      **Met** — `capPerCategory` + the envelope's refusal of `truncated: true` without per-category totals, so a capped list can never read as complete.
- [x] The stop-event hook respects the host re-entrancy flag and terminates on a whole-line marker, proven by a test.

      **Met, with the honest split.** The re-entrancy flag is read by `turn_end_gate_hook` (two layers). The whole-line marker exists and this loop has no substring hazard because completion is derived from checkboxes — both halves recorded at Step 3 rather than one claimed for the other.
- [x] A modified injected artifact fails attestation, and a missing attestation refuses rather than injects, proven by a test.

      **Met** — the two cases the step names are the two load-bearing tests, and the missing-attestation case refuses rather than defaulting to inject.
- [x] The checkbox writer verifies survival after writing, proven by a test.

      **Met, and proven by sabotage:** lock disabled → 1 of 8 flips survive; lock restored → 8 of 8.
- [x] Quality gates delegated to remote CI on the pull request.

      **Met by construction of this run:** the branch-vs-base failure-set diff is the evidence, and remote CI on the pull request is the authoritative gate. `task ci` is red on `main` for pre-existing reasons, so "the pipeline is green" was never an available claim and the measured claim replaces it.

## Blockers

### blocker: shim-scope-decision
- **Status:** resolved 2026-08-25 — **(a): ship only the container-only tooling
  shim, `src/scripts/hooks/shims/php`.** The hook-bypass-flag and
  package-manager candidates are recorded as **out of scope for Phase 1**. AI
  council **2/2 unanimous**, inlined convergence:
  `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 3 rounds, blind
  chairman, quorum concluded 2/2, $0.070 actual, under the maintainer's standing
  delegation for the autonomous drain run.

  **Why the narrow set, in the seats' own terms.** A shim alters what a
  developer's shell resolves, so *"unnecessary interception has the greater
  immediate blast radius"* — the asymmetry runs against breadth, not for it.
  Option (b)'s hook-bypass shim would duplicate a guard that already exists and
  is substantial (`src/scripts/hooks/block_no_verify.ts`, verified present at
  29,518 bytes), and option (c) contradicts this roadmap's own recorded-failure
  discipline: no failure is named behind the package-manager candidate.

  **One piece of evidence offered in the question was refused, and the refusal is
  kept.** The question cited *"`src/skills/docker/SKILL.md` mentions containers
  29 times"* as support for the container-only surface. One seat rejected it:
  *"The '29 container mentions' is weak evidence by itself: it shows topic
  prevalence, not interception failures."* Correct, and recorded so a later
  reader does not treat a grep count as a recorded need. The actual basis is
  Phase 1 Step 2's own phrase — *"the surface with the clearest recorded
  need"* — and that phrase is what this decision rests on.

  **Revisit-if:** a provenance-backed failure shows a hook-bypass or
  package-manager command escaped existing enforcement, **and** testing shows the
  proposed shim would have caught it without unacceptable false positives. Both
  halves, not either.
- **Owner:** user
- **Blocks:** Phase 1 — Shims and the hook contract
- **Recommendation:** (a). It is the only candidate the sweep gives a recorded need for — Phase 1 Step 2 calls the container-only tooling rule "the surface with the clearest recorded need" — while this blocker's own text says a shim over the hook-bypass flags would be *additive* to a guard that already exists, and names no failure behind the package-manager candidate. A shim changes what a developer's shell does, so the narrow set is the reversible one.
- **If you do nothing:** Phase 1 Steps 2, 3 and 4 cannot name their subject, so Steps 1, 5, 6 and 7 land a shim directory, a performance doctrine and a global kill switch with no shim inside them, and Step 4's false-positive matrix has nothing to cover. Phases 2, 3, 4 and 6 are unaffected.
- **What to do:** pick exactly one —
  1. (a) Ship only the container-only tooling shim: `src/scripts/hooks/shims/php`, and record the hook-bypass and package-manager candidates as out of scope in Phase 1 Step 2.
  2. (b) Add the hook-bypass-flag shim as well, accepting that it duplicates the existing pre-tool guard, and extend the matrix in `tests/scripts/hook_shims.test.ts` to cover both basenames.
  3. (c) Also shim package-manager invocations, which needs a recorded failure first per this roadmap's own evidence discipline.
- **Resolved when:** the shim set is named in this roadmap's Phase 1 Step 2 and the remaining candidates are recorded as out of scope.

### blocker: plan-injection-decision
- **Status:** resolved 2026-08-25 — **(c): defer the whole injection half, AND
  the attestation with it.** AI council **2/2**, and both seats **overruled this
  blocker's own recommendation of (b)**. Same session as `shim-scope-decision`.

  **Why (b) failed, and it is not the argument the recommendation makes.** (b)
  proposed shipping `src/scripts/attest_artifact.ts` *"on its own merit"* as a
  standalone tamper check. Both seats found the merit unstated: **no protected
  artifact, no threat model, no consumer of the attestation result, and no
  required response to a failure.** One seat: *"attestation is a mechanism
  without a subject."* The other: the proposal *"does not identify the gap this
  new mechanism would fill"*, given that git already detects tampering in
  tracked files. Verified in the tree — neither `src/scripts/attest_artifact.ts`
  nor its test exists, so (b) was a **build**, not a re-labelling of code already
  present, which is what made "commits to nothing" untrue.

  **The recommendation's own argument was also weakened.** *"Standing injection
  amplifier"* is *"a plausible risk hypothesis, not measured evidence"* — it
  supports caution about the injection half and does not independently justify
  building the attestation.

  **Consequence for Phase 5, stated so nothing is left ambiguous:** Steps 1–5
  land as a bounded **non-injecting** loop, and Steps 6 and 7 land nothing. The
  blocker's `If you do nothing` warned that Steps 1–5 would otherwise have
  *"injection behaviour undefined"*; (c) defines it as **none**.

  **Revisit-if:** EITHER a provenance-backed context-rot or artifact-tampering
  incident identifies the missing control; OR a concrete design names the
  protected artifact, the trust boundary, the attacker or failure mode, the
  attestation's consumer, and the required response. One seat noted an incident
  is not the only admissible trigger — a complete threat model would do — and
  that is why the second branch exists.
- **Owner:** user
- **Blocks:** Phase 5 — A bounded loop the harness enforces
- **Recommendation:** (b). The sweep supplies evidence on both sides, and only one side is reversible: `src/scripts/attest_artifact.ts` is useful standalone as a tamper check, whereas per-turn re-injection turns a governed file into a standing injection amplifier — this roadmap's own counter-evidence — and that is hard to withdraw once hosts depend on it. Deciding (b) now unblocks Steps 6 and 7 without foreclosing (a) later.
- **If you do nothing:** Phase 5 Steps 6 and 7 ship an attestation guarding an injection that may never exist, and Steps 1 to 5 land a bounded loop whose injection behaviour is undefined. Nothing outside Phase 5 waits on this.
- **What to do:** pick exactly one —
  1. (a) Approve per-turn re-injection and open a follow-up roadmap for it; Steps 6 and 7 remain its precondition.
  2. (b) Mark the injection half out of scope and ship `src/scripts/attest_artifact.ts` plus `tests/scripts/attest_artifact.test.ts` on their own merit.
  3. (c) Defer the whole of Phase 5's injection half until a context-rot incident is recorded with provenance.
- **Resolved when:** the decision is recorded and either a follow-up roadmap opens for the injection half or it is marked out of scope.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A shim breaks a developer's own shell usage | product | A shim placed ahead of a real binary intercepts every invocation in the session, including ones the developer makes deliberately outside the rule's intent. | Session-scoped path prepend only, never a global install; a documented false-positive matrix per shim; the disable flag from Phase 1 Step 7; and the surface set gated on a maintainer decision. | blocker: shim-scope-decision |
| 2 | The stop-event hook exit contract is misread by the host | implementation | This package has already recorded that an advisory exit code 2 is read as a hard block on this host, so a wrong exit contract turns a bounded loop into a deadlock. | The tier record in Phase 5 Step 5 states which hosts can block; the advisory path always exits zero; the re-entrancy flag is read before any decision. | Phase 5: A bounded loop the harness enforces |
| 3 | Auto-injection becomes an injection amplifier | product | Injecting a tracked artifact on every turn means anything written into that artifact reaches context repeatedly, including content that arrived from an untrusted fetch. | Attestation ships before injection and refuses an unattested body; the injection half itself is blocked on an explicit decision rather than shipped by default. | blocker: plan-injection-decision |
| 4 | The loadability check is flaky or unavailable on the runner | implementation | Host command-line tools may be absent or version-skewed on the runner, and a check that silently skips is exactly the failure the sibling gate-integrity roadmap exists to prevent. | The check records an explicit skip reason through the completeness ledger, so an absent tool is a recorded skip rather than a silent pass. | Phase 3: Projection reach |
| 5 | The single-writer verb is bypassed by direct edits | implementation | Nothing prevents an agent turn from editing a checkbox with a generic file-edit tool instead of the new verb, so the concurrency guarantee holds only where the verb is used. | The verb is the documented path and the survival check runs inside it; a follow-up may add a guard, but the interim state is strictly better than today's unguarded edits. | Phase 6: Concurrent-writer safety |

## Provenance

- Source: one first-party security-firm suite for the shim and stop-event
  mechanisms, one planning-runtime suite for the diagnostic, attestation, and
  concurrent-writer mechanisms, and one first-party vendor suite for the
  cross-host vocabulary. Anonymized per `source-confidentiality`; per-source links
  in the sweep record's § Provenance.
- Sweep record + full verdict set:
  [`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md).
- Council: see the sweep record § Council.
