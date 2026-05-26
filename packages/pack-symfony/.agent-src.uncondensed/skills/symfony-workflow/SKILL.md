---
name: symfony-workflow
description: "Writes Symfony PHP — DI container, bundles, Doctrine, Messenger, Security voters, console commands. For Laravel / Eloquent / Artisan use `laravel`. For framework-free PHP use `php-coder`."
source: package
domain: engineering
workspaces:
  - engineering
packs:
  - symfony
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---

# symfony-workflow

## When to use

Use this skill for all Symfony-specific code generation and editing tasks, especially when working with:

- Controllers (annotated / attribute-routed)
- Request listeners / event subscribers
- Services and Dependency Injection (`services.yaml`)
- Forms and validators
- Doctrine entities, repositories, and migrations
- Security: firewalls, voters, authenticators
- Messenger handlers and transports
- Console commands
- Bundles, compiler passes, and tagged services
- Twig templates and view logic

This skill extends the base `php-coder` skill and applies Symfony conventions on top of the project's general PHP rules.

## When to use the analysis sibling

When the task is **understanding** how a Symfony app boots, wires its container, routes requests, or fails at runtime — defer to `project-analysis-symfony` first, then return here for the edit. This skill assumes the kernel/container layout is already known.

## Procedure: write Symfony code

→ **First apply the `php-coder` skill** for general PHP rules.

Then add these **Symfony-specific** checks:

1. **Confirm Symfony** — `bin/console` exists, `composer.json` lists `symfony/framework-bundle`.
2. **Confirm version** — `composer.lock` for the framework-bundle major. 5.x → 6.x → 7.x differs in attribute routing, voter signatures, and Messenger DSN shape.
3. **Inspect app structure** — standard, modular (`src/Module/<Name>/`), or DDD-style. Do not enforce a layout the project does not use.
4. **Check config layout** — `config/packages/<env>/`, `services.yaml` autowiring vs explicit bindings, `config/bundles.php`.
5. **Check test conventions** — PHPUnit/Codeception; unit vs integration vs functional split.

## Core Symfony principles

- Follow Symfony conventions unless the project explicitly does otherwise.
- Keep controllers thin — delegate to services.
- Rely on autowiring + autoconfigure unless the project has explicit bindings.
- Prefer attributes over annotations on 6.x+; keep annotations only if the codebase still uses them.
- Use service IDs by FQCN — `App\Service\Foo`, not custom string IDs.
- Services are private by default; do not flip `public: true` to make tests pass.
- Do not bypass the container with `new` on classes that have collaborators.

## HTTP layer rules

- Controllers:
    - extend `AbstractController` only when the project does
    - accept `Request` or a DTO; delegate business logic; return a `Response` variant
- Use `#[Route]` attributes on 6.x+; YAML routes only where the project already does.
- Use `#[MapRequestPayload]` / `#[MapQueryString]` (7.x+) for request DTOs when the project uses them.
- Validate via Symfony Validator on the DTO, not inline in the controller.
- Use `ParamConverter` / argument resolvers for entities only when the project uses them.

## Validation rules

- Symfony Validator with constraints on DTOs / entities.
- Prefer attribute constraints (`#[Assert\NotBlank]`, `#[Assert\Email]`) on 6.x+.
- Render errors from `ConstraintViolationListInterface` — never compose error arrays by hand.
- Validation is declarative; do not put domain validation in entity setters.

## Service layer and DI rules

- One responsibility per service; constructor injection.
- Interfaces when there are multiple implementations or the boundary is mocked.
- Tagged services for collecting implementations — `#[AutoconfigureTag]` or YAML tags, never an injected array of FQCNs.
- Decorators via `#[AsDecorator]` (6.1+); respect priority.
- Compiler passes only when wiring cannot be expressed via attributes/YAML.
- Do not call `Container::get` in application code.

## Routing rules

- Follow the existing organization — attributes on controllers, or YAML in `config/routes/`.
- Route names: `<resource>_<action>` (`user_show`, `invoice_list`).
- `#[IsGranted]`, `#[RateLimit]` at the route level, not inside the controller body.
- `requirements:` for path parameter constraints; do not validate in the controller.

