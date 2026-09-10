/**
 * autonomy_friction_traffic — what share of REAL Bash traffic this package
 * can spare a host confirmation, and what the rest is shaped like.
 *
 * WHY A SECOND FRICTION INSTRUMENT. `autonomy_friction_corpus` measures seven
 * declared payload classes through the real dispatcher: it answers "does the
 * classifier behave as designed" and it answers it exactly. What it cannot
 * answer is "how much of what the agent actually types does the design
 * cover", because a hand-written corpus contains the shapes its author
 * thought of. That number turned out to be the one that mattered: measured
 * over 7,569 distinct real Bash calls in 39 transcripts on 2026-09-10,
 * category A covered 126 of them — 1.7 %.
 *
 * WHAT IT MEASURES, STATED NARROWLY. Three things, over a transcript store:
 * the share of Bash calls that are category A (the calls this package hands
 * the host an explicit `permissionDecision: allow` for); which disqualifier
 * each remaining call hits FIRST; and how many carry one of the two shapes
 * the chain-nudge concern flags. It is NOT a measurement of confirmations the
 * operator saw. The host's own permission documentation records that
 * `permissions.allow` does not bypass the auto-mode classifier, so a consumer
 * whose settings already allow a call may see no prompt for a call counted
 * here as uncovered, and a call inside category A may still be classified by
 * the host. Reading this as host behaviour is the
 * fact-about-our-plumbing-written-as-a-fact-about-the-host collapse the hook
 * contract warns about three times.
 *
 * NOT A GATE. It has no baseline and fails nothing. A gate over this number
 * would ratchet a figure that moves with how the operator happened to work
 * that week, which is a measurement of the week and not of the tree. Exit 1
 * means the store was unreadable or empty — a probe that reports zeros from
 * an absent store is worse than one that refuses.
 *
 * SHARED DETECTORS, NOT A SECOND COPY. The avoidable-shape counts come from
 * the concern's own exported `detectEditByShell` / `detectChaining`, and the
 * metacharacter class is `category_a`'s own exported constant, so a change to
 * either moves this report and the live carrier together. A private copy here
 * would let the two drift and the report would then describe a carrier that
 * does not exist — the first draft held exactly such a copy, and it computed
 * the split the whole report turns on.
 *
 * WHAT MAKES A FIGURE FROM THIS PROBE COMPARABLE. Two properties, both of
 * which the first draft lacked. Calls are deduplicated by tool-use id, because
 * a resumed session rewrites its earlier turns into a new transcript and a
 * window of files therefore counts them twice. And the running session's own
 * transcript is excluded by default, because every call the probe itself makes
 * lands in a file it is about to read — two runs minutes apart reported 7,518
 * and 7,653 for the same tree before that. What remains uncontrolled is the
 * window: `--limit 40` names the 40 most recent transcripts, and which files
 * those are moves as new sessions appear. So pin the DATE with the figure and
 * read a later run as measuring the window as well as the tree.
 *
 * Usage:
 *   ./scripts-run src/scripts/autonomy_friction_traffic [--store DIR] [--limit N] [--json]
 *   … [--include-current]   include the running session's own transcript
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { detectChaining, detectEditByShell } from "./hooks/chain_nudge_hook.js";
import {
    isCategoryABashCommand,
    namesConsequenceOperation,
    SHELL_METACHARACTERS,
} from "./hooks/category_a.js";

// Re-exported so a test can assert this module refuses on the CLASSIFIER's
// metacharacter set rather than on a copy of it. The first draft held a private
// regex literal here while the header claimed shared detectors, and that copy
// computed the split the whole report turns on.
export { SHELL_METACHARACTERS };

/** How many transcripts to read when `--limit` is absent. */
const DEFAULT_LIMIT = 40;

/** One measured report. */
export interface TrafficReport {
    store: string;
    transcripts: number;
    calls: number;
    categoryA: number;
    /** First disqualifier for each non-category-A call. */
    disqualifiers: Record<string, number>;
    /** Head token → count, for non-category-A calls only. */
    heads: Record<string, number>;
    /** The chain-nudge shape classes, counted over every call. */
    shapes: { editByShell: number; chain: number };
    /** Which write shapes, in the concern's own words. */
    editShapes: Record<string, number>;
}

/** One Bash call, with the tool-use id that identifies it across files. */
export interface BashCall {
    /** The host's `tool_use` id, or `""` when the record carries none. */
    id: string;
    command: string;
}

/**
 * Every Bash call in one transcript's text.
 *
 * Line-delimited JSON, one record per line, so a malformed line is skipped
 * rather than costing the file. The `"Bash"` pre-filter is a cheap reject: a
 * transcript is megabytes and most lines carry no tool call at all.
 *
 * The id comes out with the command because a resumed session writes a new
 * transcript carrying the earlier turns again — counting a window of files
 * therefore counts some calls twice, and the id is what tells the copies apart
 * from two genuinely identical commands.
 */
