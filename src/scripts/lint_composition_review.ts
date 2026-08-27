#!/usr/bin/env tsx
/**
 * The authoring-search record — `composition_review` (road-to-composition-before-creation).
 *
 * The estate is 299 skills, 120 rules and 114 guidelines. Two gates measure its
 * SIZE and three tools measure overlap AFTER the fact. None of them holds the
 * authoring-time record: `artifact-drafting-protocol` Phase B mandates a
 * four-surface overlap scan and ships `instruction-only`, so a skill authored
 * without one and a skill authored after a thorough one are indiscernible in
 * the tree.
 *
 * Measured 2026-08-27 over the twenty most recently added skills and rules
 * (`agents/evidence/analysis/authoring-search-record-sample-2026-08-27.md`):
 * **1 of 20** carried a machine-readable record, **9 of 20** carried a strict
 * prose one, **18 of 20** carried something loose enough to count if you
 * squinted. The kill criterion in that roadmap did not fire on either reading a
 * two-seat council was willing to adopt.
 *
 * ## What this gate does, and the split that matters
 *
 * **HARD (exit 1) — a `composition_review` that is present and malformed.** A
 * `candidate` that resolves to no artifact in the tree, a `none` candidate
 * paired with a disposition other than `none_found` (or the reverse), or a
 * duplicate candidate inside one block. A record pointing at an incumbent that
 * does not exist is worse than no record: the reference is checkable and wrong.
 *
 * **What that certifies is REFERENTIAL CONSISTENCY, never that a search
 * happened.** Narrowed after an independent review, where both seats made the
 * point independently: an author can name any existing artifact, write
 * `create_separate` and a sixteen-character rationale, and pass every check
 * here. The earlier wording said such a record "reads as evidence of a search
 * that cannot have happened", which is a claim about the search — and this gate
 * has none to make. It buys that a record cannot point at nothing; whether it
 * points at the RIGHT thing is a reviewer's judgement, and the roadmap's own
 * Risk 1 is that the field becomes a pro-forma line.
 *
 * **ADVISORY (never fails) — an artifact ADDED relative to a base ref carrying
 * no record at all.** Reported by count and by path, exit 0. Flipping this to a
 * block needs a false-positive rate from at least one release of advisory
 * operation, which this roadmap does not have and deliberately does not
 * pre-authorise: a measurement is not a gate.
 *
 * ## What it cannot do, stated rather than implied
 *
 * It checks that a delta was WRITTEN. It cannot check that the search happened,
 * that the rationale is true, or that the incumbent named is the nearest one.
 * The council that scoped it said so in both seats, and the roadmap's own Risk 1
 * is that the field becomes a pro-forma line. Nothing here refutes that risk;
 * the advisory-first sequencing is what is supposed to measure it.
 *
 * ## Why the corpus is the scan scope and the diff is only the finding
 *
 * A diff-scoped gate legitimately scans 0 on most runs and can carry no honest
 * `min_scanned` floor — `lint_evidence_artifacts` declines registration in
 * `gate-coverage.yml` for exactly that reason. This gate walks the whole
 * skill+rule corpus for its structural half, so its floor is real, and narrows
 * to the diff only for the advisory half.
 *
 * The addition set unions `git ls-files` with `git ls-files --others
 * --exclude-standard`: a create-only canary plants an UNTRACKED file, and a
 * plain `ls-files` cannot see it, so the gate would report green on its own
 * canary.
 *
 * Exit codes: 0 = pass, 1 = policy violation (a dead scan scope included — a
 * gate that read nothing has not passed), 2 = internal error. `scanned:` is
 * emitted on every path.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const GATE = 'lint_composition_review';

/** The four values `composition_review[].disposition` may take. */
export const COMPOSITION_DISPOSITIONS = [
    'extend_incumbent',
    'compose_with_incumbent',
    'create_separate',
    'none_found',
] as const;
export type CompositionDisposition = (typeof COMPOSITION_DISPOSITIONS)[number];

/** The candidate value that records "searched, found no credible incumbent". */
export const NO_INCUMBENT = 'none';

export interface Violation {
    kind: string;
    file: string;
    detail: string;
}

export interface Advisory {
    file: string;
}

/** Thrown when a diff-scoped read was requested and git could not answer it. */
export class GitScopeError extends Error {
    constructor(command: string, cause: unknown) {
        super(
            `git ${command} failed, so the added-artifact set is UNKNOWN rather than empty — a ` +
                'diff-scoped reading that silently reports zero is indistinguishable from a clean ' +
                `one. Underlying error: ${String(cause)}`,
        );
        this.name = 'GitScopeError';
    }
}

