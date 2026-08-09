#!/usr/bin/env tsx
/**
 * Safe self-heal for the self-hosted hook bundle — the builder that
 * `check_hook_bundle_freshness` deliberately is not.
 *
 * WHY THIS EXISTS — measured, not hypothetical.
 *
 * The freshness gate reds after ANY hook-source merge from main, because
 * `dist/hooks/dispatch.js` is untracked and nothing in the local chain
 * rebuilds it. On 2026-08-09 that turned `task release` (9.28.0) into a
 * blocked push with a remedy the operator had to run by hand — a routine
 * pre-push chore promoted to a release incident. The gate is right to never
 * build (its documented hazard: esbuild overwriting the dispatcher a running
 * hook is executing can wedge the tool loop). The hazard is in HOW a naive
 * rebuild writes, not in rebuilding: this script builds to a sibling `.new`
 * file, proves the result actually dispatches, and only then renames it into
 * place — an atomic same-directory rename that a running hook holding an open
 * file descriptor never observes mid-write.
 *
 * The `.new` file MUST live in `dist/hooks/` (not a temp dir): the bundle
 * resolves `src/scripts/hook_manifest.yaml` relative to its OWN location via
 * the `__AGENT_CONFIG_BUNDLE__` path-depth switch. Built anywhere else, every
 * probe answers "manifest missing" with exit 0 and the smoke test proves
 * nothing (measured 2026-08-08).
 *
 * The esbuild invocation is NOT duplicated here — it is read from
 * `package.json`'s `build:hooks` script and only the `--outfile=` is
 * rewritten, so the flag set (banner, defines, target) has exactly one home.
 *
 * Behaviour:
 *   no self-hosted bundle → no-op (fresh checkout / CI — nothing is running
 *                           stale code, and materialising a bundle here would
 *                           change what other gates see)
 *   bundle fresh          → no-op
 *   bundle stale          → rebuild to `.new`, probe, rename into place
 *   build or probe fails  → the `.new` file is removed and the OLD bundle
 *                           keeps running (old-but-working beats broken);
 *                           exit 1 so the freshness gate behind this still
 *                           reds and the failure is loud.
 *
 * Exit codes: 0 = fresh / healed / nothing to heal · 1 = heal failed.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { check } from "./check_hook_bundle_freshness.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const LIVE_REL = path.join("dist", "hooks", "dispatch.js");
const NEW_REL = path.join("dist", "hooks", "dispatch.new.js");

/**
 * Rewrite the `--outfile=` of the canonical `build:hooks` script to the
 * `.new` sibling. Returns null when the expected outfile token is absent —
 * a changed `package.json` must fail loudly, never build to a guessed path.
 */
export function rewriteOutfile(script: string, newOutfile: string): string | null {
  const token = `--outfile=${LIVE_REL}`;
  if (!script.includes(token)) return null;
  return script.replace(token, `--outfile=${newOutfile}`);
}

/**
 * Verdict on a dispatcher probe. The probe contract is pinned against the
 * real dry-run output: exit 0 AND parseable JSON AND a non-empty `concerns`
 * array. Exit 0 alone is NOT enough — a bundle that cannot find its manifest
 * answers "manifest missing" with exit 0 (measured 2026-08-08), which is
 * exactly the broken dispatcher this probe exists to keep out of the live
 * path. Returns null on pass, a human-readable reason on failure.
 */
export function probeVerdict(exitCode: number, stdout: string): string | null {
  if (exitCode !== 0) return `probe exited ${String(exitCode)}`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return `probe output is not JSON: ${stdout.slice(0, 120)}`;
  }
  const concerns = (parsed as { concerns?: unknown }).concerns;
  if (!Array.isArray(concerns) || concerns.length === 0) {
    return "probe JSON carries no concerns — the bundle dispatched nothing";
  }
  return null;
}

function cleanup(newAbs: string): void {
  try {
    fs.rmSync(newAbs, { force: true });
  } catch {
    // Best-effort: a leftover .new file is inert (nothing executes it).
  }
}

export function main(): number {
  const r = check(REPO_ROOT);

  if (r.skipped) {
    process.stdout.write(
      `✅  OK  rebuild_hook_bundle: no self-hosted ${LIVE_REL} — nothing runs stale code, nothing to heal\n`,
    );
    return 0;
  }
  if (r.stale.length === 0) {
    process.stdout.write("✅  OK  rebuild_hook_bundle: bundle already fresh — no rebuild needed\n");
    return 0;
  }

  process.stdout.write(
    `🔧  hook bundle stale (${String(r.stale.length)} newer source(s)) — rebuilding safely (build .new → probe → atomic rename)\n`,
  );

  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8")) as {
    scripts?: Record<string, string>;
  };
  const buildScript = pkg.scripts?.["build:hooks"];
  if (buildScript === undefined) {
    console.error("❌  rebuild_hook_bundle: package.json has no build:hooks script");
    return 1;
  }
  const cmd = rewriteOutfile(buildScript, NEW_REL);
  if (cmd === null) {
    console.error(
      `❌  rebuild_hook_bundle: build:hooks no longer targets --outfile=${LIVE_REL} — ` +
        "refusing to build to a guessed path; update this script alongside package.json",
    );
    return 1;
  }

  const newAbs = path.join(REPO_ROOT, NEW_REL);
  const build = spawnSync("sh", ["-c", cmd], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    env: { ...process.env, PATH: `${path.join(REPO_ROOT, "node_modules", ".bin")}:${process.env["PATH"] ?? ""}` },
  });
  if (build.status !== 0) {
    cleanup(newAbs);
    console.error(`❌  rebuild_hook_bundle: esbuild failed (${String(build.status)}):`);
    console.error((build.stderr || build.stdout || "").trim());
    return 1;
  }

  const probe = spawnSync(
    "node",
    [newAbs, "--platform", "claude", "--event", "pre_tool_use", "--dry-run"],
    { cwd: REPO_ROOT, encoding: "utf-8", input: "{}" },
  );
  const verdict = probeVerdict(probe.status ?? 1, probe.stdout ?? "");
  if (verdict !== null) {
    cleanup(newAbs);
    console.error(`❌  rebuild_hook_bundle: new bundle failed its probe — ${verdict}`);
    console.error("    The old bundle stays in place (old-but-working beats broken).");
    return 1;
  }

  fs.renameSync(newAbs, path.join(REPO_ROOT, LIVE_REL));
  process.stdout.write(
    `✅  OK  rebuild_hook_bundle: rebuilt + probed + renamed into place (${String(r.checked)} bundled source(s))\n`,
  );
  return 0;
}

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
