# Later — parked roadmaps (blocked-for-later, will resume)

Roadmaps here have **open work that cannot proceed now** — gated on an external
trigger or a decision — but are **not abandoned**: they resume when the trigger
fires. This is the fourth roadmap disposition, distinct from:

- `archive/` — work done (fully or partially), **no further work planned**.
- `skipped/` — decided **against** pursuit (superseded, scope rejected).
- active `agents/roadmaps/` — planned **and workable now**.

## The contract

Every roadmap in `later/`:

- carries frontmatter **`status: later`**, and
- records a **resume condition** — a `Blocked until …` / `Trigger` / `Resume
  when …` line so it never rots without a "when does it come back".

`later/` is **excluded** from the dashboard (`agents/roadmaps-progress.md`) and
from `/roadmap:process-*`, exactly like `archive/` and `skipped/` — a parked
roadmap is not active backlog. The `lint_roadmap_later_disposition` CI guard
enforces the `status: later` ⇔ `later/` placement contract and the
resume-condition requirement.

## When to move a roadmap here

If every open item is gated on something outside the roadmap — a real consumer
repo, a benchmark re-open, host-model access, a kernel soak, a pruning track, a
human decision — it is not active. Move it here (don't leave it lying to the
dashboard), keep its open `[ ]` items open, and record the resume condition. See
the `roadmap-management` skill (§ Lifecycle, the Active-vs-Later test) for the
full procedure.
