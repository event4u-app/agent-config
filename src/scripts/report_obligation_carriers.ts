#!/usr/bin/env node
/**
 * report_obligation_carriers — how many distinct artifacts carry one obligation.
 *
 * WHY THIS EXISTS. Seven independent code-level reviews of this tree, scoring it
 * between 9.2 and 10, named the same bottleneck in different words — mechanism
 * density — and proposed the same north star: one obligation, one authoritative
 * carrier, delete the redundant copy. None of them produced a measurement, so the
 * theme arrived across consecutive rounds as prose only. This reporter turns the
 * impression into a number with named rows a reader can open.
 *
 * WHAT IT IS NOT, AND THE NON-GOALS ARE THE LOAD-BEARING PART. It is a reporter.
 * It carries no threshold, no ceiling and no opinion about whether a count is too
 * high; it is invoked by no CI workflow and registered in no gate ledger. Its only
 * non-zero exit is a DEAD SCOPE — a run that read zero files did not measure
 * anything, and reporting `0 obligations` from an empty walk is the single most
 * comforting wrong answer this script could give. Refusing that is an assertion
 * about the INSTRUMENT, never about the census verdict, and the distinction is why
 * `assertScanned` here does not make this a gate.
 *
 * CARRIER CLASSES READ (six roots, one per class):
 *
 *   rule       src/rules                  kernel and tier-2 rules alike; the census
 *                                         does not distinguish them, because an
 *                                         obligation's body is the same body in
 *                                         either tier and the tier is a delivery
 *                                         fact, not an identity one.
 *   skill      src/skills                 every `.md`, not only `SKILL.md`: a
 *                                         supporting reference that restates a law
 *                                         is a carrier of it.
 *   command    src/domains                `command.md` and its neighbours.
 *   context    src/agent-src/contexts     the mechanics files rule bodies migrate into.
 *   guideline  docs/guidelines            the other migration target.
 *   contract   docs/contracts             where a migrated body lands when it is a
 *                                         contract rather than a guideline.
 *
 * CLASSES EXCLUDED, EACH NAMED WITH ITS REASON — a class left out is a named
 * exclusion, never a silent one. See {@link EXCLUDED_CLASSES}; the reasons live
 * there rather than here so the reporter's own header can print them.
 *
 * HOW IDENTITY IS DECIDED — STRUCTURALLY, NEVER BY SIMILARITY. A similarity score
 * makes every row unfalsifiable: a reader who disagrees cannot check it, only
 * re-tune a threshold until the disagreement goes away. So two artifacts carry the
 * same obligation when a STRUCTURAL anchor says so, and the three anchors are the
 * ones this tree already maintains:
 *
 *   fence-identity            the fenced block under an `Iron Law` heading, equal
 *                             after whitespace collapse and upper-casing. Exact.
 *   explicit-cross-reference  the stating artifact's own `Body migrated to X` /
 *                             `Body merged into X` pointer, resolved to a file.
 *   named-slug                a `canonical: [`X`]` phrase anywhere in a file,
 *                             naming the artifact that homes the law.
 *
 * A cross-reference token that resolves to no file on disk is recorded as
 * `unknown` and counted as a carrier of unknown location — never dropped, because
 * dropping it is how an unresolvable pointer reads as an absent one.
 *
 * THE MATCHER WAS SEEN UNDER-COUNTING BEFORE IT WAS TRUSTED. `fence-identity`
 * alone finds almost nothing in this tree: duplication here is overwhelmingly a
 * migration stub restating a law in prose beside the artifact that now holds the
 * body, which has no fence to compare. {@link ANCHOR_KINDS} is a parameter for
 * exactly that reason — `census(root, { anchors: ['fence-identity'] })` reproduces
 * the blind definition on demand, and the test suite pins the under-count so the
 * fix cannot silently regress to it.
 *
 * WHAT A COUNT DOES NOT DISTINGUISH, MEASURED THE FIRST TIME IT MATTERED. A
 * `named-slug` carrier is an artifact that names the obligation's home. It may be
 * a genuine second copy of the body, or it may be a bare pointer — the good shape,
 * the one this census exists to encourage — and NO structural anchor separates the
 * two, because the difference is whether the surrounding prose restates the law,
 * which is a judgement and not a structure. The consequence is concrete: the
 * `commit-policy` row's third carrier had its restated body deleted and replaced
 * by a pointer, and the row still reads 3. The number counts artifacts a reader can
 * meet the obligation in, which is the honest thing a structural matcher can count;
 * it is NOT a count of redundant bodies, and reading it as one will overstate.
 * Narrowing it would mean scoring prose, which is the trade this census refuses.
 *
 * Output: stdout, plus `agents/runtime/reports/obligation-carriers.json`, which is
 * under the gitignored `/agents/runtime/` catch-all. Nothing is written into the
 * tracked tree.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

// ledger-exempt: a REPORTER, not a gate. It has no verdict for a per-target ledger
// to account for — its only non-zero exit is a dead scope, which is a statement
// about the walk rather than about any target it walked.

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** One carrier class the census reads, with the root it walks. */
export interface CarrierClass {
    readonly name: string;
    readonly root: string;
}

