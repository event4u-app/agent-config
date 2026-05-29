---
name: condense-memory
description: "Use when shrinking always-loaded memory files (AGENTS.md, CLAUDE.md, .cursorrules) via telegraph grammar — refuses sensitive paths, round-trips via .original.md backup."
domain: process
execution:
  type: assisted
  handler: internal
  allowed_tools: [Bash]
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# condense-memory

<!-- cloud_safe: noop -->

> **Experimental.** Output-side telegraph dialect did not meet the kill-criterion in [`internal/bench/reports/telegraph-v1.md`](../../../bench/reports/telegraph-v1.md) (`vs_terse` median −9.27 %). Input-side memory condensation is an orthogonal use case: the savings target the always-loaded memory budget, not the reply stream. Treat ship-criterion as **per-target measurement**, not the v1 verdict.

## When to use

Use when:

- An always-loaded memory file (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `.windsurfrules`) is close to or above the host tool's char budget and the maintainer wants to recover input-token headroom.
- A consumer-shipped `templates/AGENTS.md` is failing the `agents-md-thin-root` cap and the pointer-extraction options are exhausted.
- The maintainer asks to "condense this memory file" or "shrink AGENTS.md" or names input-side telegraph.

## Do NOT

- Condense a reply, commit message, PR body, ticket summary, or any deliverable written *for* a human reader — those are carve-outs in [`telegraph-speak § Carve-outs`](../../rules/telegraph-speak.md) and stay verbatim.
- Condense a path matching the sensitive-file denylist (`.env*`, `.netrc`, `credentials*`, `secrets*`, `id_rsa*`, `*.pem|key|p12|pfx|crt|cer|jks`, `.ssh/*`) — the script refuses with `SensitivePathError` and so should you.
- Condense a generated file (`.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`) — edit the source in `.agent-src.uncondensed/` and regenerate via the package's sync + generate-tools scripts (`scripts/condense.sh --sync` + `scripts/condense.py --generate-tools`).
- Hand-edit a condensed memory file in place — run `--decondense` first; the next condense pass refuses on body-hash drift (`CondensationRefused`).
- Commit the condensed file without committing the matching `.original.md` backup — round-trip breaks otherwise.

## Procedure

1. **Analyse the target first.** Before any write, **inspect** the target with `view` or `wc -l` to confirm it is an always-loaded memory file (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `.windsurfrules`), is not generated, and has prose paragraphs to condense (a pointer-only Thin-Root file may net near-zero). Skip the rest of the procedure if any check fails.
2. **Check denylist gate.** Run `python3 scripts/condense_memory.py <path> --check` — exit 0 = safe; exit 2 = denylist hit, stop and surface the refusal.
3. **Record baseline.** `wc -c <path>` — capture pre-condensation char count for the commit message.
4. **Condense.** `python3 scripts/condense_memory.py <path>`. The script writes `<path>.original.md` (verbatim backup) and rewrites `<path>` with `original_sha256:` + `condensed_at:` frontmatter.
5. **Inspect the diff.** Eyeball every Iron-Law fence, numbered-options block, code fence, backtick span, `❌`/`⚠️`/`✅` line, and frontmatter pair — all must be byte-identical. Body prose may have lost articles (`the`/`a`/`an`) and auxiliaries (`is`/`are`/`was`/`be`/`that`/`which`).
6. **Validate idempotency.** Re-run `python3 scripts/condense_memory.py <path>` — clean re-run is a no-op (body hash matches). Non-zero exit = stop, escalate.
7. **Commit both files together.** `<path>` and `<path>.original.md` ship as a pair. The backup is the rollback path; never commit one without the other.
8. **Rollback path.** If readability fails review at step 5: `python3 scripts/condense_memory.py <path> --decondense` restores the backup and deletes `.original.md`.

## Output format

The maintainer-facing report after invoking the script MUST contain, in this order:

1. **Diff line** — pre/post `wc -c` as a single line (`AGENTS.md: 2,891 → 2,453 chars (−15.1 %)`).
2. **Backup path** — full path of the `.original.md` backup so the maintainer can verify it landed on disk.
3. **Carve-out check** — one line confirming the seven carve-out classes round-tripped (`carve-outs: 7 classes preserved · idempotent re-run: clean`).
4. **Exit-code surface** — on failure, surface the verbatim exit code and exception name (`SensitivePathError → exit 2`, `CondensationRefused → exit 3`, `FileNotFoundError → exit 4`); do not paraphrase.

Do **not** narrate the algorithm, the grammar rules, or the carve-out theory — the rule and this skill document the contract; the output reports the result.

## Carve-outs — byte-for-byte preserved

Mirrors the seven carve-out classes in [`telegraph-speak`](../../rules/telegraph-speak.md). The condensation engine in [`scripts/condense_memory.py`](../../../scripts/condense_memory.py) preserves:

1. **Triple-backtick fences** — any language, any depth.
2. **Numbered-options lines** — `^>?\s*\d+\.\s` plus the `**Recommendation:**` / `**Empfehlung:**` label.
3. **Backtick spans** — file paths, command names, identifiers inside body prose.
4. **Status / error markers** — lines starting with `❌`, `⚠️`, `✅`.
5. **Iron-Law ALL-CAPS lines** — `^[A-Z][A-Z0-9 ,.\-_/']{3,}$`.
6. **Frontmatter blocks** — `---` fence pairs at the head of the file.
7. **Mode markers** per [`role-mode-adherence`](../../rules/role-mode-adherence.md).

