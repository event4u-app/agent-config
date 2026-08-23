/**
 * check_playbook_invokes — a `configured` playbook may not name a procedure the tree no
 * longer has.
 *
 * Ships in the consumer `scripts/` template so it runs in the CONSUMER's CI, over the
 * consumer's own playbooks and the consumer's own configuration. That placement is the
 * whole design: staleness is a fact about their repository, and a gate in this package
 * could only ever check this package.
 *
 * The grade is the contract (ADR-244). `configured` asserts every step invokes something
 * present in the tree; when a generator is renamed, that assertion becomes false silently —
 * the playbook still reads like a procedure and the command no longer exists. This check is
 * what turns that into a failure instead of a surprise at the next `turbo gen`.
 *
 * Three resolvable kinds, and no more: a script name in the package manifest, a declared
 * task in the task file, and a registered generator template. An Nx or Plop id is reported
 * `unsupported` — NEVER as resolved and never as missing, because discovering those needs a
 * binary this check deliberately does not run. Reporting a real id as missing would be the
 * worse error: it would push a correct playbook to `observed`.
 *
 * Usage:
 *   check_playbook_invokes [--root <dir>] [--home <dir>] [--quiet]
 *
 * Exit 0 = every `configured` playbook resolves (or there are none).
 * Exit 1 = at least one `configured` step names an id the tree does not have.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Playbooks are a context type (ADR-244), so the home is the contexts home. */
const DEFAULT_HOME = path.join('agents', 'settings', 'contexts');

export interface PlaybookHead {
    readonly file: string;
    readonly grade: string;
    readonly invokes: readonly string[];
}

export type Verdict = 'resolved' | 'missing' | 'unsupported';

export interface Check {
    readonly file: string;
    readonly id: string;
    readonly verdict: Verdict;
    /** Where it resolved, for a `resolved` verdict. */
    readonly where: string | null;
}

/** Ids this check cannot resolve without running a consumer binary. */
const UNSUPPORTED_PREFIXES = ['nx ', 'nx:', 'plop ', 'plop:'] as const;

const readJson = (p: string): Record<string, unknown> | null => {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
    } catch {
        return null;
    }
};

const asRecord = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Minimal frontmatter read — `grade` and the `invokes` list only.
 *
 * Deliberately not a YAML dependency: this file ships into a consumer repository, where
 * adding a parser dependency to run one gate is a cost the consumer did not ask for.
 */
