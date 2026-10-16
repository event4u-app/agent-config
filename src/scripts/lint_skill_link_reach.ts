#!/usr/bin/env tsx
/**
 * Cross-skill body links resolve inside the tree a consumer receives.
 *
 * `road-to-inbox-harvest-2026-08-f-skill-selection-evidence` Phase 2.2.
 *
 * ── Why the DELIVERED tree and not `src/` ───────────────────────────────────
 * `check_references` already walks `dist/agent-src` and reports a broken path.
 * What it cannot answer is the question a consumer has: *does this link resolve
 * in the tree I was given*. A link is not broken because its target is missing
 * from the repository — it is broken because the target is missing from the
 * SUBSET that shipped, and those are different failures with different fixes.
 *
 * So the corpus is `dist/agent-src/skills`, which is what the installer
 * deploys. Not `src/skills`, whose contents a consumer never sees, and
 * deliberately not per-pack: the roadmap's own step leaves the per-pack half to
 * a parked owner, and a check that silently widened to it would be answering a
 * question nobody asked here.
 *
 * ── The pattern, and the two links a tighter one misses ─────────────────────
 * `](../<slug>/SKILL.md` — no trailing `\)`. With the paren the count is 974
 * rather than 976, because two links carry an anchor (`SKILL.md#section`). That
 * is the measurement note Phase 2.1 records, and it is the reason this gate does
 * not close the pattern: a two-link blind spot in a link checker is a link
 * checker that reports clean while missing exactly the shape most likely to rot.
 *
 * Relative links resolve against their own file. A link inside `references/*.md`
 * (recursively) is resolved against that file's directory, and a `SKILL.md`
 * link into the skill's own `references/`, `scripts/`, `assets/` or `examples/`
 * is resolved against the skill directory. A link that climbs out to `docs/` is
 * its own reported class — `docs/` is not delivered, and
 * `measure_docs_dead_links` owns that question. A link inside a fenced block or
 * an inline code span, or one carrying an angle-bracket placeholder, is not a
 * link. Other `SKILL.md` links that leave the skill directory are not gated by
 * this step; their unresolved count is printed so the class stays visible.
 *
 * Exit codes: 0 clean · 1 unresolved link(s) · 2 usage / dead corpus.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The delivered skills tree — what the installer deploys. */
export const DELIVERED_SKILLS_ROOT = 'dist/agent-src/skills';

/**
 * A relative cross-skill body link.
 *
 * Deliberately NOT anchored on a closing paren — see the header. An anchor
 * suffix (`SKILL.md#heading`) is a link like any other and must resolve.
 */
const CROSS_SKILL_LINK = /\]\(\.\.\/([a-z0-9-]+)\/SKILL\.md/g;

/** The same shape as a bare target — already checked against the delivered set. */
const CROSS_SKILL_TARGET = /^\.\.\/[a-z0-9-]+\/SKILL\.md(?:#.*)?$/;

/**
 * Links from one reference file to a sibling reference of the same skill.
 *
 * A reference stays one level deep, so every reference is reached from the
 * head. The ceiling is the count on 2026-10-16 and only moves down: above it
 * fails, below it prints the lower figure to record.
 */
export const SIBLING_LINK_CEILING = 7;

/** The skill subdirectories a `SKILL.md` link may point into. */
const OWN_SKILL_DIRS = /^(?:\.\/)?(?:references|scripts|assets|examples)\//;

/** A link that climbs out to `docs/`, which the installer does not deliver. */
const DOCS_TARGET = /^(?:\.\.\/)+docs\//;

/** Every inline markdown link target; a quoted title after it is tolerated. */
const MARKDOWN_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Body text with fenced blocks and inline code spans removed. */
export function linkableText(source: string): string {
    const out: string[] = [];
    let fence: string | null = null;
    for (const line of source.split('\n')) {
        const m = /^\s*(`{3,}|~{3,})/.exec(line);
        const marker = m?.[1];
        if (fence !== null) {
            if (marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
            continue;
        }
        if (marker !== undefined) {
            fence = marker;
            continue;
        }
        out.push(line.replace(/`[^`]*`/g, ''));
    }
    return out.join('\n');
}

/** Relative link targets worth resolving: no scheme, no bare anchor, no placeholder. */
export function relativeTargets(source: string): string[] {
    const targets: string[] = [];
    for (const m of linkableText(source).matchAll(MARKDOWN_LINK)) {
        const target = m[1] as string;
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/')) continue;
        if (/[<>]/.test(target)) continue;
        targets.push(target);
    }
    return targets;
}

/** The absolute path a relative target names, or null for a bare anchor. */
function resolveTarget(fromDir: string, target: string): string | null {
    const bare = target.split('#')[0]?.split('?')[0] ?? '';
    if (bare === '') return null;
    let decoded = bare;
    try {
        decoded = decodeURIComponent(bare);
    } catch {
        // A malformed escape is checked under its raw spelling.
    }
    return path.resolve(fromDir, decoded);
}

function targetExists(fromDir: string, target: string): boolean {
    const resolved = resolveTarget(fromDir, target);
    return resolved === null || fs.existsSync(resolved);
}

/** Every markdown file under a skill's `references/`, recursively, sorted. */
function referenceFiles(skillDir: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((x, y) => x.name.localeCompare(y.name))) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.md')) out.push(full);
        }
    };
    walk(path.join(skillDir, 'references'));
    return out;
}

