#!/usr/bin/env python3
"""build_ticket_export.py — export ticket bundle to Linear via GraphQL.

Reads a bundle of T-*.md ticket files and optionally creates Linear issues
via issueCreate GraphQL mutation. Implements query/map-first idempotency:
for each ticket, if manifest.yml linear_state[id].linear_id is set, plan
skip; else plan create.

Modes:

  --dry-run (default): print planned actions (create/skip per ticket),
                       exit 0, no network calls.
  (live):              POST GraphQL issueCreate, record returned ids in
                       manifest.yml linear_state, resumable on mid-batch
                       failure.

Exit codes:
  0 = success
  2 = missing token in live mode
  3 = unresolved asset (missing file, invalid frontmatter, etc)

Token source: ~/.event4u/agent-config/linear.key or LINEAR_API_KEY env.
Phases map to Parent issues (Phase 1 → P-001, etc).
Frontmatter → priority/estimate/labels; body → issue description.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("❌ PyYAML not installed. Install with: pip install pyyaml", file=sys.stderr)
    sys.exit(3)

ROOT = Path(__file__).resolve().parent.parent.parent
TICKETS_DIR = ROOT / "agents" / "tickets"
MANIFEST_FILE = TICKETS_DIR / "manifest.yml"

GRAPHQL_ENDPOINT = "https://api.linear.app/graphql"


def load_manifest() -> dict[str, Any]:
    """Load manifest.yml; return empty if missing."""
    if not MANIFEST_FILE.is_file():
        return {"linear_state": {}}
    with open(MANIFEST_FILE, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if "linear_state" not in data:
        data["linear_state"] = {}
    return data


def save_manifest(manifest: dict[str, Any]) -> None:
    """Write manifest.yml back."""
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        yaml.dump(manifest, f, default_flow_style=False, sort_keys=False)


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Parse YAML frontmatter (between first two --- fences).

    Returns (frontmatter_dict, body_text).
    Raises ValueError if frontmatter is malformed.
    """
    lines = text.split("\n", 1)
    if len(lines) < 2 or lines[0] != "---":
        raise ValueError("No YAML frontmatter found (must start with ---)")

    rest = lines[1]
    parts = rest.split("\n---\n", 1)
    if len(parts) != 2:
        raise ValueError("No closing --- fence found")

    fm_text, body = parts
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML frontmatter: {e}")

    return fm, body.lstrip()


def load_ticket(ticket_path: Path) -> tuple[str, dict[str, Any], str]:
    """Load a T-*.md ticket file.

    Returns (ticket_id, frontmatter, body).
    Raises FileNotFoundError or ValueError on error.
    """
    if not ticket_path.is_file():
        raise FileNotFoundError(f"Ticket file not found: {ticket_path}")

    text = ticket_path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)

    ticket_id = fm.get("id")
    if not ticket_id:
        raise ValueError(f"No 'id' field in {ticket_path.name} frontmatter")

    return ticket_id, fm, body


def plan_ticket(ticket_id: str, manifest: dict[str, Any]) -> str:
    """Determine action: 'create' or 'skip'."""
    state = manifest.get("linear_state", {})
    if ticket_id in state and state[ticket_id].get("linear_id"):
        return "skip"
    return "create"


def graphql_create_issue(
    token: str,
    title: str,
    description: str,
    priority: int | None = None,
    estimate: int | None = None,
    labels: list[str] | None = None,
    parent_id: str | None = None,
) -> dict[str, Any]:
    """POST GraphQL issueCreate mutation.

    Returns response dict with 'issue' containing the created issue data.
    Raises urllib.error.HTTPError on failure.
    """
    variables: dict[str, Any] = {
        "input": {
            "title": title,
            "description": description,
        }
    }
    if priority is not None:
        variables["input"]["priority"] = priority
    if estimate is not None:
        variables["input"]["estimate"] = estimate
    if labels:
        variables["input"]["labelIds"] = labels
    if parent_id:
        variables["input"]["parentId"] = parent_id

    query = """
    mutation issueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        issue {
          id
          identifier
          title
        }
      }
    }
    """

    payload = {
        "query": query,
        "variables": variables,
    }

    req = urllib.request.Request(
        GRAPHQL_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )

    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))

    if "errors" in result:
        raise ValueError(f"GraphQL error: {result['errors']}")

    return result.get("data", {})


