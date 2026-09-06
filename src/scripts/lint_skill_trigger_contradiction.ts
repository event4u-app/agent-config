#!/usr/bin/env tsx
/**
 * A skill may not say "explicit request only" and publish auto-trigger keywords.
 *
 * The description is consumed — it is the frontmatter a catalogue and a host
 * surface read. The keyword section is not: measured across the tree, nothing
 * in `src/` parses `## Auto-trigger keywords`, so a skill carrying both halves
 * is not mis-ROUTED, it is mis-DESCRIBED. A reader deciding whether they may
 * invoke the skill meets two opposite answers in one file, and the half that
 * looks operational is the half nothing reads.
 *
 * Three skills shipped in that state and a human had to notice it. The pair is
 * mechanically decidable from the file, so noticing it again should not be
 * anybody's job.
 *
 * Deliberately not a judgement about WHICH half is right. Both are legitimate
 * designs; only the contradiction is a defect, and which way to resolve it is
 * the author's call.
 *
 * Exit codes: 0 no contradiction · 1 at least one file carries both.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_REL = 'src/skills';

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
/** Matched in the description only — the phrase is meaningful there, prose elsewhere. */
const EXPLICIT_ONLY_RE = /explicit[- ]request[- ]only|explicit request only/i;
const AUTO_TRIGGER_RE = /^##\s+Auto-trigger keywords\s*$/m;

export function contradicts(text: string): boolean {
    const fm = FRONTMATTER_RE.exec(text);
    if (fm === null) return false;
    // `description:` may be a folded or quoted scalar spanning lines, so the
    // slice runs to the next top-level key rather than to the next newline.
    const desc = /^description:([\s\S]*?)(?=\n[a-z_]+:|$)/im.exec(fm[1] as string);
    if (desc === null) return false;
    if (!EXPLICIT_ONLY_RE.test(desc[1] as string)) return false;
    return AUTO_TRIGGER_RE.test(text);
}

function main(): number {
    if (process.argv.slice(2).includes('--self-test')) return selfTest();
    const rootIdx = process.argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (process.argv[rootIdx + 1] ?? ROOT);
    const dir = path.join(root, SKILLS_REL);
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).sort();
    } catch {
        process.stderr.write(`❌  no skills directory under ${root}/${SKILLS_REL}\n`);
        return 1;
    }
    const offenders: string[] = [];
    let scanned = 0;
    for (const n of names) {
        const f = path.join(dir, n, 'SKILL.md');
        if (!fs.existsSync(f)) continue;
        scanned += 1;
        if (contradicts(fs.readFileSync(f, 'utf-8'))) {
            offenders.push(`${SKILLS_REL}/${n}/SKILL.md`);
        }
    }
    reportScanned({
        gate: 'lint_skill_trigger_contradiction',
        scanned,
        units: 'SKILL.md file(s)',
        roots: [SKILLS_REL],
    });
    if (offenders.length > 0) {
        for (const o of offenders) {
            process.stdout.write(
                `❌  ${o}: description says explicit-request-only AND the body publishes ` +
                    '`## Auto-trigger keywords` — the two halves say opposite things ' +
                    'and nothing in src/ parses the keyword half, so the operational-looking ' +
                    'one is the inert one.\n',
            );
        }
        process.stdout.write(
            `\n${String(offenders.length)} contradicting skill(s). Resolve by removing whichever ` +
                'half is not true; the check does not decide which.\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅  lint_skill_trigger_contradiction: ${String(scanned)} skill(s) inspected, ` +
            'none claims explicit-request-only while publishing auto-trigger keywords.\n',
    );
    return 0;
}

function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-contradiction-selftest-'));
    const write = (name: string, body: string): string => {
        const dir = path.join(tmp, name, SKILLS_REL, 'sample');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf-8');
        return path.join(tmp, name);
    };
    const run = (root: string): number =>
        runGateCli(ROOT, 'src/scripts/lint_skill_trigger_contradiction.ts', ['--root', root], root);

    const both =
        '---\nname: sample\ndescription: Does a thing; explicit request only.\n---\n\n## Auto-trigger keywords\n\nfoo\n';
    const descOnly = '---\nname: sample\ndescription: Does a thing; explicit request only.\n---\n\nbody\n';
    const autoOnly = '---\nname: sample\ndescription: Does a thing.\n---\n\n## Auto-trigger keywords\n\nfoo\n';

    try {
        return runSelfTest({
            gate: 'lint_skill_trigger_contradiction',
            minCases: 3,
            minRejectCases: 1,
            cases: [
                {
                    name: 'a skill carrying BOTH halves is rejected',
                    expect: 'reject',
                    run: () => run(write('both', both)),
                },
                {
                    name: 'explicit-request-only with no keyword section passes',
                    expect: 'accept',
                    run: () => run(write('desc-only', descOnly)),
                },
                {
                    name: 'auto-trigger keywords with no explicit-only claim passes',
                    expect: 'accept',
                    run: () => run(write('auto-only', autoOnly)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { SKILLS_REL, main };
