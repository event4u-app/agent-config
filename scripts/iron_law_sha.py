#!/usr/bin/env python3
"""SHA-256 of every triple-fence block in a rule file (Iron Law preservation).

Usage:
  python3 scripts/iron_law_sha.py <rule-id> [<rule-id> ...]
  python3 scripts/iron_law_sha.py --all-kernel
  python3 scripts/iron_law_sha.py --diff <rule-id> --against <baseline-sha>

The Iron-Law block is delimited by triple-backtick fences. Every line
inside any fence in the file is concatenated, whitespace-normalised
(runs of spaces collapsed; leading / trailing whitespace stripped per
line), case-folded, then SHA-256-hashed. Empty fences hash to
SHA-256(''), which is `e3b0c442…` (the well-known empty-string hash).

Acceptance per `road-to-kernel-and-router.md` P2.2: re-runnable,
deterministic, stdlib-only, no network. Condensation of a kernel rule
must preserve this SHA (or surface a deliberate ADR-tracked diff).
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import artefact_roots  # noqa: E402

# Pre-monorepo this was REPO_ROOT/.agent-src.uncondensed/rules. Post-move
# (ADR-017) the source rules live under packages/*/.agent-src.uncondensed/rules.
# Resolve the same way measure_rule_budget does (multi-root aware) so the
# Iron-Law SHA gate keeps working against the current layout.
def _rules_dirs() -> list[Path]:
    return [root / "rules" for root in artefact_roots() if (root / "rules").is_dir()]

# Locked kernel set — kept in sync with measure_rule_budget.KERNEL_RULES.
KERNEL_RULES = (
    "agent-authority",
    "ask-when-uncertain",
    "commit-policy",
    "direct-answers",
    "language-and-tone",
    "no-cheap-questions",
    "non-destructive-by-default",
    "scope-control",
    "verify-before-complete",
)

_FENCE_RE = re.compile(r"```(?:[^\n]*\n)([\s\S]*?)```")
_WS_RE = re.compile(r"\s+")


def iron_law_sha(text: str) -> str:
    """SHA-256 of all triple-fence content, whitespace-collapsed, upper-cased.

    Algorithm matches `scripts/_pilot_measure.py` exactly so the SHAs
    recorded in `docs/contracts/kernel-membership.md` § 2 stay
    reproducible across pre / post condensation.
    """
    blocks = _FENCE_RE.findall(text)
    norm = "".join(_WS_RE.sub(" ", b).strip().upper() for b in blocks)
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def rule_sha(rule_id: str) -> str:
    for rules_dir in _rules_dirs():
        path = rules_dir / f"{rule_id}.md"
        if path.exists():
            return iron_law_sha(path.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"{rule_id}.md not found under any artefact root's rules/")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("rules", nargs="*", help="rule ids (omit if --all-kernel)")
    parser.add_argument("--all-kernel", action="store_true", help="hash all 9 kernel rules")
    parser.add_argument(
        "--diff", metavar="RULE", help="hash one rule and compare to --against"
    )
    parser.add_argument("--against", metavar="SHA", help="expected SHA (for --diff)")
    args = parser.parse_args(argv)

    if args.diff:
        if not args.against:
            parser.error("--diff requires --against")
        actual = rule_sha(args.diff)
        match = actual == args.against
        symbol = "✅" if match else "❌"
        print(f"{symbol}  {args.diff}: {actual}  (expected {args.against})")
        return 0 if match else 1

    targets = list(KERNEL_RULES) if args.all_kernel else args.rules
    if not targets:
        parser.error("provide rule ids, or use --all-kernel")

    width = max(len(t) for t in targets)
    for rid in targets:
        sha = rule_sha(rid)
        print(f"{rid:<{width}}  {sha}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