/** Sentinel for a field whose value was a YAML block scalar this parser refuses. */
export const BLOCK_SCALAR = '\u0000block-scalar';

/** `skill:foo`, `rule:bar`, `command:baz`, `guideline:a/b`, or the literal `none`. */
// Path segments are non-empty, so `guideline:/foo`, `guideline:foo/` and
// `guideline:foo//bar` are rejected rather than accepted-then-unresolvable.
// Found by review: the previous class admitted all three.
const CANDIDATE_RE = /^(skill|rule|command|guideline):([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)$/;

function _frontmatter(text: string): string | null {
    if (!text.startsWith('---')) return null;
    const end = text.indexOf('\n---', 3);
    return end === -1 ? null : text.slice(text.indexOf('\n') + 1, end + 1);
}

export interface CompositionEntry {
    candidate: string;
    disposition: string;
    rationale: string;
}

/**
 * Read `composition_review` out of a frontmatter block.
 *
 * A deliberately small YAML reader rather than a dependency: the block shape is
 * pinned by the JSON schema (`skill.schema.json` / `rule.schema.json`), which is
 * what `validate_frontmatter` enforces. This parser exists to find the entries,
 * not to re-validate their types — a malformed block that the schema rejects is
 * that gate's finding, not this one's, and duplicating the check would produce
 * two error messages for one defect.
 *
 * @returns `null` when the artifact carries no block at all.
 */
export function parseCompositionReview(text: string): CompositionEntry[] | null {
    const fm = _frontmatter(text);
    if (fm === null || !/^composition_review:/m.test(fm)) return null;

    const lines = fm.split('\n');
    const start = lines.findIndex((l) => /^composition_review:/.test(l));
    const entries: CompositionEntry[] = [];
    let cur: Partial<CompositionEntry> | null = null;

    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i] as string;
        if (/^\S/.test(line)) break; // dedented back to a sibling key
        const item = /^\s*-\s+(\w+):\s*(.*)$/.exec(line);
        if (item) {
            if (cur !== null) entries.push(cur as CompositionEntry);
            cur = {};
            cur[item[1] as keyof CompositionEntry] = _unquote(item[2] as string);
            continue;
        }
        const field = /^\s+(\w+):\s*(.*)$/.exec(line);
        if (field && cur !== null) {
            const raw = (field[2] as string).trim();
            // A YAML block scalar (`rationale: |`) would otherwise capture the
            // `|` itself and yield a one-character value — valid YAML read
            // wrongly, which is worse than a parse error because it looks like
            // data. Found by review. Marked, so the caller reports it.
            cur[field[1] as keyof CompositionEntry] = /^[|>][-+0-9]*$/.test(raw)
                ? BLOCK_SCALAR
                : _unquote(field[2] as string);
        }
    }
    if (cur !== null) entries.push(cur as CompositionEntry);
    return entries;
}

function _unquote(s: string): string {
    const t = s.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1);
    }
    return t;
}

/**
 * Every artifact id the tree defines, across all four kinds.
 *
 * **All four, and that is a correction.** The first version resolved only
 * `skill:` and `rule:`, and carried a comment saying a `command:` or
 * `guideline:` id "lives in a tree this gate does not walk" — while this
 * module's own contract and BOTH schema descriptions said a lint checks that
 * `candidate` resolves. An independent cross-model review found the
 * contradiction: `candidate: command:this-does-not-exist` passed every check.
 * Two ways to close it — narrow the claim, or walk the trees. The trees are
 * right here, so the claim stands and the code now earns it.
 */
