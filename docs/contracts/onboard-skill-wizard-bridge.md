---
stability: beta
keep-beta-until: 2026-08-17
---

# `/onboard` ↔ wizard bridge — in-process commit contract

> **Status:** active · **Stability:** beta
> · **Surface:** `src/cli/commands/onboardFinish.ts`, `.agent-src.uncompressed/commands/onboard.md`
> · **Tests:** [`tests/server/onboardFinish_parity.test.ts`](../../tests/server/onboardFinish_parity.test.ts)

Locks how the chat-driven `/onboard` skill commits its assembled
answers so the skill and the browser wizard share **one canonical
write path** with zero drift. The browser wizard POSTs to
`POST /api/v1/wizard/finish` (server-side); the skill pipes a JSON
payload to `agent-config onboard:finish` on stdin (in-process).
Both surfaces call the same `commitMulti` 2PC helper in
[`src/server/io/atomicMultiWrite.ts`](../../src/server/io/atomicMultiWrite.ts).

## § 0 — Design pivot (2026-05-20)

The prior revision of this contract specified an HTTP IPC bridge:
the skill would spawn `agent-config ui:serve --headless`, discover
its port via `skill-bridge.{port,token,pid}` files, then POST the
payload over loopback. Per the project's TypeScript-first policy
([`engineering/typescript-first`](../../agents/policies/engineering/typescript-first.md))
the IPC layer was dropped in favour of a native TS subcommand
(`onboard:finish`) that calls `commitMulti` directly. Same canonical
write path, less moving infrastructure, no port contention, no token
discovery.

## § 1 — Subcommand invocation

```
agent-config onboard:finish [--project-root <path>]
```

`--project-root <path>` overrides `process.cwd()` as the root used
to resolve `.agent-settings.yml` and `.agent-user.md`. Omitted →
CWD. The skill should pass it explicitly when chat shells run from
a different working directory than the project root.

Stdin: one JSON document (UTF-8). Stdout: one JSON line (response
envelope, § 3). Exit codes are documented in § 4.

## § 2 — Stdin payload

```json
{
  "settings": { ... nested object, partial subset of settingsSchema ... },
  "userMd":   "<full markdown body>" | null
}
```

- **`settings`** — partial nested object. Only the keys present are
  merged into `.agent-settings.yml`; absent keys keep their current
  value. Comments and key order in the existing file are preserved
  via `mergeIntoTemplate` ([`src/server/io/yamlIO.ts`](../../src/server/io/yamlIO.ts)).
  Schema validation is **deliberately scoped to the merged-in keys**
  — full-object validation would reject every chat session because
  `/onboard` only collects a subset (the wizard POST endpoint runs
  full-schema validation; the skill subset is gated by the
  question wording itself).
- **`userMd`** — full body of `.agent-user.md` or `null`. When
  non-null, validated by `userMdSchema` (gray-matter must parse
  the frontmatter). When `null`, `.agent-user.md` is left untouched
  and the commit reduces to a single-file 2PC (still atomic via
  the same intent marker).

## § 3 — Response envelope

One JSON line on stdout:

**Success:**
```json
{ "ok": true, "writtenPaths": ["<abs path>", ...], "txnId": "<uuid>" }
```

**Failure:**
```json
{ "ok": false, "error": { "code": "<CODE>", "message": "<text>", "fields"?: [...] } }
```

`error.code` values:

| Code | Meaning | Exit |
|---|---|---|
| `STDIN` | Could not read stdin | 2 |
| `PAYLOAD` | JSON parse failure or shape mismatch | 2 |
| `SETTINGS_MISSING` | `.agent-settings.yml` not found at project root | 1 |
| `VALIDATION` | `userMdSchema` rejected the markdown; `fields` carries Zod issues | 2 |
| `TXN_PARTIAL` | `commitMulti` failed mid-write; replay on next boot will reconcile | 1 |

## § 4 — Exit codes

| Exit | Meaning |
|---|---|
| 0 | Committed; both files in their new state |
| 1 | IO or 2PC commit failure — `commitMulti` replay recovers on next call |
| 2 | Bad invocation, malformed payload, or validation failure — no file written |

## § 5 — Atomicity & crash recovery

The subcommand calls `commitMulti(payloads, { projectRoot })` which:

1. Writes every payload to its `<target>.tmp-<txnId>` sibling, fsync.
2. Writes a `state/wizard-intent-<txnId>.json` marker, fsync.
3. Renames every `tmp → target` in order.
4. Unlinks the marker.

