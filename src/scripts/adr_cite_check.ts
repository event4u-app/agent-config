#!/usr/bin/env tsx
/**
 * ADR cite-check — evaluate a decision BEFORE citing it as a reason not to act.
 *
 * The defect this closes is one of ordering, not of permission. Measured across
 * 26 days of transcripts: in at least 13 passages a change was parked or refused
 * citing a named ADR, and in zero cases did the agent refuse an explicit
 * overturn instruction. The lock held, the owner had to notice and void it
 * retroactively, and only then did the work resume. Nothing in the tree turned
 * "this ADR blocks the change" into "is this ADR still true?".
 *
 * So this tool answers exactly that question, and only from what is mechanically
 * decidable:
 *
 *   - **status** — a `superseded` / `deprecated` ADR is not a live lock at all.
 *     This alone resolves a class of blockage with certainty. `rejected` is
 *     deliberately excluded: on an ADR it records a rejected PROPOSAL, so the
 *     rejection is the live decision.
 *   - **successors and predecessors** — `superseded_by` / `supersedes`, plus the
 *     `amended_by` / `amends` pair.
 *   - **amendment blocks in the body** — three unreconciled conventions exist in
 *     the corpus, so all three are matched.
 *   - **back-references** — other ADRs that name this one. A decision reopened
 *     by a later ADR that never linked back is invisible from the ADR's own file
 *     (measured: ADR-035 still asserts a rejection ADR-232 reopened).
 *   - **review_trigger** — verbatim, plus a state.
 *
 * `indeterminate` is a FIRST-CLASS trigger result, not a failure. Almost every
 * `review_trigger` in the corpus is a semantic condition ("reopen when the
 * capacity premise changes", "if a fifth band appears"), so forcing them to a
 * boolean would convert uncertainty into either permission or blockage. Both
 * council seats (2026-08-19) independently rejected building a machine-readable
 * trigger grammar as a prerequisite for exactly this reason. An `indeterminate`
 * result means: this may not be presented as an unqualified lock — route it.
 *
 * THE DATED SUB-CLASS, AND WHY THE 2026-08-19 REJECTION DOES NOT REACH IT
 * ----------------------------------------------------------------------
 * The sentence above used to open "Every `review_trigger` in the corpus is a
 * semantic condition"; it is weakened rather than deleted because the claim was
 * true when written and one record has since falsified it.
 *
 * What those two seats rejected was forcing SEMANTIC conditions to a boolean.
 * A trigger that OPENS with a calendar date is not one: `fired` / `not-fired`
 * is decided by comparing that date to `asOf()`, which is arithmetic and
 * carries no interpretation of the tree, so a second reader of the same commit
 * gets the same answer. That is the entire carve-out — a leading
 * `Expiry YYYY-MM-DD`, or a bare leading ISO date, and nothing else. A
 * condition that merely MENTIONS a date somewhere in its prose ("revisit at the
 * 2026-11-10 review date, or earlier on either observable event") is a semantic
 * condition and stays `indeterminate`, which is what keeps this from being the
 * rejected grammar by increments.
 *
 * `dated-unparsed` exists so the carve-out cannot fail silently. A trigger that
 * announces itself as dated and whose date this parser cannot read is a defect
 * in the record or in the parser; returning `indeterminate` for it would hide
 * that defect behind the exact state every trigger had before the carve-out
 * existed, where no test could ever see it as a regression.
 *
 * It also prints the two descriptive axes (`provenance`, `evidence`) and
 * `authority_basis`, and for an accepted E0/E1 record that does NOT carry
 * `authority_basis: owner_intent` it prints
 * `authority_effect: disabled-shadow-mode` — see LOW_EVIDENCE_NOTICE.
 * Provenance is deliberately NOT part of that condition: the notice is about
 * evidence strength, and a human snapshot has exactly as little of it.
 *
 * It prints three more record fields, so that a revisit read can be performed
 * from this tool instead of from the file by hand: `evidence.basis` verbatim
 * (with a `[found]` / `[MISSING]` marker on the refs that are repo paths — a
 * URL and a `claim:` id are printed and never checked), the RESOLVED
 * `reopen_policy` marked declared-or-defaulted, and `protected_dimensions`.
 *
 * What it deliberately does not print: whether the proposed transition is
 * reversible. That is a property of the PROPOSAL, not of the record, so no
 * reader of an ADR file can supply it — the citer does.
 * Shadow mode means exactly what the word says: the axes are surfaced, and no
 * grade changes who may act (`adr-layout § Provenance and evidence`).
 *
 * Usage:
 *   ./scripts-run src/scripts/adr_cite_check ADR-211
 *   ./scripts-run src/scripts/adr_cite_check ADR-001 ADR-035 --json
 *   ./scripts-run src/scripts/adr_cite_check --cited        # the CI gate
 *
 * `--cited` is the CI invocation: it resolves every ADR citation found in
 * `src/rules/`, `src/skills/`, `src/domains/` and `docs/` against the corpus
 * and reds when one points nowhere. Until it existed no workflow ran this tool
 * at all — only a test imported it — so every "enforced at cite time" claim
 * about this file was model-carried.
 *
 * Exit codes: 0 every reference resolved · 1 at least one did not · 2 usage.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    type AdrFrontmatter,
    authorityBasisOf,
    dated_trigger_day,
    DATED_TRIGGER_PROBE,
    iso_day,
    evidenceOf,
    isLowEvidenceAccepted,
    provenanceOf,
    readAdrFrontmatter,
    readAdrFrontmatterScalars,
} from './_lib/adr_frontmatter.js';
import { asOf } from './_lib/as_of.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');

/**
 * The tree the corpus mode reads, overridable for `--self-test`.
 *
 * The self-test drives the REAL binary — argv parsing, entry guard and all —
 * over a synthetic tree, which is the whole point of the harness
 * (`_lib/gate_self_test.ts`): an in-process call would skip exactly the layers
 * that have silently no-opped in this repository before. Driving it needs one
 * seam, and this is it.
 */
function scan_root(): string {
    return process.env['ADR_CITE_CHECK_ROOT'] ?? REPO_ROOT;
}

