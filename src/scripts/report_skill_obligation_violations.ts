#!/usr/bin/env tsx
/**
 * report_skill_obligation_violations.ts — SK-2, *loaded-but-violated*: a skill
 * body was in context and an obligation stated in it was violated in a later
 * assistant turn of the same session.
 *
 * Executes round-6 Phase 3.2. Advisory: **it gates on nothing**, and it must not
 * acquire a threshold — same reason as `report_skill_activation`, whose census
 * this consumes rather than re-deriving.
 *
 * THE HEADLINE IS THE COVERAGE, NOT THE VIOLATION COUNT
 * ----------------------------------------------------
 * Phase 3.1 scoped SK-2 to the 30 skills carrying a deterministic
 * `MUST`/`NEVER`/`ALWAYS`, so the coverage would be "legible rather than
 * implied". Reading their bodies makes it legible in a way the phase did not
 * anticipate. Across those 30 skills there are **110 obligation lines**, and of
 * those:
 *
 *   4    name a concrete artefact — a repo path or a command literal
 *   1 of those 4 names the PRESCRIBED alternative, not the forbidden thing
 *   106  are deterministic in WORDING and require judgement to test
 *
 * "NEVER return `clean` out of politeness", "NEVER penalise an artifact for
 * being short", "NEVER invent threat actors with unrealistic capabilities" — the
 * verb is absolute and the violation is a reading. So the census's own number
 * repeats the 8 → 30 correction one level down: `DETERMINISTIC_RE` matches the
 * *sentence*, and being deterministic in wording is not the same property as
 * being observable. This script measures the observable subset and publishes the
 * ratio, because a detector over 3 obligations that reported only its own hit
 * count would read as coverage of the 30.
 *
 * THE POLARITY TRAP, WHICH IS WHY THE ARTEFACT SPLIT IS NOT A GREP
 * ---------------------------------------------------------------
 * `using-git-worktrees` says *"NEVER `rm -rf` a worktree — use `git worktree
 * remove`"*. A naive artefact extraction lifts `git worktree remove` and would
 * flag the prescribed FIX as the violation. So an artefact found after a pivot
 * (`—`, `use`, `instead`, `→`) is classified `prescribed` and excluded, by name.
 * The forbidden half of that same obligation (`rm -rf` against a worktree path)
 * stays unmechanised on purpose: `rm -rf` is legitimate against anything that is
 * not a worktree, so a literal match would manufacture false positives — which
 * is the failure 3.3 exists to catch and this script prefers not to create.
 *
 * WHAT COUNTS AS A VIOLATION
 * --------------------------
 *   path artefact     an EDIT/WRITE tool call naming that path after the skill
 *                     loaded. A read never counts: the obligations say
 *                     "hand-edit", and flagging a read would make the detector
 *                     fire on the act of checking.
 *   command artefact  a shell tool call whose command string contains the literal.
 *
 * Both require the skill to have been loaded EARLIER in the same session — that
 * is the "loaded-but" half, and it is what separates SK-2 from a repo-wide grep.
 *
 * Exit: 0 always, except a usage/IO error (1). Deliberate.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { projectStoreSlug } from './_lib/cc_transcript.js';
import { entryText, isSidechain, toolUses as _toolUses } from './_lib/transcript_entry.js';
import { censusSkills, DETERMINISTIC_RE, SKILLS_ROOT } from './report_skill_activation.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * Every obligation line — DERIVED from the census's own pattern rather than
 * restated, so "what counts as a deterministic obligation" has one definition.
 * The census tests whether a skill has one (single match, `m`); this needs the
 * whole line, every time (`.*`, `g`). A second literal here is how the 8 → 30
 * spread happened in the first place: two defensible regexes, two numbers.
 */
const OBLIGATION_LINE_RE = new RegExp(`${DETERMINISTIC_RE.source}.*`, 'gm');

/** A backticked repo path — needs a separator AND an extension to count. */
const PATH_RE = /`([A-Za-z0-9_./-]*\/[A-Za-z0-9_.-]+\.[a-z]{2,6})`/g;
/** A backticked command, gated on a known tool word in command position. */
const CMD_RE = /`([a-z][a-z0-9-]*(?: [a-z][a-z0-9:._-]*){1,3})`/g;
const CMD_HEADS = new Set([
    'cargo',
    'npm',
    'pnpm',
    'yarn',
    'git',
    'php',
    'composer',
    'task',
    'make',
    'npx',
    'gh',
    'python3',
    'docker',
]);
// `vendor` was here and is unreachable: CMD_RE's token class excludes `/`, so
// `vendor/bin/phpunit` can never match. A head that cannot fire reads as coverage.

