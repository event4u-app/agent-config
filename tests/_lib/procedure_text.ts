// A run procedure is its core plus the branch files it points at
// (road-to-a-step-that-costs-what-it-changes 3.1). A test pinning what a
// procedure SAYS reads all of it; a test pinning what the core alone carries
// reads the core file directly.
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const EXEC = 'src/agent-src/contexts/execution';

export const PROCEDURE_BRANCHES: Readonly<Record<string, readonly string[]>> = {
    'src/agent-src/contexts/execution/roadmap-process-loop.md': [
        `${EXEC}/roadmap-process-loop-prescan.md`,
        `${EXEC}/roadmap-process-loop-set.md`,
        `${EXEC}/roadmap-process-loop-run.md`,
        `${EXEC}/roadmap-process-loop-close.md`,
    ],
    'src/domains/product-basic/roadmap/process-full/command.md': [
        `${EXEC}/process-full-all.md`,
        `${EXEC}/process-full-delivery.md`,
    ],
    'src/domains/git/pr/create/command.md': [
        `${EXEC}/pr-create-branches-freshness.md`,
        `${EXEC}/pr-create-branches-content.md`,
    ],
    'src/domains/git/pr/merge/command.md': [`${EXEC}/pr-merge-sync.md`, `${EXEC}/pr-merge-queue.md`],
    'src/agent-src/contexts/execution/roadmap-execution-contract.md': [
        `${EXEC}/roadmap-execution-contract-branches.md`,
    ],
};

/** The core followed by its branch files, joined by a blank line. */
export function procedureText(rel: string): string {
    return [rel, ...(PROCEDURE_BRANCHES[rel] ?? [])]
        .map((p) => fs.readFileSync(path.join(ROOT, p), 'utf8'))
        .join('\n\n');
}