/** The six roots. Order is the read order, and it decides which carrier is listed first. */
export const CARRIER_CLASSES: readonly CarrierClass[] = [
    { name: 'rule', root: path.join('src', 'rules') },
    { name: 'skill', root: path.join('src', 'skills') },
    { name: 'command', root: path.join('src', 'domains') },
    { name: 'context', root: path.join('src', 'agent-src', 'contexts') },
    { name: 'guideline', root: path.join('docs', 'guidelines') },
    { name: 'contract', root: path.join('docs', 'contracts') },
];

/** A class that could plausibly carry an obligation and is deliberately not read. */
export interface ExcludedClass {
    readonly name: string;
    readonly reason: string;
}

/**
 * Every exclusion, with the reason a reviewer can contest.
 *
 * Measured 2026-09-29 by grepping the whole tree for an `Iron Law` heading or an
 * inline `**Iron Law` restatement: the counts below are the files each exclusion
 * actually withholds, so the cost of each is visible rather than asserted.
 */
export const EXCLUDED_CLASSES: readonly ExcludedClass[] = [
    {
        name: 'hook concern injected text',
        reason:
            'the body is a TypeScript string literal under src/scripts/hooks/, carries no ' +
            'Iron Law fence, and would need a code parser rather than a markdown one. The ' +
            'census reads markdown. This is the largest honest gap in its coverage.',
    },
    {
        name: 'generated projections',
        reason:
            'dist/agent-src/ and the per-tool trees (.claude/, .cursor/, .clinerules/, ' +
            '.windsurfrules, .augment/) are byte-equal copies of src/ — check_condensation ' +
            'asserts dist == rewrite(src) — so counting them would double every row by ' +
            'construction and measure the build, not the estate. Withholds ~150 files.',
    },
    {
        name: 'workspace records under agents/',
        reason:
            'roadmaps, evidence, decisions and overrides record work ABOUT obligations; ' +
            'they do not deliver one into a turn. Withholds ~12 files. agents/settings/ ' +
            'policies (~8 files) are the arguable case: they are project-local bindings a ' +
            'consumer writes, not package source, so they move with the project rather ' +
            'than with this tree.',
    },
    {
        name: 'decision records under docs/decisions/',
        reason:
            'an ADR quotes an obligation to record a decision about it; the quote is ' +
            'evidence, not a second delivery. Withholds 4 files.',
    },
    {
        name: 'templates',
        reason:
            'src/agent-src/templates/rule.md states `{The single non-negotiable behavior ' +
            'the rule enforces.}` — a placeholder, not an obligation. Withholds 1 file.',
    },
    {
        name: 'narrative documentation',
        reason:
            'ONBOARDING.md, docs/architecture.md and docs/hook-payload-capture.md describe ' +
            'the system for a reader rather than binding an agent. Withholds 3 files.',
    },
];

/** The anchors that can make two artifacts carriers of one obligation. */
export const ANCHOR_KINDS = ['fence-identity', 'explicit-cross-reference', 'named-slug'] as const;
export type AnchorKind = (typeof ANCHOR_KINDS)[number];

/** One artifact carrying an obligation, and the anchor that put it there. */
export interface Carrier {
    /** Repo-relative path, or `unknown:<token>` when a pointer resolved to nothing. */
    readonly path: string;
    readonly cls: string;
    readonly anchor: AnchorKind | 'statement';
}