/**
 * The surfaces a decision can live on. Six exist in this tree; this tool reads
 * the two that carry numbered ADRs and can therefore be cited as `ADR-NNN`.
 *
 * Deliberately NOT covered, stated rather than silently skipped:
 * `docs/contracts/adr-*.md` (15 files) and `agents/settings/contexts/adr-*.md`
 * (6) are named-slug contracts with their own status vocabulary (`Decided`,
 * `locked`) and no ADR number, so a numeric reference can never resolve to one;
 * `agents/decisions/` is a ledger of rows, not of files. A tool that silently
 * saw one of six surfaces would report a real lock as unknown, which reads as
 * "no constraint" and is worse than the stall it replaces — so the gap is
 * printed in `--json` under `surfaces_not_scanned` and named here.
 *
 * The per-area surface took two passes to get honest. Its files are
 * `<area>/NNNN-<slug>.md` with no `ADR-` prefix, so the flat filename pattern
 * could never match one — the directory was listed as scanned and resolved
 * nothing, which is the same false "not found" the paragraph above warns
 * about, committed by this very file. It resolves by path and by the
 * `ADR-<area>-NNNN` citation form now; a BARE number still cannot address one,
 * because per-area numbering restarts per area and five files here are `0001`.
 * A per-area hit now carries the same metadata as a flat one: all seven
 * records gained YAML frontmatter on 2026-08-21, so `PARTIAL_COVERAGE` is
 * empty and no residual limit is claimed for this surface.
 */
export const ADR_DIRS = ['docs/decisions', 'docs/adrs'] as const;

export const SURFACES_NOT_SCANNED = [
    'docs/contracts/adr-*.md — slug-named contracts, no ADR number to resolve against',
    'agents/settings/contexts/adr-*.md — shadow notes, own status vocabulary',
    'agents/decisions/ — row ledger, not per-decision files',
] as const;

/**
 * Partial coverage — empty, and the KEY is kept deliberately.
 *
 * The single entry this held is gone. It said `docs/adrs/<area>/` resolves by
 * PATH and by the `ADR-<area>-NNNN` citation form while those files carry a
 * quote-block header rather than YAML, so `status` / `review_trigger` / the
 * link fields read as absent. All seven per-area records carry real
 * frontmatter as of 2026-08-21, so that gap closed — and its replacement text
 * was prose asserting the absence of partial coverage inside a field named for
 * its presence, plus a "remove on the next pass" TODO, shipped into `--json`.
 *
 * The key stays. `partial_coverage` is a published output shape (see the
 * `--json` payload), so removing it breaks any consumer that reads it, while
 * an empty list states exactly what is true: no partial coverage is known
 * today. This is the place to record the next one.
 */
export const PARTIAL_COVERAGE: readonly string[] = [];

/**
 * A trigger state. `none` means the ADR never recorded a reopen condition;
 * `dated-unparsed` means it recorded one that announces a date this parser
 * could not read, which is a defect and not an answer.
 */
export type TriggerState = 'none' | 'indeterminate' | 'fired' | 'not-fired' | 'dated-unparsed';

export interface CiteResult {
    ref: string;
    resolved: boolean;
    file?: string;
    status?: string;
    date?: string;
    decision?: string;
    review_trigger?: string;
    trigger_state: TriggerState;
    supersedes?: string;
    superseded_by?: string;
    amends?: string;
    amended_by?: string;
    /** Amendment headings found in the body, any of the three conventions. */
    amendment_blocks: string[];
    /** Other ADR files whose text names this one. */
    referenced_by: string[];
    /** `provenance.kind` — who decided. Absent when the record carries no axis. */
    provenance_kind?: string;
    /** `provenance.agentic_mode` — descriptive shape of an agentic decision. */
    provenance_agentic_mode?: string;
    /** `evidence.strength` — E0–E4, claim-relative. */
    evidence_strength?: string;
    /** `evidence.discovery` — `complete` | `incomplete`; required on E0. */
    evidence_discovery?: string;
    /**
     * `evidence.basis` — the refs the grade rests on, VERBATIM.
     *
     * Present only when the record declares at least one. The tool prints them;
     * whether each one still supports the claim is the citer's read, not a
     * verdict this file may issue.
     */
    evidence_basis?: string[];
    /**
     * The subset of `evidence_basis` that looks like a repo path and does NOT
     * exist in this checkout — the one existence question that is cheap and
     * decidable here. A URL or a `claim:` id is never listed: liveness of a URL
     * needs the network, and a claim id resolves against the claim registry,
     * neither of which this tool touches. Set (possibly empty) whenever
     * `evidence_basis` is set, so an empty list means "checked, all present"
     * rather than "not checked".
     */
    evidence_basis_unresolved?: string[];
    /** `authority_basis` — `evidence` (default) or `owner_intent`. */
    authority_basis?: string;
    /**
     * `reopen_policy`, RESOLVED — `directional` | `owner` | `unclassified`.
     *
     * Never blank on a resolved record: `adr-layout § Reopen authority` states
     * that an absent field resolves to `unclassified`, and printing a blank
     * would make an agent re-derive a default the contract already fixed.
     * `reopen_policy_defaulted` says which of the two it was, because
     * "nobody classified this" and "someone classified it as unclassified" are
     * the same value and not the same fact.
     */
    reopen_policy?: string;
    /** True when `reopen_policy` was absent and resolved to `unclassified`. */
    reopen_policy_defaulted?: boolean;
    /**
     * `protected_dimensions` — the reserved interests this record touches.
     * Empty list when the record declares none; that is not the same as
     * "no dimension is reserved for the transition being proposed", which is a
     * property of the proposal and outside anything a record can say.
     */
    protected_dimensions?: string[];
    /**
     * What the axes say a cite-time reader may draw from this record.
     *
     * Present only as `disabled-shadow-mode`, and only for an accepted E0/E1
     * record that does NOT carry `authority_basis: owner_intent`.
     *
     * Provenance is deliberately NOT part of that condition, and this docstring
     * said "accepted + agentic + E0/E1" after the predicate had stopped
     * checking provenance — caught in completion review. The notice is about
     * evidence strength, which a human snapshot has exactly as little of; the
     * real exemption is an owner purpose statement, whose alternatives are
     * foreclosed by ownership rather than by evidence.
     *
     * The literal is deliberate: no grade authorizes anything here, so the
     * field reports a *disabled* effect rather than asserting a permission
     * that does not exist. Whether one ever may is Phase 7's open question.
     */
    authority_effect?: string;
    /** Why this may or may not be cited as a live lock. */
    verdict: string;
}

