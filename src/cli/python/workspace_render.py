#!/usr/bin/env python3
"""Role-prompt placeholder rendering — ADR-069.

A role prompt at ``agents/roles/<role>/prompts/<name>.md`` carries YAML
frontmatter declaring its inputs and a body with ``{{name}}`` placeholders::

    ---
    name: risk-analysis-memo
    inputs:
      - name: context
        required: true
        shape: "one-paragraph context"
      - name: known_constraints
        required: false
        shape: "budget, deadline, ..."
    skill_hint: scenario-modeling
    ---
    ... {{context}} ... {{known_constraints}} ...

This module fills those placeholders from a caller-supplied ``name → value``
map and returns the rendered prompt. It is the missing piece between the role
prompt library and the host hand-off: Tier-3 inbox auto-routing and Tier-1
pre-rendering (Codex / Gemini have no skill surface) both consume a *filled*
prompt, not a template.

Design (AI-council 2026-06-08, claude-sonnet-4-5 + gpt-4o, design mode):

- **Single responsibility — render placeholders only.** The renderer never
  appends a ``skill_hint`` body; it *returns* the hint so the caller decides.
  The inbox store already owns skill pre-rendering (ADR-066); folding it here
  would double-append when the inbox calls the renderer. The hint is carried
  through, not consumed.
- **Missing REQUIRED input → hard error.** A required input absent (or blank)
  is a caller bug; ``render`` raises and the CLI exits 1.
- **Missing OPTIONAL input → empty string, heading stays.** No Markdown-
  structure stripping — inferring "this heading belongs to that placeholder"
  is fragile template-validation masquerading as runtime logic. An ugly empty
  section is template-author feedback, not a renderer responsibility.
- **Unknown placeholder → hard error.** A ``{{foo}}`` with no declared input
  is a broken template contract; leaving the literal wastes host tokens when
  the agent tries to interpret template syntax as content.
- **Single-pass literal substitution.** Values are inserted over the original
  body in one pass, so a value that itself contains ``{{...}}`` is never
  re-expanded — no recursion, no injection vector.

The ``shape`` field is advisory documentation only (not enforced); validating
input shapes is deferred to v1.

Deferred to v1 (debt, recorded in ADR-069): a per-prompt kill-switch (disable
a template by name without redeploying) lives at the launch/inbox layer, not
in this pure function; shape validation; success/render metrics.

CLI::

    workspace_render.py render  --role <r> --prompt <p> [--inputs-json <f|->] [--root <dir>]
    workspace_render.py inspect --role <r> --prompt <p> [--root <dir>] [--json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

# <repo>/src/cli/python/workspace_render.py → repo root is parents[3].
ROOT = Path(__file__).resolve().parents[3]
ROLES_ROOT_DEFAULT = ROOT / "agents" / "roles"

# Placeholder token: ``{{ name }}`` with an identifier-shaped name. Whitespace
# inside the braces is tolerated; the captured name is matched against the
# declared inputs.
PLACEHOLDER_RE = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")

FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)


class PromptError(ValueError):
    """A prompt template or input-set error that should fail the render."""


def _split_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER_RE.match(text)
    if m is None:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        fm = {}
    if not isinstance(fm, dict):
        fm = {}
    return fm, text[m.end():]


def load_prompt(role: str, prompt: str, root: Path = ROLES_ROOT_DEFAULT) -> dict:
    """Load + parse a role prompt → ``{name,intent,inputs,output_shape,skill_hint,body}``.

    Raises :class:`PromptError` when the prompt file does not exist.
    """
    path = root / role / "prompts" / f"{prompt}.md"
    if not path.is_file():
        raise PromptError(f"prompt not found: {role}/{prompt}")
    fm, body = _split_frontmatter(path.read_text(encoding="utf-8"))
    raw_inputs = fm.get("inputs")
    inputs: list[dict] = []
    if isinstance(raw_inputs, list):
        for entry in raw_inputs:
            if isinstance(entry, dict) and isinstance(entry.get("name"), str):
                inputs.append({
                    "name": entry["name"],
                    "required": bool(entry.get("required", False)),
                    "shape": entry.get("shape", ""),
                })
    return {
        "name": fm.get("name", prompt),
        "intent": fm.get("intent", ""),
        "inputs": inputs,
        "output_shape": fm.get("output_shape", ""),
        "skill_hint": fm.get("skill_hint") or None,
        "body": body,
    }


def render(role: str, prompt: str, inputs: dict, root: Path = ROLES_ROOT_DEFAULT) -> dict:
    """Render a role prompt with ``inputs`` → ``{rendered, skill_hint}``.

    Raises :class:`PromptError` on a missing required input or an undeclared
    ``{{placeholder}}`` in the body (both are caller / template bugs).
    """
    spec = load_prompt(role, prompt, root)
    declared = {i["name"] for i in spec["inputs"]}
    required = {i["name"] for i in spec["inputs"] if i["required"]}

    def _is_blank(v: object) -> bool:
        return v is None or (isinstance(v, str) and v.strip() == "")

    missing = sorted(n for n in required if _is_blank(inputs.get(n)))
    if missing:
        raise PromptError("missing required input(s): " + ", ".join(missing))

    used = set(PLACEHOLDER_RE.findall(spec["body"]))
    unknown = sorted(used - declared)
    if unknown:
        raise PromptError("undeclared placeholder(s) in template: " + ", ".join(unknown))

    # Single pass over the ORIGINAL body — a value containing ``{{x}}`` is never
    # re-expanded. Optional declared inputs that are absent → empty string.
    def _sub(match: re.Match) -> str:
        name = match.group(1)
        val = inputs.get(name, "")
        return "" if val is None else str(val)

    rendered = PLACEHOLDER_RE.sub(_sub, spec["body"])
    return {"rendered": rendered, "skill_hint": spec["skill_hint"]}


def _validate_cli_root(root: Path) -> Path:
    """The CLI root must be a ``roles`` directory (mirrors the other workspace
    CLIs' ``--root`` discipline — Node passes ``<packageRoot>/agents/roles``)."""
    resolved = root.resolve()
    if resolved.name != "roles":
        raise SystemExit(f"--root must be an agents/roles directory; got '{root}'")
    return resolved


def _load_inputs_json(spec: str | None) -> dict:
    if spec is None:
        return {}
    raw = sys.stdin.read() if spec == "-" else Path(spec).read_text(encoding="utf-8")
    if raw.strip() == "":
        return {}
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise SystemExit("--inputs-json must contain a JSON object (name → value)")
    return data


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_render")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render")
    r.add_argument("--role", required=True)
    r.add_argument("--prompt", required=True)
    r.add_argument("--inputs-json", help="path to a JSON object file, or '-' for stdin")
    r.add_argument("--root", type=Path, default=ROLES_ROOT_DEFAULT)
    r.add_argument("--json", action="store_true", help="emit {rendered, skill_hint} as JSON")

    ins = sub.add_parser("inspect")
    ins.add_argument("--role", required=True)
    ins.add_argument("--prompt", required=True)
    ins.add_argument("--root", type=Path, default=ROLES_ROOT_DEFAULT)
    ins.add_argument("--json", action="store_true")

    args = p.parse_args(argv)
    root = _validate_cli_root(args.root) if args.root != ROLES_ROOT_DEFAULT else args.root

    if args.cmd == "inspect":
        try:
            spec = load_prompt(args.role, args.prompt, root)
        except PromptError as err:
            raise SystemExit(str(err))
        meta = {k: spec[k] for k in ("name", "intent", "inputs", "output_shape", "skill_hint")}
        if args.json:
            print(json.dumps(meta, sort_keys=True))
        else:
            print(f"{meta['name']} — {meta['intent']}")
            for i in meta["inputs"]:
                req = "required" if i["required"] else "optional"
                print(f"  - {i['name']} ({req}): {i['shape']}")
            print(f"skill_hint: {meta['skill_hint'] or '—'}")
        return 0

    if args.cmd == "render":
        try:
            inputs = _load_inputs_json(args.inputs_json)
            result = render(args.role, args.prompt, inputs, root)
        except PromptError as err:
            print(str(err), file=sys.stderr)
            return 1
        if args.json:
            print(json.dumps(result, sort_keys=True))
        else:
            sys.stdout.write(result["rendered"])
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
