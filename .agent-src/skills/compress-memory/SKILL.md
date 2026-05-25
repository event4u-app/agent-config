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

> **Experimental.** Output-side caveman dialect did not meet kill-criterion in [`internal/bench/reports/caveman-v1.md`](../../../bench/reports/caveman-v1.md) (`vs_terse` median −9.27 %). Input-side memory compression is orthogonal use case: savings target always-loaded memory budget, not reply stream. Treat ship-criterion as **per-target measurement**, not v1 verdict.

## When to use

Use when:

- Always-loaded memory file (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `.windsurfrules`) close to or above host tool's char budget and maintainer wants to recover input-token headroom.
- Consumer-shipped `templates/AGENTS.md` failing `agents-md-thin-root` cap and pointer-extraction options exhausted.
- Maintainer asks to "compress this memory file" or "shrink AGENTS.md" or names input-side caveman.

## Do NOT

- Compress reply, commit message, PR body, ticket summary, or any deliverable written *for* human reader — those are carve-outs in [`caveman-speak § Carve-outs`](../../rules/caveman-speak.md) and stay verbatim.
- Compress path matching sensitive-file denylist (`.env*`, `.netrc`, `credentials*`, `secrets*`, `id_rsa*`, `*.pem|key|p12|pfx|crt|cer|jks`, `.ssh/*`) — script refuses with `SensitivePathError` and so should you.
- Compress generated file (`.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`) — edit source in `.agent-src.uncompressed/` and regenerate via package's sync + generate-tools scripts (`scripts/compress.sh --sync` + `scripts/compress.py --generate-tools`).
- Hand-edit compressed memory file in place — run `--decompress` first; next compress pass refuses on body-hash drift (`CompressionRefused`).
- Commit compressed file without committing matching `.original.md` backup — round-trip breaks otherwise.

## Procedure

1. **Analyse target first.** Before any write, **inspect** target with `view` or `wc -l` to confirm it is always-loaded memory file (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `.windsurfrules`), not generated, and has prose paragraphs to compress (pointer-only Thin-Root file may net near-zero). Skip rest of procedure if any check fails.
2. **Check denylist gate.** Run `python3 scripts/compress_memory.py <path> --check` — exit 0 = safe; exit 2 = denylist hit, stop and surface refusal.
3. **Record baseline.** `wc -c <path>` — capture pre-compression char count for commit message.
4. **Compress.** `python3 scripts/compress_memory.py <path>`. Script writes `<path>.original.md` (verbatim backup) and rewrites `<path>` with `original_sha256:` + `compressed_at:` frontmatter.
5. **Inspect diff.** Eyeball every Iron-Law fence, numbered-options block, code fence, backtick span, `❌`/`⚠️`/`✅` line, and frontmatter pair — all must be byte-identical. Body prose may have lost articles (`the`/`a`/`an`) and auxiliaries (`is`/`are`/`was`/`be`/`that`/`which`).
6. **Validate idempotency.** Re-run `python3 scripts/compress_memory.py <path>` — clean re-run is no-op (body hash matches). Non-zero exit = stop, escalate.
7. **Commit both files together.** `<path>` and `<path>.original.md` ship as pair. Backup is rollback path; never commit one without other.
8. **Rollback path.** If readability fails review at step 5: `python3 scripts/compress_memory.py <path> --decompress` restores backup and deletes `.original.md`.

## Output format

Maintainer-facing report after invoking script MUST contain, in this order:

1. **Diff line** — pre/post `wc -c` as single line (`AGENTS.md: 2,891 → 2,453 chars (−15.1 %)`).
2. **Backup path** — full path of `.original.md` backup so maintainer can verify it landed on disk.
3. **Carve-out check** — one line confirming seven carve-out classes round-tripped (`carve-outs: 7 classes preserved · idempotent re-run: clean`).
4. **Exit-code surface** — on failure, surface verbatim exit code and exception name (`SensitivePathError → exit 2`, `CompressionRefused → exit 3`, `FileNotFoundError → exit 4`); do not paraphrase.

Do **not** narrate algorithm, grammar rules, or carve-out theory — rule and this skill document contract; output reports result.

## Carve-outs — byte-for-byte preserved

Mirrors seven carve-out classes in [`caveman-speak`](../../rules/caveman-speak.md). Compression engine in [`scripts/compress_memory.py`](../../../scripts/compress_memory.py) preserves:

1. **Triple-backtick fences** — any language, any depth.
2. **Numbered-options lines** — `^>?\s*\d+\.\s` plus `**Recommendation:**` / `**Empfehlung:**` label.
3. **Backtick spans** — file paths, command names, identifiers inside body prose.
4. **Status / error markers** — lines starting with `❌`, `⚠️`, `✅`.
5. **Iron-Law ALL-CAPS lines** — `^[A-Z][A-Z0-9 ,.\-_/']{3,}$`.
6. **Frontmatter blocks** — `---` fence pairs at head of file.
7. **Mode markers** per [`role-mode-adherence`](../../rules/role-mode-adherence.md).

