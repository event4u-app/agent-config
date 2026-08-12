#!/usr/bin/env tsx
/**
 * report_skill_activation.ts — the census that answers "are the skills used?"
 * by showing why the question cannot currently be answered as a rate.
 *
 * Executes round-6 Phase 3.1. Advisory: **it gates on nothing**, has no
 * threshold, and must not acquire one — for the same reason
 * `report_imperative_density` must not, plus one specific to this surface.
 *
 * WHY THIS IS NOT PART OF `conformance_scan`
 * ------------------------------------------
 * The conformance scan carries a binding constraint adopted verbatim from the
 * round-1 council: it may measure ONLY classes that have a mechanism, because
 * "a conformance scan that checks un-mechanised rules is theatre". Skill
 * activation has no mechanism at all — there is no runtime router, and nothing
 * observes whether a skill that should have fired did. Putting these numbers in
 * the scan would read as enforcement. They belong in a census that says what it
 * is.
 *
 * WHAT THE ROUND-6 PASS MEASURED, AND WHY THE SHAPE INVERTED
 * ----------------------------------------------------------
 * Usage, across 59 sessions and 33,618 assistant turns in three stores: **31
 * Skill invocations, 6 distinct skills of 288 shipped (2.1%)**. Five of the six
 * are slash-commands the human typed; one looks agent-initiated.
 *
 * The first draft of the round-6 phase planned a missed-activation detector
 * keyed on "a skill's own frontmatter triggers". There are none: 0 of 288 skills
 * carry a `triggers:` key. Matching the `description:` prose instead is the
 * FC-8-shaped prose-matching the same phase forbids. So a rate is not available
 * and the census is the finding — which is why this file prints counts and an
 * explicit unmeasurable verdict rather than a percentage that would look like an
 * answer.
 *
 * THE GAP THIS SCRIPT CANNOT CLOSE, STATED SO NOBODY READS IT AS COVERED
 * ---------------------------------------------------------------------
 * The strongest candidate cause is a delivery defect: in an observed session the
 * host's injected skill catalogue carried descriptions for roughly the first
 * forty entries and BARE NAMES thereafter, and a bare `- flux` carries no
 * activation signal at all. That is a single-session observation, not a
 * measurement, because the injected catalogue is **not persisted in the
 * transcript** — grep for it across the store and it is absent. So this script
 * prints the hypothesis and its falsifier instead of a number: capture the
 * catalogue deliberately (a `session_start` concern logging the block once), then
 * count descriptions against bare names. Until that runs, "most skills reach the
 * model without a description" is a suspicion.
 *
 * Exit: 0 always, except a usage/IO error (1). Deliberate.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const SKILLS_ROOT = 'src/skills';

/** A trigger key the host could match on without reading prose. */
const TRIGGER_KEYS = ['triggers:', 'trigger_description:', 'file_pattern:', 'path_prefix:'];

/**
 * A deterministic obligation is one whose violation is observable without
 * judgement — the line-start absolutes. Prose that merely urges ("prefer",
 * "consider") is excluded on purpose: it is the FC-8 class, and counting it here
 * would inflate the only number in this census that bounds what SK-2 can cover.
 */
export const DETERMINISTIC_RE = /^\s*(?:[-*]\s*)?(?:\*\*)?(MUST|NEVER|ALWAYS)\b/m;

export interface SkillCensus {
  total: number;
  withTriggerKey: string[];
  withDeterministicObligation: string[];
}

export function censusSkills(root: string): SkillCensus {
  const out: SkillCensus = { total: 0, withTriggerKey: [], withDeterministicObligation: [] };
  if (!fs.existsSync(root)) {
    return out;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) {
      continue;
    }
    const file = path.join(root, entry.name, 'SKILL.md');
    if (!fs.existsSync(file)) {
      continue;
    }
    out.total += 1;
    const text = fs.readFileSync(file, 'utf8');
    // Frontmatter is everything between the first two `---` fences; a trigger
    // key anywhere else is prose about triggers, not a matchable declaration.
    const fmEnd = text.startsWith('---') ? text.indexOf('\n---', 3) : -1;
    const fm = fmEnd === -1 ? '' : text.slice(0, fmEnd);
    if (TRIGGER_KEYS.some((k) => new RegExp(`^${k}`, 'm').test(fm))) {
      out.withTriggerKey.push(entry.name);
    }
    const body = fmEnd === -1 ? text : text.slice(fmEnd + 4);
    if (DETERMINISTIC_RE.test(body)) {
      out.withDeterministicObligation.push(entry.name);
    }
  }
  return out;
}

export interface UsageReport {
  store: string;
  sessions: number;
  assistantTurns: number;
  invocations: number;
  bySkill: Record<string, number>;
}

