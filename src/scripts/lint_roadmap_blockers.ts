#!/usr/bin/env tsx
/**
 * Hard-gate linter for the roadmap `## Blockers` contract
 * (`templates/roadmaps.md` rule 20 / `roadmap-ci-steps-policy` siblings).
 *
 * Validates, for every active roadmap and every parked idea one directory
 * down in `stubs/`:
 *
 *   1. Every `### blocker: <id>` entry declares all five required fields
 *      (Status, Owner, Blocks, What to do, Resolved when).
 *   2. Every inline `<!-- blocked-by: <id> -->` annotation — on the checkbox
 *      line or a continuation line — resolves to an OPEN `### blocker: <id>`
 *      declared in the SAME file; `<!-- blocked-by: <roadmap-stem>#<id> -->`
 *      resolves to an open blocker in the named active roadmap or stub. A
 *      resolved target (stale), a missing file or id, a target found only in
 *      `later/`/`archive/`/`skipped/`, an ambiguous stem, a self-qualified
 *      reference, an unparseable marker, and a `### ` heading under
 *      `## Blockers` without the `blocker:` prefix are all hard findings —
 *      each used to pass with nothing validated (AI council 2026-10-07,
 *      authority-routing roadmap 4.1-4.3).
 *   3. An entry that declares `- **Class:**` declares a class the taxonomy
 *      knows (0-3), and a class-0 or class-1 entry says HOW it runs
 *      (`- **Run:**`). A gate that claims to be executable without naming the
 *      command is the same defect as a decision with no option set: it reads
 *      as actionable and is not.
 *   4. An annotation pointing at a USER-DECISION blocker (one whose `Owner:`
 *      is the maintainer, the user, or the owner) carries an `asked:` field
 *      recording whether the question was put and, when it was not, why —
 *      `<!-- blocked-by: <id> | asked: no — <reason> -->`. A decision only the
 *      user can make, filed in a roadmap without ever being put, is the defect
 *      road-to-asked-not-parked exists to stop; without this field a marker
 *      cannot distinguish a declined decision from an unoffered one.
 *
 *      HARD, not ratcheted, and it can be: no file in scope carries a real
 *      checkbox annotation pointing at a blocker today, so on the day it ships
 *      the rule fires on nothing — the same "no backlog to grandfather"
 *      argument the `Class:` contract above makes. Re-measured when `stubs/`
 *      entered scope on 2026-09-28: 7 stubs carry checkboxes and 0 of them
 *      carry a `blocked-by:` marker, so the rule stays latent there too.
 *      `later/`, `archive/` and `skipped/` are outside this gate's glob and
 *      are untouched by it; `stubs/` is inside it — see § SCOPE.
 *
 *   5. An entry that declares `- **Ownership:**` declares one of the three
 *      OWNER-OWNED classes (`product-owned`, `business-owned`,
 *      `destructive-owned`). A technical class there is a judgement call
 *      parked in a file instead of closed, which is the shape ADR-268 § 10
 *      retires: a technical decision does not become owner-owned because it is
 *      hard, so it routes back through the closure pass rather than into
 *      `## Blockers`.
 *
 *      HARD rather than ratcheted, on the same "no backlog to grandfather"
 *      argument the `Class:` contract makes: `Ownership:` is a new opt-in
 *      field, so on the day it ships no entry in the tree declares one and the
 *      rule fires on nothing.
 *
 * SCOPE — the active tree plus `stubs/`, and deliberately nothing else.
 *
 * Widened from the active tree alone by an owner ruling on 2026-09-28. Before
 * it, a stub's hold was unreachable by every blocker gate: a parked idea is
 * where a hold sits LONGEST, so excluding it exempted exactly the entries most
 * likely to rot. The rejected alternative was to keep the scope and reword the
 * acceptance criterion that named this gate — refused because a criterion
 * edited to match what was achieved stops being an acceptance test.
 *
 * Measured on the tree the widening shipped against: 121 files under `stubs/`
 * (120 stubs plus the directory README), of which 6 carry a `### blocker:`
 * heading and 4 declare one open inside a `## Blockers` section. Zero hard
 * violations, zero additions to the decidability ratchet, zero new
 * active/archived overlaps. So it lands on nothing — the same "no backlog to
 * grandfather" argument the `Class:` and `Ownership:` contracts make.
 *
 * REACH, stated honestly, because the obvious reading of the paragraph above
 * is wrong: this does NOT hold every future stub blocker to the contract. Both
 * scanners require the entry to sit under a `## Blockers` heading, and 2 of
 * today's 6 put it under `## State` instead — so a third of the population is
 * in the glob and still unread. Stub headings are free-form, unlike the
 * template-driven roadmaps this gate was written for, so that is the likely
 * shape rather than an edge case. Widening the glob fixes WHERE the gate looks
 * and not WHAT it can parse; the second half is the sibling defect recorded in
 * `stubs/road-to-blocker-parse-visibility.md`, and it is untouched here.
 *
 * `later/`, `archive/` and `skipped/` stay OUT, and the reason is not symmetry:
 * those record decisions already taken (parked, closed, dropped), so a blocker
 * left unresolved there is history rather than debt. A stub records a decision
 * still to take. The polarity is pinned in both directions by
 * `tests/scripts/lint_roadmap_blockers.test.ts` § the scanned scope, so
 * widening further cannot happen by accident.
 *
 * One consequence worth naming rather than discovering: `_archiveOverlap`
 * defaults its ACTIVE corpus to this glob, so a stub declaring a blocker open
 * that an archived roadmap also declares open now fails. That is the same
 * self-contradiction the assertion already caught one directory up, and it
 * measured 0 on the widening tree.
 *
 * Fenced code blocks are stripped before scanning so a roadmap that shows
 * the `## Blockers` shape as a documentation example is not flagged.
 *
 * Exit codes: 0 = clean / nothing in scope, 1 = violations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const QUIET = process.argv.slice(2).includes('--quiet');

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
/**
 * The scanned scope, for display. Two plain globs rather than one brace
 * expression: nothing globs with this string, and a `{,stubs/}` empty
 * alternative is bash-only syntax that would mislead anyone who tried.
 */
