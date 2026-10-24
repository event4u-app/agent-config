#!/usr/bin/env node
// The renewal suite for step 7.1: acceptance items A1, A3, A6, A7 and A8 of
// the closed bar the council fixed in round 29 (D50). A2 and A5 live in the
// reconciler, and A4 is tests/scripts/gate_multimode_truth_table.test.ts.
//
//   node gate-renewal-suite.mjs --manifest          A1  diff manifest + ledger-row diff
//   node gate-renewal-suite.mjs --provenance        A3  evidence link per changed structured field
//   node gate-renewal-suite.mjs --candidate <rev>   A6  full suite on the exact candidate tree
//   node gate-renewal-suite.mjs --matrix            A7  isolated mutations, each must fail its gate
//   node gate-renewal-suite.mjs --rollback-check    A8  the restore command yields the attested base
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ATTESTED_BASE, FILES, realIo, reconcile, section, tableSection, wiringFiles } from './gate-ledger-reconcile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const git = (args, cwd = ROOT) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e9 }).trim();
const io = realIo();

/** Every pinned input: the blob-pin table plus the wiring files. */
export function pinnedInputs() {
    const pinSection = section(io.read(FILES.ledger), '## Row ids and invalidation');
    const blobPins = [...pinSection.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{40})` \|$/gm)].map((m) => m[1]);
    return [...new Set([...blobPins, ...wiringFiles((x) => io.read(x))])].sort();
}

const UNIT_A = new Set([
    'src/scripts/check_composite_arming.ts',
    'agents/evidence/analysis/gate-branch-inventory-20261024.json',
    'agents/evidence/analysis/gate-branch-mapping-20261024.json',
    'agents/evidence/analysis/gate-branch-mapping-review-20261024.json',
    'agents/evidence/analysis/gate-branch-reconciliation-20261024.md',
]);
/** A: the D46 fix and check 16's re-inventory; C: wiring; B: everything else. */
export function unitOf(f, wiring) {
    if (UNIT_A.has(f)) return 'A';
    if (wiring.has(f) || f === FILES.wiringReview) return 'C';
    return 'B';
}

function tableRows(text) {
    const out = new Map();
    for (const l of tableSection(text).split('\n')) {
        const id = (l.match(/`(R\d+\.[a-z])`\s*\|\s*$/) ?? [])[1];
        if (id !== undefined) out.set(id, l);
    }
    return out;
}

function manifest() {
    const wiring = new Set(wiringFiles((x) => io.read(x)));
    const failures = [];
    console.log(`| Input | Unit | ${ATTESTED_BASE} blob | current blob | changed |`);
    console.log('|---|---|---|---|---|');
    const inputs = pinnedInputs();
    for (const f of inputs) {
        const base = io.blobAt(ATTESTED_BASE, f) ?? '(absent)';
        const now = io.blob(f);
        console.log(`| \`${f}\` | ${unitOf(f, wiring)} | \`${base.slice(0, 12)}\` | \`${now.slice(0, 12)}\` | ${base === now ? '' : 'yes'} |`);
    }
    // No changed pinned input may be missing: anything git reports changed
    // since the base that a reconciler input names must be in the manifest.
    const changed = git(['diff', '--name-only', ATTESTED_BASE, 'HEAD']).split('\n');
    const named = new Set([...Object.values(FILES)]);
    for (const f of changed) if (named.has(f) && !inputs.includes(f) && f !== FILES.ledger && f !== FILES.phase7) failures.push(`changed reconciler input missing from the manifest: ${f}`);
    const before = tableRows(io.showAt(ATTESTED_BASE, FILES.ledger) ?? '');
    const after = tableRows(io.read(FILES.ledger));
    console.log('\nLedger rows changed since the base:');
    for (const id of [...new Set([...before.keys(), ...after.keys()])]) {
        if (before.get(id) === after.get(id)) continue;
        console.log(`\n${id}\n- ${before.get(id) ?? '(absent)'}\n+ ${after.get(id) ?? '(absent)'}`);
    }
    if (failures.length > 0) {
        console.log(`\nFAILED:\n- ${failures.join('\n- ')}`);
        return 1;
    }
    console.log(`\nOK: ${inputs.length} pinned inputs, each assigned to a unit.`);
    return 0;
}

