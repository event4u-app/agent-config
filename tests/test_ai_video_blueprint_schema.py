"""Phase 4 Step 2 — Cinematic Scene Blueprint schema tests.

Wraps the bash-based validator ``scripts/ai-video/lib/parse-blueprint.sh``
and the canonical schema at
``.agent-src.uncompressed/skills/scene-expander/scene-blueprint.schema.yaml``.

Filesystem + subprocess only — no network, no provider API calls. The
parser exits ``0`` on a valid blueprint, ``2`` on a missing required
block, and ``3`` on a parse error (non-numeric DURATION etc.).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

PARSER = REPO_ROOT / "scripts" / "ai-video" / "lib" / "parse-blueprint.sh"
_SCHEMA_RESOLVED = resolve_logical("skills/scene-expander/scene-blueprint.schema.yaml")
assert _SCHEMA_RESOLVED is not None, "scene-blueprint.schema.yaml not found in any pack"
SCHEMA = _SCHEMA_RESOLVED

REQUIRED_BLOCKS = (
    "STYLE",
    "SUBJECT",
    "ENVIRONMENT",
    "ACTION",
    "CAMERA",
    "LENS",
    "LIGHTING",
    "MOOD",
    "DURATION",
    "NEGATIVE",
)

VALID_BLUEPRINT = """\
STYLE: Kodak Portra 400, late-1970s grain
SUBJECT: Anya, age 34, charcoal wool coat, mid-stride
ENVIRONMENT: rain-slick Berlin alley, blue hour, neon spill
ACTION: anticipation 2 beats, pivot toward camera, react 1 beat
CAMERA: handheld, eye-level, medium-close, slow push-in
LENS: 35mm, f/1.8, shallow focus on subject
LIGHTING: key from neon left, fill from window right, practical back rim
MOOD: defiant resolve
DIALOGUE: Anya: "Nicht heute Nacht."
AMBIENT SOUND: rain on metal, distant tram bell
DURATION: 5.0
NEGATIVE: centered framing, slow-motion, lens flare
"""


pytestmark = pytest.mark.skipif(
    shutil.which("jq") is None,
    reason="parse-blueprint.sh requires jq; not available on this host.",
)


def _run_parser(blueprint: str) -> subprocess.CompletedProcess[str]:
    """Invoke the bash parser with ``blueprint`` on stdin."""
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(PARSER)],
        input=blueprint,
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )


# ---------------------------------------------------------------------------
# Schema-file invariants (provider-agnostic by construction)
# ---------------------------------------------------------------------------

def test_schema_yaml_is_provider_agnostic() -> None:
    """Schema MUST NOT name a provider as a top-level block.

    Mirrors the Phase 5 advisory finding: provider-specific phrasing
    (Veo / Sora / Kling / Higgsfield camera directives) does not belong
    in the shared blueprint layer — it leaks across adapters.
    """
    data = yaml.safe_load(SCHEMA.read_text(encoding="utf-8"))
    block_names = list(data["blocks"].keys())
    banned = {"veo", "sora", "kling", "higgsfield", "openai", "gemini"}
    for name in block_names:
        lowered = name.lower()
        for token in banned:
            assert token not in lowered, (
                f"block '{name}' leaks provider token '{token}' into "
                "the provider-agnostic blueprint schema"
            )


def test_schema_marks_all_required_blocks() -> None:
    data = yaml.safe_load(SCHEMA.read_text(encoding="utf-8"))
    required = {
        name for name, spec in data["blocks"].items() if spec.get("required")
    }
    expected = set(REQUIRED_BLOCKS) - {"DURATION"} | {"DURATION"}
    assert required == expected, (
        f"schema required-set drifted from parser. schema={required} "
        f"parser={expected}"
    )


# ---------------------------------------------------------------------------
# Parser behaviour
# ---------------------------------------------------------------------------

def test_valid_blueprint_passes_and_emits_contract_json() -> None:
    result = _run_parser(VALID_BLUEPRINT)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    for slot in (
        "style",
        "subject",
        "environment",
        "action",
        "camera",
        "lens",
        "lighting",
        "mood",
    ):
        assert payload["prompt"][slot], f"prompt.{slot} empty in valid run"
    assert payload["duration"] == 5.0
    assert isinstance(payload["negative"], list) and payload["negative"]


@pytest.mark.parametrize("missing", REQUIRED_BLOCKS)
def test_missing_required_block_is_rejected_with_named_error(missing: str) -> None:
    """Exit code 2 + the missing block name on stderr."""
    lines = [ln for ln in VALID_BLUEPRINT.splitlines() if not ln.startswith(f"{missing.replace('_', ' ')}:") and not ln.startswith(f"{missing}:")]
    result = _run_parser("\n".join(lines) + "\n")
    assert result.returncode == 2, (
        f"expected exit 2 (missing required block) but got "
        f"{result.returncode} stderr={result.stderr!r}"
    )
    assert "missing required block" in result.stderr
    assert missing in result.stderr



def test_non_numeric_duration_is_rejected() -> None:
    """DURATION must be integer or one-decimal float; otherwise exit 3."""
    bp = VALID_BLUEPRINT.replace("DURATION: 5.0", "DURATION: about five")
    result = _run_parser(bp)
    assert result.returncode == 3, (
        f"expected exit 3 (parse error) but got "
        f"{result.returncode} stderr={result.stderr!r}"
    )
    assert "DURATION" in result.stderr


def test_audio_embedded_flag_enforced_when_dialogue_present() -> None:
    """When DIALOGUE or AMBIENT SOUND fires, ``audio.enable_native_audio``
    AND the mirrored ``requires.audio_native`` MUST both be ``true``.

    The adapter contract reads ``requires.audio_native`` to decide
    whether to mux operator-supplied tracks at stitch time.
    """
    result = _run_parser(VALID_BLUEPRINT)
    payload = json.loads(result.stdout)
    assert payload["audio"]["enable_native_audio"] is True
    assert payload["requires"]["audio_native"] is True
    assert isinstance(payload["audio"]["dialogue"], list)
    assert isinstance(payload["audio"]["ambient"], list)


def test_audio_native_false_when_no_audio_blocks() -> None:
    bp = "\n".join(
        ln
        for ln in VALID_BLUEPRINT.splitlines()
        if not ln.startswith(("DIALOGUE:", "AMBIENT SOUND:"))
    ) + "\n"
    result = _run_parser(bp)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["audio"]["enable_native_audio"] is False
    assert payload["requires"]["audio_native"] is False
    assert payload["audio"]["dialogue"] is None
    assert payload["audio"]["ambient"] is None


def test_character_lock_subject_token_is_non_empty() -> None:
    """SUBJECT is the character-lock surface — it MUST round-trip
    verbatim into ``prompt.subject`` so character-consistency can pin
    identity across scenes. Empty subject means lost lock.
    """
    result = _run_parser(VALID_BLUEPRINT)
    payload = json.loads(result.stdout)
    subject = payload["prompt"]["subject"]
    assert subject.strip(), "prompt.subject empty — character lock lost"
    assert "Anya" in subject, "subject token did not round-trip verbatim"


def test_unknown_top_level_block_does_not_pollute_contract_json() -> None:
    """Unknown labels MUST NOT add new top-level keys to the JSON
    contract. The parser's case-statement only recognises the 12
    canonical blocks; anything else is silently dropped (fail-closed
    at the JSON-shape boundary).
    """
    bp = VALID_BLUEPRINT + "PROVIDER: gemini-veo\nWATERMARK: agency-x\n"
    result = _run_parser(bp)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    top_level = set(payload.keys())
    assert top_level == {"prompt", "audio", "duration", "negative", "requires"}, (
        f"unknown block leaked into JSON top-level: {top_level}"
    )
    assert "provider" not in payload
    assert "watermark" not in payload
