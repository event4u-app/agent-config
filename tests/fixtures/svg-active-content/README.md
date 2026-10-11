# `svg-active-content` — three planted SVGs and one clean twin

Read by `tests/skills/frontend_render_security_svg_grep.test.ts`, which pulls the
backstop grep out of `src/skills/frontend-render-security/SKILL.md` § Backstop
greps and runs THAT pattern — not a copy of it — over this directory. A grep
documented in prose and a grep pinned in a test are two copies of one fact, and
this fixture exists so there is only one.

| File | What it plants |
|---|---|
| `onload-attribute.svg` | an `on*` event attribute on the root `<svg>` |
| `foreign-object.svg` | a `<foreignObject>` carrying HTML with its own handler |
| `javascript-href.svg` | an `xlink:href` pointing at a `javascript:` URL |
| `clean-twin.svg` | the same square with an accessible name and nothing active |

The twin is the half that matters. A pattern that matches every SVG would match
the three planted files too, and would be worthless; the test fails if the twin
is hit, which is what makes the three hits evidence.

None of these is a working exploit — each is the shortest shape that carries the
construct the grep looks for.