/**
 * The block printed for a record whose own metadata says it may not establish
 * that the alternatives remain invalid.
 *
 * Emitted verbatim and unindented so the whole block is greppable as one
 * literal — the string `disabled-shadow-mode` is the load-bearing token and a
 * reader (or a downstream check) must be able to match it without knowing this
 * renderer's indentation.
 */
export const LOW_EVIDENCE_NOTICE = [
    'authority_effect: disabled-shadow-mode',
    'This record documents the prior choice. It does not by itself',
    'establish that alternatives remain invalid.',
].join('\n');

/**
 * A parsed citation. `area` is null for the flat surface.
 *
 * Per-area numbering restarts at `0001` inside every area, so a bare number
 * cannot address one: five files in this tree are `0001`. A per-area citation
 * must therefore name its area — `ADR-cost-0001`, the form `adr-layout.md`
 * already specifies for cross-surface `supersedes:` values.
 */
export interface ParsedRef {
    id: string;
    area: string | null;
    num: string;
}

/**
 * `ADR-211` · `adr-211` · `211` · a path → the flat surface.
 * `ADR-cost-0001` · a `docs/adrs/<area>/NNNN-…` path → that area.
 */
export function normalise_ref(ref: string): ParsedRef | null {
    const raw = ref.trim();

    // A per-area path carries its area in the directory, and its file never
    // has an `ADR-` prefix — `docs/adrs/cost/0001-hard-stop-hook.md`.
    const byPath = /(?:^|\/)docs\/adrs\/([a-z0-9-]+)\/(\d{1,4})-/i.exec(raw);
    if (byPath?.[1] !== undefined && byPath[2] !== undefined) {
        const num = byPath[2].padStart(4, '0');
        return { id: `ADR-${byPath[1]}-${num}`, area: byPath[1], num };
    }

    // `ADR-<area>-NNNN` — the citation form for a per-area decision.
    const byArea = /^adr-([a-z][a-z0-9-]*?)-(\d{1,4})$/i.exec(raw.replace(/\.md$/i, ''));
    if (byArea?.[1] !== undefined && byArea[2] !== undefined) {
        const area = byArea[1].toLowerCase();
        const num = byArea[2].padStart(4, '0');
        return { id: `ADR-${area}-${num}`, area, num };
    }

    const m = /(?:^|[^0-9])(\d{1,4})(?:[^0-9]|$)/.exec(raw.replace(/^.*\//, ''));
    if (m?.[1] === undefined) return null;
    return { id: `ADR-${m[1].padStart(3, '0')}`, area: null, num: String(Number(m[1])) };
}

function walk_md(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk_md(full));
        // INDEX.md is generated FROM these files and names every one of them, so
        // leaving it in makes every ADR look referenced by one more decision
        // than it is — noise that hides the single real back-reference.
        else if (entry.name.endsWith('.md') && entry.name !== 'INDEX.md') out.push(full);
    }
    return out.sort();
}

/** Every candidate decision file across the scanned surfaces. */
export function adr_files(repo_root: string = REPO_ROOT): string[] {
    return ADR_DIRS.flatMap((d) => walk_md(path.join(repo_root, d)));
}

// ---------------------------------------------------------------------------
// The CI corpus: every ADR the tree cites at someone.
//
// WHAT THE GATE FAILS ON, and why it is this and not something else.
//
// A malformed axis (`evidence.strength: E9`, an E0 with no `discovery`) is
// already `check_adr_frontmatter`'s job, and duplicating it here would buy a
// second red for one defect while leaving this gate's real subject unguarded.
// The condition only THIS tool computes is an **unresolvable citation**: a
// rule, skill, domain or doc that names `ADR-NNN` where no decision record
// carries that number on a scanned surface. That is a live defect class in this
// tree — a lock cited by number that a reader cannot open is the same
// false-absence failure `verdict_for` was written for, seen from the citing
// side — and `cite_check` already decides it (`resolved: false` → exit 1).
//
// So the CI invocation resolves every citation in `src/rules/`, `src/skills/`,
// `src/domains/` and `docs/` against the corpus, and reds when any one of them
// points nowhere.
// ---------------------------------------------------------------------------

/** The trees whose ADR citations the CI invocation resolves. */
export const CITATION_ROOTS = ['src/rules', 'src/skills', 'src/domains', 'docs'] as const;

const CITATION_FILE_EXTS = new Set(['.md', '.ts', '.yml', '.yaml']);

/**
 * A citation, in the two forms `normalise_ref` can resolve.
 *
 * The trailing `(?![0-9A-Za-z])` rejects the template placeholders the corpus
 * really contains — `ADR-0N` in `producing-the-review.md` and `ADR-206`, which
 * would otherwise be discovered as a citation to `ADR-0`.
 *
 * The per-area alternative requires the area to START with a letter, which is
 * what `normalise_ref`'s own `byArea` pattern requires and is not cosmetic:
 * without it, the filename reference `ADR-082-410-one-click-relaunch.md` is
 * discovered as `ADR-082-410` (area `082`), and prose like a dated sweep name
 * would be discovered as a citation to an area that does not exist — a
 * manufactured red. A per-area citation whose area contains a hyphen is
 * therefore NOT discovered by this scan; all six live areas are single words,
 * and `normalise_ref` still resolves such a citation when it is passed
 * explicitly. Stated rather than left as a silent narrowing.
 */
const CITATION_RE = /ADR-(?:[a-z][a-z0-9]*-\d{1,4}|\d{1,4})(?![0-9A-Za-z])/g;

function walk_citable(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk_citable(full));
        else if (CITATION_FILE_EXTS.has(path.extname(entry.name))) out.push(full);
    }
    return out.sort();
}

/** Every distinct ADR reference the citation roots name, sorted. */
export function cited_refs(repo_root: string = REPO_ROOT): string[] {
    const found = new Set<string>();
    for (const root of CITATION_ROOTS) {
        for (const file of walk_citable(path.join(repo_root, root))) {
            for (const m of fs.readFileSync(file, 'utf-8').matchAll(CITATION_RE)) {
                found.add(m[0]);
            }
        }
    }
    return [...found].sort();
}

/**
 * Minimal frontmatter reader — folded (`>-`) values are joined, which the
 * corpus needs: every `review_trigger` in it is a folded multi-line string.
 */
/**
 * Read the leading `---` block.
 *
 * Delegates to the shared reader (`_lib/adr_frontmatter.ts`); this function was
 * one of the three divergent copies that reader replaces. Kept as a named
 * export because the test suite imports it.
 */
