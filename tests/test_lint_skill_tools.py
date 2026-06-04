"""Tests for the Block D · D1 meta-linter (`scripts/lint_skill_tools.py`).

Exercises every invariant the linter enforces and a clean-pass case so
regressions in D2/D3/D4 surface here, not at PR time.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

from lint_skill_tools import lint  # noqa: E402


_VALID = """\
#!/usr/bin/env python3
\"\"\"Sample tool that obeys all D1 invariants.\"\"\"
from __future__ import annotations
import argparse, json, sys

_SAMPLE = {"hello": "world"}


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="store_true")
    p.parse_args(argv)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
"""


def _write(dirpath: Path, name: str, body: str) -> None:
    dirpath.mkdir(parents=True, exist_ok=True)
    (dirpath / name).write_text(body, encoding="utf-8")


def test_valid_tool_passes(tmp_path: Path) -> None:
    _write(tmp_path, "do_thing.py", _VALID)
    code, findings = lint(tmp_path)
    assert code == 0, findings
    assert findings == {}


def test_third_party_import_fails(tmp_path: Path) -> None:
    body = _VALID.replace("import argparse, json, sys", "import argparse, json, sys\nimport requests")
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("requests" in v for v in next(iter(findings.values())))


def test_third_party_from_import_fails(tmp_path: Path) -> None:
    body = _VALID + "from yaml import safe_load\n"
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("yaml" in v for v in next(iter(findings.values())))


def test_internal_scripts_import_passes(tmp_path: Path) -> None:
    body = _VALID + "from scripts.skill_tools import score_skill_relevance  # type: ignore\n"
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 0, findings


def test_missing_json_flag_fails(tmp_path: Path) -> None:
    body = _VALID.replace('p.add_argument("--json", action="store_true")', "")
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("--json" in v for v in next(iter(findings.values())))


def test_missing_argparse_fails(tmp_path: Path) -> None:
    body = """\
#!/usr/bin/env python3
\"\"\"No argparse.\"\"\"
import sys
_SAMPLE = {}
if __name__ == "__main__":
    print("hi")
"""
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 1
    viols = next(iter(findings.values()))
    assert any("argparse" in v for v in viols), viols


def test_naming_violation_fails(tmp_path: Path) -> None:
    _write(tmp_path, "Bad-Name.py", _VALID)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("naming" in v for v in next(iter(findings.values())))


def test_naming_no_underscore_fails(tmp_path: Path) -> None:
    _write(tmp_path, "lonely.py", _VALID)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("naming" in v for v in next(iter(findings.values())))


def test_size_cap_enforced(tmp_path: Path) -> None:
    body = _VALID + "\n".join(f"x{i} = {i}" for i in range(220)) + "\n"
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("size" in v for v in next(iter(findings.values())))


def test_no_sample_no_main_fails(tmp_path: Path) -> None:
    body = """\
#!/usr/bin/env python3
\"\"\"No sample, no main.\"\"\"
import argparse
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="store_true")
    p.parse_args()
"""
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("sample" in v for v in next(iter(findings.values())))


def test_add_help_disabled_fails(tmp_path: Path) -> None:
    body = _VALID.replace(
        "p = argparse.ArgumentParser()",
        "p = argparse.ArgumentParser(add_help=False)",
    )
    _write(tmp_path, "do_thing.py", body)
    code, findings = lint(tmp_path)
    assert code == 1
    assert any("add_help" in v for v in next(iter(findings.values())))


def test_init_py_skipped(tmp_path: Path) -> None:
    _write(tmp_path, "__init__.py", "# pkg marker\n")
    _write(tmp_path, "do_thing.py", _VALID)
    code, findings = lint(tmp_path)
    assert code == 0, findings


def test_missing_dir_returns_usage_error(tmp_path: Path) -> None:
    code, findings = lint(tmp_path / "nope")
    assert code == 2
    assert "_error" in findings