def get_or_create_parent_issue(token: str, phase: int) -> str:
    """Get or create a parent issue for the phase.

    For now, returns a placeholder ID (P-{phase:03d}).
    In production, this would query or create via GraphQL.
    """
    return f"P-{phase:03d}"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument(
        "bundle_dir",
        type=Path,
        help="path to ticket bundle directory (e.g., agents/tickets/road-to-ticket-bundles/)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="print planned actions without making network calls (default)",
    )
    p.add_argument(
        "--live",
        action="store_false",
        dest="dry_run",
        help="actually create issues in Linear",
    )
    args = p.parse_args(argv)

    # Resolve bundle dir relative to repo root if needed
    bundle_dir = args.bundle_dir
    if not bundle_dir.is_absolute():
        bundle_dir = ROOT / bundle_dir

    if not bundle_dir.is_dir():
        print(f"❌ Bundle directory not found: {bundle_dir}", file=sys.stderr)
        return 3

    # Load manifest
    manifest = load_manifest()

    # Collect and plan tickets
    ticket_files = sorted(bundle_dir.glob("T-*.md"))
    if not ticket_files:
        print(f"⚠️  No T-*.md files found in {bundle_dir}", file=sys.stderr)
        return 0

    planned: list[tuple[str, str, dict[str, Any], str]] = []
    for ticket_file in ticket_files:
        try:
            ticket_id, fm, body = load_ticket(ticket_file)
            action = plan_ticket(ticket_id, manifest)
            planned.append((ticket_id, action, fm, body))
        except (FileNotFoundError, ValueError) as e:
            print(f"❌ Error loading {ticket_file.name}: {e}", file=sys.stderr)
            return 3

    # Dry-run: print planned actions
    if args.dry_run:
        for ticket_id, action, _, _ in planned:
            print(f"{action} {ticket_id}")
        return 0

    # Live mode: create issues
    token = os.getenv("LINEAR_API_KEY")
    if not token:
        token_file = Path.home() / ".event4u" / "agent-config" / "linear.key"
        if token_file.is_file():
            token = token_file.read_text(encoding="utf-8").strip()

    if not token:
        print(
            "❌ LINEAR_API_KEY not set and ~/.event4u/agent-config/linear.key not found",
            file=sys.stderr,
        )
        return 2

    for ticket_id, action, fm, body in planned:
        if action == "skip":
            print(f"skip {ticket_id}")
            continue

        # Create issue
        try:
            title = fm.get("title", ticket_id)
            priority = fm.get("priority")
            estimate = fm.get("estimate")
            labels = fm.get("labels", [])
            phase = fm.get("phase")

            # Map phase to parent issue
            parent_id = None
            if phase:
                parent_id = get_or_create_parent_issue(token, phase)

            result = graphql_create_issue(
                token,
                title=title,
                description=body,
                priority=priority,
                estimate=estimate,
                labels=labels,
                parent_id=parent_id,
            )

            issue = result.get("issueCreate", {}).get("issue", {})
            linear_id = issue.get("id")
            if not linear_id:
                print(
                    f"❌ No issue ID in GraphQL response for {ticket_id}",
                    file=sys.stderr,
                )
                return 3

            # Record in manifest
            if ticket_id not in manifest["linear_state"]:
                manifest["linear_state"][ticket_id] = {}
            manifest["linear_state"][ticket_id]["linear_id"] = linear_id
            save_manifest(manifest)

            print(f"create {ticket_id}")

        except (urllib.error.HTTPError, ValueError) as e:
            print(f"❌ Error creating {ticket_id}: {e}", file=sys.stderr)
            save_manifest(manifest)  # Save progress before returning
            return 3

    return 0


if __name__ == "__main__":
    sys.exit(main())
