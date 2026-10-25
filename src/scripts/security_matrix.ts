/**
 * The two-account matrix: every API route the code graph knows, crossed with
 * {anonymous, user A (owner), user B (not owner)}, each with the outcome a
 * correctly guarded route returns. Deterministic, no model call — it finds the
 * class of hole a second test account finds, and the rows seed the proof tests
 * `security-audit` § 6 asks the verifier to write.
 *
 *   ./scripts-run src/scripts/security_matrix --root <repo> [--skeleton]
 */
import path from 'node:path';

import { buildFromRepo } from './code_graph/build.js';
import type { CodeGraph } from './code_graph/types.js';

export interface MatrixCase {
    as: 'anonymous' | 'user-a' | 'user-b';
    expect: string;
}

export interface MatrixRow {
    route: string;
    verb: string;
    path: string;
    handler: string;
    provider: string;
    owned: boolean;
    cases: MatrixCase[];
}

export interface Matrix {
    rows: MatrixRow[];
    /** Routes deliberately left out (pages), with the reason, so nothing is silently absent. */
    skipped: { route: string; reason: string }[];
}

// `ROUTE` is what several providers emit for an API module whose method set is
// not declared (pages/api, a bare route.ts, a nuxt server route).
const VERBS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY', 'ROUTE']);
const SKIP_REASON: Record<string, string> = {
    OPTIONS: 'preflight/metadata verb — no resource is returned',
    HEAD: 'preflight/metadata verb — no resource is returned',
    WS: 'websocket — the request/response matrix does not apply; audit by hand',
};
const PARAM = /\{[^}]+\}|\[[^\]]+\]|(?:^|\/):[A-Za-z_]|<[^>]+>|\(\?P</;

export function buildMatrix(graph: CodeGraph): Matrix {
    const rows: MatrixRow[] = [];
    const skipped: Matrix['skipped'] = [];
    for (const node of graph.nodes) {
        if (node.kind !== 'route') continue;
        const [verb = '', routePath = ''] = node.label.split(' ', 2);
        if (!VERBS.has(verb)) {
            skipped.push({ route: node.label, reason: SKIP_REASON[verb] ?? 'not an API verb (page or view route)' });
            continue;
        }
        const edge = graph.edges.find((e) => e.source === node.id && e.relation === 'routes-to');
        const owned = PARAM.test(routePath);
        rows.push({
            route: node.label,
            verb,
            path: routePath,
            handler: edge?.target ?? '',
            provider: edge?.provider_id ?? '',
            owned,
            cases: [
                { as: 'anonymous', expect: '401' },
                { as: 'user-a', expect: '2xx' },
                { as: 'user-b', expect: owned ? '403|404' : '2xx, none of user A\'s records' },
            ],
        });
    }
    rows.sort((a, b) => a.route.localeCompare(b.route));
    return { rows, skipped };
}

/** A draft test per row for the verifier — it fails until the route's resource is bound to user A. */
const PHP_PROVIDERS = new Set(['laravel']);
const phpQuote = (v: string): string => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function renderSkeleton(matrix: Matrix): string {
    const out: string[] = [];
    for (const r of matrix.rows) {
        const php = PHP_PROVIDERS.has(r.provider);
        const name = `${r.route}: user B must not read user A's resource`;
        if (php) {
            out.push(
                `it(${phpQuote(name)}, function () {`,
                `    throw new RuntimeException(${phpQuote(`bind ${r.path} to a resource owned by user A, then assert the matrix: anonymous 401, user A 2xx, user B ${r.cases[2]?.expect}`)});`,
                '});',
                '',
            );
        } else {
            out.push(
                `it(${JSON.stringify(name)}, async () => {`,
                `    throw new Error(${JSON.stringify(`bind ${r.path} to a resource owned by user A, then assert the matrix: anonymous 401, user A 2xx, user B ${r.cases[2]?.expect}`)});`,
                '});',
                '',
            );
        }
    }
    return out.join('\n');
}

export async function matrixForRepo(root: string): Promise<Matrix> {
    const { graph } = await buildFromRepo(path.resolve(root), null);
    return buildMatrix(graph);
}

export async function main(argv: readonly string[]): Promise<number> {
    const i = argv.indexOf('--root');
    const root = i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : (process.env['AGENT_CONFIG_PROJECT_ROOT'] ?? process.cwd());
    const matrix = await matrixForRepo(root);
    if (matrix.rows.length === 0) {
        process.stderr.write('security_matrix: no API routes in the code graph — nothing to cross; say "not enumerated", never "no holes".\n');
    }
    process.stdout.write(argv.includes('--skeleton') ? renderSkeleton(matrix) : `${JSON.stringify(matrix, null, 2)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
