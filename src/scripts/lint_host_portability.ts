#!/usr/bin/env tsx
/**
 * Host portability — a grant nobody can honour, and a subagent nobody defines.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 3, Steps 4 and 5. Two
 * checks over authored artefacts, both of the same shape: an artefact NAMES
 * something host-specific, and nothing verifies the name means anything.
 *
 * ── Check 1: tool grants outside the verified vocabulary ────────────────────
 * The step asks for "a tool grant declared for one host and absent for another".
 * That comparison is not available and saying so is the finding:
 * `docs/contracts/host-tool-vocabulary.md` records that this tree verifies tool
 * NAMES for exactly one host, so a cross-host table would be filled with recalled
 * vendor documentation on the very page a porter relies on.
 *
 * What IS decidable is the same defect from the other side: a grant naming a
 * tool outside the verified vocabulary is a grant no host in this tree is known
 * to honour — and an unrecognised key is IGNORED by a loader, so the artefact
 * inherits everything. Non-portability shows up as a name nothing can resolve.
 *
 * ── Check 2: subagent types that resolve to nothing ─────────────────────────
 * A dispatch to a subagent type that does not exist fails at RUNTIME, on the
 * turn that needed it. It resolves if a definition lives in `src/subagents/`,
 * or if it is one of the host's own built-ins — which are allowlisted by name
 * rather than assumed, because a built-in is a fact about the host and this tree
 * carries its own record of them.
 *
 * Exit codes: 0 clean · 1 finding(s) · 2 usage / dead scope.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { capPerCategory, envelope } from './_lib/outcome_envelope.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Artefact roots that may name a tool or a subagent type. */
/** Per-KIND finding cap. A global cap lets one kind hide the other. */
export const FINDING_CAP_PER_KIND = 20;

export const SCAN_ROOTS = ['src/skills', 'src/agent-src', 'src/domains', 'src/subagents'] as const;

/**
 * The verified tool vocabulary, from `docs/contracts/host-tool-vocabulary.md`.
 *
 * Sourced from the names this package's own hooks match on and the grants its
 * skills declare — not from a vendor doc. Extending this list means extending
 * that contract, which is where the evidence rule lives.
 */
export const VERIFIED_TOOLS: ReadonlySet<string> = new Set([
    'Bash',
    'Read',
    'Write',
    'Edit',
    'MultiEdit',
    'Grep',
    'Glob',
    'Task',
    'NotebookEdit',
    'WebFetch',
    'WebSearch',
    'TodoWrite',
    'SlashCommand',
    'Skill',
]);

/**
 * Host-provided subagent types — a fact about the host, allowlisted by name.
 *
 * The step calls for "a built-in allowlist for the host's own types". These are
 * the types Claude Code ships; a type here needs no definition in this tree.
 */
export const HOST_BUILTIN_SUBAGENTS: ReadonlySet<string> = new Set([
    'general-purpose',
    'Explore',
    'Plan',
    'statusline-setup',
    'fork',
    'claude',
]);

export interface PortabilityFinding {
    file: string;
    line: number;
    kind: 'unverified-tool' | 'unresolved-subagent';
    detail: string;
}

