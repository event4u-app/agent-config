# YAML Round-Trip Spike — Verdict

> Phase 1 Step 7 of `agents/roadmaps/road-to-typescript-only-scripts.md`.
> Originally framed as a "ruamel.yaml → npm `yaml`" risk. The survey below
> shows that framing was wrong: there is **no ruamel usage anywhere** — the
> comment-preserving round-trip layer is `src/scripts/sync_yaml_rt.py`, a
> **self-contained, stdlib-only, hand-written narrow-subset parser**, and it
> ports 1:1 to TypeScript with no external library.

## 1. Usage survey

Grep surface: `src/scripts/` + `src/agent-src/templates/scripts/` for
`import yaml`, `from yaml`, `ruamel`, `safe_load`, `safe_dump`,
`yaml.load`, `yaml.dump` (2026-06-11, branch `feat/py2ts-phase1-infra`).

| Category | Files | What it is |
|---|---:|---|
| (a) `sync_yaml_rt` own parser | 1 (+2 consumers) | `src/scripts/sync_yaml_rt.py` — stdlib-only round-trip parser/emitter/merger for `.agent-settings.yml`. Consumed by `src/scripts/sync_agent_settings.py` and `src/scripts/_cli/cmd_settings_check.py`. |
| (b) PyYAML read-only consumers | 90 | 81 under `src/scripts/` + 9 under `src/agent-src/templates/scripts/`. All `safe_load` only — frontmatter readers, settings readers, linters, manifest loaders. |
| (c) PyYAML writers (`safe_dump`) | 6 | Listed below — these risk formatting drift on port. |
| (d) ruamel users | **0** | Verified: `grep -rn ruamel` over both trees → no hits. The council's "ruamel showstopper" has no code behind it. |

Mention-only matches (not consumers): `audit_cloud_compatibility.py`
(regex pattern for a linter), `render_value_md.py` / `render_benchmark_md.py`
(local helper functions named `safe_load` that read JSON, not YAML).

### Category (c) — the six writer scripts, explicitly

| Script | What it dumps | Drift risk |
|---|---|---|
| `src/scripts/new_skill.py` | New-skill frontmatter block (`sort_keys=False, allow_unicode=True`) | New files only — no existing bytes to preserve. Low. |
| `src/scripts/move_artefact.py` | Rewritten artefact frontmatter after a move (`sort_keys=False, allow_unicode=True`) | Touches existing frontmatter — PyYAML's quote/wrap style differs from `yaml.stringify`. **Flag for its port phase.** |
| `src/scripts/generate_pack_manifests.py` | Generated pack-manifest YAML (`sort_keys=True`, deterministic header) | Generated output with goldens — port must match or goldens regenerate once. **Flag.** |
| `src/scripts/measure_projection_bytes.py` | Temporary rewrite of `agents/.agent-tools.yml`, restored on exit | Transient file, restored from the original string. Low. |
| `src/scripts/config/session_profiles.py` | Whole `.agent-settings.local.yml` overlay (atomic write) | Gitignored per-machine file, machine-managed (no user comments preserved today either). Low-medium. |
| `src/scripts/ai_council/compile_corpus.py` | Deterministic corpus lock YAML (`dump_lock_yaml`, `width=10_000`) | Determinism is asserted by tests — port must reproduce or the lock format is re-baselined once. **Flag.** |

## 2. Spike results

### 2.1 `sync_yaml_rt` 1:1 port (`tests/spikes/yaml_rt_spike.ts`)

The core round-trip property (parse → emit reproduces every user line
character-for-character) was ported to TypeScript — ~430 lines, **zero
dependencies**, mirroring the Python module function-for-function
(tokeniser, inline-comment splitter honouring quote boundaries, mapping/
list line parsers, indent-stack tree builder, verbatim emitter).

Fixture corpus: `tests/spikes/fixtures/yaml-rt/` — 12 fixtures derived
from the documented subset and from the `src/config/agent-settings.template.yml`
shape (synthetic/generic values):

| Fixture | Nasty case covered |
|---|---|
| `01-basic-mapping.yml` | 2-space block mapping, header comment |
| `02-inline-comments.yml` | inline comments after values, comment-only values, `#` inside quotes |
| `03-blank-line-runs.yml` | multi-blank-line runs, trailing comment + blank |
| `04-block-list.yml` | block lists, item inline comments, bare `-` item |
| `05-inline-flat-list.yml` | inline flat lists `[a, b, c]`, empty `[]` |
| `06-four-space-indent.yml` | 4-space indent |
| `07-crlf.yml` | CRLF-terminated file |
| `08-duplicate-keys.yml` | duplicate keys, last-wins |
| `09-quoted-scalars.yml` | quoted scalars, `~`/`null`/`None`, bools, quoted key with `:` |
| `10-agent-settings-shape.yml` | real template shape (comment banners, nested sections, list) |
| `11-no-trailing-newline.yml` | final line without terminator |
| `12-deep-nesting-mixed.yml` | deep nesting, comments between siblings |

Differential test (`tests/spikes/yaml_rt_spike.test.ts`, 31 tests, green):

