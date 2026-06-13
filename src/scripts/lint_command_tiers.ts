#!/usr/bin/env node
/**
 * Lint slash-command frontmatter for the `tier:` key.
 *
 * TypeScript twin of `src/scripts/lint_command_tiers.py` (ADR-092, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same scan scope, file
 * ordering, finding messages, stdout/stderr split, and exit codes
 * (return-code bitwise-OR accumulation across the domain + per-root +
 * condensed-projection passes).
 *
 * Hard-fails CI if any command lacks a `tier:` declaration or uses an unknown
 * tier value. The valid tier set is locked by
 * docs/contracts/command-surface-tiers.md.
 *
 * Exit codes:
 *   0  every command declares a valid tier
 *   1  one or more commands missing or using an invalid tier
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { artefact_roots } from "./_lib/agent_src.js";

const QUIET = process.argv.includes("--quiet");

// src/scripts/lint_command_tiers.ts → two levels up is the repo root.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function _isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Recursive `*.md` glob, sorted by POSIX string; follows directory symlinks. */
function rglobMd(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.name.endsWith(".md")) {
        out.push(full);
      }
      if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
        walk(full);
      }
    }
  };
  walk(root);
  out.sort();
  return out;
}

function relPosix(child: string, base: string): string {
  return path.relative(base, child).split(path.sep).join("/");
}

// Post-ADR-051 the command sources live at src/domains/<pack>/**/command.md;
// legacy artefact-root commands/ dirs are kept for older checkouts. A root
// whose commands/ holds only evals (no .md) is not a command source.
function COMMANDS_DIRS(): string[] {
  return artefact_roots()
    .map((root) => path.join(root, "commands"))
    .filter((d) => {
      if (!_isDir(d)) {
        return false;
      }
      return rglobMd(d).some((p) => path.basename(p) !== "AGENTS.md");
    });
}

const DOMAINS_DIR = path.join(REPO, "src", "domains");
// Consumer-facing projection — must also carry tier so .augment/commands/
// (which symlinks to dist/agent-src/commands/) renders the tier filter.
const COMMANDS_DIR_CONDENSED = path.join(REPO, "dist/agent-src", "commands");

const VALID_TIERS: ReadonlySet<string> = new Set(["0", "1", "2"]);

export function parse_tier(text: string): string | null {
  if (!text.startsWith("---\n")) {
    return null;
  }
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    return null;
  }
  for (const line of text.slice(4, end).split("\n")) {
    if (!line.includes(":")) {
      continue;
    }
    const idx = line.indexOf(":");
    const k = line.slice(0, idx);
    const v = line.slice(idx + 1);
    if (k.trim() === "tier") {
      return stripQuotes(v.trim());
    }
  }
  return null;
}

function stripQuotes(s: string): string {
  return stripChar(stripChar(s, '"'), "'");
}

function stripChar(s: string, ch: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === ch) start += 1;
  while (end > start && s[end - 1] === ch) end -= 1;
  return s.slice(start, end);
}

// Mirror Python's `print(sorted(set))` list repr: ['0', '1', ...].
function sortedTiersRepr(): string {
  const items = [...VALID_TIERS].sort();
  return `[${items.map((s) => `'${s}'`).join(", ")}]`;
}

export function lint(commands_dir: string, quiet = false): number {
  if (!_isDir(commands_dir)) {
    process.stderr.write(
      `lint_command_tiers: no commands dir at ${commands_dir}\n`,
    );
    return 1;
  }

  const files = rglobMd(commands_dir);
  // Sub-AGENTS.md companions are not slash commands.
  const commands = files.filter((p) => path.basename(p) !== "AGENTS.md");

  if (commands.length === 0) {
    process.stderr.write(
      `lint_command_tiers: no commands found under ${commands_dir}\n`,
    );
    return 1;
  }

  const missing: string[] = [];
  const invalid: Array<[string, string]> = [];

  for (const cmd of commands) {
    const rel = relPosix(cmd, commands_dir);
    const tier = parse_tier(fs.readFileSync(cmd, "utf-8"));
    if (tier === null) {
      missing.push(rel);
    } else if (!VALID_TIERS.has(tier)) {
      invalid.push([rel, tier]);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    process.stderr.write(
      `❌  lint_command_tiers: ${missing.length} missing, ` +
        `${invalid.length} invalid (of ${commands.length} commands)\n`,
    );
    for (const name of missing) {
      process.stderr.write(`    missing tier: ${name}\n`);
    }
    for (const [name, tier] of invalid) {
      process.stderr.write(`    invalid tier '${tier}': ${name}\n`);
    }
    process.stderr.write(`    valid tiers: ${sortedTiersRepr()}\n`);
    process.stderr.write(
      "    contract: docs/contracts/command-surface-tiers.md\n",
    );
    return 1;
  }

  if (!quiet) {
    process.stdout.write(
      `✅  lint_command_tiers: ${commands.length} commands, ` +
        "all tier values valid\n",
    );
  }
  return 0;
}

/** Lint src/domains/**\/command.md — the post-ADR-051 authoring tree. */
export function lint_domain_sources(quiet = false): number {
  const commands = rglobNamed(DOMAINS_DIR, "command.md");
  if (commands.length === 0) {
    process.stderr.write(
      `lint_command_tiers: no command.md found under ${DOMAINS_DIR}\n`,
    );
    return 1;
  }
  const missing: string[] = [];
  const invalid: Array<[string, string]> = [];
  for (const c of commands) {
    const t = parse_tier(fs.readFileSync(c, "utf-8"));
    const rel = relPosix(c, REPO);
    if (t === null) {
      missing.push(rel);
    } else if (!VALID_TIERS.has(t)) {
      invalid.push([rel, t]);
    }
  }
  if (missing.length > 0 || invalid.length > 0) {
    process.stderr.write(
      `❌  lint_command_tiers: ${missing.length} missing, ` +
        `${invalid.length} invalid (of ${commands.length} domain commands)\n`,
    );
    for (const name of missing) {
      process.stderr.write(`    missing tier: ${name}\n`);
    }
    for (const [name, tier] of invalid) {
      process.stderr.write(`    invalid tier '${tier}': ${name}\n`);
    }
    return 1;
  }
  if (!quiet) {
    process.stdout.write(
      `✅  lint_command_tiers: ${commands.length} domain commands, ` +
        "all tier values valid\n",
    );
  }
  return 0;
}

/** Recursive glob for an exact filename, sorted. */
function rglobNamed(root: string, name: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.name === name) {
        out.push(full);
      }
      if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
        walk(full);
      }
    }
  };
  walk(root);
  out.sort();
  return out;
}

export function main(): number {
  const commandsDirs = COMMANDS_DIRS();
  if (commandsDirs.length === 0 && !_isDir(DOMAINS_DIR)) {
    process.stderr.write(
      "lint_command_tiers: no commands dir found under any artefact root\n",
    );
    return 1;
  }
  let rc = 0;
  if (_isDir(DOMAINS_DIR)) {
    rc |= lint_domain_sources(QUIET);
  }
  for (const commandsDir of commandsDirs) {
    rc |= lint(commandsDir, QUIET);
  }
  // The condensed projection is the consumer-facing tree (via the
  // .augment/commands → dist/agent-src/commands symlink). It must also
  // carry tier so the surface stays uniform.
  if (_isDir(COMMANDS_DIR_CONDENSED)) {
    rc |= lint(COMMANDS_DIR_CONDENSED, QUIET);
  }
  return rc;
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main());
}
