#!/usr/bin/env tsx
/**
 * Consolidation-lineage checker — an incomplete lineage becomes a finding.
 *
 * A *consolidating* artifact declares itself a master over sibling proposals.
 * It presents its content as adjudicated: parents named, conflicts resolved, a
 * kill register saying what was rejected and why. When a parent is missing from
 * that list its content is not killed, it is **undiscussed** — and nothing in
 * the artifact distinguishes those two states. This gate makes the omission
 * visible; it never judges whether the omission was correct.
 *
 * Measured population that motivated it:
 * `agents/evidence/analysis/consolidation-lineage-census-2026-08-26.md` — four
 * inbox folders carrying a declared consolidation, four with an incomplete
 * lineage. n=4 is a lower bound on a population found by grep, not a rate.
 *
 * ## What it reads
 *
 * The canonical declaration is the frontmatter list `consolidates:`. Five
 * legacy spellings are recognised so a legacy artifact parses to the SAME
 * parent set rather than to an empty one — an empty set would report every
 * legacy consolidation as declaring zero parents, which is a finding storm that
 * discredits the check on its first run:
 *
 *   1. `consolidates:`                       frontmatter list   (canonical)
 *   2. `supersedes_analysis:`                frontmatter list
 *   3. `**Inputs consolidated:**`            prose bullet list
 *   4. `**Ersetzt als führendes Proposal:**` prose bullet list
 *   5. `Master-Konsolidierung` + table       markdown table, first column a name
 *   6. prose supersession sentence           "supersedes ... `a` and `b`"
 *
 * Shape 6 is a correction to the roadmap's count of five, recorded rather than
 * applied silently. The five are the shapes the census GREPPED for, i.e. the
 * ways an artifact announces "I am a consolidation". Shape 6 announces the same
 * relation in prose and is invisible to that grep — but the overlap finding
 * (F3) needs it, because in `evolve/` the omitted sibling declares supersession
 * over exactly the master's two parents in a prose sentence and in no field.
 * Without shape 6 the F3 verification the roadmap asks for cannot be met on its
 * own evidence.
 *
 * ## Findings
 *
 * - `omitted-sibling`   a `road-to-*.md` in the same folder that the declared
 *                       parent set does not name.
 * - `missing-parent`    a declared parent with no matching file — the lineage
 *                       names something nobody can open.
 * - `overlapping-sets`  two artifacts in one folder declaring overlapping parent
 *                       sets while neither names the other: an artifact that
 *                       reads as the settled answer while a peer of equal
 *                       standing exists.
 * - `claims-without-field`  consolidation vocabulary and no parseable
 *                       declaration. The trigger is the claim, not the filename:
 *                       two of the four census omissions were in files with no
 *                       `-master` in the name.
 *
 * ## Exit codes
 *
 * 0 = clean, or findings in report mode (the default). 1 = findings in
 * `--strict`. 2 = a usage or scope error. Report-mode-by-default is the risk-1
 * mitigation from the roadmap: an inbox folder routinely holds files that are
 * not parents, and a finding that is usually wrong gets ignored.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const ROADMAP_RE = /^road-to-.*\.md$/i;

/**
 * Vocabulary that makes an artifact CLAIM to be a consolidation — restricted to
 * a SELF-declaration in the header.
 *
 * Deliberately narrow, and the narrowness is risk 1 from the roadmap: an inbox
 * folder routinely holds files that merely *discuss* consolidation, and a
 * finding that is usually wrong gets ignored — worse than no finding.
 *
 * Measured on the four census folders, 2026-08-27: an unrestricted
 * `/consolidat|konsolidier|supersedes/i` over the whole file body fired
 * `claims-without-field` on **9** files, and **all 9 were parents** discussing
 * the consolidation rather than masters declaring one — a 9/9 false-positive
 * rate on its first run. Restricting to a self-referential phrase within the
 * first `HEADER_LINES` lines drops it to 0 on those folders while still
 * catching the one real case in the wider corpus
 * (`database-structure/road-to-database-mastery-master.md`, whose declaration
 * is an inline prose clause with no list).
 */
const CLAIM_RE =
    /Master-Konsolidierung|Inputs consolidated|Ersetzt als führendes Proposal|deliberately supersedes|^\s*(consolidates|supersedes_analysis)\s*:/im;

/** How much of a file counts as its header for CLAIM_RE. */
const HEADER_LINES = 40;

