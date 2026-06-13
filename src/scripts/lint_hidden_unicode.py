#!/usr/bin/env python3
"""P1.1 — hidden-Unicode / smuggling-codepoint linter (road-to-security-pillar.md).

Detects the invisible-character class used by the "rules-file backdoor" attack:
instructions a human reviewer cannot see but the model reads. The codepoint set
covers bidi controls (Trojan Source), zero-width / format chars, the Unicode Tag
block, variation-selector runs, Private Use Area, and stray C0/C1 controls.

Scope: every `.md` under src/{skills,rules,agent-src,domains} + frontmatter.
Containment: a real teaching doc never needs the *actual* invisible char (it
writes ``U+200B`` as text), so this linter scans even inside ordinary code
fences; only a ```security-example fence or a `security-lint: allow
hidden-unicode` pragma exempts a file/region.

Exit 0 clean, 1 on any blocking finding. ``--fix`` writes an NFKC-normalised,
zero-width-stripped sibling ``<file>.sanitized`` for human review (never
auto-applied).

Usage: python3 src/scripts/lint_hidden_unicode.py [--json] [--fix]
"""
from __future__ import annotations

import argparse
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import security_lint as sl  # noqa: E402

CHECK = "hidden-unicode"

# (name, predicate over a single codepoint) — ordered by specificity.
_BIDI = {0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069,
         0x200E, 0x200F, 0x061C}
_ZERO_WIDTH = {0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF, 0x00AD}
_DEPRECATED = {0x206A, 0x206B, 0x206C, 0x206D, 0x206E, 0x206F, 0xFFF9, 0xFFFA, 0xFFFB}


def _classify(cp: int) -> str | None:
    if cp in _BIDI:
        return "bidi-control"
    if cp in _ZERO_WIDTH:
        return "zero-width"
    if 0xE0000 <= cp <= 0xE007F:
        return "unicode-tag"
    if cp in _DEPRECATED:
        return "deprecated-format"
    if 0xE000 <= cp <= 0xF8FF or 0xF0000 <= cp <= 0xFFFFD or 0x100000 <= cp <= 0x10FFFD:
        return "private-use-area"
    # C0/C1 controls except tab/newline/CR
    if (0x00 <= cp <= 0x1F or 0x7F <= cp <= 0x9F) and cp not in (0x09, 0x0A, 0x0D):
        return "control-char"
    return None


# Variation selectors flagged only in runs of >=3 on one line (steganography).
# Restricted to the SUPPLEMENTARY block (U+E0100–E01EF): the standard selectors
# U+FE00–FE0F are legitimate emoji/text presentation (e.g. ❌️ ✅️ ⚠️) and runs
# of them are normal, so they are NOT a steganography signal.
_VS = set(range(0xE0100, 0xE01F0))


def _scan(sf: sl.ScannedFile) -> list[sl.Finding]:
    if sf.pragma_allows(CHECK):
        return []
    out: list[sl.Finding] = []
    for lineno, text in sf.iter_lines(skip_example_fence=True):
        vs_run = 0
        for ch in text:
            cp = ord(ch)
            if cp in _VS:
                vs_run += 1
                continue
            kind = _classify(cp)
            if kind:
                name = unicodedata.name(ch, "<unnamed>")
                out.append(sl.Finding(
                    path=sf.rel, line=lineno, check=CHECK, severity="HIGH",
                    message=f"{kind} U+{cp:04X} ({name})",
                    weight=sf.weight,
                ))
        if vs_run >= 3:
            out.append(sl.Finding(
                path=sf.rel, line=lineno, check=CHECK, severity="HIGH",
                message=f"variation-selector run x{vs_run} (steganography signature)",
                weight=sf.weight,
            ))
    return out


def _sanitize(path: Path) -> Path:
    raw = path.read_text(encoding="utf-8", errors="surrogatepass")
    cleaned = "".join(
        ch for ch in raw
        if _classify(ord(ch)) is None and ord(ch) not in _VS
    )
    cleaned = unicodedata.normalize("NFKC", cleaned)
    out = path.with_suffix(path.suffix + ".sanitized")
    out.write_text(cleaned, encoding="utf-8")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, epilog=sl.GUIDELINE_EPILOG)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--fix", action="store_true",
                    help="write a sanitised sibling for each flagged file (review only)")
    args = ap.parse_args()

    findings: list[sl.Finding] = []
    flagged: set[Path] = set()
    for sf in sl.iter_corpus():
        hits = _scan(sf)
        findings.extend(hits)
        if hits:
            flagged.add(sf.path)

    if args.fix:
        for p in sorted(flagged):
            print(f"  fixed → {_sanitize(p).relative_to(sl.ROOT)}")

    if args.json:
        import json
        print(json.dumps([f.__dict__ for f in findings], indent=2))
        return 1 if any(f.is_fail for f in findings) else 0

    return sl.report(findings, check_label="hidden-unicode")


if __name__ == "__main__":
    raise SystemExit(main())
