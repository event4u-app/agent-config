#!/usr/bin/env python3
"""Sync `.github/topics.yml` + `.github/about.yml` to the GitHub repo.

Reads two on-disk manifests and pushes them via the REST API:
  * `PUT  /repos/{owner}/{repo}/topics`   \u2014 topics list
  * `PATCH /repos/{owner}/{repo}`         \u2014 description + homepage

Default mode is `--dry-run`: fetches remote state, prints a unified
diff (remote \u2192 desired), exits 0 (or 2 if drift exists when
`--strict` is passed). `--apply` is required to mutate; it also
appends an audit row to `agents/notes/visibility-sync-audit.md`.

Auth: `GITHUB_TOKEN` env var. The repo slug is taken from
`package.json` `repository.url` (parsed) or `--repo owner/name`.

Stdlib only \u2014 `urllib.request` matches the convention in
`scripts/_lib/update_check.py`.

Roadmap: agents/roadmaps/strategic-visibility-mcp-topics-positioning.md Phase 1.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import difflib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
TOPICS_FILE = ROOT / ".github" / "topics.yml"
ABOUT_FILE = ROOT / ".github" / "about.yml"
AUDIT_FILE = ROOT / "agents" / "notes" / "visibility-sync-audit.md"
API = "https://api.github.com"


def _load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _resolve_repo(explicit: str | None) -> str:
    if explicit:
        return explicit
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    url = (pkg.get("repository") or {}).get("url") or ""
    m = re.search(r"github\.com[:/]+([^/]+/[^/.]+)", url)
    if not m:
        sys.exit("ERROR: cannot resolve owner/repo from package.json; pass --repo")
    return m.group(1)


def _request(method: str, url: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "event4u-agent-config-sync")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR: {method} {url} \u2192 HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR: {method} {url} \u2192 {e.reason}")


def _diff(label: str, remote, desired) -> list[str]:
    a = json.dumps(remote, indent=2, sort_keys=True).splitlines()
    b = json.dumps(desired, indent=2, sort_keys=True).splitlines()
    return list(difflib.unified_diff(a, b, fromfile=f"remote/{label}", tofile=f"desired/{label}", lineterm=""))


def _audit(repo: str, mutations: list[str]) -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not AUDIT_FILE.exists():
        AUDIT_FILE.write_text("# Visibility sync audit log\n\nAppend-only. Every `--apply` run logs one block.\n", encoding="utf-8")
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    block = [f"\n## {ts} \u2014 {repo}\n"]
    block.extend(f"- {m}\n" for m in mutations)
    with AUDIT_FILE.open("a", encoding="utf-8") as f:
        f.writelines(block)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apply", action="store_true", help="actually mutate the remote (default: dry-run)")
    ap.add_argument("--strict", action="store_true", help="exit 2 if drift exists (dry-run only)")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--repo", help="owner/name (default: parsed from package.json)")
    args = ap.parse_args()

    repo = _resolve_repo(args.repo)
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("ERROR: GITHUB_TOKEN not set")

    topics_doc = _load_yaml(TOPICS_FILE)
    about_doc = _load_yaml(ABOUT_FILE)
    desired_topics = sorted(topics_doc.get("topics") or [])
    desired_about = {"description": about_doc.get("description", ""), "homepage": about_doc.get("homepage", "")}

    remote_topics = sorted((_request("GET", f"{API}/repos/{repo}/topics", token).get("names") or []))
    repo_payload = _request("GET", f"{API}/repos/{repo}", token)
    remote_about = {"description": repo_payload.get("description") or "", "homepage": repo_payload.get("homepage") or ""}

    topic_diff = _diff("topics", remote_topics, desired_topics)
    about_diff = _diff("about", remote_about, desired_about)
    has_drift = bool(topic_diff or about_diff)

    if not args.quiet:
        if topic_diff:
            print("\n".join(topic_diff))
        if about_diff:
            print("\n".join(about_diff))
        if not has_drift:
            print(f"\u2705  {repo}: topics + about already in sync")

    if not args.apply:
        return 2 if (has_drift and args.strict) else 0

    mutations: list[str] = []
    if topic_diff:
        _request("PUT", f"{API}/repos/{repo}/topics", token, {"names": desired_topics})
        mutations.append(f"topics \u2192 {desired_topics}")
    if about_diff:
        _request("PATCH", f"{API}/repos/{repo}", token, desired_about)
        mutations.append(f"about \u2192 {desired_about}")
    if mutations:
        _audit(repo, mutations)
        if not args.quiet:
            print(f"\u2705  {repo}: applied {len(mutations)} mutation(s); audit appended")
    elif not args.quiet:
        print(f"\u2705  {repo}: nothing to apply")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
