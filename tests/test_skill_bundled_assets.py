"""Delivery-mechanism gate for skill-bundled scripts + data (Step 1.0).

Locks docs/contracts/skill-bundled-assets.md: assets under
``skills/<name>/{scripts,data}/`` survive the sync → install chain and run
at CONSUMER runtime — i.e. from an arbitrary cwd, resolving siblings
skill-relative, never via $PWD.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_SRC = REPO_ROOT / "src" / "skills"

PROBE_SCRIPT = '''\
#!/usr/bin/env python3
"""Fixture probe: reads sibling data skill-relative, prints it."""
import csv
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "fixture.csv"
rows = list(csv.DictReader(open(DATA, encoding="utf-8")))
print(json.dumps({"rows": len(rows), "first": rows[0]["value"]}))
'''

FIXTURE_CSV = "key,value\na,alpha\nb,beta\n"


def _install_copy(src: Path, dest: Path) -> None:
    """Simulate install.py::_copy_dir_dereferencing_symlinks (whole-dir,
    symlink-dereferencing copy of a skill into the consumer skills root)."""
    shutil.copytree(src, dest, symlinks=False)


def _make_fixture_skill(root: Path) -> Path:
    skill = root / "fixture-skill"
    (skill / "scripts").mkdir(parents=True)
    (skill / "data").mkdir()
    (skill / "scripts" / "probe.py").write_text(PROBE_SCRIPT, encoding="utf-8")
    (skill / "data" / "fixture.csv").write_text(FIXTURE_CSV, encoding="utf-8")
    (skill / "SKILL.md").write_text("# fixture-skill\n", encoding="utf-8")
    return skill


def test_fixture_skill_runs_from_foreign_cwd(tmp_path: Path) -> None:
    """A bundled script finds its sibling data after deployment, regardless
    of the consumer's working directory."""
    authored = _make_fixture_skill(tmp_path / "authoring")
    skills_root = tmp_path / "consumer" / ".claude" / "skills"
    skills_root.mkdir(parents=True)
    _install_copy(authored, skills_root / "fixture-skill")

    foreign_cwd = tmp_path / "some" / "unrelated" / "project"
    foreign_cwd.mkdir(parents=True)

    proc = subprocess.run(
        [sys.executable, str(skills_root / "fixture-skill" / "scripts" / "probe.py")],
        cwd=foreign_cwd,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload == {"rows": 2, "first": "alpha"}


def test_corpus_grounding_engine_runs_from_foreign_cwd(tmp_path: Path) -> None:
    """The real engine deploys + runs from an arbitrary cwd (cross-skill
    invocation shape: domain manifest in one skill, engine in another)."""
    skills_root = tmp_path / ".claude" / "skills"
    skills_root.mkdir(parents=True)
    _install_copy(SKILLS_SRC / "corpus-grounding", skills_root / "corpus-grounding")

    # Minimal domain skill carrying a manifest + corpus.
    domain_skill = skills_root / "demo-domain"
    (domain_skill / "data").mkdir(parents=True)
    (domain_skill / "data" / "things.csv").write_text(
        "Name,Keywords,Advice\n"
        "Widget,fintech dashboard data,Use restrained color\n"
        "Gadget,playful gaming neon,Use vivid contrast\n",
        encoding="utf-8",
    )
    manifest = {
        "manifest_version": 1,
        "domain": "demo",
        "tier": "lookup-only",
        "domains": {
            "things": {
                "file": "things.csv",
                "search_cols": ["Name", "Keywords"],
                "output_cols": ["Name", "Advice"],
            }
        },
        "default_domain": "things",
        "owner": "test",
        "refresh_cadence": "quarterly",
        "upstream": {"repo": "local", "sha": "0", "last_checked": "2026-06-07"},
    }
    (domain_skill / "data" / "manifest.json").write_text(
        json.dumps(manifest), encoding="utf-8"
    )

    foreign_cwd = tmp_path / "elsewhere"
    foreign_cwd.mkdir()
    proc = subprocess.run(
        [
            sys.executable,
            str(skills_root / "corpus-grounding" / "scripts" / "ground.py"),
            "search",
            "--manifest",
            str(domain_skill / "data" / "manifest.json"),
            "fintech dashboard",
            "--json",
        ],
        cwd=foreign_cwd,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout)
    assert result["count"] >= 1
    assert result["results"][0]["Name"] == "Widget"
    # Contract invariants: confidence + evidence_gap always present.
    assert "confidence" in result and "evidence_gap" in result


def test_sync_non_md_ships_bundled_assets() -> None:
    """`task sync` copies non-.md skill assets through to dist/agent-src.

    Guarded structurally: condense.should_condense() must exclude .py/.csv
    so sync_non_md picks them up.
    """
    sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
    import condense  # noqa: PLC0415

    assert condense.should_condense(Path("skills/x/SKILL.md")) is True
    assert condense.should_condense(Path("skills/x/scripts/probe.py")) is False
    assert condense.should_condense(Path("skills/x/data/fixture.csv")) is False
