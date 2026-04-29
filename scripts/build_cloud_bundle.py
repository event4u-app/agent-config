#!/usr/bin/env python3
"""build_cloud_bundle.py — package skills as Anthropic Skills ZIP bundles.

# SPEC

## Purpose

Package each skill from `.agent-src/skills/<name>/` as a ZIP file ready
for upload to the Anthropic Skills API or Claude.ai Web (Settings →
Customize → Skills). One ZIP per skill, sandbox-friendly.

## Inputs

- `.agent-src/skills/<name>/SKILL.md` (required)
- Optional siblings: `references/`, `assets/`, `scripts/`, `evals/`
  (only the first three are bundled; `evals/` is local-tooling-only)
- Tier classification from `audit_cloud_compatibility.py` (matched by
  skill basename — uncompressed and compressed share names)

## Outputs

- `dist/cloud/<skill-name>.zip` per processed skill, layout inside ZIP:
  - `<skill-name>/SKILL.md`        rewritten frontmatter + body
  - `<skill-name>/references/...`  copied verbatim if present
  - `<skill-name>/assets/...`      copied verbatim if present
- `dist/cloud/manifest.json`       per-skill build report

## Tier handling

| Tier  | Action                                                       |
|-------|--------------------------------------------------------------|
| T1    | Bundle as-is. Pure guidance.                                 |
| T2    | Bundle with sandbox path-swap header.                        |
| T3-S  | Bundle with sandbox path-swap; optional script calls degrade.|
| T3-H  | Skip with explicit log. Manifest records the reason.         |

## Cloud-safe markers (Phase 2)

A source file can declare a cloud variant via an HTML comment in the
body:

  <!-- cloud_safe: noop -->     local rule, fully inert on cloud
  <!-- cloud_safe: degrade -->  prose fallback provided

`audit_cloud_compatibility.py` downgrades the tier when a marker is
present (noop → T1, degrade → T3-S). The builder additionally extracts
a `## Cloud Behavior` section for `noop` artefacts so the cloud bundle
ships only the cloud-side instructions, not the full local rule.

## Frontmatter rewriting

- Keep: `name`, `description`. Drop everything else (e.g. `source`).
- Cloud cap: `description` ≤ 200 chars (Claude.ai Web truncates there).
  - `--strict-budget`: violation → exit 2
  - default: truncate at last word boundary < 200, append `…`, warn
- Source-side hard error: > 1024 chars (Anthropic spec max) → exit 3

## Sandbox path-swap

Body text is preprocessed:
- Literal `.agent-src.uncompressed/` and `.agent-src/` → `source/` note
- Literal `agents/` (path prefix only, not prose) → `(local-only)` note
- Cloud header prepended explaining the constraint

## CLI

  build_cloud_bundle.py --skill <name>     # one skill
  build_cloud_bundle.py --all              # every eligible skill
  build_cloud_bundle.py --check            # validate invariants, no zip
  build_cloud_bundle.py --out <dir>        # default: dist/cloud
  build_cloud_bundle.py --strict-budget    # description > 200 → fail

## Exit codes

  0  ok
  2  description over 200 chars (strict mode)
  3  description over 1024 chars (always fatal)
  4  skill not found (--skill <name>)
  5  T3-H skill explicitly requested with --skill
  9  usage / argparse error
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

# Local import: tier classifier
sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_cloud_compatibility as audit  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SOURCE_SKILLS = ROOT / ".agent-src" / "skills"
DEFAULT_OUT = ROOT / "dist" / "cloud"
DESC_LIMIT_WEB = 200
DESC_LIMIT_SPEC = 1024

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n(.*)$", re.DOTALL)
NAME_RE = re.compile(r"^name:\s*(.+?)\s*$", re.MULTILINE)
DESC_RE = re.compile(r'^description:\s*"?(.+?)"?\s*$', re.MULTILINE)
CLOUD_BEHAVIOR_RE = re.compile(
    r"(?ms)^##\s+Cloud Behavior\s*\n(.*?)(?=^##\s+|\Z)"
)
TITLE_RE = re.compile(r"(?m)^#\s+(.+?)\s*$")
MARKER_LINE_RE = re.compile(
    r"(?m)^\s*<!--\s*cloud_safe:\s*(?:noop|degrade)\s*-->\s*\n?"
)

# Body preprocessing — sandbox path-swap.
#
# Scope: only package-internal prefixes that are unreachable from a cloud
# sandbox (`.agent-src.uncompressed/`, `.agent-src/`). `agents/` is left
# unchanged — it lives in the user's repo, the SANDBOX_NOTE header
# already tells the agent the host has no access.
PATH_SWAP_PATTERNS = [
    (re.compile(r"`\.agent-src\.uncompressed/"), "`<package-source>/"),
    (re.compile(r"`\.agent-src/"), "`<package-source>/"),
    (re.compile(r"\(\.agent-src\.uncompressed/"), "(<package-source>/"),
    (re.compile(r"\(\.agent-src/"), "(<package-source>/"),
]

SANDBOX_NOTE = """\
> **Cloud sandbox.** This skill is running on Claude.ai Web or the
> Anthropic Skills API. The host has no access to the user's repository.
> References to `.agent-src/`, `agents/`, or local task commands are
> descriptive: emit content for the user to save, don't try to read or
> write those paths. Quality scripts (`task ci`, linters) run on the
> user's machine after they apply the suggested change.
"""

NOOP_BODY_FALLBACK = """\
On platforms without persistent filesystem (Claude.ai Web, the Anthropic
Skills API), this artefact is fully inert. None of its local procedures
apply. The agent does nothing on this rule's behalf.
"""


@dataclass
class BuildResult:
    skill: str
    status: str  # "ok" | "skipped" | "error"
    tier: str = ""
    reason: str = ""
    zip_path: str = ""
    description_truncated: bool = False
    cloud_marker: str = ""  # "noop" | "degrade" | ""
    warnings: list[str] = field(default_factory=list)


def load_tier_map() -> dict[str, dict]:
    """skill-name → {tier, cloud_marker, raw_tier} from audit script."""
    tier_map: dict[str, dict] = {}
    for row in audit.scan():
        if row["kind"] != "skills":
            continue
        # row["path"] = .agent-src.uncompressed/skills/<name>/SKILL.md
        parts = Path(row["path"]).parts
        if len(parts) >= 3:
            tier_map[parts[2]] = {
                "tier": row["tier"],
                "cloud_marker": row.get("cloud_marker"),
                "raw_tier": row.get("raw_tier", row["tier"]),
            }
    return tier_map



def parse_skill_md(text: str) -> tuple[dict, str]:
    """Extract frontmatter (name, description) and body."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise ValueError("SKILL.md missing YAML frontmatter")
    fm_raw, body = m.group(1), m.group(2)
    nm = NAME_RE.search(fm_raw)
    dm = DESC_RE.search(fm_raw)
    if not nm or not dm:
        raise ValueError("frontmatter requires both 'name' and 'description'")
    return {"name": nm.group(1), "description": dm.group(1)}, body


