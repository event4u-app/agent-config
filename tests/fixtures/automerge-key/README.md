# `automerge-key` fixture

A deliberately-violating settings pair for `src/scripts/check_no_automerge_key.ts`.

The gate's corpus is two tracked files that always exist, so the create-only
canary shape `src/config/gate-coverage.yml` supports cannot reach it — a planted
file lands outside the corpus and the gate stays green, which was measured and
mis-reported as a dead gate on a previous attempt. This fixture is the
replacement sensitivity proof: `tests/scripts/check_no_automerge_key.test.ts`
runs the gate against this root and asserts exit 1 with both keys named.
