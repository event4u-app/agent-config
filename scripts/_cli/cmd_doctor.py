"""``agent-config doctor`` — install + manifest health report.

Phase 4 of road-to-multi-package-coexistence (drift detection) and
Phase 2 of road-to-surface-discipline (diagnostic hub). Read-only
sibling to ``prune``/``validate``: walks the project manifest and the
on-disk deploy roots, runs a battery of health checks, and produces:

Drift categories (manifest ↔ filesystem):

* ``missing``   — manifest entry has a ``path`` that is **not** on disk.
* ``modified``  — manifest entry records a ``sha256`` that does not
  match the current bytes on disk.
* ``foreign``   — file present under one of the ``deploy_roots`` that
  no manifest entry claims (potential neighbour-tool drift).
* ``tag-drift`` — manifest-claimed ``.md`` file carries a frontmatter
  ``package:`` value that disagrees with this package's identifier
  (P5.2). Hand-edited tags or accidental cross-package writes show up
  here; files without frontmatter are skipped (P5.1 contract).

Health checks (nine categories, see :data:`CHECK_IDS`):
scope · manifest-integrity · lockfile-freshness · bridge-drift ·
mcp-mode · mcp-beta-readiness · offline-readiness · python-runtime ·
unsupported-combos.
Each emits a structured ``{id, status, message, remedy}`` record with
``status`` ∈ ``ok`` / ``warn`` / ``fail`` (rendered ``✅`` / ``⚠️`` /
``❌``). ``--check <id>`` runs a single check.

Exit codes: ``0`` (clean) · ``1`` (drift or any ``fail`` check) · ``2``
(error such as "manifest missing"). Both human and ``--json`` output
emit the drift category lists and the structured checks array. Every
drift entry carries a one-line ``fix`` hint (P4.3).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from scripts._lib import installed_tools


class _Sentinel:
    """Tiny stand-in for a private sentinel value type."""

    __slots__ = ()


#: Returned by :func:`_read_inline_package_tag` when the file is out
#: of scope for tag-drift detection (no ``.md`` suffix, unreadable, or
#: no leading frontmatter block).
NO_FRONTMATTER = _Sentinel()


def _resolve_project_root(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    return Path.cwd().resolve()


def _resolve_path(project_root: Path, raw: str) -> Path:
    p = Path(raw).expanduser()
    if not p.is_absolute():
        p = project_root / p
    return p


def _sha256(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


#: Inline-tag identifier this package writes into deployed Markdown
#: frontmatter (P5.1). Kept in sync with ``install.PACKAGE_TAG_ID``;
#: duplicated here to keep ``cmd_doctor`` import-light (no pull on the
#: installer module from the CLI).
PACKAGE_TAG_ID = "event4u/agent-config"

_FRONTMATTER_PACKAGE_RE = re.compile(
    r"^package:\s*(.+?)\s*$", re.MULTILINE,
)


def _read_inline_package_tag(path: Path) -> str | None | _Sentinel:
    """Extract the inline ``package:`` value from a Markdown frontmatter.

    Returns ``NO_FRONTMATTER`` when ``path`` is not a Markdown file or
    has no leading ``---`` block (P5.1: those files are out of scope).
    Returns ``None`` when frontmatter is present but lacks a
    ``package:`` key. Returns the string value otherwise.
    """
    if path.suffix != ".md":
        return NO_FRONTMATTER
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return NO_FRONTMATTER
    if not (text.startswith("---\n") or text.startswith("---\r\n")):
        return NO_FRONTMATTER
    lines = text.splitlines()
    close_idx: int | None = None
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            close_idx = i
            break
    if close_idx is None:
        return NO_FRONTMATTER
    block = "\n".join(lines[1:close_idx])
    m = _FRONTMATTER_PACKAGE_RE.search(block)
    if not m:
        return None
    return m.group(1).strip().strip("'\"")


def _fix_hint(category: str, kind: str | None) -> str:
    """Return a one-line remediation hint for the surfaced item."""
    if category == "missing":
        return "run `./agent-config sync` to re-install"
    if category == "modified":
        return "commit the local change, or re-install with --force"
    if category == "foreign":
        return (
            "identify owning tool, or run `./agent-config prune` "
            "if confirmed orphan"
        )
    if category == "tag-drift":
        return (
            "re-install with --force to restore the inline tag, "
            "or remove the file if it is no longer ours"
        )
    return ""


def _collect_manifest_entries(
    project_root: Path, manifest: dict[str, Any],
) -> tuple[
    list[tuple[str, Path, str, str | None]],   # (tool, abs_path, kind, sha)
    set[Path],                                  # resolved-known set
]:
    """Flatten v2 ``tools[].files[]`` into per-file records.

    Returns the records list and a set of resolved absolute paths so
    the foreign-file scan can skip anything the manifest claims.
    """
    records: list[tuple[str, Path, str, str | None]] = []
    known: set[Path] = set()
    for tool in manifest.get("tools") or []:
        if tool.get("scope") != "project":
            continue
        tool_id = str(tool.get("name", ""))
        for entry in tool.get("files") or []:
            raw = entry.get("path") or ""
            if not raw:
                continue
            kind = entry.get("kind") or ""
            target = _resolve_path(project_root, raw)
            try:
                resolved = target.resolve()
            except OSError:
                resolved = target
            records.append((tool_id, target, kind, entry.get("sha256")))
            known.add(resolved)
    return records, known


def _scan_foreign(
    project_root: Path,
    manifest: dict[str, Any],
    known: set[Path],
) -> list[Path]:
    """Walk every declared deploy root and surface unclaimed files.

    Only ``regular files`` under ``deploy_roots`` count; directories and
    symlinks are followed but the bookkeeping is on the resolved final
    path so a manifest claim via either path silences both surfaces.
    Falls back to :data:`installed_tools.DEFAULT_DEPLOY_ROOTS` when the
    manifest lacks an explicit ``deploy_roots`` list.
    """
    roots = manifest.get("deploy_roots") or list(
        installed_tools.DEFAULT_DEPLOY_ROOTS,
    )
    foreign: list[Path] = []
    seen: set[Path] = set()
    for root_rel in roots:
        root = _resolve_path(project_root, str(root_rel))
        if not root.exists() or not root.is_dir():
            continue
        for child in root.rglob("*"):
            if not child.is_file():
                continue
            try:
                resolved = child.resolve()
            except OSError:
                resolved = child
            if resolved in known or resolved in seen:
                continue
            seen.add(resolved)
            foreign.append(child)
    foreign.sort()
    return foreign


def _classify(
    records: list[tuple[str, Path, str, str | None]],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    """Split manifest records into missing / modified / tag-drift lists.

    Tag-drift inspection (P5.2) is restricted to manifest entries that
    point at a present ``.md`` file with a frontmatter block. A file
    that has frontmatter but whose ``package:`` value disagrees with
    :data:`PACKAGE_TAG_ID` — or that has dropped the key entirely —
    surfaces here. Files without frontmatter are silently ignored per
    the P5.1 contract (we never synthesise frontmatter).
    """
    missing: list[dict[str, Any]] = []
    modified: list[dict[str, Any]] = []
    tag_drift: list[dict[str, Any]] = []
    for tool_id, target, kind, expected in records:
        if not target.exists():
            missing.append({
                "tool": tool_id, "path": str(target), "kind": kind,
                "fix": _fix_hint("missing", kind),
            })
            continue
        tag = _read_inline_package_tag(target)
        if not isinstance(tag, _Sentinel) and tag != PACKAGE_TAG_ID:
            tag_drift.append({
                "tool": tool_id, "path": str(target), "kind": kind,
                "expected": PACKAGE_TAG_ID,
                "found": "" if tag is None else tag,
                "fix": _fix_hint("tag-drift", kind),
            })
        if expected is None:
            continue
        actual = _sha256(target)
        if actual is None or actual == expected:
            continue
        modified.append({
            "tool": tool_id, "path": str(target), "kind": kind,
            "fix": _fix_hint("modified", kind),
        })
    return missing, modified, tag_drift


def _foreign_records(
    project_root: Path, foreign: list[Path],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in foreign:
        try:
            rel = p.relative_to(project_root)
            path_str = str(rel)
        except ValueError:
            path_str = str(p)
        out.append({
            "tool": "",
            "path": path_str,
            "kind": "deployed",
            "fix": _fix_hint("foreign", "deployed"),
        })
    return out


# ---------------------------------------------------------------------------
# Health checks (Phase 2 of road-to-surface-discipline).
# ---------------------------------------------------------------------------

#: Ordered registry of structured health-check identifiers. The order
#: is preserved in text and JSON output. Adding a check requires both
#: a runner below and an entry in :func:`_run_checks`.
CHECK_IDS = (
    "scope",
    "manifest-integrity",
    "lockfile-freshness",
    "bridge-drift",
    "mcp-mode",
    "mcp-beta-readiness",
    "offline-readiness",
    "python-runtime",
    "tier-usage-readiness",
    "unsupported-combos",
)

#: Six gates that govern the MCP `experimental → beta` promotion. The
#: artefact path under each gate id mirrors `tests/test_mcp_beta_gates.py`
#: and the contract in `docs/contracts/mcp-beta-criteria.md`.
MCP_BETA_GATES: tuple[tuple[str, str], ...] = (
    ("gate-1-external-client", "tests/mcp/external-clients"),
    ("gate-2-bearer-auth", "tests/mcp/auth"),
    ("gate-3-parity-smoke", "tests/mcp/parity"),
    ("gate-4-healthz-load", "tests/mcp/load/healthz.k6.js"),
    ("gate-5-rate-limit", "docs/contracts/mcp-rate-limit.md"),
    ("gate-6-no-drift", ".github/workflows/mcp-no-drift.yml"),
)

#: Visible status → glyph map. ``warn`` keeps a trailing space so the
#: rendered output stays in a single visual column with the other glyphs.
STATUS_SYMBOLS = {"ok": "✅", "warn": "⚠️ ", "fail": "❌"}

#: Minimum Python interpreter the CLI targets. Bumped in lockstep with
#: ``from __future__ import annotations`` + PEP-604 syntax usage.
MIN_PYTHON = (3, 10)


def _check_scope(project_root: Path) -> dict[str, Any]:
    """Distinguish a standalone project root from a monorepo workspace.

    Surfaces ``warn`` when ``project_root`` looks like a monorepo root
    so the operator knows to run ``doctor`` per-package; otherwise
    reports the project as a standalone target.
    """
    for marker in ("pnpm-workspace.yaml", "lerna.json"):
        if (project_root / marker).exists():
            return {
                "id": "scope", "status": "warn",
                "message": f"monorepo root detected ({marker})",
                "remedy": "run `agent-config doctor` from each workspace package",
            }
    pkg = project_root / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            if data.get("workspaces"):
                return {
                    "id": "scope", "status": "warn",
                    "message": "package.json declares workspaces (monorepo root)",
                    "remedy": "run `agent-config doctor` from each workspace package",
                }
        except (OSError, ValueError):
            pass
    return {
        "id": "scope", "status": "ok",
        "message": "standalone project root",
        "remedy": "",
    }


def _check_manifest_integrity(manifest: dict[str, Any]) -> dict[str, Any]:
    """Verify the manifest carries a writer version and a known schema."""
    schema = manifest.get("schema_version")
    version = manifest.get("agent_config_version")
    if not version:
        return {
            "id": "manifest-integrity", "status": "warn",
            "message": "manifest lacks `agent_config_version`",
            "remedy": "re-run `./agent-config init` to record the writer version",
        }
    if schema not in installed_tools.SCHEMA_VERSIONS_SUPPORTED:
        return {
            "id": "manifest-integrity", "status": "warn",
            "message": f"unknown schema_version: {schema!r}",
            "remedy": "upgrade @event4u/agent-config to a writer that "
                      "recognises this schema",
        }
    return {
        "id": "manifest-integrity", "status": "ok",
        "message": f"schema v{schema}, written by agent-config {version}",
        "remedy": "",
    }


def _package_root() -> Path:
    """Resolve the @event4u/agent-config package root (this repo)."""
    return Path(__file__).resolve().parents[2]


def _current_package_version() -> str | None:
    """Read ``version`` from this package's ``package.json``; ``None`` on error."""
    try:
        data = json.loads(
            (_package_root() / "package.json").read_text(encoding="utf-8"),
        )
        v = data.get("version")
        if isinstance(v, str) and v.strip():
            return v.strip()
    except (OSError, ValueError):
        pass
    return None


