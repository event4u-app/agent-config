/**
 * The content classes of `internal/bench/tool-results-content-profile-PREREG.md`
 * as one dependency-free module, so the result store that reads them per hook
 * event (road-to-tool-results-that-leave-a-handle Phase 2) classes a result
 * exactly as the selection report did over its window.
 */
export type ContentClass = 'Read:text' | 'Bash:file-print' | 'Bash:vcs-content' | 'execution' | 'residue' | 'out-of-scope';
export const CONTENT_CLASSES = ['Read:text', 'Bash:file-print', 'Bash:vcs-content'] as const;

/**
 * Pipeline stages as word lists, or null when the command carries a construct
 * the PREREG excludes: a `&&` / `||` / `;` / `&` / newline chain, a redirect, a
 * subshell or command substitution, or an unterminated quote.
 */
export function pipelineStages(command: string): string[][] | null {
    const stages: string[][] = [[]];
    let word = '';
    let inWord = false;
    let quote: '"' | "'" | null = null;
    const push = (): void => {
        if (inWord) (stages[stages.length - 1] as string[]).push(word);
        word = '';
        inWord = false;
    };
    for (let i = 0; i < command.length; i++) {
        const ch = command[i] as string;
        const next = command[i + 1];
        if (quote === "'") {
            if (ch === "'") quote = null;
            else word += ch;
            continue;
        }
        if (quote === '"') {
            if (ch === '"') quote = null;
            else if (ch === '`' || (ch === '$' && next === '(')) return null;
            else if (ch === '\\' && next !== undefined) word += command[++i];
            else word += ch;
            continue;
        }
        if (ch === "'" || ch === '"') {
            quote = ch;
            inWord = true;
        } else if (ch === '\\' && next === '\n') {
            i += 1;
            push();
        } else if (ch === '\\' && next !== undefined) {
            word += command[++i];
            inWord = true;
        } else if (ch === ' ' || ch === '\t') {
            push();
        } else if (ch === '|') {
            if (next === '|') return null;
            push();
            stages.push([]);
        } else if (';&\n<>()`'.includes(ch) || (ch === '$' && next === '(')) {
            return null;
        } else {
            word += ch;
            inWord = true;
        }
    }
    if (quote !== null) return null;
    push();
    return stages.some((s) => s.length === 0) ? null : stages;
}

const ADDR = String.raw`(?:\d+|\$|/(?:[^/\\]|\\.)*/)`;
const PRINT_ONLY = new RegExp(String.raw`^(?:${ADDR}(?:\s*,\s*${ADDR})?)?\s*p$`);

/** `sed` with `-n` and a script whose every command is a (possibly addressed) `p`. */
function sedPrintsOnly(args: readonly string[]): boolean {
    let quiet = false;
    let explicitScript = false;
    const scripts: string[] = [];
    let operandsOnly = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (!operandsOnly && a === '--') operandsOnly = true;
        else if (!operandsOnly && (a === '-n' || a === '--quiet' || a === '--silent')) quiet = true;
        else if (!operandsOnly && a === '-e') {
            const s = args[++i];
            if (s === undefined) return false;
            scripts.push(s);
            explicitScript = true;
        } else if (!operandsOnly && a.startsWith('--expression=')) {
            scripts.push(a.slice('--expression='.length));
            explicitScript = true;
        } else if (!operandsOnly && /^-[nErsuz]+$/.test(a)) {
            if (a.includes('n')) quiet = true;
        } else if (!operandsOnly && a.startsWith('-') && a !== '-') return false;
        else if (!explicitScript && scripts.length === 0) scripts.push(a);
    }
    if (!quiet || scripts.length === 0) return false;
    return scripts.every((s) => {
        const parts = s
            .split(/[;\n]/)
            .map((p) => p.trim())
            .filter((p) => p !== '');
        return parts.length > 0 && parts.every((p) => PRINT_ONLY.test(p));
    });
}

const FILE_PRINT_PROGRAMS = new Set(['cat', 'head', 'tail', 'nl', 'wc']);

function isFilePrint(stage: readonly string[]): boolean {
    const [prog, ...args] = stage;
    if (prog === undefined) return false;
    return FILE_PRINT_PROGRAMS.has(prog) || (prog === 'sed' && sedPrintsOnly(args));
}

function isVcsContent(stage: readonly string[]): boolean {
    if (stage[0] !== 'git') return false;
    if (stage[1] === 'diff' || stage[1] === 'show') return true;
    return stage[1] === 'log' && stage.slice(2).some((a) => a === '-p' || a === '--patch');
}

/** One result into a PREREG content class, the execution profile, Bash residue, or out of scope. */
export function classifyResult(tool: string, command: string | null): ContentClass {
    if (tool === 'Read') return 'Read:text';
    if (tool !== 'Bash') return 'out-of-scope';
    if (command === null || command.trim() === '') return 'execution';
    const stages = pipelineStages(command);
    if (stages === null || stages[0]?.[0] === 'cd') return 'residue';
    if (stages.every(isFilePrint)) return 'Bash:file-print';
    if (isVcsContent(stages[0] as string[]) && stages.slice(1).every(isFilePrint)) return 'Bash:vcs-content';
    return 'execution';
}
