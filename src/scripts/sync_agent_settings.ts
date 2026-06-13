#!/usr/bin/env node
/**
 * Sync `.agent-settings.yml` against the template + profile (additive merge).
 *
 * TypeScript twin of `src/scripts/sync_agent_settings.py` (ADR-092).
 * Applies the section-aware merge rules documented in
 * `docs/guidelines/agent-infra/layered-settings.md`:
 *
 *  - **User lines are preserved verbatim** — comments, quoting, and key
 *    order survive every sync. Existing values, custom inline comments,
 *    and user-chosen ordering are never modified.
 *  - Missing template keys are inserted (leaf into existing parent
 *    section, full subtree at EOF for entirely missing top-level
 *    sections).
 *  - Top-level user-only sections (no home in the template) are moved to
 *    a single-level `_user:` block at the end of the file.
 *  - The `_user:` block is single-level only — legacy multi-prefix
 *    corruption (`_user._user.foo`) heals to `foo` on the next sync.
 *  - Template comment changes on already-existing user keys do **not**
 *    propagate (existing line untouched is the deal).
 *
 * Idempotent — writing a file that is already in sync is a no-op.
 *
 * Usage:
 *     sync_agent_settings                       # write (default)
 *     sync_agent_settings --dry-run             # show diff, no write
 *     sync_agent_settings --check               # exit 2 on drift (for CI)
 *     sync_agent_settings --profile balanced    # use a specific profile
 *     sync_agent_settings --path path/to/.agent-settings.yml
 *
 * Exit codes:
 *     0 — already in sync, or changes applied (or --dry-run ran cleanly)
 *     2 — drift detected under --check, or invalid arguments / missing files
 *
 * No behaviour changes vs. the Python original — latent bugs replicated.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml, YAMLParseError } from 'yaml';

import { sync as rtSync } from './sync_yaml_rt.js';

const _HERE = fileURLToPath(import.meta.url);
const _SCRIPT_DIR = path.dirname(_HERE);

// --- Mirror of the three install helpers consumed by the Python module ---
// `sync_agent_settings.py` imports `_parse_profile_ini`, `_render_template`,
// `_resolve_settings_read`, and `SUPPORTED_PROFILES` from `install`. No
// `install.ts` twin exists yet, so the small, stable helpers are mirrored
// here verbatim (same behaviour, same error text / exit code).

const SUPPORTED_PROFILES = ['minimal', 'balanced', 'full'] as const;

const SETTINGS_FILE = '.agent-settings.yml';
// Canonical project settings live under agents/settings/ (ADR-038); the
// repo-root file is a back-compat read-fallback.
const SETTINGS_SUBDIR = ['agents', 'settings'] as const;

const _PLACEHOLDER_RE = /__[A-Z][A-Z0-9_]*__/g;

/** Signal that `fail()` was called — carries the exit code (1). */
class FailExit extends Error {
  readonly code: number;
  constructor(message: string, code = 1) {
    super(message);
    this.name = 'FailExit';
    this.code = code;
  }
}

/** Mirror of `install.fail` — prints the diagnostic block, exits 1. */
function fail(msg: string): never {
  process.stderr.write(`  ❌  ${msg}\n`);
  process.stderr.write(
    '      Diagnose: `./agent-config doctor` ' + '(or `--check <id>` for a single category)\n',
  );
  throw new FailExit(msg, 1);
}

/** Mirror of `install._canonical_settings_target`. */
function canonicalSettingsTarget(projectRoot: string): string {
  return path.join(projectRoot, ...SETTINGS_SUBDIR, SETTINGS_FILE);
}

/**
 * Mirror of `install._resolve_settings_read`: canonical if present, else
 * legacy repo-root file if present, else canonical.
 */
function resolveSettingsRead(projectRoot: string): string {
  const canonical = canonicalSettingsTarget(projectRoot);
  if (fs.existsSync(canonical)) {
    return canonical;
  }
  const legacy = path.join(projectRoot, SETTINGS_FILE);
  if (fs.existsSync(legacy)) {
    return legacy;
  }
  return canonical;
}

/** Mirror of `install._parse_profile_ini`. */
function parseProfileIni(p: string): Record<string, string> {
  const values: Record<string, string> = {};
  const text = fs.readFileSync(p, 'utf-8');
  for (const raw of splitLinesPy(text)) {
    const line = raw.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }
    if (!line.includes('=')) {
      continue;
    }
    const eq = line.indexOf('=');
    const key = line.slice(0, eq);
    const val = line.slice(eq + 1);
    values[key.trim()] = val.trim();
  }
  return values;
}

