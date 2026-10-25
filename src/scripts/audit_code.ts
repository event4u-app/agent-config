/**
 * `agent-config audit:code <mode>` — the deterministic half of `/audit code`.
 *
 *   matrix [--root <dir>] [--skeleton]   the two-account matrix over the code graph's routes
 *   validate [<ledger.json>] [--root …]  check a ledger against security-ledger.schema.json
 *   show [--root <dir>]                  the report derived from the newest ledger, or "not checked"
 *
 * No mode calls a model or touches the network. Ledgers live under the
 * gitignored `agents/runtime/state/security/<run>/ledger.json`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { renderLedger, type SecurityLedger, validateLedger } from './_lib/security_ledger.js';
import { main as matrixMain } from './security_matrix.js';

const LEDGER_DIR = path.join('agents', 'runtime', 'state', 'security');

function rootOf(argv: readonly string[]): string {
    const i = argv.indexOf('--root');
    return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : process.cwd();
}

/** The newest ledger by run-directory mtime, or null when no run was recorded. */
export function newestLedger(root: string): string | null {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return null;
    const runs = fs
        .readdirSync(dir)
        .map((d) => path.join(dir, d, 'ledger.json'))
        .filter((p) => fs.existsSync(p))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return runs[0] ?? null;
}

function read(file: string): unknown {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

export async function main(argv: readonly string[]): Promise<number> {
    const [mode, ...rest] = argv;
    if (mode === 'matrix') return matrixMain(rest);
    if (mode === 'validate' || mode === 'show') {
        const explicit = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--root');
        const file = explicit ?? newestLedger(rootOf(rest));
        if (file === null) {
            process.stdout.write(renderLedger(null));
            return mode === 'validate' ? 1 : 0;
        }
        const ledger = read(file);
        const problems = validateLedger(ledger);
        if (problems.length > 0) {
            process.stderr.write(`${file}: invalid ledger\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
            return 1;
        }
        process.stdout.write(mode === 'show' ? renderLedger(ledger as SecurityLedger) : `${file}: valid\n`);
        return 0;
    }
    process.stderr.write('usage: audit:code matrix|validate|show [--root <dir>] [--skeleton] [<ledger.json>]\n');
    return 2;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
