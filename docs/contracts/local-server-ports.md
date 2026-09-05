---
stability: beta
promote-to: stable
promote-reason: >-
  Beta review 2026-09-05. All four STABILITY.md criteria checked rather than
  assumed: 37 days in beta, no content change in 39 days, sixteen minor releases
  (14.0.0 to 14.16.0) shipped it unchanged, and four consumer references
  including the implementation itself (`src/server/port.ts:13`). No
  contract-to-contract dependency in either direction that is beta; the adjacent
  `local-server-api.md` points at this file, not away from it. Its three
  open-looking clauses are closed carve-outs with recorded council rejections
  (2026-07-23, 2026-07-27), not pending decisions. Decided by AI council
  2026-09-05, 2/2 convergent, under the maintainer instruction to fix the CI.
---

# Contract: local server ports + host integration

> The loopback/port contract `src/server/port.ts` enforces, plus the
> host-integration surface (config root + embed) a host like agent-switch binds
> to. This file resolves the long-standing pointer in `src/server/port.ts`.

## Port range

- The GUI/API server binds on **loopback `127.0.0.1` only**, on a free port in
  **41000–41999** (per ADR-012). `src/server/port.ts` picks a free port by
  actually binding (no is-free → bind race) and refuses any range that overlaps
  the privileged ports `[0, 1024]` or strays outside this documented range —
  both are anti-regression guards (`validateRange`).
- The chosen port is ephemeral per process; a host discovers the live port from
  the server-info readout, never by assuming a fixed value.

## Auth token

- `src/server/token.ts`: a 32-byte hex token, per-process, mode `0600`, replaced
  on every boot. The SPA reads it once from `?token=` at boot, then strips it
  from the URL; subsequent calls use the `Authorization: Bearer` header. There is
  no cookie. A host must re-read the token after every respawn.
- **Accepted-risk statement (council 2026-07-23):** the `?token=` bootstrap is
  the contract for embedded hosts too. The residual leak class (URL visible to
  same-user local processes before the post-boot strip) is already inside the
  same-user loopback trust boundary, and the token is per-process with a
  boot-bounded TTL. A session-cookie endpoint was evaluated and **rejected** —
  it would add a new endpoint plus a second credential type on `/api/*` for a
  leak class the trust boundary already contains. The post-boot URL strip
  (`src/ui/urlToken.ts`, `history.replaceState`) applies to standalone and
  embedded boots alike, so the credential does not linger in the address bar,
  webview navigation history, or copy-pasted URLs.

## Discovery file — `local-server.json`

- `src/server/serverInfo.ts` writes `~/.event4u/agent-config/local-server.json`
  (`pid`, `port`, `url`, `startedAt`) on real-serve boot and removes it on
  graceful shutdown. Readers must tolerate staleness by checking liveness
  (the file survives a `SIGKILL`).
- **The `url` field embeds `?token=`.** Hosts SHOULD ignore the `url` field and
  rebuild the target from `port` plus a fresh read of the token file — that
  also keeps a tampered `url` from redirecting the token off loopback.
- **Mode `0600` on `local-server.json` is a contract invariant, not an
  accident** — the file carries a tokenized URL, so it gets the same file-mode
  floor as `local-server.token`. Loosening either mode is a breaking change to
  this contract.

## Host integration — config root

- `agent-config --config-root <path>` (flag) or `EVENT4U_CONFIG_HOME` (env) sets
  AC's config home. Precedence: **flag > env > default**; absent → default
  behavior is unchanged. This lets a host give AC a per-profile config root so
  profile-scoped settings do not silently collide.

## Host integration — embed

- `?embed=1` renders AC chrome-stripped (no standalone nav/brand, no theme
  toggle — the host owns the theme); settings deep-links `#/settings` and
  `#/settings/<section>` keep working.
- **Framing:** AC sends CSP `frame-ancestors 'none'` and is **never** iframe-able
  — a host renders AC's URL in a **separate top-level window**, not a frame.
  - *Why deny (council 2026-07-23, 2 members, 2 rounds):* framing a loopback
    server is an engineering-economics question, not a security one — any
    same-user local process is already inside the trust boundary. The real cost
    of allowing frames is a three-webview CSP compatibility matrix (WKWebView /
    WebView2 / WebKitGTK) that would need permanent maintenance; the explicit
    DENY is the smallest deterministic surface. `frame-ancestors` does not gate
    top-level loads, so the embed/theme/capability contract stays fully useful.
    Silence (no header) was rejected: an implicit stance breaks silently the
    first time a hardening pass adds a header.
