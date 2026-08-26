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
    let links = 0;
    for (const slug of slugs) {
        ledger?.plan(slug);
        const file = path.join(root, DELIVERED_SKILLS_ROOT, slug, 'SKILL.md');
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
        if (bad > 0) ledger?.fail(slug, `${String(bad)} unresolved cross-skill link(s)`);
        else ledger?.complete(slug);
    }
    return { delivered: slugs.length, links, unresolved };
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
            minCases: 4,
            minRejectCases: 2,
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

    if (report.unresolved.length > 0) {
        if (!quiet) {
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
        ledger?.report(quiet ? () => undefined : undefined);
        return 1;
    }
    ledger?.report(quiet ? () => undefined : undefined);
    if (!quiet) {
        process.stdout.write(
            `✅  lint_skill_link_reach: ${String(report.links)} cross-skill link(s) across ` +
                `${String(report.delivered)} delivered skill(s) all resolve.\n`,
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