/** Default store for the current working directory, mangled the way the host does. */
export function defaultStore(cwd: string): string {
  // Dots are flattened too, not only separators: a worktree at
  // `<repo>/.claude/worktrees/x` lands in `…-agent-config--claude-worktrees-x`.
  // Replacing only `/` returns a directory that does not exist, and the caller
  // then reads a clean zero out of a store it never found.
  return path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[/.]/g, '-'));
}

export function measureUsage(store: string, limit: number): UsageReport {
  const rep: UsageReport = { store, sessions: 0, assistantTurns: 0, invocations: 0, bySkill: {} };
  if (!fs.existsSync(store)) {
    return rep;
  }
  const files = fs
    .readdirSync(store)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(store, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, limit);
  rep.sessions = files.length;
  for (const file of files) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) {
        continue;
      }
      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (entry['type'] !== 'assistant') {
        continue;
      }
      rep.assistantTurns += 1;
      const msg = entry['message'];
      const content = msg !== null && typeof msg === 'object' ? (msg as Record<string, unknown>)['content'] : null;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        if (part === null || typeof part !== 'object') {
          continue;
        }
        const p = part as Record<string, unknown>;
        if (p['type'] !== 'tool_use' || p['name'] !== 'Skill') {
          continue;
        }
        rep.invocations += 1;
        const input = p['input'];
        const name = input !== null && typeof input === 'object' ? (input as Record<string, unknown>)['skill'] : null;
        const key = typeof name === 'string' && name !== '' ? name : '<unnamed>';
        rep.bySkill[key] = (rep.bySkill[key] ?? 0) + 1;
      }
    }
  }
  return rep;
}

function _pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`;
}

export function render(census: SkillCensus, usage: UsageReport[]): string {
  const lines: string[] = [];
  lines.push('skill activation census — advisory, gates on nothing');
  lines.push('');
  lines.push(`  skills shipped                         ${census.total}`);
  lines.push(
    `  with a machine-matchable trigger key   ${census.withTriggerKey.length} (${_pct(census.withTriggerKey.length, census.total)})`,
  );
  lines.push(
    `  with a deterministic obligation        ${census.withDeterministicObligation.length} (${_pct(census.withDeterministicObligation.length, census.total)})`,
  );
  if (census.withDeterministicObligation.length > 0) {
    lines.push(`      ${census.withDeterministicObligation.join(', ')}`);
  }
  lines.push('');
  let totalInv = 0;
  const distinct = new Set<string>();
  for (const u of usage) {
    for (const k of Object.keys(u.bySkill)) {
      distinct.add(k);
    }
    totalInv += u.invocations;
    lines.push(
      `  ${path.basename(u.store).slice(-38).padEnd(38)} sessions=${String(u.sessions).padStart(3)} asst=${String(u.assistantTurns).padStart(6)} Skill calls=${String(u.invocations).padStart(3)}`,
    );
  }
  lines.push('');
  lines.push(`  invocations total                      ${totalInv}`);
  lines.push(
    `  distinct skills invoked                ${distinct.size} of ${census.total} (${_pct(distinct.size, census.total)})`,
  );
  if (distinct.size > 0) {
    lines.push(`      ${[...distinct].sort().join(', ')}`);
  }
  lines.push('');
  if (census.withTriggerKey.length === 0) {
    lines.push('  VERDICT: activation is not measurable as a rate. No skill declares a');
    lines.push('  machine-matchable trigger, so a missed-activation detector has nothing to');
    lines.push('  match against, and matching the description prose is the class this suite');
    lines.push('  excludes. The counts above are the finding, not an input to a percentage.');
  }
  lines.push('');
  lines.push('  NOT MEASURED: whether each skill reached the model WITH its description.');
  lines.push('  The host\'s injected catalogue is not persisted in the transcript, so the');
  lines.push('  bare-name hypothesis is a single-session observation. Falsifier: log the');
  lines.push('  catalogue once per session, then count descriptions against bare names.');
  return lines.join('\n');
}

function main(argv: string[]): number {
  let limit = 30;
  const stores: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--limit' && argv[i + 1] !== undefined) {
      limit = Number.parseInt(argv[i + 1] as string, 10);
      i += 1;
    } else if (a === '--store' && argv[i + 1] !== undefined) {
      stores.push(argv[i + 1] as string);
      i += 1;
    } else if (a === '--help' || a === '-h') {
      process.stdout.write('usage: report_skill_activation [--limit N] [--store PATH]...\n');
      return 0;
    }
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    process.stderr.write('report_skill_activation: --limit must be a positive integer\n');
    return 1;
  }
  if (stores.length === 0) {
    stores.push(defaultStore(REPO_ROOT));
  }
  const census = censusSkills(path.join(REPO_ROOT, SKILLS_ROOT));
  const usage = stores.map((s) => measureUsage(s, limit));
  process.stdout.write(`${render(census, usage)}\n`);
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