/**
 * Mirror of `install._render_template`: substitute `__UPPER_KEY__`
 * placeholders using ini values. Each ini key `foo_bar` maps to the
 * `__FOO_BAR__` placeholder. Fails if any placeholder remains unfilled.
 */
function renderTemplate(template: string, profileValues: Record<string, string>): string {
  let body = template;
  for (const [key, value] of Object.entries(profileValues)) {
    const placeholder = `__${key.toUpperCase()}__`;
    if (body.includes(placeholder)) {
      body = body.split(placeholder).join(value);
    }
  }
  const leftover = Array.from(new Set(body.match(_PLACEHOLDER_RE) ?? [])).sort();
  if (leftover.length > 0) {
    fail('Template has unfilled placeholders after profile render: ' + leftover.join(', '));
  }
  return body;
}

/** Python `str.splitlines()` over the simple cases used here (no keepends). */
function splitLinesPy(text: string): string[] {
  if (text === '') {
    return [];
  }
  // Python splitlines treats the final terminator as not producing a
  // trailing empty element; split on \r\n | \n | \r.
  const out = text.split(/\r\n|\n|\r/);
  if (out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }
  return out;
}

// --- difflib.unified_diff port (matches Python `render_diff`) -------------
// `render_diff` calls `difflib.unified_diff` with default lineterm ("\n"),
// keepends=True input lines, and n=3. The header/hunk lines therefore carry
// a trailing "\n"; body lines carry their own terminator from the input.

interface OpCode {
  tag: 'replace' | 'delete' | 'insert' | 'equal';
  i1: number;
  i2: number;
  j1: number;
  j2: number;
}

function unifiedDiff(
  a: readonly string[],
  b: readonly string[],
  fromfile: string,
  tofile: string,
  lineterm: string,
  n = 3,
): string[] {
  const out: string[] = [];
  let started = false;
  const sm = new SequenceMatcher(a, b);
  for (const group of sm.get_grouped_opcodes(n)) {
    if (!started) {
      started = true;
      out.push(`--- ${fromfile}${lineterm}`);
      out.push(`+++ ${tofile}${lineterm}`);
    }
    const first = group[0] as OpCode;
    const last = group[group.length - 1] as OpCode;
    const file1Range = formatRangeUnified(first.i1, last.i2);
    const file2Range = formatRangeUnified(first.j1, last.j2);
    out.push(`@@ -${file1Range} +${file2Range} @@${lineterm}`);
    for (const op of group) {
      if (op.tag === 'equal') {
        for (const line of a.slice(op.i1, op.i2)) {
          out.push(' ' + line);
        }
        continue;
      }
      if (op.tag === 'replace' || op.tag === 'delete') {
        for (const line of a.slice(op.i1, op.i2)) {
          out.push('-' + line);
        }
      }
      if (op.tag === 'replace' || op.tag === 'insert') {
        for (const line of b.slice(op.j1, op.j2)) {
          out.push('+' + line);
        }
      }
    }
  }
  return out;
}

function formatRangeUnified(start: number, stop: number): string {
  let beginning = start + 1; // lines start numbering with one
  const length = stop - start;
  if (length === 1) {
    return `${beginning}`;
  }
  if (length === 0) {
    beginning -= 1; // empty ranges begin at line just before the range
  }
  return `${beginning},${length}`;
}

/**
 * Minimal SequenceMatcher port sufficient for difflib.unified_diff:
 * get_opcodes + get_grouped_opcodes. Identical recursion to CPython's
 * algorithm (junk disabled).
 */
class SequenceMatcher {
  private a: readonly string[];
  private b: readonly string[];
  private b2j: Map<string, number[]>;

  constructor(a: readonly string[], b: readonly string[]) {
    this.a = a;
    this.b = b;
    this.b2j = new Map();
    this._chain_b();
  }

  private _chain_b(): void {
    this.b2j.clear();
    for (let i = 0; i < this.b.length; i++) {
      const elt = this.b[i] as string;
      const arr = this.b2j.get(elt);
      if (arr) {
        arr.push(i);
      } else {
        this.b2j.set(elt, [i]);
      }
    }
    // autojunk: CPython pops elements appearing > 1% when len(b) >= 200.
    const n = this.b.length;
    if (n >= 200) {
      const ntest = Math.floor(n / 100) + 1;
      for (const [elt, idxs] of [...this.b2j.entries()]) {
        if (idxs.length > ntest) {
          this.b2j.delete(elt);
        }
      }
    }
  }

