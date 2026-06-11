/**
 * Baseline-cache helpers for the package-impact A/B bench.
 *
 * TypeScript twin of `src/scripts/_lib/bench_ab_cache.py` (ADR-088,
 * Phase 2 Wave 2a). Public API mirrors the Python module exactly — same
 * exported names (deliberately snake_case), same cache-key shape and
 * `to_dict()` / `from_dict()` serialization, same freshness diagnosis.
 *
 * Phase 2 Step 2 of the package-impact-benchmark roadmap.
 *
 * A daily `task bench:ab` run wants to skip re-running the `without` arm when
 * nothing the model would see has changed. We define "changed" by a three-part
 * key:
 *
 *     (corpus_hash, claude_cli_version, target_shape_hash)
 *
 * Cached `without` reports live under `internal/bench/reports/ab/`. Each report
 * header records the cache key inputs; this module reads the directory, picks
 * the latest matching report, and reports freshness.
 *
 * Cross-batch dependency: `target_shape_hash()` re-exports the shape hash from
 * `src/scripts/bench_ab_clone.py`. That clone script is NOT yet ported to
 * TypeScript (it belongs to a later phase). The Python original imports it via
 * `importlib`; this twin shells out to `python3` to call
 * `bench_ab_clone.target_shape_hash()`, keeping a single source of truth for the
 * surface definition until `bench_ab_clone` is ported. When that twin lands,
 * swap the subprocess call for a direct `./bench_ab_clone.js` import.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename_ts = fileURLToPath(import.meta.url);
const __dirname_ts = path.dirname(__filename_ts);

// Python: REPO_ROOT = Path(__file__).resolve().parents[3]
// __file__ is src/scripts/_lib/<mod>; parents[3] = repo root.
export const REPO_ROOT = path.resolve(__dirname_ts, "..", "..", "..");
export const REPORTS_DIR = path.join(
  REPO_ROOT,
  "internal",
  "bench",
  "reports",
  "ab",
);

/** Three-part cache key, frozen + JSON-identical to the Python dataclass. */
export class CacheKey {
  readonly corpus_hash: string;
  readonly claude_cli_version: string;
  readonly target_shape_hash: string;

  constructor(
    corpus_hash: string,
    claude_cli_version: string,
    target_shape_hash: string,
  ) {
    this.corpus_hash = corpus_hash;
    this.claude_cli_version = claude_cli_version;
    this.target_shape_hash = target_shape_hash;
    Object.freeze(this);
  }

  /** Insertion-ordered dict — matches the Python `to_dict()` key order. */
  to_dict(): {
    corpus_hash: string;
    claude_cli_version: string;
    target_shape_hash: string;
  } {
    return {
      corpus_hash: this.corpus_hash,
      claude_cli_version: this.claude_cli_version,
      target_shape_hash: this.target_shape_hash,
    };
  }

  static from_dict(data: Record<string, string>): CacheKey {
    return new CacheKey(
      _getStr(data, "corpus_hash"),
      _getStr(data, "claude_cli_version"),
      _getStr(data, "target_shape_hash"),
    );
  }

  /** Value equality — frozen dataclass `==` in Python is field-wise. */
  equals(other: CacheKey): boolean {
    return (
      this.corpus_hash === other.corpus_hash &&
      this.claude_cli_version === other.claude_cli_version &&
      this.target_shape_hash === other.target_shape_hash
    );
  }
}

function _getStr(data: Record<string, string>, key: string): string {
  // Mirror Python `data.get(key, "")`.
  const v = data[key];
  return v === undefined || v === null ? "" : v;
}

/** Outcome of a cache lookup, JSON-identical fields to the Python dataclass. */
export class CacheLookup {
  readonly found: boolean;
  readonly fresh: boolean;
  readonly report_path: string | null;
  readonly cached_key: CacheKey | null;
  readonly reason: string;

