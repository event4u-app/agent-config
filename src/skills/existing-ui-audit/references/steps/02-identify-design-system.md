# 2. Identify the design system

Detect markers, in order. **Stop at the first match** — projects rarely run more than one design system.

| Marker | Signal | Where |
|---|---|---|
| Flux | `livewire/flux` in `composer.json`, `<flux:*>` tags in views | `composer.json`, grep `resources/views` |
| shadcn/ui | `components.json` exists at the **workspace** root — the package that owns it; in a monorepo this is never the repository root | `components.json` |
| Headless UI | `@headlessui/react` or `@headlessui/vue` in `package.json` | `package.json` |
| Radix | `@radix-ui/*` in `package.json` (without shadcn marker) | `package.json` |
| Material/Chakra/Mantine/Ant | their package names in `package.json` | `package.json` |
| Custom / none | none of the above match | — |