export type DeclKind =
    | 'consolidates'
    | 'supersedes_analysis'
    | 'inputs-consolidated'
    | 'ersetzt-als-fuehrendes-proposal'
    | 'master-konsolidierung-table'
    | 'prose-supersession'
    | 'none';

export interface Declaration {
    kind: DeclKind;
    /** Normalised parent stems, e.g. `road-to-shared-spine`. */
    parents: string[];
    /**
     * True when the artifact claims a consolidation but no shape yielded a
     * parent set. Deliberately distinct from `parents: []` with `kind: 'none'`,
     * which means "makes no claim".
     */
    unparseable: boolean;
}

export interface Finding {
    code: 'omitted-sibling' | 'missing-parent' | 'overlapping-sets' | 'claims-without-field';
    folder: string;
    file: string;
    detail: string;
}

/**
 * Normalise a declared parent to a comparable stem.
 *
 * Legacy lists carry the name in five different dresses: backticked or bare,
 * with or without `.md`, with a download-collision `(1)` suffix, and followed by
 * arbitrary prose (`road-to-gated-self-evolution` v3 (Claude-Session) — P0–P7).
 * Everything after the first token is commentary.
 */
export function normalizeParent(raw: string): string {
    let s = raw.trim();
    s = s.replace(/^[-*]\s+/, '');
    const tick = /`([^`]+)`/.exec(s);
    if (tick) {
        s = tick[1] as string;
    } else {
        s = (s.split(/[\s—–,;|]/)[0] ?? '').trim();
    }
    s = s.replace(/^.*\//, '');
    s = s.replace(/\.md$/i, '');
    s = s.replace(/\(\d+\)$/, '');
    s = s.trim();
    // A glob is a description of a file set, not a file. Prose that mentions
    // `road-to-*.md` is talking ABOUT roadmaps, not declaring a parent.
    if (/[*?\[\]]/.test(s)) return '';
    return s;
}

function frontmatterList(fm: string, key: string): string[] | null {
    const lines = fm.split(/\r?\n/);
    const head = new RegExp(`^${key}:\\s*(.*)$`);
    for (let i = 0; i < lines.length; i += 1) {
        const m = head.exec(lines[i] as string);
        if (!m) continue;
        const inline = (m[1] ?? '').trim();
        if (inline.startsWith('[')) {
            return inline
                .slice(1, inline.lastIndexOf(']') === -1 ? undefined : inline.lastIndexOf(']'))
                .split(',')
                .map((x) => normalizeParent(x.replace(/["']/g, '')))
                .filter(Boolean);
        }
        const out: string[] = [];
        for (let j = i + 1; j < lines.length; j += 1) {
            const line = lines[j] as string;
            if (/^\s*#/.test(line)) continue;
            const item = /^\s+-\s+(.*)$/.exec(line);
            if (item) {
                out.push(normalizeParent((item[1] as string).replace(/#.*$/, '')));
                continue;
            }
            if (line.trim() === '') continue;
            break;
        }
        return out.filter(Boolean);
    }
    return null;
}

/** A prose `**Label:**` heading followed by a `- ` bullet list. */
function proseList(body: string, label: RegExp): string[] | null {
    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
        if (!label.test(lines[i] as string)) continue;
        const out: string[] = [];
        for (let j = i + 1; j < lines.length; j += 1) {
            const line = lines[j] as string;
            const item = /^\s*[->]*\s*[-*]\s+(.*)$/.exec(line);
            if (item) {
                const n = normalizeParent(item[1] as string);
                if (n.startsWith('road-to-')) out.push(n);
                continue;
            }
            if (line.trim() === '' || /^>\s*$/.test(line)) continue;
            break;
        }
        if (out.length > 0) return out;
    }
    return null;
}

/** A `Master-Konsolidierung` marker followed by a table whose rows name files. */
function konsolidierungTable(body: string): string[] | null {
    if (!/Master-Konsolidierung/i.test(body)) return null;
    const out: string[] = [];
    for (const line of body.split(/\r?\n/)) {
        if (!line.trimStart().startsWith('|')) continue;
        for (const cell of line.split('|')) {
            const tick = /`(road-to-[^`]+)`/.exec(cell);
            if (tick) out.push(normalizeParent(tick[1] as string));
        }
    }
    return out.length > 0 ? out : null;
}

