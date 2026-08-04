#!/usr/bin/env tsx
/**
 * Gate R2 reviewer dispatcher — deterministic assembler for the fresh-subagent
 * completion review (docs/contracts/plan-review-gates.md §5, verdict #18).
 *
 * The Phase-1 reviewer is a FRESH subagent without the implementation
 * context; its input is never assembled by the implementing agent. This
 * script IS that deterministic dispatcher: it computes the branch diff,
 * extracts the roadmap's Acceptance Criteria block, hashes every input,
 * writes the reviewer input package (`<out-dir>/<slug>.review-input/`) and
 * the findings-artifact skeleton (`<out-dir>/<slug>.findings.md`) carrying
 * the verifiable context manifest. It calls NO LLM itself — the host agent
 * dispatches a fresh subagent (/judge:on-diff machinery) at the package.
 *
 * Modes:
 *   dispatch (default) — assemble package + skeleton.
 *   --verify <findings-file> — re-derive the manifest hashes from the
 *     CURRENT repo state and compare against the recorded inputs.
 *
 * This is a dispatcher, not a gate — it emits no `scanned:` line and is not
 * registered in gate-coverage.yml.
 *
 * Exit codes: 0 = ok / manifest verified, 1 = policy refusal (empty diff,
 * refuse-overwrite, manifest mismatch), 2 = internal error (bad ref, parse
 * failure, crash).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface ManifestInputs {
    diffSha: string;
    diffHash: string;
    roadmap: string; // path, or 'none'
    roadmapHash: string; // sha256, or 'none'
    acHash: string; // sha256, or 'none'
    dispatched: string; // ISO YYYY-MM-DDTHH:MM:SSZ
}

export interface ExpectedHashes {
    diff_hash: string;
    roadmap_hash: string;
    ac_hash: string;
}

export interface ParsedManifest {
    diff_sha: string;
    diff_hash: string;
    roadmap: string;
    roadmap_hash: string;
    ac_hash: string;
    dispatched: string;
}

function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Manifest comment block — exactly the contract §5 shape. */
export function deriveManifest(inputs: ManifestInputs): string {
    return [
        '<!-- context-manifest: v1',
        'inputs:',
        `  diff_sha: ${inputs.diffSha}`,
        `  diff_hash: ${inputs.diffHash}`,
        `  roadmap: ${inputs.roadmap}`,
        `  roadmap_hash: ${inputs.roadmapHash}`,
        `  ac_hash: ${inputs.acHash}`,
        'excluded: [session-history, agents/runtime, implementation-context]',
        'tools: [git-diff-branch-scoped, file-read-branch-paths]',
        `dispatched: ${inputs.dispatched}`,
        '-->',
    ].join('\n');
}

/**
 * Pure hash derivation — CI re-derivation imports this to verify a submitted
 * artifact's manifest. `null` roadmap/AC text means "not provided" → 'none'.
 */
export function expectedHashes(args: {
    diffText: string;
    roadmapText?: string | null;
    acText?: string | null;
}): ExpectedHashes {
    return {
        diff_hash: sha256(args.diffText),
        roadmap_hash: args.roadmapText == null ? 'none' : sha256(args.roadmapText),
        ac_hash: args.acText == null ? 'none' : sha256(args.acText),
    };
}

/**
 * Extract the `## Acceptance Criteria` section — from that heading (inclusive)
 * to the next `## ` heading or EOF. No section → empty string.
 */
export function extractAcceptanceCriteria(roadmapText: string): string {
    const lines = roadmapText.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^## Acceptance Criteria\s*$/.test(lines[i] as string)) {
            start = i;
            break;
        }
    }
    if (start === -1) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^## /.test(lines[i] as string)) {
            end = i;
            break;
        }
    }
    return lines.slice(start, end).join('\n');
}

