/**
 * BackupScreen — pre-Step-1 surface for v3 → v4 migration.
 *
 * road-to-unified-setup § Phase E2 (Council Finding #21). Rendered
 * BEFORE the rest of the wizard when `GET /api/v1/install/legacy-v3`
 * reports `present: true`. Two CTAs:
 *
 *   - **Backup v3 and proceed** — POST `/api/v1/install/backup-v3`,
 *     copies `~/.event4u/agent-config/` to `…/agent-config.v3.bak/`,
 *     then dismisses the screen so the install can land cleanly.
 *   - **Abort, uninstall v3 first** — closes the wizard tab; the
 *     operator is responsible for the manual cleanup.
 *
 * No silent overwrite path. The default CTA (and the only one that
 * advances) is the backup-and-proceed flow.
 */

interface BackupScreenProps {
    sourcePath: string;
    backupTarget: string;
    version: string | null;
    busy: boolean;
    error: string | null;
    onBackupAndProceed: () => void;
    onAbort: () => void;
}

export function BackupScreen(props: BackupScreenProps): preact.JSX.Element {
    const versionCopy = props.version ?? 'unknown';
    return (
        <section class="ac-backup-screen" aria-labelledby="ac-backup-title">
            <h2 id="ac-backup-title">Existing v3 install detected</h2>
            <p>
                Found a v3.x install at <code>{props.sourcePath}</code>{' '}
                (VERSION: <code>{versionCopy}</code>). v4 is a hard-cut
                release with no auto-migration — settings, identity, and
                history layouts changed. The wizard can back up the v3
                tree before writing the v4 layout so you can roll back
                manually if needed.
            </p>
            {props.error !== null
                ? (
                    <p class="ac-banner ac-banner--error">
                        Backup failed: {props.error}
                    </p>
                )
                : null}
            <ul>
                <li>
                    <strong>Backup v3 and proceed</strong> — copies the
                    tree to <code>{props.backupTarget}</code>, then runs
                    the v4 install. Restore later with
                    <code> mv {props.backupTarget} {props.sourcePath}</code>.
                </li>
                <li>
                    <strong>Abort, uninstall v3 first</strong> — closes
                    the wizard. You decide what to keep.
                </li>
            </ul>
            <div class="ac-backup-screen__actions">
                <button
                    type="button"
                    class="ac-button ac-button--primary"
                    disabled={props.busy}
                    onClick={(): void => props.onBackupAndProceed()}
                >
                    {props.busy ? 'Backing up…' : 'Backup v3 and proceed'}
                </button>
                <button
                    type="button"
                    class="ac-button"
                    disabled={props.busy}
                    onClick={(): void => props.onAbort()}
                >
                    Abort, uninstall v3 first
                </button>
            </div>
        </section>
    );
}