  find_longest_match(alo: number, ahi: number, blo: number, bhi: number): [number, number, number] {
    const a = this.a;
    const b2j = this.b2j;
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;
    let j2len: Map<number, number> = new Map();
    for (let i = alo; i < ahi; i++) {
      const newj2len: Map<number, number> = new Map();
      const indices = b2j.get(a[i] as string) ?? [];
      for (const j of indices) {
        if (j < blo) {
          continue;
        }
        if (j >= bhi) {
          break;
        }
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
      j2len = newj2len;
    }
    while (besti > alo && bestj > blo && a[besti - 1] === this.b[bestj - 1]) {
      besti -= 1;
      bestj -= 1;
      bestsize += 1;
    }
    while (
      besti + bestsize < ahi &&
      bestj + bestsize < bhi &&
      a[besti + bestsize] === this.b[bestj + bestsize]
    ) {
      bestsize += 1;
    }
    return [besti, bestj, bestsize];
  }

  get_matching_blocks(): Array<[number, number, number]> {
    const la = this.a.length;
    const lb = this.b.length;
    const queue: Array<[number, number, number, number]> = [[0, la, 0, lb]];
    const matchingBlocks: Array<[number, number, number]> = [];
    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
      const [i, j, k] = this.find_longest_match(alo, ahi, blo, bhi);
      if (k) {
        matchingBlocks.push([i, j, k]);
        if (alo < i && blo < j) {
          queue.push([alo, i, blo, j]);
        }
        if (i + k < ahi && j + k < bhi) {
          queue.push([i + k, ahi, j + k, bhi]);
        }
      }
    }
    matchingBlocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
    let i1 = 0;
    let j1 = 0;
    let k1 = 0;
    const nonAdjacent: Array<[number, number, number]> = [];
    for (const [i2, j2, k2] of matchingBlocks) {
      if (i1 + k1 === i2 && j1 + k1 === j2) {
        k1 += k2;
      } else {
        if (k1) {
          nonAdjacent.push([i1, j1, k1]);
        }
        i1 = i2;
        j1 = j2;
        k1 = k2;
      }
    }
    if (k1) {
      nonAdjacent.push([i1, j1, k1]);
    }
    nonAdjacent.push([la, lb, 0]);
    return nonAdjacent;
  }

  get_opcodes(): OpCode[] {
    let i = 0;
    let j = 0;
    const answer: OpCode[] = [];
    for (const [ai, bj, size] of this.get_matching_blocks()) {
      let tag: OpCode['tag'] | '' = '';
      if (i < ai && j < bj) {
        tag = 'replace';
      } else if (i < ai) {
        tag = 'delete';
      } else if (j < bj) {
        tag = 'insert';
      }
      if (tag) {
        answer.push({ tag, i1: i, i2: ai, j1: j, j2: bj });
      }
      i = ai + size;
      j = bj + size;
      if (size) {
        answer.push({ tag: 'equal', i1: ai, i2: i, j1: bj, j2: j });
      }
    }
    return answer;
  }

  get_grouped_opcodes(n = 3): OpCode[][] {
    let codes = this.get_opcodes();
    if (codes.length === 0) {
      codes = [{ tag: 'equal', i1: 0, i2: 1, j1: 0, j2: 1 }];
    }
    // Fixup leading and trailing groups if they show no changes.
    const first = codes[0] as OpCode;
    if (first.tag === 'equal') {
      codes[0] = {
        tag: first.tag,
        i1: Math.max(first.i1, first.i2 - n),
        i2: first.i2,
        j1: Math.max(first.j1, first.j2 - n),
        j2: first.j2,
      };
    }
    const lastIdx = codes.length - 1;
    const last = codes[lastIdx] as OpCode;
    if (last.tag === 'equal') {
      codes[lastIdx] = {
        tag: last.tag,
        i1: last.i1,
        i2: Math.min(last.i2, last.i1 + n),
        j1: last.j1,
        j2: Math.min(last.j2, last.j1 + n),
      };
    }
    const nn = n + n;
    const groups: OpCode[][] = [];
    let group: OpCode[] = [];
    for (const code of codes) {
      let { i1, i2, j1, j2 } = code;
      const tag = code.tag;
      // End the current group and start a new one whenever there is a
      // large range with no changes.
      if (tag === 'equal' && i2 - i1 > nn) {
        group.push({ tag, i1, i2: Math.min(i2, i1 + n), j1, j2: Math.min(j2, j1 + n) });
        groups.push(group);
        group = [];
        i1 = Math.max(i1, i2 - n);
        j1 = Math.max(j1, j2 - n);
      }
      group.push({ tag, i1, i2, j1, j2 });
    }
    if (group.length > 0 && !(group.length === 1 && (group[0] as OpCode).tag === 'equal')) {
      groups.push(group);
    }
    return groups;
  }
}

