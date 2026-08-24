# PREREG — opencode enforcement, six concerns

Written 2026-08-24, **before any measurement**, per Phase 0.3 of
`road-to-opencode-enforcement`. Nothing below is a result.

**Pin:** `@opencode-ai/plugin@1.18.21`, `@opencode-ai/sdk@1.18.21`. The roadmap's
blocker named git `6386e67`; the published packages were read instead and
**equivalence was not demonstrated**. If the sha differs materially, this
pre-registration is re-derived rather than patched.

## What is pre-registered, and why it is six rather than two

AI council 2026-08-24, 2/2. One seat argued for pre-registering only the two
concerns whose criteria are writable today and deferring four; the other argued
that **branches** are writable for all six, and that "unknown result" and
"unwritable test" are different things. The second reading carried, and the first
seat's objection is honoured by its form: what is pre-registered for the four is
not `criterion: undetermined` — that would not be a pre-registration — but a
**capability probe with three predetermined outcomes**. Every observable result
below has its interpretation fixed in advance, which is the property that makes
this falsifiable.

## Group A — the two mutation concerns. Ordinary red/green.

Both match their hook's shape exactly: the hook is mutate-only and the concern
needs only to mutate.

### A1 · `hardenedSpawnEnv` → `shell.env`

- **Red (without plugin):** a shell invoked by opencode inherits the ambient
  environment — a marker variable set in the parent is visible to the child.
- **Green (with plugin):** the same invocation sees the hardened set — the marker
  is absent and the keys `hardenedSpawnEnv` guarantees are present.
- **Falsified if:** `shell.env` does not fire for the shell path opencode
  actually uses, or its `env` output is ignored.

### A2 · kernel projection → `experimental.chat.system.transform`

- **Red:** a session's system prompt contains none of the nine kernel rules.
- **Green:** the same session's system prompt contains all nine, byte-identical to
  the projection `dist/agent-src/rules/` carries.
- **Falsified if:** the `system: string[]` output is ignored, truncated, or
  reordered such that a kernel rule is dropped.

## Group B — the four deny-dependent concerns. Capability probe first.

`permission.ask` is the **only** refusal in the interface, and it fires when the
host raises a permission request rather than on every tool call.
`tool.execute.before` is mutate-only. So each concern below is gated on one probe.

### The probe — `opencode-permission-payload-and-coverage`

For each of B1–B4, in a live opencode session with the plugin installed, record a
transcript establishing **all three**:

1. **Coverage** — `permission.ask` fires for the guarded operation.
2. **Payload** — the input carries the concern's decision input in a form that can
   be **losslessly normalized** into what the canonical script already consumes.
   `Permission` types it as `pattern?: string | Array<string>` plus
   `metadata: Record<string, unknown>`; whether the tool input is in there is the
   question.
3. **Honour** — `status: "deny"` prevents the guarded action from executing.

**Three predetermined outcomes, fixed here:**

| Probe result | Interpretation, decided in advance |
|---|---|
| all three hold | the concern proceeds to red/green transcripts; only then may an enforcement claim be made |
| any one fails | the concern is recorded **unsupported on this host surface**, with which of the three failed. **No enforcement claim may be made**, and `enforced_by` must not name opencode |
| no runtime transcript exists | **unevaluated.** Not "unsupported" and not "enforced" — the concern and AC-2 remain incomplete |

The third row is the state this pre-registration itself is in, and naming it is
the point: an autonomous run cannot install a plugin or drive a live session, so
the honest reading of B1–B4 today is *unevaluated*, never *unsupported*.

### B1 · `block-kernel-rule-writes`

- **Decision input:** the path being written.
- **Red:** a write to a kernel rule under `src/rules/` succeeds.
- **Green:** the same write is refused, and the canonical script — not the plugin —
  produced the refusal.

### B2 · `block-config-weakening`

- **Decision input:** the path **and the diff** (it counts allowlist entries).
- **Red:** an allowlist entry is appended past the cap and the write lands.
- **Green:** refused, by the canonical script's verdict.
- **Additional risk, named because it is specific:** `Permission` carries no diff
  in any typed field. This is the concern most likely to fail step 2 of the probe.

### B3 · `block-no-verify`

- **Decision input:** the command string.
- **Red:** `git commit --no-verify` (or a `core.hooksPath` override) executes.
- **Green:** refused, by the canonical script's verdict.

### B4 · `git-authorization`

- **Decision input:** the git operation, in the op-split semantics whose vector
  tests are the red/green template.
- **Red:** an unauthorized push executes.
- **Green:** refused, by the canonical script's verdict.

## The translator invariant, and it is measured, not assumed

```
A GREEN IN GROUP B COUNTS ONLY IF THE CANONICAL SCRIPT PRODUCED THE VERDICT.
A PLUGIN THAT INTERPRETS `metadata` AND DECIDES FOR ITSELF IS A SECOND
AUTHORITY SURFACE, NOT A CARRIER — AND ITS GREEN IS NOT THIS PACKAGE'S.
```

Per `docs/contracts/hook-architecture-v1.md` § The fifth state. The test is
lossless normalization: the plugin may reshape host input into what the script
consumes, and may not add a decision the script did not make. A green whose
verdict came from plugin-local logic **falsifies the translator classification**
and must be recorded as such rather than counted.

## What this file does not do

It does not authorise writing the plugin. Phase 1 needs an installed plugin and a
live session; the probe above is the transferred prerequisite, and its stub names
the producer.