def _check_lockfile_freshness(manifest: dict[str, Any]) -> dict[str, Any]:
    """Compare the manifest writer version against the current package."""
    recorded = manifest.get("agent_config_version")
    current = _current_package_version()
    if not recorded:
        return {
            "id": "lockfile-freshness", "status": "warn",
            "message": "manifest has no writer version recorded",
            "remedy": "re-run `./agent-config init` to refresh the manifest",
        }
    if current is None:
        return {
            "id": "lockfile-freshness", "status": "warn",
            "message": f"manifest written by {recorded}; current package version unknown",
            "remedy": "verify the package install (package.json missing or unreadable)",
        }
    if recorded != current:
        return {
            "id": "lockfile-freshness", "status": "warn",
            "message": f"manifest writer {recorded} != current package {current}",
            "remedy": "re-run `./agent-config sync` to refresh the manifest "
                     "against the current package",
        }
    return {
        "id": "lockfile-freshness", "status": "ok",
        "message": f"manifest and package both at {current}",
        "remedy": "",
    }


def _check_bridge_drift(
    missing: list[dict[str, Any]],
    modified: list[dict[str, Any]],
    foreign: list[dict[str, Any]],
    tag_drift: list[dict[str, Any]],
) -> dict[str, Any]:
    """Roll the four drift category counts into a single health verdict."""
    total = len(missing) + len(modified) + len(foreign) + len(tag_drift)
    if total == 0:
        return {
            "id": "bridge-drift", "status": "ok",
            "message": "manifest matches filesystem (no drift)",
            "remedy": "",
        }
    parts = []
    if missing:
        parts.append(f"{len(missing)} missing")
    if modified:
        parts.append(f"{len(modified)} modified")
    if foreign:
        parts.append(f"{len(foreign)} foreign")
    if tag_drift:
        parts.append(f"{len(tag_drift)} tag-drift")
    return {
        "id": "bridge-drift", "status": "fail",
        "message": f"{total} drift item(s): {', '.join(parts)}",
        "remedy": "see the drift section below or run `./agent-config sync`",
    }