// --- module-level helpers (mirror the Python functions) -------------------

function loadProfile(profileDir: string, profile: string): Record<string, string> {
  const profileSource = path.join(profileDir, `${profile}.ini`);
  if (!isFile(profileSource)) {
    throw new FileNotFoundError(`profile not found: ${profileSource}`);
  }
  return parseProfileIni(profileSource);
}

function loadTemplate(p: string, profileValues: Record<string, string>): string {
  if (!isFile(p)) {
    throw new FileNotFoundError(`template not found: ${p}`);
  }
  return renderTemplate(fs.readFileSync(p, 'utf-8'), profileValues);
}

function loadUser(p: string): Record<string, unknown> {
  if (!isFile(p)) {
    return {};
  }
  const data = parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
  if (data === null || data === undefined) {
    return {};
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data as Record<string, unknown>;
}

function renderDiff(oldText: string, newText: string, p: string): string {
  return unifiedDiff(
    splitlinesKeepends(oldText),
    splitlinesKeepends(newText),
    p,
    p,
    '\n',
    3,
  ).join('');
}

/** Python `str.splitlines(keepends=True)` for `\n` / `\r\n` / `\r`. */
function splitlinesKeepends(text: string): string[] {
  if (text === '') {
    return [];
  }
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        out.push(text.slice(start, i + 2));
        start = i + 2;
        i++;
      } else {
        out.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  if (start < text.length) {
    out.push(text.slice(start));
  }
  return out;
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Raised by the load* helpers; caught in `main` to return exit code 2. */
class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

// --- Argument parsing (mirrors the argparse surface) ----------------------

interface Args {
  path: string | null;
  template: string;
  profile: string | null;
  profile_dir: string;
  dry_run: boolean;
  check: boolean;
  quiet: boolean;
}

const DEFAULT_TEMPLATE = path.join(_SCRIPT_DIR, '..', '..', 'src', 'config', 'agent-settings.template.yml');
const DEFAULT_PROFILE_DIR = path.join(_SCRIPT_DIR, '..', '..', 'src', 'config', 'profiles');

/**
 * Parse argv. Returns the populated `Args` or, on an argparse-style error
 * (unknown flag / missing value / unexpected positional), prints a usage
 * line to stderr and signals exit code 2 via `ArgParseExit`.
 */
class ArgParseExit extends Error {
  readonly code: number;
  constructor(code: number) {
    super(`argparse exit ${code}`);
    this.name = 'ArgParseExit';
    this.code = code;
  }
}

function argError(message: string): never {
  process.stderr.write(`usage: sync_agent_settings [-h] [--path PATH] [--template TEMPLATE]\n`);
  process.stderr.write(`sync_agent_settings: error: ${message}\n`);
  throw new ArgParseExit(2);
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    path: null,
    template: DEFAULT_TEMPLATE,
    profile: null,
    profile_dir: DEFAULT_PROFILE_DIR,
    dry_run: false,
    check: false,
    quiet: false,
  };
  const valueFlags = new Set(['--path', '--template', '--profile', '--profile-dir']);
  const boolFlags = new Set(['--dry-run', '--check', '--quiet']);
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i] as string;
    if (tok === '-h' || tok === '--help') {
      // --help is not a parity contract; argparse would print help + exit 0.
      throw new ArgParseExit(0);
    }
    let flag = tok;
    let inlineValue: string | null = null;
    const eq = tok.indexOf('=');
    if (tok.startsWith('--') && eq !== -1) {
      flag = tok.slice(0, eq);
      inlineValue = tok.slice(eq + 1);
    }
    if (valueFlags.has(flag)) {
      let value: string;
      if (inlineValue !== null) {
        value = inlineValue;
      } else {
        const next = argv[i + 1];
        if (next === undefined) {
          argError(`argument ${flag}: expected one argument`);
        }
        value = next;
        i++;
      }
      if (flag === '--path') args.path = value;
      else if (flag === '--template') args.template = value;
      else if (flag === '--profile') args.profile = value;
      else if (flag === '--profile-dir') args.profile_dir = value;
    } else if (boolFlags.has(flag)) {
      if (inlineValue !== null) {
        argError(`argument ${flag}: ignored explicit argument ${pyReprStr(inlineValue)}`);
      }
      if (flag === '--dry-run') args.dry_run = true;
      else if (flag === '--check') args.check = true;
      else if (flag === '--quiet') args.quiet = true;
    } else if (tok.startsWith('-')) {
      argError(`unrecognized arguments: ${tok}`);
    } else {
      argError(`unrecognized arguments: ${tok}`);
    }
  }
  return args;
}

