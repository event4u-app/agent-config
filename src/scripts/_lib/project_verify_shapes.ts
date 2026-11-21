/**
 * A verifier run inside a container — `docker exec … api vendor/bin/pest`,
 * `docker compose exec app php artisan test` — read by shape.
 *
 * `segmentVerifies` classifies a segment on its head word, so a test runner
 * behind `docker exec` is no verification to it, and the turn-end gate asks
 * for one more run in every consumer repository that tests through a
 * container. This peels the `exec` wrapper and classifies what it runs with
 * the same predicate.
 *
 * Deliberately narrow (council D5, 2026-11-21): only `docker exec` and
 * `docker compose exec` / `docker-compose exec`, only options of known arity.
 * An unknown option, a missing value, a missing command or a shell (`sh -c`)
 * refuses rather than guessing which word is the container. Repository-named
 * scripts (`tools/test`, `scripts/check_x.py`), `sail`, `container exec` and
 * manifest-declared tasks stay unrecognised: a name says nothing about what a
 * script does, and a manifest read at stop time cannot prove which recipe ran.
 *
 * NOT WIRED: no hook imports this module, because the live hook bundle's byte
 * ceiling has no headroom for it. The turn-end gate still reads
 * `isVerificationCommand`.
 */
import {
    DELEGATING_HEADS,
    bareName,
    failureIsDiscarded,
    segmentVerifies,
    splitSegments,
    stripComment,
} from './verification_command.js';

/** `docker exec` options that take the next word as their value. */
const EXEC_VALUE: ReadonlySet<string> = new Set(['-w', '--workdir', '-e', '--env', '--env-file', '-u', '--user', '--detach-keys']);
/** `docker exec` options that take no value; short ones may cluster (`-it`). */
const EXEC_BOOL: ReadonlySet<string> = new Set(['--interactive', '--tty', '--detach', '--privileged']);
const EXEC_BOOL_LETTERS = 'itd';

/** `docker compose exec` options. */
const COMPOSE_VALUE: ReadonlySet<string> = new Set(['-w', '--workdir', '-e', '--env', '-u', '--user', '--index']);
const COMPOSE_BOOL: ReadonlySet<string> = new Set(['--no-TTY', '--detach', '--privileged', '--interactive', '--tty']);
const COMPOSE_BOOL_LETTERS = 'Tdit';

const SHELLS: ReadonlySet<string> = new Set(['sh', 'bash', 'zsh', 'dash', 'ash']);

/**
 * The command a `docker exec` / `docker compose exec` runs, or null when the
 * words are not one or an option cannot be read.
 */
export function containerExecCommand(words: readonly string[]): string[] | null {
    const head = bareName(words[0] ?? '');
    let i: number;
    let compose: boolean;
    if (head === 'docker-compose' && words[1] === 'exec') {
        i = 2;
        compose = true;
    } else if (head === 'docker' && words[1] === 'compose' && words[2] === 'exec') {
        i = 3;
        compose = true;
    } else if (head === 'docker' && words[1] === 'exec') {
        i = 2;
        compose = false;
    } else {
        return null;
    }
    const valued = compose ? COMPOSE_VALUE : EXEC_VALUE;
    const bool = compose ? COMPOSE_BOOL : EXEC_BOOL;
    const letters = compose ? COMPOSE_BOOL_LETTERS : EXEC_BOOL_LETTERS;

    while (i < words.length) {
        const w = words[i] as string;
        if (!w.startsWith('-')) break;
        const eq = w.indexOf('=');
        const name = eq === -1 ? w : w.slice(0, eq);
        if (valued.has(name)) {
            if (eq !== -1) i += 1;
            else if (i + 1 < words.length) i += 2;
            else return null;
        } else if (bool.has(w) || (/^-[A-Za-z]+$/.test(w) && [...w.slice(1)].every((c) => letters.includes(c)))) {
            i += 1;
        } else {
            return null;
        }
    }
    // words[i] is the container or service; the command follows it.
    const ran = words.slice(i + 1);
    return ran.length > 0 ? ran : null;
}

/** `segmentVerifies`, plus a verifier run through `docker exec` / `docker compose exec`. */
export function segmentVerifiesInContainer(rawWords: readonly string[]): boolean {
    if (segmentVerifies(rawWords)) return true;
    const w = rawWords.filter((x) => x.length > 0);
    let idx = 0;
    while (idx < w.length && DELEGATING_HEADS.has(bareName(w[idx] as string))) idx += 1;
    const inner = containerExecCommand(w.slice(idx));
    if (inner === null || SHELLS.has(bareName(inner[0] ?? ''))) return false;
    return segmentVerifies(inner);
}

/** `isVerificationCommand` with container execs, on the same segment and discard rules. */
export function isVerificationCommandInContainer(command: string): boolean {
    if (!command) return false;
    return splitSegments(stripComment(command)).some((seg) => !failureIsDiscarded(seg) && segmentVerifiesInContainer(seg.words));
}
