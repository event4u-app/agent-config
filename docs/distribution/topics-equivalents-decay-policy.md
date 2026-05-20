# Topics-equivalents decay policy

The `equivalents:` map in [`.github/topics.yml`](../../.github/topics.yml)
is a manually-curated paraphrase dictionary. Without a review cadence
it rots: the README's prose evolves, the equivalents stay frozen, the
positioning lint quietly accepts dead phrases, and a topic that *used*
to be discoverable in the README becomes a ghost mapping.

This policy locks down the review cadence so the map stays load-bearing.

## Review cadence

- **Every release cycle that touches the README tagline, H1, or any
  section heading enumerated in `.github/topics.yml`** — the PR
  author must re-run `task lint-positioning` *after* the README edit
  and visually re-confirm that every entry under `equivalents:` still
  matches a phrase in the current README. The lint only checks that
  *at least one* needle hits — it cannot detect a stale entry.
- **Six-monthly** — a dedicated `chore(visibility): refresh topics
  equivalents` PR walks every key in `equivalents:` and either:
  removes it (the equivalent now appears literally in the README),
  rewrites it (the README phrase changed), or removes the parent
  topic (no longer positioned).

## Removal heuristics

Drop an `equivalents:` entry when **any** of these holds:

- The topic key appears verbatim (case-insensitive) in the current
  README — the equivalents row is redundant.
- The README phrase the equivalent was mapped to no longer exists —
  the row is a stale alias and the lint is silently passing on a
  ghost.
- The topic itself is no longer in `topics:` — orphan entry.

## Why not a runtime lint?

The original AI-Council suggestion was to "replace the map with a
runtime lint that warns when a tagline word appears in a topic
equivalent but the parent README phrase has changed." That requires
storing a hash of the matched README phrase per equivalent and
re-validating on every lint run — extra moving parts for a low-yield
gate. The cheaper contract is the six-monthly human review documented
above. If the map grows past ~15 keys or rots faster than two release
cycles, revisit and promote to a runtime check.

## Tracking

Maintainers log each refresh in
[`agents/notes/visibility-sync-audit.md`](../../agents/notes/visibility-sync-audit.md)
with a one-line entry: date, PR, keys touched.
