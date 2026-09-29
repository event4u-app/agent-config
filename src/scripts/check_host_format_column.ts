#!/usr/bin/env tsx
/**
 * check_host_format_column.ts — the compile-time (format) column of
 * `docs/enforcement-by-host.md`'s host table may only name paths an emitter in
 * this tree actually writes.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Cursor cell read `.cursorrules` from the day the table was written until
 * 2026-09-29. Nothing in this tree has ever written that file: the projection
 * maps `.cursor/rules` (`condense.ts` `TOOL_DIRS`) and the install-time emitter
 * writes `.cursor/rules/<name>.mdc` (`src/install/emit_host_rules_cli.ts`
 * `emitCursor`). The cell was hand-maintained, nothing compared it to an
 * emitter, and an external reader found it before any check did.
 *
 * A hand-maintained cell describing generated output is the defect. Correcting
 * the cell once fixes today; this gate is what makes the NEXT drift a failing
 * check rather than a reader's discovery.
 *
 * WHAT IT PROVES, AND WHAT IT DOES NOT
 * ------------------------------------
 * It proves every path the format column names is a path some emitter in this
 * tree produces. It does NOT prove the converse — a host whose surface this
 * package writes but whose cell omits it is not a finding here, because the
 * cell is prose describing a host's native format and is allowed to name one
 * representative surface rather than enumerate all of them. Nor does it say
 * anything about whether a host READS what is written; that is a fact about the
 * host and no gate in this repository can reach it.
 *
 * THE ORACLE — MEASURED FIRST, DECLARED SECOND, NEVER SCRAPED
 * -----------------------------------------------------------
 * The risk with a check like this is the inverse failure: it reds on a cell
 * that is correct, gets disabled, and the column goes back to being
 * hand-maintained — which is what produced the Cursor error in the first place.
 * Scraping literal strings out of an emitter's source is how that happens,
 * because targets built by interpolation never appear as literals. So the
 * emitted set is built two ways and neither reads the emitters' text:
 *
 *   1. MEASURED. {@link measuredEmitterSurfaces} RUNS the two install-time rule
 *      emitters against a throwaway rules directory and walks what they left on
 *      disk. Interpolated or not, a path only enters the set if an emitter
 *      actually wrote it. This is the strongest half and it covers the two rows
 *      the original defect touched.
 *   2. DECLARED. {@link declaredRoots} and {@link anchorDirs} import two
 *      registries the projection generators and the installer are already bound
 *      to — `ADAPTER_REGISTRY` (kept in step with the README matrix and with
 *      `GENERATOR_OUTPUT_ROOTS` by `lint_supported_tools_matrix`) and
 *      `USER_SCOPE_PATHS`. These cover the surfaces whose generators need a
 *      whole repository to run and so cannot be executed from inside a gate.
 *      The two are NOT interchangeable and the split is load-bearing: a
 *      declared root is a directory an emitter writes into, so a cell may
 *      refine it; an anchor is a whole tool's home and is matched exactly. See
 *      {@link anchorDirs} for what conflating them accepted.
 *
 * Exit codes: 0 every named path is emitted · 1 a cell names a path no emitter
 * writes · 2 the document is missing, or its table is gone (a gate that read
 * nothing has not passed).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ADAPTER_REGISTRY } from './_lib/tool_adapter_registry.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { splitMarkdownRow } from './_lib/md_table.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { emitCursor, emitWindsurf } from '../install/emit_host_rules_cli.js';
import { USER_SCOPE_PATHS } from '../install/wizard-plan.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'check_host_format_column';
export const DOC_REL = path.join('docs', 'enforcement-by-host.md');

/** The header row that opens the table this gate reads. Matched exactly. */
export const TABLE_HEADER = '| Host | Compile-time rules | Lifecycle slots bound |';

const KNOWN_FLAGS: ReadonlySet<string> = new Set(['--self-test', '--root', '--quiet']);

export interface FormatCell {
    /** The row's first cell, verbatim. */
    host: string;
    /** The compile-time cell, verbatim. */
    cell: string;
    /** Backtick-quoted tokens in the cell that look like paths. */
    tokens: string[];
}

