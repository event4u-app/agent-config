/**
 * FinishChecklist — the post-finish landing surface
 * (road-to-setup-experience § Phase 3.4). Replaces the dead-end success
 * banner with a getting-started checklist: verify the install, open the
 * config GUI, restart the editor. Commands are copyable via a per-row
 * copy button (clipboard API; falls back to select-on-click).
 */

import { useState } from 'preact/hooks';

interface ChecklistItem {
    title: string;
    detail: string;
    command?: string;
}

const ITEMS: readonly ChecklistItem[] = [
    {
        title: 'Restart your AI tools',
        detail: 'Editors and CLIs pick up the new skills, rules, and commands on their next start.',
    },
    {
        title: 'Verify the installation',
        detail: 'A read-only health report — scope, deployed files, drift.',
        command: 'agent-config doctor',
    },
    {
        title: 'Tune your settings any time',
        detail: 'Opens the configuration GUI (global settings; --project for a project).',
        command: 'agent-config config',
    },
    {
        title: 'Initialize a project',
        detail: 'Adds the minimal agents/ bridge + .gitignore block to a repository.',
        command: 'agent-config init --project',
    },
    {
        title: 'Stay up to date',
        detail: 'Upgrades the global install and additively syncs your settings.',
        command: 'agent-config upgrade',
    },
];

function CopyButton({ text }: { text: string }): preact.JSX.Element {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            class="ac-button ac-checklist__copy"
            onClick={(): void => {
                void navigator.clipboard?.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => { setCopied(false); }, 1500);
                });
            }}
        >
            {copied ? 'Copied ✓' : 'Copy'}
        </button>
    );
}

export function FinishChecklist({ message }: { message: string | null }): preact.JSX.Element {
    return (
        <div class="ac-checklist">
            <div class="ac-checklist__hero">
                <h2 class="ac-checklist__headline">Setup complete</h2>
                {message !== null ? <p class="ac-checklist__message">{message}</p> : null}
            </div>
            <ol class="ac-checklist__items">
                {ITEMS.map((item) => (
                    <li key={item.title} class="ac-checklist__item">
                        <div class="ac-checklist__text">
                            <span class="ac-checklist__item-title">{item.title}</span>
                            <span class="ac-checklist__item-detail">{item.detail}</span>
                        </div>
                        {item.command !== undefined ? (
                            <div class="ac-checklist__cmd-row">
                                <code class="ac-checklist__cmd">{item.command}</code>
                                <CopyButton text={item.command} />
                            </div>
                        ) : null}
                    </li>
                ))}
            </ol>
            <p class="ac-checklist__close-hint">
                You can close this browser window — the local server shuts
                down on its own.
            </p>
        </div>
    );
}
