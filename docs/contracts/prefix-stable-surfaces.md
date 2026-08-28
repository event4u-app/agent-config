# Prefix-stable surfaces — the runtime half

> Owner: maintainer · Status: active · Landed by `road-to-runtime-context-floors`
> Phase 1 · Machine-readable source: `src/scripts/_lib/prefix_stable_surfaces.ts`

## What this contract is for

Some bytes in this repository sit in the **cached prompt prefix** of every
dispatch. Rewriting them *during* a session invalidates that cache for the rest
of it, so the next call pays the cache-**write** rate over the whole prefix
instead of the cache-**read** rate. This contract names those bytes, names the
boundaries at which a rebuild is legitimate, and points at the gate that
enforces the difference.

Two mechanisms already covered adjacent halves and neither covered this one:

| Mechanism | When it looks | What it cannot see |
|---|---|---|
| `check_kernel_prefix_stability` | authoring time, against a committed snapshot | a write that happens while a session is running |
| `_lib/payload_hash_drift` | after the fact, from an audit ledger | anything, until enough dispatches have been recorded |
| **`check_prefix_stable_mutation`** (this contract) | authoring time, over the hook manifest | a writer that is not a manifest concern |

The third row is the runtime half. Before it, the invariant was prose.

## The declared surface set

`PREFIX_STABLE_SURFACES` in `src/scripts/_lib/prefix_stable_surfaces.ts` is the
single source. It is **loaded** by every consumer, never restated:

- `check_preamble_payload_budget` resolves its census roots and its dead-scope
  `roots:` argument from it.
- `check_prefix_stable_mutation` resolves the boundary it guards from it.

Two lists describing one boundary is a drift shape this repository has already
paid for; that is why the roots live in a library rather than in either gate.

| id | root | why it is in the prefix |
|---|---|---|
| `project-scope-rules` | `dist/agent-src/rules` | every always-loaded rule body is re-written into the preamble on every spawn |
| `preloaded-skills-catalog` | `dist/agent-src/skills` | skill names and descriptions are catalogued into the preamble on every spawn |
| `project-claude-md` | `CLAUDE.md` | the project half of the hierarchy is injected ahead of the first user turn |
| `project-claude-local-md` | `CLAUDE.local.md` | the gitignored project-local override, injected on the same path |

## The scope decision, and its reopen condition

**Council 2026-08-28 — anthropic + openai, 2 rounds, 2/2 convergent.** The
`which-surfaces-are-prefix-stable` blocker offered three options: (a) reuse the
three buckets `check_preamble_payload_budget` already measures; (b) enumerate
every surface a hook can write that reaches standing context; (c) start with (a)
and record (b) as the reopen condition.

**Verdict: (c).** Rationale: (a)'s boundary is already measured and maintained,
so the gate inherits a live list instead of a second one that will drift from
it; (b) requires a first enumeration of carriers that do not exist yet, which is
enumerating a plan rather than a surface. Dissent recorded by both seats: a
carrier could land in the window before the reopen fires — which is why the
reopen condition below is an obligation on the change that lands it, not a
future review.

### Reopen condition

> A change that lands a hook, a delivery carrier, or a resident process able to
> write standing context outside the four roots above **adds it to
> `PREFIX_STABLE_SURFACES` in the same change**.

`revisit-if`: any such carrier lands; or `check_prefix_stable_mutation` reports
an `undecidable` finding, which means a writer exists whose target the gate
cannot classify from source.

## Re-arm events

`RE_ARM_EVENTS` — `session_start`, `pre_compact`. At these boundaries a rebuilt
prefix is expected and paid for once, so a write declared against one is not a
mid-session mutation.

A concern that must write a declared surface on a mid-session slot declares the
boundary in `src/scripts/hook_manifest.yaml`:

```yaml
concerns:
  my-concern:
    script: src/scripts/my_concern.ts
    re_arm: pre_compact
```

`lint_hook_manifest` rejects any other value: the mutation gate treats an
unrecognised value as *undeclared* and fails, so an unvalidated typo would look
like a real violation and send the author hunting the wrong defect.

## Fail-closed on undecidable

A write whose target is computed at runtime cannot be classified by reading the
source. Treating that as clean turns every dynamic path into an accidental
exemption, so the gate fails closed — **but narrowly**: a dynamic write target
is reported only when the same file also carries a literal that resolves into a
declared surface. A dynamic write in a file with no such literal is not
reported, because the gate does not claim to know what it cannot see, and a gate
that flagged every dynamic write in every hook is one nobody can keep green.

## What this contract does NOT claim

- **It does not see non-manifest writers.** A script a human runs, or a future
  resident process that is not a hook concern, is outside the corpus. The
  observation-only contract bounds that class instead —
  [`resident-process-floors.md`](resident-process-floors.md).
- **It does not measure cache behaviour.** Whether the cache actually behaves as
  predicted is `_lib/payload_hash_drift`'s question, reported by
  `cache_realization_report`.
- **It does not gate content.** A rule may say anything; this contract is about
  *when* its bytes change, never *what* they say.