Mangling any of these breaks the Iron-Law surface the host tool reads. The unit tests in `tests/test_condense_memory.py` lock each carve-out class as a regression case.

## Idempotency contract — Step 9 guard

The script is **idempotent on clean re-runs**: running it twice on the same target is a no-op because the body hash matches the recondensed hash. The script **refuses** on **body drift**:

| State | Outcome |
|---|---|
| No frontmatter SHA marker | Condense + write backup + inject SHA. |
| SHA marker present, body re-condenses to same hash | No-op (return target unchanged). |
| SHA marker present, body hash diverged | **Refuse** with `CondensationRefused` exit 3. |

If you need to edit a condensed memory file, run `--decondense` first, edit the restored `.original.md` content, then re-run the condenseor. Never hand-edit the condensed body — the next CI run will either silently corrupt your edit (if it happens to re-condense to the same shape) or hard-fail the next condense pass.

## Sensitive-path gate

Every read path passes through [`scripts/validate_safe_paths.py`](../../../scripts/validate_safe_paths.py) `assert_safe()` before bytes leave disk. The gate is the security floor for Phase 2 (input-side condensation) per `step-16-telegraph-substance.md` Phase 0; rollback of the gate is rollback of this skill.

CLI exit codes:

- `0` — condense / decondense / check succeeded.
- `2` — `SensitivePathError` (path matched denylist).
- `3` — `CondensationRefused` (body hash diverged from frontmatter SHA).
- `4` — `FileNotFoundError` (no `.original.md` backup to restore).

## Gotchas

- **Body-hash drift after manual edit** — hand-editing the condensed body breaks the `original_sha256:` invariant. The next condense pass refuses with `CondensationRefused` (exit 3). Recovery: `--decondense`, edit the restored body, re-condense.
- **`.original.md` backup missing on `--decondense`** — exit 4 (`FileNotFoundError`). Either someone deleted the backup or `--decondense` already ran. Restore from git history; never regenerate the backup by hand (the regenerated content would not be byte-identical).
- **Denylist false positive** — a sensitive-looking filename outside the denylist surface (project-specific naming) will still pass `assert_safe()`. The denylist is necessary but not sufficient; the maintainer is responsible for never feeding secrets to the condenseor.
- **Frontmatter ordering with existing keys** — if the target already has frontmatter, the condenseor preserves existing keys, drops any prior `original_sha256:` / `condensed_at:` entries, and appends the new pair. Other agents reading the file should treat the SHA + timestamp pair as the canonical condensation marker, not the file size.
- **Negative savings on pointer-heavy files** — a `templates/AGENTS.md` that already follows Thin-Root (≥ 40 % pointers, ≥ 60-char *why*-clauses) has little prose left to drop; condensation may net near-zero or even add bytes via frontmatter. Run [`agents-md-thin-root`](../agents-md-thin-root/SKILL.md) first to maximise pointer share, then measure whether this skill still pays.
- **Generated-tree drift** — condensing `.agent-src.uncondensed/templates/AGENTS.md` does NOT propagate to `.augment/`, `.claude/`, etc. until the package's sync + generate-tools scripts run (`scripts/condense.sh --sync` + `scripts/condense.py --generate-tools`). Always regenerate after condensing a templated file.

## Measurement — when to condense

There is no published `telegraph-v2` baseline for input-side savings yet (Step 11 of `step-16-telegraph-substance.md` ships that). Until then, the maintainer judges per-target whether the condensation pays its readability cost. Suggested workflow:

1. `wc -c <path>` before — record baseline char count.
2. `python3 scripts/condense_memory.py <path>` — condense + back up.
3. `wc -c <path>` after — record post-condensation char count.
4. Eyeball the diff: does the prose stay legible? Are all Iron-Law fences intact?
5. If yes → commit both `<path>` and `<path>.original.md`. If no → `--decondense`.

A future `telegraph-v2.md` will tabulate the realised input-token saving against the `agents-md-thin-root` 40 % pointer-ratio constraint so the maintainer has a numerical floor.

## Cross-references

- [`telegraph-speak`](../../rules/telegraph-speak.md) — runtime rule the script mirrors for input-side targets; `telegraph.speak_scope` does **not** gate this script (input-side runs regardless).
- [`scripts/validate_safe_paths.py`](../../../scripts/validate_safe_paths.py) — Phase 0 gate; ported from upstream Telegraph `63a91ec`.
- [`scripts/condense_memory.py`](../../../scripts/condense_memory.py) — implementation.
- [`tests/test_condense_memory.py`](../../../tests/test_condense_memory.py) — regression locks for each carve-out + idempotency + denylist.
- [`docs/contracts/condensation-default-kill-criterion.md`](../../../docs/contracts/condensation-default-kill-criterion.md) — v1 verdict (output-side; informs but does not gate this skill).
- [`agents-md-thin-root`](../agents-md-thin-root/SKILL.md) — caps the consumer-shipped `templates/AGENTS.md`; this skill is one tool to land under the cap.
