---
stability: beta
keep-beta-until: 2026-08-17
---

# `/onboard` ↔ wizard bridge — IPC contract

> **Status:** active · **Stability:** beta
> · **Surface:** `scripts/_cli/cmd_onboard.py`, `src/cli/commands/uiServe.ts`
> · **Tests:** `tests/skills/onboard_wizard_parity.py` (Phase 2)

Locks how the chat-driven `/onboard` skill discovers, talks to, and
tears down a short-lived local `agent-config ui:serve` instance so the
skill and the browser wizard share one canonical write path. The wire
shape of the API calls themselves lives in
[`settings-api.md`](settings-api.md) (created by the GUI roadmap); this
contract covers only the IPC handshake between the skill and the
server it spawns.

## § 1 — Transport choice

- **TCP loopback only.** The skill connects to the same `127.0.0.1`
  port range as the browser UI ([`local-server-api.md § 1`](local-server-api.md)).
- **No Unix domain socket.** Open question from the roadmap resolved
  in favour of TCP for parity with the browser path, Windows support,
  and to avoid bifurcating the server's transport surface. Port
  contention is bounded by the 1000-port scan range.

## § 2 — Server invocation — `--headless`

A new flag on `agent-config ui:serve`:

```
agent-config ui:serve --headless [--project-root <path>]
```

`--project-root <path>` overrides CWD as the root used to resolve
`.agent-config/` (§ 3). If omitted, CWD is used. The skill always
passes it explicitly to remove CWD ambiguity.

Behaviour delta from the default invocation:

- Implies `--no-open` — never spawns a browser.
- After the listener is bound and the token is minted, writes the
  discovery files under `<projectRoot>/.agent-config/` (see § 3) and
  prints **exactly one prefix-marked line** to stdout:

  ```
  AGENT_CONFIG_READY: port=<n> tokenFile=<absolute-path> pid=<n> version=<semver>
  ```

  The `AGENT_CONFIG_READY:` prefix is the sentinel. The skill reads
  stdout line-by-line until it sees a line starting with that prefix
  or the timeout fires (§ 4 step 2). Other stdout output (uvicorn
  banner, lifespan logs, third-party middleware) is forwarded
  verbatim to the skill's own stderr for diagnosis but is never
  confused with the ready line.
- Continues to print the human-readable `agent-config: token=…`
  banner to **stderr** per [`local-server-api.md § 2`](local-server-api.md).
  The bearer token does appear on stderr by design — same surface as
  the existing browser flow; the skill captures stderr from the child
  and forwards only non-token lines to its own stderr so the token
  never re-enters chat logs.
- Process stays in the foreground; SIGTERM / SIGINT triggers graceful
  shutdown (§ 5).

Without `--headless` the existing behaviour is unchanged — the flag
is additive.

### Pre-spawn version probe

Before spawning, the skill MUST execute `agent-config --version` and
parse the result against the semver range it embeds. Mismatch → skip
the spawn and fall back (§ 6); no `--headless` process is ever
started against an incompatible binary. The `version=<semver>` field
on the ready line is a defense-in-depth secondary check for the case
where `PATH` resolves a different binary between the version probe
and the spawn (e.g. a `pyenv` / `nvm` shim race or in-flight
upgrade).

## § 3 — Discovery files

