# Profiles — views over the command surface (6.0.0-D Step 14)

A profile is **commands→profile aggregation**: it declares the curated command
set a workflow surfaces, NOT a directory of files. The curated tree is rendered
by `agent-config commands ls --profile <id>`, never stored.

- `view:` — the curated default surface (the focused set shown by default).
- `packs:` — the capability packs whose full command set `--expanded` adds.
- Built-in profiles are **opinionated templates, immutable in 6.0** — user
  customization of built-ins is deferred to 6.1. A user `developer.yaml` in the
  consumer tree does NOT override the built-in; custom profiles MUST use a
  different id (name-collision is reported, built-in wins).

Profiles are an INTERNAL concept: the wizard/CLI asks "What are you doing?"
(Software Development / Product & Roadmaps / Content Creation / Finance &
Planning), which maps to a profile id. The README never says "choose a profile".

## Not the seed profiles

`src/agent-src/profiles/*.yml` carries the same six ids as **seed identity
profiles** — who the user is, default preset, personas, README anchor — under
[ADR-010](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md). Its
`packs:` list names capability packs; the `packs:` list here names the packs
whose commands `--expanded` adds. Same key, different vocabulary, so the two
lists are not expected to match. Which tree owns the "who" axis is open
(OQ-9 in `agents/owner-questions.md`).
