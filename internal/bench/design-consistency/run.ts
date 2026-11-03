#!/usr/bin/env node
/**
 * Retroactive shadow window for the consistency check
 * (road-to-a-control-that-matches-its-neighbours 3.8).
 *
 * Replays every commit of a local repository that wrote a UI surface, as the
 * `design-pass` hook would have seen each write: the role map is computed from
 * the tree AT that commit, the written file is read AT that commit, and the
 * findings are recorded at every candidate tolerance. It reads git objects
 * only and writes nothing into the replayed repository.
 *
 * The rows name files and commits of the replayed repository, so they belong
 * in a local, gitignored path: what is committed is the aggregate
 * (`internal/bench/corpora/design-consistency-shadow-window.md`).
 *
 *   npx tsx internal/bench/design-consistency/run.ts <repo> <label> <out.jsonl> [since=6.months] [until]
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';

import { buildArtefact } from '../../../src/cli/commands/uiAudit.js';
import { isUiPath, isUiTreePath } from '../../../src/scripts/_lib/ui_surface.js';
import { consistencyFindings, SHADOW_TOLERANCES_PX } from '../../../src/scripts/lint_design_consistency.js';

const [repo, label, out, since = '6.months', until] = process.argv.slice(2);
if (!repo || !label || !out) {
    process.stderr.write('usage: run.ts <repo> <label> <out.jsonl> [since] [until]\n');
    process.exit(1);
}

// The role map needs every UI file, `components.json` and the system-marker paths.
const inScope = (f: string) => !/(^|\/)(node_modules|vendor)\//.test(f) && (isUiPath(f) || isUiTreePath(f) || /(^|\/)components\.json$/.test(f));
const hookSees = (f: string) => isUiPath(f) || isUiTreePath(f);
const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 1 << 30 }).toString();

// One `cat-file --batch` process; every unique blob is read once.
const cat = spawn('git', ['-C', repo, 'cat-file', '--batch'], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = Buffer.alloc(0);
const waiters: Array<() => void> = [];
cat.stdout.on('data', (d: Buffer) => {
    buf = Buffer.concat([buf, d]);
    waiters.shift()?.();
});
const need = async (n: number) => {
    while (buf.length < n) await new Promise<void>((r) => waiters.push(r));
};
const cache = new Map<string, string>();
async function blob(id: string): Promise<string> {
    const hit = cache.get(id);
    if (hit !== undefined) return hit;
    cat.stdin.write(`${id}\n`);
    let nl = buf.indexOf(10);
    while (nl < 0) {
        await need(buf.length + 1);
        nl = buf.indexOf(10);
    }
    const size = Number(buf.subarray(0, nl).toString().split(' ')[2]);
    await need(nl + 1 + size + 1);
    const text = buf.subarray(nl + 1, nl + 1 + size).toString('utf8');
    buf = buf.subarray(nl + 1 + size + 1);
    cache.set(id, text);
    return text;
}

function tree(commit: string): Map<string, string> {
    const m = new Map<string, string>();
    for (const l of git('ls-tree', '-r', commit).split('\n')) {
        const t = l.indexOf('\t');
        if (t < 0) continue;
        const [, type, id] = l.slice(0, t).split(' ');
        const p = l.slice(t + 1);
        if (type === 'blob' && inScope(p)) m.set(p, id!);
    }
    return m;
}

const commits: Array<{ sha: string; parent?: string; files: string[] }> = [];
for (const l of git('log', `--since=${since}`, ...(until ? [`--until=${until}`] : []), '--no-merges', '--format=@%H %P', '--name-only', '--diff-filter=AM').split('\n')) {
    if (l.startsWith('@')) {
        const [sha, parent] = l.slice(1).split(' ');
        commits.push({ sha: sha!, parent, files: [] });
    } else if (l && commits.length && hookSees(l)) commits.at(-1)!.files.push(l);
}

const key = (f: { rule: string; message: string }) => `${f.rule}|${f.message}`;
const sink = fs.createWriteStream(out);
let rows = 0;
for (const c of commits.filter((x) => x.files.length > 0)) {
    const t = tree(c.sha);
    const pairs: Array<[string, string]> = [];
    for (const [p, id] of t) pairs.push([p, await blob(id)]);
    const roles = buildArtefact('.', pairs).control_roles;
    const before = c.parent ? tree(c.parent) : new Map<string, string>();
    for (const f of c.files) {
        const id = t.get(f);
        if (!id) continue;
        const content = await blob(id);
        const now = consistencyFindings(content, f, roles, 0);
        const prev = consistencyFindings(before.get(f) ? await blob(before.get(f)!) : '', f, roles, 0).map(key);
        const would_fire: Record<string, number> = {};
        for (const tol of SHADOW_TOLERANCES_PX) would_fire[`tolerance_${tol}px`] = consistencyFindings(content, f, roles, tol).length;
        sink.write(
            `${JSON.stringify({
                repo: label,
                commit: c.sha.slice(0, 10),
                file: f,
                would_fire,
                raw_control: now.filter((x) => x.rule === 'consistency-raw-control').length,
                deviations_px: now.flatMap((x) => (x.deviation_px === undefined ? [] : [x.deviation_px])),
                introduced: now
                    .filter((x) => {
                        const i = prev.indexOf(key(x));
                        if (i < 0) return true;
                        prev.splice(i, 1);
                        return false;
                    })
                    .map((x) => ({ rule: x.rule, line: x.line, message: x.message })),
            })}\n`,
        );
        rows++;
    }
}
sink.end();
cat.stdin.end();
process.stderr.write(`${label}: ${rows} UI writes replayed\n`);
