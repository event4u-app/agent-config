# `shadcn-current` — what the shadcn CLI actually scaffolds

Not authored. **Emitted**, verbatim, by

```bash
npx shadcn@latest init -d --template vite    # CLI 4.19.0, 2026-08-24
```

and copied here unedited. This fixture exists so that no skill in this
repository states a shadcn or Tailwind version it read in prose: the majors in
`package.json` are the only ones `react-shadcn-ui/SKILL.md` § Compatibility may
quote (`road-to-component-library-lifecycle` Phase 5 step 5.1).

What the 2026-08-24 scaffold establishes, each of which contradicted the
skill's prior text:

| Fact | Value in this fixture | Why it matters |
|---|---|---|
| shadcn CLI major | `shadcn@^4.19.0` (a **runtime dependency**, not a devDependency) | the skill said `2.1.x` |
| Tailwind major | `tailwindcss@^4` + `@tailwindcss/vite@^4` | the skill's `tailwind.config.{js,ts}` instructions are v3-only |
| Tailwind config file | **none** — `components.json` carries `"tailwind": {"config": ""}` | v4 is CSS-first; an empty `config` string IS the v4 marker in `components.json` |
| Primitive layer | `@base-ui/react@^1.7.0` | not Radix — the primitive vendor changed |
| React major | `react@^19.2.6` | — |
| Icon library | `lucide-react@^1.33.0`, `components.json` `iconLibrary: "lucide"` | — |
| Default style | `components.json` `style: "base-nova"` | the `default`/`new-york` pair the skill named is gone |

`components.json` is committed alongside because three of those facts are only
observable there, not in the manifest.

- **Pre-state:** no such fixture existed; every version in the touched skills
  was asserted from reading.
- **Post-state:** `react-shadcn-ui/SKILL.md` § Compatibility quotes these
  majors and nothing else.

This directory is a **fixture, never installed** — the repository root declares
no `workspaces`, so no package manager walks into it (see the parent
`README.md`).
