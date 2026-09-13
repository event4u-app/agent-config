#!/usr/bin/env node
/**
 * Gate: a major that ships BREAKING CHANGES owes `docs/MIGRATION.md` a section.
 *
 * WHY THIS EXISTS. `lint_scheduled_deprecations` is the FORWARD half of the
 * release pre-flight's MIGRATION.md obligation — commitments due at a future
 * major. The backward half had nothing at all behind it, and it failed exactly
 * the way an unchecked obligation does: 15.0.0 and 16.0.0 both shipped
 * BREAKING CHANGES, neither had a migration section, and the gap survived
 * seventeen separate reports before anything in the tree could see it.
 *
 * WHAT IT REQUIRES, AND WHAT IT DELIBERATELY DOES NOT. A major section in a
 * changelog carrying at least one `### BREAKING CHANGES` entry must have a
 * `## ` heading in `docs/MIGRATION.md` naming that version. That is the whole
 * requirement: a STATED ANSWER, never a non-empty procedure. Not every
 * breaking change asks something of a consumer, and a gate that could not
 * express "this asks nothing of you" would turn into a ritual heading with no
 * content — which is worse than no gate, because the heading would be
 * believed. The 16.0.0 section this gate ships beside says exactly that, and
 * passes.
 *
 * THE FLOOR, AND WHY IT IS A CONSTANT RATHER THAN `package.json`. Majors below
 * {@link FLOOR_MAJOR} are out of scope. The obvious alternative — grandfather
 * everything at or below the shipped version, the cutoff `lint_changelog_rollback`
 * uses — would leave this gate comparing ZERO majors on the day it lands, which
 * is the "a gate that scans nothing exits green" shape. A constant floor set at
 * the oldest major this repository actually carries a section for means the gate
 * does real arithmetic from its first run (two majors today, both passing) and
 * a reader can see which historical majors were forgiven and why.
 *
 * EXIT CONTRACT
 *   0  every in-scope major has a section, or none is in scope for a reason
 *      the output names
 *   1  an in-scope major carries BREAKING CHANGES and has no section, or the
 *      scan root is dead
 *   2  usage error
 *
 * `--root <dir>` drives the whole check against a fixture tree, which is the
 * seam `--self-test` and the unit suite use. `--self-test` proves the rule
 * against the real CLI on inline fixtures.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'lint_major_migration_sections';
export const MIGRATION_PATH = path.join('docs', 'MIGRATION.md');
const CHANGELOG_PATH = 'CHANGELOG.md';
const ARCHIVE_DIR = path.join('docs', 'archive');

/**
 * Oldest major this gate holds to the requirement.
 *
 * 15 because 15.0.0 is the oldest major `docs/MIGRATION.md` carries a section
 * for. Everything below it shipped before the obligation existed and is
 * forgiven on the record rather than silently: retro-failing eight majors
 * nobody can now write an honest section for is the gate-lands-as-N-blockers
 * failure this repository has refused before. Raise it only by deleting a
 * section, which is not a move this gate should make cheap.
 */
export const FLOOR_MAJOR = 15;

const MAJOR_HEADING_RE = /^## \[(\d+)\.(\d+)\.(\d+)\]/;
const ANY_SECTION_RE = /^#{1,2} /;
const BREAKING_HEADING_RE = /^### BREAKING CHANGES\s*$/;
const SUB_HEADING_RE = /^### /;
const BULLET_RE = /^\*\s+\S/;

/** One major section found in a changelog file. */
export interface MajorSection {
    /** Bare `X.0.0`. */
    readonly version: string;
    readonly major: number;
    /** Repo-relative file the heading was read from. */
    readonly source: string;
    /** 1-based heading line. */
    readonly line: number;
    /** BREAKING CHANGES bullets under the heading. */
    readonly breaking: number;
}

/**
 * Collect every `## [X.0.0](…)` section and how many BREAKING bullets it has.
 *
 * Minor and patch sections are not returned at all: the obligation is stated
 * per MAJOR, because that is the boundary a consumer plans an upgrade around
 * and the boundary the release runbook already stops at.
 */
export function findMajorSections(text: string, source: string): MajorSection[] {
    const lines = text.split('\n');
    const out: MajorSection[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = MAJOR_HEADING_RE.exec(lines[i] as string);
        if (m === null) continue;
        if (m[2] !== '0' || m[3] !== '0') continue;
        let breaking = 0;
        let inBreaking = false;
        for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j] as string;
            if (ANY_SECTION_RE.test(line)) break;
            if (BREAKING_HEADING_RE.test(line)) {
                inBreaking = true;
                continue;
            }
            if (inBreaking && SUB_HEADING_RE.test(line)) {
                inBreaking = false;
                continue;
            }
            if (inBreaking && BULLET_RE.test(line)) breaking += 1;
        }
        out.push({
            version: `${m[1] as string}.0.0`,
            major: Number(m[1]),
            source,
            line: i + 1,
            breaking,
        });
    }
    return out;
}

/**
 * Versions named by a `## ` heading in `docs/MIGRATION.md`.
 *
 * The heading text is matched on a whole version token, so both shapes the
 * file already uses are accepted — `## 16.0.0 — …` and `## 8.x → 9.0.0 — …` —
 * without this gate dictating a heading grammar the file did not choose.
 */
