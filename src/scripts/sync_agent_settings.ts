#!/usr/bin/env node
/**
 * Sync `.agent-settings.yml` against the template + profile (additive merge).
 *
 * Ported from the retired Python `src/scripts/sync_agent_settings.py` (ADR-200).
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
 *     sync_agent_settings --check               # exit 2 if a sync is needed (CI)
 *     sync_agent_settings --profile balanced    # use a specific profile
 *     sync_agent_settings --path path/to/.agent-settings.yml
 *
 * Exit codes:
 *     0 — already in sync, or changes applied (or --dry-run ran cleanly)
 *     2 — under --check, synchronization requires intervention; also invalid
 *         arguments, missing files, and a duplicate-key repair this tool
 *         refuses to perform.
 *
 * `--check` has two diagnostic cases and its stderr line already separates
 * them, because the remedies differ: template drift ("drift detected"), and a
 * duplicate-key repair with no drift ("duplicate keys need collapsing"). Both
 * exit 2 — the target needs a write either way, and a green `--check` over a
 * file the strict reader cannot parse would hide the breakage. A caller that
 * needs the distinction reads the message, not the code.
 *
 * No behaviour changes vs. the retired Python implementation — historical quirks preserved (consumers pin the exact behaviour).
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

/**
 * The comment `mergeIntoTemplate` writes above its appended flat-key block.
 *
 * Duplicated here rather than imported: the writer holds it as a literal in
 * `src/server/io/yamlIO.ts` and exports no constant, and that module belongs
 * to the server tree this CLI does not otherwise depend on. Keep the two in
 * step — a drift makes the sweep below silently stop matching.
 */
const WIZARD_BLOCK_HEADER = '# Wizard-added keys (no template entry)';

/**
 * Drop a wizard-block header the collapse emptied.
 *
 * The non-idempotent writer appended the header AND its keys on every save, so
 * a collapse that removes the later block's key lines leaves that block's
 * header behind with nothing under it — and the next append puts a fresh
 * header below the orphan, one more per save. A header names the keys beneath
 * it; with none beneath it, it names nothing and misleads the next reader.
 *
 * A header counts as emptied only when no key line stands between it and the
 * next header or EOF. Blanks and further comments do not count: a user comment
 * written between the header and its first key is part of the block, not a
 * replacement for it.
 */
function dropOrphanedWizardHeaders(lines: readonly string[]): string[] {
  const drop = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() !== WIZARD_BLOCK_HEADER) continue;
    let hasKey = false;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l === undefined) continue;
      if (l.trim() === WIZARD_BLOCK_HEADER) break;
      if (l.trim() === '' || l.trimStart().startsWith('#')) continue;
      hasKey = true;
      break;
    }
    if (hasKey) continue;
    drop.add(i);
    // The writer emits the blank line above the header as part of the block,
    // so removing the header alone widens the gap by one line per repair.
    if (i > 0 && lines[i - 1]?.trim() === '') drop.add(i - 1);
  }
  return drop.size === 0 ? [...lines] : lines.filter((_, i) => !drop.has(i));
}

export interface DuplicateRepair {
  /** The document with every safely-collapsible duplicate run reduced to one. */
  text: string;
  /** Keys that were collapsed, in first-seen order. */
  collapsed: string[];
  /** Duplicated keys this pass refuses to touch, with the reason. */
  unsafe: string[];
}

/**
 * Collapse duplicate TOP-LEVEL inline-scalar keys, keeping the last value.
 *
 * A strict YAML parser rejects a duplicate mapping key outright, so one such
 * pair takes the whole file — and with it `task sync`, `task release-prepare`
 * and every release — out of service with "Map keys must be unique". The
 * duplicates in the wild were written by `mergeIntoTemplate`, whose flat
 * `a.b: value` append was not idempotent before this change: each wizard save
 * re-appended the entire "Wizard-added keys" block. That writer is fixed, but
 * every file it already corrupted stays unreadable until something repairs
 * it, and a release is the worst moment to discover that.
 *
 * Last-wins is value-neutral, not a guess: a lenient reader already resolved
 * such a run that way, so collapsing changes what the file PARSES as in no
 * way — it only changes whether it parses at all.
 *
 * Deliberately narrow, and the narrowness is what makes last-wins safe. A key
 * is collapsible only when EVERY occurrence in the run is ONE-LINE-ONLY — its
 * value sits on the key's own line and it owns no continuation lines at all.
 * Anything else is reported in `unsafe` and left alone, because dropping the
 * loser of a multi-line pair does not drop its body: the body survives, stops
 * being that key's value, and attaches to whatever line precedes it. That
 * turns a parse error into silent data corruption, which is strictly worse.
 *
 * Refused for that reason: a block key with indented children, a block scalar
 * (`|`, `>`), a flow collection opened on one line and closed on another, and
 * an anchor / alias / tag / merge value, whose meaning depends on which
 * occurrence a reader binds rather than only on the value.
 *
 * A multi-document stream (`---` / `...`) is not repaired either. The reader
 * takes a single document and rejects such a file whatever this pass does, so
 * collapsing across a boundary could only merge two documents' keys into one.
 *
 * When — and only when — something did collapse, a wizard-block header the
 * collapse emptied is removed with it; see `dropOrphanedWizardHeaders`.
 */
