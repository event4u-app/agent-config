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

import json
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

# Composite tokens that contain a sub-skill keyword as a substring but
# are not themselves triggers (Phase F2). Matched with word boundaries
# on the lowercased text and substituted before keyword matching so the
# contained keyword ("password") does not fire on them. Defence in
# depth: word-boundary matching alone already skips these, the
# blocklist catches edge cases where a future keyword change or unusual
# spelling might otherwise re-introduce the false positive.
BLOCKED_COMPOSITES = (
    "1password",
    "lastpass",
    "bitwarden",
)
_BLOCKLIST_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(t) for t in BLOCKED_COMPOSITES) + r")\b",
    flags=re.IGNORECASE,
)

# Ticket-ID pattern (Phase F1). Jira / Linear / Shortcut style —
# two-to-ten uppercase letters, hyphen, digits. Used to extract the
# project key (``DEV`` in ``DEV-6182``) from a ticket body.
_TICKET_KEY_RE = re.compile(r"\b([A-Z]{2,10})-\d+\b")


@dataclass
class SubSkillDecision:
    skill: str
    fired: bool
    matched_keywords: list[str] = field(default_factory=list)
    matched_regex: list[str] = field(default_factory=list)
    matched_alt_signals: list[str] = field(default_factory=list)
    require_count: int = 1
    notes: str = ""

    def as_output_line(self) -> str:
        if not self.fired:
            return f"`{self.skill}` — skipped (no trigger match)"
        matches = (
            self.matched_keywords
            + self.matched_regex
            + self.matched_alt_signals
        )
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
class ProjectAlignment:
    """Cross-check between the ticket's project key and the current repo.

    Phase F1 + F7 — emits a one-line advisory in orchestration notes
    whenever the ticket is clearly tagged (``DEV-6182``) AND the cwd
    offers at least one repo identifier (composer/package name,
    historical branch-prefix project key). Stays silent when either
    side is absent so the output is not padded with noise.
    """

    ticket_project_key: str | None = None
    repo_identifiers: list[str] = field(default_factory=list)
    matched: bool | None = None

    def has_data(self) -> bool:
        return bool(self.ticket_project_key and self.repo_identifiers)

    def as_output_line(self) -> str | None:
        if not self.has_data():
            return None
        shown = ", ".join(f"`{r}`" for r in self.repo_identifiers[:3])
        if self.matched:
            return (
                f"Repo project match — ticket `{self.ticket_project_key}` "
                f"aligns with repo identifiers {shown}"
            )
        return (
            f"Repo project mismatch — ticket `{self.ticket_project_key}`, "
            f"repo identifiers {shown} — context may not apply"
        )


@dataclass
class Decision:
    sub_skills: list[SubSkillDecision]
    repo_aware: bool
    repo_context: RepoContext = field(default_factory=RepoContext)
    alignment: ProjectAlignment = field(default_factory=ProjectAlignment)

    def orchestration_notes(self) -> list[str]:
        notes = [ss.as_output_line() for ss in self.sub_skills]
        notes.append(
            f"Repo-aware — {'on' if self.repo_aware else 'off'}"
        )
        if self.repo_aware:
            notes.append(self.repo_context.summary_line())
        # Phase F1 + F7 — alignment line is independent of repo_aware;
        # a cross-repo invocation must surface the warning even when
        # repo-aware context gathering is off.
        alignment_line = self.alignment.as_output_line()
        if alignment_line is not None:
            notes.append(alignment_line)
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


def _keyword_pattern(keyword: str) -> re.Pattern[str]:
    """Word-boundary regex for a keyword (Phase F2).

    `\\b` matches at word/non-word transitions — `[A-Za-z0-9_]` vs. any
    other character. Multi-word keywords like ``api key`` and
    hyphenated keywords like ``multi-tenant`` work because the inner
    space / hyphen is a non-word character and the outer boundaries
    still anchor against the surrounding text.
    """
    return re.compile(r"\b" + re.escape(keyword) + r"\b", flags=re.IGNORECASE)


def _mask_blocked_composites(text_lower: str) -> str:
    """Neutralize composite tokens that contain a keyword as substring.

    Returns ``text_lower`` with each occurrence of a blocked composite
    replaced by a fixed marker of equal length-class (non-word chars)
    so keyword positions after the replacement stay plausible.
    """
    return _BLOCKLIST_RE.sub("__blocked__", text_lower)


_AC_BULLET_RE = re.compile(
    r"^\s*[-*]\s*\[[ xX~\-]\]\s*(\S+)",
    flags=re.MULTILINE,
)