export function artefactIds(repo: string): Set<string> {
    const ids = new Set<string>();
    const skills = path.join(repo, 'src', 'skills');
    if (fs.existsSync(skills)) {
        for (const e of fs.readdirSync(skills, { withFileTypes: true })) {
            if (e.isDirectory() && fs.existsSync(path.join(skills, e.name, 'SKILL.md'))) {
                ids.add(`skill:${e.name}`);
            }
        }
    }
    const rules = path.join(repo, 'src', 'rules');
    if (fs.existsSync(rules)) {
        for (const e of fs.readdirSync(rules, { withFileTypes: true })) {
            if (e.isFile() && e.name.endsWith('.md')) ids.add(`rule:${e.name.slice(0, -3)}`);
        }
    }

    // Commands are `src/domains/<pack>/<path...>/command.md`, addressed by the
    // path BELOW the pack — `refine-ticket`, `roadmap/create`. The pack is a
    // distribution detail, not part of the name a rule or skill cites.
    const domains = path.join(repo, 'src', 'domains');
    for (const pack of _dirs(domains)) {
        const walk = (rel: string): void => {
            for (const e of fs.readdirSync(path.join(domains, pack, rel), { withFileTypes: true })) {
                if (e.isDirectory()) walk(path.join(rel, e.name));
                else if (e.name === 'command.md' && rel !== '') {
                    ids.add(`command:${rel.split(path.sep).join('/')}`);
                }
            }
        };
        try {
            walk('');
        } catch {
            // An unreadable pack resolves no command — the conservative
            // direction, since the candidate then fails rather than passing.
        }
    }

    // Guidelines are `docs/guidelines/<path>.md`, addressed without the
    // extension — `code-clarity`, `agent-infra/rule-type-governance`.
    const guidelines = path.join(repo, 'docs', 'guidelines');
    const walkG = (rel: string): void => {
        for (const e of fs.readdirSync(path.join(guidelines, rel), { withFileTypes: true })) {
            if (e.isDirectory()) walkG(path.join(rel, e.name));
            else if (e.name.endsWith('.md')) {
                ids.add(`guideline:${path.join(rel, e.name.slice(0, -3)).split(path.sep).join('/')}`);
            }
        }
    };
    try {
        walkG('');
    } catch {
        // Same direction: an unreadable tree resolves nothing, never everything.
    }

    return ids;
}

function _dirs(root: string): string[] {
    try {
        return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
        return [];
    }
}

/**
 * Structural check on one artifact's record. Returns [] when it carries none —
 * absence is the ADVISORY half and is never a violation here.
 */
export function checkArtefact(rel: string, text: string, known: ReadonlySet<string>): Violation[] {
    const entries = parseCompositionReview(text);
    if (entries === null) return [];

    // `composition_review: []` is PRESENT and says nothing — neither of the two
    // states this gate distinguishes. The schema's `minItems: 1` rejects it, but
    // a gate whose comments claim "present and malformed → exit 1" has to deliver
    // that itself rather than rely on another gate having run first. Found by
    // review: the parser returned `[]` and this returned no violation.
    if (entries.length === 0) {
        return [
            {
                kind: 'empty-record',
                file: rel,
                detail:
                    'a `composition_review:` block is present but has no entries — record at least one ' +
                    'candidate, or omit the block entirely. Absence is advisory; an empty claim is not.',
            },
        ];
    }

    const out: Violation[] = [];
    const seen = new Set<string>();
    for (const [i, e] of entries.entries()) {
        const where = `entry ${String(i + 1)}`;
        const cand = (e.candidate ?? '').trim();
        const disp = (e.disposition ?? '').trim();

        if (cand === '') {
            out.push({ kind: 'missing-candidate', file: rel, detail: `${where}: no \`candidate\`.` });
            continue;
        }
        const blockScalar = [e.candidate, e.disposition, e.rationale].filter((v) => v === BLOCK_SCALAR);
        if (blockScalar.length > 0) {
            out.push({
                kind: 'block-scalar-field',
                file: rel,
                detail: `${where}: a field uses a YAML block scalar (\`|\` / \`>\`). This gate reads one line per field, so a block scalar would be read as its marker character rather than its text — write the value inline.`,
            });
            continue;
        }
        if (seen.has(cand)) {
            out.push({
                kind: 'duplicate-candidate',
                file: rel,
                detail: `${where}: \`${cand}\` is recorded twice — one candidate, one disposition.`,
            });
        }
        seen.add(cand);

        if (!(COMPOSITION_DISPOSITIONS as readonly string[]).includes(disp)) {
            out.push({
                kind: 'unknown-disposition',
                file: rel,
                detail: `${where}: disposition \`${disp}\` is not one of ${COMPOSITION_DISPOSITIONS.join(', ')}.`,
            });
        }

        // `none` and `none_found` are the same fact stated twice; either one
        // without the other is a record whose meaning cannot be recovered.
        if (cand === NO_INCUMBENT && disp !== 'none_found') {
            out.push({
                kind: 'none-mismatch',
                file: rel,
                detail: `${where}: candidate \`none\` requires disposition \`none_found\`, got \`${disp}\`.`,
            });
        } else if (cand !== NO_INCUMBENT && disp === 'none_found') {
            out.push({
                kind: 'none-mismatch',
                file: rel,
                detail: `${where}: disposition \`none_found\` requires candidate \`none\`, got \`${cand}\`.`,
            });
        }

        if (cand !== NO_INCUMBENT) {
            const m = CANDIDATE_RE.exec(cand);
            if (m === null) {
                out.push({
                    kind: 'malformed-candidate',
                    file: rel,
                    detail: `${where}: \`${cand}\` is not \`skill:<name>\` / \`rule:<name>\` / \`command:<name>\` / \`guideline:<path>\` / \`none\`.`,
                });
            } else if (!known.has(cand)) {
                // All four kinds, since `artefactIds` now walks all four. The
                // carve-out that used to sit here let `command:` and
                // `guideline:` ids through unchecked while the contract claimed
                // otherwise — found by review, closed rather than documented.
                out.push({
                    kind: 'unresolvable-candidate',
                    file: rel,
                    detail: `${where}: \`${cand}\` names no artifact in the tree. The reference is checkable and wrong — which is all this gate can tell you; it cannot tell you whether a search happened.`,
                });
            }
        }
    }
    return out;
}

