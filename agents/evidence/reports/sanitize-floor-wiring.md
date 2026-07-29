# Sanitize-floor wiring census (S0.0)

Deliverable for `road-to-runtime-encoding-hardening` Phase 0. Answers one
question per read surface: **does the sanitize floor actually run there, and
what proves it?**

Measured 2026-07-29 against `feat/runtime-encoding-hardening`. Every row is
decided by an **end-to-end probe through the real entry point** — a poisoned
curated-memory entry in, emitted output out. A unit test on `sanitize_text`
does not decide a row, per the roadmap's own evidence bar.

## Method

1. A throwaway probe root carries one poisoned entry in
   `agents/memory/incident-learnings.yml`. The body holds one representative
   per class: zero-width space (U+200B), RTL override (U+202E), Unicode Tag
   block (U+E0041), a C1 control (U+0085), and a visible Cyrillic confusable
   (U+0440) that the floor deliberately keeps.
2. The fixture is written as a YAML **double-quoted** scalar, so the parser
   yields real codepoints while the file on disk stays clean text. The
   generator **self-checks** that all five codepoints are present in the
   parsed value *before* any probe runs — without that assertion the probe
   silently proves nothing.
3. Surfaces are exercised with `cwd` set to the probe root so the real
   file-backed loader runs.
4. Output is classified by **parsing the JSON and walking the decoded
   strings**. Substring-matching raw stdout is invalid: the emitter escapes
   non-ASCII to `\uXXXX`, so a surviving codepoint reads as absent.

Both invalidity traps above were hit on the first attempt and corrected; they
are recorded here because either one silently converts this census into a
false all-clear.

## Result — per surface

| Read surface | Entry point | Floor runs? | Invisible + control classes | Visible confusable | Proof |
|---|---|---|---|---|---|
| `retrieve()` | `memory_lookup.ts:1012` | **NO** | all four **SURVIVED** | survived | end-to-end probe, direct import |
| `retrieve_with_meta()` | `memory_lookup.ts:1028` | **NO** | all four **SURVIVED** | survived | end-to-end probe, direct import |
| **CLI default** (`--envelope legacy`) | `memory_lookup.ts:1435` → `retrieve()` | **NO** | all four **SURVIVED** | survived | end-to-end probe, real CLI |
| `retrieve_v1()` | `memory_lookup.ts:1098` → `sanitize_entry` at `:1140` | **yes** | all four stripped | survived (by design) | end-to-end probe, direct import + real CLI |
| `memory_get_v1()` | `memory_lookup.ts:1257` → `sanitize_entry` at `:1264` | **yes** | all four stripped | survived (by design) | end-to-end probe, direct import |
| MCP `memory_lookup` tool | `mcp_server/tools.ts:512` → `retrieve_v1` | yes, **inherited** | via proven callee | via proven callee | code path to a probe-proven callee; MCP transport itself not exercised |
| MCP `memory_get` tool | `mcp_server/tools.ts:542` → `memory_get_v1` | yes, **inherited** | via proven callee | via proven callee | code path to a probe-proven callee; MCP transport itself not exercised |
| `second_brain_retrieval` prompt path | `second_brain_retrieval.ts:218` | **NO** — see below | not applied on the prompt path | n/a | source read, `:202` vs `:218` |
| `reddit_thread_parse` | `_lib/reddit_thread_parse.ts:166` | yes | every emitted string passes `sanitize_text` | n/a | source read; single choke point |

## Finding 1 — the gap is the legacy default envelope, not the named surfaces

The sanitizer's header names `retrieve_v1` / `memory_get_v1`. **The header is
accurate.** Both are wired and both strip every invisible and control class
end-to-end.

The unprotected path is the one the header never mentions: `retrieve()`,
`retrieve_with_meta()`, and therefore the **CLI default**. `--envelope` defaults
to `legacy` (`memory_lookup.ts:1337`), and the legacy branch at `:1435` calls
`retrieve()` directly, bypassing the projection where sanitization happens.

This matters because the legacy default is the **documented agent path**.
`rules/security-sensitive-stop.md:63` instructs the agent to run:

```bash
agent-config memory:lookup \
  --types incident-learnings,historical-patterns \
  --key <touched file path> \
  --limit 3 --format json
```

No `--envelope v1`. Every agent following that rule reads corpus content over
the unsanitized surface. The floor exists, is correct, and is off the path the
rules actually send traffic down.

## Finding 2 — `second_brain_retrieval` measures the floor instead of applying it

`second_brain_retrieval.ts:202` computes `const clean = sanitize_text(hit.body)`
and uses it for exactly one thing: incrementing `poisonedNeutralized` at `:203`.
The prompt is then built at `:218` from `topk.map((x) => x.body)` — the **raw**
body. `clean` never reaches the model.

Consequence beyond the missing defense: the reported
`poisoned_rejection_rate` (`:267`) is a property of the **algorithm**, not of
the pipeline it claims to describe. It would read 1.0 while the prompt path
forwards every vector intact.

## Finding 3 — the premise this roadmap was written on was a measurement artifact

The roadmap recorded that `memory_lookup.ts` "has **zero imports**" and that
the floor's only production caller is `second_brain_retrieval.ts`. Both were
wrong, and the reason is mechanical: `memory_lookup.ts` contains a **raw NUL
byte** (offset 5761, line 125, used as a composite map-key separator inside a
template literal), so `grep` classifies it as binary and **silently skips it**.
With `grep -a` the file shows `import { sanitize_entry } ...` at line 38.