  constructor(
    found: boolean,
    fresh: boolean,
    report_path: string | null,
    cached_key: CacheKey | null,
    reason: string,
  ) {
    this.found = found;
    this.fresh = fresh;
    this.report_path = report_path;
    this.cached_key = cached_key;
    this.reason = reason;
    Object.freeze(this);
  }
}

/** SHA-256 of a single file (used for corpus_hash) — first 16 hex chars. */
export function hash_file(filePath: string): string {
  const h = crypto.createHash("sha256");
  // Stream in 64 KiB chunks to mirror the Python iter(...read(65536)) loop;
  // result is content-identical regardless of chunk size.
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.allocUnsafe(65536);
    let read: number;
    // eslint-disable-next-line no-cond-assign
    while ((read = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      h.update(buf.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex").slice(0, 16);
}

/**
 * Best-effort: `claude --version` or fallback to env CLAUDE_CLI_VERSION.
 *
 * When the CLI is missing, return "unavailable:<reason>" so the cache key
 * still varies meaningfully when the CLI is later installed.
 */
export function claude_cli_version(): string {
  const override = process.env["CLAUDE_CLI_VERSION"];
  if (override) {
    return override.trim();
  }
  if (_which("claude") === null) {
    return "unavailable:not-on-path";
  }
  let stdout = "";
  let stderr = "";
  try {
    const result = _runCapture("claude", ["--version"], 10_000);
    if (result.code !== 0) {
      return `unavailable:exit-${result.code}`;
    }
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err) {
    // Mirror Python `(OSError, subprocess.TimeoutExpired) → type(err).__name__`.
    return `unavailable:${_errName(err)}`;
  }
  const combined = stdout || stderr;
  if (!combined) {
    return "unknown";
  }
  return combined.trim().split(/\r?\n/)[0] ?? "unknown";
}

/**
 * Re-export the shape hash from the clone script for a single source of truth.
 *
 * The clone script (`bench_ab_clone`) is not yet ported; until it is, this
 * shells out to the Python original. Mirrors the Python `importlib` path: on
 * any failure to load/run the module, returns "unknown".
 */
export function target_shape_hash(): string {
  const clonePy = path.join(
    REPO_ROOT,
    "src",
    "scripts",
    "bench_ab_clone.py",
  );
  if (!fs.existsSync(clonePy)) {
    return "unknown";
  }
  try {
    const driver = [
      "import importlib.util, sys",
      `spec = importlib.util.spec_from_file_location("bench_ab_clone", ${JSON.stringify(clonePy)})`,
      "if spec is None or spec.loader is None:",
      '    print("unknown"); sys.exit(0)',
      "module = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
      "sys.stdout.write(module.target_shape_hash())",
    ].join("\n");
    const out = execFileSync("python3", ["-c", driver], {
      encoding: "utf-8",
      maxBuffer: 4 * 1024 * 1024,
    });
    return out.trim();
  } catch {
    return "unknown";
  }
}

export function build_key(corpusPath: string): CacheKey {
  return new CacheKey(
    hash_file(corpusPath),
    claude_cli_version(),
    target_shape_hash(),
  );
}

/**
 * Return all report JSON paths under reports/ab/ for the given variant.
 *
 * Filenames follow `{stamp}-{corpus}-{variant}.json` (Phase 2 Step 3).
 * Sorted by filename to match Python `sorted(REPORTS_DIR.glob(...))`.
 */
export function iter_cached_reports(variant = "without"): string[] {
  if (!fs.existsSync(REPORTS_DIR)) {
    return [];
  }
  const suffix = `-${variant}.json`;
  const names = fs
    .readdirSync(REPORTS_DIR)
    .filter((name) => name.endsWith(suffix));
  // Sort by full path string, matching pathlib glob's lexical Path sort.
  const fullPaths = names.map((name) => path.join(REPORTS_DIR, name));
  fullPaths.sort();
  return fullPaths;
}

export function read_report_key(reportPath: string): CacheKey | null {
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  } catch {
    // Mirror Python `(OSError, json.JSONDecodeError) → None`.
    return null;
  }
  if (data === null || typeof data !== "object") {
    return null;
  }
  const raw = (data as Record<string, unknown>)["cache_key"];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  // Python: CacheKey.from_dict({k: str(v) for k, v in raw.items()})
  const coerced: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    coerced[k] = _pyStr(v);
  }
  return CacheKey.from_dict(coerced);
}

/** Find the latest cached `without` report and report freshness vs. current key. */
export function lookup(corpusPath: string): CacheLookup {
  if (!fs.existsSync(corpusPath)) {
    return new CacheLookup(
      false,
      false,
      null,
      null,
      `missing corpus: ${corpusPath}`,
    );
  }
  const current = build_key(corpusPath);
  const candidates = iter_cached_reports("without");
  if (candidates.length === 0) {
    return new CacheLookup(
      false,
      false,
      null,
      null,
      "no cached `without` report",
    );
  }
  // Reports sorted by filename — last is latest given UTC stamps
  const latest = candidates[candidates.length - 1]!;
  const cached_key = read_report_key(latest);
  if (cached_key === null) {
    return new CacheLookup(
      true,
      false,
      latest,
      null,
      "cached report missing cache_key",
    );
  }
  if (cached_key.equals(current)) {
    return new CacheLookup(true, true, latest, cached_key, "fresh");
  }
  // Diagnose which input drifted
  const drift_parts: string[] = [];
  if (cached_key.corpus_hash !== current.corpus_hash) {
    drift_parts.push("corpus");
  }
  if (cached_key.claude_cli_version !== current.claude_cli_version) {
    drift_parts.push("claude_cli_version");
  }
  if (cached_key.target_shape_hash !== current.target_shape_hash) {
    drift_parts.push("target_shape");
  }
  return new CacheLookup(
    true,
    false,
    latest,
    cached_key,
    "stale: " + drift_parts.join(","),
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Mirror Python `str(v)` for the JSON value types that can appear. */
function _pyStr(v: unknown): string {
  if (v === null) {
    return "None";
  }
  if (v === true) {
    return "True";
  }
  if (v === false) {
    return "False";
  }
  return String(v);
}

/** Locate an executable on PATH; mirrors `shutil.which`. Returns null if absent. */
function _which(cmd: string): string | null {
  const pathEnv = process.env["PATH"] || "";
  const exts =
    process.platform === "win32"
      ? (process.env["PATHEXT"] || ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) {
      continue;
    }
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // not here / not executable
      }
    }
  }
  return null;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a command capturing stdout/stderr, with a timeout. Throws on spawn
 * failure (ENOENT) or timeout, mirroring the OSError / TimeoutExpired raise
 * surface the Python caller catches.
 */
function _runCapture(cmd: string, args: string[], timeoutMs: number): RunResult {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      status?: number | null;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      signal?: string | null;
      killed?: boolean;
    };
    // Spawn failure (ENOENT etc.) or timeout (killed) → re-throw so the caller
    // produces "unavailable:<errName>", matching Python's catch.
    if (e.code === "ENOENT" || e.killed || e.signal) {
      throw err;
    }
    // Non-zero exit: surface the status so the caller maps it to exit-<code>.
    const status = typeof e.status === "number" ? e.status : 1;
    return {
      code: status,
      stdout: _decode(e.stdout),
      stderr: _decode(e.stderr),
    };
  }
}

function _decode(v: string | Buffer | undefined): string {
  if (v === undefined) {
    return "";
  }
  return typeof v === "string" ? v : v.toString("utf-8");
}

/** Approximate Python `type(err).__name__` for the unavailable reason. */
function _errName(err: unknown): string {
  const e = err as NodeJS.ErrnoException & {
    killed?: boolean;
    signal?: string | null;
  };
  if (e && (e.killed || e.signal)) {
    return "TimeoutExpired";
  }
  return "OSError";
}
