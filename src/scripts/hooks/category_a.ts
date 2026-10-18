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
 * `git branch` options that can lose a ref: delete, force-reset, and the
 * move/copy forms that overwrite an existing name.
 *
 * `-m`/`--move` onto a NEW name loses nothing, but whether the target exists
 * is a fact about the repository, and this classifier is decidable from the
 * envelope alone. So every move is withdrawn: the cost is the host's own
 * confirmation on a rename, never a skipped one on a lost ref.
 */
const GIT_BRANCH_REF_LOSS_LONG: ReadonlySet<string> = new Set(["--delete", "--force", "--move"]);
const GIT_BRANCH_REF_LOSS_SHORT = /^-[a-zA-Z]*[dDfMCm]/;

function _gitBranchLosesARef(argv: readonly string[], index: number): boolean {
    for (const token of argv.slice(index + 1)) {
        if (token.startsWith("--")) {
            if (GIT_BRANCH_REF_LOSS_LONG.has(token.split("=")[0] as string)) return true;
        } else if (GIT_BRANCH_REF_LOSS_SHORT.test(token)) {
            return true;
        }
    }
    return false;
}

/**
 * Heads that never open their arguments, so a path-shaped argument is a string
 * and confining it would only put a prompt on `echo /tmp`.
 */
const NON_OPENING_HEADS: ReadonlySet<string> = new Set([
    "pwd", "echo", "basename", "dirname", "date", "which",
]);

/**
 * Output-writing flags (0.3). Their target is a path like any other, and
 * the walk below already confines all three spellings that need no table:
 * a separate token (`--output x`, `-fprint x`, `--outDir x`) is a
 * positional, `--output=x` is an inline value, and the value-less writers
 * (`--write`/`-w`, `--fix`) write their positionals. The one spelling the walk
 * cannot see is a short flag with its value glued on, `sort -o/path`, which
 * reads as a single flag token — so that is the only table.
 */
const GLUED_OUTPUT_FLAGS: Readonly<Record<string, string>> = { sort: "-o" };

/** Pattern-taking heads whose first positional is data, not a path. */
const PATTERN_HEADS: ReadonlySet<string> = new Set(["grep", "rg"]);
const PATTERN_VALUE_FLAGS: ReadonlySet<string> = new Set(["-e", "--regexp"]);
const PATTERN_FILE_FLAGS: ReadonlySet<string> = new Set(["-f", "--file"]);

/** Shell quote removal; every other expansion is refused by the metacharacter rule. */
function _unquote(token: string): string {
    return token.replace(/["']/g, "");
}

/**
 * Could this value name a place outside the tree? A relative value with no `..`
 * segment cannot, so only these shapes are worth resolving in a flag value.
 */
function _pathShaped(value: string): boolean {
    return value.startsWith("/") || value.startsWith("~") || value.split("/").includes("..");
}

/**
 * Every argument of a Bash command that names a filesystem location.
 *
 * Positionals are all candidates — a relative positional that stays inside is
 * harmless to check, and missing one is not. A flag's inline value is a
 * candidate when it is path-shaped, and a glued output value always is.
 */
function _pathArguments(argv: readonly string[], head: string): string[] {
    const out: string[] = [];
    const glued = GLUED_OUTPUT_FLAGS[head];
    const isPatternHead = PATTERN_HEADS.has(head);
    let patternPending = isPatternHead && !argv.some((t) => {
        const flag = t.split("=")[0] as string;
        return PATTERN_VALUE_FLAGS.has(flag) || PATTERN_FILE_FLAGS.has(flag);
    });
    for (let i = 1; i < argv.length; i++) {
        const token = _unquote(argv[i] as string);
        if (!_isFlag(token)) {
            if (patternPending) {
                patternPending = false;
                continue;
            }
            out.push(token);
            continue;
        }
        const eq = token.indexOf("=");
        const flag = eq >= 0 ? token.slice(0, eq) : token;
        const inline = eq >= 0 ? token.slice(eq + 1) : null;
        if (isPatternHead && PATTERN_VALUE_FLAGS.has(flag)) {
            if (inline === null) i++;
            continue;
        }
        if (isPatternHead && PATTERN_FILE_FLAGS.has(flag)) {
            const value = inline ?? argv[++i];
            if (value !== undefined) out.push(_unquote(value));
            continue;
        }
        if (glued && token.startsWith(glued) && token.length > glued.length && !token.startsWith("--")) {
            out.push(token.slice(glued.length));
            continue;
        }
        if (inline !== null && _pathShaped(inline)) out.push(inline);
    }
    return out;
}

/** Stands in for the tree when the caller has none: absolute and `..` still escape it. */
const UNROOTED = path.resolve("/", "agent-config-unrooted-working-tree");

function _confined(candidate: string, workingTree: string): boolean {
    if (candidate.startsWith("~")) return false;
    return isInsideWorkingTree(candidate, workingTree.trim() ? workingTree : UNROOTED);
}

/** What the classifier decided, and whether a path confinement actually ran. */
export interface CategoryAVerdict {
    categoryA: boolean;
    confinementChecked: boolean;
}

const NOT_A: CategoryAVerdict = { categoryA: false, confinementChecked: false };

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
        return !(sub === "branch" && _gitBranchLosesARef(argv, index));
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

    if (NON_OPENING_HEADS.has(head)) return { categoryA: true, confinementChecked: false };
    const candidates = _pathArguments(argv, head);
    for (const candidate of candidates) {
        if (!_confined(candidate, workingTree)) return NOT_A;
    }
    return { categoryA: true, confinementChecked: candidates.length > 0 };
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
            if (!isInsideWorkingTree(value, workingTree)) return NOT_A;
            checked = true;
        }
        return { categoryA: true, confinementChecked: checked };
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