def _check_mcp_mode(project_root: Path) -> dict[str, Any]:
    """Detect which MCP config file the project advertises, if any."""
    candidates = (
        (".cursor/mcp.json", "cursor"),
        (".ai/mcp/mcp.json", "ai-mcp"),
        ("mcp.json", "root"),
    )
    found: list[str] = []
    for rel, label in candidates:
        path = project_root / rel
        if not path.exists():
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
            found.append(f"{label} ({rel})")
        except (OSError, ValueError):
            return {
                "id": "mcp-mode", "status": "warn",
                "message": f"MCP config at {rel} is not valid JSON",
                "remedy": f"fix or remove `{rel}` (see docs/architecture.md § MCP)",
            }
    if not found:
        return {
            "id": "mcp-mode", "status": "ok",
            "message": "no MCP config present (MCP Beta off)",
            "remedy": "",
        }
    return {
        "id": "mcp-mode", "status": "ok",
        "message": f"MCP config detected: {', '.join(found)}",
        "remedy": "",
    }


def _check_offline_readiness() -> dict[str, Any]:
    """Verify the verified-offline install entrypoint ships with the package."""
    script = _package_root() / "scripts" / "hermetic-install.sh"
    if not script.exists():
        return {
            "id": "offline-readiness", "status": "warn",
            "message": "scripts/hermetic-install.sh not found in package",
            "remedy": "reinstall @event4u/agent-config or pull missing files",
        }
    return {
        "id": "offline-readiness", "status": "ok",
        "message": "verified-offline install entrypoint present",
        "remedy": "",
    }