def enforce_description_budget(
    desc: str, *, strict: bool, warnings: list[str]
) -> tuple[str, bool]:
    """Apply 1024 hard cap and 200 cloud cap. Returns (description, truncated)."""
    if len(desc) > DESC_LIMIT_SPEC:
        raise SystemExit(
            f"❌  description exceeds Anthropic spec limit "
            f"({len(desc)} > {DESC_LIMIT_SPEC} chars). Source must be fixed."
        )
    if len(desc) <= DESC_LIMIT_WEB:
        return desc, False
    if strict:
        raise SystemExit(
            f"❌  description exceeds cloud cap in strict mode "
            f"({len(desc)} > {DESC_LIMIT_WEB} chars)."
        )
    cut = desc[: DESC_LIMIT_WEB - 1].rsplit(" ", 1)[0].rstrip(",.;:—–-")
    truncated = cut + "…"
    warnings.append(
        f"description truncated: {len(desc)} → {len(truncated)} chars"
    )
    return truncated, True


def swap_paths(body: str) -> str:
    """Sandbox path-swap on body literals."""
    for pat, repl in PATH_SWAP_PATTERNS:
        body = pat.sub(repl, body)
    return body


def strip_marker(body: str) -> str:
    """Remove the `<!-- cloud_safe: ... -->` line from the body."""
    return MARKER_LINE_RE.sub("", body, count=1)


