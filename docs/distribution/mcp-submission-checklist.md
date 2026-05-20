# MCP registry submission checklist

> One-shot procedure for opening a submission PR to an external MCP
> registry. The manifest under `dist/mcp/` is the source of truth;
> this file is what the maintainer runs through at submission time.

## Before submitting

1. Confirm the npm package is published with **2FA-required** for new
   releases. A downstream user clicking the registry link must not
   land on a hijacked release.
2. Re-run the builder so payloads reflect the current package:
   ```bash
   python3 scripts/build_discovery_manifest.py --write --strict
   python3 scripts/build_mcp_registry_manifest.py --write --strict
   python3 scripts/lint_mcp_registry_manifest.py
   ```
3. Confirm `dist/mcp/registry-manifest.json` `package.version`
   matches the latest published npm version (or the version about to
   be released in the same change set).

## Per-registry steps

### `awesome-mcp-servers`

- Upstream: <https://github.com/punkpeye/awesome-mcp-servers>
- Target file: `README.md`, section **"Server Frameworks / Agents"**.
  *Verify the section heading before each submission — upstream
  reorganises occasionally.*
- Payload to paste: the row in `dist/mcp/awesome-mcp-servers.row.md`.
  ```bash
  cat dist/mcp/awesome-mcp-servers.row.md
  ```
- Open the upstream PR. Title: `Add @event4u/agent-config`.
- After opening, update `dist/mcp/registry-manifest.json`:
  ```jsonc
  {
    "id": "awesome-mcp-servers",
    "status": "pending",     // → "listed" once merged, "rejected" if closed
    "submitted_at": "YYYY-MM-DD",
    "pr_url": "https://github.com/punkpeye/awesome-mcp-servers/pull/NNN",
    "last_verified": null
  }
  ```
  Then commit the manifest change as a follow-up.

### `mcp-cloudflare-catalogue`

- Upstream: <https://github.com/cloudflare/mcp-server-cloudflare>
- Target file: the catalogue JSON file the repository documents
  (verify path against the upstream README before each submission).
- Payload to paste: the JSON object in
  `dist/mcp/mcp-cloudflare-catalogue.json`.
  ```bash
  cat dist/mcp/mcp-cloudflare-catalogue.json
  ```
- Same lifecycle update as above once the PR is open.

## After the upstream PR closes

The submission PR can end in three states. Each maps to a `status`
value in the manifest. Do **not** silently drop entries.

- **merged** → `status: "listed"`, set `last_verified` to today, open
  the live listing once and confirm the link still resolves to this
  package. Refresh `last_verified` every release.
- **closed without merge** → `status: "rejected"`. Leave
  `submitted_at` and `pr_url` populated so the rejection is
  auditable. Do **not** auto-resubmit; the next attempt is a
  judgment call by the maintainer.
- **listing removed later** → `status: "unlisted"`. Refresh
  `last_verified` to the date of removal so the audit trail is
  intact.

`scripts/lint_mcp_registry_manifest.py` exits non-zero if any
registry entry uses a value outside the four-state enum.

## Submitting to a new registry

The schema's `id` vocabulary is closed (`awesome-mcp-servers`,
`mcp-cloudflare-catalogue`). Adding a third registry is a
**schema-version bump**:

1. Update `docs/contracts/mcp-registry-manifest.schema.json`:
   add the new `id` value, bump the top-level `version` const if
   the field shape changes.
2. Update `scripts/build_mcp_registry_manifest.py`'s
   `REGISTRIES_SEED` with the new entry (id, label,
   listing_format, submission_url, rendered_payload).
3. Add a new renderer for the rendered payload (Markdown row,
   JSON entry, or whatever the new registry expects).
4. Add a new payload-shape check to
   `scripts/lint_mcp_registry_manifest.py`.
5. Land it as its own PR so the schema change is reviewed
   independently of the submission itself.