const ROADMAP_GLOB = 'agents/roadmaps/*.md + agents/roadmaps/stubs/*.md';
/** The one subdirectory inside the glob. See § SCOPE for why only this one. */
const SCANNED_SUBDIRS: readonly string[] = ['stubs'];
/** Roadmap directories a qualified reference may NAME but never resolve into. */
const OUT_OF_SCOPE_SUBDIRS: readonly string[] = ['later', 'archive', 'skipped'];

const FENCED_CODE_RE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm;
const BLOCKERS_SECTION_RE = /^##[ \t]+Blockers[ \t]*$/im;
const NEXT_H2_RE = /^##[ \t]+\S/m;
const BLOCKER_HEADING_RE = /^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/gim;
const UNPREFIXED_HEADING_RE = /^###[ \t]+(?!blocker:)\S.*$/gim;
// Every line carrying a real HTML-comment marker counts — the checkbox line
// AND a wrapped continuation line of the same step. Anchoring to the checkbox
// line alone read nothing on a continuation line and still printed the file
// clean (authority-routing council record, defect 1). Inline-code
// documentation of the syntax is blanked before matching, so a quoted example
// stays prose rather than a live reference.
const BLOCKED_BY_LINE_RE =
    /<!--[ \t]*blocked-by:[ \t]*([a-z0-9-]+(?:#[a-z0-9-]+)?)[ \t]*(?:\|[ \t]*asked:[ \t]*(yes|no)[ \t]*(?:[\u2014-][ \t]*([^>]*?))?[ \t]*)?-->/i;
/** A marker opening the full grammar above failed to parse — reported, never skipped. */
const MARKER_OPEN_RE = /<!--[ \t]*blocked-by:/i;

/**
 * Where a qualified `<roadmap-stem>#<id>` reference may resolve.
 *
 * The AI council, 2026-10-07, 2/2 present, both on the qualified form: only an
 * in-scope roadmap (active or stub) is a legal target. A target found only in
 * `later/`, `archive/` or `skipped/` is out of scope — directory placement is a
 * different state machine from blocker status, so it is named in the error and
 * never read as "resolved" or "still held".
 */
interface TargetFile {
    rel: string;
    declared: ReadonlySet<string>;
    open: ReadonlySet<string>;
    userDecision: ReadonlySet<string>;
}
interface TargetIndex {
    /** Roadmap stem → every in-scope file with that stem (more than one is ambiguous). */
    inScope: ReadonlyMap<string, readonly TargetFile[]>;
    /** Roadmap stem → the out-of-scope directory it was found in. */
    outOfScope: ReadonlyMap<string, string>;
}

/**
 * The owners whose blockers are the USER-DECISION class.
 *
 * Read off `Owner:` rather than guessed from prose: `terminal-states.md`
 * defines `blocked` to include "a decision only the user can make", and the
 * owner field is the only place a roadmap says which blockers those are.
 * `council`, `implementer` and `agent` are deliberately outside the class —
 * those are not decisions the user is waiting to be asked.
 */
const USER_DECISION_OWNER_RE = /^-[ \t]*\*\*Owner:\*\*[ \t]*(maintainer|user|owner)\b/im;

const REQUIRED_FIELDS: ReadonlyArray<readonly [string, RegExp]> = [
    ['Status', /^-[ \t]*\*\*Status:\*\*/im],
    ['Owner', /^-[ \t]*\*\*Owner:\*\*/im],
    ['Blocks', /^-[ \t]*\*\*Blocks:\*\*/im],
    ['What to do', /^-[ \t]*\*\*What to do:\*\*/im],
    ['Resolved when', /^-[ \t]*\*\*Resolved when:\*\*/im],
];

/**
 * The fields that make a blocker DECIDABLE rather than merely described.
 *
 * Separated from `REQUIRED_FIELDS` on purpose: the five above are a settled
 * contract every entry in the tree already satisfies, so a missing one is a
 * hard failure. These three are new, and 36 open entries predate them — held
 * to the same bar on day one they would red the whole backlog, which is the
 * "strict gate fires on ~283 files" failure this repo has already recorded
 * once. They run through the ratchet instead: the backlog is legal at its
 * measured size, and every entry added or edited after this must clear them.
 */
const DECIDABILITY_FIELDS: ReadonlyArray<readonly [string, RegExp]> = [
    ['Recommendation', /^-[ \t]*\*\*Recommendation:\*\*[ \t]*\S/im],
    ['If you do nothing', /^-[ \t]*\*\*If you do nothing:\*\*[ \t]*\S/im],
];

/**
 * The gate taxonomy's four classes, as authored in the blocker entry.
 *
 * `Class` is deliberately OPTIONAL and its absence means class 3 — human-only.
 * Making the safe class the default is what keeps a misclassification a
 * reviewed edit rather than a runtime judgment: nothing an author forgets to
 * write can become executable by omission.
 */
const CLASS_FIELD_RE = /^-[ \t]*\*\*Class:\*\*[ \t]*(.*)$/im;
const RUN_FIELD_RE = /^-[ \t]*\*\*Run:\*\*[ \t]*(\S.*)$/im;
const KNOWN_CLASSES: ReadonlySet<string> = new Set(['0', '1', '2', '3']);
/** The classes whose whole claim is that an agent can execute them. */
const RUNNABLE_CLASSES: ReadonlySet<string> = new Set(['0', '1']);

/**
 * The ownership axis, as a blocker may declare it.
 *
 * Only the three owner-owned classes are legal here. A blocker IS the record
 * of a decision the agent correctly did not own; a technical class in that
 * field says the opposite — that something the ownership ladder can close was
 * filed instead. The remaining five ownership classes are deliberately absent
 * rather than listed as "also accepted".
 */
const OWNERSHIP_FIELD_RE = /^-[ \t]*\*\*Ownership:\*\*[ \t]*`?([a-z-]+)`?/im;
const OWNER_OWNED_CLASSES: ReadonlySet<string> = new Set([
    'product-owned',
    'business-owned',
    'destructive-owned',
]);
const TECHNICAL_CLASSES: ReadonlySet<string> = new Set([
    'deterministic',
    'reversible-technical',
    'contested-technical',
    'critical-technical',
    'spend-exhaustion',
]);

/**
 * The authored class, or `''` when the entry declares none.
 *
 * Only the leading token is read, so `- **Class:** 1 — budget-preauthorized`
 * parses as `1`: the taxonomy name is documentation for the reader and must
 * not have to be spelled identically in every entry to stay valid.
 */
function _blockerClass(body: string): string {
    const m = CLASS_FIELD_RE.exec(body);
    if (!m) {
        return '';
    }
    const raw = ((m[1] as string) ?? '').trim();
    return raw === '' ? '' : (raw.split(/[\s—–-]/)[0] as string);
}

/** `What to do:` body — everything up to the next field marker. */
const WHAT_TO_DO_SLICE_RE =
    /^-[ \t]*\*\*What to do:\*\*([\s\S]*?)(?=^-[ \t]*\*\*[A-Z]|^###[ \t]|$(?![\s\S]))/im;

/**
 * Does `What to do` carry anything the owner can actually execute?
 *
 * A backticked span (a command, a path, a flag) or an enumerated option set
 * (`(a)` / `1.`) both count. Bare prose does not: "pick exactly one — accept
 * the reading, or re-cut the criterion" names no file, no command and no
 * consequence, and hands the analysis back to the person least equipped to
 * redo it. Measured 2026-08-15: 14 of 46 entries in this tree are that shape.
 */
function _hasExecutableSubstance(body: string): boolean {
    const m = WHAT_TO_DO_SLICE_RE.exec(body);
    const slice = m ? (m[1] as string) : '';
    return /`[^`\n]+`/.test(slice) || /(^|\s)\((?:[a-z]|[0-9]+)\)\s/i.test(slice);
}

interface Violation {
    line: number;
    message: string;
}

/** 1-based line number of a character offset. */
function _lineAt(text: string, index: number): number {
    let n = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text.charCodeAt(i) === 10) {
            n += 1;
        }
    }
    return n;
}

/** Blank out fenced code blocks, preserving line count and offsets. */
function _stripFencedCode(text: string): string {
    return text.replace(FENCED_CODE_RE, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length));
}

function _scan(rawText: string, ctx?: ScanContext): Violation[] {
    return _scanBoth(rawText, ctx).hard;
}

interface ScanResult {
    /** Contract violations — always fatal. */
    hard: Violation[];
    /** Open entries that are not yet decidable — counted against the ratchet. */
    decidability: Violation[];
}

/** What a scan needs to resolve a qualified reference: who it is, and where it may point. */
interface ScanContext {
    /** The scanned file's own roadmap stem, so a self-qualified reference is caught. */
    selfStem?: string;
    index?: TargetIndex;
}

function _scanBoth(rawText: string, ctx: ScanContext = {}): ScanResult {
    const violations: Violation[] = [];
    const decidability: Violation[] = [];
    const text = _stripFencedCode(rawText);
    const declaredIds = new Set<string>();
    const userDecisionIds = new Set<string>();
    const openIds = new Set<string>();

    const sectionMatch = BLOCKERS_SECTION_RE.exec(text);
    if (sectionMatch) {
        const sectionStart = sectionMatch.index + sectionMatch[0].length;
        const rest = text.slice(sectionStart);
        const h2 = NEXT_H2_RE.exec(rest);
        const sectionEnd = h2 ? sectionStart + h2.index : text.length;
        const section = text.slice(sectionStart, sectionEnd);

        BLOCKER_HEADING_RE.lastIndex = 0;
        const heads: Array<{ start: number; end: number; id: string }> = [];
        let hm: RegExpExecArray | null;
        while ((hm = BLOCKER_HEADING_RE.exec(section)) !== null) {
            heads.push({
                start: hm.index,
                end: hm.index + hm[0].length,
                id: (hm[1] as string).trim(),
            });
            if (hm.index === BLOCKER_HEADING_RE.lastIndex) {
                BLOCKER_HEADING_RE.lastIndex++;
            }
        }
        // A `### <id>` heading without the `blocker:` prefix parses to no
        // blocker at all, so the file used to pass with nothing validated.
        for (const bare of section.matchAll(UNPREFIXED_HEADING_RE)) {
            violations.push({
                line: _lineAt(text, sectionStart + (bare.index ?? 0)),
                message:
                    `'${(bare[0] as string).trim()}' sits under ## Blockers without the ` +
                    "'blocker:' prefix, so it declares no blocker — write '### blocker: <id>'",
            });
        }
        for (let i = 0; i < heads.length; i++) {
            const cur = heads[i] as { start: number; end: number; id: string };
            declaredIds.add(cur.id);
            if (cur.id.includes('#')) {
                violations.push({
                    line: _lineAt(text, sectionStart + cur.start),
                    message:
                        `blocker id '${cur.id}' contains '#', the separator of a qualified ` +
                        "'<roadmap-stem>#<id>' reference — rename it",
                });
            }
            const bodyEnd = i + 1 < heads.length ? (heads[i + 1] as { start: number }).start : section.length;
            const body = section.slice(cur.end, bodyEnd);
            if (USER_DECISION_OWNER_RE.test(body)) {
                userDecisionIds.add(cur.id);
            }
            const missing = REQUIRED_FIELDS.filter(([, re]) => !re.test(body)).map(([name]) => name);
            if (missing.length) {
                violations.push({
                    line: _lineAt(text, sectionStart + cur.start),
                    message: `blocker '${cur.id}' missing required field(s): ${missing.join(', ')}`,
                });
            }
            // Resolved entries are history — re-litigating a decision already
            // made would be churn, and the ratchet would never reach zero.
            const isResolved = /^-[ \t]*\*\*Status:\*\*[ \t]*resolved/im.test(body);
            if (!isResolved) {
                openIds.add(cur.id);
                // The class/run contract is HARD rather than ratcheted, and it
                // can be: `Class:` is a new opt-in field, so on the day it
                // ships no entry in the tree declares one and the rule fires on
                // nothing. There is no backlog to grandfather — the "strict
                // gate reds ~283 files" failure the decidability half had to
                // avoid simply does not arise here.
                const cls = _blockerClass(body);
                if (cls !== '') {
                    const at = _lineAt(text, sectionStart + cur.start);
                    if (!KNOWN_CLASSES.has(cls)) {
                        violations.push({
                            line: at,
                            message:
                                `blocker '${cur.id}' declares unknown class '${cls}' ` +
                                '(expected 0 auto-run, 1 budget-preauthorized, ' +
                                '2 consent-once, or 3 human-only)',
                        });
                    } else if (RUNNABLE_CLASSES.has(cls) && !RUN_FIELD_RE.test(body)) {
                        violations.push({
                            line: at,
                            message:
                                `blocker '${cur.id}' is class ${cls} but declares no ` +
                                '**Run:** command — a gate that claims to be runnable ' +
                                'must say how',
                        });
                    }
                }
                const ownership = OWNERSHIP_FIELD_RE.exec(body);
                if (ownership !== null) {
                    const declared = ownership[1] as string;
                    if (TECHNICAL_CLASSES.has(declared)) {
                        violations.push({
                            line: _lineAt(text, sectionStart + cur.start),
                            message:
                                `blocker '${cur.id}' declares ownership '${declared}', which is ` +
                                'a technical class — a technical decision does not become ' +
                                'owner-owned because it is hard (ADR-268 § 10). Route it back ' +
                                'through the closure pass and record the answer as a ' +
                                '`## Decisions` row instead of parking it here',
                        });
                    } else if (!OWNER_OWNED_CLASSES.has(declared)) {
                        violations.push({
                            line: _lineAt(text, sectionStart + cur.start),
                            message:
                                `blocker '${cur.id}' declares unknown ownership '${declared}' ` +
                                '(expected product-owned, business-owned or destructive-owned)',
                        });
                    }
                }
                const gaps = DECIDABILITY_FIELDS.filter(([, re]) => !re.test(body)).map(
                    ([name]) => name,
                );
                if (!_hasExecutableSubstance(body)) {
                    gaps.push('What to do (no command, path or option set)');
                }
                if (gaps.length) {
                    decidability.push({
                        line: _lineAt(text, sectionStart + cur.start),
                        message: `blocker '${cur.id}' is not decidable yet: ${gaps.join(', ')}`,
                    });
                }
            }
        }
    }

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        // A real annotation is bare markdown (an actual checkbox + HTML
        // comment); an inline-code-quoted mention (`` `<!-- blocked-by: id -->` ``,
        // e.g. this very lint script's own roadmap step documenting the
        // syntax) is prose, not a live cross-reference — blank inline code
        // spans before matching.
        const cleaned = (lines[i] as string).replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
        const m = BLOCKED_BY_LINE_RE.exec(cleaned);
        if (!m) {
            if (MARKER_OPEN_RE.test(cleaned)) {
                violations.push({
                    line: i + 1,
                    message:
                        'blocked-by marker does not parse — write ' +
                        "'<!-- blocked-by: <id> -->' or '<!-- blocked-by: <roadmap-stem>#<id> -->'",
                });
            }
            continue;
        }
        const ref = m[1] as string;
        const r = _resolveRef(ref, { declaredIds, openIds, userDecisionIds }, ctx);
        if (r.error !== null) {
            violations.push({ line: i + 1, message: r.error });
        }
        const id = ref;
        if (r.userDecision) {
            const asked = m[2] === undefined ? null : (m[2] as string).toLowerCase();
            const reason = ((m[3] as string | undefined) ?? '').trim();
            if (asked === null) {
                violations.push({
                    line: i + 1,
                    message:
                        `blocked-by '${id}' is a user-decision blocker and carries no ` +
                        'asked: field — write `| asked: yes` when the question was put, ' +
                        'or `| asked: no — <reason>` when it was not',
                });
            } else if (asked === 'no' && reason === '') {
                violations.push({
                    line: i + 1,
                    message:
                        `blocked-by '${id}' says asked: no with no reason — a marker that ` +
                        'does not say why the question was never put is the parking lot ' +
                        'this field exists to end',
                });
            }
        }
    }
    violations.sort((a, b) => a.line - b.line);
    decidability.sort((a, b) => a.line - b.line);
    return { hard: violations, decidability };
}

