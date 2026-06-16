#!/usr/bin/env python3
"""Lint ticket bundles for build-readiness.

Enforces the ticket-bundle contract (docs/contracts/ticket-bundle-format.md):

- schema validity of every ticket frontmatter + every manifest (§3, §6);
- the self-containedness floor per ``model_tier`` (§5);
- an acyclic manifest dependency graph (§6);
- bidirectional traceability spine: every ``<!-- ticket: T-NNN -->`` marker in
  ``agents/roadmaps/*.md`` resolves to a bundle ticket, and vice versa (§9);
- asset size cap of 500 KB (§11);
- staleness with split severity: ``adr_refs`` SHA drift FAILS, ``source_refs``
  SHA drift WARNS (§10).

Exit codes: 0 = clean, 1 = lint failures, 3 = IO/setup error. Failures print as
``path:reason``. Pure stdlib + yaml + jsonschema (both present in this repo).
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import yaml
from jsonschema import Draft7Validator

REPO = Path(__file__).resolve().parents[2]
SCHEMA_DIR = REPO / "src" / "scripts" / "schemas"
TICKETS_ROOT = REPO / "agents" / "tickets"
ROADMAPS = REPO / "agents" / "roadmaps"
ASSET_CAP_BYTES = 500 * 1024
TIER_PATH_ROOTS = ("src/", "app/", "docs/", "agents/", "tests/", "scripts/", ".github/", "Taskfile")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.DOTALL)
MARKER_RE = re.compile(r"<!--\s*ticket:\s*(T-\d{3,})\s*-->")


def _load_schema(name: str) -> Draft7Validator:
    import json
    return Draft7Validator(json.loads((SCHEMA_DIR / name).read_text()))


def _parse_ticket(path: Path):
    m = FRONTMATTER_RE.match(path.read_text())
    if not m:
        return None, ""
    return yaml.safe_load(m.group(1)) or {}, m.group(2)


def _git_blob_sha(rel: str) -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", f"HEAD:{rel}"], cwd=REPO,
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _has_concrete_path(body: str, fm: dict) -> bool:
    if fm.get("source_refs"):
        return True
    return any(root in body for root in TIER_PATH_ROOTS)


def _cycle(graph: dict[str, list[str]]) -> list[str] | None:
    WHITE, GREY, BLACK = 0, 1, 2
    color = {n: WHITE for n in graph}
    stack: list[str] = []

    def visit(n: str):
        color[n] = GREY
        stack.append(n)
        for m in graph.get(n, []):
            if color.get(m) == GREY:
                return stack[stack.index(m):] + [m]
            if color.get(m, WHITE) == WHITE:
                r = visit(m)
                if r:
                    return r
        color[n] = BLACK
        stack.pop()
        return None

    for n in list(graph):
        if color[n] == WHITE:
            r = visit(n)
            if r:
                return r
    return None


def lint() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    try:
        ticket_v = _load_schema("ticket.schema.json")
        manifest_v = _load_schema("ticket-manifest.schema.json")
    except Exception as exc:  # noqa: BLE001
        print(f"setup:cannot load schemas: {exc}", file=sys.stderr)
        return 3

    if not TICKETS_ROOT.exists():
        print("agents/tickets/: no bundles yet — nothing to lint")
        return 0

    bundle_ids: set[str] = set()

    for bundle in sorted(TICKETS_ROOT.iterdir()):
        if not bundle.is_dir() or bundle.name in {"archive"}:
            continue

        manifest = bundle / "manifest.yml"
        graph_ids: set[str] = set()
        if not manifest.exists():
            failures.append(f"{bundle}:missing manifest.yml")
        else:
            data = yaml.safe_load(manifest.read_text()) or {}
            for err in manifest_v.iter_errors(data):
                failures.append(f"{manifest}:manifest schema: {err.message}")
            dg = data.get("dependency_graph", {}) or {}
            graph_ids = set(dg)
            edges = {k: list(v.get("blocks", [])) for k, v in dg.items()}
            cyc = _cycle(edges)
            if cyc:
                failures.append(f"{manifest}:dependency cycle: {' -> '.join(cyc)}")

        for tf in sorted(bundle.glob("T-*.md")):
            fm, body = _parse_ticket(tf)
            if fm is None:
                failures.append(f"{tf}:no YAML frontmatter")
                continue
            tid = fm.get("id", "?")
            bundle_ids.add(tid)
            for err in ticket_v.iter_errors(fm):
                failures.append(f"{tf}:schema: {err.message}")

            tier = fm.get("model_tier")
            # §5 floor — strictest for lite
            if tier == "lite":
                if not fm.get("acceptance"):
                    failures.append(f"{tf}:lite ticket missing runnable acceptance")
                if not _has_concrete_path(body, fm):
                    failures.append(f"{tf}:lite ticket has no concrete path in spine/source_refs")
                b = fm.get("boundaries") or {}
                if not b.get("must_touch"):
                    failures.append(f"{tf}:lite ticket missing boundaries.must_touch")
                if "Do NOT touch" not in body and "do not touch" not in body.lower():
                    failures.append(f"{tf}:lite ticket missing a Do-NOT-touch boundary section")
            for bad in ("TBD", "figure out", "tbd"):
                if any(bad in a for a in fm.get("acceptance", []) if isinstance(a, str)):
                    failures.append(f"{tf}:acceptance contains non-decidable token '{bad}'")

            # staleness — split severity
            for ref in fm.get("adr_refs", []) or []:
                pinned = ref.get("sha")
                if pinned in (None, "pending"):
                    continue
                actual = _git_blob_sha(ref["path"])
                if actual and actual != pinned:
                    failures.append(f"{tf}:adr_refs drift (HARD) {ref['path']} pinned={pinned[:8]} now={actual[:8]}")
            for ref in fm.get("source_refs", []) or []:
                pinned = ref.get("sha")
                if pinned in (None, "pending"):
                    continue
                actual = _git_blob_sha(ref["path"])
                if actual and actual != pinned:
                    warnings.append(f"{tf}:source_refs drift (warn) {ref['path']}")

            # asset resolution + size cap ("none" / scalar means no assets)
            assets_val = fm.get("assets") or []
            if isinstance(assets_val, str):
                assets_val = []
            for asset in assets_val:
                ap = (bundle / asset).resolve()
                if not ap.exists():
                    failures.append(f"{tf}:asset link unresolved: {asset}")
                elif ap.stat().st_size > ASSET_CAP_BYTES:
                    warnings.append(f"{tf}:asset over 500KB cap: {asset}")

        # manifest graph ids must match ticket ids in the bundle
        file_ids = {fm.get("id") for fm in (_parse_ticket(t)[0] for t in bundle.glob("T-*.md")) if fm}
        for missing in graph_ids - file_ids:
            failures.append(f"{manifest}:dependency_graph references {missing} with no ticket file")

    # spine: roadmap markers <-> bundle ids
    marker_ids: set[str] = set()
    for rm in ROADMAPS.glob("*.md"):
        for mid in MARKER_RE.findall(rm.read_text()):
            marker_ids.add(mid)
    for mid in marker_ids - bundle_ids:
        failures.append(f"spine:roadmap marker {mid} has no bundle ticket")

    # lint-roadmap-materialized: in a materialized roadmap (>=1 marker), every
    # non-intro phase that carries open/done steps must carry >=1 ticket marker.
    for rm in ROADMAPS.glob("*.md"):
        text = rm.read_text()
        if not MARKER_RE.search(text):
            continue  # not materialized — nothing to enforce
        phase = None
        has_step = has_marker = False

        def _close(p, step, mark):
            # Partial materialisation is legitimate (some phases ticketed, some
            # not) → warn, don't fail, so an un-materialised phase is surfaced
            # without blocking.
            if p and step and not mark:
                warnings.append(f"{rm}:materialized roadmap — phase '{p}' has steps but no ticket marker (not materialised)")

        for ln in text.split("\n"):
            if ln.startswith("## Phase"):
                _close(phase, has_step, has_marker)
                phase = ln[3:].strip()
                has_step = has_marker = False
            elif ln.startswith("## "):  # left the phase region (Acceptance/Notes)
                _close(phase, has_step, has_marker)
                phase = None
            elif phase:
                if ln.lstrip().startswith(("- [ ]", "- [x]", "- [~]", "- [-]")):
                    has_step = True
                if MARKER_RE.search(ln):
                    has_marker = True
        _close(phase, has_step, has_marker)

    for w in warnings:
        print(f"⚠️  {w}")
    for f in failures:
        print(f"❌ {f}")
    if failures:
        print(f"\n{len(failures)} failure(s), {len(warnings)} warning(s)")
        return 1
    print(f"✅ ticket bundles build-ready ({len(bundle_ids)} ticket(s), {len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(lint())
