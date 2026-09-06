---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "The MCP bridge is the one installed surface with an unpinned dependency resolution (`npx -y` fetches `latest` at every server start) and no update-repair path, and no active roadmap covers it — the estate holds one carrier and zero active roadmaps at 93d63073e."
estate_offset_exempt: "Offsets nothing: every adjacent MCP roadmap is already archived at `measured-null` or parked in `later/`, so there is no active file whose retirement this could be exchanged against."
---
# Road to MCP bridge integrity and reach truth

> **Source:** `agents/tmp.old/inbox-2026-09-k/` — verified against the tree at 93d63073e on 2026-09-05.

## Goal

The MCP bridge this package installs should resolve a pinned version rather than whatever `latest` happens to be at server start, should repair its own registration when the bridge shape changes under an update, should be documented in terms of the command the installer actually writes, should serve resources with the annotations the protocol defines, should record per host what MCP actually reaches and what consent residual remains, and should emit enough telemetry through the existing collector that the question "is the lite surface used at all" has an answer instead of an assumption. Someone else can tell whether this happened by reading `MCP_BRIDGE_ENTRY` for a version specifier, running the doc-drift check, reading `CAPABILITY_FIELDS` for the MCP axis, and querying the collector for `tools/call` rows.

Work this roadmap does **not** contain, because verification showed it already done or already owned: the resources for rules, guidelines and contexts already exist and are already served (`docs/mcp-server.md:33-35`), so no new channel is built for them; the trigger matcher is already a single pinned implementation (`router_match.ts:1-19`, `router_match_parity.test.ts`), so no second matcher is written; `explain route` and `route:explain` already exist (`registry.ts:60`, `:93`), so no new explain verb is added; the activation IR already exists as `router.json` plus `triggers:` on 104 of 120 rules, so no parallel taxonomy is created; the delivery-path parity measurement is already pre-registered as `claim:delivery-path-parity` in `docs/CLAIMS.md` with its epsilon fixed, so no duplicate parity gate is defined; and SEP-2640 interop is already carried by `agents/roadmaps/stubs/road-to-sep-2640-skill-resources.md`. Four further items are blocked rather than built — see Blockers.

## Phase 1 — Pin the bridge and repair it on update

- [ ] **1.1 Pin the version in the MCP server entry.** `MCP_BRIDGE_ENTRY.args` is `['-y', '@event4u/agent-config', 'mcp-server']`, so every server start resolves the dist-tag `latest` from the network. Read the version from the package manifest at install time and emit `@event4u/agent-config@<version>`, so the server a consumer runs is the one the installer approved. Neither parent artefact caught this; it is the one finding in the round with no prior owner.
      verify: `grep -n "args:" src/scripts/_lib/mcp_bridge.ts` shows a version specifier, and a unit test asserts the emitted entry's package spec equals the manifest version.
- [ ] **1.2 Repair the registration on update.** `mcp_bridge.ts` exports only `makeEnsureMcpBridge`; its header describes install and uninstall and there is no path that compares a recorded entry against the current bridge shape. Add a migrate step that reads the lockfile's recorded pointer, compares it against the current `MCP_BRIDGE_ENTRY`, and rewrites only keys this package owns — a stale pin from 1.1 is otherwise frozen at the version of the install that wrote it.
      verify: a test that writes an old-shape `.mcp.json`, runs the update path, and asserts the AC key changed while a hand-added neighbour server key is byte-identical.

## Phase 2 — Make the MCP truth surfaces match the tree

- [ ] **2.1 Replace the absolute `tsx` paths in the setup docs.** `docs/mcp-server.md:86`, `:105`, `:122` and `:138` document `"command": "/absolute/path/to/agent-config/node_modules/.bin/tsx"`, while the installer writes an `npx` invocation. A consumer following the docs and a consumer running the installer land on two different entries.
      verify: `grep -c '/absolute/path/to/agent-config' docs/mcp-server.md` returns 0.
- [ ] **2.2 Gate the drift.** Add a check that compares the command and args in the documented snippets against `MCP_BRIDGE_ENTRY`, so 2.1 cannot silently rot back. This compares two literals in the tree and asserts nothing about host behaviour.
      verify: the check fails on a branch that edits `MCP_BRIDGE_ENTRY` without the doc, and passes on the tree with both edited.
