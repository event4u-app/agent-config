#!/usr/bin/env node
// Mechanical reconciliation of the 7.1 classification ledger against the
// Phase 7 start inventory and the invocation inventory. Prints a matrix and
// exits 1 on any failed condition, so a reader re-runs it instead of trusting
// the ledger author's count. Run with node, no arguments.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PHASE7 = 'agents/evidence/council/live-tree-check-classification-20261010.md';
const LEDGER = 'agents/evidence/analysis/gate-classification-ledger-20261024.md';
const INVENTORY = 'agents/evidence/analysis/gate-invocation-inventory-20261024.md';
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
    ledgerRows.push({ check: current, aspect: c[2], cls, migration });
}

const inventoryChecks = section(read(INVENTORY), '## The inventory')
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => checkName(cells(l)[1]));

const failures = [];
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

console.log('check | binding aspects | all classified | classes | migration notes');
for (const check of phase7) {
    const rows = ledgerRows.filter((r) => r.check === check);
    const b = rows.filter((r) => !r.migration);
    const counts = CLASSES.map((k) => [k, b.filter((r) => r.cls === k).length]).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`${check} | ${b.length} | ${b.every((r) => r.cls !== null) ? 'yes' : 'NO'} | ${counts} | ${rows.length - b.length}`);
}
const tally = Object.fromEntries(CLASSES.map((k) => [k, binding.filter((r) => r.cls === k).length]));
console.log(`\nrows ${ledgerRows.length} · binding ${binding.length} · migration ${ledgerRows.length - binding.length} · ${JSON.stringify(tally)}`);
if (failures.length > 0) {
    console.log(`\nFAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log('\nOK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row.');
