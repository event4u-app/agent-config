"""Live-replay parity smoke — local stdio kernel vs deployed Worker URL.

Replays a fixed set of JSON-RPC calls against:

1. The local Python loaders (`prompts.py` / `resources.py`) — the
   source-of-truth wire surface.
2. An HTTP target (typically `wrangler dev` locally, or the deployed
   Cloudflare Worker URL in CI / post-deploy).

Diffs the two on a normalised view (signature + release_key + content
hashes stripped). Exit 0 = parity, 1 = drift.

Usage:
    python scripts/mcp_parity_smoke.py --target http://127.0.0.1:8787
    python scripts/mcp_parity_smoke.py --target https://mcp.example.com

Phase 5.1 of `road-to-cloudflare-mcp-hosting.md`. Governed by
`docs/contracts/mcp-cloud-scope.md` §A0-cloud.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))
_REPO_ROOT = _SCRIPTS.parents[1]
DEFAULT_NODE_CLI = _REPO_ROOT / "dist" / "cli" / "agent-config.js"
# Kinds the turnkey local stdio-lite surface serves (ADR-085 subset — no
# contexts, no execution). The parity leg compares this subset only.
_NODE_RESOURCE_KINDS = {"rule", "guideline"}

from mcp_server.catalog import load_catalog  # noqa: E402
from mcp_server.prompts import load_all_prompts, to_mcp_prompt_meta  # noqa: E402
from mcp_server.resources import load_all_resources, to_mcp_resource_meta  # noqa: E402
from mcp_server.tools import ALLOWLIST  # noqa: E402

PAGE_SIZE = 50


def _local_prompts_list() -> dict[str, Any]:
    prompts, _ = load_all_prompts()
    metas = [to_mcp_prompt_meta(p) for p in prompts]
    page = metas[:PAGE_SIZE]
    out: dict[str, Any] = {"prompts": page}
    if len(metas) > PAGE_SIZE:
        out["nextCursor"] = page[-1]["name"]
    return out


def _local_resources_list() -> dict[str, Any]:
    resources, _ = load_all_resources()
    metas = [to_mcp_resource_meta(r) for r in resources]
    page = metas[:PAGE_SIZE]
    out: dict[str, Any] = {"resources": page}
    if len(metas) > PAGE_SIZE:
        out["nextCursor"] = page[-1]["uri"]
    return out


def _rpc(target: str, method: str, params: dict[str, Any] | None = None) -> Any:
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}
    ).encode("utf-8")
    req = urllib.request.Request(
        target,
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:  # noqa: S310
        resp = json.loads(r.read().decode("utf-8"))
    if "error" in resp:
        raise RuntimeError(f"{method}: {resp['error']}")
    return resp["result"]


def _normalize_prompts(payload: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for p in payload.get("prompts", []):
        out.append({
            "name": p["name"],
            "description": p["description"],
            "kind": p.get("_meta", {}).get("kind"),
        })
    return sorted(out, key=lambda x: x["name"])


def _normalize_resources(payload: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for r in payload.get("resources", []):
        out.append({
            "uri": r["uri"],
            "name": r["name"],
            "description": r["description"],
            "mimeType": r["mimeType"],
            "kind": r.get("_meta", {}).get("kind"),
        })
    return sorted(out, key=lambda x: x["uri"])


def _local_tools_list() -> dict[str, Any]:
    """Tools catalog + allowlist as the stdio server publishes them."""
    catalog_names = [c.name for c in load_catalog()]
    allowlist_names = list(ALLOWLIST.keys())
    return {"tools": [{"name": n} for n in sorted(set(catalog_names + allowlist_names))]}


def _normalize_tools(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Compare on `name` only — descriptions / schemas drift acceptably."""
    return sorted(
        [{"name": t["name"]} for t in payload.get("tools", [])],
        key=lambda x: x["name"],
    )


