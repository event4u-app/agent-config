#!/usr/bin/env node
// A mechanical, non-model enumeration of the places in the 16 Phase 7 check
// scripts where a run can report a finding or end non-zero, compared with the
// independent branch inventory. Each site must fall inside the `where` of an
// inventoried branch of the same file, or carry a recorded disposition. Run
// with node; `--list` prints every site, `--self-test` plants one site of each
// supported type and requires each to be refused.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const INVENTORY = 'agents/evidence/analysis/gate-branch-inventory-20261024.json';
const DISPOSITIONS = 'agents/evidence/analysis/gate-branch-site-dispositions-20261024.json';

// The declared surface is the 16 check scripts' own source text. Imported
// helpers are outside it: each helper failure a check can surface is an
// inventoried branch naming the helper, and the helper closure is pinned by the
// reconciler. Spawned subprocesses (git, node) are outside it too; their
// failures reach the checks only through the branches that handle them.
export const VOCABULARY = [
    { kind: 'return-nonzero', re: /\breturn\s+[1-9]\b/ },
    { kind: 'exit-nonzero', re: /process\.exit\s*\(\s*[1-9]/ },
    { kind: 'exit-code', re: /process\.exitCode\s*=\s*[1-9]/ },
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

export function scan(read) {
    const inv = JSON.parse(read(INVENTORY));
    const { dispositions } = JSON.parse(read(DISPOSITIONS));
    const report = [];
    for (const c of inv.checks) {
        const rel = `src/scripts/${c.check}.ts`;
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
        read(rel).split('\n').forEach((text, i) => {
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
            const hit = VOCABULARY.find((s) => s.re.test(t));
            if (hit === undefined) return;
            const hits = ranges.filter((r) => r.file === rel && n >= r.from && n <= r.to);
            const span = hits.length === 0 ? 0 : Math.min(...hits.map((r) => r.to - r.from));
            const narrowest = [...new Set(hits.filter((r) => r.to - r.from === span).map((r) => r.id))];
            report.push({ check: c.check, line: n, kind: hit.kind, covering: [...new Set(hits.map((r) => r.id))], narrowest, text: t.slice(0, 110) });
        });
    }
    const branchIds = new Set(inv.checks.flatMap((c) => c.branches.map((b) => `${c.check} ${b.id}`)));
    const failures = [];
    const kinds = {};
    const outside = report.filter((x) => x.covering.length === 0);
    for (const r of outside) {
        const d = dispositions[`${r.check}:${r.line}`];
        if (d === undefined) {
            failures.push(`undisposed site ${r.check}:${r.line} ${r.kind} | ${r.text}`);
            continue;
        }
        kinds[d.kind.split(':')[0]] = (kinds[d.kind.split(':')[0]] ?? 0) + 1;
        const branch = d.kind.split(':')[1];
        if (branch !== undefined && !branchIds.has(`${r.check} ${branch}`)) failures.push(`disposition of ${r.check}:${r.line} names unknown branch ${branch}`);
    }
    // A hard exit site (a non-zero return, exit or exit code) whose NARROWEST
    // covering branch declares a non-blocking effect contradicts the inventory,
    // even when a wider wrapping branch is blocking: the
    // code can fail the run where the inventory says it cannot. The reverse is
    // not decidable here, because most findings are pushed and the exit is
    // aggregated, so it is reported as a coverage count, never claimed.
    const effectOf = {};
    for (const c of inv.checks) for (const b of c.branches) effectOf[`${c.check} ${b.id}`] = b;
    const nonBlocking = (b) => b.effect === 'warning-exit-zero' || (b.effect === 'exit-code-only' && b.exit_code === 0);
    const HARD = ['return-nonzero', 'exit-nonzero', 'exit-code'];
    const confirmed = new Set();
    for (const r of report) {
        const bs = r.narrowest.map((id) => effectOf[`${r.check} ${id}`]).filter((b) => b !== undefined);
        if (HARD.includes(r.kind) || r.kind === 'throw') for (const id of r.covering) confirmed.add(`${r.check} ${id}`);
        if (HARD.includes(r.kind) && bs.length > 0 && bs.every(nonBlocking)) failures.push(`effect contradicts code: ${r.check}:${r.line} ${r.kind} lies in non-blocking branch(es) ${r.narrowest.join(', ')}, its narrowest cover`);
    }
    const blockingIds = Object.entries(effectOf).filter(([, b]) => !nonBlocking(b) && b.effect !== 'warning-exit-nonzero-only-with-flag').map(([k]) => k);
    const effectCoverage = { blocking: blockingIds.length, confirmedByHardSite: blockingIds.filter((k) => confirmed.has(k)).length };
    const used = new Set(outside.map((r) => `${r.check}:${r.line}`));
    for (const k of Object.keys(dispositions)) if (!used.has(k)) failures.push(`stale disposition ${k}: no uncovered site there`);
    return { report, failures, kinds, sites: report.length, inside: report.length - outside.length, effectCoverage };
}

const realRead = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function selfTest() {
    const target = 'src/scripts/lint_readme_jargon.ts';
    const planted = {
        'return-nonzero': 'function planted(x: boolean): number { if (x) return 7; return 0; }',
        'exit-nonzero': 'function planted(): void { process.exit(9); }',
        'exit-code': 'function planted(): void { process.exitCode = 4; }',
        throw: 'function planted(): never { throw new Error("planted"); }',
        'push-finding': 'function planted(errors: string[]): void { errors.push("planted"); }',
    };
    let bad = 0;
    const base = scan(realRead);
    const baseOk = base.failures.length === 0;
    console.log(`${baseOk ? 'ok  ' : 'FAIL'} baseline is clean`);
    if (!baseOk) bad += 1;
    for (const v of VOCABULARY) {
        const line = planted[v.kind];
        const read = (rel) => (rel === target ? `${realRead(rel)}\n${line}\n` : realRead(rel));
        const { failures } = scan(read);
        const ok = failures.some((f) => f.startsWith('undisposed site lint_readme_jargon') && f.includes(v.kind));
        if (!ok) bad += 1;
        console.log(`${ok ? 'ok  ' : 'FAIL'} a planted ${v.kind} site is refused`);
    }
    {
        const read = (rel) => {
            if (rel !== INVENTORY) return realRead(rel);
            const j = JSON.parse(realRead(rel));
            j.checks.find((c) => c.check === 'check_composite_arming').branches.find((b) => b.id === 'c16-all-malformed').effect = 'warning-exit-zero';
            return JSON.stringify(j);
        };
        const ok = scan(read).failures.some((f) => f.startsWith('effect contradicts code: check_composite_arming'));
        if (!ok) bad += 1;
        console.log(`${ok ? 'ok  ' : 'FAIL'} a non-blocking effect over a hard exit site is refused`);
    }
    {
        const read = (rel) => {
            if (rel !== INVENTORY) return realRead(rel);
            const j = JSON.parse(realRead(rel));
            j.checks.find((c) => c.check === 'check_composite_arming').branches.find((b) => b.id === 'c16-rethrow').effect = 'warning-exit-zero';
            return JSON.stringify(j);
        };
        const ok = scan(read).failures.some((f) => f.includes('check_composite_arming') && f.includes('c16-rethrow'));
        if (!ok) bad += 1;
        console.log(`${ok ? 'ok  ' : 'FAIL'} a non-blocking narrowest branch is refused even inside a wider blocking one`);
    }
    console.log(`\nself-test: ${VOCABULARY.length + 3 - bad}/${VOCABULARY.length + 3} case(s) behaved`);
    process.exit(bad === 0 ? 0 : 1);
}

if (process.argv.includes('--self-test')) selfTest();
else {
    const { report, failures, kinds, sites, inside, effectCoverage } = scan(realRead);
    if (process.argv.includes('--list')) {
        for (const r of report) console.log(`${r.check}:${r.line} | ${r.kind} | ${r.covering.join(' ') || 'UNCOVERED'} | ${r.text}`);
    }
    console.log(`sites ${sites} · inside an inventoried branch ${inside} · outside, with a disposition ${sites - inside - failures.filter((f) => f.startsWith('undisposed')).length} ${JSON.stringify(kinds)}`);
    console.log(`effects: ${effectCoverage.blocking} blocking branches, ${effectCoverage.confirmedByHardSite} confirmed by a hard exit or throw site in their range; the rest report through an aggregated exit and rest on the independent inventory's reading. Contradictions refused: a hard exit site only in non-blocking branches.`);
    if (failures.length > 0) {
        console.log(`FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
        process.exit(1);
    }
    console.log('OK: every site of the declared vocabulary in the 16 checks lies inside an inventoried branch or carries a disposition naming one; no site is a branch the inventory lacks.');
}