def _check_python_runtime() -> dict[str, Any]:
    """Confirm the interpreter is at least :data:`MIN_PYTHON`."""
    cur = sys.version_info[:2]
    need = MIN_PYTHON
    if cur < need:
        return {
            "id": "python-runtime", "status": "fail",
            "message": f"python {cur[0]}.{cur[1]} below required {need[0]}.{need[1]}",
            "remedy": f"install python >= {need[0]}.{need[1]} and re-run",
        }
    return {
        "id": "python-runtime", "status": "ok",
        "message": f"python {cur[0]}.{cur[1]} meets {need[0]}.{need[1]}+ requirement",
        "remedy": "",
    }


def _check_mcp_beta_readiness(project_root: Path) -> dict[str, Any]:
    """Report the MCP `experimental → beta` promotion gate sheet.

    Walks the six gates in :data:`MCP_BETA_GATES` and asks whether the
    artefact named by each gate (test directory, k6 script, contract
    doc, or workflow file) is present. Green when all six pass, warn
    when any are missing — the gate stays red until evidence lands.
    Mirrors `tests/test_mcp_beta_gates.py` so the doctor verdict and
    the pytest sheet cannot drift.
    """
    pending: list[str] = []
    for gate_id, rel in MCP_BETA_GATES:
        if not (project_root / rel).exists():
            pending.append(f"{gate_id} ({rel})")
    if not pending:
        return {
            "id": "mcp-beta-readiness", "status": "ok",
            "message": "all 6 MCP beta gates green — promotion authorized",
            "remedy": "",
        }
    return {
        "id": "mcp-beta-readiness", "status": "warn",
        "message": (
            f"{len(pending)}/6 MCP beta gate(s) pending: "
            f"{', '.join(pending)}"
        ),
        "remedy": (
            "produce the artefacts listed in "
            "docs/contracts/mcp-beta-criteria.md (one per gate); "
            "do not flip `experimental` wording until all 6 are green"
        ),
    }


