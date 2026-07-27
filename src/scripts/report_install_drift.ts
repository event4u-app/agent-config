#!/usr/bin/env tsx
/**
 * Installer drift report — measures, never gates.
 *
 * Compares the sha256 hashes recorded in `agents/installed-tools.lock`
 * (`kind: 'deployed'` entries) against the current on-disk content of those
 * same files and reports anything locally modified or deleted since the
 * last install/upgrade. This is telemetry for the "do consumers edit
 * framework-authoritative files" premise — it is NEVER a gate. The drift
 * report itself always exits 0 regardless of what it finds; only a usage
 * error (unknown flag, missing value) exits non-zero, matching the rest of
 * this package's CLI scripts.
 *
 * `install.ts`'s global-install upgrade path calls the same
 * `_lib/install_drift.ts` library directly (not this CLI) and always
 * proceeds with the redeploy regardless of what the report finds.
 *
 * Usage:
 *   ./scripts-run src/scripts/report_install_drift
 *   ./scripts-run src/scripts/report_install_drift --project <path>
 *   ./scripts-run src/scripts/report_install_drift --format json
 *
 * Exit codes: 0 report emitted (clean or drifted) · 2 usage error.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collect_drift, format_drift_report } from "./_lib/install_drift.js";

interface Options {
  project: string;
  format: "text" | "json";
}

function fail(message: string): never {
  process.stderr.write(`❌  report_install_drift: ${message}\n`);
  process.exit(2);
}

function _parse(argv: string[]): Options {
  const opts: Options = { project: process.cwd(), format: "text" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "usage: report_install_drift [--project <path>] [--format text|json]\n",
      );
      process.exit(0);
    } else if (arg === "--project") {
      const value = argv[i + 1];
      if (value === undefined) fail("--project requires a value");
      opts.project = path.resolve(value);
      i += 1;
    } else if (arg === "--format") {
      const value = argv[i + 1];
      if (value !== "text" && value !== "json") {
        fail(`--format must be 'text' or 'json' (got ${JSON.stringify(value ?? null)})`);
      }
      opts.format = value;
      i += 1;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

/**
 * Run the report and print it. Always returns 0 — the finding is telemetry,
 * never a build/CI failure signal.
 */
export function main(argv: string[] = process.argv.slice(2)): number {
  const opts = _parse(argv);
  const entries = collect_drift(opts.project);

  if (opts.format === "json") {
    process.stdout.write(
      `${JSON.stringify(
        {
          project_root: opts.project,
          manifest_found: entries !== null,
          drift: entries ?? [],
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(format_drift_report(entries));
  }
  return 0;
}

// Main-guard (realpath-compared, mirrors the repo convention).
if (process.argv[1] !== undefined) {
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
    if (here === argv1) {
      process.exit(main(process.argv.slice(2)));
    }
  } catch {
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
      process.exit(main(process.argv.slice(2)));
    }
  }
}