/** Grant keys, in every spelling this tree uses. */
const TOOL_KEY_RE = /^\s*(?:allowed_tools|allowed-tools|disallowed_tools|tools):\s*(.*)$/;
const SEQ_ITEM_RE = /^\s+-\s*(.+)$/;
const SUBAGENT_TYPE_RE = /\bsubagent_type\s*[:=]\s*['"]?([A-Za-z0-9_-]+)/g;

/** Strip a scoped grant down to its tool name: `Bash(git:*)` → `Bash`. */
export function toolName(grant: string): string {
    return grant
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\(.*$/, '')
        .trim();
}

/** Parse a grant value that may be inline flow (`[A, B]`) or empty. */
export function parseInlineGrants(value: string): string[] {
    const v = value.trim();
    if (v === '' || v === '[]') return [];
    const inner = v.startsWith('[') ? v.slice(1, v.endsWith(']') ? -1 : undefined) : v;
    return inner
        .split(',')
        .map((x) => toolName(x))
        .filter((x) => x !== '');
}

export function scanContent(rel: string, content: string): PortabilityFinding[] {
    const out: PortabilityFinding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        const m = TOOL_KEY_RE.exec(line);
        if (m !== null) {
            const grants = parseInlineGrants(m[1] ?? '');
            // A block sequence follows the key on subsequent lines.
            for (let j = i + 1; j < lines.length; j += 1) {
                const item = SEQ_ITEM_RE.exec(lines[j] as string);
                if (item === null) break;
                grants.push(toolName(item[1] as string));
            }
            for (const g of grants) {
                // `*` and `Bash(*)` are the OVER-BROAD class and belong to
                // lint_skill_frontmatter_safety. Reporting them here too would
                // red the same artefact twice for one defect.
                if (g === '' || g === '*') continue;
                if (VERIFIED_TOOLS.has(g)) continue;
                out.push({
                    file: rel,
                    line: i + 1,
                    kind: 'unverified-tool',
                    detail:
                        `grant names \`${g}\`, which is not in the verified tool vocabulary — ` +
                        'no host in this tree is known to honour it, and a loader IGNORES an ' +
                        'unrecognised key, so this artefact is not restricted. Add it to ' +
                        'docs/contracts/host-tool-vocabulary.md with its evidence, or use a verified name.',
                });
            }
        }
        SUBAGENT_TYPE_RE.lastIndex = 0;
        let sm: RegExpExecArray | null;
        while ((sm = SUBAGENT_TYPE_RE.exec(line)) !== null) {
            out.push({ file: rel, line: i + 1, kind: 'unresolved-subagent', detail: sm[1] as string });
        }
    }
    return out;
}

/** Subagent definitions in the tree. `_`-prefixed files are partials, never types. */
export function definedSubagents(repoRoot: string): Set<string> {
    const dir = path.join(repoRoot, 'src', 'subagents');
    const out = new Set<string>();
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.md') || name.startsWith('_')) continue;
        out.add(name.slice(0, -3));
    }
    return out;
}

function walkMd(root: string, rel = ''): string[] {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
        const r = rel === '' ? ent.name : `${rel}/${ent.name}`;
        if (ent.isDirectory()) out.push(...walkMd(root, r));
        else if (ent.name.endsWith('.md')) out.push(r);
    }
    return out;
}

export interface Report {
    findings: PortabilityFinding[];
    scanned: number;
}

