# readme-size-and-splitting-guidelines

## Purpose

Keep READMEs scannable as repositories grow. A README is an **entry
point**, not a reference manual. Once it stops working as entry point,
split — don't scroll.

Referenced by `readme-writing`, `readme-writing-package`, `readme-reviewer`.

---

## Size thresholds

| Lines | State | Action |
|---|---|---|
| **< 150** | Healthy | No splitting needed |
| **150–300** | Busy | Add a Table of Contents; review for padding |
| **300–500** | Overloaded | Split deep content to `/docs/` or `references/` |
| **> 500** | Broken | Hard split required; README has stopped being an entry point |

Lines, not bytes — tables, code blocks, and badges inflate bytes but stay
scannable. The real signal is: **can a new reader reach install/usage
within the first screen, then navigate intentionally from there?**

---

## When to split

Hard triggers — split immediately:

- **More than 5 install variants** (platforms, package managers, tools) →
  move install matrix to a dedicated `docs/installation.md` or a table with
  deep links
- **More than 3 framework adapters** → each adapter gets its own doc
- **Architecture or design rationale > 30 lines** → `docs/architecture.md`
- **API reference > 50 lines** → `docs/api.md` or auto-generated reference
- **Multiple audiences with different needs** → audience-specific docs
  (`docs/consumers.md`, `docs/contributors.md`)

Soft triggers — review and probably split:

- A section needs its own Table of Contents
- Reader scrolls past three screens to reach "how do I use it"
- More than one code block per section explaining variations of the same
  thing (indicates reference material, not onboarding)

---

## Splitting strategies

### Strategy 1 — Reference-split architecture (recommended for skills, packages)

```
README.md              ← entry: what, why, install, minimal usage
docs/
  installation.md      ← full install matrix, post-install steps
  usage.md             ← extended examples, common patterns
  architecture.md      ← internal design, decisions
  api.md               ← full API reference
```

README stays < 200 lines. Each `/docs/` file is a self-contained chapter.

### Strategy 2 — Deep-link tables for multi-platform repos

Supporting many platforms or tool integrations: single table with deep
links beats inline blocks:

```markdown
| Tool    | Install                | Docs                    |
|---------|------------------------|-------------------------|
| Cursor  | `./install.sh cursor`  | [docs/cursor.md](...)   |
| Aider   | `./install.sh aider`   | [docs/aider.md](...)    |
```

Pattern: 1 row per platform, actual how-to in the linked doc.

### Strategy 3 — Collapsible sections (`<details>`)

Content occasionally needed but crowding the scan path — long install
options, platform-specific quirks, troubleshooting trees:

```markdown
<details>
<summary>Troubleshooting: Docker on Apple Silicon</summary>

Content here — full detail, not shown by default.

</details>
```

Use sparingly. Collapsed content is still in the file; it defers visual
cost only. Not a substitute for true splitting when content > 30 lines.

---

## Table of Contents heuristic

Add a ToC when:

- README > 150 lines, OR
- More than 6 top-level (`##`) sections, OR
- Reader would need to scroll to find a known section

Place the ToC **after** the one-line summary and **before** the first
substantive section (usually install or quickstart). Don't add a ToC to
small READMEs — becomes visual noise.

---

## Multi-audience repos

A single README cannot serve "consumers of a package" and "contributors
to a package" equally. Choose one primary audience for the README,
deep-link the other:

- **Package repo** → consumers primary; contributors go to
  `CONTRIBUTING.md` or `docs/development.md`
- **Application repo** → contributors/team primary; end users (if any)
  go to `docs/user-guide.md`

README must declare its audience within the first screen. Readers in the
other audience must find their link within the first screen too.

---

## Anti-patterns — do not split this way

- **Splitting by accident** — moving content out "because the README is long"
  without a navigation story. Readers get lost.
- **Splitting and duplicating** — same content in README and `/docs/`.
  They drift apart. Pick one home.
- **Deep-link-only README** — README that is just a table of contents
  linking out. Reader arriving cold must still learn what/why/how-install
  without clicking.
- **Premature splitting** — `docs/` scaffolding for a 50-line README.
  Overhead not worth it; come back at 150 lines.
- **Hiding critical content in `<details>`** — install, first example, and
  requirements are **never** collapsed.

---

## Validation checklist

- [ ] First screen answers what / why / install
- [ ] Size below "overloaded" threshold, or splitting is in place
- [ ] ToC present if > 150 lines or > 6 top-level sections
- [ ] No duplication between README and `/docs/`
- [ ] `<details>` used only for secondary, bulky content
- [ ] Multi-platform install uses a table, not 10 sequential install blocks
- [ ] Each `/docs/` file is self-contained and linked from README
- [ ] Audience explicit; other audience has a visible deep-link
