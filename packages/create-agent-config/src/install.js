// Core install logic for @event4u/create-agent-config.
//
// Flow:
//   1. Parse argv (subcommand + flags).
//   2. Resolve the source tarball (npm registry latest by default; --ref for
//      a specific git ref via codeload).
//   3. Download + extract into a temp dir under os.tmpdir().
//   4. Spawn `bash scripts/install --tools=<picked> [--yes] [--target=<cwd>]`.
//   5. Clean up the temp dir.
//
// Subcommands:
//   init    — install into the current working directory (default)
//   global  — placeholder for Phase 3 (`scripts/install.py global`); prints
//             a "not yet shipped" notice and exits 2.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const PACKAGE = "@event4u/agent-config";
const REPO = "event4u-app/agent-config";

function parseArgs(argv) {
    const args = { subcommand: "init", tools: undefined, yes: false, ref: undefined, dryRun: false, target: process.cwd() };
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "init" || a === "global") { args.subcommand = a; continue; }
        if (a === "--yes" || a === "-y") { args.yes = true; continue; }
        if (a === "--dry-run") { args.dryRun = true; continue; }
        if (a === "--help" || a === "-h") { args.help = true; continue; }
        if (a.startsWith("--tools=")) { args.tools = a.slice(8); continue; }
        if (a === "--tools") { args.tools = argv[++i]; continue; }
        if (a.startsWith("--ref=")) { args.ref = a.slice(6); continue; }
        if (a === "--ref") { args.ref = argv[++i]; continue; }
        if (a.startsWith("--target=")) { args.target = a.slice(9); continue; }
        if (a === "--target") { args.target = argv[++i]; continue; }
        rest.push(a);
    }
    args.rest = rest;
    return args;
}

function showHelp() {
    process.stdout.write(`Usage: npx ${PACKAGE.replace("agent-config", "create-agent-config")} [SUBCOMMAND] [OPTIONS]

Subcommands:
  init       Install agent-config into the current directory (default)
  global     Reserved for Phase 3 (global per-user install). Not yet shipped.

Options:
  --tools <list>   Comma-separated tool IDs (default: all). Forwarded to
                   scripts/install. Valid: claude-code,claude-desktop,cursor,
                   windsurf,cline,gemini-cli,copilot,augment,aider,codex,all.
  --yes, -y        Non-interactive mode. Skip prompts.
  --ref <git-ref>  Install a specific git ref (branch, tag, sha) instead of
                   the latest npm release. Useful for testing.
  --target <dir>   Target project directory (default: cwd).
  --dry-run        Print the command that would be run; do not execute.
  --help, -h       Show this help.
`);
}

async function downloadTarball(url, destPath) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText} (${url})`);
    if (!res.body) throw new Error(`Download failed: empty body (${url})`);
    await pipeline(res.body, createWriteStream(destPath));
}

async function resolveTarballUrl(ref) {
    if (ref) return `https://codeload.github.com/${REPO}/tar.gz/${encodeURIComponent(ref)}`;
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE.replace("/", "%2F")}/latest`);
    if (!res.ok) throw new Error(`npm registry lookup failed: ${res.status} ${res.statusText}`);
    const meta = await res.json();
    const url = meta?.dist?.tarball;
    if (!url) throw new Error("npm registry response missing dist.tarball");
    return url;
}

export async function run(argv) {
    const args = parseArgs(argv);
    if (args.help) { showHelp(); return; }

    if (args.subcommand === "global") {
        process.stderr.write("  ⚠️  `global` subcommand is reserved for Phase 3 of road-to-simplicity-and-everywhere. Not yet shipped.\n");
        process.exit(2);
    }

    const tmpRoot = mkdtempSync(join(tmpdir(), "create-agent-config-"));
    const extractDir = join(tmpRoot, "src");
    const tarballPath = join(tmpRoot, "package.tgz");

    try {
        const url = await resolveTarballUrl(args.ref);
        process.stdout.write(`  ⬇️   Downloading ${url}\n`);
        await downloadTarball(url, tarballPath);
        await mkdir(extractDir, { recursive: true });
        const tarResult = spawnSync("tar", ["-xzf", tarballPath, "-C", extractDir, "--strip-components=1"], { stdio: ["ignore", "ignore", "inherit"] });
        if (tarResult.status !== 0) throw new Error(`tar extraction failed (exit ${tarResult.status}). Ensure GNU/BSD tar is installed.`);

        const installer = join(extractDir, "scripts", "install");
        if (!existsSync(installer)) throw new Error(`Installer not found at ${installer} (tarball layout unexpected)`);

        const cmd = ["bash", installer, "--target", args.target];
        if (args.tools) cmd.push(`--tools=${args.tools}`);
        if (args.yes) cmd.push("--yes");

        if (args.dryRun) { process.stdout.write(`  🔍  [dry-run] ${cmd.join(" ")}\n`); return; }

        process.stdout.write(`  🚀  Running ${cmd.slice(1).join(" ")}\n`);
        const result = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit" });
        if (result.status !== 0) {
            const err = new Error(`scripts/install exited with code ${result.status}`);
            err.exitCode = result.status ?? 1;
            throw err;
        }
        process.stdout.write("  ✅  Done.\n");
    } finally {
        try { rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
}