function _corpus(repo: string): string[] {
    const out: string[] = [];
    const skills = path.join(repo, 'src', 'skills');
    if (fs.existsSync(skills)) {
        for (const e of fs.readdirSync(skills, { withFileTypes: true })) {
            const f = path.join('src', 'skills', e.name, 'SKILL.md');
            if (e.isDirectory() && fs.existsSync(path.join(repo, f))) out.push(f);
        }
    }
    const rules = path.join(repo, 'src', 'rules');
    if (fs.existsSync(rules)) {
        for (const e of fs.readdirSync(rules, { withFileTypes: true })) {
            if (e.isFile() && e.name.endsWith('.md')) out.push(path.join('src', 'rules', e.name));
        }
    }
    return out.sort();
}

/**
 * Artifacts ADDED relative to `baseRef`, unioned with untracked files.
 *
 * The union is load-bearing: a create-only canary plants an untracked artifact,
 * and `git diff --name-only` against a base ref cannot see it, so the gate would
 * report green on its own canary and the advisory half would be blind exactly
 * where it is being tested.
 */
export function addedArtefacts(repo: string, baseRef: string, corpus: readonly string[]): string[] {
    const inCorpus = new Set(corpus);
    const added = new Set<string>();
    const run = (args: readonly string[]): string[] => {
        try {
            return execFileSync('git', args, { cwd: repo, encoding: 'utf-8' })
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s !== '');
        } catch (exc) {
            throw new GitScopeError(args.join(' '), exc);
        }
    };
    for (const f of run(['diff', '--name-only', '--diff-filter=A', `${baseRef}...HEAD`])) {
        if (inCorpus.has(f)) added.add(f);
    }
    for (const f of run(['ls-files', '--others', '--exclude-standard'])) {
        if (inCorpus.has(f)) added.add(f);
    }
    return [...added].sort();
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let repo = process.cwd();
    let baseRef = '';
    let quiet = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--repo' || a === '--root') repo = args[++i] as string;
        else if (a === '--base-ref') baseRef = args[++i] as string;
        else if (a === '--quiet') quiet = true;
        else if (a === '--self-test') return selfTest();
        else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: lint_composition_review [--repo PATH] [--base-ref REF] [--quiet] [--self-test]\n',
            );
            process.stdout.write('scanned: 0\n');
            return 0;
        }
    }

    const corpus = _corpus(repo);
    try {
        reportScanned({
            gate: GATE,
            scanned: corpus.length,
            units: 'skill/rule artifact(s)',
            roots: ['src/skills', 'src/rules'],
        });
    } catch (exc) {
        // A dead scope is a POLICY violation, never an internal error: exit 2 is
        // warn-and-allow at every call site, so a moved corpus root would
        // silently degrade this gate to advisory on its HARD half too.
        process.stderr.write(`❌  ${exc instanceof DeadScopeError ? exc.message : String(exc)}\n`);
        return 1;
    }

    const known = artefactIds(repo);
    const ledger = new GateLedger(GATE);
    ledger.plan(corpus);
    const violations: Violation[] = [];
    const advisories: Advisory[] = [];
    const added = baseRef === '' ? [] : new Set(addedArtefacts(repo, baseRef, corpus));

    let scanned = 0;
    try {
        for (const rel of corpus) {
            const text = fs.readFileSync(path.join(repo, rel), 'utf-8');
            scanned += 1;
            const found = checkArtefact(rel, text, known);
            if (found.length > 0) ledger.fail(rel, `${String(found.length)} record violation(s)`);
            else ledger.complete(rel);
            violations.push(...found);
            if (added !== null && added instanceof Set && added.has(rel) && parseCompositionReview(text) === null) {
                advisories.push({ file: rel });
            }
        }
    } catch (exc) {
        process.stderr.write(
            `❌  ${GATE}: internal error after ${String(scanned)} artifact(s): ${String(exc)}\n`,
        );
        return 2;
    }
    ledger.report();

    if (!quiet) {
        for (const v of violations) process.stderr.write(`❌  ${v.file} — ${v.detail}\n`);
        for (const a of advisories) {
            process.stdout.write(
                `⚠️  ${a.file}: added without a \`composition_review\` record — advisory, not a block.\n`,
            );
        }
    }

    if (violations.length > 0) {
        process.stderr.write(
            `❌  ${GATE}: ${String(violations.length)} malformed record(s) across ${String(corpus.length)} artifact(s).\n`,
        );
        return 1;
    }
    process.stdout.write(
        `✅  ${GATE}: ${String(corpus.length)} artifact(s) — records well-formed; ` +
            `${String(advisories.length)} addition(s) without one (advisory).\n`,
    );
    return 0;
}