/** One obligation and every artifact that carries it. */
export interface ObligationRow {
    /** Readable name — the stem of the stating artifact, disambiguated when repeated. */
    readonly slug: string;
    /** `fence:<digest>` or `pointer:<path>#<n>`. Stable across runs, not across edits. */
    readonly key: string;
    readonly form: 'fence' | 'pointer';
    /** First line of the binding text, for a reader scanning the table. */
    readonly statement: string;
    readonly carriers: readonly Carrier[];
    readonly count: number;
    /** True when at least one carrier is an unresolved pointer target. */
    readonly unresolved: boolean;
}

export interface CensusOptions {
    /** Which anchors may add a carrier. Defaults to all three. */
    readonly anchors?: readonly AnchorKind[];
}

export interface CensusResult {
    readonly rows: readonly ObligationRow[];
    readonly scannedFiles: number;
    readonly roots: readonly string[];
}

/** A statement of an obligation found in one file. */
interface Statement {
    readonly file: string;
    readonly cls: string;
    readonly form: 'fence' | 'pointer';
    /** Normalised binding text — whitespace collapsed, upper-cased. */
    readonly norm: string;
    /** First line of the raw text, for display. */
    readonly display: string;
    /** Index of this statement within its file, so a pointer key is unique. */
    readonly ordinal: number;
}

/** One scanned file's directional cross-references, read once. */
interface FileRefs {
    readonly file: string;
    readonly cls: string;
    /** Tokens this file points AT — `Body migrated to X`. */
    readonly migratedTo: readonly string[];
    /** Tokens this file defers TO — `canonical: [`X`]`. */
    readonly canonicalOf: readonly string[];
}

const IRON_LAW_HEADING = /^(#{1,6})\s+.*\bIron Law/i;
const IRON_LAW_INLINE = /^\*\*Iron Law/;
const FENCE = /^\s*```/;

/**
 * What a cross-reference token may look like: a lower-case slug, optionally
 * prefixed (`skill:`, `guideline:`) or pathed (`docs/contracts/x`). No spaces, no
 * angle brackets, no upper-case initial — see {@link crossRefTokens} for the live
 * false positive that made this necessary.
 */
export const SLUG_SHAPE = /^[a-z0-9][a-z0-9._:/-]*$/;

/**
 * Collapse every whitespace run, including newlines, and upper-case.
 *
 * Line wrapping is the commonest way one law is restated in another file: rules
 * wrap near 80 columns and a copy in a skill wraps somewhere else. A matcher that
 * preserves newlines would call those two texts different, which is a formatting
 * verdict wearing an identity verdict's clothes.
 */
export function normaliseStatement(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Short, stable digest of a normalised statement. */
export function statementKey(norm: string): string {
    return createHash('sha1').update(norm, 'utf-8').digest('hex').slice(0, 12);
}

/**
 * Slug-shaped cross-reference tokens matched by one directional pattern.
 *
 * Only the two phrasings this tree actually maintains are read — a migration
 * pointer and a canonicality claim. A bare link is NOT a cross-reference for this
 * purpose: rules link each other constantly for context, and treating every link
 * as a carrier claim would turn the census into a link graph and every count into
 * noise.
 *
 * The token must also be SLUG-SHAPED, and that clause is a fix rather than a
 * precaution. `canonical:?` alone matched `canonical \`Phase <id>\` form parsed by
 * the dashboard` — a claim about a heading format, not about a carrier — and the
 * census duly reported that obligation as carried by three artifacts, two of them
 * `unknown`. A token carrying whitespace, angle brackets or an upper-case initial
 * is not a slug this tree ever uses, so rejecting it at extraction keeps `unknown`
 * meaning "a real pointer that resolves to nothing" rather than "the regex caught
 * prose".
 */
export function crossRefTokens(text: string, pattern: RegExp): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(new RegExp(pattern.source, 'g'))) {
        const raw = m[1];
        if (raw === undefined) continue;
        // Strip a trailing section marker: `skill:authz-review` then a section sign.
        const token = (raw.split('§')[0] ?? '').trim();
        if (!SLUG_SHAPE.test(token)) continue;
        if (!out.includes(token)) out.push(token);
    }
    return out;
}

/**
 * `Body migrated to X` / `Body merged into X` — OUTBOUND. The file states the law
 * and names the artifact that now holds the body, so X is a second carrier of the
 * obligations this file homes.
 */
