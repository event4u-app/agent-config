/**
 * ContinueScreen — hard-stop handoff after install Step 3 (modules).
 *
 * road-to-unified-setup § Phase B5. Install mode runs three install-only
 * steps (ai-tools / packs / modules) then renders this screen with a
 * single CTA pair: "Continue with setup" advances to Step 4 (identity);
 * "Finish install here" jumps to the Review step so the user can write
 * `.agent-settings.yml` without touching the remaining settings.
 *
 * Setup mode never sees this screen — its `wizardMode === 'setup'` signal
 * is checked in `WizardPage.tsx` before the body renderer dispatches.
 */

interface ContinueScreenProps {
    busy: boolean;
    onContinue: () => void;
    onFinishHere: () => void;
}

export function ContinueScreen(props: ContinueScreenProps): preact.JSX.Element {
    return (
        <section class="ac-continue-screen" aria-labelledby="ac-continue-title">
            <h2 id="ac-continue-title">Install complete — continue with setup?</h2>
            <p>
                The three install steps (AI tools, capability packs, module
                roots) are captured. You can keep going through the remaining
                personalisation steps now, or stop here and re-run
                <code> agent-config setup </code>
                later to pick them up.
            </p>
            <ul>
                <li>
                    <strong>Continue with setup</strong> — 6 more steps:
                    editor + tooling, personality, cost profile,
                    roadmap &amp; quality, memory, your <code>.agent-user.yml</code>.
                </li>
                <li>
                    <strong>Finish install here</strong> — jumps to the
                    Review step. You can write
                    <code> .agent-settings.yml </code>
                    with the install-only selections and skip the rest.
                </li>
            </ul>
            <div class="ac-continue-screen__actions">
                <button
                    type="button"
                    class="ac-button ac-button--primary"
                    disabled={props.busy}
                    onClick={(): void => props.onContinue()}
                >
                    Continue with setup
                </button>
                <button
                    type="button"
                    class="ac-button"
                    disabled={props.busy}
                    onClick={(): void => props.onFinishHere()}
                >
                    Finish install here
                </button>
            </div>
        </section>
    );
}
