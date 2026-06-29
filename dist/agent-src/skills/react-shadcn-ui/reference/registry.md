# shadcn registry & namespace reference

> Lazy-loaded by `react-shadcn-ui` ONLY on the registry/MCP path (custom or
> namespaced registries, or theme-alignment). Not in the always-on skill body —
> zero token cost on the vanilla `shadcn add` path.

## `registry-item.json` — the self-describing component unit

Each item is a JSON doc the agent reads before scaffolding — never guesses
paths, deps, or tokens.

- `name` — item id.
- `type` — one of: `registry:ui`, `registry:component`, `registry:block`,
  `registry:hook`, `registry:lib`, `registry:theme`, `registry:style`,
  `registry:page`, `registry:file`, `registry:base`, `registry:item`.
- `dependencies` / `devDependencies` — npm packages.
- `registryDependencies` — other items to pull first (the dependency graph):
  built-in (`"button"`), namespaced (`"@acme/input"`), GitHub
  (`"acme/ui/button#v1.2.0"`), URL, or local path.
- `files[]` — each `{ path, type, target }`; `target` uses the project alias
  placeholders (`~`, `@ui/`, `@lib/`, `@hooks/`) from `components.json`.
- `cssVars` — tokens scoped by mode: `theme` (font/radius), `light`, `dark`,
  OKLCH. **Align to the project's tokens; do not inject the default neutral
  theme** (anti-slop C1/C5/T7).
- `css` — raw `@layer` / `@utility` / `@keyframes` / `@plugin`.

Scaffold order: read item → install npm `dependencies` → resolve
`registryDependencies` (recurse) → write `files[]` to alias targets → merge
`cssVars` into the project token layer (reconcile, don't overwrite).

## Namespaced registries

`components.json` maps a namespace → URL template under `registries`:

```json
{
  "registries": {
    "@acme-ui": "https://registry.acme.com/ui/{name}.json",
    "@acme-auth": {
      "url": "https://registry.acme.com/auth/{name}.json",
      "headers": { "Authorization": "Bearer ${ACME_TOKEN}" }
    }
  }
}
```

- Resolution: `@ns/name` → look up `@ns` → substitute `{name}` (+ optional
  `{style}`). Reference regex: `^(@[a-zA-Z0-9](?:[a-zA-Z0-9-_]*[a-zA-Z0-9])?)\/(.+)$`.
- Auth registries: per-registry `headers` with `${ENV_VAR}` — never inline a
  token; read from the environment.
- Namespace space is **decentralized** — no central collision authority; the
  `components.json` map is the project's source of truth.

## CLI surface (the agent drives these)

`init` · `add [item|@ns/item]` · `search @ns -q <q>` · `view @ns/item` (inspect
JSON before install) · `docs [item] --json` · `diff` (drift vs updated
registry) · `info --json` (project context — see the SKILL handshake) · `build`
(publish). Inspect with `view` before `add` — evidence before action.
