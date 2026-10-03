/**
 * Do the links inside an installed rule file resolve from where the install
 * puts it?
 *
 * A rule body is authored in `src/rules/` and projected to
 * `dist/agent-src/rules/`, where `](../guidelines/x.md)` resolves because the
 * sibling directory is right there. The installer then copies a SUBSET of
 * those sibling directories into the host's rule directory, so the same link
 * resolves or does not depending on a list in `install.ts` that the rule
 * author never sees. Nothing checked the two against each other.
 *
 * This module answers one question per link — resolved, or why not — against a
 * deploy plan rather than against a materialised tree, so the audit costs a
 * `statSync` per distinct target instead of a copy of 299 skills.
 *
 * Side-effect-free, no CLI entry, no `process.exit`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
/**
 * Build a plan from `GLOBAL_DEPLOY_SOURCES`-shaped pairs.
 *
 * The empty destination (`cline` maps rules to the root) is deliberately kept:
 * a rule installed at the root resolves `../x` differently, and silently
 * dropping the entry would make this module answer a question about a layout
 * that is not the one being installed.
 */
export function deployPlanFrom(pairs) {
    const plan = new Map();
    for (const [source, dest] of pairs)
        plan.set(dest, source);
    return plan;
}
/** Markdown inline links, minus the ones that are not a path into the tree. */
export function relativeLinkTargets(markdown) {
    const out = [];
    for (const m of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(target))
            continue; // http:, mailto:, etc.
        if (target.startsWith('#'))
            continue; // same-file anchor
        if (target.startsWith('/'))
            continue; // absolute — not ours to resolve
        out.push(target);
    }
    return out;
}
/** Strip a trailing `#anchor`; a bare directory link keeps its trailing slash. */
function withoutAnchor(target) {
    const hash = target.indexOf('#');
    return hash === -1 ? target : target.slice(0, hash);
}
/**
 * Audit one link written in a rule that the install places at
 * `<install-root>/<rulesDest>/<rule>.md`.
 */
export function auditLink(rule, target, rulesDest, plan, packageRoot) {
    const bare = withoutAnchor(target);
    // Resolve the link the way a reader does: from the installed file's own
    // DIRECTORY — `rulesDest` is that directory, not the file — as a POSIX
    // path relative to the install root. A sibling link (`[x](other.md)`, no
    // `../`) therefore stays inside the rules directory, which is where the
    // installer puts its sibling.
    const fromDir = rulesDest === '' ? '.' : rulesDest;
    const resolved = path.posix.normalize(path.posix.join(fromDir, bare));
    if (resolved.startsWith('..')) {
        return { rule, target, resolved_to: null, verdict: 'outside-install-root' };
    }
    const segments = resolved.split('/');
    // Which deployed directory does this land in? Normally the first segment
    // names it. When rules install at the install ROOT (`cline` maps them to
    // `''`), there is no such segment: a sibling link like `](scope-control.md)`
    // resolves to `scope-control.md`, whose first segment is a FILE NAME. Read
    // literally that is `directory-not-deployed` for a file the install writes
    // right beside the rule — 275 of cline's 523 links, every one of them fine.
    // The `''` key exists in the plan precisely for this and could never be
    // reached by a first-segment lookup.
    const rootSource = plan.get('');
    // The root entry answers for a BARE filename only. A link with a directory
    // segment the plan does not carry is `directory-not-deployed`, the same as
    // anywhere else — resolving it against the rules source would probe a path
    // the install never writes and report `file-missing`, whose documented
    // meaning ("the directory IS deployed") would then be false.
    const useRoot = rootSource !== undefined && segments.length === 1;
    const source = useRoot ? rootSource : plan.get(segments[0]);
    const rest = useRoot ? segments : segments.slice(1);
    if (source === undefined) {
        return { rule, target, resolved_to: resolved, verdict: 'directory-not-deployed' };
    }
    // An empty `rest` means the link points at the deployed directory itself.
    const onDisk = path.join(packageRoot, source, ...rest);
    const exists = fs.existsSync(onDisk);
    return {
        rule,
        target,
        resolved_to: resolved,
        verdict: exists ? 'resolved' : 'file-missing',
    };
}
const EMPTY_COUNTS = () => ({
    resolved: 0,
    'outside-install-root': 0,
    'directory-not-deployed': 0,
    'file-missing': 0,
});
/**
 * Audit every link in every rule the plan installs.
 *
 * `packageRoot` is the package checkout the installer copies FROM; the rule
 * bodies are read from the plan's own rules source, so the audit cannot drift
 * from what is shipped.
 */
export function auditInstalledRuleLinks(plan, packageRoot) {
    const audits = [];
    for (const [dest, source] of plan) {
        if (!source.endsWith('/rules'))
            continue;
        const dir = path.join(packageRoot, source);
        if (!fs.existsSync(dir))
            continue;
        const files = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => !e.isDirectory() && e.name.endsWith('.md'))
            .map((e) => e.name)
            .sort();
        for (const file of files) {
            const rule = file.replace(/\.md$/, '');
            const body = fs.readFileSync(path.join(dir, file), 'utf8');
            for (const target of relativeLinkTargets(body)) {
                audits.push(auditLink(rule, target, dest, plan, packageRoot));
            }
        }
    }
    const counts = EMPTY_COUNTS();
    for (const a of audits)
        counts[a.verdict] += 1;
    const grouped = new Map();
    for (const a of audits) {
        if (a.verdict === 'resolved')
            continue;
        const key = a.resolved_to === null ? a.target.replace(/[^/]*$/, '') : a.resolved_to.split('/')[0];
        const row = grouped.get(key);
        if (row)
            row.count += 1;
        else
            grouped.set(key, { count: 1, verdict: a.verdict });
    }
    const by_directory = [...grouped.entries()]
        .map(([directory, v]) => ({ directory, count: v.count, verdict: v.verdict }))
        .sort((a, b) => b.count - a.count || a.directory.localeCompare(b.directory));
    return { audits, counts, by_directory };
}
/**
 * Standing-text cost of the rewrite option, in characters.
 *
 * Option A of this roadmap's step 1.2: leave the install plan alone and
 * rewrite every link to an absolute package path. Each unresolved link then
 * grows by the absolute prefix minus the `../` it replaces — and it grows
 * INSIDE a rule body, which is the text the host loads as instructions.
 *
 * `prefixChars` is the installed package root's own length, which is a
 * property of the machine, so the caller supplies it and the report says which
 * value it used.
 */
export function rewriteOptionCost(report, prefixChars) {
    const unresolved = report.audits.filter((a) => a.verdict !== 'resolved');
    let total = 0;
    for (const a of unresolved) {
        // `../x` and `../../x` both become `<abs>/x`: the climb is replaced.
        const climb = (a.target.match(/\.\.\//g) ?? []).length * 3;
        total += prefixChars + 1 - climb;
    }
    return total;
}
//# sourceMappingURL=installedRuleLinks.js.map