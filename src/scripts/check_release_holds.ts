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
    refuses,
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
    const holds = collect();
    const bad = holds.filter((h) => h.state === 'not-evaluable');
    process.stdout.write(`scanned: ${globRoadmaps().length}\n`);
    if (bad.length === 0) {
        process.stdout.write(
            `✅  check-release-holds: ${holds.length} declared hold(s), all well-formed\n`,
        );
        return 0;
    }
    process.stderr.write('❌  check-release-holds: malformed declaration(s):\n');
    for (const h of bad) {
        for (const why of h.malformed) {
            process.stderr.write(`   - ${rel(h.file)} · hold \`${h.id}\`: ${why}\n`);
        }
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
    const holds = collect();
    const blocking = holds.filter((h) => refuses(h, cut));
    if (blocking.length === 0) {
        process.stdout.write(`✅  release-holds: safe to cut (channel ${cut})\n`);
        return 0;
    }
    process.stderr.write(`❌  release-holds: REFUSED — ${blocking.length} hold(s) block this cut\n`);
    for (const h of blocking) {
        process.stderr.write(`\n   hold: ${h.id}   [${h.state}, channel ${h.channel}]\n`);
        process.stderr.write(`   roadmap:  ${rel(h.file)}\n`);
        if (h.state === 'not-evaluable') {
            for (const why of h.malformed) {
                process.stderr.write(`   not evaluable: ${why}\n`);
            }
            continue;
        }
        process.stderr.write(`   opened by: ${h.openedBy}\n`);
        process.stderr.write(`   cleared by: ${h.clearedBy}\n`);
    }
    process.stderr.write(
        '\n   Three ways forward, and the choice is yours — there is no override flag:\n' +
            '     1. finish the clearing step (run its `verify:` command, then flip it)\n' +
            '     2. cut `-next.N` instead, if every blocking hold is `Channel: latest`\n' +
            '     3. use a release line — docs/contracts/release-trunk-sync.md\n',
    );
    return 1;
}

/** Rule 28's state table, one fixture per row, plus the two channel cases. */
function cmdSelftest(): number {
    const base = (open: string, clear: string, channel = 'all', extra = '') => `
## Phase 1
- [${open}] **1.1 opener** <!-- opens-hold: probe -->
      verify: the opener's own check
- [${clear}] **1.2 clearer** <!-- clears-hold: probe -->
      verify: the check that proves the state is repaired

## Release holds

### hold: probe
- **Channel:** ${channel}
- **Opened by:** 1.1
- **Cleared by:** 1.2
- **State:** the surface is half wired while this is open.
- **Why not a guard:** the entry point is reachable and cannot be made inert.
${extra}`;

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

    const total = cases.length + negatives.length;
    if (failed > 0) {
        process.stderr.write(`❌  check-release-holds --selftest: ${failed}/${total} failed\n`);
        return 1;
    }
    process.stdout.write(
        `✅  check-release-holds --selftest: ${total}/${total} — every state-table row ` +
            `(including not-evaluable, 7 ways) plus both negatives\n`,
    );
    return 0;
}

function usage(): number {
    process.stderr.write(
        'usage: check_release_holds (--lint | --status | --require-safe [--channel latest|all] | --selftest)\n' +
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
