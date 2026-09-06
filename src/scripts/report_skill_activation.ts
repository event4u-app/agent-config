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
 * Exit: the REPORT is 0 always, except a usage/IO error (1). Deliberate — it
 * gates on nothing and must not acquire a threshold.
 *
 * One later mode DOES carry a verdict, and it is not a threshold on the census:
 * `--emit` exits 1 rather than writing a record from an empty store, because a
 * zero-session reading is "no transcripts at this path" and publishing it as an
 * activation figure is the defect this file exists to end.
 *
 * The assertion that the PUBLISHED figure still matches that record is a gate
 * and lives in `check_skill_activation_claim.ts`. It is a separate script on
 * purpose: `src/config/gate-coverage.yml` is a manifest of gates and
 * `_lib/gate_population.ts` classifies one by prefix, so a `report_*` id
 * registered there forks that population.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { projectStoreSlug } from './_lib/cc_transcript.js';
import { reportScanned } from './_lib/scan_scope.js';

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
  withTriggerCorpus: string[];
  withDeterministicObligation: string[];
}

export function censusSkills(root: string): SkillCensus {
  const out: SkillCensus = {
    total: 0,
    withTriggerKey: [],
    withTriggerCorpus: [],
    withDeterministicObligation: [],
  };
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
    // A test fixture, not a routing input: no host reads it at selection time.
    // Counted because it is the second of the three populations the surface
    // splits into, and it is the one most often mistaken for the first.
    if (fs.existsSync(path.join(root, entry.name, 'evals', 'triggers.json'))) {
      out.withTriggerCorpus.push(entry.name);
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
  // Every non-alphanumeric is flattened, not only separators: a worktree at
  // `<repo>/.claude/worktrees/x+y` lands in `…-agent-config--claude-worktrees-x-y`.
  // A narrower class returns a directory that does not exist, and the caller
  // then reads a clean zero out of a store it never found.
  return path.join(os.homedir(), '.claude', 'projects', projectStoreSlug(cwd));
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

/** Repo-relative path of the record the published claim is derived from. */
export const RECORD_PATH = 'agents/evidence/metrics/skill-activation-census.json';
export const CLAIMS_PATH = 'docs/CLAIMS.md';
/** The one ledger entry this census backs. */
export const CLAIM_ID = 'skill-activation-census-zero';

/**
 * The three populations the shipped surface splits into, plus their overlap.
 *
 * They are computed from one pass rather than three greps because the whole
 * point of 2.1 is that they reconcile: `humanNamedOnly` is a remainder, so it
 * cannot be stated independently and then found to disagree.
 */
export interface Populations {
  shipped: number;
  triggerKey: number;
  triggerCorpus: number;
  bothKeyAndCorpus: number;
  humanNamedOnly: number;
}

export function populations(census: SkillCensus): Populations {
  const corpus = new Set(census.withTriggerCorpus);
  const both = census.withTriggerKey.filter((s) => corpus.has(s));
  const eitherOne = new Set([...census.withTriggerKey, ...census.withTriggerCorpus]);
  return {
    shipped: census.total,
    triggerKey: census.withTriggerKey.length,
    triggerCorpus: census.withTriggerCorpus.length,
    bothKeyAndCorpus: both.length,
    humanNamedOnly: census.total - eitherOne.size,
  };
}

export interface CensusRecord {
  schema_version: 1;
  measured_at: string;
  skills_shipped: number;
  with_trigger_key: number;
  with_trigger_corpus: number;
  trigger_key_and_corpus: number;
  human_named_only: number;
  sessions: number;
  assistant_turns: number;
  invocations: number;
  distinct_skills_invoked: number;
  stores: string[];
}

export function buildRecord(census: SkillCensus, usage: UsageReport[], today: string): CensusRecord {
  const pop = populations(census);
  const distinct = new Set<string>();
  for (const u of usage) {
    for (const k of Object.keys(u.bySkill)) {
      distinct.add(k);
    }
  }
  return {
    schema_version: 1,
    measured_at: today,
    skills_shipped: pop.shipped,
    with_trigger_key: pop.triggerKey,
    with_trigger_corpus: pop.triggerCorpus,
    trigger_key_and_corpus: pop.bothKeyAndCorpus,
    human_named_only: pop.humanNamedOnly,
    sessions: usage.reduce((a, u) => a + u.sessions, 0),
    assistant_turns: usage.reduce((a, u) => a + u.assistantTurns, 0),
    invocations: usage.reduce((a, u) => a + u.invocations, 0),
    distinct_skills_invoked: distinct.size,
    stores: usage.map((u) => path.basename(u.store)),
  };
}

export function readRecord(repoRoot: string): CensusRecord | null {
  const file = path.join(repoRoot, RECORD_PATH);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as CensusRecord;
}

/**
 * Numbers the published claim asserts, pulled back out of the claim text.
 *
 * Read from prose on purpose: the claim is the surface a reader believes, so
 * comparing the record against a separate machine field would leave the
 * sentence free to drift from both. `null` for any field the claim no longer
 * states in the expected shape — which `checkClaim` reports as a defect rather
 * than passing over, because a claim that stopped stating its figures is not a
 * claim that agrees with the record.
 */
export interface ClaimFigures {
  sessions: number | null;
  assistantTurns: number | null;
  invocations: number | null;
  distinct: number | null;
  shipped: number | null;
  triggerKey: number | null;
  triggerCorpus: number | null;
  bothKeyAndCorpus: number | null;
  humanNamedOnly: number | null;
  measuredAt: string | null;
  lastVerified: string | null;
}

function _num(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m?.[1] === undefined ? null : Number.parseInt(m[1].replace(/,/gu, ''), 10);
}

export function claimBlock(claimsText: string, id: string): string | null {
  const start = claimsText.indexOf(`### claim: ${id}\n`);
  if (start === -1) {
    return null;
  }
  const rest = claimsText.slice(start + 1);
  const end = rest.indexOf('\n### claim: ');
  return end === -1 ? claimsText.slice(start) : claimsText.slice(start, start + 1 + end);
}

export function parseClaimFigures(block: string): ClaimFigures {
  return {
    sessions: _num(block, /over ([\d,]+) sessions and/u),
    assistantTurns: _num(block, /sessions and ([\d,]+) assistant turns/u),
    invocations: _num(block, /records ([\d,]+) Skill invocations/u),
    distinct: _num(block, /Skill invocations and ([\d,]+) of [\d,]+ distinct skills/u),
    shipped: _num(block, /Skill invocations and [\d,]+ of ([\d,]+) distinct skills/u),
    triggerKey: _num(block, /([\d,]+) declare a machine-matchable trigger key/u),
    triggerCorpus: _num(block, /([\d,]+) carry an `evals\/triggers\.json` corpus/u),
    bothKeyAndCorpus: _num(block, /([\d,]+) do both/u),
    humanNamedOnly: _num(block, /([\d,]+) are reachable only by a human naming them/u),
    measuredAt: /measured (\d{4}-\d{2}-\d{2})/u.exec(block)?.[1] ?? null,
    lastVerified: /^- last_verified: (\d{4}-\d{2}-\d{2})/mu.exec(block)?.[1] ?? null,
  };
}

/**
 * Disagreements between the committed record and the published claim.
 *
 * This is the whole of what 1.3 buys, so it is worth being exact about what it
 * does NOT buy: it cannot tell whether the RECORD still describes the world,
 * because the transcript store it was taken from is one machine's and is absent
 * from CI. Re-taking the measurement is `--emit`; this only forbids the
 * published sentence and the record from telling two different stories.
 */
export function claimProblems(rec: CensusRecord, fig: ClaimFigures): string[] {
  const out: string[] = [];
  const pairs: Array<[string, number, number | null]> = [
    ['sessions', rec.sessions, fig.sessions],
    ['assistant turns', rec.assistant_turns, fig.assistantTurns],
    ['Skill invocations', rec.invocations, fig.invocations],
    ['distinct skills invoked', rec.distinct_skills_invoked, fig.distinct],
    ['skills shipped', rec.skills_shipped, fig.shipped],
    ['skills with a trigger key', rec.with_trigger_key, fig.triggerKey],
    ['skills with a triggers.json corpus', rec.with_trigger_corpus, fig.triggerCorpus],
    ['skills in both populations', rec.trigger_key_and_corpus, fig.bothKeyAndCorpus],
    ['human-named-only skills', rec.human_named_only, fig.humanNamedOnly],
  ];
  for (const [label, recorded, claimed] of pairs) {
    if (claimed === null) {
      out.push(`${label}: the claim no longer states this figure; the record says ${String(recorded)}`);
    } else if (claimed !== recorded) {
      out.push(`${label}: claim says ${String(claimed)}, record says ${String(recorded)}`);
    }
  }
  for (const [label, claimed] of [
    ['measurement date', fig.measuredAt],
    ['last_verified', fig.lastVerified],
  ] as Array<[string, string | null]>) {
    if (claimed === null) {
      out.push(`${label}: the claim no longer states it; the record was measured ${rec.measured_at}`);
    } else if (claimed !== rec.measured_at) {
      out.push(`${label}: claim says ${claimed}, record was measured ${rec.measured_at}`);
    }
  }
  return out;
}

export function render(census: SkillCensus, usage: UsageReport[], published: CensusRecord | null = null): string {
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
  const pop = populations(census);
  lines.push('  populations — the three ways a skill can be reached, reconciled');
  lines.push(`    machine-matchable trigger key        ${pop.triggerKey}`);
  lines.push(`    evals/triggers.json corpus           ${pop.triggerCorpus}  (a test fixture; no host reads it at routing time)`);
  lines.push(`    both of the above                    ${pop.bothKeyAndCorpus}`);
  lines.push(`    human-named only (remainder)         ${pop.humanNamedOnly}`);
  lines.push(
    `    reconciles                           ${pop.triggerKey} + ${pop.triggerCorpus} - ${pop.bothKeyAndCorpus} + ${pop.humanNamedOnly} = ${String(pop.triggerKey + pop.triggerCorpus - pop.bothKeyAndCorpus + pop.humanNamedOnly)} of ${pop.shipped}`,
  );
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
  const sessionsRead = usage.reduce((a, u) => a + u.sessions, 0);
  if (sessionsRead === 0) {
    // The store is keyed on the directory the process runs in, so a checkout
    // that never hosted a session — a fresh worktree, a CI runner — yields a
    // zero that means "no transcripts at this path". Publishing that as the
    // activation reading would be the defect this census exists to end, so the
    // two zeros are separated here rather than left to the reader.
    lines.push('  EMPTY STORE: 0 sessions were read, so the zero above is "no transcripts at');
    lines.push('  this path", NOT "no activations". It is not a measurement of the surface and');
    lines.push('  must not be published as one. Run this where the store lives, or pass --store.');
    lines.push('');
  }
  if (published !== null) {
    // Staleness has to be readable from the run itself. Without this block the
    // only way to tell a fresh published figure from a rotted one is to open
    // the git log of `docs/CLAIMS.md`, which is exactly the thing 1.3 forbids.
    const live = buildRecord(census, usage, published.measured_at);
    // The two halves drift for different reasons and a single verdict over both
    // would be worthless: the store is rolling, so its counts move between any
    // two runs — including a run in the session that is adding to it. A reader
    // who is told STALE every time stops reading the line. Only the repository
    // half is a defect when it moves, because the published population split
    // then no longer describes the tree it claims to count.
    const REPO_FIELDS: Array<keyof CensusRecord> = [
      'skills_shipped',
      'with_trigger_key',
      'with_trigger_corpus',
      'trigger_key_and_corpus',
      'human_named_only',
    ];
    const STORE_FIELDS: Array<keyof CensusRecord> = [
      'sessions',
      'assistant_turns',
      'invocations',
      'distinct_skills_invoked',
    ];
    const repoDrift = REPO_FIELDS.filter((k) => live[k] !== published[k]);
    const storeDrift = STORE_FIELDS.filter((k) => live[k] !== published[k]);
    lines.push(`  PUBLISHED RECORD (${RECORD_PATH}), measured ${published.measured_at}:`);
    lines.push(
      `    sessions=${String(published.sessions)} asst=${String(published.assistant_turns)} invocations=${String(published.invocations)} distinct=${String(published.distinct_skills_invoked)}`,
    );
    if (repoDrift.length > 0) {
      lines.push(`    STALE: the published population split no longer describes this tree —`);
      lines.push(`    ${repoDrift.join(', ')} moved. Re-take with --emit.`);
    } else {
      lines.push('    population split still describes this tree.');
    }
    if (sessionsRead === 0) {
      lines.push('    Store reading: UNDECIDED — this run read no store, so it cannot say whether');
      lines.push('    the published figures still hold. Re-run where the store lives.');
    } else if (storeDrift.length === 0) {
      lines.push('    Store reading: reproduces the published figures exactly.');
    } else {
      lines.push(`    Store reading: moved since the record (${storeDrift.join(', ')}). Expected —`);
      lines.push('    the store is rolling, not append-only, and a later reading can be lower.');
    }
    lines.push('');
  }
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

const USAGE =
  'usage: report_skill_activation [--root DIR] [--limit N] [--store PATH]... [--emit] [--allow-empty-store]\n';

function main(argv: string[]): number {
  let limit = 30;
  let emit = false;
  let allowEmpty = false;
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx === -1 ? REPO_ROOT : (argv[rootIdx + 1] ?? REPO_ROOT);
  const stores: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root' && argv[i + 1] !== undefined) {
      i += 1;
    } else if (a === '--limit' && argv[i + 1] !== undefined) {
      limit = Number.parseInt(argv[i + 1] as string, 10);
      i += 1;
    } else if (a === '--store' && argv[i + 1] !== undefined) {
      stores.push(argv[i + 1] as string);
      i += 1;
    } else if (a === '--emit') {
      emit = true;
    } else if (a === '--allow-empty-store') {
      allowEmpty = true;
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(USAGE);
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
  const census = censusSkills(path.join(root, SKILLS_ROOT));
  const usage = stores.map((s) => measureUsage(s, limit));
  process.stdout.write(`${render(census, usage, readRecord(root))}\n`);
  // The skills are the corpus this floor can hold: they are in the repository,
  // so the count is the same everywhere. The transcript half is path-scoped and
  // legitimately zero in CI, which is why it is reported above and not here — a
  // floor over it would either red every CI run or be vacuous.
  reportScanned({
    gate: 'report_skill_activation',
    scanned: census.total,
    units: 'SKILL.md file(s)',
    roots: [SKILLS_ROOT],
  });
  if (!emit) {
    return 0;
  }
  const sessionsRead = usage.reduce((a, u) => a + u.sessions, 0);
  if (sessionsRead === 0 && !allowEmpty) {
    process.stderr.write(
      'report_skill_activation --emit: refusing to write a record from 0 sessions — that zero\n' +
        'is "no transcripts at this path", not an activation reading. Run where the store lives,\n' +
        'pass --store, or pass --allow-empty-store if an empty store is genuinely the finding.\n',
    );
    return 1;
  }
  const today = new Date().toISOString().slice(0, 10);
  const file = path.join(root, RECORD_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(buildRecord(census, usage, today), null, 2)}\n`);
  process.stdout.write(`\nwrote ${RECORD_PATH} (measured ${today})\n`);
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
