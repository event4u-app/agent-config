#!/usr/bin/env tsx
/**
 * Content-equivalence gate for the self-hosted hook bundle.
 *
 * WHY THIS EXISTS — measured, not hypothetical.
 *
 * `check_hook_bundle_freshness` compares **mtimes**: every bundled hook source
 * must be older than `dist/hooks/dispatch.js`. That establishes ordering, not
 * equivalence. An mtime-preserving edit, a `touch` on the bundle, a restore
 * from an archive, or a filesystem with coarse timestamp resolution all make
 * the inference false while the check stays green.
 *
 * On 2026-08-21 exactly that gap cost a live run: `LEDGER_MAX_AGE_MS` was
 * edited in `block_unauthorized_git.ts`, the bundle was not rebuilt, and the
 * guard kept enforcing the old value. All three copies (source, repo bundle,
 * global install) were inspected by hand before anyone noticed. This gate
 * answers the question the mtime check cannot: *are the bytes that execute the
 * bytes this source produces?*
 *
 * WHAT IT CANNOT DO, STATED PLAINLY.
 *
 * `dist/hooks/` is **untracked** — `git ls-files dist/hooks/` returns zero.
 * There is no committed artefact to compare against, so this gate can only
 * compare the bundle **present on this machine** against a fresh rebuild from
 * this checkout's sources. In CI a fresh checkout has no bundle at all, so
 * this gate declares a loud no-op there and a green CI says nothing about the
 * bundle a maintainer is actually running. That asymmetry is the finding, not
 * a gap to paper over: the bundle is a local execution artefact and only a
 * local gate can see it.
 *
 * The esbuild invocation is NOT duplicated here — it is read from
 * `package.json`'s `build:hooks` script with only `--outfile=` rewritten, via
 * the same `rewriteOutfile` helper `rebuild_hook_bundle` uses, so the flag set
 * has exactly one home.
 *
 * DETERMINISM — measured, not assumed. Two consecutive rebuilds of an
 * unchanged tree produced the identical sha256 (`616561fb…`, 2026-08-21), and
 * a one-constant edit that left the output byte-count unchanged
 * (1 139 302 bytes both times) still produced a different digest. So the
 * comparison is byte-exact with no canonicalisation, and it is sensitive to
 * the smallest semantic change. Had the rebuild NOT been reproducible, that
 * would have been a release-integrity defect to fix rather than a reason to
 * fall back to timestamps.
 *
 * Exit codes: 0 = equivalent, or no bundle to check · 1 = the executing bundle
 * is not what this source produces · 2 = the rebuild itself failed.
 */
// ledger-exempt: single-artefact transaction — one rebuild compared against one
// bundle, yielding one aggregate verdict. The per-source accounting lives in
// check_hook_bundle_freshness, which carries the ledger.
import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { reportScanned } from "./_lib/scan_scope.js";
import { rewriteOutfile } from "./rebuild_hook_bundle.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const LIVE_REL = path.join("dist", "hooks", "dispatch.js");
const PROBE_REL = path.join("dist", "hooks", "dispatch.content-check.js");