// ── self-test ──────────────────────────────────────────────────────────────

function _fixture(files: Record<string, string>): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lcr-'));
    for (const [rel, body] of Object.entries(files)) {
        const f = path.join(d, rel);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, body);
    }
    return d;
}

function _fm(block: string): string {
    return `---\nname: probe\n${block}---\n\n# probe\n`;
}

function selfTest(): number {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const rel = 'src/scripts/lint_composition_review.ts';
    const run = (files: Record<string, string>): number =>
        runGateCli(repoRoot, rel, ['--quiet'], _fixture(files));

    const incumbent = { 'src/rules/incumbent.md': _fm('') };

    return runSelfTest({
        gate: GATE,
        minCases: 6,
        minRejectCases: 4,
        cases: [
            {
                name: 'a well-formed record naming a real incumbent is accepted',
                expect: 'accept',
                run: () =>
                    run({
                        ...incumbent,
                        'src/rules/probe.md': _fm(
                            'composition_review:\n  - candidate: rule:incumbent\n    disposition: create_separate\n    rationale: the incumbent cannot express this case at all\n',
                        ),
                    }),
            },
            {
                name: 'candidate `none` with `none_found` is accepted — a search that found nothing is a record',
                expect: 'accept',
                run: () =>
                    run({
                        'src/rules/probe.md': _fm(
                            'composition_review:\n  - candidate: none\n    disposition: none_found\n    rationale: no artifact in the tree covers this surface\n',
                        ),
                    }),
            },
            {
                name: 'an artifact with NO record is accepted — absence is advisory, never a block',
                expect: 'accept',
                run: () => run({ 'src/rules/probe.md': _fm('') }),
            },
            {
                name: 'a candidate naming no artifact in the tree is REJECTED',
                expect: 'reject',
                run: () =>
                    run({
                        'src/rules/probe.md': _fm(
                            'composition_review:\n  - candidate: rule:does-not-exist\n    disposition: create_separate\n    rationale: this incumbent was never in the tree at all\n',
                        ),
                    }),
            },
            {
                name: '`none` paired with a non-`none_found` disposition is REJECTED',
                expect: 'reject',
                run: () =>
                    run({
                        'src/rules/probe.md': _fm(
                            'composition_review:\n  - candidate: none\n    disposition: extend_incumbent\n    rationale: cannot extend an incumbent that was never found\n',
                        ),
                    }),
            },
            {
                name: '`none_found` paired with a real candidate is REJECTED — the reverse direction',
                expect: 'reject',
                run: () =>
                    run({
                        ...incumbent,
                        'src/rules/probe.md': _fm(
                            'composition_review:\n  - candidate: rule:incumbent\n    disposition: none_found\n    rationale: an incumbent was named and also declared absent\n',
                        ),
                    }),
            },
            {
                name: 'a disposition outside the enum is REJECTED',
                expect: 'reject',
                run: () =>
                    run({
                        ...incumbent,
                        'src/rules/probe.md': _fm(
                            'composition_review:\n  - candidate: rule:incumbent\n    disposition: superseded\n    rationale: borrowing a value from another vocabulary entirely\n',
                        ),
                    }),
            },
            {
                name: 'the same candidate recorded twice is REJECTED',
                expect: 'reject',
                run: () =>
                    run({
                        ...incumbent,
                        'src/rules/probe.md': _fm(
                            'composition_review:\n  - candidate: rule:incumbent\n    disposition: create_separate\n    rationale: the first of two contradictory dispositions\n  - candidate: rule:incumbent\n    disposition: extend_incumbent\n    rationale: the second of two contradictory dispositions\n',
                        ),
                    }),
            },
        ],
    });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