export const MIGRATED_TO = /Body (?:migrated|merged) (?:to|into)\s+(?:\[)?`([^`]+)`/;

/**
 * `canonical: [`X`]` — INBOUND. The file restates a law and names X as its home,
 * so the FILE is the second carrier.
 *
 * Read at file level rather than inside the Iron-Law region, and that is a
 * correction rather than a convenience: `scope-control` restates the Hard Floor
 * under its own topical heading and names `non-destructive-by-default` as
 * canonical, which a region-scoped read cannot see — the census reported that
 * obligation as carried by one artifact while four rules restate it. A named-slug
 * reference names the ARTIFACT, not one law inside it, so it attaches to every
 * obligation that artifact homes; a reader who wants to narrow it opens the named
 * file, which is the property that keeps the row checkable.
 */
export const CANONICAL_OF = /[Cc]anonical:?\s+(?:\[)?`([^`]+)`/;

/**
 * Resolve a cross-reference token to a repo-relative markdown path, or null.
 *
 * The four prefixes are the ones the tokens actually use; a bare token is a rule
 * slug, which is how every pointer stub names its own family. Returning null is a
 * real answer and the caller records it as `unknown` rather than discarding it.
 */
export function resolveToken(root: string, token: string): string | null {
    const candidates: string[] = [];
    if (token.startsWith('skill:')) {
        candidates.push(path.join('src', 'skills', token.slice(6), 'SKILL.md'));
    } else if (token.startsWith('guideline:')) {
        candidates.push(path.join('docs', 'guidelines', `${token.slice(10)}.md`));
    } else if (token.startsWith('contexts/')) {
        candidates.push(path.join('src', 'agent-src', token.replace(/\.md$/, '')) + '.md');
    } else if (token.startsWith('docs/')) {
        candidates.push(token.endsWith('.md') ? token : `${token}.md`);
    } else if (token.includes('/')) {
        candidates.push(token.endsWith('.md') ? token : `${token}.md`);
    } else {
        candidates.push(path.join('src', 'rules', `${token}.md`));
        candidates.push(path.join('src', 'skills', token, 'SKILL.md'));
    }
    for (const rel of candidates) {
        if (fs.existsSync(path.join(root, rel))) return rel;
    }
    return null;
}

/** Every `.md` under one root, repo-relative, sorted for a reproducible read order. */
function walkMarkdown(root: string, rel: string): string[] {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    const stack = [abs];
    while (stack.length > 0) {
        const dir = stack.pop();
        if (dir === undefined) break;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) stack.push(full);
            else if (e.isFile() && e.name.endsWith('.md')) out.push(path.relative(root, full));
        }
    }
    return out.sort();
}

/**
 * Every obligation statement in one file.
 *
 * Two forms, and the split is structural. An `Iron Law` heading whose first
 * content is a fence states the law IN FULL — that text is the identity. An
 * inline `**Iron Law` one-liner is the migration-stub shape: it restates the law
 * in prose beside a pointer at the artifact now holding the body, so its identity
 * is its own file rather than its text, because the prose is deliberately a
 * paraphrase and paraphrases do not compare.
 */
export function extractStatements(cls: string, file: string, text: string): Statement[] {
    const lines = text.split('\n');
    const out: Statement[] = [];
    let ordinal = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        const heading = IRON_LAW_HEADING.exec(line);
        if (heading !== null) {
            let j = i + 1;
            while (j < lines.length && (lines[j] ?? '').trim() === '') j += 1;
            if (j >= lines.length || !FENCE.test(lines[j] ?? '')) continue;
            const body: string[] = [];
            let k = j + 1;
            while (k < lines.length && !FENCE.test(lines[k] ?? '')) {
                body.push(lines[k] ?? '');
                k += 1;
            }
            const raw = body.join('\n').trim();
            if (raw === '') {
                i = k;
                continue;
            }
            out.push({
                file,
                cls,
                form: 'fence',
                norm: normaliseStatement(raw),
                display: firstLine(raw),
                ordinal: ordinal++,
            });
            i = k;
            continue;
        }
        if (IRON_LAW_INLINE.test(line)) {
            out.push({
                file,
                cls,
                form: 'pointer',
                norm: normaliseStatement(line),
                display: firstLine(line.replace(/^\*\*Iron Law[^*]*\*\*\s*/, '')),
                ordinal: ordinal++,
            });
        }
    }
    return out;
}

function firstLine(raw: string): string {
    const first = raw.split('\n')[0] ?? '';
    return first.trim().slice(0, 96);
}

function classOf(file: string): string {
    for (const c of CARRIER_CLASSES) {
        if (file === c.root || file.startsWith(`${c.root}${path.sep}`)) return c.name;
    }
    return 'unknown';
}