def extract_cloud_body_for_noop(body: str, name: str) -> str:
    """Build a stripped body for a noop artefact: title + Cloud Behavior section.

    If the source has a `## Cloud Behavior` section, use it. Otherwise fall
    back to a generic noop notice. The returned body always opens with a
    title heading so the bundle reads as a self-contained skill.
    """
    title_match = TITLE_RE.search(body)
    title = title_match.group(1) if title_match else name
    section = CLOUD_BEHAVIOR_RE.search(body)
    section_text = section.group(1).strip() if section else NOOP_BODY_FALLBACK
    return f"# {title}\n\n## Cloud Behavior\n\n{section_text.strip()}\n"


def render_skill_md(
    name: str,
    description: str,
    body: str,
    *,
    swap: bool,
    cloud_marker: str | None = None,
) -> str:
    """Rebuild SKILL.md with cloud-friendly frontmatter and tier-aware body.

    - cloud_marker == 'noop'   → body replaced with stripped Cloud Behavior
    - swap (T2 / T3-S / degrade) → sandbox note + path-swap on full body
    - otherwise                  → body shipped verbatim (T1)
    """
    body = strip_marker(body)
    if cloud_marker == "noop":
        body = extract_cloud_body_for_noop(body, name)
        body = SANDBOX_NOTE + "\n" + body
    elif swap:
        body = swap_paths(body)
        body = SANDBOX_NOTE + "\n" + body
    fm = f'---\nname: {name}\ndescription: "{description}"\n---\n'
    if not body.startswith("\n"):
        body = "\n" + body
    return fm + body


def build_skill_zip(
    skill_dir: Path,
    out_dir: Path,
    tier: str,
    *,
    strict: bool,
    dry_run: bool,
    cloud_marker: str | None = None,
) -> BuildResult:
    name = skill_dir.name
    result = BuildResult(skill=name, status="ok", tier=tier)
    if cloud_marker:
        result.cloud_marker = cloud_marker
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        result.status = "error"
        result.reason = "SKILL.md missing"
        return result

    text = skill_md.read_text(encoding="utf-8")
    try:
        meta, body = parse_skill_md(text)
    except ValueError as e:
        result.status = "error"
        result.reason = str(e)
        return result
    # If caller didn't pass a marker, detect it from the raw body
    # (covers ad-hoc test fixtures).
    if cloud_marker is None:
        cloud_marker = audit.detect_cloud_marker(text)
        if cloud_marker:
            result.cloud_marker = cloud_marker

    desc, truncated = enforce_description_budget(
        meta["description"], strict=strict, warnings=result.warnings
    )
    result.description_truncated = truncated

    needs_swap = tier in {"T2", "T3-S"} and cloud_marker != "noop"
    rendered = render_skill_md(
        meta["name"], desc, body,
        swap=needs_swap, cloud_marker=cloud_marker,
    )

    if dry_run:
        return result

    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{name}/SKILL.md", rendered)
        for sibling in ("references", "assets", "scripts"):
            sib = skill_dir / sibling
            if not sib.is_dir():
                continue
            for f in sib.rglob("*"):
                if f.is_file():
                    arc = f"{name}/{f.relative_to(skill_dir)}"
                    zf.write(f, arc)
    try:
        result.zip_path = str(zip_path.relative_to(ROOT))
    except ValueError:
        result.zip_path = str(zip_path)
    return result