export function collapseDuplicateFlatKeys(text: string): DuplicateRepair {
  // Line endings are preserved: splitting on `\n` alone leaves a trailing
  // `\r` on every CRLF line, which the key pattern then never matches — so a
  // CRLF file reported zero duplicates and fell straight into the parse error
  // this pass exists to prevent.
  //
  // The MAJORITY terminator, not "any CRLF present". A mostly-LF file with one
  // stray CRLF line would otherwise be rewritten to CRLF throughout — a whole-
  // file change nobody asked for, on a pass whose entire promise is that it
  // touches only what it must. Matches `sync_yaml_rt.detectEol`.
  const crlfCount = (text.match(/\r\n/g) ?? []).length;
  const lfCount = (text.match(/(^|[^\r])\n/g) ?? []).length;
  const eol = crlfCount > lfCount ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);

  // A document separator anywhere means more than one document may be in play.
  if (lines.some((l) => /^(---|\.\.\.)\s*$/.test(l))) {
    return { text, collapsed: [], unsafe: [] };
  }

  // A mapping key ends at a colon FOLLOWED BY SPACE OR END OF LINE — YAML's
  // own plain-scalar rule. Stopping at the first colon instead reads `a:b: 1`
  // as the key `a`, so a file carrying both `a:b:` and `a:` saw two `a` heads
  // and collapsed them: the `a:b` entry vanished and the result parsed
  // cleanly, so nothing downstream could notice. `sync_yaml_rt`'s own
  // tokeniser already had this right; the two disagreeing was the defect.
  //
  // The value is captured with `[\s\S]` rather than `.`, which does not match
  // a lone `\r`. A line holding one (a value like `"x\ry"`) was not recognised
  // as a head at all, so a duplicate of it stayed invisible and the parse
  // error this pass exists to remove survived untouched.
  const HEAD_RE = /^([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*:(?=[ \t]|$)([\s\S]*)$/;

  /** Top-level key lines, in order. */
  const heads: { key: string; at: number; rest: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    // Top level only — an indented `a.b:` is somebody else's child key.
    if (line.length !== line.trimStart().length) continue;
    const m = HEAD_RE.exec(line);
    if (m === null) continue;
    heads.push({ key: m[1] as string, at: i, rest: (m[2] as string).trim() });
  }

  /**
   * Why this key may NOT be collapsed, or null when it may.
   *
   * Collapsing is safe only for a key that occupies exactly its own line: its
   * value is a plain inline scalar and nothing between here and the next
   * top-level key belongs to it. Everything else keeps its real reason, so the
   * refusal message names what actually blocked it rather than asserting
   * "different children" over a null, an anchor or a block scalar.
   */
  const blocker = (h: { at: number; rest: string }, nextAt: number): string | null => {
    const v = h.rest;
    if (v === '' || v.startsWith('#')) return 'a block key or a null value';
    if (/^[|>]/.test(v)) return 'a block scalar';
    // An anchor, alias or tag ANYWHERE in the value, not merely at its start:
    // `a: [&x 1]` fits on one line, and dropping it deletes an anchor that an
    // alias on some other line binds to — turning a duplicate-key error into
    // an unresolved-alias error. Token position only, so `a&b` in a plain
    // scalar is left alone.
    if (/(^|[\s[{,])[&*!]/.test(v)) return 'an anchor, alias or tag';
    // A flow collection must open and close on this line.
    const opens = (v.match(/[[{]/g) ?? []).length;
    const closes = (v.match(/[\]}]/g) ?? []).length;
    if (opens !== closes) return 'a flow collection spanning lines';
    for (let i = h.at + 1; i < nextAt; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      if (line.trim() === '') continue;
      if (line.trimStart().startsWith('#')) continue;
      return 'a value spanning more than its own line';
    }
    return null;
  };

  const solo = new Set<number>();
  const why = new Map<number, string>();
  for (let n = 0; n < heads.length; n++) {
    const h = heads[n] as { key: string; at: number; rest: string };
    const nextAt = n + 1 < heads.length ? (heads[n + 1] as { at: number }).at : lines.length;
    const reason = blocker(h, nextAt);
    if (reason === null) solo.add(h.at);
    else why.set(h.at, reason);
  }

  const seen = new Map<string, number[]>();
  for (const h of heads) {
    const at = seen.get(h.key);
    if (at === undefined) seen.set(h.key, [h.at]);
    else at.push(h.at);
  }

  const collapsed: string[] = [];
  const unsafe: string[] = [];
  const drop = new Set<number>();
  for (const [key, hits] of seen) {
    if (hits.length < 2) continue;
    if (!hits.every((i) => solo.has(i))) {
      const reason = hits.map((i) => why.get(i)).find((r) => r !== undefined) ?? 'not a plain one-line value';
      unsafe.push(`${key} — ${reason}`);
      continue;
    }
    collapsed.push(key);
    // Keep the LAST occurrence's value at the FIRST occurrence's position, so
    // the surrounding comments stay attached to the line they document.
    lines[hits[0] as number] = lines[hits[hits.length - 1] as number] as string;
    for (let i = 1; i < hits.length; i++) drop.add(hits[i] as number);
  }

  // Duplicates this pass cannot even SEE, reported rather than skipped.
  //
  // `HEAD_RE` recognises the key shapes the repair understands. A key starting
  // with a digit (`2fa.on`) or a quoted key (`"a:b"`) matches nothing, so a
  // file duplicating one used to come back with zero collapses AND zero
  // refusals — and then died on the strict parse with the same opaque "Map keys
  // must be unique" the whole repair exists to remove, giving the operator no
  // hint that their key was the part being skipped. Shipping a repair pass
  // creates the expectation that it either fixes the file or says why it
  // cannot; silence is neither.
  //
  // Detection only. These keys are never collapsed — the shapes are exactly the
  // ones whose tokenisation this pass does not model, which is why it declines
  // to rewrite them.
  const loose = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (line.length !== line.trimStart().length) continue;
    if (HEAD_RE.test(line)) continue;
    const m = /^("[^"]*"|'[^']*'|[^\s:#][^:]*?)[ \t]*:(?=[ \t]|$)/.exec(line);
    if (m === null) continue;
    const key = m[1] as string;
    loose.set(key, (loose.get(key) ?? 0) + 1);
  }
  for (const [key, count] of loose) {
    if (count < 2) continue;
    unsafe.push(`${key} — a key shape this repair does not model (quoted, or not starting with a letter)`);
  }

  if (collapsed.length === 0) {
    return { text, collapsed, unsafe };
  }
  const kept = dropOrphanedWizardHeaders(lines.filter((_, i) => !drop.has(i)));
  return { text: kept.join(eol), collapsed, unsafe };
}

/**
 * The parse error an input still carries once its duplicate keys are excused,
 * or null when the duplicates were its only problem.
 *
 * `uniqueKeys: false` is what excuses them: the duplicate-key rejection is the
 * single error the collapse has a mandate to remove, so anything the parser
 * still raises is an error the collapse was never licensed to touch.
 */
function residualParseError(text: string): Error | null {
  try {
    parseYaml(text, { version: '1.1', uniqueKeys: false });
    return null;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * What the parser reliably exposes about a failure, as one indented block.
 *
 * Available on every `YAMLParseError` observed from this parser: `message`,
 * whose first line already carries `at line L, column C` plus the detail, and
 * `code`, a stable identifier. `linePos` is populated too, but only while
 * `prettyErrors` stays on (the library's own condition), so it is printed when
 * present and never relied on. Nothing here is asserted beyond the parser's
 * own first message line, which is derived in the test rather than hardcoded —
 * pinning a format this module does not own would make a safety test fail on a
 * dependency's wording change.
 */
function formatParserDetail(err: Error): string {
  const first = err.message.split('\n')[0] ?? err.message;
  const parts: string[] = [`    ${first}`];
  const code = (err as { code?: unknown }).code;
  const linePos = (err as { linePos?: { line: number; col: number }[] }).linePos;
  const at = linePos?.[0];
  if (typeof code === 'string' && at !== undefined) {
    parts.push(`    (${code} at line ${at.line}, column ${at.col})`);
  } else if (typeof code === 'string') {
    parts.push(`    (${code})`);
  }
  return parts.join('\n') + '\n';
}

function loadUserText(raw: string): Record<string, unknown> {
  const data = parseYaml(raw, { version: '1.1' });
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

  // Repair BEFORE the first parse. A duplicate mapping key makes the whole
  // file unreadable, so without this the run dies here and takes the release
  // with it — see `collapseDuplicateFlatKeys` for why last-wins is safe.
  const rawText = isFile(target) ? fs.readFileSync(target, 'utf-8') : '';
  const repair = collapseDuplicateFlatKeys(rawText);
  if (repair.unsafe.length > 0) {
    // Each entry carries the reason that key was refused. A single blanket
    // sentence used to claim "different children" for every refusal — over a
    // null value, a block scalar or an anchor that has none — which sends the
    // reader looking for children to merge that are not there.
    process.stderr.write(
      `error: ${target} has duplicate mapping keys this tool will not collapse:\n` +
        repair.unsafe.map((u) => `  - ${u}\n`).join('') +
        `Keeping one occurrence would change what the file means. Merge them by hand, then re-run.\n`,
    );
    return 2;
  }
  if (repair.collapsed.length > 0) {
    // Refuse before anything else in this branch, including the notice below:
    // in write mode that notice is past tense ("collapsed …"), so announcing
    // it and then refusing describes a write that never happened.
    //
    // The collapse's safety rests on preserving the original's last-wins
    // reading, and a document that is invalid for some FURTHER reason has no
    // reading to preserve — the pass can then emit valid YAML carrying
    // structure nobody authored, which every downstream check accepts. A
    // stderr warning (what this branch used to do) is a weak control against a
    // silent outcome; a refusal is loud and the operator can still recover.
    // AI council, 2026-09-11, 2 of 2 seats, converged — including a rejection
    // of any `--repair-anyway` escape: an operator who understands the file
    // well enough to use it understands it well enough to fix the error first,
    // and "read the diff" is not a trustworthy oracle for YAML semantics.
    //
    // Exit 2, per the taxonomy in this file's header: 2 is "this tool cannot
    // proceed with this input", which is also what the sibling refusal above
    // (duplicates it will not collapse) returns. 1 is spoken for — it is the
    // mirrored `install.fail` exit and means a broken install asset.
    //
    // Nothing durable precedes this point: the only write in `main` is the
    // single `writeFileSync` at the end, there is no temporary file and no
    // rename, so the refusal leaves the target byte-for-byte unchanged.
    const residual = residualParseError(rawText);
    if (residual !== null) {
      process.stderr.write(
        `❌  ${target}: refusing the automatic duplicate repair — the file has ` +
          `another YAML error besides its duplicate keys.\n` +
          formatParserDetail(residual) +
          `    Collapsing changes only WHETHER a file parses, never what it parses as, ` +
          `and that promise is empty over a document with no valid reading.\n` +
          `    Fix the syntax error by hand, then re-run to apply the duplicate repair.\n`,
      );
      return 2;
    }

    // NOT gated on --quiet, and not on stdout. Both callers that matter run
    // quiet — the release's `sync-agent-settings` step and the pre-release
    // probe — so gating this would let a release rewrite the operator's own
    // settings file with no trace. `--quiet` suppresses routine success
    // chatter; "I modified your file" is not that.
    //
    // The tense follows the mode. `--check` and `--dry-run` never write, so
    // announcing a completed collapse there describes a write that did not
    // happen — and the pre-release probe runs `--dry-run`, which made that the
    // FIRST thing an operator saw on every release with a corrupted file.
    const writes = !args.check && !args.dry_run;
    const verb = writes
      ? `collapsed ${repair.collapsed.length} duplicate key(s), last value kept`
      : `would collapse ${repair.collapsed.length} duplicate key(s), keeping the last value (no write in this mode)`;
    process.stderr.write(`🔧  ${target}: ${verb} — ${repair.collapsed.join(', ')}\n`);
  }
  const sourceText = repair.text;

  let profile: string;
  let templateBody: string;
  try {
    const userData = loadUserText(sourceText);
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

  // The merge reads the REPAIRED text; every "did anything change" decision
  // below compares against `rawText`, what is actually on disk. Comparing
  // against the repaired text instead would report "already in sync" on a
  // file whose collapse never reached disk — the repair would run on every
  // invocation and fix nothing.
  const existingText = sourceText;

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

  if (newText === rawText) {
    if (!args.quiet) {
      process.stdout.write(`✅  ${target}: already in sync (profile=${profile})\n`);
    }
    return 0;
  }

  if (args.check) {
    const diff = renderDiff(rawText, newText, String(target));
    process.stdout.write(diff);
    // Name WHICH problem, because the two have different remedies and a CI job
    // reading only "drift detected" cannot tell them apart. A repair-only diff
    // means the file is corrupt, not out of step with the template; the
    // discriminator is whether the merge changed anything beyond the collapse.
    //
    // Still exit 2 in both cases: the file needs a write either way, and a
    // `--check` that returned 0 over a file the reader cannot parse would hide
    // exactly the breakage this whole change exists to surface.
    const repairOnly = repair.collapsed.length > 0 && newText === sourceText;
    process.stderr.write(
      repairOnly
        ? `\n❌  ${target}: duplicate keys need collapsing — no template drift (profile=${profile})\n` +
            `    Run \`sync_agent_settings\` without --check to apply the repair.\n`
        : `\n❌  ${target}: drift detected (profile=${profile})\n`,
    );
    return 2;
  }

  if (args.dry_run) {
    const diff = renderDiff(rawText, newText, String(target));
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

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
  process.exit(main());
}
