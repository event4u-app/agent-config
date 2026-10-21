---
proposed_by: claude-opus-5 session 42c8753e (drain/tool-results-handle-20261020)
implemented_by: claude-opus-5 session 42c8753e (drain/tool-results-handle-20261020)
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round of 2026-10-20
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
subject: 3247328fc3c189f74fea240a6d2e17fade06a01b889b3242ac3a5e3fb8ffabad
---

<!-- evidence-type: ratification -->

# Tool-output store — REFUSED 2/2, and what the refusal actually says

`check_kernel_edit_ratified` gates five hook-plumbing surfaces on
`drain/tool-results-handle-20261020` (Phase 2 of
`road-to-tool-results-that-leave-a-handle`): `src/config/hook-bundle-budget.json`
and the four `_lib` modules `content_class.ts`, `tool_output_selection.ts`,
`tool_output_spool.ts`, `tool_output_spool_loader.ts`. +501 lines, all additions.

Both seats returned **`refused`**. This record exists so the round is not
re-run and the reasoning is not re-derived.

## What was submitted, and what was claimed

The submission argued `confirmed-non-expanding`: the shipped
`SPOOL_SELECTED_CLASSES` is `new Set()`, so no install reaches the store; the
loader refuses a chunk whose sha256 does not match its sidecar and stores
nothing on refusal. The submission also named three ways it might be wrong,
rather than only its case — the reviewers took up all three.

## Why both seats refused

Converged on one point: **the activation boundary, not the present runtime.**
Both accept the store is inert as shipped. Both refuse the inference from
*inert* to *non-expanding*, because the distance from `new Set()` to a
populated set is one line, and whether that line is itself gated was asserted
rather than shown.

Further, from the seats:

- "Fails closed" was established only for CHUNK LOADING. It says nothing about
  partial writes, cleanup failure, corrupt records, expired handles, or
  retrieval authorization.
- An **authenticated** handle is not an **authorized** one. Possession alone
  should not grant indefinite access; a handle wants an audience, a session
  boundary, an expiry and a permitted range.
- Content addressing leaks equality: identical sensitive outputs produce
  identical hashes across a trust boundary.
- A byte cap is not a retention guarantee — cleanup needs a bounded age,
  deterministic triggering and crash recovery.
- The integrity sidecar protects CODE loading, not STORED-DATA
  confidentiality. Two threat models, currently argued as one.
- The gate must cover every equivalent activation path, not only the named
  selection file: alternate imports, config overrides, a classifier change
  that broadens an already-selected class, and changes to the loader's
  conditions.

## One submitted uncertainty resolved AFTER the round, recorded as a partial answer and not as a rebuttal

A seat wrote that the selection file's gate coverage "is not established by the
submitted artefact. This must be verified from the actual diff." It was then
verified: `check_kernel_edit_ratified` lists
`src/scripts/_lib/tool_output_selection.ts` among its five gated surfaces, so a
change from `new Set()` to a populated set re-triggers ratification today.

That answers condition 1 **for the named file only**, and the second seat's
wider form of the same condition — every equivalent activation path — is
untouched by it. Coverage also arrives through the dispatch import closure
rather than through `PLUMBING_SOURCE_RE`, which lists fixed paths and does not
match this file; so the coverage is a consequence of the module being reachable
from the dispatcher, and a refactor that removes it from the closure removes the
gate silently. Recorded as a fact for the next round, not as grounds to treat
the refusal as overtaken.

## Conditions the seats set for reconsideration

1. Show that EVERY activation or broadening path triggers ratification.
2. Tests proving an empty selection never loads the store, writes, issues a
   handle, withholds output, or changes existing behaviour.
3. Document and test authorization scope, expiry, replay, range requests,
   equality leakage, retention, cleanup failure, partial writes, corruption.
4. Separate the code-integrity claim from the stored-data security claim.
5. Return the complete diff and the test evidence for renewed review.

One seat added that if those controls hold, the right verdict is **`ratified`**
— an accepted expansion — and not `confirmed-non-expanding`. That is a finding
about the submission's framing, and it stands whatever the tests show.

## Disposition

The branch does not land in this form. The five conditions are Phase 2 work on
`road-to-tool-results-that-leave-a-handle`, recorded there as the blocker
`tool-output-store-refused-until-activation-is-gated`. The merge of `origin/main`
into this branch is resolved and committed locally; it cannot be pushed, because
the pre-push ratification gate reads the whole governed diff and a `refused`
verdict does not clear it.