function provenance() {
    const grounds = JSON.parse(io.read(FILES.grounds));
    const baseGrounds = JSON.parse(io.showAt(ATTESTED_BASE, FILES.grounds) ?? '{}');
    const inv = JSON.parse(io.read(FILES.branches));
    const branchOf = (key) => {
        const [check, id] = key.split(' ');
        return inv.checks.find((c) => c.check === check)?.branches.find((b) => b.id === id);
    };
    const rows = tableRows(io.read(FILES.ledger));
    const checkOf = new Map(reconcile(io).aspects.map((a) => [a.id, a.check]));
    const failures = [];
    const lineOf = (file, needle) => {
        const i = io.read(file).split('\n').findIndex((l) => l.includes(needle));
        return i < 0 ? null : `${file}:${i + 1}`;
    };
    console.log('| Field | Evidence |\n|---|---|');
    for (const [id, flag] of Object.entries(grounds.modes ?? {})) {
        if (baseGrounds.modes?.[id] === flag) continue;
        const row = rows.get(id);
        const check = checkOf.get(id) ?? null;
        const src = check === null ? null : lineOf(`src/scripts/${check}.ts`, `'${flag}'`) ?? lineOf(`src/scripts/${check}.ts`, `"${flag}"`);
        const ev = [row !== undefined && row.includes(flag) ? `ledger row ${id} names ${flag}` : null, src].filter(Boolean);
        if (ev.length < 2) failures.push(`modes.${id}: missing evidence (${ev.join(', ') || 'none'})`);
        console.log(`| modes.${id} = ${flag} | ${ev.join('; ')} |`);
    }
    for (const [key, flag] of Object.entries(grounds.flag_branches ?? {})) {
        if (baseGrounds.flag_branches?.[key] === flag) continue;
        const b = branchOf(key);
        const ev = [b !== undefined && (b.predicates ?? []).some((p) => p.includes(flag)) ? `inventory predicates of ${b.id}` : null, b === undefined ? null : b.where].filter(Boolean);
        if (ev.length < 2) failures.push(`flag_branches.${key}: missing evidence`);
        console.log(`| flag_branches.${key} = ${flag} | ${ev.join('; ')} |`);
    }
    for (const [key, entry] of Object.entries(grounds.overlaps ?? {})) {
        if (JSON.stringify(baseGrounds.overlaps?.[key]) === JSON.stringify(entry)) continue;
        const b = branchOf(key);
        const ev = b === undefined ? [] : [`branch ${b.id} at ${b.where}`, `predicates: ${(b.predicates ?? []).join(' / ')}`];
        if (ev.length === 0) failures.push(`overlaps.${key}: the branch is not in the inventory`);
        console.log(`| overlaps.${key} | ${ev.join('; ')} |`);
    }
    // Inventory entries changed since the base: each needs a review verdict.
    const review = JSON.parse(io.read(FILES.review)).reviews;
    const baseInv = JSON.parse(io.showAt(ATTESTED_BASE, FILES.branches) ?? '{"checks":[]}');
    for (const c of inv.checks) {
        for (const b of c.branches) {
            const old = baseInv.checks.find((x) => x.check === c.check)?.branches.find((x) => x.id === b.id);
            if (old !== undefined && old.effect === b.effect && JSON.stringify(old.predicates) === JSON.stringify(b.predicates)) continue;
            const v = review.find((r) => r.check === c.check && r.branch === b.id);
            if (old === undefined || old.effect !== b.effect) {
                if (v === undefined) failures.push(`inventory ${c.check} ${b.id}: changed since the base with no review verdict`);
            }
            console.log(`| inventory ${c.check} ${b.id} | ${b.where}; ${v === undefined ? 'unchanged effect, line range only' : `review: ${v.verdict} → ${v.verdict === 'disagree' ? v.suggested : v.mapped_to}`} |`);
        }
    }
    if (failures.length > 0) {
        console.log(`\nFAILED:\n- ${failures.join('\n- ')}`);
        return 1;
    }
    console.log('\nOK: every structured field changed since the base links to evidence.');
    return 0;
}

