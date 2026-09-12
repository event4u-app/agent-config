#!/usr/bin/env tsx
/**
 * A held object cited as blocking live work carries an arrival count.
 *
 * WHAT A HELD OBJECT IS, AND WHAT MAKES ONE VISIBLE
 * -------------------------------------------------
 * A stub or a parked roadmap is an argument the estate decided not to run
 * right now. Every one of them was created by a round that raised its subject.
 * That first round is the arrival the object already records by existing, so a
 * held object nobody has raised again owes no counter — there is nothing to
 * count.
 *
 * What changes that is a CITATION: a live roadmap naming the object inside a
 * blocker, which is the estate saying "this held thing is in the way of work
 * we are doing now". That is the subject arriving a second time, and from then
 * on the number is the fact a reader needs. Without it the next round meets a
 * fresh argument instead of a count, re-derives the same conclusion, and the
 * recurrence stays invisible — the failure this check exists to notice.
 *
 * WHY THE CITER SET IS THE LIVE ESTATE AND NOTHING ELSE
 * -----------------------------------------------------
 * Measured before the rule was written, not after. Widening the citers to
 * every markdown file in the tree fires on 56 of 72 held objects, and widening
 * only to archived roadmaps and stored review inputs fires on 54 of 66. Both
 * populations are dominated by records that are historical by construction: an
 * archived roadmap asserts what was true when it closed, and a stored review
 * input asserts what a reviewer saw on a scope that no longer exists. Neither
 * is the estate asking again. A check reading them as live citations reds on
 * four fifths of its corpus on the day it lands, which is a suppression target
 * wearing a control's clothes.
 *
 * So a citer is an active or parked roadmap, and the citation must sit in that
 * roadmap's blocker scope rather than anywhere in its prose. Both narrowings
 * are load-bearing and both were measured.
 *
 * ADVISORY BY DEFAULT, AND THE REASON IS RECORDED
 * -----------------------------------------------
 * It ships reporting rather than blocking. The false-positive rate over the
 * live corpus was measured first and is 0 of 4 firings, which would permit
 * blocking on its own. What forbids it today is that the same reading has the
 * check red on four live objects the moment it lands, and a gate that arrives
 * red is a backlog rather than a control. `--enforce` exits non-zero, so the
 * promotion is a flag rather than an edit, and the condition is written into
 * the measurement record beside the rate.
 *
 * Exit: 0 advisory (always) · with `--enforce`, 1 on any firing · 2 on a
 * usage error or a dead scope.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Directories whose members are held objects. */
export const HELD_DIRS = ['agents/roadmaps/stubs', 'agents/roadmaps/later'] as const;

/**
 * Directories whose roadmaps are live citers.
 *
 * The active tree, plus the parked tree because a parked roadmap resumes and
 * its blockers resume with it. The archived tree is deliberately absent.
 */
export const CITER_DIRS = ['agents/roadmaps', 'agents/roadmaps/later'] as const;

/** The line a held object carries once its subject has arrived again. */
export const ARRIVAL_RE = /^>\s*\*\*Arrivals:\*\*\s*\S/m;

/** A citation of a held object, by file name, inside a citer's prose. */
const HELD_REF_RE = /(?:stubs|later)\/([a-z0-9][a-z0-9\-.]*\.md)/g;

export interface Finding {
    /** Repo-relative path of the held object with no counter. */
    held: string;
    /** Repo-relative paths of the live citers naming it inside a blocker. */
    citers: string[];
}

export interface Result {
    findings: Finding[];
    /** Held objects cited inside a live blocker — the population the rate is taken over. */
    cited: number;
    /** Held objects found at all, so a collapsed corpus is visible. */
    held: number;
}

function listMarkdown(dir: string): string[] {
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

function read(file: string): string {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return '';
    }
}

/**
 * Held-object names a citer raises inside its blocker scope.
 *
 * Blocker scope opens at a `## Blockers` heading or at any `### blocker:`
 * heading and closes at the next `## ` heading. A mention in a phase step or a
 * risk row is the estate referring to the object, not declaring itself blocked
 * on it, and the two must not read the same.
 */
export function blockerCitations(text: string): Set<string> {
    const out = new Set<string>();
    let inBlocker = false;
    for (const line of text.split('\n')) {
        if (line.startsWith('## ')) inBlocker = line.trim().toLowerCase().startsWith('## blockers');
        if (line.startsWith('### blocker:')) inBlocker = true;
        if (!inBlocker) continue;
        HELD_REF_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = HELD_REF_RE.exec(line)) !== null) {
            const name = m[1];
            if (name !== undefined) out.add(name);
        }
    }
    return out;
}

