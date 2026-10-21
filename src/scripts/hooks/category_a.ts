/**
 * category_a — which `pre_tool_use` calls this package is willing to hand the
 * host an explicit `permissionDecision: allow` for.
 *
 * WHY THIS EXISTS. `host_semantics` built exactly one envelope shape, so a
 * call this package does not gate at all still cost the user a host
 * confirmation. `permissionDecision` is offered by the host contract and was
 * never emitted, so the prompt is ours to remove — but only for calls where
 * "we do not gate this" is a fact about the call rather than about our
 * coverage. That is what category A names: reads, navigation, build, test and
 * lint inside the working tree with no consequence operation attached.
 *
 * THE CLASSIFIER IS AN ALLOWLIST AND MUST STAY ONE. A denylist answers "is
 * this one of the bad shapes I thought of", so every shape nobody thought of
 * would be auto-allowed. Everything below answers the opposite question, and an
 * unrecognised call is not category A. The failure direction of a bug here is
 * then a prompt that did not go away, never a confirmation that was skipped.
 *
 * WHAT AN ALLOW DOES NOT DO. It never overrides a verdict from this package:
 * composition lives in `host_semantics.composePermissionDecision`, where one
 * `ask` or `deny` beats every `allow`, and the dispatcher reaches the allow
 * path only when the reduced severity is already `allow`. It is also not a
 * grant — the host's own strings record `permissionDecision=allow ignored: a
 * confined session takes grants only from its command line`.
 */
import * as fs from "node:fs";
import * as path from "node:path";

/** A JSON-ish tool input as it arrives in the dispatcher envelope. */
export type ToolInput = Record<string, unknown>;

/**
 * Tools whose every documented effect is a read. `WebFetch` and `WebSearch`
 * are deliberately absent — they reach the network, which is the egress leg of
 * the lethal trifecta and not something to auto-allow.
 */
const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
    "Read",
    "Glob",
    "Grep",
    "NotebookRead",
    "LS",
    "TodoRead",
]);

/** Per-tool input keys that carry a filesystem path needing confinement. */
const PATH_KEYS: readonly string[] = [
    "file_path",
    "notebook_path",
    "path",
    "directory",
];

/**
 * Any of these in a Bash command string disqualifies it before the argv is
 * looked at. Chaining, substitution, redirection and backgrounding all let a
 * safe head token carry an arbitrary second command, and a classifier that
 * tries to parse past them is a shell parser with a security boundary attached.
 * Refusing the whole shape is both smaller and correct.
 */