/**
 * Walk the six roots and group statements into obligations.
 *
 * @throws {DeadScopeError} when the walk read zero files.
 */
export function census(root: string, opts: CensusOptions = {}): CensusResult {
    const anchors = new Set<AnchorKind>(opts.anchors ?? ANCHOR_KINDS);
    const statements: Statement[] = [];
    const refs: FileRefs[] = [];
    const roots: string[] = [];
    let scannedFiles = 0;

    for (const cls of CARRIER_CLASSES) {
        const files = walkMarkdown(root, cls.root);
        if (files.length > 0) roots.push(cls.root);
        for (const file of files) {
            scannedFiles += 1;
            let text: string;
            try {
                text = fs.readFileSync(path.join(root, file), 'utf-8');
            } catch {
                continue;
            }
            statements.push(...extractStatements(cls.name, file, text));
            refs.push({
                file,
                cls: cls.name,
                migratedTo: crossRefTokens(text, MIGRATED_TO),
                canonicalOf: crossRefTokens(text, CANONICAL_OF),
            });
        }
    }

    assertScanned({
        gate: 'report_obligation_carriers',
        scanned: scannedFiles,
        units: 'markdown file(s)',
        roots: CARRIER_CLASSES.map((c) => c.root),
    });

    // Fence statements group by text; pointer statements are their own obligation.
    const groups = new Map<string, Statement[]>();
    for (const s of statements) {
        const key =
            s.form === 'fence' && anchors.has('fence-identity')
                ? `fence:${statementKey(s.norm)}`
                : s.form === 'fence'
                  ? `fence:${statementKey(s.norm)}@${s.file}#${s.ordinal}`
                  : `pointer:${s.file}#${s.ordinal}`;
        const bucket = groups.get(key);
        if (bucket === undefined) groups.set(key, [s]);
        else bucket.push(s);
    }

    // Inbound index: which files name file H as the canonical home of a law.
    const deferrers = new Map<string, FileRefs[]>();
    if (anchors.has('named-slug')) {
        for (const r of refs) {
            for (const token of r.canonicalOf) {
                const home = resolveToken(root, token);
                if (home === null || home === r.file) continue;
                const bucket = deferrers.get(home);
                if (bucket === undefined) deferrers.set(home, [r]);
                else bucket.push(r);
            }
        }
    }
    const refsByFile = new Map(refs.map((r) => [r.file, r]));

    const rows: ObligationRow[] = [];
    for (const [key, members] of groups) {
        // A pointer statement only becomes an obligation at all once a
        // cross-reference anchor is enabled. Without one it is a lone paraphrase
        // with no second carrier to compare against, and the blind definition this
        // reproduces would never have seen it.
        const crossRefEnabled =
            anchors.has('explicit-cross-reference') || anchors.has('named-slug');
        const first = members[0];
        if (first === undefined) continue;
        if (first.form === 'pointer' && !crossRefEnabled) continue;

        const carriers: Carrier[] = [];
        const seen = new Set<string>();
        const add = (p: string, cls: string, anchor: Carrier['anchor']): void => {
            if (seen.has(p)) return;
            seen.add(p);
            carriers.push({ path: p, cls, anchor });
        };
        for (const [idx, m] of members.entries()) {
            add(m.file, m.cls, idx === 0 ? 'statement' : 'fence-identity');
        }
        let unresolved = false;
        for (const m of members) {
            if (anchors.has('explicit-cross-reference')) {
                for (const token of refsByFile.get(m.file)?.migratedTo ?? []) {
                    const target = resolveToken(root, token);
                    if (target === null) {
                        unresolved = true;
                        add(`unknown:${token}`, 'unknown', 'explicit-cross-reference');
                    } else if (target !== m.file) {
                        add(target, classOf(target), 'explicit-cross-reference');
                    }
                }
            }
            for (const d of deferrers.get(m.file) ?? []) add(d.file, d.cls, 'named-slug');
        }
        rows.push({
            slug: path.basename(first.file, '.md') === 'SKILL.md'
                ? path.basename(path.dirname(first.file))
                : path.basename(first.file, '.md'),
            key,
            form: first.form,
            statement: first.display,
            carriers,
            count: carriers.length,
            unresolved,
        });
    }

    rows.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug) || a.key.localeCompare(b.key));
    return { rows, scannedFiles, roots };
}

