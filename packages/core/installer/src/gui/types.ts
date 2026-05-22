/**
 * Public types for the optional browser-wizard GUI.
 *
 * Phase 6 of the monorepo migration (agents/roadmaps/monorepo-phase-6-
 * browser-wizard-gui.md). The wizard is a thin HTTP wrapper around the
 * existing agent-mode protocol (ADR-016 § 4): the same install plan, the
 * same lockfile, the same atomic-write semantics — just selectable from
 * a local browser tab instead of a terminal.
 */

/** Boot-time options for the GUI HTTP server. */
export interface GuiServerOptions {
    /** Consumer project root — where `agents/runtime/gui/` lives. */
    readonly projectRoot: string;
    /** Override the discovery manifest path. Default: walk up from projectRoot. */
    readonly manifestPath?: string;
    /** Fixed port. Default: 0 (ephemeral, kernel-assigned). */
    readonly port?: number;
    /** Skip the `open` browser-launch step. */
    readonly noOpen?: boolean;
    /** Idle timeout in seconds. Default: 600 (10 minutes). */
    readonly idleSeconds?: number;
    /** Inject an output stream for status lines. Default: process.stdout. */
    readonly stdout?: NodeJS.WritableStream;
    /** Override the browser-launch hook (tests). */
    readonly openBrowser?: (url: string) => void;
}

/** Result of a successful server boot. */
export interface GuiServerHandle {
    /** Loopback URL the browser was directed to. */
    readonly url: string;
    /** Bound port (resolved when port=0 is used). */
    readonly port: number;
    /** CSRF token issued for this server lifetime. */
    readonly csrfToken: string;
    /** PID file written for stale-process detection. */
    readonly pidFile: string;
    /** Stop the server and release the port. */
    readonly close: () => Promise<void>;
}

/** A single transaction-log entry: one planned write or status event. */
export type TransactionLogEntry =
    | { readonly kind: 'start'; readonly ts: string; readonly workspaces: readonly string[]; readonly packs: readonly string[] }
    | { readonly kind: 'plan'; readonly ts: string; readonly path: string; readonly pack: string }
    | { readonly kind: 'commit'; readonly ts: string; readonly filesWritten: number; readonly lockfileSha256: string }
    | { readonly kind: 'cancel'; readonly ts: string; readonly reason: string }
    | { readonly kind: 'error'; readonly ts: string; readonly message: string };

/** SSE event shapes emitted by `POST /api/apply`. */
export type ApplyEvent =
    | { readonly type: 'plan-file'; readonly path: string; readonly pack: string }
    | { readonly type: 'progress'; readonly written: number; readonly total: number }
    | { readonly type: 'done'; readonly filesWritten: number; readonly lockfileSha256: string }
    | { readonly type: 'error'; readonly message: string };