/**
 * Does a backticked token look like a path rather than prose?
 *
 * Deliberately permissive in one direction only: a token that is not a path is
 * skipped, so a cell may carry `✅` or a word in backticks without being
 * dragged into the comparison. A token that IS a path is always checked — the
 * class this gate exists for.
 */
export function looksLikePath(token: string): boolean {
    if (token === '') return false;
    return token.includes('/') || token.startsWith('.') || token.endsWith('.md');
}

/** Read the host table's format column. Returns [] when the table is absent. */
export function parseFormatColumn(docText: string): FormatCell[] {
    const lines = docText.split('\n');
    const start = lines.findIndex((l) => l.trim() === TABLE_HEADER);
    if (start === -1) return [];
    const out: FormatCell[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        if (!line.trim().startsWith('|')) break;
        const cells = splitMarkdownRow(line);
        const host = cells[0] ?? '';
        // The separator row (`|---|---|---|`) is structure, not a row.
        if (/^:?-{2,}:?$/.test(host)) continue;
        const cell = cells[1] ?? '';
        const tokens = [...cell.matchAll(/`([^`]+)`/g)]
            .map((m) => m[1] ?? '')
            .filter(looksLikePath);
        out.push({ host, cell, tokens });
    }
    return out;
}

/** Strip `~/`, collapse separators, drop leading and trailing slashes. */
export function normalizeSurface(p: string): string[] {
    const cleaned = p
        .trim()
        .replace(/^~[/\\]/, '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
    return cleaned.split('/').filter((s) => s !== '');
}

/** One path segment, with `*` matching any run of non-separator characters. */
function segmentMatches(tokenSeg: string, surfaceSeg: string): boolean {
    if (!tokenSeg.includes('*')) return tokenSeg === surfaceSeg;
    const rx = new RegExp(
        `^${tokenSeg.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`,
    );
    return rx.test(surfaceSeg);
}

/**
 * Does a table token name the same surface as an emitted path?
 *
 * Three relations count, and each answers a real shape the column uses:
 *
 *  - the token is the emitted path, segment for segment (`.clinerules`);
 *  - the token REFINES an emitted root, so the root is a prefix of it
 *    (`.cursor/rules/*.mdc` under the emitted root `.cursor/rules`), or the
 *    token is a root the emitter wrote a file beneath;
 *  - the token is the emitted path's tail, so a cell may name a surface by the
 *    filename a reader recognises (`copilot-instructions.md` for the emitted
 *    `.github/copilot-instructions.md`).
 *
 * The tail relation is the loosest of the three and is worth naming as such: it
 * accepts a token that omits a directory. It does NOT loosen the case this gate
 * was built for — `.cursorrules` is one segment, and no emitted path in this
 * tree has a segment by that name, so it matches under none of the three.
 */
export function matchesSurface(token: string, surface: string, refineable = true): boolean {
    const t = normalizeSurface(token);
    const s = normalizeSurface(surface);
    if (t.length === 0 || s.length === 0) return false;
    const prefix = (a: string[], b: string[]): boolean =>
        a.length <= b.length && a.every((seg, i) => segmentMatches(seg, b[i] ?? ''));
    if (prefix(t, s)) return true;
    if (!refineable) return false;
    if (prefix(s, t)) return true;
    // Tail relation: compare the token against the last |t| segments.
    if (t.length < s.length) {
        const tail = s.slice(s.length - t.length);
        return t.every((seg, i) => segmentMatches(seg, tail[i] ?? ''));
    }
    return false;
}

/**
 * Run the install-time rule emitters into a throwaway tree and report what they
 * wrote, repo-relative and posix-separated.
 *
 * This is the measured half of the oracle. The fixture is one rule file with
 * the frontmatter a real rule carries, because the emitters read frontmatter to
 * build their host-native forms and an empty file would exercise a path no
 * install takes.
 */
export function measuredEmitterSurfaces(): string[] {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'host-format-column-'));
    try {
        const rulesDir = path.join(tmp, 'rules');
        const projectRoot = path.join(tmp, 'project');
        fs.mkdirSync(rulesDir, { recursive: true });
        fs.mkdirSync(projectRoot, { recursive: true });
        fs.writeFileSync(
            path.join(rulesDir, 'fixture-rule.md'),
            [
                '---',
                'type: auto',
                'description: Fixture rule, used only to measure emitter output paths.',
                'triggers: [fixture]',
                '---',
                '# Fixture rule',
                '',
                'Body.',
                '',
            ].join('\n'),
            'utf-8',
        );
        emitCursor(rulesDir, projectRoot);
        emitWindsurf(rulesDir, projectRoot);

        const found: string[] = [];
        const walk = (dir: string): void => {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) walk(full);
                else found.push(path.relative(projectRoot, full).split(path.sep).join('/'));
            }
        };
        walk(projectRoot);
        return found.sort();
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

/**
 * The declared half of the oracle — tool roots the projection generators are
 * already bound to. These are roots an emitter writes INTO, so a cell may
 * legitimately refine one (`.cursor/rules` → `.cursor/rules/*.mdc`).
 */
export function declaredRoots(): string[] {
    const out = new Set<string>();
    for (const entry of ADAPTER_REGISTRY) {
        for (const root of entry.roots) out.add(root);
    }
    return [...out].sort();
}

/**
 * The installer's per-tool user-scope anchor directories.
 *
 * These are matched EXACTLY and are deliberately not refineable, which the
 * self-test pins. An anchor is a whole tool's home (`~/.cursor/`), so treating
 * it as a root anything may refine accepts every path beneath it — and the
 * gate's own self-test caught exactly that: `.cursor/rules.mdc`, a plausible
 * mistyping of the Cursor cell, passed on the strength of the `~/.cursor/`
 * anchor while no emitter writes it. A cell may name an anchor (the Codex row
 * names `~/.codex/`); it may not name something inside one and be believed.
 */
export function anchorDirs(): string[] {
    return [...new Set(Object.values(USER_SCOPE_PATHS))].sort();
}

export interface Finding {
    host: string;
    token: string;
}

/** Every format-column token that no emitted surface accounts for. */
export function unemittedTokens(
    cells: readonly FormatCell[],
    roots: readonly string[],
    anchors: readonly string[],
): Finding[] {
    const findings: Finding[] = [];
    for (const row of cells) {
        for (const token of row.tokens) {
            const backed =
                roots.some((s) => matchesSurface(token, s)) ||
                anchors.some((s) => matchesSurface(token, s, false));
            if (!backed) findings.push({ host: row.host, token });
        }
    }
    return findings;
}

function _read(root: string, rel: string): string | null {
    try {
        return fs.readFileSync(path.join(root, rel), 'utf-8');
    } catch {
        return null;
    }
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    // An unrecognised flag is refused rather than ignored: this gate runs in a
    // required CI job, and a mistyped flag that still exits 0 hands back a
    // green nobody earned.
    const unknown = args.filter(
        (a, i) => a.startsWith('-') && !KNOWN_FLAGS.has(a) && args[i - 1] !== '--root',
    );
    if (unknown.length > 0) {
        process.stderr.write(
            `${GATE}: unrecognised flag(s): ${unknown.join(', ')}\n` +
                `    known: ${[...KNOWN_FLAGS].join(', ')}\n`,
        );
        return 2;
    }
    if (args.includes('--self-test')) return selfTest();
    // `--root` is validated rather than coalesced. Silently falling back to
    // ROOT on a missing or option-shaped value means `--root --quiet` checks
    // THIS repository while the caller believes it checked a fixture, and a
    // fixture test written that way passes without ever reading the fixture.
    // Repeats are refused for the same reason: two values and one winner is a
    // caller who does not know which root was read.
    const rootFlags = args.filter((a) => a === '--root');
    if (rootFlags.length > 1) {
        process.stderr.write(`${GATE}: \`--root\` given ${String(rootFlags.length)} times; pass it once.\n`);
        return 2;
    }
    const rootIdx = args.indexOf('--root');
    if (rootIdx !== -1) {
        const v = args[rootIdx + 1];
        if (v === undefined || v.startsWith('-')) {
            process.stderr.write(
                `${GATE}: \`--root\` needs a directory` +
                    (v === undefined ? '' : `, got \`${v}\``) +
                    '.\n',
            );
            return 2;
        }
    }
    const positional = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '--root');
    if (positional.length > 0) {
        process.stderr.write(`${GATE}: unexpected argument(s): ${positional.join(', ')}\n`);
        return 2;
    }
    const root = rootIdx === -1 ? ROOT : (args[rootIdx + 1] as string);
    const quiet = args.includes('--quiet');

    const docText = _read(root, DOC_REL);
    if (docText === null) {
        process.stderr.write(`❌  ${GATE}: ${DOC_REL} not found under ${root}\n`);
        return 2;
    }

    const cells = parseFormatColumn(docText);

    // The scope assertion runs BEFORE the verdict. A document whose table
    // header moved or whose rows were deleted yields zero cells, and a gate
    // that read nothing must fail loudly rather than print a green over an
    // empty corpus.
    try {
        reportScanned({
            gate: GATE,
            scanned: cells.length,
            units: 'format-column cell(s)',
            roots: [DOC_REL],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(
                `❌  ${exc.message}\n` +
                    `    The table is found by its header line, matched exactly:\n` +
                    `    ${TABLE_HEADER}\n`,
            );
            return 2;
        }
        throw exc;
    }

    const measured = measuredEmitterSurfaces();
    const roots = [...new Set([...measured, ...declaredRoots()])];
    const anchors = anchorDirs();

    const findings = unemittedTokens(cells, roots, anchors);

    if (!quiet) {
        process.stdout.write(
            `${GATE}: ${String(measured.length)} measured emitter path(s), ` +
                `${String(roots.length)} emitted root(s), ` +
                `${String(anchors.length)} user-scope anchor(s) (exact match only)\n`,
        );
        for (const m of measured) process.stdout.write(`    measured  ${m}\n`);
    }

    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(
                `❌  ${GATE}: ${DOC_REL} § the ${f.host} row names \`${f.token}\`, ` +
                    'which is neither a measured emitter output nor a declared ' +
                    'emitted root.\n',
            );
        }
        process.stdout.write(
            `\n${String(findings.length)} finding(s). The format column describes generated ` +
                'output, so the correction belongs in the cell — name the path an emitter ' +
                'really writes. Emitted roots this gate knows about:\n' +
                roots
                    .slice()
                    .sort()
                    .map((s) => `    ${s}\n`)
                    .join('') +
                'If a NEW emitter was added, it belongs in `ADAPTER_REGISTRY` (or in the ' +
                'measured pair) in the same change — a gate that cannot see an emitter ' +
                'reports a true cell as drift, which is how a gate gets disabled.\n',
        );
        return 1;
    }

    // The claim is deliberately weaker than "an emitter wrote this path". Only
    // the MEASURED half was observed being written; the DECLARED half is a root
    // read out of `ADAPTER_REGISTRY`, which is the projection's source of truth
    // but is not an observation this run took. An independent review refused
    // the earlier wording for overstating exactly that gap, and a gate whose
    // green line claims more than its oracle checked is the failure this file
    // was written to stop, one level up.
    process.stdout.write(
        `✅  ${GATE}: every path named in ${String(cells.length)} format-column cell(s) of ` +
            `${DOC_REL} resolves to a measured emitter output or to a root declared in ` +
            '`ADAPTER_REGISTRY`.\n',
    );
    return 0;
}