def _extract_description_body(body: str) -> str:
    """Return the prose between ``## Description`` and the next level-2
    heading, or the whole body when no ``## Description`` heading is
    found. Used by the F3 alt-signal ``min_body_sentences`` check.
    """
    m = re.search(
        r"##\s*Description\s*\n(.+?)(?=\n##\s|\Z)",
        body,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if m:
        return m.group(1).strip()
    return body.strip()


def _split_sentences(text: str) -> list[str]:
    """Naive sentence splitter — punctuation `.!?` followed by whitespace.

    Good enough for the F3 heuristic; intentionally avoids NLP deps.
    """
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p.strip() and len(p.strip()) > 2]


def _extract_ac_first_words(body: str) -> list[str]:
    """First token of every AC bullet, lowercased and alpha-only.

    Used by the F3 alt-signal ``min_distinct_ac_first_words`` check —
    a crude proxy for "distinct verbs in AC" without lemmatization.
    """
    words: list[str] = []
    for raw in _AC_BULLET_RE.findall(body):
        cleaned = re.sub(r"[^A-Za-z]", "", raw).lower()
        if cleaned:
            words.append(cleaned)
    return words


def _evaluate_alt_signals(body: str, spec: dict) -> list[str]:
    """Compute Phase F3 alternative signals for a sub-skill.

    Returns a list of human-readable reasons (empty when no threshold
    is met). Reasons are folded into `matched_alt_signals` so the
    orchestration-notes line explains *why* the sub-skill fired.
    """
    alt = spec.get("alternative_signals")
    if not isinstance(alt, dict) or not alt:
        return []
    reasons: list[str] = []

    min_sent = alt.get("min_body_sentences")
    if isinstance(min_sent, int) and min_sent > 0:
        n = len(_split_sentences(_extract_description_body(body)))
        if n >= min_sent:
            reasons.append(f"body sentences {n}≥{min_sent}")

    min_ac = alt.get("min_distinct_ac_first_words")
    if isinstance(min_ac, int) and min_ac > 0:
        distinct = len(set(_extract_ac_first_words(body)))
        if distinct >= min_ac:
            reasons.append(f"ac first-words {distinct}≥{min_ac}")

    return reasons