export function parse_frontmatter(text: string): Record<string, string> | null {
    return readAdrFrontmatterScalars(text);
}

/**
 * `protected_dimensions` off the shared reader's node, narrowed — not parsed.
 *
 * The field is written inline (`protected_dimensions: [governance]`), so the
 * shared reader hands it back under `nested` as a string list. This only
 * narrows that node; adding a second parser for a field one reader already
 * reads is how the tree ended up with three divergent ADR parsers.
 */
export function protected_dimensions_of(fm: AdrFrontmatter): string[] {
    const node = fm.nested['protected_dimensions'];
    if (Array.isArray(node)) return node;
    if (typeof node === 'string' && node !== '') return [node];
    return [];
}

/**
 * Which `evidence.basis` refs are repo paths that are not there any more.
 *
 * Deliberately narrow. A ref is checked ONLY when it looks like a repo-relative
 * path — no scheme, no `claim:` prefix. A trailing `(YYYY-MM-DD)` access note
 * and a `:LINE` / `:LINE-LINE` anchor are stripped before the check, because
 * both appear in the corpus and neither is part of the filename.
 *
 * What this does NOT do, stated because the difference is the whole point: it
 * does not fetch a URL, does not resolve a `claim:` id against the claim
 * registry, and does not judge whether a ref that EXISTS still supports the
 * grade. "The file is present" is the only claim made.
 */
export function unresolved_basis_refs(basis: readonly string[], repo_root: string): string[] {
    const missing: string[] = [];
    for (const ref of basis) {
        if (basis_ref_kind(ref) !== 'path') continue;
        if (!fs.existsSync(path.join(repo_root, basis_ref_path(ref)))) missing.push(ref);
    }
    return missing;
}

/** `url` and `claim` refs are printed and never checked; `path` refs are. */
export function basis_ref_kind(ref: string): 'url' | 'claim' | 'path' {
    const t = ref.trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return 'url';
    if (/^claim:/i.test(t)) return 'claim';
    return 'path';
}

/** Strip a trailing `(note)` and a `:LINE[-LINE]` anchor off a path-shaped ref. */
function basis_ref_path(ref: string): string {
    return ref
        .trim()
        .replace(/\s*\([^)]*\)\s*$/, '')
        .replace(/:\d+(-\d+)?$/, '')
        .trim();
}

/**
 * The three amendment conventions the corpus actually uses. No convention is
 * canonical yet, so all three are matched rather than one being assumed.
 */