export const SHELL_METACHARACTERS = /[;&|`$><\n\r(){}\\]/;

/**
 * Words naming a consequence operation, matched as whole tokens anywhere in
 * the command. Defence in depth: the metacharacter rule already prevents a
 * second command, so a hit here means the FIRST command is consequential.
 */
const CONSEQUENCE_WORDS: ReadonlySet<string> = new Set([
    "push", "publish", "deploy", "release", "merge", "rebase", "reset",
    "revert", "restore", "checkout", "commit", "tag", "fetch", "pull", "clone",
    "rm", "rmdir", "unlink", "mv", "cp", "chmod", "chown", "kill", "sudo",
    "curl", "wget", "ssh", "scp", "rsync", "nc", "telnet",
    "drop", "truncate", "delete", "insert", "migrate", "seed", "restore-db",
    "install", "uninstall", "upgrade", "prune", "clean", "apply", "destroy",
    "terraform", "kubectl", "helm", "aws", "gcloud", "az", "docker", "podman",
    "systemctl", "launchctl", "crontab", "mail", "sendmail",
]);

/** Read-only `git` subcommands; every consequential one is absent by design. */
const GIT_READ_SUBCOMMANDS: ReadonlySet<string> = new Set([
    "status", "log", "diff", "show", "branch", "blame", "describe",
    "shortlog", "rev-parse", "ls-files", "ls-tree", "cat-file", "whatchanged",
]);

/**
 * Head tokens that cannot write outside their arguments and whose named
 * operation is a read, a navigation, a build, a test or a lint.
 *
 * `node`, `python`, `ruby`, `php` and `sh` are deliberately absent: their named
 * operation is "run this program", which establishes nothing about what the
 * program does. A test runner is admitted by name because the name IS the
 * operation.
 */
const SAFE_HEADS: ReadonlySet<string> = new Set([
    "ls", "pwd", "cat", "head", "tail", "wc", "file", "stat", "find",
    "grep", "rg", "tree", "du", "df", "which", "basename", "dirname",
    "realpath", "sort", "uniq", "cut", "diff", "cmp", "date", "echo",
    "tsc", "eslint", "prettier", "biome", "stylelint",
    "vitest", "jest", "mocha", "pytest", "mypy", "ruff", "flake8", "black",
    "phpstan", "phpunit", "psalm", "pest", "rspec", "rubocop",
    "golangci-lint", "shellcheck", "markdownlint", "hadolint",
]);

/**
 * Multi-purpose runners: the head token decides nothing, so the subcommand
 * must be declared. `npm run <script>` executes whatever the manifest says,
 * which is why the script name is checked separately below.
 */
const RUNNER_SUBCOMMANDS: Readonly<Record<string, ReadonlySet<string>>> = {
    npm: new Set(["test", "run", "ls", "list", "why", "outdated", "view"]),
    pnpm: new Set(["test", "run", "ls", "list", "why", "outdated"]),
    yarn: new Set(["test", "run", "list", "why", "info"]),
    npx: new Set(["tsc", "eslint", "prettier", "vitest", "jest"]),
    composer: new Set(["test", "run-script", "show", "validate", "diagnose"]),
    cargo: new Set(["test", "build", "check", "clippy", "fmt", "tree"]),
    go: new Set(["test", "build", "vet", "list", "version"]),
    make: new Set(["test", "build", "lint", "check", "typecheck"]),
    task: new Set(["test", "build", "lint", "check", "typecheck", "--list"]),
    just: new Set(["test", "build", "lint", "check"]),
    bundle: new Set(["exec"]),
    dotnet: new Set(["test", "build"]),
    mvn: new Set(["test", "compile", "verify"]),
    gradle: new Set(["test", "build", "check"]),
};

/** Script names a `run`-style subcommand may name and stay category A. */
const SAFE_SCRIPT_NAMES: ReadonlySet<string> = new Set([
    "test", "tests", "lint", "typecheck", "types", "build", "check",
    "format", "fmt", "unit", "e2e", "coverage", "compile",
]);

/** Subcommands that take a script name rather than acting themselves. */
const SCRIPT_TAKING_SUBCOMMANDS: ReadonlySet<string> = new Set([
    "run", "run-script", "exec",
]);

/**
 * Is `candidate` inside `root`?
 *
 * Pure `path` arithmetic, no `fs`: the classifier must be decidable from the
 * envelope alone, and a stat call would make it depend on what happens to
 * exist on the machine that runs the hook.
 */
export function isInsideWorkingTree(candidate: string, root: string): boolean {
    if (!candidate.trim() || !root.trim()) return false;
    const abs = path.resolve(root, candidate);
    const rel = path.relative(path.resolve(root), abs);
    if (rel === "") return true;
    // `..` as a whole first segment escapes; `...` or `..cache` is a name.
    const escapes = rel === ".." || rel.startsWith(`..${path.sep}`);
    return !escapes && !path.isAbsolute(rel);
}

/** `p` with every symlink in its longest existing prefix resolved. */
function _real(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR") return "";
        // A dangling link is not a missing suffix: its target is unknowable.
        try {
            if (code === "ENOENT" && fs.lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink()) return "";
        } catch {
            return "";
        }
        const parent = path.dirname(p);
        if (parent === p) return p;
        const up = _real(parent);
        return up && path.join(up, path.basename(p));
    }
}

/**
 * {@link isInsideWorkingTree}, and still inside once symlinks are followed.
 *
 * The one place the classifier reads the filesystem, and it can only withhold:
 * an in-tree symlink to `~/.ssh` is lexically inside and really outside. A
 * missing suffix keeps its lexical answer; a dangling link and any other
 * resolution failure (`EACCES`, `ELOOP`) resolve to `""`, which is never inside. The check runs
 * before the command does, so a link swapped in between is not seen — the
 * OS sandbox is the boundary, this is a guardrail.
 */
function _reallyInside(candidate: string, root: string): boolean {
    if (!isInsideWorkingTree(candidate, root)) return false;
    return isInsideWorkingTree(_real(path.resolve(root, candidate)), _real(path.resolve(root)));
}

/** Split a command on whitespace; the caller has already refused metacharacters. */
function _argv(command: string): string[] {
    return command.trim().split(/\s+/).filter((t) => t.length > 0);
}

/** Strip a leading `-`/`--` so a flag is never mistaken for a subcommand. */
function _isFlag(token: string): boolean {
    return token.startsWith("-");
}

/** First non-flag token after the head, or `""`. */
function _firstSubcommand(argv: readonly string[]): string {
    for (const token of argv.slice(1)) {
        if (!_isFlag(token)) return token;
    }
    return "";
}

/**
 * `git` global options that consume the NEXT token as their value.
 *
 * Without this, `git -C sub status` resolves its subcommand to `sub` and the
 * whole directory-flag form — the shape the canon now teaches in place of
 * `cd X && …` — falls out of category A. That defect was found by the friction
 * corpus on its first run, which is the reason the corpus counts confirmations
 * rather than gates: a gate count would have looked identical.
 *
 * The `--flag=value` spelling consumes no extra token and needs no entry.
 */
const GIT_VALUE_FLAGS: ReadonlySet<string> = new Set([
    "-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path",
]);

/**
 * The `git` subcommand and its argv index, with global options skipped.
 *
 * Returns `""` when a global option's VALUE escapes the working tree — an
 * absolute path or a `..` traversal. The check is textual rather than resolved
 * against a root because this function is pure and receives no root; what it
 * can decide is exactly the property that matters, and a relative path with no
 * `..` cannot escape.
 */
function _gitSubcommandAt(argv: readonly string[]): { sub: string; index: number } {
    for (let i = 1; i < argv.length; i++) {
        const token = argv[i] as string;
        if (!_isFlag(token)) return { sub: token, index: i };
        const [flag, inlineValue] = token.includes("=")
            ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
            : [token, null];
        const value = inlineValue ?? (GIT_VALUE_FLAGS.has(flag) ? argv[++i] : undefined);
        if (value !== undefined && (path.isAbsolute(value) || value.split("/").includes(".."))) {
            return { sub: "", index: -1 };
        }
    }
    return { sub: "", index: -1 };
}

/**
 * `git branch` is category A only in its observational forms — an allowlist,
 * like the rest of this file. Every other form writes a ref: `-d`/`-D` and
 * `-f`/`-m`/`-M`/`-C` can lose one, and a bare `git branch <name>`, `-c`,
 * `-u` or `--edit-description` create or rewrite one. A positional operand is
 * admitted only under `-l`/`--list`, where it is a pattern, or as the value of
 * a filter flag.
 */
const GIT_BRANCH_OBSERVES =
    /^(-[arlvi]+|--(all|remotes|list|verbose|show-current|(no-)?color)(=.*)?)$/;
const GIT_BRANCH_FILTER = /^--((no-)?(contains|merged)|points-at|sort|format|abbrev)(=|$)/;

function _gitBranchOnlyObserves(argv: readonly string[], index: number): boolean {
    const rest = argv.slice(index + 1);
    const listing = rest.some((t) => /^(-[arvi]*l[arlvi]*|--list)$/.test(t));
    for (let i = 0; i < rest.length; i++) {
        const token = rest[i] as string;
        if (!_isFlag(token)) {
            if (!listing) return false;
        } else if (GIT_BRANCH_FILTER.test(token)) {
            if (!token.includes("=") && !_isFlag(rest[i + 1] ?? "-")) i++;
        } else if (!GIT_BRANCH_OBSERVES.test(token)) {
            return false;
        }
    }
    return true;
}

/**
 * Heads that never open their arguments, so a path-shaped argument is a string
 * and confining it would only put a prompt on `echo /tmp`.
 */
const NON_OPENING_HEADS = /^(pwd|echo|basename|dirname|date|which)$/;

/**
 * Output-writing flags (0.3). Their target is a path like any other, and the
 * walk below confines every spelling: a separate value token (`--output x`,
 * `-fprint x`, `--outDir x`) is a positional, `--output=x` is an inline value,
 * a glued short value (`sort -o/path`) is the tail of a single-dash token, and
 * the value-less writers (`--write`/`-w`, `--fix`) write their positionals. So
 * no per-head table is needed; one was measured inert and removed.
 *
 * For `grep`/`rg` the first positional, or an `-e`/`--regexp` value, is a
 * pattern and therefore data; an `-f`/`--file` value is a path.
 */
const PATTERN_GIVEN = /^(-e|--regexp|-f|--file)(=|$)/;

/**
 * Every argument of a Bash command that may name a filesystem location.
 *
 * Positionals, flag inline values and the tail of a single-dash token
 * (`-o/path`, `-f/path`) are all candidates: one that stays inside is harmless
 * to check, and missing one is not. After `--` every token is a positional.
 * Shell quote removal is applied; every other expansion is refused upstream by
 * the metacharacter rule.
 */
function _pathArguments(argv: readonly string[], head: string): string[] {
    const out: string[] = [];
    const grep = head === "grep" || head === "rg";
    let patternPending = grep && !argv.some((t) => PATTERN_GIVEN.test(t));
    let endOfOptions = false;
    for (let i = 1; i < argv.length; i++) {
        const raw = argv[i] as string;
        // An unquoted glob is expanded after this check, so what it selects
        // (`.*` to `..`, `le*` to an outward symlink) is never seen. "*" is a
        // candidate nothing confines.
        if (/[*?[]/.test(raw.replace(/'[^']*'|"[^"]*"/g, ""))) out.push("*");
        const token = raw.replace(/["']/g, "");
        if (!endOfOptions && token === "--") {
            endOfOptions = true;
        } else if (endOfOptions || !_isFlag(token)) {
            if (patternPending) patternPending = false;
            else out.push(token);
        } else if (grep && /^(-e|--regexp)$/.test(token)) {
            i++;
        } else if (grep && /^(-f|--file)$/.test(token)) {
            out.push((argv[++i] ?? "").replace(/["']/g, ""));
        } else {
            // A dash-led token may itself be the value of the option before it
            // (`sort -o --/../x`), so one that contains `/` is a path too.
            if (token.includes("/")) out.push(token);
            const eq = token.indexOf("=");
            if (eq >= 0) out.push(token.slice(eq + 1));
            else if (!token.startsWith("--") && token.length > 2) out.push(token.slice(2));
        }
    }
    return out;
}

/** Stands in for the tree when the caller has none: absolute and `..` still escape it. */
const UNROOTED = path.resolve("/agent-config-unrooted");

function _confined(candidate: string, workingTree: string): boolean {
    if (candidate.startsWith("~") || candidate === "*") return false;
    return _reallyInside(candidate, workingTree.trim() ? workingTree : UNROOTED);
}

/** What the classifier decided, and whether a path confinement actually ran. */
export interface CategoryAVerdict {
    categoryA: boolean;
    confined: boolean;
}

const NOT_A: CategoryAVerdict = { categoryA: false, confined: false };

/** Non-flag token after the subcommand, or `""`. */
function _secondSubcommand(argv: readonly string[]): string {
    const nonFlags = argv.slice(1).filter((t) => !_isFlag(t));
    return nonFlags[1] ?? "";
}

/**
 * Does any token in the command name a consequence operation?
 *
 * Tokenised rather than substring-matched: a substring test would refuse
 * `git log --format=…` for containing `mat`, and a classifier that refuses
 * everything is indistinguishable from one that was never wired.
 */
export function namesConsequenceOperation(command: string): boolean {
    for (const raw of _argv(command)) {
        const token = raw.replace(/^-+/, "").toLowerCase();
        if (CONSEQUENCE_WORDS.has(token)) return true;
        // `npm:publish`, `db:seed`, `deploy:prod` — a namespaced script name
        // hides the consequential half behind a separator.
        for (const part of token.split(/[:/=,]/)) {
            if (part && CONSEQUENCE_WORDS.has(part)) return true;
        }
    }
    return false;
}

/** Does the head and its subcommand name a read, build, test or lint? */
function _namesASafeOperation(argv: readonly string[], head: string): boolean {
    if (SAFE_HEADS.has(head)) return true;

    if (head === "git") {
        const { sub, index } = _gitSubcommandAt(argv);
        if (!GIT_READ_SUBCOMMANDS.has(sub)) return false;
        return sub !== "branch" || _gitBranchOnlyObserves(argv, index);
    }

    const allowed = RUNNER_SUBCOMMANDS[head];
    if (!allowed) return false;
    const sub = _firstSubcommand(argv);
    if (!sub || !allowed.has(sub)) return false;
    if (SCRIPT_TAKING_SUBCOMMANDS.has(sub)) {
        const script = _secondSubcommand(argv);
        return script !== "" && SAFE_SCRIPT_NAMES.has(script.toLowerCase());
    }
    return true;
}

/**
 * Classify a Bash command string.
 *
 * `workingTree` is the root every path argument must resolve inside. Without
 * one, the command is judged against a stand-in root, so an absolute, `~` or
 * `..`-escaping argument still disqualifies it.
 */
export function bashCategoryAVerdict(command: string, workingTree = ""): CategoryAVerdict {
    if (typeof command !== "string" || !command.trim()) return NOT_A;
    if (SHELL_METACHARACTERS.test(command)) return NOT_A;
    if (namesConsequenceOperation(command)) return NOT_A;

    const argv = _argv(command);
    const head = (argv[0] ?? "").toLowerCase();
    if (!head) return NOT_A;
    if (!_namesASafeOperation(argv, head)) return NOT_A;

    if (NON_OPENING_HEADS.test(head)) return { categoryA: true, confined: false };
    const candidates = _pathArguments(argv, head);
    for (const candidate of candidates) {
        if (!_confined(candidate, workingTree)) return NOT_A;
    }
    return { categoryA: true, confined: candidates.length > 0 };
}

/** Is this Bash command string category A? */
export function isCategoryABashCommand(command: string, workingTree = ""): boolean {
    return bashCategoryAVerdict(command, workingTree).categoryA;
}

/**
 * Is this tool call category A?
 *
 * `workingTree` is the root every path argument must resolve inside. An empty
 * root means the dispatcher could not establish one, and an unestablished
 * boundary is not a boundary — the call is not category A.
 */
export function categoryAVerdict(
    toolName: string,
    toolInput: ToolInput,
    workingTree: string,
): CategoryAVerdict {
    if (!workingTree.trim()) return NOT_A;
    if (typeof toolName !== "string" || !toolName) return NOT_A;

    if (READ_ONLY_TOOLS.has(toolName)) {
        let checked = false;
        for (const key of PATH_KEYS) {
            const value = toolInput?.[key];
            if (typeof value !== "string") continue;
            if (!_reallyInside(value, workingTree)) return NOT_A;
            checked = true;
        }
        return { categoryA: true, confined: checked };
    }

    if (toolName === "Bash") {
        const command = toolInput?.["command"];
        return typeof command === "string" ? bashCategoryAVerdict(command, workingTree) : NOT_A;
    }

    return NOT_A;
}

/** Is this tool call category A? */
export function isCategoryA(toolName: string, toolInput: ToolInput, workingTree: string): boolean {
    return categoryAVerdict(toolName, toolInput, workingTree).categoryA;
}
