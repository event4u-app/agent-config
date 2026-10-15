---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
depends:
  - road-to-one-detector-and-the-senders-we-own
estate_offset_exempt: "No active, parked or stub roadmap owns what a host carries from a session to a model provider. The archived owners of the neighbouring surfaces are closed — road-to-hooks-on-every-host (slot bindings, whose dated verified blocks this roadmap reads) and road-to-per-turn-hook-economy (payload shaping, whose planner this roadmap extends) — and reopening either would make its closed acceptance criteria read open. Nothing can be offset without retiring live work."
estate_growth_exempt: "Second of a two-roadmap set from one inbox round; grows active_roadmaps by one and open_blockers by three. All three blockers are decisions the plans themselves posed and no tree fact settles: whether to build a request gateway (owner, priced by host features it disables), how identifier values may rest between hook processes (council, a privacy-floor trade-off), and whether any class is replaced by default for consumers (owner, a consumer-facing default)."
relates:
  - slug: road-to-one-detector-and-the-senders-we-own
    relation: depends
    note: "Consumes its rule table, token grammar, contract and sender census; nothing here re-implements detection."
  - slug: road-to-hooks-on-every-host
    relation: disjoint
    note: "Archived. Its dated verified blocks in host_lowering.yaml are read before any non-claude row gains a rewrite axis; none is edited without its own probe."
  - slug: road-to-per-turn-hook-economy
    relation: extends
    note: "Archived. Its payload-shape planner (needs_payload_bodies) is the mechanism the two envelope views of 1.2 extend, instead of a second shaping pass."
---
# Road to placeholders on the wire

> **Source:** `agents/tmp.old/inbox-2026-10-g/` — the same round as
> `road-to-one-detector-and-the-senders-we-own`. Tree facts re-read at
> `main@d41121927` (v16.4.0) on 2026-10-11. Host behaviour below is quoted from
> host artefacts as read by the source plans on 2026-09-30 and is **not**
> re-verified here; Phase 0 exists because a host fact and this tree's probe
> differ.

## Context

**The unit is the channel, not the session.** On Claude Code a
`UserPromptSubmit` hook can refuse a prompt or add context beside it but cannot
replace it; a `PostToolUse` hook can replace a tool result; a `PreToolUse` hook
can replace a tool input. This tree has probed the last one: `updatedInput` is
offered at 2.1.241 (`docs/contracts/hook-architecture-v1.md:731-745`).

**This tree has decided it may not rewrite yet, and said why.** The dispatcher
builds only `additionalContext` and `permissionDecision` envelopes
(`src/scripts/hooks/host_semantics.ts:122-189`); `updatedToolOutput` occurs in no
file under `src/`. Rewrite composition is recorded as open — "two concerns
rewriting one input still has no answer" (`hook-architecture-v1.md:772-775`) —
and a test pins the absence: "nothing in the tree rewrites a tool result"
(`tests/scripts/tool_result_bytes_hook.test.ts:212`), with `delivered_bytes`
equal to `raw_bytes` by construction (`src/scripts/hooks/tool_result_bytes_hook.ts:204-208`).

**A refused or recorded prompt still reaches local stores.** The concern loop runs
every matching concern whatever an earlier one returned
(`src/scripts/hooks/dispatch_hook.ts:1297-1311`), and `src/scripts/chat_history.ts`
imports no scrubber (`:41-49`). A prompt gate built as a peer concern would leave
the refused text in chat history.

**A claim belongs to whoever owns the bytes.** A host hook that substitutes
content does not own what leaves — the host may drop a substitution in silence.
So this roadmap publishes `replaced` for hook channels, `gated` where content can
only be refused, and `asserted` only behind a request gateway this package runs.

**Host table.** `src/scripts/hooks/host_lowering.yaml` has no rewrite axis; eight
host rows carry `json_shape: none` and three carry `slots: {}`; the gemini
trampoline writes nothing to stdout by design (`src/scripts/hooks/gemini-dispatcher.sh`).
The hook-latency revisit trigger has fired (`src/config/hook-latency-budget.json:62`),
so every phase that touches the dispatcher states its bundle byte delta.

## Goal

