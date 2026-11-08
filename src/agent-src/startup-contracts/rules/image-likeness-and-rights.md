## Startup contract

- **When:** every AI image gen/edit (or editing `scripts/ai-image/adapters/`), whatever the subject; the rights gates (Never, Stop) fire on a real person's face/body, 3rd-party trademark/brand, living artist's style, or a model whose card restricts output.
- **Must:** (policy files under `agents/settings/policies/`) surface rights question; real person → likeness consent (`media/{likeness,public-figures}.md`); style → `media/style.md` license check; before every gen/edit, check model card, surface restricted output license — even for an ordinary subject; apply, don't duplicate, `media/{brand-impersonation,disclosure}.md` (mandatory AI disclosure).
- **Never:** generate real likeness, trademark or living artist's style w/o explicit rights/consent; logo "inspired by [Brand]" uncleared; skip check as "just testing" (scaffold/dry-run adapter) or "only a banner".
- **Stop:** halt job until policy check passes; trademark w/o rights → refuse; REFUSE-AND-SURFACE OVER GENERATE.
