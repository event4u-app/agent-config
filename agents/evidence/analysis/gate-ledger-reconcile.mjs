#!/usr/bin/env node
// Mechanical reconciliation of the 7.1 classification ledger against the
// Phase 7 start manifest, the invocation inventory, an independent branch
// inventory and an independent mapping review. Prints a report and exits 1 on
// any failed condition. `--self-test` applies mutations to the real inputs and
// requires each one to be refused. Run with node.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const FILES = {
    phase7: 'agents/evidence/council/live-tree-check-classification-20261010.md',
    ledger: 'agents/evidence/analysis/gate-classification-ledger-20261024.md',
    inventory: 'agents/evidence/analysis/gate-invocation-inventory-20261024.md',
    branches: 'agents/evidence/analysis/gate-branch-inventory-20261024.json',
    mapping: 'agents/evidence/analysis/gate-branch-mapping-20261024.json',
    review: 'agents/evidence/analysis/gate-branch-mapping-review-20261024.json',
};
const BRANCH_MATRIX = 'agents/evidence/analysis/gate-branch-reconciliation-20261024.md';
const MODE_FLAGS = ['--self-test', '--mutation-selftest', '--require-complete', '--strict', '--global', '--check-urls', '--freshness-days'];
const CLASSES = ['invariant', 'snapshot', 'tolerance', 'observation'];
// Every `--flag` literal in a check's own source is either declared here as
// changing no assertion, or must be named by a binding ledger row of that
// check. A flag in neither place is an unclassified invocation mode.
const NO_ASSERTION = {
    presentation: ['--quiet', '--json', '--list', '--help'],
    input: ['--root', '--dir', '--today', '--store', '--scope'],
    write: ['--write-baseline', '--publish'],
    notAFlag: ['--is-ancestor', '--record-composite'],
};

