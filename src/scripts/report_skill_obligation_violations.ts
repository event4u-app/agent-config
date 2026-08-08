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
    'vendor',
]);

/**
 * Where a line stops stating the prohibition and starts stating the remedy.
 * Everything after the first pivot is prescriptive, so an artefact there is the
 * fix, not the offence.
 */
const PIVOT_RE = /\s—\s|\s–\s|\buse\b|\binstead\b|→/;

export type Polarity = 'forbidden' | 'prescribed';

export interface Obligation {
    skill: string;
    line: string;
    artefact: string;
    kind: 'path' | 'command';
    polarity: Polarity;
}

export interface ObligationCensus {
    /** The 30 (or however many the census names today). */
    skills: string[];
    totalLines: number;
    /** Artefact-bearing, either polarity. */
    withArtefact: Obligation[];
    /** The mechanisable subset — what this detector can actually test. */
    forbidden: Obligation[];
    prescribed: Obligation[];
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
        forbidden: [],
        prescribed: [],
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
            const pivot = PIVOT_RE.exec(line);
            const head = pivot === null ? line : line.slice(0, pivot.index);
            for (const a of _artefacts(line)) {
                const polarity: Polarity = head.includes(`\`${a.artefact}\``) ? 'forbidden' : 'prescribed';
                const ob: Obligation = { skill, line, artefact: a.artefact, kind: a.kind, polarity };
                out.withArtefact.push(ob);
                (polarity === 'forbidden' ? out.forbidden : out.prescribed).push(ob);
            }
        }
    }
    return out;
}

// ── transcript side ────────────────────────────────────────────────────────

type Entry = Record<string, unknown>;

function _isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Tool calls in an assistant entry, flattened to name + input. */
function _toolUses(entry: Entry): Array<{ name: string; input: Record<string, unknown> }> {
    const msg = entry['message'];
    const content = _isObject(msg) ? msg['content'] : null;
    if (!Array.isArray(content)) return [];
    const out: Array<{ name: string; input: Record<string, unknown> }> = [];
    for (const part of content) {
        if (!_isObject(part) || part['type'] !== 'tool_use') continue;
        const name = typeof part['name'] === 'string' ? part['name'] : '';
        out.push({ name, input: _isObject(part['input']) ? part['input'] : {} });
    }
    return out;
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
    const first = new Map<string, number>();
    const note = (name: string, at: number): void => {
        const key = name.replace(/:/g, '-');
        if (!first.has(key)) first.set(key, at);
    };
    lines.forEach((line, i) => {
        if (!line.trim()) return;
        let entry: Entry;
        try {
            entry = JSON.parse(line) as Entry;
        } catch {
            return;
        }
        if (entry['type'] === 'user') {
            const msg = entry['message'];
            const content = _isObject(msg) ? msg['content'] : null;
            const text = typeof content === 'string' ? content : null;
            const m = text === null ? null : SKILL_BODY_RE.exec(text);
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

function _inputText(input: Record<string, unknown>): string {
    return Object.values(input)
        .filter((v): v is string => typeof v === 'string')
        .join('\n');
}

export function scanSessionForViolations(
    session: string,
    lines: readonly string[],
    forbidden: readonly Obligation[],
): Flag[] {
    const loaded = loadedSkills(lines);
    if (loaded.size === 0) return [];
    const relevant = forbidden.filter((o) => loaded.has(o.skill));
    if (relevant.length === 0) return [];

    const flags: Flag[] = [];
    lines.forEach((line, i) => {
        if (!line.trim()) return;
        let entry: Entry;
        try {
            entry = JSON.parse(line) as Entry;
        } catch {
            return;
        }
        if (entry['type'] !== 'assistant') return;
        for (const t of _toolUses(entry)) {
            const isWrite = WRITE_TOOLS.has(t.name);
            const isShell = SHELL_TOOLS.has(t.name);
            if (!isWrite && !isShell) continue;
            const text = _inputText(t.input);
            for (const o of relevant) {
                const loadedAt = loaded.get(o.skill) as number;
                // "in a LATER assistant turn" — the load must precede the act,
                // or a skill invoked to clean up after a violation would be read
                // as having caused it.
                if (i <= loadedAt) continue;
                if (o.kind === 'path' && !isWrite) continue;
                if (o.kind === 'command' && !isShell) continue;
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
    return path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[/.]/g, '-'));
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
            .map((f) => path.join(store, f))
            .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
            .slice(0, limit);
    } catch {
        return report;
    }
    report.sessions = files.length;
    for (const file of files) {
        const lines = fs.readFileSync(file, 'utf-8').split('\n');
        const id = path.basename(file).replace(/\.jsonl$/, '').slice(0, 8);
        if (loadedSkills(lines).size > 0) report.sessionsWithASkill += 1;
        report.flags.push(...scanSessionForViolations(id, lines, census.forbidden));
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
        `    …naming a concrete artefact              ${c.withArtefact.length} (${_pct(c.withArtefact.length, c.totalLines)})`,
    );
    lines.push(`    …of those, the FORBIDDEN artefact        ${c.forbidden.length}`);
    lines.push(`    …the PRESCRIBED alternative (excluded)   ${c.prescribed.length}`);
    lines.push(
        `    testable without judgement               ${c.forbidden.length} of ${c.totalLines} (${_pct(c.forbidden.length, c.totalLines)})`,
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
        if (a === '--limit' && args[i + 1] !== undefined) {
            limit = Number.parseInt(args[i + 1] as string, 10);
            i += 1;
        } else if (a === '--store' && args[i + 1] !== undefined) {
            stores.push(args[i + 1] as string);
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
