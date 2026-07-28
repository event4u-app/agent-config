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
- `?theme=light|dark` feeds the pre-paint `data-theme` stamp (no flash).

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

## References

- Port range: ADR-012. Enforcement: `src/server/port.ts`.
- Token transport: `src/server/token.ts`.
- Capabilities source: `src/shared/capabilities.ts`.
- Host-side consumers: the embeddable-GUI and reciprocal-ecosystem tracks drive
  this contract. They are named rather than linked — a roadmap is archived or
  deleted as its work completes, so a contract citing the file rots the day the
  plan lands (`no-roadmap-references`). The durable anchors are the ADR and the
  source paths above.