function realIo() {
    const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    return {
        read: (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8'),
        exists: (rel) => fs.existsSync(path.join(ROOT, rel)),
        blob: (rel) => git(['hash-object', path.join(ROOT, rel)]),
        existsAt: (commit, rel) => {
            try {
                git(['cat-file', '-e', `${commit}:${rel}`]);
                return true;
            } catch {
                return false;
            }
        },
        sites: () => {
            try {
                execFileSync('node', [path.join(ROOT, 'agents/evidence/analysis/gate-branch-sites.mjs')], { cwd: ROOT, stdio: 'ignore' });
                return true;
            } catch {
                return false;
            }
        },
        showAt: (commit, rel) => {
            try {
                return execFileSync('git', ['show', `${commit}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
            } catch {
                return null;
            }
        },
    };
}

function section(text, heading) {
    const start = text.indexOf(heading);
    if (start < 0) throw new Error(`missing section ${heading}`);
    const next = text.indexOf('\n## ', start + heading.length);
    return text.slice(start, next < 0 ? undefined : next);
}
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const checkName = (cell) => (cell.match(/`([a-z_]+)`/) ?? [])[1] ?? null;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function tableSection(ledger) {
    return section(ledger, '## The ledger — revision 3');
}

export function reconcile(io) {
    const failures = [];
    const report = [];
    const ledger = io.read(FILES.ledger);
    const pinSection = section(ledger, '## Row ids and invalidation');

    // Phase 7 start manifest: the record must be the one that landed, and every
    // check it names must exist at the measured commit and still today.
    const manifest = pinSection.match(/Phase 7 start manifest: measured at `([0-9a-f]{40})`, recorded in `([0-9a-f]{40})`/);
    const phase7Text = io.read(FILES.phase7);
    const phase7 = section(phase7Text, '| # | Check | Class |')
        .split('\n')
        .filter((l) => /^\| \d+ \|/.test(l))
        .map((l) => checkName(cells(l)[1]));
    if (manifest === null) failures.push('no Phase 7 start manifest pin found');
    else {
        const [, measured, recorded] = manifest;
        const landed = io.showAt(recorded, FILES.phase7);
        if (landed === null) failures.push(`Phase 7 record not found at ${recorded.slice(0, 9)}`);
        else if (landed !== phase7Text) failures.push('Phase 7 record differs from the version that landed');
        for (const c of phase7) {
            if (!io.existsAt(measured, `src/scripts/${c}.ts`)) failures.push(`${c} did not exist at the Phase 7 start commit`);
            if (!io.exists(`src/scripts/${c}.ts`)) failures.push(`${c} no longer exists under its Phase 7 path (renamed or removed)`);
        }
    }
    if (phase7.length !== 16 || new Set(phase7).size !== 16) failures.push(`phase-7 manifest has ${new Set(phase7).size} distinct checks, expected 16`);

    const table = tableSection(ledger);
    const ledgerRows = [];
    let current = null;
    for (const line of table.split('\n')) {
        if (!/^\| (\d+|) \|/.test(line) || line.startsWith('| # |')) continue;
        const c = cells(line);
        const named = checkName(c[1]);
        if (named !== null) current = named;
        const classCell = c[7] ?? '';
        ledgerRows.push({
            check: current,
            aspect: c[2],
            cls: CLASSES.find((k) => new RegExp(`\\*\\*${k}`).test(classCell)) ?? null,
            migration: /— target/.test(c[2]),
            withdrawn: /withdrawn/.test(classCell),
            raw: line,
            id: (line.match(/`(R\d+\.[a-z])`\s*\|\s*$/) ?? [])[1] ?? null,
        });
    }
    const ids = ledgerRows.map((r) => r.id);
    for (const r of ledgerRows) if (r.id === null) failures.push(`row without an id: ${r.check} / ${r.aspect}`);
    for (const d of new Set(ids.filter((x, i) => x !== null && ids.indexOf(x) !== i))) failures.push(`duplicate row id ${d}`);

    // The ledger table itself is pinned, so a row edited after review is stale.
    const rowsDigest = sha256(ledgerRows.map((r) => r.raw).join('\n'));
    const tablePin = pinSection.match(/ledger table: sha256 `([0-9a-f]{64})`/);
    if (tablePin === null) failures.push('no ledger-table pin found');
    else if (tablePin[1] !== rowsDigest) failures.push(`STALE: a ledger row changed since the table was pinned (${tablePin[1].slice(0, 9)} → ${rowsDigest.slice(0, 9)})`);

    const pins = pinSection
        .split('\n')
        .map((l) => l.match(/^\| `([^`]+)` \| `([0-9a-f]{40})` \|$/))
        .filter((m) => m !== null);
    if (pins.length === 0) failures.push('no source pins found');
    for (const [, file, blob] of pins) {
        const now = io.blob(file);
        if (now !== blob) failures.push(`STALE: ${file} changed since the verdict was pinned (${blob.slice(0, 9)} → ${now.slice(0, 9)})`);
    }
    const helperFiles = importClosure(io, phase7.map((c) => `src/scripts/${c}.ts`));
    const closureDigest = sha256(helperFiles.map((f) => `${f} ${io.blob(f)}`).join('\n'));
    const closurePin = pinSection.match(/helper closure: (\d+) files, sha256 `([0-9a-f]{64})`/);
    if (closurePin === null) failures.push('no helper-closure pin found');
    else if (Number(closurePin[1]) !== helperFiles.length || closurePin[2] !== closureDigest) {
        failures.push(`STALE: the transitive helper closure changed (${closurePin[1]} files ${closurePin[2].slice(0, 9)} → ${helperFiles.length} files ${closureDigest.slice(0, 9)})`);
    }

    const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    const inventoryChecks = section(io.read(FILES.inventory), '## The inventory')
        .split('\n')
        .filter((l) => /^\| \d+ \|/.test(l))
        .map((l) => checkName(cells(l)[1]));
    if (!same(new Set(phase7), new Set(ledgerRows.map((r) => r.check)))) failures.push('ledger checks differ from the Phase 7 manifest');
    if (!same(new Set(phase7), new Set(inventoryChecks))) failures.push('invocation inventory checks differ from the Phase 7 manifest');

    const binding = ledgerRows.filter((r) => !r.migration && !r.withdrawn);
    for (const r of binding) if (r.cls === null) failures.push(`unclassified binding aspect: ${r.check} / ${r.aspect}`);
    for (const r of ledgerRows.filter((x) => x.migration)) {
        const hasCurrent = binding.some((b) => b.check === r.check && b.aspect.replace('— current', '').trim() === r.aspect.replace('— target', '').trim());
        if (!hasCurrent) failures.push(`target row without a current-scope row: ${r.check} / ${r.aspect}`);
    }

    const declared = new Set(Object.values(NO_ASSERTION).flat());
    for (const check of phase7) {
        const src = io.read(`src/scripts/${check}.ts`);
        const flags = [...new Set([...src.matchAll(/['"`](--[a-z][a-z-]*)/g)].map((m) => m[1]))];
        const rowsText = binding.filter((r) => r.check === check).map((r) => r.raw).join('\n');
        for (const f of flags.filter((x) => !declared.has(x) && !rowsText.includes(x))) failures.push(`unclassified invocation mode: ${check} ${f}`);
    }

    // The branch population comes from an inventory produced without sight of
    // the ledger. Every branch must land on a binding row of its check or on a
    // declared non-assertion category, and every binding row must be reached.
    const branchInv = JSON.parse(io.read(FILES.branches));
    const { categories, mapping, resolutions = {} } = JSON.parse(io.read(FILES.mapping));
    const reached = new Set();
    const perCategory = {};
    let branchCount = 0;
    for (const c of branchInv.checks) {
        if (!phase7.includes(c.check)) failures.push(`branch inventory names an unknown check ${c.check}`);
        for (const b of c.branches) {
            branchCount += 1;
            const target = mapping[c.check]?.[b.id];
            if (target === undefined) {
                failures.push(`unmapped branch ${c.check} ${b.id}`);
                continue;
            }
            if (target.startsWith('op:')) {
                if (!(target in categories)) failures.push(`unknown category ${target} for ${c.check} ${b.id}`);
                perCategory[target] = (perCategory[target] ?? 0) + 1;
                continue;
            }
            for (const id of target.split('+')) {
                const row = binding.find((r) => r.id === id);
                if (row === undefined) failures.push(`branch ${c.check} ${b.id} maps to ${id}, which is not a binding row`);
                else if (row.check !== c.check) failures.push(`branch ${c.check} ${b.id} maps to ${id} of another check`);
                else reached.add(id);
            }
        }
    }
    for (const r of binding) if (!reached.has(r.id)) failures.push(`binding row ${r.id} is reached by no branch in the independent inventory`);
    for (const [check, m] of Object.entries(mapping)) {
        const known = new Set((branchInv.checks.find((c) => c.check === check)?.branches ?? []).map((b) => b.id));
        for (const bid of Object.keys(m)) if (!known.has(bid)) failures.push(`mapping names ${check} ${bid}, absent from the inventory`);
    }

    // The independent review binds in all three directions: an agreed mapping
    // may not change, a disagreement must be adopted, and an unsure verdict
    // needs a recorded resolution. Moving a reviewed row branch into a
    // non-assertion category is therefore refused.
    const review = JSON.parse(io.read(FILES.review)).reviews;
    const verdicts = {};
    for (const v of review) verdicts[v.verdict] = (verdicts[v.verdict] ?? 0) + 1;
    if (review.length !== branchCount) failures.push(`mapping review covers ${review.length} branches, inventory has ${branchCount}`);
    for (const v of review) {
        const now = mapping[v.check]?.[v.branch];
        if (v.verdict === 'agree' && now !== v.mapped_to) failures.push(`reviewed mapping changed without review: ${v.check} ${v.branch} was ${v.mapped_to}, is ${now}`);
        if (v.verdict === 'disagree' && now !== v.suggested) failures.push(`review disagreement not adopted: ${v.check} ${v.branch} is ${now}, review says ${v.suggested}`);
        if (v.verdict === 'unsure') {
            const res = resolutions[`${v.check} ${v.branch}`];
            if (res === undefined || res.decision !== now || typeof res.reason !== 'string' || res.reason.length < 40) {
                failures.push(`unresolved review verdict: ${v.check} ${v.branch}`);
            }
        }
    }

    const matrix = [];
    for (const check of phase7) {
        const rows = ledgerRows.filter((r) => r.check === check);
        const b = rows.filter((r) => !r.migration && !r.withdrawn);
        const branchesOf = branchInv.checks.find((c) => c.check === check)?.branches ?? [];
        const toRows = branchesOf.filter((x) => !(mapping[check]?.[x.id] ?? '').startsWith('op:')).length;
        const ops = {};
        for (const x of branchesOf) {
            const t = mapping[check]?.[x.id] ?? '';
            if (t.startsWith('op:')) ops[t.slice(3)] = (ops[t.slice(3)] ?? 0) + 1;
        }
        const rv = review.filter((v) => v.check === check);
        const count = (k) => rv.filter((v) => v.verdict === k).length;
        matrix.push(
            `| ${phase7.indexOf(check) + 1} | \`${check}\` | ${b.map((r) => `${r.id} ${r.cls}`).join(', ')} | ${rows.filter((r) => r.migration || r.withdrawn).map((r) => r.id).join(', ') || '—'} | ${branchesOf.length} | ${toRows} | ${Object.entries(ops).map(([k, n]) => `${k} ${n}`).join(', ') || '—'} | ${count('agree')} / ${count('disagree')} adopted / ${count('unsure')} resolved |`,
        );
    }
    // One line per independently inventoried branch: where it is, the mode the
    // destination row is classified under, the destination, its class or
    // category, and the independent review verdict that governs it.
    const branchLines = [];
    for (const c of branchInv.checks) {
        for (const x of c.branches) {
            const target = mapping[c.check]?.[x.id] ?? '';
            const v = review.find((r) => r.check === c.check && r.branch === x.id);
            const verdict = v === undefined ? 'none' : v.verdict === 'unsure' ? 'unsure, resolved' : v.verdict === 'disagree' ? 'disagree, adopted' : 'agree';
            if (target.startsWith('op:')) {
                branchLines.push(`| \`${c.check}\` | \`${x.id}\` | ${String(x.where).split(' ')[0]} | — | ${target} | ${verdict} |`);
                continue;
            }
            for (const id of target.split('+')) {
                const r = binding.find((row) => row.id === id);
                const mode = [r].map((r) => {
                    const c2 = cells(r?.raw ?? '');
                    const aspect = c2[2] ?? '';
                    const applic = c2[5] ?? '';
                    const named =
                        MODE_FLAGS.find((f) => aspect.includes(f)) ??
                        (/default mode/.test(aspect) ? 'default' : undefined) ??
                        MODE_FLAGS.find((f) => applic.includes(`only with \`${f}\``) || applic.includes(`invocation with \`${f}\``)) ??
                        'default';
                    return /consumer mode/.test(applic) ? `consumer mode, ${named}` : named;
                })[0];
                branchLines.push(`| \`${c.check}\` | \`${x.id}\` | ${String(x.where).split(' ')[0]} | ${mode} | ${r?.id} ${r?.cls} | ${verdict} |`);
            }
        }
    }
    const tally = Object.fromEntries(CLASSES.map((k) => [k, binding.filter((r) => r.cls === k).length]));
    report.push(`Phase 7 manifest: ${phase7.length} checks, record and paths verified against git`);
    report.push(`independent mapping review: ${JSON.stringify(verdicts)}`);
    report.push(`branches ${branchCount} · mapped to rows ${branchCount - Object.values(perCategory).reduce((a, b) => a + b, 0)} · ${JSON.stringify(perCategory)} · binding rows reached ${reached.size}/${binding.length}`);
    report.push(`rows ${ledgerRows.length} · binding ${binding.length} · non-binding ${ledgerRows.length - binding.length} (migration notes and withdrawn rows) · ${JSON.stringify(tally)}`);
    report.push(`pins: ${pins.length} files, ${helperFiles.length}-file helper closure, ledger table`);
    const artefact = renderBranchMatrix(branchLines, resolutions, { branchCount, toRows: branchCount - Object.values(perCategory).reduce((a, b) => a + b, 0), perCategory, tally, binding: binding.length });
    if (io.sites !== undefined && !io.sites()) failures.push('the mechanical site scanner (gate-branch-sites.mjs) does not pass');
    const committed = io.exists(BRANCH_MATRIX) ? io.read(BRANCH_MATRIX) : null;
    if (committed === null) failures.push(`branch reconciliation artefact missing: ${BRANCH_MATRIX}`);
    else if (committed !== artefact) failures.push('STALE: the committed branch reconciliation differs from a fresh regeneration');
    return { failures, report, matrix, artefact };
}

function renderBranchMatrix(lines, resolutions, t) {
    const unsure = Object.entries(resolutions).map(([k, v]) => `- \`${k}\` → \`${v.decision}\`: ${v.reason}`);
    return [
        '<!-- evidence-type: analysis -->',
        '',
        '# Branch-level reconciliation of the 7.1 classification ledger',
        '',
        'Generated by `node agents/evidence/analysis/gate-ledger-reconcile.mjs --branches`; never edited by hand. The reconciler refuses',
        'a committed copy that differs byte-for-byte from a fresh regeneration. One row per branch of the independent inventory: the mode',
        'is the invocation mode the destination aspect is classified under (`—` for a branch that asserts nothing), the destination is a',
        'binding aspect with its class or a declared non-assertion category, and the verdict is the independent mapping review\'s.',
        '',
        'A branch whose code serves two aspects in two modes is written as two rows, one per (mode, aspect), so every row is one assertion under one mode.',
        '',
        '**Reproduce from a clean checkout** (node and git only, no install), from inside any clone: `C=$(git log -1 --format=%H -- agents/evidence/analysis/gate-branch-reconciliation-20261024.md) && D=$(mktemp -d) && git worktree add --detach "$D" "$C" && cd "$D" && node agents/evidence/analysis/gate-ledger-reconcile.mjs && node agents/evidence/analysis/gate-branch-sites.mjs && node agents/evidence/analysis/gate-ledger-reconcile.mjs --branches | cmp - agents/evidence/analysis/gate-branch-reconciliation-20261024.md`. `C` is the commit that last wrote this file; the two independent reruns used `a91350838a72e555d569036fc4152e0b541344a1` and `907b83bd6678e4a6a03ae81591dc4f0e84da5cef`.',
        '',
        '**Invalidation.** The reconciler reports the verdict stale, and 7.1 reopens for the affected rows, when any pinned check, helper closure, invocation wiring, inventory, mapping, review, site disposition, reconciler, this artefact or the ledger table changes, or when a later finding shows an omitted or mis-destined branch (`agents/evidence/analysis/gate-7-2-reliance-rules-20261024.md`).',
        '',
        `Totals: ${t.branchCount} branches (${lines.length} rows) · ${t.toRows} branches to binding aspects · ${t.branchCount - t.toRows} to non-assertion categories ${JSON.stringify(t.perCategory)} · ${t.binding} binding aspects ${JSON.stringify(t.tally)}.`,
        '',
        '**Unsure review verdicts and their recorded decisions:**',
        '',
        ...unsure,
        '',
        '| Check | Branch | Where | Mode | Destination | Review |',
        '|---|---|---|---|---|---|',
        ...lines,
        '',
    ].join('\n');
}

function importClosure(io, entries) {
    const seen = new Set();
    const queue = [...entries];
    while (queue.length > 0) {
        const f = queue.pop();
        if (seen.has(f)) continue;
        seen.add(f);
        for (const m of io.read(f).matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
            let t = path.normalize(path.join(path.dirname(f), m[1])).replace(/\.js$/, '.ts');
            if (!io.exists(t) && io.exists(t.replace(/\.ts$/, '.mts'))) t = t.replace(/\.ts$/, '.mts');
            if (io.exists(t)) queue.push(t);
        }
    }
    return [...seen].filter((f) => !entries.includes(f)).sort();
}

function mutated(io, file, edit) {
    return { ...io, read: (rel) => (rel === file ? edit(io.read(rel)) : io.read(rel)) };
}

function selfTest() {
    const io = realIo();
    const json = (file, edit) => mutated(io, file, (t) => JSON.stringify(edit(JSON.parse(t))));
    const cases = [
        ['baseline is clean', io, null],
        ['a Phase 7 check is dropped from the ledger', mutated(io, FILES.ledger, (t) => t.split('\n').filter((l) => !/`check_council_layout`/.test(l) && !/`R9\.[ab]`/.test(l)).join('\n')), /ledger checks differ|ledger row changed/],
        ['the Phase 7 record is altered', mutated(io, FILES.phase7, (t) => `${t}\n`), /differs from the version that landed/],
        ['an unsure review verdict loses its resolution', json(FILES.mapping, (j) => ({ ...j, resolutions: {} })), /unresolved review verdict/],
        ['a reviewed row branch is laundered into a category', json(FILES.mapping, (j) => { j.mapping.check_knowledge_cards['c10-E1-required'] = 'op:informational'; return j; }), /reviewed mapping changed without review/],
        ['a review disagreement is reverted', json(FILES.mapping, (j) => { j.mapping.check_composite_arming['c16-store-unreadable'] = 'R16.c'; return j; }), /disagreement not adopted/],
        ['a pinned source changes', { ...io, blob: (rel) => (rel === 'src/scripts/lint_readme_jargon.ts' ? '0'.repeat(40) : io.blob(rel)) }, /STALE: src\/scripts\/lint_readme_jargon\.ts/],
        ['a helper on the closure changes', { ...io, blob: (rel) => (rel === 'src/scripts/_lib/as_of.ts' ? '0'.repeat(40) : io.blob(rel)) }, /helper closure changed/],
        ['a row\'s applicability is edited after review', mutated(io, FILES.ledger, (t) => t.replace('| when git is runnable;', '| always;')), /ledger row changed/],
        ['a branch is mapped to the withdrawn row', json(FILES.mapping, (j) => { j.mapping.check_gate_completeness['c1-dead-scope'] = 'R1.c'; return j; }), /not a binding row|disagreement not adopted/],
        ['a line of the committed branch reconciliation is edited', mutated(io, BRANCH_MATRIX, (t) => t.replace('| op:usage |', '| R1.a invariant |')), /committed branch reconciliation differs/],
        ['the mechanical site scanner finds an undisposed site', { ...io, sites: () => false }, /site scanner/],
        ['an unknown flag appears in a check', mutated(io, 'src/scripts/lint_readme_jargon.ts', (t) => `${t}\nconst x = '--surprise';\n`), /unclassified invocation mode: lint_readme_jargon --surprise/],
    ];
    let bad = 0;
    for (const [name, caseIo, expect] of cases) {
        const { failures } = reconcile(caseIo);
        const ok = expect === null ? failures.length === 0 : failures.some((f) => expect.test(f));
        if (!ok) bad += 1;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got: ${failures.slice(0, 3).join(' | ') || 'no failure'}`}`);
    }
    console.log(`\nself-test: ${cases.length - bad}/${cases.length} case(s) behaved`);
    process.exit(bad === 0 ? 0 : 1);
}

function printMatrix() {
    const io = realIo();
    const { failures, matrix } = reconcile(io);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    console.log(`revision: HEAD ${head}`);
    for (const f of Object.values(FILES)) console.log(`input: ${f} blob ${io.blob(f)}`);
    console.log('\n| # | Phase 7 check | Binding aspects and class | Not binding | Branches | → rows | → non-assertion categories | Review: agree / disagree adopted / unsure resolved |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const l of matrix) console.log(l);
    console.log(`\nreconciliation: ${failures.length === 0 ? 'OK' : `FAILED (${failures.length})`}`);
    process.exit(failures.length === 0 ? 0 : 1);
}

if (process.argv.includes('--self-test')) selfTest();
else if (process.argv.includes('--matrix')) printMatrix();
else if (process.argv.includes('--branches')) {
    process.stdout.write(reconcile(realIo()).artefact);
}
else {
    const { failures, report } = reconcile(realIo());
    for (const l of report) console.log(l);
    if (failures.length > 0) {
        console.log(`\nFAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
        process.exit(1);
    }
    console.log('\nOK: the Phase 7 manifest matches its landed record and git history; the ledger, the invocation inventory and the manifest name the same 16 checks; every binding aspect carries one of the four classes; every assertion-changing flag is named; every branch of the independent inventory maps to a binding row or a declared category and every binding row is reached; every independent review verdict is honoured; every pin is current.');
}