On Claude Code at a probed version, a tool result carrying a listed value
reaches the model as a token from the grammar of
`road-to-one-detector-and-the-senders-we-own`, and the rate at which the host
dropped a substitution is published. A token in a tool input is restored,
asked about or denied according to its class and sink, and no unresolved,
forged or foreign token reaches a tool. A typed prompt carrying a credential is
refused with a redacted copy to resend, and no local store of this package holds
the raw value. A generated coverage table — channel × host × auth mode × launch
mode — states `asserted`, `replaced`, `gated` or `uncovered` per cell, and the
published claim is the measured result per class per state, a null included.

## Execution status — 2026-10-14, `main@90ed4e697`

A `/roadmap:process-full` pass built nothing and flipped no checkbox (D9).

- **Phase 1 waits on its `depends:` roadmap, which has not started.** No step of
  `road-to-one-detector-and-the-senders-we-own` is checked: its contract
  (`egress-placeholders-v1.md`, its 0.1), its rule table (2.1) and its token
  grammar (3.1) do not exist. 1.1's ADR is to cite that contract, 1.2's
  placeholder view writes tokens of that grammar, and 1.3 counts by that rule
  table's classes. The only detector in the tree, `src/scripts/_lib/secret_detector.ts`,
  covers the credential class and nothing of D5's identifier scope.
- **Not built, by council verdict:** a provisional token shape behind one
  constant, and a provisional identifier detector inside this roadmap. Persisted
  tokens would make a provisional grammar a supported contract before the
  sibling defines token scope, collision behaviour and resolution state.
- **Correction to 1.2 and 1.3 — observe does not mutate.** 1.3 says observe
  "replaces nothing"; 1.2 serves the placeholder view to every recording concern
  without naming a mode. Read together they leave open whether local stores
  receive tokens in `observe`. Both council seats answered no: `observe` detects
  and counts only; the placeholder view is served from `protect` upward. Early
  protection of local stores, if wanted, is a separately named control rather
  than a reading of `observe`. Consequence for `road-to-tool-results-that-leave-a-handle`:
  its 2.2 "stores the placeholder view", and that view exists only from `protect`.
- **Correction to 1.2 — the execution view is granted, not declared.** "A
  concern declares the view it needs" lets a misdeclared concern obtain resolved
  values. The dispatcher hands out the execution view only to concerns on a
  closed, centrally owned list (both seats), and the manifest lint checks the
  declaration against that list.
- **Unblock events:** the sibling's 0.1 contract states token identity, scope,
  lifecycle and the owner of resolution state (which overlaps the
  `identifier-table-at-rest` blocker below); its 2.1 rule table and 3.1 grammar
  constant exist. Then 1.1 through 1.4 run in order.
- **Preparation named and not taken:** `src/scripts/hooks/dispatch_hook.ts` is at
  1,500 lines, the line `check_source_size_budget` starts counting above, so the
  stage needs an extracted module rather than lines added there. No step owns
  that extraction, and another active roadmap edits the dispatcher, so it waits
  for 1.2 to own it. The hook bundle had 26,849 bytes below its ceiling at this
  reading (1,523,151 of 1,550,000).
- **Phase 0 does not depend on the sibling and was not taken in this pass**,
  which was scoped to Phase 1. Its two probes are the next executable work.

## What this roadmap deliberately does not do