- **Round-trip property:** for every fixture except the duplicate-keys one,
  TS `emit(parse(x)) === x` byte-for-byte (CRLF and missing-final-newline
  included).
- **Differential parity:** for **all 12** fixtures, TS output is
  byte-identical to the Python reference output
  (`tests/spikes/yaml_rt_py_driver.py` → `sync_yaml_rt.parse`/`emit`).
- **Duplicate keys** are round-trip *lossy by design* in **both**
  implementations identically: last wins, the earlier line and its leading
  comment block are dropped; the result is idempotent. (Verified against
  Python: `'a: 1\na: 2\nb: 3\n'` → `'a: 2\nb: 3\n'` on both sides.)
- **Error parity** spot-checked: tabs in indent and inconsistent dedent
  ("over-indent") raise on both sides; mixed per-line EOLs are preserved.

### 2.2 PyYAML readers → npm `yaml` (`tests/spikes/pyyaml_vs_npm.test.ts`)

Representative real files — `Taskfile.yml`, `taskfiles/engine.yml`,
`src/config/agent-settings.template.yml`, `.github/workflows/consistency.yml`
— parsed with PyYAML `safe_load` and with npm `yaml` (`YAML.parse`),
canonicalised to sorted compact JSON on both sides: **semantically equal**
(5 tests, green).

Two load-bearing findings for the production port:

1. **YAML version pin.** PyYAML implements YAML 1.1: `on:` (workflow files)
   resolves to boolean `true`, `yes`/`off` are booleans. npm `yaml`
   defaults to YAML 1.2 (those stay strings). Every PyYAML replacement
   must pass `{ version: '1.1' }` to keep semantics identical. Without
   the pin, the workflow fixture fails.
2. Non-string keys (boolean `true` from `on:`) must be canonicalised the
   same way on both sides when comparing (Python dict key `True` ↔ JS
   object key `"true"`); with that, equality holds.

## 3. Verdict

- **Comment-preserving round-trip = self-contained 1:1 port of
  `sync_yaml_rt.py`. NO external library needed.** The council's
  "ruamel.yaml has no npm equivalent" showstopper is **moot** — ruamel is
  used nowhere, and the actual round-trip layer is a hand-written
  stdlib-only parser whose core property has now been reproduced
  byte-for-byte in TypeScript against a 12-fixture differential corpus.
- **PyYAML read-only consumers (90 files) → npm `yaml` with
  `{ version: '1.1' }`.** Semantic equality verified on real repo files.
- **PyYAML writers (6 files) → npm `yaml` `stringify`,** with a
  formatting-drift review in each script's own port phase. `new_skill.py`
  and `measure_projection_bytes.py` are low-risk (new/transient output);
  `move_artefact.py`, `generate_pack_manifests.py`,
  `compile_corpus.py` (and to a lesser degree `session_profiles.py`)
  emit bytes that other tooling or goldens see — handle any
  PyYAML-vs-`yaml.stringify` style differences as documented divergences
  (`docs/migration/divergences/`) or one-time golden re-baselines.

## 4. What the production port (Phase 5) must cover beyond the spike

The spike ports **`parse` + `emit` only**. The production
`sync_yaml_rt.ts` additionally needs:

1. **`merge(user, template)`** — additive merge: insert-position logic
   honouring user reordering, blank-line separator insertion for
   top-level sections, EOL normalisation of cloned template subtrees
   (`_detect_eol`, `_normalize_line_endings`, `_ensure_blank_separator`,
   `_find_insert_pos`).
2. **`heal_user_block(user, template)`** — legacy `_user._user.foo`
   corruption healer: leaf collection with `_user`-segment stripping,
   re-homing into template paths, orphan rebuild, idempotency.
3. **`sync(user_text, template_text)`** — the pipeline entry point
   (parse → heal → merge → emit).
4. **Synthetic-node rendering** under merge (the spike includes
   `renderSyntheticHeader` but no caller exercises it — production tests
   must).
5. **Full error-message parity or documented divergence** — the Python
   `ValueError` strings (line numbers included) are user-visible via
   `sync_agent_settings.py` / `cmd_settings_check.py`; decide verbatim
   parity vs. documented divergence.
6. **The existing Python test suite as the conformance oracle** —
   `tests/test_sync_agent_settings.py`, `tests/test_sync_round_trip.py`
   and friends should be mirrored (or run differentially, as in this
   spike) until the Python side is deleted.
7. **Lone-`\r` line endings** — Python `splitlines` recognises more
   terminators (`\v`, `\f`, `\x1c`…) than the spike's `\n`/`\r\n`/`\r`
   splitter. The spike handles `\r`; the exotic terminators are outside
   the documented subset — confirm and document as a divergence.

## 5. Verification evidence

```
npx vitest run tests/spikes/

 ✓ tests/spikes/pyyaml_vs_npm.test.ts (5 tests)
 ✓ tests/spikes/yaml_rt_spike.test.ts (31 tests)

 Test Files  2 passed (2)
      Tests  36 passed (36)
```

Environment: node v25.9.0, npm `yaml` 2.9.0, python3 3.9.6, PyYAML 6.0.3.