- `?theme=light|dark` feeds the pre-paint `data-theme` stamp (no flash).
- **Wizard is out of scope for embed v1.** Only the settings surfaces are part
  of the embed contract. The wizard is the one multi-step flow that ends in a
  redirect and would need a completion contract with the host; it is not
  blocked at the code level, but hosts must not deep-link it under `?embed=1`.
  Revisit as a v2 feature on an explicit host demand signal.

### Theme contract (shared-design-tokens track)

- **Precedence at boot:** `?theme=` query > persisted user override
  (`localStorage`) > OS preference — implemented by the pre-paint stamp in
  `src/ui/index.html` and mirrored at runtime by `src/ui/theme.ts`. While a
  host supplies `?theme=`, the host **owns** the theme: AC suppresses its own
  OS-preference following (`shouldFollowSystemTheme()`), so the embedded view
  never drifts from the host.
- **Live OS-theme changes are host-owned.** A host that follows the OS theme
  (agent-switch resolves `system` via a `matchMedia` listener) must
  **re-drive the embedded view by reloading it with the new `?theme=` query**
  when the OS preference flips. There is no postMessage/live-retheme channel
  in v1 — reload-with-new-query is the contract.
- **Accent override: none in v1 — by design.** Both GUIs consume one accent
  family from the canonical token source (`tokens/event4u-agent-tokens.json`,
  see `tokens/README-as-wiring.md`), so a host-supplied accent parameter is
  unnecessary; the shared identity makes the seam invisible without it. If a
  future host ever needs one, it must be a **named-value allow-list** — an
  arbitrary hex from a host page is a contrast-failure vector and an
  unbounded support surface, and stays rejected.
- **Token versioning:** the canonical token file carries `_version` (bumped on
  any value change — a token change is a visual breaking change for the
  embedded view). A host pinning visual parity can compare its vendored token
  version against AC's; the embed provenance strip may surface a mismatch.

## Capability discovery

- `GET /api/v1/ping` and `agent-config --version --json` carry a `capabilities`
  block: `{ configRoot: true, embed: { supported: true, version: 1, features:
  ['theme', 'deepLink'] } }`. A host checks a capability, not a version number —
  an older AC omits the block and the host degrades to a clear "not supported".

## Host lifecycle

- **Idle-shutdown watchdog.** The server disarms until the first client, then
  self-terminates after **30 minutes** without an authed `/api/*` request
  (`src/server/app.ts` idle watchdog); `POST /api/v1/shutdown` is the immediate
  shutdown beacon. A host holding an idle embedded view open **will lose its
  server** — that is a documented expectation, not a bug. The documented
  keepalive is any authed `/api/*` request (e.g. a periodic `GET /api/v1/ping`
  while the view is visible); the SPA's own lifecycle module
  (`src/ui/serverLifecycle.ts`) already implements visible-only keepalive +
  `pagehide` shutdown beacon, so a host embedding the real SPA inherits it.
- **Headless refusal.** `ui:serve` refuses to start (exit code `2`, clear
  message) when it detects a headless session — `SSH_CONNECTION` set, or Linux
  with no `DISPLAY` — unless `--allow-headless` is passed
  (`src/cli/commands/uiServe.ts#isHeadless`). Hosts must surface that message
  as a clear degradation state instead of waiting on a spawn that never comes.

## References

- Port range: ADR-012. Enforcement: `src/server/port.ts`.
- Token transport: `src/server/token.ts`.
- Capabilities source: `src/shared/capabilities.ts`.
- Host-side consumers: the embeddable-GUI and reciprocal-ecosystem tracks drive
  this contract. They are named rather than linked — a roadmap is archived or
  deleted as its work completes, so a contract citing the file rots the day the
  plan lands (`no-roadmap-references`). The durable anchors are the ADR and the
  source paths above.