def _match_sub_skill(
    text_lower: str, text_original: str, skill_name: str, spec: dict
) -> SubSkillDecision:
    keywords = [kw.lower() for kw in spec.get("keywords", [])]
    require = int(spec.get("require_count", 1))
    masked = _mask_blocked_composites(text_lower)
    matched_kw = sorted({
        kw for kw in keywords if _keyword_pattern(kw).search(masked)
    })
    matched_rx: list[str] = []
    for pattern in spec.get("regex", []) or []:
        if re.search(pattern, text_original):
            matched_rx.append(pattern)
    distinct = len(matched_kw) + len(matched_rx)
    matched_alt = _evaluate_alt_signals(text_original, spec)
    fired = distinct >= require or bool(matched_alt)
    return SubSkillDecision(
        skill=skill_name,
        fired=fired,
        matched_keywords=matched_kw,
        matched_regex=matched_rx,
        matched_alt_signals=matched_alt,
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


def _extract_ticket_project_key(body: str) -> str | None:
    """Extract the dominant Jira / Linear / Shortcut project key (Phase F1).

    Picks the most frequent ``[A-Z]{2,10}`` prefix across all ticket IDs
    found in the body. Ties resolve to the first occurrence order.
    Returns ``None`` when no ticket IDs are present.
    """
    from collections import Counter

    matches = _TICKET_KEY_RE.findall(body)
    if not matches:
        return None
    counts = Counter(matches)
    top_count = counts.most_common(1)[0][1]
    for key in matches:
        if counts[key] == top_count:
            return key
    return None


def _gather_repo_identifiers(cwd: Path) -> list[str]:
    """Collect project-identifier tokens from the enclosing repo (Phase F1).

    Sources, in order:
      1. ``composer.json`` ``name`` field (``vendor/package``).
      2. ``package.json`` ``name`` field (``@scope/package``).
      3. Historical branch prefixes that look like Jira project keys.

    Silent when a source is unreadable or absent. De-duplicates
    case-insensitively while preserving first-seen order.
    """
    ids: list[str] = []

    for fname in ("composer.json", "package.json"):
        fpath = cwd / fname
        if not fpath.is_file():
            continue
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        name = data.get("name") if isinstance(data, dict) else None
        if isinstance(name, str) and name:
            for part in re.split(r"[/@]", name):
                part = part.strip()
                if part:
                    ids.append(part)

    branches_raw = _run_git(
        cwd,
        [
            "for-each-ref",
            "--count", "50",
            "--sort=-committerdate",
            "--format=%(refname:short)",
            "refs/heads/",
        ],
    )
    for branch in branches_raw.splitlines():
        for prefix in _TICKET_KEY_RE.findall(branch):
            ids.append(prefix)

    seen: set[str] = set()
    deduped: list[str] = []
    for x in ids:
        key = x.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(x)
    return deduped


def _match_project(ticket_key: str, repo_ids: list[str]) -> bool:
    """Heuristic project match — case-insensitive substring either way.

    ``DEV`` matches ``devtools`` (repo id contains ticket key) and vice
    versa (``DEVOPS`` ticket key matches ``dev`` repo id). Strict
    equality is a subset of this rule.
    """
    tk = ticket_key.lower()
    for rid in repo_ids:
        rlow = rid.lower()
        if tk == rlow or tk in rlow or rlow in tk:
            return True
    return False


def _compute_alignment(
    ticket_body: str, cwd: Path | None
) -> ProjectAlignment:
    if cwd is None:
        return ProjectAlignment()
    ticket_key = _extract_ticket_project_key(ticket_body)
    if ticket_key is None:
        return ProjectAlignment()
    repo_ids = _gather_repo_identifiers(cwd)
    if not repo_ids:
        return ProjectAlignment(ticket_project_key=ticket_key)
    return ProjectAlignment(
        ticket_project_key=ticket_key,
        repo_identifiers=repo_ids,
        matched=_match_project(ticket_key, repo_ids),
    )


# ---- Phase F4 — parent context folding -------------------------------------

_PARENT_AUTO_FETCH_TYPES = frozenset({"story", "sub-task", "subtask"})


def issuetype_needs_parent(issuetype: str | None) -> bool:
    """Decide whether the F4 auto-fetch rule applies to this issuetype.

    Story / Sub-task (Jira) and their Linear / Shortcut equivalents
    inherit AC context from a parent epic most of the time. Task / Bug
    / Epic themselves do not, unless a ``parent`` link field is
    already populated — that branch is the agent's responsibility and
    is not encoded here. Comparison is case-insensitive and tolerant
    of ``Sub-task`` vs ``Subtask`` spellings.
    """
    if not issuetype:
        return False
    return issuetype.strip().lower() in _PARENT_AUTO_FETCH_TYPES


def fold_parent_context(
    ticket_body: str,
    parent_body: str,
    parent_key: str,
) -> str:
    """Prepend a canonical ``## Parent context`` block to the ticket body.

    The folded block is what the deterministic detection helper sees,
    so parent-level keywords correctly raise sub-skill triggers and
    the skill's ``Open questions`` section can cite parent AC lines
    verbatim. Idempotent — folding twice with the same parent does
    not duplicate the block.
    """
    header = f"## Parent context — {parent_key}"
    if header in ticket_body:
        return ticket_body
    parent_block = parent_body.strip() or "_(parent body empty)_"
    folded = (
        f"{header}\n\n"
        f"{parent_block}\n\n"
        f"---\n\n"
        f"{ticket_body.lstrip()}"
    )
    return folded


# ---- Phase F6 — close-prompt write-permission probe ------------------------

CLOSE_PROMPT_FULL = (
    "> Next action for this ticket:\n"
    ">\n"
    "> 1. Comment on Jira — I'll post the refined version as a comment"
    " (original untouched)\n"
    "> 2. Replace description — I'll overwrite the Jira description;"
    " original saved in a comment\n"
    "> 3. Nothing — I'll handle it myself / leave the ticket as is"
)

CLOSE_PROMPT_READ_ONLY = (
    "> Next action for this ticket:\n"
    ">\n"
    "> 1. Copy-paste — no write access to this project"
)


def render_close_prompt(write_access: bool | None) -> str:
    """Return the numbered close-prompt block for the skill output.

    - ``True``  — full three-option prompt (comment / replace / nothing).
    - ``False`` — single-option prompt (copy-paste only); options 1 and
      2 are hidden up front instead of degrading after the user picks.
    - ``None``  — probe itself failed (network, auth, missing tool).
      Fall back to the full prompt; the skill degrades on selection
      per the v1 behaviour.
    """
    if write_access is False:
        return CLOSE_PROMPT_READ_ONLY
    return CLOSE_PROMPT_FULL


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
    alignment = _compute_alignment(ticket_body, cwd)
    return Decision(
        sub_skills=decisions,
        repo_aware=repo_aware,
        repo_context=repo_context,
        alignment=alignment,
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