| # | Not done | Why |
|---|---|---|
| K1 | Give any concern a rewrite. | One dispatcher stage is the only writer (1.1). That is the composition rule in its most restrictive form. |
| K2 | Emit `permissionDecision: allow` together with a restored input. | A restore never grants; `composePermissionDecision` already makes `ask` beat `allow` (`host_semantics.ts:164`). |
| K3 | Add a scrubber per local store. | Recording concerns receive an already-replaced envelope (1.2). |
| K4 | Restore any value into model-visible content, a response or a gateway stream. | One restore point, at `pre_tool_use`. It also keeps earlier turns byte-identical, which a host's preserved-thinking check requires. |
| K5 | Store a credential value anywhere. | A credential is re-derived from its origin file when an edit needs it. |
| K6 | Pretend to cover what nothing reaches. | Without a gateway: instruction files, compaction requests, `@file` mentions. With or without: images and other non-text parts. Each is an `uncovered` row. |
| K7 | Keep a second host-capability file. | `host_lowering.yaml` exists so host facts have a single reader. |
| K8 | Mark a host channel `asserted`. | A hook does not own the bytes that leave. |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Claude Code is the first host, not Gemini CLI | Claude is the only row with a native envelope (`json_shape: hook-specific-output`); Gemini's model hook reportedly sees text parts only and its trampoline emits nothing | a Gemini envelope lands and its probe shows whole-request coverage |
| D2 | reversible-technical | agent | The two envelope views extend the existing payload-shape planner rather than adding a pass | `dispatch_hook.ts:1285-1301` already builds per-concern shapes from `needs_payload_bodies` declarations (`src/scripts/hooks/payload_stub.ts`) | the planner cannot carry a third dimension without a measured cost |
| D3 | reversible-technical | agent | Prompt path on a host that cannot replace a prompt: refuse and print the redacted copy for re-submission | A one-step resend would be a second visible call | the host gains a prompt-replace field |
| D4 | reversible-technical | agent | An identifier restore into a call that is not a consequence-free local read, build or file write composes to `ask`, showing the restored input; on a host with no `ask`, deny | `src/scripts/hooks/category_a.ts` already classifies consequence-free calls | — |
| D5 | reversible-technical | agent | Identifier scope: IBAN, payment card, e-mail outside the allowlist, phone with country code or context word, German tax ID with context; names and customers only from configured lists | The validated set of the sibling's 2.3; free-text names need a recogniser declared out of scope | the paired comparison shows a class costs more than it protects |
| D6 | contested-technical | council:identifier-table-at-rest | How identifier values rest between hook processes | blocker `identifier-table-at-rest` | — |
| D7 | product-owned | owner | Whether to build the request gateway | blocker `request-gateway-build` | — |
| D8 | product-owned | owner | Whether any class is replaced by default for consumers | blocker `default-mode-for-consumers` | — |
| D9 | reversible-technical | council:placeholders-phase1-scope-2026-10-14 (2/2 present, anthropic/claude-sonnet-4-5 and openai/codex-default) | Phase 1 is not built before its dependency; `observe` never mutates a view; the execution view comes from a closed dispatcher-owned list. Rejected: building the detector-independent half with a provisional token constant and credential-only counting (a persisted provisional grammar becomes a contract; credential-only counts give no identifier evidence); building a provisional detector and grammar here (duplicates the sibling's ownership). One seat would have landed 1.4's settings block now and the other would not; it was not taken, because the per-mode behaviour matrix it names is still unspecified | no step of `road-to-one-detector-and-the-senders-we-own` is checked on `main@90ed4e697` | the sibling's 0.1, 2.1 and 3.1 land, or the sibling is re-scoped so this roadmap owns the grammar |

## Phase 0 — Probes against the running host (no product code)

- [ ] **0.1 Probe tool-output replacement, pinned to a host version.** For
      `Read`, `Bash`, `Grep` and one MCP tool record: the `tool_response` shape;
      that a shape-preserving replacement is what the model then quotes; that a
      mismatched replacement is silently dropped; what the on-disk transcript
      holds afterwards; what happens to an output large enough to be spilled to a
      file; that a subagent's tool calls arrive with the parent's `session_id`;
      whether host telemetry captures the original output.
      verify: `agents/evidence/analysis/host-output-rewrite-probe-<date>.md` names the host version and answers each item `observed` or `not-observable`, never with a citation.
- [ ] **0.2 Probe tool-input replacement.** `updatedInput` alone, with the
      permission flow still running; with `ask`, the restored input visible;
      whether the `tool_use` block resent next turn carries the model's original
      or the replaced input; whether any hook fires for an `@file` mention; and
      whether a timed-out `UserPromptSubmit` hook lets the prompt through.
      verify: same file; the `@file` and timeout answers seed the coverage table of 6.3.

## Phase 1 — The dispatcher gains one stage, in observe mode

- [x] **1.1 Decide composition by removing the question.** One ADR, citing the
      sibling's contract: a rewrite is produced by a single dispatcher stage
      that runs before the concern loop and at emission; no concern may produce
      one; a block outranks it; an `ask` or `deny` outranks an `allow`,
      unchanged. The ADR answers the council's two objections of 2026-08-23 by
      name — no composition rule, and a hook that silently changes what runs —
      and records what would reopen it.
      verify: `npx vitest run tests/scripts/lint_hook_manifest.test.ts -t rewrite-concern-refused --reporter=verbose` -> /✓.*rewrite-concern-refused/
      — and `hook-architecture-v1.md` no longer calls the rewrite half open.
- [x] **1.2 Two views of one envelope, built by the payload-shape planner (D2).**
      The **placeholder view** — values replaced in the prompt, `tool_input` and
      `tool_response` — is what every recording and advisory concern receives,
      so local stores inherit tokens without a scrubber. The **execution view**
      resolves only the tokens the pending call needs, built just in time, and
      goes only to concerns that decide whether a call may run. A concern
      declares the view it needs; the default is the placeholder view.
      verify: with chat history enabled, a prompt carrying a credential is persisted as a token; a blocking guard's fixture sees the restored command; a recording concern's fixture on the same event does not.
- [ ] **1.3 Observe first.** The stage counts what it would replace — class,
      type, slot, tool — and replaces nothing. The record is a fixed-field schema
      that cannot hold a value, the construction `tool_result_bytes_hook.ts`
      already uses. `hooks:replay` shows what the stage would do on a fixture.
      verify: one release of readings from this repository's own sessions exists, and the arming step 3.1 cites them.
- [ ] **1.4 Govern the stage like a concern** — an admission row answering the
      five questions of `src/scripts/hook_manifest.yaml`'s header, a kill-switch
      row, and the `egress.placeholders` settings block with modes `off`,
      `observe`, `protect`, `strict`. A thrown kill switch changes every affected
      channel's published state to `uncovered`, never a stale `replaced`. If the
      admission gate cannot represent a non-concern id, the gate is extended; the
      stage is not exempted.
      verify: the kill-switch count still equals its grep count; the bundle delta of this phase is stated in the PR and in `src/config/hook-latency-budget.json`.

## Phase 2 — The session table and continuity

- [ ] <!-- blocked-by: identifier-table-at-rest | asked: no — routed to the AI council, not the owner; no council run was taken during authoring --> **2.1 The session table, in the shape blocker `identifier-table-at-rest`
      selects.** Under either option: outside the workspace, one per session,
      removed by age; for a credential it holds fingerprint, type, number and the
      file it was first read from — never the value (K5); reads of its path by
      the agent are refused by the sibling's prevention guard.
      verify: a tool call that reads the table path is denied; the serialised table contains no credential fixture value; a table older than the retention age is gone after the next `session_start`.
- [ ] **2.2 Continuity never resolves a token to the wrong value.** Text carried
      into a new session — handoff, memory recall, a resumed session — is
      re-issued at injection: restored through the predecessor's table while it
      exists, then replaced under the current key; a token whose table is gone
      becomes an explicitly dead form.
      verify: two sessions each hold a different IBAN as entity 1; a handoff from the first to the second never restores the second's value for the first's token; a resumed session resolves its own tokens and no other session's.

## Phase 3 — Tool results carry placeholders (Claude Code → `replaced`)

- [ ] **3.1 Emit `updatedToolOutput`** when the stage replaced anything and the
      reduced severity is not a block: the original object with string leaves
      changed and nothing else. Armed only in `protect` or `strict`, and only
      after the 1.3 readings.
      verify: for each tool shape probed in 0.1, keys and types of the emitted value equal those of the input.
- [ ] **3.2 Pay the debt the byte counter recorded.** The test pinning "nothing in
      the tree rewrites a tool result" goes red by design; its premise becomes
      "exactly one module emits the field", and `delivered_bytes` is taken from
      the stage's output.
      verify: `tests/scripts/tool_result_bytes_hook.test.ts` asserts the single writer; a replaced result records `delivered_bytes` different from `raw_bytes`.
- [ ] **3.3 Refuse to trust the host's silence.** Before emitting, the stage checks
      its output against the input shape and rescans it for table values and known
      values. On a mismatch, a residual hit, a deadline breach or an internal error
      it emits no rewrite, raises the host's visible message and counts the event.
      A dropped replacement is a leak and is reported as one.
      verify: a forced shape mismatch produces the message and the counter, and the counter is what AC-1 reads.
- [ ] **3.4 Tell the model once what a token is** — one line of context at first
      use in a session. Whether it helps is part of the sibling's 0.3 measurement;
      if it does not, it is removed.
      verify: the fidelity reading with and without the line is in the published report.

## Phase 4 — Values come back in one place

- [ ] **4.1 Emit `updatedInput`** with identifier tokens restored, for file
      writes and edits and for calls `category_a.ts` ranks consequence-free. An
      input bound for another model context — a subagent prompt — is never
      restored.
      verify: an `Edit` whose `old_string` holds a token applies against the real file and the file never contains a token; a subagent prompt leaves the tool with the token intact.
- [ ] **4.2 A credential token restores into one place only: the file it was read
      from,** with the value taken from that file at restore time by matching the
      fingerprint, never from the table. Into a command, another file or any
      network sink it is denied, naming the alternative (reference the variable).
      verify: an edit spanning a credential line in its origin file applies; the same token toward an external host is denied and the denial names no value; after the origin file is rotated the token no longer resolves.
- [ ] **4.3 Every other restore asks** (D4).
      verify: a fixture per sink class; an `allow` never accompanies a restore, asserted in `emitFor`'s test.
- [ ] **4.4 Nothing unresolved runs.** A tool input still containing the grammar
      after the stage — unknown number, wrong fingerprint, mangled token — is
      denied. One tolerant match on number and fingerprint is attempted; what it
      cannot resolve it does not guess.
      verify: a token with altered spacing resolves; a token with an unknown number is denied; neither reaches a shell.
- [ ] **4.5 An audit line per restore, without the value** — session, class,
      type, number, tool, sink class, decision — and a per-session rate bound that
      turns a burst into an `ask`.
      verify: the audit schema has no free-text field; a burst fixture composes to `ask`.

## Phase 5 — The prompt is gated, and the rule says what is true

- [ ] **5.1 Refuse a prompt carrying the credential class** (D3), suppress the
      original text from the block message, and print the redacted copy. The
      identifier class follows the mode. The stage's own deadline sits well inside
      the host's, because a host timeout lets the prompt through.
      verify: a Claude Code fixture refuses and prints the copy; on a host that cannot refuse, the fixture asserts a warn and the coverage table says `uncovered`.
- [ ] **5.2 State the residue in the refusal itself:** the text was typed into the
      host and may sit in its local transcript and history; rotate a credential
      that was typed. Types and counts, never a value.
      verify: the message is asserted verbatim.
- [ ] **5.3 Correct `domain-safety-pii`.** Surface 1 becomes two statements: the
      input side is held by the stage where a host allows it (`enforced_by` names
      it), the output side stays the model's duty.
      verify: `src/rules/domain-safety-pii.md` carries `enforced_by` and the rule linters are green.

## Phase 6 — Host tiers, the coverage table, the claim

- [ ] **6.1 A rewrite axis in `host_lowering.yaml`** per slot — `output`, `input`,
      `prompt`, each `replace`, `gate` or `none` — dated like every other column.
      verify: `npx vitest run tests/scripts/lint_hook_manifest.test.ts -t rewrite-toward-non-replace-host-refused --reporter=verbose` -> /✓.*rewrite-toward-non-replace-host-refused/
- [ ] **6.2 Bind the next host by evidence, one at a time.** Copilot CLI's
      transformed-prompt field is bound only after a command-hook probe; Gemini
      CLI only after its envelope exists. A host that can gate and not replace
      runs in gate mode and never issues a reversible token, because a token that
      cannot be restored before execution would land in a file.
      verify: no row changes without its probe file; on a gate-only row the stage never issues a token into model context.
- [ ] **6.3 Generate the coverage table** — channel × host × auth mode × launch
      mode × state — from the lowering table, the sibling's sender census and the
      probes, with a column for host telemetry settings that would export prompts
      or request bodies (an egress path no hook closes). Link it from the contract,
      the threat model and the refusal message, and print it through
      `hooks:status`.
      verify: a channel absent from the generator's input appears as an `unclassified` row, the way `docs/contracts/retrieval-read-surfaces.md` already does it; one working auth mode never greens another mode's row.
- [ ] **6.4 Record the claim or the null.** A `docs/CLAIMS.md` entry per class
      and state with measured recall and precision, the dropped-replacement rate,
      the implicit-identity residue and the paired task-quality verdict. The
      README states pseudonymisation of listed value types on listed channels and
      nothing wider.
      verify: the claims gate is green and no shipped prose about this feature calls it anonymisation.
- [ ] <!-- blocked-by: default-mode-for-consumers | asked: no — put to the owner in the run report of round inbox-2026-10-g on 2026-10-11, not yet answered --> **6.5 Apply the default the owner chose** (blocker `default-mode-for-consumers`).
      Until it resolves, `egress.placeholders.mode` ships `off` for consumers.
      verify: the settings template carries the resolved default and the blocker records the answer.

## Phase 7 — A request gateway for what no hook reaches (blocker `request-gateway-build`)

On Claude Code nothing but the request itself carries the typed prompt, an
`@file` mention, an instruction file or a compaction request in a form this
package can rewrite. Steps 7.1 and 7.2 are what the blocker is answered with;
7.3 onward wait for it.

- [ ] **7.1 Classify it before building it.** A loopback listener is not Class A
      ("no listening socket", `docs/contracts/runtime-component-classes.md:16`). It
      is Class B in the shape already carried for the UI server — "human-started,
      session-bounded, loopback only" (`:56`) — with one difference written down:
      it carries model traffic. Its inventory row names who starts it (the
      launching command), what it writes (the session table and nothing else) and
      how it stops (with its child).
      verify: the inventory row exists before any gateway code and cites neither "no daemon" nor an unattended-process ADR as its basis.
- [ ] **7.2 Probe before building**, against the pinned host: a subscription
      login through a loopback base URL with the OAuth capability forwarded; which
      host features turn off behind a non-first-party base URL; twenty turns with
      thinking enabled under deterministic rewriting, watching for a
      preserved-thinking rejection; behaviour when `count_tokens` is absent; and
      each other auth mode (API key, cloud-provider modes) that can or cannot be
      routed locally.
      verify: a probe file in the shape of 0.1; the blocker is answered with it in hand.
- [ ] <!-- blocked-by: request-gateway-build | asked: no — put to the owner in the run report of round inbox-2026-10-g on 2026-10-11, not yet answered --> **7.3 Rewrite the request field by field, deterministically.** Replaced:
      `system` text, message text blocks, `tool_result` content, string values of
      historical `tool_use` inputs. Never touched: `thinking` and
      `redacted_thinking` blocks, tool definitions, cache markers, protocol
      fields. A finding in a field that may not be rewritten refuses the request.
      The same input yields the same bytes on every resend.
      verify: over a recorded multi-turn fixture with a thinking block — equal output on resend, stable earlier messages, untouched thinking.
- [ ] <!-- blocked-by: request-gateway-build | asked: no — put to the owner in the run report of round inbox-2026-10-g on 2026-10-11, not yet answered --> **7.4 Responses pass through untouched** (K4). No stream is rewritten, so no
      token can be split across chunks.
      verify: response bytes in equal response bytes out on a streaming fixture.
- [ ] <!-- blocked-by: request-gateway-build | asked: no — put to the owner in the run report of round inbox-2026-10-g on 2026-10-11, not yet answered --> **7.5 The final check owns the claim, and the route list is closed.**
      Immediately before bytes leave, the body is rescanned for table values and
      high-confidence findings; a hit refuses the request. Admitted routes live in
      one registry with a request fixture each; an unknown route with a body is
      refused; `count_tokens` is not exposed; adding a route without a fixture
      fails CI. In `strict`, a body the adapter cannot parse — compressed,
      malformed, non-UTF-8, an unknown content type, a non-text part carrying a
      finding — is refused, never passed through raw.
      verify: the sibling's canary run against the gateway is refused; a fixture per admitted route; a fixture route added without classification turns the drift gate red; a negative fixture per unparseable body class is refused in `strict`.
- [ ] <!-- blocked-by: request-gateway-build | asked: no — put to the owner in the run report of round inbox-2026-10-g on 2026-10-11, not yet answered --> **7.6 Launch as the parent of the host, for the life of the host.** Loopback
      only, a random port, a per-launch path credential, reusing
      `src/server/port.ts` and `src/server/token.ts`. The child's environment is
      checked before launch: a `NO_PROXY` entry or provider setting that would
      bypass the gateway refuses the launch, and host telemetry that exports
      prompts or request bodies is switched off for the child or the session is
      published as excluding that path. A startup self-test sends a canary to a
      local fake upstream. One new CLI entry, with its registry budget move in
      the same change.
      verify: the process is gone when the child exits; a second process without the path credential is refused; a bypassing `NO_PROXY` refuses the launch; the canary reaches the fake upstream only as a token.
- [ ] <!-- blocked-by: request-gateway-build | asked: no — put to the owner in the run report of round inbox-2026-10-g on 2026-10-11, not yet answered --> **7.7 Flip only what it covers.** Prompt, `@file` and instruction-file rows
      become `asserted` for sessions launched through the gateway and stay as they
      were for every other launch mode, with the host features that are off behind
      it stated.
      verify: the coverage table carries launch mode as a column and both values appear.

## Blockers

### blocker: identifier-table-at-rest
- **Status:** open
- **Owner:** AI council
- **Blocks:** step 2.1, and through it Phases 3–4.
- **What to do:** pick exactly one — (a) identifier values rest in a 0600 file
  outside the workspace, one per session, removed by age, credentials never
  stored (the consolidated plan's choice); or (b) no value of any class rests
  anywhere: the table holds a per-session key plus fingerprint, type, number and
  origin path, every restore re-derives the value from its origin object by
  fingerprint, and an identifier bound for any sink other than its origin is
  asked about with the value shown to the human, never auto-restored (own
  analysis, extending the plans' credential rule to identifiers; one generation
  proposed memory-only storage, which the one-process-per-event dispatcher —
  `docs/contracts/runtime-component-classes.md:39` — cannot hold without a
  resident broker).
- **Resolved when:** this section records the council verdict and step 2.1 names
  the chosen option.
- **Recommendation:** (b) — it removes the one file that would concentrate every
  detected identifier, and the edit case that motivated a value store is already
  served by origin re-derivation; its cost is that copying an identifier into a
  new file asks instead of happening.
- **If you do nothing:** Phases 3–4 cannot start; tool results stay unreplaced
  and every hook channel stays `uncovered` while the sibling's `asserted`
  channels keep working.

### blocker: request-gateway-build
- **Status:** open
- **Owner:** maintainer
- **Blocks:** steps 7.3–7.7.
- **What to do:** pick exactly one — (a) build the gateway, decided with the 7.2
  probe and the Phase 3 dropped-replacement reading in hand; or (b) do not build
  it, and the typed prompt, `@file` mentions and instruction files on Claude Code
  stay `gated` or `uncovered` permanently.
- **Resolved when:** this section records the answer and the date, with the 7.2
  probe file linked.
- **Recommendation:** (a), conditional on 7.2 — it is the only way to cover the
  typed prompt the owner's goal names; its price is set by the host (features off
  behind a non-first-party base URL, sessions not launched through it not
  covered) and is stated in the table rather than hidden.
- **If you do nothing:** Phase 7 stops after 7.2; the coverage table keeps those
  rows `gated` or `uncovered`, which is honest and incomplete.

### blocker: default-mode-for-consumers
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 6.5.
- **What to do:** pick exactly one — (a) once 6.4 publishes a result meeting the
  pre-registered bars, consumers default to `protect` for the credential class
  with the identifier class opt-in; or (b) every class stays opt-in for
  consumers regardless of the result.
- **Resolved when:** this section records the answer and the settings template
  carries the matching default.
- **Recommendation:** (a) — the credential class has no utility cost a coding task
  depends on, and the bar gates it; the identifier class stays opt-in until the
  paired comparison says otherwise.
- **If you do nothing:** the feature ships `off`; only a project that sets the
  key gets any replacement.

## Declined — read in the source set, not carried

- Request shapes other than the Messages shape in the gateway — added when a host
  that needs one is bound, not before.
- An optional local recogniser for names and addresses — out of core; as a pack it
  would need its own measurement first.
- Organisation identifier packs beyond the lists the redactor already accepts.
- Image, PDF, audio and non-generation endpoints (embeddings, files) — rows stay
  `uncovered`.
- Streaming-safe response restoration and on-screen restore — K4; display
  convenience is not confidentiality.
- New `model_egress` / `model_ingress` dispatcher events — only needed when a host
  with a model hook is bound (6.2).
- Dedicated `privacy:*` CLI entries other than the gateway launcher — the
  `hooks:*` entries cover status, diagnosis and replay.
- The gateway as an early phase — it needs the session table, the single restore
  point and a measured hook tier to be compared against, and its price is set by
  the host; it stays last and owner-gated.
- A ten-class entity taxonomy and a five-level protection scale — two classes
  with per-type rules and four published states carry the same distinctions with
  fewer names; a type keeps its own label inside its class.
- IP-address and internal-hostname detection — outside the identifier scope of D5;
  internal hostnames enter through the configured private-domain list.
- Separate "no restore" for payment cards — a card is an identifier and follows D4:
  restored only into consequence-free local sinks, asked about everywhere else.
- Base-URL wrapper integrations for further hosts — each waits for its host row's
  probe under 6.2.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A token resolves to the wrong value | implementation | A token from another session, a forged one or a merged spelling restores a different value into a file | Keyed fingerprint and spelling variants from the sibling; re-issue at continuity (2.2); unresolved is denied, never guessed (4.4) | Phase 4 — Values come back in one place |
| 2 | The host drops a replacement silently | implementation | A shape mismatch or timeout shows the model the original | Self-check, residual rescan and visible message (3.3); the channel stays `replaced` with its drop rate, never `asserted` | Phase 3 — Tool results carry placeholders (Claude Code → `replaced`) |
| 3 | The restore path is used to exfiltrate | product | An injected instruction asks for a token to be sent outward | Credential tokens restore into their origin file only (4.2); everything else asks (4.3); audit and rate bound (4.5) | Phase 4 — Values come back in one place |
| 4 | The feature is read as a compliance guarantee | product | Names, addresses and context re-identification are untouched | Four published states, the implicit-identity residue in the claim, no anonymisation wording (6.4) | Phase 6 — Host tiers, the coverage table, the claim |
| 5 | The gateway is bypassed or costs more than it covers | product | A direct upstream path or `NO_PROXY` skips it; host features are off behind it | Launch-time environment check and startup canary (7.6); price stated per launch mode (7.7); the owner decides with 7.2 in hand | Phase 7 — A request gateway for what no hook reaches (blocker `request-gateway-build`) |
| 6 | The stage grows a hook bundle whose latency trigger already fired | implementation | Every slot pays for the stage | No dependency; byte delta per phase (1.4); observe before arming (1.3) | Phase 1 — The dispatcher gains one stage, in observe mode |

## Acceptance Criteria

- [ ] AC-1 — On Claude Code at the probed version, a tool result containing a
      listed value reaches the model as a token, and the dropped-replacement count
      over the observation window is published.
- [ ] AC-2 — A token in a tool input is restored, asked about or denied according
      to class and sink; no unresolved, forged or foreign token reaches a tool.
- [ ] AC-3 — A prompt carrying a credential is refused with the original text
      suppressed, and no local store of this package holds the raw value.
- [ ] AC-4 — No serialised session state holds a credential value, and no
      identifier value rests in the form the council rejected.
- [ ] AC-5 — The coverage table is generated with four states per channel, host,
      auth mode and launch mode; no hook channel is `asserted`; every channel of
      K6 appears; host telemetry export is a row, not an omission.
- [ ] AC-6 — `docs/CLAIMS.md` carries the per-class, per-state result measured
      against the sibling's pre-registered bars, whatever that result is.
- [ ] AC-7 — If Phase 7 is built: earlier messages and thinking blocks are
      byte-stable across resends on the pinned host, `count_tokens` is not
      exposed, an unclassified route fails CI, and gateway-launched sessions are
      separated from all others in the table.
