#!/usr/bin/env -S npx tsx
/**
 * check_release_holds — the one evaluator every release boundary reads.
 *
 * Template rule 28. Four modes, and the split matters because two of them run
 * on completely different paths:
 *
 *   --lint         a malformed declaration reddens NORMAL CI, so a broken hold
 *                  cannot fail open by being unparseable.
 *   --status       list every declared hold and its state. Read-only.
 *   --require-safe the RELEASE-path question: may a cut be published now?
 *   --selftest     every row of rule 28's state table, including the
 *                  not-evaluable row, asserted against fixtures.
 *
 * Exit codes: 0 = clean / safe · 1 = a violation or a refusal · 2 = usage.
 *
 * The load-bearing behaviour, and the one worth re-reading before changing
 * anything here: `not-evaluable` REFUSES, on every channel. An evaluator that
 * cannot read a declaration has learned nothing about whether the tree is safe,
 * and "learned nothing" is not "safe". There is deliberately no flag, label or
 * trailer anywhere in this file that turns a refusal into a pass.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    evaluateFile,
    evaluateHolds,
    lifecycleViolations,
    refuses,
    refusalReport,
    REFUSING_DIRS,
    type CutChannel,
    type Hold,
} from './_lib/release_holds.js';
import { REPO_ROOT } from './lint_roadmap_blockers.js';

const _HERE = fileURLToPath(import.meta.url);

/**
 * The folders a release question must read.
 *
 * Wider than `lint_roadmap_blockers`' active-only glob on purpose: rule 28's
 * per-folder lifecycle says a window does not disappear by moving the file, and
 * a `later/` roadmap still refuses. `archive/` and `skipped/` are included
 * because the move INTO them is refused while a window is open — a file that
 * reached them with an open window is a defect this must still see, not one it
 * should be blind to.
 */
const HOLD_DIRS = ['', 'later', 'archive', 'skipped', 'stubs'] as const;

function globRoadmaps(root = REPO_ROOT): string[] {
    const out: string[] = [];
    for (const sub of HOLD_DIRS) {
        const dir = path.join(root, 'agents', 'roadmaps', sub);
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            if (e.isFile() && e.name.endsWith('.md')) {
                out.push(path.join(dir, e.name));
            }
        }
    }
    return out.sort();
}

function collect(root = REPO_ROOT): Hold[] {
    return globRoadmaps(root).flatMap((f) => evaluateFile(f));
}

function rel(p: string): string {
    return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

function cmdLint(): number {
    const files = globRoadmaps();
    const holds = collect();
    const bad = holds.filter((h) => h.state === 'not-evaluable');

    // The lifecycle half. A move already made is what a gate can see: if a file
    // with a live window is sitting in `archive/` or `skipped/`, the refused
    // move happened, and reddening CI is how the move is refused in practice.
    const lifecycle = files.flatMap((f) => {
        const hs = evaluateFile(f);
        if (hs.length === 0) {
            return [];
        }
        let text: string;
        try {
            text = fs.readFileSync(f, 'utf8');
        } catch {
            return [];
        }
        return lifecycleViolations(f, hs, text);
    });

    process.stdout.write(`scanned: ${files.length}\n`);
    if (bad.length === 0 && lifecycle.length === 0) {
        process.stdout.write(
            `✅  check-release-holds: ${holds.length} declared hold(s), all well-formed, ` +
                `lifecycle clean\n`,
        );
        return 0;
    }
    if (bad.length > 0) {
        process.stderr.write('❌  check-release-holds: malformed declaration(s):\n');
        for (const h of bad) {
            for (const why of h.malformed) {
                process.stderr.write(`   - ${rel(h.file)} · hold \`${h.id}\`: ${why}\n`);
            }
        }
    }
    if (lifecycle.length > 0) {
        process.stderr.write('❌  check-release-holds: lifecycle violation(s):\n');
        for (const v of lifecycle) {
            process.stderr.write(`   - ${rel(v.file)} · hold \`${v.holdId}\`: ${v.reason}\n`);
        }
    }
    return 1;
}

/**
 * Answer the move BEFORE it happens, so the loop asks rather than discovers.
 *
 * `--can-move <file> <archive|skipped|later>`; exit 0 permits, 1 refuses. The
 * `--lint` gate above is the backstop that catches a move made without asking.
 */
function cmdCanMove(file: string, dest: string): number {
    if (!(REFUSING_DIRS as readonly string[]).includes(dest) && dest !== 'later') {
        process.stderr.write(`❌  --can-move destination must be archive, skipped or later\n`);
        return 2;
    }
    const holds = evaluateFile(file);
    const live = holds.filter((h) => h.state === 'open' || h.state === 'not-evaluable');
    if (live.length === 0) {
        process.stdout.write(`✅  no live window — the move to \`${dest}/\` is permitted\n`);
        return 0;
    }
    if (dest === 'later') {
        let text = '';
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            /* an unreadable file is already not-evaluable above */
        }
        const problems = lifecycleViolations(
            path.join(REPO_ROOT, 'agents', 'roadmaps', 'later', path.basename(file)),
            holds,
            text,
        );
        if (problems.length === 0) {
            process.stdout.write(
                `✅  the move to \`later/\` is permitted — the window stays listed and still refuses\n`,
            );
            return 0;
        }
        for (const v of problems) {
            process.stderr.write(`❌  hold \`${v.holdId}\`: ${v.reason}\n`);
        }
        return 1;
    }
    for (const h of live) {
        process.stderr.write(
            `❌  REFUSED: hold \`${h.id}\` is ${h.state} — a roadmap with a live window may not ` +
                `move to \`${dest}/\`. Finish \`${h.clearedBy || '?'}\`, or move it to \`later/\`.\n`,
        );
    }
    return 1;
}