export function extractCommands(text: string): BashCall[] {
    const out: BashCall[] = [];
    for (const line of text.split("\n")) {
        if (!line.includes('"Bash"')) continue;
        let rec: unknown;
        try {
            rec = JSON.parse(line) as unknown;
        } catch {
            continue;
        }
        const content = (rec as { message?: { content?: unknown } })?.message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
            const b = block as { type?: unknown; name?: unknown; id?: unknown; input?: { command?: unknown } };
            if (b?.type !== "tool_use" || b?.name !== "Bash") continue;
            if (typeof b.input?.command !== "string") continue;
            out.push({ id: typeof b.id === "string" ? b.id : "", command: b.input.command });
        }
    }
    return out;
}

/**
 * The distinct calls in `calls`, keyed by tool-use id.
 *
 * A call with no id cannot be deduplicated and is kept — dropping it would
 * silently shrink the denominator, and an over-count biases the report toward
 * looking worse than it is, which is the safe direction for a friction figure.
 */
export function dedupeCalls(calls: readonly BashCall[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const call of calls) {
        if (call.id) {
            if (seen.has(call.id)) continue;
            seen.add(call.id);
        }
        out.push(call.command);
    }
    return out;
}

/**
 * The transcript of the session running this probe, if the host names one.
 *
 * Excluded by default. A probe whose window includes its own session measures
 * the measurement: every call this run makes lands in the file it is reading,
 * so two runs minutes apart report different totals for the same tree and the
 * figure cannot be pinned. `--include-current` opts back in.
 */
export function currentSessionTranscript(store: string): string | null {
    const id = process.env["CLAUDE_CODE_SESSION_ID"];
    return id ? path.join(store, `${id}.jsonl`) : null;
}

/** The head token of a command, lower-cased, or `""`. */
export function headToken(command: string): string {
    return (command.trim().split(/\s+/)[0] ?? "").toLowerCase();
}

/**
 * Why this call is not category A, in one word.
 *
 * Only the FIRST disqualifier is reported, because that is the one a change
 * would have to remove: a chained command whose head is also unlisted stays
 * uncovered if only the head is added.
 *
 * The buckets mirror `category_a`'s own order of refusal, including the
 * consequence-word check — without it `git push origin main` and `gh pr merge`
 * landed in the head bucket, and a report saying "N fail on the head token"
 * then counted operations that would be refused whatever the head list said.
 *
 * The last bucket is still an UPPER BOUND rather than an exact head count: a
 * simple command can also be refused for a directory flag whose value escapes
 * the working tree, and that case is not separable from here without
 * reimplementing the argv walk. Read it as "refused after the shape and the
 * operation were cleared", and never as "adding this head would cover it".
 */
export function firstDisqualifier(command: string): string {
    if (!command.trim()) return "empty-command";
    if (SHELL_METACHARACTERS.test(command)) return "shell-metacharacter";
    if (namesConsequenceOperation(command)) return "names-a-consequence-operation";
    return "not-an-allowlisted-operation";
}

/** Classify a command set. Pure — the caller supplies the strings. */
export function classify(store: string, transcripts: number, commands: readonly string[]): TrafficReport {
    const report: TrafficReport = {
        store,
        transcripts,
        calls: commands.length,
        categoryA: 0,
        disqualifiers: {},
        heads: {},
        shapes: { editByShell: 0, chain: 0 },
        editShapes: {},
    };
    for (const command of commands) {
        const write = detectEditByShell(command);
        if (write) {
            report.shapes.editByShell += 1;
            report.editShapes[write] = (report.editShapes[write] ?? 0) + 1;
        } else if (detectChaining(command)) {
            report.shapes.chain += 1;
        }
        if (isCategoryABashCommand(command)) {
            report.categoryA += 1;
            continue;
        }
        const why = firstDisqualifier(command);
        report.disqualifiers[why] = (report.disqualifiers[why] ?? 0) + 1;
        const head = headToken(command);
        report.heads[head] = (report.heads[head] ?? 0) + 1;
    }
    return report;
}

/** The default transcript store for the checkout this file lives in. */
export function defaultStore(repoRoot: string): string {
    const slug = repoRoot.replace(/\//g, "-");
    return path.join(os.homedir(), ".claude", "projects", slug);
}

/** The `--limit` most recently modified transcripts in `store`. */
export function transcriptPaths(store: string, limit: number): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(store);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.endsWith(".jsonl"))
        .map((n) => path.join(store, n))
        .map((p) => {
            try {
                return { p, m: fs.statSync(p).mtimeMs };
            } catch {
                return { p, m: 0 };
            }
        })
        .sort((a, b) => b.m - a.m)
        .slice(0, limit)
        .map((x) => x.p);
}

