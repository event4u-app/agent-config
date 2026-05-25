---
name: compress-memory
description: "Use when shrinking always-loaded memory files (AGENTS.md, CLAUDE.md, .cursorrules) via caveman grammar — refuses sensitive paths, round-trips via .original.md backup."
source: package
domain: process
execution:
  type: assisted
  handler: internal
  allowed_tools: [Bash]
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# compress-memory

<!-- cloud_safe: noop -->

> **Experimental.** Output-side caveman dialect did not meet the kill-criterion in [`internal/bench/reports/caveman-v1.md`](../../../bench/reports/caveman-v1.md) (`vs_terse` median −9.27 %). Input-side memory compression is an orthogonal use case: the savings target the always-loaded memory budget, not the reply stream. Treat ship-criterion as **per-target measurement**, not the v1 verdict.

## When to use

Use when:

- An always-loaded memory file (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `.windsurfrules`) is close to or above the host tool's char budget and the maintainer wants to recover input-token headroom.
- A consumer-shipped `templates/AGENTS.md` is failing the `agents-md-thin-root` cap and the pointer-extraction options are exhausted.
- The maintainer asks to "compress this memory file" or "shrink AGENTS.md" or names input-side caveman.

## Do NOT

- Compress a reply, commit message, PR body, ticket summary, or any deliverable written *for* a human reader — those are carve-outs in [`caveman-speak § Carve-outs`](../../rules/caveman-speak.md) and stay verbatim.
- Compress a path matching the sensitive-file denylist (`.env*`, `.netrc`, `credentials*`, `secrets*`, `id_rsa*`, `*.pem|key|p12|pfx|crt|cer|jks`, `.ssh/*`) — the script refuses with `SensitivePathError` and so should you.
- Compress a generated file (`.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`) — edit the source in `.agent-src.uncompressed/` and regenerate via the package's sync + generate-tools scripts (`scripts/compress.sh --sync` + `scripts/compress.py --generate-tools`).
- Hand-edit a compressed memory file in place — run `--decompress` first; the next compress pass refuses on body-hash drift (`CompressionRefused`).
- Commit the compressed file without committing the matching `.original.md` backup — round-trip breaks otherwise.

## Procedure

1. **Analyse the target first.** Before any write, **inspect** the target with `view` or `wc -l` to confirm it is an always-loaded memory file (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `.windsurfrules`), is not generated, and has prose paragraphs to compress (a pointer-only Thin-Root file may net near-zero). Skip the rest of the procedure if any check fails.
2. **Check denylist gate.** Run `python3 scripts/compress_memory.py <path> --check` — exit 0 = safe; exit 2 = denylist hit, stop and surface the refusal.
3. **Record baseline.** `wc -c <path>` — capture pre-compression char count for the commit message.
4. **Compress.** `python3 scripts/compress_memory.py <path>`. The script writes `<path>.original.md` (verbatim backup) and rewrites `<path>` with `original_sha256:` + `compressed_at:` frontmatter.
5. **Inspect the diff.** Eyeball every Iron-Law fence, numbered-options block, code fence, backtick span, `❌`/`⚠️`/`✅` line, and frontmatter pair — all must be byte-identical. Body prose may have lost articles (`the`/`a`/`an`) and auxiliaries (`is`/`are`/`was`/`be`/`that`/`which`).
6. **Validate idempotency.** Re-run `python3 scripts/compress_memory.py <path>` — clean re-run is a no-op (body hash matches). Non-zero exit = stop, escalate.
7. **Commit both files together.** `<path>` and `<path>.original.md` ship as a pair. The backup is the rollback path; never commit one without the other.
8. **Rollback path.** If readability fails review at step 5: `python3 scripts/compress_memory.py <path> --decompress` restores the backup and deletes `.original.md`.

## Output format

The maintainer-facing report after invoking the script MUST contain, in this order:

1. **Diff line** — pre/post `wc -c` as a single line (`AGENTS.md: 2,891 → 2,453 chars (−15.1 %)`).
2. **Backup path** — full path of the `.original.md` backup so the maintainer can verify it landed on disk.
3. **Carve-out check** — one line confirming the seven carve-out classes round-tripped (`carve-outs: 7 classes preserved · idempotent re-run: clean`).
4. **Exit-code surface** — on failure, surface the verbatim exit code and exception name (`SensitivePathError → exit 2`, `CompressionRefused → exit 3`, `FileNotFoundError → exit 4`); do not paraphrase.

Do **not** narrate the algorithm, the grammar rules, or the carve-out theory — the rule and this skill document the contract; the output reports the result.

## Carve-outs — byte-for-byte preserved

Mirrors the seven carve-out classes in [`caveman-speak`](../../rules/caveman-speak.md). The compression engine in [`scripts/compress_memory.py`](../../../scripts/compress_memory.py) preserves:

1. **Triple-backtick fences** — any language, any depth.
2. **Numbered-options lines** — `^>?\s*\d+\.\s` plus the `**Recommendation:**` / `**Empfehlung:**` label.
3. **Backtick spans** — file paths, command names, identifiers inside body prose.
4. **Status / error markers** — lines starting with `❌`, `⚠️`, `✅`.
5. **Iron-Law ALL-CAPS lines** — `^[A-Z][A-Z0-9 ,.\-_/']{3,}$`.
6. **Frontmatter blocks** — `---` fence pairs at the head of the file.
7. **Mode markers** per [`role-mode-adherence`](../../rules/role-mode-adherence.md).

