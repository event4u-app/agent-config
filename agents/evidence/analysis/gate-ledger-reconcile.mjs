#!/usr/bin/env node
// Mechanical reconciliation of the 7.1 classification ledger against the
// Phase 7 start inventory and the invocation inventory. Prints a matrix and
// exits 1 on any failed condition, so a reader re-runs it instead of trusting
// the ledger author's count. Run with node, no arguments.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PHASE7 = 'agents/evidence/council/live-tree-check-classification-20261010.md';
const LEDGER = 'agents/evidence/analysis/gate-classification-ledger-20261024.md';
const INVENTORY = 'agents/evidence/analysis/gate-invocation-inventory-20261024.md';
const BRANCHES = 'agents/evidence/analysis/gate-branch-inventory-20261024.json';
const MAPPING = 'agents/evidence/analysis/gate-branch-mapping-20261024.json';
const CLASSES = ['invariant', 'snapshot', 'tolerance', 'observation'];

function section(text, heading) {
    const start = text.indexOf(heading);
    if (start < 0) throw new Error(`missing section ${heading}`);
    const next = text.indexOf('\n## ', start + heading.length);
    return text.slice(start, next < 0 ? undefined : next);
}

function cells(line) {
    return line.split('|').slice(1, -1).map((c) => c.trim());
}

const checkName = (cell) => (cell.match(/`([a-z_]+)`/) ?? [])[1] ?? null;

const phase7 = section(read(PHASE7), '| # | Check | Class |')
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => checkName(cells(l)[1]));

const ledgerRows = [];
let current = null;
for (const line of section(read(LEDGER), '## The ledger — revision 3').split('\n')) {
    if (!/^\| (\d+|) \|/.test(line) || line.startsWith('| # |')) continue;
    const c = cells(line);
    const named = checkName(c[1]);
    if (named !== null) current = named;
    const classCell = c[7] ?? '';
    const cls = CLASSES.find((k) => new RegExp(`\\*\\*${k}`).test(classCell)) ?? null;
    const migration = /— target/.test(c[2]);
    const id = (line.match(/`(R\d+\.[a-z])`\s*\|\s*$/) ?? [])[1] ?? null;
    ledgerRows.push({ check: current, aspect: c[2], cls, migration, raw: line, id });
}

const inventoryChecks = section(read(INVENTORY), '## The inventory')
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => checkName(cells(l)[1]));

const failures = [];

const ids = ledgerRows.map((r) => r.id);
for (const r of ledgerRows) if (r.id === null) failures.push(`row without an id: ${r.check} / ${r.aspect}`);
const dupIds = ids.filter((x, i) => x !== null && ids.indexOf(x) !== i);
for (const d of new Set(dupIds)) failures.push(`duplicate row id ${d}`);