/**
 * One rejecting case per way the column and the emitters can part company.
 *
 * The first is the historical defect by name: planting `.cursorrules` back into
 * the Cursor cell must red the gate. The empty-root case is the scope
 * assertion's own — a document with no table must fail rather than pass over an
 * empty corpus.
 */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'host-format-column-st-'));
    const docText = _read(ROOT, DOC_REL) ?? '';
    const plant = (name: string, mutate: (doc: string) => string): string => {
        const dir = path.join(tmp, name);
        fs.mkdirSync(path.join(dir, path.dirname(DOC_REL)), { recursive: true });
        fs.writeFileSync(path.join(dir, DOC_REL), mutate(docText), 'utf-8');
        return dir;
    };
    const run = (root: string): number =>
        runGateCli(ROOT, `src/scripts/${GATE}.ts`, ['--root', root, '--quiet'], root);
    // Argv cases run against a planted-GOOD root, so the only thing that can
    // make them non-zero is the argument shape. An argv guard tested against a
    // root that would fail anyway proves nothing about the guard.
    const runArgs = (args: readonly string[]): number =>
        runGateCli(ROOT, `src/scripts/${GATE}.ts`, args, ROOT);

    try {
        return runSelfTest({
            gate: GATE,
            minCases: 9,
            minRejectCases: 8,
            cases: [
                {
                    name: 'the historical defect — `.cursorrules` planted back into the Cursor cell',
                    expect: 'reject',
                    run: () =>
                        run(
                            plant('cursorrules', (d) =>
                                d.replace(
                                    '| Cursor | ✅ `.cursor/rules/*.mdc` | 5 |',
                                    '| Cursor | ✅ `.cursorrules` | 5 |',
                                ),
                            ),
                        ),
                },
                {
                    // The row is replaced whole, never just the token: the same
                    // token appears in the prose paragraph above the table,
                    // which this gate does not scan, and `String.replace` takes
                    // the FIRST occurrence — so a token-level fixture silently
                    // mutated the prose and asserted nothing. Caught by this
                    // suite reporting the case as not behaving.
                    name: 'a plausible near-miss — `.cursor/rules.mdc` — is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            plant('nearmiss', (d) =>
                                d.replace(
                                    '| Cursor | ✅ `.cursor/rules/*.mdc` | 5 |',
                                    '| Cursor | ✅ `.cursor/rules.mdc` | 5 |',
                                ),
                            ),
                        ),
                },
                {
                    name: 'an invented surface on a correct neighbouring row is rejected',
                    expect: 'reject',
                    run: () =>
                        run(plant('invented', (d) => d.replace('| Cline | ✅ `.clinerules` | 5 |', '| Cline | ✅ `.clinereles` | 5 |'))),
                },
                {
                    name: 'a document with no host table is rejected, not passed over an empty corpus',
                    expect: 'reject',
                    run: () => run(plant('empty', (d) => d.replace(TABLE_HEADER, '| Host | Other |'))),
                },
                {
                    name: 'the committed table passes',
                    expect: 'accept',
                    run: () => run(plant('good', (d) => d)),
                },
                // The three argv shapes an independent review found accepted on
                // 2026-09-29. Each one silently read THIS repository while the
                // caller believed it had named a root — a fixture test written
                // that way passes without ever opening the fixture, which is the
                // failure mode a gate's own self-test exists to make impossible.
                // Both shapes below are constructed so the COALESCING code
                // would have exited 0: a trailing `--root` and a repeated
                // `--root ROOT` both fall back to ROOT, which passes. Pointing
                // them at a root that fails anyway would have made the cases
                // reject on the unfixed code too — a test that cannot fail for
                // the reason it names.
                {
                    name: 'a trailing `--root` with no value is refused, not coalesced to ROOT',
                    expect: 'reject',
                    run: () => runArgs(['--quiet', '--root']),
                },
                {
                    name: '`--root` given twice is refused rather than silently picking one',
                    expect: 'reject',
                    run: () => runArgs(['--root', ROOT, '--root', ROOT, '--quiet']),
                },
                {
                    name: 'an unexpected positional argument is refused',
                    expect: 'reject',
                    run: () => runArgs(['stray', '--quiet']),
                },
                // Round 3 of the review asked for this shape by name, and it is
                // carried with its limitation stated: it does NOT discriminate.
                // The coalescing code set `root = '--quiet'`, found no document
                // under it, and also exited 2 — so this case pins the branch's
                // behaviour and documents the motivating shape, while the three
                // cases above are the ones that would have caught the defect.
                // Labelled rather than quietly counted, because a self-test
                // suite whose cases are not all discriminating should say which.
                {
                    name: '`--root` with an option-shaped value is refused (pins the shape; does not discriminate)',
                    expect: 'reject',
                    run: () => runArgs(['--root', '--quiet']),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
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
