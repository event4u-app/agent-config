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

## Capability discovery

- `GET /api/v1/ping` and `agent-config --version --json` carry a `capabilities`
  block: `{ configRoot: true, embed: { supported: true, version: 1, features:
  ['theme', 'deepLink'] } }`. A host checks a capability, not a version number —
  an older AC omits the block and the host degrades to a clear "not supported".

## References

- Port range: ADR-012. Enforcement: `src/server/port.ts`.
- Token transport: `src/server/token.ts`.
- Capabilities source: `src/shared/capabilities.ts`.
- Host-side plans: `agents/roadmaps/road-to-ac-embeddable-gui.md`,
  `agents/roadmaps/road-to-reciprocal-ecosystem.md`.
