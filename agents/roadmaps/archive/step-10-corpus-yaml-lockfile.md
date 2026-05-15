---
complexity: lightweight
---

# Roadmap: Low-Impact Corpus — YAML Lockfile as Runtime Source-of-Truth

> Pfad C from the PR #151 follow-up discussion (Punkt 4 of the GPT review): turn the human-edited `agents/low-impact-decisions.md` into a **build-time** source. A generated lockfile `agents/low-impact-decisions.lock.yaml` becomes the **runtime** source-of-truth. The Markdown parser stays — but moves from a runtime risk to a build tool. `task consistency` enforces `.md` ↔ `.yaml` parity via the same `git diff --quiet` gate that already polices `.agent-src/` vs `.agent-src.uncompressed/`.

## Prerequisites

- [x] Read the PR #151 review thread ("Punkt 4 — Markdown Corpus bleibt trotz Härtung ein Sonderformat") — captured in the conversation transcript that produced this roadmap
- [x] Read [`.augment/rules/low-impact-corpus-privacy-floor.md`](../../.augment/rules/low-impact-corpus-privacy-floor.md) — the privacy floor is **content-based** and is unchanged by this work; the redactor still scans entry text, not file format
- [x] Read [`docs/contracts/ai-council-config.md`](../../docs/contracts/ai-council-config.md) § "Decision routing by impact" — the routing semantics are unchanged; only the source format flips
- [x] Read [`scripts/ai_council/low_impact_corpus.py`](../../scripts/ai_council/low_impact_corpus.py) — the current parser; understand `parse_corpus_strict` vs the two lenient loaders, and the three runtime callsites (`necessity.py`, `low_impact.py`, `learn_low_impact_preview.py`)
- [x] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

The Markdown corpus parser was hardened in PR #150 (typed `CorpusParseError`, 7 fixtures, lenient + strict modes). That removed the **acute** breakage risk but kept the **structural** risk: a human-authored Markdown format with machine-semantic bullets means every authoring variation (em-dash vs hyphen, bullet style, heading rename, whitespace drift) is a potential parser bomb. The classifier degrades to `()` on parse failure, which is safer than crashing but worse than enforcing a schema.

This roadmap flips the **runtime** source to YAML while keeping the **authoring** surface in Markdown. Reviewers still see the `.md` diff for human review; the runtime classifier and redactor read only the generated `.yaml`. The pattern is identical to `.agent-src/` ↔ `.agent-src.uncompressed/`: `task sync` regenerates, `task consistency` enforces parity via `git diff --quiet`.

**Decisions locked from the PR #151 follow-up conversation:**
- Lockfile is **committed** (`agents/low-impact-decisions.lock.yaml`), not gitignored — reviewers see drift in the PR diff
- Branch is **stacked on `feat/implement-pr150-feedback`** — corpus YAML is orthogonal to the confidence-gate but ships after it
- Privacy floor stays unchanged — the redactor still runs on entry text content, the format flip is below that layer
- Markdown parser stays — moves from a runtime tool to a build tool, the existing fixtures still validate it

This roadmap is **work-only** — no version pins, no tag plans, no release dates.

- **Sibling roadmap:** [`step-2-feedback-followup.md`](step-2-feedback-followup.md) — independent; can interleave.

## Phase 1: Build script + YAML schema

Define the schema, write the compiler, validate round-trip — before any runtime callsite flips.

