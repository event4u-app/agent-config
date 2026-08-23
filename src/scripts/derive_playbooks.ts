/**
 * derive_playbooks — propose Playbook contexts (ADR-244) from a repository's own
 * configuration, and refuse to claim more than the tree shows.
 *
 * The `grade` field is the whole point. `configured` asserts that every step invokes
 * something PRESENT IN THE TREE AND SEEN, so this script may only write it when it has
 * actually resolved the invoked id to a file or a declared task. When it cannot, it
 * writes `observed` and says which id went unresolved — never `configured` with a
 * plausible-looking `invokes` list. That is the Class-A rule of `standards-from-config`
 * applied to procedure: the config IS the standard, and an unresolvable id is not config.
 *
 * Scope of the first release, decided in ADR-244 § What a playbook is and not re-litigated
 * here: THREE resolvable kinds — `package.json#scripts`, `turbo.json` tasks, and
 * `turbo gen` templates under `turbo/generators/`. Nx generators and Plop are deliberately
 * out: discovering them needs a consumer binary (`nx list`, `plop --help`), and the
 * Phase-3 staleness check must run without one. A repo carrying them is reported, so the
 * omission is visible to its maintainer rather than silent.
 *
 * Usage:
 *   derive_playbooks --root <repo>            # propose, print, write nothing
 *   derive_playbooks --root <repo> --write    # write into the playbook home
 *   derive_playbooks --root <repo> --home <d> # override the home
 *   derive_playbooks --self-test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The playbook home. ADR-244 decided a playbook IS a context type, so this is the
 * contexts home rather than a new directory — the path is not a fresh decision, and the
 * `--home` flag exists because the ADR calls placement the part of the decision least
 * likely to survive contact with a consumer.
 */
export const DEFAULT_HOME = path.join('agents', 'settings', 'contexts');

export type Grade = 'configured' | 'observed';

export interface PlaybookStep {
    readonly title: string;
    /** The id this step invokes — a script name, a turbo task, or `turbo gen <t>`. */
    readonly invokes: string;
    /** Where the id was RESOLVED, or null when it could not be. */
    readonly source_of_truth: string | null;
    readonly verify: string;
}

export interface Playbook {
    readonly slug: string;
    readonly task: string;
    readonly scope: string;
    readonly grade: Grade;
    readonly steps: readonly PlaybookStep[];
    /** Ids that could not be resolved. Non-empty forces `observed`. */
    readonly unresolved: readonly string[];
}

export interface DeriveReport {
    readonly playbooks: readonly Playbook[];
    /** Kinds seen in the tree that this release cannot resolve — reported, never guessed. */
    readonly out_of_scope: readonly string[];
}

const readJson = (p: string): Record<string, unknown> | null => {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
    } catch {
        return null;
    }
};