def _check_tier_usage_readiness(project_root: Path) -> dict[str, Any]:
    """Report whether tier-usage telemetry can drive empirical retiering.

    Phase 5 of road-to-surface-discipline. Three terminal states:

    * **ok** — telemetry on, log present, at least one record survived
      the privacy floor.
    * **warn (disabled)** — telemetry off; no signal collected.
      Default-off doctrine; user opt-in is the unlock.
    * **warn (no data)** — telemetry on but the log is absent / empty;
      retiering decisions still rely on operator judgement until
      enough records accumulate.
    * **fail (poisoned)** — every record was rejected by the privacy
      floor; the report would refuse to render. The log needs a manual
      inspection.

    Contract: ``docs/contracts/command-clusters.md`` § tier-usage signal.
    """
    settings_file = project_root / ".agent-settings.yml"
    log_path = project_root / ".agent-tier-usage.jsonl"
    enabled = False
    if settings_file.is_file():
        try:
            import yaml  # type: ignore[import-not-found]
        except ImportError:
            yaml = None  # type: ignore[assignment]
        if yaml is not None:
            try:
                raw = yaml.safe_load(settings_file.read_text(encoding="utf-8")) or {}
            except Exception:
                raw = {}
            tele = (raw.get("telemetry") if isinstance(raw, dict) else None) or {}
            tu = tele.get("tier_usage") if isinstance(tele, dict) else None
            if isinstance(tu, dict):
                output = tu.get("output") if isinstance(tu.get("output"), dict) else {}
                if isinstance(output.get("path"), str) and output["path"].strip():
                    log_path = project_root / output["path"].strip()
                val = tu.get("enabled")
                enabled = bool(val) if isinstance(val, bool) else (
                    isinstance(val, str) and val.strip().lower() in ("true", "yes", "on", "1")
                )

    if not enabled:
        return {
            "id": "tier-usage-readiness", "status": "warn",
            "message": (
                "tier-usage telemetry disabled — empirical retiering "
                "decisions fall back to operator judgement"
            ),
            "remedy": (
                "set `telemetry.tier_usage.enabled: true` in "
                ".agent-settings.yml (default-off; opt-in)"
            ),
        }
    if not log_path.exists():
        return {
            "id": "tier-usage-readiness", "status": "warn",
            "message": (
                f"tier-usage telemetry on but {log_path.name} not yet "
                "written — no signal accumulated"
            ),
            "remedy": (
                "run any tracked command to seed the log; the dispatcher "
                "writes one record per invocation"
            ),
        }
    total = 0
    valid = 0
    allowed_fields = {"ts_bucket", "command", "tier", "outcome", "user_hash"}
    allowed_outcomes = {"success", "error", "blocked"}
    try:
        with log_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                total += 1
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(obj, dict):
                    continue
                if not set(obj.keys()).issubset(allowed_fields):
                    continue
                if (
                    isinstance(obj.get("command"), str) and obj["command"]
                    and isinstance(obj.get("tier"), int) and obj["tier"] in (0, 1, 2, 3)
                    and obj.get("outcome") in allowed_outcomes
                    and isinstance(obj.get("user_hash"), str) and len(obj["user_hash"]) == 16
                    and isinstance(obj.get("ts_bucket"), str)
                ):
                    valid += 1
    except OSError as exc:
        return {
            "id": "tier-usage-readiness", "status": "fail",
            "message": f"cannot read {log_path.name}: {exc}",
            "remedy": "fix permissions on the tier-usage log",
        }
    if total > 0 and valid == 0:
        return {
            "id": "tier-usage-readiness", "status": "fail",
            "message": (
                f"{total} record(s) in {log_path.name} but 0 passed the "
                "privacy floor — report would refuse to render"
            ),
            "remedy": (
                "inspect the log; the dispatcher is writing records the "
                "contract forbids (paths, argv, message bodies)"
            ),
        }
    if valid == 0:
        return {
            "id": "tier-usage-readiness", "status": "warn",
            "message": f"{log_path.name} present but empty — no signal yet",
            "remedy": "run any tracked command to seed the log",
        }
    return {
        "id": "tier-usage-readiness", "status": "ok",
        "message": (
            f"{valid} record(s) past the privacy floor in {log_path.name} "
            "— retiering signal available"
        ),
        "remedy": "",
    }


