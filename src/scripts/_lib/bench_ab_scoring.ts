/**
 * Structural success criteria for Track B.
 *
 * TypeScript twin of `src/scripts/_lib/bench_ab_scoring.py` (ADR-200,
 * Phase 2 Wave 2a). Public API mirrors the Python module exactly — same
 * exported names (deliberately snake_case), same A/B scoring math, same
 * check ordering, same JSON-identical result shape.
 *
 * Phase 4 Step 3 of the package-impact-benchmark roadmap.
 *
 * No LLM-judge. Each criterion is a syntactic or behavioural check executable
 * against the post-run working tree + the captured transcript. If the structural
 * signal turns out too weak, a separate follow-up roadmap adds an LLM judge —
 * not this one.
 *
 * Per-category criteria, expressed as keys in the task's `success_criteria`
 * dict (see internal/bench/corpora/ab-trackb.yaml):
 *
 * - `target_file_modified`: <path>            — file at <path> changed between
 *   the pre-run snapshot and the post-run snapshot.
 * - `regex_in_target`: <pattern>              — pattern found in the named
 *   target_file (case-insensitive).
 * - `regex_in_any`: <pattern>                 — pattern found in any modified file.
 * - `new_test_file_exists`: <path>            — new test file present after the run.
 * - `test_assertion_added`: <path>            — file contains at least one
 *   `assert` / `expect(` / `test(` call.
 * - `one_of_files_modified`: [<paths>]        — at least one path modified.
 * - `preserves_public_api`: [<names>]         — each name still exported / present.
 * - `transcript_contains_one_of`: [<strings>] — any string appears in the
 *   transcript (case-insensitive).
 * - `no_file_write_before_audit`: bool        — if true, transcript shows an
 *   audit reference before the first write tool call (UI-audit category).
 * - `no_existing_test_removed`: [<names>]     — pre-existing test names still
 *   present in the file.
 * - `min_test_count`: int                     — at least N `test(` /
 *   `it(` / `describe(` calls.
 */
import * as fs from "node:fs";
import * as path from "node:path";

/** One scored check, JSON-identical to the Python dict. */
export interface ScoreCheck {
  name: string;
  ok: boolean;
  reason: string;
}

/** Result of scoring one task. */
export interface ScoreResult {
  passed: boolean;
  checks: ScoreCheck[];
}

/** Inputs to score_task — keyword-only in Python, an options object here. */
export interface ScoreTaskInputs {
  pre_snapshot: Record<string, string>;
  post_snapshot: Record<string, string>;
  clone_root: string;
  transcript: string;
}

