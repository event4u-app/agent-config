<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Which settings-key changes count as "migrated automatically" at the release cut?

Repository: `event4u/agent-config`, an npm package (`@event4u/agent-config`) that consumers install globally into AI coding hosts. Consumers configure it through `.agent-settings.yml`.

## The decision already taken, which this question does not reopen

On 2026-10-24 the repository owner decided (recorded as ADR-300): the version bump follows each commit's `Consumer-Impact:` trailer (`none | automatic | notice | action`), and **a settings key removed with an automatic migration is not a semver-major.** Whether that exception exists is settled. Leaving the release cut unchanged is not an available answer, because it would leave the owner's decision without effect at the cut.

## What has to be decided

The release cut (`belowMajorRefusalLines` in `src/scripts/_lib/release_settings_surface.ts`) compares the released settings surface with the live one. Below a major it refuses a removed key unless `MINOR_REMOVAL_PROOFS` names a test proving the key was consumer-neutral, and it refuses dropping an alias from `RENAMED_KEYS`. The rule sentence it enforces is stated verbatim in eight places, including a warning printed to consumers:

> A settings key may be removed or renamed in a minor release only when no consumer project can rely on it — default-neutral and derivable, proven by a named test; any other removal or rename ships only in a major, and a renamed key's alias is dropped only in a major.

The cut must now recognise "removed with an automatic migration". Pick exactly one:

- **(a)** Both mechanisms count, when the release declares `Consumer-Impact: automatic`: a key moved into `RENAMED_KEYS` (old path → new path), and a key moved into `REMOVED_KEYS` (old path → a reason naming what decides instead). The rule sentence is amended in all eight places to say so.
- **(b)** Only a key moved into `RENAMED_KEYS` counts, when the release declares `Consumer-Impact: automatic`. A key moved into `REMOVED_KEYS` still needs its `MINOR_REMOVAL_PROOFS` entry or a major. The rule sentence is amended in all eight places to say so.

## Facts about the two mechanisms (read from the tree)

- `RENAMED_KEYS` (`src/scripts/_lib/settings_renamed_keys.ts`): `applyRenamedKeys` runs per settings layer before the merge and **carries the consumer's value** onto the new path; the old key keeps working and a warning is printed once per process. One entry today: `planning.challenge_on_create → planning.closure_pass`.
- `REMOVED_KEYS` (`src/scripts/_lib/settings_removed_keys.ts`): the loader **discards the consumer's value** and prints one line naming what decides instead. About sixty entries. Most were default-neutral when retired; the 2026-10-20 batch (ADR-293, shipped in 17.0.0) was not — `lean_projection.mode: delivery` written user-globally changed a real machine's behaviour, so that batch shipped in a major with a one-time conversion module, and its `BREAKING_CHANGES.md` row is classed `action`.
- `BREAKING_CHANGES.md` records 10.0.0 and 11.0.0 as majors whose settings-key removals were handled by the update ("automatic" in their own Migration prose).
- The `Consumer-Impact:` trailer is written by the commit author; the cut cannot verify it.

## What to return

Your pick, (a) or (b), the reason in a few sentences, and any condition the chosen option needs at the cut to stay safe for consumers.
