#!/usr/bin/env python3
"""Positioning consistency lint for event4u/agent-config.

Asserts that three public-positioning surfaces agree on the canonical
phrasing and that every advertised GitHub topic is discoverable in the
README body (literally or through `equivalents:` paraphrases).

Sources:
  - README.md              — canonical phrasing (H1 + first blockquote)
  - package.json           — `description` field
  - .github/about.yml      — `description` field
  - .github/topics.yml     — `topics:` + optional `equivalents:` map

Failure mode is a diff, not a stack trace. See R5 Phase 3 in
agents/roadmaps/strategic-visibility-mcp-topics-positioning.md.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("❌  PyYAML is required: pip3 install pyyaml\n")
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
README = REPO_ROOT / "README.md"
PACKAGE_JSON = REPO_ROOT / "package.json"
ABOUT_YML = REPO_ROOT / ".github" / "about.yml"
TOPICS_YML = REPO_ROOT / ".github" / "topics.yml"

# Canonical anchor: the right-side phrase of the README H1
# ("Agent Config — Universal AI Agent OS" → "Universal AI Agent OS").
# This is the substring that MUST appear in the other two surfaces.
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
BLOCKQUOTE_RE = re.compile(r"^>\s+(.+?)\s*$", re.MULTILINE)
DESCRIPTION_MAX = 200


def _read_readme_anchors() -> tuple[str, str, str]:
    text = README.read_text(encoding="utf-8")
    h1_match = H1_RE.search(text)
    if not h1_match:
        raise SystemExit("❌  README.md has no H1 heading")
    h1 = h1_match.group(1)
    # Anchor = the phrase after the em dash, falling back to the whole H1.
    parts = re.split(r"\s+[—–-]\s+", h1, maxsplit=1)
    anchor = parts[1].strip() if len(parts) == 2 else h1.strip()

    bq_match = BLOCKQUOTE_RE.search(text)
    blockquote = bq_match.group(1).strip() if bq_match else ""
    return h1, anchor, blockquote


def _read_package_description() -> str:
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    return str(data.get("description", "")).strip()


def _read_about_description() -> str:
    data = yaml.safe_load(ABOUT_YML.read_text(encoding="utf-8")) or {}
    return str(data.get("description", "")).strip()


def _read_topics() -> tuple[list[str], dict[str, list[str]]]:
    data = yaml.safe_load(TOPICS_YML.read_text(encoding="utf-8")) or {}
    topics = [str(t) for t in data.get("topics", [])]
    equivalents = {str(k): [str(v) for v in vs] for k, vs in (data.get("equivalents") or {}).items()}
    return topics, equivalents


def _topic_present(readme_lc: str, topic: str, equivalents: dict[str, list[str]]) -> tuple[bool, str | None]:
    needles = [topic, topic.replace("-", " "), topic.replace("-", "")] + equivalents.get(topic, [])
    for n in needles:
        if n and n.lower() in readme_lc:
            return True, n
    return False, None


def main() -> int:
    parser = argparse.ArgumentParser(description="Positioning consistency lint.")
    parser.add_argument("--quiet", action="store_true", help="Suppress success output.")
    args = parser.parse_args()

    h1, anchor, blockquote = _read_readme_anchors()
    pkg_desc = _read_package_description()
    about_desc = _read_about_description()
    topics, equivalents = _read_topics()

    errors: list[str] = []
    anchor_lc = anchor.lower()
    if anchor_lc not in pkg_desc.lower():
        errors.append("package.json.description missing canonical anchor")
    if anchor_lc not in about_desc.lower():
        errors.append(".github/about.yml description missing canonical anchor")
    if len(pkg_desc) > DESCRIPTION_MAX:
        errors.append(f"package.json.description is {len(pkg_desc)} chars (max {DESCRIPTION_MAX})")
    if len(about_desc) > DESCRIPTION_MAX:
        errors.append(f".github/about.yml description is {len(about_desc)} chars (max {DESCRIPTION_MAX})")

    readme_lc = README.read_text(encoding="utf-8").lower()
    missing_topics: list[str] = []
    for topic in topics:
        present, _ = _topic_present(readme_lc, topic, equivalents)
        if not present:
            missing_topics.append(topic)

    if errors or missing_topics:
        sys.stderr.write("❌  positioning drift detected:\n")
        sys.stderr.write(f"        README anchor:         {anchor}\n")
        sys.stderr.write(f"        package.json.desc:     {pkg_desc}\n")
        sys.stderr.write(f"        .github/about.yml:     {about_desc}\n\n")
        for err in errors:
            sys.stderr.write(f"        - {err}\n")
        if missing_topics:
            sys.stderr.write("\n        topics absent from README (literal + equivalents):\n")
            for t in missing_topics:
                sys.stderr.write(f"          - {t}\n")
            sys.stderr.write(
                "\n        Resolve by editing all three to share the canonical anchor,\n"
                "        or extending .github/topics.yml's `equivalents:` map\n"
                "        (or by removing the topic). The README is the canonical phrasing.\n"
            )
        else:
            sys.stderr.write(
                "\n        Resolve by editing all three to share the canonical anchor.\n"
                "        The README is the canonical phrasing; the other two follow it.\n"
            )
        return 1

    if not args.quiet:
        sys.stdout.write(f"✅  positioning consistent (anchor: {anchor!r}, topics: {len(topics)})\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