- [x] **Step 1 — Schema design.** Write the YAML schema as a docstring at the top of the new `scripts/ai_council/compile_corpus.py`. Shape: `schema_version: 1`, top-level `validated`, `probation`, `anti_examples` lists each holding objects with `{phrase, normalised, timestamp?, source_line?}`, plus a `provenance` block with `source_sha` (SHA-256 of the parsed Markdown bytes) and `last_upstreamed` (mirrored from the Markdown's `last-upstreamed:` field). Schema lives in the compiler module — no separate JSON Schema file yet (defer until a second consumer needs it).
- [x] **Step 2 — Compiler implementation.** New `scripts/ai_council/compile_corpus.py` with `compile(source_md: Path, out_yaml: Path) -> None` and a `__main__` CLI (`python3 -m scripts.ai_council.compile_corpus --source agents/low-impact-decisions.md --out agents/low-impact-decisions.lock.yaml`). Uses `parse_corpus_strict()` as the parsing primitive — no new parsing code, just serialisation. Deterministic output: sorted keys, stable timestamps, trailing newline.
- [x] **Step 3 — Generate the initial lockfile.** Run the compiler against the current `agents/low-impact-decisions.md` and commit the resulting `agents/low-impact-decisions.lock.yaml`. Verify the YAML round-trips back to the same set of validated / probation / anti-example phrases by hand (eyeball the file once before the next phase wires runtime consumers).
- [x] **Step 4 — Tests.** New `tests/ai_council/test_compile_corpus.py`. Cases: empty corpus → empty lists, populated corpus → expected entries, idempotency (compile → load YAML → compile again → byte-identical), parse error in Markdown → compiler raises (does NOT write a partial YAML), unknown fields in source → ignored (forward-compat). Reuse the existing 7 fixtures from `tests/ai_council/test_low_impact_corpus.py`.

## Phase 2: Switch runtime to YAML

Only after Phase 1 lands. Flip the three callsites; keep the Markdown parser strictly as a build tool.

- [x] **Step 1 — YAML loader primitive.** Add `load_corpus_lock(yaml_path: Path) -> CorpusParseResult` to `scripts/ai_council/low_impact_corpus.py` (same module, parallel to `parse_corpus_strict`). Returns the same `CorpusParseResult` dataclass — so downstream consumers don't change shape. Missing file → empty result (matches current Markdown behaviour).
- [x] **Step 2 — Switch `load_validated_phrases` + `load_anti_example_phrases`.** Both lenient loaders flip to read `agents/low-impact-decisions.lock.yaml` instead of running the Markdown parser. If the YAML is missing (fresh clone before `task sync`), fall back to `()` — same degradation contract as today's lenient Markdown path. Add a one-line docstring note flagging the build-tool boundary.
- [x] **Step 3 — Update `learn_low_impact_preview.py` callsites.** This is the only place that still needs strict Markdown parsing (the preview command runs **before** the lockfile is regenerated). Document the contract in a docstring: "preview runs against the Markdown source-of-truth; `task sync` then regenerates the lockfile."
- [x] **Step 4 — Tests.** Add `test_low_impact_corpus_yaml.py` covering: YAML-load equivalence with Markdown-parse (against each fixture), missing YAML → empty result, malformed YAML → typed error (not silent empty), runtime callers (`necessity.load_validated_phrases`, `low_impact`) read YAML not Markdown. Existing tests against the Markdown parser remain — they now test the build tool.

## Phase 3: CI gate + documentation

Close the loop: `task consistency` enforces the lockfile is fresh, docs explain the new pipeline, CHANGELOG records the surface delta.

- [x] **Step 1 — Task wiring.** Add `compile-corpus` task to `taskfiles/content.yml` next to `consistency` — single `cmd: python3 -m scripts.ai_council.compile_corpus`. Insert it into the `consistency` task's `cmds:` list **before** the final `git diff --quiet` so stale lockfiles fail CI on the same gate that catches stale `.agent-src/`. Also wire it into `task sync` so `sync` regenerates the lockfile alongside other derived outputs.
- [x] **Step 2 — Documentation.** New "Corpus build pipeline" section in `docs/contracts/ai-council-config.md` immediately under "Decision routing by impact": explain `.md` = human source / `.yaml` = runtime source, the build-time boundary, the CI gate, and the fall-back behaviour for fresh clones. Update [`.augment/rules/low-impact-corpus-privacy-floor.md`](../../.augment/rules/low-impact-corpus-privacy-floor.md) only if the redaction-pass language references the file format (verify first; the redactor is content-based so no change is expected).
- [x] **Step 3 — CHANGELOG.** New `[Unreleased]` bullet: "Low-impact corpus: runtime now reads `agents/low-impact-decisions.lock.yaml`; Markdown source becomes build-time-only. `task consistency` enforces parity." Surface delta count if applicable.
- [x] **Step 4 — Local CI green.** `task ci` end-to-end on the new branch — corpus compile runs, lockfile is fresh, tests pass, consistency gate green. Capture duration line.
- [x] **Step 5 — Push + verify remote CI.** Branch `feat/corpus-yaml-lockfile` pushed to `origin` (commits `50ffcb80`, `c8a4b9c3`, `5a35b903`). Remote CI workflows (`consistency`, `skill-lint`, `tests`) are `pull_request`-only — they will start once the stacked PR against `feat/implement-pr150-feedback` is opened. Local `task ci` ran green in Step 4 above; remote-CI verification is deferred to the PR.
