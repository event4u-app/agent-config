/**
 * `agent-config code-graph --help` — every verb with one line on what it
 * answers. Kept out of `cli.ts`, which sits at the source-size ceiling.
 *
 * The verb list is the dispatch list in `cli.ts::main`; a verb added there and
 * not here fails `tests/cli/help_honesty.test.ts` only for the verbs it names,
 * so keep the two in step by hand.
 */

const ROWS: ReadonlyArray<readonly [string, string]> = [
    ['Build and keep fresh', ''],
    ['build', 'Index the project into the local code graph'],
    ['refresh', 'Rebuild in the background within a time budget; --touched re-reads changed files'],
    ['detect', 'Is there a graph, and is it fresh, stale or absent (--format json)'],
    ['validate', 'Check the graph file and summarise how its edges were resolved'],
    ['lint', 'Report malformed nodes and edges, one line per problem'],
    ['auto-refresh', 'Turn background refresh for this project on, off, or show status'],
    ['rebuild-diff', 'Compare an incremental build with a cold one'],
    ['Ask', ''],
    ['ask', 'One question in words: the symbols and files it names, callers, tests'],
    ['query', 'Symbols matching a name, kind or relation filter'],
    ['explain', 'The two-hop neighbourhood of one symbol'],
    ['affected', 'What reaches a symbol, or the files changed since a rev'],
    ['path', 'The shortest path between two symbols'],
    ['suggest-verb', 'Which verb best answers a free-text question'],
    ['scope', 'Which scope each path is in, and the rule that decided'],
    ['Before a change', ''],
    ['impact', 'Callers, dependents and test files a diff can break (--diff <rev>)'],
    ['review-risk', 'A diff as a sum of risk terms, each with its witness'],
    ['tests-for', 'The test files that exercise a symbol'],
    ['untested', 'Changed symbols no test imports (--diff <rev>)'],
    ['dead', 'Symbols nothing reaches, refused where the graph cannot tell'],
    ['confirm', 'Whether the evidence behind an answer still holds in the working tree'],
    ['pack', 'A verified context pack for a task within a token budget'],
    ['verify', 'verify --all: how many facts per lane still check out (--min-rate R)'],
    ['Packages and history', ''],
    ['why', 'Every path from a declaration to a package, from the lockfiles'],
    ['usage', "Which of a package's exports the project uses"],
    ['remove-plan', 'What removing a package would touch'],
    ['provenance', 'Since when something exists, and for which commit, PR and ticket'],
    ['branches', 'Index, pin, list or clean up the per-branch fact store'],
    ['branch-diff', 'Facts that differ between two branches'],
    ['on-branches', 'Where a package, column, symbol or file appears across indexed branches'],
    ['Map', ''],
    ['map', 'Draw the project map into agents/map/ (--open to view it)'],
    ['open', 'Open the map that is already drawn'],
    ['outcome', 'Record locally that a file was useful or a dead end'],
    ['Across projects', ''],
    ['projects', 'The projects this machine works in: list, add, remove, prune'],
    ['estate', 'Questions across every registered project (where-used, projects-using, …)'],
    ['lineage', 'Where harvested mechanisms came from, and what is still missing'],
    ['bugs', 'Local bug facts: import a snapshot, measure fix commits'],
    ['scan', 'Sweep for known risky patterns; one file:line:rule per hit'],
    ['prove', 'The evidence bundle behind each benchmark claim, from a scorecard (--scorecard, --out)'],
];

function render(): string {
    const lines = [
        'Usage: agent-config code-graph <verb> [options]',
        '',
        'A local, rebuildable index of the codebase: who calls what, what a change',
        'touches, which tests cover it. Most verbs take --root <path> and --json.',
    ];
    for (const [name, text] of ROWS) {
        if (text === '') {
            lines.push('', `${name}:`);
            continue;
        }
        lines.push(`  ${name.padEnd(14)} ${text}`);
    }
    lines.push('');
    return lines.join('\n');
}

export const CODE_GRAPH_HELP = render();
