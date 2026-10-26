/**
 * Environment variable NAMES — where code reads them and where an example file
 * declares them. Values are never captured: every pattern stops at the name,
 * and a real `.env` file is never opened (only `*.example`-style files are).
 */

const CODE_READS: RegExp[] = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /process\.env\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g,
    /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
    /\benv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
    /\bgetenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
    /\$_ENV\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g,
    /os\.environ\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g,
    /os\.environ\.get\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
    /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
    /os\.Getenv\(\s*"([A-Z_][A-Z0-9_]*)"/g,
    /\bENV(?:\.fetch\()?\[?\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
];

/** Names the runtime platform or the CI provides; their absence from an example file is not drift. */
const PLATFORM = /^(NODE_ENV|HOME|PATH|PWD|USER|SHELL|TMPDIR|TEMP|TMP|LANG|TERM|CI|HOSTNAME|PORT|TZ|DEBUG|GITHUB_\w+|GITLAB_\w+|CI_\w+|RUNNER_\w+|npm_\w+|VITEST\w*|JEST_\w+)$/;

export function isPlatformName(name: string): boolean {
    return PLATFORM.test(name);
}

export function envReadsInCode(text: string): { name: string; line: number }[] {
    const out: { name: string; line: number }[] = [];
    const lines = text.split('\n');
    lines.forEach((l, i) => {
        if (l.length > 2000) return;
        for (const re of CODE_READS) for (const m of l.matchAll(re)) out.push({ name: m[1]!, line: i + 1 });
    });
    return out;
}

/** Example env files whose KEYS document the expected environment. */
export const isEnvExampleName = (name: string): boolean => /^\.?env\.(example|dist|sample|template)$|^\.env\.\w+\.example$/.test(name);

export function envNamesInExample(text: string): { name: string; line: number }[] {
    const out: { name: string; line: number }[] = [];
    text.split('\n').forEach((l, i) => {
        const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l);
        if (m) out.push({ name: m[1]!, line: i + 1 });
    });
    return out;
}

export const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|php|py|go|rb)$/;