class _NodeSession:
    """Interactive stdio session with `node <cli> mcp-server` — write a request
    line, read one JSON-RPC response line. Enables cursor pagination (we can't
    know cursors ahead of a batch). stdout is JSON-RPC; stderr (the readiness
    note) is drained separately. Asserts stdout purity: every line is JSON-RPC.
    """

    def __init__(self, cli: Path) -> None:
        self._proc = subprocess.Popen(  # noqa: S603
            ["node", str(cli), "mcp-server"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        self._id = 0

    def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        self._id += 1
        assert self._proc.stdin and self._proc.stdout
        self._proc.stdin.write(
            json.dumps({"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}}) + "\n"
        )
        self._proc.stdin.flush()
        line = self._proc.stdout.readline().strip()
        resp = json.loads(line)  # stdout purity: a non-JSON line throws here
        if "error" in resp and not method.startswith("tools/"):
            raise RuntimeError(f"{method}: {resp['error']}")
        return resp.get("result", resp.get("error"))

    def list_all(self, method: str, items_key: str, cursor_field: str) -> list[dict[str, Any]]:
        """Follow `nextCursor` until exhausted — returns the FULL list."""
        items: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            result = self.call(method, {"cursor": cursor} if cursor else {})
            items.extend(result.get(items_key, []))
            cursor = result.get("nextCursor")
            if not cursor:
                return items

    def close(self) -> None:
        assert self._proc.stdin
        self._proc.stdin.close()
        self._proc.wait(timeout=15)


def _subset_prompts(metas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Key on name + kind only — robust to condensed-vs-uncondensed
    description telegraphing across surfaces."""
    return sorted(
        ({"name": p["name"], "kind": p["kind"]} for p in metas),
        key=lambda x: x["name"],
    )


def _subset_resources(metas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter to the kinds the turnkey surface serves; key on uri + kind +
    mimeType (drop description for the same robustness reason)."""
    return sorted(
        (
            {"uri": r["uri"], "kind": r["kind"], "mimeType": r["mimeType"]}
            for r in metas
            if r["kind"] in _NODE_RESOURCE_KINDS
        ),
        key=lambda x: x["uri"],
    )


def _diff(label: str, local: list[Any], remote: list[Any]) -> int:
    if local == remote:
        print(f"✅  {label}: {len(local)} entries match")
        return 0
    print(f"❌  {label}: drift ({len(local)} local vs {len(remote)} remote)")
    local_set = {json.dumps(x, sort_keys=True) for x in local}
    remote_set = {json.dumps(x, sort_keys=True) for x in remote}
    only_local = local_set - remote_set
    only_remote = remote_set - local_set
    for s in sorted(only_local)[:5]:
        print(f"    local-only: {s}")
    for s in sorted(only_remote)[:5]:
        print(f"    remote-only: {s}")
    if len(only_local) > 5 or len(only_remote) > 5:
        print(f"    (+{len(only_local) - 5} local, +{len(only_remote) - 5} remote more)")
    return 1


def _run_http_leg(target: str) -> int:
    """Local Python kernel vs deployed Worker (HTTP). Full normalized diff."""
    failed = 0
    failed += _diff(
        "prompts/list",
        _normalize_prompts(_local_prompts_list()),
        _normalize_prompts(_rpc(target, "prompts/list")),
    )
    failed += _diff(
        "resources/list",
        _normalize_resources(_local_resources_list()),
        _normalize_resources(_rpc(target, "resources/list")),
    )
    try:
        failed += _diff(
            "tools/list",
            _normalize_tools(_local_tools_list()),
            _normalize_tools(_rpc(target, "tools/list")),
        )
    except Exception as e:
        print(f"❌  tools/list: {e}")
        failed += 1
    print(f"{'' if failed else 'parity OK '}against {target}".strip())
    return failed


def _local_prompts_all() -> list[dict[str, Any]]:
    """ALL skill+command prompt metas (uncapped — for full-set parity)."""
    prompts, _ = load_all_prompts()
    return [to_mcp_prompt_meta(p) for p in prompts]


def _local_resources_all() -> list[dict[str, Any]]:
    """ALL resource metas (uncapped — for full-set parity)."""
    resources, _ = load_all_resources()
    return [to_mcp_resource_meta(r) for r in resources]


def _run_node_leg(cli: Path) -> int:
    """Local Python kernel vs the turnkey Node stdio-lite binary (ADR-085).

    Compares the FULL SUBSET the turnkey surface serves (skill/command prompts,
    rule/guideline resources — contexts excluded by design) via cursor
    pagination, on name/kind/uri keys, and asserts the read-only boundary
    (`tools/list` empty). Skips with a note if the binary isn't built.
    """
    if not cli.exists():
        print(f"⏭️  node-stdio: {cli} not built — run `npm run build:cli` (skipped)")
        return 0
    session = _NodeSession(cli)
    try:
        node_prompts = session.list_all("prompts/list", "prompts", "name")
        node_resources = session.list_all("resources/list", "resources", "uri")
        node_tools = session.call("tools/list").get("tools", [])
    finally:
        session.close()

    failed = 0
    failed += _diff(
        "node prompts/list (full subset)",
        _subset_prompts(_normalize_prompts({"prompts": _local_prompts_all()})),
        _subset_prompts(_normalize_prompts({"prompts": node_prompts})),
    )
    failed += _diff(
        "node resources/list (full subset)",
        _subset_resources(_normalize_resources({"resources": _local_resources_all()})),
        _subset_resources(_normalize_resources({"resources": node_resources})),
    )
    if node_tools:
        print(f"❌  node tools/list: expected empty (read-only), got {len(node_tools)}")
        failed += 1
    else:
        print("✅  node tools/list: empty (read-only, ADR-085)")
    print(f"{'' if failed else 'node-stdio parity OK '}({cli.name})".strip())
    return failed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--target", help="HTTP URL of the Worker (HTTP-parity leg).")
    ap.add_argument(
        "--node-stdio",
        nargs="?",
        const=str(DEFAULT_NODE_CLI),
        help=(
            "Run the turnkey-launch parity leg against the Node stdio-lite "
            f"binary (default: {DEFAULT_NODE_CLI.relative_to(_REPO_ROOT)})."
        ),
    )
    args = ap.parse_args()
    if not args.target and not args.node_stdio:
        ap.error("at least one of --target or --node-stdio is required")

    failed = 0
    if args.target:
        failed += _run_http_leg(args.target)
    if args.node_stdio:
        failed += _run_node_leg(Path(args.node_stdio))

    if failed:
        print(f"\n{failed} surface(s) drifted")
        return 1
    print("\nparity OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
