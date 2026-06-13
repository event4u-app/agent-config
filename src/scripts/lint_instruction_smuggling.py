#!/usr/bin/env python3
"""P1.2 — instruction-smuggling / suppression-phrase linter (road-to-security-pillar.md).

Detects instructions smuggled into rule/skill/command bodies (and MCP tool
descriptions) that try to steer or silence the agent — the prose half of the
"rules-file backdoor" + MCP "tool-poisoning" attack classes.

Precision over recall (false-positive containment, P1.5): the corpus
*legitimately* quotes attack strings as teaching material, so this linter only
treats a pattern as a **blocking (HIGH)** smuggle when it appears as live
**prose** — outside any code fence and outside inline `backtick` spans, where a
teaching doc would put a quoted example. Shell / secret-path signatures are
common in legitimate security docs, so they are **MED warnings**, never blocking.

- HIGH (fail): disclosure-suppression imperative ("do not mention/tell the
  user", "without explaining") or an imperative injection tag (`<IMPORTANT>`,
  "ignore previous instructions", "you are now …") in live prose.
- MED (warn): pipe-to-shell, reverse-shell, or secret-path read in live prose.

Scope: every `.md` under src/{skills,rules,agent-src,domains}. Exempt: a
```security-example fence or a `security-lint: allow instruction-smuggling` pragma.

Usage: python3 src/scripts/lint_instruction_smuggling.py [--json]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import security_lint as sl  # noqa: E402

CHECK = "instruction-smuggling"

_INLINE_CODE = re.compile(r"`[^`]*`")

# HIGH — disclosure suppression as an imperative addressed to the agent.
_SUPPRESS = re.compile(
    r"\b(do not|don'?t|never)\s+(mention|tell|inform|disclose|reveal|notify)\b"
    r"[^.]{0,40}\b(the )?(user|human|reviewer|operator|owner)\b"
    r"|without (telling|informing|notifying|explaining to) (the )?(user|them|anyone)",
    re.IGNORECASE,
)
# HIGH — imperative injection / role-takeover tags and phrases.
_INJECT = re.compile(
    r"<\s*(important|system|admin|secret|critical)\s*>"
    r"|ignore (all |the )?(previous|prior|above) (instructions|prompts|rules)"
    r"|disregard (all |the )?(previous|prior|above)"
    r"|you are now (a|an|the)\b"
    r"|new system prompt",
    re.IGNORECASE,
)

# MED — execution / exfil signatures (common in legit security docs → warn only).
_MED = [
    (re.compile(r"\bcurl\b[^\n|]*\|\s*(ba|z|fi)?sh\b", re.IGNORECASE), "pipe-to-shell (curl|sh)"),
    (re.compile(r"\bwget\b[^\n|]*\|\s*(ba|z|fi)?sh\b", re.IGNORECASE), "pipe-to-shell (wget|sh)"),
    (re.compile(r"\b(socat|nc)\b[^\n]*\b(exec|-e)\b|/dev/tcp/", re.IGNORECASE), "reverse-shell signature"),
    (re.compile(r"(~/\.ssh/id_[rd]sa|/etc/shadow|\.aws/credentials)"), "secret-path read"),
]


def _strip_inline_code(text: str) -> str:
    """Blank out inline `code` spans so quoted examples don't trip prose checks."""
    return _INLINE_CODE.sub(lambda m: " " * len(m.group(0)), text)


def _scan(sf: sl.ScannedFile) -> list[sl.Finding]:
    if sf.pragma_allows(CHECK):
        return []
    out: list[sl.Finding] = []
    # prose = lines outside ANY fence; inline-code spans blanked.
    for lineno, text in sf.iter_lines(skip_example_fence=True, skip_any_fence=True):
        prose = _strip_inline_code(text)
        if _SUPPRESS.search(prose):
            out.append(sl.Finding(sf.rel, lineno, CHECK, "HIGH",
                                  "disclosure-suppression imperative in prose", sf.weight))
        if _INJECT.search(prose):
            out.append(sl.Finding(sf.rel, lineno, CHECK, "HIGH",
                                  "injection / role-takeover phrase in prose", sf.weight))
        for rx, label in _MED:
            if rx.search(prose):
                out.append(sl.Finding(sf.rel, lineno, CHECK, "MED",
                                      f"{label} in prose (verify intent)", sf.weight))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, epilog=sl.GUIDELINE_EPILOG)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    findings: list[sl.Finding] = []
    for sf in sl.iter_corpus():
        findings.extend(_scan(sf))

    if args.json:
        import json
        print(json.dumps([f.__dict__ for f in findings], indent=2))
        return 1 if any(f.is_fail for f in findings) else 0
    return sl.report(findings, check_label="instruction-smuggling")


if __name__ == "__main__":
    raise SystemExit(main())
