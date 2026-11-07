/**
 * Gate: a default asset — a rule or a skill — leaves the tree only through a
 * removal record that answers five conditions. A bad benchmark is a question,
 * not a removal.
 *
 * The record is named after the asset (rule file name, or
 * skill directory name) and carries in its frontmatter:
 *
 *   asset:                 the removed path
 *   interpretation_record: a record with no `construct|delivery|cost: open` line   (4.1)
 *   census:                a real-use census file that exists                         (4.2)
 *   margin:                the non-inferiority margin, and
 *   margin_commit:         the commit that recorded it, older than the first commit
 *   deciding_report:       of the report that decided                                  (4.3)
 *   safety:                true for a security or safety asset, then
 *   adversarial_fixture:   a fixture that exists                                       (4.4)
 *   hidden_in:             an ancestor of the base where the asset was already out of
 *                          the default (rule `type: manual`, skill
 *                          `disable-model-invocation: true`)                           (4.5)
 *
 * Changing routing or loading is free; only deleting the file needs the record.
 *
 * Exit: 0 pass · 1 a removal without a valid record · 2 base unresolvable.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

import { pathToFileURL } from 'node:url';

import { resolveBaseRef } from './_lib/ratchet_base_ref.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const RULE_RE = /^src\/rules\/[^/]+\.md$/;
const SKILL_RE = /^src\/skills\/[^/]+\/SKILL\.md$/;
const OPEN_RE = /^\s*[-*]?\s*(construct|delivery|cost)\s*:\s*open\b/im;

export interface RemovalGit {
    /** File content at HEAD (the working tree of the change), or null. */
    head(p: string): string | null;
    /** File content at a ref, or null. */
    at(ref: string, p: string): string | null;
    /** Commit time of a ref in seconds, or null. */
    commitTime(ref: string): number | null;
    /** Time of the commit that first added a path, or null. */
    firstAdded(p: string): number | null;
    isAncestor(ancestor: string, of: string): boolean;
}

/** Default assets a `git diff --name-status` removes: deleted, or the source of a rename. */
export function removedDefaultAssets(nameStatus: readonly string[]): string[] {
    const out = new Set<string>();
    for (const line of nameStatus) {
        const [status, from] = line.split('\t');
        if (from === undefined || status === undefined || !/^[DR]/.test(status)) continue;
        if (RULE_RE.test(from) || SKILL_RE.test(from)) out.add(from);
    }
    return [...out].sort();
}

function frontmatter(text: string): Record<string, string> {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    const out: Record<string, string> = {};
    for (const line of (m?.[1] ?? '').split('\n')) {
        const kv = /^([\w-]+):\s*(.*)$/.exec(line);
        if (kv !== null) out[kv[1] as string] = (kv[2] as string).replace(/^["']|["']$/g, '').trim();
    }
    return out;
}

function recordPath(asset: string): string {
    const name = SKILL_RE.test(asset) ? (asset.split('/')[2] as string) : path.basename(asset, '.md');
    return `agents/evidence/removals/${name}.md`;
}

function hiddenFromDefault(asset: string, text: string | null): boolean {
    if (text === null) return false;
    const fm = frontmatter(text);
    return SKILL_RE.test(asset) ? fm['disable-model-invocation'] === 'true' : fm['type'] === 'manual';
}

export function removalProblems(removed: readonly string[], base: string, git: RemovalGit): string[] {
    const problems: string[] = [];
    for (const asset of removed) {
        const rel = recordPath(asset);
        const text = git.head(rel);
        if (text === null) {
            problems.push(`${asset}: no removal record at ${rel} — hide it from the default first (routing or loading), then remove it with a record.`);
            continue;
        }
        const fm = frontmatter(text);
        const bad = (step: string, why: string): void => {
            problems.push(`${asset}: ${step} — ${why} (${rel})`);
        };
        const interp = fm['interpretation_record'] ? git.head(fm['interpretation_record']) : null;
        if (interp === null) bad('4.1', 'interpretation_record missing or not found');
        else if (OPEN_RE.test(interp)) bad('4.1', 'the interpretation record still has an open construct, delivery or cost question');
        if (!fm['census'] || git.head(fm['census']) === null) bad('4.2', 'census missing or not found');
        const marginAt = fm['margin_commit'] ? git.commitTime(fm['margin_commit']) : null;
        const reportAt = fm['deciding_report'] ? git.firstAdded(fm['deciding_report']) : null;
        if (!fm['margin'] || marginAt === null || reportAt === null) bad('4.3', 'margin, margin_commit or deciding_report missing or unresolvable');
        else if (marginAt >= reportAt) bad('4.3', 'the margin was committed after the deciding report');
        if (fm['safety'] === 'true' && (!fm['adversarial_fixture'] || git.head(fm['adversarial_fixture']) === null)) {
            bad('4.4', 'a safety asset needs an adversarial fixture that exists');
        }
        const hiddenIn = fm['hidden_in'];
        if (!hiddenIn || !git.isAncestor(hiddenIn, base) || !hiddenFromDefault(asset, git.at(hiddenIn, asset))) {
            bad('4.5', 'hidden_in must name an earlier commit on the base where the asset was already out of the default');
        }
    }
    return problems;
}

function run(args: string[]): { ok: boolean; out: string } {
    const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
    return { ok: r.status === 0, out: r.stdout ?? '' };
}

const realGit: RemovalGit = {
    head: (p) => {
        const r = run(['show', `HEAD:${p}`]);
        return r.ok ? r.out : null;
    },
    at: (ref, p) => {
        const r = run(['show', `${ref}:${p}`]);
        return r.ok ? r.out : null;
    },
    commitTime: (ref) => {
        const r = run(['show', '-s', '--format=%ct', ref]);
        return r.ok ? Number(r.out.trim()) : null;
    },
    firstAdded: (p) => {
        const r = run(['log', '--diff-filter=A', '--format=%ct', '--', p]);
        const times = r.out.trim().split('\n').filter(Boolean).map(Number);
        return r.ok && times.length > 0 ? Math.min(...times) : null;
    },
    isAncestor: (a, b) => run(['merge-base', '--is-ancestor', a, b]).ok,
};

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const i = argv.indexOf('--baseline');
    const base = i >= 0 ? argv[i + 1] : resolveBaseRef(REPO_ROOT);
    if (base === undefined || base === null || !run(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).ok) {
        process.stderr.write('check_default_asset_removal: cannot resolve the base ref\n');
        return 2;
    }
    const diff = run(['diff', '--name-status', '-M', `${base}...HEAD`]);
    const removed = removedDefaultAssets(diff.out.split('\n'));
    const problems = removalProblems(removed, base, realGit);
    for (const p of problems) process.stderr.write(`❌  ${p}\n`);
    if (problems.length === 0 && !argv.includes('--quiet')) {
        process.stdout.write(`✅  check_default_asset_removal: ${removed.length} default asset(s) removed, each with a valid record.\n`);
    }
    return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exitCode = main();
}