interface LocalBlockers {
    declaredIds: ReadonlySet<string>;
    openIds: ReadonlySet<string>;
    userDecisionIds: ReadonlySet<string>;
}

/**
 * Resolve one marker reference to its legal state, or the error naming why not.
 *
 * Bare `<id>` resolves in the same file only, unchanged. Qualified
 * `<roadmap-stem>#<id>` resolves against the in-scope target named — never
 * estate-wide, so an unrelated roadmap adding a same-named blocker cannot change
 * what an existing marker means. A target that is declared but resolved makes
 * the marker STALE: `run-continuation` treats every marker as blocked, so a
 * marker on a resolved blocker would hold a step nothing holds any more.
 * "Superseded" is not a state — the format has no replacement pointer, so a
 * moved blocker is a reference to update, reported here as missing.
 */
function _resolveRef(
    ref: string,
    local: LocalBlockers,
    ctx: ScanContext,
): { error: string | null; userDecision: boolean } {
    const hash = ref.indexOf('#');
    if (hash === -1) {
        if (!local.declaredIds.has(ref)) {
            return {
                error:
                    `blocked-by references unknown blocker id '${ref}' ` +
                    `(no matching '### blocker: ${ref}' in this file; a blocker declared in ` +
                    "another roadmap is referenced as '<roadmap-stem>#<id>')",
                userDecision: false,
            };
        }
        if (!local.openIds.has(ref)) {
            return { error: _staleMessage(ref, 'this file'), userDecision: false };
        }
        return { error: null, userDecision: local.userDecisionIds.has(ref) };
    }
    const stem = ref.slice(0, hash);
    const id = ref.slice(hash + 1);
    if (ctx.selfStem !== undefined && stem === ctx.selfStem) {
        return {
            error: `blocked-by '${ref}' qualifies a blocker in this same file — write the bare id '${id}'`,
            userDecision: false,
        };
    }
    const hits = ctx.index?.inScope.get(stem) ?? [];
    if (hits.length > 1) {
        return {
            error:
                `blocked-by '${ref}' is ambiguous — roadmap stem '${stem}' names ` +
                `${hits.map((h) => h.rel).join(' and ')}`,
            userDecision: false,
        };
    }
    const target = hits[0];
    if (target === undefined) {
        const parked = ctx.index?.outOfScope.get(stem);
        return {
            error:
                parked === undefined
                    ? `blocked-by '${ref}' names no roadmap '${stem}.md' in agents/roadmaps/ or stubs/`
                    : `blocked-by '${ref}' names a roadmap only found in ${parked}/, which is not a ` +
                      'resolvable target — only an active roadmap or a stub can hold a step',
            userDecision: false,
        };
    }
    if (!target.declared.has(id)) {
        return {
            error: `blocked-by '${ref}' names no '### blocker: ${id}' in ${target.rel}`,
            userDecision: false,
        };
    }
    if (!target.open.has(id)) {
        return { error: _staleMessage(ref, target.rel), userDecision: false };
    }
    return { error: null, userDecision: target.userDecision.has(id) };
}

