"""design-tokens toolchain (Step 5.1/5.4): generate / validate / embed."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOKENS_PY = REPO_ROOT / "src" / "skills" / "design-tokens" / "scripts" / "tokens.py"
STARTER = (
    REPO_ROOT / "src" / "skills" / "design-tokens" / "templates"
    / "design-tokens-starter.json"
)

sys.path.insert(0, str(TOKENS_PY.parent))
import tokens  # noqa: E402


def _run(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(TOKENS_PY), *args],
        capture_output=True, text=True, timeout=60, cwd=cwd,
    )


# ----------------------------------------------------------------- generate
def test_reference_resolution_is_recursive() -> None:
    data = {
        "primitive": {"color": {"blue": {"600": {"$value": "#2563EB"}}}},
        "semantic": {"color": {"primary": {"$value": "{primitive.color.blue.600}"}}},
        "component": {"button": {"bg": {"$value": "{semantic.color.primary}"}}},
    }
    flat = tokens.flatten_tokens(data["component"], data, [])
    assert flat["--button-bg"] == "#2563EB"


def test_generate_css_from_starter_has_layers_and_dark_mode() -> None:
    data = json.loads(STARTER.read_text(encoding="utf-8"))
    css = tokens.generate_css(data)
    assert "--primitive-color-gray-50: #F9FAFB;" in css
    assert "/* === SEMANTIC === */" in css
    assert ".dark {" in css  # starter ships dark.semantic overrides
    # semantic references resolved to literals, not left as {refs}
    assert "{primitive." not in css


def test_generate_tailwind_emits_var_references() -> None:
    data = json.loads(STARTER.read_text(encoding="utf-8"))
    out = tokens.generate_tailwind(data)
    assert "theme.extend.colors" in out
    assert "var(--color-" in out


# ----------------------------------------------------------------- validate
def test_validate_flags_hardcoded_values(tmp_path: Path) -> None:
    src = tmp_path / "src"
    src.mkdir()
    (src / "bad.css").write_text(
        ".card { color: #2563EB; padding: 24px; font-size: 1.5rem; }\n"
        ".ok { color: var(--color-primary); }\n"
        ".bw { color: #fff; }\n",  # black/white exception
        encoding="utf-8",
    )
    proc = _run("validate", "--dir", str(src), "--json")
    assert proc.returncode == 1
    findings = json.loads(proc.stdout)
    kinds = {f["type"] for f in findings}
    assert {"hexColor", "pixelValue", "remValue"} <= kinds
    # polish-step contract: every finding is a token_violation
    assert all(f["kind"] == "token_violation" for f in findings)
    # var(--…) line and #fff exception produced no findings
    assert not any("--color-primary" in f["context"] for f in findings)
    assert not any(f["value"].lower() == "#fff" for f in findings)


def test_validate_clean_dir_exits_zero(tmp_path: Path) -> None:
    src = tmp_path / "src"
    src.mkdir()
    (src / "good.css").write_text(
        ".card { color: var(--color-primary); padding: var(--space-lg); }\n",
        encoding="utf-8",
    )
    proc = _run("validate", "--dir", str(src))
    assert proc.returncode == 0
    assert "No token violations" in proc.stdout


# ----------------------------------------------------------------- embed
def test_embed_minimal_filters_and_wraps(tmp_path: Path) -> None:
    css = (
        ":root {\n"
        "  --color-primary: #2563EB;\n"
        "  --primitive-spacing-4: 1rem;\n"
        "  --obscure-thing: 7;\n"
        "}\n"
    )
    f = tmp_path / "design-tokens.css"
    f.write_text(css, encoding="utf-8")
    proc = _run("embed", "--tokens", str(f), "--minimal", "--style")
    assert proc.returncode == 0
    assert proc.stdout.startswith("<style>")
    assert "--color-primary" in proc.stdout
    assert "--obscure-thing" not in proc.stdout


# ----------------------------------------------------------------- ported scripts
def test_apache_derived_scripts_carry_modification_headers() -> None:
    for rel in (
        "src/skills/tailwind-engineer/scripts/tailwind_config_gen.py",
        "src/skills/react-shadcn-ui/scripts/shadcn_add.py",
    ):
        head = (REPO_ROOT / rel).read_text(encoding="utf-8")[:600]
        assert "Apache-2.0" in head and "Modified from upstream" in head, rel
    assert (
        REPO_ROOT / "src" / "skills" / "design-intelligence"
        / "LICENSE.apache-2.0.txt"
    ).exists()
