<!-- evidence-type: analysis -->

# `running_origin` read every installed package as a source checkout

Moved verbatim out of `road-to-an-update-that-installs-itself-only-when-it-is-safe.md`
step 2.1 on 2026-10-21, because that roadmap is `lightweight` and stood at 609
lines against a 600-line cap. `lint_roadmap_complexity` names this exact
remedy — move dated evidence paragraphs verbatim to a page here and leave a
one-line pointer — and explicitly forbids an agent retagging the file
`structural` to clear the cap instead. Nothing below is rewritten; only the
indentation the roadmap's list level imposed is removed.

---

*The `running_origin` half is fixed (2026-10-19).* `_is_source_repo`
answers "am I standing in an agent-config tree", and **both** of its
positive signals — a `dist/agent-src/` directory and a `package.json`
named `@event4u/agent-config` — are in every published tarball, so every
installed package read as a source checkout and `quiet_context`
suppressed the unattended run on all of them. The `.git`-at-package-root
test is now the one shared definition
(`doctor_install_mode.isSourceCheckoutPackage`), used by
`running_origin` and by `doctor_update_verdict` so the two cannot drift;
`_is_source_repo` itself is unchanged, because its three remaining
callers ask the question it actually answers. Measured on a real packaged
install (`npm pack` → `npm install --omit=dev --ignore-scripts` into an
empty directory outside the repo → `upgrade --unattended --dry-run`):
**before** `not installing — suppressed: source checkout`, **after**
`not installing (installed: 16.5.0) — candidate 16.5.0 is not newer than
16.5.0` — the origin gate now passes and the refusal is the honest one.
A real checkout still reads `source-checkout`.