export function migrationVersions(text: string): Set<string> {
    const out = new Set<string>();
    for (const line of text.split('\n')) {
        if (!line.startsWith('## ')) continue;
        for (const m of line.matchAll(/(?<![\d.])(\d+)\.0\.0(?![\d.])/g)) {
            out.add(`${m[1] as string}.0.0`);
        }
    }
    return out;
}

export interface Finding {
    readonly section: MajorSection;
}

/** Read every changelog file under `root`, newest-era file first. */
export function changelogSources(root: string): string[] {
    const out: string[] = [];
    if (fs.existsSync(path.join(root, CHANGELOG_PATH))) out.push(CHANGELOG_PATH);
    const archive = path.join(root, ARCHIVE_DIR);
    if (fs.existsSync(archive)) {
        for (const name of fs.readdirSync(archive).sort()) {
            if (name.startsWith('CHANGELOG-') && name.endsWith('.md')) {
                out.push(path.join(ARCHIVE_DIR, name));
            }
        }
    }
    return out;
}

export interface EvaluateResult {
    readonly findings: Finding[];
    readonly sections: MajorSection[];
    readonly inScope: number;
}

/**
 * Compare the majors found against the sections MIGRATION.md carries.
 *
 * Every section reaches exactly one ledger outcome: out of scope below the
 * floor, out of scope with no BREAKING entries, completed when a heading
 * exists, failed when it does not.
 */
export function evaluate(
    sections: readonly MajorSection[],
    migration: ReadonlySet<string>,
    ledger: GateLedger,
): EvaluateResult {
    const findings: Finding[] = [];
    let inScope = 0;
    for (const s of sections) {
        const target = `${s.source}:${s.version}`;
        ledger.plan(target);
        if (s.major < FLOOR_MAJOR) {
            ledger.outOfScope(target, 'declared_exemption');
            continue;
        }
        if (s.breaking === 0) {
            ledger.outOfScope(target, 'not_applicable_kind');
            continue;
        }
        inScope += 1;
        if (migration.has(s.version)) {
            ledger.complete(target);
            continue;
        }
        ledger.fail(target, `no docs/MIGRATION.md section for ${s.version}`);
        findings.push({ section: s });
    }
    return { findings, sections: [...sections], inScope };
}

/**
 * The cut-time question, answered against an entry that is not on disk yet.
 *
 * `release.ts` renders the changelog entry before prepending it, so at the
 * moment the cut can still be refused the section exists only in memory. This
 * takes that text directly rather than re-reading `CHANGELOG.md`, which at that
 * point still describes the PREVIOUS release.
 *
 * @returns a refusal reason naming the version, or `null` when the cut is clear.
 */
export function pendingMajorFinding(
    target: string,
    changelogEntry: string,
    migrationText: string,
): string | null {
    const m = /^(\d+)\.0\.0$/.exec(target.trim());
    if (m === null) return null;
    const sections = findMajorSections(changelogEntry, '(pending entry)');
    const breaking = sections.reduce((n, s) => n + s.breaking, 0);
    if (breaking === 0) return null;
    if (Number(m[1]) < FLOOR_MAJOR) return null;
    if (migrationVersions(migrationText).has(target)) return null;
    return (
        `the ${target} entry carries ${String(breaking)} BREAKING CHANGES entr(y/ies) and ` +
        `docs/MIGRATION.md has no "## " heading naming ${target}. Add one before the cut — ` +
        'a section stating that the change asks nothing of a consumer satisfies this, and is ' +
        'the right answer when it is true. What is not acceptable is silence.'
    );
}

function repoRoot(): string {
    return REPO_ROOT;
}

const SELF_TEST_MIN_CASES = 6;
const SELF_TEST_MIN_REJECT = 3;