def _check_unsupported_combos(manifest: dict[str, Any]) -> dict[str, Any]:
    """Flag tools whose ``scope`` violates the global-only or project-only rules."""
    global_only = {"droid", "qoder"}
    bad: list[str] = []
    for tool in manifest.get("tools") or []:
        name = str(tool.get("name", ""))
        scope = tool.get("scope")
        if name in global_only and scope != "global":
            bad.append(f"{name} (scope={scope}, requires global)")
    if bad:
        return {
            "id": "unsupported-combos", "status": "fail",
            "message": f"{len(bad)} tool(s) with unsupported scope: {', '.join(bad)}",
            "remedy": "re-install the listed tools with `--global --force`",
        }
    return {
        "id": "unsupported-combos", "status": "ok",
        "message": "all installed tools use supported scopes",
        "remedy": "",
    }


def _run_checks(
    project_root: Path,
    manifest: dict[str, Any],
    drift: dict[str, list[dict[str, Any]]],
    only: str | None = None,
) -> list[dict[str, Any]]:
    """Run the health-check registry and return ordered structured results.

    ``only`` filters to a single check id; ``None`` runs the full set.
    """
    runners: dict[str, Any] = {
        "scope": lambda: _check_scope(project_root),
        "manifest-integrity": lambda: _check_manifest_integrity(manifest),
        "lockfile-freshness": lambda: _check_lockfile_freshness(manifest),
        "bridge-drift": lambda: _check_bridge_drift(
            drift["missing"], drift["modified"],
            drift["foreign"], drift["tag_drift"],
        ),
        "mcp-mode": lambda: _check_mcp_mode(project_root),
        "mcp-beta-readiness": lambda: _check_mcp_beta_readiness(project_root),
        "offline-readiness": lambda: _check_offline_readiness(),
        "python-runtime": lambda: _check_python_runtime(),
        "tier-usage-readiness": lambda: _check_tier_usage_readiness(project_root),
        "unsupported-combos": lambda: _check_unsupported_combos(manifest),
    }
    out: list[dict[str, Any]] = []
    for cid in CHECK_IDS:
        if only is not None and cid != only:
            continue
        out.append(runners[cid]())
    return out