function cmdStatus(): number {
    const holds = collect();
    if (holds.length === 0) {
        process.stdout.write('No release holds declared. Every cut is permitted.\n');
        return 0;
    }
    for (const h of holds) {
        process.stdout.write(
            `${h.state.padEnd(14)} ${h.id.padEnd(28)} channel=${h.channel.padEnd(6)} ` +
                `opens=${h.openedBy || '-'} clears=${h.clearedBy || '-'}  ${rel(h.file)}\n`,
        );
    }
    return 0;
}

function cmdRequireSafe(cut: CutChannel): number {
    const report = refusalReport(collect(), cut);
    if (report === null) {
        process.stdout.write(`✅  release-holds: safe to cut (channel ${cut})\n`);
        return 0;
    }
    process.stderr.write(`❌  ${report}\n`);
    return 1;
}

/** Rule 28's state table, one fixture per row, plus the two channel cases. */
function cmdSelftest(): number {
    // Built line-by-line rather than as one template literal on purpose: a
    // heredoc whose lines begin with `##` reads to `lint_code_comments` as a
    // markdown heading left in source, and the fixture would redden a gate it
    // has nothing to do with.
    const base = (open: string, clear: string, channel = 'all', extra = '') =>
        [
            '',
            '## Phase 1',
            `- [${open}] **1.1 opener** <!-- opens-hold: probe -->`,
            "      verify: the opener's own check",
            `- [${clear}] **1.2 clearer** <!-- clears-hold: probe -->`,
            '      verify: the check that proves the state is repaired',
            '',
            '## Release holds',
            '',
            '### hold: probe',
            `- **Channel:** ${channel}`,
            '- **Opened by:** 1.1',
            '- **Cleared by:** 1.2',
            '- **State:** the surface is half wired while this is open.',
            '- **Why not a guard:** the entry point is reachable and cannot be made inert.',
            extra,
        ].join('\n');

    type Case = { name: string; text: string; state: string; all: boolean; latest: boolean };
    const cases: Case[] = [
        { name: 'unopened permits', text: base(' ', ' '), state: 'unopened', all: false, latest: false },
        { name: 'open/all refuses every cut', text: base('x', ' '), state: 'open', all: true, latest: true },
        { name: 'cleared permits', text: base('x', 'x'), state: 'cleared', all: false, latest: false },
        {
            name: 'open/latest refuses stable, permits prerelease',
            text: base('x', ' ', 'latest'),
            state: 'open',
            all: true,
            latest: false,
        },
        // The load-bearing row. Each of these is a DIFFERENT way to be
        // unreadable, and every one of them must refuse on BOTH channels.
        {
            name: 'not-evaluable: missing `Why not a guard:`',
            text: base('x', ' ').replace(/- \*\*Why not a guard:\*\*.*\n/, ''),
            state: 'not-evaluable',
            all: true,
            latest: true,
        },
        {
            name: 'not-evaluable: unknown channel',
            text: base('x', ' ', 'someday'),
            state: 'not-evaluable',
            all: true,
            latest: true,
        },
        {
            name: 'not-evaluable: clearer carries no `verify:`',
            text: base('x', ' ').replace(
                '      verify: the check that proves the state is repaired\n',
                '',
            ),
            state: 'not-evaluable',
            all: true,
            latest: true,
        },
        {
            name: 'not-evaluable: marker is not on a checkbox',
            text: base('x', ' ').replace(
                '- [ ] **1.2 clearer** <!-- clears-hold: probe -->',
                'The clearer is step 1.2 <!-- clears-hold: probe -->',
            ),
            state: 'not-evaluable',
            all: true,
            latest: true,
        },
        {
            name: 'not-evaluable: hold entry names a version (rule 13)',
            text: base('x', ' ', 'all', '- **Note:** ships in 15.1.0\n'),
            state: 'not-evaluable',
            all: true,
            latest: true,
        },
        {
            name: 'not-evaluable: duplicate hold id',
            text: `${base('x', ' ')}\n### hold: probe\n- **Channel:** all\n`,
            state: 'not-evaluable',
            all: true,
            latest: true,
        },
        {
            name: 'not-evaluable: marker with no entry',
            text: '## Phase 1\n- [x] **1.1 opener** <!-- opens-hold: orphan -->\n',
            state: 'not-evaluable',
            all: true,
            latest: true,
        },
    ];

    // The two NEGATIVE cases. Without them a check that refused everything
    // would pass every row above, which is the tautology this guards against.
    const negatives: { name: string; text: string }[] = [
        { name: 'a roadmap with no holds section declares nothing', text: '## Phase 1\n- [ ] **1.1 x**\n' },
        {
            name: 'a fenced documentation example is not a declaration',
            text: '```markdown\n## Release holds\n\n### hold: doc-example\n- **Channel:** all\n```\n',
        },
    ];

    // Lifecycle, rule 28's per-folder half. Asserted on the SAME fixture text
    // under three different paths, so the only variable is the folder.
    const openText = base('x', ' ');
    const lifecycle: { name: string; file: string; text: string; want: number }[] = [
        {
            name: 'archive/ refuses a live window',
            file: 'agents/roadmaps/archive/probe.md',
            text: openText,
            want: 1,
        },
        {
            name: 'skipped/ refuses a live window',
            file: 'agents/roadmaps/skipped/probe.md',
            text: openText,
            want: 1,
        },
        {
            name: 'later/ refuses when entry_condition.what does not name the hold',
            file: 'agents/roadmaps/later/probe.md',
            text: `---\nstatus: later\nentry_condition:\n  what: something else entirely\n  when: later\n  who: maintainer\n---\n${openText}`,
            want: 1,
        },
        {
            name: 'later/ permits when entry_condition.what names the hold',
            file: 'agents/roadmaps/later/probe.md',
            text: `---\nstatus: later\nentry_condition:\n  what: the probe hold stays open until 1.2 lands\n  when: later\n  who: maintainer\n---\n${openText}`,
            want: 0,
        },
        {
            name: 'the active root permits a live window',
            file: 'agents/roadmaps/probe.md',
            text: openText,
            want: 0,
        },
        {
            name: 'archive/ permits a CLEARED window',
            file: 'agents/roadmaps/archive/probe.md',
            text: base('x', 'x'),
            want: 0,
        },
    ];

    let failed = 0;
    for (const c of cases) {
        const holds = evaluateHolds(c.text, 'selftest.md');
        const h = holds[0];
        const ok =
            h !== undefined &&
            h.state === c.state &&
            refuses(h, 'all') === c.all &&
            refuses(h, 'latest') === c.latest;
        if (!ok) {
            failed += 1;
            process.stderr.write(
                `   ❌ ${c.name}: got state=${h?.state ?? '<none>'} ` +
                    `all=${h ? refuses(h, 'all') : '-'} latest=${h ? refuses(h, 'latest') : '-'}; ` +
                    `want state=${c.state} all=${c.all} latest=${c.latest}\n`,
            );
        }
    }
    for (const n of negatives) {
        const holds = evaluateHolds(n.text, 'selftest.md');
        if (holds.length !== 0) {
            failed += 1;
            process.stderr.write(`   ❌ ${n.name}: got ${holds.length} hold(s), want 0\n`);
        }
    }

    for (const l of lifecycle) {
        const got = lifecycleViolations(l.file, evaluateHolds(l.text, l.file), l.text).length;
        if (got !== l.want) {
            failed += 1;
            process.stderr.write(`   ❌ ${l.name}: got ${got} violation(s), want ${l.want}\n`);
        }
    }

    const total = cases.length + negatives.length + lifecycle.length;
    if (failed > 0) {
        process.stderr.write(`❌  check-release-holds --selftest: ${failed}/${total} failed\n`);
        return 1;
    }
    process.stdout.write(
        `✅  check-release-holds --selftest: ${total}/${total} — every state-table row ` +
            `(including not-evaluable, 7 ways), both negatives, and all six lifecycle cases\n`,
    );
    return 0;
}