/** "…supersedes the planning shape of `a` and `b`…" spread over wrapped lines. */
function proseSupersession(body: string): string[] | null {
    const flat = body.replace(/\r?\n/g, ' ');
    const m = /supersedes\b([^.]*)\./i.exec(flat);
    if (!m) return null;
    const out: string[] = [];
    for (const tick of (m[1] as string).matchAll(/`(road-to-[^`]+)`/g)) {
        out.push(normalizeParent(tick[1] as string));
    }
    return out.length > 0 ? out : null;
}

export function parseDeclaration(text: string, surface: Surface = 'inbox'): Declaration {
    const fmMatch = FM_RE.exec(text);
    const fm = fmMatch ? (fmMatch[1] as string) : '';
    // A declaration is a HEADER statement. Reading the whole body finds the
    // word "supersedes" a thousand lines into a discussion and turns a sentence
    // about roadmaps into a parent set — measured on this repository's own
    // estate, where two roadmaps were flagged for prose that merely discusses a
    // consolidation. Same window, and same reason, as CLAIM_RE.
    const body = (fmMatch ? text.slice(fmMatch[0].length) : text)
        .split(/\r?\n/)
        .slice(0, HEADER_LINES)
        .join('\n');

    const shapes: ReadonlyArray<readonly [DeclKind, () => string[] | null]> = [
        ['consolidates', () => frontmatterList(fm, 'consolidates')],
        ['supersedes_analysis', () => frontmatterList(fm, 'supersedes_analysis')],
        ['inputs-consolidated', () => proseList(body, /\*\*Inputs consolidated:?\*\*/i)],
        [
            'ersetzt-als-fuehrendes-proposal',
            () => proseList(body, /\*\*Ersetzt als führendes Proposal:?\*\*/i),
        ],
        ['master-konsolidierung-table', () => konsolidierungTable(body)],
        ['prose-supersession', () => proseSupersession(body)],
    ];

    const active = surface === 'estate' ? shapes.slice(0, 2) : shapes;
    for (const [kind, read] of active) {
        const parents = read();
        if (parents && parents.length > 0) {
            return { kind, parents: [...new Set(parents)].sort(), unparseable: false };
        }
    }
    // A claim with no readable set is UNPARSEABLE, never an empty declaration.
    if (CLAIM_RE.test(text.split(/\r?\n/).slice(0, HEADER_LINES).join('\n'))) {
        return { kind: 'none', parents: [], unparseable: true };
    }
    return { kind: 'none', parents: [], unparseable: false };
}

interface Artifact {
    stem: string;
    file: string;
    decl: Declaration;
}

/**
 * Which surface a folder belongs to. One axis, because the two properties it
 * decides are not independent in practice.
 *
 * `inbox` — a drafting folder holding one session's sibling proposals
 * (`agents/tmp/`, `agents/tmp.old/`). Every `road-to-*.md` beside the master is
 * a candidate parent, so an omission is a finding; and the declaration may be
 * in any of the six spellings, because these artifacts predate the canonical
 * field. This is the shape the census measured.
 *
 * `estate` — the active roadmap set under `agents/roadmaps/`. Two differences,
 * both measured on this repository rather than assumed:
 *
 *   1. **No sibling inference.** Estate files are unrelated by construction, so
 *      inferring parents from neighbours makes every roadmap a mandatory parent
 *      of every other — 11 omitted-sibling findings on a 12-file estate, all
 *      wrong. That is the roadmap's risk 1 and the hazard the deciding council
 *      named: "blocking on an unvalidated universe risks turning legitimate
 *      neighboring files into mandatory parents".
 *   2. **Frontmatter declarations only.** The four prose spellings read a
 *      header window, and an estate roadmap's header routinely *describes* an
 *      inbox consolidation it was authored from. Measured: prose recognition
 *      turned two such descriptions into parent sets, one of them a `road-to-*`
 *      glob. A tracked roadmap declares its lineage in the canonical field —
 *      that is what step 1.1 of the roadmap fixed the field name FOR — so the
 *      legacy readers are scoped to the artifacts that need them.
 */
export type Surface = 'inbox' | 'estate';

export function analyseFolder(
    dir: string,
    folderLabel = path.basename(dir),
    surface: Surface = 'inbox',
): Finding[] {
    const findings: Finding[] = [];
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => ROADMAP_RE.test(n)).sort();
    } catch {
        return findings;
    }
    const artifacts: Artifact[] = names.map((n) => ({
        stem: n.replace(/\.md$/i, ''),
        file: n,
        decl: parseDeclaration(fs.readFileSync(path.join(dir, n), 'utf-8'), surface),
    }));
    const present = new Set(artifacts.map((a) => a.stem));

    for (const a of artifacts) {
        if (a.decl.unparseable) {
            findings.push({
                code: 'claims-without-field',
                folder: folderLabel,
                file: a.file,
                detail: 'declares a consolidation in prose but no parent set could be parsed — add `consolidates:`',
            });
            continue;
        }
        if (a.decl.parents.length === 0) continue;

        for (const p of a.decl.parents) {
            if (!present.has(p)) {
                findings.push({
                    code: 'missing-parent',
                    folder: folderLabel,
                    file: a.file,
                    detail: `declares parent \`${p}\` but no such file is present`,
                });
            }
        }
        const omitted =
            surface === 'inbox'
                ? artifacts.filter((b) => b.stem !== a.stem && !a.decl.parents.includes(b.stem)).map((b) => b.stem)
                : [];
        if (omitted.length > 0) {
            findings.push({
                code: 'omitted-sibling',
                folder: folderLabel,
                file: a.file,
                detail: `declared ${a.decl.parents.length}, present ${artifacts.length - 1}, omitted ${omitted
                    .map((o) => `\`${o}\``)
                    .join(', ')}`,
            });
        }
    }

    const declaring = artifacts.filter((a) => a.decl.parents.length > 0);
    for (let i = 0; i < declaring.length; i += 1) {
        for (let j = i + 1; j < declaring.length; j += 1) {
            const a = declaring[i] as Artifact;
            const b = declaring[j] as Artifact;
            const shared = a.decl.parents.filter((p) => b.decl.parents.includes(p));
            if (shared.length === 0) continue;
            if (a.decl.parents.includes(b.stem) || b.decl.parents.includes(a.stem)) continue;
            findings.push({
                code: 'overlapping-sets',
                folder: folderLabel,
                file: `${a.file} + ${b.file}`,
                detail: `both declare ${shared.map((s) => `\`${s}\``).join(', ')} and neither names the other`,
            });
        }
    }
    return findings;
}

interface Args {
    roots: string[];
    surface: Surface;
    flat: boolean;
    strict: boolean;
    json: boolean;
    quiet: boolean;
    selfTest: boolean;
}

function parseArgs(argv: string[]): Args {
    const a: Args = {
        roots: [],
        surface: 'inbox',
        flat: false,
        strict: false,
        json: false,
        quiet: false,
        selfTest: false,
    };
    let surfaceGiven = false;
    for (let i = 0; i < argv.length; i += 1) {
        const v = argv[i] as string;
        if (v === '--flat') a.flat = true;
        else if (v === '--strict') a.strict = true;
        else if (v === '--json') a.json = true;
        else if (v === '--quiet') a.quiet = true;
        else if (v === '--self-test') a.selfTest = true;
        else if (v === '--root') a.roots.push(path.resolve(REPO_ROOT, argv[++i] as string));
        else if (v.startsWith('--root=')) a.roots.push(path.resolve(REPO_ROOT, v.slice('--root='.length)));
        else if (v === '--surface' || v.startsWith('--surface=')) {
            const raw = v.startsWith('--surface=') ? v.slice('--surface='.length) : (argv[++i] as string);
            if (raw !== 'inbox' && raw !== 'estate') {
                process.stderr.write(`lint_consolidation_lineage: --surface must be inbox|estate\n`);
                process.exit(2);
            }
            a.surface = raw;
            surfaceGiven = true;
        }
        else {
            process.stderr.write(`lint_consolidation_lineage: unrecognized argument: ${v}\n`);
            process.exit(2);
        }
    }
    if (a.roots.length === 0) {
        // The default root is the ACTIVE ESTATE, whose files are unrelated by
        // construction — so sibling inference is off unless asked for.
        a.roots.push(path.join(REPO_ROOT, 'agents', 'roadmaps'));
        a.flat = true;
        if (!surfaceGiven) a.surface = 'estate';
    }
    return a;
}

/**
 * Prove the gate can go red without touching the tree.
 *
 * A gate whose corpus is legitimately clean reports "0 findings" whether it
 * works or not. The self-test builds the census's own shapes in a temp dir and
 * asserts each finding fires, so a green run on the real tree is a statement
 * about the tree rather than about the checker.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lineage-'));
    const w = (rel: string, body: string): void => {
        const abs = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    };
    const cli = (dir: string, extra: readonly string[]): number =>
        runGateCli(REPO_ROOT, 'src/scripts/lint_consolidation_lineage.ts', ['--root', path.join(tmp, dir), '--strict', ...extra], REPO_ROOT);

    // Rejection is measured under `--strict`. The gate ships in REPORT mode by
    // council decision, so its default exit code carries no verdict — asserting
    // against it would prove nothing. `--strict` is the same detection with a
    // non-zero exit, which is what a self-test needs and what a canary cannot
    // supply for a report-mode gate.
    w('cmp/road-to-master.md', '---\nconsolidates:\n  - road-to-a.md\n  - road-to-ghost.md\n---\n# m\n');
    w('cmp/road-to-a.md', '# a\n');
    w('cmp/road-to-b.md', '---\nsupersedes_analysis:\n  - road-to-a\n---\n# b\n');
    w('claim/road-to-a.md', '# a\n');
    w('claim/road-to-m.md', '# m\n\n**Status: ersetzt als führendes Proposal:** `road-to-a` v1, prose only.\n');
    w('clean/road-to-a.md', '# a\n');
    w('clean/road-to-b.md', '# b\n');
    w('clean/road-to-m.md', '---\nconsolidates:\n  - road-to-a.md\n  - road-to-b.md\n---\n# m\n');
    w('estate-ghost/road-to-m.md', '---\nconsolidates:\n  - road-to-never-existed.md\n---\n# m\n');
    w(
        'estate-describes/road-to-m.md',
        '---\nstatus: draft\n---\n# m\n\n> **Source:** an inbox folder. The master there\n> supersedes — `road-to-x` v3 and `road-to-y`.\n\nA set difference over `road-to-*.md`.\n',
    );
    w('estate-describes/road-to-other.md', '# unrelated estate work\n');

    const spellings: ReadonlyArray<readonly [DeclKind, string]> = [
        ['consolidates', '---\nconsolidates:\n  - road-to-a.md\n  - road-to-b.md\n---\n#\n'],
        ['supersedes_analysis', '---\nsupersedes_analysis:\n  - road-to-a\n  - road-to-b\n---\n#\n'],
        ['inputs-consolidated', '# m\n\n**Inputs consolidated:**\n- `road-to-a(1).md`\n- `road-to-b.md`\n'],
        [
            'ersetzt-als-fuehrendes-proposal',
            '# m\n\n> **Ersetzt als führendes Proposal:**\n> - `road-to-a` v3 — P0\n> - `road-to-b` — Phase 0\n',
        ],
        [
            'master-konsolidierung-table',
            '# m — Master-Konsolidierung\n\n| ID | Roadmap |\n|---|---|\n| R1 | `road-to-a` |\n| R2 | `road-to-b` |\n',
        ],
        [
            'prose-supersession',
            '# m\n\n> This document deliberately supersedes the planning shape of\n> `road-to-a` and `road-to-b`.\n',
        ],
    ];

    const cases: SelfTestCase[] = [
        {
            name: 'a folder with an omitted sibling, a ghost parent and two competing masters',
            expect: 'reject',
            run: () => cli('cmp', []),
        },
        {
            name: 'a consolidation claim with no readable parent list',
            expect: 'reject',
            run: () => cli('claim', []),
        },
        {
            name: 'a complete folder stays silent — without this, a checker returning every code would pass',
            expect: 'accept',
            run: () => cli('clean', []),
        },
        {
            name: 'estate surface still reports a canonical declaration naming a file that does not exist',
            expect: 'reject',
            run: () => cli('estate-ghost', ['--surface', 'estate']),
        },
        {
            name: 'estate surface does NOT read a roadmap describing a consolidation as declaring one',
            expect: 'accept',
            run: () => cli('estate-describes', ['--surface', 'estate']),
        },
        {
            name: 'all six declaration spellings parse to the identical parent set',
            expect: 'accept',
            run: () => {
                for (const [kind, body] of spellings) {
                    const d = parseDeclaration(body);
                    if (d.kind !== kind || d.parents.join(',') !== 'road-to-a,road-to-b' || d.unparseable) {
                        process.stdout.write(
                            `      spelling ${kind} parsed as ${d.kind} -> [${d.parents.join(', ')}]\n`,
                        );
                        return 1;
                    }
                }
                return 0;
            },
        },
    ];

    const code = runSelfTest({
        gate: 'lint_consolidation_lineage',
        cases,
        minCases: 6,
        minRejectCases: 3,
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    return code;
}

export function main(argv: string[] | null = null): number {
    const args = parseArgs(argv ?? process.argv.slice(2));
    if (args.selfTest) return selfTest();

    const folders: Array<{ dir: string; label: string }> = [];
    // ENUMERATION, not a count, is this gate's dead-scope invariant.
    //
    // AI council 2026-08-30, anthropic + openai, convergent on option (b). The
    // count floor that used to guard this scope (`min_scanned: 5` in
    // gate-coverage.yml) sat over a population under deliberate drawdown to
    // ZERO, so every successful drain red the build and the only available
    // move was lowering the number again — a treadmill that would have ended at
    // a floor of 0, which is no floor at all.
    //
    // What replaced it has to live HERE rather than in check_gate_coverage, and
    // that placement is the load-bearing half of the verdict: an independent
    // `existsSync` in the coverage gate would observe a directory without
    // proving that THIS linter enumerated it. openai's seat put the invariant
    // as "successful enumeration of the exact declared root by the production
    // linter invocation". So a declared root that is missing, is not a
    // directory, or cannot be read is a hard failure naming the resolved path —
    // where the old code silently `continue`d, contributed zero, and passed
    // under the `allowEmpty` reason below.
    //
    // What this deliberately does NOT claim, because openai's seat listed the
    // gap and it would be dishonest to imply otherwise: it detects a missing or
    // renamed root. It does not detect a glob narrowed to match nothing,
    // enumeration in the wrong working directory, or roadmaps moved into nested
    // directories the walk no longer traverses. Those remain uncovered.
    for (const root of args.roots) {
        let stat: fs.Stats;
        try {
            stat = fs.statSync(root);
        } catch (err) {
            process.stderr.write(
                `❌  lint_consolidation_lineage: declared scan root does not exist: ${root}\n`
                    + `    (${(err as Error).message})\n`
                    + '    A root that cannot be resolved is a DEAD SCOPE, not an empty estate.\n',
            );
            return 1;
        }
        if (!stat.isDirectory()) {
            process.stderr.write(
                `❌  lint_consolidation_lineage: declared scan root is not a directory: ${root}\n`,
            );
            return 1;
        }
        try {
            fs.readdirSync(root);
        } catch (err) {
            process.stderr.write(
                `❌  lint_consolidation_lineage: declared scan root cannot be enumerated: ${root}\n`
                    + `    (${(err as Error).message})\n`
                    + '    Unreadable is not empty — a permission error must not read as a clean scan.\n',
            );
            return 1;
        }
        // A root that directly holds roadmaps IS a folder. Without this, a
        // `--root` pointed at a single consolidation folder scans zero files
        // and exits green — the "gates that scan nothing exit green" shape the
        // roadmap's risk 3 names, arriving through the CLI instead of CI.
        const direct = fs.readdirSync(root).filter((n) => ROADMAP_RE.test(n)).length > 0;
        if (direct || args.flat) {
            folders.push({ dir: root, label: path.relative(REPO_ROOT, root) || '.' });
        }
        if (args.flat) continue;
        for (const e of fs.readdirSync(root, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
            if (e.isDirectory()) folders.push({ dir: path.join(root, e.name), label: e.name });
        }
    }

    const findings: Finding[] = [];
    let scanned = 0;
    for (const f of folders) {
        const before = findings.length;
        findings.push(...analyseFolder(f.dir, f.label, args.surface));
        void before;
        try {
            scanned += fs.readdirSync(f.dir).filter((n) => ROADMAP_RE.test(n)).length;
        } catch {
            /* unreadable folder contributes nothing */
        }
    }

    if (args.json) {
        process.stdout.write(`${JSON.stringify({ scanned, findings }, null, 2)}\n`);
    }

    reportScanned({
        gate: 'lint_consolidation_lineage',
        scanned,
        units: 'roadmap file(s)',
        roots: args.roots.map((r) => path.relative(REPO_ROOT, r)),
        allowEmpty:
            'The active roadmap estate is under deliberate drawdown and may legitimately ' +
            'reach zero files; an empty estate is a completed drain, not a dead scan root. ' +
            'The count is published on every run so an empty scan stays visible rather ' +
            'than silently green.',
    });

    if (!args.json && !args.quiet) {
        for (const f of findings) {
            process.stdout.write(`  ${f.code} · ${f.folder}/${f.file}: ${f.detail}\n`);
        }
        const verb = args.strict ? 'error' : 'finding';
        process.stdout.write(
            findings.length === 0
                ? `✅  lint_consolidation_lineage: ${scanned} roadmap file(s), no lineage ${verb}s.\n`
                : `⚠️  lint_consolidation_lineage: ${findings.length} lineage ${verb}(s) across ${folders.length} folder(s).\n`,
        );
    }
    return args.strict && findings.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