/** Prove the rejections still fire against the real CLI, not against imports. */
function selfTest(): number {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lmms-selftest-'));
    const repo = repoRoot();
    const script = path.join('src', 'scripts', 'lint_major_migration_sections.ts');

    const changelog = (version: string, breakingBullets: readonly string[]): string =>
        [
            '# Changelog',
            '',
            `## [${version}](https://example.invalid/compare) (2026-01-01)`,
            '',
            ...(breakingBullets.length > 0
                ? ['### BREAKING CHANGES', '', ...breakingBullets.map((b) => `* ${b}`), '']
                : []),
            '### Features',
            '',
            '* something additive',
            '',
        ].join('\n');

    const fixture = (
        name: string,
        changelogText: string,
        migrationHeadings: readonly string[],
    ): number => {
        const dir = path.join(root, name);
        fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), changelogText, 'utf8');
        fs.writeFileSync(
            path.join(dir, 'docs', 'MIGRATION.md'),
            ['# Migration Guide', '', ...migrationHeadings.flatMap((h) => [h, '', 'body', ''])].join(
                '\n',
            ),
            'utf8',
        );
        return runGateCli(repo, script, ['--root', dir, '--quiet'], repo);
    };

    const cases: SelfTestCase[] = [
        {
            name: 'a major with BREAKING and no MIGRATION heading is refused',
            expect: 'reject',
            run: () => fixture('missing', changelog('17.0.0', ['**x:** drop y']), []),
        },
        {
            // The same fixture with the heading added. This pair IS the gate:
            // one half proves the refusal fires, the other that the heading is
            // what clears it, so neither can be satisfied by a gate that always
            // reds or always passes.
            name: 'the same major passes once the heading exists',
            expect: 'accept',
            run: () =>
                fixture('present', changelog('17.0.0', ['**x:** drop y']), [
                    '## 17.0.0 — what to do',
                ]),
        },
        {
            name: 'a heading naming a DIFFERENT major does not satisfy the requirement',
            expect: 'reject',
            run: () =>
                fixture('wrong-version', changelog('17.0.0', ['**x:** drop y']), [
                    '## 16.0.0 — what to do',
                ]),
        },
        {
            name: 'an arrow-form heading naming the version satisfies it',
            expect: 'accept',
            run: () =>
                fixture('arrow', changelog('17.0.0', ['**x:** drop y']), [
                    '## 16.x → 17.0.0 — what to do',
                ]),
        },
        {
            name: 'a major BELOW the floor is forgiven',
            expect: 'accept',
            run: () => fixture('below-floor', changelog('9.0.0', ['**x:** drop y']), []),
        },
        {
            name: 'a major with no BREAKING entries owes nothing',
            expect: 'accept',
            run: () => fixture('no-breaking', changelog('17.0.0', []), []),
        },
        {
            // The anti-vacuity half. A tree with no changelog at all must not
            // read as "every major has its section"; a gate that greens over an
            // empty corpus is the failure `_lib/scan_scope.ts` exists for.
            name: 'a tree with no changelog is a dead scan root, not a pass',
            expect: 'reject',
            run: () => {
                const dir = path.join(root, 'no-changelog');
                fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
                fs.writeFileSync(path.join(dir, 'docs', 'MIGRATION.md'), '# Migration Guide\n', 'utf8');
                return runGateCli(repo, script, ['--root', dir, '--quiet'], repo);
            },
        },
    ];

    try {
        return runSelfTest({
            gate: GATE,
            cases,
            minCases: SELF_TEST_MIN_CASES,
            minRejectCases: SELF_TEST_MIN_REJECT,
        });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[]): number {
    let root = REPO_ROOT;
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--quiet') quiet = true;
        else if (a === '--self-test') return selfTest();
        else if (a === '--root') {
            const next = argv[++i];
            if (next === undefined || next.startsWith('--')) {
                process.stderr.write('usage: --root expects a directory\n');
                return 2;
            }
            root = path.resolve(next);
        } else {
            process.stderr.write(
                `usage: ${GATE} [--root <dir>] [--quiet] [--self-test]\nunknown argument: ${String(a)}\n`,
            );
            return 2;
        }
    }

    const migrationFile = path.join(root, MIGRATION_PATH);
    if (!fs.existsSync(migrationFile)) {
        process.stderr.write(`❌  ${GATE}: ${MIGRATION_PATH} not found under ${root}\n`);
        return 1;
    }
    const migration = migrationVersions(fs.readFileSync(migrationFile, 'utf-8'));

    const sources = changelogSources(root);
    const sections: MajorSection[] = [];
    for (const rel of sources) {
        sections.push(...findMajorSections(fs.readFileSync(path.join(root, rel), 'utf-8'), rel));
    }

    const ledger = new GateLedger(GATE);
    const result = evaluate(sections, migration, ledger);
    const tally = ledger.finalize();

    try {
        // No `allowEmpty`. Zero major sections means the heading shape drifted
        // or the changelog moved — blindness, not cleanliness, and this
        // repository has shipped majors continuously since 1.x.
        reportScanned({
            gate: GATE,
            scanned: tally.planned,
            units: 'major changelog section(s)',
            roots: [CHANGELOG_PATH, ARCHIVE_DIR],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (result.findings.length > 0) {
        for (const f of result.findings) {
            process.stderr.write(
                `❌  ${GATE}: ${f.section.version} ships ${String(f.section.breaking)} BREAKING ` +
                    `CHANGES entr(y/ies) (${f.section.source}:${String(f.section.line)}) and ` +
                    `${MIGRATION_PATH} carries no "## " heading naming it.\n` +
                    `    Add a section for ${f.section.version}. A section stating that the change\n` +
                    '    asks nothing of a consumer satisfies this and is the right answer when it\n' +
                    '    is true — the requirement is a stated answer, never a procedure.\n',
            );
        }
        return 1;
    }

    if (!quiet) {
        ledger.report();
        process.stdout.write(
            `✅  ${GATE}: ${String(tally.planned)} major section(s) read, ` +
                `${String(result.inScope)} in scope (major >= ${String(FLOOR_MAJOR)} with BREAKING ` +
                'CHANGES), each with a migration section' +
                (result.inScope === 0
                    ? ' — NONE in scope this run, so no comparison ran. Green here means\n' +
                      '    "nothing to compare", not "the comparison passed".\n'
                    : '.\n'),
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
