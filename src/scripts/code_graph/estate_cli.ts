/**
 * `code-graph estate …` — questions about every registered project at once,
 * answered from the estate index alone (ADR-299, step 5.3). No project graph
 * is opened: an estate answer is as current as each project's last refresh,
 * and says when it was indexed.
 *
 *   estate where-used <package|symbol>      who declares, imports, publishes or references it
 *   estate projects-using <package>         projects that declare or import a package
 *   estate advisory-impact [--package P]    advisory packages × the projects that use them
 *
 * `--json` prints the answer as JSON.
 */
import { readState } from '../_lib/advisory_notice.js';
import { type EstateReader, openEstate } from './estate_index.js';

const NO_INDEX =
    'no estate index — switch it on with `code-graph projects index on`, then build or refresh each project once';

export interface WhereUsed {
    name: string;
    package_users: ReturnType<EstateReader['projectsUsing']>;
    publishers: ReturnType<EstateReader['publishers']>;
    declared_by: ReturnType<EstateReader['exporters']>;
    referenced_by: ReturnType<EstateReader['referrers']>;
}

export interface AdvisoryImpact {
    package: string;
    advisories: string[];
    projects: ReturnType<EstateReader['projectsUsing']>;
}

export function whereUsed(db: EstateReader, name: string): WhereUsed {
    return {
        name,
        package_users: db.projectsUsing(name),
        publishers: db.publishers(name),
        declared_by: db.exporters(name),
        referenced_by: db.referrers(name),
    };
}

/**
 * Advisory packages from each indexed project's own advisory cache (or the one
 * `--package` names), joined with the index. A project that imports the
 * package in code is the one an advisory reaches first; `imports` says so.
 */
export function advisoryImpact(db: EstateReader, only: string | null): AdvisoryImpact[] {
    const ids = new Map<string, Set<string>>();
    if (only !== null) ids.set(only, new Set());
    else {
        for (const p of db.projects()) {
            for (const f of readState(p.root)?.findings ?? []) {
                if (!ids.has(f.package)) ids.set(f.package, new Set());
                ids.get(f.package)?.add(f.id);
            }
        }
    }
    return [...ids.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([pkg, adv]) => ({ package: pkg, advisories: [...adv].sort(), projects: db.projectsUsing(pkg) }))
        .filter((r) => only !== null || r.projects.length > 0);
}

function flagValue(argv: string[], name: string): string | null {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

function line(p: { id: string; root: string }, extra = ''): string {
    return `  ${p.id}  ${p.root}${extra}\n`;
}

export function estateMain(argv: string[]): number {
    const [verb, ...rest] = argv;
    const json = rest.includes('--json');
    const positional = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--package');
    if (verb !== 'where-used' && verb !== 'projects-using' && verb !== 'advisory-impact') {
        process.stderr.write('usage: code-graph estate where-used <name>|projects-using <package>|advisory-impact [--package P] [--json]\n');
        return 2;
    }
    if (verb !== 'advisory-impact' && !positional[0]) {
        process.stderr.write(`usage: code-graph estate ${verb} <name> [--json]\n`);
        return 2;
    }
    const db = openEstate();
    if (!db) {
        process.stdout.write(`${NO_INDEX}\n`);
        return 1;
    }
    try {
        const name = positional[0] as string;
        if (verb === 'projects-using') {
            const rows = db.projectsUsing(name);
            if (json) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
            else {
                process.stdout.write(`projects using ${name} (${rows.length}):\n`);
                for (const r of rows) process.stdout.write(line(r, `${r.declared_in.length ? ` · declared in ${r.declared_in.join(', ')}` : ''}${r.imports ? ` · imported ${r.imports}×` : ''}`));
            }
            return 0;
        }
        if (verb === 'where-used') {
            const w = whereUsed(db, name);
            if (json) {
                process.stdout.write(`${JSON.stringify(w, null, 2)}\n`);
                return 0;
            }
            const section = (title: string, rows: Array<{ id: string; root: string }>): void => {
                if (!rows.length) return;
                process.stdout.write(`${title} (${rows.length}):\n`);
                for (const r of rows) process.stdout.write(line(r));
            };
            section(`declare or import package ${name}`, w.package_users);
            section(`publish package ${name}`, w.publishers);
            section(`declare a top-level symbol ${name}`, w.declared_by);
            section(`reference ${name} without resolving it (a guess)`, w.referenced_by);
            if (!w.package_users.length && !w.publishers.length && !w.declared_by.length && !w.referenced_by.length) {
                process.stdout.write(`no registered project uses ${name}\n`);
            }
            return 0;
        }
        const impact = advisoryImpact(db, flagValue(rest, '--package'));
        if (json) process.stdout.write(`${JSON.stringify(impact, null, 2)}\n`);
        else {
            if (!impact.length) process.stdout.write('no advisory package is used by a registered project\n');
            for (const r of impact) {
                process.stdout.write(`${r.package}${r.advisories.length ? ` — ${r.advisories.join(', ')}` : ''}:\n`);
                for (const p of r.projects) process.stdout.write(line(p, p.imports ? ` · imported ${p.imports}×` : ' · declared only'));
            }
        }
        return 0;
    } finally {
        db.close();
    }
}