export interface UnresolvedLink {
    /** Skill whose body carries the link. */
    from: string;
    /** Slug the link points at. */
    to: string;
}

export interface ReachReport {
    /** Skills present in the delivered tree. */
    delivered: number;
    /** Cross-skill links examined. */
    links: number;
    unresolved: UnresolvedLink[];
    /** Gated relative links resolved against their own file. */
    fileLinks: number;
    unresolvedFiles: UnresolvedFileLink[];
    /** Links into `docs/` — not delivered; reported, never failing. */
    docsLinks: number;
    /** Unresolved `SKILL.md` links that leave the skill directory — reported only. */
    bodyEscapesUnresolved: number;
    /** Reference files linking a sibling reference of their own skill. */
    siblingLinks: UnresolvedFileLink[];
}

export interface UnresolvedFileLink {
    /** File carrying the link, relative to the delivered skills root. */
    file: string;
    /** The target exactly as written. */
    target: string;
}

/** Every skill directory in the delivered tree. */
export function deliveredSkills(root: string): string[] {
    const dir = path.join(root, DELIVERED_SKILLS_ROOT);
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
    } catch {
        return [];
    }
}

/** Check every delivered skill's body links against the delivered set. */
export function run(root: string, ledger?: GateLedger): ReachReport {
    const slugs = deliveredSkills(root);
    const present = new Set(slugs);
    const unresolved: UnresolvedLink[] = [];
    const unresolvedFiles: UnresolvedFileLink[] = [];
    const siblingLinks: UnresolvedFileLink[] = [];
    let links = 0;
    let fileLinks = 0;
    let docsLinks = 0;
    let bodyEscapesUnresolved = 0;
    const skillsRoot = path.join(root, DELIVERED_SKILLS_ROOT);
    for (const slug of slugs) {
        ledger?.plan(slug);
        const skillDir = path.join(skillsRoot, slug);
        const file = path.join(skillDir, 'SKILL.md');
        let source: string;
        try {
            source = fs.readFileSync(file, 'utf-8');
        } catch {
            // A skill directory with no SKILL.md carries no body links. Recorded
            // as a skip rather than silently completed, so the ledger's planned
            // count stays honest about what was actually read.
            ledger?.skip(slug, 'no_applicable_files');
            continue;
        }
        let bad = 0;
        for (const m of source.matchAll(CROSS_SKILL_LINK)) {
            links += 1;
            const target = m[1] as string;
            if (!present.has(target)) {
                unresolved.push({ from: slug, to: target });
                bad += 1;
            }
        }
        for (const target of relativeTargets(source)) {
            if (CROSS_SKILL_TARGET.test(target)) continue;
            if (DOCS_TARGET.test(target)) {
                docsLinks += 1;
                continue;
            }
            const exists = targetExists(skillDir, target);
            if (!OWN_SKILL_DIRS.test(target)) {
                if (!exists) bodyEscapesUnresolved += 1;
                continue;
            }
            fileLinks += 1;
            if (!exists) {
                unresolvedFiles.push({ file: `${slug}/SKILL.md`, target });
                bad += 1;
            }
        }
        for (const ref of referenceFiles(skillDir)) {
            const rel = path.relative(skillsRoot, ref).split(path.sep).join('/');
            for (const target of relativeTargets(fs.readFileSync(ref, 'utf-8'))) {
                if (DOCS_TARGET.test(target)) {
                    docsLinks += 1;
                    continue;
                }
                fileLinks += 1;
                if (!targetExists(path.dirname(ref), target)) {
                    unresolvedFiles.push({ file: rel, target });
                    bad += 1;
                    continue;
                }
                const resolved = resolveTarget(path.dirname(ref), target);
                if (
                    resolved !== null &&
                    resolved !== ref &&
                    resolved.endsWith('.md') &&
                    resolved.startsWith(path.join(skillDir, 'references') + path.sep)
                ) {
                    siblingLinks.push({ file: rel, target });
                }
            }
        }
        if (bad > 0) ledger?.fail(slug, `${String(bad)} unresolved link(s)`);
        else ledger?.complete(slug);
    }
    return {
        delivered: slugs.length,
        links,
        unresolved,
        fileLinks,
        unresolvedFiles,
        docsLinks,
        bodyEscapesUnresolved,
        siblingLinks,
    };
}