/**
 * Where a line stops stating the prohibition and starts stating the remedy.
 * Everything after the first pivot is prescriptive, so an artefact there is the
 * fix, not the offence.
 *
 * DELIBERATELY NOT a bare `use` / `instead`. A first draft matched those anywhere
 * in the line, which inverts the very polarity the pivot exists to get right:
 * *"NEVER use `X`"* puts the pivot BEFORE the artefact, so the forbidden thing
 * would be classified `prescribed` and silently dropped from the mechanisable
 * set — biasing this report's own headline ratio downward. A pivot is a
 * punctuation break (dash, arrow, semicolon) or a remedy phrase that follows one,
 * never a verb that can appear inside the prohibition itself.
 */
const PIVOT_RE = /\s—\s|\s–\s|→|;\s|\s—use\b|\buse instead\b/;

/**
 * `forbidden` — a NEVER line's own artefact: its appearance IS the violation.
 * `prescribed` — the remedy a NEVER line points at instead.
 * `required` — a MUST / ALWAYS line's artefact. NOT testable here, and the
 *   distinction is load-bearing rather than tidy: for a positive obligation the
 *   violation is the artefact's **absence**, and a transcript cannot show that
 *   something never happened without also knowing it was due. Deciding polarity
 *   from position alone put `ALWAYS run \`task ci\`` into `forbidden`, so the
 *   detector would have flagged *compliance* as a violation. Verified against a
 *   fixture before the fix: `forbidden: ["task ci"]`.
 */
export type Polarity = 'forbidden' | 'prescribed' | 'required';

/** The absolute a line opens with — the verb that decides what its artefact means. */
export type ObligationVerb = 'NEVER' | 'MUST' | 'ALWAYS';

export interface Obligation {
    skill: string;
    line: string;
    verb: ObligationVerb;
    artefact: string;
    kind: 'path' | 'command';
    polarity: Polarity;
}

export interface ObligationCensus {
    /** The 30 (or however many the census names today). */
    skills: string[];
    totalLines: number;
    /** Artefact-bearing, either polarity. One entry per ARTEFACT. */
    withArtefact: Obligation[];
    /**
     * Obligation LINES carrying at least one artefact. Kept separate from
     * `withArtefact.length` because a line can name two, and dividing an
     * artefact count by a line count and calling it a share of lines overstates
     * the coverage this report exists to be honest about.
     */
    linesWithArtefact: number;
    /** The mechanisable subset — what this detector can actually test. */
    forbidden: Obligation[];
    prescribed: Obligation[];
    /** MUST / ALWAYS artefacts: required, and their violation is unobservable here. */
    required: Obligation[];
}

/** The absolute the line opens with. Defaults to NEVER only if none matched. */
function _verb(line: string): ObligationVerb {
    const m = /\b(NEVER|MUST|ALWAYS)\b/.exec(line);
    return (m?.[1] as ObligationVerb | undefined) ?? 'NEVER';
}

function _artefacts(line: string): Array<{ artefact: string; kind: 'path' | 'command' }> {
    const out: Array<{ artefact: string; kind: 'path' | 'command' }> = [];
    for (const m of line.matchAll(PATH_RE)) {
        out.push({ artefact: m[1] as string, kind: 'path' });
    }
    for (const m of line.matchAll(CMD_RE)) {
        const cmd = m[1] as string;
        if (CMD_HEADS.has(cmd.split(' ')[0] as string)) {
            out.push({ artefact: cmd, kind: 'command' });
        }
    }
    return out;
}

/**
 * Derive the obligations FROM the skill bodies — never a hand-written list.
 *
 * A literal list here would go stale the first time a skill's wording changed,
 * and the detector would then police an obligation the skill no longer states.
 * The census supplies the skill set for the same reason: one definition of "the
 * 30".
 */
