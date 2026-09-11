<!-- evidence-type: analysis -->
# Warn-only continuation on `stop` — measured once, 2026-09-12

What happens to the turn after an advisory `stop` concern fires, and what the
next `Stop` payload carries. Written to close the blocker
`warn-continuation-on-stop` on
`agents/roadmaps/road-to-a-stop-slot-that-knows-it-continues.md`, which the
2026-09-11 census
(`agents/evidence/analysis/stop-slot-continuation-census-2026-09-11.md`) opened
by naming this the one property that file could not establish.

**Pinned to `9a0216f4c7b1655af72d4e7c03b0fdc30a9b03b3`.** Every code citation
below is read at that revision. The central claim depends on a code-level
mapping, and a mapping is a property of a revision, not of the repository.

## The two claims, and the fact that they are different kinds

| Claim | Kind | How it is established |
|---|---|---|
| the turn continued after a warn-only `end-review-nudge` fire | **observed** | three dispatcher invocations follow the warn, with no `user_prompt_submit` between them |
| the following `Stop` carried `stop_hook_active: true` | **derived, not directly captured** | the concern-drop signature, which at this revision occurs only when `payload.stop_hook_active === true` |

The distinction is kept deliberately. Calling the second one an observation
would set a precedent in which every deterministic interpretation is reported as
a direct reading, and the next such derivation would arrive with that precedent
already spent. The derivation is strong enough to carry the conclusion; it is
not the same act as reading the byte.

## Why no raw payload exists, and what it would have cost to get one

The dispatcher can capture raw payloads — `_maybe_capture_payload`
(`src/scripts/hooks/dispatch_hook.ts:433-467`) — but the path is gated on
`AGENT_HOOK_CAPTURE_DIR`, that variable is absent from `~/.claude/settings.json`,
and `~/.agent-config-captures/` does not exist. Zero captures have ever been
written.

Claude Code's own transcripts do not record hook stdin. All 39 project
transcript directories under `~/.claude/projects/` were searched: 142 files
contain the string `stop_hook_active` and 101 carry the `…true` form, and every
one of them is prose, test source, roadmap text, or a quoted diff. Not one is a
recorded payload.

Obtaining the literal bytes therefore requires exporting the variable and then
driving a mutating session past the concern's 50-line threshold — a change to
the host environment, made outside any agent session. That is the same limit
`docs/contracts/hook-architecture-v1.md` already states for the
guard-expansion question, and it is why this artifact reports a derivation
instead of a capture.

## The mapping

Two concerns declare `skip_on_refusal_retry: true` — `end-review-nudge`
(`src/scripts/hook_manifest.yaml:921`) and `interruption-ledger` (`:1126`). The
dispatcher drops exactly those two when `_is_refusal_retry()` is true
(`src/scripts/hooks/dispatch_hook.ts:355-366`, applied at `:1218-1221`), and
that predicate is `payload.stop_hook_active === true`. So a recorded `stop`
invocation whose concern list is missing both **is** a recorded
`stop_hook_active: true`.

The competing explanation for a shortened concern list is the worker-role drop
(`hook_manifest.yaml:1311`), which also removes `team-review-gate`,
`self-repair` and `session-eol`. It is excluded by inspection rather than
assumed away: all 36 retry-signature invocations retain those three.

## The decisive record

`agents/runtime/state/.dispatcher/99e74fef-a05f-4210-b817-ca4b0b382264.fd7d7da9c9db/summary.json`
(main checkout; `agents/runtime/` is gitignored and per-checkout, so this record
is machine-local and not reproducible from a fresh clone):

| idx | event | time | what it shows |
|---|---|---|---|
| 13 | `Stop` | 2026-09-07T12:43:10Z | `final_severity: warn`, `final_exit_code: 2`. Sole non-allow concern: `end-review-nudge warn (2)` — "session mutated 1400 non-doc lines without a neutral review". `turn-end-gate: allow`. **Nothing blocked.** |
| 14 | `subagent_stop` | 12:43:12 | — |
| 15 | `pre_tool_use` | 12:43:16 | — |
| 16 | `post_tool_use` | 12:43:18 | — |
| 17 | `Stop` | 12:43:23 | concern list omits `end-review-nudge` and `interruption-ledger`, retains `team-review-gate` / `self-repair` / `session-eol` → **`stop_hook_active: true`** |

**Three** intervening events, indices 14 through 16, with no
`user_prompt_submit` among them. The turn continued.

## Scope of the sample, and the negative control

Across 891 schema-2 `summary.json` files: 204 `stop` invocations, 36 carrying
the retry signature. Classified by the immediately preceding `stop` in the same
window:

| Prior stop's verdict | count |
|---|---|
| block (turn-end-gate refused) | 18 |
| warn only | 4 |
| **allow only** | **0** |
| no prior stop inside the 20-invocation cap | 14 |

The 0-of-36 row is the control: no retry-signature stop followed an all-allow
stop. It supports the host-behaviour reading — that a retry does not ordinarily
follow a clean stop — and it is worth being precise about what it does **not**
do: it does not establish the payload-field mapping. The dispatcher code does
that, on its own.

The 14 rows with no prior stop in window are an artefact of
`SUMMARY_INVOCATION_CAP = 20`, which truncates history. That bounds the sample.
It does not weaken the one clean case.

## What this measures, and four things it does not

n = 1 for `end-review-nudge` specifically. The only other fire on record —
`8e37c191-6a5b-4633-99e8-3b3561f91563.44c8aada9fc7`, 2026-08-28T08:02:13Z — is
uninformative, because `turn-end-gate` blocked in the same invocation and the
retry that follows is attributable to the gate. Three further warn-only cases
exist (`session-eol` warns in `a94780ea…`, `d116c1ff…`, `a070ead3…`), each
followed 5 to 14 tool events later by a retry-signature stop; they corroborate
the shape and are not the measured case.

Not established by this artifact:

1. **That warn-only stops always continue.** One session continued. Nothing here
   licenses a general rule, and the contract sentence this artifact supports is
   written to match.
2. **Behaviour on any host but `claude`.** `end-review-nudge` is bound only there
   (`hook_manifest.yaml:1324`).
3. **Behaviour on any future Claude Code version.** The host decides; the
   measurement is of one version on one date.
4. **What the host did with the payload.** The dispatcher records what concerns
   returned, never what the host did next. Attribution here is by elimination
   within the record.

## The standard this acceptance rests on

The council of 2026-09-12 accepted the derivation on four properties, both seats
converging: the mapping is **one-to-one**, it is **deterministic**, it is
produced by **code in this repository** rather than inferred from an external
system's behaviour, and its **limits are stated**. The third is the load-bearing
one — and it cuts both ways in the same record. The mapping from drop signature
to payload field is code we control. Whether the host continues after receiving
that payload is not, which is precisely why that half is reported as observed
behaviour and not as a derivation.

## See also

- `agents/evidence/analysis/stop-slot-continuation-census-2026-09-11.md` — the census that opened this question.
- `docs/contracts/hook-architecture-v1.md` § Exit-code semantics — the contract sentence this artifact supports.
- `agents/runtime/council/responses/stop-slot-blockers-2026-09-12.md` — the council record (gitignored, local-only).
