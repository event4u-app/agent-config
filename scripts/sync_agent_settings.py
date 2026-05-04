#!/usr/bin/env python3
"""Sync `.agent-settings.yml` against the template + profile (additive merge).

Applies the section-aware merge rules documented in
`docs/guidelines/agent-infra/layered-settings.md`:

- **User lines are preserved verbatim** — comments, quoting, and key order
  survive every sync. Existing values, custom inline comments, and
  user-chosen ordering are never modified.
- Missing template keys are inserted (leaf into existing parent section,
  full subtree at EOF for entirely missing top-level sections).
- Top-level user-only sections (no home in the template) are moved to a
  single-level `_user:` block at the end of the file.
- The `_user:` block is single-level only — legacy multi-prefix
  corruption (`_user._user.foo`) heals to `foo` on the next sync.
- Template comment changes on already-existing user keys do **not**
  propagate (existing line untouched is the deal).

Idempotent — writing a file that is already in sync is a no-op.

Usage:
    python3 scripts/sync_agent_settings.py                       # write (default)
    python3 scripts/sync_agent_settings.py --dry-run             # show diff, no write
    python3 scripts/sync_agent_settings.py --check               # exit 2 on drift (for CI)
    python3 scripts/sync_agent_settings.py --profile balanced    # use a specific profile
    python3 scripts/sync_agent_settings.py --path path/to/.agent-settings.yml

Exit codes:
    0 — already in sync, or changes applied (or --dry-run ran cleanly)
    2 — drift detected under --check, or invalid arguments / missing files
"""

from __future__ import annotations

import argparse
import difflib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import install as _install  # noqa: E402 — profile parsing + template rendering
import sync_yaml_rt as _rt  # noqa: E402 — additive round-trip merge

try:
    import yaml  # type: ignore
except ImportError:
    print("error: PyYAML not installed (pip install pyyaml)", file=sys.stderr)
    sys.exit(2)

DEFAULT_SETTINGS = ".agent-settings.yml"
DEFAULT_TEMPLATE = Path(__file__).resolve().parent.parent / "config" / "agent-settings.template.yml"
DEFAULT_PROFILE_DIR = Path(__file__).resolve().parent.parent / "config" / "profiles"


def load_profile(profile_dir: Path, profile: str) -> dict[str, str]:
    profile_source = profile_dir / f"{profile}.ini"
    if not profile_source.is_file():
        raise FileNotFoundError(f"profile not found: {profile_source}")
    return _install._parse_profile_ini(profile_source)


def load_template(path: Path, profile_values: dict[str, str]) -> str:
    if not path.is_file():
        raise FileNotFoundError(f"template not found: {path}")
    return _install._render_template(path.read_text(encoding="utf-8"), profile_values)


def load_user(path: Path) -> dict:
    if not path.is_file():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        return {}
    return data


def render_diff(old_text: str, new_text: str, path: str) -> str:
    return "".join(difflib.unified_diff(
        old_text.splitlines(keepends=True),
        new_text.splitlines(keepends=True),
        fromfile=path, tofile=path, n=3,
    ))



def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--path", default=DEFAULT_SETTINGS,
                    help=f"target settings file (default: ./{DEFAULT_SETTINGS})")
    ap.add_argument("--template", default=str(DEFAULT_TEMPLATE),
                    help="path to the settings template")
    ap.add_argument("--profile", default=None,
                    help="cost_profile preset (minimal|balanced|full). "
                         "Default: inferred from target, else 'minimal'")
    ap.add_argument("--profile-dir", default=str(DEFAULT_PROFILE_DIR),
                    help="directory containing profile .ini files")
    ap.add_argument("--dry-run", action="store_true",
                    help="print diff; do not modify the file")
    ap.add_argument("--check", action="store_true",
                    help="exit 2 if the target is out of sync (no writes)")
    ap.add_argument("--quiet", action="store_true",
                    help="suppress summary on success")
    args = ap.parse_args(argv)

    target = Path(args.path)
    template_path = Path(args.template)
    profile_dir = Path(args.profile_dir)

    try:
        user_data = load_user(target)
        profile = args.profile or str(user_data.get("cost_profile") or "minimal")
        if profile not in _install.SUPPORTED_PROFILES:
            print(f"error: unsupported profile {profile!r}", file=sys.stderr)
            return 2
        profile_values = load_profile(profile_dir, profile)
        template_body = load_template(template_path, profile_values)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except yaml.YAMLError as exc:
        print(f"error: cannot parse {target}: {exc}", file=sys.stderr)
        return 2

    existing_text = target.read_text(encoding="utf-8") if target.is_file() else ""

    if existing_text:
        # Additive merge — preserves user lines verbatim, inserts only
        # the template keys the user is missing.
        try:
            new_text = _rt.sync(existing_text, template_body)
        except ValueError as exc:
            print(
                f"error: cannot parse {target}: {exc}",
                file=sys.stderr,
            )
            return 2
    else:
        # First-run / file absent — write the rendered template as-is.
        new_text = template_body

    if new_text == existing_text:
        if not args.quiet:
            print(f"✅  {target}: already in sync (profile={profile})")
        return 0

    if args.check:
        diff = render_diff(existing_text, new_text, str(target))
        sys.stdout.write(diff)
        print(f"\n❌  {target}: drift detected (profile={profile})", file=sys.stderr)
        return 2

    if args.dry_run:
        diff = render_diff(existing_text, new_text, str(target))
        sys.stdout.write(diff)
        if not args.quiet:
            print(f"\n(dry-run) would update {target} (profile={profile})", file=sys.stderr)
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(new_text, encoding="utf-8")
    if not args.quiet:
        print(f"✅  {target}: updated (profile={profile})")
    return 0


if __name__ == "__main__":
    sys.exit(main())