## Rounds 2–10 (2026-10-20 / 2026-10-21) — still refused, and what each round found

The verdict above stands: no round returned `ratified` from both seats. This
section exists so the next round starts where these ended, not at round 1.
Questions and responses are under `agents/runtime/council/` (gitignored); what
matters from them is kept here.

| Round | Seats | Finding that refused it | Changed in response |
|---|---|---|---|
| 2 | 2/2 refused | a summary instead of the diff; renamed replacement store; cleanup on invalid handles; hostile session ids | activation paths gated by name and by literal import; cleanup only after a fully checked handle; session-id grammar |
| 3 | 2/2 refused | short writes ignored; a displaced cleaner released its successor's lock; claims stronger than the code | `writeAll`; token-owned lock; narrowed contract |
| 4 | openai refused, anthropic timed out | check-then-delete windows | deletion as a rename claim checked by inode, mtime and size |
| 5 | 2/2 refused, "acceptable in principle" | cleanup ran before the write; no production-path cap test | admission before publication; `limits` seam; cap tests |
| 6 | anthropic refused, openai did not start (codex MCP OAuth) | rollback could delete a refreshed shared entry | rollback only of a created entry |
| 7 | 2/2 refused | concurrent identical stores; lock contention read as success; repository-planted symlinks | room made before publication, no rollback; `cap-busy`; `lstat` on every path component |
| 8 | 2/2 refused | the key lived in the workspace, where a repository can plant it | key under the user-global root; `lstat`-only enumeration; threat model stated |
| 9 | 2/2 refused (one seat ratified in its first pass) | making room and publishing not under one lock | one lock across both; `storeBytesUnchecked`; expiry rounds up |
| 10 | 2/2 refused | (a) a same-address entry credited before cleanup can itself be deleted; (b) the lock needs fencing of a displaced owner now that it protects the cap | — the fix loop stopped at its bound of 10 |

Found by the submitter between rounds, not by a seat: concurrent first stores
could sign with a partially written key (one run in ~40); the key is now
published by link.

**What a round 11 needs.** (a) Stop crediting the same-address entry, or exempt
it from that sweep and verify it survived. (b) Mutual exclusion that holds
through slow operations — an OS-level lock, or a fencing generation checked
immediately before publication — with a deterministic stale-takeover test. Ask
for `ratified`.

## Rounds 11–18 (2026-10-21, resumed on the owner's instruction)

| Round | Seats | Finding that refused it | Changed in response |
|---|---|---|---|
| 11 | 2/2 refused | locks of an older format were still taken over by age | such a lock is never taken; the same-address credit dropped; takeover only from a dead pid |
| 12 | 2/2 refused | entries, log and lock still under the workspace, where every path check is check-then-use | the whole store under `runtime/tool-output-spool/<workspace digest>/` in the user-global root |
| 13 | 2/2 refused | the threat model put repository-started processes in scope and excluded them in the same text; the observe log was not private | one coherent threat model; observe log 0700/0600, written under the lock |
| 14 | 2/2 refused | an expired authenticated read skipped cleanup | an expired read cleans, best effort; a loose key tightened to 0600 |
| 15 | 2/2 refused | rounding left a sub-second window where an authenticated handle answered `missing` instead of `expired` | a two-second entry grace |
| 16 | 2/2 refused | the observe log was rotated but not bounded | a record cap; rotation before crossing 5 MB |
| 17 | 2/2 refused | a pre-existing oversized log generation broke the stated bound | oversized generations dropped, and the drop reported as `observe-dropped` |
| 18 | 2/2 refused | a takeover guard a crashed taker leaves behind blocks cleanup forever; pid reuse needs process-instance identity or an OS lock | — not changed; see below |

Found by the submitter between rounds: six concurrent takers could produce two
winners; the takeover moved under a `mkdir` guard, with a deterministic test.

**Outcome (2026-10-21).** The owner chose to land PR #2527 without the store
(roadmap D19). The store, its tests and its activation gating are kept, as
refused here, on `wip/tool-output-store-lock-redesign`. A resubmission replaces
the file-based lock with a primitive that releases on process death, or a holder
identity that includes the process start time, and asks for `ratified`. This
record's verdict stays `refused`: nothing it covers is on `main`.