Mangling any of these breaks the Iron-Law surface the host tool reads. The unit tests in `tests/test_compress_memory.py` lock each carve-out class as a regression case.

## Idempotency contract — Step 9 guard

The script is **idempotent on clean re-runs**: running it twice on the same target is a no-op because the body hash matches the recompressed hash. The script **refuses** on **body drift**:

| State | Outcome |
|---|---|
| No frontmatter SHA marker | Compress + write backup + inject SHA. |
| SHA marker present, body re-compresses to same hash | No-op (return target unchanged). |
| SHA marker present, body hash diverged | **Refuse** with `CompressionRefused` exit 3. |

If you need to edit a compressed memory file, run `--decompress` first, edit the restored `.original.md` content, then re-run the compressor. Never hand-edit the compressed body — the next CI run will either silently corrupt your edit (if it happens to re-compress to the same shape) or hard-fail the next compress pass.

## Sensitive-path gate

Every read path passes through [`scripts/validate_safe_paths.py`](../../../scripts/validate_safe_paths.py) `assert_safe()` before bytes leave disk. The gate is the security floor for Phase 2 (input-side compression) per `step-16-caveman-substance.md` Phase 0; rollback of the gate is rollback of this skill.

CLI exit codes:

- `0` — compress / decompress / check succeeded.
- `2` — `SensitivePathError` (path matched denylist).
- `3` — `CompressionRefused` (body hash diverged from frontmatter SHA).
- `4` — `FileNotFoundError` (no `.original.md` backup to restore).

## Gotchas

- **Body-hash drift after manual edit** — hand-editing the compressed body breaks the `original_sha256:` invariant. The next compress pass refuses with `CompressionRefused` (exit 3). Recovery: `--decompress`, edit the restored body, re-compress.
- **`.original.md` backup missing on `--decompress`** — exit 4 (`FileNotFoundError`). Either someone deleted the backup or `--decompress` already ran. Restore from git history; never regenerate the backup by hand (the regenerated content would not be byte-identical).
- **Denylist false positive** — a sensitive-looking filename outside the denylist surface (project-specific naming) will still pass `assert_safe()`. The denylist is necessary but not sufficient; the maintainer is responsible for never feeding secrets to the compressor.
- **Frontmatter ordering with existing keys** — if the target already has frontmatter, the compressor preserves existing keys, drops any prior `original_sha256:` / `compressed_at:` entries, and appends the new pair. Other agents reading the file should treat the SHA + timestamp pair as the canonical compression marker, not the file size.
- **Negative savings on pointer-heavy files** — a `templates/AGENTS.md` that already follows Thin-Root (≥ 40 % pointers, ≥ 60-char *why*-clauses) has little prose left to drop; compression may net near-zero or even add bytes via frontmatter. Run [`agents-md-thin-root`](../agents-md-thin-root/SKILL.md) first to maximise pointer share, then measure whether this skill still pays.
- **Generated-tree drift** — compressing `.agent-src.uncompressed/templates/AGENTS.md` does NOT propagate to `.augment/`, `.claude/`, etc. until the package's sync + generate-tools scripts run (`scripts/compress.sh --sync` + `scripts/compress.py --generate-tools`). Always regenerate after compressing a templated file.

## Measurement — when to compress

There is no published `caveman-v2` baseline for input-side savings yet (Step 11 of `step-16-caveman-substance.md` ships that). Until then, the maintainer judges per-target whether the compression pays its readability cost. Suggested workflow:

1. `wc -c <path>` before — record baseline char count.
2. `python3 scripts/compress_memory.py <path>` — compress + back up.
3. `wc -c <path>` after — record post-compression char count.
4. Eyeball the diff: does the prose stay legible? Are all Iron-Law fences intact?
5. If yes → commit both `<path>` and `<path>.original.md`. If no → `--decompress`.

A future `caveman-v2.md` will tabulate the realised input-token saving against the `agents-md-thin-root` 40 % pointer-ratio constraint so the maintainer has a numerical floor.

## Cross-references

- [`caveman-speak`](../../rules/caveman-speak.md) — runtime rule the script mirrors for input-side targets; `caveman.speak_scope` does **not** gate this script (input-side runs regardless).
- [`scripts/validate_safe_paths.py`](../../../scripts/validate_safe_paths.py) — Phase 0 gate; ported from upstream Caveman `63a91ec`.
- [`scripts/compress_memory.py`](../../../scripts/compress_memory.py) — implementation.
- [`tests/test_compress_memory.py`](../../../tests/test_compress_memory.py) — regression locks for each carve-out + idempotency + denylist.
- [`docs/contracts/compression-default-kill-criterion.md`](../../../docs/contracts/compression-default-kill-criterion.md) — v1 verdict (output-side; informs but does not gate this skill).
- [`agents-md-thin-root`](../agents-md-thin-root/SKILL.md) — caps the consumer-shipped `templates/AGENTS.md`; this skill is one tool to land under the cap.