- [ ] **2.3 Serve the protocol's standard resource annotations.** `to_mcp_resource_meta` emits `_meta: { source, kind }` and nothing else (`src/scripts/mcp_server/resources.ts:266`). Emit `audience`, `priority` derived from the existing `tier`, and `lastModified`. This is protocol conformance with no effect claim attached — no shipped host is known to consume `priority` for selection, and this step must not be cited as evidence that one does.
      verify: a unit test asserts the three annotation fields are present with the derived values, and no CLAIMS entry is added.

## Phase 3 — Record what MCP actually reaches, per host

- [ ] **3.1 Add the MCP axis to the host capability manifest.** `CAPABILITY_FIELDS` (`src/scripts/_lib/host_capability.ts:283-290`) holds six fields and none of them is about MCP, so no code can currently answer "does this host read a project MCP config" without guessing. Add the fields under the manifest's existing per-field source discipline, where an unanswered field reads as "nobody answered" rather than as "checked and absent".
      verify: `grep -i mcp src/scripts/_lib/host_capability.ts` returns the new fields, and the existing sources snapshot test fails when a field is added without a source.
- [ ] **3.2 Record and report the consent residual.** Carry per host what remains non-automatic after installation, and have the installer's closing report name exactly those residuals and nothing else — a checklist of things that did work is noise, a named residual is actionable. Start values come from vendor documentation and are marked as such; an observed value replaces one only after a session records it.
      verify: `agent-config doctor --check` surfaces the residual per host, and a host with no observed value prints its source as vendor-doc rather than as fact.
- [ ] **3.3 Register the MCP server on the hosts whose config file the installer already writes.** `mcpServers` appears zero times in `src/scripts/install.ts`; the entry reaches only `claude-code` via `ensure_mcp_bridge` at `:5151`, while `ensure_cursor_bridge` (`:1153`) and `ensure_gemini_bridge` (`:1417`) write the same consumers' config files for hooks alone. Add the MCP entry for each host the 3.1 axis records as reading one, under the existing `--tools` gate.
      verify: an install into a scratch project with a given `--tools` set produces an MCP entry in each such host's config, and none in a host the axis marks as not reading one.

## Phase 4 — Answer whether the lite surface is used

- [ ] **4.1 Emit one collector row per `tools/call`.** `grep -rn 'telemetry\|collector\|journal\|record' src/cli/mcp/*.ts` is empty, so the two lite tools are invisible and every statement about their uptake is currently an assumption. Route one row — tool name, result class, host — through the collector that already backs `telemetry:record`, with no second sink and no new consent gate.
      verify: a dispatch test asserts exactly one row per call and zero rows when telemetry is off.
- [ ] **4.2 Surface the reading in the telemetry report.** Add an MCP-lite section reporting call counts per tool and per host. Publish whatever it says, including nothing — a null here is a result, and the adjacent archived roadmaps in this family closed at `measured-null` precisely because nulls were published rather than buried.
      verify: `agent-config telemetry:report` renders the section, and renders it with an explicit zero on a machine with no calls recorded.

## Blockers

### blocker: mcp-user-scope-approval-consent

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — the write blurs a security-consent boundary on a file shared by every project on the machine, and the artefact itself names that boundary as the thing not to blur.
- **If you do nothing:** consumers keep seeing the interactive per-project MCP-server approval prompt on `init` — today's friction continues, but no consent boundary is touched.
- **What to do:**
  1. Decide whether adding `enabledMcpjsonServers: ["agent-config"]` to the managed block of the user-global host settings file is authorised, given the key applies to every project on the machine, not only this one.
  2. Record the decision. If authorised, implement the write with `enableAllProjectMcpServers` left untouched and add a check that an existing `disabledMcpjsonServers` entry on any layer suppresses the write entirely; if rejected, record that so a future round does not re-litigate it without new evidence.
- **Resolved when:** the owner records either an authorisation (with the untouched-key and `disabledMcpjsonServers` safeguards in place) or a rejection of the write.

