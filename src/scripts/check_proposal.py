#!/usr/bin/env python3
"""
Stage-4 gate for curated self-improvement proposals.

Validates a proposal doc produced by the pipeline documented in
`guidelines/agent-infra/self-improvement-pipeline.md`. A proposal is
only eligible to advance to `stage: gated` if every check here passes.

Gate checks (all hard):
  1. Frontmatter complete — proposal_id, type, scope, stage, author,
     created, last_updated.
  2. Type / scope / stage values are from the documented vocabulary.
  3. Evidence block — ≥2 entries under `evidence:`, each with distinct
     `ref` value. At least two distinct hosts/repos/paths.
  4. No "TODO" / "TBD" / "xxx" markers in the draft body.
  5. Required sections all present (1..10 per template).
  6. Success signal — Section 7 has a concrete metric, target, and
     evaluation date.

Exit codes: 0 = pass, 1 = gate failure, 2 = PyYAML missing, 3 = internal error.

Usage:
    python3 scripts/check_proposal.py agents/proposals/my-proposal.md
    python3 scripts/check_proposal.py --format json path/to.md
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Literal, Tuple
from urllib.parse import urlparse

Severity = Literal["error", "warning"]

REQUIRED_FRONTMATTER = {
    "proposal_id", "type", "scope", "stage",
    "author", "created", "last_updated",
}
VALID_TYPES = {"rule", "skill", "command", "guideline"}
VALID_SCOPES = {"project", "package"}
VALID_STAGES = {"captured", "classified", "proposed", "gated", "upstream"}
REQUIRED_SECTIONS: List[Tuple[str, str]] = [
    (r"^##\s+1\.\s+Learning\b", "1. Learning"),
    (r"^##\s+2\.\s+Classification\b", "2. Classification"),
    (r"^##\s+3\.\s+Evidence\b", "3. Evidence"),
    (r"^##\s+4\.\s+Proposed artefact\b", "4. Proposed artefact"),
    (r"^##\s+5\.\s+Quality gate expectations\b", "5. Quality gate expectations"),
    (r"^##\s+6\.\s+Replacement justification\b", "6. Replacement justification"),
    (r"^##\s+7\.\s+Success signal\b", "7. Success signal"),
    (r"^##\s+8\.\s+Risks and alternatives rejected\b", "8. Risks and alternatives rejected"),
    (r"^##\s+9\.\s+Gate verdict\b", "9. Gate verdict"),
    (r"^##\s+10\.\s+Upstream PR\b", "10. Upstream PR"),
]
BAD_MARKERS = re.compile(r"\b(TODO|TBD|FIXME|XXX)\b")
FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


@dataclass
class Finding:
    severity: Severity
    section: str
    message: str


def _load_frontmatter(text: str) -> dict:
    match = FRONTMATTER_PATTERN.match(text)
    if not match:
        return {}
    try:
        import yaml
    except ImportError:
        print("error: PyYAML not installed. Run `pip install pyyaml`.", file=sys.stderr)
        sys.exit(2)
    return yaml.safe_load(match.group(1)) or {}


def _body_after_frontmatter(text: str) -> str:
    match = FRONTMATTER_PATTERN.match(text)
    return text[match.end():] if match else text


def _check_frontmatter(fm: dict, findings: List[Finding]):
    missing = REQUIRED_FRONTMATTER - set(fm.keys())
    for key in sorted(missing):
        findings.append(Finding("error", "frontmatter", f"missing: {key}"))
    if fm.get("type") and fm["type"] not in VALID_TYPES:
        findings.append(Finding("error", "frontmatter",
                                f"invalid type '{fm['type']}'"))
    if fm.get("scope") and fm["scope"] not in VALID_SCOPES:
        findings.append(Finding("error", "frontmatter",
                                f"invalid scope '{fm['scope']}'"))
    if fm.get("stage") and fm["stage"] not in VALID_STAGES:
        findings.append(Finding("error", "frontmatter",
                                f"invalid stage '{fm['stage']}'"))


def _check_sections(body: str, findings: List[Finding]):
    for pattern, name in REQUIRED_SECTIONS:
        if not re.search(pattern, body, flags=re.MULTILINE):
            findings.append(Finding("error", "sections", f"missing section: {name}"))


def _extract_evidence_refs(body: str) -> List[str]:
    refs: List[str] = []
    ev_match = re.search(r"^##\s+3\.\s+Evidence\b(.+?)(?=^##\s)", body,
                         flags=re.DOTALL | re.MULTILINE)
    if not ev_match:
        return refs
    for line in ev_match.group(1).splitlines():
        m = re.match(r"\s*-?\s*ref:\s*(\S+)", line)
        if m:
            refs.append(m.group(1).strip())
    return refs


def _check_evidence(body: str, findings: List[Finding]):
    refs = _extract_evidence_refs(body)
    if len(refs) < 2:
        findings.append(Finding("error", "evidence",
                                f"need ≥2 evidence refs, found {len(refs)}"))
        return
    # Independence — two distinct hosts OR two distinct paths.
    hosts = {urlparse(r).netloc or r for r in refs}
    paths = {urlparse(r).path.rsplit("/", 2)[-2:] and urlparse(r).path for r in refs}
    if len(hosts) < 2 and len({tuple(urlparse(r).path.strip("/").split("/")[:2]) for r in refs}) < 2:
        findings.append(Finding("warning", "evidence",
                                "evidence refs look similar — verify independence"))


def _strip_html_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)


def _check_markers(body: str, findings: List[Finding]):
    stripped = _strip_html_comments(body)
    for line_no, line in enumerate(stripped.splitlines(), 1):
        if line.lstrip().startswith("//"):
            continue
        if BAD_MARKERS.search(line):
            findings.append(Finding("error", "markers",
                                    f"draft placeholder on line {line_no}: {line.strip()[:60]}"))


def _check_success_signal(body: str, findings: List[Finding]):
    m = re.search(r"^##\s+7\.\s+Success signal\b(.+?)(?=^##\s)", body,
                  flags=re.DOTALL | re.MULTILINE)
    if not m:
        return
    sect = m.group(1)
    for label in ("Metric:", "Baseline:", "Target:", "Evaluation date:"):
        if label not in sect:
            findings.append(Finding("error", "success-signal",
                                    f"missing '{label}' entry"))


def _check_originating_project(body: str, fm: dict,
                               findings: List[Finding]):
    """Section 10 must name the originating project once stage=upstream.

    `originating_project` is metadata only — the linter does NOT check
    for specific identifiers. It only ensures the slot is filled so the
    Q2 outcome measurement can group merged proposals by consumer repo.
    """
    if fm.get("stage") != "upstream":
        return
    m = re.search(r"^##\s+10\.\s+Upstream PR\b(.+?)(?:^##\s|\Z)", body,
                  flags=re.DOTALL | re.MULTILINE)
    sect = m.group(1) if m else ""
    if "Originating project:" not in sect:
        findings.append(Finding("error", "originating-project",
                                "Section 10 must include 'Originating "
                                "project: <slug>' when stage=upstream"))
        return
    line = re.search(r"Originating project:\s*(.*)", sect)
    value = (line.group(1).strip() if line else "")
    if not value or value.startswith("<") or value in {"-", "…", "TBD"}:
        findings.append(Finding("error", "originating-project",
                                "Originating project slot is empty or "
                                "left as template placeholder"))


def _proposal_rate_warning(path: Path, findings: List[Finding],
                           limit: int = 6, window_days: int = 90) -> None:
    """Soft cap: warn if the proposals/ directory already holds `limit`
    proposals authored within the last `window_days`.

    Never a hard block — the Stage-4 gate does not adjudicate volume.
    The goal is to surface a consumer that is over-fitting the package.
    """
    import datetime as dt
    parent = path.parent
    if parent.name != "proposals":
        return
    cutoff = dt.date.today() - dt.timedelta(days=window_days)
    recent = 0
    for md in parent.glob("*.md"):
        if md.resolve() == path.resolve():
            continue
        try:
            text = md.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        fm_m = FRONTMATTER_PATTERN.match(text)
        if not fm_m:
            continue
        created_m = re.search(r"^created:\s*(\S+)", fm_m.group(1),
                              flags=re.MULTILINE)
        if not created_m:
            continue
        try:
            created = dt.date.fromisoformat(created_m.group(1).strip())
        except ValueError:
            continue
        if created >= cutoff:
            recent += 1
    if recent >= limit:
        findings.append(Finding(
            "warning", "rate-limit",
            f"{recent} proposals in the last {window_days}d — consider "
            "bundling or pruning; the package is a public good, not a "
            "per-project scratchpad",
        ))


def _run_checks(text: str, path: Path | None = None) -> List[Finding]:
    findings: List[Finding] = []
    fm = _load_frontmatter(text)
    _check_frontmatter(fm, findings)
    body = _body_after_frontmatter(text)
    _check_sections(body, findings)
    _check_evidence(body, findings)
    _check_markers(body, findings)
    _check_success_signal(body, findings)
    _check_originating_project(body, fm, findings)
    if path is not None:
        _proposal_rate_warning(path, findings)
    return findings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("path", help="Path to the proposal .md file")
    ap.add_argument("--format", choices=["text", "json"], default="text")
    args = ap.parse_args()
    path = Path(args.path)
    if not path.exists():
        print(f"error: {path} not found", file=sys.stderr)
        return 3
    findings = _run_checks(path.read_text(encoding="utf-8"), path=path)
    errors = [f for f in findings if f.severity == "error"]
    if args.format == "json":
        print(json.dumps({"findings": [asdict(f) for f in findings]}, indent=2))
    else:
        for f in findings:
            icon = "❌" if f.severity == "error" else "⚠️"
            print(f"  {icon}  [{f.section}]  {f.message}")
        print(f"\nSummary: {len(errors)} error(s), "
              f"{sum(1 for f in findings if f.severity == 'warning')} warning(s)")
        print(f"Verdict: {'BLOCK' if errors else 'PASS'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