export function extractObligations(repoRoot: string): ObligationCensus {
    const skillsRoot = path.join(repoRoot, SKILLS_ROOT);
    const census = censusSkills(skillsRoot);
    const out: ObligationCensus = {
        skills: census.withDeterministicObligation,
        totalLines: 0,
        withArtefact: [],
        linesWithArtefact: 0,
        forbidden: [],
        prescribed: [],
        required: [],
    };
    for (const skill of census.withDeterministicObligation) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(skillsRoot, skill, 'SKILL.md'), 'utf-8');
        } catch {
            continue;
        }
        const fmEnd = text.startsWith('---') ? text.indexOf('\n---', 3) : -1;
        const body = fmEnd === -1 ? text : text.slice(fmEnd + 4);
        for (const raw of body.match(OBLIGATION_LINE_RE) ?? []) {
            const line = raw.trim();
            out.totalLines += 1;
            const verb = _verb(line);
            const pivot = PIVOT_RE.exec(line);
            const head = pivot === null ? line : line.slice(0, pivot.index);
            const found = _artefacts(line);
            if (found.length > 0) {
                out.linesWithArtefact += 1;
            }
            for (const a of found) {
                // The VERB decides what the artefact means; position only splits a
                // prohibition from its remedy. Reading position alone classified
                // `ALWAYS run \`task ci\`` as forbidden — the detector would have
                // reported compliance as a violation.
                const polarity: Polarity =
                    verb === 'NEVER'
                        ? head.includes(`\`${a.artefact}\``)
                            ? 'forbidden'
                            : 'prescribed'
                        : 'required';
                const ob: Obligation = { skill, line, verb, artefact: a.artefact, kind: a.kind, polarity };
                out.withArtefact.push(ob);
                if (polarity === 'forbidden') out.forbidden.push(ob);
                else if (polarity === 'prescribed') out.prescribed.push(ob);
                else out.required.push(ob);
            }
        }
    }
    return out;
}

// ── transcript side ────────────────────────────────────────────────────────

type Entry = Record<string, unknown>;

/**
 * Parse a session once. Both passes below need the same entries, and parsing the
 * file three times for one report is the kind of waste that also invites the two
 * passes to disagree about what they read.
 */
function _parseSession(lines: readonly string[]): Array<Entry | null> {
    return lines.map((line) => {
        if (!line.trim()) return null;
        try {
            return JSON.parse(line) as Entry;
        } catch {
            return null;
        }
    });
}

/** Tools that WRITE. A read must never satisfy a "never hand-edit" obligation. */
const WRITE_TOOLS = new Set([
    'Edit',
    'Write',
    'NotebookEdit',
    'MultiEdit',
    'str-replace-editor',
    'str_replace_editor',
    'save-file',
    'save_file',
]);
const SHELL_TOOLS = new Set(['Bash', 'BashTool', 'launch-process', 'launch_process']);

/** `…/skills/<name>` in an injected body, which is how a skill reaches context. */
const SKILL_BODY_RE = /Base directory for this skill:\s*\S*?\/skills\/([A-Za-z0-9_-]+)/;

/**
 * Which skills were in context, and from which entry index onward.
 *
 * Two carriers, both real in this store: an injected body in the user role, and
 * a `Skill` tool call. A slash-command form (`roadmap:process-full`) is
 * normalised to its skill stem so both spellings resolve to one key.
 */
export function loadedSkills(lines: readonly string[]): Map<string, number> {
    return loadedSkillsFrom(_parseSession(lines));
}

/** As `loadedSkills`, over already-parsed entries. */
export function loadedSkillsFrom(entries: ReadonlyArray<Entry | null>): Map<string, number> {
    const first = new Map<string, number>();
    const note = (name: string, at: number): void => {
        const key = name.replace(/:/g, '-');
        if (!first.has(key)) first.set(key, at);
    };
    entries.forEach((entry, i) => {
        // A sidechain turn did not happen in the main thread. Counting one lets a
        // skill loaded inside a subagent be paired with an edit made outside it,
        // which breaks the ordering premise that separates SK-2 from a grep.
        if (entry === null || isSidechain(entry)) return;
        if (entry['type'] === 'user') {
            // `entryText`, not a string-only read: measured in one 30-session
            // store, ALL 41 injected skill bodies arrive as content blocks and
            // none as a bare string, so a string-only reader detects zero of
            // them — and a detector with an empty loaded-set returns no findings,
            // which is indistinguishable from compliance.
            const m = SKILL_BODY_RE.exec(entryText(entry));
            if (m !== null) note(m[1] as string, i);
            return;
        }
        if (entry['type'] !== 'assistant') return;
        for (const t of _toolUses(entry)) {
            if (t.name !== 'Skill') continue;
            const s = t.input['skill'];
            if (typeof s === 'string' && s !== '') note(s, i);
        }
    });
    return first;
}

export interface Flag {
    session: string;
    skill: string;
    artefact: string;
    kind: 'path' | 'command';
    /** Entry index of the violating turn, and of the turn that loaded the skill. */
    at: number;
    loadedAt: number;
    tool: string;
    /** The matched literal in context — what makes the flag hand-checkable. */
    evidence: string;
}