def _emit_json(
    project_root: Path,
    missing: list[dict[str, Any]],
    modified: list[dict[str, Any]],
    foreign: list[dict[str, Any]],
    tag_drift: list[dict[str, Any]],
    checks: list[dict[str, Any]] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "project_root": str(project_root),
        "missing": missing,
        "modified": modified,
        "foreign": foreign,
        "tag_drift": tag_drift,
    }
    if checks is not None:
        payload["checks"] = checks
    print(json.dumps(payload, indent=2))


def _emit_checks_text(checks: list[dict[str, Any]]) -> None:
    """Render the health-check block above the drift section."""
    if not checks:
        return
    print("checks:")
    for c in checks:
        sym = STATUS_SYMBOLS.get(c["status"], "?")
        print(f"  {sym} {c['id']}: {c['message']}")
        if c["status"] != "ok" and c.get("remedy"):
            print(f"      fix: {c['remedy']}")
    print("")


def _emit_text(
    project_root: Path,
    missing: list[dict[str, Any]],
    modified: list[dict[str, Any]],
    foreign: list[dict[str, Any]],
    tag_drift: list[dict[str, Any]],
) -> None:
    total = len(missing) + len(modified) + len(foreign) + len(tag_drift)
    if total == 0:
        print(f"✅  doctor: manifest matches filesystem under {project_root}")
        return
    print(f"⚠️   doctor: {total} drift item(s) under {project_root}")
    for label, items in (
        ("missing", missing),
        ("modified", modified),
        ("foreign", foreign),
        ("tag-drift", tag_drift),
    ):
        if not items:
            continue
        print(f"\n  {label} ({len(items)}):")
        for it in items:
            tool = it["tool"] or "?"
            print(f"    · [{tool}] {it['path']}")
            if label == "tag-drift":
                found = it.get("found") or "(missing)"
                expected = it.get("expected", PACKAGE_TAG_ID)
                print(f"        expected: {expected}")
                print(f"        found:    {found}")
            print(f"        fix: {it['fix']}")


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config doctor",
        description=(
            "Manifest ↔ filesystem drift report plus install health "
            "checks. See --check for the individual check ids."
        ),
    )
    parser.add_argument("--project", default=None,
                        help="project root (default: cwd)")
    parser.add_argument("--json", action="store_true",
                        help="emit a JSON report instead of human text")
    parser.add_argument(
        "--check", default=None, metavar="ID",
        choices=list(CHECK_IDS),
        help=("run a single health check by id "
              f"({' · '.join(CHECK_IDS)})"),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    opts = _parse(list(argv) if argv is not None else sys.argv[1:])
    project_root = _resolve_project_root(opts.project)
    manifest_pth = installed_tools.manifest_path(project_root)
    manifest = installed_tools.read_manifest(manifest_pth)
    if manifest is None:
        print(f"❌  doctor: no project lockfile at {manifest_pth}",
              file=sys.stderr)
        print("    run `./agent-config init` to create one",
              file=sys.stderr)
        return 2

    records, known = _collect_manifest_entries(project_root, manifest)
    missing, modified, tag_drift = _classify(records)
    foreign = _foreign_records(
        project_root, _scan_foreign(project_root, manifest, known),
    )
    drift_groups = {
        "missing": missing, "modified": modified,
        "foreign": foreign, "tag_drift": tag_drift,
    }
    checks = _run_checks(project_root, manifest, drift_groups, only=opts.check)
    fail_check = any(c["status"] == "fail" for c in checks)

    if opts.json:
        _emit_json(
            project_root, missing, modified, foreign, tag_drift,
            checks=checks,
        )
    else:
        _emit_checks_text(checks)
        if opts.check is None:
            _emit_text(project_root, missing, modified, foreign, tag_drift)

    # Full-suite mode: exit code reflects drift only; failing health
    # checks are surfaced visually but do not change the rc, preserving
    # the original drift-detection contract. ``--check <id>`` mode is
    # explicit and propagates the single check's verdict.
    if opts.check is not None:
        return 1 if fail_check else 0
    return 1 if (missing or modified or foreign or tag_drift) else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