Sixteen tracked `.ts` files carry raw NUL bytes and are invisible to the
grep family the same way. That is a defect in its own right — a gate or an
agent gathering evidence by grep reads **nothing** from these files and reports
a clean result. It is the same class as a check whose scan root matches no
files: zero findings is indistinguishable from a pass.

Census, intent classification, and blast radius: see
[`nul-byte-source-census.md`](nul-byte-source-census.md).

## S0.0b — the inter-agent / subagent message channel

The roadmap asked whether content crossing the subagent boundary is untrusted in
the same sense retrieved content is. **For the subagent boundary the answer is
"structurally impossible", not "uncovered" — and asking the question surfaced a
different carrier that genuinely is uncovered.**

The premise check first: **this package is not the carrier.** It authors the
subagent *definitions* (`condense.ts:1639` projects `src/subagents/*.md` →
`.claude/agents/*.md`), the *prompt templates*
(`src/skills/subagent-orchestration/prompts/`, which
`prompts/README.md:4` calls "the **literal template** the orchestrator hands to
the subagent"), and the safety floor inside them
(`generate_subagent_floor.ts:53`). The spawn and the return are the **host's**
primitive — `auto_dispatch.ts:64` bails out entirely when
`activation.subagent_spawn` is absent, and there is **no `SubagentStop` hook
event** in `hook_manifest.yaml` to attach a sanitizer to. The
`subagent_spawn.ts` / `subagent_response.ts` libs are imported by nothing on the
shipped path. `docs/contracts/subagent-boundary.md:56-60` already states this
limit in its own words.

| Direction | Untrusted in the same sense? | Same floor applies? | Reasoning |
|---|---|---|---|
| orchestrator → subagent | **no** (different sense) | **no — wrong side** | The outbound payload is our own trusted material: task string, `KERNEL_RULE_IDS`-derived floor text, and knowledge passed as **refs, never bodies** — `isRefLike` (`subagent_spawn.ts:63`) rejects any entry with a newline or over 200 chars, capped at 5 refs (`:28`). Sanitizing here would protect the worker, not us; the worker already carries a prose defense (`src/subagents/_prompt-defense.md:17-19`). |
| subagent → orchestrator | **yes in kind** | **structurally impossible** | A return is model text derived from whatever the worker read, so it can launder a vector. But no code we own ever holds it — the host hands the result straight to the orchestrating model. The mitigations the package *can* deliver already exist at two other layers: the refs-not-bodies floor on the return (`subagent_response.ts:53` errors on `evidence_refs` containing a newline) and the prose defense above. |

**Do not mistake the existing verification machinery for coverage.**
`delegation-policy.md:38` ("never adopts a subagent return unverified") and
`verify-budget` guard **claim correctness** — is the finding true, is the
evidence real. Neither guards **injection**: a hidden-unicode payload inside a
`summary` field passes a cross-model judge untouched, because the judge is
checking whether the claim holds. Different failure class, different mitigation.

### The carrier the framing missed — `ai_team/team_dispatch.ts` (uncovered, in-repo)

Unlike the subagent boundary, this **is** an inter-agent channel implemented by
our own code, and it has no floor:

- Outbound it builds a repo-context bundle (`git status`, a size-capped diff,
  tracked-file list, `:190-216`) and sends it to a different agent via the
  `codex` CLI (`spawnSync`, `:30` / `:133`).
- Inbound it parses the reply and, on any parse failure, **preserves the model
  text verbatim** into the emitted envelope — `raw: text` (`:386`).
- `grep -a` over `src/scripts/ai_team/` and `src/scripts/ai_council/` finds
  **zero** sanitize calls (the sole hit, `review_gate.ts:434`, is an unrelated
  path-basename slug).

That is a `sanitize_text`-shaped surface in exactly the sense
`second_brain_retrieval.ts` is: our code receives external-model text and emits
it into the host agent's context. Recorded as its own row rather than folded
into the structurally-impossible subagent verdict.

### One partial, default-off mitigation

`injection_scan_hook.ts` is a **PostToolUse** scanner with no `tool_name` filter
(`_tool_output`, `:141`), so on a host where a spawn is a tool call a return
would pass a hidden-unicode detector (`_HIDDEN`, `:75`). Three hard limits: it is
**default-off** (`:21-22`), it **warns and never strips** (`:17-18`), and it
never blocks. A warner, not a floor. Whether a host `Task` result actually
reaches that envelope in an extractable shape is **un-probed** — there is no
Task-shaped fixture under `tests/`. Not counted as coverage.

## What this census does NOT establish

- The MCP **transport** was not exercised. The two MCP rows are decided by a
  source-read of a thin wrapper onto a callee that the probe did prove. If a
  future change inserts post-processing between the wrapper and the emitted
  tool result, these rows go stale and need a real MCP round-trip.
- Coverage is asserted for the **five probed codepoint classes only**. The
  visible layer beyond the single confusable tested (math-alphanumeric,
  full-width, punycode) is Phase 1's measurement, not this table's.
- The `[visible] survived` cells are the **documented design**, not a finding.
  Whether that design should change is Phase 1's normalise-vs-flag decision.