/**
 * Which input fields name the TARGET of the act, per kind.
 *
 * Concatenating every string value would match a forbidden path that appears in
 * `new_string` / `old_string` / `content` — i.e. flag an edit to some other file
 * whose text merely MENTIONS `docs/THIRD-PARTY-NOTICES.md` as hand-editing it.
 * The obligation is about the target, so only target-bearing fields are read; the
 * same reasoning excludes a `description` that quotes a forbidden command.
 */
const PATH_FIELDS = ['file_path', 'path', 'filePath', 'notebook_path', 'target_file'] as const;
const COMMAND_FIELDS = ['command', 'cmd'] as const;

function _targetText(input: Record<string, unknown>, kind: 'path' | 'command'): string {
    const fields = kind === 'path' ? PATH_FIELDS : COMMAND_FIELDS;
    return fields
        .map((f) => input[f])
        .filter((v): v is string => typeof v === 'string')
        .join('\n');
}

export function scanSessionForViolations(
    session: string,
    lines: readonly string[],
    forbidden: readonly Obligation[],
    parsed?: ReadonlyArray<Entry | null>,
): Flag[] {
    // `parsed` lets `scanStore` reuse the single pass it already made — without it
    // the file is parsed twice per session, which contradicts `_parseSession`'s
    // own reason for existing.
    const entries = parsed ?? _parseSession(lines);
    const loaded = loadedSkillsFrom(entries);
    if (loaded.size === 0) return [];
    const relevant = forbidden.filter((o) => loaded.has(o.skill));
    if (relevant.length === 0) return [];

    const flags: Flag[] = [];
    entries.forEach((entry, i) => {
        if (entry === null || isSidechain(entry)) return;
        if (entry['type'] !== 'assistant') return;
        for (const t of _toolUses(entry)) {
            const isWrite = WRITE_TOOLS.has(t.name);
            const isShell = SHELL_TOOLS.has(t.name);
            if (!isWrite && !isShell) continue;
            for (const o of relevant) {
                const loadedAt = loaded.get(o.skill) as number;
                // "in a LATER assistant turn" — the load must precede the act,
                // or a skill invoked to clean up after a violation would be read
                // as having caused it.
                if (i <= loadedAt) continue;
                if (o.kind === 'path' && !isWrite) continue;
                if (o.kind === 'command' && !isShell) continue;
                const text = _targetText(t.input, o.kind);
                if (!text.includes(o.artefact)) continue;
                const at = text.indexOf(o.artefact);
                flags.push({
                    session,
                    skill: o.skill,
                    artefact: o.artefact,
                    kind: o.kind,
                    at: i,
                    loadedAt,
                    tool: t.name,
                    evidence: text.slice(Math.max(0, at - 40), at + o.artefact.length + 40).replace(/\n/g, ' '),
                });
            }
        }
    });
    return flags;
}

export interface Sk2Report {
    store: string;
    sessions: number;
    sessionsWithASkill: number;
    census: ObligationCensus;
    flags: Flag[];
}

export function defaultStore(cwd: string): string {
    return path.join(os.homedir(), '.claude', 'projects', projectStoreSlug(cwd));
}

export function scanStore(repoRoot: string, store: string, limit: number): Sk2Report {
    const census = extractObligations(repoRoot);
    const report: Sk2Report = {
        store,
        sessions: 0,
        sessionsWithASkill: 0,
        census,
        flags: [],
    };
    let files: string[];
    try {
        files = fs
            .readdirSync(store)
            .filter((f) => f.endsWith('.jsonl'))
            // mtime read ONCE per file, not twice per comparison — a comparator
            // that stats is O(n log n) syscalls for an O(n) fact.
            .map((f) => ({ p: path.join(store, f), m: fs.statSync(path.join(store, f)).mtimeMs }))
            .sort((a, b) => b.m - a.m)
            .slice(0, limit)
            .map((x) => x.p);
    } catch {
        return report;
    }
    report.sessions = files.length;
    for (const file of files) {
        const lines = fs.readFileSync(file, 'utf-8').split('\n');
        const id = path.basename(file).replace(/\.jsonl$/, '').slice(0, 8);
        const entries = _parseSession(lines);
        if (loadedSkillsFrom(entries).size > 0) report.sessionsWithASkill += 1;
        report.flags.push(...scanSessionForViolations(id, lines, census.forbidden, entries));
    }
    return report;
}