function _staleMessage(ref: string, where: string): string {
    return (
        `blocked-by '${ref}' points at a blocker resolved in ${where} — if the step can ` +
        'proceed, remove the marker; if it is still held, reopen the blocker and say why'
    );
}

/** Declared, open and user-decision blocker ids of one roadmap text. */
function _blockerSets(text: string): { declared: Set<string>; open: Set<string>; userDecision: Set<string> } {
    const declared = new Set<string>();
    const userDecision = new Set<string>();
    const stripped = _stripFencedCode(text);
    const sectionMatch = BLOCKERS_SECTION_RE.exec(stripped);
    if (sectionMatch) {
        const sectionStart = sectionMatch.index + sectionMatch[0].length;
        const rest = stripped.slice(sectionStart);
        const h2 = NEXT_H2_RE.exec(rest);
        const section = stripped.slice(sectionStart, h2 ? sectionStart + h2.index : stripped.length);
        const heads = [...section.matchAll(BLOCKER_HEADING_RE)];
        heads.forEach((hm, i) => {
            const id = (hm[1] as string).trim();
            declared.add(id);
            const next = heads[i + 1];
            const body = section.slice((hm.index ?? 0) + hm[0].length, next ? next.index : section.length);
            if (USER_DECISION_OWNER_RE.test(body)) {
                userDecision.add(id);
            }
        });
    }
    return { declared, open: _openBlockerIds(text), userDecision };
}

