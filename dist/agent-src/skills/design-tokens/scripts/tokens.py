#!/usr/bin/env python3
"""design-tokens · tokens — DTCG token toolchain (generate / validate / embed).

Python port (no Node runtime dependency — ADR-061 fork, unanimous) of the
upstream `.cjs` trio from `nextlevelbuilder/ui-ux-pro-max-skill`
`design-system/scripts/{generate-tokens,validate-tokens,embed-tokens}.cjs`
@ b7e3af80f6e331f6fb456667b82b12cade7c9d35 · MIT · last checked 2026-06-07.
The HTML surface of `html-token-validator.py` is folded into `validate`
(one token-discipline linter, not two).

Usage (skill-relative; works from any cwd):
  python3 tokens.py generate --config tokens.json [-o out.css] [--format css|tailwind]
  python3 tokens.py validate --dir src/ [--ignore extra_dir] [--json]
  python3 tokens.py embed --tokens assets/design-tokens.css [--minimal] [--style]

Pure stdlib · read-only except `generate -o` · no network · no subprocess.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# --------------------------------------------------------------- generate
def resolve_reference(value: object, tokens: dict) -> object:
    """Resolve `{primitive.color.blue.600}`-style references recursively."""
    if not isinstance(value, str) or not value.startswith("{"):
        return value
    path = value.strip("{}").split(".")
    node: object = tokens
    for key in path:
        if not isinstance(node, dict):
            return value
        node = node.get(key)
        if node is None:
            return value
    if isinstance(node, dict) and "$value" in node:
        return resolve_reference(node["$value"], tokens)
    return node if node is not None else value


def flatten_tokens(obj: dict, tokens: dict, prefix: list | None = None,
                   result: dict | None = None) -> dict:
    """Flatten a DTCG token tree into `--css-var → resolved value`."""
    prefix = prefix or []
    result = result if result is not None else {}
    for key, value in obj.items():
        current = prefix + [key]
        if isinstance(value, dict):
            if "$value" in value:
                css_var = "--" + "-".join(current).replace(".", "-")
                result[css_var] = resolve_reference(value["$value"], tokens)
            else:
                flatten_tokens(value, tokens, current, result)
    return result


def generate_css(tokens: dict) -> str:
    primitive = flatten_tokens(tokens.get("primitive") or {}, tokens, ["primitive"])
    semantic = flatten_tokens(tokens.get("semantic") or {}, tokens, [])
    component = flatten_tokens(tokens.get("component") or {}, tokens, [])
    dark = flatten_tokens((tokens.get("dark") or {}).get("semantic") or {}, tokens, [])

    def block(entries: dict) -> str:
        return "\n".join(f"  {k}: {v};" for k, v in entries.items())

    css = (
        "/* Design Tokens - Auto-generated */\n"
        "/* Do not edit directly - modify tokens.json instead */\n\n"
        f"/* === PRIMITIVES === */\n:root {{\n{block(primitive)}\n}}\n\n"
        f"/* === SEMANTIC === */\n:root {{\n{block(semantic)}\n}}\n\n"
        f"/* === COMPONENTS === */\n:root {{\n{block(component)}\n}}\n"
    )
    if dark:
        css += f"\n/* === DARK MODE === */\n.dark {{\n{block(dark)}\n}}\n"
    return css


def generate_tailwind(tokens: dict) -> str:
    semantic = flatten_tokens(tokens.get("semantic") or {}, tokens, [])
    colors = {
        key.replace("--color-", "").replace("-", "."): f"var({key})"
        for key in semantic
        if "color" in key
    }
    body = json.dumps(colors, indent=2).replace('"', "'")
    return (
        "// Tailwind color config - Auto-generated\n"
        "// Add to tailwind.config.ts theme.extend.colors\n\n"
        f"module.exports = {{\n  colors: {body}\n}};\n"
    )


# --------------------------------------------------------------- validate
PATTERNS = {
    "hexColor": (
        re.compile(r"#([0-9A-Fa-f]{3}){1,2}\b"),
        "Hardcoded hex color", "Use var(--color-*) token",
    ),
    "rgbColor": (
        re.compile(r"rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)", re.I),
        "Hardcoded RGB(A) color", "Use var(--color-*) token",
    ),
    "pixelValue": (
        re.compile(r":\s*(\d{2,})px"),
        "Hardcoded pixel value", "Use var(--space-*) or var(--radius-*) token",
    ),
    "remValue": (
        re.compile(r":\s*\d+\.?\d*rem"),
        "Hardcoded rem value", "Use var(--space-*) or var(--font-size-*) token",
    ),
}
EXTENSIONS = {".css", ".scss", ".tsx", ".jsx", ".ts", ".js", ".vue",
              ".svelte", ".html", ".blade.php"}
SKIP_FILE_PATTERNS = (
    re.compile(r"\.min\.(css|js)$"),
    re.compile(r"tailwind\.config"),
    re.compile(r"globals\.css"),
    re.compile(r"tokens\.(css|json)"),
)
HEX_EXCEPTIONS = {"#000", "#FFF", "#000000", "#FFFFFF"}
DEFAULT_IGNORE = {"node_modules", ".git", "dist", "build", ".next", "vendor"}
ALLOWED_HOST_HINTS = ("fonts.googleapis.com", "fonts.gstatic.com",
                      "unsplash.com", "pexels.com")


def _iter_files(root: Path, ignore: set) -> list:
    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        if any(part in ignore for part in path.parts):
            continue
        suffix = "".join(path.suffixes[-2:]) if path.name.endswith(".blade.php") else path.suffix
        if path.is_file() and suffix in EXTENSIONS:
            if any(p.search(str(path)) for p in SKIP_FILE_PATTERNS):
                continue
            files.append(path)
    return files


def scan_file(path: Path) -> list:
    violations = []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").split("\n")
    except OSError:
        return violations
    for lineno, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith(("//", "/*", "*")) or "var(--" in line:
            continue
        if any(host in line for host in ALLOWED_HOST_HINTS):
            continue
        for kind, (regex, message, suggestion) in PATTERNS.items():
            for match in regex.findall(line):
                value = match if isinstance(match, str) else regex.search(line).group(0)
                if kind == "hexColor":
                    whole = regex.search(line).group(0)
                    if whole.upper() in HEX_EXCEPTIONS:
                        continue
                    value = whole
                violations.append({
                    "file": str(path), "line": lineno, "type": kind,
                    "value": value, "message": message,
                    "suggestion": suggestion,
                    "context": stripped[:80],
                    # Maps onto the UI directive set's finding kind so the
                    # polish step can auto-convert against audit tokens.
                    "kind": "token_violation",
                })
                break  # one finding per pattern per line is enough
    return violations


def format_report(violations: list) -> str:
    if not violations:
        return "✅ No token violations found"
    out = [f"⚠️  Found {len(violations)} potential token violations:", ""]
    by_file: dict = {}
    for v in violations:
        by_file.setdefault(v["file"], []).append(v)
    for file, items in by_file.items():
        out.append(f"📁 {file}")
        for v in items:
            out += [
                f"   Line {v['line']}: {v['message']}",
                f"   Found: {v['value']}",
                f"   Suggestion: {v['suggestion']}",
                f"   Context: {v['context']}", "",
            ]
    counts: dict = {}
    for v in violations:
        counts[v["message"]] = counts.get(v["message"], 0) + 1
    out.append("📊 Summary:")
    out += [f"   {msg}: {n}" for msg, n in counts.items()]
    return "\n".join(out)


# --------------------------------------------------------------- embed
MINIMAL_TOKEN_PREFIXES = (
    "--primitive-spacing-", "--primitive-fontSize-", "--primitive-fontWeight-",
    "--primitive-lineHeight-", "--primitive-radius-", "--primitive-shadow-glow-",
    "--primitive-gradient-", "--primitive-duration-", "--color-primary",
    "--color-secondary", "--color-accent", "--color-background",
    "--color-surface", "--color-foreground", "--color-border",
    "--typography-font-", "--card-",
)


def extract_tokens(css: str, minimal: bool = False) -> str:
    blocks = re.findall(r":root\s*\{([^}]+)\}", css)
    all_vars: list[str] = []
    for block in blocks:
        all_vars += re.findall(r"--[\w-]+:\s*[^;]+;", block)
    if minimal:
        all_vars = [v for v in all_vars
                    if any(p in v for p in MINIMAL_TOKEN_PREFIXES)]
    seen: list[str] = []
    for v in all_vars:
        if v not in seen:
            seen.append(v)
    return ":root {\n  " + "\n  ".join(seen) + "\n}"


# --------------------------------------------------------------- CLI
def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tokens", description=__doc__)
    sub = parser.add_subparsers(dest="op", required=True)

    p_gen = sub.add_parser("generate", help="tokens.json → CSS vars / Tailwind colors")
    p_gen.add_argument("--config", "-c", required=True)
    p_gen.add_argument("--output", "-o", default=None)
    p_gen.add_argument("--format", "-f", choices=["css", "tailwind"], default="css")

    p_val = sub.add_parser("validate", help="find hardcoded values that should be tokens")
    p_val.add_argument("--dir", "-d", required=True)
    p_val.add_argument("--ignore", "-i", action="append", default=[])
    p_val.add_argument("--json", action="store_true",
                       help="Emit findings as JSON (kind=token_violation)")

    p_emb = sub.add_parser("embed", help="emit embeddable inline CSS from a tokens.css")
    p_emb.add_argument("--tokens", "-t", required=True,
                       help="Path to the generated design-tokens.css")
    p_emb.add_argument("--minimal", action="store_true")
    p_emb.add_argument("--style", action="store_true", help="Wrap in <style> tags")

    args = parser.parse_args(argv)

    if args.op == "generate":
        config = Path(args.config)
        if not config.exists():
            print(f"Error: Config file not found: {config}", file=sys.stderr)
            return 1
        tokens = json.loads(config.read_text(encoding="utf-8"))
        output = generate_tailwind(tokens) if args.format == "tailwind" else generate_css(tokens)
        if args.output:
            out = Path(args.output)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(output, encoding="utf-8")
            print(f"Generated: {out}")
        else:
            print(output)
        return 0

    if args.op == "validate":
        root = Path(args.dir)
        if not root.exists():
            print(f"Error: Directory not found: {root}", file=sys.stderr)
            return 1
        ignore = DEFAULT_IGNORE | set(args.ignore)
        violations: list = []
        for file in _iter_files(root, ignore):
            violations += scan_file(file)
        if args.json:
            print(json.dumps(violations, indent=2))
        else:
            print(format_report(violations))
        return 1 if violations else 0

    # embed
    tokens_path = Path(args.tokens)
    if not tokens_path.exists():
        print(f"Error: tokens css not found: {tokens_path}", file=sys.stderr)
        return 1
    output = extract_tokens(tokens_path.read_text(encoding="utf-8"), args.minimal)
    header = "/* Design Tokens (embedded for standalone HTML) */"
    if args.style:
        print(f"<style>\n{header}\n{output}\n</style>")
    else:
        print(f"{header}\n{output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
