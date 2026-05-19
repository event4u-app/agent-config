/**
 * Python interpreter resolution.
 *
 * The Bash dispatcher's `require_python3` only checks PATH for
 * `python3`. We keep the same contract here: the first executable on
 * PATH named `python3` (or `python` on Windows) wins. No version
 * coercion, no venv hijacking — the engine's own scripts handle that.
 *
 * Exposed as a function so tests can stub it via dependency injection.
 */

import { execaSync } from 'execa';

export interface PythonResolution {
    /** Absolute path to the resolved interpreter. */
    bin: string;
    /** Version string, e.g. "3.11.7", as reported by the interpreter. */
    version: string;
}

export class PythonNotFoundError extends Error {
    constructor() {
        super(
            'agent-config: python3 not found on PATH. Install Python 3.11+ and retry.',
        );
        this.name = 'PythonNotFoundError';
    }
}

export function resolvePython(): PythonResolution {
    const candidates = process.platform === 'win32'
        ? ['python3', 'python']
        : ['python3'];

    for (const bin of candidates) {
        try {
            const { stdout } = execaSync(bin, ['--version'], {
                reject: false,
                timeout: 5000,
            });
            const match = /Python\s+(\d+\.\d+\.\d+)/.exec(stdout);
            if (match?.[1]) return { bin, version: match[1] };
        } catch {
            // try next candidate
        }
    }
    throw new PythonNotFoundError();
}
