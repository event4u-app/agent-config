#!/usr/bin/env python3
"""Deterministic detection helper for the refine-ticket skill.

Reads the detection-map.yml from
.agent-src.uncompressed/skills/refine-ticket/ (or the projected copy),
takes ticket body text, and returns a structured decision — which
sub-skills should fire, which keywords matched, and an
orchestration-notes line per sub-skill ready to fold into the skill
output.

This helper makes the skill's Step 2 deterministic and pytest-covered.
The skill's procedure cites this helper by name; it does not re-derive
the matching logic.

Usage:
    from scripts.refine_ticket_detect import detect, load_map
    decision = detect(ticket_body, load_map())
"""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

try:
    import yaml
except ImportError as exc:
    raise SystemExit(
        "refine_ticket_detect requires pyyaml (pip install pyyaml)"
    ) from exc

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAP = (
    REPO_ROOT
    / ".agent-src.uncompressed"
    / "skills"
    / "refine-ticket"
    / "detection-map.yml"
)


@dataclass
class SubSkillDecision:
    skill: str
    fired: bool
    matched_keywords: list[str] = field(default_factory=list)
    matched_regex: list[str] = field(default_factory=list)
    require_count: int = 1
    notes: str = ""

    def as_output_line(self) -> str:
        if not self.fired:
            return f"`{self.skill}` — skipped (no trigger match)"
        matches = self.matched_keywords + self.matched_regex
        shown = ", ".join(matches[:5])
        extra = (
            f" (+{len(matches) - 5} more)" if len(matches) > 5 else ""
        )
        return f"`{self.skill}` — fired on: {shown}{extra}"


@dataclass
class RepoContext:
    """Repo-local signals gathered when cwd is inside a repo clone.

    Feeds the skill's Top-5 risks with project-specific vocabulary —
    recent branch names (naming-convention signal), recent commit
    subjects (active modules signal), and on-disk `agents/contexts/`
    documents (domain-vocabulary signal).

    Empty when `repo_aware=False` — the skill still produces the same
    output shape (graceful degrade), but without repo-specific
    citations.
    """

    recent_branches: list[str] = field(default_factory=list)
    recent_commits: list[str] = field(default_factory=list)
    context_docs: list[str] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not (
            self.recent_branches or self.recent_commits or self.context_docs
        )

    def summary_line(self) -> str:
        if self.is_empty():
            return "Repo context — none gathered"
        parts = [
            f"{len(self.recent_branches)} branches",
            f"{len(self.recent_commits)} commits",
            f"{len(self.context_docs)} context docs",
        ]
        return "Repo context — " + ", ".join(parts)


@dataclass
class Decision:
    sub_skills: list[SubSkillDecision]
    repo_aware: bool
    repo_context: RepoContext = field(default_factory=RepoContext)

    def orchestration_notes(self) -> list[str]:
        notes = [ss.as_output_line() for ss in self.sub_skills]
        notes.append(
            f"Repo-aware — {'on' if self.repo_aware else 'off'}"
        )
        if self.repo_aware:
            notes.append(self.repo_context.summary_line())
        return notes


def load_map(path: Path | None = None) -> dict:
    path = path or DEFAULT_MAP
    if not path.exists():
        raise FileNotFoundError(f"detection-map not found: {path}")
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if data.get("version") != 1:
        raise ValueError(
            f"unsupported detection-map version: {data.get('version')}"
        )
    return data


def _match_sub_skill(
    text_lower: str, text_original: str, skill_name: str, spec: dict
) -> SubSkillDecision:
    keywords = [kw.lower() for kw in spec.get("keywords", [])]
    require = int(spec.get("require_count", 1))
    matched_kw = sorted({kw for kw in keywords if kw in text_lower})
    matched_rx: list[str] = []
    for pattern in spec.get("regex", []) or []:
        if re.search(pattern, text_original):
            matched_rx.append(pattern)
    distinct = len(matched_kw) + len(matched_rx)
    return SubSkillDecision(
        skill=skill_name,
        fired=distinct >= require,
        matched_keywords=matched_kw,
        matched_regex=matched_rx,
        require_count=require,
        notes=(spec.get("notes") or "").strip(),
    )


def _detect_repo_aware(
    cwd: Path | None, spec: dict | None
) -> bool:
    if not spec or cwd is None:
        return False
    signals = spec.get("signals", [])
    require = int(spec.get("require_count", 1))
    hits = 0
    for sig in signals:
        target = cwd / sig["path"]
        if sig.get("type") == "dir" and target.is_dir():
            hits += 1
        elif sig.get("type") == "file" and target.is_file():
            hits += 1
    return hits >= require


def _run_git(cwd: Path, args: list[str]) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout


def gather_repo_context(
    cwd: Path,
    branch_limit: int = 20,
    commit_limit: int = 30,
) -> RepoContext:
    """Collect naming-convention signals from the enclosing repo.

    Safe outside a repo — returns an empty `RepoContext`. Safe when
    `git` is unavailable (timeout / not installed) — returns partial
    data without raising.
    """
    if not (cwd / ".git").is_dir():
        return RepoContext()

    branches_raw = _run_git(
        cwd,
        [
            "for-each-ref",
            "--count",
            str(branch_limit),
            "--sort=-committerdate",
            "--format=%(refname:short)",
            "refs/heads/",
        ],
    )
    branches = [b.strip() for b in branches_raw.splitlines() if b.strip()]

    commits_raw = _run_git(
        cwd, ["log", f"-{commit_limit}", "--pretty=format:%s"]
    )
    commits = [c.strip() for c in commits_raw.splitlines() if c.strip()]

    context_docs: list[str] = []
    contexts_dir = cwd / "agents" / "contexts"
    if contexts_dir.is_dir():
        context_docs = sorted(
            p.name for p in contexts_dir.glob("*.md") if p.is_file()
        )

    return RepoContext(
        recent_branches=branches,
        recent_commits=commits,
        context_docs=context_docs,
    )


def detect(
    ticket_body: str,
    detection_map: dict,
    cwd: Path | None = None,
) -> Decision:
    text_lower = ticket_body.lower()
    decisions: list[SubSkillDecision] = []
    for skill_name, spec in detection_map.get("sub_skills", {}).items():
        decisions.append(
            _match_sub_skill(text_lower, ticket_body, skill_name, spec)
        )
    repo_aware = _detect_repo_aware(cwd, detection_map.get("repo_aware"))
    repo_context = (
        gather_repo_context(cwd) if repo_aware and cwd else RepoContext()
    )
    return Decision(
        sub_skills=decisions,
        repo_aware=repo_aware,
        repo_context=repo_context,
    )


def main() -> None:
    import argparse
    import sys

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path", nargs="?", help="Path to a ticket body .md file; - for stdin"
    )
    args = parser.parse_args()
    if not args.path or args.path == "-":
        body = sys.stdin.read()
    else:
        body = Path(args.path).read_text(encoding="utf-8")
    decision = detect(body, load_map(), cwd=Path.cwd())
    for line in decision.orchestration_notes():
        print(line)


if __name__ == "__main__":
    main()