export function scan(root: string): Result {
    const held = new Map<string, string>();
    for (const d of HELD_DIRS) {
        for (const f of listMarkdown(path.join(root, d))) held.set(path.basename(f), f);
    }

    const citerFiles = new Set<string>();
    for (const d of CITER_DIRS) for (const f of listMarkdown(path.join(root, d))) citerFiles.add(f);
    // A held object citing another held object is not the estate asking again;
    // it is one parked argument pointing at its neighbour. Parked roadmaps are
    // citers, and a parked roadmap is also a held object, so the two sets
    // overlap by construction and a self-citation must not count.
    const citations = new Map<string, Set<string>>();
    for (const f of [...citerFiles].sort()) {
        const self = path.basename(f);
        for (const name of blockerCitations(read(f))) {
            if (name === self) continue;
            if (!held.has(name)) continue;
            const set = citations.get(name) ?? new Set<string>();
            set.add(path.relative(root, f));
            citations.set(name, set);
        }
    }

    const findings: Finding[] = [];
    for (const [name, citers] of [...citations.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const file = held.get(name);
        if (file === undefined) continue;
        if (ARRIVAL_RE.test(read(file))) continue;
        findings.push({ held: path.relative(root, file), citers: [...citers].sort() });
    }
    return { findings, cited: citations.size, held: held.size };
}

export function check(root: string, enforce: boolean, write = process.stdout.write.bind(process.stdout)): number {
    const res = scan(root);
    // Published before the verdict on every path: a gate that says what it read
    // only when it passes leaves the coverage census blind exactly when it
    // matters.
    reportScanned({
        gate: 'check_held_object_arrivals',
        scanned: res.cited,
        units: 'held object(s) cited inside a live blocker',
        roots: [...CITER_DIRS],
        allowEmpty:
            'EMPTY_VALID: zero held objects cited inside a live blocker is a real and ' +
            'desirable estate state — nothing is currently blocked on a held argument. The ' +
            'held-object corpus itself is asserted separately below, so a moved root is ' +
            'still caught.',
    });
    if (res.held === 0) {
        write('❌  no held objects found — the held-object directories are empty or moved.\n');
        return 2;
    }
    if (res.findings.length === 0) {
        write(
            `✅  ${String(res.cited)} held object(s) cited inside a live blocker, all carrying an arrival line ` +
                `(of ${String(res.held)} held objects).\n`,
        );
        return 0;
    }
    const label = enforce ? '❌' : '⚠️';
    write(
        `${label}  ${String(res.findings.length)} of ${String(res.cited)} held object(s) cited inside a live blocker ` +
            'carry no arrival line:\n',
    );
    for (const f of res.findings) {
        write(`  · ${f.held}\n`);
        for (const c of f.citers) write(`      cited by ${c}\n`);
    }
    write(
        '\nEach one is a subject that arrived at least twice — once to create the object, ' +
            'once in the blocker above. Derive the count with `report_held_object_arrivals ' +
            '<object> --pattern <subject>` and write the line by hand, with its pattern and ' +
            'denominator, so the number carries a reason.\n',
    );
    if (!enforce) {
        write('\nAdvisory: exiting 0. `--enforce` turns these into a failure.\n');
    }
    return enforce ? 1 : 0;
}

/**
 * The check proving it still discriminates.
 *
 * The accept cases are the two that a firing-on-everything version would get
 * wrong: an uncited held object with no counter is a first arrival and owes
 * nothing, and an object cited outside blocker scope is being referred to
 * rather than blocked on.
 */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'held-arrivals-selftest-'));
    const HELD_BODY = '---\ncomplexity: lightweight\n---\n\n# Stub: a held subject\n\nbody\n';
    const COUNTED_BODY =
        '---\ncomplexity: lightweight\n---\n\n# Stub: a held subject\n\n' +
        '> **Arrivals:** 3 — latest `round-b` (2026-01-02); earlier `round-a`.\n\nbody\n';

    const build = (name: string, heldBody: string, citerBody: string): string => {
        const root = path.join(tmp, name);
        fs.mkdirSync(path.join(root, 'agents', 'roadmaps', 'stubs'), { recursive: true });
        fs.mkdirSync(path.join(root, 'agents', 'roadmaps', 'later'), { recursive: true });
        fs.writeFileSync(path.join(root, 'agents', 'roadmaps', 'stubs', 'road-to-held.md'), heldBody);
        fs.writeFileSync(path.join(root, 'agents', 'roadmaps', 'road-to-live.md'), citerBody);
        return root;
    };
    const citerWithBlocker =
        '# Road to live work\n\n## Phase 1\n\n- [ ] 1.1 do a thing\n\n## Blockers\n\n' +
        '### blocker: the held thing\n- **Status:** open\n- **Blocks:** everything\n' +
        '- **What to do:** read `stubs/road-to-held.md` and decide.\n';
    const citerWithoutBlocker =
        '# Road to live work\n\n## Phase 1\n\n' +
        '- [ ] 1.1 read `stubs/road-to-held.md` for background, then do a thing\n';

    const run = (root: string, enforce: boolean): number =>
        runGateCli(
            REPO_ROOT,
            'src/scripts/check_held_object_arrivals.ts',
            enforce ? ['--root', root, '--enforce'] : ['--root', root],
            root,
        );

    try {
        return runSelfTest({
            gate: 'check_held_object_arrivals',
            minCases: 5,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a held object cited inside a blocker with no arrival line is rejected',
                    expect: 'reject',
                    run: () => run(build('cited-uncounted', HELD_BODY, citerWithBlocker), true),
                },
                {
                    name: 'an empty held corpus is rejected rather than reported clean',
                    expect: 'reject',
                    run: () => {
                        const root = path.join(tmp, 'dead-scope');
                        fs.mkdirSync(path.join(root, 'agents', 'roadmaps'), { recursive: true });
                        return run(root, false);
                    },
                },
                {
                    name: 'a first-arrival held object with no counter and no citation passes',
                    expect: 'accept',
                    run: () => run(build('uncited', HELD_BODY, '# Road to live work\n\n## Phase 1\n\n- [ ] 1.1 x\n'), true),
                },
                {
                    name: 'a held object mentioned outside blocker scope passes',
                    expect: 'accept',
                    run: () => run(build('outside-blocker', HELD_BODY, citerWithoutBlocker), true),
                },
                {
                    name: 'a cited held object that carries its arrival line passes',
                    expect: 'accept',
                    run: () => run(build('counted', COUNTED_BODY, citerWithBlocker), true),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'usage: check_held_object_arrivals [--root DIR] [--enforce] [--self-test]\n\n' +
                '  --enforce   exit 1 on any firing; the default is advisory\n',
        );
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();
    const i = argv.indexOf('--root');
    return check(i === -1 ? REPO_ROOT : (argv[i + 1] ?? REPO_ROOT), argv.includes('--enforce'));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
