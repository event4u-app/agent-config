/**
 * What a person sees during `agent-config init` / `global`: the version moving,
 * one progress bar, and at the end which AI tools got the package and where.
 * The per-step report the installer used to print is `--verbose` / `--debug`.
 */

import * as os from 'node:os';
import * as path from 'node:path';

import { ProgressBar, formatDuration, isInteractive, type ProgressSink } from '../scripts/_lib/progress_bar.js';

/** `[written, skipped, status, …]` — the installer's per-tool deploy outcome. */
export type DeployOutcome = readonly [number, number, string, ...unknown[]];

export interface ToolLineContext {
    readonly anchors: Readonly<Record<string, string>>;
    readonly claudeDesktopBundlesDir: () => string;
    readonly exportHint: (toolId: string) => string;
}

/** One line per tool: where its content went, or why it has none at user scope. */
export function deployedToolLines(results: Readonly<Record<string, DeployOutcome>>, ctx: ToolLineContext): string[] {
    return Object.keys(results).sort().map((id) => {
        const [written, skipped, status] = results[id] as DeployOutcome;
        const anchor = ctx.anchors[id] ?? '';
        const head = `${id.padEnd(15)} → `;
        if (status === 'deployed' && id === 'claude-desktop') return `${head}${ctx.claudeDesktopBundlesDir()} (${written} bundles)`;
        if (status === 'deployed') return `${head}${anchor} (${written} files, ${skipped} skipped)`;
        if (status === 'marker') return `${head}${anchor}agent-config.md (${written ? 'written' : 'skipped'})`;
        if (status === 'hint') return `${head}no user-scope convention; per project: \`${ctx.exportHint(id)}\``;
        return `${head}no global-scope content yet (project-scope install supported)`;
    });
}

/** `~/…` for a path under the home directory. */
export function tildePath(p: string, home: string = os.homedir()): string {
    return home !== '' && (p === home || p.startsWith(home + path.sep)) ? '~' + p.slice(home.length) : p;
}

export function versionHeadline(from: string | null, to: string): string {
    if (from === null) return `agent-config ${to} — new install`;
    if (from === to) return `agent-config ${to} — reinstall`;
    return `agent-config ${from} → ${to}`;
}

/** The global install's progress: preparing, one step per tool, finishing. */
export class InstallProgress {
    private readonly bar: ProgressBar;
    private readonly out: ProgressSink;
    private readonly started: number;

    constructor(opts: { from: string | null; to: string; tools: number; out?: ProgressSink; tty?: boolean; now?: () => number }) {
        this.out = opts.out ?? process.stdout;
        this.started = (opts.now ?? Date.now)();
        this.out.write(`${versionHeadline(opts.from, opts.to)}\n`);
        this.bar = new ProgressBar({ total: opts.tools + 2, out: this.out, tty: opts.tty ?? isInteractive(process.stdout) });
        this.bar.step('preparing …');
    }

    tool(id: string): void {
        this.bar.step(`deploying to ${id} …`);
    }

    finishing(): void {
        this.bar.step('finishing …');
    }

    /** Output on another stream (a warning) without tearing the bar. */
    interleave(write: () => void): void {
        this.bar.interleave(write);
    }

    /** Close the bar and print where everything went. */
    done(opts: { to: string; root: string; results: Readonly<Record<string, DeployOutcome>>; ctx: ToolLineContext; now?: () => number }): void {
        const took = formatDuration((opts.now ?? Date.now)() - this.started);
        this.bar.finish(`done in ${took}`);
        const lines = deployedToolLines(opts.results, opts.ctx);
        this.out.write(`  Installed to: ${tildePath(opts.root)}\n`);
        this.out.write(`  AI tools (${lines.length}):\n`);
        for (const line of lines) this.out.write(`    ${line}\n`);
        this.out.write(`✅  agent-config ${opts.to} ready (${took}). Full report: add --verbose.\n`);
    }
}