/** The reporter's header — every class read, every class excluded, and why. */
export function headerLines(): string[] {
    const out: string[] = [];
    out.push('obligation-carrier census — read-only, no threshold, reds no build');
    out.push('');
    out.push('classes READ:');
    for (const c of CARRIER_CLASSES) out.push(`  ${c.name.padEnd(10)} ${c.root}`);
    out.push('');
    out.push('classes EXCLUDED (named, never silent):');
    for (const e of EXCLUDED_CLASSES) {
        out.push(`  ${e.name}`);
        for (const line of wrap(e.reason, 72)) out.push(`      ${line}`);
    }
    out.push('');
    out.push('identity anchors (structural — no similarity score decides a match):');
    out.push('  fence-identity            same fenced Iron Law text after whitespace collapse');
    out.push('  explicit-cross-reference  `Body migrated to X` / `Body merged into X`, resolved');
    out.push('  named-slug                `canonical: [`X`]` naming the artifact that homes it');
    out.push('  unknown                   a cross-reference token that resolves to no file');
    return out;
}

function wrap(text: string, width: number): string[] {
    const words = text.split(' ');
    const out: string[] = [];
    let line = '';
    for (const w of words) {
        if (line === '') line = w;
        else if (line.length + 1 + w.length <= width) line += ` ${w}`;
        else {
            out.push(line);
            line = w;
        }
    }
    if (line !== '') out.push(line);
    return out;
}

const OUT_REL = path.join('agents', 'runtime', 'reports', 'obligation-carriers.json');

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let root = REPO_ROOT;
    let top = 10;
    let write = true;
    let fenceOnly = false;
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--root') {
            const v = args[i + 1];
            if (v === undefined || v.startsWith('-')) {
                process.stderr.write('report_obligation_carriers: --root needs a directory\n');
                return 1;
            }
            root = path.resolve(v);
            i += 1;
        } else if (a === '--top') {
            const v = args[i + 1];
            const n = Number(v);
            if (v === undefined || !Number.isInteger(n) || n < 1) {
                process.stderr.write('report_obligation_carriers: --top needs a positive integer\n');
                return 1;
            }
            top = n;
            i += 1;
        } else if (a === '--no-write') {
            write = false;
        } else if (a === '--fence-only') {
            fenceOnly = true;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'usage: report_obligation_carriers [--root DIR] [--top N] [--no-write] [--fence-only]\n' +
                    '\n' +
                    '  --fence-only  reproduce the blind definition (fence identity alone), which\n' +
                    '                under-counts this tree by construction. Kept so the\n' +
                    '                under-count is reproducible rather than merely recorded.\n',
            );
            return 0;
        } else if (a !== undefined) {
            process.stderr.write(`report_obligation_carriers: unexpected argument ${a}\n`);
            return 1;
        }
    }

    let result: CensusResult;
    try {
        result = census(root, fenceOnly ? { anchors: ['fence-identity'] } : {});
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`${err.message}\n`);
            return 1;
        }
        throw err;
    }

    for (const line of headerLines()) process.stdout.write(`${line}\n`);
    const multi = result.rows.filter((r) => r.count > 1);
    process.stdout.write('\n');
    process.stdout.write(
        `scanned ${result.scannedFiles} markdown file(s) across ${result.roots.length} root(s)\n`,
    );
    process.stdout.write(
        `${result.rows.length} obligation(s); ${multi.length} carried by more than one artifact\n\n`,
    );
    process.stdout.write(`top ${Math.min(top, result.rows.length)} by carrier count:\n`);
    for (const row of result.rows.slice(0, top)) {
        process.stdout.write(`\n  ${row.count}  ${row.slug}  [${row.form}]${row.unresolved ? ' (unresolved pointer)' : ''}\n`);
        process.stdout.write(`      ${row.statement}\n`);
        for (const c of row.carriers) {
            process.stdout.write(`      - ${c.path}  (${c.cls}, ${c.anchor})\n`);
        }
    }

    if (write) {
        const target = path.join(root, OUT_REL);
        try {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, `${JSON.stringify({ rows: result.rows, scannedFiles: result.scannedFiles }, null, 2)}\n`, 'utf-8');
            process.stdout.write(`\nwrote ${OUT_REL}\n`);
        } catch (err) {
            // A report that could not be written is a missing reading, never a
            // failed run: the table above is the product and it already printed.
            process.stdout.write(`\ncould not write ${OUT_REL}: ${String(err)}\n`);
        }
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