/** sha256 of a file's bytes, hex. */
export function digestOf(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Read `build:hooks` out of package.json. Returns null when the script is
 * absent — a renamed build script must fail loudly, never be guessed at.
 */
export function buildScript(repoRoot: string): string | null {
  const pkgPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const scripts =
    typeof pkg === "object" && pkg !== null ? (pkg as Record<string, unknown>)["scripts"] : null;
  if (typeof scripts !== "object" || scripts === null) return null;
  const s = (scripts as Record<string, unknown>)["build:hooks"];
  return typeof s === "string" ? s : null;
}

function main(): number {
  const live = path.join(REPO_ROOT, LIVE_REL);
  if (!fs.existsSync(live)) {
    // Loud no-op, matching the sibling gates: a fresh checkout or CI has no
    // bundle, and materialising one here would change what other gates see.
    process.stdout.write(
      `check_hook_bundle_content: no self-hosted ${LIVE_REL} — nothing executes locally, nothing to compare\n`,
    );
    reportScanned({
      gate: "check_hook_bundle_content",
      scanned: 0,
      units: "bundle(s)",
      roots: [LIVE_REL],
      allowEmpty:
        "OPTIONAL_INPUT: dist/hooks/ is UNTRACKED (`git ls-files dist/hooks/` returns zero), so a fresh " +
        "checkout or a CI runner has no bundle by construction. An empty scope here is the " +
        "correct reading of the environment, not a dead scan root — the artefact this gate " +
        "guards is a local build output and exists only where the hooks actually run.",
    });
    return 0;
  }

  const script = buildScript(REPO_ROOT);
  if (script === null) {
    process.stderr.write(
      "check_hook_bundle_content: package.json has no `build:hooks` script — refusing to guess the flag set\n",
    );
    return 2;
  }
  const rewritten = rewriteOutfile(script, PROBE_REL);
  if (rewritten === null) {
    process.stderr.write(
      `check_hook_bundle_content: \`build:hooks\` no longer writes ${LIVE_REL} — refusing to build to a guessed path\n`,
    );
    return 2;
  }

  const probe = path.join(REPO_ROOT, PROBE_REL);
  try {
    // PATH is injected exactly as `rebuild_hook_bundle` does it, and for the
    // same reason: `build:hooks` starts with a bare `esbuild`, so inheriting an
    // ambient PATH without `node_modules/.bin` makes this gate report "rebuild
    // failed" on a bundle that is in fact correct — a false red on a pre-push
    // gate, which is how a pre-push gate teaches people to skip it.
    const built = spawnSync("sh", ["-c", rewritten], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${path.join(REPO_ROOT, "node_modules", ".bin")}:${process.env["PATH"] ?? ""}`,
      },
    });
    if (built.status !== 0 || !fs.existsSync(probe)) {
      process.stderr.write(
        `check_hook_bundle_content: rebuild failed (exit ${String(built.status)})\n${built.stderr ?? ""}\n`,
      );
      return 2;
    }

    const liveDigest = digestOf(live);
    const probeDigest = digestOf(probe);
    if (liveDigest === probeDigest) {
      process.stdout.write(
        `✅  ${LIVE_REL} is byte-identical to a rebuild from this source (sha256 ${liveDigest.slice(0, 12)})\n`,
      );
      reportScanned({
        gate: "check_hook_bundle_content",
        scanned: 1,
        units: "bundle(s)",
        roots: [LIVE_REL],
      });
      return 0;
    }

    process.stderr.write(
      `❌  ${LIVE_REL} is NOT what this source produces.\n` +
        `    executing: sha256 ${liveDigest.slice(0, 12)}  (${String(fs.statSync(live).size)} bytes)\n` +
        `    rebuilt:   sha256 ${probeDigest.slice(0, 12)}  (${String(fs.statSync(probe).size)} bytes)\n` +
        `    The mtime check cannot see this — it compares ordering, not bytes.\n` +
        `    Heal with: ./scripts-run src/scripts/rebuild_hook_bundle\n`,
    );
    reportScanned({
      gate: "check_hook_bundle_content",
      scanned: 1,
      units: "bundle(s)",
      roots: [LIVE_REL],
    });
    return 1;
  } finally {
    try {
      fs.rmSync(probe, { force: true });
    } catch {
      // Best effort — a leftover probe file is untracked build output.
    }
  }
}

// Resolved on BOTH sides with `realpathSync`, mirroring `rebuild_hook_bundle`.
// A string compare against `import.meta.url` is false under a symlinked
// checkout, and under any repo path containing a space or a non-ASCII
// character, which `import.meta.url` percent-encodes and `path.resolve` does
// not. The failure is silent: `main()` never runs, the process exits 0, and
// the gate reports nothing — a green on an invariant it never evaluated,
// which is the exact class this gate exists to remove.
const invokedDirectly = ((): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return fs.realpathSync(path.resolve(entry)) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  process.exit(main());
}

export { main };