/** The qualified-reference target map over a roadmap tree. See {@link TargetIndex}. */
function _targetIndex(roadmapRoot: string = path.join(REPO_ROOT, 'agents', 'roadmaps')): TargetIndex {
    const inScope = new Map<string, TargetFile[]>();
    for (const f of _globRoadmaps(roadmapRoot)) {
        const stem = path.basename(f, '.md');
        const sets = _blockerSets(fs.readFileSync(f, 'utf-8'));
        const entry: TargetFile = {
            rel: _relPosix(f, REPO_ROOT),
            declared: sets.declared,
            open: sets.open,
            userDecision: sets.userDecision,
        };
        const list = inScope.get(stem);
        if (list === undefined) {
            inScope.set(stem, [entry]);
        } else {
            list.push(entry);
        }
    }
    const outOfScope = new Map<string, string>();
    for (const dir of OUT_OF_SCOPE_SUBDIRS) {
        for (const f of _globFlat(path.join(roadmapRoot, dir))) {
            const stem = path.basename(f, '.md');
            if (!inScope.has(stem) && !outOfScope.has(stem)) {
                outOfScope.set(stem, dir);
            }
        }
    }
    return { inScope, outOfScope };
}

/** Sorted `*.md` directly inside `dir` — never recursive. */
function _globFlat(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        // A missing directory is not an error: `stubs/` is optional, and the
        // dead-scope assertion in `main` is what catches a MOVED root.
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

/**
 * The files this gate judges: active roadmaps, plus `stubs/`. See § SCOPE.
 *
 * Takes its root so the scope can be driven from a fixture tree. Asserting the
 * rule against the real tree would only restate today's file list; the test
 * pins which DIRECTORIES are in and which are out, in both directions.
 */
function _globRoadmaps(roadmapRoot: string = path.join(REPO_ROOT, 'agents', 'roadmaps')): string[] {
    const out = _globFlat(roadmapRoot);
    for (const sub of SCANNED_SUBDIRS) {
        out.push(..._globFlat(path.join(roadmapRoot, sub)));
    }
    return out;
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/**
 * Every `*.md` anywhere under the roadmap tree — active plus `archive/`,
 * `later/`, `skipped/`.
 *
 * The active glob is the subset this gate judges, and it reaches zero
 * legitimately once everything is archived, so it cannot double as the scope
 * assertion. The whole tree reaching zero has only one cause: the root moved.
 */
function _countRoadmapTree(dir: string): number {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return 0;
    }
    let n = 0;
    for (const entry of entries) {
        if (entry.isDirectory()) {
            n += _countRoadmapTree(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
            n += 1;
        }
    }
    return n;
}

/**
 * Blocker ids declared `Status: open` in one file, by id.
 *
 * Reads exactly one fact per blocker — id and open-ness. It is deliberately
 * NOT `_scanBoth`: the five-field contract, the class taxonomy and the
 * decidability ratchet are not applied here, because the corpus this runs over
 * includes `archive/` and applying the contract there lands 23 findings on day
 * one against a change that caused none of them. That shape has been reverted
 * twice in this repository — `lint_roadmap_later_disposition` at 68 files and
 * `check_no_new_legacy_path` at 46 — and the exclusion also protects a true
 * thing an archived roadmap is allowed to say: a blocker genuinely unresolved
 * when its roadmap closed is history, not a defect.
 */
function _openBlockerIds(text: string): Set<string> {
    const stripped = _stripFencedCode(text);
    const out = new Set<string>();
    const sectionMatch = BLOCKERS_SECTION_RE.exec(stripped);
    if (!sectionMatch) {
        return out;
    }
    const sectionStart = sectionMatch.index + sectionMatch[0].length;
    const rest = stripped.slice(sectionStart);
    const h2 = NEXT_H2_RE.exec(rest);
    const section = stripped.slice(sectionStart, h2 ? sectionStart + h2.index : stripped.length);

    BLOCKER_HEADING_RE.lastIndex = 0;
    const heads: Array<{ end: number; start: number; id: string }> = [];
    let hm: RegExpExecArray | null;
    while ((hm = BLOCKER_HEADING_RE.exec(section)) !== null) {
        heads.push({ start: hm.index, end: hm.index + hm[0].length, id: (hm[1] as string).trim() });
        if (hm.index === BLOCKER_HEADING_RE.lastIndex) {
            BLOCKER_HEADING_RE.lastIndex++;
        }
    }
    for (let i = 0; i < heads.length; i++) {
        const cur = heads[i] as { end: number; start: number; id: string };
        const bodyEnd =
            i + 1 < heads.length ? (heads[i + 1] as { start: number }).start : section.length;
        const body = section.slice(cur.end, bodyEnd);
        // Resolved is a prefix test for the same reason `blocker_is_resolved`
        // makes it one: `resolved 2026-09-08 by …` is resolved.
        if (!/^-[ \t]*\*\*Status:\*\*[ \t]*resolved\b/im.test(body)) {
            out.add(cur.id);
        }
    }
    return out;
}

/** Sorted `*.md` directly under the archive directory. */
function _globArchivedRoadmaps(): string[] {
    const dir = path.join(REPO_ROOT, 'agents', 'roadmaps', 'archive');
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => path.join(dir, e.name))
        .sort();
}

interface Overlap {
    id: string;
    active: string[];
    archived: string[];
}

/** id → the files (repo-relative, sorted by input order) declaring it open. */
function _openIdIndex(files: string[]): Map<string, string[]> {
    const index = new Map<string, string[]>();
    for (const f of files) {
        const rel = _relPosix(f, REPO_ROOT);
        for (const id of _openBlockerIds(fs.readFileSync(f, 'utf-8'))) {
            const hits = index.get(id);
            if (hits === undefined) {
                index.set(id, [rel]);
            } else {
                hits.push(rel);
            }
        }
    }
    return index;
}

/**
 * Blocker ids declared open in BOTH an active and an archived roadmap.
 *
 * The assertion is the one an archived record cannot legitimately make: a
 * blocker still being decided in the active tree, simultaneously declared open
 * in a file that says the work closed. The transition check in
 * `archive_completed_roadmaps` catches the archival that produces this state;
 * this catches it however else it arrives — a hand edit, a bad merge, or a
 * commit that shipped stale index content.
 *
 * `open_blockers` is a shrink-only ratchet over the ACTIVE tree only, so
 * without this the count is satisfiable by archiving rather than by resolving.
 *
 * Deliberately NOT "no id open in more than one file". Two ACTIVE roadmaps may
 * legitimately share one cross-cutting blocker, and forbidding that would break
 * a real pattern to catch a different defect (AI council 2026-09-08, 2/2
 * present: the unscoped form "forbids legitimate cross-cutting blockers in
 * multiple active roadmaps"). Two ARCHIVED files sharing an open id is out of
 * scope for the same day-one reason as the contract itself: measured at 2 on
 * this tree, so a hard assertion there would red the build on records this
 * change did not create.
 */
function _archiveOverlap(
    activeFiles: string[] = _globRoadmaps(),
    archivedFiles: string[] = _globArchivedRoadmaps(),
): Overlap[] {
    const active = _openIdIndex(activeFiles);
    const archived = _openIdIndex(archivedFiles);
    const out: Overlap[] = [];
    for (const [id, activeHits] of [...active.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const archivedHits = archived.get(id);
        if (archivedHits !== undefined) {
            out.push({ id, active: activeHits, archived: archivedHits });
        }
    }
    return out;
}

function main(): number {
    try {
        assertScanned({
            gate: 'lint_roadmap_blockers',
            scanned: _countRoadmapTree(path.join(REPO_ROOT, 'agents', 'roadmaps')),
            units: 'roadmap file(s)',
            roots: ['agents/roadmaps'],
        });
    } catch (e) {
        // 1 is the only failure code this gate defines.
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }
    const roadmaps = _globRoadmaps();
    if (roadmaps.length === 0) {
        if (!QUIET) {
            process.stdout.write(`✅  nothing in scope under ${ROADMAP_GLOB}\n`);
        }
        return 0;
    }
    const index = _targetIndex();
    let failed = 0;
    const undecidable: Array<{ rel: string; v: Violation }> = [];
    for (const roadmap of roadmaps) {
        const rel = _relPosix(roadmap, REPO_ROOT);
        const text = fs.readFileSync(roadmap, 'utf-8');
        const { hard, decidability } = _scanBoth(text, { selfStem: path.basename(roadmap, '.md'), index });
        for (const v of decidability) {
            undecidable.push({ rel, v });
        }
        if (hard.length) {
            failed += 1;
            process.stderr.write(`❌  ${rel}\n`);
            for (const v of hard) {
                process.stderr.write(`    line ${v.line}: ${v.message}\n`);
            }
        } else if (!QUIET) {
            process.stdout.write(`✅  ${rel}\n`);
        }
    }
    if (failed) {
        process.stderr.write(
            `\n❌  ${failed} roadmap(s) violate the ## Blockers contract — ` +
                'see .augment/rules/roadmap-progress-sync.md and ' +
                '.augment/templates/roadmaps.md rule 20\n',
        );
        return 1;
    }

    // An archived roadmap says the work closed. An open blocker declared in one
    // AND in an active roadmap therefore contradicts itself, and the shrink-only
    // `open_blockers` ratchet reads the active tree only — so without this the
    // count is satisfiable by archiving rather than by resolving.
    //
    // HARD rather than ratcheted, and measured before it shipped: 0 overlapping
    // ids on this tree at 2026-09-08 (12 active open ids, 33 archived), so on
    // the day it lands it fires on nothing and there is no backlog to
    // grandfather — the same argument the `Class:` contract above makes.
    const overlap = _archiveOverlap();
    if (overlap.length > 0) {
        process.stderr.write(
            `\n❌  ${overlap.length} blocker id(s) declared open in both an active ` +
                'and an archived roadmap\n',
        );
        for (const o of overlap) {
            process.stderr.write(`    ${o.id}\n`);
            for (const rel of o.active) {
                process.stderr.write(`        active:   ${rel}\n`);
            }
            for (const rel of o.archived) {
                process.stderr.write(`        archived: ${rel}\n`);
            }
        }
        process.stderr.write(
            '\n    Resolve it in one place. An archived record may keep a blocker that\n' +
                '    was genuinely unresolved when its roadmap closed; it may not keep one\n' +
                '    the active tree is still deciding.\n',
        );
        return 1;
    }

    // The decidability ratchet. A blocker that names no option, no command and
    // no recommendation is a research task handed to the person with the least
    // context — the defect this half of the gate exists to stop growing.
    const verdict = checkRatchet({
        gate: 'lint_roadmap_blockers:decidability',
        actual: undecidable.length,
        repoRoot: REPO_ROOT,
    });
    if (!verdict.ok) {
        process.stderr.write(`❌  ${verdict.message}\n`);
        for (const { rel, v } of undecidable) {
            process.stderr.write(`    ${rel}:${v.line}: ${v.message}\n`);
        }
        process.stderr.write(
            '\n    Every open blocker needs **Recommendation:** (which option, and why),\n' +
                '    **If you do nothing:** (the cost of the non-decision), and a\n' +
                '    **What to do:** carrying a command, a path or an enumerated option set.\n' +
                '    See templates/roadmaps.md rule 20.\n',
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(`\n✅  ${roadmaps.length} roadmap(s) blocker-contract-clean\n`);
        process.stdout.write(
            `✅  0 blocker id(s) open in both an active and an archived roadmap ` +
                `(${_globArchivedRoadmaps().length} archived file(s) read)\n`,
        );
        process.stdout.write(`✅  ${verdict.message}\n`);
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

export {
    REPO_ROOT,
    ROADMAP_GLOB,
    _stripFencedCode,
    REQUIRED_FIELDS,
    DECIDABILITY_FIELDS,
    KNOWN_CLASSES,
    RUNNABLE_CLASSES,
    OWNER_OWNED_CLASSES,
    TECHNICAL_CLASSES,
    _blockerClass,
    _hasExecutableSubstance,
    _scan,
    _scanBoth,
    _targetIndex,
    _globRoadmaps,
    _globArchivedRoadmaps,
    _openBlockerIds,
    _archiveOverlap,
    main,
};
export type { Violation, ScanResult, Overlap, ScanContext, TargetIndex };
