---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: road to one tool-id list for the installer

> **Stub — not active work.** Found on 2026-11-12 while making `upgrade`
> redeploy only the recorded tools (`perf/quiet-fast-install`). The fix touches
> `src/scripts/install`, whose bytes `check_pack_size` pins by fingerprint, and
> every re-pin of that file so far was made on the owner's approval in session,
> so it did not ride along with that change.

**The defect.** The bash wrapper `src/scripts/install` validates `--tools`
against `VALID_TOOLS` (16 ids). `install.ts` `_VALID_TOOLS` deploys 23: `qoder`,
`opencode`, `trae`, `antigravity`, `codebuddy`, `droid` and `warp` are missing
from the wrapper. So `agent-config global --tools=antigravity` (or `init` with
any of the seven) exits 1 with `Unknown tool ID` before the installer runs,
although a default `--tools=all` install deploys to all seven.

**Evidence.** On `bdf47e1bd4`:
`HOME=$(mktemp -d) agent-config global --tools=claude-code,antigravity --dry-run --no-ui`
prints `❌  Unknown tool ID: antigravity`.

**What closes it.**

1. Add the seven ids to `VALID_TOOLS` and to `list_tools` in
   `src/scripts/install`.
2. A test pins the wrapper's list equal to `install.ts` `_VALID_TOOLS`, so the
   two cannot drift again (or the wrapper reads the list from one source).
3. Re-pin `src/scripts/install` in `src/scripts/check_pack_size.ts` (path, size,
   fingerprint, dated note) — on the owner's approval, as every earlier re-pin.
