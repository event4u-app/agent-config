<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# The hook-bundle byte ceiling is nearly reached: raise it, or make room?

Repository: `event4u/agent-config`. Every host hook event loads one self-hosted bundle, `dist/hooks/dispatch.js`, built from source with every hook concern inlined. A ceiling on its size lives in `src/config/hook-bundle-budget.json` and is enforced by `check_hook_bundle_composition`.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner wrote, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). Roadmap notes call a raise "a ratchet move recorded in that file's `raise_log` and the owner's"; the file itself records `owner: maintainer`. The file is on the repository's ratification-gate watched set, so a raise also needs an independent two-provider ratification record in the same change.

## The question

Pick one, or propose another:

- **(a) raise** `max_bytes` with a `raise_log` entry — state the new value and the reason;
- **(b) wait** for a sibling change that moves code out of the bundle;
- **(c) make room first**: a dedicated change that moves a module out of the always-loaded bundle (for example into a conditionally loaded chunk) before any of the blocked steps land;
- **(other)** name it.

## Evidence

- File content (abridged): `max_bytes: 1550000`, `shrink_only: true`. "A RAISE needs a recorded reason in `raise_log` naming what was added and why it could not be avoided." The gate reads `max_bytes` at the base revision and fails a working value above it unless `raise_log` gained an entry whose `to` equals the new value. `max_yaml_packages: 1`. "WHY A CEILING AT ALL: every concern is inlined into one bundle that every hook event loads, so a dependency added for one concern is paid by all of them, on every dispatch. The second YAML parser that opened this roadmap cost 95,846 bytes and reached a release as a review finding rather than as a red check." "What this does not bound: latency" — a separate file, `hook-latency-budget.json`, owns wall-clock.
- Derivation of 1,550,000 (2026-10): measured 1,514,715 B plus about 2.3 % headroom, because an esbuild minor can move the figure by hundreds of bytes with no source change. One prior raise (1,500,000 → 1,550,000 on 2026-10-01): the old ceiling was red on the commit that registered it, because it was derived on a branch whose base predated three merged PRs. Composition then: one YAML package (258,833 B), 1,238,525 B own source.
- Measured today on `origin/main` (`f55e5a760`): **1,547,451 B / 1,550,000 B**, 292 modules, 1 YAML reader. Headroom 2,549 B.
- Blocked consumers: (1) `road-to-a-setup-that-decides-itself` step 1.1 — binding the host's `InstructionsLoaded` event to an observer concern; on its branch, with the binding in and before follow-up review fixes, the bundle measured 1,549,991 B, and the fixes cost more than the 9 B left. It is also the input of another roadmap's steps (installed-layer 2.x). (2) The same setup roadmap's step 3.3 (a promotion pass in the `session_start` concern). (3) `road-to-an-update-that-installs-itself-only-when-it-is-safe` steps 3.1 and 3.3–3.5 — a new day-throttled `session_start` notification concern; its size is not measured yet.
- Sibling search: a grep over active and archived roadmaps for a change that moves code out of the bundle (egress engine into a conditional chunk, or anything similar) found **none** scheduled. The only mention is the setup roadmap's own sentence that such a change "would free room". One open PR (#2471) edits an existing bundled concern (`block_config_weakening`); its byte effect was not measured.
- Not measured: the per-module size breakdown of the bundle's own source, and whether a chunk split changes cold-start latency.

## Omitted

The full `max_bytes_derivation` and `raise_log` prose is abridged above; no figure was left out.

## Answer format

Choose one option (or propose one), with your reasoning in one or two paragraphs. If you choose (a), state the new `max_bytes` value and what the `raise_log` entry must say; if (c), say what is moved and what proves it worked. End with exactly these lines:

CHOICE: <a:<new max_bytes>|b|c|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