The round's headline lever is adding `enabledMcpjsonServers: ["agent-config"]` to the managed block in the user-global host settings file, which would let the project-scoped server start without the interactive approval. The tree confirms the gap is real — `enabledMcpjsonServers` and `enableAllProjectMcpServers` are both grep-null across `src/scripts/install.ts`. The artefact argues the write is the same act as the user running the host's own user-scope add command, triggered by the user who ran `init`. That may be right, and it is not a call this roadmap may make: the key carries a consent semantics on a file shared with every project on the machine, and the boundary between "zero configuration" and "zero security consent" is exactly what the artefact itself names as the thing not to blur. Resolution requires the owner to authorise the write, or to reject it. Whatever is decided, `enableAllProjectMcpServers` stays untouched and an existing `disabledMcpjsonServers` entry on any layer must suppress the write entirely.

### blocker: mcp-runtime-resolver-reopen

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** route the reopen to the AI council with the mechanism distinction stated explicitly (a pull-only tool a host may call versus the push-time resolver ADR-054 rejected) before writing any wrapper — a narrower scope is not grounds to bypass the council path a recorded decision already requires.
- **If you do nothing:** the trigger matcher stays unreachable through any MCP tool path; the rest of this roadmap's MCP-truth work proceeds without it, and ADR-054's rejection stands unchallenged.
- **What to do:**
  1. Route the reopen to the AI council, stating explicitly the mechanism distinction between a pull-only read tool and the push-time resolver ADR-054 rejected, and cite the 0-of-67 candidate-failure null from `road-to-activation-evidence-or-refusal` as the standing evidence the reopen must address.
  2. On council convergence to reopen, implement the thin read-only wrapper over `match_prompt`; on a non-reopen verdict, record that ADR-054 stands.
- **Resolved when:** the AI council records a convergence verdict (reopen or confirm) on the mechanism-match question, filed per the council's own output-path convention.

Both parent artefacts converge on exposing the trigger matcher through an MCP tool, and the consolidated draft narrows it to a thin read-only wrapper over the existing `match_prompt` rather than a second matcher. The narrowing is real and the gap it names is verified — the matcher is reachable through no consumer MCP path. It nevertheless meets a recorded decision head-on: `ADR-054` is `status: rejected`, `docs/contracts/rule-router.md:212` states there is no runtime resolver, and `agents/roadmaps/archive/road-to-activation-evidence-or-refusal.md` closed that question on 2026-08-02 with 0 of 67 candidate failures confirmed against a required 5. The recorded qualifier is that the refusal is "as designed, never permanently", and what it closes is the path from a restated complaint to a built resolver — which is precisely the shape this round arrives in. Under the decision-revisit gate this is a mechanism-match question the council decides before any wrapper is written, not one this roadmap settles by building the smaller version.

Corrected step, carried from the reproduction: route the reopen to the council with the mechanism distinction stated explicitly — a pull-only tool a host may call versus the push-time resolver ADR-054 rejected — and with the 0/67 null as the standing evidence the reopen must address.

### blocker: mcp-instructions-index-preregistration

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** pre-register the evaluation (corpus, arms, effect floor, published-null branch) and obtain approval before raising the cap — three prior measurements in this family returned null, and building the index unevaluated would repeat that pattern.
- **If you do nothing:** the `instructions` cap stays at 400 bytes and no generated family index is built — the fourth unevaluated entry in a null-measured family is not added, which is the safe default.
- **What to do:**
  1. Draft the pre-registration — corpus, arms (with/without index), effect floor, and the published-null branch — mirroring the two adjacent `measured-null` roadmaps in this family.
  2. Obtain approval for that registration; only once approved, raise the cap and implement the generated index.
- **Resolved when:** the pre-registered evaluation is approved and recorded, or the owner declines to pursue this fourth measurement and records that instead.

The server `instructions` string is capped at 400 bytes (`src/cli/mcp/dispatch.ts:173`) against a larger host budget, and the artefact proposes raising the cap and filling it with a generated family index plus rule pointers. The cap figure is verified and the headroom is real. What is also verified is that this is the fourth entry in a family whose prior three measurements returned nothing: the reminder-injection apparatus measured a zero-point difference on both host tiers with a pre-committed teardown that was executed, and two adjacent roadmaps in this family closed at `measured-null`. Building the index before its evaluation is pre-registered would repeat the pattern the family's own record warns about.

Corrected step, carried from the reproduction: pre-register the evaluation — corpus, arms, effect floor, and the published-null branch — and obtain approval for that registration before any byte of the cap is raised.

