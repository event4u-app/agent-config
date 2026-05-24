# Install-Funnel Telemetry — Privacy

> **3-minute read.** This page explains what the `@event4u/agent-config`
> installer collects when you opt in, what it never collects, and how to
> opt out.

## TL;DR

- **Off by default.** You see one prompt during install. If you do nothing,
  nothing is sent.
- **Anonymous.** No IP, no machine ID, no project name, no file paths.
- **Short retention.** Raw events live 14 days; sessions live 2 hours.
- **One-click off.** `--no-telemetry`, the wizard "No thanks" button, or
  unsetting `TELEMETRY_OPT_IN=1` for the next install.

## 1. What we collect (only if you opt in)

Per install attempt, we send one event per funnel stage with these fields:

- **Funnel stage** — one of: `started`, `wizard_opt_in_seen`,
  `wizard_opt_in_accepted`, `packs_selected`, `applied`,
  `first_command_run`, `errored`.
- **Entry path** — `npx`, `curl`, or `gui`.
- **Host agent family** — coarse bucket: `vscode`, `jetbrains`, `cli`,
  `browser`, or `unknown`. Specific tool names (Cursor, Copilot, Windsurf)
  are collapsed into the family bucket.
- **Operating-system family** — `linux`, `macos`, or `windows`.
- **Node major version** — `20` or `22`.
- **agent-config version** — the semver string of the installer release.
- **Pack categories** — a list of broad categories from a fixed enum
  (`finance`, `founder`, `engineering`, `content`, `consultant`, `meta`,
  `other`). Specific pack names are never sent.
- **Wizard used** — boolean.
- **Duration bucket** — one of `<30s`, `30s-2m`, `2m-10m`, `>10m`. We never
  send millisecond timings.
- **Error class** (only on `errored`) — one of `network`, `filesystem`,
  `config_invalid`, `dependency`, `unknown`. Never a stack, never a
  message.
- **Session ID** — a 128-bit random token issued by our server with a
  2-hour time-to-live, used to stitch the funnel. It is never persisted
  on your machine.

The full wire contract is in [`telemetry-schema.md`](telemetry-schema.md).

## 2. What we NEVER collect

- IP address. Cloudflare drops it before our worker reads the request body;
  our code does not log `cf-connecting-ip`.
- Machine identifiers — no MAC, no hostname, no username, no home directory.
- Project name, project path, repository slug, git remote URL.
- Pack names (only the coarse `pack_categories` enum).
- File paths of any kind.
- Error stacks, error messages, or any freeform error text.
- Anything you typed: prompts, ticket IDs, ad-hoc commands.
- Sub-bucket timing (no `duration_ms`).

## 3. How to opt out

Three paths, any one works:

1. **Wizard (browser GUI)** — click "No thanks" on the telemetry screen.
   This is the default focus; pressing Enter without picking declines.
2. **CLI / TUI** — answer `n` at the telemetry prompt (default `n`).
3. **CI / `--yes` mode** — telemetry is **always off** unless you pass
   `--telemetry-opt-in` explicitly. There is no implicit consent in
   non-interactive runs.

You can also disable telemetry for one specific install by setting
`AGENT_CONFIG_NO_TELEMETRY=1` in the environment.

## 4. Per-install scope — choice is never persisted

The opt-in choice applies **only to the current install session**. We do
not write a preference file under your project, your home directory, or
anywhere else. If you run the installer again, you will see the prompt
again. This is intentional — every install is an explicit consent moment.

## 5. How long we keep it

| What | Storage | Time to live |
|---|---|---|
| Session ID + stage events | Cloudflare KV | 14 days |
| Session token only | Cloudflare KV | 2 hours |
| Weekly aggregates (no session ID) | Cloudflare KV | 24 months |

Aggregates contain only counts — number of installs per stage, per OS, per
entry path. No identifier survives beyond 14 days.

## 6. Where the source lives, who can see the data

- Client SDK source — [`packages/core/installer/src/telemetry/`](../../packages/core/installer/src/telemetry/).
- Worker source — [`packages/cloud/telemetry-worker/`](../../packages/cloud/telemetry-worker/).
- Aggregates are visible only to the named maintainers of
  `event4u/agent-config`. No third-party access. No advertising integration.
  No resale.

## 7. Remote kill-switch

We host a public feature-flag JSON. If we ever need to disable telemetry
across all installs — for an incident, a privacy concern, or a deprecation
— we flip the flag to `enabled: false`. The installer reads the flag
before opening a session; if disabled, no events are sent regardless of
your opt-in choice. The flag defaults to `false` when unreachable.

## 8. Legal basis

Lawful basis under the General Data Protection Regulation is consent
under Article 6(1)(a). You give consent by clicking "opt in" or passing
`--telemetry-opt-in`; you withdraw consent by choosing any of the opt-out
paths in §3. Withdrawal applies to all future installs immediately.

Because session IDs are server-issued, short-lived (2 hours), and not
combined with re-identifying quasi-identifiers, the resulting records are
designed to fall outside the GDPR Art. 4(1) definition of personal data.
We treat them as personal data anyway for safety.

## 9. Changes to this policy

Material changes ship as a new section in this file plus a bump of
`schema_version` in the wire format. Non-material changes (typo fixes,
clearer wording) ship as plain edits. The current version corresponds to
`schema_version: "1"` in [`telemetry-schema.md`](telemetry-schema.md).

## See also

- [`telemetry-schema.md`](telemetry-schema.md) — full wire contract.
- `agents/roadmaps/road-to-product-adoption.md § Phase 4`.
- `non-destructive-by-default` — why worker deploy is a separate PR.
