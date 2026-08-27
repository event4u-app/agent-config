/**
 * The two runtime-presence checks of `agent-config doctor`.
 *
 * PURE MOVE out of `cmd_doctor.ts`, made under the extraction discipline that
 * file's own `_lib` siblings follow: it is ~3,700 lines and
 * `check_source_size_budget` counts every line above 1,500, so a change that
 * adds lines there must pay for them by taking lines away. Wiring the Phase-1
 * install-reach checks in (`road-to-consumer-repo-reality` 1.1) charged five
 * lines; this move returns more than that.
 *
 * Both checks are cohesive with each other and with nothing else in that file:
 * each answers "is a runtime present, and what does the package do when it is
 * not", and neither reads the manifest, the drift sets, or the project root.
 * Their one dependency is a `which` lookup, and it is passed IN rather than
 * imported: `shutilWhich` lives in `cmd_doctor.ts` and importing it back would
 * make the two modules circular. A parameter is cheaper than moving a shared
 * utility that four other call sites already resolve from there.
 *
 * Behaviour is unchanged — same ids, same statuses, same message strings.
 */
/** The doctor's structured check row. Mirrors `cmd_doctor`'s internal `Dict`. */
export interface RuntimeCheck {
    id: string;
    status: 'ok' | 'warn' | 'fail' | 'skipped';
    message: string;
    remedy: string;
    /** Structural compatibility with `cmd_doctor`'s `Dict` row type. */
    [k: string]: string;
}

export function checkPythonRuntime(): RuntimeCheck {
    // Post-teardown: the package runtime is TypeScript-on-`tsx`. python3 is no
    // longer a runtime dependency, so this check no longer probes for an
    // interpreter (spawning python3 here would be misleading in a python-free
    // package). The check id is retained for the doctor's stable report shape;
    // it always reports `ok`.
    return {
        id: 'python-runtime',
        status: 'ok',
        message: 'python3 is not a runtime dependency (TS runtime via tsx)',
        remedy: '',
    };
}

export function checkHumanizerRuntime(which: (name: string) => string | null): RuntimeCheck {
    // Write-engine step 4b (humanize audit) runs `detect_ai_tells.ts` via a
    // Node/tsx runtime "when available", degrading to a prose-only audit
    // otherwise. This check surfaces which path a consumer install gets so the
    // default-on behavior is not a silent surprise. Either state is healthy —
    // the fallback is graceful by design — so it never fails the run.
    const node = which('node');
    if (node === null) {
        return {
            id: 'humanizer-runtime',
            status: 'ok',
            message:
                'no Node runtime on PATH — write-engine step 4b uses the ' +
                'prose-only humanize audit (graceful fallback)',
            remedy:
                'install Node to enable the mechanical detect_ai_tells.ts pass; ' +
                'the prose audit runs regardless',
        };
    }
    return {
        id: 'humanizer-runtime',
        status: 'ok',
        message: `Node runtime present (${node}) — step 4b runs the mechanical detect_ai_tells.ts pass`,
        remedy: '',
    };
}
