#!/usr/bin/env node
// A mechanical, non-model enumeration of the places in the 16 Phase 7 check
// scripts where a run can report a finding or end non-zero, compared with the
// independent branch inventory. Each site must fall inside the `where` of at
// least one inventoried branch of the same file. Run with node; `--list`
// prints every site with the branches covering it.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const INVENTORY = 'agents/evidence/analysis/gate-branch-inventory-20261024.json';
const DISPOSITIONS = 'agents/evidence/analysis/gate-branch-site-dispositions-20261024.json';

// A site is a line that, by syntax alone, can turn a run into a finding or a
// non-zero end: a non-zero return or exit, a throw, or a push into a list the
// script reports. The patterns are deliberately syntactic and over-inclusive.
const SITE = [
    { kind: 'return-nonzero', re: /\breturn\s+[1-9]\b/ },
    { kind: 'exit-nonzero', re: /process\.exit(Code)?\s*(=|\()\s*[1-9]/ },
    { kind: 'throw', re: /\bthrow\s+(new\s+)?[A-Za-z]/ },
    { kind: 'push-finding', re: /\b(errors|failures|findings|violations|warnings|hits|problems|issues|unknown|out|stale|malformed)\??\.push\(/ },
];

function parseWhere(where) {
    const out = [];
    for (const part of String(where).split(/[;,]\s*(?=[\w./-]+\.(?:ts|mjs):|\d)/)) {
        const m = part.match(/([\w./-]+\.(?:ts|mjs))?:?(\d+)(?:-(\d+))?/);
        if (m) out.push({ file: m[1] ?? null, from: Number(m[2]), to: Number(m[3] ?? m[2]) });
    }
    return out;
}

const inv = JSON.parse(fs.readFileSync(path.join(ROOT, INVENTORY), 'utf8'));
const report = [];
let sites = 0;
let uncovered = 0;
for (const c of inv.checks) {
    const rel = `src/scripts/${c.check}.ts`;
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    const ranges = [];
    for (const b of c.branches) {
        let lastFile = rel;
        for (const r of parseWhere(b.where)) {
            const file = r.file === null ? lastFile : r.file.startsWith('src/') ? r.file : path.join('src/scripts', r.file);
            lastFile = file;
            ranges.push({ id: b.id, file, from: r.from, to: r.to });
        }
    }
    let inComment = false;
    lines.forEach((text, i) => {
        const n = i + 1;
        const t = text.trim();
        if (inComment) {
            if (t.includes('*/')) inComment = false;
            return;
        }
        if (t.startsWith('/*')) {
            inComment = !t.includes('*/');
            return;
        }
        if (t.startsWith('//') || t.startsWith('*')) return;
        const hit = SITE.find((s) => s.re.test(t));
        if (hit === undefined) return;
        sites += 1;
        const covering = ranges.filter((r) => r.file === rel && n >= r.from - 2 && n <= r.to + 2).map((r) => r.id);
        if (covering.length === 0) uncovered += 1;
        report.push({ check: c.check, line: n, kind: hit.kind, covering: [...new Set(covering)], text: t.slice(0, 110) });
    });
}

if (process.argv.includes('--list')) {
    for (const r of report) console.log(`${r.check}:${r.line} | ${r.kind} | ${r.covering.join(' ') || 'UNCOVERED'} | ${r.text}`);
}
// A site outside every branch range needs a recorded disposition, and a
// disposition that names a branch must name one the inventory has.
const { dispositions } = JSON.parse(fs.readFileSync(path.join(ROOT, DISPOSITIONS), 'utf8'));
const branchIds = new Set(inv.checks.flatMap((c) => c.branches.map((b) => `${c.check} ${b.id}`)));
const failures = [];
const kinds = {};
for (const r of report.filter((x) => x.covering.length === 0)) {
    const d = dispositions[`${r.check}:${r.line}`];
    if (d === undefined) {
        failures.push(`undisposed site ${r.check}:${r.line} ${r.kind} | ${r.text}`);
        continue;
    }
    kinds[d.kind.split(':')[0]] = (kinds[d.kind.split(':')[0]] ?? 0) + 1;
    const branch = d.kind.split(':')[1];
    if (branch !== undefined && !branchIds.has(`${r.check} ${branch}`)) failures.push(`disposition of ${r.check}:${r.line} names unknown branch ${branch}`);
}
const used = new Set(report.filter((x) => x.covering.length === 0).map((r) => `${r.check}:${r.line}`));
for (const k of Object.keys(dispositions)) if (!used.has(k)) failures.push(`stale disposition ${k}: no uncovered site there`);
console.log(`sites ${sites} · inside an inventoried branch ${sites - uncovered} · outside, with a disposition ${uncovered - failures.filter((f) => f.startsWith('undisposed')).length} ${JSON.stringify(kinds)}`);
if (failures.length > 0) {
    console.log(`FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log('OK: every syntactic finding or non-zero site in the 16 checks lies inside an inventoried branch or carries a disposition naming one; no site is a branch the inventory lacks.');