/** Parse the context-manifest comment block out of a findings artifact. */
export function parseManifest(text: string): ParsedManifest | null {
    const re = new RegExp(
        '<!-- context-manifest: v1\\n' +
            'inputs:\\n' +
            '  diff_sha: (.+)\\n' +
            '  diff_hash: (.+)\\n' +
            '  roadmap: (.+)\\n' +
            '  roadmap_hash: (.+)\\n' +
            '  ac_hash: (.+)\\n' +
            'excluded: \\[session-history, agents/runtime, implementation-context\\]\\n' +
            'tools: \\[git-diff-branch-scoped, file-read-branch-paths\\]\\n' +
            'dispatched: (.+)\\n' +
            '-->',
    );
    const m = re.exec(text);
    if (!m) return null;
    return {
        diff_sha: m[1] as string,
        diff_hash: m[2] as string,
        roadmap: m[3] as string,
        roadmap_hash: m[4] as string,
        ac_hash: m[5] as string,
        dispatched: m[6] as string,
    };
}

export function sanitizeSlug(raw: string): string {
    const s = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return s || 'review';
}

function git(repo: string, ...args: string[]): string {
    return execFileSync('git', args, {
        cwd: repo,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

function deriveSlugFromBranch(repo: string): string {
    const branch = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    if (branch === 'HEAD') {
        const short = git(repo, 'rev-parse', '--short', 'HEAD').trim();
        return sanitizeSlug(`detached-${short}`);
    }
    return sanitizeSlug(branch);
}

/** ISO timestamp at seconds precision (YYYY-MM-DDTHH:MM:SSZ). */
function isoSeconds(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function reviewerPrompt(args: {
    slug: string;
    headSha: string;
    roadmapGiven: boolean;
    changedFiles: readonly string[];
}): string {
    const roadmapLine = args.roadmapGiven
        ? '- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)'
        : '- roadmap under review: none (`acceptance-criteria.md` is empty)';
    return [
        `# R2 completion review — ${args.slug}`,
        '',
        'You are a FRESH reviewer subagent. You have no implementation context and',
        'you must not acquire any (blind-review pattern, plan-review-gates.md §5).',
        '',
        '## Review mode',
        '',
        'Senior-engineer review of the branch diff. Search grid — hunt for:',
        '',
        '- errors',
        '- inconsistent logic',
        '- inefficiencies',
        '- bug-producing patterns',
        '',
        '## Rules',
        '',
        '- Review only — write no code, fix nothing.',
        '- Tool allowlist (contract §5): branch-scoped `git diff` + reads of',
        '  branch-touched files only; no `git log` beyond the branch, no repo-wide',
        '  grep, no reads of `agents/runtime/` or session artifacts.',
        '',
        '## Inputs',
        '',
        `- diff: \`diff.patch\` (branch head ${args.headSha})`,
        roadmapLine,
        '',
        'Changed files:',
        '',
        ...args.changedFiles.map((f) => `- ${f}`),
        '',
        '## Output format (contract §2.2)',
        '',
        `Fill the findings table in \`${args.slug}.findings.md\`:`,
        '',
        '```markdown',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        '| 1 | critical | src/x.ts:42 | ... | open | |',
        '```',
        '',
        '- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending',
        '  by severity (ties keep authoring order).',
        '- Initial status of every finding: `open`.',
        '- 0 findings → replace the table with exactly this honest-null line',
        '  (contract §2.3):',
        '',
        '```markdown',
        `**Honest-null:** 0 findings, diff ${args.headSha}, reviewed <YYYY-MM-DD>`,
        '```',
        '',
    ].join('\n');
}

function findingsSkeleton(args: {
    slug: string;
    headSha: string;
    reviewedDate: string;
    manifest: string;
}): string {
    return [
        `# Findings: ${args.slug}`,
        `<!-- completion-review: v1 | reviewed: ${args.reviewedDate} | diff: ${args.headSha} | reviewer: r2-fresh-subagent-${args.slug} -->`,
        '',
        args.manifest,
        '',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        '<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 -->',
        '',
    ].join('\n');
}

interface Args {
    base: string;
    roadmap: string | null;
    slug: string | null;
    outDir: string;
    repo: string;
    printPrompt: boolean;
    format: 'text' | 'json';
    force: boolean;
    now: string | null;
    verify: string | null;
}

function parse_args(argv: readonly string[]): Args {
    const args: Args = {
        base: 'origin/main',
        roadmap: null,
        slug: null,
        outDir: 'agents/evidence/reviews',
        repo: '.',
        printPrompt: false,
        format: 'text',
        force: false,
        now: null,
        verify: null,
    };
    const takeValue = (flag: string, v: string | undefined): string => {
        if (v === undefined) {
            process.stderr.write(`dispatch_r2_reviewer: error: argument ${flag}: expected a value\n`);
            process.exit(2);
        }
        return v;
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--base') {
            args.base = takeValue(arg, argv[++i]);
        } else if (arg === '--roadmap') {
            args.roadmap = takeValue(arg, argv[++i]);
        } else if (arg === '--slug') {
            args.slug = takeValue(arg, argv[++i]);
        } else if (arg === '--out-dir') {
            args.outDir = takeValue(arg, argv[++i]);
        } else if (arg === '--repo') {
            args.repo = takeValue(arg, argv[++i]);
        } else if (arg === '--now') {
            args.now = takeValue(arg, argv[++i]);
        } else if (arg === '--verify') {
            args.verify = takeValue(arg, argv[++i]);
        } else if (arg === '--print-prompt') {
            args.printPrompt = true;
        } else if (arg === '--force') {
            args.force = true;
        } else if (arg === '--format') {
            const v = takeValue(arg, argv[++i]);
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `dispatch_r2_reviewer: error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            args.format = v;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: dispatch_r2_reviewer [-h] [--base REF] [--roadmap PATH] [--slug SLUG]\n' +
                    '                            [--out-dir PATH] [--repo PATH] [--print-prompt]\n' +
                    '                            [--format {text,json}] [--force] [--now ISO]\n' +
                    '                            [--verify FINDINGS_FILE]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(`dispatch_r2_reviewer: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
        i++;
    }
    return args;
}

function resolveNow(nowArg: string | null): Date {
    if (nowArg === null) return new Date();
    const d = new Date(nowArg);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`--now: invalid ISO timestamp '${nowArg}'`);
    }
    return d;
}

function runVerify(args: Args): number {
    const findingsPath = args.verify as string;
    if (!fs.existsSync(findingsPath)) {
        process.stderr.write(`❌  Internal error: findings file not found: ${findingsPath}\n`);
        return 2;
    }
    const manifest = parseManifest(fs.readFileSync(findingsPath, 'utf-8'));
    if (manifest === null) {
        process.stderr.write(`❌  Internal error: no context-manifest block found in ${findingsPath}\n`);
        return 2;
    }

    const headSha = git(args.repo, 'rev-parse', 'HEAD').trim();
    const diffText = git(args.repo, 'diff', `${args.base}...HEAD`);
    let roadmapText: string | null = null;
    let acText: string | null = null;
    let roadmapMissing = false;
    if (manifest.roadmap !== 'none') {
        const roadmapPath = path.resolve(args.repo, manifest.roadmap);
        if (fs.existsSync(roadmapPath)) {
            roadmapText = fs.readFileSync(roadmapPath, 'utf-8');
            acText = extractAcceptanceCriteria(roadmapText);
        } else {
            roadmapMissing = true;
        }
    }
    const expected = expectedHashes({ diffText, roadmapText, acText });

    const diverged: string[] = [];
    const check = (name: string, recorded: string, actual: string): void => {
        if (recorded !== actual) {
            diverged.push(name);
            process.stderr.write(`  ${name}: recorded ${recorded} ≠ current ${actual}\n`);
        }
    };
    check('diff_sha', manifest.diff_sha, headSha);
    check('diff_hash', manifest.diff_hash, expected.diff_hash);
    if (roadmapMissing) {
        diverged.push('roadmap_hash');
        process.stderr.write(`  roadmap_hash: recorded ${manifest.roadmap_hash} but roadmap file ${manifest.roadmap} is missing\n`);
    } else {
        check('roadmap_hash', manifest.roadmap_hash, expected.roadmap_hash);
        check('ac_hash', manifest.ac_hash, expected.ac_hash);
    }

    if (diverged.length) {
        process.stderr.write(`❌  manifest mismatch (stale review): ${diverged.join(', ')} diverged\n`);
        return 1;
    }
    process.stdout.write('✅ manifest verified\n');
    return 0;
}

function runDispatch(args: Args): number {
    const now = resolveNow(args.now);
    const dispatched = isoSeconds(now);
    const reviewedDate = dispatched.slice(0, 10);

    const headSha = git(args.repo, 'rev-parse', 'HEAD').trim();
    const diffText = git(args.repo, 'diff', `${args.base}...HEAD`);
    if (diffText.trim() === '') {
        process.stderr.write(`❌  Empty diff (${args.base}...HEAD) — nothing to review.\n`);
        return 1;
    }
    const changedFiles = git(args.repo, 'diff', '--name-only', `${args.base}...HEAD`)
        .split('\n')
        .filter((l) => l.trim() !== '');

    const slug = args.slug !== null ? sanitizeSlug(args.slug) : deriveSlugFromBranch(args.repo);

    let roadmapText: string | null = null;
    let acText: string | null = null;
    if (args.roadmap !== null) {
        roadmapText = fs.readFileSync(path.resolve(args.repo, args.roadmap), 'utf-8');
        acText = extractAcceptanceCriteria(roadmapText);
    }
    const hashes = expectedHashes({ diffText, roadmapText, acText });

    const outDirAbs = path.resolve(args.repo, args.outDir);
    const inputDirAbs = path.join(outDirAbs, `${slug}.review-input`);
    const findingsAbs = path.join(outDirAbs, `${slug}.findings.md`);
    if (fs.existsSync(findingsAbs) && !args.force) {
        process.stderr.write(`❌  Refusing to overwrite existing findings artifact: ${findingsAbs} (use --force)\n`);
        return 1;
    }

    const promptText = reviewerPrompt({ slug, headSha, roadmapGiven: roadmapText !== null, changedFiles });
    const manifest = deriveManifest({
        diffSha: headSha,
        diffHash: hashes.diff_hash,
        roadmap: args.roadmap ?? 'none',
        roadmapHash: hashes.roadmap_hash,
        acHash: hashes.ac_hash,
        dispatched,
    });
    const skeleton = findingsSkeleton({ slug, headSha, reviewedDate, manifest });

    fs.mkdirSync(inputDirAbs, { recursive: true });
    fs.writeFileSync(path.join(inputDirAbs, 'diff.patch'), diffText, 'utf-8');
    if (roadmapText !== null) {
        fs.writeFileSync(path.join(inputDirAbs, 'roadmap.md'), roadmapText, 'utf-8');
    }
    fs.writeFileSync(path.join(inputDirAbs, 'acceptance-criteria.md'), acText ?? '', 'utf-8');
    fs.writeFileSync(path.join(inputDirAbs, 'prompt.md'), promptText, 'utf-8');
    fs.writeFileSync(findingsAbs, skeleton, 'utf-8');

    const inputDirRel = path.join(args.outDir, `${slug}.review-input`);
    const findingsRel = path.join(args.outDir, `${slug}.findings.md`);
    const files = {
        input_dir: inputDirRel,
        diff: path.join(inputDirRel, 'diff.patch'),
        roadmap: roadmapText !== null ? path.join(inputDirRel, 'roadmap.md') : null,
        acceptance_criteria: path.join(inputDirRel, 'acceptance-criteria.md'),
        prompt: path.join(inputDirRel, 'prompt.md'),
        findings: findingsRel,
    };

    if (args.format === 'json') {
        process.stdout.write(JSON.stringify({ slug, head_sha: headSha, hashes, files }, null, 2) + '\n');
    } else if (args.printPrompt) {
        process.stdout.write(promptText);
        process.stdout.write('\n---\n');
        process.stdout.write(`input package: ${inputDirRel}\n`);
        process.stdout.write(`findings skeleton: ${findingsRel}\n`);
    } else {
        process.stdout.write(`✅  R2 reviewer package prepared for '${slug}' (head ${headSha}).\n`);
        process.stdout.write(`  input package:     ${inputDirRel}\n`);
        process.stdout.write(`  findings skeleton: ${findingsRel}\n`);
        process.stdout.write('  Dispatch a FRESH subagent at the input package (never the implementing session).\n');
    }
    return 0;
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.verify !== null) {
        return runVerify(args);
    }
    return runDispatch(args);
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked invocation (installed projection, macOS /var → /private/var)
    // makes the raw URLs differ; compare realpaths so the guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  Internal error: ${msg}\n`);
        process.exit(2);
    }
}
