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
import sys
import urllib.request
from pathlib import Path
from typing import Any

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))

from mcp_server.prompts import load_all_prompts, to_mcp_prompt_meta  # noqa: E402
from mcp_server.resources import load_all_resources, to_mcp_resource_meta  # noqa: E402

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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--target", required=True, help="HTTP URL of the Worker.")
    args = ap.parse_args()

    failed = 0
    local_p = _normalize_prompts(_local_prompts_list())
    remote_p = _normalize_prompts(_rpc(args.target, "prompts/list"))
    failed += _diff("prompts/list", local_p, remote_p)

    local_r = _normalize_resources(_local_resources_list())
    remote_r = _normalize_resources(_rpc(args.target, "resources/list"))
    failed += _diff("resources/list", local_r, remote_r)

    try:
        _ = _rpc(args.target, "tools/list")
        print("✅  tools/list: round-trips (stub list — content not parity-checked)")
    except Exception as e:
        print(f"❌  tools/list: {e}")
        failed += 1

    if failed:
        print(f"\n{failed} surface(s) drifted between local stdio and {args.target}")
        return 1
    print(f"\nparity OK against {args.target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
