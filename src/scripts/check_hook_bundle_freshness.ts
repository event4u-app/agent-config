#!/usr/bin/env tsx
/**
 * Fail when the self-hosted hook bundle is older than the hook sources it
 * bundles — i.e. when this repo's own agent is running a hook fix that has
 * not been built.
 *
 * WHY THIS EXISTS — measured, not hypothetical.
 *
 * The Claude hook command resolves its dispatcher in two steps: the installed
 * package copy (`node_modules/@event4u/agent-config/dist/hooks/dispatch.js`)
 * if present, else this repo's OWN `dist/hooks/dispatch.js`. In the
 * agent-config repo the second branch always wins — that is the dogfooding
 * path, and it is the only place these hooks are exercised before release.
 *
 * `dist/hooks/dispatch.js` is UNTRACKED (a build artifact) and is produced
 * only by `npm run build:hooks`, which no Taskfile target, no `task ci`
 * target, and no workflow invokes. `prepack` runs the full build, so a
 * PUBLISHED package is always fresh and consumers are unaffected. The gap is
 * local and it is exactly where the testing happens.
 *
 * Consequence, observed on 2026-08-06: the conformance round-2 PR (#1195)
 * merged four hook fixes — among them the language-mirror pin — while the
 * running bundle was from 07:27 that morning, before any of them existed.
 * Ten hook sources were newer than the bundle. In the very session that
 * shipped the language fix, the scanner counted four German-prompt /
 * English-reply violations: the fix was merged, correct, and not loaded.
 *
 * A hook fix that cannot reach the agent that wrote it is indistinguishable
 * from no fix, and nothing said so. This gate says so.
 *
 * WHAT IT DOES NOT DO — ORDERING IS NOT EQUIVALENCE. This gate compares
 * mtimes, so `touch dist/hooks/dispatch.js` makes every source look older and
 * this gate green while the executing bytes are stale. Demonstrated on this tree
 * rather than argued (2026-08-23): a one-constant edit to
 * `block_unauthorized_git.ts` plus a `touch` on the bundle left THIS gate at
 * exit 0 while `check_hook_bundle_content` exited 1 with executing
 * `sha256 ce21579b7c14` against rebuilt `ac83e2f51118` — identical byte count,
 * different bytes. That is why the success line below says "ordering" and names
 * the digest gate instead of claiming freshness outright, and why preflight runs
 * the two together (`taskfiles/ci-fast.yml`). The content comparison is NOT
 * duplicated here: one home per invariant.
 *
 * WHAT IT DOES NOT DO: it never builds. Building into a live hook path is a
 * documented hazard in this repo (an esbuild run that overwrites the
 * dispatcher a running hook is executing can wedge the tool loop), so the
 * remedy is printed for a human to run deliberately. The SAFE rebuild
 * (build to .new → probe → atomic rename) lives in `rebuild_hook_bundle.ts`,
 * which preflight runs right before this gate — so a red here means the heal
 * itself failed or was bypassed, not merely that a merge landed.
 *
 * Exit codes: 0 = fresh, or no self-hosted bundle to check · 1 = stale.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

// Single-quoted on purpose: check_gate_completeness detects ledger adoption by this exact import form.
import { GateLedger } from './_lib/gate_ledger.js';
import { reportScanned } from "./_lib/scan_scope.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const BUNDLE = path.join("dist", "hooks", "dispatch.js");
const MANIFEST = path.join("src", "scripts", "hook_manifest.yaml");
const HOOK_DIR = path.join("src", "scripts", "hooks");
const REMEDY = "npm run build:hooks";

/** Every source whose edit changes the bundle's behaviour. */
export function bundledSources(root: string): string[] {
  const out = new Set<string>();

  const manifestAbs = path.join(root, MANIFEST);
  if (fs.existsSync(manifestAbs)) {
    out.add(MANIFEST);
    try {
      const doc = parseYaml(fs.readFileSync(manifestAbs, "utf-8")) as {
        concerns?: Record<string, { script?: string }>;
      };
      for (const def of Object.values(doc?.concerns ?? {})) {
        const s = def?.script;
        // A concern script is bundled wherever it lives, not only under hooks/.
        if (typeof s === "string" && s.endsWith(".ts")) out.add(s);
      }
    } catch {
      // A malformed manifest is another gate's problem; still check the dir.
    }
  }

  const hookDirAbs = path.join(root, HOOK_DIR);
  if (fs.existsSync(hookDirAbs)) {
    for (const e of fs.readdirSync(hookDirAbs, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith(".ts")) out.add(path.join(HOOK_DIR, e.name));
    }
  }

  return [...out].filter((rel) => fs.existsSync(path.join(root, rel))).sort();
}

