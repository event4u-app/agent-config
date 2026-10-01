## Acceptance Criteria

- [x] AC-1 — No `verified: null` in `host_lowering.yaml`; `lint_hook_manifest`
      green.

      **Evidence (2026-10-01).** All 9 rows carry a `verified:` block; the only
      `verified: null` string in the file is line 13 of the header, which is the
      sentence defining the term. `lint_hook_manifest --as-of 2026-10-01` exits
      0 with **7** warnings, all of them the admissible
      `verified.host_version is null` note — down from 8, because the codex row
      now carries `0.148.0` from the live probe.

- [x] AC-2 — Every host×slot pair carries `block_exit` or a dated `null` with
      `docs_url`; the enforcement table regenerated; every `verified:` block
      carries `docs_digest` and the re-fetch job has run once.

      **Evidence (2026-10-01).** All 32 pairs dated — and enforced, not merely
      met: `_check_slot_answers` makes an undated pair an error and refuses a
      dated answer with no reachable citation. `check_enforcement_matrix --write`
      reports `already current`, i.e. regeneration is a no-op against the
      committed table. The re-fetch job has run twice: once with `--write` to
      record 8 digests, and once read-only, which returned 8 unchanged and so
      also demonstrates the digests are reproducible rather than volatile.

      **One honest subtraction from "every `verified:` block carries
      `docs_digest`": `cowork` does not, and must not.** Its `docs_url` is
      `null` because the 2026-09-29 sweep found no public hooks page for that
      host, so there is no body to hash. A digest there would be invented, which
      is the one thing this table refuses. The criterion is met as "every block
      that cites a page carries the digest of that page", 8 of 8, and the ninth
      is a `no-url` the watcher reports and skips by design. A test pins both
      halves so the exception cannot quietly become a gap.

- [x] AC-3 — Codex and copilot each have a row with a verified block or a
      dated zero, per D1.

      **Evidence (2026-10-01).** Both rows exist with dated, cited, digested
      `verified:` blocks and `slots: {}`. Codex additionally carries
      `probe_at: 2026-10-01` / `host_version: 0.148.0` from a live deny probe;
      copilot's `probe_at` stays null with the reason recorded (no CLI on this
      machine). D1 carries both URLs; D2 records the rule the probe produced —
      a documented refusal does not arm a binding, only a reproduced one does.

- [x] AC-4 — The install smoke test iterates every bound host.

      **Evidence (2026-10-01).** Three tests in
      `tests/install/global_install_hooks_smoke.test.ts` iterate
      `host_lowering.yaml` and assert the probe covers every host with
      `slots > 0`, covers nothing with `slots: {}`, and would fail on a newly
      bound host. Sensitivity proven by temporarily binding a `codex` slot in
      the real table and watching the assertion fail with its intended message.
