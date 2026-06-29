# shadcn registry & namespace reference

> Lazy-loaded by `react-shadcn-ui` ONLY on the registry/MCP path (custom or
> namespaced registries, or theme-alignment work). Not part of the always-on
> skill body — zero token cost on the vanilla `shadcn add` path.

## `registry-item.json` — the self-describing component unit

A registry serves each item as a JSON document the agent reads before
scaffolding, so it never guesses paths, deps, or tokens.

- `name` — item id.
- `type` — one of: `registry:ui`, `registry:component`, `registry:block`,
  `registry:hook`, `registry:lib`, `registry:theme`, `registry:style`,
  `registry:page`, `registry:file`, `registry:base`, `registry:item`.
- `dependencies` / `devDependencies` — npm packages to install.
- `registryDependencies` — other registry items to pull first (the dependency
  graph). Forms: built-in (`"button"`), namespaced (`"@acme/input"`), GitHub
  (`"acme/ui/button#v1.2.0"`), URL, or local path.
- `files[]` — each `{ path, type, target }`; `target` uses the project's alias
  placeholders (`~`, `@ui/`, `@lib/`, `@hooks/`) resolved from `components.json`.
- `cssVars` — design tokens scoped by mode: `theme` (font/radius), `light`,
  `dark`. Values are OKLCH. **Align these to the project's existing tokens, do
  not inject the default neutral theme** (anti-slop C1/C5/T7).
- `css` — raw `@layer` / `@utility` / `@keyframes` / `@plugin` directives.

Scaffold order: read the item → install npm `dependencies` → resolve
`registryDependencies` (recurse) → write `files[]` to the alias targets →
merge `cssVars` into the project's token layer (reconcile, do not overwrite).

## Namespaced registries

`components.json` maps a namespace to a URL template under `registries`:

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

- Resolution: `@ns/name` → look up `@ns` → substitute `{name}` (and optional
  `{style}`) into the URL template. The reference resolution regex is
  `^(@[a-zA-Z0-9](?:[a-zA-Z0-9-_]*[a-zA-Z0-9])?)\/(.+)$`.
- Auth registries: per-registry `headers` with `${ENV_VAR}` interpolation —
  never inline a token; read it from the environment.
- The namespace space is **decentralized** — no central authority resolves
  collisions; the `components.json` map is the project's source of truth.

## CLI surface (the agent drives these)

`init` · `add [item|@ns/item]` · `search @ns -q <q>` · `view @ns/item`
(inspect JSON before install) · `docs [item] --json` · `diff` (drift vs the
updated registry) · `info --json` (project context — see the SKILL handshake)
· `build` (publish a registry). Inspect with `view` before `add` — evidence
before action.
