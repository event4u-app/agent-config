/**
 * ContinueScreen — hard-stop handoff after the install-only lead
 * (ai-tools / roles / packs), before "Editor and tooling". The project
 * `modules` step is no longer part of this lead; it sits at the end of
 * the flow (before Review), so it is reached after the settings section.
 *
 * road-to-wizard-ux-improvements § Phase 6: this is a presentational "Step 3.5"
 * screen. The wizard footer drives the actions — **Next** acknowledges and
 * reveals "Editor and tooling" (same index); **Finish install here** sits in
 * the footer like Skip and jumps to the Review step (write
 * `.agent-settings.yml` with the install-only selections, skip the rest). The
 * old in-body "Continue with setup" / "Finish install here" buttons were
 * removed — Next replaces the former.
 *
 * Setup mode never sees this screen (`wizardMode === 'setup'` is checked in
 * `WizardPage.tsx` before the body renderer dispatches).
 */

export function ContinueScreen(): preact.JSX.Element {
    return (
        <section class="ac-continue-screen" aria-labelledby="ac-continue-title">
            <h2 id="ac-continue-title">Install complete — continue with setup?</h2>
            <p>
                Your install selections (AI tools, roles, capability packs)
                are captured. Use the footer to continue:
            </p>
            <ul>
                <li>
                    <strong>Next</strong> — go through the remaining
                    personalisation steps: editor + tooling, personality, cost
                    profile, roadmap &amp; quality, memory, your
                    <code> .agent-user.yml</code>, and finally the project
                    module roots.
                </li>
                <li>
                    <strong>Finish install here</strong> — skip the rest and
                    write <code>.agent-settings.yml</code> with the install-only
                    selections. You can re-run <code>agent-config setup</code>
                    later to pick up the personalisation steps.
                </li>
            </ul>
        </section>
    );
}