/** Top `n` entries of a histogram, descending. */
function top(hist: Record<string, number>, n: number): Array<[string, number]> {
    return Object.entries(hist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
}

function pct(part: number, whole: number): string {
    return whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(1)} %`;
}

export function render(r: TrafficReport): string {
    const lines: string[] = [];
    lines.push("autonomy_friction_traffic — category-A coverage over real Bash traffic\n");
    lines.push(`  store        ${r.store}`);
    lines.push(`  transcripts  ${r.transcripts}`);
    lines.push(`  Bash calls   ${r.calls}\n`);
    lines.push(`  category A (this package hands the host an allow)  ${r.categoryA}  (${pct(r.categoryA, r.calls)})`);
    lines.push(`  no allow emitted                                   ${r.calls - r.categoryA}  (${pct(r.calls - r.categoryA, r.calls)})\n`);
    lines.push("  first disqualifier:");
    for (const [k, v] of top(r.disqualifiers, 10)) lines.push(`    ${String(v).padStart(6)}  ${k}`);
    lines.push("\n  top head tokens among the uncovered:");
    for (const [k, v] of top(r.heads, 15)) lines.push(`    ${String(v).padStart(6)}  ${k}`);
    lines.push("\n  chain-nudge shape classes (counted over every call):");
    lines.push(`    ${String(r.shapes.editByShell).padStart(6)}  edit-by-shell  (${pct(r.shapes.editByShell, r.calls)})`);
    lines.push(`    ${String(r.shapes.chain).padStart(6)}  chain          (${pct(r.shapes.chain, r.calls)})`);
    for (const [k, v] of top(r.editShapes, 6)) lines.push(`      ${String(v).padStart(4)}  ${k}`);
    lines.push("\n  Not a gate: no baseline, fails nothing. See this file's header for what");
    lines.push("  the number does and does not say about what the operator was prompted for.\n");
    return `${lines.join("\n")}\n`;
}

/**
 * The value of `flag`, `undefined` when the flag is absent, `null` when it is
 * present with no value.
 *
 * The three states are distinct because the caller must refuse the third. A
 * valueless `--store` used to collapse into "absent" and fall back to the
 * default store silently, which is the same class of defect as the `--limit`
 * coercion beside it: an argument that silently changes the window.
 */
function argValue(argv: readonly string[], flag: string): string | null | undefined {
    const i = argv.indexOf(flag);
    if (i === -1) return undefined;
    const value = argv[i + 1];
    return value === undefined || value.startsWith("--") ? null : value;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes("--help") || argv.includes("-h")) {
        process.stdout.write(
            "usage: autonomy_friction_traffic [--store DIR] [--limit N] [--json] [--include-current]\n" +
                "  Category-A coverage over the Bash calls in a transcript store,\n" +
                "  plus the shape classes the chain-nudge concern flags. Calls are\n" +
                "  deduplicated by tool-use id and the running session's own\n" +
                "  transcript is excluded unless --include-current is passed.\n" +
                "  Exit 1 when the store is unreadable or holds no Bash call.\n",
        );
        return 0;
    }
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    const storeArg = argValue(argv, "--store");
    if (storeArg === null) {
        process.stderr.write("autonomy_friction_traffic: --store needs a directory\n");
        return 1;
    }
    const store = storeArg ?? defaultStore(repoRoot);
    const limitRaw = argValue(argv, "--limit");
    let limit = DEFAULT_LIMIT;
    if (limitRaw !== undefined) {
        const parsed = limitRaw === null ? NaN : Number(limitRaw);
        // Validated rather than coerced: `--limit -5` silently dropped the
        // five OLDEST transcripts through `Array.slice`, `--limit 0` reported
        // an empty store as the reason, and a typo fell back to 40 without
        // saying so. A window is the report's denominator; a wrong one is a
        // wrong measurement wearing the right shape.
        if (!Number.isInteger(parsed) || parsed < 1) {
            process.stderr.write(`autonomy_friction_traffic: --limit must be a positive integer, got ${limitRaw ?? "no value"}\n`);
            return 1;
        }
        limit = parsed;
    }

    const current = argv.includes("--include-current") ? null : currentSessionTranscript(store);
    const paths = transcriptPaths(store, limit).filter((p) => p !== current);
    const calls: BashCall[] = [];
    for (const p of paths) {
        let text: string;
        try {
            text = fs.readFileSync(p, "utf8");
        } catch {
            continue;
        }
        calls.push(...extractCommands(text));
    }
    const commands = dedupeCalls(calls);
    if (commands.length === 0) {
        process.stderr.write(
            `autonomy_friction_traffic: no Bash call found under ${store} ` +
                `(${paths.length} transcript(s) read) — nothing measured\n`,
        );
        return 1;
    }
    const report = classify(store, paths.length, commands);
    process.stdout.write(argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : render(report));
    return 0;
}

function _isCliEntry(): boolean {
    const argv1 = process.argv[1];
    if (argv1 === undefined) return false;
    try {
        return fs.realpathSync(argv1) === fs.realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