const pins = section(read(LEDGER), '## Row ids and invalidation')
    .split('\n')
    .map((l) => l.match(/^\| `([^`]+)` \| `([0-9a-f]{40})` \|$/))
    .filter((m) => m !== null);
if (pins.length === 0) failures.push('no source pins found');
for (const [, file, blob] of pins) {
    const now = execFileSync('git', ['hash-object', path.join(ROOT, file)], { encoding: 'utf8' }).trim();
    if (now !== blob) failures.push(`STALE: ${file} changed since the verdict was pinned (${blob.slice(0, 9)} → ${now.slice(0, 9)})`);
}
const set = (xs) => new Set(xs);
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

if (phase7.length !== 16 || set(phase7).size !== 16) failures.push(`phase-7 inventory has ${set(phase7).size} distinct checks, expected 16`);
const ledgerChecks = set(ledgerRows.map((r) => r.check));
if (!same(set(phase7), ledgerChecks)) failures.push('ledger checks differ from the phase-7 inventory');
if (!same(set(phase7), set(inventoryChecks))) failures.push('invocation inventory checks differ from the phase-7 inventory');

const binding = ledgerRows.filter((r) => !r.migration);
for (const r of binding) if (r.cls === null) failures.push(`unclassified binding aspect: ${r.check} / ${r.aspect}`);
for (const r of ledgerRows.filter((x) => x.migration)) {
    const hasCurrent = binding.some((b) => b.check === r.check && b.aspect.replace('— current', '').trim() === r.aspect.replace('— target', '').trim());
    if (!hasCurrent) failures.push(`target row without a current-scope row: ${r.check} / ${r.aspect}`);
}

// Every `--flag` literal in a check's own source is either declared here as
// changing no assertion, or must be named by a binding ledger row of that
// check. A flag in neither place is an unclassified invocation mode.
const NO_ASSERTION = {
    presentation: ['--quiet', '--json', '--list', '--help'],
    input: ['--root', '--dir', '--today', '--store', '--scope'],
    write: ['--write-baseline', '--publish'],
    notAFlag: ['--is-ancestor', '--record-composite'],
};
const declared = new Set(Object.values(NO_ASSERTION).flat());
const modeRows = [];
for (const check of phase7) {
    const src = read(`src/scripts/${check}.ts`);
    const flags = [...new Set([...src.matchAll(/['"`](--[a-z][a-z-]*)/g)].map((m) => m[1]))].sort();
    const rowsText = binding.filter((r) => r.check === check).map((r) => r.raw).join('\n');
    const assertionFlags = flags.filter((f) => !declared.has(f));
    const unmatched = assertionFlags.filter((f) => !rowsText.includes(f));
    for (const f of unmatched) failures.push(`unclassified invocation mode: ${check} ${f}`);
    modeRows.push(`${check} | ${flags.join(' ') || '—'} | ${assertionFlags.join(' ') || '—'} | ${unmatched.length === 0 ? 'yes' : 'NO'}`);
}

// The branch population comes from an inventory produced without sight of the
// ledger; this file only maps it. Both directions are checked: every branch
// lands on a row or a declared non-assertion category, and every binding row
// is reached by at least one branch.
const branchInv = JSON.parse(read(BRANCHES));
const { categories, mapping } = JSON.parse(read(MAPPING));
const rowIds = new Set(binding.map((r) => r.id));
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
for (const id of rowIds) if (!reached.has(id)) failures.push(`binding row ${id} is reached by no branch in the independent inventory`);
for (const [check, m] of Object.entries(mapping)) {
    const known = new Set((branchInv.checks.find((c) => c.check === check)?.branches ?? []).map((b) => b.id));
    for (const bid of Object.keys(m)) if (!known.has(bid)) failures.push(`mapping names ${check} ${bid}, absent from the inventory`);
}

console.log('check | binding aspects | all classified | classes | migration notes');
for (const check of phase7) {
    const rows = ledgerRows.filter((r) => r.check === check);
    const b = rows.filter((r) => !r.migration);
    const counts = CLASSES.map((k) => [k, b.filter((r) => r.cls === k).length]).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`${check} | ${b.length} | ${b.every((r) => r.cls !== null) ? 'yes' : 'NO'} | ${counts} | ${rows.length - b.length}`);
}
console.log('\ncheck | flags in source | assertion-changing flags | each named by a binding row');
for (const r of modeRows) console.log(r);
console.log(`\nbranches ${branchCount} · mapped to rows ${branchCount - Object.values(perCategory).reduce((a, b) => a + b, 0)} · ${JSON.stringify(perCategory)} · binding rows reached ${reached.size}/${rowIds.size}`);
const tally = Object.fromEntries(CLASSES.map((k) => [k, binding.filter((r) => r.cls === k).length]));
console.log(`\nrows ${ledgerRows.length} · binding ${binding.length} · migration ${ledgerRows.length - binding.length} · ${JSON.stringify(tally)}`);
if (failures.length > 0) {
    console.log(`\nFAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log('\nOK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row; every assertion-changing flag in each check\'s source is named by a binding row; every row has a unique id; ' + pins.length + ' pinned files are unchanged; every branch of the independent inventory maps to a binding row or a declared category, and every binding row is reached.');