A crash between steps 3 and 4 is reconciled by `replayPendingCommits`
on the next server boot (called from the wizard server's startup
hook). The chat path does not itself replay markers — leftover
markers from a `TXN_PARTIAL` exit are picked up the next time the
wizard server boots, or the next time the user runs `/onboard`
followed by a wizard session.

## § 6 — Skill-side lifecycle (chat path)

The `/onboard` skill ([`.agent-src.uncompressed/commands/onboard.md`](../../.agent-src.uncompressed/commands/onboard.md)
§ 8) operates in a **deferred-write** model:

1. Steps 3–7c collect answers in working memory only — no file is
   touched.
2. Step 7c re-runs `agent-config explain config --json` to verify the
   profile/preset chain resolves before the commit.
3. Step 8 assembles the nested payload, appends
   `onboarding.onboarded: true`, and pipes the JSON to
   `agent-config onboard:finish` via stdin.
4. On `ok=true`, the skill prints the summary (step 10).
5. On `ok=false`, the skill surfaces `error.code` + `error.message`,
   leaves `onboarding.onboarded` at its previous value, and stops.

## § 6a — Parity gate

[`tests/server/onboardFinish_parity.test.ts`](../../tests/server/onboardFinish_parity.test.ts)
seeds two temp project roots from `config/agent-settings.template.yml`,
drives the chat surface via `commitOnboardPayload(...)` (in-process)
and the browser surface via `app.inject({ url: '/api/v1/wizard/finish' })`,
then diffs the resulting files. The gate guards against future drift.

**Canonicalisation:** none today. Both surfaces share `commitMulti`
and `mergeIntoTemplate`, so the on-disk `.agent-settings.yml` and
`.agent-user.md` are byte-identical when fed equivalent payloads.
The per-call `txnId` is random but only lands in the intent marker
under `agents/state/` and is unlinked post-commit — it never reaches
the user-facing files compared by the test. If a future change
introduces non-deterministic content (timestamp footers, comment
ordering shifts, locale-dependent number formatting), the test
must add the matching canonicalisation step and this section MUST
document it.

**Wire shape note (`userMd`).** The on-the-wire payload sends
`userMd` as a bare string (matching the chat subcommand JSON).
The `userMdSchema` is shaped as `{ body: string }` for length +
gray-matter checks, so both surfaces wrap the bare string into
`{ body: userMd }` before validation. The wizard route was fixed
in this change to perform that wrap (it previously passed the
bare string through, which deterministically failed validation
with `Expected object, received string`).

## § 7 — Stability commitments

- The subcommand name (`onboard:finish`), the stdin JSON shape
  (`settings` / `userMd`), the response envelope keys (`ok` /
  `writtenPaths` / `txnId` / `error`), and the documented `error.code`
  values are SemVer-major to remove or rename.
- Adding new `error.code` values is non-breaking; callers MUST treat
  unknown codes the same as `TXN_PARTIAL` (retry safe).
- Adding new response fields is non-breaking; consumers MUST ignore
  unknown fields.

## § 8 — Out of scope

- **User-global file writes** (`~/.event4u/agent-config/agent-settings.yml`).
  Step 9 of the skill writes that file directly — `onboard:finish`
  handles project-local files only.
- **Wizard-side HTTP route.** `POST /api/v1/wizard/finish` is the
  browser path and is documented separately in
  [`settings-api.md`](settings-api.md).
- **Legacy IPC bridge.** The prior `agent-config ui:serve --headless`
  flow, port/token discovery files, and the `AGENT_CONFIG_READY:`
  stdout sentinel are no longer consumed by `/onboard`. The
  `--headless` mode itself survives in `uiServe.ts` for potential
  future consumers; its contract — should a consumer adopt it —
  remains the one documented in the git history of this file
  (commit prior to the 2026-05-20 pivot).

## Related contracts

- [`local-server-api.md`](local-server-api.md) — server-side wire shape
  for the browser wizard path.
- [`settings-api.md`](settings-api.md) — wizard POST endpoints; same
  `commitMulti` substrate as `onboard:finish`.
- [`ADR-012`](../decisions/ADR-012-typescript-cli-shell.md) — parent
  decision for the TS CLI shell that hosts this subcommand.
- [`agents/policies/engineering/typescript-first.md`](../../agents/policies/engineering/typescript-first.md)
  — project-local policy that drove the 2026-05-20 pivot.
