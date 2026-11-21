/**
 * Detector G's second reason, `unlisted_surface`: the turn edited a runnable
 * surface, ran nothing after the edit that drives it, and the reply claims done
 * without listing it under "Not verified:". Records, never refuses.
 *
 * Kept apart from `coverage_claim.ts` because it reads the repository (the
 * live-surface map): the turn-end hook's live path does not run it yet, so none
 * of this module is in the dispatch bundle (decision D11 of the done-claims
 * roadmap). The `verify:surfaces` verb shares the reader.
 */
import * as path from 'node:path';

import { completionClaimAt, notVerifiedSpans, partialRatioIn, type CoverageFinding } from './coverage_claim.js';
import { deriveLiveSurfaces, type LiveSurface } from './live_surfaces.js';
import { commandSegments } from './exit_masking.js';

/** The structural slice of a transcript tool call this detector reads. */
export interface CallLike {
    name: string;
    command?: string;
    path?: string;
}

const EDIT_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** A documentation file: by extension, or anywhere under a `docs/` directory. */
const DOC_PATH = /(?:\.(?:md|mdx|markdown|txt|rst|adoc)$)|(?:(?:^|\/)docs\/)/i;

/** Surfaces a render or browser run reaches without naming them: a web page. */
const BROWSER_KINDS: ReadonlySet<LiveSurface['kind']> = new Set(['npm-script', 'playwright']);