Mangling any of these breaks Iron-Law surface host tool reads. Unit tests in `tests/test_compress_memory.py` lock each carve-out class as regression case.

## Idempotency contract — Step 9 guard

Script is **idempotent on clean re-runs**: running it twice on same target is no-op because body hash matches recompressed hash. Script **refuses** on **body drift**:

| State | Outcome |
|---|---|
| No frontmatter SHA marker | Compress + write backup + inject SHA. |
| SHA marker present, body re-compresses to same hash | No-op (return target unchanged). |
| SHA marker present, body hash diverged | **Refuse** with `CompressionRefused` exit 3. |

If you need to edit compressed memory file, run `--decompress` first, edit restored `.original.md` content, then re-run compressor. Never hand-edit compressed body — next CI run will either silently corrupt your edit (if it happens to re-compress to same shape) or hard-fail next compress pass.

## Sensitive-path gate

Every read path passes through [`scripts/validate_safe_paths.py`](../../../scripts/validate_safe_paths.py) `assert_safe()` before bytes leave disk. Gate is security floor for Phase 2 (input-side compression) per `step-16-caveman-substance.md` Phase 0; rollback of gate is rollback of this skill.

CLI exit codes:

- `0` — compress / decompress / check succeeded.
- `2` — `SensitivePathError` (path matched denylist).
- `3` — `CompressionRefused` (body hash diverged from frontmatter SHA).
- `4` — `FileNotFoundError` (no `.original.md` backup to restore).

## Gotchas

- **Body-hash drift after manual edit** — hand-editing compressed body breaks `original_sha256:` invariant. Next compress pass refuses with `CompressionRefused` (exit 3). Recovery: `--decompress`, edit restored body, re-compress.
- **`.original.md` backup missing on `--decompress`** — exit 4 (`FileNotFoundError`). Either someone deleted backup or `--decompress` already ran. Restore from git history; never regenerate backup by hand (regenerated content would not be byte-identical).
- **Denylist false positive** — sensitive-looking filename outside denylist surface (project-specific naming) will still pass `assert_safe()`. Denylist necessary but not sufficient; maintainer responsible for never feeding secrets to compressor.
- **Frontmatter ordering with existing keys** — if target already has frontmatter, compressor preserves existing keys, drops any prior `original_sha256:` / `compressed_at:` entries, and appends new pair. Other agents reading file should treat SHA + timestamp pair as canonical compression marker, not file size.
- **Negative savings on pointer-heavy files** — `templates/AGENTS.md` already following Thin-Root (≥ 40 % pointers, ≥ 60-char *why*-clauses) has little prose left to drop; compression may net near-zero or even add bytes via frontmatter. Run [`agents-md-thin-root`](../agents-md-thin-root/SKILL.md) first to maximise pointer share, then measure whether this skill still pays.
- **Generated-tree drift** — compressing `.agent-src.uncompressed/templates/AGENTS.md` does NOT propagate to `.augment/`, `.claude/`, etc. until package's sync + generate-tools scripts run (`scripts/compress.sh --sync` + `scripts/compress.py --generate-tools`). Always regenerate after compressing templated file.

## Measurement — when to compress

No published `caveman-v2` baseline for input-side savings yet (Step 11 of `step-16-caveman-substance.md` ships that). Until then, maintainer judges per-target whether compression pays its readability cost. Suggested workflow:

1. `wc -c <path>` before — record baseline char count.
2. `python3 scripts/compress_memory.py <path>` — compress + back up.
3. `wc -c <path>` after — record post-compression char count.
4. Eyeball diff: does prose stay legible? Are all Iron-Law fences intact?
5. If yes → commit both `<path>` and `<path>.original.md`. If no → `--decompress`.

Future `caveman-v2.md` will tabulate realised input-token saving against `agents-md-thin-root` 40 % pointer-ratio constraint so maintainer has numerical floor.

## Cross-references

- [`caveman-speak`](../../rules/caveman-speak.md) — runtime rule script mirrors for input-side targets; `caveman.speak_scope` does **not** gate this script (input-side runs regardless).
- [`scripts/validate_safe_paths.py`](../../../scripts/validate_safe_paths.py) — Phase 0 gate; ported from upstream Caveman `63a91ec`.
- [`scripts/compress_memory.py`](../../../scripts/compress_memory.py) — implementation.
- [`tests/test_compress_memory.py`](../../../tests/test_compress_memory.py) — regression locks for each carve-out + idempotency + denylist.
- [`docs/contracts/compression-default-kill-criterion.md`](../../../docs/contracts/compression-default-kill-criterion.md) — v1 verdict (output-side; informs but does not gate this skill).
- [`agents-md-thin-root`](../agents-md-thin-root/SKILL.md) — caps consumer-shipped `templates/AGENTS.md`; this skill is one tool to land under cap.
