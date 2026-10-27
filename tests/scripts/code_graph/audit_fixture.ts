import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { writeProvenanceFixture } from './provenance_fixture.js';

/** Subjects of every commit the audit fixture writes — none may reach a committed map file. */
export const AUDIT_SUBJECTS = ['chore: init', 'add orders', 'Merge pull request #7 from acme/ABC-12-orders', 'feat: status (#9)', 'docs: note AC-1 holds', 'refactor: rename status migration (#11)'] as const;

/** The migration's path after the rename commit, and before it. */
export const RENAMED_MIGRATION = { from: 'database/migrations/2026_10_02_000000_add_status_to_orders_table.php', to: 'database/migrations/2026_10_02_000000_add_order_status.php' } as const;

/**
 * The audit fixture: the provenance history (a merge PR, a squash `feat: status (#9)`)
 * plus a squash that renames the status migration without changing its content.
 */
export function writeAuditFixture(): string {
    const root = writeProvenanceFixture();
    const git = (...args: string[]): void => {
        execFileSync('git', args, {
            cwd: root,
            stdio: 'ignore',
            env: { ...process.env, GIT_AUTHOR_NAME: 'Dev One', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev One', GIT_COMMITTER_EMAIL: 'dev@example.com', GIT_AUTHOR_DATE: '2026-10-03T10:00:00Z', GIT_COMMITTER_DATE: '2026-10-03T10:00:00Z' },
        });
    };
    fs.mkdirSync(path.join(root, path.dirname(RENAMED_MIGRATION.to)), { recursive: true });
    git('mv', RENAMED_MIGRATION.from, RENAMED_MIGRATION.to);
    git('commit', '-qm', AUDIT_SUBJECTS[5]);
    return root;
}