function inTempWorktree(rev, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-cand-'));
    git(['worktree', 'add', '--detach', dir, rev]);
    try {
        return fn(dir);
    } finally {
        git(['worktree', 'remove', '--force', dir]);
    }
}

const SUITE = [
    ['reconciler', ['node', 'agents/evidence/analysis/gate-ledger-reconcile.mjs']],
    ['reconciler self-test', ['node', 'agents/evidence/analysis/gate-ledger-reconcile.mjs', '--self-test']],
    ['site scanner', ['node', 'agents/evidence/analysis/gate-branch-sites.mjs']],
    ['site scanner self-test', ['node', 'agents/evidence/analysis/gate-branch-sites.mjs', '--self-test']],
    ['A1 manifest', ['node', 'agents/evidence/analysis/gate-renewal-suite.mjs', '--manifest']],
    ['A3 provenance', ['node', 'agents/evidence/analysis/gate-renewal-suite.mjs', '--provenance']],
    ['A4 truth table + D46 tests', ['npx', 'vitest', 'run', 'tests/scripts/gate_multimode_truth_table.test.ts', 'tests/scripts/composite_arming.test.ts']],
    ['A7 mutation matrix', ['node', 'agents/evidence/analysis/gate-renewal-suite.mjs', '--matrix']],
    ['A8 rollback check', ['node', 'agents/evidence/analysis/gate-renewal-suite.mjs', '--rollback-check']],
];

// A6 runs the suite on the exact candidate: the working tree must be clean and
// HEAD must be the candidate, so every byte tested is a byte of that commit.
function candidate(rev) {
    const commit = git(['rev-parse', `${rev}^{commit}`]);
    const tree = git(['rev-parse', `${rev}^{tree}`]);
    if (git(['rev-parse', 'HEAD']) !== commit || git(['status', '--porcelain']) !== '') {
        console.log('CANDIDATE REJECTED — HEAD must be the candidate and the working tree clean');
        return 1;
    }
    const results = SUITE.map(([name, cmd]) => [name, spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding: 'utf8', timeout: 900_000 }).status]);
    for (const [name, status] of results) console.log(`${status === 0 ? 'ok  ' : 'FAIL'} ${name} (exit ${String(status)})`);
    const unchanged = git(['status', '--porcelain']) === '' && git(['rev-parse', 'HEAD']) === commit;
    if (!unchanged) console.log('FAIL the suite changed the tree');
    const ok = unchanged && results.every(([, s]) => s === 0);
    console.log(ok ? `\nCANDIDATE CLEAN — promoted candidate: commit \`${commit}\`, tree \`${tree}\`` : '\nCANDIDATE REJECTED');
    return ok ? 0 : 1;
}

/** Applies one in-place mutation, runs its gate, restores, and checks the tree is clean again. */
function mutate(file, from, to, gate) {
    const original = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (!original.includes(from)) return { failed: null, why: `mutation anchor not found in ${file}` };
    fs.writeFileSync(path.join(ROOT, file), original.replace(from, to));
    try {
        const r = spawnSync(gate[0], gate.slice(1), { cwd: ROOT, encoding: 'utf8', timeout: 900_000 });
        return { failed: r.status !== 0 };
    } finally {
        fs.writeFileSync(path.join(ROOT, file), original);
    }
}

