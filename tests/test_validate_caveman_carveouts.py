"""Tests for scripts/validate_caveman_carveouts.py — Phase 4 mechanical validator."""
from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "scripts" / "validate_caveman_carveouts.py"

_SPEC = importlib.util.spec_from_file_location("validate_caveman_carveouts", SCRIPT)
assert _SPEC and _SPEC.loader
vcc = importlib.util.module_from_spec(_SPEC)
sys.modules["validate_caveman_carveouts"] = vcc
_SPEC.loader.exec_module(vcc)


# Fixture pairs: (pre, post, expect_pass). One per carve-out category.
PASS_PAIRS = [
    # 1. Code fence preserved; surrounding prose compressed.
    (
        "I will check the file now:\n```python\nprint('x')\n```\nThen I will see.",
        "Check file:\n```python\nprint('x')\n```\nThen see.",
    ),
    # 2. Numbered options preserved verbatim.
    (
        "Which path do you want me to take?\n\n1. Option one with full context.\n2. Option two.\n\n**Recommendation:** Option 1.",
        "Pick path?\n\n1. Option one with full context.\n2. Option two.\n\n**Recommendation:** Option 1.",
    ),
    # 3. Backtick spans (paths, identifiers) preserved.
    (
        "I will edit the file `scripts/foo.py` and call `bar()` there.",
        "Edit `scripts/foo.py`. Call `bar()`.",
    ),
    # 4. Status markers preserved.
    (
        "I ran the tests and got results:\n✅ test_a passed\n❌ test_b failed\n⚠️ test_c flaky",
        "Ran tests:\n✅ test_a passed\n❌ test_b failed\n⚠️ test_c flaky",
    ),
    # 5. ALL-CAPS Iron-Law fence preserved.
    (
        "Reminder of the rule:\n```\nNEVER COMMIT WITHOUT PERMISSION.\nNO EXCEPTIONS.\n```\nNow let me proceed.",
        "Rule:\n```\nNEVER COMMIT WITHOUT PERMISSION.\nNO EXCEPTIONS.\n```\nProceed.",
    ),
    # 6. Recommendation label (German variant).
    (
        "Welche Variante möchtest du?\n\n1. Variante eins.\n2. Variante zwei.\n\n**Empfehlung:** Variante 1.",
        "Welche?\n\n1. Variante eins.\n2. Variante zwei.\n\n**Empfehlung:** Variante 1.",
    ),
    # 7. Pure-prose (no carve-outs at all) — vacuously preserved.
    (
        "I will now compress this entire paragraph into caveman grammar.",
        "Compress paragraph caveman.",
    ),
]

# Fail pairs: one per carve-out category, drift introduced post-side.
FAIL_PAIRS = [
    # Code fence body mutated.
    (
        "```python\nprint('x')\n```\nprose",
        "```python\nprint('y')\n```\nprose",
        "code_fences",
    ),
    # Numbered-option text mutated.
    (
        "1. Original option one.\n2. Option two.",
        "1. Mutated option one.\n2. Option two.",
        "numbered_options",
    ),
    # Backtick span mutated.
    (
        "Edit `scripts/foo.py` then continue.",
        "Edit `scripts/bar.py` then continue.",
        "backtick_spans",
    ),
    # Status marker line mutated.
    (
        "✅ test_a passed\nprose",
        "✅ test_a now failed\nprose",
        "status_markers",
    ),
    # ALL-CAPS Iron-Law fence mutated.
    (
        "```\nNEVER COMMIT WITHOUT PERMISSION.\n```\nprose",
        "```\nSOMETIMES COMMIT WITHOUT PERMISSION.\n```\nprose",
        "code_fences",  # primary diff surfaces here
    ),
    # Recommendation label mutated.
    (
        "**Recommendation:** Option 1.",
        "**Recommendation:** Option 2.",
        "recommendation_labels",
    ),
]


class TestValidatePasses(unittest.TestCase):
    def test_pass_pairs_have_no_drift(self) -> None:
        for i, (pre, post) in enumerate(PASS_PAIRS):
            with self.subTest(idx=i):
                self.assertEqual(vcc.validate(pre, post), [],
                                 f"pair {i} unexpectedly drifted")


class TestValidateFails(unittest.TestCase):
    def test_fail_pairs_drift_in_expected_category(self) -> None:
        for i, (pre, post, expected_cat) in enumerate(FAIL_PAIRS):
            with self.subTest(idx=i, cat=expected_cat):
                failures = vcc.validate(pre, post)
                names = [name for name, _ in failures]
                self.assertIn(expected_cat, names,
                              f"pair {i} expected drift in {expected_cat}; got {names}")


class TestCLI(unittest.TestCase):
    def _run_pair(self, pre: str, post: str) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as td:
            pre_p = Path(td) / "pre.md"
            post_p = Path(td) / "post.md"
            pre_p.write_text(pre, encoding="utf-8")
            post_p.write_text(post, encoding="utf-8")
            return subprocess.run(
                [sys.executable, str(SCRIPT), str(pre_p), str(post_p)],
                capture_output=True, text=True, check=False,
            )

    def test_cli_exit_0_on_pass(self) -> None:
        pre, post = PASS_PAIRS[0]
        r = self._run_pair(pre, post)
        self.assertEqual(r.returncode, 0, msg=r.stdout + r.stderr)
        self.assertIn("preserved", r.stdout)

    def test_cli_exit_1_on_fail(self) -> None:
        pre, post, _ = FAIL_PAIRS[0]
        r = self._run_pair(pre, post)
        self.assertEqual(r.returncode, 1)
        self.assertIn("DRIFT DETECTED", r.stdout)


if __name__ == "__main__":
    unittest.main()