function _pct(n: number, d: number): string {
    return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`;
}

export function render(r: Sk2Report): string {
    const c = r.census;
    const lines: string[] = [];
    lines.push('SK-2 loaded-but-violated — advisory, gates on nothing');
    lines.push('');
    lines.push('  COVERAGE (the headline — read this before any violation count)');
    lines.push(`    skills with a deterministic obligation   ${c.skills.length}`);
    lines.push(`    obligation lines in them                 ${c.totalLines}`);
    lines.push(
        `    …LINES naming a concrete artefact        ${c.linesWithArtefact} (${_pct(c.linesWithArtefact, c.totalLines)})`,
    );
    lines.push(`    …artefacts named across those lines      ${c.withArtefact.length}`);
    lines.push(`    …of those, the FORBIDDEN artefact        ${c.forbidden.length}`);
    lines.push(`    …the PRESCRIBED alternative (excluded)   ${c.prescribed.length}`);
    lines.push(`    …REQUIRED by a MUST/ALWAYS (excluded)    ${c.required.length}`);
    lines.push(
        `    testable without judgement               ${c.forbidden.length} artefact(s) over ${c.totalLines} obligation line(s)`,
    );
    lines.push('');
    lines.push('  The other lines are deterministic in wording and need a reading to test');
    lines.push('  ("NEVER return `clean` out of politeness"). That is the FC-8 class this suite');
    lines.push('  excludes, so it is reported as uncovered rather than approximated.');
    lines.push('');
    if (c.forbidden.length > 0) {
        lines.push('  Mechanised obligations:');
        for (const o of c.forbidden) {
            lines.push(`    [${o.skill}] ${o.kind}: ${o.artefact}`);
        }
        lines.push('');
    }
    if (c.prescribed.length > 0) {
        lines.push('  Excluded as prescriptive (the artefact is the remedy, not the offence):');
        for (const o of c.prescribed) {
            lines.push(`    [${o.skill}] ${o.artefact}`);
        }
        lines.push('');
    }
    if (c.required.length > 0) {
        lines.push('  Excluded as REQUIRED — a MUST/ALWAYS line, so its violation is the');
        lines.push('  artefact being ABSENT, and a transcript cannot show that something never');
        lines.push('  happened without also knowing it was due:');
        for (const o of c.required) {
            lines.push(`    [${o.skill}] ${o.verb} ${o.artefact}`);
        }
        lines.push('');
    }
    lines.push(
        `  Scanned ${r.sessions} session(s); ${r.sessionsWithASkill} had a skill in context.`,
    );
    lines.push(`  Flags: ${r.flags.length}`);
    for (const f of r.flags) {
        lines.push(`    ${f.session}  [${f.skill}] ${f.artefact} via ${f.tool} (entry ${f.at}, loaded ${f.loadedAt})`);
        lines.push(`        …${f.evidence}…`);
    }
    lines.push('');
    lines.push('  PRECISION: every flag above is hand-read before any number from this script');
    lines.push('  is cited (Phase 3.3). A detector that cannot state its false-positive rate');
    lines.push('  ships as detection-only, and this one says so.');
    return lines.join('\n');
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let limit = 30;
    let json = false;
    const stores: string[] = [];
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        // A value must not itself be a flag: `--store --json` otherwise reads
        // `--json` as a store path and reports 0 sessions, silently. The sibling
        // report closes the same hole in this branch.
        const value = (at: number): string | null => {
            const v = args[at + 1];
            return v === undefined || v.startsWith('-') ? null : v;
        };
        if (a === '--limit') {
            const v = value(i);
            if (v === null) {
                process.stderr.write('report_skill_obligation_violations: --limit needs a number\n');
                return 1;
            }
            limit = Number.parseInt(v, 10);
            i += 1;
        } else if (a === '--store') {
            const v = value(i);
            if (v === null) {
                process.stderr.write('report_skill_obligation_violations: --store needs a path\n');
                return 1;
            }
            stores.push(v);
            i += 1;
        } else if (a === '--json') {
            json = true;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'usage: report_skill_obligation_violations [--limit N] [--store PATH]... [--json]\n',
            );
            return 0;
        } else if (a !== undefined && a.startsWith('--') && a !== '--quiet') {
            process.stderr.write(`report_skill_obligation_violations: unknown flag ${a}\n`);
            return 1;
        }
    }
    if (!Number.isFinite(limit) || limit <= 0) {
        process.stderr.write('report_skill_obligation_violations: --limit must be a positive integer\n');
        return 1;
    }
    if (stores.length === 0) stores.push(defaultStore(REPO_ROOT));
    for (const store of stores) {
        const r = scanStore(REPO_ROOT, store, limit);
        process.stdout.write(json ? `${JSON.stringify(r, null, 2)}\n` : `${render(r)}\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