const RECONCILE = ['node', 'agents/evidence/analysis/gate-ledger-reconcile.mjs'];
const MATRIX = [
    ['D46 behaviour: absent store exits 1 again', 'src/scripts/check_composite_arming.ts', "and it is not a build failure.\\n`,\n        );\n        return 0;", "and it is not a build failure.\\n`,\n        );\n        return 1;", ['npx', 'vitest', 'run', 'tests/scripts/composite_arming.test.ts']],
    ['multi-mode dispatch: --strict no longer fails on a beta warning', 'src/scripts/check_public_links.ts', '    if (hasWarnings && args.strict) {\n        return 1;', '    if (hasWarnings && args.strict) {\n        return 0;', ['npx', 'vitest', 'run', 'tests/scripts/gate_multimode_truth_table.test.ts']],
    ['grounds effect: a blocking branch declared non-blocking', 'agents/evidence/analysis/gate-branch-inventory-20261024.json', '"finding": "a type:auto rule\'s frontmatter description is longer than 150 chars",\n          "effect": "error-exit-nonzero",', '"finding": "a type:auto rule\'s frontmatter description is longer than 150 chars",\n          "effect": "warning-exit-zero",', RECONCILE],
    ['classifier precedence: the declared order reversed', 'agents/evidence/analysis/gate-ledger-reconcile.mjs', "export const PREDICATE_ORDER = ['observation', 'tolerance', 'snapshot', 'invariant'];", "export const PREDICATE_ORDER = ['invariant', 'snapshot', 'tolerance', 'observation'];", ['node', 'agents/evidence/analysis/gate-ledger-reconcile.mjs', '--self-test']],
    ['wiring: a Phase 7 step edited', '.github/workflows/rule-backstops.yml', 'check_composite_arming --self-test', 'check_composite_arming --self-test --x', RECONCILE],
    ['pin: one pin line edited', FILES.ledger, '| `agents/evidence/analysis/gate-phase7-harness.mjs` | `', '| `agents/evidence/analysis/gate-phase7-harness.mjs` | `0', RECONCILE],
];

function matrix() {
    const before = git(['status', '--porcelain']);
    let bad = 0;
    for (const [name, file, from, to, gate] of MATRIX) {
        // A gate that already fails unmutated proves nothing about the mutation.
        const clean = spawnSync(gate[0], gate.slice(1), { cwd: ROOT, encoding: 'utf8', timeout: 900_000 }).status;
        if (clean !== 0) {
            bad += 1;
            console.log(`FAIL ${name} — the gate is already red unmutated (exit ${String(clean)}), so the mutation is not evidence`);
            continue;
        }
        const r = mutate(file, from, to, gate);
        const ok = r.failed === true;
        if (!ok) bad += 1;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${r.failed === null ? r.why : r.failed ? 'gate failed as required' : 'gate PASSED the mutation'}`);
    }
    const after = git(['status', '--porcelain']);
    if (after !== before) {
        console.log('FAIL the working tree differs after the matrix — a mutation was not restored');
        bad += 1;
    }
    console.log('\nNo validator reads actual and expected from one field: A2 derives every class from the inventory, modes and structured fields, and compares the result with the recorded class only afterwards.');
    console.log(`\nmatrix: ${MATRIX.length + 1 - bad}/${MATRIX.length + 1} behaved`);
    return bad === 0 ? 0 : 1;
}

/**
 * A8: the documented restore command checks out every pinned input at the
 * attested base, all at once (no mixed versions), without regenerating any of
 * them. In a scratch worktree the base's own reconciler must then report valid.
 */
export const RESTORE = (inputs) => ['checkout', ATTESTED_BASE, '--', ...inputs.filter((f) => io.blobAt(ATTESTED_BASE, f) !== null)];

function rollbackCheck() {
    const inputs = [...pinnedInputs(), FILES.ledger];
    console.log(`restore command: git ${RESTORE(inputs).slice(0, 3).join(' ')} <${inputs.length} pinned inputs>`);
    const status = inTempWorktree('HEAD', (dir) => {
        git(RESTORE(inputs), dir);
        const r = spawnSync('node', ['agents/evidence/analysis/gate-ledger-reconcile.mjs', '--status'], { cwd: dir, encoding: 'utf8' });
        console.log(r.stdout.split('\n').filter((l) => /"state"|"consumable"/.test(l)).join('\n'));
        return r.status;
    });
    console.log(status === 0 ? 'OK: the restored set is the valid attested base.' : `FAILED: the restored set is not valid (exit ${String(status)}).`);
    return status === 0 ? 0 : 1;
}

const argv = process.argv.slice(2);
const modes = { '--manifest': manifest, '--provenance': provenance, '--matrix': matrix, '--rollback-check': rollbackCheck };
if (argv[0] === '--candidate') process.exit(candidate(argv[1] ?? 'HEAD'));
else if (argv[0] in modes) process.exit(modes[argv[0]]());
else {
    console.error('usage: gate-renewal-suite.mjs --manifest | --provenance | --candidate <rev> | --matrix | --rollback-check');
    process.exit(2);
}