const asRecord = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Turbo generator templates present in the tree, as `turbo gen <name>` ids. */
export const discoverTurboGenerators = (root: string): Map<string, string> => {
    const out = new Map<string, string>();
    const dir = path.join(root, 'turbo', 'generators');
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.set(`turbo gen ${entry.name}`, path.relative(root, full));
            continue;
        }
        // A config file declares generators BY NAME, so read the names it registers
        // rather than assuming the filename is the generator id. `@turbo/gen` wraps Plop
        // and the registering call is `plop.setGenerator('component', …)`; `addGenerator`
        // is accepted too because Plop's own API carries both spellings and a config
        // written against either must resolve.
        const text = fs.readFileSync(full, 'utf8');
        for (const m of text.matchAll(/\.(?:set|add)Generator\(\s*['"]([A-Za-z0-9_-]+)['"]/g)) {
            out.set(`turbo gen ${m[1]}`, `${path.relative(root, full)} (setGenerator)`);
        }
    }
    return out;
};

/** Every workspace directory that carries its own `package.json`. */
export const discoverWorkspaces = (root: string): string[] => {
    const pkg = readJson(path.join(root, 'package.json'));
    const globs = Array.isArray(pkg?.workspaces) ? (pkg.workspaces as string[]) : [];
    const found: string[] = [];
    for (const g of globs) {
        if (!g.endsWith('/*')) continue;
        const base = path.join(root, g.slice(0, -2));
        if (!fs.existsSync(base)) continue;
        for (const e of fs.readdirSync(base, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const rel = path.join(g.slice(0, -2), e.name);
            if (fs.existsSync(path.join(root, rel, 'package.json'))) found.push(rel);
        }
    }
    return found.sort();
};

/**
 * Resolve one invoked id against the tree. Returns the place it was SEEN, or null.
 * Null is what forces `observed`, so this function is the honesty gate of the script.
 */
export const resolveInvoked = (
    root: string,
    id: string,
    generators: Map<string, string>,
): string | null => {
    if (generators.has(id)) return generators.get(id) ?? null;

    const turbo = readJson(path.join(root, 'turbo.json'));
    if (turbo && Object.prototype.hasOwnProperty.call(asRecord(turbo.tasks), id)) {
        return 'turbo.json#tasks';
    }
    const pkg = readJson(path.join(root, 'package.json'));
    if (pkg && Object.prototype.hasOwnProperty.call(asRecord(pkg.scripts), id)) {
        return 'package.json#scripts';
    }
    return null;
};

/** Kinds this release does not resolve, reported so the gap is visible. */
export const detectOutOfScope = (root: string): string[] => {
    const out: string[] = [];
    if (fs.existsSync(path.join(root, 'nx.json'))) out.push('nx generators (needs `nx list`)');
    for (const n of ['plopfile.js', 'plopfile.mjs', 'plopfile.ts', 'plopfile.cjs']) {
        if (fs.existsSync(path.join(root, n))) {
            out.push('plop generators (needs `plop --help`)');
            break;
        }
    }
    return out;
};

const scriptBody = (root: string, name: string): string =>
    String(asRecord(readJson(path.join(root, 'package.json'))?.scripts)[name] ?? '');

/**
 * A script whose body is a thin wrapper (`turbo gen component`) is a POINTER at the real
 * procedure, so the playbook must invoke what it points at — otherwise a renamed
 * generator leaves the playbook green while the procedure is broken, which is exactly the
 * drift Phase 3 gates.
 */
export const unwrapScript = (body: string): string | null => {
    const m = /^\s*turbo\s+gen\s+([A-Za-z0-9_-]+)/.exec(body);
    return m ? `turbo gen ${m[1]}` : null;
};

export const derive = (root: string): DeriveReport => {
    const generators = discoverTurboGenerators(root);
    const workspaces = discoverWorkspaces(root);
    const pkg = readJson(path.join(root, 'package.json'));
    const scripts = asRecord(pkg?.scripts);
    const playbooks: Playbook[] = [];

    for (const name of Object.keys(scripts).sort()) {
        // Only creation-shaped scripts become playbooks. `build` and `test` are one
        // command each — a playbook for them would be a rename of the script, not a
        // procedure, and the estate does not need one file per npm script.
        const noun = /^(?:new|gen|generate|create|scaffold|add)[:-]?(.*)$/.exec(name);
        if (!noun) continue;

        const wrapped = unwrapScript(scriptBody(root, name));
        const invoked = wrapped ?? name;
        const where = resolveInvoked(root, invoked, generators);
        const subject = (noun[1] || 'artefact').replace(/[^A-Za-z0-9]+/g, '-');

        // `scope` prefers a real workspace whose name matches the subject, so a component
        // playbook lands on packages/ui rather than claiming the whole repo.
        const ws = workspaces.find((w) => path.basename(w) === subject) ?? null;
        const scope =
            ws ??
            workspaces.find((w) => subject === 'component' && path.basename(w) === 'ui') ??
            'repo';

        const step: PlaybookStep = {
            title: `Run the repository's own generator`,
            invokes: invoked,
            source_of_truth: where,
            verify: where
                ? `the generator's output appears under \`${scope}\` and the package builds`
                : `UNRESOLVED — confirm \`${invoked}\` exists before trusting this step`,
        };

        // The slug carries the workspace when the playbook is workspace-scoped. Two
        // workspaces may each own a `component` procedure with different conventions, and
        // one file per subject would silently collapse them into whichever ran last.
        const noun_slug = subject === 'artefact' ? name.replace(/[^a-z0-9]+/gi, '-') : subject;
        const slug = scope === 'repo' ? `add-${noun_slug}` : `add-${path.basename(scope)}-${noun_slug}`;

        playbooks.push({
            slug,
            task: `Add a new ${subject.replace(/-/g, ' ')} to this repository`,
            scope,
            grade: where ? 'configured' : 'observed',
            steps: [step],
            unresolved: where ? [] : [invoked],
        });
    }

    return { playbooks, out_of_scope: detectOutOfScope(root) };
};

export const renderPlaybook = (p: Playbook): string => {
    const lines: string[] = [
        '---',
        `task: "${p.task}"`,
        `scope: "${p.scope}"`,
        `grade: "${p.grade}"`,
        'invokes:',
        ...p.steps.map((s) => `  - "${s.invokes}"`),
        '---',
        '',
        `# Playbook: ${p.task}`,
        '',
        '> **This is THIS repository\'s answer, and it outranks a shipped skill.** A shipped',
        '> skill is a generic answer to a generic question; this file encodes decisions this',
        '> repository already made.',
        '',
        `Grade \`${p.grade}\` — ${
            p.grade === 'configured'
                ? 'every step below invokes something seen in the tree, cited per step.'
                : 'at least one invoked id could NOT be resolved in the tree, so the steps are a hypothesis to confirm, not a procedure to trust.'
        }`,
        '',
        '## Steps',
        '',
    ];
    p.steps.forEach((s, i) => {
        lines.push(
            `${i + 1}. **${s.title}** — \`${s.invokes}\``,
            `   - **Source of truth:** ${s.source_of_truth ?? '**unresolved** — nothing in the tree declares this id'}`,
            `   - **Verify:** ${s.verify}`,
            '',
        );
    });
    if (p.unresolved.length > 0) {
        lines.push(
            '## Why this is not `configured`',
            '',
            `Unresolved: ${p.unresolved.map((u) => `\`${u}\``).join(', ')}. A \`configured\``,
            'grade asserts every step was seen in the tree; this one was not, and downgrading is',
            'the honest outcome rather than writing the stronger claim and hoping.',
            '',
        );
    }
    return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Restatement detection — for the per-workspace AGENTS.md contract (1.3).
//
// A `packages/<n>/AGENTS.md` is allowed and its primary content is a POINTER LIST to the
// playbooks scoped to that workspace. The failure it must not become is a second copy of
// the steps: two files then disagree the first time one is edited, and a reader has no way
// to tell which one the repository actually follows. So the detector below looks for a
// playbook step's own text appearing verbatim in a workspace file, and deliberately does
// NOT flag a pointer AT the playbook — naming the file is the behaviour the contract wants.
// ---------------------------------------------------------------------------

export interface Restatement {
    readonly file: string;
    readonly playbook: string;
    /** The step text found verbatim in `file`. */
    readonly step: string;
}

/** Normalise for comparison: collapse whitespace, drop markdown emphasis and list markers. */
const normalise = (line: string): string =>
    line
        .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
        .replace(/[*_`>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

/** A line that merely POINTS at a playbook — a link, or a path mention. Never a restatement. */
export const isPointerLine = (line: string): boolean =>
    /\[[^\]]+\]\([^)]*\.md[^)]*\)/.test(line) || /`[^`]*\.md`/.test(line);

/**
 * Steps of a playbook that a workspace file restates verbatim.
 *
 * The needle is the step's **invoked id**, not its title. Titles are generic by
 * construction — every generator step in this repository's own fixture is called "Run the
 * repository's own generator" — so a title match reports the same prose line once per
 * playbook and tells the reader nothing about WHICH procedure was duplicated. The id is
 * what makes a line actionable, and duplicating the actionable half is the failure.
 *
 * Short lines are skipped: a three-word step and a three-word sentence collide by accident,
 * and a detector that fires on coincidence teaches its readers to ignore it.
 */
export const findRestatedSteps = (
    playbooks: readonly { readonly slug: string; readonly steps: readonly PlaybookStep[] }[],
    file: string,
    text: string,
    minChars = 12,
): Restatement[] => {
    const lines = text.split('\n');
    const found: Restatement[] = [];
    for (const p of playbooks) {
        for (const st of p.steps) {
            const needle = normalise(st.invokes);
            if (needle.length < minChars) continue;
            for (const line of lines) {
                if (isPointerLine(line)) continue;
                if (normalise(line).includes(needle)) {
                    found.push({ file, playbook: p.slug, step: st.title });
                    break;
                }
            }
        }
    }
    return found;
};

const selfTest = (): number => {
    let failed = 0;
    const check = (name: string, cond: boolean): void => {
        if (!cond) {
            console.error(`❌  ${name}`);
            failed += 1;
        }
    };

    check('a thin wrapper unwraps to the generator it points at', unwrapScript('turbo gen component') === 'turbo gen component');
    check('an unrelated script body does not unwrap', unwrapScript('vite build') === null);
    check('a wrapper with flags still unwraps', unwrapScript('turbo gen workspace --type package') === 'turbo gen workspace');

    check(
        'a pointer at a playbook is not a restatement',
        isPointerLine('- See [add a component](../../agents/settings/contexts/add-ui-component.md)'),
    );
    check('a prose line is not a pointer', !isPointerLine('Run the repository own generator first'));

    const fixture = path.join('tests', 'fixtures', 'playbooks', 'mono-with-generator');
    if (fs.existsSync(fixture)) {
        const r = derive(fixture);
        const comp = r.playbooks.find((p) => p.slug === 'add-ui-component');
        check('the fixture yields a component playbook', comp !== undefined);
        check('it is graded configured', comp?.grade === 'configured');
        check('it invokes the generator, not the wrapper script', comp?.steps[0]?.invokes === 'turbo gen component');
        check('its scope is the workspace, not the repo', comp?.scope === path.join('packages', 'ui'));
        check('build and test produced no playbook', !r.playbooks.some((p) => /build|test/.test(p.slug)));
    }

    process.stdout.write(
        failed === 0
            ? '✅  derive_playbooks: self-test passed\n'
            : `❌  derive_playbooks: ${failed} failure(s)\n`,
    );
    return failed === 0 ? 0 : 1;
};

const main = (): number => {
    const argv = process.argv.slice(2);
    if (argv.includes('--self-test')) return selfTest();

    const arg = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i >= 0 && i + 1 < argv.length ? String(argv[i + 1]) : null;
    };
    const root = arg('--root') ?? '.';
    const home = arg('--home') ?? path.join(root, DEFAULT_HOME);
    const write = argv.includes('--write');

    const report = derive(root);
    if (report.playbooks.length === 0) {
        process.stdout.write('derive_playbooks: no creation-shaped procedure found — nothing proposed.\n');
    }
    for (const p of report.playbooks) {
        const target = path.join(home, `${p.slug}.md`);
        process.stdout.write(
            `${p.grade === 'configured' ? '✅' : '⚠️ '} ${target}  grade=${p.grade}  invokes=[${p.steps.map((s) => s.invokes).join(', ')}]\n`,
        );
        if (!write) continue;
        fs.mkdirSync(home, { recursive: true });
        fs.writeFileSync(target, renderPlaybook(p), 'utf8');
    }
    for (const o of report.out_of_scope) {
        process.stdout.write(`ℹ️  out of scope for this release: ${o} — reported, not guessed at (ADR-244)\n`);
    }
    process.stdout.write(`scanned: ${report.playbooks.length}\n`);
    return 0;
};

if (process.argv[1] && /derive_playbooks/.test(process.argv[1])) {
    process.exit(main());
}
