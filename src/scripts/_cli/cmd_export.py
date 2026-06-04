"""``agent-config export`` — eject a tool's canonical content into the project.

Phase 1.5 of road-to-global-first-install.md (ADR-007 D3). Replaces the
rejected symlink-bridge subcommand: writes a real file with the resolved
content for a named tool into a user-chosen path so it can be committed,
shared with the team, or customized in place. Idempotent by default;
``--force`` overrides content drift. No canonical-path defaults.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from typing import Callable, Optional

from scripts.install import (
    AIDER_MARKER,
    CLAUDE_DESKTOP_MARKER,
    CODEX_MARKER,
    CONTINUE_MARKER,
    JETBRAINS_MARKER,
    KILOCODE_MARKER,
    KIRO_MARKER,
    ROOCODE_MARKER,
    ZED_MARKER,
)

PACKAGE_ROOT = Path(__file__).resolve().parents[3]
TEMPLATES_DIR = PACKAGE_ROOT / ".agent-src" / "templates"


def _from_template(rel: str) -> Callable[[], str]:
    def _read() -> str:
        path = TEMPLATES_DIR / rel
        if not path.is_file():
            raise FileNotFoundError(
                f"template missing from package: {path} "
                f"(reinstall @event4u/agent-config or report a bug)"
            )
        return path.read_text(encoding="utf-8")
    return _read


def _from_constant(value: str) -> Callable[[], str]:
    def _read() -> str:
        return value
    return _read


# tool_id → (description, content_provider).
EXPORT_REGISTRY: "dict[str, tuple[str, Callable[[], str]]]" = {
    "roocode": ("Roo Code marker (.roo/rules/agent-config.md body)",
                _from_constant(ROOCODE_MARKER)),
    "claude-desktop": ("Claude Desktop marker (informational, global-scope tool)",
                       _from_constant(CLAUDE_DESKTOP_MARKER)),
    "aider": ("Aider marker (manual `read:` wiring documented inline)",
              _from_constant(AIDER_MARKER)),
    "codex": ("Codex CLI marker (informational — AGENTS.md is canonical)",
              _from_constant(CODEX_MARKER)),
    "continue": ("Continue.dev marker (.continue/rules/agent-config.md body)",
                 _from_constant(CONTINUE_MARKER)),
    "kilocode": ("Kilo Code marker (.kilocode/rules/agent-config.md body)",
                 _from_constant(KILOCODE_MARKER)),
    "zed": ("Zed marker (informational — .rules at repo root is canonical)",
            _from_constant(ZED_MARKER)),
    "jetbrains": ("JetBrains AI Assistant marker (.jetbrains/agent-config.md body)",
                  _from_constant(JETBRAINS_MARKER)),
    "kiro": ("Kiro marker (.kiro/steering/agent-config.md body)",
             _from_constant(KIRO_MARKER)),
    "agents-md": ("AGENTS.md template (Thin-Root entry point — consumer scaffold)",
                  _from_template("AGENTS.md")),
    "copilot-instructions": ("GitHub Copilot Code Review instructions template",
                             _from_template("copilot-instructions.md")),
}


def _list_tools(out) -> int:
    print("Available tools for `agent-config export --tool <id>`:", file=out)
    width = max(len(t) for t in EXPORT_REGISTRY) + 2
    for tool_id, (desc, _) in sorted(EXPORT_REGISTRY.items()):
        print(f"  {tool_id:<{width}}{desc}", file=out)
    return 0


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _rel(path: Path) -> Path:
    try:
        return path.relative_to(Path.cwd())
    except ValueError:
        return path


def _write(output: Path, content: str, *, force: bool, out, err) -> int:
    if output.exists():
        existing = output.read_text(encoding="utf-8")
        if _hash(existing) == _hash(content):
            print(f"ℹ️  {_rel(output)} already exported (content matches).", file=out)
            return 0
        if not force:
            print(
                f"❌  refusing to overwrite {output} — content differs. "
                f"Pass --force to replace.",
                file=err,
            )
            return 1
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    print(f"✅  exported to {_rel(output)}", file=out)
    return 0


def main(argv: Optional[list[str]] = None, *, out=sys.stdout, err=sys.stderr) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config export",
        description="Eject a tool's resolved content into a user-chosen path.",
    )
    parser.add_argument("--tool", metavar="ID",
                        help="Tool to export (see --list for the catalog).")
    parser.add_argument("--output", metavar="PATH",
                        help="Destination path (relative to CWD).")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite an existing file with non-matching content.")
    parser.add_argument("--list", action="store_true",
                        help="Print supported tool IDs with descriptions and exit.")
    args = parser.parse_args(argv)

    if args.list:
        return _list_tools(out)
    if not args.tool:
        print("❌  --tool is required (see --list for the catalog).", file=err)
        return 2
    if not args.output:
        print("❌  --output is required (no canonical-path defaults).", file=err)
        return 2

    entry = EXPORT_REGISTRY.get(args.tool)
    if entry is None:
        print(f"❌  unknown tool: {args.tool} (see --list)", file=err)
        return 2

    _, provider = entry
    try:
        content = provider()
    except FileNotFoundError as exc:
        print(f"❌  {exc}", file=err)
        return 1

    output = Path(args.output).expanduser().resolve()
    return _write(output, content, force=args.force, out=out, err=err)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