function usage(): number {
    process.stderr.write(
        'usage: check_release_holds (--lint | --status | --require-safe [--channel latest|all]\n' +
            '                            | --can-move <file> <archive|skipped|later> | --selftest)\n' +
            '  --channel all     (default) a stable X.Y.Z cut — every open hold refuses\n' +
            '  --channel latest  a -next.N prerelease — only `Channel: all` holds refuse\n',
    );
    return 2;
}

function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--selftest')) {
        return cmdSelftest();
    }
    if (argv.includes('--lint')) {
        return cmdLint();
    }
    if (argv.includes('--status')) {
        return cmdStatus();
    }
    if (argv.includes('--require-safe')) {
        const i = argv.indexOf('--channel');
        const raw = i === -1 ? 'all' : argv[i + 1];
        if (raw !== 'all' && raw !== 'latest') {
            process.stderr.write(`❌  --channel must be \`all\` or \`latest\`, got \`${raw ?? ''}\`\n`);
            return usage();
        }
        return cmdRequireSafe(raw);
    }
    const mv = argv.indexOf('--can-move');
    if (mv !== -1) {
        const file = argv[mv + 1];
        const dest = argv[mv + 2];
        if (file === undefined || dest === undefined) {
            return usage();
        }
        return cmdCanMove(path.resolve(file), dest);
    }
    return usage();
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { collect, globRoadmaps, main, HOLD_DIRS };