/** The config path a `playwright test` run names (`--config X`, `-c X`, quoted or not); null when none. */
function playwrightConfig(command: string): string | null {
    const m = /\s(?:--config(?:=|\s+)|-c\s+)("[^"]+"|'[^']+'|\S+)/.exec(command);
    return m ? (m[1] as string).replace(/^["']|["']$/g, '') : null;
}

/** `start` run as one of the line's commands, not merely mentioned in one. */
function runsCommand(segs: readonly string[], start: string): boolean {
    return segs.some((x) => x === start || x.startsWith(`${start} `));
}

/** A segment that runs `playwright test` or `agent-config ui:render`, behind an env prefix or a runner. */
const PLAYWRIGHT_RUN = /^(?:\w+=\S*\s+)*(?:(?:npx|bunx|pnpm(?:\s+exec)?|yarn)\s+)?playwright\s+test\b/;
const HTTP_CLIENT = /^(?:\w+=\S*\s+)*(?:curl|wget|http|https|xh|hurl)\b/;
const RENDER_RUN = /^(?:\w+=\S*\s+)*(?:(?:npx|bunx|pnpm(?:\s+exec)?|yarn)\s+)?(?:\S*\/)?agent-config\s+ui:render\b/;

/**
 * A call that drove `surface`: its start command, its URL, or a render or browser
 * run over a web page. A `playwright test` run that names another config does not
 * drive a surface derived from this one.
 */
function drives(segs: readonly string[], surface: LiveSurface, root: string): boolean {
    const playwrightRuns = segs.filter((x) => PLAYWRIGHT_RUN.test(x));
    if (surface.kind === 'playwright' && playwrightRuns.length > 0) {
        const config = surface.derived_from.replace(/:\d+$/, '');
        return playwrightRuns.some((run) => {
            const named = playwrightConfig(run);
            return named === null || path.relative(root, path.resolve(root, named)).split(path.sep).join('/') === config;
        });
    }
    // A playwright run credits an npm surface only through this repo's own root config
    // (its webServer); a run naming another app's config does not.
    const servedBy = surface.webServerOf ?? [];
    if (surface.kind === 'npm-script' && servedBy.length > 0 && playwrightRuns.length > 0) {
        // Credit only through a config whose webServer starts this script: the one a run names,
        // or, with none named, any root config.
        const own = playwrightRuns.some((run) => {
            const named = playwrightConfig(run);
            if (named === null) return true;
            return servedBy.includes(path.relative(root, path.resolve(root, named)).split(path.sep).join('/'));
        });
        if (own) return true;
    }
    if (BROWSER_KINDS.has(surface.kind) && segs.some((x) => RENDER_RUN.test(x))) return true;
    if (surface.start !== null && runsCommand(segs, surface.start)) return true;
    // A URL counts as a whole host:port.
    if (surface.url === undefined) return false;
    const escaped = surface.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Only a request actually made — an HTTP client or a render — whose target argument IS the
    // URL, not one that merely contains it (`?next=http://localhost:3000`).
    // The whole word is the URL or the URL and a path, query or fragment.
    const url = new RegExp(`^${escaped}(?:[/?#]|$)`);
    return segs.some((x) => (HTTP_CLIENT.test(x) || RENDER_RUN.test(x)) && targets(x).some((w) => url.test(w)));
}

/** Shell words, dequoted: whitespace splits only outside quotes, `\` escapes the next character. */
function shellWords(text: string): string[] {
    const out: string[] = [];
    let word = '';
    let started = false;
    let quote: '' | "'" | '"' = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        if (quote === "'") {
            if (ch === "'") quote = '';
            else word += ch;
        } else if (ch === '\\' && i + 1 < text.length) {
            word += text[i + 1] as string;
            i += 1;
            started = true;
        } else if (quote === '"') {
            if (ch === '"') quote = '';
            else word += ch;
        } else if (ch === "'" || ch === '"') {
            quote = ch;
            started = true;
        } else if (/\s/.test(ch)) {
            if (started) out.push(word);
            word = '';
            started = false;
        } else {
            word += ch;
            started = true;
        }
    }
    if (started) out.push(word);
    return out;
}

/** Short and long options of the HTTP clients that take no value; any other option may own the next word. */
const FLAG_CLUSTER = /^-[sSfLkviIGNq46]+$/;
const LONG_FLAGS = new Set([
    '--silent', '--show-error', '--fail', '--fail-with-body', '--location', '--insecure', '--verbose',
    '--include', '--head', '--get', '--no-buffer', '--compressed', '--ipv4', '--ipv6', '--http1.1',
    '--http2', '--http3', '--quiet', '--spider', '--server-response',
]);

/**
 * The words of `segment` that can be a request target: shell words, dequoted, never an
 * option, and never the word after an option that may take a value (`-e URL`,
 * `--referer URL`, `-x URL`). An unknown option counts as one that takes a value, so a
 * doubtful word is not credited. After `--` every word is positional.
 */
function targets(segment: string): string[] {
    const words = shellWords(segment);
    const out: string[] = [];
    let positional = false;
    for (let i = 1; i < words.length; i += 1) {
        const word = words[i] as string;
        if (!positional && word === '--') {
            positional = true;
            continue;
        }
        if (!positional && word.startsWith('-')) continue;
        const prev = words[i - 1] as string;
        const ownedByOption =
            !positional && i > 1 && prev.startsWith('-') && !prev.includes('=') &&
            !FLAG_CLUSTER.test(prev) && !LONG_FLAGS.has(prev);
        if (!ownedByOption) out.push(word);
    }
    return out;
}

/**
 * Reason `unlisted_surface`: a completion claim, a turn that edited a file
 * under a derived surface's root, no call that drove that surface, and no
 * `Not verified:` block naming it.
 *
 * The map is derived in memory (`deriveLiveSurfaces`), never written from the
 * Stop path: the gate runs in consumer repos, and a turn-end hook that drops a
 * file into one is a side effect nobody asked for.
 */
export function unlistedSurfaceIn(
    fenceStripped: string,
    visible: string,
    calls: readonly CallLike[],
    workspaceRoot: string,
    given?: readonly LiveSurface[],
): CoverageFinding | null {
    // The cheap checks first: most turn ends claim nothing or edit nothing, and
    // those never read the repo.
    if (completionClaimAt(visible) === null) return null;
    // Documentation is not part of what a surface runs.
    // Each call keeps its position: only a run AFTER the last edit under a surface drives it.
    const edits = calls.flatMap((c, at) =>
        EDIT_TOOLS.has(c.name) && c.path !== undefined && !DOC_PATH.test(c.path.split(path.sep).join('/'))
            ? [{ at, path: c.path }]
            : [],
    );
    if (edits.length === 0) return null;
    const surfaces = given ?? deriveLiveSurfaces(workspaceRoot);
    if (surfaces.length === 0) return null;
    // Each command split once, not once per surface.
    const commands = calls
        .map((c, at) => ({ at, command: c.command ?? '' }))
        .filter((c) => c.command !== '')
        .map((c) => ({ at: c.at, segs: commandSegments(c.command).map((x) => x.trim()) }));
    // Inline code kept (backticks dropped): a list entry is often `npm run dev`.
    const text = fenceStripped.replace(/`/g, ' ');
    const listed = notVerifiedSpans(text).map(([s, e]) => text.slice(s, e)).join('\n');
    for (const surface of surfaces) {
        const root = path.resolve(workspaceRoot, surface.root);
        const under = edits.filter((e) => {
            const rel = path.relative(root, path.resolve(workspaceRoot, e.path));
            return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
        });
        const latest = under[under.length - 1];
        if (latest === undefined) continue;
        const edited = latest.path;
        if (commands.some((c) => c.at > latest.at && drives(c.segs, surface, workspaceRoot))) continue;
        const names = [surface.name, surface.start, surface.url].filter((x): x is string => typeof x === 'string');
        if (names.some((n) => namedIn(listed, n))) continue;
        return {
            detector: 'coverage',
            code: 'unlisted_surface',
            evidence: `${path.relative(workspaceRoot, edited)} under ${surface.kind} ${surface.name}`,
            reason:
                `unlisted_surface: a completion claim over ${surface.kind} "${surface.name}" ` +
                `(${surface.start ?? 'no start command'}), which nothing in the turn drove — drive it, ` +
                'or list it under "Not verified:" (verify-completion-evidence)',
        };
    }
    return null;
}

/** `name` as a whole word of `text`: `dev` is named by "dev (npm run dev)", not by "development". */
function namedIn(text: string, name: string): boolean {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^\\w-])${escaped}(?:$|[^\\w-])`, 'i').test(text);
}

/** Both reasons, ratio first: the hook's one entry point for detector G. */
export function coverageGapIn(
    fenceStripped: string,
    visible: string,
    calls: readonly CallLike[],
    workspaceRoot: string | undefined,
): CoverageFinding | null {
    const ratio = partialRatioIn(fenceStripped, visible);
    if (ratio !== null || workspaceRoot === undefined) return ratio;
    try {
        return unlistedSurfaceIn(fenceStripped, visible, calls, workspaceRoot);
    } catch {
        // A surface read that fails is no finding; this detector never decides a turn.
        return null;
    }
}