export function run(repoRoot: string, ledger?: GateLedger): Report {
    const defined = definedSubagents(repoRoot);
    const findings: PortabilityFinding[] = [];
    let scanned = 0;
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
        for (const rel of walkMd(path.join(repoRoot, root))) files.push(`${root}/${rel}`);
    }
    ledger?.plan(files);
    for (const rel of files) {
        scanned += 1;
        const hits = scanContent(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
        const real = hits.filter((h) => {
            if (h.kind !== 'unresolved-subagent') return true;
            return !defined.has(h.detail) && !HOST_BUILTIN_SUBAGENTS.has(h.detail);
        });
        for (const h of real) {
            if (h.kind === 'unresolved-subagent') {
                h.detail =
                    `subagent_type \`${h.detail}\` resolves to nothing — no src/subagents/${h.detail}.md ` +
                    'and not a host built-in. A broken dispatch is invisible until the turn that needs it.';
            }
        }
        findings.push(...real);
        if (real.length > 0) ledger?.fail(rel, `${String(real.length)} portability finding(s)`);
        else ledger?.complete(rel);
    }
    return { findings, scanned };
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portability-'));
    const build = (name: string, rel: string, body: string, subagents: string[] = []): string => {
        const root = path.join(tmp, name);
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf8');
        for (const s of subagents) {
            fs.mkdirSync(path.join(root, 'src', 'subagents'), { recursive: true });
            fs.writeFileSync(path.join(root, 'src', 'subagents', `${s}.md`), '', 'utf8');
        }
        return root;
    };
    const runIt = (root: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/lint_host_portability.ts', ['--root', root, '--quiet'], REPO_ROOT);

    try {
        return runSelfTest({
            gate: 'lint_host_portability',
            minCases: 4,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a grant naming a verified tool passes',
                    expect: 'accept',
                    run: () =>
                        runIt(build('ok', 'src/skills/a/SKILL.md', '---\nexecution:\n  allowed_tools: ["Bash(git:*)", "Read"]\n---\n')),
                },
                {
                    name: 'a grant naming an unverified tool is rejected',
                    expect: 'reject',
                    run: () =>
                        runIt(build('bad', 'src/skills/a/SKILL.md', '---\nexecution:\n  allowed_tools: ["FileWriter"]\n---\n')),
                },
                {
                    name: 'a subagent_type with a definition in the tree passes',
                    expect: 'accept',
                    run: () =>
                        runIt(build('defined', 'src/skills/a/SKILL.md', 'Dispatch with subagent_type: my-judge\n', ['my-judge'])),
                },
                {
                    name: 'a host built-in subagent_type passes without a definition',
                    expect: 'accept',
                    run: () => runIt(build('builtin', 'src/skills/a/SKILL.md', 'subagent_type: general-purpose\n')),
                },
                {
                    name: 'a subagent_type resolving to nothing is rejected',
                    expect: 'reject',
                    run: () => runIt(build('ghost', 'src/skills/a/SKILL.md', 'subagent_type: no-such-agent\n')),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: lint_host_portability [--root DIR] [--quiet] [--json] [--self-test]\n' +
                '  --json emits an outcome envelope: terminal state, retry class, suggestion,\n' +
                '         and a `truncated` flag with per-category pre-cap totals.\n',
        );
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();
    const quiet = argv.includes('--quiet');
    const rootIdx = argv.indexOf('--root');
    const root = rootIdx !== -1 && rootIdx + 1 < argv.length ? path.resolve(argv[rootIdx + 1] as string) : REPO_ROOT;
    const isFixture = root !== REPO_ROOT;

    const ledger = isFixture ? undefined : new GateLedger('lint_host_portability');
    const report = run(root, ledger);

    try {
        // `exactOptionalPropertyTypes` distinguishes an ABSENT key from one set
        // to `undefined`, and `ScannedOptions.allowEmpty` is optional-absent
        // rather than optional-undefined. Spreading the key in only when it
        // applies says the same thing the ternary meant and type-checks: a
        // non-fixture run must not carry an empty-scope escape at all.
        assertScanned({
            gate: 'lint_host_portability',
            scanned: report.scanned,
            units: 'authored artefact(s)',
            roots: SCAN_ROOTS,
            ...(isFixture
                ? {
                      allowEmpty:
                          'OPTIONAL_INPUT: a self-test fixture may legitimately contain no artefact under a given root.',
                  }
                : {}),
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    ledger?.report(quiet ? () => undefined : undefined);
    process.stdout.write(`scanned: ${String(report.scanned)}\n`);

    // Findings are capped PER KIND, not globally: one high-volume kind would
    // otherwise fill the list and hide the other entirely — the failure a cap is
    // supposed to prevent, arriving through the cap. `truncated` and the pre-cap
    // totals come from the same call, so the flag and the counts cannot drift.
    const capped = capPerCategory(report.findings, (f) => f.kind, FINDING_CAP_PER_KIND);

    if (argv.includes('--json')) {
        const env = envelope({
            state: report.findings.length > 0 ? 'blocked' : report.scanned === 0 ? 'clean-no-op' : 'success',
            retry: report.findings.length > 0 ? 'hard-blocker' : 'not-applicable',
            suggestion:
                report.findings.length > 0
                    ? 'rename the grant to a verified tool, or define the subagent type — a retry ' +
                      'changes nothing, the artefact has to change'
                    : '',
            truncated: capped.truncated,
            totals: capped.totals,
            payload: capped.kept,
        });
        process.stdout.write(`${JSON.stringify(env, null, 2)}\n`);
        return report.findings.length > 0 ? 1 : 0;
    }

    if (report.findings.length > 0) {
        for (const f of capped.kept) {
            process.stderr.write(`  🔴 [${f.kind}] ${f.file}:${String(f.line)} — ${f.detail}\n`);
        }
        if (capped.truncated) {
            const dropped = Object.entries(capped.totals)
                .map(([k, n]) => `${k}=${String(n)}`)
                .join(' · ');
            process.stderr.write(
                `  … list CAPPED at ${String(FINDING_CAP_PER_KIND)} per kind. Pre-cap totals: ${dropped}\n`,
            );
        }
        process.stderr.write(`❌  lint_host_portability: ${String(report.findings.length)} finding(s).\n`);
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`✅  lint_host_portability: ${String(report.scanned)} artefact(s) clean.\n`);
    }
    return 0;
}

/* c8 ignore start */
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href) {
    process.exit(main());
}
/* c8 ignore stop */
