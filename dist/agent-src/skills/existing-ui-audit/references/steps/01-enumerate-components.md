# 1. Enumerate components and templates

| Stack | Where to look |
|---|---|
| `blade-livewire-flux` | `resources/views/components/`, `resources/views/livewire/`, `resources/views/partials/`, `resources/views/layouts/`, `app/View/Components/`, `app/Livewire/` |
| `react-shadcn` | `components/`, `app/components/`, `src/components/`, `src/app/(routes)/`, plus any `app/**/page.tsx` for Next.js |
| `vue` | `resources/js/components/`, `src/components/`, `pages/` |
| `plain` | `resources/views/`, plus any `*.html` under `public/` |

Capture each component/template as:
`{path, name, kind: component|view|style|page, exports?: [props]}`.

The `kind` set is the one `agent-config ui:audit` actually emits — its single
definition is `AUDIT_KINDS` in `src/cli/commands/uiAudit.ts`, and a test asserts
this line against that constant rather than restating it. It read
`page|partial|component|layout` until 2026-08-26; only two of those four values
existed in the code, so an artefact written by the command was being read here
against a contract it did not satisfy.

`partial` and `layout` are not in the set. Neither has an operational definition
that survives contact with a real tree, and adding a branch for a category
nobody can test is how the previous mismatch happened.

`view` is the **Blade** classification — `*.blade.php` and `resources/views/`.
It reads zero in a JavaScript tree by construction, which is not the same as
unused.