/** Self-test. The rejecting case is a link to a skill that is not delivered. */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(REPO_ROOT, '.link-reach-selftest-'));
    const mk = (slug: string, body: string): void => {
        const d = path.join(tmp, DELIVERED_SKILLS_ROOT, slug);
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'SKILL.md'), body, 'utf-8');
    };
    const fresh = (): void => {
        fs.rmSync(path.join(tmp, 'dist'), { recursive: true, force: true });
    };
    const invoke = (): number =>
        runGateCli(REPO_ROOT, 'src/scripts/lint_skill_link_reach.ts', ['--root', tmp, '--quiet'], REPO_ROOT);
    try {
        return runSelfTest({
            gate: 'lint_skill_link_reach',
            minCases: 5,
            minRejectCases: 3,
            cases: [
                {
                    name: 'a link to a skill that is NOT delivered is rejected',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        mk('a', 'see [b](../b/SKILL.md)\n');
                        return invoke();
                    },
                },
                {
                    name: 'a link carrying an ANCHOR is checked too — the two-link blind spot',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        mk('a', 'see [b](../b/SKILL.md#some-heading)\n');
                        return invoke();
                    },
                },
                {
                    name: 'a references/ link one ../ short is rejected',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        mk('a', 'body\n');
                        mk('b', 'body\n');
                        const refs = path.join(tmp, DELIVERED_SKILLS_ROOT, 'a', 'references');
                        fs.mkdirSync(refs, { recursive: true });
                        fs.writeFileSync(path.join(refs, 'r.md'), 'see [b](../b/SKILL.md)\n', 'utf-8');
                        return invoke();
                    },
                },
                {
                    name: 'a link to a delivered skill is accepted',
                    expect: 'accept',
                    run: () => {
                        fresh();
                        mk('a', 'see [b](../b/SKILL.md)\n');
                        mk('b', 'body\n');
                        return invoke();
                    },
                },
                {
                    name: 'an empty delivered tree is REFUSED, not passed',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        fs.mkdirSync(path.join(tmp, DELIVERED_SKILLS_ROOT), { recursive: true });
                        return invoke();
                    },
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        if (process.env['GATE_SELF_TEST_CHILD'] === '1') {
            process.stderr.write('lint_skill_link_reach: --self-test must not recurse\n');
            return 2;
        }
        return selfTest();
    }
    const rootIdx = argv.indexOf('--root');
    const rootArg = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
    const root = rootArg === undefined ? REPO_ROOT : path.resolve(rootArg);
    const quiet = argv.includes('--quiet');
    const isFixture = root !== REPO_ROOT;
    const ceilingIdx = argv.indexOf('--sibling-ceiling');
    const siblingCeiling = ceilingIdx >= 0 ? Number(argv[ceilingIdx + 1]) : SIBLING_LINK_CEILING;
    if (!Number.isInteger(siblingCeiling) || siblingCeiling < 0) {
        process.stderr.write('lint_skill_link_reach: --sibling-ceiling takes a non-negative integer\n');
        return 2;
    }

    const ledger = isFixture ? undefined : new GateLedger('lint_skill_link_reach');
    const report = run(root, ledger);

    const sink = (chunk: string): boolean => {
        if (!quiet) process.stdout.write(chunk);
        return true;
    };
    try {
        reportScanned(
            {
                gate: 'lint_skill_link_reach',
                scanned: report.delivered,
                units: 'delivered skill(s)',
                roots: [DELIVERED_SKILLS_ROOT],
            },
            sink,
        );
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    if (report.unresolved.length > 0 || report.unresolvedFiles.length > 0) {
        if (!quiet && report.unresolved.length > 0) {
            process.stderr.write(
                `❌  lint_skill_link_reach: ${String(report.unresolved.length)} cross-skill link(s) ` +
                    `do not resolve inside ${DELIVERED_SKILLS_ROOT}:\n`,
            );
            for (const u of report.unresolved) {
                process.stderr.write(`   ${u.from}/SKILL.md → ../${u.to}/SKILL.md  (not delivered)\n`);
            }
            process.stderr.write(
                '   A consumer following that link gets a 404. Either the target belongs in the\n' +
                    '   delivered set, or the link should point at something that is.\n',
            );
        }
        if (!quiet && report.unresolvedFiles.length > 0) {
            process.stderr.write(
                `❌  lint_skill_link_reach: ${String(report.unresolvedFiles.length)} relative link(s) ` +
                    `resolve to nothing against their own file inside ${DELIVERED_SKILLS_ROOT}:\n`,
            );
            for (const u of report.unresolvedFiles) process.stderr.write(`   ${u.file} → ${u.target}\n`);
            process.stderr.write(
                '   A link inside references/ resolves against references/, so it needs one more\n' +
                    '   ../ than the same link written in SKILL.md.\n',
            );
        }
        ledger?.report(quiet ? () => undefined : undefined);
        return 1;
    }
    const siblings = report.siblingLinks.length;
    if (siblings > siblingCeiling) {
        if (!quiet) {
            process.stderr.write(
                `❌  lint_skill_link_reach: ${String(siblings)} reference-to-sibling-reference link(s), ` +
                    `ceiling ${String(siblingCeiling)}. A reference file links no sibling reference of its ` +
                    'own skill — link it from SKILL.md instead:\n',
            );
            for (const s of report.siblingLinks) process.stderr.write(`   ${s.file} → ${s.target}\n`);
        }
        ledger?.report(quiet ? () => undefined : undefined);
        return 1;
    }
    if (!quiet && siblings < siblingCeiling) {
        process.stdout.write(
            `   sibling-reference links fell to ${String(siblings)} — lower SIBLING_LINK_CEILING ` +
                `from ${String(siblingCeiling)} to ${String(siblings)}.\n`,
        );
    }
    ledger?.report(quiet ? () => undefined : undefined);
    if (!quiet) {
        process.stdout.write(
            `✅  lint_skill_link_reach: ${String(report.links)} cross-skill link(s) and ` +
                `${String(report.fileLinks)} relative link(s) across ` +
                `${String(report.delivered)} delivered skill(s) all resolve.\n` +
                `   reported, not gated: ${String(report.docsLinks)} link(s) into docs/ (not delivered — ` +
                `measure_docs_dead_links owns them) · ${String(report.bodyEscapesUnresolved)} unresolved ` +
                `SKILL.md link(s) leaving the skill directory.\n`,
        );
    }
    return 0;
}

/* c8 ignore start */
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href;
}
if (isCliEntry()) {
    process.exit(main());
}
/* c8 ignore stop */