export const parseHead = (file: string, text: string): PlaybookHead | null => {
    if (!text.startsWith('---')) return null;
    const end = text.indexOf('\n---', 3);
    if (end < 0) return null;
    const head = text.slice(3, end);
    const gradeMatch = /^grade:\s*["']?([A-Za-z]+)["']?\s*$/m.exec(head);
    if (!gradeMatch) return null;

    const invokes: string[] = [];
    const lines = head.split('\n');
    let inList = false;
    for (const line of lines) {
        if (/^invokes:\s*$/.test(line)) {
            inList = true;
            continue;
        }
        if (inList) {
            const item = /^\s+-\s*["']?(.+?)["']?\s*$/.exec(line);
            if (item?.[1] !== undefined) {
                invokes.push(item[1]);
                continue;
            }
            inList = false;
        }
        // An inline list is the other legal shape and a reader that only handled the block
        // form would report a correct playbook as having no ids at all.
        const inline = /^invokes:\s*\[(.*)\]\s*$/.exec(line);
        if (inline?.[1] !== undefined) {
            for (const part of inline[1].split(',')) {
                const v = part.trim().replace(/^["']|["']$/g, '');
                if (v.length > 0) invokes.push(v);
            }
        }
    }
    return { file, grade: gradeMatch[1] as string, invokes };
};

/** Generator templates registered in the tree, as `<runner> gen <name>` ids. */
export const registeredGenerators = (root: string): Map<string, string> => {
    const out = new Map<string, string>();
    const dir = path.join(root, 'turbo', 'generators');
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.set(entry.name, path.relative(root, full));
            continue;
        }
        const text = fs.readFileSync(full, 'utf8');
        for (const m of text.matchAll(/\.(?:set|add)Generator\(\s*['"]([A-Za-z0-9_-]+)['"]/g)) {
            out.set(m[1] as string, path.relative(root, full));
        }
    }
    return out;
};

export const resolveId = (
    root: string,
    id: string,
    gens: Map<string, string>,
): { verdict: Verdict; where: string | null } => {
    const lower = id.toLowerCase();
    if (UNSUPPORTED_PREFIXES.some((p) => lower.startsWith(p))) {
        return { verdict: 'unsupported', where: null };
    }

    const gen = /^\S+\s+gen\s+([A-Za-z0-9_-]+)/.exec(id);
    if (gen) {
        const name = gen[1] as string;
        return gens.has(name)
            ? { verdict: 'resolved', where: gens.get(name) ?? null }
            : { verdict: 'missing', where: null };
    }

    const tasks = asRecord(readJson(path.join(root, 'turbo.json'))?.tasks);
    if (Object.prototype.hasOwnProperty.call(tasks, id)) {
        return { verdict: 'resolved', where: 'turbo.json#tasks' };
    }
    const scripts = asRecord(readJson(path.join(root, 'package.json'))?.scripts);
    if (Object.prototype.hasOwnProperty.call(scripts, id)) {
        return { verdict: 'resolved', where: 'package.json#scripts' };
    }
    return { verdict: 'missing', where: null };
};

export const checkAll = (root: string, home: string): Check[] => {
    if (!fs.existsSync(home)) return [];
    const gens = registeredGenerators(root);
    const out: Check[] = [];
    for (const name of fs.readdirSync(home).sort()) {
        if (!name.endsWith('.md')) continue;
        const file = path.join(home, name);
        const head = parseHead(file, fs.readFileSync(file, 'utf8'));
        // Only `configured` is a claim about the tree. An `observed` playbook already says
        // its steps are unverified, so failing it here would punish the honest grade.
        if (head === null || head.grade !== 'configured') continue;
        for (const id of head.invokes) {
            const { verdict, where } = resolveId(root, id, gens);
            out.push({ file, id, verdict, where });
        }
    }
    return out;
};

/**
 * The remediation. BOTH options are printed verbatim on every failure, and neither is
 * "delete the line": a playbook that loses its evidence line stops being checkable, which
 * turns a caught drift into an uncatchable one.
 */
export const REMEDIATION = [
    'Two ways to fix this, and only two:',
    '  1. Fix the `invokes` id — the procedure moved, so point the playbook at where it moved to.',
    '  2. Downgrade the step to `observed` and cite the commit it was last seen working in.',
    'Do NOT delete the evidence line. A playbook without it is not a weaker claim, it is an',
    'unverifiable one — and the next drift goes unnoticed.',
].join('\n');

const main = (): number => {
    const argv = process.argv.slice(2);
    const arg = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i >= 0 && i + 1 < argv.length ? String(argv[i + 1]) : null;
    };
    const quiet = argv.includes('--quiet');
    const root = arg('--root') ?? '.';
    const home = arg('--home') ?? path.join(root, DEFAULT_HOME);

    const checks = checkAll(root, home);
    const missing = checks.filter((c) => c.verdict === 'missing');
    const unsupported = checks.filter((c) => c.verdict === 'unsupported');

    if (!quiet) {
        for (const u of unsupported) {
            process.stdout.write(
                `ℹ️  ${u.file}: \`${u.id}\` is unsupported by this check (its discovery needs a ` +
                    `consumer binary) — reported, not treated as missing\n`,
            );
        }
        process.stdout.write(
            `scanned: ${String(checks.length)} configured step(s) across ${String(new Set(checks.map((c) => c.file)).size)} playbook(s)\n`,
        );
    }

    if (missing.length === 0) {
        if (!quiet) {
            process.stdout.write('✅  check_playbook_invokes: every configured step resolves in the tree.\n');
        }
        return 0;
    }

    for (const m of missing) {
        process.stderr.write(
            `❌  ${m.file}: step invoking \`${m.id}\` does not resolve — no such script, task, or generator in the tree\n`,
        );
    }
    process.stderr.write(`\n${REMEDIATION}\n`);
    return 1;
};

if (process.argv[1] !== undefined && process.argv[1].includes('check_playbook_invokes')) {
    process.exit(main());
}
