/**
 * The install / upgrade progress display: one redrawn bar on a terminal, one
 * line per step everywhere else (CI logs, pipes, `TERM=dumb`), so a log never
 * fills with carriage-return frames.
 *
 * Lines that must survive the run — a warning, the final summary — go through
 * `log()`, which clears the bar, prints the line and redraws, so a warning never
 * lands in the middle of a half-drawn bar.
 */

export interface ProgressSink {
    write(chunk: string): unknown;
}

export interface ProgressOptions {
    readonly total: number;
    readonly out: ProgressSink;
    /** Redraw in place. Callers pass `isInteractive(stream)`. */
    readonly tty: boolean;
    /** Cells of the bar itself; the label follows it. */
    readonly width?: number;
}

const FILLED = '█';
const EMPTY = '░';

/** A stream the bar may redraw on: a TTY, not `TERM=dumb`, not a CI run. */
export function isInteractive(stream: { isTTY?: boolean }, env: NodeJS.ProcessEnv = process.env): boolean {
    const ci = (env['CI'] ?? '').toLowerCase();
    return stream.isTTY === true && env['TERM'] !== 'dumb' && (ci === '' || ci === 'false' || ci === '0');
}

export function renderBar(done: number, total: number, width: number): string {
    const clamped = total <= 0 ? 1 : Math.min(1, Math.max(0, done / total));
    const filled = Math.round(clamped * width);
    return `[${FILLED.repeat(filled)}${EMPTY.repeat(width - filled)}]`;
}

export class ProgressBar {
    private readonly out: ProgressSink;
    private readonly tty: boolean;
    private readonly width: number;
    private readonly total: number;
    /** Steps completed; the step in progress is `done + 1`. */
    private done = 0;
    private current = 0;
    private label = '';
    private drawn = false;

    constructor(opts: ProgressOptions) {
        this.out = opts.out;
        this.tty = opts.tty;
        this.width = opts.width ?? 24;
        this.total = Math.max(1, opts.total);
    }

    /** Start step `done + 1` of `total`, labelled. */
    step(label: string): void {
        this.done = this.current;
        this.current = Math.min(this.current + 1, this.total);
        this.label = label;
        if (this.tty) this.draw();
        else this.out.write(`  [${this.current}/${this.total}] ${label}\n`);
    }

    /** A line that stays in the scrollback; the bar is redrawn below it. */
    log(line: string): void {
        this.interleave(() => this.out.write(`${line}\n`));
    }

    /** Run `write` with the bar cleared, then redraw it — for output on another stream. */
    interleave(write: () => void): void {
        const redraw = this.tty && this.drawn;
        if (redraw) this.out.write('\r\x1b[2K');
        write();
        if (redraw) this.draw();
    }

    /** Fill the bar and leave it as the last line of the progress block. */
    finish(label = 'done'): void {
        this.done = this.total;
        this.current = this.total;
        this.label = label;
        if (this.tty) {
            this.draw();
            this.out.write('\n');
            this.drawn = false;
        }
    }

    private draw(): void {
        const count = `${this.current}/${this.total}`;
        this.out.write(`\r\x1b[2K  ${renderBar(this.done, this.total, this.width)} ${count}  ${this.label}`);
        this.drawn = true;
    }
}

/** `12.3 s` / `850 ms` — the one duration format the summaries print. */
export function formatDuration(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** A sink that hands each complete line to `line` — `print`-style writers end every line with `\n`. */
export function lineSink(line: (text: string) => void): ProgressSink {
    let pending = '';
    return {
        write(chunk: string): void {
            pending += chunk;
            let nl = pending.indexOf('\n');
            while (nl !== -1) {
                line(pending.slice(0, nl));
                pending = pending.slice(nl + 1);
                nl = pending.indexOf('\n');
            }
        },
    };
}