def build_all(
    out_dir: Path,
    *,
    only: str | None,
    strict: bool,
    dry_run: bool,
) -> tuple[list[BuildResult], list[BuildResult]]:
    """Build every eligible skill (or just `only`). Returns (built, skipped)."""
    tier_map = load_tier_map()
    if not SOURCE_SKILLS.is_dir():
        raise SystemExit(f"❌  source not found: {SOURCE_SKILLS}")

    if only:
        skill_dir = SOURCE_SKILLS / only
        if not skill_dir.is_dir():
            raise SystemExit(f"❌  skill not found: {only}")
        skill_dirs = [skill_dir]
    else:
        skill_dirs = sorted(d for d in SOURCE_SKILLS.iterdir() if d.is_dir())

    built: list[BuildResult] = []
    skipped: list[BuildResult] = []
    for sd in skill_dirs:
        info = tier_map.get(sd.name) or {"tier": "T1", "cloud_marker": None}
        tier = info["tier"]
        cloud_marker = info.get("cloud_marker")
        if tier == "T3-H":
            sk = BuildResult(
                skill=sd.name,
                status="skipped",
                tier=tier,
                reason="T3-H — Phase 2 cloud-aware variant required",
            )
            if only:
                # Explicit single-skill request for a T3-H — refuse loudly.
                raise SystemExit(
                    f"❌  '{only}' is T3-H (script-hard). "
                    "Bundle blocked until Phase 2 ships a cloud-aware variant.",
                )
            skipped.append(sk)
            continue
        result = build_skill_zip(
            sd, out_dir, tier,
            strict=strict, dry_run=dry_run,
            cloud_marker=cloud_marker,
        )
        if result.status == "ok":
            built.append(result)
        else:
            skipped.append(result)
    return built, skipped


def write_manifest(
    out_dir: Path, built: list[BuildResult], skipped: list[BuildResult]
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "summary": {
            "built": len(built),
            "skipped": len(skipped),
            "truncated_descriptions": sum(
                1 for r in built if r.description_truncated
            ),
        },
        "built": [r.__dict__ for r in built],
        "skipped": [r.__dict__ for r in skipped],
    }
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--skill", help="bundle one skill by name")
    g.add_argument("--all", action="store_true", help="bundle every eligible skill")
    g.add_argument("--check", action="store_true",
                   help="dry-run: validate invariants, no zip output")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT,
                   help=f"output directory (default: {DEFAULT_OUT.relative_to(ROOT)})")
    p.add_argument("--strict-budget", action="store_true",
                   help="fail when any description > 200 chars")
    p.add_argument("--clean", action="store_true",
                   help="wipe --out before building")
    args = p.parse_args(argv)

    if args.clean and args.out.exists() and not args.check:
        shutil.rmtree(args.out)

    only = args.skill if args.skill else None
    dry_run = bool(args.check)

    built, skipped = build_all(
        args.out, only=only, strict=args.strict_budget, dry_run=dry_run
    )

    if not dry_run:
        write_manifest(args.out, built, skipped)

    # Console report
    label = "check" if dry_run else "build"
    print(f"📦  cloud-bundle {label}: {len(built)} built · {len(skipped)} skipped")
    truncated = [r for r in built if r.description_truncated]
    if truncated:
        print(f"⚠️   {len(truncated)} description(s) truncated to 200 chars:")
        for r in truncated[:10]:
            print(f"   - {r.skill}")
        if len(truncated) > 10:
            print(f"   …and {len(truncated) - 10} more")
    t3h = [r for r in skipped if r.tier == "T3-H"]
    if t3h:
        print(f"🚧  {len(t3h)} T3-H skill(s) skipped (Phase 2 pending):")
        for r in t3h[:5]:
            print(f"   - {r.skill}")
        if len(t3h) > 5:
            print(f"   …and {len(t3h) - 5} more")
    errors = [r for r in skipped if r.status == "error"]
    if errors:
        print(f"❌  {len(errors)} error(s):")
        for r in errors:
            print(f"   - {r.skill}: {r.reason}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
