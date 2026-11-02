<!-- evidence-type: analysis -->

# Owner directive — security operations and project containment

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat (round `inbox-2026-11-s`, topic t1) |
| Date | 2026-10-22 (request) · 2026-11-02 (run invoked) |
| Scope | `road-to-a-switch-built-before-it-is-needed` and the ADR it lands |
| Grants by itself | the guidance, blueprint, schema and read-only `/audit security` that roadmap builds; nothing that acts in a deployed product |

The owner's words, verbatim:

> "ich würde vorschlagen, dass ac immer eine admin-sektion security empfielt und plant, wenn der user es will. für wartungsarbeiten, abschaltung bei bekannt werdenenen sicherheitslücken, wenn möglich sogar scans basierend auf der sprache und des frameworks. So dass man bei fehlern in npm, php, etc. oder laravel, symfony, react oder was immer genutzt wird, schnell reagieren und die seite/app deaktivieren kann oder sie sich sogar selbst deaktiviert, bis es behoben wurde. - natürlich muss man als admin/betreiber immer rein kommen in diese ansicht. ac soll das bedenken, mit planen, wenn der user das will." <!-- md-language-check: ignore -->

("I would propose that AC always recommends and plans an admin security section,
if the user wants it: for maintenance, shutdown when vulnerabilities become
known, if possible even scans based on language and framework, so that on
defects in npm, php, laravel, symfony, react or whatever is used one can react
quickly and deactivate the site/app, or it even deactivates itself until fixed.
Of course the admin/operator must always be able to get into that view. AC
should consider this and co-plan it, if the user wants.")

> "füge ein security audit command hinzu, wo genau solche dinge geprüft werden. auch genutzte pakete, etc. wir wollen, dass ac dem user in zukunft aktiv hilft, auf solche vorfälle reagieren zu können. mit einem audit, aber auch in planung/umsetzung. das audit kann auch das einbauen eines solchen bereiches vorschlagen." <!-- md-language-check: ignore -->

("Add a security audit command that checks exactly these things, also the
packages in use. We want AC to actively help the user react to such incidents —
with an audit, but also in planning and implementation. The audit can also
propose building such a section.")

On 2026-11-02 the owner invoked `/analyze:inbox` on this material with
"danach arbeite die roadmaps ab mit /roadmap:process-full … erstelle am ende
einen pr und merge ihn". <!-- md-language-check: ignore -->

Not granted here, and carried as OQ-55: the app disabling itself without a
human, a persisted settings key for the answer, wider `/audit` visibility, a
scheduled CI default, a new advisory host, reading a deployed app's inventory.