export interface Result {
  /** No self-hosted bundle → the installed package copy is authoritative. */
  skipped: boolean;
  bundleMtimeMs: number;
  /** Sources strictly newer than the bundle, newest first. */
  stale: { file: string; mtimeMs: number }[];
  checked: number;
}

export function check(root: string): Result {
  const bundleAbs = path.join(root, BUNDLE);
  if (!fs.existsSync(bundleAbs)) {
    return { skipped: true, bundleMtimeMs: 0, stale: [], checked: 0 };
  }
  const bundleMtimeMs = fs.statSync(bundleAbs).mtimeMs;
  const sources = bundledSources(root);
  const stale = sources
    .map((file) => ({ file, mtimeMs: fs.statSync(path.join(root, file)).mtimeMs }))
    .filter((s) => s.mtimeMs > bundleMtimeMs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { skipped: false, bundleMtimeMs, stale, checked: sources.length };
}

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16);
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const root = REPO_ROOT;
  const quiet = argv.includes("--quiet");
  const r = check(root);

  // Scope hardening: publish the count and refuse a silent zero. The one
  // legitimate zero is the absent self-hosted bundle — an optional input, and
  // the reason survives the manifest's own test ("if the scan root were
  // deleted, would this still make sense?"): with no bundle there is no stale
  // dispatcher to catch, which is a correct verdict rather than blindness.
  reportScanned({
    gate: "check_hook_bundle_freshness",
    scanned: r.checked,
    units: "bundled hook source(s)",
    roots: [BUNDLE, HOOK_DIR, MANIFEST],
    ...(r.skipped
      ? {
          allowEmpty:
            "OPTIONAL_INPUT: no self-hosted dist/hooks/dispatch.js — this repo is not " +
            "running its own bundle (fresh checkout / CI), so there is nothing to compare against.",
        }
      : {}),
  });

  // Per-source completeness: every bundled source reaches exactly one outcome
  // (fresh or stale), so a source silently dropped from the mtime sweep could
  // not read as a pass. Nothing to plan when no self-hosted bundle exists.
  if (!r.skipped) {
    const ledger = new GateLedger("check_hook_bundle_freshness");
    const sources = bundledSources(root);
    ledger.plan(sources);
    const staleSet = new Set(r.stale.map((s) => s.file));
    for (const file of sources) {
      if (staleSet.has(file)) {
        ledger.fail(file, "source is newer than the built bundle");
      } else {
        ledger.complete(file);
      }
    }
    ledger.report();
  }

  // A gate that scans nothing must SAY it scanned nothing — a silent green
  // here is indistinguishable from a pass.
  if (r.skipped) {
    if (!quiet) {
      process.stdout.write(
        `✅  OK  hook bundle: no self-hosted ${BUNDLE} — the installed package copy is in use, nothing to check\n`,
      );
    }
    return 0;
  }

  if (r.stale.length === 0) {
    if (!quiet) {
      process.stdout.write(
        `✅  OK  hook bundle: ordering fresh (built ${stamp(r.bundleMtimeMs)}, ${String(r.checked)} bundled source(s) checked) — byte-equivalence is check_hook_bundle_content's\n`,
      );
    }
    return 0;
  }

  console.error(
    `❌  hook bundle is STALE — the running dispatcher predates ${r.stale.length} of ${r.checked} bundled source(s).`,
  );
  console.error(`    ${BUNDLE} built ${stamp(r.bundleMtimeMs)}; newer sources:`);
  for (const s of r.stale.slice(0, 10)) {
    console.error(`      ${stamp(s.mtimeMs)}  ${s.file}`);
  }
  if (r.stale.length > 10) console.error(`      … and ${r.stale.length - 10} more`);
  console.error("");
  console.error(`    Your hooks are running the OLD code. Rebuild:  ${REMEDY}`);
  console.error(
    "    (This gate never builds for you — writing into a live hook path can wedge the tool loop.)",
  );
  return 1;
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