function _read(p: string): string {
  // Mirrors Python `path.read_text(errors="replace")`: invalid bytes become
  // U+FFFD; any OSError → "". Node's "utf-8" decode already substitutes
  // U+FFFD for invalid sequences (no throw), matching errors="replace".
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

function _file_changed(
  pre: Record<string, string>,
  post: Record<string, string>,
  rel: string,
): boolean {
  // Mirrors Python `pre.get(rel) != post.get(rel)` — missing key → undefined
  // on both sides, undefined !== undefined is false (treated unchanged), and
  // a present-vs-absent or differing value compares unequal.
  return getOrUndefined(pre, rel) !== getOrUndefined(post, rel);
}

function getOrUndefined(
  d: Record<string, string>,
  key: string,
): string | undefined {
  return Object.prototype.hasOwnProperty.call(d, key) ? d[key] : undefined;
}

/**
 * Translate a Python regex pattern to a JavaScript RegExp with the
 * `re.IGNORECASE | re.MULTILINE` flag pair the Python module always uses.
 *
 * The benchmark corpus patterns are simple character/alternation/anchor
 * patterns (`assert|expect\(|test\(|it\(`, `\btest\s*\(`, …) that are valid
 * in both engines; no Python-only construct is used.
 */
function _compile(pattern: string): RegExp {
  return new RegExp(pattern, "im");
}

function _has_regex(text: string, pattern: string): boolean {
  return _compile(pattern).test(text);
}

function _count_regex(text: string, pattern: string): number {
  // Mirrors Python `len(re.findall(...))` with re.MULTILINE — count of
  // non-overlapping matches. Use a global+multiline+ignorecase RegExp.
  const re = new RegExp(pattern, "gim");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/** Score one task. Returns `{ passed, checks: [{ name, ok, reason }] }`. */
export function score_task(
  task: Record<string, unknown>,
  inputs: ScoreTaskInputs,
): ScoreResult {
  const { pre_snapshot, post_snapshot, clone_root, transcript } = inputs;
  const critRaw = task["success_criteria"];
  const crit: Record<string, unknown> =
    critRaw && typeof critRaw === "object" ? (critRaw as Record<string, unknown>) : {};
  const checks: ScoreCheck[] = [];

  const add = (name: string, ok: boolean, reason = ""): void => {
    checks.push({ name, ok: Boolean(ok), reason });
  };

  // target_file_modified
  const target_modified_path = crit["target_file_modified"];
  if (target_modified_path) {
    const ok = _file_changed(
      pre_snapshot,
      post_snapshot,
      String(target_modified_path),
    );
    add("target_file_modified", ok, `file: ${String(target_modified_path)}`);
  }

  // regex_in_target — uses target_file_modified path, or the new_test_file_exists path
  const regex_target_pattern = crit["regex_in_target"];
  if (regex_target_pattern) {
    const target_rel = String(
      crit["target_file_modified"] || crit["new_test_file_exists"] || "",
    );
    const body = target_rel ? _read(path.join(clone_root, target_rel)) : "";
    const ok = _has_regex(body, String(regex_target_pattern));
    add(
      "regex_in_target",
      ok,
      `pattern=${reprStr(regex_target_pattern)} in ${reprStr(target_rel)}`,
    );
  }

  // regex_in_any
  const regex_any_pattern = crit["regex_in_any"];
  if (regex_any_pattern) {
    const modified_files = Object.keys(post_snapshot).filter((rel) =>
      _file_changed(pre_snapshot, post_snapshot, rel),
    );
    const ok = modified_files.some((rel) =>
      _has_regex(_read(path.join(clone_root, rel)), String(regex_any_pattern)),
    );
    add(
      "regex_in_any",
      ok,
      `pattern=${reprStr(regex_any_pattern)} across ${modified_files.length} modified files`,
    );
  }

  // new_test_file_exists
  const new_test = crit["new_test_file_exists"];
  if (new_test) {
    const newTestStr = String(new_test);
    const ok =
      fs.existsSync(path.join(clone_root, newTestStr)) &&
      !Object.prototype.hasOwnProperty.call(pre_snapshot, newTestStr);
    add("new_test_file_exists", ok, `path=${newTestStr}`);
  }

  // test_assertion_added
  const test_target = crit["test_assertion_added"];
  if (test_target) {
    const body = _read(path.join(clone_root, String(test_target)));
    const ok = _has_regex(body, "assert|expect\\(|test\\(|it\\(");
    add("test_assertion_added", ok, `in ${String(test_target)}`);
  }

  // one_of_files_modified
  const one_of = crit["one_of_files_modified"];
  if (Array.isArray(one_of) && one_of.length > 0) {
    const ok = one_of.some((rel) =>
      _file_changed(pre_snapshot, post_snapshot, String(rel)),
    );
    add("one_of_files_modified", ok, `any of: ${reprList(one_of)}`);
  }

  // preserves_public_api
  const api = crit["preserves_public_api"];
  if (Array.isArray(api) && api.length > 0 && target_modified_path) {
    const body = _read(path.join(clone_root, String(target_modified_path)));
    const missing = api.filter((name) => !body.includes(String(name)));
    add(
      "preserves_public_api",
      missing.length === 0,
      missing.length > 0 ? `missing: ${reprList(missing)}` : "all present",
    );
  }

  // transcript_contains_one_of
  const transcript_one_of = crit["transcript_contains_one_of"];
  if (Array.isArray(transcript_one_of) && transcript_one_of.length > 0) {
    const lt = (transcript || "").toLowerCase();
    const ok = transcript_one_of.some((s) =>
      lt.includes(String(s).toLowerCase()),
    );
    add(
      "transcript_contains_one_of",
      ok,
      `any of: ${reprList(transcript_one_of)}`,
    );
  }

  // no_file_write_before_audit
  const audit_first = crit["no_file_write_before_audit"];
  if (audit_first) {
    const ok = _no_write_before_audit(transcript);
    add(
      "no_file_write_before_audit",
      ok,
      "audit reference precedes any write tool call",
    );
  }

  // no_existing_test_removed
  const keep_tests = crit["no_existing_test_removed"];
  if (Array.isArray(keep_tests) && keep_tests.length > 0 && target_modified_path) {
    const body = _read(path.join(clone_root, String(target_modified_path)));
    const missing = keep_tests.filter((name) => !body.includes(String(name)));
    add(
      "no_existing_test_removed",
      missing.length === 0,
      missing.length > 0 ? `missing: ${reprList(missing)}` : "all present",
    );
  }

  // min_test_count
  const min_tests = crit["min_test_count"];
  if (
    typeof min_tests === "number" &&
    Number.isInteger(min_tests) &&
    min_tests > 0 &&
    (new_test || test_target)
  ) {
    const p = new_test || test_target;
    const body = p ? _read(path.join(clone_root, String(p))) : "";
    const count = _count_regex(
      body,
      "\\btest\\s*\\(|\\bit\\s*\\(|\\bdescribe\\s*\\(",
    );
    add(
      "min_test_count",
      count >= min_tests,
      `found=${count}, required=${min_tests}`,
    );
  }

  const passed = checks.length > 0 && checks.every((c) => c.ok);
  return { passed, checks };
}

/**
 * Best-effort: scan the transcript for any string suggesting an audit
 * reference; require it to appear before any write/edit tool call.
 *
 * Without a structured tool-call log this is a heuristic; the task runner
 * emits a structured `events` list (Phase 4 Step 2) that the scorer can
 * later consume directly when we want a stricter check.
 */
export function _no_write_before_audit(transcript: string): boolean {
  if (!transcript) {
    // Empty transcript = nothing fired = treat as not-failed-yet (will fail other checks)
    return false;
  }
  const lt = transcript.toLowerCase();
  const audit_markers = ["existing-ui-audit", "ui_audit", "audit"];
  const write_markers = ["str-replace-editor", "save-file", "edit(", "write("];
  const audit_idx = _minPresentIndex(lt, audit_markers);
  const write_idx = _minPresentIndex(lt, write_markers);
  if (audit_idx === -1) {
    return false;
  }
  if (write_idx === -1) {
    return true;
  }
  return audit_idx < write_idx;
}

/**
 * Mirror Python `min((lt.find(m) for m in markers if m in lt), default=-1)`:
 * the smallest index among markers that ARE present, or -1 if none present.
 */
function _minPresentIndex(haystack: string, markers: string[]): number {
  let best = -1;
  for (const m of markers) {
    const idx = haystack.indexOf(m);
    if (idx === -1) {
      continue;
    }
    if (best === -1 || idx < best) {
      best = idx;
    }
  }
  return best;
}

/**
 * Mirror Python `repr()` of a string. Python escapes the backslash and the
 * chosen quote, prefers single quotes, and switches to double quotes only when
 * the string contains a `'` but no `"`. The benchmark `reason` strings embed
 * regex patterns (often containing `\`), so the backslash escape is the
 * load-bearing part.
 */
function reprStr(value: unknown): string {
  const s = String(value);
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  const quote = hasSingle && !hasDouble ? '"' : "'";
  let body = "";
  for (const ch of s) {
    if (ch === "\\") {
      body += "\\\\";
    } else if (ch === quote) {
      body += "\\" + ch;
    } else if (ch === "\n") {
      body += "\\n";
    } else if (ch === "\r") {
      body += "\\r";
    } else if (ch === "\t") {
      body += "\\t";
    } else {
      body += ch;
    }
  }
  return `${quote}${body}${quote}`;
}

/** Mirror Python `repr()` of a list of strings: `['a', 'b']`. */
function reprList(items: unknown[]): string {
  return `[${items.map((i) => reprStr(i)).join(", ")}]`;
}