### blocker: mcp-prompt-emission-scope

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** wait for Phase 4's telemetry reading (step 4.2) before deciding whether to suppress the prompt catalogue on hosts that already carry a file listing — suppressing now would remove a surface consumers may be using, with no evidence either way.
- **If you do nothing:** the prompt catalogue keeps duplicating the host's own skill listing on every such host indefinitely; the decision is simply deferred, not actively harmed by the delay.
- **What to do:**
  1. Read Phase 4's published reading: `agent-config telemetry:status --json` for the per-host `tools/call` rows, and the emission site at `src/cli/mcp/dispatch.ts`.
  2. Pick one of three options and record it in `docs/decisions/`: (a) keep the prompt catalogue on every host, (b) suppress it only on hosts whose capability row already reports a native file listing, (c) drop it entirely and serve the listing through resources alone.
- **Resolved when:** an ADR under `docs/decisions/` names one of options (a), (b) or (c) and cites the Phase 4 reading it rests on.

The server emits a large prompt catalogue (`docs/mcp-server.md:31-32`, `:42-44`) beside the host's own skill listing, which the artefact reads as a duplicated menu and proposes suppressing on hosts that already carry a file listing. The duplication is real. Suppressing it removes a surface consumers may be using, with no telemetry today that could say whether they are — which is what Phase 4 exists to produce. The decision belongs to the owner and should wait for a reading from 4.2 rather than precede it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Pinned version freezes on old installs | implementation | 1.1 pins the spec at install time, so a consumer who never updates keeps running an old server against a newer package. | 1.2 is the paired repair path and rotates the pin on update; the two steps ship together or neither does. | Phase 1 — Pin the bridge and repair it on update |
| 2 | Update repair touches a neighbour's key | implementation | The repair rewrites entries in a config file consumers and other tools also write. | Repair only keys recorded as this package's own in the lockfile, and assert a hand-added neighbour key is byte-identical after the run. | Phase 1 — Pin the bridge and repair it on update |
| 3 | Annotations read as an effect claim | product | Shipping `priority` invites a later reader to cite it as evidence that hosts prioritise this package's resources, which nothing measured. | 2.3 states the no-claim condition in the step and forbids a CLAIMS entry; the verify asserts none was added. | Phase 2 — Make the MCP truth surfaces match the tree |
| 4 | Vendor-doc residuals harden into asserted facts | product | 3.2 seeds consent residuals from vendor documentation, which drifts and which nobody here observed. | Carry the source per field, print it, and let an observed value replace a documented one only after a session records it. | Phase 3 — Record what MCP actually reaches, per host |
| 5 | New host registrations surprise consumers | implementation | 3.3 writes an MCP entry into config files that previously carried only hooks for those hosts. | Gate on the existing `--tools` selection and on the 3.1 axis, so a host is registered only where the axis records that it reads such a file. | Phase 3 — Record what MCP actually reaches, per host |
| 6 | Telemetry reads near zero and is treated as failure | product | The lite surface may show almost no calls, and a low number invites a rushed default-flip or a rushed removal. | 4.2 publishes the reading including a zero; the two prompt- and cap-shaped decisions that would consume it are held in Blockers rather than wired to a threshold. | Phase 4 — Answer whether the lite surface is used |

## Acceptance Criteria

- [ ] AC-1 — The installed MCP server entry names an exact package version, and an update run rewrites that version while leaving every key this package does not own byte-identical.
- [ ] AC-2 — No setup snippet in the MCP documentation contains a path the installer does not write, and a check fails when the documented command and the installed command diverge.
- [ ] AC-3 — Served resources carry the protocol's `audience`, `priority` and `lastModified` annotations, and no claim in `docs/CLAIMS.md` cites them.
- [ ] AC-4 — The host capability manifest carries MCP fields with a recorded source per field, and the installer's closing report names only the residuals that remain non-automatic.
- [ ] AC-5 — Each host the manifest records as reading a project MCP config carries the server entry after an install selecting it, and no other host does.
- [ ] AC-6 — A query against the collector returns per-tool, per-host call counts for the lite surface, and the telemetry report renders that section with an explicit zero on a machine with no calls.
- [ ] AC-7 — Each of the four blockers is either resolved by a recorded owner or council decision, or still carries `Status: open` with its owner named.