## Response rules

- Match the project's response style: Twig, `JsonResponse`, API Platform, or redirects with flash.
- For APIs: consistent status codes; `ConstraintViolationList` → `application/problem+json`; DTOs / serializer groups, not raw entities.
- Do not return entities directly unless the project consistently does that.

## Messenger and async work

- Messenger for async/deferred work; one message class per intent.
- Handlers: `MessageHandlerInterface` (5.x) or `#[AsMessageHandler]` (6.x+).
- Route via `framework.messenger.routing` in `config/packages/messenger.yaml`.
- Configure `failure_transport` explicitly — without it, failed messages disappear.
- Pass IDs, not entities; the consumer re-fetches.

## Events and subscribers

- `#[AsEventListener]` (6.1+) or `EventSubscriberInterface` — match the project's convention.
- Past-tense event names (`UserRegistered`, `OrderPaid`); one side-effect per subscriber.
- Respect priority on `kernel.request` / `kernel.response` — wrong priority is a frequent bug source.

## Security, voters, authorization

- One firewall per surface in `config/packages/security.yaml` (main, API, admin).
- Voters for object-level permissions; never role checks in templates or controllers.
- `#[IsGranted]` on actions; `$this->isGranted()` only when the result drives downstream logic.
- Stateless APIs: token-based authenticator, not form-login.

## Config and environment

- Read via `ParameterBagInterface` or `#[Autowire(param: ...)]` — never `$_ENV` directly.
- New env vars in `.env` (+ `.env.test`); production values in deployment config.
- Bundle config under `config/packages/<bundle>.yaml`; env overrides under `config/packages/<env>/`.

## Doctrine and persistence

- Doctrine ORM unless the project uses DBAL/raw SQL by convention.
- Repositories for non-trivial queries; no inline QueryBuilder in controllers/services.
- N+1 awareness: fetch joins via `addSelect` or `EAGER` when always needed.
- Transactions via `EntityManager::wrapInTransaction()` for multi-write atomicity.
- Lifecycle hooks (`PreFlush`, `PostUpdate`) — no domain logic there unless the project already does.

## Migrations

- Generate via `doctrine:migrations:diff`; review before commit.
- Reversible — implement `up()` and `down()`.
- One concern per migration; destructive prod changes split into expand → migrate → contract.

## Twig

- Templates are dumb — presentation only; pre-computed view models from the controller/service.
- Reuse via `{% extends %}` / `{% include %}` / macros.
- Auto-escape on; `|raw` only when content is provably safe.

## Bundles and compiler passes

- Bundles are for reusable, redistributable code — not "another folder".
- Compiler passes only when wiring cannot be expressed via attributes/YAML.

## Console commands

- `#[AsCommand]` (6.x+); one command class per intent; constructor injection.
- Long-running: `--limit`, `--time-limit`, graceful `SIGTERM` shutdown.
- Output via `OutputInterface` — never `echo`.

## Output format

1. Symfony code following framework conventions and project architecture.
2. All related files (controller, service, DTO, repository, test, config) as needed.
3. Schema changes — migration file plus updated entity/mapping.

## Do NOT

- Business logic in controllers, entities, listeners, or Twig.
- Bypass the container with `new` on classes with collaborators.
- `$_ENV` / `$_SERVER` direct access — go through the parameter bag.
- Return Doctrine entities from an API endpoint — use DTOs or serializer groups.
- Silently swallow Messenger failures — route to a failure transport.
- Flip services `public: true` to make tests pass — use the test container.
- Pass entities through Messenger — pass IDs.
- Mix attribute and YAML routing for the same controller surface.

## Gotcha

- Autowiring fails silently when two implementations exist without explicit binding — read the error, don't just flip `public: true`.
- `#[IsGranted]` is a no-op if the controller is not a service (autoconfigure handles it by default).
- Messenger `failure_transport` is opt-in; without it, failures vanish.
- Compiled container changes need `cache:clear` in `prod` before debugging "config not applied".
- Symfony 7.x removed deprecated APIs — verify `composer.lock` before assuming 6.x patterns work.
