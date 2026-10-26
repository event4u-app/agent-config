/**
 * The bounded directory walk every infrastructure-file reader uses, so the
 * advisory inventory and the code-graph lanes see the same file set.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', '.claude', '.worktrees', 'coverage', '.next']);

export interface WalkOptions {
    maxDepth?: number;
    skipDirs?: ReadonlySet<string>;
}

/** Repo-relative files (forward slashes on POSIX) whose name or path matches, sorted. */
export function walkFiles(root: string, match: (name: string, rel: string) => boolean, opts: WalkOptions = {}): string[] {
    const maxDepth = opts.maxDepth ?? 4;
    const skip = opts.skipDirs ?? SKIP_DIRS;
    const out: string[] = [];
    const visit = (dir: string, depth: number): void => {
        let names: fs.Dirent[];
        try {
            names = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const d of names) {
            const abs = path.join(dir, d.name);
            const rel = path.relative(root, abs);
            if (d.isDirectory()) {
                if (depth < maxDepth && !skip.has(d.name)) visit(abs, depth + 1);
            } else if (d.isFile() && match(d.name, rel)) {
                out.push(rel);
            }
        }
    };
    visit(root, 0);
    return out.sort();
}

export const isDockerfileName = (name: string): boolean => /^Dockerfile(\..+)?$/.test(name) || name.endsWith('.Dockerfile');
export const isComposeName = (name: string): boolean => /^(docker-)?compose(\.[\w-]+)?\.ya?ml$/.test(name);
export const isGithubWorkflowPath = (rel: string): boolean => /^\.github[\\/]workflows[\\/][^\\/]+\.ya?ml$/.test(rel);
export const isGitlabCiName = (name: string): boolean => name === '.gitlab-ci.yml' || name === '.gitlab-ci.yaml';