export function amendment_blocks(body: string): string[] {
    const found: string[] = [];
    for (const line of body.split('\n')) {
        if (/^#{2,3}\s+Amendment\b/i.test(line) || /^\*\*Amended\b/i.test(line)) {
            found.push(line.trim().replace(/^#+\s*/, '').replace(/\*\*/g, ''));
        }
    }
    return found;
}

/**
 * A trigger's state, from what is mechanically decidable and nothing else.
 *
 * Two clauses return a decided answer, and both read a leading calendar date
 * and nothing else — see `DATED_TRIGGER_RE` for why the anchor is the safety
 * property. Every semantic trigger still returns `indeterminate`, which is a
 * first-class result here and not a failure.
 *
 * The clock is read ONLY when a dated trigger is actually present — `asOf()`
 * warns on stderr for an unpinned run, and a corpus with no dated trigger has
 * no verdict that depends on the hour, so announcing one there would be noise
 * on a stream other tools read beside the payload.
 *
 * @param asOfDate the "now" to compare against; defaults to the `asOf()` seam,
 *                 so a CI run compares against the commit date and is
 *                 reproducible from the commit alone.
 */
export function trigger_state(fm: Record<string, string>, asOfDate?: Date): TriggerState {
    const t = (fm['review_trigger'] ?? '').trim();
    if (t === '') return 'none';
    // The transitional migration value records that no condition has been
    // written yet, so it is `none` rather than `indeterminate`. Mapping it to
    // `indeterminate` would report "a condition exists, its state is unknown"
    // for a record that has no condition at all — the opposite of what the
    // staging is for, and indistinguishable at a glance from a real trigger
    // nobody has evaluated. Found in completion review; the field did not
    // exist in this file's corpus when the mapping was written.
    if (t.toLowerCase() === 'unclassified') return 'none';
    const day = dated_trigger_day(t);
    if (day !== null) return iso_day(asOfDate ?? asOf()) >= day ? 'fired' : 'not-fired';
    if (DATED_TRIGGER_PROBE.test(t)) return 'dated-unparsed';
    return 'indeterminate';
}

/** The one-line answer to "may I cite this as a reason not to act?". */
export function verdict_for(r: Omit<CiteResult, 'verdict'>): string {
    if (!r.resolved) return 'UNRESOLVED — no ADR file carries this number on a scanned surface.';
    const status = (r.status ?? '').toLowerCase();
    // `rejected` is deliberately NOT in this set. On an ADR it means "the
    // proposal was rejected" — the record is a LIVE lock stating that
    // rejection, not a dead decision. Folding it in with `superseded` would
    // make the tool clear a lock that still binds, which is a worse failure
    // than the stall it replaces. Found by running this tool over the eleven
    // ADRs the transcripts show blocking work: ADR-054 came back "not a live
    // lock" and it is one.
    if (status === 'superseded' || status === 'deprecated') {
        const by = r.superseded_by !== undefined && r.superseded_by !== '—' ? ` (by ${r.superseded_by})` : '';
        return `NOT A LIVE LOCK — status is \`${status}\`${by}. Citing it as a blocker is a stale-state claim.`;
    }
    if (status === 'challenged') {
        // Reported DISTINCTLY from `accepted` and from `superseded`, and it is a
        // LIVE lock. `challenged` records "accepted, and under active question";
        // it names no successor and suspends nothing. If citing it cleared the
        // lock, the status would become a way to stop obeying a decision without
        // reopening it — road-to-decision-conformance 1.2 names that as the
        // failure to prevent, and this branch is where it would have happened.
        return (
            'LIVE, CHALLENGED — the decision is under active question and STILL BINDS. ' +
            'A challenge is not a successor: nothing has replaced this record. Read the ' +
            'challenge, then either satisfy it or route the reopening — do not treat the ' +
            'status as permission to act against the decision.'
        );
    }
    if (status === 'rejected') {
        return (
            'LIVE — status `rejected` records a REJECTED PROPOSAL, so the rejection is the ' +
            'decision and it still binds. Reopening it means showing the premise it rejected on ' +
            'has changed; it does not mean the record is stale.'
        );
    }
    if (r.amendment_blocks.length > 0 || (r.amended_by !== undefined && r.amended_by !== '—')) {
        return 'AMENDED — read the amendment before citing the original decision; the text above it may no longer hold.';
    }
    if (r.trigger_state === 'none') {
        return 'LIVE, NO REOPEN CONDITION — the ADR records no `review_trigger`, so nothing would ever reopen it on its own. Treat that as a defect in the ADR, not as strength of the lock.';
    }
    if (r.trigger_state === 'fired') {
        return 'LIVE, TRIGGER FIRED — the reopen condition is a date and that date has passed. The record still binds until someone acts on it, and citing it without naming the fired trigger presents a lapsed review as a current one.';
    }
    if (r.trigger_state === 'not-fired') {
        return 'LIVE, TRIGGER NOT YET FIRED — the reopen condition is a date still in the future. This is the one state in which a trigger genuinely adds nothing to the citation, and it stops being true on a known day.';
    }
    if (r.trigger_state === 'dated-unparsed') {
        return 'LIVE, DATED TRIGGER UNREADABLE — the reopen condition announces a date this tool could not parse. That is a defect in the record or in the parser, not a verdict: fix the trigger to open with `Expiry YYYY-MM-DD` rather than reading this as "unknown".';
    }
    return 'LIVE, TRIGGER INDETERMINATE — the reopen condition is semantic and this tool cannot decide it. Not an unqualified lock: evaluate the condition against the current tree and route the result.';
}

export function cite_check(refs: string[], repo_root: string = REPO_ROOT): CiteResult[] {
    const files = adr_files(repo_root);
    const contents = new Map<string, string>();
    for (const f of files) contents.set(f, fs.readFileSync(f, 'utf-8'));

    return refs.map((ref) => {
        const parsed = normalise_ref(ref);
        if (parsed === null) {
            const empty: Omit<CiteResult, 'verdict'> = {
                ref,
                resolved: false,
                trigger_state: 'none',
                amendment_blocks: [],
                referenced_by: [],
            };
            return { ...empty, verdict: verdict_for(empty) };
        }
        const { id, area, num } = parsed;

        // Two filename conventions, and the flat one's `ADR-` prefix is exactly
        // what a per-area file does NOT have (`docs/adrs/cost/0001-…`). Matching
        // both against one pattern was the defect: the tool advertised
        // `docs/adrs` as covered and could never resolve a citation to it.
        const match =
            area === null
                ? files.find((f) => new RegExp(`(^|/)ADR-0*${num}[-.]`, 'i').test(f))
                : files.find((f) =>
                      new RegExp(`/docs/adrs/${area}/0*${Number(num)}-`, 'i').test(f),
                  );
        if (match === undefined) {
            const empty: Omit<CiteResult, 'verdict'> = {
                ref: id,
                resolved: false,
                trigger_state: 'none',
                amendment_blocks: [],
                referenced_by: [],
            };
            return { ...empty, verdict: verdict_for(empty) };
        }

        const text = contents.get(match) ?? '';
        const fm = parse_frontmatter(text) ?? {};
        // The two nested axes need the structured reader; `parse_frontmatter`
        // folds them back to a string for scalar-only callers. `null` here is
        // the honest answer for a record predating the axes — no longer for a
        // per-area record: all seven carry real frontmatter as of 2026-08-21
        // and read through exactly the same path as a flat one.
        const structured = readAdrFrontmatter(text);
        const provenance = structured === null ? null : provenanceOf(structured);
        const evidence = structured === null ? null : evidenceOf(structured);
        const basis = structured === null ? null : authorityBasisOf(structured);
        const evidence_basis = evidence?.basis ?? [];
        // `adr-layout § Reopen authority`: absent resolves to `unclassified`,
        // and deliberately NOT to `owner` — fail-closed there would encode the
        // existing blockage into the schema. A record with no frontmatter at
        // all resolves the same way, for the same reason.
        const declared_policy = fm['reopen_policy'];
        const reopen_policy =
            declared_policy !== undefined && declared_policy !== '' ? declared_policy : 'unclassified';
        const reopen_policy_defaulted = declared_policy === undefined || declared_policy === '';
        const protected_dimensions = structured === null ? [] : protected_dimensions_of(structured);
        const provisional = structured !== null && isLowEvidenceAccepted(structured);
        const bodyStart = text.indexOf('\n---\n', 4);
        const body = bodyStart === -1 ? text : text.slice(bodyStart + 5);

        // Back-references: any OTHER decision file naming this number. This is
        // the only way to see a one-sided reopen — the amending ADR links back,
        // the amended one does not.
        // A per-area decision is cited as `ADR-<area>-NNNN`; a flat one by number.
        const cited =
            area === null
                ? new RegExp(`ADR-0*${num}\\b`, 'i')
                : new RegExp(`ADR-${area}-0*${Number(num)}\\b`, 'i');
        const referenced_by = files
            .filter((f) => f !== match && cited.test(contents.get(f) ?? ''))
            .map((f) => path.relative(repo_root, f));

        const partial: Omit<CiteResult, 'verdict'> = {
            ref: id,
            resolved: true,
            file: path.relative(repo_root, match),
            ...(fm['status'] !== undefined ? { status: fm['status'] } : {}),
            ...(fm['date'] !== undefined ? { date: fm['date'] } : {}),
            ...(fm['decision'] !== undefined ? { decision: fm['decision'] } : {}),
            ...(fm['review_trigger'] !== undefined && fm['review_trigger'] !== ''
                ? { review_trigger: fm['review_trigger'] }
                : {}),
            trigger_state: trigger_state(fm),
            ...(fm['supersedes'] !== undefined ? { supersedes: fm['supersedes'] } : {}),
            ...(fm['superseded_by'] !== undefined ? { superseded_by: fm['superseded_by'] } : {}),
            ...(fm['amends'] !== undefined ? { amends: fm['amends'] } : {}),
            ...(fm['amended_by'] !== undefined ? { amended_by: fm['amended_by'] } : {}),
            amendment_blocks: amendment_blocks(body),
            referenced_by,
            ...(provenance?.kind !== undefined && provenance.kind !== null
                ? { provenance_kind: provenance.kind }
                : {}),
            ...(provenance?.agenticMode !== undefined && provenance.agenticMode !== null
                ? { provenance_agentic_mode: provenance.agenticMode }
                : {}),
            ...(evidence?.strength !== undefined && evidence.strength !== null
                ? { evidence_strength: evidence.strength }
                : {}),
            ...(evidence?.discovery !== undefined && evidence.discovery !== null
                ? { evidence_discovery: evidence.discovery }
                : {}),
            ...(evidence_basis.length > 0
                ? {
                      evidence_basis,
                      evidence_basis_unresolved: unresolved_basis_refs(evidence_basis, repo_root),
                  }
                : {}),
            ...(basis !== null ? { authority_basis: basis } : {}),
            reopen_policy,
            reopen_policy_defaulted,
            protected_dimensions,
            ...(provisional ? { authority_effect: 'disabled-shadow-mode' } : {}),
        };
        return { ...partial, verdict: verdict_for(partial) };
    });
}

function render(results: CiteResult[]): string {
    const lines: string[] = [];
    for (const r of results) {
        lines.push(`\n${r.ref}${r.file !== undefined ? `  ·  ${r.file}` : ''}`);
        if (!r.resolved) {
            lines.push(`  ❌  ${r.verdict}`);
            continue;
        }
        lines.push(`  status           ${r.status ?? '—'}   date ${r.date ?? '—'}`);
        if (r.decision !== undefined) lines.push(`  decision         ${r.decision}`);
        lines.push(`  review_trigger   ${r.review_trigger ?? '— (none recorded)'}`);
        lines.push(`  trigger state    ${r.trigger_state}`);
        if (r.supersedes !== undefined && r.supersedes !== '—') lines.push(`  supersedes       ${r.supersedes}`);
        if (r.superseded_by !== undefined && r.superseded_by !== '—')
            lines.push(`  superseded_by    ${r.superseded_by}`);
        if (r.amends !== undefined && r.amends !== '—') lines.push(`  amends           ${r.amends}`);
        if (r.amended_by !== undefined && r.amended_by !== '—') lines.push(`  amended_by       ${r.amended_by}`);
        if (r.amendment_blocks.length > 0)
            lines.push(`  amendments       ${String(r.amendment_blocks.length)}: ${r.amendment_blocks.join(' · ')}`);
        if (r.referenced_by.length > 0)
            lines.push(`  referenced by    ${String(r.referenced_by.length)} other ADR(s): ${r.referenced_by.join(', ')}`);

        // The two descriptive axes. Printed for every resolved record, absent
        // or not: "the axis is missing" is itself the thing a citer needs to
        // see — a record with no grade has not been assessed, which is not the
        // same as a record assessed as weak.
        const provenanceLine = r.provenance_kind ?? '— (no provenance axis)';
        const mode = r.provenance_agentic_mode !== undefined ? `  ·  mode ${r.provenance_agentic_mode}` : '';
        lines.push(`  provenance       ${provenanceLine}${mode}`);
        lines.push(
            `  evidence         ${r.evidence_strength ?? '— (ungraded)'}` +
                `  ·  discovery ${r.evidence_discovery ?? '—'}`,
        );
        lines.push(`  authority_basis  ${r.authority_basis ?? '— (absent → evidence)'}`);

        // The basis refs, verbatim, one per line with an existence marker. A
        // grade with no readable basis is the thing a citer has to see, so the
        // absent case prints too rather than dropping the line.
        if (r.evidence_basis === undefined || r.evidence_basis.length === 0) {
            lines.push('  evidence_basis   — (none recorded)');
        } else {
            const unresolved = new Set(r.evidence_basis_unresolved ?? []);
            lines.push(
                `  evidence_basis   ${String(r.evidence_basis.length)} ref(s), ` +
                    `${String(unresolved.size)} unresolved:`,
            );
            for (const ref of r.evidence_basis) {
                const kind = basis_ref_kind(ref);
                const marker =
                    kind !== 'path'
                        ? `[not checked: ${kind}]`
                        : unresolved.has(ref)
                          ? '[MISSING]'
                          : '[found]';
                lines.push(`                     ${marker} ${ref}`);
            }
        }

        // The two reserved-authority fields, printed together because the
        // routing question reads them together. `protected_dimensions` names
        // what the RECORD reserves; whether a given transition weakens one is a
        // property of the proposal and is nothing this tool can print.
        const policyNote = r.reopen_policy_defaulted === true ? ' (absent → default)' : ' (declared)';
        const dims =
            r.protected_dimensions !== undefined && r.protected_dimensions.length > 0
                ? r.protected_dimensions.join(', ')
                : '— (none declared)';
        lines.push(`  reopen_policy    ${r.reopen_policy ?? 'unclassified'}${policyNote}`);
        lines.push(`  protected dims   ${dims}`);
        lines.push(`  →  ${r.verdict}`);
        // Verbatim + unindented, on purpose: see LOW_EVIDENCE_NOTICE.
        if (r.authority_effect === 'disabled-shadow-mode') lines.push(LOW_EVIDENCE_NOTICE);
    }
    return lines.join('\n');
}


/**
 * `--self-test` — drives the REAL binary over synthetic trees.
 *
 * Not optional for a new gate: `gate-self-test:registered-non-adopters`
 * (`check_gate_coverage.list_self_test_non_adopters`) is a shrink-only count
 * over the enforced manifest, so registering this gate without a self-test
 * would raise it and red CI. That ratchet is working as designed — the cheapest
 * moment to prove a gate discriminates is when it is written, and an enforced
 * `scanned:` floor only proves the gate READ something.
 *
 * Both reject cases were run by hand before they were written down, and both
 * were seen red: a planted `ADR-993` citation exited 1, and a citation root
 * with no ADR reference in it exited 1 through `DeadScopeError`. A case never
 * seen red has unknown sensitivity.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-'));

    /** Build a tree with one flat ADR and one citing rule; return its root. */
    const mk = (adr: string | null, citation: string | null): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'root-'));
        fs.mkdirSync(path.join(root, 'docs', 'decisions'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'rules'), { recursive: true });
        if (adr !== null) {
            fs.writeFileSync(
                path.join(root, 'docs', 'decisions', `ADR-${adr}-probe.md`),
                `---\nstatus: accepted\ndate: 2026-08-21\ndecision: probe\n---\n\n# Probe\n`,
                'utf-8',
            );
        }
        fs.writeFileSync(
            path.join(root, 'src', 'rules', 'probe.md'),
            citation === null ? '# Probe\n\nNo decision is named here.\n' : `# Probe\n\nSee ${citation}.\n`,
            'utf-8',
        );
        return root;
    };

    const run = (root: string): number => {
        process.env['ADR_CITE_CHECK_ROOT'] = root;
        try {
            return runGateCli(REPO_ROOT, 'src/scripts/adr_cite_check.ts', ['--cited'], REPO_ROOT);
        } finally {
            delete process.env['ADR_CITE_CHECK_ROOT'];
        }
    };

    try {
        return runSelfTest({
            gate: 'adr_cite_check',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a citation whose ADR exists passes',
                    expect: 'accept',
                    run: () => run(mk('001', 'ADR-001')),
                },
                {
                    name: 'a citation to an ADR that does not exist is rejected — the gate\'s whole subject',
                    expect: 'reject',
                    run: () => run(mk('001', 'ADR-993')),
                },
                {
                    name: 'citation roots that name no ADR at all are rejected as a dead scope, never green',
                    expect: 'reject',
                    run: () => run(mk('001', null)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

/**
 * One row per ADR — the corpus survey `road-to-decision-conformance` Phase 2
 * asks for. Distinct from `--cited`, which resolves every ADR *citation* and
 * answers "does this reference land"; this answers "what state is the corpus
 * in", which is a different denominator (186 records vs the citations that
 * happen to name them).
 */
export interface CorpusRow {
    ref: string;
    file: string;
    status: string;
    /** `superseded_by` when present, else `—`. */
    successor: string;
    /** Does the record carry a `review_trigger` at all? */
    has_trigger: boolean;
    /** Only meaningful when `has_trigger`; see `TRIGGER_VERDICTS`. */
    trigger: TriggerState;
    reopen_policy: string;
    /** Cited anywhere OUTSIDE `docs/decisions/`. */
    cited_outside: boolean;
}

/**
 * The states a record CARRYING a trigger can be in, and why `none` is not one.
 *
 * `none` is outside the denominator, not a bucket inside it: the survey asks
 * that these sum to "the number of ADRs carrying a trigger", and a record with
 * no trigger carries none.
 *
 * `dated-unparsed` was added with the dated sub-class and belongs in the sum
 * for the same reason `none` does not — a record in that state DOES carry a
 * trigger. Leaving it out would have made the sum line report a mismatch, i.e.
 * announced a defect in the survey where the defect is in the ADR.
 */
export const TRIGGER_VERDICTS = ['fired', 'not-fired', 'indeterminate', 'dated-unparsed'] as const;

/** Every ADR file, surveyed. */
export function corpus_survey(repo_root: string = REPO_ROOT): CorpusRow[] {
    const files = adr_files(repo_root);
    const cited_outside = new Set<string>();
    for (const root of CITATION_ROOTS) {
        for (const file of walk_citable(path.join(repo_root, root))) {
            const rel = path.relative(repo_root, file);
            if (rel.startsWith(path.join('docs', 'decisions'))) continue;
            for (const m of fs.readFileSync(file, 'utf-8').matchAll(CITATION_RE)) {
                const parsed = normalise_ref(m[0]);
                if (parsed !== null) cited_outside.add(parsed.id);
            }
        }
    }
    const rows: CorpusRow[] = [];
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf-8');
        const fm = parse_frontmatter(text) ?? {};
        const base = path.basename(f);
        // Key on the SAME identity the citation side produces, via
        // `normalise_ref`. Deriving it with a private regex here is how the two
        // halves of a join silently stop matching.
        const parsedSelf = normalise_ref(path.relative(repo_root, f));
        const num = parsedSelf?.id ?? base;
        const raw_trigger = (fm['review_trigger'] ?? '').trim();
        rows.push({
            ref: num,
            file: path.relative(repo_root, f),
            status: (fm['status'] ?? '(none)').trim(),
            successor: (fm['superseded_by'] ?? '—').trim() || '—',
            has_trigger: raw_trigger !== '' && raw_trigger.toLowerCase() !== 'unclassified',
            trigger: trigger_state(fm),
            reopen_policy: (fm['reopen_policy'] ?? 'unclassified').trim() || 'unclassified',
            cited_outside: cited_outside.has(num),
        });
    }
    return rows.sort((a, b) => a.ref.localeCompare(b.ref));
}

export interface CorpusSummary {
    total: number;
    by_status: Record<string, number>;
    with_trigger: number;
    trigger_counts: Record<string, number>;
    accepted: number;
    accepted_cited_outside: number;
    uncited_pct: number;
    reopen_policy_declared: number;
}

export function corpus_summary(rows: readonly CorpusRow[]): CorpusSummary {
    const by_status: Record<string, number> = {};
    for (const r of rows) by_status[r.status] = (by_status[r.status] ?? 0) + 1;
    const with_trigger = rows.filter((r) => r.has_trigger).length;
    const trigger_counts: Record<string, number> = { fired: 0, 'not-fired': 0, indeterminate: 0 };
    for (const r of rows) {
        if (!r.has_trigger) continue;
        trigger_counts[r.trigger] = (trigger_counts[r.trigger] ?? 0) + 1;
    }
    const accepted = rows.filter((r) => r.status.toLowerCase() === 'accepted');
    const cited = accepted.filter((r) => r.cited_outside).length;
    return {
        total: rows.length,
        by_status,
        with_trigger,
        trigger_counts,
        accepted: accepted.length,
        accepted_cited_outside: cited,
        uncited_pct: accepted.length === 0 ? 0 : ((accepted.length - cited) * 100) / accepted.length,
        reopen_policy_declared: rows.filter((r) => r.reopen_policy !== 'unclassified').length,
    };
}

function render_corpus(rows: readonly CorpusRow[], sum: CorpusSummary): string {
    const out: string[] = [];
    out.push(`adr corpus survey · ${String(sum.total)} decision record(s)\n`);
    out.push('  status:');
    for (const [k, v] of Object.entries(sum.by_status).sort()) {
        out.push(`      ${k.padEnd(14)} ${String(v)}`);
    }
    out.push('');
    out.push(`  review_trigger — ${String(sum.with_trigger)} record(s) carry one:`);
    for (const k of TRIGGER_VERDICTS) {
        out.push(`      ${k.padEnd(14)} ${String(sum.trigger_counts[k] ?? 0)}`);
    }
    const triSum = TRIGGER_VERDICTS.reduce((a, k) => a + (sum.trigger_counts[k] ?? 0), 0);
    out.push(
        `      ${'sum'.padEnd(14)} ${String(triSum)}` +
            (triSum === sum.with_trigger ? '  ✅ equals the carrying count' : '  ❌ DOES NOT equal the carrying count'),
    );
    out.push('');
    out.push(
        `  citation reach — ${String(sum.accepted_cited_outside)} of ${String(sum.accepted)} accepted ` +
            `ADR(s) are cited outside docs/decisions/ (${sum.uncited_pct.toFixed(1)} % uncited)`,
    );
    out.push(
        `  reopen_policy  — ${String(sum.reopen_policy_declared)} of ${String(sum.total)} declare one; ` +
            'the rest resolve to `unclassified`',
    );
    out.push('');
    out.push('  Reports only. This command decides nothing and gates nothing.');
    return out.join('\n') + '\n';
}

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    if (argv.includes('--self-test')) return selfTest();
    const corpus_mode = argv.includes('--cited');
    const survey_mode = argv.includes('--all');
    if (survey_mode) {
        const root = scan_root();
        const rows = corpus_survey(root);
        const sum = corpus_summary(rows);
        process.stdout.write(
            as_json ? `${JSON.stringify({ summary: sum, rows }, null, 2)}\n` : render_corpus(rows, sum),
        );
        return 0;
    }
    const explicit = argv.filter((a) => !a.startsWith('--'));
    if (!corpus_mode && explicit.length === 0) {
        process.stderr.write(
            'usage: adr_cite_check <ADR-NNN> [ADR-NNN …] [--json]\n' +
                '       adr_cite_check --cited [--json]\n' +
                '       adr_cite_check --all [--json]\n' +
                '       evaluate a decision before citing it as a reason not to act\n' +
                '       --cited: resolve every ADR citation in ' +
                `${CITATION_ROOTS.join(', ')} (the CI gate)\n` +
                '       --all: one row per decision record — status, successor, trigger\n' +
                '              state, reopen_policy, citation reach. Reports only.\n',
        );
        return 2;
    }

    const root = scan_root();
    const refs = corpus_mode ? cited_refs(root) : explicit;
    const results = cite_check(refs, root);

    // The ledger and the `scanned:` line exist only in corpus mode, and the
    // asymmetry is deliberate. In explicit-ref mode the refs come from argv, so
    // there is no scan scope to assert and a published count would be a floor
    // under a constant — the false-count shape `gate-coverage.yml` rejects. In
    // corpus mode the denominator is real: it collapses to 0 if either the
    // citation roots or the decision surfaces move, which is exactly the
    // dead-scan-root failure the assertion is for.
    let ledger: GateLedger | null = null;
    if (corpus_mode) {
        ledger = new GateLedger('adr_cite_check');
        ledger.plan(refs);
        for (const r of results) {
            if (r.resolved) ledger.complete(r.ref);
            else ledger.fail(r.ref, 'citation resolves to no decision record');
        }
    }

    if (as_json) {
        // The tally rides in the payload rather than on stdout: printing the
        // ledger line beside the JSON would break every parser of this mode.
        process.stdout.write(
            JSON.stringify(
                {
                    results,
                    surfaces_not_scanned: SURFACES_NOT_SCANNED,
                    partial_coverage: PARTIAL_COVERAGE,
                    ...(ledger !== null ? { ledger: ledger.finalize() } : {}),
                },
                null,
                2,
            ) + '\n',
        );
    } else {
        // Corpus mode renders only the unresolved records. The full per-record
        // surfacing is 178 records × ~10 lines today — a CI step that prints
        // 1,900 lines of green hides the one red line that matters, and the
        // surfacing exists for a human citing ONE decision, not for the gate.
        // `--json` still carries every record for a machine consumer.
        const shown = corpus_mode ? results.filter((r) => !r.resolved) : results;
        if (corpus_mode) {
            process.stdout.write(
                `ADR citations: ${String(results.length)} distinct reference(s) across ` +
                    `${CITATION_ROOTS.join(', ')} · ` +
                    `${String(results.filter((r) => !r.resolved).length)} unresolved\n`,
            );
        }
        if (shown.length > 0) process.stdout.write(render(shown) + '\n');
        if (ledger !== null) {
            try {
                // The count is references RESOLVED AGAINST the corpus, not the
                // subset that resolved successfully — deliberately the same
                // number the ledger's own `scanned=` reports, because two
                // different values printed under the same word is the drift
                // `reportScanned` was written to prevent. It still guards both
                // roots: a moved citation root drops this to 0 and throws
                // here, and a moved decision surface makes every reference
                // unresolved, which reds on exit 1 below with 178 failures in
                // the ledger. Neither failure can present as green.
                reportScanned({
                    gate: 'adr_cite_check',
                    scanned: results.length,
                    units: 'cited ADR reference(s)',
                    roots: [...CITATION_ROOTS, ...ADR_DIRS],
                });
            } catch (exc) {
                if (exc instanceof DeadScopeError) {
                    process.stderr.write(`❌  ${exc.message}\n`);
                    return 1;
                }
                throw exc;
            }
            ledger.report();
        }
    }

    const unresolved = results.filter((r) => !r.resolved);
    if (unresolved.length > 0) {
        process.stderr.write(
            `\n❌  ${String(unresolved.length)} reference(s) did not resolve on a scanned surface. ` +
                `Not scanned: ${SURFACES_NOT_SCANNED.join(' · ')}\n`,
        );
        return 1;
    }
    return 0;
}

// Main-guard (realpath-compared, mirrors the repo convention).
//
// `process.exitCode`, never `process.exit()` — and the difference is a real
// defect this change would otherwise have shipped. `--cited --json` writes a
// ~167 KB payload; `process.exit()` tears the process down before Node has
// flushed an async stdout, so piping that mode into a parser delivered exactly
// 65,536 bytes and a JSONDecodeError, while redirecting to a file delivered all
// of it. Measured before the fix, on this branch. Setting the code and letting
// the process end naturally flushes first. Twenty-odd sibling gates already use
// this shape (`audit_skill_overlap`, `apply_modules_config`, …).
if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exitCode = main(process.argv.slice(2));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exitCode = main(process.argv.slice(2));
        }
    }
}