function pyReprStr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Python truthiness for the values a parsed-YAML scalar can hold. */
function pyTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false) {
    return false;
  }
  if (v === 0 || v === '') {
    return false;
  }
  if (Array.isArray(v)) {
    return v.length > 0;
  }
  if (typeof v === 'object') {
    return Object.keys(v).length > 0;
  }
  return true;
}

/** Python `str(x)` for the scalar values a YAML user_type field can hold. */
function pyStr(v: unknown): string {
  if (v === true) {
    return 'True';
  }
  if (v === false) {
    return 'False';
  }
  if (v === null || v === undefined) {
    return 'None';
  }
  return String(v);
}

// --- main ----------------------------------------------------------------

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (err instanceof ArgParseExit) {
      return err.code;
    }
    throw err;
  }

  const target = args.path !== null ? args.path : resolveSettingsRead(process.cwd());
  const templatePath = args.template;
  const profileDir = args.profile_dir;

  let profile: string;
  let templateBody: string;
  try {
    const userData = loadUser(target);
    const personalRaw = userData['personal'];
    const personal =
      personalRaw !== null && typeof personalRaw === 'object' && !Array.isArray(personalRaw)
        ? (personalRaw as Record<string, unknown>)
        : {};
    // Python: `args.profile or str(rule_loading_tier or cost_profile or "minimal")`.
    if (args.profile !== null) {
      profile = args.profile;
    } else {
      const rlt = userData['rule_loading_tier'];
      const cp = userData['cost_profile'];
      const chosen = pyTruthy(rlt) ? rlt : pyTruthy(cp) ? cp : 'minimal';
      profile = pyStr(chosen);
    }
    if (!(SUPPORTED_PROFILES as readonly string[]).includes(profile)) {
      process.stderr.write(`error: unsupported profile ${pyReprStr(profile)}\n`);
      return 2;
    }
    const profileValues = loadProfile(profileDir, profile);
    // Preserve existing user_type (step-9 axis) so the template's
    // __USER_TYPE__ placeholder renders without forcing the user to
    // re-pass --user-type on every sync. Empty string = no filter.
    // Python: `str(personal.get("user_type") or "") if personal else ""`.
    let existingUserType = '';
    if (Object.keys(personal).length > 0) {
      const userTypeRaw = personal['user_type'];
      // `x or ""` — falsy values (None/undefined, empty, 0, false) → "".
      existingUserType = pyTruthy(userTypeRaw) ? pyStr(userTypeRaw) : '';
    }
    profileValues['user_type'] = existingUserType;
    templateBody = loadTemplate(templatePath, profileValues);
  } catch (err) {
    if (err instanceof FileNotFoundError) {
      process.stderr.write(`error: ${err.message}\n`);
      return 2;
    }
    if (err instanceof YAMLParseError) {
      process.stderr.write(`error: cannot parse ${target}: ${err.message}\n`);
      return 2;
    }
    if (err instanceof FailExit) {
      // `fail()` already printed the diagnostic block; mirror sys.exit(1).
      return err.code;
    }
    throw err;
  }

  const existingText = isFile(target) ? fs.readFileSync(target, 'utf-8') : '';

  let newText: string;
  if (existingText) {
    // Additive merge — preserves user lines verbatim, inserts only the
    // template keys the user is missing.
    try {
      newText = rtSync(existingText, templateBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: cannot parse ${target}: ${msg}\n`);
      return 2;
    }
  } else {
    // First-run / file absent — write the rendered template as-is.
    newText = templateBody;
  }

  if (newText === existingText) {
    if (!args.quiet) {
      process.stdout.write(`✅  ${target}: already in sync (profile=${profile})\n`);
    }
    return 0;
  }

  if (args.check) {
    const diff = renderDiff(existingText, newText, String(target));
    process.stdout.write(diff);
    process.stderr.write(`\n❌  ${target}: drift detected (profile=${profile})\n`);
    return 2;
  }

  if (args.dry_run) {
    const diff = renderDiff(existingText, newText, String(target));
    process.stdout.write(diff);
    if (!args.quiet) {
      process.stderr.write(`\n(dry-run) would update ${target} (profile=${profile})\n`);
    }
    return 0;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, newText, 'utf-8');
  if (!args.quiet) {
    process.stdout.write(`✅  ${target}: updated (profile=${profile})\n`);
  }
  return 0;
}

const _isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
  process.exit(main());
}