Three files under `<projectRoot>/.agent-config/`, each written via a
write-temp-then-rename sequence and forced to mode `0600` by an
explicit `os.chmod()` call **after** the rename (the `mode=` argument
to `open()` is silently ignored on Windows and on systems where the
user's umask is permissive):

| File | Content | Lifetime |
|---|---|---|
| `skill-bridge.port` | ASCII decimal port number, no trailing newline | Created post-bind, deleted on graceful shutdown |
| `skill-bridge.token` | URL-safe bearer token, no trailing newline | Same lifetime as the port file |
| `skill-bridge.pid` | Server process PID, ASCII decimal, no trailing newline | Same lifetime as the port file |

Server contract:

- Creates the parent directory with mode `0700` if absent.
- Validates the recorded port is inside the documented loopback range
  (per [`local-server-api.md § 1`](local-server-api.md)) **before**
  probing. A port outside that range is treated as a corrupted /
  hostile write — the server unlinks all three files and continues
  boot without probing (probing arbitrary local ports is a footgun).
- If the port file exists and is in-range, the server probes the
  recorded port with `GET /api/v1/ping`. **200** → another bridge is
  live; the server then reads `skill-bridge.pid` and checks
  `os.kill(pid, 0)` (or platform equivalent). PID alive → exit
  non-zero with a guidance line. PID dead or pid file missing →
  treat as stale, unlink all three, continue boot. **ECONNREFUSED /
  timeout / non-200** → unlink all three, continue boot.
- On filesystems without atomic rename (FAT32, some SMB / NFS
  mounts) the rename SHALL retry up to 3 times with exponential
  backoff (50 ms, 200 ms, 800 ms) before failing the spawn.
- All three filenames are added to `.gitignore` by the GUI roadmap's
  gitignore-block sync (Phase 1 of this roadmap verifies the entry
  exists; if missing, the skill rewrite adds it).

## § 4 — Skill-side lifecycle

`scripts/_cli/cmd_onboard.py` runs the following sequence per skill
turn:

1. **Version probe + spawn.** First run `agent-config --version`; if
   the result is outside the embedded semver range, jump straight to
   fallback (§ 6). Otherwise
   `subprocess.Popen(['agent-config', 'ui:serve', '--headless', '--project-root', <root>], ...)`
   with `--project-root` passed explicitly (no CWD reliance). The
   child's stdout / stderr are piped. The skill installs
   `signal.signal(SIGINT, _teardown)` and `signal.signal(SIGTERM, _teardown)`
   handlers **before** the spawn so Ctrl-C between spawn and the
   `finally` block in step 5 still tears down the child and unlinks
   the discovery files.
2. **Wait for ready.** Block until **(a)** a stdout line starting
   with the `AGENT_CONFIG_READY:` prefix is read **AND** all three
   discovery files (`skill-bridge.port`, `skill-bridge.token`,
   `skill-bridge.pid`) exist with non-empty content, **OR** a
   5-second wall-clock timeout elapses. The AND between the ready
   line and the file checks is deliberate — either signal alone is
   insufficient because filesystem visibility lag can lag stdout
   delivery (or vice versa). Timeout, ready-line parse failure, or
   port out of range → teardown the child if still alive, then
   fallback (§ 6).
3. **Read discovery once.** Parse the port from `skill-bridge.port`,
   the token from `skill-bridge.token`, and the server PID from
   `skill-bridge.pid`. **Cache all three for the remainder of the
   skill turn.** The discovery files are immutable after creation
   (§ 3 lifetime: created post-bind, deleted on shutdown) — there
   is nothing to re-read. Token rotation is explicitly out of scope
   for the beta; if a future protocol revision adds rotation it MUST
   ship under a new `AGENT_CONFIG_READY:` field (e.g.
   `rotation=true`) so the skill caches conservatively today.
4. **Talk.** POST collected answers to the wizard endpoints documented
   in [`settings-api.md`](settings-api.md). Auth via the header form
   (`Authorization: Bearer <token>`); the query-string form is reserved
   for browser bootstrap.
5. **Teardown.** Send SIGTERM (Unix) / `CTRL_BREAK_EVENT` (Windows;
   the server registers `SIGBREAK` per § 5) to the child. Wait up
   to 2 seconds for exit; SIGKILL / `TerminateProcess` on timeout.
   The `try` / `finally` block plus the signal handlers installed
   in step 1 ensure teardown runs on every exit path including
   Ctrl-C and uncaught exceptions in step 4.

## § 5 — Server teardown

On SIGTERM / SIGINT (Unix) or `SIGBREAK` (Windows; raised by the
skill's `CTRL_BREAK_EVENT`) the server, in order:

- Stops accepting new connections.
- Drains in-flight requests up to a 2-second budget.
- Unlinks `skill-bridge.port`, `skill-bridge.token`, and
  `skill-bridge.pid` from `<projectRoot>/.agent-config/`.
- Exits zero.

**Platform divergence.** Graceful drain is supported on Unix and on
Windows when the skill spawns the child with
`CREATE_NEW_PROCESS_GROUP` and signals via `CTRL_BREAK_EVENT`. If
the skill instead calls `subprocess.Popen.terminate()` on Windows
(which maps to `TerminateProcess`), the drain step is skipped and
the discovery files are left in place — they are reclaimed on the
next boot per § 3. Crash exits (uncaught exception, SIGKILL /
`TerminateProcess`) intentionally leave the discovery files in
place for the same reason.

## § 6 — Fallback path

The skill reverts to the legacy direct-write flow (today's behaviour:
in-place writes of `.agent-settings.yml` and `.agent-user.md`) when:

- `agent-config` is not on `PATH`, **or**
- the `--headless` spawn exits non-zero before the ready line, **or**
- the 5-second readiness timeout elapses, **or**
- `.agent-config/skill-bridge.port` cannot be read after the ready
  signal.

In every fallback case the skill emits one stderr line of the form
`/onboard: bridge unavailable (<reason>) — using direct write`. The
legacy path does **not** honour the wizard's 2PC intent marker
documented in [`settings-api.md`](settings-api.md) — an interrupted
legacy write may leave a partial file. The skill accepts this risk
because the fallback only fires in environments where the TS shell is
unreachable (sandboxes, air-gapped installs, missing-node hosts).

## § 7 — Failure modes summary

| Condition | Skill action | Server action |
|---|---|---|
| `agent-config` missing | Fallback (§ 6) | n/a |
| Port range exhausted | Fallback (§ 6) | Non-zero exit per [`local-server-api.md § 5`](local-server-api.md) |
| Stale discovery files at boot | n/a — handled by server | Unlink + continue |
| Live discovery files at boot | n/a — handled by server | Non-zero exit, guidance line |
| Token mismatch on API call | Abort skill turn with stderr error; unlink the cached discovery files before exit so the next invocation cannot re-use the bad token and loop | `401` per [`local-server-api.md § 5`](local-server-api.md) |
| Crash before teardown (server side) | Next skill invocation reclaims stale files via § 3 PID + ping probe | n/a |
| Ctrl-C in the skill before teardown | SIGINT / SIGTERM handler installed in § 4 step 1 runs teardown, unlinks files, exits non-zero | Receives SIGTERM (Unix) or `CTRL_BREAK_EVENT` (Windows) and drains per § 5 |

## § 8 — Stability commitments

- The discovery-file paths (`.agent-config/skill-bridge.port`,
  `skill-bridge.token`, `skill-bridge.pid`), the ready-line prefix
  (`AGENT_CONFIG_READY:`) and its documented fields
  (`port`, `tokenFile`, `pid`, `version`), and the SIGTERM /
  `SIGBREAK` teardown contract are SemVer-major to remove or rename.
- Adding new discovery files or new ready-line fields is
  non-breaking; consumers MUST ignore unknown fields.
- **Loosening** the fallback predicates (more environments fall back
  to the legacy path) is **breaking** — callers that previously rode
  the bridge silently drop onto the legacy write path on upgrade.
  **Tightening** (the bridge serves more cases, fewer fallbacks) is
  non-breaking. (Inverted from a prior draft; the bridge is the
  primary path and fallback is the regression surface.)

## § 9 — Deferred / out-of-scope

The AI Council design review (Phase 0) raised additional hardening
ideas that are tracked here but deliberately not included in the
beta surface:

- **Token TTL / expiry file.** Embedding an expiry timestamp in the
  token or a sibling `skill-bridge.expiry` file. Phase 1+ if shared-
  user / CI scenarios become a target; the current threat model (a
  single developer on their own machine) does not justify it.
- **Server-side onboarding status endpoint.**
  `GET /api/v1/onboard/status` returning `{fieldsWritten, intentMarkerPresent}`
  so the skill can refuse fallback after a partial-success crash and
  surface a `--reset` hint instead of silently double-writing. Phase 2
  alongside the parity test.
- **Per-project hash in discovery filenames.** Naming the files
  `skill-bridge.<sha256(projectRoot)[:8]>.port` etc. to prevent
  cross-project file accumulation when crashes leave orphans in
  long-lived `.agent-config/` directories. Phase 1+; the PID probe
  in § 3 already handles same-project stale files.
- **Unix domain socket transport.** Cuts loopback overhead and
  removes port-exhaustion risk on Unix. Deferred to post-GA; TCP
  loopback wins on cross-platform parity for the beta.
- **TLS over loopback.** Rejected. The token is the sole auth factor
  and lives in a file the same UID can read; encrypting the wire
  adds latency and complexity for zero confidentiality gain at this
  threat level. Re-evaluated only if the contract is ever extended
  off-localhost.
- **Drop the legacy fallback (§ 6) entirely.** Rejected for the
  beta. Removing fallback turns `node` / `agent-config` into a hard
  runtime dependency for the skill, which breaks Nix / Alpine / air-
  gapped install paths the roadmap explicitly supports. Phase 7 of
  the parent roadmap revisits with telemetry on actual fallback
  hit-rate.

## Related contracts

- [`local-server-api.md`](local-server-api.md) — server-side wire shape,
  bind / port / token / Host / Origin guarantees the bridge inherits.
- [`settings-api.md`](settings-api.md) — the wizard POST endpoints the
  skill calls once the bridge is up (forward reference; lands with the
  GUI roadmap).
- [`ADR-012`](../decisions/ADR-012-typescript-cli-shell.md) — parent
  decision for the TS CLI shell and embedded server.
