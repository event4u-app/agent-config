#!/usr/bin/env python3
"""Sync `.agent-settings.yml` against the template + profile.

Applies the section-aware merge rules documented in
`docs/guidelines/agent-infra/layered-settings.md`:

- Template section order always wins — reorder keys to match.
- Existing user scalar values are preserved verbatim (as parsed).
- Missing keys land with their template / profile default.
- Template comments replace user comments in the same position.
- Unknown user keys (not in the template) are preserved in a trailing
  `_user:` block so custom additions never get silently dropped.

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
import install as _install  # noqa: E402 — shares _yaml_scalar + _replace_template_value

try:
    import yaml  # type: ignore
except ImportError:
    print("error: PyYAML not installed (pip install pyyaml)", file=sys.stderr)
    sys.exit(2)

DEFAULT_SETTINGS = ".agent-settings.yml"
DEFAULT_TEMPLATE = Path(__file__).resolve().parent.parent / "config" / "agent-settings.template.yml"
DEFAULT_PROFILE_DIR = Path(__file__).resolve().parent.parent / "config" / "profiles"


def _flatten(data: dict, prefix: str = "") -> dict[str, object]:
    """Flatten nested dicts to dotted keys — recurses to all leaves.

    Lists, scalars, and ``None`` are leaves. Dicts are walked and their
    keys folded into the dotted path.
    """
    out: dict[str, object] = {}
    for key, value in data.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            out.update(_flatten(value, prefix=f"{path}."))
        else:
            out[path] = value
    return out


def _as_yaml_value(value: object) -> str | None:
    """Format *value* as an inline-YAML literal.

    Returns ``None`` when the value cannot be safely represented as a
    scalar / flow-style sequence (e.g. unsupported types). Callers
    must skip those keys so the template default sticks instead of
    producing malformed YAML.
    """
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    if value is None:
        return "~"
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            rendered = _as_yaml_value(item)
            if rendered is None:
                return None
            items.append(rendered)
        return "[" + ", ".join(items) + "]"
    if isinstance(value, str):
        return _install._yaml_scalar(value)
    return None


def _template_keys(template_body: str) -> set[str]:
    """Return the set of dotted keys declared by the rendered template."""
    data = yaml.safe_load(template_body) or {}
    if not isinstance(data, dict):
        return set()
    return set(_flatten(data).keys())


def _apply_user_values(template_body: str, user_flat: dict[str, object]) -> str:
    """Overlay every known user value on the rendered template body.

    Keys whose value cannot be rendered inline (see :func:`_as_yaml_value`)
    are skipped so the template default survives instead of corrupting
    the file.
    """
    body = template_body
    for dotted, value in user_flat.items():
        rendered = _as_yaml_value(value)
        if rendered is None:
            continue
        body = _install._replace_template_value_raw(body, dotted, rendered)
    return body


def _append_unknown(body: str, user_flat: dict[str, object], known: set[str]) -> str:
    """Emit user keys that have no home in the template under `_user:`."""
    unknown = sorted(k for k in user_flat if k not in known)
    if not unknown:
        return body
    lines = [
        "",
        "# Unknown keys preserved by sync_agent_settings.py — review and move",
        "# them into the template or drop them.",
        "_user:",
    ]
    for key in unknown:
        rendered = _as_yaml_value(user_flat[key])
        if rendered is None:
            continue
        lines.append(f"  {key}: {rendered}")
    suffix = "\n".join(lines) + "\n"
    return body + (suffix if body.endswith("\n") else "\n" + suffix)


def render_target(template_body: str, user_data: dict) -> str:
    """Return the desired `.agent-settings.yml` body for the given user data.

    The trailing ``_user:`` block (emitted by :func:`_append_unknown`) is
    already in dotted-key form on every read after the first sync. Re-
    flattening it would prepend another ``_user.`` segment on every run
    and accumulate forever, so we strip the wrapper and merge its
    contents straight into the flat dict.
    """
    if user_data:
        user_only = user_data.pop("_user", None) if isinstance(user_data, dict) else None
        user_flat = _flatten(user_data)
        if isinstance(user_only, dict):
            for key, value in user_only.items():
                # Dotted keys round-trip verbatim — never re-flatten them.
                if isinstance(key, str):
                    # Heal legacy corruption: pre-fix syncs prepended a
                    # `_user.` segment per run, so a key may carry an
                    # arbitrary number of them. Strip them all back to
                    # the original leaf path.
                    healed = key
                    while healed.startswith("_user."):
                        healed = healed[len("_user."):]
                    user_flat[healed] = value
    else:
        user_flat = {}
    known = _template_keys(template_body)
    body = _apply_user_values(template_body, user_flat)
    return _append_unknown(body, user_flat, known)


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

    new_text = render_target(template_body, user_data)
    existing_text = target.read_text(encoding="utf-8") if target.is_file() else ""

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